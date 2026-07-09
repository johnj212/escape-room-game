# DELTA — reference-delta log

The reference-delta loop is verification check **#1** and runs **every phase** (`Project_Requirements.md` §5). Newest entry first.

---

## 2026-07-09 — Phase 2 — gate-verifier Pillar-C round (reproducible pixel measurement + edge-band lift)

Shot: `docs/shots/phase2-hero.png` (re-rendered this round). Reference: `reference/sector9_deck_hero.png`.

**Measurement is now reproducible:** `tools/pixel-check.mjs` (new, committed — Playwright-decoded, Rec.709 linear luminance, band histograms) replaces the ad hoc scratch sampling behind earlier "% < 5% luminance" claims. The gate-verifier could not reproduce those numbers; nobody can re-derive an uncommitted methodology. All numbers below: `--band <x0,x1> --threshold 0.0037` (≈ 5%-sRGB).

**Verifier finding confirmed, but not a regression:** the right edge band (x 85–100%) measured 98.5% below the bar with mean linear luminance 0.0026 — *pixel-identical* between the Phase-2 and accepted-Phase-1 gate shots (round-2's "no regression" claim verified; its "61%" figure was the old ad hoc methodology). The reference's same band: 36.8% below, mean 0.0488 — the absolute gap is real and is the D-3/D-4 no-bounce-GI signature.

**What was tried, measured per iteration (all zero-per-pixel-cost — same light count, constants only):**
1. Hemisphere 6.0→8.5 (+ warmer ground `#2a2430`), ambient 2.0→2.9, vignette floor 0.8→0.88 → left band 67.1→55.6%, right 98.5→98.2% (the right band barely responds to global fill).
2. Fog color `#0b101b`→`#1c2136` + background lift → **zero effect on either band** (those pixels sit nearer than the fog start at 13); kept anyway for far-field haze/airglow (this log's standing gap #3).
3. Sector fills raised/reached (engineer 16cd/dist12→24/17, technician 16/12→36/19 — the side walls sat at the old `distance` cutoff) → right 98.2→**95.9%** (mean 0.0026→0.0032, +23%), left 55.6→**45.2%** (mean 0.0106→0.0119).

**Where it lands:** right band 95.9% vs reference 36.8%. Directed-light constants are past diminishing returns; the residual is missing bounce/GI (and a magenta wash scores structurally low on Rec.709 luminance — red weighs 0.21). Closing the rest is the **D-4 environment-probe payback (Phase 5)**, now verifiable against a committed measurement tool. Visual check this round: composition and cipher legibility hold, corners read tinted rather than void, no washout.

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

## 2026-07-08 — Phase 2 — Scanner-array deck vs. reference (round 2)

Shot: `docs/shots/phase2-hero-before.png` (pre-round) → `docs/shots/phase2-hero.png` (post-fix)
Reference: `reference/sector9_deck_hero.png`

Ranked differences at round start (carried gaps from round 1 re-verified against the actual shot):

1. [high] Reactor reads as a plain glowing ball behind thin struts vs. the reference's heavy caged containment vessel (round-1 carry, biggest gap).
2. [high] Air is optically clear — no ambient haze or drifting motes; the reference's atmosphere reads in every cubic meter (round-1 carry).
3. [high] Floor reads as uniform clean tile vs. oil-stained, rust-pocked, worn plating (round-1 carry).
4. [medium] Right wall band carries large near-black regions (61% of the sampled band < 5% luminance — same value as the accepted Phase-1 gate shot; carried, Phase-5 lighting pass).
5. [medium] Reference walls are dense with machinery, conduit boxes and lit panels; ours are ribbed panelling only.
6. [medium] Reference consoles are heavily greebled (cables, screens, switch banks); our consoles/pedestals are comparatively simple volumes.
7. [medium] Volumetric fog in the reference pools through the whole frame; our shafts are reactor-local only.
8. [medium] No hover droids in frame (reference has two detailed mechs) — Phase-5 scope, per round 1 #9.
9. [low] No environmental signage/typographic identity (the reference's "SECTOR-9 COMMAND DECK" plate).
10. [low] Partition energy beam is a clean strip vs. the reference's crackling arc texture.

Fixed this round: #1, #2, #3 (each re-bisected against the 60-fps floor — first attempt cost 9 fps and was rebuilt cheaper; see the perf note below).
Re-render: `docs/shots/phase2-hero.png` —
- **#1 closed.** Reactor containment detail (Deck.jsx): 9 banded coil wraps, 10 vertical window mullions over the glass, 16 diagonal cross-braces in two height bands, 10 base vent/control boxes, blockier top header + twin side ducts (~36K tris, instanced). The core now reads as a caged industrial vessel.
- **#2 closed.** Ambient haze via the existing linear fog pulled in to a 13–42 band with a lighter airglow color (`#0b101b`) + a 120-instance drifting mote field (unlit, alpha-blended, per-instance flicker). FogExp2 was tried first and REVERTED: ~1 fps (per-pixel `exp()` in every material) for no visible gain over the linear band at room distances.
- **#3 closed.** deckPlateMaterial grime: large soot/oil patches (single-octave low-frequency noise), glossy puddle band thresholded from the same field, rare per-plate rust reusing the existing cell-random — one new noise call total; the fractal version cost ~3 fps and was cheapened.
- Wall bands pixel-checked before/after: byte-identical to the Phase-1 gate shot — no Pillar-C regression from the fog change (#4 unchanged, carried).

**Perf note (fps-floor re-bisect, 2026-07-08):** the round's first draft (fractal grime + 360 additive motes + FogExp2) measured 51 fps vs the 60 floor. Rebuilt to the shipped config (above) + godrays 10→8 steps + scene scale 0.55→0.53 (D-5 knobs, both imperceptible) + shadow-caster trim on pedestals/side-ducts. HEAD-relative A/B in the same machine window: HEAD 60 fps / this tree 59 → then the window degraded (59→56→55 on successively CHEAPER configs, GPU canary healthy throughout — the raw-ALU canary is blind to CPU/compositor contention). Final idle-machine `perf-probe --mode assert` is REQUIRED at the battery/gate step; not claiming the floor met until then.

Remains (re-ranked for the next round): #4 right-wall near-black band, #5 wall machinery density, #7 room-wide volumetrics, #10 beam arc texture; #8 droids stay Phase-5.

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

_2026-07-08 addendum:_ hero re-rendered after the fps-floor turn (D-5: dpr 1.5 + 0.72 scene scale + FXAA, light consolidation, transmission-off glass) and the 2M density turn — composition, cipher legibility and wall color all hold; the reactor containment cage actually reads better without transmission. Frame is marginally dimmer overall (two ceiling panels lost their point lights); acceptable against Pillar C — darkest corners still carry color.

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
