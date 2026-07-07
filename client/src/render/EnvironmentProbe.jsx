import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator } from 'three/webgpu'

// Baked irradiance probe (§2 GI, nearest-feasible first stage): the room is
// static, so once at load we bake a PMREM radiance environment FROM THE
// LIVE SCENE and feed it back as scene.environment. Every PBR surface then
// receives image-based ambient from the actual deck — neon strips, reactor
// glow, lit panels — i.e. one real bounce of the room's own light, instead
// of a constant ambient term. Shadowed metal picks up colored fill from
// whatever actually surrounds it (Pillar C).
//
// The §2 spec asks for an 8×6×8 probe GRID baked in compute; this is the
// single-probe substitute, logged as D-4 in docs/DEVIATIONS.md with the
// payback plan. Generated fully in code — no external asset (Pillar B).
export const EnvironmentProbe = ({ intensity = 0.5 }) => {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    let disposed = false
    let rt = null
    let raf2 = null
    // Wait two frames so geometry, materials and lights have all landed
    // before the bake samples them.
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (disposed) return
        const generator = new PMREMGenerator(gl)
        rt = generator.fromScene(scene, 0.045, 0.1, 60)
        generator.dispose()
        scene.environment = rt.texture
        scene.environmentIntensity = intensity
      })
    })
    return () => {
      disposed = true
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
      scene.environment = null
      if (rt) rt.dispose()
    }
  }, [gl, scene, intensity])

  return null
}
export default EnvironmentProbe
