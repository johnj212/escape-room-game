import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../store/gameStore'

describe('Zustand Game Store', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame()
  })

  it('should initialize with correct default phase and roles', () => {
    const state = useGameStore.getState()
    expect(state.gamePhase).toBe('lobby')
    expect(state.players['player-1'].role).toBe('engineer')
    expect(state.players['player-2'].role).toBe('technician')
    expect(state.players['player-3'].role).toBe('overseer')
  })

  it('should prevent NaN positions from corrupting the player state', () => {
    const store = useGameStore.getState()
    
    // Initial safe coordinates
    const initialPos = [...store.players['player-1'].position]
    expect(initialPos).toEqual([-3, 1.2, -2])

    // Attempt to update with NaN coordinates
    useGameStore.getState().updatePlayerPosition('player-1', [NaN, 1.2, -2], 0)
    
    // Position should NOT change (should preserve the last good values)
    const currentPos = useGameStore.getState().players['player-1'].position
    expect(currentPos).toEqual(initialPos)
  })

  it('should prevent undefined or empty position arrays from corrupting state', () => {
    const store = useGameStore.getState()
    const initialPos = [...store.players['player-1'].position]

    // Attempt to update with empty/invalid positions
    useGameStore.getState().updatePlayerPosition('player-1', null, 0)
    useGameStore.getState().updatePlayerPosition('player-1', [], 0)

    const currentPos = useGameStore.getState().players['player-1'].position
    expect(currentPos).toEqual(initialPos)
  })

  it('should update position successfully with valid inputs', () => {
    useGameStore.getState().updatePlayerPosition('player-1', [-3.5, 1.2, -2.1], 1.5)
    const currentPos = useGameStore.getState().players['player-1'].position
    const currentRot = useGameStore.getState().players['player-1'].rotation
    
    expect(currentPos).toEqual([-3.5, 1.2, -2.1])
    expect(currentRot).toBe(1.5)
  })

  it('should toggle switches correctly and check for solution in solo mode', () => {
    // Reset state to ensure solo is true and we have clean switches
    useGameStore.getState().setIsSolo(true)
    useGameStore.getState().resetGame()
    
    const cipher = useGameStore.getState().puzzleState.cipher
    expect(cipher).toHaveLength(3)

    // Toggle a random color not in the cipher (e.g. yellow if it's not in, or check a direct toggle)
    const targetColor = 'red'
    const isRedInitiallyActive = useGameStore.getState().puzzleState.currentSwitches.red
    
    useGameStore.getState().toggleSwitch(targetColor)
    
    const isRedActiveNow = useGameStore.getState().puzzleState.currentSwitches.red
    expect(isRedActiveNow).toBe(!isRedInitiallyActive)
  })

  it('should set safe spawn heights upon resetting the game', () => {
    useGameStore.getState().resetGame()
    const players = useGameStore.getState().players
    
    expect(players['player-1'].position[1]).toBe(1.2)
    expect(players['player-2'].position[1]).toBe(1.2)
    expect(players['player-3'].position[1]).toBe(1.2)
  })
})
