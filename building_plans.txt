/*
 * Township building-plan factory.
 * It owns building variants, geometry templates, and phase labels.
 */
export function createBuildingPlans({
  transformFromBackAnchor,
  directionStateNumber,
  addBlockEntry,
  lotPathOffset,
  lotSmallHalf,
  lotSmallSize
}) {
  const BUILDING_VARIANTS_BY_LOT_SIZE = {
    11: [
      "small_cottage", "narrow_house", "wide_house", "workshop", "storage_cottage",
      "porch_cottage", "split_roof_house", "tiny_farmhouse", "corner_hearth_house", "two_room_cottage"
    ],
    15: [
      "medium_family_house", "medium_farmhouse", "medium_workshop", "medium_storehouse", "medium_inn",
      "medium_bunkhouse", "medium_blacksmith", "medium_market_house", "medium_corner_house", "medium_longhouse"
    ],
    21: [
      "large_manor", "large_guild_house", "large_barracks", "large_warehouse", "large_farm_estate",
      "large_market_hall", "large_workshop_hall", "large_inn", "large_town_house", "large_courtyard_house"
    ]
  };

  function getBuildingVariantsForLot(lot) {
    return BUILDING_VARIANTS_BY_LOT_SIZE[lot?.size ?? lotSmallSize] ?? BUILDING_VARIANTS_BY_LOT_SIZE[11];
  }

  function chooseAutoBuildingVariant(lot) {
    const variants = getBuildingVariantsForLot(lot);
    const index = hashStringNumber(lot?.id ?? tickCounter) % variants.length;
    return variants[index];
  }

  const BUILDING_DISPLAY_NAMES = {
    small_cottage: "Small Cottage", narrow_house: "Narrow House", wide_house: "Wide House", workshop: "Workshop", storage_cottage: "Storage Cottage",
    porch_cottage: "Porch Cottage", split_roof_house: "Split Roof House", tiny_farmhouse: "Tiny Farmhouse", corner_hearth_house: "Corner Hearth House", two_room_cottage: "Two Room Cottage",
    medium_family_house: "Family House", medium_farmhouse: "Farmhouse", medium_workshop: "Medium Workshop", medium_storehouse: "Storehouse", medium_inn: "Small Inn",
    medium_bunkhouse: "Bunkhouse", medium_blacksmith: "Blacksmith", medium_market_house: "Market House", medium_corner_house: "Corner House", medium_longhouse: "Longhouse",
    large_manor: "Manor", large_guild_house: "Guild House", large_barracks: "Barracks", large_warehouse: "Warehouse", large_farm_estate: "Farm Estate",
    large_market_hall: "Market Hall", large_workshop_hall: "Workshop Hall", large_inn: "Town Inn", large_town_house: "Large Town House", large_courtyard_house: "Courtyard House",
    log_cabin: "Log Cabin", workshop_house: "Workshop House", stone_cottage: "Stone Cottage", plank_cottage: "Plank Cottage"
  };

  function buildingDisplayName(typeId) {
    return BUILDING_DISPLAY_NAMES[typeId] ?? "Small House";
  }

  function transformLotLocal(lot, lx, lb) {
    const p = transformFromBackAnchor(lot.marker, lot.backDirection ?? "north", lx, lb);
    return { x: p.x, z: p.z };
  }

  function addDoorToPlan(plan, lot, y, lx, lb) {
    const doorDirection = lot.frontDirection ?? "south";
    const p1 = transformLotLocal(lot, lx, lb);
    const p2 = transformLotLocal(lot, lx, lb);
    addBlockEntry(plan, "build_small_house", p1.x, y + 1, p1.z, "minecraft:wooden_door", {
      "minecraft:cardinal_direction": doorDirection,
      door_hinge_bit: false,
      open_bit: false,
      upper_block_bit: false
    });
    addBlockEntry(plan, "build_small_house", p2.x, y + 2, p2.z, "minecraft:wooden_door", {
      "minecraft:cardinal_direction": doorDirection,
      door_hinge_bit: false,
      open_bit: false,
      upper_block_bit: true
    });
  }

  function addBedToPlan(plan, lot, y, lx, lbFoot) {
    const bedDirection = directionStateNumber(lot.backDirection ?? "north");
    const foot = transformLotLocal(lot, lx, lbFoot);
    const head = transformLotLocal(lot, lx, lbFoot + 1);
    addBlockEntry(plan, "build_small_house", foot.x, y + 1, foot.z, "minecraft:bed", {
      direction: bedDirection,
      head_piece_bit: false,
      occupied_bit: false
    });
    addBlockEntry(plan, "build_small_house", head.x, y + 1, head.z, "minecraft:bed", {
      direction: bedDirection,
      head_piece_bit: true,
      occupied_bit: false
    });
  }

  function addHouseBlock(plan, lot, y, phase, lx, dy, lb, typeId, states = undefined) {
    const p = transformLotLocal(lot, lx, lb);
    addBlockEntry(plan, phase, p.x, y + dy, p.z, typeId, states);
  }

  function addRectClear(plan, lot, y, minX, maxX, minB, maxB, height = 7) {
    // Start above the floor so house clearing does not dig the lot back into a dip.
    for (let dy = 1; dy <= height; dy++) {
      for (let lx = minX - 1; lx <= maxX + 1; lx++) {
        for (let lb = minB - 1; lb <= maxB + 1; lb++) {
          addHouseBlock(plan, lot, y, "clear_house", lx, dy, lb, "minecraft:air");
        }
      }
    }
  }

  function addPathAndPorchTo(plan, lot, y, doorLb, porchHalf = 2, porchBlock = "minecraft:oak_planks", pathX = lotPathOffset) {
    for (let lb = 1; lb < doorLb; lb++) addHouseBlock(plan, lot, y, "build_small_house", pathX, 0, lb, "minecraft:gravel");
    for (let lx = pathX - porchHalf; lx <= pathX + porchHalf; lx++) addHouseBlock(plan, lot, y, "build_small_house", lx, 0, doorLb - 1, porchBlock);
    addHouseBlock(plan, lot, y, "build_small_house", pathX - porchHalf, 1, doorLb - 1, "minecraft:oak_fence");
    addHouseBlock(plan, lot, y, "build_small_house", pathX + porchHalf, 1, doorLb - 1, "minecraft:oak_fence");
    addHouseBlock(plan, lot, y, "build_small_house", pathX - porchHalf, 2, doorLb - 1, "minecraft:torch");
    addHouseBlock(plan, lot, y, "build_small_house", pathX + porchHalf, 2, doorLb - 1, "minecraft:torch");
  }

  function addRectRoof(plan, lot, y, minX, maxX, minB, maxB, roofBlock = "minecraft:spruce_planks") {
    for (let lx = minX - 1; lx <= maxX + 1; lx++) {
      for (let lb = minB - 1; lb <= maxB + 1; lb++) addHouseBlock(plan, lot, y, "build_small_house", lx, 4, lb, roofBlock);
    }
    for (let lx = minX; lx <= maxX; lx++) {
      for (let lb = minB; lb <= maxB; lb++) addHouseBlock(plan, lot, y, "build_small_house", lx, 5, lb, roofBlock);
    }
    const ridgeX = Math.floor((minX + maxX) / 2);
    for (let lb = minB; lb <= maxB; lb++) addHouseBlock(plan, lot, y, "build_small_house", ridgeX, 6, lb, "minecraft:oak_log");
  }

  function addRectShell(plan, lot, y, cfg = {}) {
    const minX = cfg.minX ?? -3;
    const maxX = cfg.maxX ?? 3;
    const frontB = cfg.frontB ?? 4;
    const backB = cfg.backB ?? 8;
    const doorX = cfg.doorX ?? 0;
    const wallBlock = cfg.wallBlock ?? "minecraft:oak_planks";
    const postBlock = cfg.postBlock ?? "minecraft:oak_log";
    const floorBlock = cfg.floorBlock ?? "minecraft:oak_planks";
    const roofBlock = cfg.roofBlock ?? "minecraft:spruce_planks";

    for (let lx = minX; lx <= maxX; lx++) {
      for (let lb = frontB; lb <= backB; lb++) addHouseBlock(plan, lot, y, "build_small_house", lx, 0, lb, floorBlock);
    }

    for (const lx of [minX, maxX]) {
      for (const lb of [frontB, backB]) {
        for (let dy = 1; dy <= 3; dy++) addHouseBlock(plan, lot, y, "build_small_house", lx, dy, lb, postBlock);
      }
    }

    for (let lx = minX + 1; lx <= maxX - 1; lx++) {
      for (let dy = 1; dy <= 3; dy++) {
        addHouseBlock(plan, lot, y, "build_small_house", lx, dy, backB, wallBlock);
        if (lx === doorX && (dy === 1 || dy === 2)) {
          // door opening
        } else if ((lx === doorX - 1 || lx === doorX + 1) && (dy === 1 || dy === 2)) {
          addHouseBlock(plan, lot, y, "build_small_house", lx, dy, frontB, postBlock);
        } else {
          addHouseBlock(plan, lot, y, "build_small_house", lx, dy, frontB, wallBlock);
        }
      }
    }

    for (let lb = frontB + 1; lb <= backB - 1; lb++) {
      for (let dy = 1; dy <= 3; dy++) {
        const windowBlock = dy === 2 && lb === Math.floor((frontB + backB) / 2) ? "minecraft:glass" : wallBlock;
        addHouseBlock(plan, lot, y, "build_small_house", minX, dy, lb, windowBlock);
        addHouseBlock(plan, lot, y, "build_small_house", maxX, dy, lb, windowBlock);
      }
    }

    addDoorToPlan(plan, lot, y, doorX, frontB);
    addRectRoof(plan, lot, y, minX, maxX, frontB, backB, roofBlock);
  }

  function addWallInterior(plan, lot, y, cfg = {}) {
    const minX = cfg.minX ?? -3;
    const maxX = cfg.maxX ?? 3;
    const frontB = cfg.frontB ?? 4;
    const backB = cfg.backB ?? 8;
    const bedX = cfg.bedX ?? (minX + 1);
    const bedFootB = cfg.bedFootB ?? (frontB + 1);
    addBedToPlan(plan, lot, y, bedX, bedFootB);

    // Keep furnishings against walls, not floating in the middle and not embedded into exterior blocks.
    addHouseBlock(plan, lot, y, "build_small_house", maxX - 1, 1, backB - 1, "minecraft:chest");
    addHouseBlock(plan, lot, y, "build_small_house", maxX - 2, 1, backB - 1, "minecraft:crafting_table");
    addHouseBlock(plan, lot, y, "build_small_house", maxX - 1, 1, frontB + 1, "minecraft:furnace");
    addHouseBlock(plan, lot, y, "build_small_house", 0, 2, backB, "minecraft:torch");
  }

  function addChimney(plan, lot, y, lx, lb) {
    for (let dy = 4; dy <= 7; dy++) addHouseBlock(plan, lot, y, "build_small_house", lx, dy, lb, "minecraft:cobblestone");
  }

  function getSmallCottagePlan(town, lot) {
    const y = Math.floor(lot.marker.y) - 1;
    const plan = [];
    addRectClear(plan, lot, y, -4, 4, 3, 9, 8);
    addPathAndPorchTo(plan, lot, y, 4, 2, "minecraft:oak_planks");
    addRectShell(plan, lot, y, { minX: -3, maxX: 3, frontB: 4, backB: 8, wallBlock: "minecraft:oak_planks", postBlock: "minecraft:oak_log", floorBlock: "minecraft:oak_planks", roofBlock: "minecraft:spruce_planks" });
    addWallInterior(plan, lot, y, { minX: -3, maxX: 3, frontB: 4, backB: 8, bedX: -2, bedFootB: 5 });
    addChimney(plan, lot, y, 3, 7);
    return plan;
  }

  function getNarrowHousePlan(town, lot) {
    const y = Math.floor(lot.marker.y) - 1;
    const plan = [];
    addRectClear(plan, lot, y, -3, 3, 3, 10, 8);
    addPathAndPorchTo(plan, lot, y, 3, 1, "minecraft:spruce_planks");
    addRectShell(plan, lot, y, { minX: -2, maxX: 2, frontB: 3, backB: 9, wallBlock: "minecraft:oak_planks", postBlock: "minecraft:oak_log", floorBlock: "minecraft:spruce_planks", roofBlock: "minecraft:spruce_planks" });
    addWallInterior(plan, lot, y, { minX: -2, maxX: 2, frontB: 3, backB: 9, bedX: -1, bedFootB: 5 });
    addHouseBlock(plan, lot, y, "build_small_house", -2, 4, 5, "minecraft:oak_log");
    addHouseBlock(plan, lot, y, "build_small_house", 2, 4, 5, "minecraft:oak_log");
    addChimney(plan, lot, y, 2, 8);
    return plan;
  }

  function getWideHousePlan(town, lot) {
    const y = Math.floor(lot.marker.y) - 1;
    const plan = [];
    addRectClear(plan, lot, y, -5, 5, 4, 9, 8);
    addPathAndPorchTo(plan, lot, y, 5, 3, "minecraft:oak_planks");
    addRectShell(plan, lot, y, { minX: -4, maxX: 4, frontB: 5, backB: 8, wallBlock: "minecraft:oak_planks", postBlock: "minecraft:stripped_oak_log", floorBlock: "minecraft:oak_planks", roofBlock: "minecraft:spruce_planks" });
    addWallInterior(plan, lot, y, { minX: -4, maxX: 4, frontB: 5, backB: 8, bedX: -3, bedFootB: 6 });
    addHouseBlock(plan, lot, y, "build_small_house", -1, 2, 5, "minecraft:glass");
    addHouseBlock(plan, lot, y, "build_small_house", 1, 2, 5, "minecraft:glass");
    addChimney(plan, lot, y, 4, 7);
    return plan;
  }

  function getWorkshopPlan(town, lot) {
    const y = Math.floor(lot.marker.y) - 1;
    const plan = [];
    addRectClear(plan, lot, y, -5, 4, 3, 10, 8);
    addPathAndPorchTo(plan, lot, y, 4, 2, "minecraft:stone");
    addRectShell(plan, lot, y, { minX: -3, maxX: 3, frontB: 4, backB: 9, wallBlock: "minecraft:oak_planks", postBlock: "minecraft:stripped_oak_log", floorBlock: "minecraft:stone", roofBlock: "minecraft:spruce_planks" });
    // Right-side work alcove gives the workshop a different silhouette while keeping the same style family.
    for (let lx = 4; lx <= 5; lx++) {
      for (let lb = 6; lb <= 9; lb++) addHouseBlock(plan, lot, y, "build_small_house", lx, 0, lb, "minecraft:stone");
    }
    for (let lb = 6; lb <= 9; lb++) {
      addHouseBlock(plan, lot, y, "build_small_house", 5, 1, lb, "minecraft:oak_fence");
      addHouseBlock(plan, lot, y, "build_small_house", 5, 2, lb, "minecraft:torch");
    }
    addBedToPlan(plan, lot, y, -2, 5);
    addHouseBlock(plan, lot, y, "build_small_house", 2, 1, 8, "minecraft:crafting_table");
    addHouseBlock(plan, lot, y, "build_small_house", 1, 1, 8, "minecraft:furnace");
    addHouseBlock(plan, lot, y, "build_small_house", -2, 1, 8, "minecraft:chest");
    addHouseBlock(plan, lot, y, "build_small_house", 0, 2, 9, "minecraft:torch");
    addChimney(plan, lot, y, 3, 8);
    return plan;
  }

  function getStorageCottagePlan(town, lot) {
    const y = Math.floor(lot.marker.y) - 1;
    const plan = [];
    addRectClear(plan, lot, y, -4, 5, 3, 10, 8);
    addPathAndPorchTo(plan, lot, y, 4, 2, "minecraft:oak_planks");
    addRectShell(plan, lot, y, { minX: -3, maxX: 2, frontB: 4, backB: 9, wallBlock: "minecraft:oak_planks", postBlock: "minecraft:oak_log", floorBlock: "minecraft:oak_planks", roofBlock: "minecraft:spruce_planks" });
    // Left storage lean-to creates a different building, not just a material swap.
    for (let lx = -5; lx <= -4; lx++) {
      for (let lb = 6; lb <= 9; lb++) addHouseBlock(plan, lot, y, "build_small_house", lx, 0, lb, "minecraft:oak_planks");
    }
    for (let lb = 6; lb <= 9; lb++) {
      addHouseBlock(plan, lot, y, "build_small_house", -5, 1, lb, "minecraft:oak_fence");
      addHouseBlock(plan, lot, y, "build_small_house", -5, 2, lb, "minecraft:torch");
    }
    addBedToPlan(plan, lot, y, -2, 5);
    addHouseBlock(plan, lot, y, "build_small_house", 1, 1, 8, "minecraft:chest");
    addHouseBlock(plan, lot, y, "build_small_house", 0, 1, 8, "minecraft:barrel");
    addHouseBlock(plan, lot, y, "build_small_house", 1, 1, 5, "minecraft:crafting_table");
    addHouseBlock(plan, lot, y, "build_small_house", 2, 1, 8, "minecraft:furnace");
    addHouseBlock(plan, lot, y, "build_small_house", 0, 2, 9, "minecraft:torch");
    addChimney(plan, lot, y, 2, 8);
    return plan;
  }

  const BUILDING_CONFIGS = {
    small_cottage: { minX:-3, maxX:3, frontB:4, backB:8, porch:2, wall:"minecraft:oak_planks", post:"minecraft:oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[3,7], interior:"home" },
    narrow_house: { minX:-2, maxX:2, frontB:3, backB:9, porch:1, wall:"minecraft:oak_planks", post:"minecraft:oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[2,8], interior:"home" },
    wide_house: { minX:-4, maxX:4, frontB:5, backB:8, porch:3, wall:"minecraft:oak_planks", post:"minecraft:stripped_oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[4,7], interior:"home" },
    workshop: { minX:-3, maxX:3, frontB:4, backB:9, porch:2, wall:"minecraft:oak_planks", post:"minecraft:stripped_oak_log", floor:"minecraft:stone", roof:"minecraft:spruce_planks", chimney:[3,8], interior:"workshop", leanTo:"right" },
    storage_cottage: { minX:-3, maxX:2, frontB:4, backB:9, porch:2, wall:"minecraft:oak_planks", post:"minecraft:oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[2,8], interior:"storage", leanTo:"left" },
    porch_cottage: { minX:-3, maxX:3, frontB:5, backB:9, porch:3, wall:"minecraft:oak_planks", post:"minecraft:stripped_oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[3,8], interior:"home", frontAwning:true },
    split_roof_house: { minX:-4, maxX:3, frontB:4, backB:9, porch:2, wall:"minecraft:oak_planks", post:"minecraft:oak_log", floor:"minecraft:oak_planks", roof:"minecraft:dark_oak_planks", chimney:[3,8], interior:"home", sideWing:"right" },
    tiny_farmhouse: { minX:-3, maxX:3, frontB:4, backB:8, porch:2, wall:"minecraft:oak_planks", post:"minecraft:oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[3,7], interior:"farm", sidePen:"left" },
    corner_hearth_house: { minX:-3, maxX:3, frontB:4, backB:9, porch:2, wall:"minecraft:oak_planks", post:"minecraft:stripped_oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[-3,8], interior:"hearth" },
    two_room_cottage: { minX:-4, maxX:4, frontB:4, backB:9, porch:2, wall:"minecraft:oak_planks", post:"minecraft:oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[4,8], interior:"home", divider:true },

    medium_family_house: { minX:-5, maxX:5, frontB:4, backB:12, porch:3, wall:"minecraft:oak_planks", post:"minecraft:stripped_oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[5,11], interior:"home", divider:true },
    medium_farmhouse: { minX:-5, maxX:5, frontB:4, backB:12, porch:3, wall:"minecraft:oak_planks", post:"minecraft:oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[5,11], interior:"farm", sidePen:"left" },
    medium_workshop: { minX:-5, maxX:5, frontB:4, backB:12, porch:2, wall:"minecraft:oak_planks", post:"minecraft:stripped_oak_log", floor:"minecraft:stone", roof:"minecraft:spruce_planks", chimney:[5,11], interior:"workshop", leanTo:"right" },
    medium_storehouse: { minX:-5, maxX:5, frontB:5, backB:12, porch:2, wall:"minecraft:oak_planks", post:"minecraft:oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[5,11], interior:"storage", leanTo:"left" },
    medium_inn: { minX:-6, maxX:6, frontB:4, backB:12, porch:4, wall:"minecraft:oak_planks", post:"minecraft:stripped_oak_log", floor:"minecraft:oak_planks", roof:"minecraft:dark_oak_planks", chimney:[6,11], interior:"inn", divider:true },
    medium_bunkhouse: { minX:-5, maxX:5, frontB:4, backB:13, porch:2, wall:"minecraft:oak_planks", post:"minecraft:oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[5,12], interior:"bunkhouse" },
    medium_blacksmith: { minX:-5, maxX:5, frontB:4, backB:12, porch:2, wall:"minecraft:oak_planks", post:"minecraft:stripped_oak_log", floor:"minecraft:stone", roof:"minecraft:spruce_planks", chimney:[5,11], interior:"smith", leanTo:"right" },
    medium_market_house: { minX:-6, maxX:6, frontB:4, backB:11, porch:4, wall:"minecraft:oak_planks", post:"minecraft:oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[6,10], interior:"market", frontAwning:true },
    medium_corner_house: { minX:-5, maxX:5, frontB:4, backB:12, porch:2, wall:"minecraft:oak_planks", post:"minecraft:stripped_oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[-5,11], interior:"hearth", sideWing:"left" },
    medium_longhouse: { minX:-4, maxX:4, frontB:3, backB:13, porch:2, wall:"minecraft:oak_planks", post:"minecraft:oak_log", floor:"minecraft:oak_planks", roof:"minecraft:dark_oak_planks", chimney:[4,12], interior:"bunkhouse" },

    large_manor: { minX:-8, maxX:8, frontB:5, backB:17, porch:4, wall:"minecraft:oak_planks", post:"minecraft:stripped_oak_log", floor:"minecraft:oak_planks", roof:"minecraft:dark_oak_planks", chimney:[8,16], interior:"inn", divider:true, sideWing:"right" },
    large_guild_house: { minX:-8, maxX:8, frontB:5, backB:17, porch:4, wall:"minecraft:oak_planks", post:"minecraft:stripped_oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[8,16], interior:"workshop", divider:true, sideWing:"left" },
    large_barracks: { minX:-7, maxX:7, frontB:4, backB:18, porch:3, wall:"minecraft:oak_planks", post:"minecraft:oak_log", floor:"minecraft:oak_planks", roof:"minecraft:dark_oak_planks", chimney:[7,17], interior:"bunkhouse", divider:true },
    large_warehouse: { minX:-8, maxX:8, frontB:5, backB:17, porch:3, wall:"minecraft:oak_planks", post:"minecraft:oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[8,16], interior:"storage", leanTo:"right" },
    large_farm_estate: { minX:-8, maxX:8, frontB:5, backB:17, porch:4, wall:"minecraft:oak_planks", post:"minecraft:oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[8,16], interior:"farm", sidePen:"left", sideWing:"right" },
    large_market_hall: { minX:-9, maxX:9, frontB:5, backB:16, porch:5, wall:"minecraft:oak_planks", post:"minecraft:stripped_oak_log", floor:"minecraft:oak_planks", roof:"minecraft:dark_oak_planks", chimney:[9,15], interior:"market", frontAwning:true },
    large_workshop_hall: { minX:-8, maxX:8, frontB:5, backB:17, porch:4, wall:"minecraft:oak_planks", post:"minecraft:stripped_oak_log", floor:"minecraft:stone", roof:"minecraft:spruce_planks", chimney:[8,16], interior:"smith", leanTo:"right", sideWing:"left" },
    large_inn: { minX:-9, maxX:9, frontB:5, backB:17, porch:5, wall:"minecraft:oak_planks", post:"minecraft:stripped_oak_log", floor:"minecraft:oak_planks", roof:"minecraft:dark_oak_planks", chimney:[9,16], interior:"inn", divider:true },
    large_town_house: { minX:-8, maxX:8, frontB:4, backB:17, porch:4, wall:"minecraft:oak_planks", post:"minecraft:stripped_oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[8,16], interior:"home", divider:true, sideWing:"right" },
    large_courtyard_house: { minX:-9, maxX:9, frontB:5, backB:18, porch:4, wall:"minecraft:oak_planks", post:"minecraft:oak_log", floor:"minecraft:oak_planks", roof:"minecraft:spruce_planks", chimney:[9,17], interior:"home", sideWing:"left", sideWing2:"right" }
  };

  function addSpecialShape(plan, lot, y, cfg) {
    const lotHalf = lot.halfSize ?? lotSmallHalf;
    const lotDepth = (lot.size ?? lotSmallSize) - 1;
    const frontB = cfg.frontB, backB = Math.min(cfg.backB, lotDepth - 1), minX = Math.max(cfg.minX, -lotHalf + 1), maxX = Math.min(cfg.maxX, lotHalf - 1);
    if (cfg.divider) {
      const midB = Math.floor((frontB + backB) / 2);
      for (let lx = minX + 1; lx <= maxX - 1; lx++) {
        if (lx === 0) continue;
        addHouseBlock(plan, lot, y, "build_small_house", lx, 1, midB, cfg.wall ?? "minecraft:oak_planks");
        addHouseBlock(plan, lot, y, "build_small_house", lx, 2, midB, cfg.wall ?? "minecraft:oak_planks");
      }
    }
    if (cfg.leanTo === "right" || cfg.leanTo === "left") {
      const side = cfg.leanTo === "right" ? maxX + 1 : minX - 1;
      const outer = cfg.leanTo === "right" ? maxX + 2 : minX - 2;
      for (let lx = Math.min(side, outer); lx <= Math.max(side, outer); lx++) {
        for (let lb = Math.floor((frontB + backB) / 2); lb <= backB; lb++) addHouseBlock(plan, lot, y, "build_small_house", lx, 0, lb, cfg.floor ?? "minecraft:oak_planks");
      }
      for (let lb = Math.floor((frontB + backB) / 2); lb <= backB; lb++) {
        addHouseBlock(plan, lot, y, "build_small_house", outer, 1, lb, "minecraft:oak_fence");
        if (lb % 2 === 0) addHouseBlock(plan, lot, y, "build_small_house", outer, 2, lb, "minecraft:torch");
      }
    }
    if (cfg.sidePen) {
      const side = cfg.sidePen === "right" ? Math.min(lotHalf - 2, maxX + 2) : Math.max(-lotHalf + 2, minX - 2);
      const innerSide = cfg.sidePen === "right" ? side - 1 : side + 1;
      for (let lb = frontB + 2; lb <= backB - 1; lb++) addHouseBlock(plan, lot, y, "build_small_house", side, 1, lb, "minecraft:oak_fence");

      // Farm blocks are now placed by addFarmPatch() in the front yard, not in cramped side pens.
      // Keep this side area as a decorative rail/work yard only.
    }
    if (cfg.frontAwning) {
      for (let lx = minX - 1; lx <= maxX + 1; lx++) addHouseBlock(plan, lot, y, "build_small_house", lx, 3, frontB - 1, cfg.roof ?? "minecraft:spruce_planks");
    }
    if (cfg.sideWing || cfg.sideWing2) {
      for (const sideName of [cfg.sideWing, cfg.sideWing2].filter(Boolean)) {
        const rawX0 = sideName === "right" ? maxX + 1 : minX - 3;
        const rawX1 = sideName === "right" ? maxX + 3 : minX - 1;
        const x0 = Math.max(-lotHalf + 1, Math.min(lotHalf - 1, rawX0));
        const x1 = Math.max(-lotHalf + 1, Math.min(lotHalf - 1, rawX1));
        if (x0 === x1) continue;
        const b0 = Math.floor((frontB + backB) / 2);
        const b1 = Math.min(lotDepth - 1, Math.min(backB + 1, b0 + 4));
        for (let lx = x0; lx <= x1; lx++) for (let lb = b0; lb <= b1; lb++) addHouseBlock(plan, lot, y, "build_small_house", lx, 0, lb, cfg.floor ?? "minecraft:oak_planks");
        for (const lx of [x0, x1]) for (const lb of [b0, b1]) for (let dy = 1; dy <= 3; dy++) addHouseBlock(plan, lot, y, "build_small_house", lx, dy, lb, cfg.post ?? "minecraft:oak_log");
        for (let lx = x0; lx <= x1; lx++) for (let lb = b0; lb <= b1; lb++) if (lx === x0 || lx === x1 || lb === b0 || lb === b1) addHouseBlock(plan, lot, y, "build_small_house", lx, 4, lb, cfg.roof ?? "minecraft:spruce_planks");
      }
    }
  }

  function addFarmPatch(plan, lot, y, cfg) {
    const half = lot.halfSize ?? lotSmallHalf;
    const depth = (lot.size ?? lotSmallSize) - 1;
    const patchMinB = 1;
    const patchMaxB = Math.min(depth - 2, Math.max(3, (cfg.frontB ?? 4) - 1));
    let patchMinX = 1;
    let patchMaxX = Math.min(half - 2, patchMinX + Math.max(2, Math.floor((lot.size ?? lotSmallSize) / 5)));
    if (patchMaxX < patchMinX) { patchMinX = -half + 2; patchMaxX = patchMinX + 2; }
    for (let lx = patchMinX; lx <= patchMaxX; lx++) {
      for (let lb = patchMinB; lb <= patchMaxB; lb++) {
        addHouseBlock(plan, lot, y, "build_small_house", lx, 0, lb, "minecraft:farmland");
        if ((lx + lb) % 2 === 0) addHouseBlock(plan, lot, y, "build_small_house", lx, 1, lb, "minecraft:wheat");
      }
    }
    addHouseBlock(plan, lot, y, "build_small_house", patchMaxX + 1 <= half - 1 ? patchMaxX + 1 : patchMinX, 0, patchMinB, "minecraft:water");
    addHouseBlock(plan, lot, y, "build_small_house", patchMaxX + 1 <= half - 1 ? patchMaxX + 1 : patchMinX, 1, patchMinB + 1, "minecraft:composter");
  }

  function addInteriorByType(plan, lot, y, cfg) {
    const minX = cfg.minX, maxX = cfg.maxX, frontB = cfg.frontB, backB = cfg.backB;
    const leftX = minX + 1, rightX = maxX - 1;
    const rearB = backB - 1, midB = Math.floor((frontB + backB) / 2);
    const type = cfg.interior ?? "home";

    // Sleeping/furniture goes against rear/side walls, not in the doorway or front path.
    const bedFootB = Math.max(frontB + 1, rearB - 2);
    addBedToPlan(plan, lot, y, leftX, bedFootB);
    if (type === "bunkhouse" || type === "inn") addBedToPlan(plan, lot, y, Math.min(rightX - 1, leftX + 2), bedFootB);

    // Basic home utility wall.
    addHouseBlock(plan, lot, y, "build_small_house", rightX, 1, rearB, "minecraft:chest");
    addHouseBlock(plan, lot, y, "build_small_house", rightX - 1, 1, rearB, "minecraft:crafting_table");
    addHouseBlock(plan, lot, y, "build_small_house", rightX, 1, frontB + 1, "minecraft:furnace");

    // Temporary vanilla villager job blocks. These are deliberately spread across the preset pool
    // so auto-building towns eventually contain every normal workstation before custom villagers exist.
    if (type === "home") {
      addHouseBlock(plan, lot, y, "build_small_house", leftX, 1, rearB, "minecraft:lectern");
    }
    if (type === "storage" || type === "market") {
      addHouseBlock(plan, lot, y, "build_small_house", leftX, 1, rearB, "minecraft:barrel");
      addHouseBlock(plan, lot, y, "build_small_house", leftX + 1, 1, rearB, "minecraft:chest");
      addHouseBlock(plan, lot, y, "build_small_house", 0, 1, rearB, "minecraft:barrel");
      addHouseBlock(plan, lot, y, "build_small_house", leftX, 1, frontB + 1, "minecraft:cartography_table");
      addHouseBlock(plan, lot, y, "build_small_house", leftX + 1, 1, frontB + 1, "minecraft:loom");
    }
    if (type === "workshop") {
      addHouseBlock(plan, lot, y, "build_small_house", rightX - 2, 1, rearB, "minecraft:furnace");
      addHouseBlock(plan, lot, y, "build_small_house", 0, 1, rearB, "minecraft:crafting_table");
      addHouseBlock(plan, lot, y, "build_small_house", leftX, 1, rearB, "minecraft:stonecutter");
      addHouseBlock(plan, lot, y, "build_small_house", leftX + 1, 1, rearB, "minecraft:fletching_table");
    }
    if (type === "smith") {
      addHouseBlock(plan, lot, y, "build_small_house", rightX - 2, 1, rearB, "minecraft:blast_furnace");
      addHouseBlock(plan, lot, y, "build_small_house", rightX - 1, 1, rearB, "minecraft:smithing_table");
      addHouseBlock(plan, lot, y, "build_small_house", leftX, 1, rearB, "minecraft:grindstone");
    }
    if (type === "farm") {
      addHouseBlock(plan, lot, y, "build_small_house", leftX, 1, rearB, "minecraft:barrel");
      addHouseBlock(plan, lot, y, "build_small_house", leftX + 1, 1, rearB, "minecraft:hay_block");
      addHouseBlock(plan, lot, y, "build_small_house", rightX - 1, 1, rearB, "minecraft:composter");
    }
    if (type === "inn") {
      addHouseBlock(plan, lot, y, "build_small_house", rightX - 2, 1, rearB, "minecraft:smoker");
      addHouseBlock(plan, lot, y, "build_small_house", rightX - 3, 1, rearB, "minecraft:brewing_stand");
      addHouseBlock(plan, lot, y, "build_small_house", leftX, 1, rearB, "minecraft:cauldron");
    }
    if (type === "bunkhouse") {
      addHouseBlock(plan, lot, y, "build_small_house", rightX - 2, 1, rearB, "minecraft:grindstone");
    }
    if (type === "hearth") {
      addHouseBlock(plan, lot, y, "build_small_house", leftX, 1, rearB, "minecraft:campfire");
      addHouseBlock(plan, lot, y, "build_small_house", leftX + 1, 1, rearB, "minecraft:smoker");
    }

    // Light the interior from multiple wall/ceiling points to avoid dark corners.
    for (const [lx, lb] of [[0, backB], [minX, midB], [maxX, midB], [leftX, frontB + 1], [rightX, frontB + 1]]) {
      addHouseBlock(plan, lot, y, "build_small_house", lx, 2, lb, "minecraft:torch");
    }
  }


  function addLotFloorRepair(plan, lot, y) {
    const half = lot.halfSize ?? lotSmallHalf;
    const depth = (lot.size ?? lotSmallSize) - 1;
    // Restore the prepared floor after building clear operations. This prevents dips under and around houses.
    for (let lx = -half; lx <= half; lx++) {
      for (let lb = 0; lb <= depth; lb++) {
        addHouseBlock(plan, lot, y, "build_small_house", lx, 0, lb, "minecraft:dirt");
      }
    }
  }

  function addLotBoundaryRestore(plan, lot, y) {
    const half = lot.halfSize ?? lotSmallHalf;
    const depth = (lot.size ?? lotSmallSize) - 1;
    for (let lx = -half; lx <= half; lx++) {
      const frontOpen = (lx >= lotPathOffset - 1 && lx <= lotPathOffset + 1);
      if (!frontOpen && lx !== 0) addHouseBlock(plan, lot, y, "build_small_house", lx, 1, 0, "minecraft:oak_fence");
      addHouseBlock(plan, lot, y, "build_small_house", lx, 1, depth, "minecraft:oak_fence");
    }
    for (let lb = 1; lb <= depth - 1; lb++) {
      addHouseBlock(plan, lot, y, "build_small_house", -half, 1, lb, "minecraft:oak_fence");
      addHouseBlock(plan, lot, y, "build_small_house", half, 1, lb, "minecraft:oak_fence");
    }
    for (const [cx, cb] of [[-half, 0], [half, 0], [-half, depth], [half, depth]]) {
      addHouseBlock(plan, lot, y, "build_small_house", cx, 2, cb, "minecraft:stripped_oak_log");
    }
  }

  function clampNumber(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function getConfiguredBuildingPlan(town, lot, variant) {
    const cfg = BUILDING_CONFIGS[variant] ?? BUILDING_CONFIGS.small_cottage;
    // Ground-level rule: Lot Marker stays one block above prepared dirt.
    // Building floors, paths, and porches go at markerY - 1.
    // Walls, doors, beds, furniture, fences, and job blocks then sit at markerY.
    const y = Math.floor(lot.marker.y) - 1;
    const plan = [];
    const pathX = clampNumber(cfg.pathX ?? lotPathOffset, cfg.minX + 1, cfg.maxX - 1);
    const doorX = clampNumber(cfg.doorX ?? pathX, cfg.minX + 1, cfg.maxX - 1);
    addRectClear(plan, lot, y, cfg.minX - 1, cfg.maxX + 1, cfg.frontB - 1, cfg.backB + 1, 9);
    addLotFloorRepair(plan, lot, y);
    addPathAndPorchTo(plan, lot, y, cfg.frontB, cfg.porch ?? 2, cfg.floor ?? "minecraft:oak_planks", pathX);
    addRectShell(plan, lot, y, { minX: cfg.minX, maxX: cfg.maxX, frontB: cfg.frontB, backB: cfg.backB, doorX, wallBlock: cfg.wall, postBlock: cfg.post, floorBlock: cfg.floor, roofBlock: cfg.roof });
    addSpecialShape(plan, lot, y, cfg);
    if ((cfg.interior ?? "home") === "farm") addFarmPatch(plan, lot, y, cfg);
    addInteriorByType(plan, lot, y, cfg);
    if (Array.isArray(cfg.chimney)) addChimney(plan, lot, y, cfg.chimney[0], cfg.chimney[1]);
    addLotBoundaryRestore(plan, lot, y);
    return plan;
  }

  function getAutoBuildingPlan(town, lot, variant) {
    if (variant === "log_cabin") variant = "narrow_house";
    if (variant === "workshop_house") variant = "workshop";
    if (variant === "stone_cottage") variant = "wide_house";
    if (variant === "plank_cottage") variant = "storage_cottage";
    return getConfiguredBuildingPlan(town, lot, variant);
  }

  function getSmallHousePhaseLabel(phase, variant = "small_house") {
    const name = buildingDisplayName(variant).toLowerCase();
    if (phase === "clear_house") return `clearing space for a ${name}`;
    if (phase === "build_small_house") return `building a ${name}`;
    return phase ?? `building a ${name}`;
  }

  return {
    chooseAutoBuildingVariant,
    buildingDisplayName,
    getAutoBuildingPlan,
    getSmallHousePhaseLabel
  };
}
