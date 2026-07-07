import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Component and Dependency Audits', () => {
  it('should ensure Player.jsx does not use colliders="capsule" on RigidBody due to Rapier runtime crashes', () => {
    const filePath = path.resolve(__dirname, '../components/Player.jsx')
    const content = fs.readFileSync(filePath, 'utf8')
    
    // Ensure we do not use the dynamic collider="capsule" property on <RigidBody>
    const hasDynamicCapsule = content.includes('colliders="capsule"')
    expect(hasDynamicCapsule).toBe(false)
    
    // Ensure we manually define the CapsuleCollider tag
    const hasCapsuleColliderTag = content.includes('<CapsuleCollider')
    expect(hasCapsuleColliderTag).toBe(true)
  })

  it('should ensure Room.jsx front wall is set to invisible to prevent camera blocking', () => {
    const filePath = path.resolve(__dirname, '../components/Room.jsx')
    const content = fs.readFileSync(filePath, 'utf8')
    
    // Verify front wall has visible={false} to let camera see inside the room
    const hasInvisibleFrontWall = content.includes('visible={false}')
    expect(hasInvisibleFrontWall).toBe(true)
  })

  it('should ensure the WebGPU-era dependency matrix holds (fiber 9 + react 19, no WebGL-only postprocessing wrapper)', () => {
    const filePath = path.resolve(__dirname, '../../package.json')
    const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'))

    // @react-three/postprocessing wraps the WebGL-only `postprocessing`
    // library — it must NOT return: the Phase-1 post stack is three/webgpu's
    // own PostProcessing + TSL display nodes (docs/R3F-WEBGPU-NOTES.md).
    expect(pkg.dependencies['@react-three/postprocessing']).toBeUndefined()

    // The WebGPU render path requires fiber v9, which peer-requires react 19.
    expect(pkg.dependencies['@react-three/fiber']).toMatch(/^\^?9\./)
    expect(pkg.dependencies['react']).toMatch(/^\^?19\./)
  })
})
