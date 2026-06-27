import { world } from "@minecraft/server";
import { requestTownshipTickingArea, removeTownshipTickingArea } from "./ticking_areas.js";

export function createTownPrepSystem({
  addonName,
  runtimeState,
  safeLocationKey,
  sendSystemMessage,
  sendDebugLogError,
  getJobs,
  getDimensionFromId,
  blockAlreadyMatches,
  safeSetBlock,
  waitForTickingAreaReady,
  constants
}) {
  const {
    FOUNDING_STONE_ID,
    DIRT_ROAD_ID,
    TOWN_PREP_RADIUS,
    TOWN_BOUNDARY_RADIUS,
    INNER_GATE_HALF_WIDTH,
    TOWN_PREP_CLEAR_HEIGHT,
    TOWN_PREP_INTERVAL_TICKS,
    TOWN_PREP_BLOCKS_PER_STEP,
    TOWN_PREP_PHASES,
    TOWN_PREP_LOAD_BUFFER,
    TOWN_PREP_QUADRANTS
  } = constants;

  function queueTownPrep(town) {
    if (!town) return;
    const jobs = getJobs(town);
    if (jobs.find(job => job && job.type === "town_prep" && job.status !== "complete")) return;
    jobs.unshift({
      type: "town_prep",
      status: "queued",
      quadrantIndex: 0,
      phase: "clear_town_area",
      nextIndex: 0,
      nextTick: runtimeState.tickCounter + TOWN_PREP_INTERVAL_TICKS,
      lastPhase: undefined,
      tickingAreaName: undefined,
      loadedQuadrantIndex: undefined,
      loadedPrepKey: undefined,
      tickingAreaReadyTick: undefined
    });
    town.townPrepStatus = "queued";
    town.townPrepPhase = "queued";
  }

  function townPrepTickingAreaName(town) {
    return `township_setup_${safeLocationKey(town.center ?? { x: 0, y: 0, z: 0 })}`.slice(0, 60);
  }

  function removeTownPrepTickingArea(town, job, dimension) {
    try {
      const name = job?.tickingAreaName ?? townPrepTickingAreaName(town);
      if (!name) return;
      removeTownshipTickingArea(
        name,
        (systemName, error) => sendDebugLogError(addonName, systemName, error),
        "Remove Town Prep Ticking Area"
      );
      if (job) {
        job.loadedQuadrantIndex = undefined;
        job.loadedPrepKey = undefined;
        job.tickingAreaReadyTick = undefined;
        job.tickingAreaName = undefined;
        job.loadState = undefined;
        job.loadConfirmed = undefined;
        job.loadFailureAnnounced = undefined;
        job.nextLoadCheckMessageTick = undefined;
        job.loadCheckAttempts = undefined;
      }
    } catch (error) {
      sendDebugLogError(addonName, "Remove Town Prep Ticking Area", error);
    }
  }

  function ensureFoundingStoneBlock(town, dimension) {
    try {
      if (!town || !town.center || !dimension) return false;
      const location = {
        x: Math.floor(town.center.x),
        y: Math.floor(town.center.y),
        z: Math.floor(town.center.z)
      };

      const support = dimension.getBlock({ x: location.x, y: location.y - 1, z: location.z });
      if (support && support.typeId === "minecraft:air") support.setType("minecraft:dirt");

      const block = dimension.getBlock(location);
      if (!block) return false;
      if (block.typeId !== FOUNDING_STONE_ID) {
        block.setType(FOUNDING_STONE_ID);
        sendSystemMessage("§eTownship Founding Stone restored after setup protection check.");
      }
      town.center = location;
      return true;
    } catch (error) {
      sendDebugLogError(addonName, "Ensure Founding Stone Block", error);
      return false;
    }
  }

  function getTownPrepQuadrantBounds(town, quadrantIndex, radius = TOWN_PREP_RADIUS) {
    const center = town?.center ?? { x: 0, y: 0, z: 0 };
    const cx = Math.floor(center.x);
    const cy = Math.floor(center.y);
    const cz = Math.floor(center.z);
    const q = TOWN_PREP_QUADRANTS[quadrantIndex] ?? TOWN_PREP_QUADRANTS[0];
    return {
      key: q.key,
      label: q.label,
      cx, cy, cz,
      minX: cx + q.sx * radius,
      maxX: cx + q.ex * radius,
      minZ: cz + q.sz * radius,
      maxZ: cz + q.ez * radius
    };
  }

  function ensureTownPrepTickingArea(town, job, dimension) {
    try {
      if (!job || typeof job.quadrantIndex !== "number") return;
      const phase = job.phase ?? "clear_town_area";
      const radius = phase === "mark_town_boundary" ? TOWN_BOUNDARY_RADIUS : TOWN_PREP_RADIUS;
      const loadKey = `${job.quadrantIndex}_${phase}_${radius}`;
      const name = townPrepTickingAreaName(town);
      if (job.loadedPrepKey === loadKey && job.tickingAreaName === name && job.loadState !== "failed") {
        const manager = world.tickingAreaManager;
        if (manager.hasTickingArea(name)) {
          if (job.loadState === "requesting") {
            job.loadState = "waiting";
            job.loadCommandStatus = "recovered";
            job.loadListStatus = "managed";
            job.tickingAreaReadyTick = 0;
          }
          return;
        }
      }

      removeTownPrepTickingArea(town, job, dimension);

      const bounds = getTownPrepQuadrantBounds(town, job.quadrantIndex, radius);
      job.tickingAreaName = name;
      job.loadedQuadrantIndex = job.quadrantIndex;
      job.loadedPrepKey = loadKey;
      job.loadState = undefined;
      job.loadConfirmed = false;
      job.loadFailureAnnounced = false;
      job.nextLoadCheckMessageTick = undefined;
      job.loadCheckAttempts = 0;

      const loadMinX = Math.floor(bounds.minX) - TOWN_PREP_LOAD_BUFFER;
      const loadMaxX = Math.floor(bounds.maxX) + TOWN_PREP_LOAD_BUFFER;
      const loadMinZ = Math.floor(bounds.minZ) - TOWN_PREP_LOAD_BUFFER;
      const loadMaxZ = Math.floor(bounds.maxZ) + TOWN_PREP_LOAD_BUFFER;
      job.loadBounds = { minX: loadMinX, maxX: loadMaxX, minZ: loadMinZ, maxZ: loadMaxZ, y: bounds.cy, testY: bounds.cy };
      requestTownshipTickingArea({
        dimension,
        bounds: job.loadBounds,
        identifier: name,
        target: job,
        label: "Add Town Prep Ticking Area",
        tick: runtimeState.tickCounter,
        reportError: (systemName, error) => sendDebugLogError(addonName, systemName, error),
        reportMessage: sendSystemMessage
      });
    } catch (error) {
      sendDebugLogError(addonName, "Ensure Town Prep Ticking Area", error);
    }
  }

  function getTownPrepPhasePlan(town, quadrantIndex, phase) {
    const plan = [];
    if (!town || !town.center) return plan;

    const center = town.center;
    const cx = Math.floor(center.x);
    const cy = Math.floor(center.y);
    const cz = Math.floor(center.z);
    const prep = getTownPrepQuadrantBounds(town, quadrantIndex, TOWN_PREP_RADIUS);
    const fence = getTownPrepQuadrantBounds(town, quadrantIndex, TOWN_BOUNDARY_RADIUS);
    const q = TOWN_PREP_QUADRANTS[quadrantIndex] ?? TOWN_PREP_QUADRANTS[0];

    const isProtectedTownCenter = (x, y, z) => (x === cx && y === cy && z === cz);
    const isGateOpening = (x, z) => {
      const relX = x - cx;
      const relZ = z - cz;
      const r = TOWN_BOUNDARY_RADIUS;
      if ((Math.abs(relX) <= INNER_GATE_HALF_WIDTH) && (Math.abs(relZ) === r)) return true;
      if ((Math.abs(relZ) <= INNER_GATE_HALF_WIDTH) && (Math.abs(relX) === r)) return true;
      return false;
    };

    if (phase === "clear_town_area") {
      for (let y = cy - 2; y <= cy + TOWN_PREP_CLEAR_HEIGHT; y++) {
        for (let x = Math.floor(prep.minX); x <= Math.floor(prep.maxX); x++) {
          for (let z = Math.floor(prep.minZ); z <= Math.floor(prep.maxZ); z++) {
            if (isProtectedTownCenter(x, y, z)) continue;
            plan.push({ phase, x, y, z, typeId: "minecraft:air", clearLotMarker: true });
          }
        }
      }
    }

    if (phase === "level_town_area") {
      for (let x = Math.floor(prep.minX); x <= Math.floor(prep.maxX); x++) {
        for (let z = Math.floor(prep.minZ); z <= Math.floor(prep.maxZ); z++) {
          plan.push({ phase, x, y: cy - 3, z, typeId: "minecraft:dirt", setupFill: true });
          plan.push({ phase, x, y: cy - 2, z, typeId: "minecraft:dirt", setupFill: true });
          plan.push({ phase, x, y: cy - 1, z, typeId: "minecraft:dirt", setupFill: true });
        }
      }
    }

    if (phase === "mark_town_boundary") {
      const r = TOWN_BOUNDARY_RADIUS;
      const addFence = (x, z, offset) => {
        if (isGateOpening(x, z)) return;
        plan.push({ phase, x, y: cy, z, typeId: "minecraft:oak_fence" });
        if (offset % 8 === 0) plan.push({ phase, x, y: cy + 1, z, typeId: "minecraft:torch" });
      };
      const addRoad = (x, z) => {
        plan.push({ phase, x, y: cy - 1, z, typeId: DIRT_ROAD_ID });
        plan.push({ phase, x, y: cy, z, typeId: "minecraft:air" });
      };

      for (let x = Math.floor(fence.minX); x <= Math.floor(fence.maxX); x++) {
        if (Math.abs(x - cx) <= r && Math.abs(x - cx) >= 11) {
          for (let oz = -1; oz <= 1; oz++) addRoad(x, cz + oz);
        }
      }
      for (let z = Math.floor(fence.minZ); z <= Math.floor(fence.maxZ); z++) {
        if (Math.abs(z - cz) <= r && Math.abs(z - cz) >= 11) {
          for (let ox = -1; ox <= 1; ox++) addRoad(cx + ox, z);
        }
      }

      if (q.ex === 1) {
        let n = 0;
        for (let z = Math.floor(fence.minZ); z <= Math.floor(fence.maxZ); z++) addFence(cx + r, z, n++);
      }
      if (q.sx === -1) {
        let n = 0;
        for (let z = Math.floor(fence.minZ); z <= Math.floor(fence.maxZ); z++) addFence(cx - r, z, n++);
      }
      if (q.ez === 1) {
        let n = 0;
        for (let x = Math.floor(fence.minX); x <= Math.floor(fence.maxX); x++) addFence(x, cz + r, n++);
      }
      if (q.sz === -1) {
        let n = 0;
        for (let x = Math.floor(fence.minX); x <= Math.floor(fence.maxX); x++) addFence(x, cz - r, n++);
      }
    }

    return plan;
  }

  function getTownPrepPhaseLabel(phase) {
    if (phase === "clear_town_area") return "clearing the township area";
    if (phase === "level_town_area") return "leveling the township area";
    if (phase === "mark_town_boundary") return "marking the town fence and gate roads";
    return phase ?? "preparing the township area";
  }

  function advanceTownPrepPhaseOrQuadrant(town, job, dimension) {
    const currentPhase = job.phase ?? "clear_town_area";
    const phaseIndex = Math.max(0, TOWN_PREP_PHASES.indexOf(currentPhase));

    if (phaseIndex < TOWN_PREP_PHASES.length - 1) {
      job.phase = TOWN_PREP_PHASES[phaseIndex + 1];
      job.nextIndex = 0;
      job.lastPhase = undefined;
      job.failedPlacementStreak = 0;
      job.lastSkippedSetupBlockKey = undefined;
      job.skippedSetupMessages = 0;
      return;
    }

    if ((job.skippedSetupMessages ?? 0) > 0) {
      sendSystemMessage(`§eTownship setup section ${job.quadrantIndex + 1}/${TOWN_PREP_QUADRANTS.length} complete with ${job.skippedSetupMessages} skipped block attempts.`);
    }

    removeTownPrepTickingArea(town, job, dimension);
    job.quadrantIndex = (typeof job.quadrantIndex === "number" ? job.quadrantIndex : 0) + 1;
    job.phase = "clear_town_area";
    job.nextIndex = 0;
    job.lastPhase = undefined;
    job.failedPlacementStreak = 0;
    job.lastSkippedSetupBlockKey = undefined;
    job.skippedSetupMessages = 0;

    if (job.quadrantIndex >= TOWN_PREP_QUADRANTS.length) {
      job.status = "complete";
      town.townPrepStatus = "complete";
      town.townPrepPhase = "complete";
      ensureFoundingStoneBlock(town, dimension);
      const skipped = job.skippedSetupBlocks ?? 0;
      sendSystemMessage(`§aTownship area prepared, fence marked, and gate roads placed.${skipped ? ` Skipped setup blocks: ${skipped}.` : ""}`);
    }
  }

  function processTownPrepJob(town, job) {
    try {
      if (!town || !job || job.type !== "town_prep" || job.status === "complete") return false;
      if (typeof job.nextTick === "number" && runtimeState.tickCounter < job.nextTick) return false;

      const dimension = getDimensionFromId(town.dimensionId);
      if (typeof job.quadrantIndex !== "number") job.quadrantIndex = 0;
      if (!job.phase) job.phase = "clear_town_area";

      if (job.quadrantIndex >= TOWN_PREP_QUADRANTS.length) {
        removeTownPrepTickingArea(town, job, dimension);
        job.status = "complete";
        town.townPrepStatus = "complete";
        town.townPrepPhase = "complete";
        ensureFoundingStoneBlock(town, dimension);
        const skipped = job.skippedSetupBlocks ?? 0;
        sendSystemMessage(`§aTownship area prepared, fence marked, and gate roads placed.${skipped ? ` Skipped setup blocks: ${skipped}.` : ""}`);
        return true;
      }

      ensureTownPrepTickingArea(town, job, dimension);

      if (!waitForTickingAreaReady(job, dimension, job.loadBounds, "Township setup section")) {
        job.nextTick = runtimeState.tickCounter + TOWN_PREP_INTERVAL_TICKS;
        return true;
      }

      const quadrant = TOWN_PREP_QUADRANTS[job.quadrantIndex] ?? TOWN_PREP_QUADRANTS[0];
      const phase = job.phase ?? "clear_town_area";
      const plan = getTownPrepPhasePlan(town, job.quadrantIndex, phase);
      let index = typeof job.nextIndex === "number" ? job.nextIndex : 0;

      while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) index++;

      if (index >= plan.length) {
        advanceTownPrepPhaseOrQuadrant(town, job, dimension);
        job.nextTick = runtimeState.tickCounter + TOWN_PREP_INTERVAL_TICKS;
        return true;
      }

      let worked = 0;
      town.townPrepStatus = "working";
      while (index < plan.length && worked < TOWN_PREP_BLOCKS_PER_STEP) {
        while (index < plan.length && blockAlreadyMatches(dimension, plan[index])) index++;
        if (index >= plan.length) break;

        const entry = plan[index];
        const entryPhase = entry.phase ?? phase;
        const phaseLabel = `${entryPhase}_${quadrant.key}`;
        if (job.lastPhase !== phaseLabel) {
          job.lastPhase = phaseLabel;
          town.townPrepPhase = `${entryPhase}_${quadrant.key}`;
          sendSystemMessage(`§eTownship is ${getTownPrepPhaseLabel(entryPhase)} (${quadrant.label} section ${job.quadrantIndex + 1}/${TOWN_PREP_QUADRANTS.length}).`);
        }

        if (safeSetBlock(dimension, entry)) {
          job.failedPlacementStreak = 0;
          index++;
          worked++;
        } else {
          job.failedPlacementStreak = (job.failedPlacementStreak ?? 0) + 1;
          job.skippedSetupBlocks = (job.skippedSetupBlocks ?? 0) + 1;
          const skipKey = `${job.quadrantIndex}_${entryPhase}_${entry.x}_${entry.y}_${entry.z}_${entry.typeId}`;
          if (job.lastSkippedSetupBlockKey !== skipKey) {
            job.lastSkippedSetupBlockKey = skipKey;
            job.skippedSetupMessages = (job.skippedSetupMessages ?? 0) + 1;
            if ((job.skippedSetupMessages ?? 0) === 1) {
              sendSystemMessage(`§eTownship setup section ${job.quadrantIndex + 1}/${TOWN_PREP_QUADRANTS.length} has skipped setup blocks; continuing.`);
            }
          }
          index++;
          worked++;
        }
      }

      job.nextIndex = index;
      job.nextTick = runtimeState.tickCounter + TOWN_PREP_INTERVAL_TICKS;

      if (index >= plan.length) {
        advanceTownPrepPhaseOrQuadrant(town, job, dimension);
      }

      return true;
    } catch (error) {
      sendDebugLogError(addonName, "Process Town Prep Job", error);
      job.status = "error";
      town.townPrepStatus = "error";
      return true;
    }
  }

  return {
    queueTownPrep,
    processTownPrepJob,
    getTownPrepPhasePlan,
    getTownPrepQuadrantBounds,
    ensureFoundingStoneBlock,
    removeTownPrepTickingArea
  };
}
