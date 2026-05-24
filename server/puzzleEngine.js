// server/puzzleEngine.js

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = {
  createPuzzleState: () => {
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
  },

  validatePuzzle: (puzzleState) => {
    const { cipher, currentSwitches } = puzzleState;
    
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
