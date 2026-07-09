import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { useGameStore } from '../store/gameStore'

let socket = null

export const useMultiplayer = () => {
  const isSolo = useGameStore((state) => state.isSolo)
  const setMyPlayerId = useGameStore((state) => state.setMyPlayerId)
  const setPlayers = useGameStore((state) => state.setPlayers)
  const setRoomId = useGameStore((state) => state.setRoomId)
  const setGamePhase = useGameStore((state) => state.setGamePhase)
  const setTimer = useGameStore((state) => state.setTimer)
  const setPuzzleState = useGameStore((state) => state.setPuzzleState)
  const showToast = useGameStore((state) => state.showToast)
  
  const lastEmitTime = useRef(0)

  useEffect(() => {
    if (isSolo) {
      if (socket) {
        socket.disconnect()
        socket = null
      }
      return
    }

    // Connect to Socket.io server
    // ⚠️  NGROK TESTING ONLY - This connection strategy should be reverted after ngrok testing
    // Socket.IO will auto-connect to the current origin (same host/port) when no URL provided.
    // This allows the client (served by Express) to connect to the server on the same origin,
    // whether that's localhost:3001 or https://your-ngrok-url.ngrok-free.dev
    socket = io(undefined, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socket.on('connect', () => {
      setMyPlayerId(socket.id)
      showToast('Connected to server')
    })

    socket.on('disconnect', () => {
      showToast('Disconnected from server')
    })

    socket.on('room-state', (roomState) => {
      // roomState format: { id, players: { [id]: player }, puzzleState, timer, phase }
      setTimer(roomState.timer)
      setGamePhase(roomState.phase)
      setPuzzleState(roomState.puzzleState)

      // Update positions of other players (excluding ourselves to allow prediction)
      const currentPlayers = useGameStore.getState().players
      const updatedPlayers = { ...currentPlayers }

      Object.keys(roomState.players).forEach((id) => {
        if (id === socket.id) {
          // Sync role or active state if needed, but not position
          if (updatedPlayers[id]) {
            updatedPlayers[id].isReady = roomState.players[id].isReady
          } else {
            updatedPlayers[id] = roomState.players[id]
          }
        } else {
          // Remote player - update position, rotation, and details
          updatedPlayers[id] = roomState.players[id]
        }
      })

      // Clean up players that left
      Object.keys(updatedPlayers).forEach((id) => {
        if (!roomState.players[id] && id !== 'player-1' && id !== 'player-2' && id !== 'player-3') {
          delete updatedPlayers[id]
        }
      })

      setPlayers(updatedPlayers)
    })

    socket.on('joined-room', ({ roomId, playerId, players }) => {
      setRoomId(roomId)
      setMyPlayerId(playerId)
      setPlayers(players)
      setGamePhase('lobby')
      showToast(`Joined room: ${roomId}`)
    })

    socket.on('player-joined', ({ name, role }) => {
      showToast(`${name} joined as ${role}`)
    })

    socket.on('player-left', ({ name }) => {
      showToast(`${name} left the room`)
    })

    socket.on('error-msg', (msg) => {
      showToast(msg)
    })

    // Puzzle 2: per-attempt arm feedback for THIS client (authoritative
    // result — the room-state broadcast carries the state itself).
    socket.on('scanner-result', ({ result }) => {
      const messages = {
        'failed-window': 'SCAN WINDOW MISSED — ARRAY LOCKOUT ENGAGED',
        'rejected-lockout': 'SCANNER ARRAY IN LOCKOUT — STAND BY',
        'rejected-locked': 'SCANNER ARRAY OFFLINE — SYNC THE POWER GRID FIRST',
        solved: 'TRI-VECTOR LOCK CONFIRMED',
      }
      if (messages[result]) showToast(messages[result])
    })

    // Puzzle 3: per-action laser feedback for THIS client (authoritative
    // result — the room-state broadcast carries the state itself).
    socket.on('laser-result', ({ result }) => {
      const messages = {
        'rejected-lockout': 'DEFLECTION ARRAY IN LOCKOUT — STAND BY',
        'rejected-locked': 'DEFLECTION ARRAY OFFLINE — CLEAR THE SCANNER GATE FIRST',
        'rejected-limit': 'EMITTER GIMBAL AT ITS STOP',
        solved: 'BEAM LOCKED ON RECEIVER — BLAST DOOR RELEASED',
      }
      if (messages[result]) showToast(messages[result])
    })

    // Route store puzzle actions to the authoritative server (Pillar D:
    // components call store actions; the store never solves locally online).
    // The server resolves role and position from its OWN player record, so
    // these payloads carry only the action's parameters, never identity.
    useGameStore.getState().registerNetEmitters({
      toggleSwitch: (color) => socket.emit('toggle-switch', { color }),
      armScanner: () => socket.emit('arm-scanner', {}),
      steerEmitter: (dir) => socket.emit('steer-emitter', { dir }),
      rotateMirror: (index, dir) => socket.emit('rotate-mirror', { index, dir }),
      openAperture: () => socket.emit('open-aperture', {}),
    })

    return () => {
      useGameStore.getState().registerNetEmitters(null)
      if (socket) {
        socket.disconnect()
        socket = null
      }
    }
    // Mount-only socket wiring, re-run only when solo/multiplayer mode flips.
    // The zustand setters and showToast are stable references, so listing them
    // would not change behaviour — only add churn. Deliberately excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSolo])

  const joinRoom = (roomId, name, role) => {
    if (socket) {
      socket.emit('join-room', { roomId, name, role })
    }
  }

  const createRoom = (name, role) => {
    if (socket) {
      socket.emit('create-room', { name, role })
    }
  }

  const emitMovement = (position, rotation) => {
    if (!socket || isSolo) return
    
    // Throttle emits to ~20Hz (every 50ms) to save bandwidth
    const now = Date.now()
    if (now - lastEmitTime.current > 50) {
      socket.emit('move', { position, rotation })
      lastEmitTime.current = now
    }
  }

  const emitToggleSwitch = (color) => {
    if (socket && !isSolo) {
      socket.emit('toggle-switch', { color })
    }
  }

  const emitReady = () => {
    if (socket && !isSolo) {
      socket.emit('player-ready')
    }
  }

  const emitResetGame = () => {
    if (socket && !isSolo) {
      socket.emit('reset-game')
    }
  }

  return {
    joinRoom,
    createRoom,
    emitMovement,
    emitToggleSwitch,
    emitReady,
    emitResetGame,
    socket
  }
}
