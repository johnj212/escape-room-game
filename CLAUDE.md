# CLAUDE.md — Sector-9 Command Deck

## Project Overview
A 3-role, high-cooperation multiplayer 3D escape room (Engineer / Technician / Overseer): three interdependent puzzles chained 1→2→3 against a 15-minute server-authoritative meltdown timer. Client renders asset-free on three.js `WebGPURenderer` + TSL (React 19, `@react-three/fiber` v9, Rapier physics); server is Express + Socket.IO and owns all game truth. **No WebGL fallback** — non-WebGPU devices get a designed unsupported screen.

## Key Commands
```bash
npm run install:all      # install root + client + server deps
npm run dev              # concurrently: server (node) + client (vite)
npm run dev:server       # server only  → server/index.js
npm run dev:client       # client only  → vite dev

npm run build            # build client (vite) into client/dist
npm run verify           # full verification battery (tools/verify.mjs) — the gate check
npm run capture          # render a hero shot for reference-delta (docs/DELTA.md)
npm run perf             # fps / draw-call / triangle / bundle-size probe

# client-scoped (run from client/ or via --prefix client)
npm run lint --prefix client    # eslint, --max-warnings 0
npm run test --prefix client    # vitest unit tests (src/tests)
npm run e2e --prefix client     # playwright e2e (client/e2e)
```

## ngrok Testing (Public Internet)

**Setup (one-time):**
1. Install ngrok: `brew install ngrok`
2. Create free account at https://dashboard.ngrok.com/signup
3. Get auth token from https://dashboard.ngrok.com/get-started/your-authtoken
4. Authenticate: `ngrok config add-authtoken YOUR_TOKEN`

**To test on public internet:**
```bash
npm run build                           # build client
npm run dev:server                      # start server (serves both client + Socket.IO)
ngrok http 3001 --region us            # in another terminal
```

Visit: `https://your-ngrok-url.ngrok-free.dev`

**⚠️ IMPORTANT — Cleanup before committing:**
- `server/index.js`: Remove static file serving (lines marked "NGROK TESTING ONLY")
- `client/src/hooks/useMultiplayer.js`: Revert Socket.IO connection to `io('http://localhost:3001')`
- Both files have comments marking what to delete

**For local dev after ngrok testing:**
```bash
npm run dev                # back to concurrent server + Vite dev client
```

**ngrok dashboard:** http://localhost:4040 (view all traffic)

## Architecture
- `client/src/render/` — WebGPU/TSL layer: `Deck.jsx` (procedural geometry), `materials.js` (TSL material library), `Lighting.jsx` + `lightRegistry.js` (CSM rig), `PostFX.jsx` (GTAO/bloom/CA/vignette), `EnvironmentProbe.jsx` (PMREM), `capability.js` (WebGPU gate + reason codes), `prng.js` (seeded procedural), `three-webgpu-shim.js`.
- `client/src/components/` — R3F scene + UI: `GameCanvas.jsx`, `Room.jsx`, `Player.jsx`, `WirePuzzle.jsx`, `PerfHud.jsx`, `LoadingScreen.jsx`, `UnsupportedScreen.jsx`, `UIOverlays.jsx`.
- `client/src/game/roleGates.js` — **Pillar A** pure role-gate functions (info vs. action split); exhaustively unit-tested.
- `client/src/hooks/` — `useMultiplayer.js` (socket), `usePlayerControls.js`. `store/gameStore.js` — zustand client state.
- `server/` — `index.js` (Socket.IO wiring, rate limiter), `gameLoop.js` (authoritative loop + timer), `puzzleEngine.js` (puzzle state/validation). Server owns truth.
- `tools/` — verification harness: `verify.mjs` (battery), `perf-probe.mjs`, `capture-hero.mjs`.
- `reference/media__new_visuals.png` — the visual bar (grading only, **never** loaded at runtime). `docs/` — `RUBRIC.md`, `DELTA.md`, `DEVIATIONS.md`, `R3F-WEBGPU-NOTES.md` (verified stack facts).
- `STATUS.md` / `Project_Requirements.md` / `handoff.md` — read these first each session (rehydration protocol at top of STATUS.md).

## Strict Rules / Prohibitions
1. **WebGPU only — no WebGL fallback renderer, no second render path.** Non-WebGPU → the designed unsupported screen, never a crash or black screen.
2. **Zero external assets in the play route.** All detail is code-generated geometry/light. The reference PNG stays in `reference/` for grading only.
3. **Server owns truth.** No client-authoritative solves or positions; puzzle state, timer, and win/lose live on the server (`tools/verify.mjs` proves fabricated solves/teleports are rejected).
4. **Every puzzle requires ≥2 roles** — a test must prove single-role completion is impossible. Solo-swap changes character/role; it is NOT a role-separation exemption.
5. **No stubs / no `// TODO` / no disabled tests in a closed phase.** Never silently drop a pillar or floor — log any deviation in `docs/DEVIATIONS.md`. No black shadows / no flat unlit hero surfaces (under-rendering = fail). Run `npm run verify` before claiming a phase done.
