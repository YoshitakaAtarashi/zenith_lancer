// The game's shared state and constants.
'use strict';

// Positions are 12.4 fixed point screen pixels.
const FP = (v) => s16(v << 4);
const PX = (v) => v >> 4;

// ------------------------------------------------------------------ input (main.js)
let padHeld = 0, padPressed = 0;
const BTN_FIRE = BUTTON_A | BUTTON_C;
const BTN_POWER = BUTTON_B;

// ------------------------------------------------------------------ player (player.js)
const MAX_OPTIONS = 4;
const TRAIL_LEN = 64;
const OPT_SPACING = 14;
const WPN_NORMAL = 0, WPN_DOUBLE = 1, WPN_LASER = 2;
const G_SPEED = 0, G_MISSILE = 1, G_DOUBLE = 2, G_LASER = 3, G_OPTION = 4, G_FORCE = 5, G_NUM = 6;

const pl = {
    x: 0, y: 0,          // centre, fixed point
    alive: false,
    deadTimer: 0,
    invuln: 0,
    speedLv: 0,          // 0..5
    missile: false,
    weapon: 0,
    options: 0,
    force: 0,            // barrier hit points, 0 = none
    gauge: -1,           // highlighted gauge slot, -1 = none
    tilt: 0,             // -1 up, 0 level, 1 down
    fireTimer: 0,
    anim: 0,
};
const optX = new Int16Array(MAX_OPTIONS), optY = new Int16Array(MAX_OPTIONS);   // screen px

// AUTO PLAY (autoplay.js): 0 off, 1 novice, 2 normal, 3 expert
let autoPlay = 0;
let demoPlay = false;    // the title's demo (main.js): AUTO PLAY, labelled DEMO PLAY

// Player shots, read by the collision code.
const MAX_SHOTS = 28;
const SH_NONE = 0, SH_SHOT = 1, SH_DIAG = 2, SH_LASER = 3, SH_MISSILE = 4;
const shots = Array.from({ length: MAX_SHOTS }, () => ({
    type: 0,
    src: 0,              // 0 = ship, 1.. = option
    state: 0,
    hitId: 0,            // last enemy pierced (lasers)
    x: 0, y: 0, vx: 0, vy: 0,    // fixed point
    spr: 0,              // its sprite in this frame's staged list
}));

// ------------------------------------------------------------------ enemies (enemy.js)
const MAX_ENEMIES = 24;
const EN_NONE = 0, EN_FAN = 1, EN_DART = 2, EN_TURRET = 3, EN_WALKER = 4, EN_HATCH = 5, EN_MINI = 6,
    EN_ROCK = 7, EN_CRAB = 8, EN_VOLCANO = 9,
    EN_ICICLE = 10, EN_FLAKE = 11, EN_SLED = 12,
    EN_SPORE = 13, EN_WORM = 14, EN_AMOEBA = 15, EN_CELL = 16,
    EN_JELLY = 17, EN_FISH = 18, EN_MINE = 19,
    EN_BLOCK = 20, EN_CANNON = 21,
    EN_ORB = 22, EN_LANCER = 23;
const EF_CARRIER = 0x01;   // drops a capsule
const EF_CEIL = 0x02;      // ground unit hanging from the ceiling
const EF_GROUND = 0x04;    // scrolls with the terrain
const EF_NOSHOT = 0x08;    // immune to shots (spawners)
const EF_FIXEDY = 0x10;    // scrolls with the terrain but at the script's height

const enemies = Array.from({ length: MAX_ENEMIES }, (_, i) => ({
    type: 0, flags: 0,
    group: 0,            // formation id, 0 = none
    id: i,
    x: 0, y: 0, vx: 0, vy: 0,    // fixed point
    hp: 0,
    t: 0,
    a: 0, b: 0,          // behaviour scratch
    hw: 0, hh: 0,        // half hitbox, px
    flash: 0,
    score: 0,
    cd: 0,               // fire countdown
}));

// Enemy bullets, beams, capsules
const MAX_EBULLETS = 32;   // power of two (the draw loop masks with it)
const MAX_BEAMS = 8;
const MAX_CAPS = 6;
const eb = Array.from({ length: MAX_EBULLETS }, () => ({ on: false, dir: 0, x: 0, y: 0, vx: 0, vy: 0 }));
const beams = Array.from({ length: MAX_BEAMS }, () => ({ on: false, x: 0, y: 0, vx: 0, len: 0 }));
const caps = Array.from({ length: MAX_CAPS }, () => ({ on: false, blue: false, x: 0, y: 0, t: 0 }));

// ------------------------------------------------------------------ boss (boss.js)
const B_OFF = 0, B_ENTER = 1, B_FIGHT = 2, B_DYING = 3, B_LEAVE = 4, B_DONE = 5;
const BOSS_PARTS = 12;
// Shared state for whichever boss is on screen. Each boss file reads and
// writes it freely; the scratch arrays mean different things per boss.
const boss = {
    state: 0,
    killed: false,
    x: 0, y: 0,          // anchor, px
    vx: 0, vy: 0,
    t: 0,                // frames in the current state
    age: 0,              // frames since it came (and its song began)
    timeLimit: 0,        // frames from then: in B_FIGHT past this, it leaves
    hp: 0,               // the weak point
    flash: 0,            // weak point hit flash
    phase: 0,
    partHp: new Int16Array(BOSS_PARTS),
    partX: new Int16Array(BOSS_PARTS), partY: new Int16Array(BOSS_PARTS),
    partFlash: new Uint8Array(BOSS_PARTS),
    a: 0, b: 0, c: 0,
    bodyX: 0, bodyY: 0,  // body position for a def with bodySelf
    hp0: 0,              // the weak point's health at the start (after scaling)
};
// screen box the boss can occupy this frame (x0, y0, x1, y1); x0 > x1 = none
const bossBox = new Int16Array([1, 0, 0, 0]);

// ------------------------------------------------------------------ game (game.js)
let score = 0, hiScore = 50000;
let lives = 0;
let frameCount = 0;      // u16
let loopNum = 0;         // second loop and beyond are harder
let curStage = 0;
let optContinue = 0, optInvincible = 0, optStartStage = 0;
let cheatInvincible = false;
const GAME_OVER = 0, GAME_RUN = 1, GAME_ENDING = 2;

// ------------------------------------------------------------------ hud (hud.js)
let playBottom = 0;      // lowest y the ship may fly to (px)

// ------------------------------------------------------------------ stage (stage.js)
const NO_FLOOR = 208;
const NO_CEIL = 0;
let cameraX = 0;         // camera position in world pixels (left edge of the screen)
let scrollSpeed = 0;     // 1/16 px per frame (16 = 1 px)
let scrollTarget = 0;    // speed the scroll eases toward (EV_SPEED sets it)
let scrollStep = 0;      // pixels the camera moved this frame
let stageNum = 0;        // current stage, 0-based
let terrFloor = null, terrCeil = null;
let terrW = 0;           // terrain width in px
let stageOpen = false;   // the screen is past the end of the terrain (boss arenas)
let bossDim = false;

// Terrain heights at a world x (pixels).
function stage_floorAt(wx) { return (wx >= 0 && wx < terrW) ? terrFloor[wx] : NO_FLOOR; }
function stage_ceilAt(wx) { return (wx >= 0 && wx < terrW) ? terrCeil[wx] : NO_CEIL; }
// Screen-space point inside rock?
function stage_solid(sx, sy)
{
    const wx = cameraX + sx;
    if (wx < 0 || wx >= terrW) return sy >= NO_FLOOR || sy < NO_CEIL;
    return sy >= terrFloor[wx] || sy < terrCeil[wx];
}

// ------------------------------------------------------------------ video (video.js)
const VT_FONT = TILE_USER_INDEX;
const SCREEN_W = 320;
const PLAY_H = 208;       // playfield height; the HUD window covers the rest
const SF_HFLIP = 0x01;
const SF_VFLIP = 0x02;
const SF_PAL_OVR = 0x04;  // use the palette in bits 4-5 instead of the frame's
const SF_PAL = (p) => SF_PAL_OVR | (p << 4);
const assetVram = new Uint16Array(NUM_ASSETS);
let sprN = 0;
let sprPrio = 0;          // 0, or the priority bit while shadow/highlight is on

// ------------------------------------------------------------------ sound ids (sound.js)
const SFX_SHOT = 0, SFX_LASER = 1, SFX_MISSILE = 2, SFX_HIT = 3, SFX_EXPLODE = 4, SFX_BIGEXPLODE = 5,
    SFX_CAPSULE = 6, SFX_POWERUP = 7, SFX_DIE = 8, SFX_EXTEND = 9, SFX_SHIELDHIT = 10, SFX_ALARM = 11,
    SFX_COUNT = 12;
const MUS_NONE = 0;
