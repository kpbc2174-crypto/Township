export function createAutoLotSystem({
  addonName,
  runtimeState,
  distance2D,
  oppositeDirection,
  sendSystemMessage,
  sendDebugLogError,
  getLots,
  getJobs,
  getLotSizeInfoFromMarker,
  getLotBounds,
  getCenteredBounds,
  getFrontMarkerLotBounds,
  boundsOverlapOrTooClose,
  boundsOverlapInnerWallReserve,
  getDimensionFromId,
  queueLotPrep,
  ensureTownAutomationDefaults,
  isLotMarkerType,
  constants
}) {
  const {
    LOT_SMALL_SIZE,
    LOT_MEDIUM_SIZE,
    LOT_SMALL_HALF,
    LOT_BUFFER,
    DIRT_ROAD_ID,
    LOT_MARKER_ID,
    MEDIUM_LOT_MARKER_ID,
    LARGE_LOT_MARKER_ID,
    LOT_STATUS_REGISTERED,
    LOT_STATUS_QUEUED,
    LOT_STATUS_PREPARING,
    LOT_STATUS_READY,
    LOT_STATUS_BUILDING,
    LOT_STATUS_OCCUPIED,
    ROAD_STATUS_NOT_CONNECTED,
    ROAD_STATUS_CONNECTED,
    CAMP_JOB_STATUS_COMPLETE,
    AUTO_PLACE_INTERVAL_TICKS,
    AUTO_PLACE_MAX_SMALL,
    AUTO_PLACE_MAX_MEDIUM,
    AUTO_PLACE_MAX_LARGE,
    AUTO_PLACE_MAX_PER_RUN,
    AUTO_PLACE_MAX_CANDIDATES_PER_SEARCH,
    AUTO_PLACE_SEARCH_STEP,
    AUTO_PLACE_RINGS,
    AUTO_PLACE_ROAD_SCAN_DISTANCE,
    TOWN_BOUNDARY_RADIUS,
    INNER_WALL_RESERVE_HALF_WIDTH,
    ROAD_RESERVE_HALF_WIDTH,
    ROAD_RESERVE_SCAN_BUFFER,
    STARTING_BUILD_RADIUS
  } = constants;

  function expandBounds(bounds, amount) {
    if (!bounds) return undefined;
    return { minX: bounds.minX - amount, maxX: bounds.maxX + amount, minZ: bounds.minZ - amount, maxZ: bounds.maxZ + amount };
  }

  function countLotsBySizeName(town, sizeName) {
    return getLots(town).filter(lot => lot && lot.sizeName === sizeName).length;
  }

  function directionTowardCenter(marker, center) {
    const dx = Math.floor(center.x) - Math.floor(marker.x);
    const dz = Math.floor(center.z) - Math.floor(marker.z);
    if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? "east" : "west";
    return dz > 0 ? "south" : "north";
  }

  function getAutoLotPlanForType(typeId) {
    const info = getLotSizeInfoFromMarker(typeId);
    return { typeId, ...info, max: info.size === LOT_SMALL_SIZE ? AUTO_PLACE_MAX_SMALL : (info.size === LOT_MEDIUM_SIZE ? AUTO_PLACE_MAX_MEDIUM : AUTO_PLACE_MAX_LARGE) };
  }

  function lotBoundsInsideBuildRadius(town, bounds) {
    if (!town || !bounds) return false;
    const radius = town.buildRadius ?? STARTING_BUILD_RADIUS;
    const points = [{ x: bounds.minX, z: bounds.minZ }, { x: bounds.minX, z: bounds.maxZ }, { x: bounds.maxX, z: bounds.minZ }, { x: bounds.maxX, z: bounds.maxZ }];
    return points.every(point => distance2D({ x: point.x, z: point.z }, town.center) <= radius - 2);
  }

  function boundsOverlapPrimaryRoadReserve(town, bounds) {
    if (!town || !town.center || !bounds) return false;
    const cx = Math.floor(town.center.x);
    const cz = Math.floor(town.center.z);
    const radius = town.buildRadius ?? STARTING_BUILD_RADIUS;
    const width = ROAD_RESERVE_HALF_WIDTH;
    const overlapsNorthSouth = bounds.maxX >= cx - width && bounds.minX <= cx + width && bounds.maxZ >= cz - radius && bounds.minZ <= cz + radius;
    const overlapsEastWest = bounds.maxZ >= cz - width && bounds.minZ <= cz + width && bounds.maxX >= cx - radius && bounds.minX <= cx + radius;
    return overlapsNorthSouth || overlapsEastWest;
  }

  function boundsOverlapExistingRoadReserve(town, bounds, reserve = ROAD_RESERVE_HALF_WIDTH) {
    try {
      if (!town || !bounds) return false;
      const dimension = getDimensionFromId(town.dimensionId);
      const y = Math.floor((town.center?.y ?? 0) - 1);
      for (let x = bounds.minX - reserve; x <= bounds.maxX + reserve; x++) {
        for (let z = bounds.minZ - reserve; z <= bounds.maxZ + reserve; z++) {
          const block = dimension.getBlock({ x, y, z });
          if (block && block.typeId === DIRT_ROAD_ID) return true;
        }
      }
      return false;
    } catch (error) {
      sendDebugLogError(addonName, "Road Reserve Check", error);
      return true;
    }
  }

  function lotOverlapsAnyRoadReserve(town, bounds) {
    if (boundsOverlapPrimaryRoadReserve(town, expandBounds(bounds, ROAD_RESERVE_SCAN_BUFFER))) return true;
    if (boundsOverlapExistingRoadReserve(town, bounds, ROAD_RESERVE_HALF_WIDTH)) return true;
    return false;
  }

  function hasActiveAutoConstruction(town) {
    if (!town) return true;
    if (getJobs(town).some(job => job && job.status !== "complete" && job.type !== "rebuild_boundary" && job.type !== "town_prep")) return true;
    return getLots(town).some(lot => {
      if (!lot || lot.isBuildLotRecorder) return false;
      if (lot.status === LOT_STATUS_REGISTERED || lot.status === LOT_STATUS_QUEUED || lot.status === LOT_STATUS_PREPARING || lot.status === LOT_STATUS_READY || lot.status === LOT_STATUS_BUILDING) return true;
      return lot.status === LOT_STATUS_OCCUPIED && lot.roadStatus !== ROAD_STATUS_CONNECTED;
    });
  }

  function canAutoPlaceLotAt(town, marker, info, frontDirection) {
    if (!town || !marker || !info) return false;
    const bounds = getFrontMarkerLotBounds(marker, oppositeDirection(frontDirection), info.halfSize, info.size - 1);
    if (!lotBoundsInsideBuildRadius(town, bounds)) return false;
    if (boundsOverlapInnerWallReserve(town, bounds)) return false;
    if (lotOverlapsAnyRoadReserve(town, bounds)) return false;
    if (boundsOverlapOrTooClose(bounds, getCenteredBounds(town.center, LOT_SMALL_HALF + 4), LOT_BUFFER + 2)) return false;
    for (const lot of getLots(town)) {
      const existingBounds = getLotBounds(lot);
      if (existingBounds && boundsOverlapOrTooClose(bounds, existingBounds, LOT_BUFFER + 2)) return false;
    }
    return true;
  }

  function getNearestLotDistance(town, marker) {
    let best = distance2D(marker, town.center ?? marker);
    for (const lot of getLots(town)) if (lot?.marker) best = Math.min(best, distance2D(marker, lot.marker));
    return best;
  }

  function scanNearestRoadDirection(town, marker, maxDistance = AUTO_PLACE_ROAD_SCAN_DISTANCE) {
    try {
      const dimension = getDimensionFromId(town.dimensionId);
      const directions = [{ name: "north", dx: 0, dz: -1 }, { name: "south", dx: 0, dz: 1 }, { name: "west", dx: -1, dz: 0 }, { name: "east", dx: 1, dz: 0 }];
      let best;
      for (const direction of directions) for (let distance = 1; distance <= maxDistance; distance++) for (let side = -2; side <= 2; side++) {
        const x = marker.x + direction.dx * distance + (direction.dz !== 0 ? side : 0);
        const z = marker.z + direction.dz * distance + (direction.dx !== 0 ? side : 0);
        const block = dimension.getBlock({ x, y: marker.y - 1, z });
        if (block && block.typeId === DIRT_ROAD_ID) {
          const score = distance + Math.abs(side) * 0.25;
          if (!best || score < best.distance) best = { direction: direction.name, distance: score };
        }
      }
      return best;
    } catch (error) {
      sendDebugLogError(addonName, "Scan Nearest Road Direction", error);
      return undefined;
    }
  }

  function scoreAutoLotCandidate(town, marker, info, frontDirection, seedOffset = 0, roadOverride = undefined) {
    const center = town.center;
    const distanceFromCenter = distance2D(marker, center);
    const insideInner = distanceFromCenter <= TOWN_BOUNDARY_RADIUS - INNER_WALL_RESERVE_HALF_WIDTH - info.halfSize - LOT_BUFFER;
    const nearestLot = getNearestLotDistance(town, marker);
    const road = roadOverride ?? scanNearestRoadDirection(town, marker, AUTO_PLACE_ROAD_SCAN_DISTANCE);
    let score = (insideInner ? -8000 : 8000) + nearestLot * 18 + distanceFromCenter * 0.65;
    if (road) {
      score -= 1400;
      score += road.distance * 20;
      if (frontDirection === road.direction) score -= 700;
    } else if (frontDirection === directionTowardCenter(marker, center)) score -= 250;
    score += Math.abs(((marker.x * 31 + marker.z * 17 + seedOffset) % 23));
    return score;
  }

  function findAutoLotMarkerLocation(town, info, seedOffset = 0) {
    const center = town.center;
    if (!center) return undefined;
    const candidates = [];
    for (const radius of AUTO_PLACE_RINGS) {
      for (let x = -radius; x <= radius; x += AUTO_PLACE_SEARCH_STEP) {
        candidates.push({ x: Math.floor(center.x) + x, y: Math.floor(center.y), z: Math.floor(center.z) - radius });
        candidates.push({ x: Math.floor(center.x) + x, y: Math.floor(center.y), z: Math.floor(center.z) + radius });
      }
      for (let z = -radius + AUTO_PLACE_SEARCH_STEP; z <= radius - AUTO_PLACE_SEARCH_STEP; z += AUTO_PLACE_SEARCH_STEP) {
        candidates.push({ x: Math.floor(center.x) - radius, y: Math.floor(center.y), z: Math.floor(center.z) + z });
        candidates.push({ x: Math.floor(center.x) + radius, y: Math.floor(center.y), z: Math.floor(center.z) + z });
      }
    }
    let best;
    const directions = ["north", "south", "east", "west"];
    let checked = 0;
    for (const marker of candidates) {
      if (++checked > AUTO_PLACE_MAX_CANDIDATES_PER_SEARCH) break;
      const road = scanNearestRoadDirection(town, marker, AUTO_PLACE_ROAD_SCAN_DISTANCE);
      const towardCenter = directionTowardCenter(marker, center);
      const preferred = road ? [road.direction, ...directions.filter(direction => direction !== road.direction)] : [towardCenter, ...directions.filter(direction => direction !== towardCenter)];
      for (const frontDirection of preferred) {
        if (!canAutoPlaceLotAt(town, marker, info, frontDirection)) continue;
        const score = scoreAutoLotCandidate(town, marker, info, frontDirection, seedOffset, road);
        if (!best || score < best.score) best = { marker, frontDirection, backDirection: oppositeDirection(frontDirection), score };
      }
    }
    return best;
  }

  function createAutoLot(town, typeId, seedOffset = 0) {
    try {
      const info = getLotSizeInfoFromMarker(typeId);
      const found = findAutoLotMarkerLocation(town, info, seedOffset);
      if (!found) return false;
      const dimension = getDimensionFromId(town.dimensionId);
      const block = dimension.getBlock(found.marker);
      if (!block || (block.typeId !== "minecraft:air" && !isLotMarkerType(block.typeId))) return false;
      block.setType(typeId);
      const lot = {
        id: `${town.id}_lot_${getLots(town).length + 1}`,
        sizeName: info.sizeName,
        size: info.size,
        halfSize: info.halfSize,
        markerTypeId: typeId,
        anchorMode: "front",
        frontDirection: found.frontDirection,
        backDirection: found.backDirection,
        marker: { x: found.marker.x, y: found.marker.y, z: found.marker.z },
        buildingType: "empty",
        buildingLevel: 0,
        roadStatus: ROAD_STATUS_NOT_CONNECTED,
        assignedVillager: "none",
        locked: false,
        status: LOT_STATUS_REGISTERED,
        prepPhase: "not_started",
        autoPlaced: true
      };
      getLots(town).push(lot);
      queueLotPrep(town, lot);
      sendSystemMessage(`§aTownship auto-placed ${info.sizeName}: ${lot.id}`);
      return true;
    } catch (error) {
      sendDebugLogError(addonName, "Create Auto Lot", error);
      return false;
    }
  }

  function runAutoLotPlacement(town, force = false) {
    try {
      ensureTownAutomationDefaults(town);
      if (!town || town.autoPlaceLots !== true || town.builderPaused === true) return 0;
      if ((town.townPrepStatus ?? "") !== "complete") return 0;
      if (town.campStatus !== CAMP_JOB_STATUS_COMPLETE) return 0;
      if (!force && runtimeState.tickCounter < (town.nextAutoPlaceTick ?? 0)) return 0;
      if (hasActiveAutoConstruction(town)) {
        town.nextAutoPlaceTick = runtimeState.tickCounter + AUTO_PLACE_INTERVAL_TICKS;
        return 0;
      }
      const plans = [
        { typeId: LARGE_LOT_MARKER_ID, max: town.maxLargeLots ?? AUTO_PLACE_MAX_LARGE, sizeName: "Large Lot" },
        { typeId: MEDIUM_LOT_MARKER_ID, max: town.maxMediumLots ?? AUTO_PLACE_MAX_MEDIUM, sizeName: "Medium Lot" },
        { typeId: LOT_MARKER_ID, max: town.maxSmallLots ?? AUTO_PLACE_MAX_SMALL, sizeName: "Small Lot" }
      ];
      let placed = 0;
      for (const plan of plans) {
        if (placed >= AUTO_PLACE_MAX_PER_RUN) break;
        if (countLotsBySizeName(town, plan.sizeName) >= plan.max) continue;
        if (createAutoLot(town, plan.typeId, runtimeState.tickCounter + placed * 17 + getLots(town).length * 31)) placed++;
      }
      town.nextAutoPlaceTick = runtimeState.tickCounter + AUTO_PLACE_INTERVAL_TICKS;
      if (placed > 0) sendSystemMessage(`§eTownship auto lot placement added ${placed} lot(s).`);
      return placed;
    } catch (error) {
      sendDebugLogError(addonName, "Run Auto Lot Placement", error);
      return 0;
    }
  }

  return { boundsOverlapInnerWallReserve, getAutoLotPlanForType, lotOverlapsAnyRoadReserve, runAutoLotPlacement, createAutoLot, findAutoLotMarkerLocation };
}
