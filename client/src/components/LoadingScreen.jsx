import { useProgress } from '@react-three/drei'

export const LoadingScreen = () => {
  const { progress } = useProgress()

  return (
    <div className="overlay-screen" style={{ zIndex: 500 }}>
      <h1 className="overlay-title" style={{ fontSize: '2rem' }}>BOOTING SECTOR-9 COMMAND DECK</h1>
      <p className="overlay-subtitle" style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Loading core reactor parameters...</p>
      
      <div className="loading-bar-container">
        <div className="loading-bar-fill" style={{ width: `${progress}%` }}></div>
      </div>
      
      <div style={{
        fontFamily: 'var(--font-hud)',
        fontSize: '0.85rem',
        color: 'var(--neon-cyan)',
        textShadow: '0 0 5px var(--neon-cyan-glow)'
      }}>
        {Math.round(progress)}%
      </div>
    </div>
  )
}
export default LoadingScreen
