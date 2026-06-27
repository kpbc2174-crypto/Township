export function createGroundLevelerSystem({
  addonName,
  runtimeState,
  safeLocationKey,
  sendSystemMessage,
  sendDebugLogError,
  messagePlayer,
  getJobs,
  getLots,
  getDimensionFromId,
  getCenteredBounds,
  expandBounds,
  pointInsideBounds,
  isLotMarkerType,
  blockAlreadyMatches,
  safeSetBlock,
  keepBuilderNearLocation,
  constants
}) {
  const {
    GROUND_LEVELER_ID,
    GROUND_LEVELER_SIZE,
    GROUND_LEVELER_HALF,
    GROUND_LEVELER_CLEAR_HEIGHT,
    GROUND_LEVELER_INTERVAL_TICKS,
    GROUND_LEVELER_BLOCKS_PER_STEP
  } = constants;

  function queueGroundLevelerJob(town, blockLocation, player) {
    if (!town || !blockLocation) return;
    const jobs = getJobs(town);
    const id = `${town.id}_leveler_${safeLocationKey(blockLocation)}_${runtimeState.tickCounter}`;
    const existing = jobs.find(job => job && job.type === "ground_leveler" && job.location && job.location.x === blockLocation.x && job.location.y === blockLocation.y && job.location.z === blockLocation.z && job.status !== "complete");
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
    messagePlayer(player, `§eTownship Ground Leveler queued a ${GROUND_LEVELER_SIZE}x${GROUND_LEVELER_SIZE} flatten job with ${GROUND_LEVELER_CLEAR_HEIGHT} blocks of overhead clearing.`);
  }

  function cleanupLotsInsideGroundLeveler(town, dimension, job) {
    try {
      if (!town || !job?.location) return;
      const loc = job.location;
      const protectedCenter = town.center ? expandBounds(getCenteredBounds(town.center, 10), 0) : undefined;
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
            const block = dimension.getBlock(marker);
            if (block && isLotMarkerType(block.typeId)) block.setType("minecraft:air");
          } catch (blockError) {
            sendDebugLogError(addonName, "Ground Leveler Clear Lot Marker", blockError);
          }
        } else {
          remaining.push(lot);
        }
      }
      if (removedIds.size > 0) {
        town.lots = remaining;
        town.jobs = getJobs(town).filter(jobItem => !(jobItem?.lotId && removedIds.has(jobItem.lotId)));
        sendSystemMessage(`§eTownship Ground Leveler removed ${removedIds.size} lot marker record(s).`);
      }
    } catch (error) {
      sendDebugLogError(addonName, "Ground Leveler Cleanup Lots", error);
    }
  }

  function getGroundLevelerPlan(town, job) {
    const location = job.location;
    const plan = [];
    if (!location) return plan;
    const x0 = Math.floor(location.x);
    const y0 = Math.floor(location.y);
    const z0 = Math.floor(location.z);
    const protectedCenter = town?.center ? expandBounds(getCenteredBounds(town.center, 10), 0) : undefined;

    for (let cy = 0; cy <= GROUND_LEVELER_CLEAR_HEIGHT; cy++) {
      for (let dx = -GROUND_LEVELER_HALF; dx <= GROUND_LEVELER_HALF; dx++) {
        for (let dz = -GROUND_LEVELER_HALF; dz <= GROUND_LEVELER_HALF; dz++) {
          const x = x0 + dx;
          const z = z0 + dz;
          if (dx === 0 && dz === 0 && cy === 0) continue;
          if (protectedCenter && pointInsideBounds(x, z, protectedCenter)) continue;
          plan.push({ phase: "clear_ground_leveler", x, y: y0 + cy, z, typeId: "minecraft:air", clearLotMarker: true });
        }
      }
    }

    for (let dx = -GROUND_LEVELER_HALF; dx <= GROUND_LEVELER_HALF; dx++) {
      for (let dz = -GROUND_LEVELER_HALF; dz <= GOUND_LEVELER_HALF; dz++) {
        const x = x0 + dx;
        const z = z0 + dz;
        if (protectedCenter && pointInsideBounds(x, z, protectedCenter)) continue;
        plan.push({ phase: "level_ground_leveler", x, y: y0 - 3, z, typeId: "minecraft:dirt" });
        plan.push({ phase: "level_ground_leveler", x, y: y0 - 2, z, typeId: "minecraft:dirt" });
        plan.push({ phase: "level_ground_leveler", x, y: y0 - 1, z, typeId: "minecraft:dirt" });
      }
    }

    return plan;
  }

  function getGroundLevelerPhaseLabel(phase) {
    if (phase === "clear_ground_leveler") return "clearing a large township work area";
    if (phase === "level_ground_leveler") return "leveling a large township work area";
    return phase ?? "using a Township Ground Leveler";
  }

  function finishGroundLevelerJob(dimension, job) {
    try {
      const block = dimension.getBlock(job.location);
      if (block && block.typeId === GROUND_LEVELER_ID) block.setType("minecraft:air");
    } catch (error) {
      sendDebugLogError(addonName, "Ground Leveler Self Remove", error);
    }
    job.status = "complete";
    sendSystemMessage("§aTownship Ground Leveler job complete and removed itself.");
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
        finishGroundLevelerJob(dimension, job);
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
      if (index >= plan.length) finishGroundLevelerJob(dimension, job);
      return true;
    } catch (error) {
      sendDebugLogError(addonName, "Process Ground Leveler Job", error);
      job.status = "error";
      return true;
    }
  }

  return {
    queueGroundLevelerJob,
    processGroundLevelerJob,
    getGroundLevelerPlan
  };
}
