import { requestTownshipTickingArea, removeTownshipTickingArea } from "./ticking_areas.js";

export function createStarterCampSystem({
  addonName,
  runtimeState,
  safeLocationKey,
  transformTownLocal,
  distance2D,
  townTag,
  sendSystemMessage,
  sendDebugLogError,
  getDimensionFromId,
  getJobs,
  isLotMarkerType,
  blockAlreadyMatches,
  safeSetBlock,
  waitForTickingAreaReady,
  constants
}) {
  const {
    FOUNDING_STONE_ID,
    GROUND_LEVELER_ID,
    BUILD_RECORDER_ID,
    DIRT_ROAD_ID,
    BUILDER_TAG,
    CAMP_BUILD_INTERVAL_TICKS,
    CAMP_BLOCKS_PER_STEP,
    CAMP_JOB_STATUS_PENDING,
    CAMP_JOB_STATUS_BUILDING,
    CAMP_JOB_STATUS_COMPLETE,
    ACTIVE_JOB_BUFFER,
    TOWN_PREP_LOAD_WAIT_TICKS
  } = constants;

  function getStarterCampPlan(townOrCenter) {
    const center = townOrCenter.center ?? townOrCenter;
    const frontDirection = townOrCenter.frontDirection ?? "south";
    const x = Math.floor(center.x);
    const y = Math.floor(center.y);
    const z = Math.floor(center.z);
    const plan = [];

    const add = (phase, lx, dy, lz, typeId) => {
      const p = transformTownLocal({ x, y, z }, frontDirection, lx, lz);
      plan.push({ phase, x: p.x, y: y + dy, z: p.z, typeId });
    };

    for (let cy = 0; cy <= 6; cy++) {
      for (let lx = -8; lx <= 8; lx++) {
        for (let lz = -8; lz <= 8; lz++) {
          if (lx === 0 && lz === 0 && cy === 0) continue;
          add("clear_lot", lx, cy, lz, "minecraft:air");
        }
      }
    }

    for (let lx = -8; lx <= 8; lx++) {
      for (let lz = -8; lz <= 8; lz++) {
        if (lx === 0 && lz === 0) continue;
        add("level_lot", lx, -1, lz, "minecraft:dirt");
      }
    }

    for (let lx = -10; lx <= 10; lx++) {
      for (const lz of [-10, -9, 9, 10]) add("build_camp", lx, -1, lz, DIRT_ROAD_ID);
    }
    for (let lz = -8; lz <= 8; lz++) {
      for (const lx of [-10, -9, 9, 10]) add("build_camp", lx, -1, lz, DIRT_ROAD_ID);
    }

    for (const lx of [-4, 4]) {
      for (const lz of [-4, 4]) {
        for (let dy = 0; dy <= 3; dy++) add("build_camp", lx, dy, lz, "minecraft:oak_log");
      }
    }

    for (let lx = -4; lx <= 4; lx++) {
      for (let lz = -4; lz <= 4; lz++) {
        if (lx === 0 && lz === 0) continue;
        add("build_camp", lx, 4, lz, "minecraft:oak_planks");
      }
    }
    for (let lx = -3; lx <= 3; lx++) {
      if (lx === 0) continue;
      add("build_camp", lx, 3, -4, "minecraft:oak_planks");
    }

    for (let lx = -8; lx <= 8; lx++) {
      for (const lz of [-8, 8]) {
        if (lz === 8 && lx >= -1 && lx <= 1) continue;
        add("build_camp", lx, 0, lz, "minecraft:oak_fence");
      }
    }
    for (let lz = -7; lz <= 7; lz++) {
      add("build_camp", -8, 0, lz, "minecraft:oak_fence");
      add("build_camp", 8, 0, lz, "minecraft:oak_fence");
    }

    for (const [tx, tz] of [[-7,-7],[7,-7],[-7,7],[7,7],[-3,0],[3,0],[-2,5],[2,5]]) {
      add("build_camp", tx, 0, tz, "minecraft:torch");
    }

    add("build_camp", 0, 0, 3, "minecraft:campfire");
    add("build_camp", -3, 0, 2, "minecraft:chest");
    add("build_camp", 3, 0, 2, "minecraft:crafting_table");
    add("build_camp", 0, 0, 5, "minecraft:bell");

    return plan;
  }

  function getCampPhaseLabel(phase) {
    if (phase === "clear_lot") return "clearing starter lot";
    if (phase === "level_lot") return "leveling starter lot";
    if (phase === "build_camp") return "building starter camp";
    return phase ?? "working";
  }

  function keepBuilderNearLocation(town, location, maxDistance = 10) {
    try {
      const dimension = getDimensionFromId(town.dimensionId);
      const builders = dimension.getEntities({ tags: [BUILDER_TAG, townTag(town.id)] });
      if (!builders || builders.length === 0) return;

      const builder = builders[0];
      const d = distance2D(builder.location, location);
      if (d <= maxDistance) return;

      const target = { x: location.x + 2, y: location.y + 1, z: location.z };
      if (typeof builder.teleport === "function") {
        builder.teleport(target, { dimension });
      }
    } catch (error) {
      sendDebugLogError(addonName, "Keep Builder Near Location", error);
    }
  }

  function keepBuilderNearTown(town) {
    keepBuilderNearLocation(town, town.center, 10);
  }

  function queueStarterCamp(town) {
    if (!town || town.campStatus === CAMP_JOB_STATUS_COMPLETE || town.campStatus === CAMP_JOB_STATUS_BUILDING) return;
    town.campStatus = CAMP_JOB_STATUS_BUILDING;
    town.campNextIndex = 0;
    town.campNextTick = runtimeState.tickCounter + CAMP_BUILD_INTERVAL_TICKS;
    town.campLastPhase = undefined;
    sendSystemMessage("§eThe Township Builder has started preparing the starter camp.");
  }

  function starterCampTickingAreaName(town) {
    return `township_starter_${safeLocationKey(town.center ?? { x: 0, y: 0, z: 0 })}`.slice(0, 60);
  }

  function getPlanBounds(plan, yFallback = 64, buffer = ACTIVE_JOB_BUFFER) {
    if (!Array.isArray(plan) || plan.length === 0) return undefined;
    const xs = plan.map(p => p.x).filter(v => typeof v === "number");
    const zs = plan.map(p => p.z).filter(v => typeof v === "number");
    if (xs.length === 0 || zs.length === 0) return undefined;
    return {
      minX: Math.min(...xs) - buffer,
      maxX: Math.max(...xs) + buffer,
      minZ: Math.min(...zs) - buffer,
      maxZ: Math.max(...zs) + buffer,
      y: yFallback
    };
  }

  function ensureStarterCampTickingArea(town, dimension, plan) {
    try {
      if (!town || !dimension) return;
      const bounds = getPlanBounds(plan, Math.floor(town.center?.y ?? 64), ACTIVE_JOB_BUFFER);
      if (!bounds) return;
      const name = starterCampTickingAreaName(town);
      const key = `${bounds.minX}_${bounds.minZ}_${bounds.maxX}_${bounds.maxZ}`;
      if (town.campTickingAreaName === name && town.campTickingAreaKey === key) return;
      if (town.campTickingAreaName) {
        removeTownshipTickingArea(
          town.campTickingAreaName,
          (systemName, error) => sendDebugLogError(addonName, systemName, error),
          "Remove Starter Camp Ticking Area"
        );
      }
      town.campTickingAreaName = name;
      town.campTickingAreaKey = key;
      town.loadState = undefined;
      town.loadConfirmed = false;
      town.loadFailureAnnounced = false;
      const centerX = Math.floor((Math.floor(bounds.minX) + Math.floor(bounds.maxX)) / 2);
      const centerZ = Math.floor((Math.floor(bounds.minZ) + Math.floor(bounds.maxZ)) / 2);
      town.loadBounds = { ...bounds, testY: bounds.y };
      requestTownshipTickingArea({
        dimension,
        bounds: town.loadBounds,
        identifier: name,
        target: town,
        label: "Add Starter Camp Ticking Area",
        tick: runtimeState.tickCounter,
        readyDelayTicks: TOWN_PREP_LOAD_WAIT_TICKS,
        reportError: (systemName, error) => sendDebugLogError(addonName, systemName, error),
        reportMessage: sendSystemMessage
      });
    } catch (error) {
      sendDebugLogError(addonName, "Ensure Starter Camp Ticking Area", error);
    }
  }

  function removeStarterCampTickingArea(town, dimension) {
    try {
      if (!town?.campTickingAreaName || !dimension) return;
      removeTownshipTickingArea(
        town.campTickingAreaName,
        (systemName, error) => sendDebugLogError(addonName, systemName, error),
        "Remove Starter Camp Ticking Area"
      );
      town.campTickingAreaName = undefined;
      town.campTickingAreaKey = undefined;
      town.loadState = undefined;
      town.loadConfirmed = undefined;
      town.loadBounds = undefined;
    } catch (error) {
      sendDebugLogError(addonName, "Remove Starter Camp Ticking Area", error);
    }
  }

  function processStarterCamp(town) {
    try {
      if (!town || town.campStatus !== CAMP_JOB_STATUS_BUILDING) return false;
      if (typeof town.campNextTick === "number" && runtimeState.tickCounter < town.campNextTick) return false;

      keepBuilderNearTown(town);

      const dimension = getDimensionFromId(town.dimensionId);
      const plan = getStarterCampPlan(town);
      ensureStarterCampTickingArea(town, dimension, plan);
      if (!waitForTickingAreaReady(town, dimension, town.loadBounds, "Starter camp work zone")) {
        town.campNextTick = runtimeState.tickCounter + CAMP_BUILD_INTERVAL_TICKS;
        return true;
      }
      let index = typeof town.campNextIndex === "number" ? town.campNextIndex : 0;

      if (index >= plan.length) {
        town.campStatus = CAMP_JOB_STATUS_COMPLETE;
        town.campLastPhase = "complete";
        removeStarterCampTickingArea(town, dimension);
        sendSystemMessage("§aStarter camp complete.");
        return true;
      }

      let skipped = 0;
      while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) {
        index++;
        skipped++;
      }

      if (index >= plan.length) {
        town.campNextIndex = index;
        town.campStatus = CAMP_JOB_STATUS_COMPLETE;
        town.campLastPhase = "complete";
        removeStarterCampTickingArea(town, dimension);
        sendSystemMessage("§aStarter camp complete.");
        return true;
      }

      let worked = 0;
      while (index < plan.length && worked < CAMP_BLOCKS_PER_STEP) {
        while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) {
          index++;
          skipped++;
        }

        if (index >= plan.length) break;

        const entry = plan[index];
        const phase = entry.phase ?? "build_camp";
        if (town.campLastPhase !== phase) {
          town.campLastPhase = phase;
          sendSystemMessage(`§eTownship Builder is ${getCampPhaseLabel(phase)}.`);
        }

        if (safeSetBlock(dimension, entry)) {
          index++;
          worked++;
        } else {
          break;
        }
      }

      town.campNextIndex = index;
      town.campNextTick = runtimeState.tickCounter + CAMP_BUILD_INTERVAL_TICKS;

      if (index % 50 === 0 || skipped >= 50) {
        sendSystemMessage(`§7Starter camp progress: ${index}/${plan.length}`);
      }

      if (town.campNextIndex >= plan.length) {
        town.campStatus = CAMP_JOB_STATUS_COMPLETE;
        town.campLastPhase = "complete";
        removeStarterCampTickingArea(town, dimension);
        sendSystemMessage("§aStarter camp complete.");
      }

      return true;
    } catch (error) {
      sendDebugLogError(addonName, "Process Starter Camp", error);
      town.campStatus = "starter_camp_error";
      return true;
    }
  }

  return {
    queueStarterCamp,
    processStarterCamp,
    keepBuilderNearLocation,
    getStarterCampPlan
  };
}
