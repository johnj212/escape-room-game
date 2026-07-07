# DELTA — reference-delta log

The reference-delta loop is verification check **#1** and runs **every phase** (`Project_Requirements.md` §5). Newest entry first.

**Procedure per phase:** render the closest matching hero shot of the Sector-9 deck → place it side-by-side with `reference/media__new_visuals.png` (and any relevant UE5 stills in `reference/`) → list the **ten most visually significant differences, ranked by impact** → fix the top three → re-render → only then does the phase close.

**Entry format:**

```
## <date> — Phase <n> — <short label>
Shot: <path to the rendered comparison image>
Reference: reference/media__new_visuals.png

1. [impact] <biggest difference>
2. ...
10. ...

Fixed this round: #<a>, #<b>, #<c>
Re-render: <path> — <what closed, what remains>
```

---

## 2026-07-07 — Phase 0 — Scaffold hero shot vs. reference (gate-verifier round) + reference correction

Shot: `docs/shots/phase0-hero.png` (captured by the Phase-0 gate-verifier via `tools/capture-hero.mjs`)
Reference: **corrected this round** — the gate-verifier found `reference/media__new_visuals.png` is a flat lobby/menu title card, not the lit 3D deck render the brief describes. The true render existed at `assets/sector_9_deck_1779639466019.png` (reactor core, greebled pipes/cabling, volumetric fog, hover droids, colored bounce light) and is now copied to **`reference/sector9_deck_hero.png` — the primary visual grading reference from Phase 1 onward.** `media__new_visuals.png` stays as the UI/menu style reference only.

Gate-verifier's ranked differences (Phase-0 scaffold vs. the bar — expected to be brutal pre-rebuild):

1. [critical] ~~Reference was a flat 2D title card~~ — RESOLVED this round via `reference/sector9_deck_hero.png`.
2. [critical] Phase-0 shot is flat-unlit primitive geometry (disc console, plinth, translucent wall) with no GI/bounce; background near-black.
3. [critical] No visible shadows at all — Pillar C can't even be evaluated yet.
4. [high] No bloom on neon emissives — flat saturated color, no glow falloff.
5. [high] Zero geometric detail/greebling — no panels, rivets, cabling, pipes.
6. [high] No volumetrics/atmosphere (no shafts, no motes).
7. [medium] Triangle count median 2 (tools/.last-verify.json) vs. the ≥2M hero floor.
8. [medium] Composition not like-for-like (title card vs. top-down gameplay) — resolved by the reference correction.
9. [low] Color language (cyan/magenta on near-black) already aligned — carries into Phase 1.
10. [low] HUD typography already close to the reference card — keep.

Fixed this round: #1 (reference corrected). #2–#6 are exactly Phase 1's gate (WebGPU geometry + lighting rebuild) — deferred to it by design, per this file's own note that the first real delta round lands at Phase 1 close.
Re-render: at Phase 1 close, against `reference/sector9_deck_hero.png`.

---

_(First full render-vs-reference round lands at the close of Phase 1, when the deck first renders on WebGPU.)_
