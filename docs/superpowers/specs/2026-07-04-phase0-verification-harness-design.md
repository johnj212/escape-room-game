# Phase-0 Verification Harness — Design Spec

**Date:** 2026-07-04
**Status:** Approved (attended-loop, Phase-0-gate scope, dedicated verifier agent)
**Goal:** Stand up the executable verification machinery that gates every phase, so the
long autonomous loop can be *held to evidence* rather than trusted on its own claims. This
builds the Phase-0 slice only; later checks are added per-phase as their subjects exist.

This spec is the source of truth for the subagents building the pieces. Interfaces below
are contracts — do not change them without updating this file.

---

## Context (verified this session)

- The checked-in app is **pre-Phase-1 WebGL** (`client/src/components/GameCanvas.jsx` uses a
  stock R3F v8 `<Canvas>` → `WebGLRenderer`). No WebGPU, no capability gate, no unsupported
  screen exist yet. The WebGPU-only state in `Project_Requirements.md` is the **Phase-1 target**.
- **Headless WebGPU works** on this machine (M3, macOS) with Chromium flags
  `--enable-unsafe-webgpu --use-angle=metal` — verified hardware Metal adapter, not software.
  All Playwright-based tools run **headless**. (See `docs/R3F-WEBGPU-NOTES.md`.)
- Base e2e already green: `client/playwright.config.js` + `client/e2e/puzzle1.spec.js`
  (WebGPU-adapter proof + full solo-swap Puzzle 1 solve). `workers: 1` is required —
  Rapier-timed movement stalls under parallel Chromium load on this machine.
- Floors that later phases enforce (`Project_Requirements.md` §2, **WebGPU**):
  desktop ≥ 60 fps @ 1440p dpr≤2, ≥ 2M triangles/frame in a hero shot (post-cull),
  JS+CSS ≤ 500 KB gzip (excl. Rapier WASM + shaders), zero shipped image > 50 KB;
  mobile ≥ 30 fps, ≥ 0.5M tris.
  **Phase 0 records the current WebGL numbers; it does not fail against these WebGPU floors.**
- Pillars (for the rubric): A Forced interdependence · B Geometry & light, asset-free ·
  C No black shadows · D Server-authoritative integrity · E Reach / capability degradation ·
  F The room is alive, clock is dread.

---

## Principle

The harness **runs checks**; it does not build product features. The only app-code touch is
tiny **instrumentation hooks** (below) — additive test surfaces, logged in `STATUS.md`
gotchas, not `DEVIATIONS.md`.

---

## Component 1 — Instrumentation hooks (app code, owned by lead)

A `<PerfProbe />` component mounted inside the `<Canvas>` in `GameCanvas.jsx`, using
`useThree`/`useFrame`, exposes two globals on every frame:

```js
window.__SCENE_READY__ = true          // set once, after the first rendered frame
window.__PERF__ = {                     // overwritten each frame
  fps:        <number>,                 // rolling ~500ms window, integer
  drawCalls:  <number>,                 // renderer.info.render.calls
  triangles:  <number>,                 // renderer.info.render.triangles
}
```

Reads `renderer.info.render` — identical API for WebGL now and WebGPU later, so no rework at
the Phase-1 swap. Cost is one object write/frame (negligible; the visual perf HUD is a later
deliverable, this is only its data layer).

**Important for tool authors:** `GameCanvas` only mounts when `gamePhase !== 'lobby'`. So
`__SCENE_READY__`/`__PERF__` do not exist on the lobby screen. Every Playwright-based tool
must first drive the app into a playing state, exactly as `client/e2e/puzzle1.spec.js` does:
load `/`, click **"Launch Offline Reactor (Solo)"**, then wait for
`window.__SCENE_READY__ === true`.

---

## Component 2 — `tools/capture-hero.mjs` (reference-delta capture)

**CLI:** `node tools/capture-hero.mjs [--phase <N>] [--out <path>]`
Default out: `docs/shots/phase<N>-hero.png` (create `docs/shots/` if absent).

**Behavior:** launch Chromium headless with the verified WebGPU flags at a **fixed desktop
profile (1440×810, dpr 2)**; drive to the solo playing state; wait on `__SCENE_READY__`; let
the scene settle (fixed number of frames / short fixed wait so the camera-follow lerp
stabilises — deterministic, not a race); screenshot the canvas element to the out path; print
the absolute path. Freeze obvious non-determinism where cheap (e.g. pause the countdown).

**Feeds:** `docs/DELTA.md` (entry format already defined in that file).

---

## Component 3 — `tools/perf-probe.mjs` (scripted floors)

**CLI:** `node tools/perf-probe.mjs [--profile desktop|mobile] [--mode record|assert]`
Phase 0 uses `--mode record` only.

**Behavior:** launch app (WebGPU flags, `desktop` = 1440×810/dpr2, `mobile` = ~360×780/dpr1.5
emulation); drive to solo playing state; wait `__SCENE_READY__`; sample `window.__PERF__` for
a fixed window (≥ 3 s); report **median** fps / drawCalls / triangles. Then build the client
(`npm run build --prefix client`) and measure the **gzip** size of the JS+CSS in `client/dist`
(exclude Rapier WASM + any shader source per §2).

- `record` mode: print a table and write the numbers into a **`## Phase-0 baseline (WebGL)`**
  block in `STATUS.md` (create the block if absent; overwrite it if present). Never fails.
- `assert` mode (later phases): compare against the §2 floors for the profile; exit non-zero
  on any miss. Not used in Phase 0.

**Determinism:** honour `workers: 1` discipline — do not run other Chromium load concurrently.

---

## Component 4 — `tools/verify.mjs` (battery runner) + static gate

**CLI:** `node tools/verify.mjs [--phase <N>]` (default `--phase 0`).

Runs the phase's check manifest, prints a **numbered PASS/FAIL table**, emits a machine-
readable JSON summary (stdout tail or `tools/.last-verify.json`), and **exits non-zero if any
hard check fails**. This is what `gate-verifier` invokes.

**Phase-0 manifest:**
1. **Static gate** — `npm run lint --prefix client` at **0 warnings**. Requires an ESLint
   config, which does not currently exist → this component also adds a **minimal
   `client/.eslintrc.cjs`** matching the installed eslint 8 + `eslint-plugin-react`/`-hooks`/
   `-refresh` already in `client/package.json`. (Decision: add the config; a real static gate
   is cheap and pays off immediately.)
2. **Unit tests** — `npm test --prefix client` (vitest, the 3 existing specs).
3. **E2E** — `npm run e2e --prefix client` (the green Puzzle-1 suite).
4. **Perf baseline** — `node tools/perf-probe.mjs --mode record` (non-failing; records numbers).
5. **Bundle record** — captured by step 4's build/measure; surfaced in the table.

Steps 1–3 are **hard** (a fail = red battery). Steps 4–5 are **record-only** in Phase 0.

---

## Component 5 — `.claude/agents/gate-verifier.md` (the honest verifier)

A dedicated project agent — the single highest-leverage piece.

- **Frontmatter:** `name: gate-verifier`, `model: sonnet`, tools **read-only + run**:
  `Bash, Read, Grep, Glob` — **no `Edit`/`Write`/`Agent`**. It grades; it cannot fix its own
  critique (no stake).
- **Inputs (in the dispatch prompt):** the phase number, and pointers to read —
  `STATUS.md` current focus, the phase's row + gate in `Project_Requirements.md` §6, pillars,
  §2 floors, and `reference/media__new_visuals.png`.
- **Procedure:** run `node tools/verify.mjs --phase <N>`; run `tools/capture-hero.mjs`; do the
  reference-delta (the **ten** most significant differences vs the reference, ranked by
  impact); score the self-rubric (`docs/RUBRIC.md`) per pillar with a "what raises this +2"
  line each. Cross-check every claim against a tool result per the anti-overclaim rule.
- **Output:** a **PASS/FAIL verdict** with evidence (the numbered battery result, the shot
  path, the ranked delta list ready to paste into `DELTA.md`, the rubric scores). It does not
  edit files; the loop session applies fixes and re-dispatches a fresh verifier.
- Replaces (deletes) the stale `.claude/agents/playwright-regression-tester.md` (leftover from
  a different "OKR tracker" project).

**Attended-loop use:** at each gate the loop session dispatches `gate-verifier`, then pauses
and surfaces the verdict + hero-shot-vs-reference to the human before closing the phase.

---

## Component 6 — `docs/RUBRIC.md` (self-score template)

Rows: pillars **A–F**, plus **Performance** and **Reliability**. Scale per the method:
`10` = passes review against the reference bar; `7` = right class, visibly short; `4` =
functional but generic; `2` = looks unfinished. Per row, a "what raises this +2" line and a
per-phase score column. The loop implements the two cheapest +2 items before closing a phase.

---

## Runtime wiring

`tools/*.mjs` live at repo root and import Playwright's `chromium`. To resolve it, the lead
adds `@playwright/test` to the **root** `package.json` devDependencies (browser binaries are
cached globally, so no second download) and adds root scripts:
`verify` → `node tools/verify.mjs`, `capture` → `node tools/capture-hero.mjs`,
`perf` → `node tools/perf-probe.mjs`.

---

## Sequencing

1. **Lead (me):** this spec · the `<PerfProbe />` hook · root `@playwright/test` + scripts ·
   `npm install` at root. (Shared, collision-sensitive — not fanned out.)
2. **Fan out to Sonnet, parallel** (disjoint new files; none touch `package.json` or app code):
   - **H1** → Components 2 + 3 (`capture-hero.mjs`, `perf-probe.mjs`).
   - **H2** → Component 4 (`verify.mjs` + `client/.eslintrc.cjs`).
   - **H3** → Components 5 + 6 (`gate-verifier.md`, `RUBRIC.md`; delete stale agent).
3. **Lead:** run `node tools/verify.mjs --phase 0` → the **green Phase-0 baseline** with
   recorded WebGL numbers in `STATUS.md`. That *is* the Phase-0 gate passing.
4. Then the separate **version-bump** workstream (its own research + safe-tier apply gated by
   the now-complete e2e).

## Deferred (built per-phase, NOT now — subjects don't exist yet)

Capability-gate test (needs the Phase-1 unsupported screen — authored test-first when that
lands) · Puzzle-2/3 e2e · full 1→2→3 escape run · 3-client sync test (will need `webServer`
extended to also boot `node server/index.js`) · server-authority probe · `assert`-mode perf
enforcement against §2 floors.
