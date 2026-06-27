export function createBuildingSystem({
  addonName,
  runtimeState,
  buildingPlans,
  sendSystemMessage,
  sendDebugLogError,
  getJobs,
  getLotById,
  getDimensionFromId,
  ensureTownAutomationDefaults,
  isLotMarkerType,
  ensureActiveJobTickingArea,
  removeActiveJobTickingArea,
  waitForTickingAreaReady,
  verifyPlanComplete,
  blockAlreadyMatches,
  safeSetBlock,
  keepBuilderNearLocation,
  queueRoadToTown,
  constants
}) {
  const {
    HOUSE_BUILD_INTERVAL_TICKS,
    HOUSE_BLOCKS_PER_STEP,
    LOT_STATUS_BUILDING,
    LOT_STATUS_OCCUPIED
  } = constants;

  function queueSmallHouseBuild(town, lot, priority = false) {
    if (!town || !lot) return;
    if ((lot.buildingType ?? "empty") !== "empty") return;
    const jobs = getJobs(town);
    const existing = jobs.find(job => job && job.type === "build_small_house" && job.lotId === lot.id && job.status !== "complete");
    if (existing) return;
    const variant = buildingPlans.chooseAutoBuildingVariant(lot);
    lot.status = LOT_STATUS_BUILDING;
    lot.buildingType = `${variant}_pending`;
    lot.buildVariant = variant;
    lot.buildPhase = "queued";
    const newJob = {
      type: "build_small_house",
      lotId: lot.id,
      buildingVariant: variant,
      status: "queued",
      nextIndex: 0,
      nextTick: runtimeState.tickCounter + HOUSE_BUILD_INTERVAL_TICKS,
      lastPhase: undefined
    };
    if (priority) jobs.unshift(newJob);
    else jobs.push(newJob);
  }

  function completeBuilding(town, lot, job, dimension, variant) {
    lot.status = LOT_STATUS_OCCUPIED;
    lot.buildingType = variant;
    lot.buildingLevel = 1;
    lot.buildPhase = "complete";
    job.status = "complete";
    removeActiveJobTickingArea(town, job, dimension);
    sendSystemMessage(`§a${buildingPlans.buildingDisplayName(variant)} complete on lot: ${lot.id}`);
    ensureTownAutomationDefaults(town);
    if (town.autoRoads !== false) queueRoadToTown(town, lot, true);
  }

  function processSmallHouseJob(town, job) {
    try {
      if (!town || !job || job.type !== "build_small_house" || job.status === "complete") return false;
      if (typeof job.nextTick === "number" && runtimeState.tickCounter < job.nextTick) return false;

      const lot = getLotById(town, job.lotId);
      if (!lot || !lot.marker) {
        job.status = "complete";
        return true;
      }

      const dimension = getDimensionFromId(town.dimensionId);
      ensureActiveJobTickingArea(town, job, dimension);
      if (!waitForTickingAreaReady(job, dimension, job.loadBounds, "Active build job")) {
        job.nextTick = runtimeState.tickCounter + HOUSE_BUILD_INTERVAL_TICKS;
        return true;
      }
      const markerBlock = dimension.getBlock(lot.marker);
      if (!markerBlock || !isLotMarkerType(markerBlock.typeId)) {
        lot.status = "missing_marker";
        job.status = "complete";
        return true;
      }

      keepBuilderNearLocation(town, lot.marker, 12);

      const variant = job.buildingVariant ?? lot.buildVariant ?? buildingPlans.chooseAutoBuildingVariant(lot);
      lot.buildVariant = variant;
      const plan = buildingPlans.getAutoBuildingPlan(town, lot, variant);
      let index = typeof job.nextIndex === "number" ? job.nextIndex : 0;

      while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) index++;

      if (index >= plan.length) {
        if (!verifyPlanComplete(dimension, plan, job, buildingPlans.buildingDisplayName(variant))) return true;
        completeBuilding(town, lot, job, dimension, variant);
        return true;
      }

      lot.status = LOT_STATUS_BUILDING;
      let worked = 0;
      while (index < plan.length && worked < HOUSE_BLOCKS_PER_STEP) {
        while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) index++;
        if (index >= plan.length) break;

        const entry = plan[index];
        const phase = entry.phase ?? "build_small_house";
        if (job.lastPhase !== phase) {
          job.lastPhase = phase;
          lot.buildPhase = phase;
          sendSystemMessage(`§eTownship Builder is ${buildingPlans.getSmallHousePhaseLabel(phase, variant)}.`);
        }

        if (safeSetBlock(dimension, entry)) {
          index++;
          worked++;
        } else {
          break;
        }
      }

      job.nextIndex = index;
      job.nextTick = runtimeState.tickCounter + HOUSE_BUILD_INTERVAL_TICKS;

      if (index >= plan.length) {
        if (!verifyPlanComplete(dimension, plan, job, buildingPlans.buildingDisplayName(variant))) return true;
        completeBuilding(town, lot, job, dimension, variant);
      }

      return true;
    } catch (error) {
      sendDebugLogError(addonName, "Process Small House Job", error);
      job.status = "error";
      const lot = getLotById(town, job.lotId);
      if (lot) lot.status = "small_house_error";
      return true;
    }
  }

  return { queueSmallHouseBuild, processSmallHouseJob };
}
