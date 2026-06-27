export function createLotPrepSystem({
  addonName,
  runtimeState,
  transformFromBackAnchor,
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
  queueSmallHouseBuild,
  constants
}) {
  const {
    LOT_SMALL_HALF,
    LOT_SMALL_SIZE,
    LOT_PATH_OFFSET,
    LOT_PREP_INTERVAL_TICKS,
    LOT_PREP_BLOCKS_PER_STEP,
    LOT_STATUS_QUEUED,
    LOT_STATUS_PREPARING,
    LOT_STATUS_READY
  } = constants;

  function queueLotPrep(town, lot) {
    if (!town || !lot) return;
    const jobs = getJobs(town);
    const existing = jobs.find(job => job && job.type === "prepare_lot" && job.lotId === lot.id && job.status !== "complete");
    if (existing) return;
    lot.status = LOT_STATUS_QUEUED;
    lot.prepPhase = "queued";
    jobs.push({
      type: "prepare_lot",
      lotId: lot.id,
      status: "queued",
      nextIndex: 0,
      nextTick: runtimeState.tickCounter + LOT_PREP_INTERVAL_TICKS,
      lastPhase: undefined
    });
  }

  function getLotPrepPlan(lot) {
    const marker = lot.marker;
    const y = Math.floor(marker.y);
    const half = lot.halfSize ?? LOT_SMALL_HALF;
    const depth = (lot.size ?? LOT_SMALL_SIZE) - 1;
    const backDirection = lot.backDirection ?? "north";
    const plan = [];

    const add = (phase, lx, dy, lb, typeId) => {
      const p = transformFromBackAnchor(marker, backDirection, lx, lb);
      plan.push({ phase, x: p.x, y: y + dy, z: p.z, typeId });
    };

    for (let cy = 0; cy <= 5; cy++) {
      for (let lx = -half; lx <= half; lx++) {
        for (let lb = 0; lb <= depth; lb++) {
          if (lx === 0 && lb === 0 && cy === 0) continue;
          add("clear_lot", lx, cy, lb, "minecraft:air");
        }
      }
    }

    for (let lx = -half; lx <= half; lx++) {
      for (let lb = 0; lb <= depth; lb++) {
        add("level_lot", lx, -3, lb, "minecraft:dirt");
        add("level_lot", lx, -2, lb, "minecraft:dirt");
        add("level_lot", lx, -1, lb, "minecraft:dirt");
      }
    }

    for (let lx = -half; lx <= half; lx++) {
      const frontOpen = (lx >= LOT_PATH_OFFSET - 1 && lx <= LOT_PATH_OFFSET + 1);
      if (!frontOpen && lx !== 0) add("outline_lot", lx, 0, 0, "minecraft:oak_fence");
      add("outline_lot", lx, 0, depth, "minecraft:oak_fence");
    }

    for (let lb = 1; lb <= depth - 1; lb++) {
      add("outline_lot", -half, 0, lb, "minecraft:oak_fence");
      add("outline_lot", half, 0, lb, "minecraft:oak_fence");
    }

    for (const [cx, cb] of [[-half, 0], [half, 0], [-half, depth], [half, depth]]) {
      add("outline_lot", cx, 1, cb, "minecraft:stripped_oak_log");
    }

    return plan;
  }

  function getLotPrepPhaseLabel(phase) {
    if (phase === "clear_lot") return "clearing a township lot";
    if (phase === "level_lot") return "leveling a township lot";
    if (phase === "outline_lot") return "marking a township lot boundary";
    return phase ?? "preparing a township lot";
  }

  function processLotPrepJob(town, job) {
    try {
      if (!town || !job || job.type !== "prepare_lot" || job.status === "complete") return false;
      if (typeof job.nextTick === "number" && runtimeState.tickCounter < job.nextTick) return false;

      const lot = getLotById(town, job.lotId);
      if (!lot || !lot.marker) {
        job.status = "complete";
        return true;
      }

      const dimension = getDimensionFromId(town.dimensionId);
      ensureActiveJobTickingArea(town, job, dimension);
      if (!waitForTickingAreaReady(job, dimension, job.loadBounds, "Active lot prep job")) {
        job.nextTick = runtimeState.tickCounter + LOT_PREP_INTERVAL_TICKS;
        return true;
      }
      const markerBlock = dimension.getBlock(lot.marker);
      if (!markerBlock || !isLotMarkerType(markerBlock.typeId)) {
        lot.status = "missing_marker";
        job.status = "complete";
        return true;
      }

      lot.townCenter = town.center;
      keepBuilderNearLocation(town, lot.marker, 12);

      const plan = getLotPrepPlan(lot);
      let index = typeof job.nextIndex === "number" ? job.nextIndex : 0;

      while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) index++;

      if (index >= plan.length) {
        if (!verifyPlanComplete(dimension, plan, job, "Township lot prep")) return true;
        lot.status = LOT_STATUS_READY;
        lot.prepPhase = "complete";
        job.status = "complete";
        removeActiveJobTickingArea(town, job, dimension);
        sendSystemMessage(`§aTownship lot ready: ${lot.id}`);
        ensureTownAutomationDefaults(town);
        if (!lot.isBuildLotRecorder && town.autoBuildLots !== false) queueSmallHouseBuild(town, lot, true);
        return true;
      }

      lot.status = LOT_STATUS_PREPARING;
      let worked = 0;
      while (index < plan.length && worked < LOT_PREP_BLOCKS_PER_STEP) {
        while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) index++;
        if (index >= plan.length) break;

        const entry = plan[index];
        const phase = entry.phase ?? "outline_lot";
        if (job.lastPhase !== phase) {
          job.lastPhase = phase;
          lot.prepPhase = phase;
          sendSystemMessage(`§eTownship Builder is ${getLotPrepPhaseLabel(phase)}.`);
        }

        if (safeSetBlock(dimension, entry)) {
          index++;
          worked++;
        } else {
          break;
        }
      }

      job.nextIndex = index;
      job.nextTick = runtimeState.tickCounter + LOT_PREP_INTERVAL_TICKS;

      if (index >= plan.length) {
        if (!verifyPlanComplete(dimension, plan, job, "Township lot prep")) return true;
        lot.status = LOT_STATUS_READY;
        lot.prepPhase = "complete";
        job.status = "complete";
        removeActiveJobTickingArea(town, job, dimension);
        sendSystemMessage(`§aTownship lot ready: ${lot.id}`);
        ensureTownAutomationDefaults(town);
        if (!lot.isBuildLotRecorder && town.autoBuildLots !== false) queueSmallHouseBuild(town, lot, true);
      }

      return true;
    } catch (error) {
      sendDebugLogError(addonName, "Process Lot Prep Job", error);
      job.status = "error";
      const lot = getLotById(town, job.lotId);
      if (lot) lot.status = "prep_error";
      return true;
    }
  }

  return { queueLotPrep, processLotPrepJob, getLotPrepPlan };
}
