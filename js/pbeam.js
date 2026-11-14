// Lasers drawn on plane A: gates between roof and deck, barriers across a
// shaft, the long beam of a laser cannon. A beam is a bar of plane cells
// anchored in the world (it scrolls with the terrain for free), so a beam
// the width of the screen costs no sprites at all. Its owner (an enemy,
// enemy.js) sets its state and extent; this file paints the cells when the
// look changes, patches the terrain columns and rows streamed in under it,
// and kills the ship it touches.
'use strict';
(function () {

// what each beam's cells show now (to repaint only on a change)
const drawn = Array.from({ length: MAX_PBEAMS }, () => ({ state: 0, phase: 0, c0: 0, c1: 0, r0: 0, r1: 0 }));
let tileBase = 0;           // first VRAM tile of the beam tiles
let phaseT = 0;

const T_HEDGE = 0, T_HCORE = 2, T_HWARN = 4, T_V = 5;

// The beams shimmer and the warnings blink by changing the few tiles all
// their cells share (frames 0, 2, 4 and 5, 7, 9 of the pbeam asset take
// the data of their phase), not the cells.
const zeroTile = new Uint32Array(8);
function tilePhase(ph)
{
    const src = asset_tiles[AS_PBEAM];
    for (let v = 0; v <= T_V; v += T_V)
    {
        gfx_loadTileData(src, tileBase + v + T_HEDGE, 1, UP_LATER, (v + T_HEDGE + (ph & 1)) << 3);
        gfx_loadTileData(src, tileBase + v + T_HCORE, 1, UP_LATER, (v + T_HCORE + (ph & 1)) << 3);
        if (ph & 2) gfx_loadTileData(src, tileBase + v + T_HWARN, 1, UP_LATER, (v + T_HWARN) << 3);
        else gfx_loadTileData(zeroTile, tileBase + v + T_HWARN, 1, UP_LATER, 0);
    }
}

function pbeam_init()
{
    for (let i = 0; i < MAX_PBEAMS; i++) { pbeams[i].used = false; drawn[i].state = PB_OFF; }
    pbeamCount = 0;
    tileBase = assetVram[AS_PBEAM];
}

function pbeam_new(vert, thick)
{
    for (let i = 0; i < MAX_PBEAMS; i++)
    {
        const b = pbeams[i];
        if (b.used) continue;
        b.state = 0; b.c0 = b.c1 = b.r0 = b.r1 = 0;
        b.used = true;
        b.idx = i;
        b.vert = vert;
        b.thick = thick;
        drawn[i].state = PB_OFF;
        pbeamCount++;
        return b;
    }
    return null;
}

// The cell a beam shows k cells across its thickness (0 = top or left).
function cellFor(b, state, ph, k)
{
    const v = b.vert ? T_V : 0;
    const last = b.thick - 1;
    if (state === PB_WARN)
    {
        // a thin blinking sight line down the middle (the blink is in the tile)
        const mid = b.thick >> 1;
        if (k === mid - 1) return TILE_ATTR(PAL1, 0, 0, 0, tileBase + v + T_HWARN);
        if (k === mid) return TILE_ATTR(PAL1, 0, !b.vert, b.vert, tileBase + v + T_HWARN);
        return 0;
    }
    const t = (k === 0 || k === last) ? T_HEDGE : T_HCORE;
    const flip = k === last && last;
    return TILE_ATTR(PAL1, 0, flip && !b.vert, flip && b.vert, tileBase + v + t);
}

// Paints (or, with state PB_OFF, restores the terrain of) the beam's cells
// that plane A holds.
function paint(b, state, ph, c0, c1, r0, r1)
{
    if (b.vert)
        for (let c = c0; c < c1; c++)
            stage_paintCol(c, r0, r1, state === PB_OFF ? 0xFFFF : cellFor(b, state, ph, c - c0));
    else
        for (let r = r0; r < r1; r++)
            stage_paintRow(r, c0, c1, state === PB_OFF ? 0xFFFF : cellFor(b, state, ph, r - r0));
}

// A sight line holds only the two cells in the middle of the beam.
function paintWarn(b, c0, c1, r0, r1, off)
{
    const mid = (b.thick >> 1) - 1;
    for (let k = mid; k <= mid + 1; k++)
    {
        const cell = off ? 0xFFFF : cellFor(b, PB_WARN, 0, k);
        if (b.vert) stage_paintCol(c0 + k, r0, r1, cell);
        else stage_paintRow(r0 + k, c0, c1, cell);
    }
}

function erase(b, d)
{
    if (d.state === PB_WARN) paintWarn(b, d.c0, d.c1, d.r0, d.r1, true);
    else if (d.state !== PB_OFF) paint(b, PB_OFF, 0, d.c0, d.c1, d.r0, d.r1);
}

function pbeam_free(b)
{
    if (!b || !b.used) return;
    b.state = PB_OFF;
    const d = drawn[b.idx];
    erase(b, d);
    d.state = PB_OFF;
    b.used = false;
    pbeamCount--;
}

function pbeam_clear()
{
    for (let i = 0; i < MAX_PBEAMS; i++)
        if (pbeams[i].used) pbeam_free(pbeams[i]);
}

// After the owners have moved: repaint what changed, then the ship.
function pbeam_update()
{
    if (!pbeamCount) return;
    phaseT = (phaseT + 1) & 0xFFFF;
    const ph = (phaseT >> 2) & 3;
    if ((phaseT & 3) === 0) tilePhase(ph);
    for (let i = 0; i < MAX_PBEAMS; i++)
    {
        const b = pbeams[i];
        if (!b.used) continue;
        const d = drawn[i];
        const p = 0;
        const same = d.c0 === b.c0 && d.c1 === b.c1 && d.r0 === b.r0 && d.r1 === b.r1;
        if (d.state === b.state && (b.state === PB_OFF || (same && d.phase === p))) continue;
        if (d.state === b.state && d.phase === p && b.c0 < d.c0 && d.c1 === b.c1 &&
            d.r0 === b.r0 && d.r1 === b.r1 && !b.vert)
        {
            // a beam shooting out: only its new cells
            paint(b, b.state, p, b.c0, d.c0, b.r0, b.r1);
            d.c0 = b.c0;
            continue;
        }
        if (d.state === PB_ON && b.state === PB_ON && d.c1 === b.c1)
        {
            // a beam growing or giving out: only the cells that change
            if (b.vert && d.c0 === b.c0)
            {
                if (d.r0 === b.r0 && b.r1 > d.r1)
                {
                    paint(b, PB_ON, p, b.c0, b.c1, d.r1, b.r1);
                    d.r1 = b.r1;
                    continue;
                }
                if (d.r1 === b.r1 && b.r0 > d.r0)
                {
                    paint(b, PB_OFF, 0, b.c0, b.c1, d.r0, b.r0);
                    d.r0 = b.r0;
                    continue;
                }
            }
            else if (!b.vert && d.r0 === b.r0 && d.r1 === b.r1 && b.c0 > d.c0)
            {
                paint(b, PB_OFF, 0, d.c0, b.c0, b.r0, b.r1);
                d.c0 = b.c0;
                continue;
            }
        }
        if (d.state !== PB_OFF && (!same || b.state === PB_OFF)) erase(b, d);
        if (b.state === PB_WARN) paintWarn(b, b.c0, b.c1, b.r0, b.r1, false);
        else if (b.state !== PB_OFF) paint(b, b.state, p, b.c0, b.c1, b.r0, b.r1);
        d.state = b.state;
        d.phase = p;
        d.c0 = b.c0; d.c1 = b.c1; d.r0 = b.r0; d.r1 = b.r1;
    }
    // the ship: a beam that is on burns it (2 px of glow forgiven each side)
    if (!pl.alive || pl.invuln) return;
    const px = PX(pl.x) + 1, py = PX(pl.y);
    for (let i = 0; i < MAX_PBEAMS; i++)
    {
        const b = pbeams[i];
        if (!b.used || b.state !== PB_ON) continue;
        const bx = pbeam_screenBox(b);
        if (px + 4 > bx[0] && px - 4 < bx[2] && py + 2 > bx[1] && py - 2 < bx[3])
        {
            player_kill();
            return;
        }
    }
}

// The beam's burning box on screen (the glow's outer pixels excepted):
// [x0, y0, x1, y1].
const boxOut = new Int16Array(4);
function pbeam_screenBox(b)
{
    let sx0 = (b.c0 << 3) - cameraX, sx1 = (b.c1 << 3) - cameraX;
    let sy0 = (b.r0 << 3) - cameraY, sy1 = (b.r1 << 3) - cameraY;
    if (sx0 < -64) sx0 = -64;
    if (sx1 > SCREEN_W + 64) sx1 = SCREEN_W + 64;
    if (b.vert) { sx0 += 3; sx1 -= 3; }
    else { sy0 += 3; sy1 -= 3; }
    boxOut[0] = sx0; boxOut[1] = sy0; boxOut[2] = sx1; boxOut[3] = sy1;
    return boxOut;
}

// Streaming: a terrain column or row about to be written gets the beams
// lying over it.
function pbeam_patchColumn(c, r0, n, buf)
{
    for (let i = 0; i < MAX_PBEAMS; i++)
    {
        const b = pbeams[i];
        const d = drawn[i];
        if (!b.used || d.state === PB_OFF || c < d.c0 || c >= d.c1) continue;
        let v = b.vert ? cellFor(b, d.state, d.phase, c - d.c0) : 0;
        if (b.vert && !v) continue;            // (beside a sight line)
        for (let r = d.r0; r < d.r1; r++)
            if (r >= r0 && r < r0 + n)
            {
                if (!b.vert) v = cellFor(b, d.state, d.phase, r - d.r0);
                if (v) buf[r - r0] = v;
            }
    }
}

function pbeam_patchRow(r, c0, n, buf)
{
    for (let i = 0; i < MAX_PBEAMS; i++)
    {
        const b = pbeams[i];
        const d = drawn[i];
        if (!b.used || d.state === PB_OFF || r < d.r0 || r >= d.r1) continue;
        for (let c = d.c0; c < d.c1; c++)
            if (c >= c0 && c < c0 + n)
                buf[c - c0] = cellFor(b, d.state, d.phase, b.vert ? c - d.c0 : r - d.r0);
    }
}

Object.assign(window, {
    pbeam_init, pbeam_new, pbeam_free, pbeam_clear, pbeam_update, pbeam_screenBox,
    pbeam_patchColumn, pbeam_patchRow,
});
})();
