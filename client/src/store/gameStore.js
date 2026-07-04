import { create } from 'zustand'

export const useGameStore = create((set, get) => ({
  gamePhase: 'lobby', // 'lobby' | 'playing' | 'win' | 'lose'
  roomId: '',
  myPlayerId: '',
  activePlayerId: 'player-1', // Default active player in solo/multiplayer
  isSolo: true,
  timer: 900, // 15 mins
  toastMsg: '',
  
  // Roles: 'engineer' (Player 1), 'technician' (Player 2), 'overseer' (Player 3)
  players: {
    'player-1': { id: 'player-1', name: 'Engineer (P1)', role: 'engineer', position: [-3, 1.2, -2], rotation: 0, isReady: false },
    'player-2': { id: 'player-2', name: 'Technician (P2)', role: 'technician', position: [3, 1.2, -2], rotation: 0, isReady: false },
    'player-3': { id: 'player-3', name: 'Overseer (P3)', role: 'overseer', position: [-2, 1.2, 4], rotation: 0, isReady: false },
  },

  puzzleState: {
    cipher: ['red', 'blue', 'green'], // Wire color sequence Player 1 sees
    currentSwitches: {
      red: false,
      blue: false,
      green: false,
      yellow: false
    },
    solved: false
  },

  setGamePhase: (phase) => set({ gamePhase: phase }),
  setRoomId: (id) => set({ roomId: id }),
  setMyPlayerId: (id) => set({ myPlayerId: id }),
  setIsSolo: (solo) => set({ isSolo: solo }),
  
  setPlayers: (players) => set({ players }),
  
  updatePlayerPosition: (id, position, rotation) => set((state) => {
    if (!state.players[id]) return {};
    // Guard against NaN coordinates to prevent camera-follow black holes (must be exactly 3 coordinates)
    if (!position || position.length !== 3 || position.some(val => typeof val !== 'number' || isNaN(val))) {
      return {};
    }
    return {
      players: {
        ...state.players,
        [id]: {
          ...state.players[id],
          position,
          rotation
        }
      }
    }
  }),

  setActivePlayer: (id) => set((state) => {
    if (!state.players[id]) return {};
    return { activePlayerId: id };
  }),

  toggleSwitch: (color) => set((state) => {
    const currentSwitches = {
      ...state.puzzleState.currentSwitches,
      [color]: !state.puzzleState.currentSwitches[color]
    };
    
    // Evaluate solution locally for solo mode
    let solved = false;
    if (state.isSolo) {
      const cipher = state.puzzleState.cipher;
      
      // If we turned on EXACTLY the ones in the cipher, and in the correct count/order
      // For Puzzle 1 v0.1: order-independent active toggle check or sequence check
      // Let's do: all cipher colors must be active, and no other colors.
      const match = cipher.every(c => currentSwitches[c]) && 
                    Object.keys(currentSwitches).every(c => !currentSwitches[c] || cipher.includes(c));
      
      if (match) {
        solved = true;
        setTimeout(() => {
          set({ gamePhase: 'win' });
        }, 1000);
      }
    }

    return {
      puzzleState: {
        ...state.puzzleState,
        currentSwitches,
        solved
      }
    };
  }),

  setPuzzleState: (newPuzzleState) => set((state) => ({
    puzzleState: {
      ...state.puzzleState,
      ...newPuzzleState
    }
  })),

  decrementTimer: () => set((state) => {
    const nextTimer = state.timer - 1;
    if (nextTimer <= 0) {
      return { timer: 0, gamePhase: 'lose' };
    }
    return { timer: nextTimer };
  }),
  
  setTimer: (t) => set({ timer: t }),

  showToast: (msg) => {
    set({ toastMsg: msg });
    setTimeout(() => {
      if (get().toastMsg === msg) set({ toastMsg: '' });
    }, 3000);
  },

  resetGame: () => set((state) => ({
    gamePhase: 'lobby',
    timer: 900,
    toastMsg: '',
    puzzleState: {
      cipher: state.isSolo ? shuffle(['red', 'blue', 'green', 'yellow']).slice(0, 3) : ['red', 'blue', 'green'],
      currentSwitches: { red: false, blue: false, green: false, yellow: false },
      solved: false
    },
    players: {
      'player-1': { id: 'player-1', name: 'Engineer (P1)', role: 'engineer', position: [-3, 1.2, -2], rotation: 0, isReady: false },
      'player-2': { id: 'player-2', name: 'Technician (P2)', role: 'technician', position: [3, 1.2, -2], rotation: 0, isReady: false },
      'player-3': { id: 'player-3', name: 'Overseer (P3)', role: 'overseer', position: [-2, 1.2, 4], rotation: 0, isReady: false },
    }
  }))
}));

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

if (typeof window !== 'undefined') {
  window.useGameStore = useGameStore;
}

