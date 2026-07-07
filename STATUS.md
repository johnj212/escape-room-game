# STATUS — Sector-9 Command Deck

## Rehydration protocol (read this first, every session)

1. Read this file fully.
2. Read `Project_Requirements.md` (the brief — pillars, floors, banned outcomes, phases).
3. Read `docs/R3F-WEBGPU-NOTES.md` (verified stack facts — do not re-derive from memory).
4. Skim `docs/DEVIATIONS.md` and the newest entries of `docs/DELTA.md`.
5. Go to **Current focus** below. **Never re-plan from scratch.**

**Before reporting any progress, audit each claim against a tool result from THIS session — a screenshot, a test run, a measured fps/triangle number. If something isn't verified yet, say so; don't report it as done.** Confident status that outruns tool evidence is the failure this line exists to prevent.

---

## Mission (one paragraph)

Build the Sector-9 Command Deck: a 3-role, high-cooperation escape room (Engineer / Technician / Overseer) that renders in the browser at UE5-showcase *ambition* on three.js `WebGPURenderer` + TSL, asset-free, no WebGL fallback. Three interdependent puzzles chain 1 → 2 → 3 to an escape before a 15-minute server-authoritative meltdown timer. Graded every phase against `reference/media__new_visuals.png` (visual) and *Operation: Tango* (asymmetric co-op feel). Desktop is the ambition ceiling; mobile runs the same scene on a scaled render profile.

## Hard-rules digest (full text in `Project_Requirements.md`)

- Build, don't describe. No plan-approval round-trips. Proceed on anything reversible; stop only for destructive/irreversible/scope-change.
- WebGPU only — **no WebGL fallback renderer**. Non-WebGPU → designed unsupported screen, never a crash.
- **Zero external assets** in the play route. The reference PNG lives in `reference/` only.
- Server owns truth — no client-authoritative solves or positions.
- Every puzzle requires ≥ 2 roles (a test must prove single-role completion is impossible).
- No black shadows; no flat unlit surfaces in a hero shot (under-rendering = fail).
- No stubs / no `// TODO` in a closed phase. No disabled tests to go green.
- A pillar/floor is never silently dropped — deviation → `docs/DEVIATIONS.md` entry.
- Effort: `high` default; `xhigh` for Phase 1 (WebGPU rebuild) and Phase 3 (laser + server raycast).

## Phase checklist

- [x] **Phase 0** — Scaffold + harness — **GATE CLOSED 2026-07-07, gate-verifier verdict PASS** (fresh-context agent; independently re-ran the battery → 3/3 HARD PASS, verified all six gate items with tool evidence, zero banned outcomes in the Phase-0 surface). Its two non-blocking flags are both addressed/scheduled: reference asset corrected (see below), font/PNG deviations formalization scheduled into Phase 1.
- [ ] **Phase 1 (xhigh)** — WebGPU render-layer rebuild + Puzzle 1 re-homed; asset-free; desktop + mobile fps floors met; unsupported screen; reference-delta round 1
- [ ] **Phase 2** — Puzzle 2 (scanners) + 1 → 2 chain server-side; lockout; reference-delta
- [ ] **Phase 3 (xhigh)** — Puzzle 3 (laser) + full escape; server-raycast validated; win/lose sequences; reference-delta
- [ ] **Phase 4** — Mobile/touch parity + adaptive ladder + graceful degradation verified
- [ ] **Phase 5** — Visual reference-delta pass + atmosphere/tension (Pillar F); self-score ≥ 7 all rows; human sign-off

## Current focus

**Brief amended 2026-07-04 (design decision — read before Phase 1/2/3).** `Project_Requirements.md` was tightened on role interdependence, integrated into Pillar A, the puzzle list (§3), the every-puzzle quality law (§4), and the phase gates (§6): (1) **P1 = 2 roles, P2 and P3 = all 3 roles**, with a Pillar-A test proving the required role count is necessary; (2) **solo-swap is no longer a role exemption** — the `isSolo` bypass at `WirePuzzle.jsx:47` that collapses Engineer+Technician into one free actor must be removed when P1 is re-homed in Phase 1 (a test proves the solo player must swap Engineer → Technician); (3) simultaneous P2 uses a **latch/hold arm mechanic** so solo-swap solves the *identical* puzzle (arm all three within a rolling window), never a relaxed variant. No pillar/floor dropped — this raises the bar, so no `docs/DEVIATIONS.md` entry.

Phase 0 in progress. Operating files scaffolded (this file, `docs/DELTA.md`, `docs/DEVIATIONS.md`, `docs/R3F-WEBGPU-NOTES.md`, `tools/`). `reference/media__new_visuals.png` copied in.

**Playwright e2e harness stood up and green** (2026-07-04): `client/playwright.config.js`, `client/e2e/puzzle1.spec.js`, `npm run e2e` in `client/`. Verified WebGPU adapter acquisition in Playwright-controlled Chromium (flags + findings in `docs/R3F-WEBGPU-NOTES.md`) and a full solo-swap solve of Puzzle 1 against the *current* (pre-Phase-1) build. Confirmed while building this: **the checked-in app still renders on R3F v8 → `WebGLRenderer`** — `client/src` has no WebGPU code yet, so the WebGPU-only end-state in `Project_Requirements.md` does not describe the current build, only the Phase 1 target. The e2e suite's "app boot" test therefore asserts a live WebGL context today; it must be swapped to assert a WebGPU context on the app's own canvas once Phase 1 lands.

**WebGPU capability gate + designed unsupported screen SHIPPED and verified** (2026-07-07): `client/src/render/capability.js` (async adapter probe, stable reason codes, result mirrored to `window.__CAPABILITY__`), `client/src/components/UnsupportedScreen.jsx` (designed screen — screenshot evidence at `client/e2e/shots/unsupported-screen.png`), gated in `App.jsx` before anything renders. e2e: new `chromium-no-webgpu` Playwright project (no WebGPU flags → real null-adapter context, per the verified R3F-WEBGPU-NOTES finding) runs `client/e2e/capability.spec.js` — unsupported screen visible, zero console errors/pageerrors, zero canvases mounted, routed in <500 ms; supported path asserted in `puzzle1.spec.js` (`reason === 'ok'`, `durationMs < 500`). All 3 e2e green + full battery PASS this session. The §3.1 *recorded-demo hook* on the unsupported screen is deliberately deferred until WebGPU hero footage exists to record (Phase 1+) — no dead button shipped.

**Open flag (found 2026-07-07):** `client/src/index.css:1` `@import`s Google Fonts (Inter + Orbitron) at runtime — an external asset in the play route (Pillar B tension), alongside the known lobby PNG flag in `handoff.md` §0. Both must be resolved in Phase 1's asset-free pass (procedural/system-font substitute or a `docs/DEVIATIONS.md` entry).

**PHASE 0 GATE CLOSED — verdict PASS** (2026-07-07, fresh-context gate-verifier). Evidence: independent battery re-run (3/3 HARD), per-item file/grep/test verification, hero shot captured to `docs/shots/phase0-hero.png`, Phase-0 self-score rubric recorded in the verifier report (A:4 B:2 C:2 D:2 E:7 F:2 Perf:2 Reliability:10 — low rows are all Phase 1/2/5 scope by design, honestly scored against the final bar). **Reference asset corrected:** the verifier found `reference/media__new_visuals.png` is a flat lobby/menu card, not the lit 3D deck render the brief describes; the true render (`assets/sector_9_deck_1779639466019.png` — reactor core, greebles, fog, bounce light) is now at **`reference/sector9_deck_hero.png`** and is the primary visual grading reference from Phase 1 on (decision + delta logged in `docs/DELTA.md` 2026-07-07). The brief's §"The bar" pointer should be read accordingly; the bar itself is unchanged.

**Perf HUD SHIPPED + R3F v9 path CONFIRMED** (2026-07-07): `client/src/components/PerfHud.jsx` — visible layer over the existing `window.__PERF__` feed (F3 toggle / `?hud=1`, fps color-coded against the 30/60 floors); e2e-verified in `puzzle1.spec.js` (toggles on, reports live fps > 0, toggles off) — battery PASS. R3F v9 + `WebGPURenderer` integration path verified against installed source in a scratch install (fiber 9.6.1 / three 0.185.1): async `gl` factory awaited by fiber, factory must call `await renderer.init()`, **React 19 required**, full Phase-1 dep matrix + the finding that `@react-three/postprocessing` should be dropped for three's own `PostProcessing` + TSL display nodes — all in `docs/R3F-WEBGPU-NOTES.md` (2026-07-07 entry). **All Phase 0 deliverables now built; gate-verifier dispatch is the only step left before closing Phase 0.**

## Render baseline (WebGPU, auto-recorded)

Recorded 2026-07-07 via `node tools/perf-probe.mjs --mode record --profile desktop` (R3F v9 WebGPURenderer build, 1440x810 dpr2).

| Metric | Value |
| --- | --- |
| fps (median) | 41 |
| drawCalls (median) | 405 |
| triangles (median) | 157182 |
| samples | 29 |
| JS+CSS gzip, client/dist, excl. .wasm | 1341.5 KB (1373655 bytes) |

_Record-only until the Phase 1 gate: not yet compared against the §2 floors (desktop >=60fps/>=2M tris/<=500KB gzip, mobile >=30fps/>=0.5M tris). `perf-probe.mjs --mode assert` enforces those floors at Phase 1 close and onward._
## Next actions

**Phase 0 is closed.** Phase 1 (xhigh — WebGPU render-layer rebuild + Puzzle 1 re-homed) task order:

1. ~~**Dependency migration + WebGPU boot**~~ — **DONE 2026-07-07, battery PASS on the WebGPU build.** react 19.2.7 / fiber 9.6.1 / drei 10.7.7 / rapier 2.2.0 / three 0.185.1 / lucide-react 1.x installed; @react-three/postprocessing removed (unit test now asserts its absence); app renders on `WebGPURenderer` via the async `gl` factory; `puzzle1.spec.js` asserts a live `webgpu` canvas context (and that no WebGL context exists on the same canvas) + full P1 solo-swap solve green on the new stack. Measured on the WebGPU build: **60 fps median, 219 draw calls, 17,833 tris/frame** (headless desktop profile). Three debugging rounds logged in `docs/R3F-WEBGPU-NOTES.md` (StrictMode×async-factory loop kill; drei ContactShadows incompatible; `renderer.info` must be read in `addAfterEffect`). Interim states, deliberate: no post stack yet (task 4), drei Environment preset removed (external HDR — replaced by hemisphere fill until probe GI lands in task 3).
2. ~~Modular render layer: TSL materials + procedural deck geometry~~ — **first pass DONE 2026-07-07, battery PASS.** `client/src/render/`: `prng.js` (seeded streams, `?seed=N` §1 determinism), `materials.js` (TSL library: deck plating w/ per-plate variation + seam grime, wall alloy, structural metal, flickering neon, breathing reactor-core plasma, containment glass — all NodeBuilder-clean, zero image files), `Deck.jsx` (instanced procedural deck: 100 floor plates + 400 rivets, panelled walls + ribs + seeded neon strips, pipe runs/drops, 520-greeble field, ceiling trusses + seeded sagging cables, full reactor assembly). Room.jsx is now colliders + partition only — deck visuals are the single visual source of truth; old canvas-texture room retired (generator stays until the WirePuzzle re-home, task 5). Measured: **60 fps, ~288 draws, ~124K tris** (density constants in `Deck.jsx` are the §2 2M-tri tuning knobs — raise during task 3/6 once the lighting rig defines the fps budget). Interim lighting raised to physical units + fog band widened (the old 10–25 band crushed every wall to fog-black); the frame is still visibly darker than the reference — that is task 3's job. WIP shot: `client/e2e/shots/deck-wip.png`.
3. ~~Lighting rig (CSM + fixtures)~~ — **first pass DONE 2026-07-07, battery PASS.** `client/src/render/Lighting.jsx`: key directional through first-party `CSMShadowNode` (three/examples/jsm/csm — WebGPU-native), 4 cascades @2048² desktop / 2 @1024² mobile, fade on, PCFSoft-filtered; every light is fixture-driven (5 emissive ceiling panels each carrying its own point light, reactor core glow + alarm spot, console task lights, sector neon washes standing in for bounce until probe GI). Measured: **60 fps, ~398 draws, ~158K tris**, zero console errors; WIP shot `client/e2e/shots/deck-wip.png` — warm reactor bounce pools on the plating, sector color washes read, nothing crushes to pure black. **Still open from §2 (tracked, not dropped):** PCSS contact hardening (custom TSL shadow filter — the hook is `light.shadow.shadowNode`), screen-space contact shadows, probe-volume GI bake + GTAO (GTAO ships with the task-4 post stack). Gotcha fixed en route: camera lerp factor must clamp at 1 — WebGPU pipeline-compile frame hitches spike `delta`, `5*delta > 1` makes lerp overshoot and the camera oscillates forever (broke Html-overlay stability in e2e; see Gotchas).
4. ~~Post stack on `PostProcessing` + TSL nodes~~ — **DONE 2026-07-07 (battery PASS) except volumetric shafts.** `client/src/render/PostFX.jsx`: desktop = CA (on the scene texture) → half-res 8-sample GTAO (scalar-multiplied) → bloom (threshold 0.72 — neon/reactor glow, lit metal doesn't) → vignette; mobile = bloom + vignette only (§2 scaling); tonemap/color-space via PostProcessing output transform; integrated through a priority-1 useFrame so fiber's own render is suppressed and PerfProbe keeps reporting. Measured: **60 fps, ~403 draws, ~157K tris**, zero console errors — shot `client/e2e/shots/deck-wip.png` (bloom halos, red reactor bounce, CA fringing; hologram bloom slightly blown → tune in the reference-delta round). Three silent-wrong-frame TSL gotchas logged in `docs/R3F-WEBGPU-NOTES.md` (CA needs a texture node + non-null center; GTAO target is single-channel — multiply by `.r`; full-res GTAO ~1 fps → half-res/8-sample). **Volumetric light shafts (Godrays) still open** — §2 desktop floor item, scheduled with the task-6 reference-delta/visual pass.
5. Asset-free pass: kill the Google-Fonts `@import` + lobby PNG import (or `docs/DEVIATIONS.md` entries); re-home Puzzle 1 with the `isSolo` role bypass at `WirePuzzle.jsx:47` REMOVED + a Pillar-A test proving the solo player must swap Engineer → Technician.
6. Floors: desktop ≥60 fps/≥2M tris/≤500 KB gzip via `perf-probe.mjs --mode assert`; mobile profile scaled. Reference-delta round 1 against **`reference/sector9_deck_hero.png`** → fix top three → re-render → dispatch gate-verifier on Phase 1.

## Gotchas (append-only; newest first)

_(Carry forward the hard-won ones from `handoff.md` as they recur under the new stack; add new ones here rather than re-debugging.)_

- Clamp frame-delta-driven lerp factors to <=1 (`Math.min(1, k*delta)`). WebGPU pipeline compiles cause multi-second delta spikes; an unclamped `lerp(target, 5*delta)` overshoots and oscillates permanently — symptom: drei `<Html>` overlays never pass Playwright's stability check ("element is not stable").
- React 19 `<StrictMode>` + fiber v9 async WebGPU `gl` factory = frame loop freezes after first frame, zero errors. StrictMode is off in `main.jsx` on purpose. Full writeup: `docs/R3F-WEBGPU-NOTES.md` 2026-07-07.
- Read `renderer.info` in `addAfterEffect`, never `useFrame`, under WebGPU — the renderer's internal Animation loop resets Info every tick and pre-render reads report zeros. Per-frame draws = `info.render.drawCalls` (not `calls`).
- drei `<ContactShadows>` (and anything customizing materials via WebGL hooks) fails NodeBuilder under WebGPU with per-frame console errors that also tank fps.

- Rapier rigid-body `type` transitions are async — `linvel()` can return `NaN` on the first frame after a solo-swap type change. Guard velocity/position reads against `NaN` before writing to the store, or the camera-follow lerp propagates `NaN` into a permanent black screen. (from `handoff.md`)
- Third-person camera can clip through/behind room walls; keep boundary colliders but handle the visual so the camera never renders from inside an opaque mesh. Revisit under the WebGPU renderer. (from `handoff.md`)
