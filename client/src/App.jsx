import { Suspense, useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import { usePlayerControls } from './hooks/usePlayerControls'
import { useMultiplayer } from './hooks/useMultiplayer'
import { GameCanvas } from './components/GameCanvas'
import { UIOverlays } from './components/UIOverlays'
import { LoadingScreen } from './components/LoadingScreen'

export default function App() {
  const gamePhase = useGameStore((state) => state.gamePhase)
  const decrementTimer = useGameStore((state) => state.decrementTimer)

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
