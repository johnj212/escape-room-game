import { describe, it, expect } from 'vitest'

// Mock basic Canvas and document API to run PBR checks cleanly under Node.js
if (typeof global.document === 'undefined') {
  const createMockCanvas = (w = 512, h = 512) => ({
    width: w,
    height: h,
    getContext: () => ({
      fillStyle: '',
      fillRect: () => {},
      lineWidth: 0,
      strokeStyle: '',
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      arc: () => {},
      fill: () => {},
      save: () => {},
      restore: () => {},
      strokeRect: () => {},
      getImageData: (x, y, width, height) => ({
        data: new Uint8ClampedArray((width || w) * (height || h) * 4)
      }),
      putImageData: () => {},
      createImageData: (width, height) => ({
        data: new Uint8ClampedArray((width || w) * (height || h) * 4)
      })
    })
  })

  global.document = {
    createElement: (tag) => {
      if (tag === 'canvas') return createMockCanvas()
      return {}
    }
  }
}

// Now safely import the texture generator functions
import { generateFloorTextures, generateWallTextures, generateReactorTextures } from '../utils/textureGenerator'

describe('Procedural PBR Textures', () => {
  it('should successfully export texture generator channels', () => {
    expect(generateFloorTextures).toBeTypeOf('function')
    expect(generateWallTextures).toBeTypeOf('function')
    expect(generateReactorTextures).toBeTypeOf('function')
  })

  it('should return valid THREE.CanvasTexture mapping channels for Floor', () => {
    const floorChannels = generateFloorTextures()
    expect(floorChannels).toHaveProperty('map')
    expect(floorChannels).toHaveProperty('normalMap')
    expect(floorChannels).toHaveProperty('roughnessMap')
    expect(floorChannels).toHaveProperty('metalnessMap')
    
    // Check that wrapping and repeats are initialized
    expect(floorChannels.map.repeat.x).toBe(5)
    expect(floorChannels.map.repeat.y).toBe(5)
  })

  it('should return valid mapping channels for Walls', () => {
    const wallChannels = generateWallTextures()
    expect(wallChannels).toHaveProperty('map')
    expect(wallChannels).toHaveProperty('normalMap')
    expect(wallChannels).toHaveProperty('roughnessMap')
    expect(wallChannels).toHaveProperty('metalnessMap')
    
    expect(wallChannels.map.repeat.x).toBe(4)
    expect(wallChannels.map.repeat.y).toBe(2)
  })

  it('should return valid mapping channels for the Reactor Core', () => {
    const reactorChannels = generateReactorTextures()
    expect(reactorChannels).toHaveProperty('map')
    expect(reactorChannels).toHaveProperty('normalMap')
    expect(reactorChannels).toHaveProperty('roughnessMap')
    expect(reactorChannels).toHaveProperty('metalnessMap')
  })
})
