# Sector-9 Command Deck — Single-Player-First, 3-Avatar Refactor Plan (v2.0)

**Repo:** `johnj212/escape-room-game`
**Direction locked:** Keep the Sector-9 cyberpunk reactor room. The game is built around **3 characters** (Engineer / Technician / Overseer) like a real escape room — playable by **one real player controlling all three**, with true 3-player co-op re-enabled later. The dual-view mechanic (first-person + overhead) is fused with character control into one core mechanic: **possession**.
**Stack (unchanged):** React 18 + Vite, react-three-fiber, drei, @react-three/rapier, Zustand.

-----

## The core mechanic: Overhead = command, First-person = embodiment

This is the synthesis of the dual-view idea and the 3-character requirement:

- **Overhead view** is the *command deck*: you see all three avatars, the room layout, conduit routing, load gauges. **Tap/click an avatar to possess them** — the camera dives down into that character’s first-person view (~0.5 s tween).
- **First-person view** is *being* that character: walk, inspect, read holograms, operate their station. Toggle back up to overhead at any time.
- Character switching is **not** keys 1/2/3 + a follow camera. The overhead view *is* the switching mechanism. The Overseer role from the co-op design becomes literal: solo, *you* are the overseer.
- **Multiplayer later:** each real player embodies one avatar in FP. The overhead view becomes the Overseer’s exclusive ability (their asymmetric power), or a shared limited “security cam” — decided in Phase 6, not now.

**Design rule for every puzzle (non-negotiable):** each puzzle must define both its **co-op form** (3 humans, real-time) and its **solo form** (one human, sequential possession). The standard adaptation: *real-time coordination becomes plan-then-execute* — solo players position avatars / pre-set stations, then trigger execution from overhead. Any puzzle that can’t express both forms gets redesigned before it gets built.

-----

## Phase 0 — Repo surgery: park multiplayer, keep it possible (≈ half a day)

**Goal:** single-player runs clean; nothing built this phase blocks co-op’s return.

- **Unwire, don’t unthink:** remove `socket.io-client`, `useMultiplayer.js`, lobby/join/role-select UI, and the `dev:server` script from the dev loop. Move `server/` to `/deferred/server/` with a README noting the known bug (switch toggles never reached the server — `emitToggleSwitch` was never wired in).
- **Keep the 3-player store shape:** `players: { engineer, technician, overseer }` stays (positions, rotation, per-avatar flags). Add `possessedId: string | null` (null = overhead/command view).
- **Command-pattern actions:** every game-state change goes through dispatched action objects (`{ type, avatarId, payload }`) handled by pure reducers — this is the multiplayer insurance policy: later, actions get relayed through a server instead of applied locally. No direct `set()` mutations from components.
- Remove `client/dist/` from git; add to `.gitignore`. Remove keys `1/2/3` handling (replaced by possession in Phase 1).

**Acceptance:** client-only `npm run dev` boots into the room with 3 avatars visible; movement works for a possessed avatar; zero socket imports in `src/`.

-----

## Phase 1 — Camera + possession system: the make-or-break core (≈ 2–3 days)

Build and tune this before any puzzle work. If possession doesn’t feel great, nothing downstream matters.

### 1.1 `CameraRig.jsx` (replaces `CameraFollow`)

- State: `viewMode: 'overhead' | 'fp' | 'transitioning'` + `possessedId`.
- **Overhead:** fixed height ~14 (clamp 8–18 via pinch/scroll), near-top-down with slight tilt; narrow FOV (~30°) for the tabletop feel. Two-finger pan X/Z (desktop: right-drag), `touch-action: none` on canvas.
- **FP:** camera at possessed avatar’s head (~1.5 m); pointer-lock mouse look on desktop, right-half drag look on mobile, nipplejs joystick for movement.
- **Possession transition:** tap avatar in overhead → camera tweens position + quaternion (slerp, ease-in-out, ~0.5 s) down into their head; `transitioning` blocks input. Reverse on “ascend” button/key (`Tab` / top-right button). Use `maath/easing` damping; never instantiate/destroy cameras.
- **Unpossessed avatars:** kinematic bodies, idle in place (subtle idle bob/visor pulse so they read as “yours”). No follow-AI — scope control.

### 1.2 Input profiles per mode

- **Overhead profile:** avatar physics frozen; tap avatar = possess; tap station = inspect tooltip (name, role required, status); pan/pinch camera.
- **FP profile:** WASD/joystick relative to camera yaw; raycast-from-center interact (`E`/tap target); proximity prompts via a shared `Interactable` component.
- Guard the kinematic↔dynamic body-type switch against the NaN bug class documented in `handoff.md` — one shared physics-safety util.

**Acceptance:** possess → walk → ascend → possess another avatar feels fluid on a phone; no physics explosions; transition is the moment that makes testers say “oh, that’s cool.”

-----

## Phase 2 — Puzzle framework: composite 3-role puzzles (≈ 2 days)

**Goal:** kill the architecture that made puzzles shallow. Every big puzzle = **3 interlocking role-stations** (mini-puzzles) + a completion condition.

```
/src/puzzles/
  registry.js          // { [puzzleId]: PuzzleDefinition }
  powerGrid.js         // Puzzle 1
  triScanners.js       // Puzzle 2
  laserArray.js        // Puzzle 3
/src/components/interaction/
  Interactable.jsx     // proximity + raycast + prompt (one impl, reused)
  PuzzlePanel.jsx      // generic HTML overlay shell
```

- `PuzzleDefinition = { id, title, stations: { [role]: { requiredView, initState(), reduce(state, action), isComplete(state) } }, isSolved(stationStates), coopNotes }` — **all pure functions**, no side effects, no `setTimeout` phase mutations (current `toggleSwitch` anti-pattern dies here).
- Store: generic `puzzles: { [id]: { stations: {...} } }` + `dispatchPuzzle(id, action)`; a single `ProgressionController` listens for solved events and advances the chain.
- **Role-gating:** stations check `action.avatarId`‘s role — the Technician’s panel won’t open for the Engineer. Solo, this *forces* possession swapping; co-op, it forces communication. Same code path.

**Acceptance:** adding puzzle #4 = one new file + placing Interactables. Zero store edits.

-----

## Phase 3 — The three composite puzzles (≈ 3–4 days)

Each lists co-op form → solo form. The asymmetric-information designs from `implementation_plan.md` survive — possession is what makes them solvable alone.

### Puzzle 1 — Decoupled Power Grid (upgraded wire cipher)

- **Engineer (FP):** hologram cipher, legible only up close in first-person. Now 5 wires incl. 2 distractors.
- **Technician (FP):** switchboard behind the laser partition; flips wire switches.
- **Overseer (overhead):** conduit glow on the floor reveals which distractor is live — only readable from above.
- **Co-op:** verbal relay. **Solo:** read cipher as Engineer → ascend to spot the live distractor → possess Technician → flip. Memory becomes the solo challenge (no notepad UI — like a real escape room).

### Puzzle 2 — Tri-Vector Hand Scanners (simultaneity)

- Three scanners at room corners, one per role.
- **Co-op:** all three activate within a 3.0 s window (amended 2026-07-09, D-6); miss = brief lockout.
- **Solo (plan-then-execute):** walk each avatar to their scanner and *arm* it (FP), then ascend to overhead and hit a 3-second **SYNC EXECUTE** — succeeds only if all three are armed and standing on their pads. The overhead trigger is the solo translation of simultaneity.

### Puzzle 3 — Laser Deflection Array (spatial coordination)

- **Engineer (FP):** console steering emitter angle. **Technician (FP):** rotates mirror stands. **Overseer (overhead):** only view that shows the full beam path and the occluded receiver.
- **Co-op:** Overseer calls directions. **Solo:** iterate — adjust in FP, ascend to see the beam path, descend, adjust. The view toggle *is* the puzzle loop.

**Progression chain:** Grid powers scanners → scanners unlock laser console → laser opens escape pod. 15:00 timer; meltdown on expiry.

-----

## Phase 4 — Visual pass (≈ 2–3 days)

Impact-per-effort order: (1) `@react-three/postprocessing` **Bloom** + subtle Vignette — the single biggest win for the neon scene; quality toggle for mobile. (2) drei `<Environment>` dark industrial HDRI (Poly Haven CC0) — instant metallic-material upgrade. (3) 2–3 tiling PBR texture sets; memoize materials (`Room.jsx` currently rebuilds per render). (4) Replace `gridHelper` with an emissive shader floor that blooms. (5) 5–10 CC0 GLTF props (Kenney/Quaternius), budget < 150 k tris / < 100 draw calls. (6) One shadow-casting light only (reactor core, flicker synced to timer urgency). (7) Distinct avatar silhouettes/colors readable from overhead — possession targets must be instantly identifiable. (8) dpr clamp `[1, 1.5]` + shadows off on mobile (keep existing checks).

**Acceptance:** 60 fps desktop, ≥ 30 fps mid-range phone, and an overhead screenshot with the beam/conduits glowing that you’d post unprompted.

-----

## Phase 5 — Game feel & QA (≈ 1–2 days)

- Audio (howler in deps): reactor hum, possession whoosh (sell the transition), solve sting, heartbeat < 60 s.
- Onboarding via 3 contextual prompts: move → ascend → possess. No tutorial screens.
- Win/lose: time, swaps used, restart. Best time in `localStorage` *(fine in the deployed app; not in a Claude artifact)*.
- Consolidate NaN guards into one util; device matrix: iOS Safari, Android Chrome, desktop Chrome/Safari, both orientations.

-----

## Phase 6 — Multiplayer return (deferred, design notes only)

- Reinstate server from `/deferred/`, fix the toggle-emit bug, relay command-pattern actions through authoritative server (the Phase 0 investment pays off here).
- Open design question to settle then, not now: overhead view in co-op = Overseer-exclusive power (strong asymmetry, recommended) vs. shared security-cam (weaker, safer).
- Solo “plan-then-execute” mechanisms (SYNC EXECUTE) switch to real-time windows when ≥ 2 humans present — puzzle definitions already carry both forms via `coopNotes`.

## Suggested working order with Claude (Code)

|Session|Deliverable                                         |
|-------|----------------------------------------------------|
|1      |Phase 0 + possession camera skeleton                |
|2      |Possession polish (mobile gestures, transition feel)|
|3      |Phase 2 framework + Power Grid stations             |
|4      |Tri-Vector Scanners + SYNC EXECUTE                  |
|5      |Laser Array + progression chain                     |
|6      |Phase 4 visuals                                     |
|7      |Phase 5 polish + device QA                          |

**Definition of done for the PoC:** a stranger on a phone finishes the room solo in 10–15 min without explanation, uses possession naturally by puzzle 2, and the answer to “what was cool?” is the dive from overhead into a character’s eyes.