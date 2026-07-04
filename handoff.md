# Handoff: Sector-9 Command Deck

> **Two-layer document.** §0 below is the CURRENT session state (read this first).
> Everything from "Handoff (v0.2)" onward is the historical build log for the
> original R3F v8 game — kept for its hard-won debugging lessons, not as current
> status. When in doubt, `STATUS.md` is the source of truth, not this file.

---

## 0. Current session handoff (2026-07-04) — READ FIRST

### Rehydration (do this before touching anything)

1. Read `STATUS.md` fully — it is the live rehydration protocol and phase tracker.
2. Read `Project_Requirements.md` (the brief: pillars, floors, banned outcomes, phases).
3. Read `docs/R3F-WEBGPU-NOTES.md` (verified stack facts — do not re-derive from memory).
4. Skim `docs/DEVIATIONS.md` and the newest entries of `docs/DELTA.md`.
5. **Never re-plan from scratch.** Continue from STATUS.md "Current focus".

### Where we are

- **Phase 0 (scaffold + harness), gate now GREEN.** The verify battery passes 3/3
  hard checks (eslint 0-warnings, vitest 13 tests, Playwright e2e).
- The current checked-in app still renders on **React Three Fiber v8 → WebGLRenderer**.
  There is **no WebGPU code in `client/src` yet** — the WebGPU-only end state in
  `Project_Requirements.md` describes the *Phase 1 target*, not today's build.
- All work is on **`main`** (pushed: `b7d1c75`) and branch
  `docs/sector9-requirements-scaffold` (pushed). Working tree clean.

### What this session did

- Diagnosed a red verify gate. Root cause: commit `51cfad3` had removed the `e2e`
  npm script + `@playwright/test` dep from `client/package.json`, and the file
  also carried a stray `cla` prefix (invalid JSON). Restored both; stripped the typo.
- `vite.config.js`: added `test.exclude` for `e2e/**` so vitest stops trying to run
  the Playwright spec (its `test.describe` is incompatible with the vitest runner).
- eslint 52 → 0: removed genuine dead code; added a documented `react/prop-types: off`
  (plain-JSX, all-internal components); annotated two intentional mount-only effects
  with justified `exhaustive-deps` disables.
- Merged `origin/main`'s stray doc commit (`REFACTOR PLAN.md`) back in; pushed `main`.

### The one command that matters

```bash
node tools/verify.mjs        # from repo root — must print "BATTERY: PASS" (3/3 hard)
```

Run it before claiming ANY work is done. Do not disable a test or lint rule to go
green (a documented, principled rule-scope like the two in `.eslintrc.cjs` is the
only exception, and it must be justified in a comment). STATUS.md line 11 is the
governing discipline: **audit every progress claim against a tool result from the
current session — a screenshot, a test run, a measured number.**

### Manual test

- Client dev server (solo mode, no backend needed): `npm run dev --prefix client`
  → open the printed `http://localhost:517x/`. Solo-swap the three roles with keys
  `1` / `2` / `3`. Full multiplayer additionally needs the Node/Socket.io server.

### Next steps (from STATUS.md "Next actions", in order)

1. **Build the WebGPU capability gate + designed "unsupported" screen** — REQUIRED
   before the Phase 1 renderer swap so non-WebGPU devices never hit a raw crash.
   Add its Playwright test (forced non-WebGPU context → unsupported screen, zero
   console exceptions).
2. Confirm the React Three Fiber v9 + three.js `WebGPURenderer` integration path
   against installed source; log findings in `docs/R3F-WEBGPU-NOTES.md`. When Phase 1
   lands, update `client/e2e/puzzle1.spec.js`'s "app boot" test to assert a WebGPU
   context on the app canvas instead of WebGL.
3. Then Phase 1 proper (xhigh effort): WebGPU render-layer rebuild + Puzzle 1 re-homed.

### Open flags (noted, not yet acted on)

- `client/src/components/UIOverlays.jsx` imports a PNG asset (`sector_9_deck_*.png`).
  Potential tension with the zero-external-assets floor — but it's the lobby, not the
  play route. Decide during the Phase-1/visual pass; log to `docs/DEVIATIONS.md` if kept.

---

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
