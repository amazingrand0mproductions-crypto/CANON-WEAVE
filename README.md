# 🧵 CANON WEAVE

**A canon-event, continuity, branching and timeline engine for AI Dungeon.**

CANON WEAVE gives scenario creators a way to build **events that wait for the right moment** instead of relying on ordinary Story Card triggers alone.

Normal Story Cards remain your lore database. Special **Canon Event** cards sit above them as a plot-control layer: they can wait for previous events, source-material timing, characters or locations, route choices, remembered evidence, Story Card support, and completion proof before moving the canon forward.

The aim is simple: **keep the important backbone of a story without turning the player into a passenger.**

---

## ✨ Why use it?

A normal Story Card answers:

> “The word *Akira* appeared. Should Akira's card enter context?”

CANON WEAVE can answer:

> “The entrance exam already happened, the rival has been introduced, the player chose the Hero Course, the tournament is now three actions past the previous canon beat, the arena is relevant, and this event has not been contradicted. Is the rival duel now allowed to happen?”

That difference is the whole point.

### Core features

- 🎬 **Franchise Auto-Builder** — put a franchise name in Config and CANON WEAVE builds a hidden AI-assisted roadmap into real Canon Event Story Cards.
- 🧭 **Roadmap cursor** — later generation batches continue from the last source position instead of repeatedly guessing from the beginning.
- 🦴 **Backbone dependency mode** — generated anchor events form a resilient spine while minor/conditional beats no longer hard-lock every later event.
- 🧬 **Adaptive divergence** — impossible generated beats can resolve cleanly and later anchors can continue without retconning the player’s timeline.
- 📖 **Source-required mode** — optionally refuse franchise generation until creator-provided `Canon Source` cards exist.
- 🧠 **Player-role modes** — original character, canon protagonist, replacement protagonist, or observer framing for franchise generation.
- 📏 **Adaptive context budgeting** — CANON WEAVE scales itself against `info.maxChars` so event control does not unnecessarily eat story history.
- ♻️ **Resolved dependencies** — `after_resolved:` and `strict_order_resolved:true` let adaptive arcs continue past legitimately skipped/cancelled events.
- ⏳ **Force deadline grace** — mandatory events get a short grace period before scene cues are waived.
- 🪜 **Tiered canon strength** — minor/conditional beats stay flexible while anchor events inherit stronger enforcement.
- 🗺️ **Creator Roadmap Card** — optional auto-updating Story Card shows generated events, current build cursor, ambiguity status and progress.
- 🧩 **Continuity ambiguity handling** — if a franchise name fits several adaptations, the builder can stop and suggest continuity choices instead of fabricating one.
- 🛡️ **Generated protect/blocker rules** — planner-created events can preserve continuity facts and reject canon beats made impossible by the player’s established timeline.
- 🧭 **Canon scheduler** — `at`, `before`, windows, priorities, cooldowns and overdue policies.
- 🔗 **Event graph** — `after`, `after_any`, `after_not`, arcs and strict ordering.
- ⏱️ **Relative chronology** — schedule a beat a set number of actions after another beat instead of guessing one global turn number.
- ↩️ **Undo-aware state** — canon completions, route flags and cancellations created by the new engine can rewind with `info.actionCount`.
- 🔁 **Retry-aware output handling** — retrying an AI response at the same action count rolls back effects from the replaced output, preventing ghost completions.
- 🧠 **Evidence memory** — events can depend on facts seen earlier in the adventure.
- 🎯 **High-precision completion** — completion and contradiction matching default to stricter detection than ordinary scene matching.
- 🚫 **Negation awareness** — phrases such as “the villain is not dead” are far less likely to satisfy “villain dead”.
- 🧩 **Clause groups** — require one alternative from each required group, e.g. `(alarm rings OR siren sounds) AND (gates close OR doors seal)`.
- 🧑‍🚀 **Character Creator branching** — gate events using `state.placeholders` answers.
- 🌿 **Exclusive routes** — first event in a `group:` can own that branch.
- 🚦 **Persistent flags** — set and clear route/world-state flags on completion.
- 🛑 **Cancellation rules** — one event can permanently cancel incompatible future beats.
- 🪄 **Foreshadowing** — seed future canon beats before their activation point.
- 🌉 **Deadline bridging** — mandatory events can bridge naturally from the current scene when their intended moment has passed.
- 📚 **Forced Story Card support** — explicitly load Character, Location, Item, Lore or other cards alongside a canon beat.
- 🔎 **Automatic Story Card retrieval** — rank likely support cards by triggers, title when exposed, and weak entry relevance.
- 🧹 **Auto-include exclusions** — prevent known-wrong cards or card types from being selected.
- 🎭 **Player-agency protection** — the engine pushes world/NPC circumstances without deciding unattempted player actions, thoughts or dialogue.
- ✅ **Completion proof** — an event is not finished merely because it was injected.
- 🔂 **Strong retry cycles** — failed beats can back off and re-arm instead of instantly disappearing.
- 🔒 **Force mode** — mandatory events can use a creator-written fallback when model compliance repeatedly fails.
- 🩺 **Canon Doctor** — checks duplicate ids, dependency cycles, missing references, broken timelines and suspicious configurations.
- 📊 **Optional dashboard** — a Story Card can display current canon state for the creator.
- 🧯 **Fail-open hooks** — a malformed card is much less likely to break the whole adventure.
- 📦 **No external dependencies** — everything runs inside AI Dungeon's JavaScript scripting sandbox.

---

# 🛡️ Hardened timeline architecture

The scheduler now distinguishes **completed canon** from **resolved canon**. This matters in freeform adaptations: a player may make a source event genuinely impossible, and treating that event as an eternal prerequisite can freeze the entire roadmap.

Hand-written events can use:

```text
after_resolved: previous_event
strict_order_resolved: true
blocked_policy: skip
```

`after_resolved:` accepts a prior event that was completed, legitimately skipped, or cancelled. It does **not** treat a stalled/broken event as healthy resolution. That gives adaptive scenarios a way to preserve forward momentum without pretending the skipped source beat happened.

Franchise Mode uses this automatically when `franchise_dependency_strategy: backbone` and `franchise_divergence: adaptive` are enabled. True anchor events link to the prior backbone anchor, while minor/conditional beats remain opportunities rather than hard gates.

## Context budgeting

AI Dungeon’s context is finite, and adding a huge canon instruction can displace the very story history needed to make that canon scene coherent. CANON WEAVE therefore has two limits:

```text
max_inject_chars:7600
adaptive_context_budget:true
max_context_share:0.20
min_history_chars:5200
```

`max_inject_chars` remains the hard ceiling, but adaptive budgeting can shrink the real injection based on the current `info.maxChars`. Supporting Story Cards are also deduplicated and capped by type so a scene does not waste context on several nearly identical entries.

## Retry/Undo hardening

Retry rollback now covers not only completed events and flags, but also strong-mode misses and force-mode stalls created by the discarded output. A replacement generation can therefore re-enter and complete the same active beat instead of inheriting a hidden failure state from text the player rejected.

---

# 🎬 Franchise Auto-Builder

This is the fastest way to use CANON WEAVE for an existing anime, game, film series, TV universe or other established franchise.

You can now put **one line** in the Canon Config:

```text
franchise: Naruto
```

CANON WEAVE will begin building a chronological canon roadmap in the background.

It does **not** need you to manually write every Canon Event first.

## What happens internally

1. The Context hook sees the configured franchise.
2. If no canon event is currently active, CANON WEAVE adds a tightly formatted **background planner instruction** to the normal model context.
3. The model still writes the normal story response first.
4. At the very end, it appends a hidden `<CW_FRANCHISE_PLAN>` JSON block containing a small batch of canon events.
5. The Output hook parses that block and removes it **before the player sees it**.
6. CANON WEAVE turns the validated plan entries into real `Canon Event` Story Cards with `addStoryCard()`.
7. Those generated cards immediately become part of the normal scheduler on following actions.
8. The process repeats in small batches until the requested roadmap size or source boundary is reached.

This is intentionally **batch-based** rather than asking the model for fifty events in one giant response. Each successful batch stores a continuation cursor and recent source references, reducing repeats and helping the next batch continue from the correct part of the source timeline.

### Minimal config

```text
@CANON_CONFIG
enabled: true
franchise: Naruto
---
```

That is enough to turn the feature on.

### Recommended franchise config

```text
@CANON_CONFIG
enabled: true

franchise: Naruto
franchise_canon: original anime/manga continuity
franchise_scope: main canon and major character arcs
franchise_start: beginning
franchise_end: end of original series
franchise_route: main storyline
franchise_filler: exclude
franchise_granularity: major

franchise_auto_generate: true
franchise_event_count: 28
franchise_batch_size: 5
franchise_build_every: 2
franchise_pacing: normal
franchise_first_event_at: 4

franchise_event_policy: tiered
franchise_anchor_threshold: 4
franchise_enforcement: strong
franchise_deadline_policy: force
franchise_auto_include: true
franchise_confidence_floor: 0.60
franchise_source_mode: prefer
franchise_dependency_strategy: backbone
franchise_divergence: adaptive
franchise_player_role: original_character
franchise_planner_max_chars: 6800

franchise_materialize_cards: true
franchise_cleanup_old: true
franchise_source_cards: true
franchise_roadmap_card: true
---
```


## New polished franchise controls

### `franchise_scope`

Free-form scope guidance separate from continuity and route. Examples:

```text
franchise_scope: main canon and major character arcs
```

```text
franchise_scope: main quest and mandatory companion events
```

### `franchise_filler`

```text
franchise_filler: exclude
```

Values: `exclude`, `include`, `only`. `exclude` is the recommended default for adaptation scenarios where filler should not become plot-backbone canon.

### `franchise_granularity`

- `anchors` — only backbone events.
- `major` — backbone plus major developments. Recommended.
- `detailed` — adds important intermediate reveals, confrontations and arc transitions.

### `franchise_event_policy`

`uniform` applies the same enforcement/deadline policy to every generated event.

`tiered` classifies planner events as `anchor`, `major`, `minor`, or `conditional`. Minor beats become soft/catch-up, major beats become strong, and true anchors inherit your configured high-level enforcement. This keeps franchise mode from turning every tiny event into a mandatory cutscene.

### `franchise_anchor_threshold`

Importance level from 1–5 at which a generated beat starts receiving stronger deadline behavior under tiered policy. Default: `4`.

### `franchise_require_source_ref`

When enabled, events without an episode/chapter/mission/arc reference are rejected. Useful for strict creator workflows, but it can reject a correct event if the model knows the beat but not the exact source position.

### `franchise_roadmap_card`

Creates a sentinel-triggered `Canon Roadmap` Story Card showing:

- franchise/continuity
- build status
- generated event count
- roadmap cursor
- last batch summary
- continuity choices if the property is ambiguous
- generated event titles

This card is marked as a control card and is never selected by automatic Story Card retrieval.

### `franchise_generated_protect` / `franchise_generated_blockers`

The hidden planner can now suggest continuity facts to preserve and specific outcomes that make a source beat impossible. Those become `protect:`, `forbid:`, and `unless:` metadata on generated Canon Event cards.

### `franchise_source_mode`

Controls whether generated canon may rely on the story model's built-in franchise knowledge:

- `ignore` — never pass Canon Source Story Cards to the planner.
- `prefer` — use creator source cards when available, otherwise allow model knowledge. Recommended for familiar canon.
- `require` — **do not generate anything** until a `Canon Source`, `Franchise Source`, or `Source Canon` Story Card exists. Recommended for obscure, recent, disputed, episode-exact or creator-custom canon.

### `franchise_dependency_strategy`

- `backbone` — recommended. Anchor events form the hard timeline spine. Minor/conditional events do not become mandatory dependencies for every later anchor.
- `linear` — every generated event depends on the immediately previous generated event. Useful for tightly scripted sequences, but easier to deadlock if one optional beat becomes impossible.

### `franchise_divergence`

- `strict` — source backbone has highest priority whenever it can be preserved without an outright contradiction.
- `adaptive` — recommended. Preserve major canon outcomes, but let genuinely contradicted generated beats resolve as skipped and allow later anchors to adapt around the changed timeline.
- `reactive` — player-created consequences take priority; non-anchor source beats remain especially flexible.

### `franchise_player_role`

Tells the hidden planner how the player relates to the source protagonist:

- `original_character` — default; canon cast/world can carry source events around the player's own character.
- `canon_protagonist` — player fills the source protagonist role, while unchosen decisions/dialogue remain protected.
- `replacement` — player replaces the protagonist's plot function.
- `observer` — canon may progress through the source cast without requiring the player to personally perform protagonist actions.

### `franchise_planner_max_chars`

Hard cap on the hidden roadmap-builder instruction, including source-card excerpts. This prevents franchise planning from swallowing a disproportionate share of context while the roadmap is being built.

### Continuity ambiguity

If `franchise: NAME` is not specific enough, the hidden planner may return `needs_continuity` with a short list of likely adaptations/continuities. CANON WEAVE pauses generation instead of repeatedly guessing. Set `franchise_canon`, then run:

```text
/canon franchise rebuild
```

## Franchise options

### `franchise`

The franchise or source property to follow.

Examples:

```text
franchise: Naruto
```

```text
franchise: Buffy the Vampire Slayer
```

```text
franchise: The Witcher
```

```text
franchise: Marvel Cinematic Universe
```

### `franchise_canon`

Disambiguates properties with several continuities, reboots or adaptations.

```text
franchise_canon: 2003 anime continuity
```

```text
franchise_canon: MCU films only
```

```text
franchise_canon: original game continuity
```

If a franchise name is broad, **this is one of the most useful settings**.

### `franchise_start` / `franchise_end`

Limit the source range used to construct events.

```text
franchise_start: Season 2
franchise_end: Season 5 finale
```

or:

```text
franchise_start: Chunin Exams arc
franchise_end: Sasuke Retrieval arc
```

These are source-material boundaries, not adventure action numbers.

### `franchise_route`

Adds a focus or route instruction.

```text
franchise_route: main anime canon, skip filler
```

```text
franchise_route: Geralt main quest only
```

```text
franchise_route: Buffy-focused television canon
```

### `franchise_event_count`

Maximum roadmap size.

```text
franchise_event_count: 24
```

Allowed range: **1–80**.

A smaller number creates a broad backbone. A larger number creates a more granular timeline.

### `franchise_batch_size`

How many new events the hidden planner may create in one normal model response.

```text
franchise_batch_size: 6
```

Allowed range: **1–10**.

### `franchise_pacing`

Controls the default action spacing between generated events:

```text
franchise_pacing: compressed
```

≈ 1–4 actions between major beats.

```text
franchise_pacing: normal
```

≈ 3–8 actions.

```text
franchise_pacing: slow
```

≈ 6–14 actions.

Generated events use **relative timelines**, so one delayed scene does not throw the entire franchise schedule out of alignment.

### `franchise_first_event_at`

Earliest action for the first generated canon beat.

```text
franchise_first_event_at: 4
```

### `franchise_enforcement`

Enforcement mode placed on generated cards:

```text
franchise_enforcement: soft
```

```text
franchise_enforcement: strong
```

```text
franchise_enforcement: force
```

`strong` is the default and is recommended for most adaptation scenarios.

### `franchise_deadline_policy`

What happens if the player does not naturally reach the expected setup in time.

```text
franchise_deadline_policy: force
```

With `force`, the event may waive current-scene trigger requirements once overdue while still respecting dependencies, route ownership, contradictions and other hard state.

### `franchise_confidence_floor`

Reject low-confidence events returned by the planner.

```text
franchise_confidence_floor: 0.55
```

The planner is explicitly instructed **not to invent events just to fill the quota**. If it is genuinely unsure which canon you meant, it can mark the build as uncertain instead.

### `franchise_materialize_cards`

```text
franchise_materialize_cards: true
```

Generated events become actual editable `Canon Event` Story Cards.

This is the recommended mode.

### `franchise_cleanup_old`

If you change the franchise/continuity, automatically remove cards previously generated by the Franchise Auto-Builder.

```text
franchise_cleanup_old: true
```

Hand-authored Canon Event cards are not touched.

### `franchise_source_cards`

Allows optional creator-written Story Cards of type:

```text
Canon Source
```

or:

```text
Franchise Source
```

to be included in the hidden planner instruction.

A source card is **optional**. The franchise name alone can work.

But source cards are extremely useful for:

- obscure franchises
- fan continuities
- very recent material
- alternate adaptations
- exact episode lists
- creator-specific definitions of canon

Creator source cards are explicitly treated as stronger guidance than uncertain model memory.

---

## Example: one config, automatic roadmap

```text
franchise: Buffy the Vampire Slayer
franchise_canon: TV series
franchise_start: Season 1
franchise_end: Season 3 finale
franchise_event_count: 20
franchise_route: major Buffy-focused canon events
```

The builder might turn that into editable cards conceptually like:

```text
@CANON
id: fr_buffy_the_vampire_slayer_early_major_beat
created_by: franchise
after: previous_generated_event
relative_window: 3-8
deadline_policy: force
mode: strong
complete: observable canon outcome | alternate proof
---
A compact world-side description of the canon beat.
```

The actual events come from the selected AI model's knowledge and any supplied Canon Source cards; they are **not hard-coded into CANON WEAVE**.

---

## Generated roadmap safety

Auto-generated events get several protections automatically:

- IDs are prefixed with the franchise.
- Generated events are chained in source order.
- `strict_order: true` prevents later generated events jumping ahead.
- Each event gets a dependency-relative timing window.
- Completion defaults to strict detection.
- Low-confidence planner events are rejected.
- Duplicate IDs/titles are rejected.
- Old build sets are disabled immediately if the franchise configuration changes.
- Optional cleanup removes obsolete generated Story Cards.
- Planner JSON is stripped from visible output.
- A planner block is never requested while a real Canon Event is active.
- Retry at the same action cannot multiply the same generated batch.
- The builder pauses after repeated malformed/missing planner responses rather than hammering every story turn forever.

---

## Franchise commands

```text
/canon franchise status
```

Shows franchise, build set, status, generated count, batches and failures.

```text
/canon franchise pause
```

Stops background roadmap generation without deleting generated events.

```text
/canon franchise resume
```

Resumes building.

```text
/canon franchise rebuild
```

Removes the old auto-generated roadmap and starts a fresh build using the current config.

Useful after changing:

- continuity
- source boundary
- route
- event count
- source cards

```text
/canon franchise clear
```

Removes generated franchise cards and pauses rebuilding.

Hand-written Canon Event cards remain intact.

---

## Important accuracy note

CANON WEAVE's JavaScript sandbox cannot independently browse a wiki or call a separate AI generation endpoint. The Franchise Auto-Builder therefore uses the **same normal AI Dungeon model generation** as a background planning channel, captures its structured plan in the Output hook, strips that control block, and materializes validated events with the scripting Story Card API.

That means accuracy depends on:

- the model selected in AI Dungeon
- how well that model knows the franchise
- how ambiguous the franchise name is
- whether you specify `franchise_canon`
- whether you give it Canon Source cards

For a famous franchise, a name may be enough.

For exact episode-level fidelity, give the builder a continuity/range and optionally a compact source card.

---

# 📥 Installation

AI Dungeon scenarios expose four script tabs. Copy the files into the matching tabs:

| File | AI Dungeon tab |
|---|---|
| `1-Library.js` | Library |
| `2-Input.js` | Input |
| `3-Context.js` | Context |
| `4-Output.js` | Output |

The Input, Context and Output files already end in `modifier(text)`.

You can also import `Example_Story_Cards.json` from the **web** Scenario/Adventure editor. Back up your existing cards first: AI Dungeon Story Card import replaces the current set.

---

# 🚀 Five-minute setup

Create an ordinary Location card:

```text
Type: Location
Triggers: academy, school grounds
Entry: The Academy is a fortified training school with examination halls, dormitories and a secured arena.
```

Then create a special control card:

```text
Type: Canon Event
Triggers: %CW:selection_exam%
```

Put this in its **Entry**:

```text
@CANON
id: selection_exam
title: Selection Exam
at: 8
when: academy | exam hall
include: key:academy
mode: strong
complete: selection exam begins | first test begins
set: exam_started
---
The official Selection Exam begins. Preserve the rules and relationships already established in the adventure.
```

`%CW:selection_exam%` is intentionally unnatural so AI Dungeon's ordinary Story Card trigger system should not activate the control card by accident. CANON WEAVE reads the card directly.

---

# 🧱 How a Canon Event is built

A Canon Event has two parts:

```text
@CANON
metadata: values
more_metadata: values
---
The actual canon instruction goes here.
```

Everything above `---` is parsed by the script. Everything below it describes the canon beat to the model when the event becomes active.

For maximum scripting compatibility, keep control metadata in the **Entry**. AI Dungeon's documented scripting Story Card object guarantees `id`, `keys`, `entry`, and `type`; the user-facing Name/Notes fields are not required by CANON WEAVE.

---

# 🗓️ Timeline controls

### Absolute timing

```text
at: 20
before: 35
```

The event cannot activate before action 20. `before:` is its intended deadline.

Shortcut:

```text
window: 20-35
```

### Resolved dependencies

For adaptive stories, a prerequisite can be allowed to resolve without pretending it happened:

```text
after_resolved: destroyed_city_attack
```

This accepts completed, missed, or cancelled prerequisites. Pair it with:

```text
blocked_policy: skip
```

when a permanent contradiction should retire the impossible beat instead of freezing the arc. For ordered arcs:

```text
strict_order: true
strict_order_resolved: true
```

lets later ordered events advance past legitimate skips/cancellations.

## Relative timing

This is much better for adaptations where players may spend extra time in side scenes.

```text
after: entrance_exam
relative_window: 3-7
```

The event becomes eligible three actions after `entrance_exam` completes and becomes overdue seven actions after it.

Equivalent long form:

```text
after_delay: 3
after_before: 7
```

Absolute and relative limits can be combined. CANON WEAVE uses the stricter legal window.

### Deadline policy

```text
deadline_policy: catchup
```

- `catchup` — event may happen late but still waits for normal scene anchors.
- `skip` — event is marked missed if its deadline passes.
- `force` — after the deadline, current-scene `when` anchors may be waived so the story can bridge toward the required beat.

Hard dependencies, route flags and contradictions are **not** waived by deadline forcing.

---

# 🔗 Event graph

```text
after: event_a, event_b
after_any: route_a, route_b
after_not: bad_ending
```

- `after:` requires **all** listed events.
- `after_any:` requires at least one.
- `after_not:` blocks the event if any listed event already completed.

For ordered arcs:

```text
arc: tournament_arc
order: 3
strict_order: true
```

A strict event cannot run while a lower-numbered event in the same arc remains unfinished.

---

# 🔎 Story conditions

### Current scene

```text
when: arena | tournament hall
when_all: rival, referee
```

`when:` means **ANY** listed alternative. `when_all:` means every listed phrase must be present.

For more expressive logic:

```text
when_clauses: arena | stadium; rival | challenger; referee | judge
```

Semicolons separate required groups. Pipes are alternatives inside a group:

```text
(arena OR stadium)
AND (rival OR challenger)
AND (referee OR judge)
```

### Remembered evidence

```text
require: invitation, mentor
require_any: keycard | secret passage
require_within: 20
```

Use `require_clauses:` for grouped alternatives in remembered evidence.

### Blockers

```text
unless: city destroyed | rival already dead
scene_unless: police | teacher
```

`unless:` is remembered as a contradiction. `scene_unless:` only blocks while the phrase is in the recent scene.

Completion and blocker detection default to `strict` matching to reduce accidental canon state changes.

---

# 🎯 Matching modes

```text
match: strict
complete_match: strict
blocker_match: strict
```

Available modes:

- `strict` — boundary-aware phrase matching.
- `balanced` — phrase matching first, then conservative content-token coverage.
- `loose` — more tolerant token coverage.

Prefix a term with `=` to force strict phrase matching even inside a looser event:

```text
require: =Masked Stranger
```

Advanced creators can use `/regular expression/` terms.

Negation awareness is enabled by default. It specifically helps prevent dangerous matches such as `villain dead` being accepted from wording that says the villain is **not** dead.

---

# 🧑‍🚀 Character Creator choices

AI Dungeon exposes scenario placeholder answers through `state.placeholders`. CANON WEAVE can use them directly.

```text
placeholder: Choose route=Hero Course
placeholder_any: Origin=Mutant | Origin=Alien
placeholder_not: Faction=Villain League
```

This makes it possible to use one scenario script for multiple canon routes without hard-coding every player into the same storyline.

---

# 🌿 Flags, branches and cancellation

```text
flags: knows_secret
not_flags: betrayed_guard
set: act_two, rival_respected
clear: act_one
group: finale_route
cancel: bad_ending, escape_route
```

A `group:` is mutually exclusive. Once one event in the group completes, other events in that group are suppressed.

---

# 📚 Loading supporting Story Cards

### Explicit loading

```text
include: key:Main Rival, key:Tournament Arena, id:123
```

Stable selectors:

- `key:Trigger Text`
- `trigger:Trigger Text`
- `id:123`
- `type:Location`

A plain value is also accepted and can match an exact trigger, numeric id, or exposed title when the runtime provides it.

### Automatic loading

```text
auto_include: true
include_types: Character, Location, Lore
exclude: key:Wrong Rival
exclude_types: Random Event
```

Auto-selection ranks normal cards against the canon event and current scene. Exact trigger relevance carries much more weight than generic entry overlap.

Use `exclude:` whenever a similarly named or generic card is a known bad match.

---

# 🌒 Foreshadowing and bridging

```text
lead: 4
seed: Let officials quietly prepare the arena and mention that brackets will be posted soon.
bridge: Use the official tournament bracket to bring the current scene naturally toward the rival match.
```

`lead:` starts setup before the event's activation point. `seed:` should prepare without spoiling or prematurely resolving the event.

`bridge:` tells the model how to connect a divergent player route back into the required beat.

---

# 🔒 Enforcement modes

### Soft

```text
mode: soft
```

One contextual nudge. Best for flexible beats.

### Strong

```text
mode: strong
retries: 4
max_cycles: 3
retry_delay: 2
```

The beat stays active until completion proof appears. If a retry burst fails, it backs off briefly and can re-arm.

### Force

```text
mode: force
retries: 3
fallback: The referee steps between the fighters and officially ends the duel.
```

Force mode is for events that genuinely must not vanish. If the model repeatedly ignores a mandatory event, CANON WEAVE can append the short creator-authored `fallback:`.

Keep fallbacks factual and compact. They are a last resort, not a replacement for good event design.

---

# ✅ Completion proof

### Any one result

```text
complete: duel ends | referee declares the winner
```

### Every result

```text
complete_all: alarm rings, gates close
complete_within: 3
```

### Alternative groups

```text
complete_clauses: alarm rings | siren sounds; gates close | doors seal
complete_within: 4
```

This means one result from the first group **and** one from the second must be observed inside the configured action window.

### Prevent false completion

```text
complete_unless: it was only a dream | false alarm
```

### Partial progress

```text
progress: rival enters the arena | referee explains the rules | crowd falls silent
```

Progress is tracked separately from final completion.

---

# ↩️ Undo and Retry safety

Canon control is stateful, so rewinds matter.

CANON WEAVE uses AI Dungeon's documented `info.actionCount` as its main timeline instead of inventing a separate counter. This has two major advantages:

1. **Retrying an AI response at the same action count does not fast-forward the canon timeline.**
2. **Undoing to an earlier action can remove newer CANON WEAVE completions, flags and cancellations.**

If you upgrade an already-running adventure from an older CANON WEAVE build, the pre-upgrade state becomes a baseline. New changes are rewind-aware from that point forward; state from before the upgrade cannot be perfectly reconstructed by the script.

---

# ⚙️ Configuration Story Card

Create:

```text
Type: Canon Config
Triggers: %CW:CONFIG%
```

Entry:

```text
@CANON_CONFIG
enabled: true
scene_actions: 10
evidence_turns: 120
default_match: balanced
completion_match: strict
blocker_match: strict
fuzzy_threshold: 0.72
negation_aware: true
negation_window: 42
global_cooldown: 0
allow_catch_up: true
default_deadline_policy: catchup
default_mode: strong
default_retries: 4
strong_cycles: 3
retry_delay: 2
force_max_attempts: 10
max_include_cards: 8
auto_include: true
auto_include_cards: 3
auto_include_min_score: 5
auto_include_diversity: true
max_inject_chars: 7600
max_card_chars: 1800
preserve_player_agency: true
preserve_established_facts: true
foreshadow: true
foreshadow_lead: 4
max_foreshadow_events: 2
validate_graph: true
dashboard: false
dashboard_every: 3
debug: false
---
```

The supplied example JSON puts the longer explanations in the Config card's **Notes** so the Entry stays compact.

---

# 🧪 Full event example

```text
@CANON
id: rival_duel
title: Official Rival Duel

after: selection_exam
relative_window: 3-8
deadline_policy: force

placeholder: Choose route=Hero Course
require: rival
when_clauses: arena | stadium; referee | tournament official
unless: rival is dead

include: key:Main Rival, key:Tournament Arena
exclude: key:Rival Fan Club
auto_include: true
include_types: Character, Location, Lore

lead: 3
seed: Let tournament officials prepare the bracket and build anticipation around the rival matchup.
bridge: Use the official bracket or referee to bring the current route naturally into the match.

priority: 85
mode: force
retries: 3

progress: rival enters the arena | referee begins the match
complete_clauses: referee declares the winner | official result is announced; duel is over | match ends
complete_within: 4
complete_unless: exhibition only | dream sequence

protect: established abilities, established relationship
forbid: unexplained power changes | forced player surrender
fallback: The referee steps between the fighters and announces the official result. The sanctioned duel is over.

set: rival_duel_finished
arc: exam_arc
order: 2
strict_order: true
---
The protagonist and the Main Rival reach their canon official tournament duel. Preserve established abilities, injuries, promises and relationship changes. The official match and result are required canon, but the player's unchosen thoughts, dialogue and decisions remain open.
```

---

# 🩺 Creator commands

Commands are handled in the Input hook with `stop: true`, so they are not sent to the model as story text.

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
/canon flag NAME=false
/canon doctor
```

`/canon why` is especially useful while building a large timeline because it tells you the current blocking condition for an event.

---

# 📊 Optional dashboard

Create a Story Card:

```text
Type: Canon Dashboard
Triggers: %CW:DASHBOARD%
Entry: @CANON_DASHBOARD
```

Then enable:

```text
dashboard: true
```

The engine can update the card with the current action, active event, completed/missed/stalled counts, route flags and upcoming beats.

---

# 🧠 Design tips

**Use dependencies more than giant absolute turn numbers.** Source-material stories feel much more natural when `event_b` is “3–7 actions after event_a” instead of “always action 42”.

**Keep completion proof concrete.** “The relationship changes” is vague. “She admits the truth” or “the referee declares the winner” is much safer.

**Use strict matching for irreversible state.** Completion, death, betrayal, route ownership and permanent contradictions should be difficult to trigger accidentally.

**Give mandatory events a bridge.** If the player can wander, tell the engine how the world can plausibly bring the canon beat to them.

**Do not overuse force mode.** A scenario full of forced beats stops feeling interactive. Use it for the small number of moments the source timeline genuinely depends on.

**Prefer exact Story Card trigger selectors.** `key:Akira` is more reliable in scripts than depending on a user-facing card name that the scripting API may not expose.

---

# 🧪 Validation & tests

The repository includes two local Node test files:

```bash
node tests/mock_runtime.test.js
node tests/package_sanity.test.js
```

`mock_runtime.test.js` exercises activation, completion, flags, Retry/Undo rollback, relative scheduling, clause matching, negation, Franchise Auto-Builder materialization, ambiguity handling, source-required mode, resolved dependencies, deadline grace, roadmap generation and hidden planner quarantine.

`package_sanity.test.js` parses every shipped JSON artifact, verifies the Config Entry remains within AI Dungeon's 2000-character Story Card Entry target used by this project, and verifies that every Config key in the Entry is explained in the Notes section.

The tests are a local simulation of the documented scripting objects/functions, not a replacement for AI Dungeon's own Script Test panel. Always run a real scenario smoke test before publishing.

---

# ⚠️ Limits

CANON WEAVE is deterministic JavaScript, not a second language model. It cannot understand every possible paraphrase, infer arbitrary hidden meaning, or independently reconstruct an entire anime episode from nothing.

It works best when you give it:

- concrete event dependencies,
- several sensible trigger/completion alternatives,
- exact support-card selectors,
- strict proof for irreversible outcomes,
- and short bridge/fallback instructions for mandatory beats.

The script also shares AI Dungeon's scripting sandbox limits, so state and context growth are deliberately bounded.

---

# 🗂️ Repository layout

```text
CANON_WEAVE/
├── 1-Library.js
├── 2-Input.js
├── 3-Context.js
├── 4-Output.js
├── README.md
├── QUICKSTART.md
├── CHANGELOG.md
├── CARD_TEMPLATE.txt
├── FRANCHISE_CONFIG_EXAMPLE.txt
├── CANON_CONFIG_Story_Card.json
├── CANON_DASHBOARD_Story_Card.json
├── CANON_SOURCE_TEMPLATE.json
├── Example_Story_Cards.json
├── docs/
│   ├── CONFIG_REFERENCE.md
│   ├── EVENT_REFERENCE.md
│   ├── FRANCHISE_MODE.md
│   ├── RECIPES.md
│   └── TROUBLESHOOTING.md
└── tests/
    ├── mock_runtime.test.js
    └── package_sanity.test.js
```

---

# 🤝 Contributing

Bug reports and reproducible Story Card examples are especially useful. If an event fires too early, never fires, loads the wrong support card, or behaves badly after Retry/Undo, include:

- the Canon Event Entry,
- the relevant normal Story Cards,
- the recent story text,
- the expected event state,
- and the Script Test console output with `debug: true` if possible.

That makes detection and scheduler problems much easier to reproduce without weakening the matcher globally.

---

**CANON WEAVE is built for scenarios where “canon” should be a backbone, not a cage.**
