// server/puzzleEngine.js
//
// Phase 2: the puzzle chain grows to P1 (wire cipher) → P2 (tri-vector scanners),
// shared/scannerPuzzle.js. Node 22 natively resolves require() of an ESM module,
// so we pull the P2 state machine in directly rather than duplicating its rules.
const { createScannerState } = require('../shared/scannerPuzzle.js');

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createP1State() {
  // Generate a random 3-wire combination out of 4 possible colors
  const colors = ['red', 'blue', 'green', 'yellow'];
  const cipher = shuffle(colors).slice(0, 3);

  return {
    cipher,
    currentSwitches: {
      red: false,
      blue: false,
      green: false,
      yellow: false
    },
    solved: false
  };
}

module.exports = {
  // Authoritative chained shape: { stage: 1|2, p1: {...}, p2: <scanner state> }.
  // p2 starts 'locked' (createScannerState default) until p1.solved activates it.
  createPuzzleState: () => {
    return {
      stage: 1,
      p1: createP1State(),
      p2: createScannerState()
    };
  },

  // Validates the P1 wire cipher only (unchanged rules, operates on the p1 sub-state).
  validatePuzzle: (p1State) => {
    const { cipher, currentSwitches } = p1State;

    // Check if the switches that are true match exactly the items in the cipher
    const activeSwitches = Object.keys(currentSwitches).filter(
      (color) => currentSwitches[color]
    );

    // Order independent check: active switches must equal cipher colors exactly
    const correctCount = activeSwitches.length === cipher.length;
    const allPresent = cipher.every((color) => currentSwitches[color]);

    return correctCount && allPresent;
  }
};
