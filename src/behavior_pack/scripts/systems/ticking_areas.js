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
    from: { x: Math.floor(bounds.minX), y, z: Math.floor(bounds.minZ) },
    to: { x: Math.floor(bounds.maxX), y, z: Math.floor(bounds.maxZ) }
  };
}

function resolveIdentifier(identifier, areaBounds) {
  if (identifier !== "township_temp" || !areaBounds) return identifier;
  const { from, to } = areaBounds;
  return `township_setup_${from.x}_${from.z}_${to.x}_${to.z}`.slice(0, 60);
}

export function requestTownshipTickingArea({
  dimension,
  bounds,
  identifier,
  target,
  label,
  tick,
  reportError,
  reportMessage
}) {
  if (!dimension || !bounds || !identifier || !target) return;

  const areaBounds = normalizeBounds(bounds);
  if (!areaBounds) {
    target.loadState = "failed";
    target.loadError = "Missing ticking-area bounds.";
    return;
  }

  const resolvedIdentifier = resolveIdentifier(identifier, areaBounds);
  if (target.tickingAreaName === identifier) target.tickingAreaName = resolvedIdentifier;
  if (target.activeTickingAreaName === identifier) target.activeTickingAreaName = resolvedIdentifier;

  // Do not persist an asynchronous-only "requesting" state. A reload between
  // createTickingArea() and its Promise callback must be able to resume through
  // the regular writable probe.
  target.loadState = "waiting";
  target.loadCommandStartedTick = tick;
  target.loadCommandDoneTick = undefined;
  target.tickingAreaReadyTick = 0;
  target.loadError = undefined;
  target.loadCommandStatus = "pending";
  target.loadListStatus = undefined;

  const manager = world.tickingAreaManager;
  const options = { dimension, from: areaBounds.from, to: areaBounds.to };

  try {
    if (manager.hasTickingArea(resolvedIdentifier)) {
      manager.removeTickingArea(resolvedIdentifier);
    }

    if (!manager.hasCapacity(options)) {
      target.loadState = "failed";
      target.loadError = `No ticking-area capacity for ${resolvedIdentifier}.`;
      reportMessage?.(`§c${label} failed: ${target.loadError}`);
      return;
    }

    manager.createTickingArea(resolvedIdentifier, options)
      .then(() => {
        target.loadCommandStatus = "created";
        target.loadListStatus = "managed";
        target.loadState = "waiting";
        target.loadCommandDoneTick = tick;
        // The caller confirms writable access before edits begin.
        target.tickingAreaReadyTick = 0;
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
