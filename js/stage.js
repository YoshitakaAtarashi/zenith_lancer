// Terrain streaming (and the camera's path on stages that climb), parallax,
// water sway, palette animation, the writhing walls, the sky on fire,
// screen shake and flash, the boss body on plane A.
'use strict';
(function () {

const ROWS = 26;        // rows on screen (plane rows 0-25 at camera height 0)

let waveAmp = 0, waveTarget = 0;   // column wave height, 1/16 px
let wavePh = 0;                    // u8
const vsA = new Int16Array(20), vsB = new Int16Array(20);
let vsBSent = false;

let sg = null;
let subX = 0;               // camera fraction, 1/16 px
let nextCol = 0;            // next terrain column to stream into plane A
const colBuf = new Uint16Array(32);
let mapRows = 26;           // the map's height in cells
let winRows = 26;           // rows of it kept in plane A (26, or 29 of the 32 when it scrolls)
let rowLo = 0;              // first of them
let bgV = 0, bgVSent = 0;   // plane B's vertical scroll (stages that climb)
// The camera follows the stage's path: straight segments between
// waypoints, the last one running on to the right for good.
let segI = 0;               // segment from waypoint segI to segI + 1
let segT = 0, segLen = 0;   // progress along it and its length (px, on its longer axis)
let segDX = 0, segDY = 0;
let waveT = 0;              // u16
// Boss fights are the heaviest frames, so a water stage drops to a sway of
// whole 8-line rows there (28 values instead of 224 lines).
let rowWave = false;

// Screen shake: the planes jump by a few pixels for a while, sprites stay.
let shakeT = 0, shakeAmp = 0;
let shakeX = 0, shakeY = 0;
let flashT = 0;             // frames left of a palette flash
let heat = 0, heatTarget = 0;      // the sky on fire, 0..8 (stage_heat)
const heatPal = new Uint16Array(32);   // palette lines 0 and 3 as the heat has them
let bodyOn = false;         // plane A shows a boss body, not terrain
const MAX_BANDS = 8;
const bandStart = new Uint8Array(MAX_BANDS), bandLen = new Uint8Array(MAX_BANDS), bandSp = new Uint8Array(MAX_BANDS);
let nBands = 0;
const rowBand = new Uint8Array(32);    // band of each plane B row (rows 26-31 mirror 5..0)
let bgVDone = 0x7FFF;       // plane B's vertical scroll the h-scroll table was made for
const bandVal = new Int16Array(MAX_BANDS);
let bodyX = 0, bodyY = 0;
const flashBuf = new Uint16Array(32);

// per-row (HSCROLL_TILE) or per-line (HSCROLL_LINE, water stages) tables
const hscrollA = new Int16Array(224);
const hscrollB = new Int16Array(224);
// The water sway line by line: line L of a frame with phase ph takes
// wave_tab[ph + 5L]. Stepping 5 a line visits all 256 entries, so the
// lines of any frame are one run of this sequence starting at 205 * ph
// (205 = 1/5 mod 256), and building the table is copying a window.
const waveSeq = new Int16Array(256 + 224);

// Shadow/highlight: every plane pixel whose cells are all low priority is
// drawn at half brightness; sprites keep theirs by going high priority.
function shadow(on)
{
    gfx_setHilightShadow(on);
    sprPrio = on ? TILE_ATTR_PRIORITY_MASK : 0;
}

// a column of plane A, split where the plane's 32 rows wrap
function putCol(buf, c, r0, n, mode)
{
    const pr = r0 & 31;
    const n1 = 32 - pr < n ? 32 - pr : n;
    gfx_setTileMapDataColumnFast(BG_A, buf, c & 63, pr, n1, mode);
    if (n1 < n) gfx_setTileMapDataColumnFast(BG_A, buf.subarray(n1), c & 63, 0, n - n1, mode);
}

// One column of plane A: the rows kept (rowLo..).
function writeColumn(c, mode)
{
    if (c < 0 || c >= sg.cols)
        colBuf.fill(0, 0, winRows);
    else
    {
        const o = c * mapRows + rowLo;
        colBuf.set(sg.map.subarray(o, o + winRows));
    }
    if (pbeamCount) pbeam_patchColumn(c, rowLo, winRows, colBuf);
    putCol(colBuf, c, rowLo, winRows, mode);
}

// A run of cells along a plane A row, split where the plane's 64 columns wrap.
function putRow(buf, pr, pc, n)
{
    const n1 = 64 - pc < n ? 64 - pc : n;
    gfx_setTileMapDataRow(BG_A, buf, pr, pc, n1, UP_LATER);
    if (n1 < n) gfx_setTileMapDataRow(BG_A, buf, pr, 0, n - n1, UP_LATER, n1);
}

// While the Hive writhes (VSCROLL_COLUMN), the passage closes toward the left
// of the screen. The column the horizontal scroll leaves half shown there has no
// vertical scroll of its own (on the console), so nothing may show in it but
// rock. The map itself changes: each 16 px column, as it scrolls left, has its
// gap filled further with flesh, from both walls, until it is shut. Only the
// picture: the ship is kept off it (stage_leftLimit), the rock kills as ever.
const CLOSE_PAIRS = 4;
const CLOSE_MARGIN = 58;
let closePair = 0;
let closeQ = 0, closeQN = 0;    // columns of the pair step still to write (one a frame)
let closeFull = false;

// what the column's cells are shut with
let clC = 0, clFl = 0, clCe = 0;
let clDeep = -1;                // index into the map of 4 cells of its own deep rock, or -1
let clFill = 0, clRim = 0;

function closePrep(c)
{
    clC = c;
    let f = ms_frames[FR_HIVEFILL];
    clFill = TILE_ATTR(PAL0, 0, 0, 0, assetVram[f.asset] + ms_pieces[f.piece].tile + ((c & 3) << 2));
    f = ms_frames[FR_HIVERIM];
    clRim = TILE_ATTR(PAL0, 0, 0, 0, assetVram[f.asset] + ms_pieces[f.piece].tile + (c & 3));
    clDeep = -1;
    clFl = 0x7FFF; clCe = 0;
    if (c < 0 || c >= sg.cols) return;
    const x = c << 3;
    clFl = terrFloor[x] < terrFloor[x + 7] ? terrFloor[x] : terrFloor[x + 7];
    clCe = terrCeil[x] > terrCeil[x + 7] ? terrCeil[x] : terrCeil[x + 7];
    const m = c * mapRows;
    const rf = (clFl >> 3) + 3, rc = (clCe >> 3) - 6;
    if (rf + 4 <= mapRows) clDeep = m + rf;
    else if (rc >= 0) clDeep = m + rc;
}

function fillCell(r) { return clDeep >= 0 ? sg.map[clDeep + (r & 3)] : clFill + (r & 3); }

// The cell at (clC, r), `i` 16 px columns from the leftmost.
function closeCell(r, i, cell)
{
    if (i >= CLOSE_PAIRS) return cell;
    const fill = fillCell(r);
    if (clFl === 0x7FFF || r < 0 || r >= mapRows) return fill;
    const y = r << 3;
    if (y + 16 <= clCe || y >= clFl + 8) return cell;           // deep in the rock
    if (i < 2) return fill;
    const d = (clFl - clCe) >> (i === 2 ? 2 : 3);               // a quarter, an eighth of the gap
    const lo = clCe + d, hi = clFl - d;                         // the gap left
    if (y + 8 > hi) return y < hi ? clRim : fill;               // (the rim where it ends)
    if (y < lo) return y + 8 >= lo ? clRim | 0x1000 : fill;
    return cell;
}

// Rows r0..r1 of the column shut, a rim on the row given (-1: none).
const closeBuf = new Uint16Array(32);
function closeSpan(c, r0, r1, rim, rimCell)
{
    if (r0 < rowLo) r0 = rowLo;
    if (r1 > rowLo + 31) r1 = rowLo + 31;
    if (r1 < r0) return;
    let n = 0;
    for (let r = r0; r <= r1; r++, n++)
        closeBuf[n] = r === rim ? rimCell : fillCell(r);
    putCol(closeBuf, c, r0, n, UP_LATER);
}

function closeStep()
{
    const pair = cameraX >> 4;
    if (pair !== closePair)
    {
        // A column moves up a step: only the cells that step changes. All of it
        // the first time (from the left edge) or when the last round was not done.
        closeFull = pair !== closePair + 1 || closeQ < closeQN;
        closeQ = closeFull ? 0 : 2;
        closeQN = CLOSE_PAIRS * 2;
        closePair = pair;
    }
    if (closeQ >= closeQN) return;
    const q = closeQ++;
    const i = q >> 1;
    const c = (pair + i) * 2 + (q & 1);
    closePrep(c);
    if (c >= sg.cols) return;
    const rs = ((clCe - 16) >> 3) + 1, re = (clFl + 7) >> 3;
    const gap = clFl - clCe;
    const up = clRim | 0x1000;
    if (i < 2)
    {
        if (closeFull) closeSpan(c, rs, re, -1, 0);
        else
        {
            const d = gap >> 2;
            closeSpan(c, (clCe + d - 1) >> 3, (clFl - d) >> 3, -1, 0);
        }
        // rows of the plane past the map's end, which a half shown column can reach
        if (mapRows < rowLo + 32) closeSpan(c, mapRows, rowLo + 31, -1, 0);
        return;
    }
    const d = gap >> (i === 2 ? 2 : 3);                         // a quarter, an eighth of the gap
    const lo = clCe + d, hi = clFl - d;                         // the gap left
    const d0 = gap >> 3;
    // (the second step starts where the first left off)
    const topFrom = closeFull || i === 3 ? rs : (clCe + d0 - 1) >> 3;
    const botTo = closeFull || i === 3 ? re : (clFl - d0) >> 3;
    const topRim = (lo - 1) >> 3, botRim = hi & 7 ? hi >> 3 : -1;
    closeSpan(c, topFrom, topRim, topRim, up);
    closeSpan(c, hi >> 3, botTo, botRim, clRim);
}

// One row of plane A across the columns kept (the screen's and the ones
// streamed ahead of it).
const rowBuf = new Uint16Array(44);
function writeRow(r)
{
    const c0 = cameraX >> 3;
    let n = nextCol - c0;
    if (n > 44) n = 44;
    if (n < 0) n = 0;
    for (let k = 0; k < n; k++)
    {
        const c = c0 + k;
        rowBuf[k] = (c < sg.cols && r >= 0 && r < mapRows) ? sg.map[c * mapRows + r] : 0;
    }
    if (pbeamCount) pbeam_patchRow(r, c0, n, rowBuf);
    if (colWave && sg_swings())
    {
        const p = cameraX >> 4;
        for (let k = 0; k < CLOSE_PAIRS * 2 + 1 && k < n; k++)
        {
            closePrep(c0 + k);
            rowBuf[k] = closeCell(r, ((c0 + k) >> 1) - p, rowBuf[k]);
        }
    }
    putRow(rowBuf, r & 31, c0 & 63, n);
}

function stage_paintRow(r, c0, c1, cell)
{
    stage_paintRowSeq(r, c0, c1, cell, 0);
}

const paintBuf = new Uint16Array(44);
function stage_paintRowSeq(r, c0, c1, cell, step)
{
    const lo = cameraX >> 3;
    if (c0 < lo) { if (cell !== 0xFFFF) cell = (cell + step * (lo - c0)) & 0xFFFF; c0 = lo; }
    if (c1 > nextCol) c1 = nextCol;
    if (c1 <= c0 || r < rowLo || r >= rowLo + winRows || bodyOn) return;
    let n = c1 - c0;
    if (n > 44) n = 44;
    if (cell !== 0xFFFF)
        for (let k = 0; k < n; k++) paintBuf[k] = cell + k * step;
    else
        for (let k = 0; k < n; k++)
            paintBuf[k] = (c0 + k < sg.cols && r < mapRows) ? sg.map[(c0 + k) * mapRows + r] : 0;
    putRow(paintBuf, r & 31, c0 & 63, n);
}

function stage_paintCol(c, r0, r1, cell)
{
    stage_paintColSeq(c, r0, r1, cell, 0);
}

const paintColBuf = new Uint16Array(32);
function stage_paintColSeq(c, r0, r1, cell, step)
{
    if (c < (cameraX >> 3) || c >= nextCol || bodyOn) return;
    if (r0 < rowLo) { if (cell !== 0xFFFF) cell = (cell + step * (rowLo - r0)) & 0xFFFF; r0 = rowLo; }
    if (r1 > rowLo + winRows) r1 = rowLo + winRows;
    if (r1 <= r0) return;
    const n = r1 - r0;
    if (cell !== 0xFFFF)
        for (let k = 0; k < n; k++) paintColBuf[k] = cell + k * step;
    else if (c < sg.cols)
        paintColBuf.set(sg.map.subarray(c * mapRows + r0, c * mapRows + r0 + n));
    else
        paintColBuf.fill(0, 0, n);
    putCol(paintColBuf, c, r0, n, UP_LATER);
}

function stage_cellSolid(c, r)
{
    if (c < 0 || c >= sg.cols) return false;
    const x = c << 3;
    const y = (r << 3) & 0xFFFF;
    // either edge of the cell
    return y + 8 > terrFloor[x] || y < terrCeil[x] || y + 8 > terrFloor[x + 7] || y < terrCeil[x + 7];
}

// first row kept for a camera height: one row above the screen, clamped
function rowFor(camY)
{
    const r = (camY >> 3) - 1;
    const top = mapRows - winRows;
    return r < 0 ? 0 : r > top ? top : r;
}

function segStart(i)
{
    const p = i * 2;
    segI = i;
    segT = 0;
    if (i + 1 >= sg.npath)                            // the last: on to the right
    {
        segLen = 0;
        scrollDirX = -8;
        scrollDirY = 0;
        return;
    }
    segDX = sg.path[p + 2] - sg.path[p];
    segDY = sg.path[p + 3] - sg.path[p + 1];
    const ax = abs(segDX), ay = abs(segDY);
    segLen = ax > ay ? ax : ay;
    if (segLen)
    {
        scrollDirX = -divs(segDX * 8, segLen);
        scrollDirY = -divs(segDY * 8, segLen);
    }
}

// Moves the camera `step` px along the path.
function camAdvance(step)
{
    stageDist += step;
    while (step && segLen)
    {
        let k = segLen - segT;
        if (step < k) k = step;
        segT += k;
        step -= k;
        if (segT >= segLen) segStart(segI + 1);
    }
    const p = segI * 2;
    const px = sg.path[p], py = sg.path[p + 1];
    if (!segLen)
    {
        // the last segment: x runs on
        if (segT === 0) { cameraX = px; cameraY = py; segT = 1; }
        cameraX += step;
        return;
    }
    cameraX = px + (segDX === 0 ? 0 : segDY === 0 ? segT : divs(segDX * segT, segLen));
    cameraY = u16(py + (segDY === 0 ? 0 : segDX === 0 ? (segDY < 0 ? -segT : segT)
                                                       : divs(segDY * segT, segLen)));
}

function loadBackdrop()
{
    // rows 26 and up of a stage's plane B hold tiles, not map
    for (let y = 0; y < sg.bgRows; y++)
        gfx_setTileMapDataRow(BG_B, sg.bgMap, y, 0, 64, UP_NOW, y * 64);
}

function stage_init(stage, startCol)
{
    stageNum = stage;
    iceOn = false;
    for (let i = 0; i < ICE_SLOTS; i++) { iceH[i] = 0; iceTag[i] = 0xFFFF; }
    sg = stage_gfx[stage];
    terrFloor = sg.floor;
    terrCeil = sg.ceil;
    terrW = sg.cols * 8;
    mapRows = sg.rows;
    winRows = mapRows > ROWS ? 29 : ROWS;
    findBands();
    heat = heatTarget = 0;
    heatI = 32;
    heatPal.set(sg.pal.subarray(0, 16));
    heatPal.set(sg.pal.subarray(48, 64), 16);
    if (sg.raster)
        for (let j = 0; j < 256 + 224; j++) waveSeq[j] = wave_tab[(j * 5) & 255];
    stageDist = 0;
    segStart(0);
    camAdvance(0);
    // skipping ahead (boss rush): along the path, a screen at a time
    for (let d = startCol << 3; d; )
    {
        const k = d > 256 ? 256 : d;
        camAdvance(k);
        d -= k;
    }
    rowLo = rowFor(cameraY);
    scrollStepY = 0;
    bgV = 0;
    bgVSent = 0x7FFF;
    subX = 0;
    scrollSpeed = scrollTarget = 16;
    scrollStep = 0;
    nextCol = 0;
    waveT = 0;
    stageOpen = false;
    rowWave = false;
    colWave = false;
    waveAmp = waveTarget = 0;
    closeLeft = 16;
    colOff.fill(0);
    shakeT = shakeAmp = flashT = 0;
    bodyOn = false;
    shakeX = 0;
    gfx_setVerticalScroll(BG_A, 0);
    gfx_setVerticalScroll(BG_B, 0);
    gfx_setScrollingMode(sg.raster ? HSCROLL_LINE : HSCROLL_TILE, VSCROLL_PLANE);
    shadow(false);
}

function stage_title()
{
    return sg.title;
}

function stage_drawInitial()
{
    // only the rows in use: rows 27-30 of the planes hold tiles; rows 26
    // and 31 stay blank for the screen shake (a stage that climbs uses
    // all of plane A's rows, and plane B's when its backdrop follows)
    if (mapRows > ROWS) gfx_clearTileMapRect(BG_A, 0, 0, 64, 32);
    else
    {
        gfx_clearTileMapRect(BG_A, 0, 0, 64, ROWS + 1);
        gfx_clearTileMapRect(BG_A, 0, 31, 64, 1);
    }
    if (sg.bgRows <= ROWS)
    {
        gfx_clearTileMapRect(BG_B, 0, 26, 64, 1);
        gfx_clearTileMapRect(BG_B, 0, 31, 64, 1);
    }
    loadBackdrop();
    const first = cameraX >> 3;
    for (let c = first; c < first + 42; c++) writeColumn(c, UP_NOW);
    nextCol = first + 42;
    gfx_setVerticalScroll(BG_A, cameraY);
}

function stage_bossMode(on)
{
    if (bossDim) shadow(on);
    if (!sg.raster || on === rowWave) return;
    rowWave = on;
    gfx_setScrollingMode(on ? HSCROLL_TILE : HSCROLL_LINE, VSCROLL_PLANE);
    for (let i = 0; i < nBands; i++) bandVal[i] = 0x7FFF;   // resend plane B
}

function stage_shake(frames, amp)
{
    if (frames > shakeT) shakeT = frames;
    if (amp > shakeAmp) shakeAmp = amp;
}

// Flash: the terrain and backdrop palettes brighten for a few frames.
function stage_flash(frames)
{
    for (let i = 0; i < 32; i++)
    {
        const c = heatPal[i];
        let o = 0;
        for (let sh = 0; sh < 12; sh += 4)
        {
            let v = (c >> sh) & 0xE;
            v += ((14 - v) >> 1) & 0xE;               // halfway to white
            o |= (v > 14 ? 14 : v) << sh;
        }
        flashBuf[i] = o;
    }
    pal_setColors(0, flashBuf, 16, UP_LATER);
    pal_setColors(48, flashBuf, 16, UP_LATER, 16);
    flashT = frames;
}

function stage_wave(amp)
{
    waveTarget = amp << 4;
}

// The writhing terrain: each 16 px screen column of plane A gets its own
// vertical scroll, a sine travelling along the screen. The rock moves with
// it (stage_floorAt and the rest read colOff), the backdrop does not.
function columnWave()
{
    if (waveAmp !== waveTarget)
        waveAmp += waveAmp < waveTarget ? 1 : -1;
    if (!waveAmp && !waveTarget)
    {
        if (colWave)
        {
            colWave = false;
            colOff.fill(0);
            gfx_setScrollingMode(sg.raster ? HSCROLL_LINE : HSCROLL_TILE, VSCROLL_PLANE);
            gfx_setVerticalScrollVSync(BG_A, cameraY + shakeY);
            gfx_setVerticalScrollVSync(BG_B, bgV + shakeY);
        }
        return;
    }
    if (!colWave)
    {
        colWave = true;
        vsBSent = false;
        gfx_setScrollingMode(sg.raster ? HSCROLL_LINE : HSCROLL_TILE, VSCROLL_COLUMN);
        closePair = 0;
    }
    wavePh = (wavePh + 3) & 255;
    const amp = waveAmp >> 4;
    // colOff[k] covers screen x 16k-16 .. 16k-1 (index 0 is a margin)
    let a = wavePh;
    for (let k = 0; k < 22; k++, a = (a - 12) & 255)
        colOff[k] = s8((s16(sin_tab[a]) * amp) >> 8);
    const base = cameraY + shakeY;
    for (let k = 0; k < 20; k++) vsA[k] = base + colOff[k + 1];
    gfx_setVerticalScrollTile(BG_A, 0, vsA, 20, UP_LATER);
    // plane B's columns all scroll alike: sent only when that changes
    const b = bgV + shakeY;
    if (b !== vsB[0] || !vsBSent)
    {
        vsB.fill(b);
        gfx_setVerticalScrollTile(BG_B, 0, vsB, 20, UP_LATER);
        vsBSent = true;
    }
}

function shakeStep()
{
    if (flashT && --flashT === 0)
    {
        pal_setColors(0, heatPal, 16, UP_LATER);
        pal_setColors(48, heatPal, 16, UP_LATER, 16);
    }
    if (colWave)
    {
        // (columnWave sends the scroll, shake included)
        if (shakeT)
        {
            shakeT--;
            const r = random();
            const amp = shakeT ? shakeAmp : 0;
            if (!shakeT) shakeAmp = 0;
            shakeX = amp ? modu(r, amp * 2 + 1) - amp : 0;
            shakeY = amp ? modu(r >> 8, 5) - 2 : 0;
        }
        else shakeX = shakeY = 0;
        return;
    }
    if (!shakeT)
    {
        if (bodyOn) gfx_setVerticalScrollVSync(BG_A, -bodyY);
        else if (scrollStepY || shakeY) gfx_setVerticalScrollVSync(BG_A, cameraY);
        if (bgV !== bgVSent) { gfx_setVerticalScrollVSync(BG_B, bgV); bgVSent = bgV; }
        shakeX = shakeY = 0;
        return;
    }
    shakeT--;
    const r = random();
    const amp = shakeT ? shakeAmp : 0;
    if (!shakeT) shakeAmp = 0;
    shakeX = amp ? modu(r, amp * 2 + 1) - amp : 0;
    // vertical: at most 2 px either way (plane rows 26 and 31 are blank)
    const dy = amp ? modu(r >> 8, 5) - 2 : 0;
    shakeY = dy;
    gfx_setVerticalScrollVSync(BG_A, (bodyOn ? -bodyY : cameraY) + dy);
    gfx_setVerticalScrollVSync(BG_B, bgV + dy);
    bgVSent = 0x7FFF;
}

// A boss's big body drawn on plane A: the terrain stops streaming, the
// plane is cleared and then follows the boss through the scroll registers.
function stage_bossBody(on)
{
    bodyOn = on;
    gfx_clearPlane(BG_A, true);
    if (!on) gfx_setVerticalScrollVSync(BG_A, 0);
}

// Called after the boss has moved this frame, so the body keeps in step
// with the boss's sprites.
function stage_bossBodyAt(x, y)
{
    bodyX = x;
    bodyY = y;
    if (!bodyOn) return;
    // a water stage fills all 224 lines: the frame the boss arrives (and
    // the scroll mode turns to 8-line rows) still sends the table laid out
    // by lines, and the rows read every 8th entry of it
    const n = sg.raster ? 224 : 28;
    hscrollA.fill(s16(x + shakeX), 0, n);
    if (sg.raster && !rowWave) gfx_setHorizontalScrollLine(BG_A, 0, hscrollA, 224, UP_LATER);
    else gfx_setHorizontalScrollTile(BG_A, 0, hscrollA, 28, UP_LATER);
    gfx_setVerticalScrollVSync(BG_A, -y + shakeY);
}

// The backdrop scrolls in bands of rows with one speed each (1-5 per
// stage): found once at the stage start.
function findBands()
{
    nBands = 0;
    for (let r = 0; r < 28; r++)
    {
        const sp = sg.bgSpeed[r];
        if (nBands && bandSp[nBands - 1] === sp) bandLen[nBands - 1]++;
        else if (nBands < MAX_BANDS)
        {
            bandStart[nBands] = r;
            bandLen[nBands] = 1;
            bandSp[nBands] = sp;
            bandVal[nBands] = 0x7FFF;
            nBands++;
        }
        rowBand[r] = nBands - 1;
    }
    for (let r = 26; r < 32; r++) rowBand[r] = rowBand[31 - r];
    bgVDone = 0x7FFF;
}

function stage_heat(level)
{
    heatTarget = level;
}

// every colour eased toward the same brightness on a ramp of fire
let heatI = 32;             // the next colour of the step under way
// (a dark ramp: the star and the flames in front of it must stand out)
const heatR = [0, 2, 4, 4, 6, 8, 8, 10];
const heatG = [0, 0, 0, 0, 0, 2, 2, 4];
const heatB = [0, 0, 0, 0, 0, 0, 0, 0];
function heatStep()
{
    if (heatI >= 32)
    {
        heat += heat < heatTarget ? 1 : -1;
        heatI = 0;
    }
    // (eight colours a frame)
    const last = heatI + 8;
    for (let i = heatI; i < last; i++)
    {
        const c = sg.pal[i < 16 ? i : i + 32];
        const h = (i < 16 && i) ? heat >> 1 : heat;
        const r = c & 14, g = (c >> 4) & 14, b = (c >> 8) & 14;
        let m = r > g ? r : g;
        if (b > m) m = b;
        m >>= 1;
        const r2 = r + (((heatR[m] - r) * h) >> 3);
        const g2 = g + (((heatG[m] - g) * h) >> 3);
        const b2 = b + (((heatB[m] - b) * h) >> 3);
        heatPal[i] = (r2 & 14) | ((g2 & 14) << 4) | ((b2 & 14) << 8);
    }
    heatI = last;
    if (heatI < 32) return;
    pal_setColors(0, heatPal, 16, UP_LATER);
    pal_setColors(48, heatPal, 16, UP_LATER, 16);
    // the backdrop's rows sway in the heat
    const sway = !!(heat || heatTarget);
    if (sway !== rowWave)
    {
        rowWave = sway;
        for (let i = 0; i < nBands; i++) bandVal[i] = 0x7FFF;
    }
}

// the stars' faces: the block's 36 tiles, 6 a frame, on to the next of 8
// phases (a phase takes 6 frames to arrive; in that noise the seam can't show)
const PLASMA_TILES = 36;
let plasmaPh = 0, plasmaNext = 0;
function plasmaStep()
{
    let src = (plasmaPh * PLASMA_TILES + plasmaNext) << 3;
    for (let left = 6; left;)
    {
        const v = s6_plasma_vram[plasmaNext];
        let n = 1;
        while (n < left && s6_plasma_vram[plasmaNext + n] === v + n) n++;
        gfx_loadTileData(s6_plasma_tiles, v, n, UP_LATER, src);
        src += n << 3;
        plasmaNext += n;
        left -= n;
    }
    if (plasmaNext >= PLASMA_TILES) { plasmaNext = 0; plasmaPh = (plasmaPh + 1) & 7; }
}

function parallax(camX, moveA)
{
    const a = s16((bodyOn ? bodyX : moveA ? -(camX & 0x1FF) : 0) + shakeX);
    // band scrolls; plane B is only resent when one of them moved
    let moved = false;
    for (let i = 0; i < nBands; i++)
    {
        const v = s16(-s16(mul16u(camX & 0xFFFF, bandSp[i]) >>> 8) + shakeX);
        if (v !== bandVal[i]) { bandVal[i] = v; moved = true; }
    }
    if (rowWave)
    {
        hscrollA.fill(a, 0, 28);
        gfx_setHorizontalScrollTile(BG_A, 0, hscrollA, 28, UP_LATER);
        // the sway moves under half a pixel a frame: every other frame
        // (but every frame while the screen shakes)
        if ((waveT & 2) && !shakeT) return;
        let ph = waveT & 255;
        for (let i = 0; i < nBands; i++)
            for (let r = bandStart[i], n = bandLen[i]; n; n--, r++, ph = (ph + 40) & 255)
                hscrollB[r] = bandVal[i] + wave_tab[ph];
        gfx_setHorizontalScrollTile(BG_B, 0, hscrollB, 28, UP_LATER);
        return;
    }
    if (!sg.raster)
    {
        hscrollA.fill(a, 0, 28);
        gfx_setHorizontalScrollTile(BG_A, 0, hscrollA, 28, UP_LATER);
        if (sg.bgVShift && (moved || bgV !== bgVDone))
        {
            // plane B moves up and down too: each screen row takes the
            // speed of the backdrop row now behind it
            bgVDone = bgV;
            let y = bgV + 4;
            for (let r = 0; r < 28; r++, y += 8)
                hscrollB[r] = bandVal[rowBand[(y >> 3) & 31]];
            gfx_setHorizontalScrollTile(BG_B, 0, hscrollB, 28, UP_LATER);
        }
        else if (moved)
        {
            for (let i = 0; i < nBands; i++)
                hscrollB.fill(bandVal[i], bandStart[i], bandStart[i] + bandLen[i]);
            gfx_setHorizontalScrollTile(BG_B, 0, hscrollB, 28, UP_LATER);
        }
        return;
    }
    // Water: every line of plane B sways on a slow sine, looked up from a
    // table; the even lines one frame, the odd ones the next.
    hscrollA.fill(a, 0, 224);
    gfx_setHorizontalScrollLine(BG_A, 0, hscrollA, 224, UP_LATER);
    const odd = (waveT >> 1) & 1;
    let w = (mul16u(waveT & ~2 & 255, 205) & 255) + odd;
    let pb = odd;
    for (let i = 0; i < nBands; i++)
    {
        const base = bandVal[i];
        for (let n = bandLen[i] << 2; n; n--, pb += 2, w += 2) hscrollB[pb] = base + waveSeq[w];
    }
    gfx_setHorizontalScrollLine(BG_B, 0, hscrollB, 224, UP_LATER);
}

// Per-stage palette animation.
const palBuf = new Uint16Array(4);
const vein = [0x002, 0x004, 0x00A, 0x006, 0x008, 0x00C, 0x006, 0x004];
const node = [0x08A, 0x0AA, 0x2EC, 0x0CA, 0x0CA, 0x2EE, 0x0CA, 0x0AA];
const seam = [0x606, 0x80A, 0xA4C, 0xC8E, 0xEAE, 0xC8E, 0xA4C, 0x80A];

function paletteAnim()
{
    if (stageNum === 2)
    {
        // Hive: the walls' veins and nodes pulse like a heartbeat (lub-dub)
        const k = (waveT >> 4) & 7;
        palBuf[0] = vein[k];
        palBuf[1] = vein[(k + 1) & 7] | 0x002;
        palBuf[2] = node[k];
        pal_setColors(12, palBuf, 3, UP_LATER);
    }
    else if (stageNum === 5)
    {
        // Zenith: energy seams run violet -> white and back
        const k = (waveT >> 3) & 7;
        palBuf[0] = seam[k];
        palBuf[1] = seam[(k + 4) & 7];
        pal_setColors(13, palBuf, 2, UP_LATER);
    }
}

function stage_update()
{
    // speed changes ease in: 1/16 px per frame every other frame
    if (scrollSpeed !== scrollTarget && (waveT & 2))
        scrollSpeed += scrollSpeed < scrollTarget ? 1 : -1;
    const s = subX + scrollSpeed;
    subX = s & 15;
    const ox = cameraX, oy = cameraY;
    camAdvance(s >> 4);
    scrollStep = cameraX - ox;
    scrollStepY = cameraY - oy;
    waveT = (waveT + 2) & 0xFFFF;
    stageOpen = (cameraX >> 3) >= sg.cols;

    if (scrollStepY && !bodyOn)
    {
        // rows: keep the window round the camera's height
        const want = rowFor(cameraY);
        while (rowLo > want) writeRow(--rowLo);
        while (rowLo < want) { writeRow(rowLo + winRows); rowLo++; }
    }
    if (sg.bgVShift)
    {
        const v = s16(cameraY - sg.path[1]) >> sg.bgVShift;
        bgV = v < -44 ? -44 : v > 44 ? 44 : v;
    }
    // keep plane A one column ahead of the right edge (two at high speed)
    const need = (cameraX >> 3) + 42;
    for (let k = 0; k < 2 && nextCol < need && !bodyOn; k++)
        writeColumn(nextCol++, UP_LATER);
    shakeStep();
    if (waveAmp || waveTarget || colWave) columnWave();
    if (sg_swings())
    {
        // the ship is eased clear of the closing flesh
        const want = colWave && !bodyOn ? CLOSE_MARGIN : 16;
        if (closeLeft !== want) closeLeft += closeLeft < want ? 1 : -1;
        if (colWave && !bodyOn) closeStep();
    }
    parallax(cameraX, true);
    if ((waveT & 15) === 0 && !flashT) paletteAnim();
    if (heatI < 32 || (heat !== heatTarget && (waveT & 15) === 8 && !flashT)) heatStep();
    if (heat && heatTarget && stageNum === 5) plasmaStep();
}

function stage_titleBackdrop(camX, load)
{
    if (load)
    {
        // whatever a game left (a demo quit mid-fight leaves a boss body
        // on plane A, a shake, a wave) goes, as at a stage's start
        rowWave = false;
        shakeT = shakeAmp = flashT = 0;
        shakeX = shakeY = 0;
        bodyOn = false;
        bodyX = bodyY = 0;
        waveT = 0;
        gfx_setVerticalScroll(BG_A, 0);
        gfx_setVerticalScroll(BG_B, 0);
        sg = title_gfx;
        findBands();
        shadow(false);
        gfx_setScrollingMode(HSCROLL_TILE, VSCROLL_PLANE);
        loadBackdrop();
    }
    parallax(camX, false);
}

Object.assign(window, {
    stage_init, stage_title, stage_drawInitial, stage_bossMode, stage_shake, stage_flash,
    stage_bossBody, stage_bossBodyAt, stage_update, stage_titleBackdrop,
    stage_paintRow, stage_paintRowSeq, stage_paintCol, stage_paintColSeq, stage_cellSolid,
    stage_heat, stage_wave,
});
})();
