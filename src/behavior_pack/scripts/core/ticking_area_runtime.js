import { world } from "@minecraft/server";

const DIMENSION_IDS = ["overworld", "nether", "the_end"];
const ADD_CIRCLE_PATTERN = /^tickingarea\s+add\s+circle\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(\d+)\s+([^\s]+)(?:\s+(?:true|false))?$/i;
const REMOVE_PATTERN = /^tickingarea\s+remove\s+([^\s]+)$/i;
const LIST_PATTERN = /^tickingarea\s+list(?:\s+all-dimensions)?$/i;

function circleOptions(dimension, x, y, z, radius) {
  const centerChunkX = Math.floor(x / 16) * 16;
  const centerChunkZ = Math.floor(z / 16) * 16;
  const radiusBlocks = radius * 16;

  return {
    dimension,
    from: {
      x: centerChunkX - radiusBlocks,
      y,
      z: centerChunkZ - radiusBlocks
    },
    to: {
      x: centerChunkX + radiusBlocks + 15,
      y,
      z: centerChunkZ + radiusBlocks + 15
    }
  };
}

function createCommandResult(statusMessage) {
  return { statusMessage };
}

function installDimensionTickingAreaRoute(dimension) {
  if (!dimension || typeof dimension.runCommandAsync === "function") return;

  const nativeRunCommand = typeof dimension.runCommand === "function"
    ? dimension.runCommand.bind(dimension)
    : undefined;

  Object.defineProperty(dimension, "runCommandAsync", {
    configurable: false,
    enumerable: false,
    writable: false,
    value(command) {
      const text = String(command ?? "").trim();
      const add = text.match(ADD_CIRCLE_PATTERN);
      const remove = text.match(REMOVE_PATTERN);

      if (add) {
        const [, rawX, rawY, rawZ, rawRadius, identifier] = add;
        const options = circleOptions(
          dimension,
          Number(rawX),
          Number(rawY),
          Number(rawZ),
          Number(rawRadius)
        );
        const manager = world.tickingAreaManager;

        if (!manager.hasCapacity(options) && !manager.hasTickingArea(identifier)) {
          return Promise.reject(new Error(`Township ticking-area capacity is unavailable for ${identifier}.`));
        }

        try {
          if (manager.hasTickingArea(identifier)) manager.removeTickingArea(identifier);
        } catch {
          // A stale identifier should not prevent the replacement area from being created.
        }

        return manager.createTickingArea(identifier, options)
          .then(() => createCommandResult(`Township ticking area ready: ${identifier}`));
      }

      if (remove) {
        const [, identifier] = remove;
        const manager = world.tickingAreaManager;
        if (manager.hasTickingArea(identifier)) manager.removeTickingArea(identifier);
        return Promise.resolve(createCommandResult(`Township ticking area removed: ${identifier}`));
      }

      if (LIST_PATTERN.test(text)) {
        const identifiers = world.tickingAreaManager
          .getAllTickingAreas()
          .map((area) => area.identifier)
          .join(", ");
        return Promise.resolve(createCommandResult(identifiers || "No Township ticking areas."));
      }

      if (!nativeRunCommand) return Promise.reject(new Error(`Unsupported Township command: ${text}`));

      try {
        return Promise.resolve(nativeRunCommand(text));
      } catch (error) {
        return Promise.reject(error);
      }
    }
  });
}

export function installTownshipTickingAreaRuntime() {
  for (const dimensionId of DIMENSION_IDS) {
    try {
      installDimensionTickingAreaRoute(world.getDimension(dimensionId));
    } catch {
      // A missing or unavailable dimension is ignored until Minecraft exposes it.
    }
  }
}
