import { Suspense, useEffect, useState } from 'react'
import { useGameStore } from './store/gameStore'
import { usePlayerControls } from './hooks/usePlayerControls'
import { useMultiplayer } from './hooks/useMultiplayer'
import { GameCanvas } from './components/GameCanvas'
import { UIOverlays } from './components/UIOverlays'
import { LoadingScreen } from './components/LoadingScreen'
import { UnsupportedScreen } from './components/UnsupportedScreen'
import { detectWebGPUSupport } from './render/capability'

export default function App() {
  const gamePhase = useGameStore((state) => state.gamePhase)
  const decrementTimer = useGameStore((state) => state.decrementTimer)

  // WebGPU capability gate: null = probing, then the routing decision.
  // Sector-9 is WebGPU-only — non-WebGPU devices get the designed
  // unsupported screen, never the game and never a WebGL fallback.
  const [capability, setCapability] = useState(null)
  useEffect(() => {
    let live = true
    detectWebGPUSupport().then((result) => {
      if (live) setCapability(result)
    })
    return () => {
      live = false
    }
  }, [])

  // Initialize input listeners (ref pattern for low overhead inside useFrame)
  const inputRef = usePlayerControls()

  // Initialize Socket.io connection (automatically manages connection based on solo state)
  const { joinRoom, createRoom, emitMovement, emitReady, emitResetGame } = useMultiplayer()

  // Manage Game Tick countdown timer on client
  useEffect(() => {
    let timerInterval = null
    if (gamePhase === 'playing') {
      timerInterval = setInterval(() => {
        decrementTimer()
      }, 1000)
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval)
    }
  }, [gamePhase, decrementTimer])

  // Probe resolves in well under the 500 ms routing floor; a styled boot
  // frame covers the gap so the gate never shows as a raw black screen.
  if (capability === null) {
    return (
      <div className="overlay-screen">
        <p className="overlay-subtitle">PROBING RENDER CORE…</p>
      </div>
    )
  }
  if (!capability.supported) {
    return <UnsupportedScreen capability={capability} />
  }

  return (
    <div className="game-container">
      {/* 3D WebGL Scene wrapper */}
      <Suspense fallback={<LoadingScreen />}>
        {gamePhase !== 'lobby' && (
          <GameCanvas inputRef={inputRef} emitMovement={emitMovement} />
        )}
      </Suspense>

      {/* HTML Overlays (HUD, Lobby, Mobile sticks, modals) */}
      <UIOverlays
        inputRef={inputRef}
        joinRoom={joinRoom}
        createRoom={createRoom}
        emitReady={emitReady}
        emitResetGame={emitResetGame}
      />
    </div>
  )
}
