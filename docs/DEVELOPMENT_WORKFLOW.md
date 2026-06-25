# Township Development Workflow

1. Change one feature at a time.
2. Work only from `Township BP/` and `Township RP/`.
3. Preserve BP and RP UUIDs for normal updates.
4. Update the pack versions and script version together.
5. Validate files before packaging.
6. Test on the target Bedrock Android version.
7. Record changed paths, test result, enabled experiments, and Content Log output in `docs/TEST_LOG.md`.

Do not combine system changes, API migration, and broad reorganization in the same test build.
