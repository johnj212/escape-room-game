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

    // Connect to Socket.io server (port 3001)
    socket = io('http://localhost:3001', {
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

    socket.on('player-joined', ({ id, name, role }) => {
      showToast(`${name} joined as ${role}`)
    })

    socket.on('player-left', ({ id, name }) => {
      showToast(`${name} left the room`)
    })

    socket.on('error-msg', (msg) => {
      showToast(msg)
    })

    return () => {
      if (socket) {
        socket.disconnect()
        socket = null
      }
    }
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
