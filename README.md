# Township

Minecraft Bedrock Add-On source repository.

Current baseline: **v1.0.84**, the confirmed working recovery build restored from the known-working v1.0.63 line.

Repository layout:
- `Township BP/` — Behavior Pack source
- `Township RP/` — Resource Pack source
- `docs/` — project notes, release records, and source architecture

Forward architecture:
- `docs/architecture/Township Source Architecture.md` defines the permanent module boundaries.
- Township is a builder-driven settlement add-on. Buildings remain phase-based, ordered, block-by-block plans so the Builder visibly constructs them over time.
- New gameplay systems must be placed in their owning module directory under `Township BP/scripts/`, not appended to the legacy controller.
- `Township BP/scripts/main.js` is being reduced over time to startup and event wiring only.

Source-control rule: future Township builds start from this baseline, preserve the established pack UUIDs, and include a complete changelog entry describing every changed file and test result.
