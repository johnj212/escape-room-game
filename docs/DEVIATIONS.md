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
