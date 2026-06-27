export function createRoadSystem({
  addonName,
  runtimeState,
  transformFromBackAnchor,
  distance2D,
  sendSystemMessage,
  sendDebugLogError,
  getJobs,
  getLots,
  getLotById,
  getLotBounds,
  getCenteredBounds,
  pointInsideBounds,
  getDimensionFromId,
  isLotMarkerType,
  ensureActiveJobTickingArea,
  removeActiveJobTickingArea,
  waitForTickingAreaReady,
  verifyPlanComplete,
  blockAlreadyMatches,
  safeSetBlock,
  keepBuilderNearLocation,
  constants
}) {
  const {
    DIRT_ROAD_ID,
    LOT_SMALL_HALF,
    LOT_PATH_OFFSET,
    LOT_BUFFER,
    STARTING_BUILD_RADIUS,
    ACTIVE_JOB_BUFFER,
    ROAD_BUILD_INTERVAL_TICKS,
    ROAD_BLOCKS_PER_STEP,
    ROAD_STATUS_NOT_CONNECTED,
    ROAD_STATUS_QUEUED,
    ROAD_STATUS_BUILDING,
    ROAD_STATUS_CONNECTED
  } = constants;

  function expandBounds(bounds, amount) {
    if (!bounds) return undefined;
    return {
      minX: bounds.minX - amount,
      maxX: bounds.maxX + amount,
      minZ: bounds.minZ - amount,
      maxZ: bounds.maxZ + amount
    };
  }

  function getAllRoadBlockedBounds(town, currentLot = undefined, expand = 1) {
    const blocked = [];
    blocked.push(expandBounds(getCenteredBounds(town.center, LOT_SMALL_HALF), expand));
    for (const lot of getLots(town)) {
      const b = getLotBounds(lot);
      if (!b) continue;
      blocked.push(expandBounds(b, expand));
    }
    return blocked.filter(Boolean);
  }

  function pointInsideAnyBounds(x, z, boundsList) {
    for (const bounds of boundsList) {
      if (pointInsideBounds(x, z, bounds)) return true;
    }
    return false;
  }

  function findNearestExistingRoadTarget(town, start, currentLot) {
    try {
      const dimension = getDimensionFromId(town.dimensionId);
      const buildRadius = town.buildRadius ?? STARTING_BUILD_RADIUS;
      const cx = Math.floor(town.center.x);
      const cz = Math.floor(town.center.z);
      const blocked = getAllRoadBlockedBounds(town, currentLot, 2);
      let best = undefined;
      let bestDistance = 999999;

      for (let x = cx - buildRadius; x <= cx + buildRadius; x++) {
        for (let z = cz - buildRadius; z <= cz + buildRadius; z++) {
          if (pointInsideAnyBounds(x, z, blocked)) continue;
          const block = dimension.getBlock({ x, y: start.y, z });
          if (!block || block.typeId !== DIRT_ROAD_ID) continue;
          const d = Math.abs(x - start.x) + Math.abs(z - start.z);
          if (d < 4) continue;
          if (d < bestDistance) {
            bestDistance = d;
            best = { x, y: start.y, z };
          }
        }
      }

      return best;
    } catch (error) {
      sendDebugLogError(addonName, "Find Existing Road Target", error);
      return undefined;
    }
  }

  function buildRoadCenterPath(town, lot, start, end) {
    const buildRadius = town.buildRadius ?? STARTING_BUILD_RADIUS;
    const cx = Math.floor(town.center.x);
    const cz = Math.floor(town.center.z);
    const minX = cx - buildRadius;
    const maxX = cx + buildRadius;
    const minZ = cz - buildRadius;
    const maxZ = cz + buildRadius;
    const blocked = getAllRoadBlockedBounds(town, lot, 2);
    const startKey = `${start.x},${start.z}`;
    const endKey = `${end.x},${end.z}`;

    const isBlocked = (x, z) => {
      const key = `${x},${z}`;
      if (key === startKey || key === endKey) return false;
      if (x < minX || x > maxX || z < minZ || z > maxZ) return true;
      return pointInsideAnyBounds(x, z, blocked);
    };

    if (isBlocked(end.x, end.z)) return [];

    const open = [{ x: start.x, z: start.z, g: 0, f: Math.abs(start.x - end.x) + Math.abs(start.z - end.z) }];
    const cameFrom = new Map();
    const bestG = new Map([[startKey, 0]]);
    const closed = new Set();
    const directions = [
      { dx: 1, dz: 0 },
      { dx: -1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: 0, dz: -1 }
    ];

    let iterations = 0;
    while (open.length > 0 && iterations < 30000) {
      iterations++;
      open.sort((a, b) => a.f - b.f);
      const current = open.shift();
      const currentKey = `${current.x},${current.z}`;
      if (closed.has(currentKey)) continue;
      closed.add(currentKey);

      if (currentKey === endKey) {
        const path = [];
        let k = currentKey;
        let p = { x: current.x, z: current.z };
        path.push(p);
        while (cameFrom.has(k)) {
          p = cameFrom.get(k);
          k = `${p.x},${p.z}`;
          path.push(p);
        }
        path.reverse();
        return path;
      }

      for (const dir of directions) {
        const nx = current.x + dir.dx;
        const nz = current.z + dir.dz;
        const nk = `${nx},${nz}`;
        if (closed.has(nk) || isBlocked(nx, nz)) continue;
        const ng = current.g + 1;
        if (ng >= (bestG.get(nk) ?? 999999)) continue;
        bestG.set(nk, ng);
        cameFrom.set(nk, { x: current.x, z: current.z });
        const h = Math.abs(nx - end.x) + Math.abs(nz - end.z);
        open.push({ x: nx, z: nz, g: ng, f: ng + h });
      }
    }

    return [];
  }

  function queueRoadToTown(town, lot, priority = false) {
    if (!town || !lot || !lot.marker) return;
    if (lot.roadStatus === ROAD_STATUS_CONNECTED || lot.roadStatus === ROAD_STATUS_QUEUED || lot.roadStatus === ROAD_STATUS_BUILDING) return;
    const jobs = getJobs(town);
    const existing = jobs.find(job => job && job.type === "build_road" && job.lotId === lot.id && job.status !== "complete");
    if (existing) return;
    lot.roadStatus = ROAD_STATUS_QUEUED;
    lot.roadPhase = "queued";
    const newJob = {
      type: "build_road",
      lotId: lot.id,
      status: "queued",
      nextIndex: 0,
      nextTick: runtimeState.tickCounter + ROAD_BUILD_INTERVAL_TICKS,
      lastPhase: undefined
    };
    if (priority) jobs.unshift(newJob);
    else jobs.push(newJob);
  }

  function getRoadPlan(town, lot) {
    const plan = [];
    if (!town || !lot || !lot.marker || !town.center) return plan;
    const townFront = (() => {
      const direction = town.frontDirection ?? "south";
      if (direction === "north") return { dx: 0, dz: -1 };
      if (direction === "east") return { dx: 1, dz: 0 };
      if (direction === "west") return { dx: -1, dz: 0 };
      return { dx: 0, dz: 1 };
    })();

    const roadStartPoint = transformFromBackAnchor(lot.marker, lot.backDirection ?? "north", LOT_PATH_OFFSET, -3);
    const start = { x: Math.floor(roadStartPoint.x), y: Math.floor(lot.marker.y) - 1, z: Math.floor(roadStartPoint.z) };
    const fallbackEnd = { x: Math.floor(town.center.x) + townFront.dx * 7, y: Math.floor(town.center.y) - 1, z: Math.floor(town.center.z) + townFront.dz * 7 };
    const existingRoadTarget = findNearestExistingRoadTarget(town, start, lot);
    const end = existingRoadTarget ?? fallbackEnd;
    const blockedForBrush = getAllRoadBlockedBounds(town, lot, 2);

    const pushRoad = (rx, rz) => {
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          const wx = rx + ox;
          const wz = rz + oz;
          if (wx === Math.floor(lot.marker.x) && wz === Math.floor(lot.marker.z)) continue;
          if (wx === Math.floor(town.center.x) && wz === Math.floor(town.center.z)) continue;
          if (pointInsideAnyBounds(wx, wz, blockedForBrush)) continue;
          plan.push({ phase: "clear_road", x: wx, y: start.y + 1, z: wz, typeId: "minecraft:air" });
          plan.push({ phase: "build_road", x: wx, y: start.y, z: wz, typeId: DIRT_ROAD_ID });
        }
      }
    };

    const centerPath = buildRoadCenterPath(town, lot, start, end);
    if (centerPath.length === 0) return plan;
    for (const p of centerPath) pushRoad(p.x, p.z);
    return plan;
  }

  function getRoadPhaseLabel(phase) {
    if (phase === "clear_road") return "clearing a road path";
    if (phase === "build_road") return "building a township dirt road";
    return phase ?? "building a township road";
  }

  function processRoadJob(town, job) {
    try {
      if (!town || !job || job.type !== "build_road" || job.status === "complete") return false;
      if (typeof job.nextTick === "number" && runtimeState.tickCounter < job.nextTick) return false;

      const lot = getLotById(town, job.lotId);
      if (!lot || !lot.marker) {
        job.status = "complete";
        return true;
      }

      const dimension = getDimensionFromId(town.dimensionId);
      ensureActiveJobTickingArea(town, job, dimension);
      if (!waitForTickingAreaReady(job, dimension, job.loadBounds, "Active road job")) {
        job.nextTick = runtimeState.tickCounter + ROAD_BUILD_INTERVAL_TICKS;
        return true;
      }
      const markerBlock = dimension.getBlock(lot.marker);
      if (!markerBlock || !isLotMarkerType(markerBlock.typeId)) {
        lot.status = "missing_marker";
        job.status = "complete";
        return true;
      }

      keepBuilderNearLocation(town, lot.marker, 14);
      if (!Array.isArray(job.plan) || job.plan.length === 0) job.plan = getRoadPlan(town, lot);
      const plan = job.plan;
      let index = typeof job.nextIndex === "number" ? job.nextIndex : 0;

      while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) index++;
      if (index >= plan.length) {
        if (!verifyPlanComplete(dimension, plan, job, "Township road")) return true;
        lot.roadStatus = ROAD_STATUS_CONNECTED;
        lot.roadPhase = "complete";
        job.status = "complete";
        removeActiveJobTickingArea(town, job, dimension);
        sendSystemMessage(`§aTownship dirt road connected for lot: ${lot.id}`);
        return true;
      }

      lot.roadStatus = ROAD_STATUS_BUILDING;
      let worked = 0;
      while (index < plan.length && worked < ROAD_BLOCKS_PER_STEP) {
        while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) index++;
        if (index >= plan.length) break;

        const entry = plan[index];
        const phase = entry.phase ?? "build_road";
        if (job.lastPhase !== phase) {
          job.lastPhase = phase;
          lot.roadPhase = phase;
          sendSystemMessage(`§eTownship Builder is ${getRoadPhaseLabel(phase)}.`);
        }

        if (safeSetBlock(dimension, entry)) {
          index++;
          worked++;
        } else {
          break;
        }
      }

      job.nextIndex = index;
      job.nextTick = runtimeState.tickCounter + ROAD_BUILD_INTERVAL_TICKS;
      if (index >= plan.length) {
        if (!verifyPlanComplete(dimension, plan, job, "Township road")) return true;
        lot.roadStatus = ROAD_STATUS_CONNECTED;
        lot.roadPhase = "complete";
        job.status = "complete";
        removeActiveJobTickingArea(town, job, dimension);
        sendSystemMessage(`§aTownship dirt road connected for lot: ${lot.id}`);
      }
      return true;
    } catch (error) {
      sendDebugLogError(addonName, "Process Road Job", error);
      job.status = "error";
      const lot = getLotById(town, job.lotId);
      if (lot) lot.roadStatus = "road_error";
      return true;
    }
  }

  return { queueRoadToTown, processRoadJob, getRoadPlan };
}
