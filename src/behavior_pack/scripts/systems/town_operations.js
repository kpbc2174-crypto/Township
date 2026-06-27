export function createTownOperationsSystem({ addonName, runtimeState, townTag, sendSystemMessage, sendDebugLogError, getLots, getJobs, getDimensionFromId, getTownPrepPhasePlan, ensureFoundingStoneBlock, blockAlreadyMatches, safeSetBlock, queueStarterCamp, constants }) {
  const {
    FOUNDING_STONE_ID,
    TOWN_PREP_INTERVAL_TICKS,
    TOWN_PREP_BLOCKS_PER_STEP,
    TOWN_PREP_QUADRANTS,
    LOT_STATUS_READY,
    LOT_STATUS_OCCUPIED,
    ROAD_STATUS_CONNECTED
  } = constants;

  function queueReadyLotsForAutoBuild(town, queueSmallHouseBuild) {
    if (!town || typeof queueSmallHouseBuild !== "function") return 0;
    let count = 0;
    for (const lot of getLots(town)) {
      if (!lot) continue;
      const empty = !lot.buildingType || lot.buildingType === "empty";
      if (lot.isBuildLotRecorder) continue;
      if (lot.status === LOT_STATUS_READY && empty) {
        queueSmallHouseBuild(town, lot, false);
        count++;
      }
    }
    return count;
  }

  function queueRoadsForCompletedBuildings(town, queueRoadToTown) {
    if (!town || typeof queueRoadToTown !== "function") return 0;
    let count = 0;
    for (const lot of getLots(town)) {
      if (!lot) continue;
      if (lot.status === LOT_STATUS_OCCUPIED && lot.roadStatus !== ROAD_STATUS_CONNECTED) {
        queueRoadToTown(town, lot, false);
        count++;
      }
    }
    return count;
  }

  function queueBoundaryRebuild(town) {
    if (!town) return false;
    const jobs = getJobs(town);
    if (jobs.find(job => job && job.type === "rebuild_boundary" && job.status !== "complete")) return false;
    jobs.unshift({ type: "rebuild_boundary", status: "queued", quadrantIndex: 0, nextIndex: 0, nextTick: runtimeState.tickCounter + TOWN_PREP_INTERVAL_TICKS, lastPhase: undefined });
    return true;
  }

  function processBoundaryRebuildJob(town, job) {
    try {
      if (!town || !job || job.type !== "rebuild_boundary" || job.status === "complete") return false;
      if (typeof job.nextTick === "number" && runtimeState.tickCounter < job.nextTick) return false;
      const dimension = getDimensionFromId(town.dimensionId);
      if (typeof job.quadrantIndex !== "number") job.quadrantIndex = 0;
      if (job.quadrantIndex >= TOWN_PREP_QUADRANTS.length) {
        job.status = "complete";
        sendSystemMessage("§aTownship fence rebuild complete.");
        return true;
      }
      const quadrant = TOWN_PREP_QUADRANTS[job.quadrantIndex] ?? TOWN_PREP_QUADRANTS[0];
      const plan = getTownPrepPhasePlan(town, job.quadrantIndex, "mark_town_boundary");
      let index = typeof job.nextIndex === "number" ? job.nextIndex : 0;
      while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) index++;
      if (index >= plan.length) {
        job.quadrantIndex++;
        job.nextIndex = 0;
        job.lastPhase = undefined;
        return true;
      }
      if (job.lastPhase !== quadrant.label) {
        job.lastPhase = quadrant.label;
        sendSystemMessage(`§eTownship is rebuilding the town fence (${quadrant.label} section ${job.quadrantIndex + 1}/${TOWN_PREP_QUADRANTS.length}).`);
      }
      let worked = 0;
      while (index < plan.length && worked < TOWN_PREP_BLOCKS_PER_STEP) {
        while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) index++;
        if (index >= plan.length) break;
        if (safeSetBlock(dimension, plan[index])) {
          index++;
          worked++;
        } else {
          break;
        }
      }
      job.nextIndex = index;
      job.nextTick = runtimeState.tickCounter + TOWN_PREP_INTERVAL_TICKS;
      if (index >= plan.length) {
        job.quadrantIndex++;
        job.nextIndex = 0;
        job.lastPhase = undefined;
      }
      return true;
    } catch (error) {
      sendDebugLogError(addonName, "Process Boundary Rebuild Job", error);
      job.status = "error";
      return true;
    }
  }

  function spawnTwoVillageResidents(town, dimension) {
    try {
      if (!town || !dimension || town.vanillaVillagersSpawned === true) return;
      const center = town.center ?? { x: 0, y: 0, z: 0 };
      for (const spot of [{ x: center.x + 2, y: center.y + 1, z: center.z + 2 }, { x: center.x - 2, y: center.y + 1, z: center.z + 2 }]) {
        const villager = dimension.spawnEntity("minecraft:villager", spot);
        villager.addTag(townTag(town.id));
        villager.addTag("township_resident");
      }
      town.vanillaVillagersSpawned = true;
      sendSystemMessage("§aTwo villagers have arrived at the township.");
    } catch (error) {
      sendDebugLogError(addonName, "Spawn Township Villagers", error);
    }
  }

  function spawnBuilderForTown(town) {
    try {
      const dimension = getDimensionFromId(town.dimensionId);
      let block = dimension.getBlock(town.center);
      if ((!block || block.typeId !== FOUNDING_STONE_ID) && (town.townPrepStatus ?? "") === "complete") {
        ensureFoundingStoneBlock(town, dimension);
        block = dimension.getBlock(town.center);
      }
      if (!block || block.typeId !== FOUNDING_STONE_ID) {
        town.builderStatus = "missing_founding_stone";
        return false;
      }
      town.builderEntityId = undefined;
      town.builderStatus = "present";
      sendSystemMessage("§aTownship construction controller is active.");
      if (!getJobs(town).some(job => job && job.type === "town_prep" && job.status !== "complete")) queueStarterCamp(town);
      else sendSystemMessage("§eTownship construction is waiting for township founding area prep to finish.");
      return true;
    } catch (error) {
      sendDebugLogError(addonName, "Activate Township Construction", error);
      town.builderStatus = "spawn_error";
      return false;
    }
  }

  return { queueReadyLotsForAutoBuild, queueRoadsForCompletedBuildings, queueBoundaryRebuild, processBoundaryRebuildJob, spawnTwoVillageResidents, spawnBuilderForTown };
}
