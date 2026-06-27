export function createTownRegistrySystem({ addonName, runtimeState, safeLocationKey, sendDebugLogError, messagePlayer, clearBlock, getTowns, getLots, getJobs, saveTowns, getTownAtBlock, findNearbyTown, getPlacementFacing, queueTownPrep, showFoundingStoneMenu, constants }) {
  const { FOUNDING_STONE_ID, MIN_TOWN_DISTANCE, CLAIM_RADIUS, STARTING_BUILD_RADIUS, BUILDER_DELAY_TICKS, CAMP_JOB_STATUS_PENDING, AUTO_PLACE_MAX_SMALL, AUTO_PLACE_MAX_MEDIUM, AUTO_PLACE_MAX_LARGE } = constants;

  function registerTownFromBlock(block, player) {
    try {
      if (!block || block.typeId !== FOUNDING_STONE_ID) return;
      const location = block.location;
      const dimensionId = block.dimension.id;
      if (getTownAtBlock(location, dimensionId)) return;
      const nearby = findNearbyTown(location, dimensionId);
      if (nearby) {
        clearBlock(block);
        messagePlayer(player, `§cTownship Founding Stone failed: another township is too close (${Math.floor(nearby.distance)} blocks away). Minimum center distance is ${MIN_TOWN_DISTANCE} blocks.`);
        return;
      }
      const facing = getPlacementFacing(player);
      const town = {
        id: `t_${dimensionId.replace("minecraft:", "").replace(/[^a-zA-Z0-9]/g, "_")}_${safeLocationKey(location)}_${runtimeState.tickCounter}`,
        dimensionId,
        center: { x: location.x, y: location.y, z: location.z },
        frontDirection: facing.frontDirection,
        backDirection: facing.backDirection,
        tier: 1,
        claimRadius: CLAIM_RADIUS,
        buildRadius: STARTING_BUILD_RADIUS,
        createdTick: runtimeState.tickCounter,
        builderStatus: "pending",
        builderSpawnTick: runtimeState.tickCounter + BUILDER_DELAY_TICKS,
        builderEntityId: undefined,
        campStatus: CAMP_JOB_STATUS_PENDING,
        campNextIndex: 0,
        campNextTick: undefined,
        autoBuildLots: true,
        autoRoads: true,
        builderPaused: false
      };
      const towns = getTowns();
      towns.push(town);
      queueTownPrep(town);
      saveTowns(towns);
      messagePlayer(player, `§aTownship founded. Front: ${facing.frontDirection}. Township radius: ${CLAIM_RADIUS}. Township area prep queued. First builder will arrive soon.`);
    } catch (error) {
      sendDebugLogError(addonName, "Register Town", error);
      messagePlayer(player, "§cTownship error while founding town. Check content log.");
    }
  }

  function getTownStatusText(town) {
    if (!town) return "§cNo township record found for this Founding Stone.";
    const center = town.center ?? { x: 0, y: 0, z: 0 };
    return [
      "§6--- Township Status ---",
      `§eTier: §f${town.tier ?? 1}`,
      `§eTown Front: §f${town.frontDirection ?? "unknown"}`,
      `§eBuilder: §f${town.builderStatus ?? "unknown"}${town.builderPaused ? " (paused)" : ""}`,
      `§eAuto Build Lots: §f${(town.autoBuildLots ?? true) ? "on" : "off"}`,
      `§eAuto Roads: §f${(town.autoRoads ?? true) ? "on" : "off"}`,
      `§eAuto Place Lots: §f${(town.autoPlaceLots ?? false) ? "on" : "off"}`,
      `§eAuto Lot Limits: §fS ${town.maxSmallLots ?? AUTO_PLACE_MAX_SMALL} / M ${town.maxMediumLots ?? AUTO_PLACE_MAX_MEDIUM} / L ${town.maxLargeLots ?? AUTO_PLACE_MAX_LARGE}`,
      `§eTown Prep: §f${town.townPrepStatus ?? "not_started"} (${town.townPrepPhase ?? "not_started"})`,
      `§eStarter Camp: §f${town.campStatus ?? "unknown"}${town.campLastPhase ? ` (${town.campLastPhase})` : ""}`,
      `§eTownship Radius: §f${town.buildRadius ?? STARTING_BUILD_RADIUS}`,
      `§eTown Center: §f${center.x}, ${center.y}, ${center.z}`,
      `§eRegistered Townships This World: §f${getTowns().length}`,
      `§eRegistered Lots: §f${getLots(town).length}`,
      `§eQueued Jobs: §f${getJobs(town).length}`
    ].join("\n");
  }

  function showTownStatusFromBlock(block, player) {
    try {
      if (!block || block.typeId !== FOUNDING_STONE_ID) return;
      const town = getTownAtBlock(block.location, block.dimension.id);
      if (!town) return messagePlayer(player, getTownStatusText(town));
      showFoundingStoneMenu(block, player, town);
    } catch (error) {
      sendDebugLogError(addonName, "Show Town Status", error);
      messagePlayer(player, "§cTownship error while reading status. Check content log.");
    }
  }

  function cleanupTownAt(location, dimensionId, player) {
    try {
      const towns = getTowns();
      const remaining = towns.filter(town => !(town.dimensionId === dimensionId && town.center.x === location.x && town.center.y === location.y && town.center.z === location.z));
      if (remaining.length !== towns.length) {
        saveTowns(remaining);
        messagePlayer(player, "§eTownship record removed for this Founding Stone.");
      }
    } catch (error) {
      sendDebugLogError(addonName, "Cleanup Town", error);
    }
  }

  return { registerTownFromBlock, getTownStatusText, showTownStatusFromBlock, cleanupTownAt };
}
