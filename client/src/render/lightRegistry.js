// Tiny render-layer registry: lights that post passes need to reference
// (GodraysNode wants the actual Light instance). Populated by Lighting.jsx
// ref callbacks during commit — read from effects (never during render).
export const sceneLights = {}
