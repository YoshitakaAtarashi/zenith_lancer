// Asset constants and tables (data/assets.js holds the data).
const FR_SHIP = 0;
const FR_SHIP_N = 3;
const AS_SHIP = 0;
const FR_FLAME = 3;
const FR_FLAME_N = 2;
const AS_FLAME = 1;
const FR_OPTION = 5;
const FR_OPTION_N = 4;
const AS_OPTION = 2;
const FR_SHOT = 9;
const FR_SHOT_N = 1;
const AS_SHOT = 3;
const FR_SHOTDIAG = 10;
const FR_SHOTDIAG_N = 1;
const AS_SHOTDIAG = 4;
const FR_MISSILE = 11;
const FR_MISSILE_N = 2;
const AS_MISSILE = 5;
const FR_LASER = 13;
const FR_LASER_N = 2;
const AS_LASER = 6;
const FR_SHIELD = 15;
const FR_SHIELD_N = 3;
const AS_SHIELD = 7;
const FR_CAPRED = 18;
const FR_CAPRED_N = 2;
const AS_CAPRED = 8;
const FR_CAPBLUE = 20;
const FR_CAPBLUE_N = 2;
const AS_CAPBLUE = 9;
const FR_EXSMALL = 22;
const FR_EXSMALL_N = 6;
const AS_EXSMALL = 10;
const FR_EXBIG = 28;
const FR_EXBIG_N = 6;
const AS_EXBIG = 11;
const FR_SPARK = 34;
const FR_SPARK_N = 3;
const AS_SPARK = 12;
const FR_EBULLET = 37;
const FR_EBULLET_N = 2;
const AS_EBULLET = 13;
const FR_BEAM = 39;
const FR_BEAM_N = 2;
const AS_BEAM = 14;
const FR_FAN = 41;
const FR_FAN_N = 8;
const AS_FAN = 15;
const FR_DART = 49;
const FR_DART_N = 1;
const AS_DART = 16;
const FR_TURRET = 50;
const FR_TURRET_N = 5;
const AS_TURRET = 17;
const FR_WALKER = 55;
const FR_WALKER_N = 4;
const AS_WALKER = 18;
const FR_HATCH = 59;
const FR_HATCH_N = 4;
const AS_HATCH = 19;
const FR_MINI = 63;
const FR_MINI_N = 2;
const AS_MINI = 20;
const FR_CRAB = 65;
const FR_CRAB_N = 2;
const AS_CRAB = 21;
const FR_ROCK = 67;
const FR_ROCK_N = 4;
const AS_ROCK = 22;
const FR_B1CORE = 71;
const FR_B1CORE_N = 3;
const AS_B1CORE = 23;
const FR_B5CORE = 74;
const FR_B5CORE_N = 3;
const AS_B5CORE = 24;
const FR_SHUTTER = 77;
const FR_SHUTTER_N = 2;
const AS_SHUTTER = 25;
const FR_ICICLE = 79;
const FR_ICICLE_N = 2;
const AS_ICICLE = 26;
const FR_FLAKE = 81;
const FR_FLAKE_N = 6;
const AS_FLAKE = 27;
const FR_SLED = 87;
const FR_SLED_N = 2;
const AS_SLED = 28;
const FR_CUBE = 89;
const FR_CUBE_N = 4;
const AS_CUBE = 29;
const FR_CRYOCORE = 93;
const FR_CRYOCORE_N = 4;
const AS_CRYOCORE = 30;
const FR_CRYOSHARD = 97;
const FR_CRYOSHARD_N = 2;
const AS_CRYOSHARD = 31;
const FR_SPORE = 99;
const FR_SPORE_N = 2;
const AS_SPORE = 32;
const FR_WORMHEAD = 101;
const FR_WORMHEAD_N = 2;
const AS_WORMHEAD = 33;
const FR_WORMBODY = 103;
const FR_WORMBODY_N = 1;
const AS_WORMBODY = 34;
const FR_AMOEBA = 104;
const FR_AMOEBA_N = 2;
const AS_AMOEBA = 35;
const FR_CELL = 106;
const FR_CELL_N = 2;
const AS_CELL = 36;
const FR_EYELID = 108;
const FR_EYELID_N = 3;
const AS_EYELID = 37;
const FR_IRIS = 111;
const FR_IRIS_N = 1;
const AS_IRIS = 38;
const FR_TENTACLE = 112;
const FR_TENTACLE_N = 2;
const AS_TENTACLE = 39;
const FR_JELLY = 114;
const FR_JELLY_N = 3;
const AS_JELLY = 40;
const FR_FISH = 117;
const FR_FISH_N = 2;
const AS_FISH = 41;
const FR_MINE = 119;
const FR_MINE_N = 2;
const AS_MINE = 42;
const FR_CLAM = 121;
const FR_CLAM_N = 2;
const AS_CLAM = 43;
const FR_HIVEFILL = 123;
const FR_HIVEFILL_N = 1;
const AS_HIVEFILL = 44;
const FR_HIVERIM = 124;
const FR_HIVERIM_N = 1;
const AS_HIVERIM = 45;
const FR_BUBBLET = 125;
const FR_BUBBLET_N = 2;
const AS_BUBBLET = 46;
const FR_GEYSER = 127;
const FR_GEYSER_N = 1;
const AS_GEYSER = 47;
const FR_LEVHEAD = 128;
const FR_LEVHEAD_N = 2;
const AS_LEVHEAD = 48;
const FR_LEVSEG = 130;
const FR_LEVSEG_N = 1;
const AS_LEVSEG = 49;
const FR_LEVTAIL = 131;
const FR_LEVTAIL_N = 1;
const AS_LEVTAIL = 50;
const FR_BLOCK = 132;
const FR_BLOCK_N = 2;
const AS_BLOCK = 51;
const FR_CANNON = 134;
const FR_CANNON_N = 2;
const AS_CANNON = 52;
const FR_PBEAM = 136;
const FR_PBEAM_N = 10;
const AS_PBEAM = 53;
const FR_EMITTER = 146;
const FR_EMITTER_N = 6;
const AS_EMITTER = 54;
const FR_LCANNON = 152;
const FR_LCANNON_N = 3;
const AS_LCANNON = 55;
const FR_RAIL = 155;
const FR_RAIL_N = 1;
const AS_RAIL = 56;
const FR_FLAREHEAD = 156;
const FR_FLAREHEAD_N = 1;
const AS_FLAREHEAD = 57;
const FR_FLAREBODY = 157;
const FR_FLAREBODY_N = 2;
const AS_FLAREBODY = 58;
const FR_BAYDOORS = 159;
const FR_BAYDOORS_N = 4;
const AS_BAYDOORS = 59;
const FR_POD = 163;
const FR_POD_N = 2;
const AS_POD = 60;
const FR_ORB = 165;
const FR_ORB_N = 2;
const AS_ORB = 61;
const FR_LANCER = 167;
const FR_LANCER_N = 2;
const AS_LANCER = 62;
const FR_ZCORE = 169;
const FR_ZCORE_N = 3;
const AS_ZCORE = 63;
const FR_ZSAT = 172;
const FR_ZSAT_N = 2;
const AS_ZSAT = 64;
const NUM_ASSETS = 65;
const NUM_FRAMES = 174;
const FONT_HUD = 0;
const FONT_SEL = 51;
const FONT_TXT = 102;
const FONT_DIM = 153;
const FONT_GOLD = 204;
const FONT_TILES_NUM = 255;
const HUDFONT_GLYPHS = 31;
const HUDFONT_TILES_NUM = 93;
const VT_STAGE = 316;
const VT_MSG = 1984;
const NUM_STAGES = 6;
const MUS_TITLE = 1;
const MUS_STAGE1 = 2;
const MUS_STAGE2 = 3;
const MUS_STAGE3 = 4;
const MUS_STAGE4 = 5;
const MUS_STAGE5 = 6;
const MUS_STAGE6 = 7;
const MUS_BOSS = 8;
const MUS_FINALBOSS = 9;
const MUS_ENDING = 10;
const MUS_CLEAR = 11;
const MUS_GAMEOVER = 12;
const MUS_COUNT = 13;

const ms_pieces = [
    { dx: 0, dy: 0, size: 13, w: 32, tile: 0 },
    { dx: 0, dy: 0, size: 13, w: 32, tile: 8 },
    { dx: 0, dy: 0, size: 13, w: 32, tile: 16 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 0 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 1 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 8 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 12 },
    { dx: 0, dy: 0, size: 4, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 0 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 0 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 1 },
    { dx: 0, dy: 0, size: 12, w: 32, tile: 0 },
    { dx: 0, dy: 0, size: 12, w: 32, tile: 4 },
    { dx: 0, dy: 0, size: 7, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 7, w: 16, tile: 8 },
    { dx: 0, dy: 0, size: 7, w: 16, tile: 16 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 8 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 12 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 16 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 20 },
    { dx: 8, dy: 8, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 8, size: 10, w: 24, tile: 4 },
    { dx: 0, dy: 0, size: 11, w: 24, tile: 13 },
    { dx: 0, dy: 0, size: 11, w: 24, tile: 25 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 37 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 53 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 0 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 1 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 2 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 12, w: 32, tile: 0 },
    { dx: 0, dy: 0, size: 12, w: 32, tile: 4 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 8 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 12 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 16 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 20 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 24 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 28 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 8 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 12 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 16 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 8 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 12 },
    { dx: 0, dy: 0, size: 13, w: 32, tile: 0 },
    { dx: 0, dy: 0, size: 13, w: 32, tile: 8 },
    { dx: 0, dy: 0, size: 13, w: 32, tile: 16 },
    { dx: 0, dy: 0, size: 13, w: 32, tile: 24 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 0 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 1 },
    { dx: 0, dy: 0, size: 14, w: 32, tile: 0 },
    { dx: 0, dy: 0, size: 14, w: 32, tile: 12 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 8 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 12 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 0 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 16 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 32 },
    { dx: 0, dy: 0, size: 10, w: 24, tile: 0 },
    { dx: 0, dy: 0, size: 10, w: 24, tile: 9 },
    { dx: 0, dy: 0, size: 10, w: 24, tile: 18 },
    { dx: 0, dy: 0, size: 7, w: 16, tile: 0 },
    { dx: 0, dy: 32, size: 5, w: 16, tile: 8 },
    { dx: 0, dy: 0, size: 7, w: 16, tile: 12 },
    { dx: 0, dy: 32, size: 5, w: 16, tile: 20 },
    { dx: 0, dy: 0, size: 2, w: 8, tile: 0 },
    { dx: 0, dy: 0, size: 2, w: 8, tile: 3 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 8 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 12 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 16 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 20 },
    { dx: 0, dy: 0, size: 9, w: 24, tile: 0 },
    { dx: 0, dy: 0, size: 9, w: 24, tile: 6 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 0 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 16 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 32 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 48 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 0 },
    { dx: 0, dy: 32, size: 13, w: 32, tile: 16 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 24 },
    { dx: 8, dy: 32, size: 5, w: 16, tile: 40 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 44 },
    { dx: 8, dy: 32, size: 5, w: 16, tile: 60 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 64 },
    { dx: 0, dy: 32, size: 13, w: 32, tile: 80 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 10, w: 24, tile: 0 },
    { dx: 0, dy: 0, size: 10, w: 24, tile: 9 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 0 },
    { dx: 32, dy: 0, size: 15, w: 32, tile: 16 },
    { dx: 0, dy: 32, size: 15, w: 32, tile: 32 },
    { dx: 32, dy: 32, size: 15, w: 32, tile: 48 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 64 },
    { dx: 32, dy: 0, size: 15, w: 32, tile: 80 },
    { dx: 0, dy: 32, size: 15, w: 32, tile: 96 },
    { dx: 32, dy: 32, size: 15, w: 32, tile: 112 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 128 },
    { dx: 32, dy: 0, size: 15, w: 32, tile: 144 },
    { dx: 0, dy: 32, size: 15, w: 32, tile: 160 },
    { dx: 32, dy: 32, size: 15, w: 32, tile: 176 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 0 },
    { dx: 0, dy: 0, size: 10, w: 24, tile: 0 },
    { dx: 0, dy: 0, size: 10, w: 24, tile: 9 },
    { dx: 0, dy: 0, size: 6, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 6, w: 16, tile: 6 },
    { dx: 0, dy: 0, size: 6, w: 16, tile: 12 },
    { dx: 0, dy: 0, size: 4, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 4, w: 16, tile: 2 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 0 },
    { dx: 32, dy: 0, size: 15, w: 32, tile: 16 },
    { dx: 0, dy: 32, size: 13, w: 32, tile: 32 },
    { dx: 32, dy: 32, size: 13, w: 32, tile: 40 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 48 },
    { dx: 32, dy: 0, size: 15, w: 32, tile: 64 },
    { dx: 0, dy: 32, size: 13, w: 32, tile: 80 },
    { dx: 32, dy: 32, size: 13, w: 32, tile: 88 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 0 },
    { dx: 0, dy: 0, size: 12, w: 32, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 0 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 0 },
    { dx: 32, dy: 0, size: 7, w: 16, tile: 16 },
    { dx: 8, dy: 32, size: 9, w: 24, tile: 24 },
    { dx: 32, dy: 32, size: 4, w: 16, tile: 30 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 32 },
    { dx: 32, dy: 0, size: 7, w: 16, tile: 48 },
    { dx: 8, dy: 32, size: 9, w: 24, tile: 56 },
    { dx: 32, dy: 32, size: 4, w: 16, tile: 62 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 0 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 0 },
    { dx: 0, dy: 0, size: 7, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 7, w: 16, tile: 8 },
    { dx: 0, dy: 0, size: 14, w: 32, tile: 0 },
    { dx: 0, dy: 0, size: 14, w: 32, tile: 12 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 0 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 1 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 2 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 3 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 4 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 5 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 6 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 7 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 8 },
    { dx: 0, dy: 0, size: 0, w: 8, tile: 9 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 8 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 12 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 16 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 20 },
    { dx: 0, dy: 0, size: 13, w: 32, tile: 0 },
    { dx: 0, dy: 0, size: 13, w: 32, tile: 8 },
    { dx: 0, dy: 0, size: 13, w: 32, tile: 16 },
    { dx: 0, dy: 0, size: 3, w: 8, tile: 0 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 0 },
    { dx: 32, dy: 0, size: 15, w: 32, tile: 16 },
    { dx: 0, dy: 32, size: 15, w: 32, tile: 32 },
    { dx: 32, dy: 32, size: 15, w: 32, tile: 48 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 0 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 16 },
    { dx: 0, dy: 0, size: 11, w: 24, tile: 0 },
    { dx: 0, dy: 32, size: 8, w: 24, tile: 12 },
    { dx: 0, dy: 0, size: 11, w: 24, tile: 15 },
    { dx: 8, dy: 32, size: 4, w: 16, tile: 27 },
    { dx: 0, dy: 0, size: 11, w: 24, tile: 29 },
    { dx: 8, dy: 32, size: 4, w: 16, tile: 41 },
    { dx: 0, dy: 0, size: 10, w: 24, tile: 0 },
    { dx: 0, dy: 0, size: 10, w: 24, tile: 9 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
    { dx: 0, dy: 0, size: 9, w: 24, tile: 0 },
    { dx: 0, dy: 0, size: 9, w: 24, tile: 6 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 0 },
    { dx: 32, dy: 0, size: 7, w: 16, tile: 16 },
    { dx: 0, dy: 32, size: 13, w: 32, tile: 24 },
    { dx: 32, dy: 32, size: 5, w: 16, tile: 32 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 36 },
    { dx: 32, dy: 0, size: 7, w: 16, tile: 52 },
    { dx: 0, dy: 32, size: 13, w: 32, tile: 60 },
    { dx: 32, dy: 32, size: 5, w: 16, tile: 68 },
    { dx: 0, dy: 0, size: 15, w: 32, tile: 72 },
    { dx: 32, dy: 0, size: 7, w: 16, tile: 88 },
    { dx: 0, dy: 32, size: 13, w: 32, tile: 96 },
    { dx: 32, dy: 32, size: 5, w: 16, tile: 104 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 0 },
    { dx: 0, dy: 0, size: 5, w: 16, tile: 4 },
];
const ms_frames = [
    { piece: 0, count: 1, pal: 1, w: 32, h: 16, asset: 0 },
    { piece: 1, count: 1, pal: 1, w: 32, h: 16, asset: 0 },
    { piece: 2, count: 1, pal: 1, w: 32, h: 16, asset: 0 },
    { piece: 3, count: 1, pal: 1, w: 8, h: 8, asset: 1 },
    { piece: 4, count: 1, pal: 1, w: 8, h: 8, asset: 1 },
    { piece: 5, count: 1, pal: 1, w: 16, h: 16, asset: 2 },
    { piece: 6, count: 1, pal: 1, w: 16, h: 16, asset: 2 },
    { piece: 7, count: 1, pal: 1, w: 16, h: 16, asset: 2 },
    { piece: 8, count: 1, pal: 1, w: 16, h: 16, asset: 2 },
    { piece: 9, count: 1, pal: 1, w: 16, h: 8, asset: 3 },
    { piece: 10, count: 1, pal: 1, w: 8, h: 8, asset: 4 },
    { piece: 11, count: 1, pal: 1, w: 8, h: 8, asset: 5 },
    { piece: 12, count: 1, pal: 1, w: 8, h: 8, asset: 5 },
    { piece: 13, count: 1, pal: 1, w: 32, h: 8, asset: 6 },
    { piece: 14, count: 1, pal: 1, w: 32, h: 8, asset: 6 },
    { piece: 15, count: 1, pal: 1, w: 16, h: 32, asset: 7 },
    { piece: 16, count: 1, pal: 1, w: 16, h: 32, asset: 7 },
    { piece: 17, count: 1, pal: 1, w: 16, h: 32, asset: 7 },
    { piece: 18, count: 1, pal: 1, w: 16, h: 16, asset: 8 },
    { piece: 19, count: 1, pal: 1, w: 16, h: 16, asset: 8 },
    { piece: 20, count: 1, pal: 1, w: 16, h: 16, asset: 9 },
    { piece: 21, count: 1, pal: 1, w: 16, h: 16, asset: 9 },
    { piece: 22, count: 1, pal: 1, w: 16, h: 16, asset: 10 },
    { piece: 23, count: 1, pal: 1, w: 16, h: 16, asset: 10 },
    { piece: 24, count: 1, pal: 1, w: 16, h: 16, asset: 10 },
    { piece: 25, count: 1, pal: 1, w: 16, h: 16, asset: 10 },
    { piece: 26, count: 1, pal: 1, w: 16, h: 16, asset: 10 },
    { piece: 27, count: 1, pal: 1, w: 16, h: 16, asset: 10 },
    { piece: 28, count: 1, pal: 1, w: 32, h: 32, asset: 11 },
    { piece: 29, count: 1, pal: 1, w: 32, h: 32, asset: 11 },
    { piece: 30, count: 1, pal: 1, w: 32, h: 32, asset: 11 },
    { piece: 31, count: 1, pal: 1, w: 32, h: 32, asset: 11 },
    { piece: 32, count: 1, pal: 1, w: 32, h: 32, asset: 11 },
    { piece: 33, count: 1, pal: 1, w: 32, h: 32, asset: 11 },
    { piece: 34, count: 1, pal: 1, w: 8, h: 8, asset: 12 },
    { piece: 35, count: 1, pal: 1, w: 8, h: 8, asset: 12 },
    { piece: 36, count: 1, pal: 1, w: 8, h: 8, asset: 12 },
    { piece: 37, count: 1, pal: 1, w: 16, h: 16, asset: 13 },
    { piece: 38, count: 1, pal: 1, w: 16, h: 16, asset: 13 },
    { piece: 39, count: 1, pal: 1, w: 32, h: 8, asset: 14 },
    { piece: 40, count: 1, pal: 1, w: 32, h: 8, asset: 14 },
    { piece: 41, count: 1, pal: 2, w: 16, h: 16, asset: 15 },
    { piece: 42, count: 1, pal: 2, w: 16, h: 16, asset: 15 },
    { piece: 43, count: 1, pal: 2, w: 16, h: 16, asset: 15 },
    { piece: 44, count: 1, pal: 2, w: 16, h: 16, asset: 15 },
    { piece: 45, count: 1, pal: 2, w: 16, h: 16, asset: 15 },
    { piece: 46, count: 1, pal: 2, w: 16, h: 16, asset: 15 },
    { piece: 47, count: 1, pal: 2, w: 16, h: 16, asset: 15 },
    { piece: 48, count: 1, pal: 2, w: 16, h: 16, asset: 15 },
    { piece: 49, count: 1, pal: 2, w: 16, h: 16, asset: 16 },
    { piece: 50, count: 1, pal: 2, w: 16, h: 16, asset: 17 },
    { piece: 51, count: 1, pal: 2, w: 16, h: 16, asset: 17 },
    { piece: 52, count: 1, pal: 2, w: 16, h: 16, asset: 17 },
    { piece: 53, count: 1, pal: 2, w: 16, h: 16, asset: 17 },
    { piece: 54, count: 1, pal: 2, w: 16, h: 16, asset: 17 },
    { piece: 55, count: 1, pal: 2, w: 16, h: 16, asset: 18 },
    { piece: 56, count: 1, pal: 2, w: 16, h: 16, asset: 18 },
    { piece: 57, count: 1, pal: 2, w: 16, h: 16, asset: 18 },
    { piece: 58, count: 1, pal: 2, w: 16, h: 16, asset: 18 },
    { piece: 59, count: 1, pal: 2, w: 32, h: 16, asset: 19 },
    { piece: 60, count: 1, pal: 2, w: 32, h: 16, asset: 19 },
    { piece: 61, count: 1, pal: 2, w: 32, h: 16, asset: 19 },
    { piece: 62, count: 1, pal: 2, w: 32, h: 16, asset: 19 },
    { piece: 63, count: 1, pal: 2, w: 8, h: 8, asset: 20 },
    { piece: 64, count: 1, pal: 2, w: 8, h: 8, asset: 20 },
    { piece: 65, count: 1, pal: 2, w: 32, h: 24, asset: 21 },
    { piece: 66, count: 1, pal: 2, w: 32, h: 24, asset: 21 },
    { piece: 67, count: 1, pal: 0, w: 16, h: 16, asset: 22 },
    { piece: 68, count: 1, pal: 0, w: 16, h: 16, asset: 22 },
    { piece: 69, count: 1, pal: 0, w: 16, h: 16, asset: 22 },
    { piece: 70, count: 1, pal: 0, w: 16, h: 16, asset: 22 },
    { piece: 71, count: 1, pal: 2, w: 32, h: 32, asset: 23 },
    { piece: 72, count: 1, pal: 2, w: 32, h: 32, asset: 23 },
    { piece: 73, count: 1, pal: 2, w: 32, h: 32, asset: 23 },
    { piece: 74, count: 1, pal: 2, w: 24, h: 24, asset: 24 },
    { piece: 75, count: 1, pal: 2, w: 24, h: 24, asset: 24 },
    { piece: 76, count: 1, pal: 2, w: 24, h: 24, asset: 24 },
    { piece: 77, count: 2, pal: 2, w: 16, h: 48, asset: 25 },
    { piece: 79, count: 2, pal: 2, w: 16, h: 48, asset: 25 },
    { piece: 81, count: 1, pal: 0, w: 8, h: 24, asset: 26 },
    { piece: 82, count: 1, pal: 0, w: 8, h: 24, asset: 26 },
    { piece: 83, count: 1, pal: 2, w: 16, h: 16, asset: 27 },
    { piece: 84, count: 1, pal: 2, w: 16, h: 16, asset: 27 },
    { piece: 85, count: 1, pal: 2, w: 16, h: 16, asset: 27 },
    { piece: 86, count: 1, pal: 2, w: 16, h: 16, asset: 27 },
    { piece: 87, count: 1, pal: 2, w: 16, h: 16, asset: 27 },
    { piece: 88, count: 1, pal: 2, w: 16, h: 16, asset: 27 },
    { piece: 89, count: 1, pal: 2, w: 24, h: 16, asset: 28 },
    { piece: 90, count: 1, pal: 2, w: 24, h: 16, asset: 28 },
    { piece: 91, count: 1, pal: 2, w: 32, h: 32, asset: 29 },
    { piece: 92, count: 1, pal: 2, w: 32, h: 32, asset: 29 },
    { piece: 93, count: 1, pal: 2, w: 32, h: 32, asset: 29 },
    { piece: 94, count: 1, pal: 2, w: 32, h: 32, asset: 29 },
    { piece: 95, count: 2, pal: 2, w: 32, h: 48, asset: 30 },
    { piece: 97, count: 2, pal: 2, w: 32, h: 48, asset: 30 },
    { piece: 99, count: 2, pal: 2, w: 32, h: 48, asset: 30 },
    { piece: 101, count: 2, pal: 2, w: 32, h: 48, asset: 30 },
    { piece: 103, count: 1, pal: 2, w: 16, h: 16, asset: 31 },
    { piece: 104, count: 1, pal: 2, w: 16, h: 16, asset: 31 },
    { piece: 105, count: 1, pal: 2, w: 16, h: 16, asset: 32 },
    { piece: 106, count: 1, pal: 2, w: 16, h: 16, asset: 32 },
    { piece: 107, count: 1, pal: 2, w: 16, h: 16, asset: 33 },
    { piece: 108, count: 1, pal: 2, w: 16, h: 16, asset: 33 },
    { piece: 109, count: 1, pal: 2, w: 16, h: 16, asset: 34 },
    { piece: 110, count: 1, pal: 2, w: 24, h: 24, asset: 35 },
    { piece: 111, count: 1, pal: 2, w: 24, h: 24, asset: 35 },
    { piece: 112, count: 1, pal: 2, w: 16, h: 16, asset: 36 },
    { piece: 113, count: 1, pal: 2, w: 16, h: 16, asset: 36 },
    { piece: 114, count: 4, pal: 2, w: 64, h: 64, asset: 37 },
    { piece: 118, count: 4, pal: 2, w: 64, h: 64, asset: 37 },
    { piece: 122, count: 4, pal: 2, w: 64, h: 64, asset: 37 },
    { piece: 126, count: 1, pal: 2, w: 32, h: 32, asset: 38 },
    { piece: 127, count: 1, pal: 2, w: 24, h: 24, asset: 39 },
    { piece: 128, count: 1, pal: 2, w: 24, h: 24, asset: 39 },
    { piece: 129, count: 1, pal: 2, w: 16, h: 24, asset: 40 },
    { piece: 130, count: 1, pal: 2, w: 16, h: 24, asset: 40 },
    { piece: 131, count: 1, pal: 2, w: 16, h: 24, asset: 40 },
    { piece: 132, count: 1, pal: 2, w: 16, h: 8, asset: 41 },
    { piece: 133, count: 1, pal: 2, w: 16, h: 8, asset: 41 },
    { piece: 134, count: 1, pal: 2, w: 16, h: 16, asset: 42 },
    { piece: 135, count: 1, pal: 2, w: 16, h: 16, asset: 42 },
    { piece: 136, count: 4, pal: 2, w: 64, h: 48, asset: 43 },
    { piece: 140, count: 4, pal: 2, w: 64, h: 48, asset: 43 },
    { piece: 144, count: 1, pal: 0, w: 32, h: 32, asset: 44 },
    { piece: 145, count: 1, pal: 0, w: 32, h: 8, asset: 45 },
    { piece: 146, count: 1, pal: 2, w: 16, h: 16, asset: 46 },
    { piece: 147, count: 1, pal: 2, w: 16, h: 16, asset: 46 },
    { piece: 148, count: 1, pal: 2, w: 32, h: 32, asset: 47 },
    { piece: 149, count: 4, pal: 2, w: 48, h: 48, asset: 48 },
    { piece: 153, count: 4, pal: 2, w: 48, h: 48, asset: 48 },
    { piece: 157, count: 1, pal: 2, w: 32, h: 32, asset: 49 },
    { piece: 158, count: 1, pal: 2, w: 32, h: 32, asset: 50 },
    { piece: 159, count: 1, pal: 2, w: 16, h: 32, asset: 51 },
    { piece: 160, count: 1, pal: 2, w: 16, h: 32, asset: 51 },
    { piece: 161, count: 1, pal: 2, w: 32, h: 24, asset: 52 },
    { piece: 162, count: 1, pal: 2, w: 32, h: 24, asset: 52 },
    { piece: 163, count: 1, pal: 1, w: 8, h: 8, asset: 53 },
    { piece: 164, count: 1, pal: 1, w: 8, h: 8, asset: 53 },
    { piece: 165, count: 1, pal: 1, w: 8, h: 8, asset: 53 },
    { piece: 166, count: 1, pal: 1, w: 8, h: 8, asset: 53 },
    { piece: 167, count: 1, pal: 1, w: 8, h: 8, asset: 53 },
    { piece: 168, count: 1, pal: 1, w: 8, h: 8, asset: 53 },
    { piece: 169, count: 1, pal: 1, w: 8, h: 8, asset: 53 },
    { piece: 170, count: 1, pal: 1, w: 8, h: 8, asset: 53 },
    { piece: 171, count: 1, pal: 1, w: 8, h: 8, asset: 53 },
    { piece: 172, count: 1, pal: 1, w: 8, h: 8, asset: 53 },
    { piece: 173, count: 1, pal: 2, w: 16, h: 16, asset: 54 },
    { piece: 174, count: 1, pal: 2, w: 16, h: 16, asset: 54 },
    { piece: 175, count: 1, pal: 2, w: 16, h: 16, asset: 54 },
    { piece: 176, count: 1, pal: 2, w: 16, h: 16, asset: 54 },
    { piece: 177, count: 1, pal: 2, w: 16, h: 16, asset: 54 },
    { piece: 178, count: 1, pal: 2, w: 16, h: 16, asset: 54 },
    { piece: 179, count: 1, pal: 2, w: 32, h: 16, asset: 55 },
    { piece: 180, count: 1, pal: 2, w: 32, h: 16, asset: 55 },
    { piece: 181, count: 1, pal: 2, w: 32, h: 16, asset: 55 },
    { piece: 182, count: 1, pal: 2, w: 8, h: 32, asset: 56 },
    { piece: 183, count: 4, pal: 1, w: 64, h: 64, asset: 57 },
    { piece: 187, count: 1, pal: 1, w: 32, h: 32, asset: 58 },
    { piece: 188, count: 1, pal: 1, w: 32, h: 32, asset: 58 },
    { piece: 189, count: 2, pal: 2, w: 24, h: 40, asset: 59 },
    { piece: 191, count: 2, pal: 2, w: 24, h: 40, asset: 59 },
    { piece: 193, count: 2, pal: 2, w: 24, h: 40, asset: 59 },
    { piece: 195, count: 0, pal: 2, w: 24, h: 40, asset: 59 },
    { piece: 195, count: 1, pal: 2, w: 24, h: 24, asset: 60 },
    { piece: 196, count: 1, pal: 2, w: 24, h: 24, asset: 60 },
    { piece: 197, count: 1, pal: 2, w: 16, h: 16, asset: 61 },
    { piece: 198, count: 1, pal: 2, w: 16, h: 16, asset: 61 },
    { piece: 199, count: 1, pal: 2, w: 24, h: 16, asset: 62 },
    { piece: 200, count: 1, pal: 2, w: 24, h: 16, asset: 62 },
    { piece: 201, count: 4, pal: 2, w: 48, h: 48, asset: 63 },
    { piece: 205, count: 4, pal: 2, w: 48, h: 48, asset: 63 },
    { piece: 209, count: 4, pal: 2, w: 48, h: 48, asset: 63 },
    { piece: 213, count: 1, pal: 2, w: 16, h: 16, asset: 64 },
    { piece: 214, count: 1, pal: 2, w: 16, h: 16, asset: 64 },
];
const song_names = ["OPENING", "VOLCANO", "BROKEN WINDOWS", "MUSHROOM!", "WATER", "BUILDING", "FLIGHT TO THE STAR", "PUWA-", "LAST BATTLE", "WINNER TAKES ALL", "STAGE CLEAR", "GAME OVER"];

let asset_tiles, stage_gfx, title_gfx, sfx_data;

function assets_bind(bin)
{
    const view = (t, off, n) => {
        switch (t) {
        case 'u8': return new Uint8Array(bin.buffer, off, n);
        case 's8': return new Int8Array(bin.buffer, off, n);
        case 'u16': return new Uint16Array(bin.buffer, off, n);
        case 's16': return new Int16Array(bin.buffer, off, n);
        case 'u32': return new Uint32Array(bin.buffer, off, n);
        default: return new Int32Array(bin.buffer, off, n);
        }
    };
    for (const name in ASSET_INDEX) {
        const [t, off, n] = ASSET_INDEX[name];
        window[name] = view(t, off, n);
    }
    asset_tiles = [at_ship, at_flame, at_option, at_shot, at_shotdiag, at_missile, at_laser, at_shield, at_capred, at_capblue, at_exsmall, at_exbig, at_spark, at_ebullet, at_beam, at_fan, at_dart, at_turret, at_walker, at_hatch, at_mini, at_crab, at_rock, at_b1core, at_b5core, at_shutter, at_icicle, at_flake, at_sled, at_cube, at_cryocore, at_cryoshard, at_spore, at_wormhead, at_wormbody, at_amoeba, at_cell, at_eyelid, at_iris, at_tentacle, at_jelly, at_fish, at_mine, at_clam, at_hivefill, at_hiverim, at_bubblet, at_geyser, at_levhead, at_levseg, at_levtail, at_block, at_cannon, at_pbeam, at_emitter, at_lcannon, at_rail, at_flarehead, at_flarebody, at_baydoors, at_pod, at_orb, at_lancer, at_zcore, at_zsat];
    sfx_data = [sfx_shot, sfx_laser, sfx_missile, sfx_hit, sfx_explode, sfx_bigexplode, sfx_capsule, sfx_powerup, sfx_die, sfx_extend, sfx_shieldhit, sfx_alarm, sfx_lasergate, sfx_lasercannon];
    stage_gfx = [
        { planeTiles: s1_ptiles, chunks: s1_chunks, nchunks: 6, map: s1_map, floor: s1_floor, ceil: s1_ceil, cols: 840, bgMap: s1_bgmap, bgRows: 32, bgSpeed: s1_bgspeed, pal: s1_pal, bossPal: s1_bosspal, assets: s1_assets, raster: 0, title: "BASALT REACH", bodyTiles: s1_body_ptiles, bodyChunks: s1_body_chunks, bodyNChunks: 5, bodyMap: s1_bodymap, bodyW: 24, bodyH: 16, rows: 52, path: s1_path, npath: 3, bgVShift: 4 },
        { planeTiles: s2_ptiles, chunks: s2_chunks, nchunks: 8, map: s2_map, floor: s2_floor, ceil: s2_ceil, cols: 820, bgMap: s2_bgmap, bgRows: 26, bgSpeed: s2_bgspeed, pal: s2_pal, bossPal: s2_bosspal, assets: s2_assets, raster: 0, title: "GLACIER VEIL", bodyTiles: s2_body_ptiles, bodyChunks: s2_body_chunks, bodyNChunks: 1, bodyMap: s2_bodymap, bodyW: 22, bodyH: 20, rows: 26, path: s2_path, npath: 1, bgVShift: 0 },
        { planeTiles: s3_ptiles, chunks: s3_chunks, nchunks: 4, map: s3_map, floor: s3_floor, ceil: s3_ceil, cols: 860, bgMap: s3_bgmap, bgRows: 32, bgSpeed: s3_bgspeed, pal: s3_pal, bossPal: s3_bosspal, assets: s3_assets, raster: 0, title: "HIVE NEBULA", bodyTiles: s3_body_ptiles, bodyChunks: s3_body_chunks, bodyNChunks: 1, bodyMap: s3_bodymap, bodyW: 16, bodyH: 16, rows: 52, path: s3_path, npath: 13, bgVShift: 3 },
        { planeTiles: s4_ptiles, chunks: s4_chunks, nchunks: 6, map: s4_map, floor: s4_floor, ceil: s4_ceil, cols: 860, bgMap: s4_bgmap, bgRows: 26, bgSpeed: s4_bgspeed, pal: s4_pal, bossPal: s4_bosspal, assets: s4_assets, raster: 1, title: "SUNKEN ARCHIVE", bodyTiles: s4_body_ptiles, bodyChunks: s4_body_chunks, bodyNChunks: 6, bodyMap: s4_bodymap, bodyW: 22, bodyH: 22, rows: 26, path: s4_path, npath: 1, bgVShift: 0 },
        { planeTiles: s5_ptiles, chunks: s5_chunks, nchunks: 6, map: s5_map, floor: s5_floor, ceil: s5_ceil, cols: 904, bgMap: s5_bgmap, bgRows: 32, bgSpeed: s5_bgspeed, pal: s5_pal, bossPal: s5_bosspal, assets: s5_assets, raster: 0, title: "IRON CITADEL", bodyTiles: s5_body_ptiles, bodyChunks: s5_body_chunks, bodyNChunks: 3, bodyMap: s5_bodymap, bodyW: 24, bodyH: 12, rows: 104, path: s5_path, npath: 3, bgVShift: 4 },
        { planeTiles: s6_ptiles, chunks: s6_chunks, nchunks: 8, map: s6_map, floor: s6_floor, ceil: s6_ceil, cols: 1726, bgMap: s6_bgmap, bgRows: 26, bgSpeed: s6_bgspeed, pal: s6_pal, bossPal: s6_bosspal, assets: s6_assets, raster: 0, title: "ZENITH GATE", bodyTiles: s6_body_ptiles, bodyChunks: s6_body_chunks, bodyNChunks: 1, bodyMap: s6_bodymap, bodyW: 22, bodyH: 22, rows: 26, path: s6_path, npath: 1, bgVShift: 0 },
    ];
    title_gfx = { planeTiles: title_ptiles, chunks: title_chunks, nchunks: 4, map: null, floor: null, ceil: null, cols: 0, bgMap: title_bgmap, bgRows: 28, bgSpeed: title_bgspeed, pal: title_pal, bossPal: s1_bosspal, assets: null, raster: 0, title: "", bodyTiles: null, bodyChunks: null, bodyNChunks: 0, bodyMap: null, bodyW: 0, bodyH: 0, rows: 26, path: null, npath: 0, bgVShift: 0 };
}
