# Township Source Architecture

## What Township is

Township is a Minecraft Bedrock settlement-building add-on. A Founding Stone establishes a persistent town. The add-on manages claims, lots, terrain preparation, roads, construction plans, a visible Township Builder, town residents, player controls, and durable world state.

The core gameplay contract is builder-driven construction. Buildings are not instant structure placements: the Builder works through ordered block-placement plans over time. Test builds may increase placement throughput, but the underlying model remains resumable, phase-based, and visible.

## Source ownership rule

Each gameplay system has one owning module. A module may call another module through a narrow public function, but it must not read or mutate another module's internal state directly.

No new feature belongs in `scripts/main.js`.

`main.js` will become startup wiring only: register components, subscribe to events, start the scheduler, and route events to feature modules.

## Target Behavior Pack tree

```text
Township BP/
  manifest.json
  blocks/
  items/
  entities/
  recipes/
  loot_tables/
  functions/
  scripts/
    main.js                         # startup wiring only
    core/
      constants.js                  # stable IDs, timing defaults, version metadata
      errors.js                     # Debug Log bridge wrapper and safe error boundaries
      runtime.js                    # tick clock, scheduler registration, feature lifecycle
      dimensions.js                 # dimension lookup and loaded-area checks
    data/
      town_store.js                 # world dynamic-property persistence only
      town_schema.js                # default values, migrations, validation
      build_store.js                # captured build metadata and future template records
    towns/
      town_registry.js              # create/remove/find towns, claim-distance rules
      town_status.js                # status summaries used by UI and messages
      town_residents.js             # builder and resident entity lifecycle
    lots/
      lot_registry.js               # lot placement/removal and collision rules
      lot_geometry.js               # bounds, rotation, local-to-world transforms
      lot_preview.js                # player-only preview particles
    construction/
      job_queue.js                  # durable job queue and job state transitions
      job_scheduler.js              # selects one eligible work unit per active town
      block_plan.js                 # ordered phase plans and plan cursor helpers
      block_writer.js               # idempotent block placement and permutations
      terrain_jobs.js               # clear, level, support-fill, boundary preparation
      road_jobs.js                  # road planning and road construction
      building_jobs.js              # house/building construction execution
      ticking_areas.js              # ticking-area lifecycle for construction jobs
    buildings/
      catalog.js                    # building IDs, sizes, display names, eligibility
      small/
      medium/
      large/
      shared/
    ui/
      forms.js                      # ActionFormData and ModalFormData only
      block_ui.js                   # routes a clicked Township block to its screen
      messages.js                   # player and world messages
    interactions/
      block_components.js           # registered custom block components
      placement_events.js           # player place behavior
      break_events.js               # player break behavior
      item_events.js                # intentional item-use behavior only
    tools/
      ground_leveler.js
      build_recorder.js
    compat/
      verified_compat.js            # only documented, version-tested compatibility handling
  tests/
    ui_lab/
    ticking_area_lab/
    build_plan_lab/

Township RP/
  manifest.json
  blocks.json
  textures/
  texts/
  models/
  entity/
  animations/
  animation_controllers/
  render_controllers/
```

## Architecture constraints

1. Construction plans remain block-by-block and phase ordered.
2. A construction job saves only durable progress: plan identifier, phase, cursor, target bounds, state, and job metadata. It does not save redundant per-tick runtime data.
3. One active construction job owns one ticking area. The job releases it when paused, complete, canceled, or failed.
4. UI has one verified primary interaction route. Compatibility behavior is isolated under `scripts/compat/` and is not added until the primary route has been tested in a minimal lab.
5. Every system writes errors through the shared Debug Log bridge with its own system label.
6. No feature is added directly to the legacy controller. New work is added only in the target module tree.

## Migration order

1. Create the target tree and preserve current runtime behavior.
2. Move immutable constants and shared helpers into `core/`.
3. Move persistence and schema normalization into `data/`.
4. Move lot geometry and town registry logic.
5. Move construction job queue, block writer, and ticking-area lifecycle.
6. Move buildings into catalog and size-based plan files.
7. Move UI and interaction routing after the verified normal-click proof pack succeeds.
8. Reduce `main.js` to wiring only.

Every migration step must preserve the working Behavior Pack and Resource Pack UUIDs, state the tested Bedrock version/platform/experiments, and include the Content Log result.
