import { useEffect, useMemo } from 'react'
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
  smoothstep,
} from 'three/tsl'
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js'
import { ao } from 'three/examples/jsm/tsl/display/GTAONode.js'
import { chromaticAberration } from 'three/examples/jsm/tsl/display/ChromaticAberrationNode.js'

// Post stack (§3.6) on three/webgpu's own PostProcessing + TSL display nodes
// (the WebGL-only @react-three/postprocessing wrapper was retired at the
// renderer swap — docs/R3F-WEBGPU-NOTES.md 2026-07-07).
//
// Desktop: GTAO (from the scene pass's depth + MRT normals) → bloom →
// chromatic aberration → vignette. Mobile (§2 scaled profile): GTAO off,
// bloom kept, CA off, vignette kept. Tone mapping + output color space are
// applied by PostProcessing's output transform from the renderer settings.
// Volumetric light shafts (Godrays) are still open §2 work — tracked in
// STATUS.md for the Phase-1 visual pass, not silently dropped.
//
// Integration: a priority-1 useFrame takes over rendering from fiber
// (state.internal.priority > 0 suppresses fiber's own gl.render), and
// PostProcessing.render() drives the frame, so renderer.info — and with it
// PerfProbe/PerfHud — keeps reporting real per-frame stats.
export const PostFX = ({ isMobile = false }) => {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  const post = useMemo(() => {
    const processing = new PostProcessing(gl)

    const scenePass = pass(scene, camera)
    let beauty

    if (isMobile) {
      beauty = scenePass.getTextureNode('output')
    } else {
      // MRT: color + view-space normals in one pass; GTAO reads depth+normal.
      scenePass.setMRT(mrt({ output, normal: normalView }))
      const color = scenePass.getTextureNode('output')
      const normal = scenePass.getTextureNode('normal')
      const depth = scenePass.getTextureNode('depth')

      // CA FIRST, directly on the scene color: ChromaticAberrationNode
      // re-samples its input per channel via textureNode.sample(uv), so it
      // only works on a real texture node — feeding it a computed chain
      // (e.g. beauty.add(bloom)) silently loses the G/B taps and the frame
      // collapses to the red channel. Also: never pass center=null; the
      // node consumes it unconditionally and NodeBuilder crashes.
      const aberrated = chromaticAberration(color, 0.55, vec2(0.5, 0.5), 1.04)

      const aoPass = ao(depth, normal, camera)
      // Full-res GTAO at dpr 2 measured ~1 fps on an M3 (2880×1620 target,
      // 16 samples). Half-res + 8 samples restores 60 fps and reads nearly
      // identically after the blur/composite — matches the §2 mobile
      // prescription; the task-6 quality ladder makes it adaptive. Raise
      // samples before resolution if quality needs a step up.
      aoPass.resolutionScale = 0.5
      aoPass.samples.value = 8
      // Multiply by the SCALAR .r: the AO target is single-channel, so its
      // vec4 sample is (ao, 0, 0, 1) — a component-wise mul zeroes G and B
      // and the whole frame collapses to the red channel.
      beauty = aberrated.mul(aoPass.getTextureNode().r)
    }

    // Bloom keyed just above emissive threshold: neon and the reactor core
    // glow; lit metal does not. (BloomNode renders its input into internal
    // targets, so a computed chain is fine here — unlike CA.)
    const bloomPass = bloom(beauty, isMobile ? 0.5 : 0.7, 0.85, 0.72)
    let composed = beauty.add(bloomPass)

    // Vignette: darken toward corners; keeps the deck's center-read.
    const radial = screenUV.sub(0.5).mul(2.0).length()
    const vignette = smoothstep(1.65, 0.55, radial).mul(0.35).add(0.65)
    composed = composed.mul(vec3(float(vignette)))

    processing.outputNode = composed
    return processing
  }, [gl, scene, camera, isMobile])

  useEffect(() => {
    return () => post.dispose()
  }, [post])

  // Priority 1: fiber skips its own render; we drive it through the stack.
  useFrame(() => {
    post.render()
  }, 1)

  return null
}
export default PostFX
