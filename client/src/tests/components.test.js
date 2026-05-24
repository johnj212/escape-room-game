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

  it('should ensure package.json specifies a compatible @react-three/postprocessing version for R3F v8', () => {
    const filePath = path.resolve(__dirname, '../../package.json')
    const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    
    const postVersion = pkg.dependencies['@react-three/postprocessing']
    // Must be version 2.x to match R3F v8 and avoid "length" of undefined crashes
    expect(postVersion).toBe('^2.16.2')
  })
})
