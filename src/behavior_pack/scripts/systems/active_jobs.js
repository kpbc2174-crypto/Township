import { requestTownshipTickingArea, removeTownshipTickingArea } from "./ticking_areas.js";

export function createActiveJobSystem({
  addonName,
  runtimeState,
  sendSystemMessage,
  sendDebugLogError,
  getLotById,
  getLotBounds,
  blockAlreadyMatches,
  constants
}) {
  const { ACTIVE_JOB_BUFFER, TOWN_PREP_LOAD_WAIT_TICKS, DIRT_ROAD_ID } = constants;

  function activeJobTickingAreaName(town, job) {
    const key = `${town?.id ?? "town"}_${job?.type ?? "job"}_${job?.lotId ?? "main"}`.replace(/[^A-Za-z0-9_]/g, "_");
    return `township_job_${key}`.slice(0, 60);
  }

  function getJobWorkBounds(town, job) {
    try {
      if (!town || !job) return undefined;
      if (job.type === "prepare_lot" || job.type === "build_small_house") {
        const lot = getLotById(town, job.lotId);
        const b = getLotBounds(lot);
        if (!b) return undefined;
        return { minX: b.minX - ACTIVE_JOB_BUFFER, maxX: b.maxX + ACTIVE_JOB_BUFFER, minZ: b.minZ - ACTIVE_JOB_BUFFER, maxZ: b.maxZ + ACTIVE_JOB_BUFFER, y: Math.floor(lot.marker.y) };
      }
      if (job.type === "build_road") {
        if (Array.isArray(job.plan) && job.plan.length > 0) {
          const xs = job.plan.map(p => p.x);
          const zs = job.plan.map(p => p.z);
          return { minX: Math.min(...xs) - ACTIVE_JOB_BUFFER, maxX: Math.max(...xs) + ACTIVE_JOB_BUFFER, minZ: Math.min(...zs) - ACTIVE_JOB_BUFFER, maxZ: Math.max(...zs) + ACTIVE_JOB_BUFFER, y: Math.floor(town.center?.y ?? 64) };
        }
        const lot = getLotById(town, job.lotId);
        const b = getLotBounds(lot);
        if (!b) return undefined;
        return { minX: b.minX - ACTIVE_JOB_BUFFER, maxX: b.maxX + ACTIVE_JOB_BUFFER, minZ: b.minZ - ACTIVE_JOB_BUFFER, maxZ: b.maxZ + ACTIVE_JOB_BUFFER, y: Math.floor(lot.marker.y) };
      }
    } catch (error) {
      sendDebugLogError(addonName, "Get Job Work Bounds", error);
    }
    return undefined;
  }

  function ensureActiveJobTickingArea(town, job, dimension) {
    try {
      if (!town || !job || !dimension) return;
      const bounds = getJobWorkBounds(town, job);
      if (!bounds) return;
      const name = activeJobTickingAreaName(town, job);
      const key = `${bounds.minX}_${bounds.minZ}_${bounds.maxX}_${bounds.maxZ}`;
      if (job.activeTickingAreaName === name && job.activeTickingAreaKey === key) return;
      if (job.activeTickingAreaName) {
        removeTownshipTickingArea(job.activeTickingAreaName, (systemName, error) => sendDebugLogError(addonName, systemName, error), "Remove Active Job Ticking Area");
      }
      job.activeTickingAreaName = name;
      job.activeTickingAreaKey = key;
      job.loadState = undefined;
      job.loadConfirmed = false;
      job.loadFailureAnnounced = false;
      job.loadBounds = { ...bounds, testY: bounds.y };
      requestTownshipTickingArea({
        dimension,
        bounds: job.loadBounds,
        identifier: name,
        target: job,
        label: "Add Active Job Ticking Area",
        tick: runtimeState.tickCounter,
        readyDelayTicks: TOWN_PREP_LOAD_WAIT_TICKS,
        reportError: (systemName, error) => sendDebugLogError(addonName, systemName, error),
        reportMessage: sendSystemMessage
      });
    } catch (error) {
      sendDebugLogError(addonName, "Ensure Active Job Ticking Area", error);
    }
  }

  function removeActiveJobTickingArea(town, job, dimension) {
    try {
      const name = job?.activeTickingAreaName;
      if (!name || !dimension) return;
      removeTownshipTickingArea(name, (systemName, error) => sendDebugLogError(addonName, systemName, error), "Remove Active Job Ticking Area");
      job.activeTickingAreaName = undefined;
      job.activeTickingAreaKey = undefined;
      job.loadState = undefined;
      job.loadConfirmed = undefined;
      job.loadBounds = undefined;
    } catch (error) {
      sendDebugLogError(addonName, "Remove Active Job Ticking Area", error);
    }
  }

  function verifyPlanComplete(dimension, plan, job, label) {
    try {
      if (!Array.isArray(plan)) return true;
      const anchors = [];
      const preferred = ["minecraft:oak_log", "minecraft:oak_planks", "minecraft:spruce_planks", "minecraft:torch", "minecraft:bell", DIRT_ROAD_ID];
      for (const wanted of preferred) {
        const found = plan.find(entry => entry && entry.typeId === wanted);
        if (found) anchors.push(found);
      }
      if (anchors.length === 0) {
        for (const entry of plan) {
          if (entry && entry.typeId && entry.typeId !== "minecraft:air" && entry.typeId !== "minecraft:dirt") anchors.push(entry);
          if (anchors.length >= 6) break;
        }
      }

      for (const entry of anchors.slice(0, 8)) {
        if (!entry || entry.typeId === "minecraft:air") continue;
        if (!blockAlreadyMatches(dimension, entry)) {
          job.verifyRetries = (job.verifyRetries ?? 0) + 1;
          if (job.verifyRetries > 2) {
            sendSystemMessage(`§e${label} verification still found missing anchor blocks after 2 retries. Marking job complete to prevent a rebuild loop.`);
            return true;
          }
          if (job) {
            job.nextIndex = 0;
            job.status = "queued";
            job.lastPhase = undefined;
            job.nextTick = runtimeState.tickCounter + 20;
          }
          sendSystemMessage(`§e${label} verification found missing anchor blocks. Retrying this job (${job.verifyRetries}/2).`);
          return false;
        }
      }
      return true;
    } catch (error) {
      sendDebugLogError(addonName, "Verify Plan Complete", error);
      return true;
    }
  }

  return {
    ensureActiveJobTickingArea,
    removeActiveJobTickingArea,
    verifyPlanComplete
  };
}
