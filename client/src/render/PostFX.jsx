import { useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PostProcessing } from 'three/webgpu'
import {
  pass,
  mrt,
  output,
  normalView,
  renderOutput,
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
import { fxaa } from 'three/examples/jsm/tsl/display/FXAANode.js'
import { sceneLights } from './lightRegistry'

// Desktop internal render scale (D-5, docs/DEVIATIONS.md): the scene pass
// renders at this fraction of canvas resolution and the post chain outputs
// at full canvas res, finished by FXAA after tonemapping — the same
// internal-resolution strategy UE5-class titles use to hold frame rate.
// Measured 2026-07-08: per-pixel shading breadth (PBR light loop + CSM taps
// + fog + procedural noise) is the fps ceiling at desktop res with no single
// dominant pass — resolution scale is the one lever that shrinks all of it.
// 0.55 holds the §2 60-fps floor with margin for background-load noise.
const DESKTOP_SCENE_SCALE = 0.55

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
    // Perf-ablation switch for the fps harness (`?fxoff=godrays,ao,ca,bloom`):
    // lets tools bisect per-pass GPU cost on the live stack. Not a quality
    // ladder — the shipped profiles are exactly (desktop, mobile).
    const fxoff = new Set(
      (new URLSearchParams(window.location.search).get('fxoff') ?? '')
        .split(',')
        .filter(Boolean)
    )
    const processing = new PostProcessing(gl)

    const scenePass = pass(scene, camera)
    let beauty

    if (isMobile) {
      beauty = scenePass.getTextureNode('output')
    } else {
      scenePass.setResolutionScale(DESKTOP_SCENE_SCALE)
      scenePass.setMRT(mrt({ output, normal: normalView }))
      const colorTex = scenePass.getTextureNode('output')
      const normal = scenePass.getTextureNode('normal')
      const depth = scenePass.getTextureNode('depth')

      // 0.35: fringing should whisper at frame edges, not rainbow-split the
      // ceiling neon (delta round 1 re-render check).
      const aberrated = fxoff.has('ca')
        ? colorTex
        : chromaticAberration(colorTex, 0.35, vec2(0.5, 0.5), 1.04)

      if (fxoff.has('ao')) {
        beauty = aberrated
      } else {
        const aoPass = ao(depth, normal, camera)
        aoPass.resolutionScale = 0.35
        aoPass.samples.value = 6
        beauty = aberrated.mul(aoPass.getTextureNode().r)
      }

      // Volumetric shafts (§2): raymarched from the reactor's shadow-casting
      // glow light, composited additively in the reactor's own hue.
      const reactor = sceneLights.reactor
      if (reactor && !fxoff.has('godrays')) {
        const shafts = godrays(depth, camera, reactor)
        shafts.resolutionScale = 0.35
        shafts.raymarchSteps.value = 10
        shafts.density.value = 0.55
        shafts.maxDensity.value = 0.34
        shafts.distanceAttenuation.value = 2.2
        beauty = beauty.add(shafts.rgb.mul(color('#ff5a2a')).mul(0.85))
      }
    }

    // Threshold 1.0: only true HDR emitters (neon, reactor, holograms) bloom —
    // lit metal and light-pool hotspots on the floor stay crisp. Radius 0.6
    // keeps halos hugging their sources (delta round 1, gap #1: the old
    // 0.72/0.85 smeared the hologram console into a frame-eating blob).
    let composed = beauty
    if (!fxoff.has('bloom')) {
      const bloomPass = bloom(beauty, isMobile ? 0.5 : 0.6, 0.6, 1.0)
      composed = beauty.add(bloomPass)
    }

    // Floor 0.8 (was 0.65): the Phase-1 gate-verifier pixel-measured the old
    // vignette crushing already-dim wall corners below the Pillar-C bar —
    // the frame edges must darken, never black out.
    const radial = screenUV.sub(0.5).mul(2.0).length()
    const vignette = smoothstep(1.75, 0.5, radial).mul(0.2).add(0.8)
    composed = composed.mul(vec3(float(vignette)))

    if (isMobile) {
      processing.outputNode = composed
    } else {
      // FXAA needs sRGB input, so tonemap/color-space (renderOutput) moves
      // in front of it and the default output transform is disabled. FXAA
      // also cleans the edge shimmer from the scaled scene pass (MSAA is off
      // — see GameCanvas.jsx).
      processing.outputColorTransform = false
      processing.outputNode = fxaa(renderOutput(composed))
    }
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
