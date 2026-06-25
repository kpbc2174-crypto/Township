import { world } from "@minecraft/server";

/*
 * Pack-owned ticking areas. This is a direct wrapper around
 * world.tickingAreaManager; it does not issue /tickingarea commands and does
 * not emulate Dimension.runCommandAsync.
 */

function normalizeBounds(bounds) {
  if (!bounds) return undefined;
  const y = Math.floor(bounds.y ?? bounds.testY ?? 64);
  return {
    from: {
      x: Math.floor(bounds.minX),
      y,
      z: Math.floor(bounds.minZ)
    },
    to: {
      x: Math.floor(bounds.maxX),
      y,
      z: Math.floor(bounds.maxZ)
    }
  };
}

export function requestTownshipTickingArea({
  dimension,
  bounds,
  identifier,
  target,
  label,
  tick,
  readyDelayTicks,
  reportError,
  reportMessage
}) {
  if (!dimension || !bounds || !identifier || !target) return;

  target.loadState = "requesting";
  target.loadCommandStartedTick = tick;
  target.loadCommandDoneTick = undefined;
  target.loadError = undefined;
  target.loadCommandStatus = undefined;
  target.loadListStatus = undefined;

  const areaBounds = normalizeBounds(bounds);
  if (!areaBounds) {
    target.loadState = "failed";
    target.loadError = "Missing ticking-area bounds.";
    return;
  }

  const manager = world.tickingAreaManager;
  const options = {
    dimension,
    from: areaBounds.from,
    to: areaBounds.to
  };

  try {
    if (manager.hasTickingArea(identifier)) {
      manager.removeTickingArea(identifier);
    }

    if (!manager.hasCapacity(options)) {
      target.loadState = "failed";
      target.loadError = `No ticking-area capacity for ${identifier}.`;
      reportMessage?.(`§c${label} failed: ${target.loadError}`);
      return;
    }

    manager.createTickingArea(identifier, options)
      .then(() => {
        target.loadCommandStatus = "created";
        target.loadListStatus = "managed";
        target.loadState = "waiting";
        target.loadCommandDoneTick = tick;
        target.tickingAreaReadyTick = tick + readyDelayTicks;
      })
      .catch((error) => {
        target.loadState = "failed";
        target.loadError = String(error?.message ?? error);
        reportError?.(label, error);
        reportMessage?.(`§c${label} failed: ${target.loadError}`);
      });
  } catch (error) {
    target.loadState = "failed";
    target.loadError = String(error?.message ?? error);
    reportError?.(label, error);
    reportMessage?.(`§c${label} failed: ${target.loadError}`);
  }
}

export function removeTownshipTickingArea(identifier, reportError, label = "Remove Township Ticking Area") {
  if (!identifier) return;
  try {
    const manager = world.tickingAreaManager;
    if (manager.hasTickingArea(identifier)) {
      manager.removeTickingArea(identifier);
    }
  } catch (error) {
    reportError?.(label, error);
  }
}
