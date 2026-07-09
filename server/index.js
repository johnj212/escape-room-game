// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const gameLoop = require('./gameLoop');
const puzzleEngine = require('./puzzleEngine');
const {
  armScanner,
  activateScanners,
  SCANNER_POSITIONS,
  SCANNER_RANGE,
} = require('../shared/scannerPuzzle.js');
const {
  activateLaser,
  steerEmitter,
  rotateMirror,
  openAperture,
  EMITTER_POS,
  RECEIVER_POS,
  STATION_RANGE,
  MIRROR_COUNT,
  LASER_ROLES,
} = require('../shared/laserPuzzle.js');

// P1 switchboard console position ([x, z]) — same forgiving radius as the P2 scanners.
// Only the technician standing here may toggle a wire switch (Pillar D hardening).
const SWITCHBOARD_POSITION = [5, 0];
const SWITCHBOARD_RANGE = 3;

// XZ-plane distance gate shared by the switchboard and the P2 scanner consoles.
const inRangeXZ = (position, [px, pz], range) => {
  const dx = position[0] - px;
  const dz = position[2] - pz;
  return Math.sqrt(dx * dx + dz * dz) < range;
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow connections from Vite client
    methods: ['GET', 'POST']
  }
});

// ⚠️  NGROK TESTING ONLY - DELETE BEFORE COMMIT
// Serve built client files (client/dist) from Express root
// This allows single-server deployment for ngrok testing.
// For production, use a separate static file host or CDN.
const path = require('path');
app.use(express.static(path.join(__dirname, '../client/dist')));

// Simple Rate Limiter state
const socketActionTracker = {}; // { [socketId]: { count, timestamp } }

const checkRateLimit = (socketId) => {
  const now = Date.now();
  if (!socketActionTracker[socketId]) {
    socketActionTracker[socketId] = { count: 1, timestamp: now };
    return true;
  }

  const track = socketActionTracker[socketId];
  if (now - track.timestamp > 1000) {
    track.count = 1;
    track.timestamp = now;
    return true;
  }

  track.count += 1;
  // Max 60 events/second
  return track.count <= 60;
};

io.on('connection', (socket) => {
  let currentRoomId = null;

  socket.on('create-room', ({ name, role, seed }) => {
    if (!checkRateLimit(socket.id)) return;

    // Generate a unique 4-letter room code
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    // §1 determinism: an explicit seed (e.g. client's ?seed=N) is honoured verbatim;
    // otherwise gameLoop.createRoom mints a fresh random per-room seed.
    const explicitSeed = Number.isFinite(seed) ? seed : undefined;
    const room = gameLoop.createRoom(roomId, explicitSeed);

    joinRoomSocket(roomId, name, role);
  });

  socket.on('join-room', ({ roomId, name, role }) => {
    if (!checkRateLimit(socket.id)) return;
    const cleanRoomId = roomId.toUpperCase();
    const room = gameLoop.getRoom(cleanRoomId);

    if (!room) {
      socket.emit('error-msg', 'Room does not exist.');
      return;
    }

    if (room.phase !== 'lobby') {
      socket.emit('error-msg', 'Game is already in progress.');
      return;
    }

    const playersCount = Object.keys(room.players).length;
    if (playersCount >= 3) {
      socket.emit('error-msg', 'Room is full.');
      return;
    }

    // Role check
    const roleTaken = Object.values(room.players).some(p => p.role === role);
    if (roleTaken) {
      socket.emit('error-msg', `Role "${role}" is already taken.`);
      return;
    }

    joinRoomSocket(cleanRoomId, name, role);
  });

  const joinRoomSocket = (roomId, name, role) => {
    currentRoomId = roomId;
    socket.join(roomId);

    const room = gameLoop.getRoom(roomId);
    
    let spawnPosition = [0, 1.2, 0];
    if (role === 'engineer') spawnPosition = [-3, 1.2, -2];
    if (role === 'technician') spawnPosition = [3, 1.2, -2];
    if (role === 'overseer') spawnPosition = [-2, 1.2, 4];

    room.players[socket.id] = {
      id: socket.id,
      name: name || `Player ${Object.keys(room.players).length + 1}`,
      role,
      position: spawnPosition,
      rotation: 0,
      isReady: false
    };

    socket.emit('joined-room', {
      roomId,
      playerId: socket.id,
      players: room.players
    });

    socket.to(roomId).emit('player-joined', {
      id: socket.id,
      name: room.players[socket.id].name,
      role
    });
    
    // Broadcast updated room state immediately
    io.to(roomId).emit('room-state', room);
  };

  socket.on('move', ({ position, rotation }) => {
    if (!checkRateLimit(socket.id)) return;
    if (!currentRoomId) return;

    const room = gameLoop.getRoom(currentRoomId);
    if (!room || room.phase !== 'playing') return;

    const player = room.players[socket.id];
    if (!player) return;

    // Simple anti-cheat: velocity capping
    const dx = position[0] - player.position[0];
    const dy = position[1] - player.position[1];
    const dz = position[2] - player.position[2];
    const distanceSquared = dx * dx + dy * dy + dz * dz;

    // In a 50ms window (default emit rate), max movement should not exceed 2 units
    // (Translates to a speed limit of 40 units/sec)
    if (distanceSquared > 4) {
      // Flag suspicious movement, reset to last good position
      socket.emit('error-msg', 'Cheat detected: Movement too fast');
      return;
    }

    player.position = position;
    player.rotation = rotation;
  });

  socket.on('player-ready', () => {
    if (!currentRoomId) return;
    gameLoop.updatePlayerReady(currentRoomId, socket.id);
  });

  socket.on('reset-game', () => {
    if (!currentRoomId) return;
    gameLoop.resetRoom(currentRoomId);
  });

  socket.on('toggle-switch', ({ color }) => {
    if (!checkRateLimit(socket.id)) return;
    if (!currentRoomId) return;
    const room = gameLoop.getRoom(currentRoomId);
    if (!room || room.phase !== 'playing') return;

    // P1 only, and only while it's still the active stage.
    if (room.puzzleState.stage !== 1 || room.puzzleState.p1.solved) return;

    const player = room.players[socket.id];
    if (!player) return;

    // Pillar D hardening: role AND server-known position are authoritative — never trust
    // the client. Only the technician standing at the switchboard may toggle.
    if (player.role !== 'technician') {
      socket.emit('error-msg', 'Only the technician may operate the switchboard.');
      return;
    }
    if (!inRangeXZ(player.position, SWITCHBOARD_POSITION, SWITCHBOARD_RANGE)) {
      socket.emit('error-msg', 'Too far from the switchboard.');
      return;
    }

    const currentSwitches = room.puzzleState.p1.currentSwitches;
    if (currentSwitches[color] !== undefined) {
      currentSwitches[color] = !currentSwitches[color];
    }

    // Server-side validation
    const isSolved = puzzleEngine.validatePuzzle(room.puzzleState.p1);
    if (isSolved) {
      room.puzzleState.p1.solved = true;
      room.puzzleState.stage = 2;
      room.puzzleState.p2 = activateScanners(room.puzzleState.p2);
      // phase stays 'playing' — the chain continues into P2.
    }

    io.to(currentRoomId).emit('room-state', room);
  });

  socket.on('arm-scanner', () => {
    if (!checkRateLimit(socket.id)) return;
    if (!currentRoomId) return;
    const room = gameLoop.getRoom(currentRoomId);
    if (!room || room.phase !== 'playing') return;
    if (room.puzzleState.stage !== 2) return;

    // Role is resolved from the server's own player record — never trusted from the
    // client payload (there is no payload at all for this event, by design).
    const player = room.players[socket.id];
    if (!player) return;

    const scannerPos = SCANNER_POSITIONS[player.role];
    if (!scannerPos || !inRangeXZ(player.position, scannerPos, SCANNER_RANGE)) {
      socket.emit('error-msg', 'Too far from your scanner.');
      return;
    }

    const { state, result } = armScanner(room.puzzleState.p2, player.role, Date.now());
    room.puzzleState.p2 = state;
    if (result === 'solved') {
      // P2 solved advances the chain into P3 — it no longer wins the game.
      // Only the P3 laser solve (steer-emitter / rotate-mirror / open-aperture,
      // or the clock-driven tick) sets phase = 'win'.
      room.puzzleState.stage = 3;
      room.puzzleState.p3 = activateLaser(room.puzzleState.p3);
    }

    socket.emit('scanner-result', { result });
    io.to(currentRoomId).emit('room-state', room);
  });

  // ---------------------------------------------------------------------
  // P3 — Laser Deflection Array. Role and position are always resolved from
  // the server's own room.players[socket.id] record, never trusted from the
  // client payload — mirrors the arm-scanner pattern exactly.
  // ---------------------------------------------------------------------

  socket.on('steer-emitter', ({ dir }) => {
    if (!checkRateLimit(socket.id)) return;
    if (!currentRoomId) return;
    const room = gameLoop.getRoom(currentRoomId);
    if (!room || room.phase !== 'playing') return;
    if (room.puzzleState.stage !== 3) return;

    const player = room.players[socket.id];
    if (!player) return;

    if (player.role !== LASER_ROLES.emitter) {
      socket.emit('error-msg', 'Only the engineer may steer the emitter.');
      return;
    }
    if (!inRangeXZ(player.position, EMITTER_POS, STATION_RANGE)) {
      socket.emit('error-msg', 'Too far from the emitter.');
      return;
    }

    // Sanitise dir server-side: only +1 or -1 survive; anything non-finite is rejected.
    if (!Number.isFinite(dir) || dir === 0) {
      socket.emit('error-msg', 'Invalid steering direction.');
      return;
    }
    const safeDir = Math.sign(dir);

    const { state, result } = steerEmitter(room.puzzleState.p3, safeDir, Date.now());
    room.puzzleState.p3 = state;
    if (result === 'solved') {
      room.phase = 'win';
    }

    socket.emit('laser-result', { result });
    io.to(currentRoomId).emit('room-state', room);
  });

  socket.on('rotate-mirror', ({ index, dir }) => {
    if (!checkRateLimit(socket.id)) return;
    if (!currentRoomId) return;
    const room = gameLoop.getRoom(currentRoomId);
    if (!room || room.phase !== 'playing') return;
    if (room.puzzleState.stage !== 3) return;

    const player = room.players[socket.id];
    if (!player) return;

    if (player.role !== LASER_ROLES.mirror) {
      socket.emit('error-msg', 'Only the technician may rotate the mirrors.');
      return;
    }

    // Reject early with error-msg rather than relying solely on the shared
    // machine's own guard (defense in depth, per spec).
    if (!Number.isInteger(index) || index < 0 || index >= MIRROR_COUNT) {
      socket.emit('error-msg', 'Invalid mirror index.');
      return;
    }

    const mirrorPos = room.puzzleState.p3.layout.mirrors[index]?.pos;
    if (!mirrorPos || !inRangeXZ(player.position, mirrorPos, STATION_RANGE)) {
      socket.emit('error-msg', 'Too far from that mirror.');
      return;
    }

    if (!Number.isFinite(dir) || dir === 0) {
      socket.emit('error-msg', 'Invalid rotation direction.');
      return;
    }
    const safeDir = Math.sign(dir);

    const { state, result } = rotateMirror(room.puzzleState.p3, index, safeDir, Date.now());
    room.puzzleState.p3 = state;
    if (result === 'solved') {
      room.phase = 'win';
    }

    socket.emit('laser-result', { result });
    io.to(currentRoomId).emit('room-state', room);
  });

  socket.on('open-aperture', () => {
    if (!checkRateLimit(socket.id)) return;
    if (!currentRoomId) return;
    const room = gameLoop.getRoom(currentRoomId);
    if (!room || room.phase !== 'playing') return;
    if (room.puzzleState.stage !== 3) return;

    const player = room.players[socket.id];
    if (!player) return;

    if (player.role !== LASER_ROLES.receiver) {
      socket.emit('error-msg', 'Only the overseer may open the aperture.');
      return;
    }
    if (!inRangeXZ(player.position, RECEIVER_POS, STATION_RANGE)) {
      socket.emit('error-msg', 'Too far from the receiver.');
      return;
    }

    const { state, result } = openAperture(room.puzzleState.p3, Date.now());
    room.puzzleState.p3 = state;
    if (result === 'solved') {
      room.phase = 'win';
    }

    socket.emit('laser-result', { result });
    io.to(currentRoomId).emit('room-state', room);
  });

  socket.on('disconnect', () => {
    delete socketActionTracker[socket.id];
    if (!currentRoomId) return;

    const room = gameLoop.getRoom(currentRoomId);
    if (!room) return;

    const player = room.players[socket.id];
    if (player) {
      socket.to(currentRoomId).emit('player-left', {
        id: socket.id,
        name: player.name
      });
      delete room.players[socket.id];
    }

    // Clean up room if empty
    if (Object.keys(room.players).length === 0) {
      gameLoop.deleteRoom(currentRoomId);
    } else {
      io.to(currentRoomId).emit('room-state', room);
    }
  });
});

// Start loop
gameLoop.initGameLoop(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.io Escape Room server running on port ${PORT}`);
});
