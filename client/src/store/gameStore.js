import { create } from 'zustand'
import {
  createScannerState,
  activateScanners,
  armScanner as armScannerMachine,
  tickScanners,
} from '../../../shared/scannerPuzzle.js'

// The chained puzzle state (stage 1 = P1 Decoupled Power Grid, stage 2 = P2
// Tri-Vector Hand Scanners). The server owns this shape authoritatively in
// multiplayer; solo mode runs the IDENTICAL machines locally — P2 through the
// same shared/scannerPuzzle.js module the server executes.
function freshPuzzleState(cipher) {
  return {
    stage: 1,
    p1: {
      cipher,
      currentSwitches: { red: false, blue: false, green: false, yellow: false },
      solved: false,
    },
    p2: createScannerState(),
  }
}

const SCANNER_FAIL_TOASTS = {
  'failed-window': 'SCAN WINDOW MISSED — ARRAY LOCKOUT ENGAGED',
  'rejected-lockout': 'SCANNER ARRAY IN LOCKOUT — STAND BY',
  'rejected-locked': 'SCANNER ARRAY OFFLINE — SYNC THE POWER GRID FIRST',
}

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

  puzzleState: freshPuzzleState(['red', 'blue', 'green']),

  // Multiplayer emitters registered by useMultiplayer so puzzle actions can
  // route to the authoritative server without components juggling the socket.
  netEmitters: null,
  registerNetEmitters: (emitters) => set({ netEmitters: emitters }),

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

  toggleSwitch: (color) => {
    const state = get();
    // Multiplayer: the server owns puzzle truth — emit and let the
    // authoritative room-state broadcast update us (Pillar D: no local solve).
    if (!state.isSolo) {
      state.netEmitters?.toggleSwitch?.(color);
      return;
    }

    set((s) => {
      const { p1 } = s.puzzleState;
      if (s.puzzleState.stage !== 1 || p1.solved) return {};
      const currentSwitches = { ...p1.currentSwitches, [color]: !p1.currentSwitches[color] };

      // Solo P1 validation (same rule the server applies): exactly the
      // cipher's colors active, nothing else.
      const match =
        p1.cipher.every((c) => currentSwitches[c]) &&
        Object.keys(currentSwitches).every((c) => !currentSwitches[c] || p1.cipher.includes(c));

      if (!match) {
        return { puzzleState: { ...s.puzzleState, p1: { ...p1, currentSwitches } } };
      }

      // P1 solved → the chain advances: stage 2, scanner array powers up.
      // No win here anymore — escape now runs through the 1 → 2 chain.
      setTimeout(() => {
        get().showToast('POWER GRID SYNCED — TRI-VECTOR SCANNER ARRAY ONLINE');
      }, 400);
      return {
        puzzleState: {
          stage: 2,
          p1: { ...p1, currentSwitches, solved: true },
          p2: activateScanners(s.puzzleState.p2),
        },
      };
    });
  },

  // Puzzle 2 (Tri-Vector Hand Scanners). `role` is the acting character's
  // role — the caller resolves who is acting; the shared machine enforces the
  // rules (identical to the server's). Solo runs it locally; multiplayer
  // emits and trusts only the server's broadcast.
  armScanner: (role) => {
    const state = get();
    if (!state.isSolo) {
      state.netEmitters?.armScanner?.();
      return null;
    }
    const { puzzleState } = state;
    if (puzzleState.stage !== 2) return null;
    const { state: p2, result } = armScannerMachine(puzzleState.p2, role, Date.now());
    set({ puzzleState: { ...puzzleState, p2 } });

    if (result === 'solved') {
      setTimeout(() => set({ gamePhase: 'win' }), 1000);
    } else if (SCANNER_FAIL_TOASTS[result]) {
      state.showToast(SCANNER_FAIL_TOASTS[result]);
    }
    return result;
  },

  // Solo time-advance for P2 (latch expiry, lockout cooldown) — mirrors the
  // server's 30 Hz tick. Called from the scene at a modest cadence.
  tickScannerPuzzle: (now = Date.now()) => {
    const state = get();
    if (!state.isSolo || state.puzzleState.stage !== 2) return;
    const prev = state.puzzleState.p2;
    const next = tickScanners(prev, now);
    if (next === prev) return;
    set({ puzzleState: { ...state.puzzleState, p2: next } });
    if (next.status === 'lockout' && prev.status !== 'lockout') {
      state.showToast('SCAN LATCH EXPIRED — ARRAY LOCKOUT ENGAGED');
    }
  },

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
    puzzleState: freshPuzzleState(
      state.isSolo ? shuffle(['red', 'blue', 'green', 'yellow']).slice(0, 3) : ['red', 'blue', 'green']
    ),
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

