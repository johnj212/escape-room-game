# Handoff: Sector-9 Command Deck

> **Two-layer document.** §0 below is the CURRENT session state (read this first).
> Everything from "Handoff (v0.2)" onward is the historical build log for the
> original R3F v8 game — kept for its hard-won debugging lessons, not as current
> status. When in doubt, `STATUS.md` is the source of truth, not this file.

---

## 0a. Current session handoff (2026-07-09, fourth session — PHASE 3 IN PROGRESS, halted on spend limit) — READ FIRST

**Read `STATUS.md` → "Phase 3 progress" for the full, evidence-backed state.**
Short version: the P3 laser puzzle's shared machine and the entire server side
are DONE and verified (authority probe 14/14, exit 0, including a full
legitimate 1→2→3 escape to `phase='win'`). The client side is half-done:
`laserStationAccess` role gates are tested and green, and `LaserArray.jsx`
exists but is **unwired and would throw if mounted** — `gameStore` has no `p3`
and none of the three actions it calls. Nothing imports it, so lint/tests/build
are all green on `main`.

**Resume at STATUS.md "Next session starts here" step 1** (finish the client
track: store actions + solo tick pump, useMultiplayer emitters, HUD, then mount
the component). Everything after that is unchanged from the plan.

Lessons from this session, worth carrying:

- **Both Sonnet subagents died mid-task on a monthly spend limit.** Because the
  contract module (`shared/laserPuzzle.js`) was written and committed FIRST,
  neither death corrupted the design — the server track finished and verified
  independently. Contract-first fan-out survived a hard cutoff. Keep doing it.
- **A test that fails twice in the same place is telling you the diagnosis is
  wrong, not that the test needs adjusting.** Both failures traced to a real
  gameplay bug: the emitter arc was centred on +x while the mirror field sits
  up-field, so 11/200 seeds put the winning heading on the dial's end-stop.
  Recentred to +34°. The suite had passed symbolically the whole time.
- **Prove a Pillar-A test isn't vacuous.** The 373k-combination no-Engineer
  sweep returns 0 hits — but the same sweep at the solution heading returns
  5,719. Without that control, "0 hits" could just mean the trace was broken.
- GPU-serial work (e2e, verify, perf, capture) was NOT run — the user reported a
  busy machine. No fps or triangle claim is made for Phase 3.

---

## 0. Previous session handoff (2026-07-09, third session — PHASE 2 GATE CLOSED)

### Rehydration: read STATUS.md fully (esp. the Phase-2 gate-close entries),
### the brief, docs/R3F-WEBGPU-NOTES.md, docs/DEVIATIONS.md (now D-1..D-6), and
### the newest docs/DELTA.md entry (2026-07-09). Never re-plan from scratch.

### Where we are

**Phase 2 is CLOSED (gate-verifier PASS on the second dispatch, 2026-07-09).**
The next session starts **Phase 3 (xhigh): Puzzle 3 (laser) + full escape** —
server-raycast validated, win/lose sequences, all-3-roles (2026-07-04
amendment), reference-delta round, then gate. Carried context:

- **D-6 (new deviation):** the P2 arm window is 3.0 s, not the brief's 1.5 s —
  the USER widened it in playtest commit `9b04c77` (no Claude trailer). Kept
  deliberately; pinned by literal-value tests in `scannerPuzzle.test.js`. Any
  timing constant in a spec needs a literal pin test — symbolic-only usage let
  this drift invisibly through a green 39-test suite.
- **`tools/pixel-check.mjs` (new):** reproducible luminance-band measurement
  (Playwright-decoded, Rec.709 linear, `--band`/`--threshold`). ALL future
  "% below X luminance" claims in DELTA.md must cite it — the round-1 FAIL
  partly stemmed from irreproducible ad hoc numbers. It is also the named
  acceptance test for the D-4 GI payback (Phase 5).
- **Pillar C residual (carried, not blocking):** hero right band 95.9% below
  the 5%-sRGB bar vs reference 36.8%. Directed-light constants are exhausted
  (fog color does NOT touch those pixels — nearer than the fog start; magenta
  wash scores structurally low on Rec.709). The fix is D-4 bounce/GI, Phase 5.
- **ngrok state is still committed** (server static-serving block +
  `io(undefined)` in useMultiplayer.js): networked multiplayer under local
  Vite dev (5173) has no socket path — no proxy exists. Solo mode, e2e, and
  the authority probe are unaffected. Revert per CLAUDE.md's markers when the
  user is done with public playtests.

### What worked / what didn't this session (append to the lists below)

- The user chose gate order up front via one structured question (idle-machine
  check included) — zero mid-run stalls; every step ended in a commit, so a
  4-hour-limit cutoff would have lost at most one step.
- The fresh-context gate-verifier FAILing round 1 was the system working: it
  caught a user-side spec drift (D-6) the entire green battery could not see,
  plus an irreproducible-measurement smell. Fixed + re-dispatched same session;
  round 2 PASSed after independently reproducing the new pixel numbers.
- Perf lesson repeated: last session's "59/56/55 fps" floor misses were pure
  machine-load artifacts — the identical tree measured 60 first-try on an idle
  machine. Never spend D-5 knobs on numbers from a contended window.

### Previous session's notes (2026-07-08, Phase 2 feature-complete)

- Fan-out worked: server track (chain + authority probe, sonnet subagent) and
  client track (that session inline) built against a shared contract module
  written FIRST (`shared/scannerPuzzle.js`) — zero integration friction.
- The delta-round subagent hit the spend limit mid-optimization; its visual
  work was sound but its fps re-bisect had to be finished inline. Its first
  draft cost 9 fps (fractal grime / FogExp2 / 360 additive motes) — costs and
  cheap replacements are documented in DELTA.md round 2's perf note.
- Do NOT trust perf numbers from a window where cheaper configs measure lower
  (see the canary-blind-spot gotcha in STATUS.md). Late-session numbers there
  were invalid; nothing was concluded from them.

# Previous session handoff (2026-07-08, Phase-1 close) — kept for its lessons

### Rehydration (do this before touching anything)

1. Read `STATUS.md` fully — it is the live rehydration protocol and phase tracker.
2. Read `Project_Requirements.md` (the brief: pillars, floors, banned outcomes, phases).
3. Read `docs/R3F-WEBGPU-NOTES.md` (verified stack facts + hard-won WebGPU/TSL
   gotchas — do NOT re-derive or re-debug these) and STATUS.md "Gotchas".
4. Skim `docs/DEVIATIONS.md` (now D-1..D-5) and the newest `docs/DELTA.md` entry.
5. **Never re-plan from scratch.** Continue from STATUS.md "Current focus".

### Goal

Autonomously loop-engineer the brief's phase plan (user instruction: "loop engineer
these features"). Phases 0–5 gated; a phase closes only after the verify battery,
reference-delta, and a fresh-context `gate-verifier` agent dispatch. User protocol:
**stop at each phase close for handoff + a fresh context window.**

### Where we are (verified, all on `main`, tree clean at the Phase-1-close commit)

- **Phase 0: CLOSED** (2026-07-07, gate-verifier PASS). Grade visuals against
  **`reference/sector9_deck_hero.png`**, NOT `media__new_visuals.png` (menu card only).
- **Phase 1: CLOSED** (2026-07-08, gate-verifier PASS — independent 5/5 battery,
  per-item evidence, zero banned outcomes). WebGPU-only game on React 19 / fiber 9.6 /
  three 0.185 `WebGPURenderer` + TSL; **all §2 floors MET on the production build**:
  desktop 60 fps / 2.02M tris / 484 KB gzip (dpr-1.5 canvas, 0.55-scale scene pass +
  FXAA — D-5), mobile 60 fps / 1.89M tris (emulated). Verifier's Pillar-C flag
  (near-black walls) was fixed post-verdict — root cause was ~1%-albedo dark metal
  (`#0d1017`), not lighting — and re-verified (battery 5/5 after).
- **Two false beliefs were killed this session — don't resurrect them:**
  (1) prior "60 fps" STATUS claims did not reproduce (old probe sampled during
  pipeline-compile warmup); the honest pre-optimization baseline was ~10 fps.
  (2) The room had ZERO physics colliders since the Deck rebuild (rapier auto-colliders
  skip `visible={false}` meshes) — players free-fell behind a rescue-teleport loop.
  Fixed via `includeInvisible`; e2e now fails on any "fell through floor" warning.
- **Battery: `node tools/verify.mjs --phase 1` → 5/5 HARD PASS.** perf-probe measures
  the PRODUCTION build (`vite preview :4173`), waits out compile warmup, and runs a
  GPU-contention canary (threshold 59) — verify.mjs retries perf steps ≤3× when the
  canary flags a contended machine (user's Chrome busy = numbers invalid, not failed).

### What worked (keep doing)

- One coherent chunk per iteration → empirical probe in headless Chromium
  (`--enable-unsafe-webgpu --use-angle=metal`) → battery → STATUS update → commit.
- **Relative A/B measurement within one machine-load window** + the GPU canary to
  reject contended windows; absolute floor claims only with a healthy canary.
- Root-causing with pixel math instead of trusting eyeballs (the "black walls" were
  albedo, not lights — two lighting raises did nothing until the material fix).
- Fan-out: a tools-only subagent (battery wiring) + a read-only investigator (physics)
  ran while the GPU-serial perf work continued inline — GPU measurements must never
  run in parallel.
- Fresh-context gate-verifier at the gate (its pixel-measured Pillar-C flag was real).

### What didn't work (do NOT retry blind)

- All previous entries in docs/R3F-WEBGPU-NOTES.md + STATUS Gotchas still stand
  (StrictMode×async factory; ContactShadows; renderer.info in useFrame; CA/GTAO traps;
  EnvironmentProbe D-4 unmounted; shim edits need `.vite` cache clear).
- NEW: drei `<AdaptiveDpr>` + a Canvas dpr clamp below device ratio = per-frame canvas
  resize = full pipeline rebuild = 1 fps (removed).
- NEW: `colliders="cuboid"` + `visible={false}` = no collider (needs `includeInvisible`).
- NEW: glass `transmission > 0` costs a full-res scene copy + mips per frame (~20% of
  scene pass) — keep alpha-only unless refraction is actually visible.
- NEW: don't pipe `verify.mjs` through `tail` — it swallows the exit code.

### Next steps (Phase 2 — fresh session starts here)

1. **Puzzle 2 — Tri-Vector Hand Scanners** (brief §3.14): 3-role simultaneous arm
   within a rolling window (spec 1.5 s; shipped 3.0 s per D-6 user playtest tuning); each scanner LATCHES armed a few seconds so
   solo-swap solves the identical puzzle across swaps; failure → lockout cooldown.
   Server-side 1→2 chain; Pillar-A test proving 2 roles cannot complete it.
2. **Pillar-D server-authority probe** (verifier rubric D=4): scripted client emits a
   fabricated solve + teleport → assert authoritative state unchanged. Becomes real
   with the server-side chain work.
3. Reference-delta round (per phase, mandatory): biggest carried gaps = reactor
   containment detail, ambient haze/motes, floor grime/wear.
4. Gate: e2e solves P1→P2, lockout verified, server-authoritative, reference-delta —
   then gate-verifier dispatch, fix findings, check the box, STOP for handoff.

# Handoff (v0.2) — historical build log (original R3F v8 game)

This section summarizes the original build: initial request, what worked, what
didn't (with solutions), and lessons learned. Retained for its debugging lessons;
the Rapier/camera/NaN gotchas below still apply under the current stack.

---

## 1. Initial Request & Visual Upgrades
* **Core Goal:** Design and build the initial playable version of a multiplayer 3D cyberpunk escape room game ("Sector-9 Command Deck") for 3 players, implementing the first puzzle: **The Decoupled Power Grid**.
* **Key Features:**
  * **Role-based Asymmetric Puzzle:** The Engineer (P1) sees a flashing wire sequence cipher on a holographic projector console. The Technician (P2) must access a switchboard terminal to toggle matching wire grids. The Overseer (P3) coordinates their efforts.
  * **Controls:** Desktop keyboard/mouse controls and mobile-friendly virtual joysticks (via `nipplejs`).
  * **Play Modes:** Authoritative multi-client server mode (Socket.io) or solo swap mode (offline keyboard swapping using keys `1`, `2`, `3`).
  * **Aesthetics:** Sleek, premium cyberpunk visual style with physically-based rendering (PBR), neon emissives, glassmorphism UI overlays, bloom, vignettes, and chromatic aberration.

---

## 2. What Worked
* **Concurrently Managed Monorepo:** Configured Vite client (port `5173`) and Node/Socket.io backend (port `3001`) with concurrently launching start-scripts.
* **Asymmetric State Machine:** Auth server managing rooms, player assignments, countdown ticks, wire-toggles, and puzzle verification.
* **Procedural 3D Holograms & Volumetric Cones:** Generated wire sequence cards dynamically based on server-side ciphers, adding additive blending light projections and sliding horizontal scanlines.
* **Interactive 3D Sockets**: Added physical sockets to the switchboard console that light up with high-intensity bloom colors dynamically when users toggle wire cards in the UI HUD.
* **PBR Material Upgrades**: Replaced flat colors with detailed, procedurally generated metallic floor plating (complete with beveled rivets and micro-scratches) and wall panels drawn dynamically on HTML canvases.
* **Hovering Mech Droids**: Upgraded players to animated hover droids with bobbing movement, spinning stabilizers, visors, antennae, and flickering thruster flames.
* **Menu Concept Integration**: Integrated a realistic room render as a masked background on the lobby menu and game over screens.
* **Automated Vitest Test Suite**: Added 13 unit and code auditing tests to verify store boundary safety, component setups, and texture generators.

---

## 3. What Didn't Work (And Was Fixed)

### A. Rapier Capsule Shape Resolution
* **Issue:** Setting `colliders="capsule"` on the `RigidBody` component threw runtime errors (`TypeError: Rg[options.shape] is not a function`), causing players to fail loading.
* **Fix:** Manually defined `<CapsuleCollider args={[0.3, 0.3]} />` child components inside the `<RigidBody>` wrappers to bypass package-specific automated shape resolution.

### B. RigidBody State Transitions (`NaN` Velocity & Position Loop)
* **Issue:** When swapping between players in solo mode, body types transition from `kinematicPosition` to `dynamic`. In the first frame of this asynchronous transition, `linvel()` returns `NaN` coordinates. Setting this velocity caused player position arrays in the Zustand store to become `NaN`, permanently locking the camera follow loop into a black screen void.
* **Fix:**
  * Added linear velocity validation in `Player.jsx`:
    ```javascript
    const velY = linvel && typeof linvel.y === 'number' && !isNaN(linvel.y) ? linvel.y : 0;
    ```
  * Added safety checks before updating the player positions in the store.
  * Added auto-recovery inside `GameCanvas.jsx`: if `camera.position` contains any `NaN` values, it directly snaps to the target position rather than breaking.

### C. Camera Obstruction (Opaque Front Wall)
* **Issue:** The third-person camera tracks players with an offset of `[0, 5, 8]`. When Player 3 (Overseer) active at `z = 4` or Player 2 walked forward, the camera coordinate exceeded `z = 10`. This placed the camera behind the solid opaque front wall mesh, rendering a black void.
* **Fix:** In `Room.jsx`, kept the front wall physical collider parameters for boundaries but made its visual `<mesh>` invisible via `visible={false}`. This allows the camera to view the scene from outside without obstruction.

### D. Peer Dependency Mismatch WebGL context loss (EffectComposer crash)
* **Issue:** Installing the latest `@react-three/postprocessing` (v3.x) threw `Cannot read properties of undefined (reading 'length')` inside `EffectComposer` because it expects React Three Fiber v9, whereas our project runs Fiber v8 (which structure children inside internal instance objects differently).
* **Fix:** Downgraded `@react-three/postprocessing` to `2.16.2`, removed Vite's cached bundles inside `node_modules/.vite`, and restarted the dev environment to clean pre-bundled caches.

### E. Physics Spawn falling-through-floor
* **Issue:** The dynamic player-1 was falling through the floor on startup because the static floor collider had not finished registering in the physics world when gravity started simulation.
* **Fix:** Raised spawn heights of all player roles from `0.6` to `1.2` on both the client store (`gameStore.js`) and the server side (`server/index.js`). Players now fall a safe 0.6 units to the ground upon initialization.

### F. Empty Array State Corruption
* **Issue:** The Zustand store's position guard was bypassed by empty arrays `[]` since `.some()` returns false on empty arrays, which could lead to state corruption.
* **Fix:** Added a coordinate array length check `position.length !== 3` inside `updatePlayerPosition` to reject any malformed coordinates.

---

## 4. Lessons Learned for Future Sessions

1. **Camera Collisions in R3F:**
   When designing a closed room with a third-person camera, avoid placing visual meshes on walls facing the camera offset path. Instead, use physics-only boundaries (`<RigidBody>` colliders with `visible={false}` meshes) so the camera can see through them.
2. **Dynamic RigidBody Type Switching:**
   Changing Rapier rigid body `type` properties dynamically is asynchronous. Always guard linear velocity queries and position updates against `NaN`/`undefined` values during transition frames to prevent corruption of the state machine.
3. **Camera Follow Fallbacks:**
   When writing camera lerp systems, always implement a check for `NaN` coordinates. If the camera position is corrupted, snap it to the target tracking point rather than letting `lerp` propagate `NaN` indefinitely.
4. **Library Version Matching (R3F Ecosystem):**
   Three.js libraries (especially `@react-three/drei` and `@react-three/postprocessing`) are tightly coupled with `@react-three/fiber` versions. Bypassing peer warnings via `--force` or `--legacy-peer-deps` can introduce runtime crashes in components that query Fiber metadata. Always match `postprocessing` v2.x with Fiber v8, and `postprocessing` v3.x with Fiber v9.
5. **Physics Spawn Heights:**
   To prevent dynamic physics bodies from slipping past static floors during initial world building (initialization race conditions), spawn characters 0.5 to 1.0 units above the floor rather than flush with it.
6. **Array Validation Guards:**
   When guarding coordinate arrays against `NaN` using `.some()`, always prepend length checks (e.g., `length === 3`) since `.some()` on empty arrays `[]` evaluates to `false` and bypasses checks.
