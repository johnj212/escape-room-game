# DEVIATIONS — spec vs. built, with reasoning

When a `Project_Requirements.md` item turns out infeasible or is deliberately changed, the substitute is recorded here — **the bar itself never moves without this paper trail.** Newest entry at the bottom.

**Entry format:**

```
### D-<n> — <short title>
- **Spec:** <what the requirement / original plan said>
- **Built:** <what was done instead>
- **Why:** <the reasoning>
- **Cost / to revisit:** <what this trades away; whether it's permanent or a later phase pays it back>
```

---

### D-1 — Physics engine: custom AABB → Rapier (WASM)
- **Spec:** The original `implementation_plan.md` mandated a lightweight custom AABB/cylinder collision system in pure JS, explicitly to avoid Rapier's WASM bundle ("eliminates WASM dependencies entirely").
- **Built:** `@react-three/rapier` (WASM) is used and is **ratified** by `Project_Requirements.md` (§1, Physics).
- **Why:** Hand-rolling a robust physics engine is wasted runway for a proof-of-concept; Rapier already works, its edge cases are documented (`handoff.md` §3), and it scales to richer mechanics than a custom AABB system could. Investors do not evaluate the physics library.
- **Cost / to revisit:** Adds a WASM payload (excluded from the §2 critical-bundle floor and budgeted separately). Permanent unless a future hard mobile-size constraint forces reconsideration.

### D-2 — HUD typography: webfont → system font stacks
- **Spec:** The original build's visual identity used Google-Fonts Orbitron (HUD) + Inter (UI) via a runtime `@import` — an external asset fetched in the play route, in direct violation of Pillar B / §1 Assets ("no font binary in the critical path").
- **Built:** Zero-fetch system stacks (2026-07-07): `--font-hud` = Avenir Next Condensed/Futura/Segoe UI-class condensed sans with wide tracking + uppercase; `--font-ui` = the platform UI stack. All inline `fontFamily: 'Orbitron'` references now resolve through the CSS variables.
- **Why:** The asset floor is absolute; self-hosting a font file is equally banned ("font binary in the critical path"). Wide-tracked condensed system faces keep the cyber-HUD voice with zero network/binary cost.
- **Cost / to revisit:** Some typographic distinctiveness vs. Orbitron; exact face varies by platform. Revisit only if a procedurally generated (code-drawn) display face for the few big HUD strings proves worth the effort in the Phase-5 visual pass.

### D-3 — Shadow stack: PCSS + screen-space contact shadows → PCFSoft CSM + GTAO grounding (interim)
- **Spec:** §2 desktop: "4 CSM cascades ≥2048², texel-snapped, + PCSS contact hardening + screen-space contact shadows (short raymarch)".
- **Built:** 4-cascade CSMShadowNode @2048² (first-party WebGPU CSM) with PCFSoft filtering; contact grounding via half-res GTAO in the post stack. PCSS contact hardening and the SS-contact raymarch are not implemented yet.
- **Why:** three r185 ships Basic/PCF/PCFSoft/VSM shadow filters; PCSS under the node system is a custom `shadowFilterNode` — real work that competes with Phase-2/3 gameplay scope. GTAO already grounds props visually at the current camera distance.
- **Cost / to revisit:** Softer-but-uniform penumbrae (no contact hardening). **Not permanent:** scheduled for the Phase-5 visual pass; the hook (`light.shadow.shadowNode` filter) is already the seam CSM uses.

### D-4 — GI: 8×6×8 irradiance-probe volume → fixture lighting + GTAO (probe bake built but benched)
- **Spec:** §2: precomputed irradiance-probe volume (≥8×6×8 probes, compute bake at load) + GTAO; SSR on floor/metal.
- **Built:** GTAO (half-res) ships. A real single-probe bake exists (`client/src/render/EnvironmentProbe.jsx`: PMREMGenerator.fromScene of the live deck → scene.environment) and WORKS visually, but drops 60 fps → 1 fps when combined with the PostFX scene pass + cube shadows (measured 2026-07-07, suspected per-frame pipeline churn) — so it is NOT mounted. Ambient bounce is currently hemisphere skylight + sector-tinted fixture washes. SSR not implemented.
- **Why:** The fps floor (≥60) outranks single-bounce IBL; the probe needs its own debugging round to find the recompile trigger.
- **Cost / to revisit:** Ambient is directionally correct but not image-based; no SSR. **Not permanent:** Phase 5 pays this back — first fix the environment perf trigger (then a probe GRID via compute per spec), then evaluate SSR against the fps budget.
- **Re-confirmed still open at the Phase-2 gate (2026-07-09):** the visible cost is Pillar-C edge-band darkness — hero right band pixel-measured 95.9% below the 5%-sRGB bar vs the reference's 36.8% (`tools/pixel-check.mjs`, methodology + per-iteration numbers in `docs/DELTA.md` 2026-07-09) after directed-light constants hit diminishing returns. The Phase-5 probe/GI payback is the fix; the committed pixel-check tool is the acceptance test for it.

### D-5 — Desktop pixel budget: native dpr-2 rendering → dpr 1.5 canvas + 0.6-scale scene pass + FXAA
- **Spec:** §2 desktop: "≥60 fps at 1440p, dpr ≤ 2" with the full §2 post stack; the natural reading of the original build was native rendering at the canvas resolution.
- **Built (2026-07-08):** The desktop canvas clamps to dpr 1.5 (explicitly within the floor's "dpr ≤ 2") and the PostFX scene pass renders at 0.6 of canvas resolution (`PostFX.jsx` `DESKTOP_SCENE_SCALE`), upscaled through the post chain and finished with FXAA after tonemapping — the internal-resolution strategy UE5-class titles ship with. Companion cuts from the same fps bisect: MSAA off (FXAA instead), PCF instead of PCFSoft shadow filtering (folds into D-3), glass `transmission` 0 (per-frame full-res transmission target + mips for invisible refraction), ceiling panel point lights 5→3 (all five stay emissive), console task lights folded into the sector fills, alarm spot shadowless, material fractal noise 3→2 octaves, godrays 14 steps @0.35 res, GTAO 6 samples @0.35 res. Fps is asserted on the **production build** via `vite preview` (dev-mode React overhead was depressing readings ~10%). **Result: 60 fps median / 2.02M tris / 484 KB gzip with a healthy GPU canary — §2 desktop floors met.**
- **Why:** Empirical bisect (2026-07-08, all numbers in STATUS.md): per-pixel shading breadth (forward light loop + 4-cascade PCFSoft CSM taps + fog + procedural noise) capped the scene pass at ~20 fps at native 2880×1620 with no single dominant pass. Resolution scale is the one lever that shrinks every per-pixel cost at once; the alternative was cutting §2 features outright (CSM cascades, GTAO, godrays), which the floor forbids.
- **Cost / to revisit:** Slight softening of fine detail at 100% crop (FXAA hides most of it at viewing distance; HUD/text is DOM-rendered at native dpr and unaffected). Revisit in Phase 5: TRAA (temporal AA node ships in three r185) would recover sharpness at the same scale, and the Phase-4 adaptive ladder may raise the scale on stronger GPUs.

### D-6 — Puzzle-2 arm window: 1.5 s → 3.0 s (user playtest tuning; SPEC AMENDED 2026-07-09)
- **Spec:** §3.14 / §6 Phase-2 gate originally said "three role-keyed scanners armed within a **1.5 s** rolling window." **Amended 2026-07-09 on the user's explicit instruction — 3.0 s is now the spec value** (`Project_Requirements.md` §3.14 and the §6 Phase-2 gate row updated in place); this entry is the paper trail, no longer an open deviation.
- **Built:** `shared/scannerPuzzle.js` `ARM_WINDOW_MS = 3000`. Changed in commit `9b04c77` (2026-07-08, user-authored — no agent trailer, bundled with a `client/dist` rebuild consistent with the ngrok playtest session that also surfaced the mobile USE-button bug). Every other mechanic is untouched: 4 s latch, 5 s lockout, all-3-roles requirement, no solo variant.
- **Why:** Real-human playtest tuning, **confirmed by the user 2026-07-09: 3000 ms was needed on mobile** — touch input latency (virtual joystick + USE button) makes the 1.5 s window unreachable for real players on phones, and the window must be one value everywhere (server-authoritative shared machine, no per-device variant). The interdependence *shape* is unchanged — the exhaustive 2-role-subset insufficiency proof and the authority probe are window-agnostic and still pass.
- **Cost / to revisit:** The puzzle is easier than the original number; tension relies more on the latch/lockout rhythm. Pinned by a literal-value regression test (`scannerPuzzle.test.js` asserts `ARM_WINDOW_MS === 3000` referencing this entry) so the constant can never drift silently again — the drift was found by the Phase-2 gate-verifier as an undocumented spec change, then ratified by the user. A 1.5 s hard-mode remains a cheap future option (one constant + pin test + this entry).
