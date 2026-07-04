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
