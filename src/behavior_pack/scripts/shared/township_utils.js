export function createTownshipUtils({ addonName, sendDebugLogError, constants }) {
  const {
    LOT_MARKER_IDS,
    BUILD_LOT_MARKER_IDS,
    LOT_MARKER_ID,
    MEDIUM_LOT_MARKER_ID,
    LARGE_LOT_MARKER_ID,
    MEDIUM_BUILD_LOT_ID,
    LARGE_BUILD_LOT_ID,
    LOT_SMALL_SIZE,
    LOT_SMALL_HALF,
    LOT_MEDIUM_SIZE,
    LOT_MEDIUM_HALF,
    LOT_LARGE_SIZE,
    LOT_LARGE_HALF
  } = constants;

  function townTag(id) {
    return `township_id_${id}`;
  }

  function safeLocationKey(location) {
    return `${Math.floor(location.x)}_${Math.floor(location.y)}_${Math.floor(location.z)}`.replace(/-/g, "m");
  }

  function distance2D(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function oppositeDirection(direction) {
    if (direction === "north") return "south";
    if (direction === "south") return "north";
    if (direction === "east") return "west";
    if (direction === "west") return "east";
    return "south";
  }

  function directionVector(direction) {
    if (direction === "north") return { dx: 0, dz: -1 };
    if (direction === "south") return { dx: 0, dz: 1 };
    if (direction === "east") return { dx: 1, dz: 0 };
    if (direction === "west") return { dx: -1, dz: 0 };
    return { dx: 0, dz: 1 };
  }

  function directionFromPlayerView(player) {
    try {
      if (player && typeof player.getViewDirection === "function") {
        const view = player.getViewDirection();
        if (view && typeof view.x === "number" && typeof view.z === "number") {
          if (Math.abs(view.x) > Math.abs(view.z)) return view.x > 0 ? "east" : "west";
          return view.z > 0 ? "south" : "north";
        }
      }
    } catch (error) {
      sendDebugLogError(addonName, "Player View Direction", error);
    }

    try {
      if (player && typeof player.getRotation === "function") {
        const yaw = player.getRotation().y;
        if (yaw >= -45 && yaw < 45) return "south";
        if (yaw >= 45 && yaw < 135) return "west";
        if (yaw >= -135 && yaw < -45) return "east";
        return "north";
      }
    } catch (error) {
      sendDebugLogError(addonName, "Player Rotation Direction", error);
    }

    return "north";
  }

  function getPlacementFacing(player) {
    const playerFacing = directionFromPlayerView(player);
    return { frontDirection: oppositeDirection(playerFacing), backDirection: playerFacing };
  }

  function isBuildLotRecorderType(typeId) {
    return BUILD_LOT_MARKER_IDS.includes(typeId);
  }

  function isLotMarkerType(typeId) {
    return LOT_MARKER_IDS.includes(typeId);
  }

  function getLotSizeInfoFromMarker(typeId) {
    if (typeId === MEDIUM_LOT_MARKER_ID || typeId === MEDIUM_BUILD_LOT_ID) return { sizeName: "Medium Lot", size: LOT_MEDIUM_SIZE, halfSize: LOT_MEDIUM_HALF, recorderSizeName: "medium" };
    if (typeId === LARGE_LOT_MARKER_ID || typeId === LARGE_BUILD_LOT_ID) return { sizeName: "Large Lot", size: LOT_LARGE_SIZE, halfSize: LOT_LARGE_HALF, recorderSizeName: "large" };
    return { sizeName: "Small Lot", size: LOT_SMALL_SIZE, halfSize: LOT_SMALL_HALF, recorderSizeName: "small" };
  }

  function directionStateNumber(direction) {
    if (direction === "south") return 0;
    if (direction === "west") return 1;
    if (direction === "north") return 2;
    if (direction === "east") return 3;
    return 0;
  }

  function getRightVector(backDirection) {
    const back = directionVector(backDirection);
    return { dx: -back.dz, dz: back.dx };
  }

  function transformFromBackAnchor(anchor, backDirection, lx, lb) {
    const back = directionVector(backDirection);
    const right = getRightVector(backDirection);
    return {
      x: Math.floor(anchor.x) + right.dx * lx + back.dx * lb,
      z: Math.floor(anchor.z) + right.dz * lx + back.dz * lb
    };
  }

  function transformTownLocal(center, frontDirection, lx, lz) {
    const front = directionVector(frontDirection ?? "south");
    const right = { dx: front.dz, dz: -front.dx };
    return {
      x: Math.floor(center.x) + right.dx * lx + front.dx * lz,
      z: Math.floor(center.z) + right.dz * lx + front.dz * lz
    };
  }

  return {
    townTag,
    safeLocationKey,
    distance2D,
    oppositeDirection,
    directionVector,
    directionFromPlayerView,
    getPlacementFacing,
    isBuildLotRecorderType,
    isLotMarkerType,
    getLotSizeInfoFromMarker,
    directionStateNumber,
    getRightVector,
    transformFromBackAnchor,
    transformTownLocal
  };
}
