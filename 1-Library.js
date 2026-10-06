/*
 * CANON WEAVE
 * Canon-event, continuity, branching and timeline engine for AI Dungeon.
 *
 * Core philosophy:
 *   Story Cards hold canon knowledge.
 *   Canon Event cards decide WHEN that knowledge becomes plot-active.
 *   The engine never needs an external API or a second model.
 *
 * Runtime constraints respected:
 * - deterministic JavaScript only
 * - bounded state growth
 * - bounded context injection
 * - undo/retry-aware action clock
 * - high-precision completion/blocker matching
 * - no empty story output except documented stopped maintenance commands
 * - every hook fails open instead of breaking the adventure
 * - Story Card writes use ONLY AI Dungeon's documented scripting fields/API
 *   (keys, entry, type). Runtime code never writes Title, Notes/description,
 *   or Character Creator UI fields, so user-owned Notes remain editable.
 */

var CW_SCHEMA = 10;

var CW_DEFAULTS = {
  enabled: true,

  /* Scene / evidence */
  sceneActions: 10,
  evidenceTurns: 120,
  maxEvidenceKeys: 650,
  defaultMatch: "balanced",      /* strict | balanced | loose */
  completionMatch: "strict",    /* high precision for canon completion */
  blockerMatch: "strict",       /* high precision for contradictions */
  fuzzyThreshold: 0.72,
  negationAware: true,
  negationWindow: 42,

  /* Usability / scheduler */
  preset: "balanced",            /* balanced | strict | player_first | cinematic | source_locked | minimal */
  fairScheduler: true,
  starvationTurns: 8,
  starvationBoost: 1800,
  allowPreemption: true,
  preemptPriorityGap: 25,

  /* Timeline */
  globalCooldown: 0,
  allowCatchUp: true,
  defaultDeadlinePolicy: "catchup", /* catchup | skip | force */
  forceDeadlineGrace: 2,

  /* Enforcement */
  defaultMode: "strong",        /* soft | strong | force */
  defaultRetries: 4,
  strongCycles: 3,
  retryDelay: 2,
  forceMaxAttempts: 10,

  /* Context */
  maxIncludeCards: 8,
  autoInclude: true,
  autoIncludeCards: 3,
  autoIncludeMinScore: 5,
  autoIncludeDiversity: true,
  autoIncludeTypeCap: 2,
  autoIncludeDedupe: true,
  smartCardExtract: true,
  smartCardSentences: 5,
  smartCardLeadChars: 260,
  maxInjectChars: 7600,
  adaptiveContextBudget: true,
  maxContextShare: 0.20,
  minHistoryChars: 5200,
  maxCardChars: 1800,
  preservePlayerAgency: true,
  preserveEstablishedFacts: true,

  /* Foreshadow / pacing */
  foreshadow: true,
  foreshadowLead: 4,
  maxForeshadowEvents: 2,

  /* Franchise auto-builder */
  franchise: "",
  franchiseCanon: "",
  franchiseStart: "",
  franchiseEnd: "",
  franchiseRoute: "",
  franchiseAutoGenerate: true,
  franchiseTargetEvents: 24,
  franchiseBatchSize: 5,
  franchiseBuildEvery: 2,
  franchiseMaxFailures: 5,
  franchiseMaterializeCards: true,
  franchiseCleanupOld: true,
  franchiseEnforcement: "strong",
  franchiseDeadlinePolicy: "force",
  franchisePacing: "normal",
  franchiseFirstEventAt: 4,
  franchiseAutoInclude: true,
  franchiseConfidenceFloor: 0.60,
  franchiseSourceCards: true,
  franchiseSourceChars: 3200,
  franchiseScope: "",
  franchiseFiller: "exclude",          /* exclude | include | only */
  franchiseGranularity: "major",       /* anchors | major | detailed */
  franchiseEventPolicy: "tiered",      /* tiered | uniform */
  franchiseAnchorThreshold: 4,
  franchiseRequireSourceRef: false,
  franchiseRoadmapCard: true,
  franchiseRoadmapMaxChars: 1900,
  franchisePlannerHistory: 18,
  franchiseGeneratedProtect: true,
  franchiseGeneratedBlockers: true,
  franchiseSourceMode: "prefer",       /* ignore | prefer | require */
  franchiseDependencyStrategy: "backbone", /* backbone | linear */
  franchiseDivergence: "adaptive",    /* strict | adaptive | reactive */
  franchisePlayerRole: "original_character", /* original_character | canon_protagonist | replacement | observer */
  franchisePlannerMaxChars: 6800,
  franchisePlannerNonce: true,
  franchiseSourceFilterStrict: true,
  franchiseRebuildOnSourceChange: false,
  franchiseBuildMode: "steady",      /* steady | frontload | manual */
  franchiseDeliveryPolicy: "adaptive", /* adaptive | scene | world | offscreen */
  franchiseOutcomePolicy: "adaptive",  /* adaptive | fixed | flexible | opportunity */

  /* Validation / UI */
  validateGraph: true,
  dashboard: false,
  dashboardEvery: 3,
  hookHealth: true,
  commandSafeMode: true,
  debug: false
};

/* ========================================================================
 * ZERO-CONFIG / FIRST-RUN INSTALLER
 * ====================================================================== */

/* AI Dungeon installs Scripts and Story Cards as separate scenario components.
 * Therefore adding CANON WEAVE from the Script UI cannot create editor-level
 * config cards until a scripting hook actually executes.  CANON WEAVE now
 * solves that gap by creating its own config cards on the first Adventure hook.
 *
 * The engine never requires these cards to exist: embedded defaults remain the
 * source of truth when Story Card writes are unavailable.  The cards are a UI
 * control panel, not a hard runtime dependency.
 *
 * IMPORTANT: the scripting API cannot safely write Story Card Notes/Title.
 * Auto-created cards therefore use only keys/entry/type. Optional import JSON
 * supplies polished Title/Notes without runtime mutation.
 */
var CW_SETUP_VERSION = 3;
/* `title` and `notes` below are PACKAGE METADATA used to build optional
 * import JSON/documentation. Runtime scripting deliberately ignores them. */
var CW_SETUP_MASTER = {
  keys: "%CW:CONFIG:MASTER%",
  entry: "@CANON_CONFIG\nconfig_priority:10\npreset:balanced\nenabled:true\ndefault_mode:strong\ndefault_deadline_policy:catchup\npreserve_player_agency:true\npreserve_established_facts:true\nforeshadow:true\nforeshadow_lead:4\nmax_foreshadow_events:2\nfranchise:\nfranchise_canon:\nfranchise_scope:main canon\nfranchise_start:\nfranchise_end:\nfranchise_route:\nfranchise_filler:exclude\nfranchise_granularity:major\nfranchise_auto_generate:true\nfranchise_event_count:24\nfranchise_pacing:normal\nfranchise_event_policy:tiered\nfranchise_enforcement:strong\nfranchise_deadline_policy:force\nfranchise_source_mode:prefer\nfranchise_dependency_strategy:backbone\nfranchise_divergence:adaptive\nfranchise_player_role:original_character\nfranchise_build_mode:steady\nfranchise_delivery_policy:adaptive\nfranchise_outcome_policy:adaptive\nfranchise_materialize_cards:true\nfranchise_roadmap_card:true\ndashboard:false\n---\nCANON WEAVE SAFE CONFIG: edit settings above. Runtime scripting never writes Story Card Notes/Title; those fields remain yours. For titled/documented cards, import CANON_CONFIG_Story_Cards.json in the web editor.",
  type: "Canon Config",
  title: "⚙️ CANON WEAVE — MASTER CONFIG",
  notes: "⚙️ CANON WEAVE — MASTER CONFIG\n\nCANON WEAVE now supports layered Config Story Cards. Both supplied cards use Type `Canon Config`, so they stay together in the same Story Card category. The friendly Master card contains the controls most people actually change; the Advanced card contains precision, performance and planner tuning. The script merges every Canon Config card by `config_priority`, then lets higher-priority cards override lower-priority values.\n\nYou can therefore create your own tiny override card instead of editing the long defaults:\n\n@CANON_CONFIG\nconfig_priority:100\nfranchise:Naruto\npreset:cinematic\n---\n\nThe Notes below explain EVERY setting used by both supplied config cards. Settings you omit simply use the selected preset/default.\n\n━━━━━━━━━━━━━━━━━━\n🎚️ PRESETS & CONFIG LAYERS\n━━━━━━━━━━━━━━━━━━\n• config_priority — Merge order for multiple Canon Config cards. Higher numbers override lower numbers. The supplied Master uses 10 and Advanced uses 20. Use 100+ for a personal override card. This is a config-card control, not a runtime story option.\n\n• preset — Starting profile applied before individual settings. `balanced` is the normal recommendation. `strict` favors exact detection and source accuracy. `player_first` softens enforcement and favors divergence. `cinematic` increases foreshadowing and flexible presentation. `source_locked` requires source-grounded franchise generation and stricter canon. `minimal` disables most automatic extras. Any setting explicitly written in a Config card overrides the preset.\n\n• fair_scheduler — Prevents a continuously eligible lower-priority event from being starved forever by a stream of slightly higher-priority events.\n\n• starvation_turns — How long an eligible event waits before fairness boosting begins. Default 8.\n\n• starvation_boost — Scheduler score added once starvation protection starts. Default 1800, roughly enough to matter without automatically beating a genuinely critical event.\n\n• allow_preemption — Lets a truly urgent Force/overdue event interrupt a lower-pressure active event. The interrupted event is re-armed instead of discarded.\n\n• preempt_priority_gap — Minimum priority difference normally required for Force preemption when the incoming event is not already overdue. Default 25.\n\n━━━━━━━━━━━━━━━━━━\n🧠 SMART SUPPORT EXTRACTION\n━━━━━━━━━━━━━━━━━━\n• smart_card_extract — When an automatically retrieved Story Card is very long, extract the most relevant sentences instead of blindly cutting the first N characters. Explicit `include:` cards remain full/authoritative.\n\n• smart_card_sentences — Maximum relevant sentences kept from an oversized automatically selected card. Default 5.\n\n• smart_card_lead_chars — Small beginning fragment kept with the extracted sentences so identity/definition text at the start of a card is not lost. Default 260.\n\n━━━━━━━━━━━━━━━━━━\n🎬 FRANCHISE HARDENING\n━━━━━━━━━━━━━━━━━━\n• franchise_planner_nonce — Adds a one-use nonce to hidden Franchise Auto-Builder blocks. The Output hook only accepts the matching machine block, making accidental tag-like story text far less likely to be parsed as planner data. Recommended true.\n\n• franchise_source_filter_strict — Structured `@CANON_SOURCE` cards can name `franchise:` and `continuity:`. When true, source cards for another continuity are excluded instead of being blended into the active roadmap.\n\n• franchise_rebuild_on_source_change — If true, changing matching Canon Source content can rebuild the auto-generated roadmap. Default false for safety: once a roadmap exists, changed source pauses the builder and asks you to rebuild manually rather than deleting live generated canon unexpectedly.\n\n• franchise_build_mode — `steady` builds at the configured interval; `frontload` tries every eligible generation until the roadmap is ready; `manual` builds only after `/canon franchise build`.\n\n• franchise_delivery_policy — Default presentation of generated franchise events. `adaptive` chooses per beat; `scene` prefers the current scene; `world` lets the event advance as a world event; `offscreen` allows canon to happen away from the player and arrive through consequences.\n\n• franchise_outcome_policy — Default generated-event outcome philosophy. `adaptive` chooses by importance/divergence policy; `fixed` protects the world-side source outcome; `flexible` preserves the beat/function but allows consequences to change; `opportunity` guarantees the canon pressure/opportunity while leaving the actual choice/outcome open.\n\n━━━━━━━━━━━━━━━━━━\n🧠 DETECTION & EVIDENCE\n━━━━━━━━━━━━━━━━━━\n• enabled — Master switch. `true` runs CANON WEAVE. `false` leaves the story untouched while preserving saved state.\n\n• scene_actions — Number of recent adventure actions treated as the current scene for `when:` / `scene_unless:` matching. Default `10`. Lower = more local and precise; higher = better for slow scenes. Recommended 6–14.\n\n• evidence_turns — How long ordinary remembered evidence is retained for `require:` checks. Default `120`. Permanent canon completion and permanent blocker state are tracked separately.\n\n• max_evidence_keys — Safety cap for remembered evidence phrases. Default `650`. Raise only for very large scenarios with many distinct Canon Event conditions.\n\n• default_match — Default matching mode for normal scene/evidence detection. `strict`, `balanced`, or `loose`. `balanced` is recommended.\n\n• completion_match — Default mode used to decide whether an event really finished. `strict` is recommended because false completion is worse than a delayed completion.\n\n• blocker_match — Default mode for permanent contradictions such as `unless:`. Keep `strict` unless you deliberately want broad blockers.\n\n• fuzzy_threshold — Token coverage needed by non-strict matching. Default `0.72`. Higher is more precise; lower is more tolerant. Balanced mode also applies its own conservative floor.\n\n• negation_aware — When `true`, common nearby negations are considered. Example: “the villain is not dead” should not satisfy `complete: villain dead`.\n\n• negation_window — Character window inspected before a matched phrase/token for negation. Default `42`. Increase cautiously; too large can make unrelated “not” words interfere.\n\n━━━━━━━━━━━━━━━━━━\n🗓️ TIMELINE & ENFORCEMENT\n━━━━━━━━━━━━━━━━━━\n• global_cooldown — Minimum completed-action gap between separate canon events. `0` disables the global delay.\n\n• allow_catch_up — Legacy/default behavior for events whose intended window has passed. `true` allows late beats unless an event explicitly uses another deadline policy.\n\n• default_deadline_policy — Default when an event passes `before:`. `catchup` keeps waiting for normal conditions, `skip` marks it missed, `force` can eventually waive scene-location cues and bridge the beat in.\n\n• force_deadline_grace — Extra actions after `before:` before a `force` deadline is allowed to ignore current-scene `when:` cues. Default `2`. This prevents an event becoming abruptly location-agnostic the instant it is one action late.\n\n• default_mode — Default enforcement mode. `soft` = one nudge; `strong` = retry cycles; `force` = strongest enforcement and optional fallback.\n\n• default_retries — Attempts in one strong/force burst before backoff/fallback logic. Default `4`.\n\n• strong_cycles — Number of strong-mode retry bursts before the event is marked missed. Default `3`.\n\n• retry_delay — Actions to wait before a failed strong event re-arms for another cycle. Default `2`.\n\n• force_max_attempts — Safety ceiling for force events with no successful completion/fallback. Prevents permanent loops. Default `10`.\n\n━━━━━━━━━━━━━━━━━━\n📚 CONTEXT & STORY CARD RETRIEVAL\n━━━━━━━━━━━━━━━━━━\n• max_include_cards — Absolute maximum supporting Story Cards injected beside one active Canon Event. Default `8`.\n\n• auto_include — Global switch for automatic supporting-card retrieval. Explicit `include:` references still work when this is false.\n\n• auto_include_cards — Maximum automatically selected Story Cards per active event. Default `3`.\n\n• auto_include_min_score — Relevance score required before an ordinary Story Card can be auto-selected. Higher reduces weak matches. Default `5`.\n\n• auto_include_diversity — If true, the first auto-selection pass prefers different Story Card types instead of returning three near-identical Character cards.\n\n• auto_include_type_cap — Maximum automatically selected cards of the same Type. Default `2`. Explicit `include:` references are not blocked by this cap.\n\n• auto_include_dedupe — Removes automatic support cards whose Entry text is effectively duplicated by another selected card. Useful when a large Story Card library contains aliases/copies.\n\n• max_inject_chars — Hard ceiling for the entire CANON WEAVE context block. Default `7600` characters. This is a ceiling, not a target.\n\n• adaptive_context_budget — Recommended `true`. CANON WEAVE scales its injection down using the current model's `info.maxChars`, instead of always consuming the hard ceiling.\n\n• max_context_share — Maximum share of the model context CANON WEAVE may try to occupy when adaptive budgeting is enabled. Default `0.20` (20%).\n\n• min_history_chars — History/context reserve used by adaptive budgeting. Default `5200`. The engine avoids growing its own block so large that too much useful adventure history has to be displaced.\n\n• max_card_chars — Per-support-card Entry cap. Default `1800`. Very long lore cards are trimmed before injection.\n\n• preserve_player_agency — Adds an explicit rule that canon may pressure the world/NPC side but must not choose the player's unattempted actions, dialogue, thoughts, loyalties, feelings or decisions.\n\n• preserve_established_facts — Tells the model to bridge toward canon instead of erasing legitimate story consequences just to imitate source material.\n\n━━━━━━━━━━━━━━━━━━\n🌒 FORESHADOWING\n━━━━━━━━━━━━━━━━━━\n• foreshadow — Master switch for future-event seeds when no canon event or franchise-planning task currently owns the context slot.\n\n• foreshadow_lead — Default number of actions before an event's `at:` time where seeding may begin. Default `4`.\n\n• max_foreshadow_events — Maximum future events seeded at once. Default `2`. Keep low so setup stays subtle.\n\n━━━━━━━━━━━━━━━━━━\n🎬 FRANCHISE — IDENTITY & RANGE\n━━━━━━━━━━━━━━━━━━\n• franchise — Franchise/property name. Blank disables automatic roadmap generation. Example `Naruto`, `Buffy the Vampire Slayer`, `Mass Effect`.\n\n• franchise_canon — Exact continuity/adaptation. Very important for reboots, remakes, film vs TV, game routes, manga vs anime, etc.\n\n• franchise_scope — Free-form instruction describing what kind of canon matters, e.g. `main canon and major character arcs` or `main quest only`.\n\n• franchise_start — Source boundary where generation should begin, e.g. `Season 2`, `Chunin Exams`, `Mass Effect 2 opening`.\n\n• franchise_end — Source boundary where generation should stop, e.g. `Season 5 finale` or `end of original game`.\n\n• franchise_route — Optional route/focus, e.g. `Paragon main route`, `Buffy-focused canon`, `main story, skip side quests`.\n\n• franchise_filler — `exclude`, `include`, or `only`. Default `exclude`. For anime, `exclude` tells the planner not to turn filler-only material into backbone canon.\n\n• franchise_granularity — `anchors`, `major`, or `detailed`. `anchors` keeps only plot backbone; `major` is recommended; `detailed` adds more intermediate beats.\n\n━━━━━━━━━━━━━━━━━━\n🏗️ FRANCHISE — GENERATION PIPELINE\n━━━━━━━━━━━━━━━━━━\n• franchise_auto_generate — Master Franchise Auto-Builder switch once `franchise:` is set.\n\n• franchise_event_count — Target number of generated Canon Events, 1–80. It is a target, not permission to invent filler. The planner may finish early if the selected source range has fewer worthwhile events.\n\n• franchise_batch_size — Events requested per hidden planning batch. Default `5`. Smaller batches are slower but usually easier for the model to keep chronological and valid.\n\n• franchise_build_every — Minimum action gap between hidden planning batches. Default `2`. Roadmap generation pauses automatically while a real Canon Event is active.\n\n• franchise_max_failures — Consecutive planner failures allowed before automatic generation pauses. Default `5`.\n\n• franchise_pacing — `compressed`, `normal`, or `slow`. Controls generated relative windows between beats; it does not alter prose length.\n\n• franchise_first_event_at — Earliest action for the first generated event. Default `4`, giving the adventure room to establish itself.\n\n• franchise_planner_max_chars — Hard cap for the hidden roadmap-planner instruction, including source material. Default `6800`. Keeps planning from dominating context.\n\n• franchise_planner_history — Number of recent generated event titles repeated to the planner as anti-duplication history. Default `18`.\n\n━━━━━━━━━━━━━━━━━━\n🪜 FRANCHISE — EVENT STRENGTH & STRUCTURE\n━━━━━━━━━━━━━━━━━━\n• franchise_event_policy — `tiered` or `uniform`. `tiered` is recommended: anchors stay firm, minor/conditional beats stay flexible. `uniform` applies one enforcement policy to everything.\n\n• franchise_anchor_threshold — Importance 1–5 at which a generated event is treated as a backbone anchor under tiered mode. Default `4`.\n\n• franchise_enforcement — Enforcement mode inherited by generated anchor/hard-canon events: `soft`, `strong`, or `force`. Default `strong`.\n\n• franchise_deadline_policy — Deadline behavior inherited by important generated events: `catchup`, `skip`, or `force`. Default `force`.\n\n• franchise_dependency_strategy — `backbone` or `linear`. **Backbone is recommended.** `backbone` prevents optional/minor generated events becoming hard gates for every later canon beat. Later anchors link to the previous anchor. `linear` chains every generated event to the one before it.\n\n• franchise_divergence — `strict`, `adaptive`, or `reactive`.\n  - `strict`: preserve the source backbone whenever logically possible; contradicted anchors wait rather than auto-skip.\n  - `adaptive`: recommended. Preserve backbone outcomes but allow genuinely contradicted generated beats to resolve as skipped so later anchors can adapt instead of deadlocking.\n  - `reactive`: player-created consequences take highest priority; non-anchor generated beats stay especially flexible.\n\n• franchise_player_role — How the player relates to the source protagonist:\n  - `original_character` (default): player is their own character; canon cast/world can carry source beats.\n  - `canon_protagonist`: player occupies the source protagonist role, but agency is still protected.\n  - `replacement`: player replaces the source protagonist's plot function.\n  - `observer`: canon can progress around the player without requiring them to perform protagonist actions.\n\n━━━━━━━━━━━━━━━━━━\n📖 FRANCHISE — SOURCE ACCURACY\n━━━━━━━━━━━━━━━━━━\n• franchise_source_cards — Enables reading Story Cards whose Type is `Canon Source`, `Franchise Source`, or `Source Canon` and passing their Entry to the hidden planner.\n\n• franchise_source_chars — Maximum source-card characters supplied to one planner batch. Default `3200`.\n\n• franchise_source_mode — `ignore`, `prefer`, or `require`.\n  - `ignore`: do not use Canon Source cards.\n  - `prefer`: default; use them when present, otherwise fall back to model knowledge.\n  - `require`: do not build a roadmap until at least one Canon Source card exists. Best for obscure franchises, recent canon, exact episode/chapter accuracy, or creator-controlled timelines.\n\n• franchise_confidence_floor — Reject planner events below this confidence value (0–1). Default `0.60`. Raising it trades coverage for caution.\n\n• franchise_require_source_ref — If true, every generated event must provide a source position such as episode/chapter/mission/arc. Very strict; can reject correct events when the model remembers the event but not its exact number.\n\n━━━━━━━━━━━━━━━━━━\n🧩 FRANCHISE — GENERATED CARD BEHAVIOR\n━━━━━━━━━━━━━━━━━━\n• franchise_auto_include — Lets generated Canon Events automatically retrieve relevant ordinary Story Cards.\n\n• franchise_materialize_cards — Recommended `true`. Generated roadmap events become real editable Canon Event Story Cards using AI Dungeon's `addStoryCard()` API. If false, CANON WEAVE keeps temporary virtual events in state instead.\n\n• franchise_cleanup_old — When the franchise/continuity identity changes or you rebuild, remove CANON WEAVE's old auto-generated franchise cards so different continuities do not mix.\n\n• franchise_generated_protect — Lets generated events carry `protect:` and `forbid:` continuity safeguards suggested by the planner.\n\n• franchise_generated_blockers — Lets generated events carry specific `unless:` contradiction signals. In adaptive/reactive divergence mode, those generated blockers can resolve an impossible beat instead of freezing the later backbone.\n\n• franchise_roadmap_card — Creates/updates a creator-facing `Canon Roadmap` Story Card showing build status, cursor and generated event titles.\n\n• franchise_roadmap_max_chars — Maximum Entry size of the Roadmap display card. Default `1900`.\n\n━━━━━━━━━━━━━━━━━━\n🩺 VALIDATION, DASHBOARD & LOGGING\n━━━━━━━━━━━━━━━━━━\n• validate_graph — Runs Canon Doctor validation when the event graph changes. Recommended `true`.\n\n• dashboard — Enables an optional live `Canon Dashboard` Story Card if one exists. Intended for creator testing, not normal lore retrieval.\n\n• dashboard_every — Minimum actions between dashboard refreshes. Default `3`.\n\n• debug — Prints detailed engine logs to AI Dungeon's creator Script Test/console. Keep false for normal play; enable while diagnosing a scenario.\n\n━━━━━━━━━━━━━━━━━━\n🎚️ RECOMMENDED PRESETS\n━━━━━━━━━━━━━━━━━━\n\nBALANCED / DEFAULT\nfranchise_event_policy:tiered\nfranchise_dependency_strategy:backbone\nfranchise_divergence:adaptive\nfranchise_enforcement:strong\nfranchise_deadline_policy:force\nfranchise_source_mode:prefer\nadaptive_context_budget:true\n\nSTRICT ADAPTATION\nfranchise_dependency_strategy:backbone\nfranchise_divergence:strict\nfranchise_enforcement:force\nfranchise_deadline_policy:force\nfranchise_confidence_floor:0.75\nfranchise_source_mode:require\nfranchise_require_source_ref:true\n\nPLAYER-FIRST ADAPTATION\nfranchise_dependency_strategy:backbone\nfranchise_divergence:reactive\nfranchise_enforcement:strong\nfranchise_deadline_policy:catchup\npreserve_player_agency:true\npreserve_established_facts:true\n\n━━━━━━━━━━━━━━━━━━\n🧵 IMPORTANT EVENT-CARD TOOLS\n━━━━━━━━━━━━━━━━━━\nThe options above configure the engine globally. Individual `Canon Event` cards can override behavior with metadata such as:\n\n`at`, `before`, `relative_window`, `after`, `after_any`, `after_resolved`, `after_not`, `deadline_policy`, `deadline_grace`, `blocked_policy`, `when`, `when_all`, `when_clauses`, `require`, `require_any`, `require_clauses`, `unless`, `scene_unless`, `flags`, `not_flags`, `set`, `clear`, `group`, `cancel`, `include`, `exclude`, `include_types`, `exclude_types`, `mode`, `retries`, `max_cycles`, `complete`, `complete_all`, `complete_clauses`, `complete_unless`, `progress`, `fallback`, `protect`, `forbid`, `lead`, `seed`, and `bridge`.\n\n`after_resolved:` means the dependency may be completed, missed, or cancelled. It is useful for adaptive canon where one impossible beat should not deadlock the entire later timeline.\n\n`blocked_policy:skip` marks an event missed when its permanent `unless:` contradiction is established. `blocked_policy:wait` keeps it blocked indefinitely until the contradiction is manually resolved/reset.\n\n`strict_order_resolved:true` lets a strict arc advance past prior events that were legitimately skipped/cancelled, not only completed ones.\n\n━━━━━━━━━━━━━━━━━━\n🧰 CREATOR COMMANDS\n━━━━━━━━━━━━━━━━━━\n/canon status\n/canon next\n/canon why EVENT_ID\n/canon fire EVENT_ID\n/canon complete EVENT_ID\n/canon skip EVENT_ID\n/canon reset EVENT_ID\n/canon reset all\n/canon flag NAME=true\n/canon flag NAME=false\n/canon doctor\n/canon franchise status\n/canon franchise roadmap\n/canon franchise pause\n/canon franchise resume\n/canon franchise rebuild\n/canon franchise clear\n\n━━━━━━━━━━━━━━━━━━\n⚠️ FRANCHISE ACCURACY NOTE\n━━━━━━━━━━━━━━━━━━\nThe JavaScript cannot browse a wiki or make a separate model call by itself. Franchise Auto-Builder uses the same AI generation pass that writes the story, captures a hidden structured roadmap block, validates it, then removes the block before it reaches the player.\n\nFor well-known canon, `franchise_source_mode:prefer` can be convenient. For obscure, very recent, disputed, branch-heavy or episode-exact canon, use creator-written Canon Source cards and `franchise_source_mode:require`. That is the most reliable mode because the planner is then grounded in source text you supplied rather than memory alone.\n\n\n━━━━━━━━━━━━━━━━━━\n🧩 EVENT-LEVEL CONTROLS ADDED\n━━━━━━━━━━━━━━━━━━\nThese are written on Canon Event cards rather than Config cards:\n\n• `when_min:N` — require N distinct `when:` alternatives in the current scene.\n• `complete_min:N` — require N distinct `complete:` alternatives; with `complete_within`, evidence can accumulate across nearby actions.\n• `delivery:adaptive|scene|world|offscreen` — controls whether the event must be shown locally or may progress as a world/offscreen beat.\n• `outcome:fixed|flexible|opportunity|adaptive` — separates preserving a canon situation from forcing a specific outcome.\n• `player_presence:required|optional|none` — says whether the player needs to be physically present, without ever authorizing the script to puppet the player's choices.\n\nFor franchise scenarios, these fields are generated automatically per event unless you override the franchise delivery/outcome policies.\n"
};
var CW_SETUP_ADVANCED = {
  keys: "%CW:CONFIG:ADVANCED%",
  entry: "@CANON_CONFIG\nconfig_priority:20\nscene_actions:10\nevidence_turns:120\nmax_evidence_keys:650\ndefault_match:balanced\ncompletion_match:strict\nblocker_match:strict\nfuzzy_threshold:0.72\nnegation_aware:true\nnegation_window:42\nfair_scheduler:true\nstarvation_turns:8\nstarvation_boost:1800\nallow_preemption:true\npreempt_priority_gap:25\nglobal_cooldown:0\nallow_catch_up:true\nforce_deadline_grace:2\ndefault_retries:4\nstrong_cycles:3\nretry_delay:2\nforce_max_attempts:10\nmax_include_cards:8\nauto_include:true\nauto_include_cards:3\nauto_include_min_score:5\nauto_include_diversity:true\nauto_include_type_cap:2\nauto_include_dedupe:true\nsmart_card_extract:true\nsmart_card_sentences:5\nsmart_card_lead_chars:260\nmax_inject_chars:7600\nadaptive_context_budget:true\nmax_context_share:0.20\nmin_history_chars:5200\nmax_card_chars:1800\nfranchise_batch_size:5\nfranchise_build_every:2\nfranchise_max_failures:5\nfranchise_first_event_at:4\nfranchise_anchor_threshold:4\nfranchise_auto_include:true\nfranchise_confidence_floor:0.60\nfranchise_require_source_ref:false\nfranchise_cleanup_old:true\nfranchise_source_cards:true\nfranchise_source_chars:3200\nfranchise_roadmap_max_chars:1900\nfranchise_planner_history:18\nfranchise_generated_protect:true\nfranchise_generated_blockers:true\nfranchise_planner_max_chars:6800\nfranchise_planner_nonce:true\nfranchise_source_filter_strict:true\nfranchise_rebuild_on_source_change:false\nvalidate_graph:true\ndashboard_every:3\nhook_health:true\ncommand_safe_mode:true\ndebug:false\n---\nCANON WEAVE SAFE ADVANCED CONFIG: edit values above. This runtime-created card intentionally leaves Notes/Title untouched.",
  type: "Canon Config",
  title: "🛠️ CANON WEAVE — ADVANCED CONFIG",
  notes: "🛠️ CANON WEAVE — ADVANCED CONFIG\n\nThis card contains precision, scheduler, context-budget and Franchise Auto-Builder tuning. It is intentionally the same Type (`Canon Config`) as the Master card. CANON WEAVE merges both automatically using `config_priority`.\n\nThe Master Config Notes contain the complete explanation of every option in both cards. Most users should leave this card alone unless they are tuning detection, context use, planner accuracy or large Story Card libraries.\n\nTip: instead of editing this card, create a third Canon Config card with `config_priority:100` and only the values you want to override."
};

/* Common words removed from fuzzy token coverage. Keeping this conservative
 * makes names, places and concrete nouns carry more weight than grammar. */
var CW_STOPWORDS = {
  "a":1,"an":1,"the":1,"and":1,"or":1,"but":1,"if":1,"then":1,"than":1,
  "to":1,"of":1,"in":1,"on":1,"at":1,"by":1,"for":1,"from":1,"with":1,
  "into":1,"onto":1,"over":1,"under":1,"up":1,"down":1,"out":1,"off":1,
  "is":1,"am":1,"are":1,"was":1,"were":1,"be":1,"been":1,"being":1,
  "do":1,"does":1,"did":1,"done":1,"have":1,"has":1,"had":1,
  "this":1,"that":1,"these":1,"those":1,"it":1,"its":1,"as":1,
  "you":1,"your":1,"yours":1,"he":1,"his":1,"him":1,"she":1,"her":1,
  "hers":1,"they":1,"their":1,"them":1,"we":1,"our":1,"us":1,
  "i":1,"me":1,"my":1,"mine":1,"who":1,"what":1,"when":1,"where":1,
  "why":1,"how":1,"can":1,"could":1,"would":1,"should":1,"will":1,
  "may":1,"might":1,"must":1,"just":1,"very":1,"really":1,"still":1,
  "already":1,"again":1,"also":1,"only":1,"even":1,"some":1,"any":1
};

/* ========================================================================
 * PUBLIC ENTRY
 * ====================================================================== */

function CanonWeave(hook, text) {
  var original = (typeof text === "string") ? text : "";

  try {
    var s = CW_state();
    CW_migrateState(s);
    CW_markHookSeen(hook);

    /* Story Card creation is kept out of Output.  Input/Context are sufficient
       for first-run setup and this avoids mutating the card collection while an
       output is being finalized. */
    if (hook === "input" || hook === "context") CW_bootstrapConfigCards(false);

    var parsed = CW_parseAllCards();
    var cfg = CW_buildConfig(parsed.config);

    CW_applyFranchiseConfig(parsed, cfg);
    CW_filterGeneratedEvents(parsed, cfg);
    CW_pruneState(cfg);

    if (!cfg.enabled || s.enabled === false) {
      return { text: original, stop: false };
    }

    if (cfg.validateGraph) {
      CW_validateIfChanged(parsed, cfg);
    }

    if (hook === "input") return CW_onInput(original, parsed, cfg);
    if (hook === "context") return CW_onContext(original, parsed, cfg);
    if (hook === "output") return CW_onOutput(original, parsed, cfg);

    return { text: original, stop: false };
  } catch (err) {
    try { CW_markHookError(hook, err); } catch (ignoreHookError) {}
    CW_log("FATAL " + hook + ": " + CW_errorText(err), true);
    /* Never return null/empty text from a failed hook.  AI Dungeon documents
       empty Input/Output text as a scenario-script error. */
    return { text: original || " ", stop: false };
  }
}

/* ========================================================================
 * HOOK HEALTH / RUNTIME COMPATIBILITY
 * ====================================================================== */

function CW_markHookSeen(hook) {
  var s = CW_state();
  s.hooksSeen = s.hooksSeen || { input:0, context:0, output:0 };
  s.hookErrors = s.hookErrors || { input:0, context:0, output:0 };
  hook = CW_norm(hook || "");
  if (hook === "input" || hook === "context" || hook === "output") {
    s.hooksSeen[hook] = (s.hooksSeen[hook] || 0) + 1;
    s.lastHook = hook;
    try {
      s.lastHookAction = (typeof info !== "undefined" && info && typeof info.actionCount === "number") ? info.actionCount : s.turn;
    } catch (ignore) { s.lastHookAction = s.turn; }
  }
}

function CW_markHookError(hook, err) {
  var s = CW_state();
  s.hookErrors = s.hookErrors || { input:0, context:0, output:0 };
  hook = CW_norm(hook || "");
  if (hook === "input" || hook === "context" || hook === "output") {
    s.hookErrors[hook] = (s.hookErrors[hook] || 0) + 1;
  }
  CW_log("HOOK ERROR " + hook + ": " + CW_errorText(err), true);
}

function CW_hookHealthText() {
  var s = CW_state();
  var h = s.hooksSeen || {};
  var e = s.hookErrors || {};
  return "Canon Weave hooks | Input: " + (h.input || 0) + " runs / " + (e.input || 0) + " errors" +
    " | Context: " + (h.context || 0) + " runs / " + (e.context || 0) + " errors" +
    " | Output: " + (h.output || 0) + " runs / " + (e.output || 0) + " errors" +
    " | Last: " + (s.lastHook || "none") + " @ action " + (typeof s.lastHookAction === "number" ? s.lastHookAction : "?");
}

/* ========================================================================
 * HOOKS
 * ====================================================================== */

function CW_onInput(text, parsed, cfg) {
  var s = CW_state();
  CW_syncActionClock(parsed.events);
  s.lastInput = text || "";

  var cmd = CW_parseCommand(text);
  if (cmd) {
    CW_applyCommand(cmd, parsed, cfg);

    /* AI Dungeon's current docs warn that stop:true in onInput throws
       "Unable to run scenario scripts".  Do not use stop for maintenance
       commands.  A short, non-empty neutral line keeps the hook valid and tells
       the model not to treat the command as player intent. */
    s.commandHandledTurn = s.turn;
    s.commandHandledText = String(text || "");
    return {
      text: "[Canon Weave maintenance command processed. Do not treat this line as player dialogue, choice, movement, or elapsed story time. Continue the existing scene without changing canon because of this line.]",
      stop: false
    };
  }

  CW_observeText(parsed.events, text, "input", cfg);
  return { text: text, stop: false };
}

function CW_onContext(text, parsed, cfg) {
  var s = CW_state();

  CW_syncActionClock(parsed.events);
  CW_pruneState(cfg);
  CW_observeText(parsed.events, CW_recentSceneText(cfg.sceneActions), "scene", cfg);
  CW_observeText(parsed.events, s.lastInput || "", "input", cfg);
  CW_reconcileEvents(parsed.events);
  cfg.effectiveInjectChars = CW_effectiveInjectBudget(cfg);

  var active = s.activeId ? CW_findEvent(parsed.events, s.activeId) : null;
  if (active) CW_applyEventDefaults(active, cfg);

  if (active && cfg.allowPreemption) {
    var preemptor = CW_selectPreemptor(parsed.events, active, cfg);
    if (preemptor) {
      CW_preemptActive(active, preemptor, cfg);
      active = preemptor;
    }
  }

  if (!active) {
    active = CW_selectEvent(parsed.events, cfg);
    if (active) CW_activate(active, cfg);
  }

  var blocks = [];

  if (active) {
    blocks.push(CW_buildActiveInjection(active, parsed.cards, cfg));
  } else {
    var franchisePlanner = CW_buildFranchisePlannerInjection(parsed, cfg);
    if (franchisePlanner) {
      /* Background franchise planning pauses whenever an actual canon event is
         active. This keeps the story-control instruction stronger than the
         roadmap-generation instruction. */
      blocks.push(franchisePlanner);
    } else if (cfg.foreshadow) {
      var seeds = CW_selectForeshadow(parsed.events, cfg);
      var i;
      for (i = 0; i < seeds.length; i++) blocks.push(CW_buildForeshadowInjection(seeds[i], cfg));
    }
  }

  var injection = CW_compactBlocks(blocks, cfg.effectiveInjectChars);
  var finalText = injection ? CW_appendWithinBudget(text, injection, cfg) : text;

  CW_maybeUpdateDashboard(parsed, cfg);
  return { text: finalText, stop: false };
}

function CW_onOutput(text, parsed, cfg) {
  var s = CW_state();
  var out = text || "";

  CW_syncActionClock(parsed.events);

  /* The normal model call can also return a hidden franchise-roadmap block.
     Capture it, create Canon Event Story Cards, then remove it before the
     player or the rest of CANON WEAVE sees the output. */
  out = CW_captureFranchisePlan(out, parsed, cfg);

  CW_prepareOutputRevision(parsed.events, out);
  CW_observeText(parsed.events, out, "output", cfg);

  if (!s.activeId) {
    CW_maybeUpdateDashboard(parsed, cfg);
    return { text: out, stop: false };
  }

  var e = CW_findEvent(parsed.events, s.activeId);
  if (!e) {
    s.activeId = null;
    s.active = null;
    return { text: out, stop: false };
  }
  CW_applyEventDefaults(e, cfg);

  var es = CW_eventState(e.id);
  es.attempts += 1;
  es.totalAttempts += 1;
  es.lastAttemptTurn = s.turn;

  CW_recordCompletionEvidence(e, out, cfg);

  if (CW_eventCompleted(e, out, cfg)) {
    CW_complete(e, "detected", cfg, "output");
    CW_maybeUpdateDashboard(parsed, cfg);
    return { text: out, stop: false };
  }

  if (CW_eventProgressed(e, out, cfg)) {
    es.lastProgressTurn = s.turn;
    es.progressHits += 1;
  }

  if (e.mode === "soft") {
    CW_complete(e, "soft-one-shot", cfg, "output");
    CW_maybeUpdateDashboard(parsed, cfg);
    return { text: out, stop: false };
  }

  if (e.mode === "force") {
    if (es.attempts >= e.retries && e.fallback) {
      if (!CW_textMatchesTerm(out, e.fallback, "strict", cfg)) out = CW_joinStoryText(out, e.fallback);
      CW_observeText(parsed.events, e.fallback, "fallback", cfg);
      CW_complete(e, "fallback", cfg, "output");
      CW_maybeUpdateDashboard(parsed, cfg);
      return { text: out, stop: false };
    }

    if (es.totalAttempts >= cfg.forceMaxAttempts && !e.fallback) CW_stallEvent(e, "force-max-attempts", cfg, "output");

    CW_maybeUpdateDashboard(parsed, cfg);
    return { text: out, stop: false };
  }

  /* Strong mode backs off rather than permanently dropping a canon beat after
     one bad generation burst. */
  if (es.attempts >= e.retries) {
    es.cycles += 1;

    if (es.cycles >= e.maxCycles) {
      CW_markMissed(e, "strong-cycles-exhausted", "output");
      s.activeId = null;
      s.active = null;
    } else {
      es.status = "cooldown";
      es.nextEligibleTurn = s.turn + e.retryDelay;
      es.attempts = 0;
      s.activeId = null;
      s.active = null;
      CW_log("Backoff " + e.id + " until turn " + es.nextEligibleTurn);
    }
  }

  CW_maybeUpdateDashboard(parsed, cfg);
  return { text: out, stop: false };
}

/* ========================================================================
 * STATE / MIGRATION / CLOCK
 * ====================================================================== */

function CW_state() {
  if (!state.CANON_WEAVE) {
    state.CANON_WEAVE = {
      schema: CW_SCHEMA,
      enabled: true,
      turn: 0,
      lastActionCount: -1,
      clockKey: "",
      completed: {},
      occurrences: {},
      eventStates: {},
      groupOwners: {},
      flags: {},
      seen: {},
      completionEvidence: {},
      cancelled: {},
      missed: {},
      stalled: {},
      gates: {},
      chance: {},
      activeId: null,
      active: null,
      lastEventTurn: -999999,
      lastInput: "",
      hooksSeen: { input:0, context:0, output:0 },
      hookErrors: { input:0, context:0, output:0 },
      lastHook: "",
      lastHookAction: -1,
      commandHandledTurn: -1,
      commandHandledText: "",
      manualFire: null,
      diagnostics: { signature: "", errors: [], warnings: [] },
      dashboardHash: "",
      dashboardTurn: -999999,
      lastToast: "",

      /* Schema 8: zero-config installer / self-healing config UI. */
      setup: {
        version: 0,
        status: "idle",
        attempts: 0,
        complete: false,
        added: 0,
        lastError: "",
        noticeShown: false
      },

      /* Schema 3: action-aware history for undo/retry safety. */
      journal: [],
      baseline: null,
      rewindFloor: 0,
      lastOutputAction: -1,
      lastOutputHash: "",
      rewindNoticeShown: false,

      /* Schema 5: expanded AI-assisted franchise roadmap generation. */
      /* Schema 6: resolved dependencies, adaptive budgets, stronger retry/franchise hardening. */
      /* Schema 7: merged configs, presets, fair scheduling, preemption, smart lore extraction,
         stronger franchise source grounding and nonce-verified planner protocol. */
      /* Schema 8: zero-config self-installer and repairable config Story Cards. */
      franchise: {
        identity: "",
        name: "",
        activeSet: "",
        session: 0,
        status: "idle",
        generated: 0,
        target: 0,
        batches: 0,
        failures: 0,
        lastPlanTurn: -999999,
        lastCapturedAction: -999999,
        lastMissedAction: -999999,
        eventIds: [],
        titles: [],
        complete: false,
        paused: false,
        lastReason: "",
        cursor: "",
        sourceRefs: [],
        suggestions: [],
        lastBatchSummary: "",
        roadmapKey: "",
        planNonce: "",
        sourceHash: "",
        sourceChanged: false
      }
    };
  }
  return state.CANON_WEAVE;
}

function CW_migrateState(s) {
  if (!s) return;

  /* Preserve schema-1/2 adventures. A baseline snapshot protects existing
     canon state; fully reversible journaling begins from the moment schema 3
     is first seen. */
  if (!s.schema || s.schema < 2) {
    s.occurrences = s.occurrences || {};
    s.eventStates = s.eventStates || {};
    s.groupOwners = s.groupOwners || s.completedGroups || {};
    s.completionEvidence = s.completionEvidence || {};
    s.cancelled = s.cancelled || {};
    s.stalled = s.stalled || {};
    s.diagnostics = s.diagnostics || { signature: "", errors: [], warnings: [] };
    s.dashboardHash = s.dashboardHash || "";
    s.dashboardTurn = (typeof s.dashboardTurn === "number") ? s.dashboardTurn : -999999;
    s.lastActionCount = (typeof s.lastActionCount === "number") ? s.lastActionCount : -1;
    if (s.active && s.active.id && !s.activeId) s.activeId = s.active.id;
    s.schema = 2;
  }

  s.completed = s.completed || {};
  s.occurrences = s.occurrences || {};
  s.eventStates = s.eventStates || {};
  s.groupOwners = s.groupOwners || {};
  s.flags = s.flags || {};
  s.seen = s.seen || {};
  s.completionEvidence = s.completionEvidence || {};
  s.cancelled = s.cancelled || {};
  s.missed = s.missed || {};
  s.stalled = s.stalled || {};
  s.gates = s.gates || {};
  s.chance = s.chance || {};
  s.diagnostics = s.diagnostics || { signature: "", errors: [], warnings: [] };

  if (s.schema < 3) {
    var now = CW_currentActionCount();
    if (now < 0) now = s.turn || 0;
    s.journal = [];
    s.baseline = {
      turn: now,
      completed: CW_cloneMap(s.completed),
      occurrences: CW_cloneMap(s.occurrences),
      groupOwners: CW_cloneMap(s.groupOwners),
      flags: CW_cloneMap(s.flags),
      cancelled: CW_cloneMap(s.cancelled)
    };
    s.rewindFloor = now;
    s.lastOutputAction = -1;
    s.lastOutputHash = "";
    s.rewindNoticeShown = false;
    s.schema = 3;
  }

  s.journal = s.journal || [];
  s.rewindFloor = typeof s.rewindFloor === "number" ? s.rewindFloor : 0;
  s.lastOutputAction = typeof s.lastOutputAction === "number" ? s.lastOutputAction : -1;
  s.lastOutputHash = s.lastOutputHash || "";

  if (s.schema < 4) {
    s.franchise = s.franchise || {};
    s.schema = 4;
  }
  if (s.schema < 5) {
    s.franchise = s.franchise || {};
    s.schema = 5;
  }
  if (s.schema < 6) {
    s.franchise = s.franchise || {};
    s.schema = 6;
  }
  if (s.schema < 7) {
    s.franchise = s.franchise || {};
    s.schema = 7;
  }
  if (s.schema < 8) {
    s.setup = s.setup || {};
    s.schema = 8;
  }
  CW_ensureSetupState(s);
  CW_ensureFranchiseState(s);
}

function CW_eventState(id) {
  var s = CW_state();
  id = CW_slug(id);

  if (!s.eventStates[id]) {
    s.eventStates[id] = {
      status: "dormant",
      armedTurn: 0,
      startedTurn: 0,
      attempts: 0,
      totalAttempts: 0,
      cycles: 0,
      injections: 0,
      progressHits: 0,
      lastProgressTurn: 0,
      lastAttemptTurn: 0,
      lastCompleteTurn: 0,
      nextEligibleTurn: 0,
      eligibleSince: 0,
      lastEligibleTurn: 0,
      preemptions: 0,
      lastReason: ""
    };
  }

  return s.eventStates[id];
}

function CW_advanceClock() {
  return CW_syncActionClock([]);
}


function CW_currentActionCount() {
  if (typeof info !== "undefined" && info && typeof info.actionCount === "number") return info.actionCount;
  return -1;
}

function CW_syncActionClock(events) {
  var s = CW_state();
  var ac = CW_currentActionCount();

  if (ac >= 0) {
    if (s.lastActionCount >= 0 && ac < s.lastActionCount) CW_rewindTo(ac, events || []);
    s.lastActionCount = ac;
    /* The documented actionCount is the timeline. Retrying output at the same
       action count cannot accidentally fast-forward scheduled canon events. */
    s.turn = ac;
    return s.turn;
  }

  /* Fallback only for test harnesses/clients without actionCount. */
  var h = (typeof history !== "undefined" && history) ? history : [];
  var tail = "";
  var start = Math.max(0, h.length - 3);
  var i;
  for (i = start; i < h.length; i++) if (h[i] && typeof h[i].text === "string") tail += "|" + String(h[i].type || "") + ":" + h[i].text;
  var key = h.length + "|" + CW_hash(tail);
  if (key !== s.clockKey) { s.clockKey = key; s.turn += 1; }
  return s.turn;
}

function CW_cloneMap(obj) {
  var out = {}, k;
  obj = obj || {};
  for (k in obj) if (obj.hasOwnProperty(k)) {
    var v = obj[k];
    if (v && typeof v === "object") {
      var vv = {}, q;
      for (q in v) if (v.hasOwnProperty(q)) vv[q] = v[q];
      out[k] = vv;
    } else out[k] = v;
  }
  return out;
}

function CW_journalPush(rec) {
  var s = CW_state();
  rec = rec || {};
  rec.turn = typeof rec.turn === "number" ? rec.turn : s.turn;
  s.journal.push(rec);
  if (s.journal.length > 2000) s.journal.splice(0, s.journal.length - 2000);
}

function CW_rebuildDerivedFromJournal(targetTurn) {
  var s = CW_state();
  var b = s.baseline || { turn:0, completed:{}, occurrences:{}, groupOwners:{}, flags:{}, cancelled:{} };

  if (targetTurn < (b.turn || 0)) {
    if (!s.rewindNoticeShown) {
      CW_log("Undo crossed the pre-upgrade rewind floor; legacy canon state cannot be perfectly reconstructed before action " + b.turn + ".", true);
      s.rewindNoticeShown = true;
    }
    return;
  }

  s.completed = CW_cloneMap(b.completed || {});
  s.occurrences = CW_cloneMap(b.occurrences || {});
  s.groupOwners = CW_cloneMap(b.groupOwners || {});
  s.flags = CW_cloneMap(b.flags || {});
  s.cancelled = CW_cloneMap(b.cancelled || {});

  var i, r, j;
  for (i = 0; i < s.journal.length; i++) {
    r = s.journal[i];
    if (!r || r.turn > targetTurn) continue;
    if (r.kind === "complete") {
      s.completed[r.eventId] = r.turn;
      s.occurrences[r.eventId] = (s.occurrences[r.eventId] || 0) + 1;
      if (r.group) s.groupOwners[r.group] = r.eventId;
      for (j = 0; j < (r.setFlags || []).length; j++) s.flags[r.setFlags[j]] = true;
      for (j = 0; j < (r.clearFlags || []).length; j++) delete s.flags[r.clearFlags[j]];
      for (j = 0; j < (r.cancel || []).length; j++) s.cancelled[r.cancel[j]] = { turn:r.turn, reason:"cancelled-by-event", by:r.eventId };
    } else if (r.kind === "flag") {
      if (r.value) s.flags[r.flag] = true; else delete s.flags[r.flag];
    } else if (r.kind === "cancel") s.cancelled[r.eventId] = { turn:r.turn, reason:r.reason || "manual", by:"manual" };
  }

  var last = -999999, k;
  for (k in s.completed) if (s.completed.hasOwnProperty(k) && typeof s.completed[k] === "number" && s.completed[k] > last) last = s.completed[k];
  s.lastEventTurn = last;
}

function CW_rewindTo(targetTurn, events) {
  var s = CW_state();
  if (targetTurn < 0) return;

  s.journal = (s.journal || []).filter(function(r) { return !r || r.turn <= targetTurn; });
  CW_rebuildDerivedFromJournal(targetTurn);

  var k, led, term;
  for (k in s.completionEvidence) if (s.completionEvidence.hasOwnProperty(k)) {
    led = s.completionEvidence[k] || {};
    for (term in led) if (led.hasOwnProperty(term) && led[term] > targetTurn) delete led[term];
  }

  for (k in s.seen) if (s.seen.hasOwnProperty(k)) {
    var rec = s.seen[k];
    if (rec && rec.timeline && rec.timeline.length) {
      rec.timeline = rec.timeline.filter(function(x){ return x && x.turn <= targetTurn; });
      if (!rec.timeline.length) { delete s.seen[k]; continue; }
      var last = rec.timeline[rec.timeline.length - 1];
      rec.turn = last.turn; rec.source = last.source; rec.hits = rec.timeline.length;
    } else if (rec && typeof rec === "object" && rec.turn > targetTurn) delete s.seen[k];
  }

  for (k in s.missed) if (s.missed.hasOwnProperty(k) && s.missed[k] && s.missed[k].turn > targetTurn) delete s.missed[k];
  for (k in s.stalled) if (s.stalled.hasOwnProperty(k) && s.stalled[k] && s.stalled[k].turn > targetTurn) delete s.stalled[k];
  for (k in s.gates) if (s.gates.hasOwnProperty(k) && s.gates[k] > targetTurn) delete s.gates[k];

  for (k in s.eventStates) if (s.eventStates.hasOwnProperty(k)) {
    var es = s.eventStates[k];
    if (!es) continue;
    if (es.startedTurn > targetTurn || es.lastAttemptTurn > targetTurn || es.lastProgressTurn > targetTurn) {
      es.status = CW_completed(k) ? "complete" : "dormant";
      es.attempts = 0; es.cycles = 0; es.nextEligibleTurn = 0;
      if (es.eligibleSince > targetTurn) es.eligibleSince = 0;
      if (es.lastEligibleTurn > targetTurn) es.lastEligibleTurn = 0;
      es.lastAttemptTurn = Math.min(es.lastAttemptTurn || 0, targetTurn);
      es.lastProgressTurn = Math.min(es.lastProgressTurn || 0, targetTurn);
    }
    if (es.lastCompleteTurn > targetTurn) es.lastCompleteTurn = CW_completed(k) ? s.completed[k] : 0;
  }

  s.activeId = null; s.active = null; s.turn = targetTurn;
  s.lastOutputAction = -1; s.lastOutputHash = "";
  CW_log("Rewound canon state to action " + targetTurn, true);
}

function CW_prepareOutputRevision(events, output) {
  var s = CW_state();
  var ac = CW_currentActionCount();
  if (ac < 0) ac = s.turn;
  var h = CW_hash(output || "");

  if (s.lastOutputAction === ac && s.lastOutputHash && s.lastOutputHash !== h) {
    var removedEvents = [];
    var kept = [];
    var i, r;
    for (i = 0; i < s.journal.length; i++) {
      r = s.journal[i];
      if (r && r.turn === ac && r.source === "output") {
        if (r.kind === "complete") removedEvents.push(r.eventId);
      } else kept.push(r);
    }
    s.journal = kept;
    CW_rebuildDerivedFromJournal(ac);

    var k, led, term;
    for (k in s.completionEvidence) if (s.completionEvidence.hasOwnProperty(k)) {
      led = s.completionEvidence[k] || {};
      for (term in led) if (led.hasOwnProperty(term) && led[term] === ac) delete led[term];
    }

    /* Remove observations contributed only by the replaced output/fallback. */
    for (k in s.seen) if (s.seen.hasOwnProperty(k)) {
      var rec = s.seen[k];
      if (!rec || !rec.timeline) continue;
      rec.timeline = rec.timeline.filter(function(x){ return !(x && x.turn === ac && (x.source === "output" || x.source === "fallback")); });
      if (!rec.timeline.length) { delete s.seen[k]; continue; }
      var last = rec.timeline[rec.timeline.length - 1];
      rec.turn = last.turn; rec.source = last.source; rec.hits = rec.timeline.length;
    }

    for (k in s.eventStates) if (s.eventStates.hasOwnProperty(k)) {
      var es = s.eventStates[k];
      if (es && es.lastAttemptTurn === ac) {
        es.attempts = Math.max(0, (es.attempts || 0) - 1);
        es.totalAttempts = Math.max(0, (es.totalAttempts || 0) - 1);
        es.nextEligibleTurn = 0;
        es.status = CW_completed(k) ? "complete" : "dormant";
      }
    }

    /* Strong/force failure states can also be created by the replaced output.
       They must not survive Retry any more than a discarded completion can. */
    var retryRestore = removedEvents.slice(0);
    for (k in s.missed) if (s.missed.hasOwnProperty(k) && s.missed[k] && s.missed[k].turn === ac && s.missed[k].source === "output") { retryRestore.push(k); delete s.missed[k]; }
    for (k in s.stalled) if (s.stalled.hasOwnProperty(k) && s.stalled[k] && s.stalled[k].turn === ac && s.stalled[k].source === "output") { retryRestore.push(k); delete s.stalled[k]; }

    if (retryRestore.length) {
      var restore = retryRestore[retryRestore.length - 1];
      if (!CW_completed(restore) && !s.cancelled[restore] && CW_findEvent(events || [], restore)) {
        s.activeId = restore;
        s.active = { id:restore, startedTurn:ac };
        var restoredState = CW_eventState(restore);
        restoredState.status = "active";
        restoredState.attempts = Math.max(0, restoredState.attempts || 0);
        restoredState.cycles = Math.max(0, (restoredState.cycles || 0) - 1);
        restoredState.nextEligibleTurn = 0;
      }
    }
    CW_log("Retry revision detected at action " + ac + "; previous output effects rolled back.");
  }

  s.lastOutputAction = ac;
  s.lastOutputHash = h;
}

function CW_pruneState(cfg) {
  var s = CW_state();
  var cutoff = Math.max(0, s.turn - cfg.evidenceTurns);
  var keys = [];
  var k;

  for (k in s.seen) {
    if (!s.seen.hasOwnProperty(k)) continue;
    var rec = s.seen[k];
    if (rec && typeof rec === "object" && rec.turn < cutoff && !rec.permanent) {
      delete s.seen[k];
    } else {
      keys.push(k);
    }
  }

  if (keys.length > cfg.maxEvidenceKeys) {
    keys.sort(function(a, b) {
      return CW_seenTurn(s.seen[a]) - CW_seenTurn(s.seen[b]);
    });
    while (keys.length > cfg.maxEvidenceKeys) {
      delete s.seen[keys.shift()];
    }
  }
}

function CW_seenTurn(rec) {
  if (typeof rec === "number") return rec;
  if (rec && rec.timeline && rec.timeline.length) {
    var last = rec.timeline[rec.timeline.length - 1];
    if (last && typeof last.turn === "number") return last.turn;
  }
  return rec && typeof rec.turn === "number" ? rec.turn : 0;
}

/* ========================================================================
 * FIRST-RUN / ZERO-CONFIG INSTALLER
 * ====================================================================== */

function CW_ensureSetupState(s) {
  s = s || CW_state();
  s.setup = s.setup || {};
  if (typeof s.setup.version !== "number") s.setup.version = 0;
  if (!s.setup.status) s.setup.status = "idle";
  if (typeof s.setup.attempts !== "number") s.setup.attempts = 0;
  if (typeof s.setup.complete !== "boolean") s.setup.complete = false;
  if (typeof s.setup.added !== "number") s.setup.added = 0;
  if (typeof s.setup.lastError !== "string") s.setup.lastError = "";
  if (typeof s.setup.noticeShown !== "boolean") s.setup.noticeShown = false;
  return s.setup;
}

function CW_findStoryCardByExactKeys(keys) {
  var cards = (typeof storyCards !== "undefined" && storyCards) ? storyCards : [];
  var wanted = CW_norm(String(keys || ""));
  var i;
  for (i = 0; i < cards.length; i++) {
    if (CW_norm(String((cards[i] || {}).keys || "")) === wanted) return cards[i];
  }
  return null;
}

function CW_scanSetupCards() {
  var cards = (typeof storyCards !== "undefined" && storyCards) ? storyCards : [];
  var master = CW_findStoryCardByExactKeys(CW_SETUP_MASTER.keys);
  var advanced = CW_findStoryCardByExactKeys(CW_SETUP_ADVANCED.keys);
  var custom = false, total = 0, i;

  for (i = 0; i < cards.length; i++) {
    var c = cards[i] || {};
    var type = CW_norm(c.type || "");
    var marker = CW_firstMarker(c.entry || "");
    if (type === "canon config" || type === "canon weave config" || marker === "@canon_config") {
      total += 1;
      if (c !== master && c !== advanced) custom = true;
    }
  }

  return { master:master, advanced:advanced, custom:custom, total:total };
}

/* ========================================================================
 * STORY CARD WRITE FIREWALL
 * ====================================================================== */

/* AI Dungeon's documented scripting Story Card object exposes ONLY:
 *   id, keys, entry, type
 *
 * And its documented write functions are:
 *   addStoryCard(keys, entry, type)
 *   updateStoryCard(index, keys, entry, type)
 *   removeStoryCard(index)
 *
 * Title / Notes (`description` in import JSON) are editor metadata and are NOT
 * part of the documented scripting object. Earlier CANON WEAVE builds tried
 * to decorate runtime cards by assigning `card.title` / `card.description`
 * and by passing extra arguments to addStoryCard(). That was unsupported and
 * could interfere with editing Story Card Notes in the UI.
 *
 * Every runtime Story Card mutation now goes through these wrappers. They
 * intentionally cannot write Notes or Title. Imported/manual Notes therefore
 * remain entirely user-owned and editable.
 */
function CW_apiAddStoryCard(keys, entry, type) {
  if (typeof addStoryCard !== "function") return false;
  return addStoryCard(String(keys || ""), String(entry || ""), String(type || ""));
}

function CW_apiUpdateStoryCard(index, keys, entry, type) {
  if (typeof updateStoryCard !== "function") return false;
  updateStoryCard(index, String(keys || ""), String(entry || ""), String(type || ""));
  return true;
}

function CW_apiRemoveStoryCard(index) {
  if (typeof removeStoryCard !== "function") return false;
  removeStoryCard(index);
  return true;
}

function CW_addSetupCard(def) {
  if (!def) return null;
  var existing = CW_findStoryCardByExactKeys(def.keys);
  if (existing) return existing;
  if (typeof addStoryCard !== "function") return null;

  /* Deliberately use ONLY the documented three-argument API. The optional
     package JSON can provide pretty Titles + Notes before play; the runtime
     installer never touches those editor-only fields. */
  var result = CW_apiAddStoryCard(def.keys, def.entry, def.type);

  /* Never use `if (!result)`: index 0 is a valid successful return value. */
  var card = CW_findStoryCardByExactKeys(def.keys);
  if (!card && result !== false && typeof result === "number" && typeof storyCards !== "undefined") {
    card = storyCards[result] || null;
  }
  if (!card && typeof storyCards !== "undefined" && storyCards.length) {
    var tail = storyCards[storyCards.length - 1];
    if (tail && CW_norm(tail.keys || "") === CW_norm(def.keys)) card = tail;
  }

  return card;
}

function CW_bootstrapConfigCards(force) {
  var s = CW_state();
  var setup = CW_ensureSetupState(s);

  /* After successful installation we do zero Story Card scanning on normal
     turns.  /canon setup is the explicit repair path if the cards are later
     deleted. This keeps the installer effectively free in large databases. */
  if (!force && setup.complete && setup.version === CW_SETUP_VERSION) return setup;

  var scan = CW_scanSetupCards();

  /* A creator who supplied their own Canon Config card has deliberately
     configured the engine. Do not clutter their database with our defaults. */
  if (scan.custom && !scan.master && !scan.advanced) {
    setup.complete = true;
    setup.version = CW_SETUP_VERSION;
    setup.status = "custom-config";
    setup.lastError = "";
    return setup;
  }

  if (scan.master && scan.advanced) {
    setup.complete = true;
    setup.version = CW_SETUP_VERSION;
    setup.status = "ready";
    setup.lastError = "";
    return setup;
  }

  if (!force && setup.complete) return setup;
  if (!force && setup.attempts >= 3) return setup;

  setup.attempts += 1;
  setup.status = "installing";
  setup.lastError = "";

  if (typeof addStoryCard !== "function") {
    setup.status = "defaults-only";
    setup.lastError = "addStoryCard is unavailable in this hook/runtime";
    if (!setup.noticeShown) {
      setup.noticeShown = true;
      CW_toast("Canon Weave is running with embedded defaults. Config Story Cards could not be created in this runtime; use /canon setup to retry later.");
    }
    return setup;
  }

  try {
    var added = 0;
    if (!scan.master) { if (CW_addSetupCard(CW_SETUP_MASTER)) added += 1; }
    if (!scan.advanced) { if (CW_addSetupCard(CW_SETUP_ADVANCED)) added += 1; }
    setup.added += added;

    scan = CW_scanSetupCards();
    if ((scan.master && scan.advanced) || (scan.custom && !scan.master && !scan.advanced)) {
      setup.complete = true;
      setup.version = CW_SETUP_VERSION;
      setup.status = scan.custom && !scan.master ? "custom-config" : "ready";
      setup.lastError = "";
      if (added > 0 && !setup.noticeShown) {
        setup.noticeShown = true;
        CW_toast("Canon Weave setup complete. Config cards use the documented Story Card API; Notes and Titles are never modified at runtime.");
      }
    } else {
      setup.status = "defaults-only";
      setup.lastError = "Story Card write did not persist";
      if (!setup.noticeShown) {
        setup.noticeShown = true;
        CW_toast("Canon Weave is active with embedded defaults, but its Config Story Cards could not be saved. Use /canon setup to retry.");
      }
    }
  } catch (err) {
    setup.status = "defaults-only";
    setup.lastError = CW_errorText(err);
    CW_log("Config bootstrap failed: " + setup.lastError, true);
    if (!setup.noticeShown) {
      setup.noticeShown = true;
      CW_toast("Canon Weave is active with embedded defaults. Automatic Config Story Card creation failed; /canon setup can retry.");
    }
  }

  return setup;
}

function CW_setupStatusText() {
  var s = CW_state();
  var setup = CW_ensureSetupState(s);
  var scan = CW_scanSetupCards();
  var parts = [
    "Canon Weave setup: " + setup.status,
    "Master Config: " + (scan.master ? "present" : "missing"),
    "Advanced Config: " + (scan.advanced ? "present" : "missing"),
    "Custom Config: " + (scan.custom ? "present" : "none"),
    "Notes safety: runtime never writes Story Card Notes/Title"
  ];
  if (setup.lastError) parts.push("Last issue: " + setup.lastError);
  parts.push(CW_hookHealthText());
  return parts.join(" | ");
}

/* ========================================================================
 * CARD PARSING
 * ====================================================================== */

function CW_parseAllCards() {
  var cards = (typeof storyCards !== "undefined" && storyCards) ? storyCards : [];
  var events = [];
  var config = {};
  var configBlocks = [];
  var configCount = 0;
  var configCardIndices = [];
  var dashboardIndex = -1;
  var i;

  for (i = 0; i < cards.length; i++) {
    var c = cards[i] || {};
    var type = CW_norm(c.type || "");
    var entryMarker = CW_firstMarker(c.entry || "");

    if (type === "canon config" || type === "canon weave config" || entryMarker === "@canon_config") {
      var cm = CW_parseConfigCard(c);
      configBlocks.push({ meta:cm, priority:CW_int(cm.config_priority || cm.configpriority, 0), index:i });
      configCount += 1;
      configCardIndices.push(i);
      continue;
    }

    if (type === "canon dashboard" || entryMarker === "@canon_dashboard") {
      dashboardIndex = i;
      continue;
    }

    if (type === "canon event" || type === "canon" || entryMarker === "@canon") {
      events.push(CW_parseEventCard(c));
    }
  }

  configBlocks.sort(function(a,b) { if (a.priority !== b.priority) return a.priority - b.priority; return a.index - b.index; });
  for (i = 0; i < configBlocks.length; i++) CW_mergeInto(config, configBlocks[i].meta);

  /* Virtual generated cards are only used when materialization was explicitly
     disabled. addStoryCard is the normal/default path. */
  var fs = CW_state().franchise;
  if (fs && fs.virtualCards && fs.virtualCards.length) {
    for (i = 0; i < fs.virtualCards.length; i++) {
      var vc = fs.virtualCards[i];
      cards = cards.slice(0);
      cards.push(vc);
      events.push(CW_parseEventCard(vc));
    }
  }

  return { cards: cards, events: events, config: config, configCount:configCount, configCardIndices:configCardIndices, dashboardIndex: dashboardIndex };
}

function CW_firstMarker(src) {
  var lines = String(src || "").split(/\r?\n/);
  var i;

  for (i = 0; i < lines.length; i++) {
    var t = CW_norm(lines[i]);
    if (!t) continue;
    if (t === "@canon") return "@canon";
    if (t === "@canon_config" || t === "@canon config") return "@canon_config";
    if (t === "@canon_dashboard" || t === "@canon dashboard") return "@canon_dashboard";
    if (t === "@canon_source" || t === "@canon source") return "@canon_source";
    return "";
  }

  return "";
}

function CW_parseConfigCard(card) {
  return CW_parseMetaBlock(String(card.entry || ""), "@canon_config").meta;
}

function CW_parseEventCard(card) {
  var entry = String(card.entry || "");
  var parsed = CW_parseMetaBlock(entry, "@canon");
  var m = parsed.meta;
  var title = String(card.title || m.title || m.name || "");
  var id = CW_slug(m.id || title || ("card_" + String(card.id)));
  if (!title) title = id;

  var window = CW_parseWindow(m.window || m.between || "");
  var relWindow = CW_parseWindow(m.relative_window || m.relativewindow || "");
  var once = CW_bool(m.once, true);
  var maxOcc = Math.max(1, CW_int(m.max_occurrences || m.maxoccurrences, once ? 1 : 999999));

  var e = {
    id: id,
    title: title,
    cardId: card.id,
    payload: CW_cleanBody(parsed.body),

    /* absolute + dependency-relative timeline */
    at: Math.max(0, CW_int(CW_pick(m, ["at","turn","min_turn","minturn"]), 0)),
    before: Math.max(0, CW_int(CW_pick(m, ["before","max_turn","maxturn"]), 0)),
    afterDelay: Math.max(0, CW_int(m.after_delay || m.afterdelay || m.relative_after || m.relativeafter, relWindow.min || 0)),
    afterBefore: Math.max(0, CW_int(m.after_before || m.afterbefore || m.relative_before || m.relativebefore, relWindow.max || 0)),
    delay: Math.max(0, CW_int(m.delay, 0)),
    cooldown: Math.max(0, CW_int(m.cooldown, 0)),
    repeatEvery: Math.max(0, CW_int(m.repeat_every || m.repeatevery, 0)),
    once: once,
    maxOccurrences: maxOcc,
    deadlinePolicy: CW_deadlinePolicy(m.deadline_policy || m.deadlinepolicy || ""),
    deadlineGrace: Math.max(-1, CW_int(m.deadline_grace || m.deadlinegrace, -1)),
    blockedPolicy: CW_blockedPolicy(m.blocked_policy || m.blockedpolicy || m.on_block || m.onblock || ""),
    catchUp: CW_bool(m.catch_up || m.catchup, null),

    /* graph */
    after: CW_terms(CW_pick(m, ["after","requires_event","requires_events"])),
    afterAny: CW_terms(CW_pick(m, ["after_any","afterany"])),
    afterResolved: CW_terms(CW_pick(m, ["after_resolved","afterresolved"])),
    afterNot: CW_terms(CW_pick(m, ["after_not","afternot"])),
    arc: CW_slug(m.arc || ""),
    order: CW_int(m.order, 0),
    strictOrder: CW_bool(m.strict_order || m.strictorder, false),
    strictOrderResolved: CW_bool(m.strict_order_resolved || m.strictorderresolved, false),

    /* conditions */
    whenAny: CW_altTerms(CW_pick(m, ["when","when_any","trigger","any"])),
    whenMin: Math.max(1, CW_int(m.when_min || m.whenmin, 1)),
    whenAll: CW_terms(CW_pick(m, ["when_all","whenall","scene_all","sceneall"])),
    whenClauses: CW_clauseGroups(m.when_clauses || m.whenclauses || ""),
    requireAll: CW_terms(CW_pick(m, ["require","requires","seen","require_all"])),
    requireAny: CW_altTerms(CW_pick(m, ["require_any","requireany"])),
    requireClauses: CW_clauseGroups(m.require_clauses || m.requireclauses || ""),
    unlessEver: CW_altTerms(CW_pick(m, ["unless","blocked_by","blockedby"])),
    sceneUnless: CW_altTerms(CW_pick(m, ["scene_unless","sceneunless"])),
    requireWithin: Math.max(0, CW_int(m.require_within || m.requirewithin, 0)),
    matchMode: CW_matchMode(m.match || m.match_mode || m.matchmode || ""),
    completionMatch: CW_matchMode(m.complete_match || m.completion_match || m.completematch || ""),
    blockerMatch: CW_matchMode(m.blocker_match || m.unless_match || m.blockermatch || ""),

    /* character creator / scenario start choices */
    placeholderAll: CW_terms(m.placeholder || m.placeholders || m.placeholder_all || ""),
    placeholderAny: CW_altTerms(m.placeholder_any || m.placeholderany || ""),
    placeholderNot: CW_altTerms(m.placeholder_not || m.placeholdernot || ""),

    /* state/branches */
    flags: CW_terms(CW_pick(m, ["flag","flags","require_flags"])),
    notFlags: CW_terms(CW_pick(m, ["not_flag","not_flags","without_flags"])),
    setFlags: CW_terms(CW_pick(m, ["set","set_flags","setflags"])),
    clearFlags: CW_terms(CW_pick(m, ["clear","clear_flags","clearflags"])),
    group: CW_slug(m.group || m.branch || ""),
    cancel: CW_terms(CW_pick(m, ["cancel","cancel_events","cancelevents"])),

    /* supporting canon */
    include: CW_terms(CW_pick(m, ["include","cards","activate_cards","activate"])),
    exclude: CW_terms(m.exclude || m.exclude_cards || m.excludecards || ""),
    includeTypes: CW_terms(m.include_types || m.includetypes || ""),
    excludeTypes: CW_terms(m.exclude_types || m.excludetypes || ""),
    autoInclude: CW_bool(m.auto_include || m.autoinclude, null),

    /* pacing / enforcement */
    priority: CW_int(m.priority, 50),
    chance: CW_clamp(CW_num(m.chance, 100), 0, 100),
    mode: CW_mode(m.mode || ""),
    retries: Math.max(0, CW_int(m.retries || m.attempts, 0)),
    maxCycles: Math.max(0, CW_int(m.max_cycles || m.maxcycles, 0)),
    retryDelay: Math.max(-1, CW_int(m.retry_delay || m.retrydelay, -1)),
    lead: Math.max(0, CW_int(m.lead || m.foreshadow_lead || m.foreshadowlead, 0)),
    seed: String(m.seed || m.foreshadow || ""),
    bridge: String(m.bridge || ""),
    delivery: CW_deliveryMode(m.delivery || m.delivery_mode || m.deliverymode || ""),
    outcomePolicy: CW_outcomePolicy(m.outcome || m.outcome_policy || m.outcomepolicy || ""),
    playerPresence: CW_playerPresence(m.player_presence || m.playerpresence || m.presence || ""),
    protect: CW_terms(m.protect || m.must_keep || m.mustkeep || ""),
    forbid: CW_altTerms(m.forbid || m.do_not || m.donot || ""),

    /* completion */
    completeAny: CW_altTerms(CW_pick(m, ["complete","completion","complete_any"])),
    completeMin: Math.max(1, CW_int(m.complete_min || m.completemin, 1)),
    completeAll: CW_terms(CW_pick(m, ["complete_all","completeall"])),
    completeClauses: CW_clauseGroups(m.complete_clauses || m.completeclauses || ""),
    completeRegex: String(CW_pick(m, ["complete_regex","completeregex"]) || ""),
    completeWithin: Math.max(1, CW_int(m.complete_within || m.completewithin, 1)),
    completeUnless: CW_altTerms(CW_pick(m, ["complete_unless","completeunless"])),
    progress: CW_altTerms(m.progress || ""),
    fallback: String(m.fallback || ""),

    /* generated franchise metadata */
    generatedFor: CW_slug(m.generated_for || m.generatedfor || ""),
    generatedSet: CW_slug(m.generated_set || m.generatedset || ""),
    generatedConfidence: CW_clamp(CW_num(m.generated_confidence || m.generatedconfidence, 1), 0, 1),
    generatedKind: CW_norm(m.generated_kind || m.generatedkind || ""),
    generatedRole: CW_norm(m.generated_role || m.generatedrole || ""),
    sourceRef: String(m.source_ref || m.sourceref || ""),

    rawMeta: m
  };

  if (window.min && !e.at) e.at = window.min;
  if (window.max && !e.before) e.before = window.max;
  return e;
}

function CW_parseMetaBlock(src, marker) {
  src = String(src || "");
  var lines = src.split(/\r?\n/);
  var meta = {};
  var body = [];
  var markerSeen = false;
  var header = true;
  var i;

  for (i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trim = line.replace(/^\s+|\s+$/g, "");

    if (!markerSeen) {
      if (!trim) continue;
      if (CW_norm(trim) === CW_norm(marker)) {
        markerSeen = true;
        continue;
      }
      /* Type can mark a card even if creator forgot @CANON. */
      markerSeen = true;
    }

    if (header && /^-{3,}$/.test(trim)) {
      header = false;
      continue;
    }

    if (header) {
      if (!trim || trim.charAt(0) === "#") continue;
      var mm = trim.match(/^([A-Za-z0-9_\- ]+?)\s*[:=]\s*(.*)$/);
      if (mm) {
        meta[CW_normKey(mm[1])] = CW_unquote(mm[2]);
        continue;
      }
      header = false;
    }

    if (!header) body.push(line);
  }

  return { meta: meta, body: body.join("\n") };
}


function CW_presetDefaults(v) {
  var out = {}, k;
  for (k in CW_DEFAULTS) if (CW_DEFAULTS.hasOwnProperty(k)) out[k] = CW_DEFAULTS[k];
  v = CW_norm(v || "balanced").replace(/\s+/g, "_");
  if (v !== "balanced" && v !== "strict" && v !== "player_first" && v !== "cinematic" && v !== "source_locked" && v !== "minimal") v = "balanced";
  out.preset = v;

  if (v === "strict") {
    out.defaultMatch = "strict"; out.completionMatch = "strict"; out.blockerMatch = "strict";
    out.fuzzyThreshold = 0.86; out.franchiseConfidenceFloor = 0.72;
    out.franchiseSourceMode = "prefer"; out.franchiseDivergence = "strict";
    out.franchiseRequireSourceRef = true; out.autoIncludeCards = 2;
  } else if (v === "player_first") {
    out.defaultDeadlinePolicy = "catchup"; out.forceDeadlineGrace = 5;
    out.defaultMode = "soft"; out.strongCycles = 2; out.franchiseDivergence = "reactive";
    out.franchiseDeadlinePolicy = "catchup"; out.franchiseEnforcement = "soft";
    out.franchiseOutcomePolicy = "opportunity"; out.franchiseDeliveryPolicy = "adaptive";
  } else if (v === "cinematic") {
    out.foreshadowLead = 6; out.maxForeshadowEvents = 2; out.defaultMode = "strong";
    out.franchiseGranularity = "major"; out.franchisePacing = "normal";
    out.franchiseDeliveryPolicy = "adaptive"; out.franchiseOutcomePolicy = "flexible";
  } else if (v === "source_locked") {
    out.defaultMatch = "strict"; out.completionMatch = "strict"; out.blockerMatch = "strict";
    out.franchiseSourceMode = "require"; out.franchiseRequireSourceRef = true;
    out.franchiseConfidenceFloor = 0.80; out.franchiseDivergence = "strict";
    out.franchiseDeadlinePolicy = "force"; out.franchiseOutcomePolicy = "fixed";
  } else if (v === "minimal") {
    out.autoInclude = false; out.foreshadow = false; out.dashboard = false;
    out.maxIncludeCards = 3; out.maxInjectChars = 4200; out.franchiseAutoGenerate = false;
  }
  return out;
}

function CW_buildConfig(meta) {
  meta = meta || {};
  var base = CW_presetDefaults(meta.preset || meta.profile || meta.config_preset || CW_DEFAULTS.preset);

  var cfg = {
    preset: base.preset,
    enabled: CW_bool(meta.enabled, base.enabled),
    sceneActions: Math.max(1, CW_int(meta.scene_actions || meta.sceneactions, base.sceneActions)),
    evidenceTurns: Math.max(20, CW_int(meta.evidence_turns || meta.evidenceturns, base.evidenceTurns)),
    maxEvidenceKeys: Math.max(100, CW_int(meta.max_evidence_keys || meta.maxevidencekeys, base.maxEvidenceKeys)),
    defaultMatch: CW_matchMode(meta.default_match || meta.defaultmatch || base.defaultMatch),
    completionMatch: CW_matchMode(meta.completion_match || meta.completionmatch || base.completionMatch),
    blockerMatch: CW_matchMode(meta.blocker_match || meta.blockermatch || base.blockerMatch),
    fuzzyThreshold: CW_clamp(CW_num(meta.fuzzy_threshold || meta.fuzzythreshold, base.fuzzyThreshold), 0.5, 1),
    negationAware: CW_bool(meta.negation_aware || meta.negationaware, base.negationAware),
    negationWindow: Math.max(12, CW_int(meta.negation_window || meta.negationwindow, base.negationWindow)),

    fairScheduler: CW_bool(meta.fair_scheduler || meta.fairscheduler, base.fairScheduler),
    starvationTurns: Math.max(0, CW_int(meta.starvation_turns || meta.starvationturns, base.starvationTurns)),
    starvationBoost: Math.max(0, CW_int(meta.starvation_boost || meta.starvationboost, base.starvationBoost)),
    allowPreemption: CW_bool(meta.allow_preemption || meta.allowpreemption, base.allowPreemption),
    preemptPriorityGap: Math.max(1, CW_int(meta.preempt_priority_gap || meta.preemptprioritygap, base.preemptPriorityGap)),

    globalCooldown: Math.max(0, CW_int(meta.global_cooldown || meta.globalcooldown, base.globalCooldown)),
    allowCatchUp: CW_bool(meta.allow_catch_up || meta.allowcatchup, base.allowCatchUp),
    defaultDeadlinePolicy: CW_deadlinePolicy(meta.default_deadline_policy || meta.defaultdeadlinepolicy || base.defaultDeadlinePolicy),
    forceDeadlineGrace: Math.max(0, CW_int(meta.force_deadline_grace || meta.forcedeadlinegrace, base.forceDeadlineGrace)),

    defaultMode: CW_mode(meta.default_mode || meta.defaultmode || base.defaultMode),
    defaultRetries: Math.max(1, CW_int(meta.default_retries || meta.defaultretries, base.defaultRetries)),
    strongCycles: Math.max(1, CW_int(meta.strong_cycles || meta.strongcycles, base.strongCycles)),
    retryDelay: Math.max(0, CW_int(meta.retry_delay || meta.retrydelay, base.retryDelay)),
    forceMaxAttempts: Math.max(1, CW_int(meta.force_max_attempts || meta.forcemaxattempts, base.forceMaxAttempts)),

    maxIncludeCards: Math.max(0, CW_int(meta.max_include_cards || meta.maxincludecards, base.maxIncludeCards)),
    autoInclude: CW_bool(meta.auto_include || meta.autoinclude, base.autoInclude),
    autoIncludeCards: Math.max(0, CW_int(meta.auto_include_cards || meta.autoincludecards, base.autoIncludeCards)),
    autoIncludeMinScore: Math.max(1, CW_num(meta.auto_include_min_score || meta.autoincludeminscore, base.autoIncludeMinScore)),
    autoIncludeDiversity: CW_bool(meta.auto_include_diversity || meta.autoincludediversity, base.autoIncludeDiversity),
    autoIncludeTypeCap: Math.max(1, CW_int(meta.auto_include_type_cap || meta.autoincludetypecap, base.autoIncludeTypeCap)),
    autoIncludeDedupe: CW_bool(meta.auto_include_dedupe || meta.autoincludededupe, base.autoIncludeDedupe),
    smartCardExtract: CW_bool(meta.smart_card_extract || meta.smartcardextract, base.smartCardExtract),
    smartCardSentences: CW_clamp(CW_int(meta.smart_card_sentences || meta.smartcardsentences, base.smartCardSentences), 1, 12),
    smartCardLeadChars: CW_clamp(CW_int(meta.smart_card_lead_chars || meta.smartcardleadchars, base.smartCardLeadChars), 0, 800),
    maxInjectChars: Math.max(1400, CW_int(meta.max_inject_chars || meta.maxinjectchars, base.maxInjectChars)),
    adaptiveContextBudget: CW_bool(meta.adaptive_context_budget || meta.adaptivecontextbudget, base.adaptiveContextBudget),
    maxContextShare: CW_clamp(CW_num(meta.max_context_share || meta.maxcontextshare, base.maxContextShare), 0.05, 0.50),
    minHistoryChars: Math.max(1000, CW_int(meta.min_history_chars || meta.minhistorychars, base.minHistoryChars)),
    maxCardChars: Math.max(250, CW_int(meta.max_card_chars || meta.maxcardchars, base.maxCardChars)),
    preservePlayerAgency: CW_bool(meta.preserve_player_agency || meta.preserveplayeragency, base.preservePlayerAgency),
    preserveEstablishedFacts: CW_bool(meta.preserve_established_facts || meta.preserveestablishedfacts, base.preserveEstablishedFacts),

    foreshadow: CW_bool(meta.foreshadow, base.foreshadow),
    foreshadowLead: Math.max(0, CW_int(meta.foreshadow_lead || meta.foreshadowlead, base.foreshadowLead)),
    maxForeshadowEvents: Math.max(0, CW_int(meta.max_foreshadow_events || meta.maxforeshadowevents, base.maxForeshadowEvents)),

    /* Franchise auto-builder. A plain franchise name is enough to start; the
       optional canon/source/range fields disambiguate properties with several
       continuities or adaptations. */
    franchise: String(meta.franchise || meta.franchise_name || meta.franchisename || base.franchise).replace(/^\s+|\s+$/g, ""),
    franchiseCanon: String(meta.franchise_canon || meta.franchisecanon || meta.continuity || base.franchiseCanon).replace(/^\s+|\s+$/g, ""),
    franchiseStart: String(meta.franchise_start || meta.franchisestart || base.franchiseStart).replace(/^\s+|\s+$/g, ""),
    franchiseEnd: String(meta.franchise_end || meta.franchiseend || base.franchiseEnd).replace(/^\s+|\s+$/g, ""),
    franchiseRoute: String(meta.franchise_route || meta.franchiseroute || base.franchiseRoute).replace(/^\s+|\s+$/g, ""),
    franchiseAutoGenerate: CW_bool(meta.franchise_auto_generate || meta.franchiseautogenerate, base.franchiseAutoGenerate),
    franchiseTargetEvents: CW_clamp(CW_int(meta.franchise_event_count || meta.franchiseeventcount || meta.franchise_target_events || meta.franchisetargetevents, base.franchiseTargetEvents), 1, 80),
    franchiseBatchSize: CW_clamp(CW_int(meta.franchise_batch_size || meta.franchisebatchsize, base.franchiseBatchSize), 1, 10),
    franchiseBuildEvery: Math.max(1, CW_int(meta.franchise_build_every || meta.franchisebuildevery, base.franchiseBuildEvery)),
    franchiseMaxFailures: Math.max(1, CW_int(meta.franchise_max_failures || meta.franchisemaxfailures, base.franchiseMaxFailures)),
    franchiseMaterializeCards: CW_bool(meta.franchise_materialize_cards || meta.franchisematerializecards, base.franchiseMaterializeCards),
    franchiseCleanupOld: CW_bool(meta.franchise_cleanup_old || meta.franchisecleanupold, base.franchiseCleanupOld),
    franchiseEnforcement: CW_mode(meta.franchise_enforcement || meta.franchiseenforcement || base.franchiseEnforcement) || base.franchiseEnforcement,
    franchiseDeadlinePolicy: CW_deadlinePolicy(meta.franchise_deadline_policy || meta.franchisedeadlinepolicy || base.franchiseDeadlinePolicy) || base.franchiseDeadlinePolicy,
    franchisePacing: CW_franchisePacing(meta.franchise_pacing || meta.franchisepacing || base.franchisePacing),
    franchiseFirstEventAt: Math.max(0, CW_int(meta.franchise_first_event_at || meta.franchisefirsteventat, base.franchiseFirstEventAt)),
    franchiseAutoInclude: CW_bool(meta.franchise_auto_include || meta.franchiseautoinclude, base.franchiseAutoInclude),
    franchiseConfidenceFloor: CW_clamp(CW_num(meta.franchise_confidence_floor || meta.franchiseconfidencefloor, base.franchiseConfidenceFloor), 0, 1),
    franchiseSourceCards: CW_bool(meta.franchise_source_cards || meta.franchisesourcecards, base.franchiseSourceCards),
    franchiseSourceChars: CW_clamp(CW_int(meta.franchise_source_chars || meta.franchisesourcechars, base.franchiseSourceChars), 0, 7000),
    franchiseScope: String(meta.franchise_scope || meta.franchisescope || base.franchiseScope).replace(/^\s+|\s+$/g, ""),
    franchiseFiller: CW_franchiseFiller(meta.franchise_filler || meta.franchisefiller || base.franchiseFiller),
    franchiseGranularity: CW_franchiseGranularity(meta.franchise_granularity || meta.franchisegranularity || base.franchiseGranularity),
    franchiseEventPolicy: CW_franchiseEventPolicy(meta.franchise_event_policy || meta.franchiseeventpolicy || base.franchiseEventPolicy),
    franchiseAnchorThreshold: CW_clamp(CW_int(meta.franchise_anchor_threshold || meta.franchiseanchorthreshold, base.franchiseAnchorThreshold), 1, 5),
    franchiseRequireSourceRef: CW_bool(meta.franchise_require_source_ref || meta.franchiserequiresourceref, base.franchiseRequireSourceRef),
    franchiseRoadmapCard: CW_bool(meta.franchise_roadmap_card || meta.franchiseroadmapcard, base.franchiseRoadmapCard),
    franchiseRoadmapMaxChars: CW_clamp(CW_int(meta.franchise_roadmap_max_chars || meta.franchiseroadmapmaxchars, base.franchiseRoadmapMaxChars), 700, 4000),
    franchisePlannerHistory: CW_clamp(CW_int(meta.franchise_planner_history || meta.franchiseplannerhistory, base.franchisePlannerHistory), 4, 40),
    franchiseGeneratedProtect: CW_bool(meta.franchise_generated_protect || meta.franchisegeneratedprotect, base.franchiseGeneratedProtect),
    franchiseGeneratedBlockers: CW_bool(meta.franchise_generated_blockers || meta.franchisegeneratedblockers, base.franchiseGeneratedBlockers),
    franchiseSourceMode: CW_franchiseSourceMode(meta.franchise_source_mode || meta.franchisesourcemode || base.franchiseSourceMode),
    franchiseDependencyStrategy: CW_franchiseDependencyStrategy(meta.franchise_dependency_strategy || meta.franchisedependencystrategy || base.franchiseDependencyStrategy),
    franchiseDivergence: CW_franchiseDivergence(meta.franchise_divergence || meta.franchisedivergence || base.franchiseDivergence),
    franchisePlayerRole: CW_franchisePlayerRole(meta.franchise_player_role || meta.franchiseplayerrole || base.franchisePlayerRole),
    franchisePlannerMaxChars: CW_clamp(CW_int(meta.franchise_planner_max_chars || meta.franchiseplannermaxchars, base.franchisePlannerMaxChars), 2600, 12000),
    franchisePlannerNonce: CW_bool(meta.franchise_planner_nonce || meta.franchiseplannernonce, base.franchisePlannerNonce),
    franchiseSourceFilterStrict: CW_bool(meta.franchise_source_filter_strict || meta.franchisesourcefilterstrict, base.franchiseSourceFilterStrict),
    franchiseRebuildOnSourceChange: CW_bool(meta.franchise_rebuild_on_source_change || meta.franchiserebuildonsourcechange, base.franchiseRebuildOnSourceChange),
    franchiseBuildMode: CW_franchiseBuildMode(meta.franchise_build_mode || meta.franchisebuildmode || base.franchiseBuildMode),
    franchiseDeliveryPolicy: CW_deliveryMode(meta.franchise_delivery_policy || meta.franchisedeliverypolicy || base.franchiseDeliveryPolicy) || "adaptive",
    franchiseOutcomePolicy: CW_outcomePolicy(meta.franchise_outcome_policy || meta.franchiseoutcomepolicy || base.franchiseOutcomePolicy) || "adaptive",

    validateGraph: CW_bool(meta.validate_graph || meta.validategraph, base.validateGraph),
    dashboard: CW_bool(meta.dashboard, base.dashboard),
    dashboardEvery: Math.max(1, CW_int(meta.dashboard_every || meta.dashboardevery, base.dashboardEvery)),
    hookHealth: CW_bool(meta.hook_health || meta.hookhealth, base.hookHealth),
    commandSafeMode: CW_bool(meta.command_safe_mode || meta.commandsafemode, base.commandSafeMode),
    debug: CW_bool(meta.debug, base.debug)
  };

  CW_state().debug = cfg.debug;
  return cfg;
}

function CW_applyEventDefaults(e, cfg) {
  if (!e.matchMode) e.matchMode = cfg.defaultMatch;
  if (!e.completionMatch) e.completionMatch = cfg.completionMatch;
  if (!e.blockerMatch) e.blockerMatch = cfg.blockerMatch;
  if (!e.mode) e.mode = cfg.defaultMode;
  if (!e.retries) e.retries = cfg.defaultRetries;
  if (!e.maxCycles) e.maxCycles = cfg.strongCycles;
  if (e.retryDelay < 0) e.retryDelay = cfg.retryDelay;
  if (e.deadlineGrace < 0) e.deadlineGrace = cfg.forceDeadlineGrace;
  if (!e.blockedPolicy) e.blockedPolicy = "wait";
  if (!e.deadlinePolicy) {
    if (e.catchUp === false) e.deadlinePolicy = "skip";
    else if (e.catchUp === true) e.deadlinePolicy = "catchup";
    else if (cfg.allowCatchUp === false) e.deadlinePolicy = "skip";
    else e.deadlinePolicy = cfg.defaultDeadlinePolicy;
  }
  if (!e.lead) e.lead = cfg.foreshadowLead;
  if (e.autoInclude === null) e.autoInclude = cfg.autoInclude;
  if (!e.delivery) e.delivery = "adaptive";
  if (!e.outcomePolicy) e.outcomePolicy = "flexible";
  if (!e.playerPresence) e.playerPresence = "optional";
  return e;
}

/* ========================================================================
 * EVIDENCE / MATCHING
 * ====================================================================== */

function CW_buildEvidenceRegistry(events, cfg) {
  if (events && events._cwEvidenceRegistry) return events._cwEvidenceRegistry;
  var registry = {}, i, x, e, key;
  function addTerms(list, matchMode, permanent) {
    for (x = 0; x < list.length; x++) {
      var term = list[x], ek = CW_evidenceKey(term, matchMode);
      if (!registry[ek]) registry[ek] = { term:term, mode:matchMode, permanent:!!permanent };
      else if (permanent) registry[ek].permanent = true;
    }
  }
  function addClauses(groups, matchMode, permanent) {
    var a, b;
    for (a = 0; a < groups.length; a++) for (b = 0; b < groups[a].length; b++) {
      var term = groups[a][b], ek = CW_evidenceKey(term, matchMode);
      if (!registry[ek]) registry[ek] = { term:term, mode:matchMode, permanent:!!permanent };
      else if (permanent) registry[ek].permanent = true;
    }
  }
  for (i = 0; i < events.length; i++) {
    e = CW_applyEventDefaults(events[i], cfg);
    addTerms(e.requireAll, e.matchMode, false); addTerms(e.requireAny, e.matchMode, false);
    addClauses(e.requireClauses, e.matchMode, false);
    addTerms(e.completeAny, e.completionMatch, false); addTerms(e.completeAll, e.completionMatch, false);
    addClauses(e.completeClauses, e.completionMatch, false); addTerms(e.progress, e.completionMatch, false);
    addTerms(e.unlessEver, e.blockerMatch, true);
  }
  try { events._cwEvidenceRegistry = registry; } catch (ignore) {}
  return registry;
}

function CW_observeText(events, text, source, cfg) {
  text = String(text || "");
  if (!text) return;
  var registry = CW_buildEvidenceRegistry(events, cfg);
  var s = CW_state(), src = source || "unknown", key;
  for (key in registry) {
    if (!registry.hasOwnProperty(key)) continue;
    var rr = registry[key];
    if (!CW_textMatchesTerm(text, rr.term, rr.mode, cfg)) continue;
    var old = s.seen[key], timeline = [];
    if (old && old.timeline && Object.prototype.toString.call(old.timeline) === "[object Array]") timeline = old.timeline.slice(0);
    else if (old) timeline.push({ turn:CW_seenTurn(old), source:old.source || "legacy" });
    var duplicate = false, z;
    for (z = timeline.length - 1; z >= 0 && z >= timeline.length - 4; z--) {
      if (timeline[z] && timeline[z].turn === (s.turn || 0) && timeline[z].source === src) { duplicate = true; break; }
    }
    if (!duplicate) timeline.push({ turn:s.turn || 0, source:src });
    if (timeline.length > 24) timeline.splice(0, timeline.length - 24);
    var last = timeline[timeline.length - 1] || {turn:s.turn || 0,source:src};
    s.seen[key] = { turn:last.turn, hits:timeline.length, source:last.source, permanent:!!rr.permanent || !!(old && old.permanent), timeline:timeline };
  }
}

function CW_textMatchesTerm(text, term, mode, cfg) {
  text = String(text || "");
  term = String(term || "").replace(/^\s+|\s+$/g, "");
  if (!text || !term) return false;

  /* /regex/ is explicit creator logic and is therefore not altered by fuzzy or
     negation heuristics. */
  if (term.length > 2 && term.charAt(0) === "/" && term.charAt(term.length - 1) === "/") {
    try { return new RegExp(term.slice(1,-1), "i").test(text); }
    catch (err) { return false; }
  }

  var forceStrict = term.charAt(0) === "=";
  if (forceStrict) term = term.slice(1);

  mode = CW_matchMode(forceStrict ? "strict" : (mode || (cfg ? cfg.defaultMatch : "balanced")));
  var nt = CW_normText(text);
  var np = CW_normText(term);

  if (CW_boundaryPhrase(nt, np)) {
    if (cfg && cfg.negationAware && !CW_termContainsNegation(np) && CW_phraseOnlyNegated(nt, np, cfg.negationWindow)) return false;
    return true;
  }
  if (mode === "strict") return false;

  var need = CW_contentTokens(np);
  if (!need.length) return false;
  var got = CW_tokenSet(nt);
  var hit = 0, i;
  for (i = 0; i < need.length; i++) if (got[CW_stem(need[i])]) hit += 1;

  var coverage = hit / need.length;
  var threshold = cfg ? cfg.fuzzyThreshold : CW_DEFAULTS.fuzzyThreshold;
  if (mode === "balanced") threshold = Math.max(0.8, threshold);
  if (mode === "loose") threshold = Math.min(0.66, threshold);

  if (need.length === 1 && need[0].length < 5) return false;
  if (coverage < threshold) return false;

  if (cfg && cfg.negationAware && !CW_termContainsNegation(np)) {
    var focus = need[need.length - 1];
    if (CW_tokenOnlyNegated(nt, focus, cfg.negationWindow)) return false;
  }
  return true;
}

function CW_boundaryPhrase(text, phrase) {
  if (!text || !phrase) return false;
  var at = text.indexOf(phrase);

  while (at !== -1) {
    var left = at === 0 ? " " : text.charAt(at - 1);
    var rightAt = at + phrase.length;
    var right = rightAt >= text.length ? " " : text.charAt(rightAt);
    if (!CW_isWordChar(left) && !CW_isWordChar(right)) return true;
    at = text.indexOf(phrase, at + 1);
  }

  return false;
}

function CW_isWordChar(c) { return /[a-z0-9_]/i.test(c || ""); }

function CW_contentTokens(s) {
  var raw = CW_normText(s).split(/[^a-z0-9']+/);
  var out = [];
  var seen = {};
  var i;

  for (i = 0; i < raw.length; i++) {
    var t = raw[i];
    if (!t || CW_STOPWORDS[t]) continue;
    t = CW_stem(t);
    if (t.length < 2 || seen[t]) continue;
    seen[t] = true;
    out.push(t);
  }

  return out;
}

function CW_tokenSet(s) {
  var raw = CW_normText(s).split(/[^a-z0-9']+/);
  var set = {};
  var i;
  for (i = 0; i < raw.length; i++) if (raw[i]) set[CW_stem(raw[i])] = 1;
  return set;
}

function CW_stem(t) {
  t = CW_normText(t);
  if (t.length > 6 && /ing$/.test(t)) t = t.slice(0,-3);
  else if (t.length > 5 && /ied$/.test(t)) t = t.slice(0,-3) + "y";
  else if (t.length > 5 && /ed$/.test(t)) t = t.slice(0,-2);
  else if (t.length > 5 && /es$/.test(t)) t = t.slice(0,-2);
  else if (t.length > 4 && /s$/.test(t) && !/ss$/.test(t)) t = t.slice(0,-1);
  return t;
}

function CW_termKey(term) { return CW_normText(String(term || "")); }

function CW_seen(term, within, mode) {
  var s = CW_state();
  var key = CW_evidenceKey(term, mode || "balanced");
  var rec = s.seen[key];
  /* Compatibility with schema-2 evidence keys. */
  if (!rec) rec = s.seen[CW_termKey(term)];
  if (!rec) return false;
  var turn = CW_seenTurn(rec);
  if (within > 0 && (s.turn - turn) > within) return false;
  return true;
}

function CW_anySeen(terms, within, mode) {
  var i;
  for (i = 0; i < terms.length; i++) if (CW_seen(terms[i], within, mode)) return true;
  return false;
}

function CW_allSeen(terms, within, mode) {
  var i;
  for (i = 0; i < terms.length; i++) if (!CW_seen(terms[i], within, mode)) return false;
  return true;
}

function CW_anyInText(terms, text, mode, cfg) {
  var i;
  for (i = 0; i < terms.length; i++) if (CW_textMatchesTerm(text, terms[i], mode, cfg)) return true;
  return false;
}

function CW_countInText(terms, text, mode, cfg) {
  var hit = 0, i;
  for (i = 0; i < terms.length; i++) if (CW_textMatchesTerm(text, terms[i], mode, cfg)) hit += 1;
  return hit;
}

function CW_allInText(terms, text, mode, cfg) {
  var i;
  for (i = 0; i < terms.length; i++) if (!CW_textMatchesTerm(text, terms[i], mode, cfg)) return false;
  return true;
}


function CW_evidenceKey(term, mode) {
  return CW_matchMode(mode || "balanced") + "|" + CW_termKey(term);
}

function CW_termContainsNegation(term) {
  return /\b(?:not|never|no|isn't|isnt|wasn't|wasnt|aren't|arent|weren't|werent|didn't|didnt|doesn't|doesnt|don't|dont|cannot|can't|cant|without)\b/i.test(term || "");
}

function CW_negatedPrefix(prefix) {
  return /\b(?:not|never|no|isn't|isnt|wasn't|wasnt|aren't|arent|weren't|werent|didn't|didnt|doesn't|doesnt|don't|dont|cannot|can't|cant|without)\b(?:\W+\w+){0,3}\W*$/i.test(prefix || "");
}

function CW_phraseOnlyNegated(text, phrase, window) {
  var at = text.indexOf(phrase);
  var found = false;
  while (at !== -1) {
    var left = at === 0 ? " " : text.charAt(at - 1);
    var rightAt = at + phrase.length;
    var right = rightAt >= text.length ? " " : text.charAt(rightAt);
    if (!CW_isWordChar(left) && !CW_isWordChar(right)) {
      found = true;
      var prefix = text.slice(Math.max(0, at - window), at);
      if (!CW_negatedPrefix(prefix)) return false;
    }
    at = text.indexOf(phrase, at + 1);
  }
  return found;
}

function CW_tokenOnlyNegated(text, token, window) {
  var re = new RegExp("\\b" + CW_escapeRegex(token) + "\\b", "ig");
  var m, found = false;
  while ((m = re.exec(text))) {
    found = true;
    var prefix = text.slice(Math.max(0, m.index - window), m.index);
    if (!CW_negatedPrefix(prefix)) return false;
  }
  return found;
}

function CW_allClauseGroupsInText(groups, text, mode, cfg) {
  var i, j, ok;
  for (i = 0; i < groups.length; i++) {
    ok = false;
    for (j = 0; j < groups[i].length; j++) if (CW_textMatchesTerm(text, groups[i][j], mode, cfg)) { ok = true; break; }
    if (!ok) return false;
  }
  return true;
}

function CW_allClauseGroupsSeen(groups, within, mode) {
  var i, j, ok;
  for (i = 0; i < groups.length; i++) {
    ok = false;
    for (j = 0; j < groups[i].length; j++) if (CW_seen(groups[i][j], within, mode)) { ok = true; break; }
    if (!ok) return false;
  }
  return true;
}

function CW_placeholderMatches(spec, mode, cfg) {
  var arr = (state && state.placeholders) ? state.placeholders : [];
  spec = String(spec || "").replace(/^\s+|\s+$/g, "");
  if (!spec) return false;
  var eq = spec.indexOf("=");
  var q = eq >= 0 ? spec.slice(0, eq).replace(/^\s+|\s+$/g, "") : "";
  var v = eq >= 0 ? spec.slice(eq + 1).replace(/^\s+|\s+$/g, "") : spec;
  var i;
  for (i = 0; i < arr.length; i++) {
    var p = arr[i] || {};
    if (q && !CW_textMatchesTerm(String(p.question || ""), "=" + q, "strict", cfg)) continue;
    if (CW_textMatchesTerm(String(p.answer || ""), v, mode, cfg)) return true;
  }
  return false;
}

function CW_allPlaceholders(specs, mode, cfg) {
  var i;
  for (i = 0; i < specs.length; i++) if (!CW_placeholderMatches(specs[i], mode, cfg)) return false;
  return true;
}

function CW_anyPlaceholder(specs, mode, cfg) {
  var i;
  for (i = 0; i < specs.length; i++) if (CW_placeholderMatches(specs[i], mode, cfg)) return true;
  return false;
}

function CW_recentSceneText(count) {
  var h = (typeof history !== "undefined" && history) ? history : [];
  var start = Math.max(0, h.length - count);
  var parts = [];
  var i;

  for (i = start; i < h.length; i++) {
    if (h[i] && typeof h[i].text === "string") parts.push(h[i].text);
  }

  var s = CW_state();
  if (s.lastInput) parts.push(s.lastInput);
  return parts.join("\n");
}

/* ========================================================================
 * SCHEDULER / ELIGIBILITY
 * ====================================================================== */

function CW_selectEvent(events, cfg) {
  var s = CW_state();
  var scene = CW_recentSceneText(cfg.sceneActions);
  var candidates = [];
  var i;

  if (s.manualFire) {
    var manual = CW_findEvent(events, s.manualFire);
    s.manualFire = null;
    if (manual) {
      CW_applyEventDefaults(manual, cfg);
      return manual;
    }
  }

  for (i = 0; i < events.length; i++) {
    var e = CW_applyEventDefaults(events[i], cfg);
    var check = CW_eligibility(e, scene, events, cfg, false);
    var es = CW_eventState(e.id);
    if (check.ok) {
      if (!es.eligibleSince) es.eligibleSince = s.turn;
      es.lastEligibleTurn = s.turn;
      candidates.push({ event: e, score: CW_eventScore(e, check, cfg) });
    } else if (check.why !== "global-cooldown" && check.why !== "event-cooldown" && check.why !== "repeat-wait" && check.why !== "backoff") {
      es.eligibleSince = 0;
    }
  }

  candidates.sort(function(a,b) {
    if (a.score !== b.score) return b.score - a.score;
    if (a.event.priority !== b.event.priority) return b.event.priority - a.event.priority;
    return a.event.id < b.event.id ? -1 : 1;
  });

  return candidates.length ? candidates[0].event : null;
}

function CW_eligibility(e, scene, events, cfg, foreshadowOnly) {
  var s = CW_state();
  var es = CW_eventState(e.id);
  var turn = s.turn;
  var timeline = CW_effectiveTimeline(e);
  var late = timeline.before > 0 && turn > timeline.before;
  var policy = e.deadlinePolicy || cfg.defaultDeadlinePolicy;
  var forceDeadline = late && policy === "force" && turn > (timeline.before + Math.max(0, e.deadlineGrace || 0));

  /* Auto-generated events belong to one franchise build-set. Old generated
     cards can stay in the Story Card database without ever firing after the
     creator changes franchise/continuity or explicitly rebuilds the roadmap. */
  if (e.generatedSet) {
    if (!cfg.franchise || !s.franchise || e.generatedSet !== s.franchise.activeSet) return { ok:false, why:"inactive-franchise-set" };
    if (e.generatedFor && e.generatedFor !== CW_slug(cfg.franchise)) return { ok:false, why:"wrong-franchise" };
  }

  if (s.cancelled[e.id]) return { ok:false, why:"cancelled" };
  if (s.stalled[e.id]) return { ok:false, why:"stalled" };

  var count = s.occurrences[e.id] || 0;
  if (count >= e.maxOccurrences) return { ok:false, why:"max-occurrences" };
  if (e.once && s.completed[e.id]) return { ok:false, why:"complete" };
  if (es.nextEligibleTurn && turn < es.nextEligibleTurn) return { ok:false, why:"backoff" };

  if (e.group && s.groupOwners[e.group] && s.groupOwners[e.group] !== e.id) return { ok:false, why:"group-owned" };
  if (turn < timeline.at) return { ok:false, why:"early" };

  if (late && policy === "skip") {
    CW_markMissed(e, "deadline-skip", "context");
    return { ok:false, why:"deadline-skip" };
  }

  if (cfg.globalCooldown > 0 && (turn - s.lastEventTurn) < cfg.globalCooldown) return { ok:false, why:"global-cooldown" };
  if (e.cooldown > 0 && es.lastCompleteTurn && (turn - es.lastCompleteTurn) < e.cooldown) return { ok:false, why:"event-cooldown" };
  if (e.repeatEvery > 0 && es.lastCompleteTurn && (turn - es.lastCompleteTurn) < e.repeatEvery) return { ok:false, why:"repeat-wait" };

  if (!CW_dependenciesOK(e, events)) return { ok:false, why:"dependency" };
  if (!CW_arcOrderOK(e, events)) return { ok:false, why:"arc-order" };

  var i;
  for (i = 0; i < e.flags.length; i++) if (!s.flags[CW_slug(e.flags[i])]) return {ok:false,why:"flag"};
  for (i = 0; i < e.notFlags.length; i++) if (s.flags[CW_slug(e.notFlags[i])]) return {ok:false,why:"not-flag"};

  if (e.placeholderAll.length && !CW_allPlaceholders(e.placeholderAll, e.matchMode, cfg)) return {ok:false,why:"placeholder-all"};
  if (e.placeholderAny.length && !CW_anyPlaceholder(e.placeholderAny, e.matchMode, cfg)) return {ok:false,why:"placeholder-any"};
  if (e.placeholderNot.length && CW_anyPlaceholder(e.placeholderNot, e.matchMode, cfg)) return {ok:false,why:"placeholder-not"};

  if (e.requireAll.length && !CW_allSeen(e.requireAll, e.requireWithin, e.matchMode)) return {ok:false,why:"require-all"};
  if (e.requireAny.length && !CW_anySeen(e.requireAny, e.requireWithin, e.matchMode)) return {ok:false,why:"require-any"};
  if (e.requireClauses.length && !CW_allClauseGroupsSeen(e.requireClauses, e.requireWithin, e.matchMode)) return {ok:false,why:"require-clauses"};
  if (e.unlessEver.length && CW_anySeen(e.unlessEver, 0, e.blockerMatch)) {
    if (e.blockedPolicy === "skip") {
      CW_markMissed(e, "blocked-contradiction", "context");
      return {ok:false,why:"blocked-skip"};
    }
    return {ok:false,why:"unless"};
  }
  if (e.sceneUnless.length && CW_anyInText(e.sceneUnless, scene, e.blockerMatch, cfg)) return {ok:false,why:"scene-unless"};

  if (!forceDeadline) {
    if (e.whenAny.length && CW_countInText(e.whenAny, scene, e.matchMode, cfg) < Math.min(e.whenMin, e.whenAny.length)) return {ok:false,why:"when-min"};
    if (e.whenAll.length && !CW_allInText(e.whenAll, scene, e.matchMode, cfg)) return {ok:false,why:"when-all"};
    if (e.whenClauses.length && !CW_allClauseGroupsInText(e.whenClauses, scene, e.matchMode, cfg)) return {ok:false,why:"when-clauses"};
  }

  if (foreshadowOnly) return { ok:true, late:late, forced:forceDeadline, timeline:timeline };

  if (e.delay > 0) {
    if (!s.gates[e.id]) {
      s.gates[e.id] = turn;
      es.status = "armed";
      es.armedTurn = turn;
      return {ok:false,why:"delay"};
    }
    if ((turn - s.gates[e.id]) < e.delay) return {ok:false,why:"delay"};
  }

  if (e.chance < 100) {
    var chanceKey = e.id + "#" + String(count + 1);
    if (typeof s.chance[chanceKey] !== "boolean") s.chance[chanceKey] = (Math.random() * 100) < e.chance;
    if (!s.chance[chanceKey]) return {ok:false,why:"chance"};
  }

  return { ok:true, late:late, forced:forceDeadline, timeline:timeline };
}


function CW_resolutionTurn(id) {
  var s = CW_state();
  id = CW_slug(id);
  if (typeof s.completed[id] === "number") return s.completed[id];
  if (s.missed[id] && typeof s.missed[id].turn === "number") return s.missed[id].turn;
  if (s.cancelled[id] && typeof s.cancelled[id] === "object" && typeof s.cancelled[id].turn === "number") return s.cancelled[id].turn;
  return 0;
}

function CW_resolved(id) {
  var s = CW_state();
  id = CW_slug(id);
  return !!s.completed[id] || !!s.missed[id] || !!s.cancelled[id];
}

function CW_dependencyAnchorTurn(e) {
  var s = CW_state();
  var anchor = 0, i, t;
  for (i = 0; i < e.after.length; i++) {
    t = s.completed[CW_slug(e.after[i])] || 0;
    if (t > anchor) anchor = t;
  }
  for (i = 0; i < e.afterAny.length; i++) {
    t = s.completed[CW_slug(e.afterAny[i])] || 0;
    if (t > anchor) anchor = t;
  }
  for (i = 0; i < e.afterResolved.length; i++) {
    t = CW_resolutionTurn(e.afterResolved[i]);
    if (t > anchor) anchor = t;
  }
  return anchor;
}

function CW_effectiveTimeline(e) {
  var at = e.at || 0;
  var before = e.before || 0;
  var anchor = CW_dependencyAnchorTurn(e);

  if (anchor > 0 && e.afterDelay > 0) at = Math.max(at, anchor + e.afterDelay);
  if (anchor > 0 && e.afterBefore > 0) {
    var relBefore = anchor + e.afterBefore;
    before = before > 0 ? Math.min(before, relBefore) : relBefore;
  }
  return { at:at, before:before, anchor:anchor };
}

function CW_dependenciesOK(e, events) {
  var s = CW_state();
  var i;

  for (i = 0; i < e.after.length; i++) if (!CW_completed(CW_slug(e.after[i]))) return false;
  for (i = 0; i < e.afterResolved.length; i++) if (!CW_resolved(CW_slug(e.afterResolved[i]))) return false;

  if (e.afterAny.length) {
    var ok = false;
    for (i = 0; i < e.afterAny.length; i++) if (CW_completed(CW_slug(e.afterAny[i]))) { ok = true; break; }
    if (!ok) return false;
  }

  for (i = 0; i < e.afterNot.length; i++) if (CW_completed(CW_slug(e.afterNot[i]))) return false;
  return true;
}

function CW_arcOrderOK(e, events) {
  if (!e.arc || !e.strictOrder || !e.order) return true;
  var i;

  for (i = 0; i < events.length; i++) {
    var other = events[i];
    if (other.id === e.id) continue;
    if (CW_slug(other.arc) === e.arc && other.order > 0 && other.order < e.order) {
      if (e.strictOrderResolved ? !CW_resolved(other.id) : !CW_completed(other.id)) return false;
    }
  }

  return true;
}

function CW_completed(id) {
  var s = CW_state();
  return !!s.completed[CW_slug(id)];
}

function CW_eventScore(e, check, cfg) {
  var s = CW_state();
  var timeline = check.timeline || CW_effectiveTimeline(e);
  var score = e.priority * 100;
  var overdue = timeline.before > 0 ? Math.max(0, s.turn - timeline.before) : 0;
  var age = Math.max(0, s.turn - timeline.at);
  score += Math.min(5000, overdue * 120);
  score += Math.min(1500, age * 10);
  if (check.forced) score += 10000;
  if (e.mode === "force") score += 250;
  if (cfg.fairScheduler) {
    var es = CW_eventState(e.id);
    var waited = es.eligibleSince ? Math.max(0, s.turn - es.eligibleSince) : 0;
    if (waited >= cfg.starvationTurns) score += Math.min(9000, cfg.starvationBoost + (waited - cfg.starvationTurns) * 140);
  }
  return score;
}

function CW_selectPreemptor(events, active, cfg) {
  if (!active || active.mode === "force") return null;
  var scene = CW_recentSceneText(cfg.sceneActions), best = null, bestScore = -1, i;
  var activeScore = active.priority * 100;
  for (i = 0; i < events.length; i++) {
    var e = CW_applyEventDefaults(events[i], cfg);
    if (e.id === active.id) continue;
    var check = CW_eligibility(e, scene, events, cfg, false);
    if (!check.ok || (!check.forced && e.mode !== "force")) continue;
    if ((e.priority - active.priority) < cfg.preemptPriorityGap && !check.forced) continue;
    var sc = CW_eventScore(e, check, cfg);
    if (sc > bestScore && sc > activeScore + cfg.preemptPriorityGap * 100) { best = e; bestScore = sc; }
  }
  return best;
}

function CW_preemptActive(active, incoming, cfg) {
  var s = CW_state(), aes = CW_eventState(active.id);
  aes.status = "cooldown";
  aes.nextEligibleTurn = Math.max(aes.nextEligibleTurn || 0, s.turn + 1);
  aes.preemptions = (aes.preemptions || 0) + 1;
  aes.lastReason = "preempted-by:" + incoming.id;
  s.activeId = null; s.active = null;
  CW_activate(incoming, cfg);
  CW_log("Preempted " + active.id + " for urgent event " + incoming.id);
}

function CW_activate(e, cfg) {
  var s = CW_state();
  var es = CW_eventState(e.id);

  s.activeId = e.id;
  s.active = { id:e.id, startedTurn:s.turn };
  es.status = "active";
  es.startedTurn = s.turn;
  es.attempts = 0;
  es.injections = 0;
  es.lastReason = "activated";
  delete s.missed[e.id];

  CW_log("Activated " + e.id + " at turn " + s.turn);
}

function CW_reconcileEvents(events) {
  var s = CW_state();
  if (s.activeId && !CW_findEvent(events, s.activeId)) {
    CW_log("Active event card removed: " + s.activeId, true);
    s.activeId = null;
    s.active = null;
  }
}

/* ========================================================================
 * FORESHADOWING
 * ====================================================================== */

function CW_selectForeshadow(events, cfg) {
  var s = CW_state();
  var scene = CW_recentSceneText(cfg.sceneActions);
  var out = [];
  var i;

  for (i = 0; i < events.length; i++) {
    var e = CW_applyEventDefaults(events[i], cfg);
    var tl = CW_effectiveTimeline(e);
    if (!e.lead || !tl.at) continue;
    if (s.turn >= tl.at || s.turn < (tl.at - e.lead)) continue;
    if (CW_completed(e.id) || s.cancelled[e.id] || s.stalled[e.id]) continue;

    var shadow = CW_shallowClone(e);
    shadow.at = 0;
    shadow.afterDelay = 0;
    shadow.afterBefore = 0;
    shadow.whenAny = [];
    shadow.whenAll = [];
    shadow.whenClauses = [];
    shadow.delay = 0;
    var check = CW_eligibility(shadow, scene, events, cfg, true);
    if (!check.ok) continue;
    out.push(e);
  }

  out.sort(function(a,b) {
    var da = CW_effectiveTimeline(a).at - s.turn;
    var db = CW_effectiveTimeline(b).at - s.turn;
    if (da !== db) return da - db;
    return b.priority - a.priority;
  });
  return out.slice(0, cfg.maxForeshadowEvents);
}

function CW_buildForeshadowInjection(e, cfg) {
  var tl = CW_effectiveTimeline(e);
  var seed = e.seed || e.bridge || ("Quietly position the ongoing story so the canon beat '" + e.title + "' can occur naturally soon. Do not trigger the beat yet.");
  var lines = [
    "[CANON WEAVE — FUTURE CONTINUITY SEED]",
    "Upcoming beat: " + e.title,
    "Timing: approximately " + Math.max(0, tl.at - CW_state().turn) + " action(s) away.",
    "Seed: " + seed,
    "Do not announce this planning instruction or prematurely resolve the event."
  ];
  if (cfg.preservePlayerAgency) lines.push("Preserve player agency while arranging world/NPC circumstances.");
  lines.push("[END CANON SEED]");
  return "\n\n" + lines.join("\n");
}

/* ========================================================================
 * COMPLETION / PROGRESS / EVENT RESULTS
 * ====================================================================== */

function CW_recordCompletionEvidence(e, output, cfg) {
  var s = CW_state();
  if (!s.completionEvidence[e.id]) s.completionEvidence[e.id] = {};
  var led = s.completionEvidence[e.id];
  var all = e.completeAny.concat(e.completeAll, CW_flattenClauses(e.completeClauses));
  var i;
  for (i = 0; i < all.length; i++) {
    if (CW_textMatchesTerm(output, all[i], e.completionMatch, cfg)) led[CW_evidenceKey(all[i], e.completionMatch)] = s.turn;
  }
}

function CW_eventCompleted(e, output, cfg) {
  if (e.completeUnless.length && CW_anyInText(e.completeUnless, output, e.blockerMatch, cfg)) return false;

  if (e.completeRegex) {
    try { if (new RegExp(e.completeRegex, "i").test(output || "")) return true; }
    catch (err) { CW_log("Bad complete_regex on " + e.id, true); }
  }

  var s = CW_state();
  var led = s.completionEvidence[e.id] || {};
  var i, j, k, t, ok;

  if (e.completeAll.length) {
    for (i = 0; i < e.completeAll.length; i++) {
      k = CW_evidenceKey(e.completeAll[i], e.completionMatch);
      t = led[k];
      if (typeof t !== "number" || (s.turn - t) >= e.completeWithin) return false;
    }
  }

  if (e.completeClauses.length) {
    for (i = 0; i < e.completeClauses.length; i++) {
      ok = false;
      for (j = 0; j < e.completeClauses[i].length; j++) {
        k = CW_evidenceKey(e.completeClauses[i][j], e.completionMatch);
        t = led[k];
        if (typeof t === "number" && (s.turn - t) < e.completeWithin) { ok = true; break; }
      }
      if (!ok) return false;
    }
  }

  if (e.completeAll.length || e.completeClauses.length) return true;
  if (e.completeAny.length) {
    var minNeed = Math.min(Math.max(1, e.completeMin || 1), e.completeAny.length);
    var hits = 0;
    for (i = 0; i < e.completeAny.length; i++) {
      k = CW_evidenceKey(e.completeAny[i], e.completionMatch); t = led[k];
      if (typeof t === "number" && (s.turn - t) < e.completeWithin) hits += 1;
    }
    if (hits >= minNeed) return true;
  }
  if (!e.completeAny.length && !e.completeAll.length && !e.completeClauses.length && !e.completeRegex) return true;
  return false;
}

function CW_eventProgressed(e, output, cfg) {
  return e.progress.length ? CW_anyInText(e.progress, output, e.completionMatch, cfg) : false;
}

function CW_complete(e, reason, cfg, source) {
  var s = CW_state();
  var es = CW_eventState(e.id);
  var i;
  var setFlags = [], clearFlags = [], cancels = [];

  for (i = 0; i < e.setFlags.length; i++) setFlags.push(CW_slug(e.setFlags[i]));
  for (i = 0; i < e.clearFlags.length; i++) clearFlags.push(CW_slug(e.clearFlags[i]));
  for (i = 0; i < e.cancel.length; i++) cancels.push(CW_slug(e.cancel[i]));

  CW_journalPush({
    kind:"complete",
    source:source || "output",
    turn:s.turn || 0,
    eventId:e.id,
    group:e.group || "",
    setFlags:setFlags,
    clearFlags:clearFlags,
    cancel:cancels,
    reason:reason
  });

  s.completed[e.id] = s.turn || 0;
  s.occurrences[e.id] = (s.occurrences[e.id] || 0) + 1;
  delete s.chance[e.id + "#" + String(s.occurrences[e.id])];
  s.lastEventTurn = s.turn || 0;

  es.status = "complete";
  es.lastCompleteTurn = s.turn || 0;
  es.lastReason = reason;
  es.attempts = 0;
  es.cycles = 0;
  es.nextEligibleTurn = e.repeatEvery > 0 ? s.turn + e.repeatEvery : 0;

  if (e.group) s.groupOwners[e.group] = e.id;
  for (i = 0; i < setFlags.length; i++) s.flags[setFlags[i]] = true;
  for (i = 0; i < clearFlags.length; i++) delete s.flags[clearFlags[i]];
  for (i = 0; i < cancels.length; i++) s.cancelled[cancels[i]] = { turn:s.turn || 0, reason:"cancelled-by-event", by:e.id };

  delete s.gates[e.id];
  delete s.missed[e.id];
  delete s.stalled[e.id];
  delete s.completionEvidence[e.id];
  s.activeId = null;
  s.active = null;
  CW_log("Completed " + e.id + " (" + reason + ")");
}

function CW_markMissed(e, reason, source) {
  var s = CW_state();
  var es = CW_eventState(e.id);
  s.missed[e.id] = { turn:s.turn, reason:reason, source:source || "context" };
  es.status = "missed";
  es.lastReason = reason;
  CW_log("Missed " + e.id + ": " + reason, true);
}

function CW_stallEvent(e, reason, cfg, source) {
  var s = CW_state();
  var es = CW_eventState(e.id);
  s.stalled[e.id] = { turn:s.turn, reason:reason, source:source || "output" };
  es.status = "stalled";
  es.lastReason = reason;
  s.activeId = null;
  s.active = null;
  CW_toast("CANON WEAVE: '" + e.title + "' stalled. Add a fallback or completion rule, then /canon reset " + e.id);
  CW_log("Stalled " + e.id + ": " + reason, true);
}

/* ========================================================================
 * ACTIVE CONTEXT INJECTION
 * ====================================================================== */

function CW_buildActiveInjection(e, cards, cfg) {
  var s = CW_state();
  var es = CW_eventState(e.id);
  es.injections += 1;

  var urgency = CW_urgency(e, es);
  var scene = CW_recentSceneText(cfg.sceneActions);
  var support = CW_resolveSupportingCards(e, cards, scene, cfg);
  var lines = [];
  var i;

  lines.push("[CANON WEAVE — ACTIVE CONTINUITY CONTROL]");
  lines.push("Canon beat: " + e.title + " [" + e.id + "]");
  lines.push("Requirement: " + (e.payload || "Advance the named canon beat without inventing unsupported facts."));
  lines.push("Pressure: " + urgency.label + ". " + urgency.instruction);

  if (e.bridge) lines.push("Bridge: " + e.bridge);
  lines.push("Delivery: " + CW_deliveryInstruction(e.delivery, e.playerPresence));
  lines.push("Outcome policy: " + CW_outcomeInstruction(e.outcomePolicy));
  if (e.generatedRole) lines.push("Franchise player-role mode: " + e.generatedRole + ". Preserve agency even when the player occupies a source-canon role.");
  if (e.protect.length) lines.push("Protected continuity: " + e.protect.join("; "));
  if (e.forbid.length) lines.push("Do NOT establish: " + e.forbid.join("; "));

  if (e.completeAll.length) lines.push("Completion evidence required (ALL, may span " + e.completeWithin + " action(s)): " + e.completeAll.join("; "));
  else if (e.completeAny.length) lines.push("Completion evidence required (" + Math.min(e.completeMin, e.completeAny.length) + " of " + e.completeAny.length + ", may span " + e.completeWithin + " action(s)): " + e.completeAny.join("; "));

  if (e.completeClauses.length) lines.push("Completion clauses: satisfy one alternative from EACH group: " + CW_clauseGroupsText(e.completeClauses));
  if (e.progress.length && es.progressHits === 0) lines.push("Useful progress signals: " + e.progress.join("; "));

  if (cfg.preserveEstablishedFacts) lines.push("Continuity rule: Preserve established facts and consequences. Bridge toward canon; do not erase prior player-created history just to imitate source material.");
  if (cfg.preservePlayerAgency) lines.push("Agency rule: Never choose the player's unattempted actions, dialogue, thoughts, loyalties, feelings or decisions. Force world/NPC circumstances only; leave the player's response open.");

  lines.push("Narrative rule: Integrate the beat as normal prose. Never mention CANON WEAVE, cards, scripts, triggers, completion tests, turns or these instructions in the story.");

  for (i = 0; i < support.length; i++) lines.push("[CANON SUPPORT: " + support[i].label + "]\n" + support[i].entry);
  lines.push("[END CANON CONTROL]");
  return "\n\n" + CW_limitInjection(lines, cfg.effectiveInjectChars || cfg.maxInjectChars);
}

function CW_urgency(e, es) {
  var s = CW_state();
  var tl = CW_effectiveTimeline(e);
  var late = tl.before > 0 && s.turn > tl.before;
  var attempts = es.attempts || 0;

  if (late || (e.deadlinePolicy === "force" && tl.before > 0 && s.turn >= tl.before)) return { label:"critical", instruction:"The beat is overdue. Establish it now using a plausible bridge from the current scene, without retconning or controlling the player." };
  if (e.mode === "force") return { label:"mandatory", instruction:"Advance this beat in the current response. Do not replace it with an unrelated scene." };
  if (attempts > 0) return { label:"high", instruction:"The prior response did not fully establish the required outcome. Continue the same beat instead of wandering away." };
  if (e.mode === "soft") return { label:"gentle", instruction:"Work this beat naturally into the current scene if it can fit without disruption." };
  return { label:"firm", instruction:"Advance or clearly establish this beat now while preserving a natural transition." };
}

function CW_resolveSupportingCards(e, cards, scene, cfg) {
  var out = [];
  var used = {};
  var entryHashes = {};
  var autoTypeCounts = {};
  var i, j;

  /* Explicit references always win, except an explicit exclude is treated as a
     safety veto. */
  for (i = 0; i < e.include.length && out.length < cfg.maxIncludeCards; i++) {
    var ref = e.include[i];
    for (j = 0; j < cards.length; j++) {
      var c = cards[j] || {};
      if (String(c.id) === String(e.cardId) || used[String(c.id)] || CW_isControlCard(c) || CW_cardExcluded(e, c)) continue;
      if (CW_cardMatchesRef(c, ref)) { CW_pushSupport(out, used, c, cfg, entryHashes, false, e.payload + " " + e.title); break; }
    }
  }

  if (!e.autoInclude || cfg.autoIncludeCards <= 0 || out.length >= cfg.maxIncludeCards) return out;

  var query = [e.payload, e.title, e.completeAny.join(" "), e.completeAll.join(" "), CW_flattenClauses(e.completeClauses).join(" "), scene].join(" ");
  var ranked = [];

  for (i = 0; i < cards.length; i++) {
    var card = cards[i] || {};
    if (String(card.id) === String(e.cardId) || used[String(card.id)] || CW_isControlCard(card) || CW_cardExcluded(e, card)) continue;
    if (!card.entry) continue;
    if (e.includeTypes.length && !CW_typeAllowed(card.type, e.includeTypes)) continue;
    if (e.excludeTypes.length && CW_typeAllowed(card.type, e.excludeTypes)) continue;

    var score = CW_cardRelevance(card, query, cfg);
    if (score >= cfg.autoIncludeMinScore) ranked.push({ card:card, score:score });
  }

  ranked.sort(function(a,b) {
    if (a.score !== b.score) return b.score - a.score;
    return String(a.card.id) < String(b.card.id) ? -1 : 1;
  });

  var autoLimit = Math.min(cfg.autoIncludeCards, cfg.maxIncludeCards - out.length);
  var picked = 0;

  if (cfg.autoIncludeDiversity) {
    var types = {};
    for (i = 0; i < ranked.length && picked < autoLimit; i++) {
      var t = CW_normText(ranked[i].card.type || "other");
      if (types[t]) continue;
      types[t] = true;
      var dt = CW_normText(ranked[i].card.type || "other");
      if ((autoTypeCounts[dt] || 0) >= cfg.autoIncludeTypeCap) continue;
      if (!CW_pushSupport(out, used, ranked[i].card, cfg, entryHashes, true, query)) continue;
      autoTypeCounts[dt] = (autoTypeCounts[dt] || 0) + 1;
      picked += 1;
    }
  }

  for (i = 0; i < ranked.length && picked < autoLimit; i++) {
    if (used[String(ranked[i].card.id)]) continue;
    var at = CW_normText(ranked[i].card.type || "other");
    if ((autoTypeCounts[at] || 0) >= cfg.autoIncludeTypeCap) continue;
    if (!CW_pushSupport(out, used, ranked[i].card, cfg, entryHashes, true, query)) continue;
    autoTypeCounts[at] = (autoTypeCounts[at] || 0) + 1;
    picked += 1;
  }

  return out;
}

function CW_pushSupport(out, used, card, cfg, entryHashes, isAuto, query) {
  var entry = String(card.entry || "").replace(/^\s+|\s+$/g, "");
  if (!entry) return false;
  if (isAuto && cfg.smartCardExtract) entry = CW_extractRelevantCardEntry(entry, query || "", cfg);
  if (entry.length > cfg.maxCardChars) entry = entry.slice(0, cfg.maxCardChars) + "…";

  entryHashes = entryHashes || {};
  var eh = CW_hash(CW_normText(entry).slice(0, 900));
  if (isAuto && cfg.autoIncludeDedupe && entryHashes[eh]) return false;

  out.push({
    id: card.id,
    label: String(card.title || card.type || card.keys || ("Story Card " + card.id)),
    entry: entry
  });
  used[String(card.id)] = true;
  entryHashes[eh] = true;
  return true;
}

function CW_extractRelevantCardEntry(entry, query, cfg) {
  entry = String(entry || "").replace(/^\s+|\s+$/g, "");
  if (!entry || entry.length <= cfg.maxCardChars) return entry;
  var lead = cfg.smartCardLeadChars > 0 ? entry.slice(0, cfg.smartCardLeadChars).replace(/\s+$/g, "") : "";
  var sentences = entry.match(/[^.!?\n]+(?:[.!?]+|$)/g) || [entry];
  var qs = CW_tokenSet(query || ""), ranked = [], i, j;
  for (i = 0; i < sentences.length; i++) {
    var sentence = String(sentences[i] || "").replace(/^\s+|\s+$/g, "");
    if (!sentence || sentence.length < 18) continue;
    var toks = CW_contentTokens(sentence), hit = 0;
    for (j = 0; j < toks.length; j++) if (qs[toks[j]]) hit += 1;
    var score = hit * 5 + (i === 0 ? 3 : 0) - Math.min(3, sentence.length / 500);
    if (hit > 0 || i === 0) ranked.push({i:i, text:sentence, score:score});
  }
  ranked.sort(function(a,b){ if (a.score !== b.score) return b.score-a.score; return a.i-b.i; });
  ranked = ranked.slice(0, Math.max(1, cfg.smartCardSentences));
  ranked.sort(function(a,b){ return a.i-b.i; });
  var parts = [], seen = {};
  if (lead) { parts.push(lead); seen[CW_normText(lead)] = true; }
  for (i = 0; i < ranked.length; i++) {
    var k = CW_normText(ranked[i].text);
    if (!seen[k]) { parts.push(ranked[i].text); seen[k] = true; }
  }
  var out = parts.join(" ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  return out || entry.slice(0, cfg.maxCardChars);
}

function CW_deliveryMode(v) {
  v = CW_norm(v || "");
  if (v === "scene" || v === "world" || v === "offscreen" || v === "adaptive") return v;
  return "";
}
function CW_outcomePolicy(v) {
  v = CW_norm(v || "");
  if (v === "fixed" || v === "flexible" || v === "opportunity" || v === "adaptive") return v;
  return "";
}
function CW_playerPresence(v) {
  v = CW_norm(v || "");
  if (v === "required" || v === "optional" || v === "none") return v;
  return "";
}
function CW_deliveryInstruction(mode, presence) {
  mode = mode || "adaptive"; presence = presence || "optional";
  var p = presence === "required" ? "The player must be able to witness/participate, but do not teleport or puppet them; bridge them there through world circumstances." : (presence === "none" ? "Do not require the player's physical presence; the event may occur through the canon cast/world and reach the player through consequences." : "Player presence is optional; use whichever presentation best fits established location and agency.");
  if (mode === "offscreen") return "Offscreen/world consequence permitted. " + p;
  if (mode === "world") return "Treat this as a world event that can progress regardless of the player's exact location. " + p;
  if (mode === "scene") return "Keep the beat in the current/on-screen scene when logically possible. " + p;
  return "Adapt presentation to the current adventure instead of teleporting the player. " + p;
}
function CW_outcomeInstruction(mode) {
  if (mode === "fixed") return "Preserve the required world-side canon outcome unless established facts make it impossible; never force an unchosen player decision to obtain it.";
  if (mode === "opportunity") return "Preserve the canon opportunity, pressure or confrontation, but leave the player's decision and resulting branch genuinely open.";
  if (mode === "adaptive") return "Preserve the source event's narrative function, adapting participants/details/outcome when legitimate player-caused divergence requires it.";
  return "Preserve the core canon beat while allowing details and consequences to adapt to established play.";
}

function CW_cardRelevance(card, query, cfg) {
  var score = 0;
  var nq = CW_normText(query);
  var keys = CW_terms(card.keys || "");
  var qs = CW_tokenSet(nq);
  var i;

  for (i = 0; i < keys.length; i++) {
    var k = CW_normText(keys[i]);
    if (!k || k.indexOf("%cw:") === 0) continue;
    var kt = CW_contentTokens(k);
    if (CW_boundaryPhrase(nq, k)) score += 10 + Math.min(4, kt.length);
    else {
      var hit = 0, j;
      for (j = 0; j < kt.length; j++) if (qs[kt[j]]) hit++;
      if (kt.length && hit === kt.length) score += 5;
      else if (kt.length > 1 && hit / kt.length >= 0.66) score += 2;
    }
  }

  var title = CW_normText(card.title || "");
  if (title && CW_boundaryPhrase(nq, title)) score += 12;

  /* Entry is deliberately a weak signal. It improves cards with poor triggers
     without allowing a generic lore paragraph to outrank an exact key. */
  var lead = String(card.entry || "").slice(0, 520);
  var et = CW_contentTokens(lead);
  var overlap = 0;
  for (i = 0; i < et.length; i++) if (et[i].length >= 4 && qs[et[i]]) overlap++;
  score += Math.min(4, overlap * 0.6);
  return score;
}

function CW_cardMatchesRef(card, ref) {
  ref = String(ref || "").replace(/^\s+|\s+$/g, "");
  if (!ref) return false;
  var nr = CW_normText(ref);

  if (nr.indexOf("id:") === 0) return String(card.id) === ref.slice(3).replace(/^\s+|\s+$/g, "");
  if (nr.indexOf("type:") === 0) return CW_normText(card.type || "") === CW_normText(ref.slice(5));

  var keyOnly = null;
  if (nr.indexOf("key:") === 0 || nr.indexOf("trigger:") === 0) {
    keyOnly = ref.slice(ref.indexOf(":") + 1).replace(/^\s+|\s+$/g, "");
    nr = CW_normText(keyOnly);
  }

  if (!keyOnly && CW_normText(String(card.id)) === nr) return true;
  if (!keyOnly && card.title && CW_normText(card.title) === nr) return true;

  var keys = CW_terms(card.keys || "");
  var i;
  for (i = 0; i < keys.length; i++) if (CW_normText(keys[i]) === nr) return true;
  return false;
}


function CW_cardExcluded(e, card) {
  var i;
  if (e.excludeTypes && e.excludeTypes.length && CW_typeAllowed(card.type, e.excludeTypes)) return true;
  for (i = 0; i < (e.exclude || []).length; i++) if (CW_cardMatchesRef(card, e.exclude[i])) return true;
  return false;
}

function CW_typeAllowed(type, allowed) {
  var nt = CW_normText(type || "");
  var i;
  for (i = 0; i < allowed.length; i++) if (CW_normText(allowed[i]) === nt) return true;
  return false;
}

function CW_isControlCard(c) {
  var t = CW_norm(c.type || "");
  return t === "canon event" || t === "canon" || t === "canon config" || t === "canon weave config" || t === "canon dashboard" || t === "canon roadmap" || t === "canon source" || t === "franchise source" || t === "source canon" || CW_firstMarker(c.entry || "") !== "";
}

function CW_limitInjection(lines, limit) {
  var out = [];
  var used = 0;
  var i;

  for (i = 0; i < lines.length; i++) {
    var line = String(lines[i] || "");
    if (used + line.length + 1 > limit) {
      var room = Math.max(0, limit - used - 80);
      if (room > 80) out.push(line.slice(0, room) + "…");
      out.push("[Canon support truncated to configured context budget.]");
      break;
    }
    out.push(line);
    used += line.length + 1;
  }

  return out.join("\n");
}

function CW_compactBlocks(blocks, maxChars) {
  var out = "";
  var i;
  for (i = 0; i < blocks.length; i++) {
    var b = String(blocks[i] || "");
    if (!b) continue;
    if (out.length + b.length > maxChars) {
      var room = maxChars - out.length;
      if (room > 150) out += b.slice(0, room - 1);
      break;
    }
    out += b;
  }
  return out;
}

function CW_effectiveInjectBudget(cfg) {
  var hard = Math.max(1200, cfg.maxInjectChars || CW_DEFAULTS.maxInjectChars);
  if (!cfg.adaptiveContextBudget || typeof info === "undefined" || !info || typeof info.maxChars !== "number" || info.maxChars <= 0) return hard;

  /* Never reserve more canon text than the runtime can physically hold.
     The preferred floor is 1200 chars on normal contexts, but tiny/test
     contexts fall back gracefully instead of returning a budget > maxChars. */
  var runtimeMax = Math.max(1, Math.floor(info.maxChars));
  var floor = Math.min(1200, Math.max(320, runtimeMax));
  var byShare = Math.max(floor, Math.floor(runtimeMax * cfg.maxContextShare));
  var byReserve = Math.max(floor, runtimeMax - cfg.minHistoryChars);
  return Math.min(runtimeMax, Math.max(floor, Math.min(hard, byShare, byReserve)));
}

function CW_appendWithinBudget(text, injection, cfg) {
  text = String(text || "");
  injection = String(injection || "");
  if (!injection) return text;

  var max = 0, memLen = 0;
  if (typeof info !== "undefined" && info) {
    if (typeof info.maxChars === "number") max = info.maxChars;
    if (typeof info.memoryLength === "number") memLen = info.memoryLength;
  }

  if (!max || text.length + injection.length <= max) return text + injection;
  if (injection.length >= max) return injection.slice(injection.length - max);

  memLen = CW_clamp(memLen, 0, text.length);
  var prefix = text.slice(0, memLen);
  var body = text.slice(memLen);
  var room = max - prefix.length - injection.length;

  if (room < 0) {
    prefix = prefix.slice(0, Math.max(0, max - injection.length));
    room = 0;
  }

  if (body.length > room) body = body.slice(body.length - room);
  return prefix + body + injection;
}


/* ========================================================================
 * FRANCHISE AUTO-BUILDER
 * ====================================================================== */

function CW_ensureFranchiseState(s) {
  s = s || CW_state();
  s.franchise = s.franchise || {};
  var f = s.franchise;
  if (typeof f.identity !== "string") f.identity = "";
  if (typeof f.name !== "string") f.name = "";
  if (typeof f.activeSet !== "string") f.activeSet = "";
  if (typeof f.session !== "number") f.session = 0;
  if (typeof f.status !== "string") f.status = "idle";
  if (typeof f.generated !== "number") f.generated = 0;
  if (typeof f.target !== "number") f.target = 0;
  if (typeof f.batches !== "number") f.batches = 0;
  if (typeof f.failures !== "number") f.failures = 0;
  if (typeof f.lastPlanTurn !== "number") f.lastPlanTurn = -999999;
  if (typeof f.lastCapturedAction !== "number") f.lastCapturedAction = -999999;
  if (typeof f.lastMissedAction !== "number") f.lastMissedAction = -999999;
  if (Object.prototype.toString.call(f.eventIds) !== "[object Array]") f.eventIds = [];
  if (Object.prototype.toString.call(f.titles) !== "[object Array]") f.titles = [];
  if (typeof f.complete !== "boolean") f.complete = false;
  if (typeof f.paused !== "boolean") f.paused = false;
  if (typeof f.lastReason !== "string") f.lastReason = "";
  if (typeof f.cursor !== "string") f.cursor = "";
  if (Object.prototype.toString.call(f.sourceRefs) !== "[object Array]") f.sourceRefs = [];
  if (Object.prototype.toString.call(f.suggestions) !== "[object Array]") f.suggestions = [];
  if (typeof f.lastBatchSummary !== "string") f.lastBatchSummary = "";
  if (typeof f.roadmapKey !== "string") f.roadmapKey = "";
  if (Object.prototype.toString.call(f.anchorIds) !== "[object Array]") f.anchorIds = [];
  if (typeof f.lastAnchorId !== "string") f.lastAnchorId = "";
  if (typeof f.lastStableId !== "string") f.lastStableId = "";
  if (typeof f.lastSourceModeNotice !== "string") f.lastSourceModeNotice = "";
  if (typeof f.planNonce !== "string") f.planNonce = "";
  if (typeof f.sourceHash !== "string") f.sourceHash = "";
  if (typeof f.sourceChanged !== "boolean") f.sourceChanged = false;
  if (typeof f.manualBuildRequested !== "boolean") f.manualBuildRequested = false;
  if (typeof f.lastSourceChangeNotice !== "string") f.lastSourceChangeNotice = "";
  return f;
}

function CW_franchiseBuildMode(v) {
  v = CW_norm(v || "steady");
  if (v === "frontload" || v === "fast") return "frontload";
  if (v === "manual" || v === "off") return "manual";
  return "steady";
}

function CW_franchisePacing(v) {
  v = CW_norm(v || "normal");
  if (v === "compressed" || v === "fast") return "compressed";
  if (v === "slow" || v === "expanded") return "slow";
  return "normal";
}

function CW_franchiseFiller(v) {
  v = CW_norm(v || "exclude");
  if (v === "include" || v === "all") return "include";
  if (v === "only" || v === "filler-only" || v === "filler only") return "only";
  return "exclude";
}

function CW_franchiseGranularity(v) {
  v = CW_norm(v || "major");
  if (v === "anchor" || v === "anchors" || v === "backbone") return "anchors";
  if (v === "detailed" || v === "dense" || v === "full") return "detailed";
  return "major";
}

function CW_franchiseEventPolicy(v) {
  v = CW_norm(v || "tiered");
  return v === "uniform" ? "uniform" : "tiered";
}

function CW_franchiseSourceMode(v) {
  v = CW_norm(v || "prefer");
  if (v === "ignore" || v === "off" || v === "none") return "ignore";
  if (v === "require" || v === "required" || v === "source-only") return "require";
  return "prefer";
}

function CW_franchiseDependencyStrategy(v) {
  v = CW_norm(v || "backbone");
  return v === "linear" ? "linear" : "backbone";
}

function CW_franchiseDivergence(v) {
  v = CW_norm(v || "adaptive");
  if (v === "strict") return "strict";
  if (v === "reactive" || v === "player-first" || v === "player first") return "reactive";
  return "adaptive";
}

function CW_franchisePlayerRole(v) {
  v = CW_norm(v || "original_character").replace(/[ -]+/g, "_");
  if (v === "canon_protagonist" || v === "protagonist") return "canon_protagonist";
  if (v === "replacement" || v === "replace_protagonist") return "replacement";
  if (v === "observer" || v === "supporting") return "observer";
  return "original_character";
}

function CW_franchiseTierPolicy(raw, cfg) {
  raw = raw || {};
  var importance = CW_clamp(CW_int(raw.importance, 3), 1, 5);
  var hard = CW_bool(raw.hard_canon || raw.hardcanon, false);
  var kind = CW_norm(raw.kind || raw.type || "major");

  if (cfg.franchiseEventPolicy === "uniform") {
    return { mode: cfg.franchiseEnforcement, deadline: cfg.franchiseDeadlinePolicy };
  }

  if (hard || importance >= 5 || kind === "anchor") {
    return { mode: cfg.franchiseEnforcement, deadline: cfg.franchiseDeadlinePolicy };
  }

  if (kind === "conditional" || importance <= 2) {
    return { mode: "soft", deadline: "catchup" };
  }

  if (importance >= cfg.franchiseAnchorThreshold) {
    return { mode: "strong", deadline: cfg.franchiseDeadlinePolicy };
  }

  return { mode: "strong", deadline: "catchup" };
}

function CW_franchiseWindow(pacing) {
  if (pacing === "compressed") return { min:1, max:4 };
  if (pacing === "slow") return { min:6, max:14 };
  return { min:3, max:8 };
}

function CW_franchiseIdentity(cfg) {
  if (!cfg.franchise) return "";
  return [
    CW_norm(cfg.franchise),
    CW_norm(cfg.franchiseCanon),
    CW_norm(cfg.franchiseStart),
    CW_norm(cfg.franchiseEnd),
    CW_norm(cfg.franchiseRoute),
    CW_norm(cfg.franchiseScope),
    CW_norm(cfg.franchiseFiller),
    CW_norm(cfg.franchiseGranularity),
    CW_norm(cfg.franchiseEventPolicy),
    CW_norm(cfg.franchiseSourceMode),
    CW_norm(cfg.franchiseDependencyStrategy),
    CW_norm(cfg.franchiseDivergence),
    CW_norm(cfg.franchisePlayerRole),
    CW_norm(cfg.franchiseDeliveryPolicy),
    CW_norm(cfg.franchiseOutcomePolicy)
  ].join("|");
}

function CW_applyFranchiseConfig(parsed, cfg) {
  var s = CW_state();
  var f = CW_ensureFranchiseState(s);
  var identity = CW_franchiseIdentity(cfg);
  var sourceHash = CW_franchiseSourceSignature(parsed, cfg);
  var identityWithSource = identity;
  if (cfg.franchiseSourceMode !== "ignore" && sourceHash) identityWithSource += "|source:" + sourceHash;

  if (!identity) {
    f.status = "disabled";
    f.target = 0;
    f.complete = false;
    return;
  }

  f.target = cfg.franchiseTargetEvents;

  if (f.identity && identity && f.identity !== identityWithSource && f.sourceHash && sourceHash && f.sourceHash !== sourceHash && !cfg.franchiseRebuildOnSourceChange && f.generated > 0) {
    f.sourceChanged = true;
    f.paused = true;
    f.status = "source_changed";
    f.lastReason = "canon-source-changed";
    f.sourceHash = sourceHash;
    f.identity = identityWithSource;
    if (f.lastSourceChangeNotice !== sourceHash) {
      f.lastSourceChangeNotice = sourceHash;
      CW_toast("Canon Weave: Canon Source changed. Existing roadmap kept safe; use /canon franchise rebuild after reviewing it.");
    }
  } else if (f.identity !== identityWithSource) {
    if (cfg.franchiseCleanupOld) CW_removeGeneratedFranchiseCards();

    f.session += 1;
    f.identity = identityWithSource;
    f.name = cfg.franchise;
    f.activeSet = CW_slug(cfg.franchise) + "_" + String(f.session) + "_" + CW_hash(identity).slice(0, 6);
    f.status = cfg.franchiseAutoGenerate ? "building" : "ready";
    f.generated = 0;
    f.batches = 0;
    f.failures = 0;
    f.lastPlanTurn = -999999;
    f.lastCapturedAction = -999999;
    f.lastMissedAction = -999999;
    f.eventIds = [];
    f.titles = [];
    f.complete = false;
    f.paused = false;
    f.lastReason = "new-franchise";
    f.sourceHash = sourceHash;
    f.sourceChanged = false;
    f.cursor = "";
    f.sourceRefs = [];
    f.suggestions = [];
    f.lastBatchSummary = "";
    f.anchorIds = [];
    f.lastAnchorId = "";
    f.lastStableId = "";
    f.lastSourceModeNotice = "";
    f.planNonce = "";
    f.roadmapKey = "%CW:ROADMAP:" + f.activeSet + "%";
    CW_toast("Canon Weave: preparing canon roadmap for " + cfg.franchise + ".");
  }

  /* Recount current generated cards so reloads and duplicate-safe addStoryCard
     behaviour cannot inflate the progress counter. */
  var ids = {}, titles = {}, i, e;
  for (i = 0; i < parsed.events.length; i++) {
    e = parsed.events[i];
    if (!e.generatedSet || e.generatedSet !== f.activeSet) continue;
    ids[e.id] = true;
    if (e.title) titles[CW_norm(e.title)] = e.title;
  }
  for (i = 0; i < f.eventIds.length; i++) ids[CW_slug(f.eventIds[i])] = true;
  f.eventIds = [];
  for (var id in ids) if (ids.hasOwnProperty(id)) f.eventIds.push(id);
  f.titles = [];
  for (var tk in titles) if (titles.hasOwnProperty(tk)) f.titles.push(titles[tk]);
  f.generated = f.eventIds.length;
  f.anchorIds = [];
  f.lastAnchorId = "";
  f.lastStableId = "";
  for (i = 0; i < parsed.events.length; i++) {
    e = parsed.events[i];
    if (!e.generatedSet || e.generatedSet !== f.activeSet) continue;
    if (e.generatedKind === "anchor") { f.anchorIds.push(e.id); f.lastAnchorId = e.id; }
    if (e.generatedKind !== "minor" && e.generatedKind !== "conditional") f.lastStableId = e.id;
  }

  if (f.generated >= f.target) {
    f.complete = true;
    /* Source changes are a review state, not a build-progress state. Keep the
       warning visible even when the old roadmap already met its event target. */
    if (!f.sourceChanged && f.status !== "source_changed") f.status = "ready";
  } else if (!f.paused && cfg.franchiseAutoGenerate && f.status !== "uncertain" && f.status !== "needs_continuity" && f.status !== "needs_source" && f.status !== "source_changed" && f.status !== "failed") {
    f.status = "building";
  }
}

function CW_filterGeneratedEvents(parsed, cfg) {
  var s = CW_state();
  var activeSet = s.franchise && s.franchise.activeSet ? s.franchise.activeSet : "";
  parsed.events = (parsed.events || []).filter(function(e) {
    if (!e.generatedSet) return true;
    return !!cfg.franchise && !!activeSet && e.generatedSet === activeSet;
  });
}

function CW_removeGeneratedFranchiseCards() {
  if (typeof storyCards === "undefined" || !storyCards) return 0;
  if (typeof removeStoryCard !== "function") return 0;

  var removed = 0;
  var i;
  for (i = storyCards.length - 1; i >= 0; i--) {
    var c = storyCards[i] || {};
    var keys = String(c.keys || "");
    var entry = String(c.entry || "");
    if (keys.indexOf("%CW:AUTO:") === 0 || keys.indexOf("%CW:ROADMAP:") === 0 || /generated_by\s*:\s*franchise/i.test(entry)) {
      try { if (CW_apiRemoveStoryCard(i) !== false) removed += 1; } catch (err) { CW_log("Could not remove generated franchise card index " + i + ": " + CW_errorText(err)); }
    }
  }
  return removed;
}

function CW_shouldBuildFranchise(cfg) {
  var s = CW_state();
  var f = CW_ensureFranchiseState(s);

  if (!cfg.franchise || !cfg.franchiseAutoGenerate) return false;
  if (cfg.franchiseBuildMode === "manual" && !f.manualBuildRequested) return false;
  if (f.paused || f.complete || f.status === "uncertain" || f.status === "needs_continuity" || f.status === "needs_source" || f.status === "failed") return false;
  if (f.generated >= f.target) return false;
  if (f.failures >= cfg.franchiseMaxFailures) {
    f.status = "failed";
    f.lastReason = "planner-failure-limit";
    return false;
  }
  var every = cfg.franchiseBuildMode === "frontload" ? 1 : cfg.franchiseBuildEvery;
  if ((s.turn - f.lastPlanTurn) < every) return false;
  /* Never generate two roadmaps for the same output action. Retries at that
     action can still regenerate story text without multiplying cards. */
  if (f.lastCapturedAction === s.turn) return false;
  return true;
}

function CW_buildFranchisePlannerInjection(parsed, cfg) {
  if (!CW_shouldBuildFranchise(cfg)) return "";

  var s = CW_state();
  var f = CW_ensureFranchiseState(s);
  var source = CW_franchiseSourceContext(parsed, cfg);
  if (cfg.franchiseSourceMode === "require" && !source) {
    f.status = "needs_source";
    f.lastReason = "source-card-required";
    if (f.lastSourceModeNotice !== f.activeSet) {
      f.lastSourceModeNotice = f.activeSet;
      CW_toast("Canon Weave needs a Canon Source Story Card before it can build this franchise roadmap.");
    }
    CW_updateFranchiseRoadmapCard(cfg, f);
    return "";
  }
  var remaining = Math.max(0, f.target - f.generated);
  var batch = Math.min(cfg.franchiseBatchSize, remaining);
  if (batch <= 0) return "";

  f.lastPlanTurn = s.turn;
  f.planNonce = cfg.franchisePlannerNonce ? CW_hash(f.activeSet + "|" + String(s.turn) + "|" + String(f.batches) + "|" + String(f.generated)) : "";
  f.manualBuildRequested = false;

  var previous = [];
  var start = Math.max(0, f.titles.length - cfg.franchisePlannerHistory);
  var i;
  for (i = start; i < f.titles.length; i++) previous.push(f.titles[i]);

  var lines = [];
  lines.push("\n\n[CANON WEAVE — BACKGROUND FRANCHISE ROADMAP BUILDER]");
  lines.push("This is a hidden machine task performed alongside the NORMAL story continuation. Do NOT replace, shorten, summarize, or derail the story response because of this task.");
  lines.push("After the normal story response, append exactly one franchise-plan JSON block. The Output script will remove that block before the player sees it.");
  if (f.planNonce) lines.push("Planner nonce: " + f.planNonce + ". The block MUST use this exact nonce so stray story text cannot be mistaken for machine data.");
  lines.push("Franchise: " + cfg.franchise);
  if (cfg.franchiseCanon) lines.push("Continuity/adaptation: " + cfg.franchiseCanon);
  if (cfg.franchiseStart) lines.push("Start boundary: " + cfg.franchiseStart);
  if (cfg.franchiseEnd) lines.push("End boundary: " + cfg.franchiseEnd);
  if (cfg.franchiseRoute) lines.push("Route/focus: " + cfg.franchiseRoute);
  if (cfg.franchiseScope) lines.push("Scope instructions: " + cfg.franchiseScope);
  lines.push("Filler policy: " + cfg.franchiseFiller + ". Granularity: " + cfg.franchiseGranularity + ".");
  lines.push("Player role: " + cfg.franchisePlayerRole + ". Divergence policy: " + cfg.franchiseDivergence + ". Dependency strategy: " + cfg.franchiseDependencyStrategy + ".");
  lines.push("Need: up to " + batch + " NEW chronological canon events. Already built: " + f.generated + "/" + f.target + ".");
  if (previous.length) lines.push("Recent generated event titles (do not repeat them): " + previous.join(" ; "));
  if (f.cursor) lines.push("Continue after this roadmap cursor/source position: " + f.cursor);
  if (f.sourceRefs.length) lines.push("Recent source references already used: " + f.sourceRefs.slice(Math.max(0, f.sourceRefs.length - 12)).join(" ; "));
  lines.push("Accuracy rules: use established source canon only; never invent an event to fill the quota. If multiple continuities fit and the config does not disambiguate them, return status=needs_continuity with 2-5 short continuity_options. If knowledge is too uncertain, return status=uncertain.");
  if (cfg.franchiseFiller === "exclude") lines.push("Exclude filler-only/anime-original/non-canon beats unless the configured continuity explicitly treats them as canon.");
  if (cfg.franchiseFiller === "only") lines.push("Generate only filler/anime-original side-continuity beats that fit the selected continuity.");
  if (cfg.franchiseGranularity === "anchors") lines.push("Select only backbone/anchor events whose removal would materially change the main source plot.");
  if (cfg.franchiseGranularity === "detailed") lines.push("Include anchors plus important intermediate developments, reveals, confrontations, arrivals, departures and arc transitions; still avoid trivia.");
  lines.push("Each event must be a compact plot beat, never copied dialogue. Keep player agency open: define world/NPC circumstances and observable outcomes, not an unchosen player decision.");
  if (cfg.franchisePlayerRole === "original_character") lines.push("The player is an original character: do not assume they replace the canon protagonist. Let canon cast/world events carry source beats unless the adventure naturally involves the player.");
  if (cfg.franchisePlayerRole === "canon_protagonist") lines.push("The player occupies the source protagonist role, but never write their unchosen dialogue, feelings or decisions. Frame source decisions as pressures/opportunities when necessary.");
  if (cfg.franchisePlayerRole === "replacement") lines.push("The player replaces the source protagonist in major plot functions. Preserve world-side canon while adapting role-specific beats around the player's established identity and choices.");
  if (cfg.franchisePlayerRole === "observer") lines.push("The player is not required to personally perform canon-protagonist actions. Let the canon cast complete world-side source events off the player's agency when appropriate.");
  if (cfg.franchiseDivergence === "strict") lines.push("Strict divergence policy: preserve backbone events whenever logically possible; mark a blocker only when the event is genuinely impossible without retconning established facts.");
  if (cfg.franchiseDivergence === "adaptive") lines.push("Adaptive divergence policy: preserve backbone outcomes, but rewrite bridges and participants around legitimate player-caused changes. Mark impossible events with specific blockers so later backbone events can continue.");
  if (cfg.franchiseDivergence === "reactive") lines.push("Reactive divergence policy: player-created consequences outrank source imitation. Keep canon opportunities, but make route-dependent or contradicted beats soft/skip-safe rather than forcing a retcon.");
  lines.push("JSON schema (valid JSON only, no markdown fence):");
  lines.push('{"protocol":"CW1","nonce":"' + (f.planNonce || '') + '","status":"ok|uncertain|needs_continuity","reason":"","continuity_options":["option"],"cursor":"next source position","complete":false,"batch_summary":"short summary","events":[{"id":"short_unique_id","title":"Event title","arc":"arc_name","kind":"anchor|major|minor|conditional","hard_canon":false,"source_ref":"season/episode/chapter/mission/arc if known","importance":1,"confidence":0.9,"delivery":"adaptive|scene|world|offscreen","outcome":"fixed|flexible|opportunity|adaptive","player_presence":"required|optional|none","when":["concrete scene cue"],"complete":["observable outcome phrase"],"support":["exact character/location/item names"],"blockers":["specific outcome making this beat impossible"],"protect":["continuity fact to preserve"],"forbid":["retcon/outcome to avoid"],"seed":"brief foreshadow setup","bridge":"world-side route into this beat if the player diverges","body":"2-4 sentence canon-event summary"}]}');
  lines.push("importance is 1-5 and confidence is 0-1. Use kind=anchor only for true backbone events. hard_canon=true only when the event must occur in the selected continuity rather than being route/choice dependent. Keep IDs lowercase/simple. Return events in source chronology. Set complete=true only when the configured end boundary is reached or there are no more qualifying events in scope.");

  if (source && cfg.franchiseSourceMode !== "ignore") {
    lines.push(cfg.franchiseSourceMode === "require" ? "Creator-provided Canon Source Story Cards are the authoritative generation boundary: do not create events unsupported by this supplied source material." : "Creator-provided Canon Source Story Cards override uncertain memory when they conflict:");
    lines.push(source);
  }

  lines.push("Append the block at the very END of the normal story response:");
  lines.push(f.planNonce ? ("<CW_FRANCHISE_PLAN nonce=\"" + f.planNonce + "\">{...valid JSON...}</CW_FRANCHISE_PLAN>") : "<CW_FRANCHISE_PLAN>{...valid JSON...}</CW_FRANCHISE_PLAN>");
  lines.push("[END CANON WEAVE FRANCHISE BUILDER]");
  return CW_limitInjection(lines, cfg.franchisePlannerMaxChars);
}

function CW_parseCanonSourceCard(card) {
  var entry = String((card || {}).entry || ""), parsed = {meta:{}, body:entry};
  if (CW_norm(entry.split(/\r?\n/)[0] || "") === "@canon_source") parsed = CW_parseMetaBlock(entry, "@canon_source");
  return { meta:parsed.meta || {}, body:String(parsed.body || "").replace(/^\s+|\s+$/g, "") };
}

function CW_sourceCardMatches(src, cfg) {
  var m = src.meta || {}, f = CW_norm(m.franchise || m.property || ""), c = CW_norm(m.continuity || m.canon || "");
  if (f && cfg.franchise && f !== CW_norm(cfg.franchise)) return false;
  if (c && cfg.franchiseCanon && c !== CW_norm(cfg.franchiseCanon)) {
    if (cfg.franchiseSourceFilterStrict) return false;
    if (CW_norm(cfg.franchiseCanon).indexOf(c) === -1 && c.indexOf(CW_norm(cfg.franchiseCanon)) === -1) return false;
  }
  return true;
}

function CW_franchiseSourceSignature(parsed, cfg) {
  if (!cfg.franchise || cfg.franchiseSourceMode === "ignore" || !cfg.franchiseSourceCards) return "";
  var cards = parsed.cards || [], parts = [], i;
  for (i = 0; i < cards.length; i++) {
    var c = cards[i] || {}, t = CW_norm(c.type || "");
    if (t !== "canon source" && t !== "franchise source" && t !== "source canon") continue;
    var src = CW_parseCanonSourceCard(c);
    if (!CW_sourceCardMatches(src, cfg)) continue;
    parts.push(String(c.id) + ":" + CW_hash(JSON.stringify(src.meta || {}) + "|" + src.body));
  }
  return parts.length ? CW_hash(parts.join("|")) : "";
}

function CW_franchiseSourceContext(parsed, cfg) {
  if (cfg.franchiseSourceMode === "ignore") return "";
  if (!cfg.franchiseSourceCards || cfg.franchiseSourceChars <= 0) return "";
  var cards = parsed.cards || [], out = [], used = 0, i;
  for (i = 0; i < cards.length; i++) {
    var c = cards[i] || {}, t = CW_norm(c.type || "");
    if (t !== "canon source" && t !== "franchise source" && t !== "source canon") continue;
    var src = CW_parseCanonSourceCard(c);
    if (!CW_sourceCardMatches(src, cfg) || !src.body) continue;
    var header = [];
    if (src.meta.source_ref || src.meta.ref) header.push("Ref " + (src.meta.source_ref || src.meta.ref));
    if (src.meta.range) header.push("Range " + src.meta.range);
    var chunk = (header.length ? ("[" + header.join(" • ") + "]\n") : "") + src.body;
    var room = cfg.franchiseSourceChars - used;
    if (room <= 0) break;
    if (chunk.length > room) chunk = chunk.slice(0, room);
    out.push(chunk); used += chunk.length + 1;
  }
  return out.join("\n");
}

function CW_captureFranchisePlan(output, parsed, cfg) {
  output = String(output || "");
  var s0 = CW_state(), f0 = CW_ensureFranchiseState(s0);
  var re = /<CW_FRANCHISE_PLAN(?:\s+nonce=["']?([^"'>\s]+)["']?)?>([\s\S]*?)<\/CW_FRANCHISE_PLAN>/gi;
  var m, payload = "", nonce = "";
  while ((m = re.exec(output))) { nonce = String(m[1] || ""); payload = String(m[2] || ""); }

  var cleaned = output.replace(/<CW_FRANCHISE_PLAN(?:\s+nonce=["']?[^"'>\s]+["']?)?>[\s\S]*?<\/CW_FRANCHISE_PLAN>/gi, "");
  var orphanRe = f0.planNonce ? new RegExp("<CW_FRANCHISE_PLAN\\s+nonce=[\"']?" + CW_escapeRegex(f0.planNonce), "i") : /<CW_FRANCHISE_PLAN>/i;
  var om = orphanRe.exec(cleaned);
  if (om) cleaned = cleaned.slice(0, om.index);
  cleaned = cleaned.replace(/\s+$/g, "");

  if (payload && cfg.franchisePlannerNonce && f0.planNonce && nonce !== f0.planNonce) {
    CW_log("Ignored franchise planner block with wrong nonce.", true);
    payload = "";
  }

  if (!payload) {
    var fMiss = CW_ensureFranchiseState(CW_state());
    if (cfg.franchise && fMiss.lastPlanTurn === CW_state().turn && fMiss.lastCapturedAction !== CW_state().turn && fMiss.lastMissedAction !== CW_state().turn) {
      fMiss.lastMissedAction = CW_state().turn;
      fMiss.failures += 1;
      fMiss.lastReason = "planner-block-missing-or-invalid";
      if (fMiss.failures >= cfg.franchiseMaxFailures) {
        fMiss.status = "failed";
        CW_toast("Canon Weave franchise builder paused after repeated planner failures. Use /canon franchise rebuild after adjusting the config.");
      }
    }
    return cleaned;
  }

  if (!cfg.franchise) return cleaned;

  var s = CW_state();
  var f = CW_ensureFranchiseState(s);

  if (f.lastCapturedAction === s.turn) return cleaned;
  f.lastCapturedAction = s.turn;
  f.lastMissedAction = -999999;

  payload = payload.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  var plan;
  try {
    plan = JSON.parse(payload);
  } catch (err) {
    f.failures += 1;
    f.lastReason = "invalid-json";
    CW_log("Franchise planner returned invalid JSON: " + CW_errorText(err), true);
    if (f.failures >= cfg.franchiseMaxFailures) f.status = "failed";
    return cleaned;
  }

  if (cfg.franchisePlannerNonce && f.planNonce) {
    if (String(plan.protocol || "") !== "CW1" || String(plan.nonce || "") !== f.planNonce) {
      f.failures += 1; f.lastReason = "planner-protocol-mismatch";
      CW_log("Franchise planner protocol/nonce mismatch.", true);
      return cleaned;
    }
  }
  var planStatus = CW_norm((plan && plan.status) || "ok");
  if (plan && planStatus !== "ok" && planStatus !== "uncertain" && planStatus !== "needs_continuity") {
    f.failures += 1;
    f.lastReason = "invalid-plan-status";
    return cleaned;
  }
  if (!plan || planStatus === "uncertain" || planStatus === "needs_continuity") {
    f.status = planStatus === "needs_continuity" ? "needs_continuity" : "uncertain";
    f.lastReason = String((plan && plan.reason) || "franchise-or-continuity-uncertain");
    f.suggestions = CW_jsonStringArray(plan && plan.continuity_options, 5);
    if (f.suggestions.length) {
      CW_toast("Canon Weave needs a continuity for " + cfg.franchise + ": " + f.suggestions.join(" / ") + ". Set franchise_canon, then rebuild.");
    } else {
      CW_toast("Canon Weave could not confidently auto-build " + cfg.franchise + ". Add franchise_canon or a Canon Source card, then use /canon franchise rebuild.");
    }
    CW_updateFranchiseRoadmapCard(cfg, f);
    return cleaned;
  }

  f.cursor = String(plan.cursor || f.cursor || "").replace(/^\s+|\s+$/g, "");
  f.lastBatchSummary = String(plan.batch_summary || "").replace(/^\s+|\s+$/g, "");

  var events = Object.prototype.toString.call(plan.events) === "[object Array]" ? plan.events : [];
  var added = 0;
  var max = Math.min(events.length, cfg.franchiseBatchSize, Math.max(0, f.target - f.generated));
  var i;

  for (i = 0; i < max; i++) {
    if (CW_materializeFranchiseEvent(events[i], cfg, f)) added += 1;
  }

  f.batches += 1;
  if (added === 0 && events.length) f.failures += 1;
  else if (added > 0) f.failures = 0;

  f.generated = f.eventIds.length;
  var rawRefs = [];
  for (i = 0; i < max; i++) {
    var sr = String((events[i] || {}).source_ref || "").replace(/^\s+|\s+$/g, "");
    if (sr) rawRefs.push(sr);
  }
  f.sourceRefs = CW_unique((f.sourceRefs || []).concat(rawRefs));
  if (f.sourceRefs.length > 40) f.sourceRefs = f.sourceRefs.slice(f.sourceRefs.length - 40);
  if (CW_bool(plan.complete, false) || f.generated >= f.target) {
    f.complete = true;
    f.status = "ready";
    f.lastReason = CW_bool(plan.complete, false) ? "source-scope-complete" : "target-reached";
  } else {
    f.status = "building";
  }

  CW_updateFranchiseRoadmapCard(cfg, f);
  CW_toast("Canon Weave: " + f.generated + "/" + f.target + " canon events built for " + cfg.franchise + (f.complete ? ". Roadmap ready." : "."));
  return cleaned;
}

function CW_similarLabel(a, b) {
  var aa = CW_contentTokens(a || "");
  var bb = CW_contentTokens(b || "");
  if (!aa.length || !bb.length) return CW_normText(a) === CW_normText(b);
  var set = {}, i, hit = 0;
  for (i = 0; i < aa.length; i++) set[aa[i]] = 1;
  for (i = 0; i < bb.length; i++) if (set[bb[i]]) hit += 1;
  var denom = Math.max(aa.length, bb.length);
  return denom > 0 && (hit / denom) >= 0.82;
}

function CW_generatedDelivery(kind, isAnchor, cfg) {
  if (cfg.franchiseDeliveryPolicy && cfg.franchiseDeliveryPolicy !== "adaptive") return cfg.franchiseDeliveryPolicy;
  if (cfg.franchisePlayerRole === "observer") return isAnchor ? "world" : "offscreen";
  if (kind === "conditional" || kind === "minor") return "adaptive";
  return isAnchor ? "world" : "adaptive";
}
function CW_generatedOutcome(kind, isAnchor, hard, cfg) {
  if (cfg.franchiseOutcomePolicy && cfg.franchiseOutcomePolicy !== "adaptive") return cfg.franchiseOutcomePolicy;
  if (cfg.franchiseDivergence === "reactive") return isAnchor && hard ? "flexible" : "opportunity";
  if (cfg.franchiseDivergence === "strict") return isAnchor ? "fixed" : "flexible";
  if (kind === "conditional" || kind === "minor") return "opportunity";
  return isAnchor && hard ? "fixed" : "flexible";
}
function CW_generatedPresence(kind, isAnchor, cfg) {
  if (cfg.franchisePlayerRole === "observer") return "none";
  if (cfg.franchisePlayerRole === "original_character") return isAnchor ? "optional" : "none";
  return isAnchor ? "optional" : "optional";
}

function CW_materializeFranchiseEvent(raw, cfg, f) {
  raw = raw || {};
  var confidence = CW_clamp(CW_num(raw.confidence, 0.75), 0, 1);
  if (confidence < cfg.franchiseConfidenceFloor) return false;

  var title = String(raw.title || "").replace(/^\s+|\s+$/g, "");
  var baseId = CW_slug(raw.id || title);
  if (!baseId || !title) return false;

  var id = "fr_" + CW_slug(cfg.franchise) + "_" + baseId;
  var i;
  for (i = 0; i < f.eventIds.length; i++) if (f.eventIds[i] === id) return false;
  for (i = 0; i < f.titles.length; i++) if (CW_norm(f.titles[i]) === CW_norm(title) || CW_similarLabel(f.titles[i], title)) return false;

  var prev = f.eventIds.length ? f.eventIds[f.eventIds.length - 1] : "";
  var window = CW_franchiseWindow(cfg.franchisePacing);
  var importance = CW_clamp(CW_int(raw.importance, 3), 1, 5);
  var when = CW_jsonStringArray(raw.when, 4);
  var complete = CW_jsonStringArray(raw.complete, 4);
  var body = String(raw.body || "").replace(/^\s+|\s+$/g, "");
  var bridge = String(raw.bridge || "").replace(/^\s+|\s+$/g, "");
  var seed = String(raw.seed || "").replace(/^\s+|\s+$/g, "");
  var arc = CW_slug(raw.arc || "franchise_main") || "franchise_main";
  var sourceRef = String(raw.source_ref || "").replace(/^\s+|\s+$/g, "");
  var kind = CW_norm(raw.kind || "major");
  var tier = CW_franchiseTierPolicy(raw, cfg);
  var hard = CW_bool(raw.hard_canon || raw.hardcanon, false);
  var isAnchor = hard || kind === "anchor" || importance >= cfg.franchiseAnchorThreshold;
  if (isAnchor) kind = "anchor";
  var support = CW_jsonStringArray(raw.support, 6);
  var blockers = CW_jsonStringArray(raw.blockers, 5);
  var protect = CW_jsonStringArray(raw.protect, 5);
  var forbid = CW_jsonStringArray(raw.forbid, 5);
  var delivery = CW_deliveryMode(raw.delivery || "");
  var outcome = CW_outcomePolicy(raw.outcome || "");
  var presence = CW_playerPresence(raw.player_presence || raw.presence || "");
  if (!delivery || delivery === "adaptive") delivery = CW_generatedDelivery(kind, isAnchor, cfg);
  if (!outcome || outcome === "adaptive") outcome = CW_generatedOutcome(kind, isAnchor, hard, cfg);
  if (!presence) presence = CW_generatedPresence(kind, isAnchor, cfg);

  if (cfg.franchiseRequireSourceRef && !sourceRef) return false;
  if (!body) body = "Canon beat: " + title + ". Preserve established continuity while allowing the current adventure to bridge naturally into this source-canon event.";
  if (body.length > 1200) body = body.slice(0, 1200);
  if (!complete.length) complete.push(title);

  var lines = [];
  lines.push("@CANON");
  lines.push("id: " + id);
  lines.push("title: " + CW_metaSafe(title));
  lines.push("generated_by: franchise");
  lines.push("generated_for: " + CW_slug(cfg.franchise));
  lines.push("generated_set: " + f.activeSet);
  lines.push("generated_confidence: " + confidence.toFixed(2));
  lines.push("generated_kind: " + CW_metaSafe(kind || "major"));
  lines.push("generated_role: " + cfg.franchisePlayerRole);
  lines.push("delivery: " + delivery);
  lines.push("outcome: " + outcome);
  lines.push("player_presence: " + presence);
  if (sourceRef) lines.push("source_ref: " + CW_metaSafe(sourceRef));
  lines.push("source_arc: " + arc);
  lines.push("order: " + String(f.eventIds.length + 1));

  var dep = prev;
  var resolvedDep = false;
  if (cfg.franchiseDependencyStrategy === "backbone") {
    dep = isAnchor ? (f.lastAnchorId || "") : (f.lastStableId || f.lastAnchorId || "");
    if (isAnchor && cfg.franchiseDivergence !== "strict") resolvedDep = true;
  }

  if (isAnchor && cfg.franchiseDependencyStrategy === "backbone") {
    lines.push("arc: " + CW_slug(cfg.franchise) + "_backbone");
    lines.push("strict_order: true");
    lines.push("strict_order_resolved: " + (cfg.franchiseDivergence === "strict" ? "false" : "true"));
  } else {
    lines.push("arc: " + arc);
    lines.push("strict_order: " + (cfg.franchiseDependencyStrategy === "linear" ? "true" : "false"));
  }

  if (dep) {
    lines.push((resolvedDep ? "after_resolved: " : "after: ") + dep);
    lines.push("relative_window: " + window.min + "-" + window.max);
  } else {
    lines.push("at: " + String(cfg.franchiseFirstEventAt));
    lines.push("before: " + String(cfg.franchiseFirstEventAt + window.max));
  }
  if (when.length) lines.push("when: " + when.join(" | "));
  if (blockers.length && cfg.franchiseGeneratedBlockers) lines.push("unless: " + blockers.join(" | "));
  if (cfg.franchiseDivergence === "strict") lines.push("blocked_policy: wait");
  else lines.push("blocked_policy: skip");
  lines.push("priority: " + String(55 + importance * 8));
  var deadline = tier.deadline;
  if (cfg.franchiseDivergence === "reactive" && !isAnchor) deadline = "catchup";
  lines.push("deadline_policy: " + deadline);
  lines.push("mode: " + tier.mode);
  lines.push("retries: " + String(Math.max(2, CW_DEFAULTS.defaultRetries)));
  lines.push("complete: " + complete.join(" | "));
  lines.push("complete_match: strict");
  lines.push("auto_include: " + (cfg.franchiseAutoInclude ? "true" : "false"));
  if (support.length) {
    var selectors = [];
    for (i = 0; i < support.length; i++) selectors.push("key:" + support[i]);
    lines.push("include: " + selectors.join(", "));
  }
  if (protect.length && cfg.franchiseGeneratedProtect) lines.push("protect: " + protect.join(", "));
  if (forbid.length && cfg.franchiseGeneratedProtect) lines.push("forbid: " + forbid.join(" | "));
  if (seed) {
    lines.push("lead: " + String(importance >= 4 ? 4 : 2));
    lines.push("seed: " + CW_metaSafe(seed));
  }
  if (bridge) lines.push("bridge: " + CW_metaSafe(bridge));
  lines.push("---");
  lines.push(body);
  if (sourceRef) lines.push("\nSource position: " + sourceRef + ".");

  var key = "%CW:AUTO:" + f.activeSet + ":" + id + "%";
  var entry = lines.join("\n");
  var created = false;

  if (cfg.franchiseMaterializeCards && typeof addStoryCard === "function") {
    try {
      var idx = CW_apiAddStoryCard(key, entry, "Canon Event");
      created = (idx !== false);
      if (!created) {
        /* Same key already exists: count it as known rather than creating a
           duplicate after a retry/reload. */
        created = CW_hasStoryCardKey(key);
      }
    } catch (err) {
      CW_log("addStoryCard failed for generated franchise event " + id + ": " + CW_errorText(err), true);
      created = false;
    }
  }

  if (!created && !cfg.franchiseMaterializeCards) {
    /* Materialization is the useful mode because it makes generated events
       visible/editable to the creator. If explicitly disabled, retain a small
       virtual card so the scheduler can still consume the roadmap. */
    var virtual = { id:-(100000 + f.eventIds.length), keys:key, entry:entry, type:"Canon Event", title:title };
    f.virtualCards = f.virtualCards || [];
    f.virtualCards.push(virtual);
    created = true;
  }

  if (!created) return false;
  f.eventIds.push(id);
  f.titles.push(title);
  if (isAnchor) { f.anchorIds.push(id); f.lastAnchorId = id; f.lastStableId = id; }
  else if (kind !== "minor" && kind !== "conditional") f.lastStableId = id;
  return true;
}

function CW_hasStoryCardKey(key) {
  if (typeof storyCards === "undefined" || !storyCards) return false;
  var i;
  for (i = 0; i < storyCards.length; i++) if (String((storyCards[i] || {}).keys || "") === key) return true;
  return false;
}

function CW_jsonStringArray(v, max) {
  var arr = Object.prototype.toString.call(v) === "[object Array]" ? v : (typeof v === "string" ? [v] : []);
  var out = [], seen = {}, i;
  for (i = 0; i < arr.length && out.length < max; i++) {
    var x = String(arr[i] || "").replace(/[\r\n|;]+/g, " ").replace(/^\s+|\s+$/g, "");
    if (!x || x.length < 2) continue;
    if (x.length > 120) x = x.slice(0, 120);
    var k = CW_norm(x);
    if (seen[k]) continue;
    seen[k] = true;
    out.push(x);
  }
  return out;
}

function CW_metaSafe(v) {
  return String(v || "").replace(/[\r\n]+/g, " ").replace(/^\s+|\s+$/g, "").slice(0, 500);
}

function CW_updateFranchiseRoadmapCard(cfg, f) {
  if (!cfg.franchiseRoadmapCard || !cfg.franchise || !f || !f.activeSet) return;
  if (typeof storyCards === "undefined" || !storyCards) return;

  var key = f.roadmapKey || ("%CW:ROADMAP:" + f.activeSet + "%");
  f.roadmapKey = key;
  var lines = [];
  lines.push("🧵 CANON WEAVE — FRANCHISE ROADMAP");
  lines.push("Franchise: " + cfg.franchise);
  if (cfg.franchiseCanon) lines.push("Continuity: " + cfg.franchiseCanon);
  if (cfg.franchiseStart || cfg.franchiseEnd) lines.push("Range: " + (cfg.franchiseStart || "beginning") + " → " + (cfg.franchiseEnd || "open end"));
  lines.push("Status: " + f.status + " • Events: " + f.generated + "/" + f.target + " • Batches: " + f.batches);
  lines.push("Build: " + cfg.franchiseGranularity + " • " + cfg.franchiseDependencyStrategy + " dependencies • " + cfg.franchiseDivergence + " divergence • role " + cfg.franchisePlayerRole);
  if (f.cursor) lines.push("Cursor: " + f.cursor);
  if (f.lastBatchSummary) lines.push("Latest batch: " + f.lastBatchSummary);
  if (f.sourceChanged) lines.push("⚠ Canon Source changed after roadmap generation. Rebuild recommended before further planning.");
  if (f.suggestions && f.suggestions.length) lines.push("Continuity options: " + f.suggestions.join(" / "));
  lines.push("");
  lines.push("GENERATED CANON");
  var start = Math.max(0, f.titles.length - 28);
  var i;
  for (i = start; i < f.titles.length; i++) lines.push((i + 1) + ". " + f.titles[i]);
  if (!f.titles.length) lines.push("No events generated yet.");
  lines.push("");
  lines.push("Creator-only index. Sentinel trigger prevents normal activation.");

  var entry = lines.join("\n");
  if (entry.length > cfg.franchiseRoadmapMaxChars) {
    entry = entry.slice(0, cfg.franchiseRoadmapMaxChars - 28) + "\n…roadmap display truncated";
  }

  var idx = -1;
  for (i = 0; i < storyCards.length; i++) {
    if (String((storyCards[i] || {}).keys || "") === key) { idx = i; break; }
  }

  try {
    if (idx >= 0 && typeof updateStoryCard === "function") {
      CW_apiUpdateStoryCard(idx, key, entry, "Canon Roadmap");
    } else if (idx < 0 && typeof addStoryCard === "function") {
      CW_apiAddStoryCard(key, entry, "Canon Roadmap");
    }
  } catch (err) {
    CW_log("Franchise roadmap card update failed: " + CW_errorText(err), true);
  }
}

function CW_franchiseStatus(cfg) {
  var f = CW_ensureFranchiseState(CW_state());
  if (!cfg.franchise) return "Franchise auto-builder: disabled (set franchise: NAME in Canon Config).";
  var msg = "Franchise: " + cfg.franchise + " | set: " + (f.activeSet || "none") + " | status: " + f.status + " | generated: " + f.generated + "/" + f.target + " | batches: " + f.batches + " | failures: " + f.failures;
  if (f.cursor) msg += " | cursor: " + f.cursor;
  if (f.suggestions && f.suggestions.length) msg += " | continuity options: " + f.suggestions.join(" / ");
  if (f.lastReason) msg += " | last: " + f.lastReason;
  return msg;
}

/* ========================================================================
 * GRAPH VALIDATION / DOCTOR
 * ====================================================================== */

function CW_validateIfChanged(parsed, cfg) {
  var s = CW_state();
  var sigParts = [];
  var i;

  for (i = 0; i < parsed.events.length; i++) {
    var e = parsed.events[i];
    sigParts.push(e.id + ":" + CW_hash(e.payload + JSON.stringify(e.rawMeta || {})));
  }

  var sig = CW_hash(sigParts.join("|"));
  if (s.diagnostics.signature === sig) return;

  var d = CW_validateGraph(parsed.events, parsed.cards, cfg);
  d.signature = sig;
  s.diagnostics = d;

  if (d.errors.length) CW_log("Graph errors: " + d.errors.join(" | "), true);
  if (cfg.debug && d.warnings.length) CW_log("Graph warnings: " + d.warnings.join(" | "), true);
}

function CW_validateGraph(events, cards, cfg) {
  var errors = [], warnings = [], map = {}, i, j, e;
  var arcOrders = {};

  for (i = 0; i < events.length; i++) {
    e = events[i];
    CW_applyEventDefaults(e, cfg);
    if (!e.id) errors.push("Event card " + e.cardId + " has no usable id");
    if (map[e.id]) errors.push("Duplicate event id: " + e.id);
    map[e.id] = e;
    if (!e.payload) warnings.push(e.id + " has empty event body");
    if (e.before > 0 && e.at > e.before) errors.push(e.id + " has at: later than before:");
    if (e.afterBefore > 0 && e.afterDelay > e.afterBefore) errors.push(e.id + " has after_delay later than after_before");
    if ((e.afterDelay || e.afterBefore) && !e.after.length && !e.afterAny.length && !e.afterResolved.length) warnings.push(e.id + " uses a relative timeline without after:/after_any:/after_resolved:");
    if (e.mode === "force" && !e.fallback && !e.completeAny.length && !e.completeAll.length && !e.completeClauses.length && !e.completeRegex) warnings.push(e.id + " is force mode with neither completion evidence nor fallback");
    if (e.completeAny.length && e.completeMin > e.completeAny.length) warnings.push(e.id + " complete_min exceeds number of complete: alternatives; it will clamp to the available alternatives");
    if (e.whenAny.length && e.whenMin > e.whenAny.length) warnings.push(e.id + " when_min exceeds number of when: alternatives; it will clamp to the available alternatives");
    if (e.outcomePolicy === "fixed" && e.playerPresence === "required" && cfg.preservePlayerAgency) warnings.push(e.id + " combines fixed outcome + required player presence; make sure the required outcome does not depend on an unchosen player decision");
    if (e.strictOrder && e.arc && e.order > 0) {
      var ao = e.arc + "#" + e.order;
      if (arcOrders[ao]) warnings.push("Arc " + e.arc + " has duplicate strict order " + e.order + " (" + arcOrders[ao] + ", " + e.id + ")");
      else arcOrders[ao] = e.id;
    }
  }

  for (i = 0; i < events.length; i++) {
    e = events[i];
    var deps = e.after.concat(e.afterAny, e.afterResolved, e.afterNot);
    for (j = 0; j < deps.length; j++) {
      var dep = CW_slug(deps[j]);
      if (dep === e.id) errors.push(e.id + " depends on itself");
      else if (!map[dep]) warnings.push(e.id + " references missing dependency " + dep);
    }

    for (j = 0; j < e.after.length; j++) if (e.afterNot.indexOf(e.after[j]) !== -1) errors.push(e.id + " both requires and forbids dependency " + e.after[j]);

    for (j = 0; j < e.include.length; j++) {
      if (!CW_anyCardMatches(cards, e.include[j], e.cardId)) warnings.push(e.id + " include not resolved: " + e.include[j]);
      var x;
      for (x = 0; x < e.exclude.length; x++) if (CW_normText(e.include[j]) === CW_normText(e.exclude[x])) warnings.push(e.id + " both includes and excludes " + e.include[j]);
    }
  }

  var visiting = {}, visited = {};
  function dfs(id, path) {
    if (visiting[id]) { errors.push("Dependency cycle: " + path.concat([id]).join(" -> ")); return; }
    if (visited[id] || !map[id]) return;
    visiting[id] = true;
    var arr = map[id].after.concat(map[id].afterResolved || []);
    var x;
    for (x = 0; x < arr.length; x++) dfs(CW_slug(arr[x]), path.concat([id]));
    visiting[id] = false;
    visited[id] = true;
  }
  for (i = 0; i < events.length; i++) dfs(events[i].id, []);
  return { errors:CW_unique(errors), warnings:CW_unique(warnings) };
}

function CW_anyCardMatches(cards, ref, ownId) {
  var i;
  for (i = 0; i < cards.length; i++) {
    var c = cards[i] || {};
    if (String(c.id) === String(ownId)) continue;
    if (CW_cardMatchesRef(c, ref)) return true;
  }
  return false;
}

/* ========================================================================
 * OPTIONAL DASHBOARD STORY CARD
 * ====================================================================== */

function CW_maybeUpdateDashboard(parsed, cfg) {
  if (!cfg.dashboard || parsed.dashboardIndex < 0) return;
  var s = CW_state();
  if ((s.turn - s.dashboardTurn) < cfg.dashboardEvery) return;

  var c = parsed.cards[parsed.dashboardIndex] || {};
  var entry = CW_dashboardText(parsed.events);
  var h = CW_hash(entry);
  if (h === s.dashboardHash) { s.dashboardTurn = s.turn; return; }

  try {
    if (typeof updateStoryCard === "function") {
      CW_apiUpdateStoryCard(parsed.dashboardIndex, c.keys || "%CW:DASHBOARD%", entry, c.type || "Canon Dashboard");
      s.dashboardHash = h;
      s.dashboardTurn = s.turn;
    }
  } catch (err) {
    CW_log("Dashboard update failed: " + CW_errorText(err), true);
  }
}

function CW_dashboardText(events) {
  var s = CW_state();
  var next = [];
  var i;

  for (i = 0; i < events.length; i++) {
    var e = events[i];
    if (CW_completed(e.id) || s.cancelled[e.id] || s.stalled[e.id]) continue;
    next.push(e);
  }

  next.sort(function(a,b) {
    if (a.at !== b.at) return a.at - b.at;
    return b.priority - a.priority;
  });

  var lines = [
    "CANON WEAVE STATUS",
    "Action: " + s.turn,
    "Active: " + (s.activeId || "none"),
    "Completed: " + CW_objectCount(s.completed),
    "Missed: " + CW_objectCount(s.missed),
    "Stalled: " + CW_objectCount(s.stalled),
    "Flags: " + CW_trueKeys(s.flags).join(", ")
  ];

  if (next.length) {
    lines.push("Next canon beats:");
    for (i = 0; i < Math.min(5, next.length); i++) {
      lines.push("- " + next[i].id + " (at " + next[i].at + ", priority " + next[i].priority + ")");
    }
  }

  if (s.diagnostics.errors.length) lines.push("Doctor errors: " + s.diagnostics.errors.length);
  if (s.diagnostics.warnings.length) lines.push("Doctor warnings: " + s.diagnostics.warnings.length);
  return lines.join("\n");
}

/* ========================================================================
 * COMMANDS
 * ====================================================================== */

function CW_parseCommand(text) {
  var t = String(text || "").replace(/^\s+|\s+$/g, "");
  var m = t.match(/^(?:>\s*You\s*)?\/canon(?:\s+(.+))?$/i);
  if (!m) return null;
  var rest = String(m[1] || "status").replace(/^\s+|\s+$/g, "");
  var parts = rest.split(/\s+/);
  return { action:CW_norm(parts.shift() || "status"), args:parts };
}

function CW_applyCommand(cmd, parsed, cfg) {
  var s = CW_state();
  var id, e;

  if (cmd.action === "on") { s.enabled = true; CW_toast("Canon Weave enabled."); return; }
  if (cmd.action === "off") { s.enabled = false; CW_toast("Canon Weave disabled."); return; }

  if (cmd.action === "fire") {
    id = CW_slug(cmd.args.join(" "));
    e = CW_findEvent(parsed.events, id);
    if (e) { s.manualFire = e.id; CW_toast("Queued canon event: " + e.id); }
    else CW_toast("Canon event not found: " + id);
    return;
  }

  if (cmd.action === "complete") {
    id = CW_slug(cmd.args.join(" "));
    e = CW_findEvent(parsed.events, id);
    if (e) { CW_applyEventDefaults(e, cfg); CW_complete(e, "manual", cfg, "manual"); CW_toast("Completed: " + e.id); }
    else CW_toast("Canon event not found: " + id);
    return;
  }

  if (cmd.action === "skip" || cmd.action === "cancel") {
    id = CW_slug(cmd.args.join(" "));
    e = CW_findEvent(parsed.events, id);
    if (e) {
      s.cancelled[e.id] = { turn:s.turn, reason:"manual", by:"manual" };
      CW_journalPush({kind:"cancel",source:"manual",eventId:e.id,reason:"manual",turn:s.turn});
      if (s.activeId === e.id) { s.activeId = null; s.active = null; }
      CW_toast("Cancelled: " + e.id);
    } else CW_toast("Canon event not found: " + id);
    return;
  }

  if (cmd.action === "reset") {
    id = CW_slug(cmd.args.join(" "));
    if (!id || id === "all") {
      var enabled = s.enabled;
      state.CANON_WEAVE = null;
      CW_state().enabled = enabled;
      CW_toast("Canon Weave state reset.");
    } else {
      delete s.completed[id]; delete s.occurrences[id]; delete s.eventStates[id];
      delete s.cancelled[id]; delete s.missed[id]; delete s.stalled[id];
      delete s.gates[id]; delete s.completionEvidence[id];
      s.journal = (s.journal || []).filter(function(r){ return !r || r.eventId !== id; });
      if (s.activeId === id) { s.activeId = null; s.active = null; }
      CW_toast("Reset event: " + id);
    }
    return;
  }

  if (cmd.action === "flag") {
    var joined = cmd.args.join(" ");
    var fm = joined.match(/^([^=]+)=(true|false|on|off|1|0)$/i);
    if (!fm) { CW_toast("Usage: /canon flag name=true"); return; }
    var flag = CW_slug(fm[1]);
    var value = /^(true|on|1)$/i.test(fm[2]);
    if (value) s.flags[flag] = true; else delete s.flags[flag];
    CW_journalPush({kind:"flag",source:"manual",flag:flag,value:value,turn:s.turn});
    CW_toast("Flag " + flag + " = " + value);
    return;
  }

  if (cmd.action === "setup" || cmd.action === "install") {
    var setupSub = CW_norm(cmd.args.shift() || "repair");
    if (setupSub === "status") {
      CW_toast(CW_setupStatusText());
      return;
    }
    var setupState = CW_ensureSetupState(s);
    setupState.complete = false;
    setupState.attempts = 0;
    setupState.noticeShown = false;
    CW_bootstrapConfigCards(true);
    CW_toast(CW_setupStatusText());
    return;
  }

  if (cmd.action === "franchise") {
    var sub = CW_norm(cmd.args.shift() || "status");
    var f = CW_ensureFranchiseState(s);

    if (sub === "status") {
      CW_toast(CW_franchiseStatus(cfg));
      return;
    }

    if (sub === "roadmap") {
      CW_updateFranchiseRoadmapCard(cfg, f);
      CW_toast(cfg.franchise ? "Franchise roadmap card refreshed." : "Set franchise: NAME in Canon Config first.");
      return;
    }

    if (sub === "build") {
      f.manualBuildRequested = true; f.paused = false;
      if (cfg.franchise && f.generated < f.target) f.status = "building";
      f.lastPlanTurn = -999999;
      CW_toast(cfg.franchise ? "Franchise planner queued for the next eligible generation." : "Set franchise: NAME in Canon Config first.");
      return;
    }

    if (sub === "pause") {
      f.paused = true;
      f.status = "paused";
      CW_toast("Franchise roadmap generation paused.");
      return;
    }

    if (sub === "resume") {
      f.paused = false;
      if (cfg.franchise && f.generated < f.target) f.status = "building";
      CW_toast("Franchise roadmap generation resumed.");
      return;
    }

    if (sub === "rebuild") {
      CW_removeGeneratedFranchiseCards();
      f.session += 1;
      f.activeSet = CW_slug(cfg.franchise || f.name || "franchise") + "_" + String(f.session) + "_" + CW_hash(f.identity + "|" + String(f.session)).slice(0, 6);
      f.generated = 0; f.batches = 0; f.failures = 0; f.lastPlanTurn = -999999;
      f.lastCapturedAction = -999999; f.lastMissedAction = -999999; f.eventIds = []; f.titles = []; f.complete = false;
      f.cursor = ""; f.sourceRefs = []; f.suggestions = []; f.lastBatchSummary = "";
      f.anchorIds = []; f.lastAnchorId = ""; f.lastStableId = ""; f.lastSourceModeNotice = "";
      f.planNonce = ""; f.sourceHash = CW_franchiseSourceSignature(parsed, cfg); f.sourceChanged = false; f.manualBuildRequested = false;
      f.roadmapKey = "%CW:ROADMAP:" + f.activeSet + "%";
      f.paused = false; f.status = cfg.franchise ? "building" : "disabled"; f.lastReason = "manual-rebuild";
      f.virtualCards = [];
      CW_toast(cfg.franchise ? ("Rebuilding canon roadmap for " + cfg.franchise + ".") : "Set franchise: NAME in Canon Config first.");
      return;
    }

    if (sub === "clear") {
      var removed = CW_removeGeneratedFranchiseCards();
      f.generated = 0; f.batches = 0; f.failures = 0; f.eventIds = []; f.titles = [];
      f.cursor = ""; f.sourceRefs = []; f.suggestions = []; f.lastBatchSummary = "";
      f.anchorIds = []; f.lastAnchorId = ""; f.lastStableId = ""; f.lastSourceModeNotice = "";
      f.planNonce = ""; f.sourceChanged = false; f.manualBuildRequested = false;
      f.complete = false; f.paused = true; f.status = "paused"; f.virtualCards = [];
      CW_toast("Cleared " + removed + " generated franchise card(s) and paused rebuilding.");
      return;
    }

    CW_toast("Usage: /canon franchise status|roadmap|build|pause|resume|rebuild|clear");
    return;
  }

  if (cmd.action === "hooks" || cmd.action === "health") {
    CW_toast(CW_hookHealthText());
    return;
  }

  if (cmd.action === "doctor") {
    CW_validateIfChanged(parsed, cfg);
    var d = s.diagnostics;
    CW_toast("Canon doctor: " + d.errors.length + " error(s), " + d.warnings.length + " warning(s). See creator console for details.");
    CW_log("DOCTOR errors=" + d.errors.join(" | ") + " warnings=" + d.warnings.join(" | "), true);
    return;
  }

  if (cmd.action === "next") {
    var next = CW_selectEvent(parsed.events, cfg);
    CW_toast(next ? ("Next eligible: " + next.id) : "No canon event is currently eligible.");
    return;
  }

  if (cmd.action === "why") {
    id = CW_slug(cmd.args.join(" "));
    e = CW_findEvent(parsed.events, id);
    if (!e) { CW_toast("Canon event not found: " + id); return; }
    CW_applyEventDefaults(e, cfg);
    var why = CW_eligibility(e, CW_recentSceneText(cfg.sceneActions), parsed.events, cfg, false);
    CW_toast(e.id + ": " + (why.ok ? "eligible now" : ("blocked by " + why.why)));
    return;
  }

  var status = "Canon action " + s.turn + " | active: " + (s.activeId || "none") + " | complete: " + CW_objectCount(s.completed) + " | flags: " + CW_trueKeys(s.flags).join(", ");
  if (CW_ensureSetupState(s).status !== "ready" && CW_ensureSetupState(s).status !== "custom-config") status += " | setup " + CW_ensureSetupState(s).status;
  if (cfg.franchise) status += " | franchise " + CW_ensureFranchiseState(s).generated + "/" + CW_ensureFranchiseState(s).target;
  CW_toast(status);
}

function CW_toast(msg) {
  var s = CW_state();
  msg = String(msg || "");
  try {
    /* Avoid clobbering another installed script's message unless the current
       message is ours or empty. */
    if (!state.message || state.message === s.lastToast) {
      state.message = msg;
      s.lastToast = msg;
    }
  } catch (err) {}
  CW_log(msg);
}

/* ========================================================================
 * UTILITY
 * ====================================================================== */

function CW_findEvent(events, id) {
  id = CW_slug(id || "");
  var i;
  for (i = 0; i < events.length; i++) if (events[i].id === id) return events[i];
  return null;
}

function CW_mode(v) {
  v = CW_norm(v || "");
  if (v === "soft" || v === "strong" || v === "force") return v;
  return "";
}

function CW_matchMode(v) {
  v = CW_norm(v || "");
  if (v === "strict" || v === "balanced" || v === "loose") return v;
  return "";
}

function CW_deadlinePolicy(v) {
  v = CW_norm(v || "");
  if (v === "catchup" || v === "skip" || v === "force") return v;
  return "";
}

function CW_blockedPolicy(v) {
  v = CW_norm(v || "");
  if (v === "skip" || v === "resolve" || v === "cancel") return "skip";
  if (v === "wait" || v === "hold") return "wait";
  return "";
}

function CW_mergeInto(target, src) {
  target = target || {}; src = src || {};
  var k; for (k in src) if (src.hasOwnProperty(k)) target[k] = src[k];
  return target;
}

function CW_pick(obj, keys) {
  var i;
  obj = obj || {};
  for (i = 0; i < keys.length; i++) if (typeof obj[keys[i]] !== "undefined" && obj[keys[i]] !== "") return obj[keys[i]];
  return "";
}

function CW_normKey(s) { return CW_norm(s).replace(/[\s\-]+/g, "_"); }

function CW_norm(s) {
  return String(s || "").toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g," ").replace(/^\s+|\s+$/g,"");
}

function CW_normText(s) {
  return CW_norm(String(s || "").replace(/[“”]/g,'"').replace(/[—–]/g,'-'));
}

function CW_slug(s) {
  return CW_norm(s).replace(/[^a-z0-9_\- ]+/g,"").replace(/[\s\-]+/g,"_").replace(/^_+|_+$/g,"");
}

function CW_unquote(s) {
  s = String(s || "").replace(/^\s+|\s+$/g, "");
  if (s.length >= 2) {
    var a = s.charAt(0), b = s.charAt(s.length-1);
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) return s.slice(1,-1);
  }
  return s;
}

function CW_terms(value) {
  if (value === null || typeof value === "undefined") return [];
  if (Object.prototype.toString.call(value) === "[object Array]") return CW_unique(value);
  var parts = String(value || "").split(/[,;\n]+/), out = [], i;
  for (i = 0; i < parts.length; i++) {
    var p = CW_unquote(parts[i]).replace(/^\s+|\s+$/g, "");
    if (p) out.push(p);
  }
  return CW_unique(out);
}

function CW_altTerms(value) {
  if (value === null || typeof value === "undefined") return [];
  if (Object.prototype.toString.call(value) === "[object Array]") return CW_unique(value);
  var parts = String(value || "").split(/[|;\n]+/), out = [], i;
  for (i = 0; i < parts.length; i++) {
    var p = CW_unquote(parts[i]).replace(/^\s+|\s+$/g, "");
    if (p) out.push(p);
  }
  return CW_unique(out);
}

function CW_unique(arr) {
  var out = [], seen = {}, i;
  for (i = 0; i < arr.length; i++) {
    var raw = String(arr[i] || "").replace(/^\s+|\s+$/g, "");
    var key = CW_normText(raw);
    if (!raw || seen[key]) continue;
    seen[key] = true; out.push(raw);
  }
  return out;
}


function CW_clauseGroups(value) {
  if (value === null || typeof value === "undefined" || value === "") return [];
  var clauses = String(value).split(/[;\n]+/);
  var out = [], i, j;
  for (i = 0; i < clauses.length; i++) {
    var alts = String(clauses[i] || "").split(/\|+/);
    var group = [];
    for (j = 0; j < alts.length; j++) {
      var t = CW_unquote(alts[j]).replace(/^\s+|\s+$/g, "");
      if (t) group.push(t);
    }
    group = CW_unique(group);
    if (group.length) out.push(group);
  }
  return out;
}

function CW_flattenClauses(groups) {
  var out = [], i, j;
  groups = groups || [];
  for (i = 0; i < groups.length; i++) for (j = 0; j < groups[i].length; j++) out.push(groups[i][j]);
  return CW_unique(out);
}

function CW_clauseGroupsText(groups) {
  var out = [], i;
  for (i = 0; i < groups.length; i++) out.push("(" + groups[i].join(" OR ") + ")");
  return out.join(" AND ");
}

function CW_escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function CW_parseWindow(v) {
  var m = String(v || "").match(/(\d+)\s*(?:-|to|\.\.)\s*(\d+)/i);
  if (!m) return {min:0,max:0};
  return {min:parseInt(m[1],10)||0,max:parseInt(m[2],10)||0};
}

function CW_int(v, fallback) { var n = parseInt(v,10); return isNaN(n) ? fallback : n; }
function CW_num(v, fallback) { var n = parseFloat(v); return isNaN(n) ? fallback : n; }

function CW_bool(v, fallback) {
  if (typeof v === "boolean") return v;
  if (v === null || typeof v === "undefined" || v === "") return fallback;
  var s = CW_norm(v);
  if (s === "true" || s === "yes" || s === "on" || s === "1") return true;
  if (s === "false" || s === "no" || s === "off" || s === "0") return false;
  return fallback;
}

function CW_clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function CW_cleanBody(s) { return String(s || "").replace(/^\s+|\s+$/g, ""); }
function CW_shallowClone(o) { var x={},k; for(k in o) if(o.hasOwnProperty(k)) x[k]=o[k]; return x; }

function CW_hash(str) {
  str = String(str || "");
  var h = 2166136261, i;
  for (i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24);
  }
  return (h>>>0).toString(36);
}

function CW_joinStoryText(a,b) {
  a = String(a || "").replace(/\s+$/g,"");
  b = String(b || "").replace(/^\s+/g,"");
  if (!a) return b; if (!b) return a; return a + "\n\n" + b;
}

function CW_objectCount(obj) { var n=0,k; obj=obj||{}; for(k in obj) if(obj.hasOwnProperty(k)) n++; return n; }
function CW_trueKeys(obj) { var a=[],k; obj=obj||{}; for(k in obj) if(obj.hasOwnProperty(k)&&obj[k]) a.push(k); return a.sort(); }
function CW_errorText(err) { return err && (err.stack || err.message) ? String(err.stack || err.message) : String(err || "unknown error"); }

function CW_log(msg, force) {
  var debug = false;
  try { debug = !!CW_state().debug; } catch (e) {}
  if (!force && !debug) return;
  try {
    if (typeof log === "function") log("[CANON WEAVE] " + msg);
    else if (typeof console !== "undefined" && console && console.log) console.log("[CANON WEAVE] " + msg);
  } catch (e2) {}
}
