# 🧵 CANON WEAVE

**Canon-event, continuity, branching and franchise timeline control for AI Dungeon.**

CANON WEAVE is a deterministic plot-control layer that sits above Story Cards. Story Cards describe **what** people, places and lore are; Canon Events decide **when** major beats become eligible, required, adapted, completed, skipped or resolved.

> **Canon should be a backbone, not a cage.**

## ✅ Hook-safe build

This release specifically hardens CANON WEAVE against AI Dungeon hook failures.

AI Dungeon currently requires non-Library scripts to end in `modifier(text)`, gives each hook a 16 MB / 2-second sandbox, and warns that empty Input/Output text or `stop:true` can produce scenario-script errors. CANON WEAVE now follows that contract defensively:

- Input, Context and Output wrappers are **fail-open**.
- Every wrapper always returns a non-empty `text` string.
- The wrappers never propagate `stop:true`.
- Missing Library functions no longer take the Scenario down; the original text is returned and an error is logged.
- The Library tracks an Input/Context/Output heartbeat.
- `/canon hooks` or `/canon health` reports which hooks have actually run and any recorded hook errors.
- First-run Story Card setup is restricted to Input/Context, never Output.

### Why commands changed

Older builds returned `text:null, stop:true` for `/canon ...` maintenance commands. AI Dungeon's current documentation says `stop:true` in `onInput` throws **Unable to run scenario scripts**. The new build processes the command, shows the result through `state.message`, and substitutes a non-story neutral maintenance line instead of using `stop`.

Maintenance commands may therefore consume a generation. They are creator/debug tools, not normal gameplay actions.

## ✅ Story Card Notes remain editable

Runtime Story Card writes use only AI Dungeon's documented scripting fields:

- `keys`
- `entry`
- `type`

CANON WEAVE never writes Story Card **Notes**, **Title**, or Character Creator metadata at runtime.

All card mutations pass through a small write firewall around:

```js
addStoryCard(keys, entry, type)
updateStoryCard(index, keys, entry, type)
removeStoryCard(index)
```

The optional `CANON_CONFIG_Story_Cards.json` can still create the polished Config Titles and full Notes guide through AI Dungeon's normal Story Card importer; those Notes remain user-editable afterwards.

## 📥 Installation

Paste the four files into the matching AI Dungeon script tabs:

| File | Tab |
|---|---|
| `1-Library.js` | Library |
| `2-Input.js` | Input |
| `3-Context.js` | Context |
| `4-Output.js` | Output |

Then **Save** and use AI Dungeon's Script Test on each non-Library tab.

A healthy install should show normal text in every Script Test rather than an error.

Start an Adventure and run:

```text
/canon hooks
```

The info message should eventually show runs for all three hooks.

If `CanonWeave is unavailable` appears in the logs, the Library file was not installed/saved correctly. If one hook stays at zero runs, reinstall that hook file specifically.

Also confirm **Settings → Gameplay → Scripts** is enabled.

## ⚙️ Config

CANON WEAVE can self-create functional Master + Advanced Config cards on first Adventure hooks. Because AI Dungeon's scripting API does not document a runtime Notes/Title writer, self-created cards intentionally use only Triggers/Entry/Type.

For the polished Config cards with explanations in Notes, import:

`CANON_CONFIG_Story_Cards.json`

through the web Story Card importer.

## 🎬 Franchise Mode

Minimal setup:

```text
franchise:Naruto
```

More controlled setup:

```text
franchise:Naruto
franchise_canon:manga / main anime continuity
franchise_scope:main canon and major character arcs
franchise_start:beginning
franchise_end:end of original Naruto
franchise_filler:exclude
franchise_granularity:major
franchise_dependency_strategy:backbone
franchise_divergence:adaptive
franchise_player_role:original_character
franchise_build_mode:steady
franchise_delivery_policy:adaptive
franchise_outcome_policy:adaptive
```

For exact continuity, add `Canon Source` Story Cards and use:

```text
franchise_source_mode:require
franchise_require_source_ref:true
```

## ✨ Core systems

- dependency-relative and absolute timelines
- strict arcs and exclusive routes
- `after`, `after_any`, `after_resolved`, `after_not`
- strict/balanced/loose detection
- negation-aware completion and blockers
- N-of-M `when_min` / `complete_min`
- cross-action evidence
- flags, cancellations and contradictions
- Retry rollback and Undo-aware canon state
- fair scheduling and urgent preemption
- foreshadowing and deadline bridging
- explicit + automatic Story Card retrieval
- smart extraction from long lore cards
- delivery / outcome / player-presence policies
- Franchise Auto-Builder
- structured `@CANON_SOURCE` grounding
- Canon Doctor
- optional Dashboard and Roadmap
- adaptive context budgeting
- fail-open hooks
- Story Card Notes safety firewall

## 🩺 Diagnostics

```text
/canon status
/canon hooks
/canon health
/canon setup status
/canon doctor
/canon next
/canon why EVENT_ID
/canon franchise status
/canon franchise roadmap
```

The most useful first check is `/canon hooks`.

## 🧪 Tests

The package includes mock-runtime, package-sanity, performance, Notes safety and hook-contract tests.

```bash
node tests/mock_runtime.test.js
node tests/notes_safety.test.js 1-Library.js
node tests/hook_contract.test.js
node tests/package_sanity.test.js
node tests/performance_smoke.test.js
```

---

**CANON WEAVE keeps source canon available without forcing the player to reenact it — and now treats hook failure as something to survive and diagnose rather than something that can break the Adventure.**
