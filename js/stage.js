// Terrain streaming, parallax, water sway, palette animation, screen
// shake and flash, the boss body on plane A.
'use strict';
(function () {

const ROWS = 26;

let sg = null;
let subX = 0;               // camera fraction, 1/16 px
let nextCol = 0;            // next terrain column to stream into plane A
const colBuf = new Uint16Array(ROWS);
let waveT = 0;              // u16
// Boss fights are the heaviest frames, so a water stage drops to a sway of
// whole 8-line rows there (28 values instead of 224 lines).
let rowWave = false;

// Screen shake: the planes jump by a few pixels for a while, sprites stay.
let shakeT = 0, shakeAmp = 0;
let shakeX = 0, shakeY = 0;
let flashT = 0;             // frames left of a palette flash
let bodyOn = false;         // plane A shows a boss body, not terrain
const MAX_BANDS = 8;
const bandStart = new Uint8Array(MAX_BANDS), bandLen = new Uint8Array(MAX_BANDS), bandSp = new Uint8Array(MAX_BANDS);
let nBands = 0;
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

function buildColumn(c)
{
    if (c < 0 || c >= sg.cols)
    {
        colBuf.fill(0);
        return;
    }
    colBuf.set(sg.map.subarray(c * ROWS, c * ROWS + ROWS));
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
    sg = stage_gfx[stage];
    terrFloor = sg.floor;
    terrCeil = sg.ceil;
    terrW = sg.cols * 8;
    findBands();
    if (sg.raster)
        for (let j = 0; j < 256 + 224; j++) waveSeq[j] = wave_tab[(j * 5) & 255];
    cameraX = startCol << 3;
    subX = 0;
    scrollSpeed = scrollTarget = 16;
    scrollStep = 0;
    nextCol = 0;
    waveT = 0;
    stageOpen = false;
    rowWave = false;
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
    // and 31 stay blank for the screen shake
    gfx_clearTileMapRect(BG_A, 0, 0, 64, ROWS + 1);
    gfx_clearTileMapRect(BG_A, 0, 31, 64, 1);
    gfx_clearTileMapRect(BG_B, 0, 26, 64, 1);
    gfx_clearTileMapRect(BG_B, 0, 31, 64, 1);
    loadBackdrop();
    const first = cameraX >> 3;
    for (let c = first; c < first + 42; c++)
    {
        buildColumn(c);
        gfx_setTileMapDataColumnFast(BG_A, colBuf, c & 63, 0, ROWS, UP_NOW);
    }
    nextCol = first + 42;
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
    const p = sg.pal;
    for (let i = 0; i < 32; i++)
    {
        const c = p[i < 16 ? i : i + 32];
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

function shakeStep()
{
    if (flashT && --flashT === 0)
    {
        pal_setColors(0, sg.pal, 16, UP_LATER);
        pal_setColors(48, sg.pal, 16, UP_LATER, 48);
    }
    if (!shakeT)
    {
        shakeX = shakeY = 0;
        if (bodyOn) gfx_setVerticalScrollVSync(BG_A, -bodyY);
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
    gfx_setVerticalScrollVSync(BG_A, (bodyOn ? -bodyY : 0) + dy);
    gfx_setVerticalScrollVSync(BG_B, dy);
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
    }
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
        if (moved)
        {
            for (let i = 0; i < nBands; i++)
                hscrollB.fill(bandVal[i], bandStart[i], bandStart[i] + bandLen[i]);
            gfx_setHorizontalScrollTile(BG_B, 0, hscrollB, 28, UP_LATER);
        }
        return;
    }
    // Water: every line of plane B sways on a slow sine, looked up from a
    // table; plane B's 224 lines are rebuilt every other frame.
    hscrollA.fill(a, 0, 224);
    gfx_setHorizontalScrollLine(BG_A, 0, hscrollA, 224, UP_LATER);
    if (waveT & 2) return;
    let w = mul16u(waveT & 255, 205) & 255;
    let pb = 0;
    for (let i = 0; i < nBands; i++)
    {
        const base = bandVal[i];
        for (let n = bandLen[i] << 3; n; n--) hscrollB[pb++] = base + waveSeq[w++];
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
    scrollStep = s >> 4;
    subX = s & 15;
    cameraX += scrollStep;
    waveT = (waveT + 2) & 0xFFFF;
    stageOpen = (cameraX >> 3) >= sg.cols;

    // keep plane A one column ahead of the right edge (two at high speed)
    const need = (cameraX >> 3) + 42;
    for (let k = 0; k < 2 && nextCol < need && !bodyOn; k++)
    {
        buildColumn(nextCol);
        gfx_setTileMapDataColumnFast(BG_A, colBuf, nextCol & 63, 0, ROWS, UP_LATER);
        nextCol++;
    }
    shakeStep();
    parallax(cameraX, true);
    if ((waveT & 15) === 0 && !flashT) paletteAnim();
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
});
})();
