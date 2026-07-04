import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

export const usePlayerControls = () => {
  const setActivePlayer = useGameStore((state) => state.setActivePlayer)
  const isSolo = useGameStore((state) => state.isSolo)
  
  const inputRef = useRef({
    forward: 0,
    backward: 0,
    left: 0,
    right: 0,
    interact: false,
    // Mobile joysticks
    joystickMove: { x: 0, y: 0 },
    joystickLook: { x: 0, y: 0 }
  })

  useEffect(() => {
    const handleKeyDown = (e) => {
      const inputs = inputRef.current
      
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          inputs.forward = 1
          break
        case 's':
        case 'arrowdown':
          inputs.backward = 1
          break
        case 'a':
        case 'arrowleft':
          inputs.left = 1
          break
        case 'd':
        case 'arrowright':
          inputs.right = 1
          break
        case 'e':
        case ' ':
          inputs.interact = true
          break
        case '1':
          if (isSolo) setActivePlayer('player-1')
          break
        case '2':
          if (isSolo) setActivePlayer('player-2')
          break
        case '3':
          if (isSolo) setActivePlayer('player-3')
          break
        default:
          break
      }
    }

    const handleKeyUp = (e) => {
      const inputs = inputRef.current
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          inputs.forward = 0
          break
        case 's':
        case 'arrowdown':
          inputs.backward = 0
          break
        case 'a':
        case 'arrowleft':
          inputs.left = 0
          break
        case 'd':
        case 'arrowright':
          inputs.right = 0
          break
        case 'e':
        case ' ':
          inputs.interact = false
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // Listen to mobile custom events
    const handleMobileMove = (e) => {
      inputRef.current.joystickMove = e.detail
    }
    const handleMobileLook = (e) => {
      inputRef.current.joystickLook = e.detail
    }
    const handleMobileInteract = (e) => {
      inputRef.current.interact = e.detail.active
    }

    window.addEventListener('mobile-move', handleMobileMove)
    window.addEventListener('mobile-look', handleMobileLook)
    window.addEventListener('mobile-interact', handleMobileInteract)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mobile-move', handleMobileMove)
      window.removeEventListener('mobile-look', handleMobileLook)
      window.removeEventListener('mobile-interact', handleMobileInteract)
    }
  }, [setActivePlayer, isSolo])

  return inputRef
}
