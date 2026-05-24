// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const gameLoop = require('./gameLoop');
const puzzleEngine = require('./puzzleEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow connections from Vite client
    methods: ['GET', 'POST']
  }
});

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

  socket.on('create-room', ({ name, role }) => {
    if (!checkRateLimit(socket.id)) return;
    
    // Generate a unique 4-letter room code
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    const room = gameLoop.createRoom(roomId);
    
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

  socket.on('toggle-switch', ({ color }) => {
    if (!currentRoomId) return;
    const room = gameLoop.getRoom(currentRoomId);
    if (!room || room.phase !== 'playing') return;

    // Only allow toggle if user role is technician or engineer (optional, but keep simple)
    const player = room.players[socket.id];
    if (!player) return;

    const currentSwitches = room.puzzleState.currentSwitches;
    if (currentSwitches[color] !== undefined) {
      currentSwitches[color] = !currentSwitches[color];
    }

    // Server-side validation
    const isSolved = puzzleEngine.validatePuzzle(room.puzzleState);
    if (isSolved) {
      room.puzzleState.solved = true;
      room.phase = 'win';
    }

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
