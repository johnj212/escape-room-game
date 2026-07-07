import { useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PostProcessing } from 'three/webgpu'
import {
  pass,
  mrt,
  output,
  normalView,
  screenUV,
  float,
  vec2,
  vec3,
  color,
  smoothstep,
} from 'three/tsl'
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js'
import { ao } from 'three/examples/jsm/tsl/display/GTAONode.js'
import { chromaticAberration } from 'three/examples/jsm/tsl/display/ChromaticAberrationNode.js'
import { godrays } from 'three/examples/jsm/tsl/display/GodraysNode.js'
import { sceneLights } from './lightRegistry'

// Post stack (§3.6) on three/webgpu's own PostProcessing + TSL display nodes
// (the WebGL-only @react-three/postprocessing wrapper was retired at the
// renderer swap — docs/R3F-WEBGPU-NOTES.md 2026-07-07).
//
// Desktop: GTAO (scene-pass depth + MRT normals) → bloom → volumetric
// godrays from the shadow-casting reactor glow light → chromatic aberration
// → vignette. Mobile (§2 scaled profile): bloom + vignette only. Tone
// mapping + output color space are applied by PostProcessing's output
// transform from the renderer settings.
//
// Built in an effect (not useMemo): GodraysNode needs the actual reactor
// Light instance, which Lighting.jsx registers via a ref callback during
// commit — before effects, after render. Until the stack exists we render
// plainly, so there is never a black frame.
//
// TSL gotchas encoded here (docs/R3F-WEBGPU-NOTES.md): CA only accepts a
// real texture node and a non-null center; GTAO's single-channel target
// must be scalar-multiplied via `.r`; GTAO at full res is ~1 fps at dpr 2 —
// run it half-res/8-sample.
export const PostFX = ({ isMobile = false }) => {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  const [post, setPost] = useState(null)

  useEffect(() => {
    const processing = new PostProcessing(gl)

    const scenePass = pass(scene, camera)
    let beauty

    if (isMobile) {
      beauty = scenePass.getTextureNode('output')
    } else {
      scenePass.setMRT(mrt({ output, normal: normalView }))
      const colorTex = scenePass.getTextureNode('output')
      const normal = scenePass.getTextureNode('normal')
      const depth = scenePass.getTextureNode('depth')

      const aberrated = chromaticAberration(colorTex, 0.55, vec2(0.5, 0.5), 1.04)

      const aoPass = ao(depth, normal, camera)
      aoPass.resolutionScale = 0.5
      aoPass.samples.value = 8
      beauty = aberrated.mul(aoPass.getTextureNode().r)

      // Volumetric shafts (§2): raymarched from the reactor's shadow-casting
      // glow light, composited additively in the reactor's own hue.
      const reactor = sceneLights.reactor
      if (reactor) {
        const shafts = godrays(depth, camera, reactor)
        shafts.raymarchSteps.value = 28
        shafts.density.value = 0.55
        shafts.maxDensity.value = 0.34
        shafts.distanceAttenuation.value = 2.2
        beauty = beauty.add(shafts.rgb.mul(color('#ff5a2a')).mul(0.85))
      }
    }

    const bloomPass = bloom(beauty, isMobile ? 0.5 : 0.7, 0.85, 0.72)
    let composed = beauty.add(bloomPass)

    const radial = screenUV.sub(0.5).mul(2.0).length()
    const vignette = smoothstep(1.65, 0.55, radial).mul(0.35).add(0.65)
    composed = composed.mul(vec3(float(vignette)))

    processing.outputNode = composed
    setPost(processing)
    return () => {
      setPost(null)
      processing.dispose()
    }
  }, [gl, scene, camera, isMobile])

  // Priority 1: fiber skips its own render; we drive the frame. Plain
  // render until the stack is built — never a dead frame.
  useFrame(() => {
    if (post) post.render()
    else gl.render(scene, camera)
  }, 1)

  return null
}
export default PostFX
