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
- [x] **Phase 1 (xhigh)** — WebGPU render-layer rebuild + Puzzle 1 re-homed — **GATE CLOSED 2026-07-08, gate-verifier verdict PASS** (fresh-context agent; independent battery re-run 5/5 HARD incl. desktop 60fps/2.02M tris/484KB + mobile floors with healthy GPU canaries; every gate item verified with tool evidence; zero banned outcomes). Its main non-blocking flag (Pillar C: 37–77% near-black side walls after the D-5 light cuts) was fixed post-verdict — root cause was the ~1%-albedo dark-structural material, not the lights (tone `#0d1017`→`#242c3a`, metalness 0.9→0.7, vignette floor 0.8, ambient/hemisphere raised) — pixel-measured left 37→5% / right 77→45%, battery re-run 5/5 PASS after.
- [x] **Phase 2** — Puzzle 2 (scanners) + 1 → 2 chain server-side; lockout; reference-delta — **GATE CLOSED 2026-07-09, gate-verifier verdict PASS on the second dispatch** (first dispatch FAILed on the D-6 window drift + Pillar-C edge-band; both fixed and re-verified same session — see "Phase 2 progress"). Second verifier independently re-ran the battery (6/6 HARD, 60 fps desktop with healthy canary), reproduced the pixel-check numbers byte-for-byte on its own fresh hero capture, and confirmed every gate item with tool evidence. Rubric: A 10, B 7, C 4 (D-4 GI residual, Phase-5 payback with `tools/pixel-check.mjs` as acceptance test), D 10, E 10, F 7, Perf 10, Reliability 10.
- [x] **Phase 3 (xhigh)** — Puzzle 3 (laser) + full escape; server-raycast validated; win/lose sequences; reference-delta — **GATE CLOSED 2026-07-13, gate-verifier verdict PASS** (fresh-context agent; independently re-ran the battery → 6/6 HARD PASS with byte-reproduced perf numbers (desktop 60fps/2.076M tris/496.1KB, mobile 60fps/1.94M, canaries healthy), re-ran the authority probe standalone (14/14), re-captured the hero and byte-reproduced both pixel-check bands, independently re-ran the 373k no-Engineer sweep (0 hits confirmed) AND its solution-heading mutation control. Rubric: A 10, B 10, C 4 (D-4 GI residual, Phase-5 payback), D 10, E 10, F 7, Perf 10, Reliability 9). Its one real finding — STATUS.md's mutation-control figure had silently drifted (5,719 → actual 10,733) — was fixed at gate close: figure corrected here + in handoff.md and pinned as a literal-value test in `laserPuzzle.test.js` (103rd test, the D-6 lesson applied to evidence numbers). Non-blocking flags carried to Phase 5: stage-3 hero capture variant (the fixed hero vantage captures the lobby-launch state, so P3's laser geometry can't be graded from the committed shot — a methodology gap, not a code defect); a timer-critical vs timer-full frame comparison to substantiate the F-row alarm-escalation claim.
- [ ] **Phase 4** — Mobile/touch parity + adaptive ladder + graceful degradation verified
- [ ] **Phase 5** — Visual reference-delta pass + atmosphere/tension (Pillar F); self-score ≥ 7 all rows; human sign-off

## Current focus

**RESOLVED 2026-07-09:** user-reported mobile issue (USE button didn't activate items, unlike desktop Space) — fixed in `3538a3e`: `UIOverlays.jsx` dispatches a `mobile-interact` CustomEvent; `WirePuzzle.jsx` and `ScannerStations.jsx` both listen for it alongside keyboard input. Covered by `client/e2e/puzzle1-mobile.spec.js` (mobile UA + touch tap opens the terminal like Space/E) — re-run green this session (1/1, 3.3s). Current focus is now the Phase-2 gate close (see "Phase 2 progress" → PENDING).

**Brief amended 2026-07-09:** §3.14 / §6 P2 arm window is officially **3.0 s** (was 1.5 s) — user-confirmed as needed for mobile input timing; D-6 is the paper trail, pin test enforces it, all docs/comments/HUD text updated the same day.

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
| fps (median) | 2 |
| drawCalls (median) | 504 |
| triangles (median) | 1337959 |
| samples | 6 |
| JS+CSS gzip, client/dist, excl. .wasm | 483.2 KB (494828 bytes) |

_Record-only until the Phase 1 gate: not yet compared against the §2 floors (desktop >=60fps/>=2M tris/<=500KB gzip, mobile >=30fps/>=0.5M tris). `perf-probe.mjs --mode assert` enforces those floors at Phase 1 close and onward._
## Next actions

**Phase 0 is closed.** Phase 1 (xhigh — WebGPU render-layer rebuild + Puzzle 1 re-homed) task order:

1. ~~**Dependency migration + WebGPU boot**~~ — **DONE 2026-07-07, battery PASS on the WebGPU build.** react 19.2.7 / fiber 9.6.1 / drei 10.7.7 / rapier 2.2.0 / three 0.185.1 / lucide-react 1.x installed; @react-three/postprocessing removed (unit test now asserts its absence); app renders on `WebGPURenderer` via the async `gl` factory; `puzzle1.spec.js` asserts a live `webgpu` canvas context (and that no WebGL context exists on the same canvas) + full P1 solo-swap solve green on the new stack. Measured on the WebGPU build: **60 fps median, 219 draw calls, 17,833 tris/frame** (headless desktop profile). Three debugging rounds logged in `docs/R3F-WEBGPU-NOTES.md` (StrictMode×async-factory loop kill; drei ContactShadows incompatible; `renderer.info` must be read in `addAfterEffect`). Interim states, deliberate: no post stack yet (task 4), drei Environment preset removed (external HDR — replaced by hemisphere fill until probe GI lands in task 3).
2. ~~Modular render layer: TSL materials + procedural deck geometry~~ — **first pass DONE 2026-07-07, battery PASS.** `client/src/render/`: `prng.js` (seeded streams, `?seed=N` §1 determinism), `materials.js` (TSL library: deck plating w/ per-plate variation + seam grime, wall alloy, structural metal, flickering neon, breathing reactor-core plasma, containment glass — all NodeBuilder-clean, zero image files), `Deck.jsx` (instanced procedural deck: 100 floor plates + 400 rivets, panelled walls + ribs + seeded neon strips, pipe runs/drops, 520-greeble field, ceiling trusses + seeded sagging cables, full reactor assembly). Room.jsx is now colliders + partition only — deck visuals are the single visual source of truth; old canvas-texture room retired (generator stays until the WirePuzzle re-home, task 5). Measured: **60 fps, ~288 draws, ~124K tris** (density constants in `Deck.jsx` are the §2 2M-tri tuning knobs — raise during task 3/6 once the lighting rig defines the fps budget). Interim lighting raised to physical units + fog band widened (the old 10–25 band crushed every wall to fog-black); the frame is still visibly darker than the reference — that is task 3's job. WIP shot: `client/e2e/shots/deck-wip.png`.
3. ~~Lighting rig (CSM + fixtures)~~ — **first pass DONE 2026-07-07, battery PASS.** `client/src/render/Lighting.jsx`: key directional through first-party `CSMShadowNode` (three/examples/jsm/csm — WebGPU-native), 4 cascades @2048² desktop / 2 @1024² mobile, fade on, PCFSoft-filtered; every light is fixture-driven (5 emissive ceiling panels each carrying its own point light, reactor core glow + alarm spot, console task lights, sector neon washes standing in for bounce until probe GI). Measured: **60 fps, ~398 draws, ~158K tris**, zero console errors; WIP shot `client/e2e/shots/deck-wip.png` — warm reactor bounce pools on the plating, sector color washes read, nothing crushes to pure black. **Still open from §2 (tracked, not dropped):** PCSS contact hardening (custom TSL shadow filter — the hook is `light.shadow.shadowNode`), screen-space contact shadows, probe-volume GI bake + GTAO (GTAO ships with the task-4 post stack). Gotcha fixed en route: camera lerp factor must clamp at 1 — WebGPU pipeline-compile frame hitches spike `delta`, `5*delta > 1` makes lerp overshoot and the camera oscillates forever (broke Html-overlay stability in e2e; see Gotchas).
4. ~~Post stack on `PostProcessing` + TSL nodes~~ — **DONE 2026-07-07 (battery PASS) except volumetric shafts.** `client/src/render/PostFX.jsx`: desktop = CA (on the scene texture) → half-res 8-sample GTAO (scalar-multiplied) → bloom (threshold 0.72 — neon/reactor glow, lit metal doesn't) → vignette; mobile = bloom + vignette only (§2 scaling); tonemap/color-space via PostProcessing output transform; integrated through a priority-1 useFrame so fiber's own render is suppressed and PerfProbe keeps reporting. Measured: **60 fps, ~403 draws, ~157K tris**, zero console errors — shot `client/e2e/shots/deck-wip.png` (bloom halos, red reactor bounce, CA fringing; hologram bloom slightly blown → tune in the reference-delta round). Three silent-wrong-frame TSL gotchas logged in `docs/R3F-WEBGPU-NOTES.md` (CA needs a texture node + non-null center; GTAO target is single-channel — multiply by `.r`; full-res GTAO ~1 fps → half-res/8-sample). **Volumetric light shafts (Godrays) still open** — §2 desktop floor item, scheduled with the task-6 reference-delta/visual pass.
5. ~~Asset-free pass + P1 re-home with role separation~~ — **DONE 2026-07-07, battery PASS (6 new vitest, e2e 3/3).** (a) **The `isSolo` role bypass is dead**: Pillar-A gates extracted to pure functions in `client/src/game/roleGates.js` (no solo parameter exists) — Technician-only switchboard with a role-lock refusal UI, Engineer-only cipher legibility within projector range (non-engineers see "SIGNAL ENCRYPTED" static). `src/tests/roleGates.test.js` enumerates every role × range combination, proves no single role holds both information and action, and source-audits that `|| isSolo` can never return; e2e asserts the hologram label flips legible→encrypted on the P1→P2 swap and the solve still requires operating as Technician. (b) **Zero external assets in `client/src`**: Google-Fonts `@import` removed → system font stacks (D-2 in `docs/DEVIATIONS.md`), 973 KB lobby PNG deleted → procedural CSS backdrop (`.overlay-backdrop`), `find client/src -name '*.png'` returns nothing. (c) UX fixes surfaced by the tests: switchboard interaction radius 2→3 m + open-terminal hysteresis (+0.6 m) so hover-drift can't flap the UI shut; the open terminal is now a screen-fixed takeover (drei Html `calculatePosition`) instead of 3D-tracked — camera micro-motion can't jitter click targets (gotcha below).
6. Floors progress (2026-07-07, all measured this session, battery PASS):
   - **Bundle floor MET: 458 KB gzip ≤ 500 KB** (was 1373 KB). Two moves: (a) vite exact-match alias `three` → `src/render/three-webgpu-shim.js`, which re-exports `three/src/Three.WebGPU.js` (source entry) plus real data-module re-exports (UniformsUtils/Lib, ShaderLib/Chunk — three-stdlib reads them at import time) and THROWING stubs for WebGLRenderer/WebGLCubeRenderTarget (imported-never-constructed by fiber/three-stdlib; constructing = loud fail, per the no-fallback policy — NOT a second render path); (b) rapier3d-compat embeds its ~2.2 MB WASM inside rapier.mjs, so vite `manualChunks` isolates it as `rapier-wasm-*` and `perf-probe.mjs` excludes that chunk under the §2 "excl. Rapier WASM" carve-out (D-1). Unused `howler` dep removed. **Gotcha:** after editing the shim, `rm -rf node_modules/.vite` — the dep optimizer inlines the old shim into cached pre-bundles.
   - **Triangles: 985 K/frame at 60 fps** (desktop headless, ~417 draws) — up from 158 K via justified detail only: beveled ExtrudeGeometry floor plates (400, real chamfers), 3,200 20-radial rivets, 6,000 greebles, 100 sagging cables (56×12 tubes), doubled pipe drops, reactor core icosa detail 6 + 28×300 torus rings. **2M hero floor still open** — remaining 2× is a DENSITY-constant turn in `Deck.jsx`; do it at the delta/gate round when godrays+probe-GI fix the real fps budget.
   - **Volumetric shafts SHIPPED** (2026-07-07, battery PASS): GodraysNode raymarched from the reactor's now-shadow-casting glow point light (512² cube shadow; light instance shared to the post stack via `render/lightRegistry.js` ref-callback registry; PostFX rebuilt in an effect so the ref exists — renders plainly until built, never a dead frame). 28 steps, additive composite in reactor hue. Measured: **60 fps, ~521 draws, ~1.35M tris/frame** (cube shadow pass counts) — shot `client/e2e/shots/deck-wip.png`: shafts + bounce read clearly; hologram bloom still blown (delta-round tune).
   - **Shadow/GI deviations formalized + mobile measured** (2026-07-07, battery PASS): D-3 (PCSS + SS-contact → PCFSoft CSM + GTAO grounding, Phase-5 payback via the `shadowNode` filter seam) and D-4 (probe-volume GI → fixture lighting + GTAO; **a real PMREM single-probe bake was BUILT and works visually** — `render/EnvironmentProbe.jsx`, bakes the live deck via `PMREMGenerator.fromScene` → `scene.environment` — but drops 60→1 fps combined with the PostFX scene pass + cube shadows, suspected per-frame pipeline churn, so it is NOT mounted; needs its own debugging round) — both in `docs/DEVIATIONS.md`. **Mobile profile measured (emulated 360×780 dpr1.5): 60 fps median, 1.27M tris** — above the ≥30 fps / ≥0.5M floors (real-device verification is Phase 4's gate; this is a desktop-GPU emulation number, recorded as such).
   - **Reference-delta round 1 COMPLETE** (2026-07-07, battery PASS after): full entry in `docs/DELTA.md`. 10 gaps ranked vs `reference/sector9_deck_hero.png`; top 3 fixed and verified by re-render (`docs/shots/phase1-hero.png`): hologram/ceiling bloom blowout tamed (threshold 1.0/radius 0.6, task lights 38→14 cd, panel emissive 3.2→1.7, CA 0.35), dedicated hero vantage `?hero=1` (GameCanvas `HeroCamera`, capture-hero defaults to it, `--gameplay` opts out), wall black-crush fixed (wall metalness 0.55 + hemisphere 4.2 + partition glass tinted `#2ec8e6`). Biggest remaining gaps re-ranked in DELTA.md: reactor reads as a plain ball, no ambient haze, floor grime.
   - **Perf-probe warmup bias found** (2026-07-07): `--mode record` samples immediately after `__SCENE_READY__`, i.e. during WebGPU pipeline compilation — the auto-recorded "fps (median) 2 / 6 samples" in the baseline block above is that artifact, not steady state (debug probes measure 60 fps after warmup; the 6-of-30 sample count shows the page was stalling in compiles). Fix (skip warmup until the fps signal stabilizes) lands with the `--mode assert` wiring, or the fps floor would gate on compile time.
   - **fps-floor turn (2026-07-08) — the "60 fps" history was wrong, and the floor took real optimization.** Empirical re-measurement showed steady-state desktop fps was ~8–12 at native dpr-2, including at past commits whose STATUS entries claim 60 (the old perf-probe sampled during pipeline-compile warmup, and the separate 60-fps debug reads don't reproduce at those same commits today). A raw-WebGPU ALU canary proved the GPU itself healthy. Full bisect + fix set (details in D-5, `docs/DEVIATIONS.md`): MSAA off + FXAA-after-tonemap, glass transmission 0, ceiling panel lights 5→3 + console lights folded into sector fills (11→7 punctual), fractal noise 3→2 octaves, GTAO 0.4, godrays 18 steps, desktop dpr clamp 1.5, scene pass at 0.72 canvas res (D-5). drei `AdaptiveDpr` removed (1-fps churn gotcha below).
   - **Physics was silently dead and is now fixed + regression-guarded (2026-07-08):** Room.jsx's collider-only RigidBodies generated no colliders at all (`traverseVisible` skips `visible={false}` — see Gotchas), so players free-fell in a rescue-teleport loop the e2e couldn't see. Fixed with `includeInvisible` on all collider-only bodies; three unclamped `10*delta` lerps in Player.jsx clamped (hitch-frame divergence); `puzzle1.spec.js` now fails on any rescue warning. Verified: zero "fell through floor" warnings across a full probe run.
   - **Density floor MET: 2.02M tris/frame median** (gameplay camera, full stack) via plateDiv 26, 14K greebles, 200 cables, 28-radial rivets, reactor icosa-7 + 36×420 rings. Hero shot re-rendered after the perf/density changes — composition and legibility hold (`docs/shots/phase1-hero.png`).
   - **Desktop fps floor MET (2026-07-08, idle-machine assert): 60 fps median / 2.02M tris / 484 KB gzip, GPU canary 60 (healthy), warmup stabilized** — production build via `vite preview`. The honest idle baseline was 43.5; closing the last 16 fps took: measuring the production build instead of the dev server (React dev-mode overhead ~10%), PCF instead of PCFSoft, scene scale 0.72→0.55, GTAO 6 samples @0.35, godrays 10 steps @0.35, alarm spot shadowless. D-5 updated with the final numbers.
   - **Harness hardening from the same round:** perf-probe measures the production build (build-first + `vite preview :4173`), warmup floor 20 s, GPU canary printed in every table; verify.mjs perf steps settle 25 s and RETRY (≤3×) when the canary flags a contended environment — a contended measurement is invalid, not failed, and only a clean-environment miss fails the gate.
   - **Battery `--phase 1`: 5/5 HARD PASS (2026-07-08)** — lint 0, vitest, e2e 3/3, desktop floors (60 fps / 2.02M tris / 484 KB, canary 60 healthy), mobile floors (60 fps ≥30, 2.02M tris ≥0.5M). Canary threshold finalized at 59 (a 60-fps assert is only valid in a window where the trivial canary itself reaches the cap).
   - **GATE CLOSED (2026-07-08): gate-verifier verdict PASS** — see the Phase checklist entry. Verifier's carried-forward flags for the Phase-2+ delta rounds: reactor containment detail (biggest geometry gap), ambient haze/motes, floor grime/wear, hero-shot-includes-HUD is now a documented choice (gameplay hero; the deck is judged around it), partition beam texture, droid detail (Phase 5). Its Pillar-C flag was fixed post-verdict and re-verified (5/5 battery).
   - **Next: Phase 2** — Puzzle 2 (tri-vector scanners, 3-role, latch/hold arm mechanic) + the 1→2 chain server-side; see the brief §3.14 and the 2026-07-04 amendment above. Also carry: Pillar-D server-authority probe (verifier rubric row D=4 — the scripted fabricated-solve test becomes real in Phase 2), EnvironmentProbe D-4 debugging round when the fps budget allows.

## Phase 2 progress (2026-07-08 session — FEATURE-COMPLETE, gate NOT closed)

All verified with tool evidence this session unless marked pending:

- **Puzzle 2 SHIPPED as one shared machine.** `shared/scannerPuzzle.js` (pure ESM, clock-injected): 3.0 s rolling arm window over the three role-keyed scanners (spec said 1.5 s — widened by the user's playtest commit `9b04c77`, formalized as **D-6** with a literal pin test 2026-07-09), 4 s latch (the mechanism that carries an armed scanner across solo swaps — no relaxed solo variant exists, no solo parameter exists), 5 s lockout on failure (out-of-window third arm OR latch expiry with an incomplete set). The authoritative server `require()`s it natively (Node 22 require(esm)) and the solo client imports the same file — one source of truth. 14 deterministic unit tests incl. the exhaustive proof that every 2-role subset can never reach `solved` (`client/src/tests/scannerPuzzle.test.js`).
- **1→2 chain server-side.** `puzzleState` is now `{ stage, p1: {cipher,currentSwitches,solved}, p2: <scanner state> }` on both server and client. P1 solve → stage 2 + scanners activate (phase stays `playing`; P1 no longer wins). P2 solve → `win` (end of the implemented chain; Phase 3 extends). `toggle-switch` hardened server-side (technician-only + switchboard range from the server's own player record); new `arm-scanner` event trusts NO payload — role and position come from server state, range-checked against `SCANNER_POSITIONS`. Server tick runs `tickScanners` at 30 Hz.
- **Pillar-D authority probe REAL: `tools/authority-probe.mjs` — 8/8 PASS** (run twice by the author agent + once independently this session): fabricated solve/phase events are no-ops, teleports rejected, wrong-role/out-of-range actions rejected, stage-order enforced, live two-role insufficiency → lockout, legit 3-client chain P1→P2→win. Wired into `verify.mjs --phase 2` as HARD check #4 (manifest: lint, vitest, e2e, probe, desktop floors, mobile floors).
- **Client**: `game/roleGates.js` `scannerAccess` (role×pedestal matrix unit-tested — exactly one role can arm each pedestal), `components/ScannerStations.jsx` (procedural pedestals: approach-glow affordance, armed flare, lockout flash + countdown, role-lock refusal — §4 quality law), store routes puzzle actions through registered net emitters online (never solves locally) and the shared machine offline. HUD objective flips at stage 2; win screen is now "SECTOR-9 STABILIZED".
- **e2e 5/5 green** (`client/e2e/puzzle2.spec.js` + updated `puzzle1.spec.js`): P1 solve now asserts the stage-2 transition (no premature win); full chain test walks each character to their own pedestal (real physics), swap-arms 1-E-2-E-3-E inside the window → win; lockout test proves latch-expiry → lockout → arm-rejection → cooldown recovery. The arm burst retries through lockout if machine load stretches the arm window (the mechanic itself is never relaxed — see Gotchas). vitest 39/39, lint 0.
- **Reference-delta round 2 COMPLETE** (docs/DELTA.md 2026-07-08): reactor containment detail (coils/mullions/braces/vents/header), ambient haze (linear fog band 13–42 + 120 drifting motes) and floor grime/puddles/rust shipped — each re-bisected against the fps floor after the first draft cost 9 fps (fractal grime ~3, FogExp2 ~1, 360 additive motes; see DELTA.md perf note). Paid back with: 1-octave grime, motes 120 alpha-blend, linear fog kept, godrays 10→8 steps, desktop scene scale 0.55→0.53 (D-5 knobs), shadow-caster trims. Hero: `docs/shots/phase2-hero.png`; wall bands pixel-checked byte-identical to the Phase-1 gate shot (no Pillar-C regression).
- **Battery `--phase 2`: 6/6 HARD PASS (2026-07-09, idle machine, first attempt)** — lint 0 / vitest / e2e / authority-probe / desktop floors / mobile floors. Desktop: **60 fps median / 2.04M tris / 487.4 KB gzip, GPU canary 60 (healthy), warmup stabilized 20.1s**. Mobile: 60 fps / 1.90M tris, canary healthy. Last session's 59→56→55 readings confirmed as the contended window, not the config — no D-5 knobs spent.
- **Gate-verifier round 1 (2026-07-09): verdict FAIL — both blocking findings fixed same session:**
  1. **ARM_WINDOW_MS had silently drifted 1500→3000** (user playtest commit `9b04c77`, no paper trail; the whole test suite uses the constant symbolically so nothing caught it). Formalized as **D-6** in `docs/DEVIATIONS.md` (kept at 3000 — real-human playtest tuning; interdependence proofs are window-agnostic and unaffected), pinned by literal-value tests in `scannerPuzzle.test.js` (ARM/LATCH/LOCKOUT can no longer drift silently), and STATUS.md's three stale "1.5 s" claims corrected.
  2. **Pillar-C edge-band crush**: verifier's ~99% measurement confirmed real via new committed `tools/pixel-check.mjs` — but pixel-identical to the accepted Phase-1 gate shot (not a Phase-2 regression; earlier "61%" was an irreproducible ad hoc methodology, now retired). Three zero-per-pixel-cost lighting iterations (hemisphere/ambient/vignette-floor, fog-color lift, sector-fill reach) improved right band 98.5→95.9% / left 67→45.2%; residual gap vs reference (36.8%) is the D-4 no-GI signature — re-logged under D-4 with the Phase-5 payback plan and per-iteration numbers in `docs/DELTA.md` 2026-07-09.
- **Battery re-run after the round-1 fixes: 6/6 HARD PASS** (2026-07-09, 60 fps desktop / 2.04M tris / 487.4 KB, canary healthy — the lighting lift cost nothing, as designed).
- **GATE CLOSED (2026-07-09): gate-verifier verdict PASS on re-dispatch** — see the Phase checklist entry. Verifier's non-blocking flags, all handled or carried: stale "1.5 s" comments in `puzzle2.spec.js`/`handoff.md` fixed at gate close; Pillar-C residual carried under D-4 (Phase 5, acceptance test = `tools/pixel-check.mjs`); DELTA #5/#6 (wall machinery density, console greebling) are the next-cheapest visual wins for a future round.
- **Next: Phase 3 (xhigh)** — Puzzle 3 (laser) + full escape; server-raycast validated; win/lose sequences; reference-delta. All 3 roles required (2026-07-04 amendment); carry the EnvironmentProbe D-4 debugging round when the fps budget allows. **Fresh session starts here per the user's phase protocol.**

## Phase 3 progress (2026-07-09 — FEATURE-COMPLETE, gate NOT closed)

**Everything below is verified by a tool result this session.** Not run at all:
`npm run verify`, perf-probe, hero capture — all GPU-serial, and the user
reported a busy machine. **No fps or triangle claim is made for Phase 3.**

Verified: `vitest 102/102`, `lint 0 warnings`, client build clean,
`node tools/authority-probe.mjs → 14/14 PASS (exit 0)`,
**full Playwright suite `8/8 passed` (2.5 min, serial)** — including the solo-swap
1→2→3 escape and the misfire lockout.
**Bundle, measured the way the gate measures it** (JS+CSS gzip, excl. the
Rapier WASM chunk): **495.0 KB = 506,928 B against the 512,000 B floor —
passing with only ~5 KB of headroom.** (A subagent reported "504 KB" from
vite's 1000-based main-chunk number; that is not the floor's metric.)

### Three real bugs the tests found (none of which a green unit suite could see)

1. **Emitter arc end-stop.** With the arc centred on +x, 11/200 seeds put the
   winning heading exactly on an arc stop, where the Engineer's dial cannot
   turn further. Arc recentred on +34° with a 2-step end margin. *The whole
   suite passed symbolically the entire time — the D-6 failure class.*
2. **Two mirrors inside one interaction radius.** The generator kept mounts
   2.5 m apart while `STATION_RANGE` is 3 m, and `LaserArray.resolveTarget`
   takes the FIRST station in range — so standing at one mirror rotated the
   other, and the player could never turn it (seed 132). Separation is now
   `STATION_RANGE + 0.4`; regression test added.
3. **The deck's only doorway was ~0.3 m wide.** The partition spanned
   z ∈ [-8, 8] and the overseer's pedestal sits at [0, 8.5] — squarely in the
   gap between its end and the back wall. P1/P2 never require a crossing, so
   nothing caught it; P3 seeds mirrors on BOTH sides and the Technician must
   get through. Pane shortened to 12 m (z ∈ [-6, 6]). Role separation is
   unaffected (enforced by the role gates; consoles sit at z=0).
   *A fourth, fixed earlier: a mirror could spawn on a player spawn point and
   wedge that character for the entire round.*

Also fixed by reading the input path (no test would have caught it): pressing
`E` at the receiver called `applyDir` first, which armed the 90 ms input
throttle with nothing to steer, throttling out the `applyOpen` that follows in
the same keypress — **the Overseer's aperture could never be opened from the
keyboard, making P3 unsolvable.**

### Committed (six commits on `main`, tree clean)

- `d95e5a0` — **`shared/laserPuzzle.js`**: the P3 single source of truth (pure,
  clock-injected, dependency-free; server `require()`s it, solo client imports
  it — same pattern as `scannerPuzzle.js`). `traceLaser` is the raycast (2D XZ
  ray/segment + ray/circle, MAX_BOUNCES reflections; reactor + walls absorb,
  containment glass transmits). Engineer steers the emitter arc, Technician
  rotates 3 mirror mounts, Overseer opens a `RECEIVER_HOLD_MS`=10 s aperture
  latch — the latch is what lets solo-swap solve the IDENTICAL puzzle. An
  aligned beam resting on a SHUT aperture past `MISFIRE_GRACE_MS` trips a
  lockout. All timing/step constants carry literal pin tests (the D-6 lesson).
  **32 unit tests.**
  - **Pillar A proven empirically, not argued.** No Technician: exhaustive over
    all 49 headings × 50 seeds → never a hit. No Engineer: exhaustive over all
    72³ = 373,248 mirror combinations at the initial heading (seed 9) → 0 hits,
    plus the structural invariant (initial beam clears every mirror's max
    reach) checked across 50 seeds. No Overseer: an aligned beam misfires into
    lockout instead of winning. **Mutation control:** the same 373k sweep at the
    SOLUTION heading yields 10,733 hits — the exhaustive test is not vacuous.
    (Correction 2026-07-13: originally recorded as 5,719 — a stale pre-arc-recentring
    figure the Phase-3 gate-verifier caught; now a pinned test in laserPuzzle.test.js.)
  - **Gameplay bug found + fixed while testing (would have shipped invisibly):**
    with the emitter arc centred on +x, 11/200 seeds put the winning heading
    exactly on an arc end-stop, where the Engineer's dial cannot turn further.
    Arc recentred on `EMITTER_BASE_DEG`=+34° (where the mirror field actually
    lies) with a 2-step end margin; regression test added. 300/300 seeds now
    valid, median solution step 25 of 48. *The whole suite passed symbolically
    before this — same failure class as D-6.*

- `543f33b` — **server: the 2→3 chain + laser role events.** `puzzleState` is
  now `{ stage: 1|2|3, p1, p2, p3 }`. **The P2 solve no longer wins** — it
  advances to stage 3 + `activateLaser`; only the P3 raycast solve sets
  `phase='win'`. Three new events (`steer-emitter`, `rotate-mirror`,
  `open-aperture`) trust NO client payload for role or position (both resolved
  from the server's own `room.players` record), each rate-limited, stage-gated,
  range-checked, acked via `laser-result`. `gameLoop` runs `tickLaser` at 30 Hz
  when stage 3 — the latch, the lockout AND the solve are clock-driven, so the
  tick alone can win the game, not only a player action. `createPuzzleState(seed)`
  threads a per-room seed (§1 determinism). The solution never enters room state
  or any broadcast.
  - **`tools/authority-probe.mjs`: 8 → 14 assertions, 14/14 PASS, exit 0**
    (re-run independently this session). New: fabricated P3 events are no-ops;
    `steer-emitter` rejected while stage≠3; wrong-role cross-station actions
    rejected; out-of-range action by the correct role rejected; **a full
    legitimate 1→2→3 escape reaches `phase='win'` via legal role events only**;
    and a deep check that no broadcast ever contains a `solution` key.
  - Fixed en route: the probe re-declared stale copies of the shared constants
    (`ARM_WINDOW_MS=1500` vs the shared module's 3000; overseer scanner pos
    `[0,6.5]` vs `[0,8.5]`). It now imports them from `shared/`. Exactly the
    drift D-6 exists to prevent.

- `41e4cac` + `e47d937` — **client: role gates, props, store, net, HUD, scene.**
  `game/roleGates.js` gains `laserStationAccess` (exactly one role per station,
  no solo parameter) with exhaustive role × station × range tests.
  `components/LaserArray.jsx` — procedural emitter / 3 mirror mounts / receiver
  iris, and the beam rendered directly from the shared `traceLaser` polyline
  (one source of truth; no separate client simulation). `gameStore` gains `p3`
  (seeded via `?seed=N`), the three role actions, and the `tickLaserPuzzle`
  solo pump. Online, all three actions emit through `netEmitters` and never
  touch the local machine. `useMultiplayer` registers the emitters + the
  `laser-result` ack. HUD flips to a per-ROLE stage-3 objective, and mobile gets
  a ◀ / ▶ pair (Pillar E: Q/E had no touch equivalent).
  - Bug the store tests caught: the solo P1 solve rebuilt `puzzleState` as an
    object literal `{stage, p1, p2}`, silently **dropping `p3`** — every solo
    run threw at stage 3.

- `2ca0566` + `f18abf0` — **e2e + the room fixes + win/lose sequences.**
  `client/e2e/puzzle3.spec.js` (2/2): the brief's §5.2 acceptance run — the
  Engineer steers, the Technician rotates and **holds back the final step**
  (finishing against a sealed aperture is a sensor overload by design), the
  Overseer opens the 10 s latch, the player swaps back and lands it → `win`.
  The spec asserts that after two roles have acted it is STILL unsolved, and
  that `p3` never contains a `solution` key. Second test: aligned beam on a
  sealed aperture → lockout → input rejected → recovery with the alignment
  preserved. `puzzle2.spec.js` updated (a P2 solve now yields stage 3, not a
  win).
  - `EndgameSequence.jsx`: diegetic blast-door / escape-pod on win, reactor
    meltdown wash on lose, plus timer-driven alarm escalation that mutates the
    **existing** reactor/alarm/sector lights — no new light, no new shadow
    caster, no new pass. Both respect `prefers-reduced-motion` and cap the
    pulse rate (photosensitivity).
  - e2e harness note: the axis-by-axis walker in puzzle1/2 cannot navigate a
    room with three seeded colliders. puzzle3 uses a greedy stepper with
    obstacle + partition awareness. Two harness bugs worth remembering: it drove
    the WRONG character whenever a swap keypress silently failed (swaps are now
    verified against `activePlayerId`), and **an idle teammate is a solid
    capsule** that will block the doorway (teammates are now obstacles).

### Phase-3 gate session (2026-07-13) — delta round 3 + battery PASS

1. **Reference-delta round 3 COMPLETE** (`docs/DELTA.md` 2026-07-13, commit
   `06d67ab`): top-3 fixed and verified by re-render — (a) partition-post bloom
   blowout **regression** (the doorway fix put the +z post 2.7 m in front of
   the hero camera at neon 2.2; → 0.9, under the bloom threshold), (b) laser
   props reshaped (real mirror faces + rim-frame state glow, emitter/receiver
   housing — §4), (c) DELTA #5 wall machinery shipped (~35K instanced tris,
   Sonnet subagent + two orchestrator fix rounds: depths were based on the
   collider face and buried behind the panelling; lamps were free-floating
   confetti — both caught by validating the actual render). Pillar-C bonus,
   pixel-checked: right band 95.9→77.1% <5%-sRGB, left 45.2→34.9%.
2. **Battery `--phase 3`: 6/6 HARD PASS** (2026-07-13, idle machine, attempt 3;
   a `--phase 3` manifest had to be added to `verify.mjs` first — Phase 3 had
   never wired one). Desktop **60 fps / 2.08M tris / 545 draws, canary 60
   (healthy), warmup 20.1s**; mobile **60 fps / 1.94M tris**; bundle
   **496.1 KB / 500 KiB (~4 KB headroom — round 3 cost 1.1 KB)**.
   Attempts 1–2 failed in the puzzle3 e2e and exposed three real walker-model
   bugs (fixed in `55d7ae9` + the BFS commit): teammates were goal-exempt in
   `blocked()` (walker drove INTO the Overseer's idle capsule 0.78 m from the
   left doorway waypoint); prop radii were ~half the real collider footprints
   (console 1.7 m base modeled at r 0.4 — physical wedge the probes called
   free); and the myopic greedy structurally cannot round a large keep-out.
   The walker now plans with a 0.4 m grid-BFS (`planPath`) over the same
   `blocked()` model and follows decimated waypoints — suite ~3× faster.
   The escape run also parks the Overseer clear of the doorway first (an idle
   teammate is a solid capsule — the standing gotcha, now load-bearing).
3. **GATE CLOSED (2026-07-13): gate-verifier verdict PASS on first dispatch** —
   see the Phase checklist entry for the full evidence + rubric. Its one
   finding (drifted mutation-control figure) fixed and pinned at gate close;
   vitest 103/103 + lint 0 after.

## Next: Phase 4 — Mobile/touch parity + adaptive ladder + graceful degradation

Fresh session starts here per the user's phase protocol. Carried context:
- **Bundle floor is currently MISSED, not just tight — re-measure before Phase 4 work.**
  A plain `npm run build` on 2026-07-15 measured **506.10 KB gzip (index.js) +
  3.31 KB (index.css) = ~509.4 KB**, excl. the carved-out Rapier WASM chunk —
  over the §2 500 KB gzip floor, up from the 496.1 KB recorded at the Phase-3
  gate close (`c2cb311`..`394e6d2`, no dependency changes in that range visible
  from `package.json` diffs). Not yet bisected — first Phase-4 task should
  re-run `perf-probe.mjs --mode assert` to confirm/quantify, then bisect what
  grew. Do not add a dependency until this is back under floor.
- Real-device verification is Phase 4's gate (all mobile numbers so far are
  desktop-GPU emulations, recorded as such).
- Carried from the Phase-3 verifier: stage-3 hero capture variant + alarm-
  escalation frame comparison (both Phase-5 delta-round items); D-4 GI payback
  (Pillar C, acceptance test `tools/pixel-check.mjs`); EnvironmentProbe
  debugging round.

Carried: the EnvironmentProbe D-4 debugging round when the fps budget allows;
Pillar-C residual under D-4 (acceptance test `tools/pixel-check.mjs`).

## Deploy (2026-07-15) — Render free-tier blueprint added, outside the phase ladder

Not a phase deliverable — a side-quest to get the current build in front of
family/friends. The app already ran single-server (Express serves
`client/dist` + Socket.IO on one origin; client connects via `io(undefined)`
same-origin) from the ngrok-testing work, which turned out to be exactly the
right shape for a free-tier PaaS deploy — no architecture change needed, only
plumbing:
- `render.yaml` (Blueprint manifest) + a root `npm start` (`node server/index.js`)
  added in `394e6d2`. Verified locally end-to-end before pushing: built the
  client, ran the server standalone, confirmed `/`, `/socket.io/...`, and a
  built JS asset all 200 from the same port.
- The two "NGROK TESTING ONLY — delete before commit" comments (`server/index.js`,
  `useMultiplayer.js`) were **relabeled, not deleted** — same-origin serving
  is now the permanent deploy strategy, not throwaway test scaffolding. The
  CLAUDE.md ngrok-cleanup instructions predate this and no longer apply to
  those two spots.
- **Gotcha:** Render's Blueprint deploy reads `render.yaml` off whatever branch
  the service is pointed at. First attempt failed with "Blueprint file
  render.yaml not found on main branch" because the file was still local/
  uncommitted; a second, unexplained mismatch traced to the Render dashboard
  service being pointed at a branch (`tomtom`) that doesn't exist in this repo
  or its `origin` at all (`git branch -a` after `git fetch` shows only `main`
  and `docs/sector9-requirements-scaffold`) — likely a stray/typo'd branch
  selection made directly in the Render UI when the service was first created,
  unrelated to anything in this repo. Fix is on the Render side: Settings →
  branch → `main`.
- Free-tier caveat to flag to playtesters: the service spins down after 15 min
  idle; first request after that takes ~30-60s to wake, which will look like
  a hang on a cold "start game" click.

## Gotchas (append-only; newest first)

_(Carry forward the hard-won ones from `handoff.md` as they recur under the new stack; add new ones here rather than re-debugging.)_

- **A prop's interaction radius must be smaller than the gap between props of the same kind.** `LaserArray.resolveTarget` (like every console on this deck) takes the FIRST station within range, so two mirrors 2.86 m apart with a 3 m `STATION_RANGE` meant standing at one rotated the other, unreachably. Any new seeded prop needs `separation > STATION_RANGE`, enforced in the generator and pinned by a test.
- **An idle teammate is a solid capsule.** Inactive characters keep their colliders, so one parked in a doorway blocks the character you are driving. It cost an hour of e2e debugging that looked like a phantom collider; the give-away was that the *other* player's stored position had drifted.
- **Press/release stepping in an e2e walker is 3× slower than holding the key.** The hover droid decelerates between steps and the walk becomes CDP round-trips: puzzle3 passed alone but timed out inside the full suite. Hold the key, poll position, change the key only when the direction changes (`greedyWalk`), and always release in a `finally`. Also: a walker's wall bound must sit OUTSIDE what the capsule can actually reach (9.6, not 9.4) — a character resting past the bound has every probe rejected and deadlocks in the corner.
- **In an e2e, a swap keypress that silently fails is invisible and catastrophic**: the walker drives the wrong character while polling a position that never changes, so it reads as "stuck against a wall". Always poll `activePlayerId` after a `1`/`2`/`3` press before moving (`swapTo` in puzzle3.spec.js), and assert the character you drive is the active one.
- **Bind one key to two actions and the input throttle will eat one of them.** `E` fed both `applyDir` and `applyOpen`; `applyDir` stamped the throttle clock even when it had nothing to steer, so the aperture could never open. Only arm a throttle when an action actually fires.
- **The GPU canary is blind to CPU/compositor contention.** 2026-07-08 Phase-2 re-bisect: successively CHEAPER render configs measured 59→56→55 fps while the raw-ALU canary read a healthy 60 every run — the canary only proves the GPU itself is free, not that Chrome/CDP/compositor scheduling is. Symptom of an invalid window: fps moves opposite to the change you made. Treat any floor decision from such a window as unmeasured and re-run idle; consider adding a CPU canary to perf-probe.
- **`npm run capture` with no `--out` writes to `docs/shots/phase0-hero.png`** and will silently overwrite the historical Phase-0 gate shot (it did, 2026-07-08 — restored from git). Always pass `--out docs/shots/phase<N>-hero.png`.
- **Playwright keystroke bursts stretch under machine load**: six `keyboard.press` round-trips can exceed P2's arm window (1.5 s at the time; 3.0 s since D-6) on a loaded box, correctly failing into lockout — e2e flake, not a bug. `puzzle2.spec.js` retries the identical burst after the cooldown (never relaxes the mechanic).
- **`colliders="cuboid"` on a RigidBody whose meshes are `visible={false}` generates ZERO colliders** — @react-three/rapier auto-collider generation walks `traverseVisible`. Every collider-only body needs `includeInvisible` (Room.jsx, fixed 2026-07-08). Symptom was players free-falling forever behind a rescue-teleport loop that made e2e still pass; `puzzle1.spec.js` now fails on any "fell through floor" console warning.
- **drei `<AdaptiveDpr>` + a Canvas `dpr` clamp below the device ratio = 1 fps.** It re-asserts its own dpr every frame; each write resizes the canvas and rebuilds every WebGPU pipeline. Removed from GameCanvas.jsx (2026-07-08).
- **Perf numbers are only comparable within one machine-load window.** The user's Chrome at ~100%+ CPU cuts headless WebGPU throughput ~40%+ (raw-ALU canary 60 → 35 fps). perf-probe now measures a GPU canary before the game and flags contended runs; treat any floor miss with a canary < 50 as environment-suspect and re-run idle.
- **Glass `transmission > 0` (MeshPhysicalNodeMaterial) costs a full-res scene copy + mip chain every frame** — ~20% of scene-pass time for two thin panes (2026-07-08 bisect). Use plain alpha transparency unless refraction is actually visible.

- drei `<Html>` interactables that must be CLICKED should be screen-fixed (`calculatePosition`) while open — 3D-tracked overlays re-transform on every camera micro-move (droid hover bob) and never pass Playwright's element-stability check; humans feel it as swimmy UI too.
- Clamp frame-delta-driven lerp factors to <=1 (`Math.min(1, k*delta)`). WebGPU pipeline compiles cause multi-second delta spikes; an unclamped `lerp(target, 5*delta)` overshoots and oscillates permanently — symptom: drei `<Html>` overlays never pass Playwright's stability check ("element is not stable").
- React 19 `<StrictMode>` + fiber v9 async WebGPU `gl` factory = frame loop freezes after first frame, zero errors. StrictMode is off in `main.jsx` on purpose. Full writeup: `docs/R3F-WEBGPU-NOTES.md` 2026-07-07.
- Read `renderer.info` in `addAfterEffect`, never `useFrame`, under WebGPU — the renderer's internal Animation loop resets Info every tick and pre-render reads report zeros. Per-frame draws = `info.render.drawCalls` (not `calls`).
- drei `<ContactShadows>` (and anything customizing materials via WebGL hooks) fails NodeBuilder under WebGPU with per-frame console errors that also tank fps.

- Rapier rigid-body `type` transitions are async — `linvel()` can return `NaN` on the first frame after a solo-swap type change. Guard velocity/position reads against `NaN` before writing to the store, or the camera-follow lerp propagates `NaN` into a permanent black screen. (from `handoff.md`)
- Third-person camera can clip through/behind room walls; keep boundary colliders but handle the visual so the camera never renders from inside an opaque mesh. Revisit under the WebGPU renderer. (from `handoff.md`)
