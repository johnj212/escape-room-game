import { useState, useEffect, useRef } from 'react'
import { Monitor, Phone, Compass, Shield, User, Play, RefreshCw, Key, Power } from 'lucide-react'
import nipplejs from 'nipplejs'
import { useGameStore } from '../store/gameStore'
import lobbyBg from '../assets/sector_9_deck_1779639466019.png'

export const UIOverlays = ({ inputRef, joinRoom, createRoom, emitReady }) => {
  const gamePhase = useGameStore((state) => state.gamePhase)
  const roomId = useGameStore((state) => state.roomId)
  const players = useGameStore((state) => state.players)
  const activePlayerId = useGameStore((state) => state.activePlayerId)
  const setActivePlayer = useGameStore((state) => state.setActivePlayer)
  const isSolo = useGameStore((state) => state.isSolo)
  const setIsSolo = useGameStore((state) => state.setIsSolo)
  const timer = useGameStore((state) => state.timer)
  const toastMsg = useGameStore((state) => state.toastMsg)
  const myPlayerId = useGameStore((state) => state.myPlayerId)
  const resetGame = useGameStore((state) => state.resetGame)

  // Lobby states
  const [name, setName] = useState('')
  const [inputRoomId, setInputRoomId] = useState('')
  const [selectedRole, setSelectedRole] = useState('engineer') // 'engineer' | 'technician' | 'overseer'
  
  // Mobile check
  const isMobile = /Mobi|Android/i.test(navigator.userAgent)

  // Formatter for timer: seconds -> MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // Mobile virtual joystick initialization
  useEffect(() => {
    if (!isMobile || gamePhase !== 'playing') return

    const leftZone = document.getElementById('joystick-move-zone')
    const rightZone = document.getElementById('joystick-look-zone')

    let managerMove = null
    let managerLook = null

    if (leftZone) {
      managerMove = nipplejs.create({
        zone: leftZone,
        mode: 'static',
        position: { left: '75px', top: '75px' },
        color: '#00f3ff',
        size: 100
      })

      managerMove.on('move', (evt, data) => {
        if (data.vector) {
          const moveEvent = new CustomEvent('mobile-move', {
            detail: { x: data.vector.x, y: data.vector.y }
          })
          window.dispatchEvent(moveEvent)
        }
      })

      managerMove.on('end', () => {
        const moveEvent = new CustomEvent('mobile-move', {
          detail: { x: 0, y: 0 }
        })
        window.dispatchEvent(moveEvent)
      })
    }

    if (rightZone) {
      managerLook = nipplejs.create({
        zone: rightZone,
        mode: 'static',
        position: { right: '75px', top: '75px' },
        color: '#ff007f',
        size: 100
      })

      managerLook.on('move', (evt, data) => {
        if (data.vector) {
          const lookEvent = new CustomEvent('mobile-look', {
            detail: { x: data.vector.x, y: data.vector.y }
          })
          window.dispatchEvent(lookEvent)
        }
      })

      managerLook.on('end', () => {
        const lookEvent = new CustomEvent('mobile-look', {
          detail: { x: 0, y: 0 }
        })
        window.dispatchEvent(lookEvent)
      })
    }

    return () => {
      if (managerMove) managerMove.destroy()
      if (managerLook) managerLook.destroy()
    }
  }, [isMobile, gamePhase])

  // Trigger mobile interact click
  const handleMobileInteract = (active) => {
    const interactEvent = new CustomEvent('mobile-interact', {
      detail: { active }
    })
    window.dispatchEvent(interactEvent)
  }

  // 1. Lobby Screen
  if (gamePhase === 'lobby') {
    const lobbyPlayers = Object.values(players)
    const myPlayer = players[myPlayerId]

    return (
      <div className="overlay-screen" style={{
        backgroundImage: `linear-gradient(rgba(10, 11, 16, 0.7), rgba(5, 6, 10, 0.88)), url(${lobbyBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        <h1 className="overlay-title">Sector-9 Command Deck</h1>
        <p className="overlay-subtitle">Cyberpunk Multi-operator Escape Grid</p>

        <div className="glass-panel lobby-card">
          <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
            <button
              onClick={() => setIsSolo(true)}
              className={`cyber-button ${isSolo ? '' : 'secondary'}`}
              style={{ flex: 1, borderBottomRightRadius: 0, borderTopRightRadius: 0 }}
            >
              Play Offline (Solo Swapping)
            </button>
            <button
              onClick={() => setIsSolo(false)}
              className={`cyber-button ${!isSolo ? '' : 'secondary'}`}
              style={{ flex: 1, borderBottomLeftRadius: 0, borderTopLeftRadius: 0 }}
            >
              Play Online (Co-op Multiplayer)
            </button>
          </div>

          {!isSolo ? (
            // Multiplayer Config
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
              <div style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'Orbitron' }}>Operator Name</label>
                <input
                  type="text"
                  placeholder="Enter Name"
                  className="lobby-input"
                  style={{ width: '100%', marginTop: '5px', textAlign: 'left', fontSize: '0.95rem', letterSpacing: '1px' }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'Orbitron' }}>Choose System Role</label>
                <div className="lobby-role-selection">
                  <button
                    className={`lobby-role-btn role-engineer ${selectedRole === 'engineer' ? 'selected' : ''}`}
                    onClick={() => setSelectedRole('engineer')}
                  >
                    <Compass size={24} color="#00f3ff" />
                    <span>Engineer (P1)</span>
                  </button>
                  <button
                    className={`lobby-role-btn role-technician ${selectedRole === 'technician' ? 'selected' : ''}`}
                    onClick={() => setSelectedRole('technician')}
                  >
                    <Shield size={24} color="#ff007f" />
                    <span>Technician (P2)</span>
                  </button>
                  <button
                    className={`lobby-role-btn role-overseer ${selectedRole === 'overseer' ? 'selected' : ''}`}
                    onClick={() => setSelectedRole('overseer')}
                  >
                    <Monitor size={24} color="#ffdf00" />
                    <span>Overseer (P3)</span>
                  </button>
                </div>
              </div>

              {!roomId ? (
                // Not in room yet
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="cyber-button"
                    style={{ flex: 1 }}
                    onClick={() => createRoom(name, selectedRole)}
                    disabled={!name.trim()}
                  >
                    Create Grid
                  </button>
                  <div style={{ display: 'flex', flex: 1, gap: '5px' }}>
                    <input
                      type="text"
                      placeholder="GRID CODE"
                      className="lobby-input"
                      style={{ flex: 1, padding: '5px', fontSize: '0.9rem' }}
                      value={inputRoomId}
                      onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                    />
                    <button
                      className="cyber-button secondary"
                      onClick={() => joinRoom(inputRoomId, name, selectedRole)}
                      disabled={!name.trim() || !inputRoomId.trim()}
                    >
                      Join
                    </button>
                  </div>
                </div>
              ) : (
                // Inside room waiting lobby
                <div>
                  <div style={{
                    fontFamily: 'Orbitron',
                    fontSize: '1.2rem',
                    color: 'var(--neon-cyan)',
                    background: 'rgba(0,0,0,0.4)',
                    padding: '10px',
                    borderRadius: '6px',
                    marginBottom: '15px',
                    border: '1px solid var(--neon-cyan-glow)'
                  }}>
                    GRID SECURE: {roomId}
                  </div>

                  <h3 style={{ textAlign: 'left', fontSize: '0.8rem', fontFamily: 'Orbitron', marginBottom: '8px', color: 'var(--text-secondary)' }}>CONNECTED OPERATORS</h3>
                  <div className="lobby-player-list">
                    {lobbyPlayers.map((p) => (
                      <div key={p.id} className={`lobby-player-row ${p.isReady ? 'ready' : ''}`}>
                        <span style={{ fontSize: '0.9rem' }}>{p.name} ({p.role.toUpperCase()})</span>
                        <span style={{
                          fontFamily: 'Orbitron',
                          fontSize: '0.75rem',
                          color: p.isReady ? 'var(--neon-green)' : 'var(--text-secondary)'
                        }}>
                          {p.isReady ? 'READY' : 'WAITING'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    className="cyber-button"
                    style={{ width: '100%', marginTop: '10px' }}
                    onClick={emitReady}
                  >
                    {myPlayer?.isReady ? 'UNREADY' : 'STANDBY READY'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Solo Mode Config
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
              <div style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                Offline simulation active. You control exactly 3 characters. Use keys <span style={{ color: 'var(--neon-cyan)', fontWeight: 'bold' }}>1, 2, 3</span> or the HUD buttons at the bottom to switch active characters. Solve the Decoupled Power Grid.
              </div>
              <button
                className="cyber-button"
                onClick={() => {
                  // Direct transition to game
                  useGameStore.getState().setGamePhase('playing')
                }}
              >
                Launch Offline Reactor (Solo)
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 2. Play Screen / HUD Overlay
  return (
    <div className="hud-overlay">
      {/* HUD Top panel */}
      <div className="hud-top">
        <div className="hud-players-list">
          {Object.values(players).map((p) => (
            <div
              key={p.id}
              className={`hud-player-badge ${p.role} ${activePlayerId === p.id ? 'active-player' : ''}`}
            >
              <div className="hud-player-avatar-dot"></div>
              <span className="hud-player-role">
                {p.name} {activePlayerId === p.id && '(ACTIVE)'}
              </span>
            </div>
          ))}
        </div>

        <div className={`hud-timer ${timer < 60 ? 'warning' : ''}`}>
          <Power size={20} />
          {formatTime(timer)}
        </div>

        <div className="hud-objective">
          <div className="hud-objective-title">Current Objective</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {activePlayerId === 'player-1' ? (
              <span>Stand near the left hologram console to read the flashing security wire sequence.</span>
            ) : activePlayerId === 'player-2' ? (
              <span>Approach the right terminal and toggle matching wires to align power switches.</span>
            ) : (
              <span>Cooperate and direct actions across sectors. Swapping enabled.</span>
            )}
          </div>
        </div>
      </div>

      {/* Solo Active Avatar Selector (Center-Bottom) */}
      {isSolo && (
        <div className="hud-swap-panel">
          <button
            className={`hud-swap-btn engineer ${activePlayerId === 'player-1' ? 'active' : ''}`}
            onClick={() => setActivePlayer('player-1')}
          >
            1
          </button>
          <button
            className={`hud-swap-btn technician ${activePlayerId === 'player-2' ? 'active' : ''}`}
            onClick={() => setActivePlayer('player-2')}
          >
            2
          </button>
          <button
            className={`hud-swap-btn overseer ${activePlayerId === 'player-3' ? 'active' : ''}`}
            onClick={() => setActivePlayer('player-3')}
          >
            3
          </button>
        </div>
      )}

      {/* Mobile joysticks and action button overlays */}
      {isMobile && (
        <div className="mobile-controls">
          <div id="joystick-move-zone" className="joystick-zone joystick-left"></div>
          <div id="joystick-look-zone" className="joystick-zone joystick-right"></div>
          
          <button
            className="mobile-action-btn"
            onTouchStart={() => handleMobileInteract(true)}
            onTouchEnd={() => handleMobileInteract(false)}
          >
            USE
          </button>
        </div>
      )}

      {/* Game Over Screen (Win/Lose Modal) */}
      {(gamePhase === 'win' || gamePhase === 'lose') && (
        <div className="overlay-screen" style={{
          backgroundImage: `linear-gradient(rgba(10, 11, 16, 0.75), rgba(5, 6, 10, 0.9)), url(${lobbyBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}>
          <h1 className="overlay-title" style={{ color: gamePhase === 'win' ? '#39ff14' : '#ff3131' }}>
            {gamePhase === 'win' ? 'GRID SYNCHRONIZED' : 'REACTOR MELTDOWN'}
          </h1>
          <p className="overlay-subtitle">
            {gamePhase === 'win'
              ? 'Security override succeeded. Reactor core stabilized!'
              : 'Core failure critical. Escape pod launch systems offline.'}
          </p>
          <div className="glass-panel" style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <button className="cyber-button" onClick={resetGame}>
              <RefreshCw size={16} />
              Re-Initialize System
            </button>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toastMsg && <div className="toast">{toastMsg}</div>}
      
      {/* Mobile Portrait Warning Overlay */}
      <div className="portrait-warning">
        <div className="portrait-warning-title">Landscape Mode Required</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Please rotate your device horizontally to deploy control panels.
        </div>
      </div>
    </div>
  )
}
export default UIOverlays
