# 🧵 CANON WEAVE

**Canon-event, continuity, branching and franchise timeline control for AI Dungeon.**

CANON WEAVE adds a deterministic plot-control layer above Story Cards. Normal Story Cards answer **what something is**. Canon Event cards decide **when a story beat is allowed, required, skipped, adapted, completed or resolved**.

It is designed for franchise adaptations, campaign arcs, episode structures, mysteries, visual-novel routes, boss chains, prophecy systems and any scenario where important beats need stronger continuity than ordinary keyword activation can provide.

> **Canon should be a backbone, not a cage.** CANON WEAVE pushes world/NPC circumstances while keeping the player's unchosen dialogue, thoughts, feelings, loyalties and actions open.

---

## ✨ Highlights

- 🗓️ Absolute and dependency-relative timelines
- 🔗 `after`, `after_any`, `after_resolved`, `after_not`, strict arcs and route groups
- 🎯 Strict/balanced/loose phrase matching with negation awareness
- 🧩 Clause groups plus new **N-of-M** `when_min` / `complete_min` rules
- 🧠 Persistent evidence, flags, cancellation, blockers and completion proof
- ↩️ Undo-aware state and Retry rollback so discarded generations do not become ghost canon
- 🚦 Fair scheduling so eligible events are not starved forever
- 🚨 Safe preemption when a genuinely urgent Force event must interrupt a lower-pressure beat
- 🌒 Foreshadowing and deadline bridges
- 📚 Explicit + automatic Story Card retrieval
- ✂️ Smart sentence extraction from oversized automatically selected lore cards
- 🎭 **Delivery / outcome / player-presence policies** so canon can happen on-screen, as a world event, offscreen, as a fixed outcome, or merely as a genuine opportunity
- 🩺 Canon Doctor and creator commands
- 📊 Optional creator dashboard and franchise roadmap cards
- 🎬 Franchise Auto-Builder from a franchise name
- 📚 Structured source-grounding with `@CANON_SOURCE`
- 🔐 Nonce-verified hidden planner protocol
- 🧯 Fail-open hooks and bounded context/state growth

---

## 🛡️ Story Card Notes / Title safety

**CANON WEAVE no longer writes Story Card Notes or Title at runtime.**

AI Dungeon's documented scripting `storyCards` objects expose only `id`, `keys`, `entry`, and `type`. The documented Story Card mutations are `addStoryCard(keys, entry, type)`, `updateStoryCard(index, keys, entry, type)`, and `removeStoryCard(index)`.

An earlier first-run installer tried to decorate runtime cards by assigning `card.title`, `card.description` (Notes), and `useForCharacterCreation`, and also passed extra undocumented arguments to `addStoryCard()`. That unsupported behavior has been removed.

CANON WEAVE now routes **every runtime Story Card write through a Story Card Write Firewall**. It can only touch supported fields (`keys`, `entry`, `type`). This applies to:

- first-run Config creation
- generated Franchise Canon Events
- Franchise Roadmap updates
- Dashboard updates
- generated-card cleanup

Your Notes, Titles, and Character Creator metadata are therefore **user-owned** and left alone by CANON WEAVE.

### Why runtime-created Config cards may have blank Notes

The scripting API does not document a Notes/Title writer. So the self-installer deliberately creates safe working Config cards using only `keys`, `entry`, and `type`. A short help footer is included in Entry instead.

If you want the fully titled Config cards with the complete option guide already in Notes, import the supplied `CANON_CONFIG_Story_Cards.json` through AI Dungeon's normal web Story Card importer. Those imported Notes remain editable because CANON WEAVE does not rewrite them.

Creator check:

```text
/canon notesafety
```

Official scripting reference: https://help.aidungeon.com/faq/how-do-i-write-scripts-and-use-scripting

---

## 📥 Installation — now zero-config

AI Dungeon provides **Library, Input, Context and Output** script tabs. Copy:

| File | Tab |
|---|---|
| `1-Library.js` | Library |
| `2-Input.js` | Input |
| `3-Context.js` | Context |
| `4-Output.js` | Output |

The non-Library files already finish with `modifier(text)`.

### ✅ You do **not** need to import a Config JSON just to make the script work

CANON WEAVE contains an embedded first-run installer. If the script code is installed but no `Canon Config` Story Card exists, the first real Adventure hook safely creates working Config cards using only the documented Story Card scripting fields:

- ⚙️ **CANON WEAVE — MASTER CONFIG**
- 🛠️ **CANON WEAVE — ADVANCED CONFIG**

The engine also works from embedded defaults if Story Card creation is unavailable, so a missing Config card can no longer make CANON WEAVE appear dead. Runtime creation intentionally does **not** set Notes or Title; use the optional JSON import if you want those editor fields pre-populated.

### Important AI Dungeon editor limitation

Adding a Script in **Scenario Creation** installs the JavaScript, but the JavaScript is not executing merely because it was added to the editor. CANON WEAVE therefore cannot pre-populate Scenario-level Story Cards at install time. The auto-created Config cards appear after the Scenario is actually played and a script hook runs.

If you want the Config cards visible **inside Scenario Creation before publishing**, use the optional root file:

`CANON_CONFIG_Story_Cards.json`

AI Dungeon currently exposes Story Card import/export on the web editor, not the native mobile apps. Import replaces the current Story Card set, so export/merge existing cards first.

### Built-in/community Script installation

If you add CANON WEAVE through AI Dungeon's Script UI, the same rule applies: the Script code can be installed without any bundled Story Cards. Start an Adventure from the Scenario and CANON WEAVE will create its control cards on first run.

If the cards were deleted later, run:

```text
/canon setup
```

To inspect installation state:

```text
/canon setup status
```

If absolutely nothing happens when an Adventure runs, check AI Dungeon **Account Settings → Gameplay → Scripts**. A globally disabled Scripts toggle prevents every script from running, so no script can self-repair around it.

Official scripting reference: https://help.aidungeon.com/faq/how-do-i-write-scripts-and-use-scripting

---

## ⚙️ Config that stays usable

The config is now split into **two cards with the same Type: `Canon Config`**. This avoids cramming dozens of technical options into one 2,000-character Entry while keeping everything in one Story Card category.

### Master Config

```text
@CANON_CONFIG
config_priority:10
preset:balanced
franchise:
franchise_canon:
franchise_scope:main canon
franchise_divergence:adaptive
franchise_player_role:original_character
franchise_build_mode:steady
franchise_delivery_policy:adaptive
franchise_outcome_policy:adaptive
...
---
```

### Advanced Config

Contains matching, scheduler, context, support retrieval and planner tuning. Its `config_priority:20` means it merges after Master.

You can add a tiny personal override card:

```text
@CANON_CONFIG
config_priority:100
preset:cinematic
franchise:Naruto
franchise_canon:manga / main anime continuity
---
```

The Master Config **Notes explain every option in both cards**.

### Presets

- `balanced` — recommended general setup
- `strict` — high-precision detection and more source discipline
- `player_first` — softer enforcement and reactive divergence
- `cinematic` — stronger setup/foreshadowing and flexible presentation
- `source_locked` — source-required, strict franchise adaptation
- `minimal` — manual lightweight canon engine with automation reduced

---

## 🧱 Canon Event example

```text
@CANON
id: rival_duel
title: Official Rival Duel

after_resolved: selection_exam
relative_window: 3-8

when: arena | tournament | referee
when_min: 2
unless: rival is dead | arena destroyed

priority: 85
deadline_policy: force
blocked_policy: skip

delivery: scene
outcome: opportunity
player_presence: optional

include: key:Main Rival, key:Tournament Arena
auto_include: true

mode: strong
complete: official result announced | referee calls the match | match ends
complete_min: 2
complete_within: 3

lead: 3
seed: Build anticipation around the tournament bracket without starting the duel early.
bridge: Use the official bracket or tournament staff to make the match relevant without choosing the player's actions.

protect: established abilities, established relationship
forbid: forced surrender | unexplained power changes
---
The canon rival confrontation reaches its official match. Preserve everything the adventure has legitimately established. The match opportunity and tournament pressure are canon; the player's tactics, dialogue and choices remain open.
```

---

## 🎭 Canon situation vs canon outcome

A major improvement is that CANON WEAVE no longer has to treat every source beat as “the player must do exactly what the original protagonist did.”

`outcome:opportunity` means the **canon situation** is required, but the response is open. A villain can make the famous offer; the player does not have to accept it. A tournament can schedule the rival duel; the player still controls how they fight.

`delivery:offscreen` or `player_presence:none` also lets important franchise events occur through the canon cast/world when the player's original character is somewhere else. The story can receive the consequences later instead of teleporting the player into every episode.

---

## 🎬 Franchise Auto-Builder

The shortest setup is:

```text
franchise:Naruto
```

CANON WEAVE asks the active model to append a hidden structured roadmap block after the normal story response. The Output hook removes the block, validates it, and turns accepted beats into real `Canon Event` Story Cards through `addStoryCard()`.

The generated cards then use the exact same scheduler, dependencies, completion proof, support retrieval, Retry/Undo safety and agency rules as hand-authored events.

### Better franchise setup

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

### Source-grounded mode

Create one or more Story Cards with Type `Canon Source`:

```text
@CANON_SOURCE
franchise:Naruto
continuity:manga / main anime continuity
source_ref:Chunin Exams
range:Exam registration → invasion
---
Paste a compact creator-approved chronological source summary here.
```

Then use:

```text
franchise_source_mode:require
franchise_require_source_ref:true
```

Matching source cards are filtered by franchise/continuity. With nonce mode enabled, each hidden planner request carries a one-use identifier and only the matching `CW1` machine block is accepted.

---

## 🚦 Fair scheduler and urgent preemption

A long scenario can have several events eligible at once. Priority still matters, but `fair_scheduler:true` tracks how long an event remains eligible and gradually boosts it after `starvation_turns`, preventing permanent starvation.

`allow_preemption:true` solves the opposite problem: a low-pressure active scene should not block an overdue high-priority Force event forever. A valid preemptor temporarily re-arms the interrupted event rather than marking it failed.

---

## 📚 Smarter support-card retrieval

Explicit `include:` still wins. Automatic retrieval ranks ordinary Story Cards using triggers, event text, completion signals and the current scene. Control/source/dashboard cards are excluded.

When an automatically selected card is huge, `smart_card_extract:true` ranks its sentences against the current canon query, keeps a short definition lead, and injects the most relevant sentences instead of wasting context on the first arbitrary chunk.

---

## 🔁 Retry and Undo safety

CANON WEAVE journals output-derived state. If you Retry an output at the same action count, completions, flags, misses and evidence from the discarded generation are rolled back before the replacement is evaluated. If the adventure is Undone to an earlier action count, later journaled canon state is rebuilt away.

This avoids “ghost canon” where a discarded output secretly leaves a character dead, a route selected, or an event completed.

---

## 🩺 Creator commands

```text
/canon status
/canon on
/canon off
/canon next
/canon why EVENT_ID
/canon fire EVENT_ID
/canon complete EVENT_ID
/canon skip EVENT_ID
/canon reset EVENT_ID
/canon reset all
/canon flag NAME=true
/canon doctor
/canon setup
/canon setup status

/canon franchise status
/canon franchise roadmap
/canon franchise build
/canon franchise pause
/canon franchise resume
/canon franchise rebuild
/canon franchise clear
```

Commands are stopped in the Input hook and do not become story text.

---

## 🧪 Tests

Run:

```bash
node tests/mock_runtime.test.js
node tests/package_sanity.test.js
node tests/performance_smoke.test.js
```

The mock runtime covers normal scheduling, supporting cards, Retry/Undo rollback, relative timelines, placeholders, negation, clause completion, franchise generation, roadmap materialization, source-required mode, backbone dependencies, layered configs, N-of-M conditions, urgent preemption, structured source filtering, planner nonces, smart support extraction, **zero-config first-run installation, index-0 Story Card creation, Config-card repair, and defaults-only fallback when Story Card writes are unavailable**.

The performance smoke test builds a large synthetic card/event library to catch accidental algorithmic regressions. It is not a substitute for AI Dungeon's own 2-second sandbox test, but it is useful for development.

---

## ⚠️ Important limitation

CANON WEAVE is deterministic JavaScript. It cannot browse the web from AI Dungeon and it is not a second hidden language model. Franchise Auto-Builder therefore depends on either the selected model's existing franchise knowledge or the Canon Source cards you provide.

For exact episode/chapter/mission fidelity, use structured Canon Source cards and `franchise_source_mode:require`.

---

## 🗂️ Repository layout

```text
CANON_WEAVE/
├── 1-Library.js
├── 2-Input.js
├── 3-Context.js
├── 4-Output.js
├── CANON_CONFIG_Story_Cards.json
├── CANON_CONFIG_MASTER_Story_Card.json
├── CANON_CONFIG_ADVANCED_Story_Card.json
├── CANON_SOURCE_TEMPLATE.json
├── CANON_DASHBOARD_Story_Card.json
├── CARD_TEMPLATE.txt
├── Example_Story_Cards.json
├── QUICKSTART.md
├── INSTALLATION.md
├── README.md
├── CHANGELOG.md
├── docs/
│   ├── CONFIG_REFERENCE.md
│   ├── EVENT_REFERENCE.md
│   ├── FRANCHISE_MODE.md
│   ├── RECIPES.md
│   └── TROUBLESHOOTING.md
└── tests/
    ├── mock_runtime.test.js
    ├── package_sanity.test.js
    └── performance_smoke.test.js
```

---

**CANON WEAVE keeps the source timeline available without pretending the player is obligated to reenact it.**
