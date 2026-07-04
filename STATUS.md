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

Phase 0 in progress. Operating files scaffolded (this file, `docs/DELTA.md`, `docs/DEVIATIONS.md`, `docs/R3F-WEBGPU-NOTES.md`, `tools/`). `reference/media__new_visuals.png` copied in.

**Playwright e2e harness stood up and green** (2026-07-04): `client/playwright.config.js`, `client/e2e/puzzle1.spec.js`, `npm run e2e` in `client/`. Verified WebGPU adapter acquisition in Playwright-controlled Chromium (flags + findings in `docs/R3F-WEBGPU-NOTES.md`) and a full solo-swap solve of Puzzle 1 against the *current* (pre-Phase-1) build. Confirmed while building this: **the checked-in app still renders on R3F v8 → `WebGLRenderer`** — `client/src` has no WebGPU code yet, so the WebGPU-only end-state in `Project_Requirements.md` does not describe the current build, only the Phase 1 target. The e2e suite's "app boot" test therefore asserts a live WebGL context today; it must be swapped to assert a WebGPU context on the app's own canvas once Phase 1 lands.

**Not yet built (Phase 0 remainder):** in-scene perf HUD (fps/draw-calls/triangles), the WebGPU capability gate + unsupported screen, a measured fps/bundle-size baseline on the current WebGL build, and confirmation of the R3F v9 + `WebGPURenderer` integration path.

## Phase-0 baseline (WebGL)

Recorded 2026-07-04 via `node tools/perf-probe.mjs --mode record --profile desktop` (pre-Phase-1 R3F v8 WebGLRenderer build, 1440x810 dpr2).

| Metric | Value |
| --- | --- |
| fps (median) | 27 |
| drawCalls (median) | 1 |
| triangles (median) | 2 |
| samples | 29 |
| JS+CSS gzip, client/dist, excl. .wasm | 1081.5 KB (1107490 bytes) |

_Phase 0 records the current WebGL numbers only — not compared against the WebGPU floors in `Project_Requirements.md` §2 (desktop >=60fps/>=2M tris/<=500KB gzip, mobile >=30fps/>=0.5M tris). `perf-probe.mjs --mode assert` enforces those floors from Phase 1 onward._
## Next actions

1. Establish the current WebGL build's baseline (fps, bundle size) so Phase 1's WebGPU rebuild has a before/after to compare — record numbers here, not from memory.
2. ~~Stand up Playwright and write the first e2e: solo-swap solve of Puzzle 1~~ — done 2026-07-04, see above.
3. Build the capability-gate + designed unsupported screen (needed before the Phase 1 renderer swap so non-WebGPU devices never hit a raw crash). Add its Playwright test (forced non-WebGPU context → unsupported screen, zero console exceptions) alongside it.
4. Confirm React Three Fiber v9 + three.js `WebGPURenderer` integration path against installed source; log findings in `docs/R3F-WEBGPU-NOTES.md`. When this lands, update `client/e2e/puzzle1.spec.js`'s "app boot" test to assert a WebGPU context on the app canvas instead of WebGL.

## Gotchas (append-only; newest first)

_(Carry forward the hard-won ones from `handoff.md` as they recur under the new stack; add new ones here rather than re-debugging.)_

- Rapier rigid-body `type` transitions are async — `linvel()` can return `NaN` on the first frame after a solo-swap type change. Guard velocity/position reads against `NaN` before writing to the store, or the camera-follow lerp propagates `NaN` into a permanent black screen. (from `handoff.md`)
- Third-person camera can clip through/behind room walls; keep boundary colliders but handle the visual so the camera never renders from inside an opaque mesh. Revisit under the WebGPU renderer. (from `handoff.md`)
