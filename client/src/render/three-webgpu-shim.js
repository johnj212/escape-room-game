// Build-time shim: the vite alias resolves every bare `three` import (ours,
// fiber's, drei's, three-stdlib's) to this module, so exactly ONE three
// build — three.webgpu.js — ships (§2 critical-bundle floor). Core classes
// are identical (both builds re-export three.core.js).
//
// The classes below exist only because some dependencies IMPORT them by
// name (fiber's default-renderer branch, three-stdlib's GLTFExporter).
// They are NOT a WebGL fallback path — constructing one is a loud failure,
// exactly as the brief's fallback policy requires. Nothing in the app can
// reach them: the capability gate routes non-WebGPU devices to the
// unsupported screen and GameCanvas always supplies the WebGPURenderer
// factory.

// Source-level entry (not the prebuilt three.webgpu.js monolith) so Rollup
// tree-shakes unused node/renderer modules out of the §2 bundle budget.
export * from 'three/src/Three.WebGPU.js'

const refuse = (name) => {
  throw new Error(
    `[sector-9] ${name} is not available: this is a WebGPU-only build with no WebGL fallback renderer (see Project_Requirements.md §1).`
  )
}

export class WebGLRenderer {
  constructor() {
    refuse('WebGLRenderer')
  }
}

// Pure DATA/utility modules from the shader system — three-stdlib (drei's
// dependency graph) reads these at module scope (e.g. UniformsUtils.clone
// runs during import), so they must be the real implementations. They carry
// GLSL strings and object helpers only — importing them creates no render
// path.
export { UniformsUtils } from 'three/src/renderers/shaders/UniformsUtils.js'
export { UniformsLib } from 'three/src/renderers/shaders/UniformsLib.js'
export { ShaderLib } from 'three/src/renderers/shaders/ShaderLib.js'
export { ShaderChunk } from 'three/src/renderers/shaders/ShaderChunk.js'

// Renderer-coupled class imported (never constructed) by three-stdlib's
// XREstimatedLight; constructing it is a loud failure like WebGLRenderer.
export class WebGLCubeRenderTarget {
  constructor() {
    refuse('WebGLCubeRenderTarget')
  }
}
