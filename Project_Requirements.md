# PROJECT SECTOR-9 — v2
### A 3-role, high-cooperation escape room rendered in the browser at UE5-showcase ambition — WebGPU capability stress test wrapped around a shippable co-op game
*(Sector-9 Command Deck — a decaying cyberpunk orbital reactor deck; escape before meltdown)*

> **How to read this file:** this is the build brief. It says *what* and *how well*, never *how* — architecture is the model's call. Open `STATUS.md` first each session (its rehydration protocol chains here). Every phase is graded against the reference bar below, not against "good for a browser." The one document meant to be human-approved; everything under it is enforced.

---

## The bar

There are **two** reference bars, and every phase is judged against both, side-by-side, never against a description:

1. **Visual — UE5-showcase-class.** The target is current-generation Unreal Engine 5 showcase rendering: real geometry over flat textures, real-time global illumination, no black shadows, physically-based neon and metal. The concrete reference frame is `reference/media__new_visuals.png` (the Sector-9 command-deck render already in this repo). UE5 reference stills live beside it in `reference/`.
2. **Design & feel — *Operation: Tango*, extended to three roles.** Asymmetric co-op where one player holds *information* and another holds *action* on a separate screen/space, over live communication — extended from Tango's two operatives to our **three roles** (Engineer, Technician, Overseer). Sleek spy/cyber-tech UI, tension-driven pacing.

**You will not fully reach the visual bar. That is expected.** The task is to close as much of the gap as physics and WebGPU allow, and to *know precisely how far you got*. A result that looks like a 2015 WebGL demo — flat unlit panels, black ambient shadows, obviously-primitive box geometry, neon with no bloom, dead static air — is a **failed task**, no matter how clean the code or how correct the puzzles.

**Reference-delta loop (mandatory, every phase):** render the closest matching shot of the room, place it side-by-side with the relevant reference, write `docs/DELTA.md`: the **ten most visually significant differences**, ranked by impact. Fix the top three. Re-render. Only then does the phase close.

---

## The six pillars

Every requirement in this document serves one of these. If a decision arises that the document doesn't cover, resolve it in favor of the pillar it serves — and record the decision, don't ask permission.

**A. Forced interdependence.** The game exists because no one can escape alone. Every puzzle splits *information* from *action* or *sightline* from *control* across roles. *Rule: for each puzzle, an automated test proves it is impossible to complete with a single role's information and inputs. If one player can solve it alone, it is not a co-op puzzle and the phase fails.*

**B. Geometry & light, not textures — asset-free.** Detail lives in modeled geometry and light transport, not in flat normal-mapped planes, and **every pixel of it is generated in code** — meshes, textures, LUTs, irradiance probes, noise volumes. *Rule: no external asset (image, `.glb`, audio file, font binary in the critical path) ships in the play route. The reference PNG lives in `reference/` only and is never imported by `client/src`.*

**C. No black shadows.** Shadowed metal reads cool from skylight, shadowed neon-lit surfaces carry colored bounce, the room interior is filled with scattered light — never crushed to flat black. *Rule: sample any shadowed surface pixel — if it is desaturated near-black, lighting has failed and the phase does not close.*

**D. Server-authoritative integrity.** The server owns truth: puzzle state, the countdown, win/lose. Clients render and predict; they never *decide*. *Rule: a scripted client that emits a fabricated "solved" event or a teleport is rejected by the server and changes nothing in authoritative state.*

**E. Reach — cross-input parity + graceful capability degradation.** Fully playable on desktop (keyboard/mouse), on mobile (touch), and solo (character-swap keys `1`/`2`/`3`). WebGPU-capable devices get the game; everything else gets a *designed* unsupported screen, never a crash. *Rule: every player action is reachable on all three input modes; a non-WebGPU context renders the unsupported screen with zero console exceptions.*

**F. The room is alive, and the clock is dread.** Idle air moves — scanlines, holographic flicker, drifting motes, reactor pulse. As the 15-minute timer burns down, the room escalates: alarm states, light shifts, klaxon cadence. *Rule: a frozen frame should read as one second from motion; the last two minutes must look and sound materially more urgent than the first two.*

---

## Operating instructions

- Build, don't describe. No plan-approval round-trips. Long autonomous stretches. When operating unattended, proceed on anything reversible; stop only for something destructive, irreversible, or a genuine scope change.
- Between two approaches, build the more ambitious one.
- Effort dial: default **`high`**. Step to **`xhigh`** for Phase 1 (WebGPU render-layer rebuild) and Phase 3 (laser + server-authoritative raycast) — the two most capability-sensitive systems. Drop to `medium` for mechanical work (UI wiring, copy).
- Expect real modular structure across `client/src/render/`, `client/src/gpu/` (TSL/WGSL passes), `client/src/game/`, `client/src/components/`, `client/src/net/`, `server/`. One giant file = fail.
- No stubs. A `// TODO` in a closed phase fails the phase.
- Never ask the user to reduce scope. Infeasible item → nearest feasible alternative + entry in `docs/DEVIATIONS.md`. **A pillar or floor may never be silently dropped** — that is the exact failure this project already committed once (the plan promised custom no-WASM physics and asset-free rendering; the build shipped Rapier and a 974 KB PNG with no paper trail).
- **Under-rendering is a failure mode.** If a hero shot of the deck draws flat-lit primitives well under the triangle floor (§2), you are underspending the GPU and must add geometric and lighting detail until the reference-delta closes.
- Before reporting a phase done, audit each claim against a tool result from this session — a screenshot, a test run, a measured fps number. If it isn't verified, say so; don't report it as done.

## 1. Fixed constraints

| Constraint | Value |
|---|---|
| Language | JavaScript (ES modules) + JSX, as in the current tree. TypeScript migration is a stretch goal (§9), not a requirement. |
| Framework / build | Vite; **React Three Fiber v9** (required for WebGPU) over three.js `WebGPURenderer`. Fiber v8 + postprocessing v2 pin from the current build is retired in Phase 1. |
| Renderer | **three.js `WebGPURenderer` + TSL.** Raw WGSL compute passes expected wherever TSL limits you. |
| Fallback | **None. No WebGL renderer path.** A non-WebGPU device gets a *designed* unsupported screen ("device unsupported → watch recorded demo / open on desktop") backed by a short recorded desktop capture. Fail loudly with diagnostics to console; never a silent black screen and never a second renderer. |
| Assets | **Zero external assets.** Every mesh, texture, LUT, impostor/decal atlas, noise volume, irradiance probe: generated by code. `reference/media__new_visuals.png` is a grading reference only, never shipped. |
| Physics | `@react-three/rapier` (WASM), **ratified** — hand-rolling a physics engine is out of scope for a POC. Logged as `D-1` in `docs/DEVIATIONS.md`. |
| Networking | Socket.io, server-authoritative. Exactly 3 role slots per room. |
| Determinism | `?seed=N` reproduces puzzle ciphers, scanner order, and mirror/laser layout for repeatable testing. |
| Cost / hosting | Zero paid APIs. Static client host + a single Node/Socket.io process. |

## 2. Floors — these numbers define "done"

One scene, **two rendering profiles** behind an adaptive-quality ladder. A device is measured against its own profile.

| Dimension | Desktop floor (WebGPU) | Mobile floor (WebGPU, iOS 18+/Android Chrome 121+) |
|---|---|---|
| Resolution / frame rate | ≥ **60 fps** at 1440p, dpr ≤ 2, HUD-verified | ≥ **30 fps** at ~800p, dpr ≤ 1.5 (60 on A17/A18/SD-8-Gen-2+) |
| Shadows | **4 CSM cascades ≥ 2048², texel-snapped, + PCSS contact hardening + screen-space contact shadows (short raymarch)** — every prop grounded | ≤ 2 cascades ≥ 1024², PCSS off, contact grounding via GTAO instead of raymarch |
| Global illumination | Precomputed irradiance-probe volume (room is static → baked at load in a compute pass, ≥ 8×6×8 probes) + GTAO + SSR on floor/metal | Same probes (near-free at runtime) + half-res GTAO; SSR off, static cubemap reflection |
| Rendered triangles | ≥ **2M/frame** in a hero deck shot (post-cull); ceiling = whatever holds 60 fps | ≥ 0.5M/frame |
| Post | Bloom, raymarched volumetric light shafts (half-res), tonemap, vignette, chromatic aberration | Bloom (half-res); volumetric shafts 1/4-res or off; no CA |
| Critical bundle | JS+CSS ≤ **500 KB gzip** (excl. Rapier WASM + shader source); **zero shipped image > 50 KB** | same |
| Cold load → interactive lobby | ≤ 3 s on broadband | ≤ 6 s on simulated 4G |
| Capability gate | WebGPU detected and routed in < 500 ms; unsupported screen otherwise | same |
| Puzzles | 3/3 implemented and **server-validated**; escape requires the 1 → 2 → 3 chain | same |
| Timer | 900 s authoritative; client displays sync within ± 1 s across all clients | same |
| Tests | Playwright e2e for each puzzle + full escape; a 3-client sync test; lint at **0 warnings** | same |

## 3. Systems / components — enumerated

**Render / GPU**
1. WebGPU bootstrap + capability gate + designed unsupported screen + recorded-demo hook
2. Procedural material/texture library in TSL (brushed metal, scratched plating, glass, emissive neon, decals)
3. Procedural room geometry + greebling (panels, cabling, rivets, pipes, debris) — the Sector-9 deck
4. Lighting rig: 4-cascade CSM + PCSS + screen-space contact shadows (desktop) / scaled (mobile)
5. Precomputed irradiance-probe GI (compute pass at load) + GTAO
6. Post stack: bloom, volumetric light shafts, tonemap, vignette, CA — all profile-gated
7. Adaptive-quality ladder: device detection → desktop/mobile profile → live fps governor

**Gameplay / net**
8. Player controller (Rapier) + third-person camera follow with occlusion handling
9. Input abstraction: keyboard/mouse, touch (dual virtual sticks), solo character-swap `1`/`2`/`3`
10. Networking: lobby, room codes, 3 role slots, join/leave, reconnect banner
11. Server game loop (30 Hz) + authoritative countdown timer
12. Puzzle engine: three state machines + the 1 → 2 → 3 unlock chain + reset/lockout semantics
13. **Puzzle 1 — Decoupled Power Grid** (asymmetric: Engineer sees the cipher hologram, Technician toggles the gated switchboard)
14. **Puzzle 2 — Tri-Vector Hand Scanners** (simultaneous: all 3 activate within a 1.5 s window; failure → lockout cooldown)
15. **Puzzle 3 — Laser Deflection Array** (spatial: one steers the emitter, one rotates mirrors, one guides from the receiver; server-side raycast validates the hit)
16. HUD / overlays: diegetic holographic timer, per-role objective, lobby, win/lose, unsupported screen
17. Diegetic FX: reactor alarm states escalating with the clock, meltdown loss sequence, escape-pod launch win sequence

## 4. Quality laws

Enforced on every instance of the recurring unit, not just the headline feature:

- **Every surface:** PBR, generated in TSL, zero image files; emissive neon uses bloom-aware intensity; no flat unlit color anywhere in a hero shot.
- **Every shadow-casting light:** contributes to the CSM; obeys the no-black-shadows law (Pillar C) — shadowed regions are filled by probe/skylight bounce.
- **Every puzzle:** server-authoritative validation; a defined reset and a defined failure/lockout; solvable in solo-swap **and** 3-client; requires ≥ 2 roles (Pillar A); every input reachable on touch **and** keyboard.
- **Every interactive prop:** a proximity trigger, a visual affordance (glow/pulse on approach), and clear state feedback on activation.
- **Every UI overlay:** works in portrait and landscape; respects `prefers-reduced-motion`; never blocks with a native `alert`/`confirm`.

## 5. Verification battery

1. **Reference-delta loop (mandatory, every phase, #1).** Render a hero shot of the deck → side-by-side with `reference/` → `docs/DELTA.md` ten ranked visual gaps → fix top three → re-render.
2. **Playwright e2e — gameplay.** Solo-swap solve of P1, P2, P3 individually, and a full 1 → 2 → 3 escape run to the win screen.
3. **Multi-client sync.** Three headless socket clients: movement, puzzle state, and timer stay in sync within tolerance; a disconnect/reconnect restores state.
4. **Server-authority probe.** A scripted client emits a fabricated solve and a teleport; assert authoritative state is unchanged and the actor is rejected.
5. **Performance harness.** In-scene HUD for fps, draw calls, and triangle count; captured on the desktop profile and an emulated mobile profile; bundle-size assertion against §2 floors.
6. **Capability-gate test.** Force a non-WebGPU context; assert the unsupported screen renders with zero console exceptions.
7. **Static gate.** Lint at 0 warnings (typecheck if/when TS lands).

## 6. Phase plan — gated

A phase closes only after: build → run → verification battery → `docs/DELTA.md` → fix top three → re-check. A phase does not close with a `// TODO` in it.

| Phase | Effort | Deliverable | Gate |
|---|---|---|---|
| 0 | high | Scaffold + harness | `STATUS.md`, `docs/DELTA.md`, `docs/DEVIATIONS.md` (seeded with D-1 Rapier), `docs/R3F-WEBGPU-NOTES.md` created; Playwright + perf HUD + capability gate exist; `reference/` populated (PNG moved out of `client/src`); baseline test run green |
| 1 | **xhigh** | WebGPU render-layer rebuild + Puzzle 1 re-homed on it | Room renders on `WebGPURenderer` + TSL, fully asset-free (no image imported by `client/src`); desktop hits the full shadow stack + fps floor and mobile hits the scaled profile + fps floor; unsupported screen works; reference-delta round 1 complete |
| 2 | high | Puzzle 2 (scanners) + 1 → 2 chain wired server-side | e2e solves P1 → P2; simultaneous 1.5 s window + lockout verified; server-authoritative; reference-delta |
| 3 | **xhigh** | Puzzle 3 (laser) + full escape | e2e completes 1 → 2 → 3 escape; laser path server-raycast-validated; win/lose sequences fire; server-authoritative; reference-delta |
| 4 | high | Mobile/touch parity + adaptive ladder + graceful degradation | Mobile e2e + emulated-device perf ≥ 30 fps; touch and solo-swap reach every action; unsupported screen verified on a forced non-WebGPU context |
| 5 | high | Visual reference-delta pass + atmosphere/motion (Pillar F) | Reference-delta top-three closed across all rooms; alarm-escalation + win/lose sequences land; self-score ≥ 7 on every rubric row; human visual sign-off |

## 7. Banned outcomes — instant fail

- A WebGL fallback renderer, or any second render path. The only "fallback" is the designed unsupported screen.
- Any external asset shipped in the play route (the reference PNG, a `.glb`, image textures, audio files).
- Client-authoritative puzzle solves, or trusting a client-sent position for a win condition.
- A puzzle solvable by one role alone.
- Flat unlit materials or black shadows in a hero shot (under-rendering).
- A stubbed Puzzle 2 or 3, or a `// TODO` in a closed phase.
- Dropping a pillar or floor without a `docs/DEVIATIONS.md` entry.
- Disabled or skipped tests to make the suite green.
- Asking the user to lower the bar.

## 8. Self-score rubric

Per row: 10 = passes review against the reference bar; 7 = clearly the right class of result but visibly short; 4 = functional but generic; 2 = looks unfinished. Score after every phase; for each row write "what raises this by 2 points"; implement the two cheapest before proceeding.

Rows: **Interdependence** (A) · **Rendering — geometry & light, asset-free** (B) · **Shadows & GI** (C) · **Server integrity** (D) · **Reach — cross-input & capability** (E) · **Atmosphere & tension** (F) · **Desktop performance** · **Mobile performance** · **Reliability** (reconnect, no crashes).

## 9. Stretch goals — only after the battery passes

- Procedural Web Audio synthesis (reactor hum, klaxon, scanner sweep, meltdown) — currently deferred; would materially lift the investor demo.
- Full accessibility: colorblind mode with pattern overlays for Puzzle 1, a settings panel (`reducedMotion`, colorblind, volume) restored to the store.
- Multiplayer hardening: client-side prediction + reconciliation, entity interpolation, robust reconnection.
- Additional rooms/acts; spectator mode; TypeScript migration.

---

## Final acceptance

**Two-shot test.** Place beside `reference/media__new_visuals.png`:

1. A rendered hero frame of the Sector-9 command deck. It must not show a **category error** on first look. A category error here is: flat/unlit surfaces, crushed black shadows, obviously-primitive box geometry in a hero position, neon with no bloom, or a scene that reads as static and dead.
2. A capture of a full escape run: three clients (or one player via solo-swap) complete the 1 → 2 → 3 chain with the countdown live and server-authoritative, at ≥ 60 fps on desktop and ≥ 30 fps on a flagship phone.

Only the visual reference bar (Pillar C-grade lighting, Pillar B-grade geometry) is a human taste call — that is the one carve-out. Everything else in this document is the model's to build, verify, and document without asking.

In the end, the human has to be able to actually play the result across desktop and mobile. Their feedback is a final requirement — but one that comes *after* the model is satisfied against the acceptance test above.
