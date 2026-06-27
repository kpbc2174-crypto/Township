export function createBuildRecorderPreviewSystem({
  addonName,
  sendDebugLogError,
  messagePlayer,
  getRecorderLotInfo,
  getPlacementFacing,
  getFrontMarkerLotBounds,
  addBoundsParticlePositions,
  spawnPreviewParticle,
  constants
}) {
  const { LOT_PREVIEW_MAX_PARTICLES_PER_PLAYER } = constants;

  function previewBuildRecorderArea(block, player, sizeName) {
    try {
      const info = getRecorderLotInfo(sizeName);
      const facing = getPlacementFacing(player);
      const bounds = getFrontMarkerLotBounds(block.location, facing.backDirection, info.halfSize, info.size - 1);
      const positions = [];
      addBoundsParticlePositions(positions, bounds, Math.floor(block.location.y) + 1.35, 1);
      let count = 0;
      for (const position of positions) {
        if (count > LOT_PREVIEW_MAX_PARTICLES_PER_PLAYER) break;
        spawnPreviewParticle(block.dimension, position);
        count++;
      }
      messagePlayer(player, `§ePreviewed ${info.sizeName} capture area using particles.`);
    } catch (error) {
      sendDebugLogError(addonName, "Preview Build Recorder Area", error);
    }
  }

  return { previewBuildRecorderArea };
}
