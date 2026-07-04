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

**Not yet built (Phase 0 remainder):** Playwright e2e setup, in-scene perf HUD (fps/draw-calls/triangles), the WebGPU capability gate + unsupported screen, and a green baseline run on the *current* build before the Phase 1 rewrite begins.

## Next actions

1. Establish the current WebGL build's baseline (fps, bundle size) so Phase 1's WebGPU rebuild has a before/after to compare — record numbers here, not from memory.
2. Stand up Playwright and write the first e2e: solo-swap solve of Puzzle 1 (the only puzzle that currently exists).
3. Build the capability-gate + designed unsupported screen (needed before the Phase 1 renderer swap so non-WebGPU devices never hit a raw crash).
4. Confirm React Three Fiber v9 + three.js `WebGPURenderer` integration path against installed source; log findings in `docs/R3F-WEBGPU-NOTES.md`.

## Gotchas (append-only; newest first)

_(Carry forward the hard-won ones from `handoff.md` as they recur under the new stack; add new ones here rather than re-debugging.)_

- Rapier rigid-body `type` transitions are async — `linvel()` can return `NaN` on the first frame after a solo-swap type change. Guard velocity/position reads against `NaN` before writing to the store, or the camera-follow lerp propagates `NaN` into a permanent black screen. (from `handoff.md`)
- Third-person camera can clip through/behind room walls; keep boundary colliders but handle the visual so the camera never renders from inside an opaque mesh. Revisit under the WebGPU renderer. (from `handoff.md`)
