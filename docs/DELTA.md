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

_(No entries yet. First entry lands at the close of Phase 1, when the deck first renders on WebGPU.)_
