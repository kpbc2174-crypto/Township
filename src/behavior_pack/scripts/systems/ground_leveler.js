export function createGroundLevelerSystem({
  addonName,
  runtimeState,
  sendSystemMessage,
  sendDebugLogError,
  getJobs,
  getLots,
  getDimensionFromId,
  getCenteredBounds,
  pointInsideBounds,
  isLotMarkerType,
  blockAlreadyMatches,
  safeSetBlock,
  keepBuilderNearLocation,
  constants
}) {
  const {
    GROUND_LEVELER_ID,
    GROUND_LEVELER_HALF,
    GROUND_LEVELER_CLEAR_HEIGHT,
    GROUND_LEVELER_INTERVAL_TICKS,
    GROUND_LEVELER_BLOCKS_PER_STEP
  } = constants;

  function queueGroundLevelerJob(town, blockLocation, player) {
    if (!town || !blockLocation) return;
    const jobs = getJobs(town);
    const id = `${town.id}_leveler_${blockLocation.x}_${blockLocation.y}_${blockLocation.z}_${runtimeState.tickCounter}`;
    const existing = jobs.find(job => job && job.type === "ground_leveler" && job.location && job.location.x === blockLocation.x && job.location.y === blockLocation.y && job.location.location?.z === blockLocation.z && job.status !== "complete");
    if (existing) return;
    jobs.push({
      id,
      type: "ground_leveler",
      status: "queued",
      location: { x: blockLocation.x, y: blockLocation.y, z: blockLocation.z },
      nextIndex: 0,
      nextTick: runtimeState.tickCounter + GROUND_LEVELER_INTERVAL_TICKS,
      lastPhase: undefined
    });
    if (player) sendSystemMessage(`§eTownship Ground Leveler queued a ${GROUND_LEVELER_HALF * 2 + 1}x${GROUND_LEVELER_HALF * 2 + 1} flatten job with ${GROUND_LEVELER_CLEAR_HEIGHT} blocks of overhead clearing.`);
  }

  function cleanupLotsInsideGroundLeveler(town, dimension, job) {
    try {
      if (!town || !job?.location) return;
      const loc = job.location;
      const protectedCenter = town.center ? getCenteredBounds(town.center, 10) : undefined;
      const removedIds = new Set();
      const remaining = [];
      for (const lot of getLots(town)) {
        const marker = lot?.marker;
        if (!marker) {
          remaining.push(lot);
          continue;
        }
        const insideRange = Math.abs(marker.x - loc.x) <= GROUND_LEVELER_HALF && Math.abs(marker.z - loc.z) <= GROUND_LEVELER_HALF;
        const protectedMain = protectedCenter && pointInsideBounds(marker.x, marker.z, protectedCenter);
        if (insideRange && !protectedMain) {
          removedIds.add(lot.id);
          try {
            const b = dimension.getBlock(marker);
            if (b && isLotMarkerType(b.typeId)) b.setType("minecraft:air");
          } catch (blockError) {
            sendDebugLogError(addonName, "Ground Leveler Clear Lot Marker", blockError);
          }
        } else {
          remaining.push(lot);
        }
      }
      if (removedIds.size > 0) {
        town.lots = remaining;
        town.jobs = getJobs(town).filter(j => !(j?.lotId && removedIds.has(j.lotId)));
        sendSystemMessage(`§eTownship Ground Leveler removed ${removedIds.size} lot marker record(s).`);
      }
    } catch (error) {
      sendDebugLogError(addonName, "Ground Leveler Cleanup Lots", error);
    }
  }

  function getGroundLevelerPlan(town, job) {
    const loc = job.location;
    const plan = [];
    if (!loc) return plan;
    const x0 = Math.floor(loc.x);
    const y0 = Math.floor(loc.y);
    const z0 = Math.floor(loc.z);
    const protectedCenter = town?.center ? getCenteredBounds(town.center, 10) : undefined;

    for (let cy = 0; cy <= GROUND_LEVELER_CLEAR_HEIGHT; cy++) {
      for (let dx = -GROUND_LEVELER_HALF; dx <= GROUND_LEVELER_HALF; dx++) {
        for (let dz = -GROUND_LEVELER_HALF; dz <= GROUND_LEVELER_HALF; dz++) {
          const wx = x0 + dx;
          const wz = z0 + dz;
          if (dx === 0 && dz === 0 && cy === 0) continue;
          if (protectedCenter && pointInsideBounds(wx, wz, protectedCenter)) continue;
          plan.push({ phase: "clear_ground_leveler", x: wx, y: y0 + cy, z: wz, typeId: "minecraft:air", clearLotMarker: true });
        }
      }
    }

    for (let dx = -GROUND_LEVELER_HALF; dx <= GROUND_LEVELER_HALF; dx++) {
      for (let dz = -GROUND_LEVELER_HALF; dz <= GROUND_LEVELER_HALF; dz++) {
        const wx = x0 + dx;
        const wz = z0 + dz;
        if (protectedCenter && pointInsideBounds(wx, wz, protectedCenter)) continue;
        plan.push({ phase: "level_ground_leveler", x: wx, y: y0 - 3, z: wz, typeId: "minecraft:dirt" });
        plan.push({ phase: "level_ground_leveler", x: wx, y: y0 - 2, z: wz, typeId: "minecraft:dirt" });
        plan.push({ phase: "level_ground_leveler", x: wx, y: y0 - 1, z: wz, typeId: "minecraft:dirt" });
      }
    }
    return plan;
  }

  function getGroundLevelerPhaseLabel(phase) {
    if (phase === "clear_ground_leveler") return "clearing a large township work area";
    if (phase === "level_ground_leveler") return "leveling a large township work area";
    return phase ?? "using a Township Ground Leveler";
  }

  function processGroundLevelerJob(town, job) {
    try {
      if (!town || !job || job.type !== "ground_leveler" || job.status === "complete") return false;
      if (typeof job.nextTick === "number" && runtimeState.tickCounter < job.nextTick) return false;

      const dimension = getDimensionFromId(town.dimensionId);
      const levelerBlock = dimension.getBlock(job.location);
      if (!levelerBlock || levelerBlock.typeId !== GROUND_LEVELER_ID) {
        job.status = "complete";
        return true;
      }

      keepBuilderNearLocation(town, job.location, 18);
      if (!job.cleanedLots) {
        cleanupLotsInsideGroundLeveler(town, dimension, job);
        job.cleanedLots = true;
      }
      const plan = getGroundLevelerPlan(town, job);
      let index = typeof job.nextIndex === "number" ? job.nextIndex : 0;

      while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) index++;
      if (index >= plan.length) {
        try {
          const b = dimension.getBlock(job.location);
          if (b && b.typeId === GROUND_LEVELER_ID) b.setType("minecraft:air");
        } catch (cleanupError) {
          sendDebugLogError(addonName, "Ground Leveler Self Remove", cleanupError);
        }
        job.status = "complete";
        sendSystemMessage("§aTownship Ground Leveler job complete and removed itself.");
        return true;
      }

      let worked = 0;
      while (index < plan.length && worked < GROUND_LEVELER_BLOCKS_PER_STEP) {
        while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) index++;
        if (index >= plan.length) break;
        const entry = plan[index];
        const phase = entry.phase ?? "ground_leveler";
        if (job.lastPhase !== phase) {
          job.lastPhase = phase;
          sendSystemMessage(`§eTownship Builder is ${getGroundLevelerPhaseLabel(phase)}.`);
        }
        if (safeSetBlock(dimension, entry)) {
          index++;
          worked++;
        } else {
          break;
        }
      }

      job.nextIndex = index;
      job.nextTick = runtimeState.tickCounter + GROUND_LEVELER_INTERVAL_TICKS;
      if (index >= plan.length) {
        try {
          const b = dimension.getBlock(job.location);
          if (b && b.typeId === GROUND_LEVELER_ID) b.setType("minecraft:air");
        } catch (cleanupError) {
          sendDebugLogError(addonName, "Ground Leveler Self Remove", cleanupError);
        }
        job.status = "complete";
        sendSystemMessage("§aTownship Ground Leveler job complete and removed itself.");
      }
      return true;
    } catch (error) {
      sendDebugLogError(addonName, "Process Ground Leveler Job", error);
      job.status = "error";
      return true;
    }
  }

  return { queueGroundLevelerJob, processGroundLevelerJob };
}
