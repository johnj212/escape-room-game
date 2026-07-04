# tools/ — verification harness

Home for the scripted checks in `Project_Requirements.md` §5. Per the build method, the harness is **built by the agent during Phase 0**, not hand-authored up front — this README is the spec for what belongs here.

## What lands here

1. **Reference-delta capture** — script/route that renders a hero shot of the deck to an image for side-by-side comparison against `reference/media__new_visuals.png` (feeds `docs/DELTA.md`). Check #1.
2. **Playwright e2e** — solo-swap solve of each puzzle + a full 1 → 2 → 3 escape run; a 3-client sync test (movement, puzzle state, timer). Checks #2, #3.
3. **Server-authority probe** — a scripted socket client that emits a fabricated solve and a teleport; asserts authoritative state is unchanged. Check #4.
4. **Performance harness** — captures fps / draw calls / triangle count on the desktop profile and an emulated mobile profile; asserts bundle size against the §2 floors. Check #5.
5. **Capability-gate test** — forces a non-WebGPU context and asserts the unsupported screen renders with zero console exceptions. Check #6.

Static gate (lint, later typecheck) runs via the existing `npm run lint` / `npm test` scripts, not from here.
