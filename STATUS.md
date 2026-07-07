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

- [ ] **Phase 0** — Scaffold + harness (STATUS/DELTA/DEVIATIONS/NOTES, Playwright, perf HUD, capability gate, `reference/` populated, green baseline)
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

**Perf HUD SHIPPED + R3F v9 path CONFIRMED** (2026-07-07): `client/src/components/PerfHud.jsx` — visible layer over the existing `window.__PERF__` feed (F3 toggle / `?hud=1`, fps color-coded against the 30/60 floors); e2e-verified in `puzzle1.spec.js` (toggles on, reports live fps > 0, toggles off) — battery PASS. R3F v9 + `WebGPURenderer` integration path verified against installed source in a scratch install (fiber 9.6.1 / three 0.185.1): async `gl` factory awaited by fiber, factory must call `await renderer.init()`, **React 19 required**, full Phase-1 dep matrix + the finding that `@react-three/postprocessing` should be dropped for three's own `PostProcessing` + TSL display nodes — all in `docs/R3F-WEBGPU-NOTES.md` (2026-07-07 entry). **All Phase 0 deliverables now built; gate-verifier dispatch is the only step left before closing Phase 0.**

## Phase-0 baseline (WebGL)

Recorded 2026-07-07 via `node tools/perf-probe.mjs --mode record --profile desktop` (pre-Phase-1 R3F v8 WebGLRenderer build, 1440x810 dpr2).

| Metric | Value |
| --- | --- |
| fps (median) | 27 |
| drawCalls (median) | 1 |
| triangles (median) | 2 |
| samples | 29 |
| JS+CSS gzip, client/dist, excl. .wasm | 1083.5 KB (1109500 bytes) |

_Phase 0 records the current WebGL numbers only — not compared against the WebGPU floors in `Project_Requirements.md` §2 (desktop >=60fps/>=2M tris/<=500KB gzip, mobile >=30fps/>=0.5M tris). `perf-probe.mjs --mode assert` enforces those floors from Phase 1 onward._
## Next actions

1. ~~Establish the current WebGL build's baseline (fps, bundle size)~~ — done, see "Phase-0 baseline (WebGL)" table above (auto-refreshed by each verify run).
2. ~~Stand up Playwright and write the first e2e: solo-swap solve of Puzzle 1~~ — done 2026-07-04, see above.
3. ~~Build the capability-gate + designed unsupported screen + its Playwright test~~ — done 2026-07-07, see above.
4. ~~Confirm React Three Fiber v9 + three.js `WebGPURenderer` integration path against installed source~~ — done 2026-07-07 via scratch install, findings in `docs/R3F-WEBGPU-NOTES.md`. (Still open for Phase 1 itself: swap `puzzle1.spec.js`'s app-boot WebGL assertion to WebGPU when the renderer lands.)
5. ~~Build the in-scene perf HUD~~ — done 2026-07-07, see above.
6. Dispatch the `gate-verifier` agent on Phase 0; fix anything it surfaces; close the Phase 0 gate in the checklist above. Then Phase 1 (xhigh): WebGPU render-layer rebuild + Puzzle 1 re-homed (incl. removing the `isSolo` role bypass at `WirePuzzle.jsx:47`, killing the Google-Fonts/lobby-PNG external assets or logging deviations).

## Gotchas (append-only; newest first)

_(Carry forward the hard-won ones from `handoff.md` as they recur under the new stack; add new ones here rather than re-debugging.)_

- Rapier rigid-body `type` transitions are async — `linvel()` can return `NaN` on the first frame after a solo-swap type change. Guard velocity/position reads against `NaN` before writing to the store, or the camera-follow lerp propagates `NaN` into a permanent black screen. (from `handoff.md`)
- Third-person camera can clip through/behind room walls; keep boundary colliders but handle the visual so the camera never renders from inside an opaque mesh. Revisit under the WebGPU renderer. (from `handoff.md`)
