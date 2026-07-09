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

  // --- Puzzle 3 (Laser Deflection Array) store wiring ---------------------

  // Walk the solo store through P1 and P2 so stage 3 is live.
  const soloToStage3 = () => {
    useGameStore.getState().setIsSolo(true)
    useGameStore.getState().resetGame()
    useGameStore.getState().setGamePhase('playing')
    const { cipher } = useGameStore.getState().puzzleState.p1
    for (const color of cipher) useGameStore.getState().toggleSwitch(color)
    for (const role of ['engineer', 'technician', 'overseer']) {
      useGameStore.getState().armScanner(role)
    }
  }

  it('solo P1 solve carries p3 forward (a literal puzzleState here would drop it)', () => {
    // Regression: the stage-2 transition rebuilt puzzleState as an object
    // literal, silently deleting p3 — every solo run then threw at stage 3.
    useGameStore.getState().setIsSolo(true)
    useGameStore.getState().resetGame()
    useGameStore.getState().setGamePhase('playing')
    const { cipher } = useGameStore.getState().puzzleState.p1
    for (const color of cipher) useGameStore.getState().toggleSwitch(color)

    const { puzzleState } = useGameStore.getState()
    expect(puzzleState.stage).toBe(2)
    expect(puzzleState.p3).toBeDefined()
    expect(puzzleState.p3.status).toBe('locked') // still gated behind P2
  })

  it('solo P2 solve advances to stage 3 and powers the laser array — it does NOT win', () => {
    soloToStage3()
    const { puzzleState, gamePhase } = useGameStore.getState()
    expect(puzzleState.stage).toBe(3)
    expect(puzzleState.p2.solved).toBe(true)
    expect(puzzleState.p3.status).toBe('active')
    expect(gamePhase).toBe('playing') // win now requires the full 1 → 2 → 3 chain
  })

  it('solo P3 actions are rejected before stage 3 (chain order is enforced)', () => {
    useGameStore.getState().setIsSolo(true)
    useGameStore.getState().resetGame()
    useGameStore.getState().setGamePhase('playing')
    expect(useGameStore.getState().puzzleState.stage).toBe(1)
    expect(useGameStore.getState().steerEmitter(1)).toBeNull()
    expect(useGameStore.getState().rotateMirror(0, 1)).toBeNull()
    expect(useGameStore.getState().openAperture()).toBeNull()
  })

  it('solo P3: the three role actions drive the shared machine', () => {
    soloToStage3()
    const before = useGameStore.getState().puzzleState.p3

    expect(useGameStore.getState().openAperture()).toBe('opened')
    expect(useGameStore.getState().puzzleState.p3.apertureOpenedAt).not.toBeNull()

    expect(useGameStore.getState().steerEmitter(1)).toBe('steered')
    expect(useGameStore.getState().puzzleState.p3.emitterStep).toBe(before.emitterStep + 1)

    expect(useGameStore.getState().rotateMirror(1, 1)).toBe('rotated')
    expect(useGameStore.getState().puzzleState.p3.mirrorSteps[1]).toBe(
      (before.mirrorSteps[1] + 1) % 72
    )
  })

  it('online P3 actions emit to the server and NEVER solve locally (Pillar D)', () => {
    soloToStage3()
    const snapshot = useGameStore.getState().puzzleState.p3
    const calls = []
    useGameStore.getState().setIsSolo(false)
    useGameStore.getState().registerNetEmitters({
      steerEmitter: (dir) => calls.push(['steer', dir]),
      rotateMirror: (i, dir) => calls.push(['rotate', i, dir]),
      openAperture: () => calls.push(['open']),
    })

    useGameStore.getState().steerEmitter(-1)
    useGameStore.getState().rotateMirror(2, 1)
    useGameStore.getState().openAperture()

    expect(calls).toEqual([['steer', -1], ['rotate', 2, 1], ['open']])
    // The local machine was not advanced — only the server's broadcast may.
    expect(useGameStore.getState().puzzleState.p3).toBe(snapshot)
    expect(useGameStore.getState().gamePhase).toBe('playing')
  })

  it('should set safe spawn heights upon resetting the game', () => {
    useGameStore.getState().resetGame()
    const players = useGameStore.getState().players
    
    expect(players['player-1'].position[1]).toBe(1.2)
    expect(players['player-2'].position[1]).toBe(1.2)
    expect(players['player-3'].position[1]).toBe(1.2)
  })
})
