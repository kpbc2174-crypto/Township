export const FOUNDING_STONE_ID = "township:founding_stone";
export const LOT_MARKER_ID = "township:lot_marker";
export const MEDIUM_LOT_MARKER_ID = "township:medium_lot_marker";
export const LARGE_LOT_MARKER_ID = "township:large_lot_marker";
export const DIRT_ROAD_ID = "township:dirt_road";
export const GROUND_LEVELER_ID = "township:ground_leveler";
export const BUILD_RECORDER_ID = "township:build_recorder";
export const SMALL_BUILD_LOT_ID = "township:small_build_lot";
export const MEDIUM_BUILD_LOT_ID = "township:medium_build_lot";
export const LARGE_BUILD_LOT_ID = "township:large_build_lot";
export const BUILD_LOT_MARKER_IDS = [SMALL_BUILD_LOT_ID, MEDIUM_BUILD_LOT_ID, LARGE_BUILD_LOT_ID];
export const NATURAL_CAPTURE_SKIP_BLOCKS = new Set([
  "minecraft:stone",
  "minecraft:dirt",
  "minecraft:grass_block",
  "minecraft:deepslate",
  "minecraft:tuff",
  "minecraft:gravel",
  "minecraft:sand",
  "minecraft:sandstone",
  "minecraft:andesite",
  "minecraft:diorite",
  "minecraft:granite",
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava"
]);
export const LOT_MARKER_IDS = [LOT_MARKER_ID, MEDIUM_LOT_MARKER_ID, LARGE_LOT_MARKER_ID, SMALL_BUILD_LOT_ID, MEDIUM_BUILD_LOT_ID, LARGE_BUILD_LOT_ID];
export const TOWNS_PROPERTY = "township:towns_v1";
export const BUILD_RECORDER_PROPERTY = "township:captured_build_v1";
export const CLAIM_RADIUS = 96;
export const MIN_TOWN_DISTANCE = CLAIM_RADIUS * 2;
export const STARTING_BUILD_RADIUS = CLAIM_RADIUS;
export const BUILDER_DELAY_TICKS = 20 * 5;
export const BUILDER_TAG = "township_builder";
export const CAMP_BUILD_INTERVAL_TICKS = 5;
export const CAMP_BLOCKS_PER_STEP = 4;
export const CAMP_JOB_STATUS_PENDING = "starter_camp_pending";
export const CAMP_JOB_STATUS_BUILDING = "starter_camp_building";
export const CAMP_JOB_STATUS_COMPLETE = "starter_camp_complete";
export const LOT_SMALL_SIZE = 11;
export const LOT_SMALL_HALF = 5;
export const LOT_MEDIUM_SIZE = 15;
export const LOT_MEDIUM_HALF = 7;
export const LOT_LARGE_SIZE = 21;
export const LOT_LARGE_HALF = 10;
export const LOT_BUFFER = 1;
export const LOT_PREP_INTERVAL_TICKS = 5;
export const LOT_PREP_BLOCKS_PER_STEP = 32;
export const LOT_STATUS_REGISTERED = "registered";
export const LOT_STATUS_QUEUED = "prep_queued";
export const LOT_STATUS_PREPARING = "preparing";
export const LOT_STATUS_READY = "ready";
export const LOT_STATUS_BUILDING = "building";
export const LOT_STATUS_OCCUPIED = "occupied";
export const HOUSE_BUILD_INTERVAL_TICKS = 5;
export const HOUSE_BLOCKS_PER_STEP = 64;
export const ROAD_BUILD_INTERVAL_TICKS = 4;
export const ROAD_BLOCKS_PER_STEP = 24;
export const ROAD_STATUS_NOT_CONNECTED = "not_connected";
export const ROAD_STATUS_QUEUED = "road_queued";
export const ROAD_STATUS_BUILDING = "road_building";
export const ROAD_STATUS_CONNECTED = "connected";
export const GROUND_LEVELER_SIZE = 41;
export const GROUND_LEVELER_HALF = 20;
export const GROUND_LEVELER_CLEAR_HEIGHT = 16;
export const GROUND_LEVELER_INTERVAL_TICKS = 3;
export const GROUND_LEVELER_BLOCKS_PER_STEP = 64;
export const LOT_PREVIEW_RADIUS = 56;
export const LOT_PREVIEW_INTERVAL_TICKS = 20;
export const LOT_PREVIEW_PARTICLE = "minecraft:basic_smoke_particle";
export const LOT_PREVIEW_MAX_PARTICLES_PER_PLAYER = 160;
export const LOT_PATH_OFFSET = -3;
export const AUTO_PLACE_INTERVAL_TICKS = 20 * 8;
export const AUTO_PLACE_MAX_SMALL = 12;
export const AUTO_PLACE_MAX_MEDIUM = 8;
export const AUTO_PLACE_MAX_LARGE = 5;
export const AUTO_PLACE_QUEUE_LIMIT = 1;
export const AUTO_PLACE_SEARCH_STEP = 8;
export const AUTO_PLACE_RINGS = [24, 40, 56, 72, 88];
export const TOWN_PREP_RADIUS = 96;
export const TOWN_BOUNDARY_RADIUS = 96;
export const INNER_WALL_RESERVE_HALF_WIDTH = 5;
export const INNER_GATE_HALF_WIDTH = 2;
export const TOWN_PREP_CLEAR_HEIGHT = 16;
export const TOWN_PREP_INTERVAL_TICKS = 2;
export const TOWN_PREP_BLOCKS_PER_STEP = 800;
export const TOWN_PREP_PHASES = ["clear_town_area", "level_town_area", "mark_town_boundary"];
export const AUTO_PLACE_MAX_PER_RUN = 1;
export const AUTO_PLACE_MAX_CANDIDATES_PER_SEARCH = 80;
export const AUTO_PLACE_ROAD_SCAN_DISTANCE = 18;
export const ROAD_RESERVE_HALF_WIDTH = 5;
export const ROAD_RESERVE_SCAN_BUFFER = 2;
export const TOWN_PREP_LOAD_BUFFER = 24;
export const TOWN_PREP_LOAD_WAIT_TICKS = 80;
export const TICKING_AREA_CIRCLE_RADIUS = 4;
export const ACTIVE_JOB_BUFFER = 24;
export const TOWN_PREP_QUADRANTS = [
  { key: "se_1", label: "south-east section A", sx: 0.5, ex: 1, sz: 0.5, ez: 1 },
  { key: "se_2", label: "south-east section B", sx: 0, ex: 0.5, sz: 0, ez: 0.5 },
  { key: "east_south", label: "east-south section", sx: 0.5, ex: 1, sz: 0, ez: 0.5 },
  { key: "south_east", label: "south-east side section", sx: 0, ex: 0.5, sz: 0.5, ez: 1 },
  { key: "ne_1", label: "north-east section A", sx: 0.5, ex: 1, sz: -1, ez: -0.5 },
  { key: "ne_2", label: "north-east section B", sx: 0, ex: 0.5, sz: -0.5, ez: 0 },
  { key: "east_north", label: "east-north section", sx: 0.5, ex: 1, sz: -0.5, ez: 0 },
  { key: "north_east", label: "north-east side section", sx: 0, ex: 0.5, sz: -1, ez: -0.5 },
  { key: "nw_1", label: "north-west section A", sx: -1, ex: -0.5, sz: -1, ez: -0.5 },
  { key: "nw_2", label: "north-west section B", sx: -0.5, ex: 0, sz: -0.5, ez: 0 },
  { key: "west_north", label: "west-north section", sx: -1, ex: -0.5, sz: -0.5, ez: 0 },
  { key: "north_west", label: "north-west side section", sx: -0.5, ex: 0, sz: -1, ez: -0.5 },
  { key: "sw_1", label: "south-west section A", sx: -1, ex: -0.5, sz: 0.5, ez: 1 },
  { key: "sw_2", label: "south-west section B", sx: -0.5, ex: 0, sz: 0, ez: 0.5 },
  { key: "west_south", label: "west-south section", sx: -1, ex: -0.5, sz: 0, ez: 0.5 },
  { key: "south_west", label: "south-west section", sx: -0.5, ex: 0, sz: 0.5, ez: 1 }
];
