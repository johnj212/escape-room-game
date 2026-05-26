// server/gameLoop.js
const puzzleEngine = require('./puzzleEngine');

const rooms = {}; // { [roomId]: roomState }
// roomState structure:
// {
//   id: string,
//   phase: 'lobby' | 'playing' | 'win' | 'lose',
//   timer: number,
//   players: { [id]: { id, name, role, position, rotation, isReady } },
//   puzzleState: { cipher, currentSwitches, solved }
// }

let ioRef = null;

const initGameLoop = (io) => {
  ioRef = io;
  
  // 30Hz tick loop (every ~33ms)
  setInterval(() => {
    Object.keys(rooms).forEach((roomId) => {
      const room = rooms[roomId];
      if (room.phase !== 'playing') return;

      // Decrement timer based on actual elapsed ticks (30Hz = 30 ticks per second)
      // For simplicity, we track time using seconds and tick decrements
      room.tickCounter = (room.tickCounter || 0) + 1;
      if (room.tickCounter >= 30) {
        room.tickCounter = 0;
        room.timer -= 1;
        if (room.timer <= 0) {
          room.timer = 0;
          room.phase = 'lose';
        }
      }

      // Broadcast room state to all sockets in the room
      io.to(roomId).emit('room-state', {
        id: room.id,
        phase: room.phase,
        timer: room.timer,
        players: room.players,
        puzzleState: room.puzzleState
      });
    });
  }, 1000 / 30);
};

const getRoom = (roomId) => rooms[roomId];

const createRoom = (roomId) => {
  rooms[roomId] = {
    id: roomId,
    phase: 'lobby',
    timer: 900, // 15 mins
    players: {},
    puzzleState: puzzleEngine.createPuzzleState(),
    tickCounter: 0
  };
  return rooms[roomId];
};

const deleteRoom = (roomId) => {
  delete rooms[roomId];
};

const updatePlayerReady = (roomId, socketId) => {
  const room = rooms[roomId];
  if (!room) return;

  if (room.players[socketId]) {
    room.players[socketId].isReady = !room.players[socketId].isReady;
  }

  // Check if all players are ready and there are exactly 3 players
  const playerIds = Object.keys(room.players);
  const allReady = playerIds.length === 3 && playerIds.every(id => room.players[id].isReady);

  if (allReady) {
    room.phase = 'playing';
    room.timer = 900;
  }

  ioRef.to(roomId).emit('room-state', room);
};

const resetRoom = (roomId) => {
  const room = rooms[roomId];
  if (!room) return;

  room.phase = 'lobby';
  room.timer = 900;
  room.tickCounter = 0;
  room.puzzleState = puzzleEngine.createPuzzleState();
  
  // Reset all players to unready and default spawn positions
  Object.keys(room.players).forEach((socketId) => {
    const player = room.players[socketId];
    player.isReady = false;
    
    let spawnPosition = [0, 1.2, 0];
    if (player.role === 'engineer') spawnPosition = [-3, 1.2, -2];
    if (player.role === 'technician') spawnPosition = [3, 1.2, -2];
    if (player.role === 'overseer') spawnPosition = [-2, 1.2, 4];
    
    player.position = spawnPosition;
    player.rotation = 0;
  });

  if (ioRef) {
    ioRef.to(roomId).emit('room-state', room);
  }
};

module.exports = {
  initGameLoop,
  getRoom,
  createRoom,
  deleteRoom,
  updatePlayerReady,
  resetRoom,
  rooms
};
