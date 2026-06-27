export function createTownScheduler({
  addonName,
  runtimeState,
  sendDebugLogError,
  getTowns,
  getJobs,
  saveTowns,
  ensureTownAutomationDefaults,
  getDimensionFromId,
  ensureFoundingStoneBlock,
  spawnBuilderForTown,
  spawnTwoVillageResidents,
  queueStarterCamp,
  processStarterCamp,
  processTownPrepJob,
  processBoundaryRebuildJob,
  processGroundLevelerJob,
  processLotPrepJob,
  processSmallHouseJob,
  processRoadJob,
  runAutoLotPlacement,
  constants
}) {
  const {
    CAMP_JOB_STATUS_PENDING,
    CAMP_JOB_STATUS_BUILDING,
    CAMP_JOB_STATUS_COMPLETE
  } = constants;

  function processLotJobs(town) {
    let changed = false;
    const jobs = getJobs(town);

    for (const job of jobs) {
      if (!job || job.status === "complete") continue;
      if (job.type === "town_prep") {
        const didWork = processTownPrepJob(town, job);
        if (didWork) changed = true;
        break;
      }
    }

    for (const job of jobs) {
      if (!job || job.status === "complete") continue;
      if (job.type === "rebuild_boundary") {
        const didWork = processBoundaryRebuildJob(town, job);
        if (didWork) changed = true;
        break;
      }
    }

    for (const job of jobs) {
      if (!job || job.status === "complete") continue;
      if (job.type === "ground_leveler") {
        const didWork = processGroundLevelerJob(town, job);
        if (didWork) changed = true;
        break;
      }
    }

    for (const job of jobs) {
      if (!job || job.status === "complete") continue;
      if (job.type === "town_prep" || job.type === "ground_leveler" || job.type === "rebuild_boundary") continue;
      let didWork = false;
      if (job.type === "prepare_lot") didWork = processLotPrepJob(town, job);
      else if (job.type === "build_small_house") didWork = processSmallHouseJob(town, job);
      else if (job.type === "build_road") didWork = processRoadJob(town, job);
      if (didWork) {
        changed = true;
        break;
      }
    }

    town.jobs = jobs.filter(job => job && job.status !== "complete");
    return changed;
  }

  function processTowns() {
    try {
      const towns = getTowns();
      let changed = false;

      for (const town of towns) {
        if (!town) continue;
        ensureTownAutomationDefaults(town);
        if (town.builderStatus === "pending" && typeof town.builderSpawnTick === "number" && runtimeState.tickCounter >= town.builderSpawnTick) {
          const spawned = spawnBuilderForTown(town);
          if (!spawned && town.builderStatus === "spawn_error") {
            town.builderSpawnTick = runtimeState.tickCounter + 20 * 10;
            town.builderStatus = "pending";
          }
          changed = true;
        }

        if (town.builderStatus === "missing_founding_stone" && (town.townPrepStatus ?? "") === "complete") {
          const dimension = getDimensionFromId(town.dimensionId);
          ensureFoundingStoneBlock(town, dimension);
          town.builderStatus = "pending";
          town.builderSpawnTick = runtimeState.tickCounter + 20;
          changed = true;
        }

        const pendingTownPrep = getJobs(town).some(job => job && job.type === "town_prep" && job.status !== "complete");
        if (pendingTownPrep) {
          const jobs = getJobs(town);
          const prepJob = jobs.find(job => job && job.type === "town_prep" && job.status !== "complete");
          if (prepJob && processTownPrepJob(town, prepJob)) changed = true;
          town.jobs = jobs.filter(job => job && job.status !== "complete");
          continue;
        }

        if (town.builderPaused === true) continue;

        if (town.builderStatus === "present" && town.campStatus === CAMP_JOB_STATUS_PENDING) {
          queueStarterCamp(town);
          changed = true;
        }

        if (town.builderStatus === "present" && town.campStatus === CAMP_JOB_STATUS_BUILDING) {
          const campChanged = processStarterCamp(town);
          if (campChanged) changed = true;
        }

        if (town.builderStatus === "present" && town.campStatus === CAMP_JOB_STATUS_COMPLETE) {
          if (town.vanillaVillagersSpawned !== true) {
            try {
              spawnTwoVillageResidents(town, getDimensionFromId(town.dimensionId));
              changed = true;
            } catch (residentError) {
              sendDebugLogError(addonName, "Ensure Township Villagers", residentError);
            }
          }
          const autoPlaced = runAutoLotPlacement(town, false);
          if (autoPlaced) changed = true;
          const lotChanged = processLotJobs(town);
          if (lotChanged) changed = true;
        }
      }

      if (changed) saveTowns(towns);
    } catch (error) {
      sendDebugLogError(addonName, "Process Towns", error);
    }
  }

  return { processLotJobs, processTowns };
}
