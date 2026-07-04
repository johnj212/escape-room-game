# Project setup — turn a vibe into a build-ready brief

> **How to use this file:** paste it into a fresh Claude Code session in an empty (or
> nearly empty) project directory, along with one sentence about what you want to build.
> Follow the protocol below in order. The end product is a `PROJECT_<NAME>_v2.md` — a
> brief written in the same style as `PROJECT_LAAS_v2.md`, the document that drove the
> LAAS procedural-world build reviewed in this session. That file is the template this
> one is derived from; read it if you want the worked example before writing your own.
See review here: https://claude.ai/code/artifact/8137448f-3d85-442b-9372-c6adb134779e

## Why this format, specifically

LAAS worked as an autonomous-agent brief not because it was long, but because of what
it refused to do: it never said *how* to build anything, and it never used a word like
"good" or "polished" without also giving something a script could check. Nine features
made it work, and they generalize past 3D worlds to almost any build:

1. **A concrete reference bar, not an adjective.** "UE5-class" meant nothing on its own —
   three actual reference images did the work. Every phase was judged against those
   images side-by-side, never against "pretty good for a browser." Whatever you're
   building needs its own equivalent artifact: screenshots, a competitor's product, a
   benchmark paper, a reference dataset, a set of golden outputs — something to hold
   next to the build and compare, not describe.
2. **A small number of named pillars.** LAAS had six (geometry, light, ecosystem density,
   distance fidelity, art direction, motion). Every requirement traced to one; an
   undocumented decision resolved in favor of the pillar it served. Pillars are the
   thing that lets a model make a thousand unwritten micro-decisions consistently
   without asking you each time.
3. **Numeric floors wherever a number is honest.** "Fast" is not checkable; "60fps at
   1440p, HUD-verified" is. Triangle counts, test coverage, p99 latency, blade counts —
   whatever the domain's equivalent is, it should be a number a script can fail on.
4. **A banned-outcomes list.** The explicit anti-patterns that make a build technically
   "done" but actually a failure — stubbed handlers, hardcoded demo data, a disabled
   test suite, one 4,000-line file, asking the user to lower the bar. This is what stops
   an agent from taking the comfortable shortcut under deadline pressure.
5. **A gated phase plan.** Sequential phases, each with one deliverable and one gate. A
   phase does not close with a TODO in it. This is what makes a multi-week autonomous
   build tractable instead of one giant undifferentiated push.
6. **A reference-delta loop, run every phase.** Render/build the closest thing to a
   review artifact, place it beside the reference, rank the ten biggest gaps by impact,
   fix the top three, re-check. This is the actual engine of quality improvement in the
   whole method — it forces an honest gap list instead of a vibe-based "looks done."
7. **A deviations log, not a silently lowered bar.** When a spec item turns out
   infeasible, the substitute goes in `DEVIATIONS.md` with the reasoning — spec, what
   was built instead, why. The bar itself never moves without a paper trail.
8. **A durable working-memory file.** `STATUS.md` is what let LAAS survive across many
   independent long sessions with no shared memory: mission, hard-rule digest,
   environment facts, phase checklist, current focus, next actions, and an append-only
   gotchas log so the same bug is never re-debugged twice.
9. **A precise carve-out for human judgment.** The brief said, explicitly, what a human
   has to judge because a model can't from static output (motion feel, interactive
   performance, taste calls) — and left everything else, including all architecture, to
   the model. Naming this up front is what let the human stay mostly out of the loop
   without the model constantly stopping to ask permission.

## Grounded in Anthropic's own Fable 5 prompting guidance

Everything above was reverse-engineered from how LAAS's brief happened to behave. It's
worth checking that against Anthropic's actual prompting guidance for this model
([Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5))
— the two turn out to reinforce each other closely, and the official guidance fills in a
few things LAAS's brief didn't need to say explicitly because they were true by default
in that harness:

- **Long-horizon autonomy is a named, expected capability**, not a fortunate side effect
  — Fable 5 is built to "sustain productive output over extended periods, completing
  multi-day, goal-directed runs with strong instruction retention." The "long autonomous
  stretches, no plan-approval round-trips" line in the template's operating instructions
  is working with the grain of the model, not against it.
- **Effort is the main dial, and the doc is specific about where to set it**: `high` as
  the default for most of this work, `xhigh` for the phases that are most
  capability-sensitive (the hardest system in your plan — for LAAS that was GI/lighting
  and the erosion/hydrology pass), `medium`/`low` once things are routine. Don't default
  to max everywhere; it's not the highest-quality setting, it's the setting for when
  quality-per-token matters least.
- **Verification works better as a separate, fresh-context subagent than as
  self-critique.** LAAS's reference-delta loop was self-graded — the same session that
  built a phase also judged it. The official recommendation is stronger: dispatch a
  fresh subagent with no stake in the work to check it against the spec, at a fixed
  interval. Worth building into Step 2/3 below rather than relying purely on
  self-comparison.
- **Progress reports need to be audited against tool evidence, explicitly told to.**
  Without that instruction, long autonomous runs can produce confident status updates
  that outrun what was actually verified. This is a direct addition to make to
  `STATUS.md`'s update discipline (below) — it wasn't a problem LAAS's log format
  encountered, but there's no reason to leave the gap open.
- **State autonomy boundaries explicitly if a run is genuinely unattended** (overnight,
  scheduled, no one watching). Reversible actions that follow from the brief should
  proceed without a check-in; only destructive/irreversible actions or genuine scope
  changes warrant stopping. LAAS's "never ask the user to reduce scope" is half of this;
  the other half — permission to just act on everything reversible — is worth stating too
  if you won't be present for the run.
- **Don't ask the model to transcribe its own reasoning into the working-memory file.**
  `STATUS.md`-style logs should record *decisions, verified facts, and measurements* —
  "erosion particle trace was D8, switched to continuous bilinear-gradient descent,
  verified in shots/wip/fix-round2" — not a narrated transcript of the deliberation that
  led there. The former is durable memory; asking for the latter risks tripping the
  model's reasoning-extraction safeguard and is worse documentation anyway.
- **Give the reason, not just the ask**, when briefing subagents or writing the spec
  itself — Fable 5 uses stated intent to connect a task to the right context rather than
  guessing at it. This is exactly why the pillars section of the template exists: it's
  the reusable "why" that every unstated decision should resolve against.

## The protocol

Run these steps in order, in the fresh session. Do not skip the interview and jump to
writing the template — the template is only good insofar as the answers under it are
specific.

### Step 1 — Interview

Ask the user these questions, one at a time or in a batch if they'd rather. Push for
specifics; a vague answer here becomes an unenforceable brief.

1. **What are you building, in one sentence?** Include the domain and medium (web app,
   CLI tool, game, data pipeline, ML system, library, etc.) — this determines everything
   below.
2. **What's the reference bar?** Two to four concrete artifacts that define "done" —
   competitor screenshots, a reference implementation, a benchmark suite, a target
   dataset, an existing tool you're trying to match or beat. If none exist yet, name the
   closest real-world analog and be honest that the target is "close the gap to that, and
   know exactly how far you got" rather than "match it exactly."
3. **What are your pillars?** 4–7 orthogonal qualities that every requirement should
   trace back to. Propose a draft set based on question 1 and iterate with the user
   rather than inventing them unilaterally — e.g. for a web app: correctness,
   performance, accessibility, security, data integrity, delight. For a data pipeline:
   correctness, idempotency, observability, cost, latency, recoverability.
4. **What are the hard, checkable floors?** Numbers a script can verify in this domain —
   throughput, latency percentiles, test coverage, bundle size, concurrent-user counts,
   accuracy/F1, whatever is measurable and non-negotiable.
5. **Fixed technical constraints.** Language, framework, deployment target, hosting,
   licensing/cost constraints ("no paid APIs," "must run offline," "must run in a
   browser tab"), anything non-negotiable about the stack.
6. **Banned outcomes.** The shortcuts that would make this "technically complete" but
   actually a failure — ask the user directly: "what's the thing you're afraid an
   AI agent would fake or skip here?" That answer is the seed of this list.
7. **Phase plan.** Does the user already have a natural build order in mind? If not,
   propose one from question 1 and get it confirmed — each phase needs one deliverable
   and one gate (a verification step that must pass before the next phase starts).
8. **What can only a human judge?** Carve this out explicitly and narrowly — the things
   that need live interaction, subjective taste, or real user data, that a model can't
   evaluate from its own output alone. Everything not on this list is the model's call
   to make and document, not ask permission for.
9. **What does verification actually look like here?** LAAS used Playwright + pixel
   diffing because it was visual. Your domain's equivalent might be: integration tests
   against golden output, a load-test harness with recorded baselines, a diff against a
   reference implementation's results, a linter/type-checker gate, a security scan. Help
   the user name the concrete tool or script that will do this — the brief should point
   at something buildable, not "write good tests."

### Step 2 — Draft PROJECT_\<NAME\>_v2.md

Use the template below. Fill every bracket from the interview answers. Keep the
operating-instructions and banned-outcomes sections blunt — that bluntness is load-
bearing, not tone. Show the draft to the user and iterate before moving on; this is the
one document in the whole method meant to be human-authored and human-approved.

### Step 3 — Scaffold the operating files

Once the brief is approved, create the supporting structure it references:

- **`STATUS.md`** — the working-memory file. Start it with a rehydration protocol
  paragraph at the top (read this fully, then the spec, then the stack-notes file, then
  "Current focus" — never re-plan from scratch), a one-paragraph mission restatement, a
  hard-rules digest, a phase checklist (unchecked), and empty "Current focus" / "Next
  actions" / "Gotchas" sections ready to be filled in as work happens. Add one line to
  the rehydration protocol itself: *"Before reporting progress, audit each claim against
  a tool result from this session — a screenshot, a test run, a measured number. If
  something isn't verified yet, say so; don't report it as done."* That single line is
  what keeps this file trustworthy across sessions that never talk to each other
  directly. If the project is large enough that one `STATUS.md` gets unwieldy, the
  gotchas log specifically can graduate to one-file-per-lesson (a short summary line at
  the top of each) rather than a single growing append-only section — either works, pick
  the one that stays skimmable.
- **`docs/DELTA.md`** — empty, newest-entry-first log for the reference-delta loop.
- **`docs/DEVIATIONS.md`** — empty, `D-1`/`D-2`/... log with the spec/built/why structure.
- **`docs/<STACK>-NOTES.md`** — empty, append-only log of verified facts about whatever
  framework/library surface the build depends on (the LAAS analog was
  `docs/THREE-NOTES.md` for three.js/TSL/WebGPU). Seed it with the rule: verify an
  unfamiliar API against the actual installed source before relying on training-data
  memory of it, and record what you found.
- **A `tools/` or `scripts/` directory** for whatever the verification harness from
  question 9 turns out to be — even a first crude version. The harness gets built by the
  agent during Phase 0 in LAAS; don't hand-build it yourself unless the user wants to.

### Step 4 — Hand off to the build loop

Once the brief and scaffolding exist, tell the user directly: the brief is now ready to
loop-engineer. Recommend they:

- Default to `high` reasoning effort for the build loop; step up to `xhigh` specifically
  for the one or two phases that are most capability-sensitive (the hardest system in
  the plan), and drop to `medium` once a phase is mostly mechanical. Effort is a dial to
  set per-phase, not a single choice made once.
- Open each new session by pointing the agent at `STATUS.md` first, not the spec —
  `STATUS.md`'s own rehydration protocol chains to the spec and stack-notes file next.
- Expect and encourage long autonomous stretches with minimal plan-approval round-trips,
  per the brief's own operating instructions — that's the point of the format. If a
  session will genuinely run unattended (overnight, scheduled), say so explicitly:
  *"You're operating autonomously — I won't be watching or able to answer questions
  mid-run. Proceed on anything reversible without asking; stop only for something
  destructive, irreversible, or a real scope change."*
- Have the reference-delta loop's verification step run as a **fresh subagent with no
  stake in the work being reviewed**, checking the output against the spec and reference
  artifacts, rather than the same session grading its own output. This is the single
  highest-leverage change over LAAS's own process, which self-graded throughout.
- Keep their own feedback narrow, per the human-judgment carve-out from Step 1 question
  8 — resist the urge to steer architecture the model is already equipped to decide and
  document on its own.

---

## Template — `PROJECT_<NAME>_v2.md`

```markdown
# PROJECT <NAME> — v2
### <One-line description of what this is>

---

## The bar

The target is <concrete reference — named product/paper/dataset/benchmark, or "closest
real-world analog + how far to close the gap">. Reference artifacts live in
`<path>` (<what they are>). Every phase is judged **against those artifacts**, not
against "pretty good."

You will not fully reach them. That is expected. The task is to close as much of the
gap as the stack allows, and to *know precisely* how far you got. What is not
acceptable is building to a lower bar because the lower bar is comfortable.

**Reference-delta loop (mandatory, every phase):** produce the closest matching
artifact, place it side-by-side with the reference, write `docs/DELTA.md`: the **ten
most significant differences**, ranked by impact. Fix the top three. Re-produce. Only
then does the phase close.

---

## The pillars

Every requirement in this document serves one of these. If a decision arises that the
document doesn't cover, resolve it in favor of the pillar.

**A. <Pillar name>.** <One or two sentences + a falsifiable rule, "Rule: ...".>
**B. <Pillar name>.** <...>
**C. <Pillar name>.** <...>
**D. <Pillar name>.** <...>
**E. <Pillar name>.** <...>
(4–7 total — don't force a number that doesn't fit the domain.)

---

## Operating instructions

- Build, don't describe. No plan-approval round-trips. Long autonomous stretches.
- Between two approaches, build the more ambitious one.
- Expect real modular structure across `<planned directories>`. One giant file = fail.
- No stubs. A `// TODO` in a closed phase fails the phase.
- Never ask the user to reduce scope. Infeasible item → nearest feasible alternative +
  entry in `docs/DEVIATIONS.md`.
- <Domain-specific version of "under-rendering is a failure mode" — the thing that
  looks done but is quietly cutting a corner in this domain.>

## 1. Fixed constraints

| Constraint | Value |
|---|---|
| Language | <...> |
| Framework / build | <...> |
| Deployment target | <...> |
| Fallback policy | <e.g. "none — fail loudly with diagnostics" or the real policy> |
| Cost / licensing | <e.g. "zero paid APIs", "must run offline"> |
| Determinism | <if relevant — e.g. seeded reproducibility> |

## 2. Floors — these numbers define "done"

| Dimension | Floor |
|---|---|
| <metric> | <number, verifiable by script> |
| <metric> | <number> |
| ... | ... |

## 3. Systems / components — enumerated

<Numbered list of the major subsystems the build needs, analogous to LAAS's "GPU
systems — enumerated passes." One line each; this becomes the module map.>

## 4. Quality laws

<The domain analog of LAAS's "surface & asset law" — the rules that get enforced on
every instance of some recurring unit of the build (every endpoint, every component,
every asset, every model class), not just the headline features.>

## 5. Verification battery

<The concrete, scripted checks from Step 1 question 9. Number them. Include the
reference-delta loop as #1.>

## 6. Phase plan — gated

| Phase | Deliverable | Gate |
|---|---|---|
| 0 | Scaffold + harness | Harness produces comparisons/checks |
| 1 | <...> | <...> |
| ... | ... | ... |

A phase closes only after: build → run → verification battery → `DELTA.md` → fix top
three → re-check.

## 7. Banned outcomes — instant fail

- <shortcut #1>
- <shortcut #2>
- Asking the user to lower the bar.
- <anything else the user named in Step 1 question 6>

## 8. Self-score rubric

Per dimension: 10 = passes review against the reference bar; 7 = clearly the right
class of result but visibly short; 4 = functional but generic; 2 = looks unfinished.
Score after every phase; for each row write "what raises this by 2 points"; implement
the two cheapest before proceeding.

Rows: <one per pillar, plus performance / reliability as needed>.

## 9. Stretch goals — only after the battery passes

<Optional nice-to-haves, explicitly deferred until the core bar is met.>

---

## Final acceptance

<The domain analog of LAAS's "two-frame test" — one or two concrete artifacts that,
placed beside the reference, should not show a category-level error on first look. State
what a category error looks like in this domain.>

In the end, the human has to be able to actually use/operate/run the result. Their
feedback is a final requirement, but one that comes after the model is satisfied against
the acceptance test above.
```
