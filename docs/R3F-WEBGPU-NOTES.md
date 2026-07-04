# R3F + WebGPU + TSL — verified stack notes

Append-only log of **verified** facts about the render/stack surface this build depends on.

**Rule:** before relying on an unfamiliar API (three.js `WebGPURenderer`, TSL node, R3F v9 behavior, Rapier, WGSL compute), verify it against the **actually installed source** in `node_modules` — not training-data memory — and record what you found here with the version you checked. Memory of these APIs is stale and they change between minor versions.

---

## Seed facts (confirm against installed versions before relying on them)

- **WebGPU needs React Three Fiber v9.** The current build is pinned to Fiber v8 + `@react-three/postprocessing` v2 (see `handoff.md` §3D) — that pin is retired in Phase 1. Verify the v9 `<Canvas>` → `WebGPURenderer` wiring (frameloop, `gl` factory / async init) against the installed `@react-three/fiber` source before building on it.
- **Rapier is renderer-agnostic.** Physics runs on WASM/CPU independent of WebGPU vs WebGL — the D-1 physics choice is unaffected by the renderer pivot.
- **`WebGPURenderer` init is async** (device/adapter request). The capability gate must `await` adapter acquisition and route to the unsupported screen on failure — never assume a synchronous context like WebGL.
- **TSL is the primary shading path; raw WGSL compute is the escape hatch.** Expect to drop to WGSL for the irradiance-probe bake and any pass TSL can't express. Record which passes ended up in raw WGSL and why.

## WebGPU availability (as of mid-2026 — re-verify targets)

- Desktop: Chrome/Edge 113+, Safari 18+, Firefox 141+ (Windows). Broadly safe.
- Mobile: iOS 18+ Safari; Android Chrome 121+ with a Vulkan-capable GPU. **iOS ≤ 17 and budget/older Android have no WebGPU** → these hit the designed unsupported screen (no fallback renderer).

## Verified findings

_(Add entries as APIs are checked against installed source, newest first. Format: `- <date> [pkg@version] <what was verified / gotcha>`.)_
