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

## 2026-07-07 — Phase 1 — First WebGPU deck render vs. the true reference (round 1)

Shot: `docs/shots/phase1-hero.png` (via `tools/capture-hero.mjs --phase 1`)
Reference: `reference/sector9_deck_hero.png` (primary from Phase 1 on — see Phase-0 entry)

1. [critical] **Hologram-console bloom blowout** — a cyan blob with a blown-white core eats ~30% of the frame; the cipher card and its label are illegible inside it. Cause: cyan console task light (intensity 38) hotspot on metallic floor + bloom threshold 0.72 smearing at radius 0.85. Reference neon is bright but *shaped* — halos hug their emitters.
2. [critical] **Composition: the "hero" is the gameplay follow-camera staring at empty floor.** Reactor, consoles, ceiling trusses, cables, greebles — nearly all of the deck's built detail is out of frame. Reference frames the reactor centered with consoles flanking and a dense ceiling. Needs a dedicated hero vantage (`?hero=1`) used by capture-hero.
3. [critical] **Left wall / upper-left crushes to near-black** (Pillar C tension). Walls are metalness 0.75 with no environment to reflect (D-4 probe benched), so away from the sector washes metal goes black. Reference's darkest corners still carry cool color and readable panel detail.
4. [high] No visible atmosphere across most of the frame — reference has layered smoke/haze catching light everywhere; our godrays exist but are out of frame at this angle, and there is no ambient haze/motes.
5. [high] Reactor reads as a bare glowing ball on a cylinder; reference is a caged containment vessel — heavy frame, coils, struts, surrounding machinery. (Partly composition — re-judge after #2.)
6. [high] Floor reads as uniform clean tiles; reference plating is grimy, oil-stained, with grating inserts and strong wear variation.
7. [medium] Right-edge magenta/red light also blown to a shapeless blob (same taming as #1).
8. [medium] Ceiling pipe/cable density can't be judged — out of frame (composition, re-judge after #2).
9. [medium] Player droid is a small featureless sphere vs the reference's detailed hover mechs (Phase-5 polish candidate).
10. [low] Color language (cyan/magenta/orange on dark steel) and HUD styling already align — keep.

Fixed this round: #1, #2, #3.
Re-render: `docs/shots/phase1-hero.png` (intermediates `phase1-hero-r2/r3.png`) — all three closed:
- **#1 closed.** Bloom threshold 0.72→1.0, radius 0.85→0.6; console task lights 38→14 cd (raised to y=2.0); ceiling panel emissive 3.2→1.7, panel lights 26/30→18/20; CA 0.55→0.35. The cipher card is now fully legible (label + colored wire bars) inside a tight shaped halo; ceiling panels read as fixtures, not a frame-wide haze.
- **#2 closed.** `?hero=1` HeroCamera (GameCanvas.jsx) on the partition line — reactor dead center, consoles flanking, ceiling trusses/cables in the top third; capture-hero.mjs defaults to it (`--gameplay` keeps the old framing). The partition glass reads edge-on as the frame's central cyan beam (tinted `#2ec8e6` — was blowing white), echoing the reference's floor-crossing energy line.
- **#3 closed.** Wall metalness 0.75→0.55 (pure metal + no environment probe (D-4) = black; painted-alloy keeps a diffuse lobe), hemisphere 3.2→4.2, ambient 0.55→0.7. Darkest corners now carry warm reactor / cool sky color with readable panel detail.
Remains (re-ranked for the next round): #5 reactor is a plain ball behind struts (biggest remaining), #4 ambient haze/motes, #6 floor grime/wear variation, #9 droid detail.

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
