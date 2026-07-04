# RUBRIC — self-score, every phase

Score **after every phase**, one row per pillar (plus Performance and Reliability). For each
row, write the score, a one-line justification tied to a tool result, and **"what raises this
+2"**. Then **implement the two cheapest +2 items before the phase closes** (`Project_setup.md`
method §8). Scores are judged against `reference/media__new_visuals.png` and the §2 floors —
never against "good enough for a browser."

**Scale:** `10` = passes review against the reference bar · `7` = clearly the right class of
result but visibly short · `4` = functional but generic · `2` = looks unfinished.

The `gate-verifier` agent fills this in during its run; the loop session confirms and acts on
the two cheapest +2 items.

| Row | What it measures (the pillar rule) | P0 | P1 | P2 | P3 | P4 | P5 |
|---|---|---|---|---|---|---|---|
| **A — Forced interdependence** | An automated test proves each puzzle is impossible for a single role's info + inputs. | | | | | | |
| **B — Geometry & light, asset-free** | Detail lives in code-generated geometry/light; no external asset in the play route. | | | | | | |
| **C — No black shadows** | Any shadowed pixel carries cool skylight / colored bounce; never crushed to flat black. | | | | | | |
| **D — Server-authoritative integrity** | A fabricated solve/teleport is rejected; server owns puzzle state, timer, win/lose. | | | | | | |
| **E — Reach / capability degradation** | Every action reachable on desktop/touch/solo-swap; non-WebGPU → designed unsupported screen, zero console exceptions. | | | | | | |
| **F — Room alive, clock is dread** | A frozen frame reads as one second from motion; last two minutes materially more urgent than first two. | | | | | | |
| **Performance** | Desktop ≥ 60 fps @ 1440p, ≥ 2M tris/frame hero; mobile ≥ 30 fps, ≥ 0.5M; JS+CSS ≤ 500 KB gzip. | | | | | | |
| **Reliability** | Battery green; no stubs / no `// TODO` in a closed phase; no disabled tests; deviations logged. | | | | | | |

## Per-phase notes (newest first)

_(Append a short block per phase: the two cheapest +2 items chosen and that they were
implemented before close. No entries yet.)_
