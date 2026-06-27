import { BlockPermutation } from "@minecraft/server";

export function createWorkBlockHelpers({
  addonName,
  runtimeState,
  sendSystemMessage,
  sendDebugLogError,
  isLotMarkerType,
  constants
}) {
  const {
    FOUNDING_STONE_ID,
    GROUND_LEVELER_ID,
    BUILD_RECORDER_ID
  } = constants;

  function sampleLoadedForWrite(dimension, location) {
    try {
      const block = dimension.getBlock(location);
      if (!block) return { ok: false, stage: "read", typeId: "none" };

      const typeId = block.typeId;
      if (!typeId) return { ok: false, stage: "read_type", typeId: "unknown" };
      if (typeId.startsWith("township:")) return { ok: true, stage: "protected", typeId };

      const originalPermutation = block.permutation;
      if (typeId === "minecraft:air") {
        block.setType("minecraft:dirt");
        block.setType("minecraft:air");
        return { ok: true, stage: "write_restore_air", typeId };
      }

      block.setType("minecraft:dirt");
      if (originalPermutation) block.setPermutation(originalPermutation);
      else block.setType(typeId);
      return { ok: true, stage: "write_restore", typeId };
    } catch (error) {
      return { ok: false, stage: "exception", typeId: "unknown", error: String(error?.message ?? error) };
    }
  }

  function confirmBoundsLoaded(dimension, bounds) {
    try {
      if (!dimension || !bounds) return false;
      const y = Math.floor((bounds.testY ?? bounds.y ?? bounds.cy ?? 64) - 1);
      const minX = Math.floor(bounds.minX);
      const maxX = Math.floor(bounds.maxX);
      const minZ = Math.floor(bounds.minZ);
      const maxZ = Math.floor(bounds.maxZ);
      const midX = Math.floor((minX + maxX) / 2);
      const midZ = Math.floor((minZ + maxZ) / 2);
      const sample = { x: midX, y, z: midZ };
      const result = sampleLoadedForWrite(dimension, sample);
      if (!result.ok && bounds) {
        bounds.lastProbe = `${result.stage} at ${sample.x} ${sample.y} ${sample.z} type ${result.typeId}${result.error ? ` error ${result.error}` : ""}`;
      } else if (bounds) {
        bounds.lastProbe = `ok ${result.stage} at ${sample.x} ${sample.y} ${sample.z} type ${result.typeId}`;
      }
      return !!result.ok;
    } catch (error) {
      if (bounds) bounds.lastProbe = `exception ${String(error?.message ?? error)}`;
      return false;
    }
  }

  function waitForTickingAreaReady(target, dimension, bounds, label) {
    try {
      if (!target) return false;
      if (target.loadState === "failed") {
        if (!target.loadFailureAnnounced) {
          target.loadFailureAnnounced = true;
          sendSystemMessage(`§c${label} cannot continue: ticking area failed.`);
        }
        return false;
      }
      if (target.loadState === "requesting") return false;
      if (typeof target.tickingAreaReadyTick === "number" && runtimeState.tickCounter < target.tickingAreaReadyTick) return false;
      if (!target.loadConfirmed) {
        target.loadCheckAttempts = (target.loadCheckAttempts ?? 0) + 1;
        if (confirmBoundsLoaded(dimension, bounds)) {
          target.loadConfirmed = true;
          target.loadState = "confirmed";
          target.loadCheckAttempts = 0;
          return true;
        }
        if ((target.nextLoadCheckMessageTick ?? 0) <= runtimeState.tickCounter) {
          target.nextLoadCheckMessageTick = runtimeState.tickCounter + 100;
          const probe = bounds?.lastProbe ? ` Probe: ${bounds.lastProbe}.` : "";
          sendSystemMessage(`§e${label} is waiting for its ticking area to become writable. Check ${target.loadCheckAttempts}/10.${probe}`);
        }
        if (target.loadCheckAttempts >= 10) {
          target.loadState = "failed";
          target.loadError = `Writable probe failed after ticking area wait. Add: ${target.loadCommandStatus ?? "unknown"}. List: ${target.loadListStatus ?? "unknown"}. Probe: ${bounds?.lastProbe ?? "unknown"}.`;
          sendDebugLogError(addonName, `${label} Writable Probe`, target.loadError);
          sendSystemMessage(`§c${label} failed: ${target.loadError}`);
          return false;
        }
        target.tickingAreaReadyTick = runtimeState.tickCounter + 20;
        return false;
      }
      return true;
    } catch (error) {
      sendDebugLogError(addonName, "Wait For Ticking Area Ready", error);
      return false;
    }
  }

  function blockAlreadyMatches(dimension, entry) {
    try {
      const block = dimension.getBlock({ x: entry.x, y: entry.y, z: entry.z });
      if (!block) return false;
      if (block.typeId === FOUNDING_STONE_ID || block.typeId === GROUND_LEVELER_ID || block.typeId === BUILD_RECORDER_ID) return true;
      if (isLotMarkerType(block.typeId)) return !entry.clearLotMarker;
      if (entry?.supportFill) {
        return !(block.typeId === "minecraft:air" || block.typeId === "minecraft:water" || block.typeId === "minecraft:flowing_water");
      }
      if (block.typeId !== entry.typeId) return false;

      if (entry.states) {
        try {
          for (const [stateName, expectedValue] of Object.entries(entry.states)) {
            const currentValue = block.permutation.getState(stateName);
            if (currentValue !== expectedValue) return false;
          }
        } catch (stateError) {
          return false;
        }
      }

      return true;
    } catch (error) {
      sendDebugLogError(addonName, "Check Starter Camp Block", error);
      return false;
    }
  }

  function safeSetBlock(dimension, entry) {
    try {
      const block = dimension.getBlock({ x: entry.x, y: entry.y, z: entry.z });
      if (!block) return false;
      if (blockAlreadyMatches(dimension, entry)) return true;
      if (entry?.supportFill && !(block.typeId === "minecraft:air" || block.typeId === "minecraft:water" || block.typeId === "minecraft:flowing_water")) return true;

      if (entry.states) {
        try {
          const permutation = BlockPermutation.resolve(entry.typeId, entry.states);
          block.setPermutation(permutation);
          return true;
        } catch (permutationError) {
          sendDebugLogError(addonName, "Set Block Permutation", permutationError);
        }
      }

      block.setType(entry.typeId);
      return true;
    } catch (error) {
      if (entry?.setupFill && entry?.typeId === "minecraft:dirt") return true;
      sendDebugLogError(addonName, "Starter Camp Block", error);
      return false;
    }
  }

  function verifyPlanComplete(dimension, plan, job, label) {
    try {
      if (!Array.isArray(plan)) return true;

      const anchors = [];
      const preferred = ["minecraft:oak_log", "minecraft:oak_planks", "minecraft:spruce_planks", "minecraft:torch", "minecraft:bell", constants.DIRT_ROAD_ID];
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
    blockAlreadyMatches,
    safeSetBlock,
    waitForTickingAreaReady,
    verifyPlanComplete
  };
}
