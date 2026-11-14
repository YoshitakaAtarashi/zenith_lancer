// The display: tiles, two scrolling planes and a window, 80 sprites,
// a 64-colour palette. Drawn once a frame into a 320x224 canvas.
'use strict';

const GFX = {
    tiles: new Uint8Array(2048 * 64),   // decoded pixels (colour index 0..15)
    planes: [new Uint16Array(64 * 32), new Uint16Array(64 * 32), new Uint16Array(64 * 32)],  // A, B, window
    colors: new Uint16Array(64),
    hscroll: [new Int16Array(224), new Int16Array(224)],    // A, B: entry per line
    vscroll: [0, 0],
    vscrollCol: [new Int16Array(20), new Int16Array(20)],   // A, B: per 16 px column (VSCROLL_COLUMN)
    hmode: 0,               // 0 plane, 2 tile (8-line rows), 3 line
    vmode: 0,               // 0 plane, 1 column
    winRow: 32,             // first window row (32 = off)
    sat: new Uint16Array(80 * 4),       // y, size_link, attr, x
    shadow: false,
    enabled: true,
    pendingVScroll: [null, null],
};

const BG_A = 0, BG_B = 1, WINDOW = 2;
const HSCROLL_PLANE = 0, HSCROLL_TILE = 2, HSCROLL_LINE = 3;
const VSCROLL_PLANE = 0, VSCROLL_COLUMN = 1;

const COLOR_LEVELS = [0, 52, 87, 116, 144, 172, 206, 255];

function screen_decodeTiles(src, srcOff, vt, n)
{
    const t = GFX.tiles;
    let o = (vt & 2047) * 64;
    const end = srcOff + n * 8;
    for (let i = srcOff; i < end; i++)
    {
        const v = src[i];
        t[o]     = (v >>> 28) & 15;
        t[o + 1] = (v >>> 24) & 15;
        t[o + 2] = (v >>> 20) & 15;
        t[o + 3] = (v >>> 16) & 15;
        t[o + 4] = (v >>> 12) & 15;
        t[o + 5] = (v >>> 8) & 15;
        t[o + 6] = (v >>> 4) & 15;
        t[o + 7] = v & 15;
        o += 8;
        if (o >= 2048 * 64) o = 0;
    }
}

// ------------------------------------------------------------------ render

const screenOut = {
    canvas: null, ctx: null, img: null, px: null,
    rgb: new Uint32Array(64), rgbShadow: new Uint32Array(64),
};

function screen_attach(canvas)
{
    screenOut.canvas = canvas;
    screenOut.ctx = canvas.getContext('2d', { alpha: false });
    screenOut.img = screenOut.ctx.createImageData(320, 224);
    screenOut.px = new Uint32Array(screenOut.img.data.buffer);
}

function rgbOf(c, shade)
{
    let r = COLOR_LEVELS[(c >> 1) & 7], g = COLOR_LEVELS[(c >> 5) & 7], b = COLOR_LEVELS[(c >> 9) & 7];
    if (shade) { r >>= 1; g >>= 1; b >>= 1; }
    return (0xFF000000 | (b << 16) | (g << 8) | r) >>> 0;
}

// line buffers: colour index (0..63) or -1, and priority
const lbB = new Int16Array(320), lbA = new Int16Array(320), lbS = new Int16Array(320);
const lpB = new Uint8Array(320), lpA = new Uint8Array(320), lpS = new Uint8Array(320);

function drawPlaneSpan(plane, y, buf, pri, hs, vs, x, xEnd)
{
    const map = GFX.planes[plane];
    const tiles = GFX.tiles;
    const py = (y + vs) & 255;
    const row = (py >> 3) * 64;
    const ty = py & 7;
    let px = (x - hs) & 511;
    while (x < xEnd)
    {
        const cell = map[row + (px >> 3)];
        const idx = cell & 2047;
        const pal = (cell >> 9) & 0x30;
        const p = cell >> 15;
        const ry = (cell & 0x1000) ? 7 - ty : ty;
        const base = idx * 64 + ry * 8;
        const hf = cell & 0x0800;
        for (let tx = px & 7; tx < 8 && x < xEnd; tx++, x++)
        {
            const c = tiles[base + (hf ? 7 - tx : tx)];
            buf[x] = c ? pal | c : -1;
            pri[x] = p;
        }
        px = (px + 8 - (px & 7)) & 511;
    }
}

function drawPlaneLine(plane, y, buf, pri, hs, vs)
{
    if (GFX.vmode !== VSCROLL_COLUMN) { drawPlaneSpan(plane, y, buf, pri, hs, vs, 0, 320); return; }
    // each 16 px screen column has its own vertical scroll
    const vc = GFX.vscrollCol[plane];
    for (let k = 0; k < 20; k++) drawPlaneSpan(plane, y, buf, pri, hs, vc[k], k * 16, k * 16 + 16);
}

function drawWindowLine(y, buf, pri)
{
    const map = GFX.planes[WINDOW];
    const tiles = GFX.tiles;
    const row = (y >> 3) * 64;
    const ty = y & 7;
    for (let cx = 0; cx < 40; cx++)
    {
        const cell = map[row + cx];
        const idx = cell & 2047;
        const pal = (cell >> 9) & 0x30;
        const p = cell >> 15;
        const ry = (cell & 0x1000) ? 7 - ty : ty;
        const base = idx * 64 + ry * 8;
        const hf = cell & 0x0800;
        for (let tx = 0; tx < 8; tx++)
        {
            const c = tiles[base + (hf ? 7 - tx : tx)];
            const x = cx * 8 + tx;
            buf[x] = c ? pal | c : -1;
            pri[x] = p;
        }
    }
}

// sprites in link order, resolved once per frame
const sprOrder = new Int16Array(80);
let sprOrderN = 0;

function buildSpriteOrder()
{
    const sat = GFX.sat;
    let i = 0;
    sprOrderN = 0;
    for (let k = 0; k < 80; k++)
    {
        sprOrder[sprOrderN++] = i;
        const link = sat[i * 4 + 1] & 0x7F;
        if (link === 0 || link >= 80) break;
        i = link;
    }
}

function drawSpriteLine(y)
{
    lbS.fill(-1);
    const sat = GFX.sat, tiles = GFX.tiles;
    let count = 0, dots = 0;
    for (let k = 0; k < sprOrderN; k++)
    {
        const o = sprOrder[k] * 4;
        const sy = (sat[o] & 0x1FF) - 128;
        const size = sat[o + 1] >> 8;
        const h = (size & 3) + 1, w = ((size >> 2) & 3) + 1;
        if (y < sy || y >= sy + h * 8) continue;
        if (++count > 20) break;            // 20 sprites a line
        const attr = sat[o + 2];
        const sx = (sat[o + 3] & 0x1FF) - 128;
        const pal = (attr >> 9) & 0x30;
        const p = attr >> 15;
        const vf = attr & 0x1000, hf = attr & 0x0800;
        let ly = y - sy;
        if (vf) ly = h * 8 - 1 - ly;
        const cy = ly >> 3, ty = ly & 7;
        const tile0 = attr & 2047;
        for (let cx = 0; cx < w; cx++)
        {
            if (dots >= 320) break;         // 320 sprite pixels a line
            dots += 8;
            const tcx = hf ? w - 1 - cx : cx;
            const base = ((tile0 + tcx * h + cy) & 2047) * 64 + ty * 8;
            for (let tx = 0; tx < 8; tx++)
            {
                const x = sx + cx * 8 + tx;
                if (x < 0 || x >= 320 || lbS[x] >= 0) continue;
                const c = tiles[base + (hf ? 7 - tx : tx)];
                if (!c) continue;
                lbS[x] = pal | c;
                lpS[x] = p;
            }
        }
    }
}

function screen_render()
{
    const out = screenOut.px;
    if (!out) return;
    const rgb = screenOut.rgb, rgbS = screenOut.rgbShadow;
    for (let i = 0; i < 64; i++)
    {
        rgb[i] = rgbOf(GFX.colors[i], false);
        rgbS[i] = rgbOf(GFX.colors[i], true);
    }
    if (!GFX.enabled)
    {
        out.fill(rgb[0]);
        screenOut.ctx.putImageData(screenOut.img, 0, 0);
        return;
    }
    buildSpriteOrder();
    const shadow = GFX.shadow;
    const bgc = rgb[0];
    for (let y = 0; y < 224; y++)
    {
        const hl = GFX.hmode === HSCROLL_LINE ? y : GFX.hmode === HSCROLL_TILE ? y & ~7 : 0;
        drawPlaneLine(BG_B, y, lbB, lpB, GFX.hscroll[1][hl], GFX.vscroll[1]);
        if ((y >> 3) >= GFX.winRow) drawWindowLine(y, lbA, lpA);
        else drawPlaneLine(BG_A, y, lbA, lpA, GFX.hscroll[0][hl], GFX.vscroll[0]);
        drawSpriteLine(y);
        const o = y * 320;
        for (let x = 0; x < 320; x++)
        {
            const b = lbB[x], a = lbA[x], s = lbS[x];
            let c = -1, isSpr = false;
            // back to front: B low, A low, S low, B high, A high, S high
            if (s >= 0 && lpS[x]) { c = s; isSpr = true; }
            else if (a >= 0 && lpA[x]) c = a;
            else if (b >= 0 && lpB[x]) c = b;
            else if (s >= 0) { c = s; isSpr = true; }
            else if (a >= 0) c = a;
            else if (b >= 0) c = b;
            if (shadow && !lpA[x] && !lpB[x] && !(isSpr && lpS[x]))
                out[o + x] = c >= 0 ? rgbS[c] : rgbS[0];
            else
                out[o + x] = c >= 0 ? rgb[c] : bgc;
        }
    }
    screenOut.ctx.putImageData(screenOut.img, 0, 0);
}
