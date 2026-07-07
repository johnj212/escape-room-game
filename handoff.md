# Handoff: Sector-9 Command Deck

> **Two-layer document.** §0 below is the CURRENT session state (read this first).
> Everything from "Handoff (v0.2)" onward is the historical build log for the
> original R3F v8 game — kept for its hard-won debugging lessons, not as current
> status. When in doubt, `STATUS.md` is the source of truth, not this file.

---

## 0. Current session handoff (2026-07-07) — READ FIRST

### Rehydration (do this before touching anything)

1. Read `STATUS.md` fully — it is the live rehydration protocol and phase tracker.
2. Read `Project_Requirements.md` (the brief: pillars, floors, banned outcomes, phases).
3. Read `docs/R3F-WEBGPU-NOTES.md` (verified stack facts + 9 hard-won WebGPU/TSL
   gotchas from this session — do NOT re-derive or re-debug these).
4. Skim `docs/DEVIATIONS.md` (now D-1..D-4) and the newest `docs/DELTA.md` entry.
5. **Never re-plan from scratch.** Continue from STATUS.md "Current focus".

### Goal

Autonomously loop-engineer the brief's phase plan (user instruction: "loop engineer
these features"). Phases 0–5 gated; a phase closes only after the verify battery,
reference-delta, and a fresh-context `gate-verifier` agent dispatch.

### Where we are (verified, all on `main`, tree clean at `9e5b920`)

- **Phase 0: CLOSED** — gate-verifier verdict PASS (independent battery re-run + per-item
  evidence). Reference asset corrected: grade visuals against
  **`reference/sector9_deck_hero.png`** (the lit 3D deck render), NOT
  `media__new_visuals.png` (a flat menu card the brief mistakenly pointed at).
- **Phase 1 (~80%): the game now runs WebGPU-only** — React 19.2.7 / fiber 9.6.1 /
  drei 10.7.7 / rapier 2.2.0 / three 0.185.1, `WebGPURenderer` via async `gl` factory,
  capability gate + designed unsupported screen (e2e-tested in a real no-adapter
  browser). TSL procedural deck (~1.35M tris @ 60 fps, seeded via `?seed=N`), CSM
  lighting rig, post stack (GTAO/bloom/CA/vignette/godrays) on three's own
  PostProcessing. Pillar-A role gates enforced + unit/e2e tested (`isSolo` bypass is
  dead). Zero external assets (fonts D-2, lobby PNG deleted). Bundle floor MET:
  ~483 KB gzip ≤ 500 KB (three source-entry shim + rapier WASM chunk carve-out).
  Mobile profile (emulated): 60 fps / 1.27M tris.
- **Battery: PASS** (eslint 0 warnings, vitest 19, Playwright 3/3). Run
  `node tools/verify.mjs` before claiming ANYTHING is done — STATUS.md line 11 governs.

### What worked (keep doing)

- The build loop: one coherent chunk per iteration → probe empirically in headless
  Chromium (`--enable-unsafe-webgpu --use-angle=metal`) → battery → STATUS update →
  commit. Screenshots + measured numbers before every "done" claim.
- Verifying APIs against installed `node_modules` source before use (caught the async
  `gl` factory contract, `drawCalls` vs `calls`, CA/GTAO node traps).
- Fresh-context gate-verifier at phase gates (caught the wrong reference asset).

### What didn't work (do NOT retry blind — details in docs/R3F-WEBGPU-NOTES.md)

- React 19 `<StrictMode>` + fiber v9 async WebGPU factory → frame loop freezes, zero
  errors. StrictMode stays OFF in `main.jsx`.
- drei `<ContactShadows>` under WebGPU; reading `renderer.info` from `useFrame`;
  `chromaticAberration` on computed chains / null center; component-wise GTAO multiply
  (use `.r`); full-res GTAO at dpr 2 (~1 fps — run half-res/8-sample).
- `scene.environment` from the PMREM probe bake (`render/EnvironmentProbe.jsx`) tanks
  60→1 fps combined with the PostFX scene pass + cube shadows — built but NOT mounted
  (D-4). Needs its own debugging round; do not simply re-mount it.
- Unclamped `lerp(…, k*delta)` camera follow (pipeline-compile delta spikes → permanent
  oscillation); 3D-tracked drei `<Html>` click targets (screen-fix them when open).
- After editing `src/render/three-webgpu-shim.js`: `rm -rf client/node_modules/.vite`
  (the dep optimizer inlines the old shim into cached pre-bundles).

### Next steps (in order — Phase 1 gate close)

1. **Reference-delta round 1**: hero shot (`tools/capture-hero.mjs`) vs
   `reference/sector9_deck_hero.png` → 10 ranked gaps in `docs/DELTA.md` → fix top 3
   (include taming the blown hologram bloom) → re-render.
2. Final 2M-triangle density turn (`DENSITY` constants in `client/src/render/Deck.jsx`)
   under the full stack, holding 60 fps.
3. Wire `tools/perf-probe.mjs --mode assert` into the battery (floors enforced from
   Phase 1 on).
4. Dispatch the `gate-verifier` agent on Phase 1 (gate text in
   `Project_Requirements.md` §6); fix findings; check the box in STATUS.md.
5. Then Phase 2: Puzzle 2 (tri-vector scanners, 3-role, latch/hold arm mechanic) +
   the 1→2 chain server-side — see the brief §3.14 and the 2026-07-04 amendment in
   STATUS.md "Current focus".

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
