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

    const cipher = useGameStore.getState().puzzleState.p1.cipher
    expect(cipher).toHaveLength(3)

    // Toggle a random color not in the cipher (e.g. yellow if it's not in, or check a direct toggle)
    const targetColor = 'red'
    const isRedInitiallyActive = useGameStore.getState().puzzleState.p1.currentSwitches.red

    useGameStore.getState().toggleSwitch(targetColor)

    const isRedActiveNow = useGameStore.getState().puzzleState.p1.currentSwitches.red
    expect(isRedActiveNow).toBe(!isRedInitiallyActive)
  })

  it('solo P1 solve advances the chain to stage 2 (scanners online) instead of winning', () => {
    useGameStore.getState().setIsSolo(true)
    useGameStore.getState().resetGame()
    useGameStore.getState().setGamePhase('playing')

    const { cipher } = useGameStore.getState().puzzleState.p1
    for (const color of cipher) useGameStore.getState().toggleSwitch(color)

    const { puzzleState, gamePhase } = useGameStore.getState()
    expect(puzzleState.p1.solved).toBe(true)
    expect(puzzleState.stage).toBe(2)
    expect(puzzleState.p2.status).toBe('active')
    expect(gamePhase).toBe('playing') // win now requires the full 1 → 2 chain
  })

  it('solo P2: three role arms inside the window solve; the store routes through the shared machine', () => {
    useGameStore.getState().setIsSolo(true)
    useGameStore.getState().resetGame()
    useGameStore.getState().setGamePhase('playing')
    const { cipher } = useGameStore.getState().puzzleState.p1
    for (const color of cipher) useGameStore.getState().toggleSwitch(color)

    // Swap-arm all three roles back-to-back (well inside the 3.0 s arm window).
    expect(useGameStore.getState().armScanner('engineer')).toBe('armed')
    expect(useGameStore.getState().armScanner('technician')).toBe('armed')
    expect(useGameStore.getState().armScanner('overseer')).toBe('solved')
    expect(useGameStore.getState().puzzleState.p2.solved).toBe(true)
  })

  it('solo P2 arming is rejected while stage 1 (chain order is enforced)', () => {
    useGameStore.getState().setIsSolo(true)
    useGameStore.getState().resetGame()
    useGameStore.getState().setGamePhase('playing')
    expect(useGameStore.getState().puzzleState.stage).toBe(1)
    expect(useGameStore.getState().armScanner('engineer')).toBeNull()
    expect(useGameStore.getState().puzzleState.p2.armedAt.engineer).toBeNull()
  })

  it('should set safe spawn heights upon resetting the game', () => {
    useGameStore.getState().resetGame()
    const players = useGameStore.getState().players
    
    expect(players['player-1'].position[1]).toBe(1.2)
    expect(players['player-2'].position[1]).toBe(1.2)
    expect(players['player-3'].position[1]).toBe(1.2)
  })
})
