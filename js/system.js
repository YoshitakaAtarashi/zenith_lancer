// Engine services: tile and map uploads, scrolling, palettes and fades,
// the sprite list, input (keyboard, gamepad, touch), random numbers,
// saving, and the 60 Hz frame clock.
'use strict';

const s16 = (v) => (v << 16) >> 16;
const u16 = (v) => v & 0xFFFF;
const s8 = (v) => (v << 24) >> 24;
const u8 = (v) => v & 0xFF;
const TRUE = true, FALSE = false;

function divu(a, b) { return Math.floor((a >>> 0) / (b & 0xFFFF)) & 0xFFFF; }
function modu(a, b) { return ((a >>> 0) % (b & 0xFFFF)) & 0xFFFF; }
function mul16u(a, b) { return ((a & 0xFFFF) * (b & 0xFFFF)) >>> 0; }
function mul16s(a, b) { return s16(a) * s16(b); }
function abs(v) { return v < 0 ? -v : v; }
function min(a, b) { return a < b ? a : b; }
function max(a, b) { return a > b ? a : b; }
function memsetU16(arr, v, n) { arr.fill(v, 0, n); }

// ------------------------------------------------------------------ attributes
const PAL0 = 0, PAL1 = 1, PAL2 = 2, PAL3 = 3;
const TILE_USER_INDEX = 16;
const TILE_ATTR_PRIORITY_MASK = 0x8000;
function TILE_ATTR(pal, prio, vflip, hflip, index)
{
    return ((prio ? 0x8000 : 0) | (pal << 13) | (vflip ? 0x1000 : 0) | (hflip ? 0x0800 : 0) | index) & 0xFFFF;
}
function SPRITE_SIZE(w, h) { return ((w - 1) << 2) | (h - 1); }

const UP_NOW = 0, UP_LATER = 1;

// ------------------------------------------------------------------ GFX calls
function gfx_setEnable(on) { GFX.enabled = on; }
function gfx_loadTileData(data, index, num, mode, offset)
{
    screen_decodeTiles(data, offset || 0, index, num);
}
function gfx_setTileMapDataRow(plane, data, row, x, w, mode, offset)
{
    const map = GFX.planes[plane];
    const o = offset || 0;
    for (let i = 0; i < w; i++) map[(row & 31) * 64 + ((x + i) & 63)] = data[o + i];
}
function gfx_setTileMapDataColumnFast(plane, data, col, row, h, mode)
{
    const map = GFX.planes[plane];
    for (let i = 0; i < h; i++) map[((row + i) & 31) * 64 + (col & 63)] = data[i];
}
function gfx_setTileMapDataRect(plane, data, x, y, w, h, stride, mode)
{
    const map = GFX.planes[plane];
    for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++)
            map[((y + j) & 31) * 64 + ((x + i) & 63)] = data[j * stride + i];
}
function gfx_fillTileMapRect(plane, value, x, y, w, h)
{
    const map = GFX.planes[plane];
    for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++)
            map[((y + j) & 31) * 64 + ((x + i) & 63)] = value;
}
function gfx_clearTileMapRect(plane, x, y, w, h) { gfx_fillTileMapRect(plane, 0, x, y, w, h); }
function gfx_clearPlane(plane, wait) { GFX.planes[plane].fill(0); }
function gfx_setScrollingMode(h, v) { GFX.hmode = h; }
function gfx_setVerticalScroll(plane, v) { GFX.vscroll[plane] = s16(v); GFX.pendingVScroll[plane] = null; }
function gfx_setVerticalScrollVSync(plane, v) { GFX.pendingVScroll[plane] = s16(v); }
function gfx_setHorizontalScrollTile(plane, tile, values, len, mode)
{
    const t = GFX.hscroll[plane];
    for (let i = 0; i < len; i++)
    {
        const line = (tile + i) * 8;
        if (line < 224) t[line] = values[i];
    }
}
function gfx_setHorizontalScrollLine(plane, line, values, len, mode)
{
    const t = GFX.hscroll[plane];
    for (let i = 0; i < len && line + i < 224; i++) t[line + i] = values[i];
}
function gfx_setWindowVPos(down, row) { GFX.winRow = down ? row : 32; }
function gfx_setWindowOff() { GFX.winRow = 32; }
function gfx_setHilightShadow(on) { GFX.shadow = !!on; }
function gfx_setBackgroundColor(i) { }

const spriteCache = new Uint16Array(80 * 4);
function gfx_updateSprites(n, mode)
{
    GFX.sat.set(spriteCache.subarray(0, n * 4));
    if (n < 80) GFX.sat[(n - 1) * 4 + 1] &= 0xFF00;   // the last links to 0
}

// ------------------------------------------------------------------ palettes
const palette_black = new Uint16Array(64);
const fade = { on: false, from: new Float32Array(192), to: new Float32Array(192), n: 0, k: 0, first: 0, count: 0 };

function pal_setColors(index, src, count, mode, offset)
{
    const o = offset || 0;
    for (let i = 0; i < count; i++) GFX.colors[(index + i) & 63] = src[o + i];
}
function pal_setColor(index, c) { GFX.colors[index & 63] = c; }
function pal_getColor(index) { return GFX.colors[index & 63]; }

function palFade(first, count, fromPal, toPal, frames, async)
{
    fade.first = first;
    fade.count = count;
    for (let i = 0; i < count; i++)
    {
        const f = fromPal[i], t = toPal[i];
        for (let c = 0; c < 3; c++)
        {
            fade.from[i * 3 + c] = (f >> (1 + c * 4)) & 7;
            fade.to[i * 3 + c] = (t >> (1 + c * 4)) & 7;
        }
    }
    fade.n = frames > 0 ? frames : 1;
    fade.k = 0;
    fade.on = true;
    if (!async) return pal_waitFade();
    return Promise.resolve();
}

function palFadeStep()
{
    if (!fade.on) return;
    fade.k++;
    const k = fade.k, n = fade.n;
    for (let i = 0; i < fade.count; i++)
    {
        let v = 0;
        for (let c = 0; c < 3; c++)
        {
            const f = fade.from[i * 3 + c], t = fade.to[i * 3 + c];
            const x = k >= n ? t : Math.round(f + (t - f) * k / n);
            v |= x << (1 + c * 4);
        }
        GFX.colors[(fade.first + i) & 63] = v;
    }
    if (k >= n) fade.on = false;
}

async function pal_waitFade()
{
    while (fade.on) await nextFrame();
}
function pal_isDoingFade() { return fade.on; }
function pal_interruptFade()
{
    fade.on = false;
}
function pal_fadeInAll(pal, frames, async) { return palFade(0, 64, palette_black, pal, frames, async); }
function pal_fadeOutAll(frames, async) { return palFade(0, 64, GFX.colors.slice(), palette_black, frames, async); }
function pal_fadeToAll(pal, frames, async) { return palFade(0, 64, GFX.colors.slice(), pal, frames, async); }

// ------------------------------------------------------------------ random
let randbase = 0xD94B;
let randStep = 0;
function setRandomSeed(seed) { randbase = (seed ^ 0xD94B) & 0xFFFF; }
function random()
{
    randStep = (randStep + 37) & 0xFF;
    randbase ^= (randbase >> 1) ^ randStep;
    randbase ^= (randbase << 1) & 0xFFFF;
    randbase &= 0xFFFF;
    return randbase;
}

// ------------------------------------------------------------------ pad
const BUTTON_UP = 0x0001, BUTTON_DOWN = 0x0002, BUTTON_LEFT = 0x0004, BUTTON_RIGHT = 0x0008;
const BUTTON_B = 0x0010, BUTTON_C = 0x0020, BUTTON_A = 0x0040, BUTTON_START = 0x0080;
const PAD_1 = 0;

const input = {
    keys: 0,        // from the keyboard
    touch: 0,       // from the on-screen pad
    map: {
        ArrowUp: BUTTON_UP, ArrowDown: BUTTON_DOWN, ArrowLeft: BUTTON_LEFT, ArrowRight: BUTTON_RIGHT,
        KeyW: BUTTON_UP, KeyS: BUTTON_DOWN, KeyA: BUTTON_LEFT, KeyD: BUTTON_RIGHT,
        KeyZ: BUTTON_A, KeyJ: BUTTON_A, Space: BUTTON_A,
        KeyX: BUTTON_B, KeyK: BUTTON_B,
        KeyC: BUTTON_C, KeyL: BUTTON_C,
        Enter: BUTTON_START, Escape: BUTTON_START, KeyP: BUTTON_START,
    },
};

function pad_init()
{
    window.addEventListener('keydown', (e) => {
        const b = input.map[e.code];
        if (b === undefined) return;
        input.keys |= b;
        e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
        const b = input.map[e.code];
        if (b === undefined) return;
        input.keys &= ~b;
        e.preventDefault();
    });
    window.addEventListener('blur', () => { input.keys = 0; input.touch = 0; });
}

function readGamepads()
{
    let s = 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads)
    {
        if (!p) continue;
        const b = (i) => p.buttons[i] && p.buttons[i].pressed;
        const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
        if (b(12) || ay < -0.5) s |= BUTTON_UP;
        if (b(13) || ay > 0.5) s |= BUTTON_DOWN;
        if (b(14) || ax < -0.5) s |= BUTTON_LEFT;
        if (b(15) || ax > 0.5) s |= BUTTON_RIGHT;
        if (b(2) || b(0)) s |= BUTTON_A;         // X / A (bottom, left face buttons): shot
        if (b(1) || b(3)) s |= BUTTON_B;         // B / Y: power up
        if (b(5) || b(7)) s |= BUTTON_C;         // R1 / R2: shot
        if (b(9) || b(8)) s |= BUTTON_START;
    }
    return s;
}

function pad_read(joy)
{
    return input.keys | input.touch | readGamepads();
}

const SAVE_KEY = 'zenith-lancer-save';
let saveBuf = null;
function saveLoad()
{
    if (saveBuf) return;
    saveBuf = new Uint8Array(64);
    try
    {
        const s = localStorage.getItem(SAVE_KEY);
        if (s) { const a = JSON.parse(s); for (let i = 0; i < a.length && i < 64; i++) saveBuf[i] = a[i]; }
    }
    catch (e) { }
}
function save_enable() { saveLoad(); }
function save_enableRO() { saveLoad(); }
function save_disable()
{
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(Array.from(saveBuf))); } catch (e) { }
}
function save_readByte(i) { saveLoad(); return saveBuf[i]; }
function save_writeByte(i, v) { saveLoad(); saveBuf[i] = v & 0xFF; }

const FRAME_MS = 1000 / 59.9227;
const clock = { waiting: null, acc: 0, last: 0, paused: false, onFrame: null };

function nextFrame()
{
    for (let p = 0; p < 2; p++)
        if (GFX.pendingVScroll[p] !== null) { GFX.vscroll[p] = GFX.pendingVScroll[p]; GFX.pendingVScroll[p] = null; }
    palFadeStep();
    return new Promise((resolve) => { clock.waiting = resolve; });
}

function clock_start()
{
    const tick = async (now) => {
        requestAnimationFrame(tick);
        if (!clock.last) clock.last = now;
        let dt = now - clock.last;
        clock.last = now;
        if (dt > 100) dt = FRAME_MS;            // a background tab: don't race to catch up
        clock.acc += dt;
        if (clock.paused) { clock.acc = 0; return; }
        // at most two game frames per display frame (a 30 Hz display)
        let runs = 0;
        while (clock.acc >= FRAME_MS - 2 && runs < 2 && clock.waiting)
        {
            clock.acc -= FRAME_MS;
            runs++;
            const w = clock.waiting;
            clock.waiting = null;
            w();
            for (let i = 0; i < 50 && !clock.waiting; i++) await null;
        }
        if (clock.acc > FRAME_MS * 2) clock.acc = 0;
        if (runs) screen_render();
    };
    requestAnimationFrame(tick);
}
