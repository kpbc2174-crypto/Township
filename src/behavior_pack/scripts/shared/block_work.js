import { BlockPermutation } from "@minecraft/server";

export function createBlockWorkHelpers({
  addonName,
  world,
  system,
  sendDebugLogError,
  isLotMarkerType,
  constants
}) {
  const { FOUNDING_STONE_ID, GROUND_LEVELER_ID, BUILD_RECORDER_ID } = constants;

  function getDimensionFromId(dimensionId) {
    const shortId = dimensionId.replace("minecraft:", "");
    return world.getDimension(shortId);
  }

  function clearBlock(block) {
    try {
      system.run(() => {
        try {
          block.setType("minecraft:air");
        } catch (error) {
          sendDebugLogError(addonName, "Clear Block", error);
        }
      });
    } catch (error) {
      sendDebugLogError(addonName, "Clear Block Schedule", error);
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
            if (block.permutation.getState(stateName) !== expectedValue) return false;
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
          block.setPermutation(BlockPermutation.resolve(entry.typeId, entry.states));
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

  return { getDimensionFromId, clearBlock, blockAlreadyMatches, safeSetBlock };
}
