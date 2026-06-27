export function createLotPreviewSystem({
  addonName,
  world,
  runtimeState,
  sendDebugLogError,
  isLotMarkerType,
  findTownContainingLocation,
  getLots,
  getLotBounds,
  distance2D,
  getPlacementFacing,
  getLotSizeInfoFromMarker,
  getFrontMarkerLotBounds,
  constants
}) {
  const {
    LOT_PREVIEW_PARTICLE,
    LOT_PREVIEW_INTERVAL_TICKS,
    LOT_PREVIEW_RADIUS,
    LOT_PREVIEW_MAX_PARTICLES_PER_PLAYER
  } = constants;

  function getHeldItemTypeId(player) {
    try {
      const equippable = player.getComponent?.("minecraft:equippable") ?? player.getComponent?.("equippable");
      if (equippable && typeof equippable.getEquipment === "function") {
        for (const slot of ["Mainhand", "mainhand", "main_hand", "MainHand"]) {
          try {
            const item = equippable.getEquipment(slot);
            if (item?.typeId) return item.typeId;
          } catch (slotError) {
          }
        }
      }
    } catch (error) {
      sendDebugLogError(addonName, "Get Held Item Equippable", error);
    }

    try {
      const inventory = player.getComponent?.("minecraft:inventory") ?? player.getComponent?.("inventory");
      const container = inventory?.container;
      const slotIndex = player.selectedSlotIndex;
      if (container && typeof slotIndex === "number" && typeof container.getItem === "function") {
        const item = container.getItem(slotIndex);
        if (item?.typeId) return item.typeId;
      }
    } catch (error) {
      sendDebugLogError(addonName, "Get Held Item Inventory", error);
    }
    return undefined;
  }

  function isHoldingLotMarker(player) {
    return isLotMarkerType(getHeldItemTypeId(player));
  }

  function faceToOffset(face) {
    const value = String(face ?? "").toLowerCase();
    if (value.includes("up")) return { x: 0, y: 1, z: 0 };
    if (value.includes("down")) return { x: 0, y: -1, z: 0 };
    if (value.includes("north")) return { x: 0, y: 0, z: -1 };
    if (value.includes("south")) return { x: 0, y: 0, z: 1 };
    if (value.includes("east")) return { x: 1, y: 0, z: 0 };
    if (value.includes("west")) return { x: -1, y: 0, z: 0 };
    return { x: 0, y: 1, z: 0 };
  }

  function getPreviewPlacementLocation(player) {
    try {
      if (!player || typeof player.getBlockFromViewDirection !== "function") return undefined;
      const hit = player.getBlockFromViewDirection({ maxDistance: 8 });
      const block = hit?.block;
      if (!block) return undefined;
      const offset = faceToOffset(hit.face);
      return {
        x: Math.floor(block.location.x) + offset.x,
        y: Math.floor(block.location.y) + offset.y,
        z: Math.floor(block.location.z) + offset.z
      };
    } catch (error) {
      return undefined;
    }
  }

  function addBoundsParticlePositions(positions, bounds, y, step = 2) {
    if (!bounds) return;
    const minX = Math.floor(bounds.minX);
    const maxX = Math.floor(bounds.maxX);
    const minZ = Math.floor(bounds.minZ);
    const maxZ = Math.floor(bounds.maxZ);
    for (let x = minX; x <= maxX; x += step) {
      positions.push({ x: x + 0.5, y, z: minZ + 0.5 });
      positions.push({ x: x + 0.5, y, z: maxZ + 0.5 });
    }
    for (let z = minZ; z <= maxZ; z += step) {
      positions.push({ x: minX + 0.5, y, z: z + 0.5 });
      positions.push({ x: maxX + 0.5, y, z: z + 0.5 });
    }
    positions.push({ x: minX + 0.5, y, z: minZ + 0.5 });
    positions.push({ x: minX + 0.5, y, z: maxZ + 0.5 });
    positions.push({ x: maxX + 0.5, y, z: minZ + 0.5 });
    positions.push({ x: maxX + 0.5, y, z: maxZ + 0.5 });
  }

  function spawnPreviewParticle(dimension, location) {
    try {
      dimension.spawnParticle(LOT_PREVIEW_PARTICLE, location);
    } catch (error) {
    }
  }

  function processLotBorderPreview() {
    try {
      if (runtimeState.tickCounter % LOT_PREVIEW_INTERVAL_TICKS !== 0) return;
      for (const player of world.getPlayers()) {
        try {
          if (!player || !player.dimension || !isHoldingLotMarker(player)) continue;
          const town = findTownContainingLocation(player.location, player.dimension.id);
          if (!town) continue;

          const positions = [];
          const particleY = Math.floor(player.location.y) + 1.15;
          for (const lot of getLots(town)) {
            if (!lot?.marker || distance2D(player.location, lot.marker) > LOT_PREVIEW_RADIUS) continue;
            addBoundsParticlePositions(positions, getLotBounds(lot), particleY, 2);
          }

          const placement = getPreviewPlacementLocation(player);
          const heldItem = getHeldItemTypeId(player);
          if (placement && heldItem) {
            const facing = getPlacementFacing(player);
            const info = getLotSizeInfoFromMarker(heldItem);
            if (info) {
              const candidateBounds = getFrontMarkerLotBounds(placement, facing.backDirection, info.halfSize, info.size - 1);
              addBoundsParticlePositions(positions, candidateBounds, placement.y + 1.35, 1);
            }
          }

          let count = 0;
          for (const position of positions) {
            if (count >= LOT_PREVIEW_MAX_PARTICLES_PER_PLAYER) break;
            spawnPreviewParticle(player.dimension, position);
            count++;
          }
        } catch (innerError) {
          sendDebugLogError(addonName, "Lot Border Preview Player", innerError);
        }
      }
    } catch (error) {
      sendDebugLogError(addonName, "Lot Border Preview", error);
    }
  }

  return {
    getHeldItemTypeId,
    isHoldingLotMarker,
    getPreviewPlacementLocation,
    addBoundsParticlePositions,
    spawnPreviewParticle,
    processLotBorderPreview
  };
}
