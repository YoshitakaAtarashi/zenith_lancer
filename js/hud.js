// The gauge and score rows, centre-screen messages, the boss's health bar.
'use strict';
(function () {

// Gauge on window row 26, score line on row 27.
const HUD_ROW = 26;
const MSG_MAX = 32;

const labels = ['SPEED', 'MISSL', 'DOUBL', 'LASER', 'OPTN', 'FORCE'];

let lastGauge = 0;
let lastAvail = 0;
let lastScore = 0;
let lastLives = 0;
let dirty = false;

let msgTimer = 0;

// Boss gauge: during a boss fight the window grows by one row above the
// gauge/score rows and shows the boss's remaining health in cells.
const BAR_ROW = 25;
const BAR_CELLS = 26;
let barOn = false;
let barHalves = 0;
const msgLen = [0, 0];
playBottom = PLAY_H - 8;

function hud_init()
{
    barOn = false;
    playBottom = PLAY_H - 8;
    gfx_setWindowVPos(true, HUD_ROW);
    gfx_fillTileMapRect(WINDOW, TILE_ATTR(PAL1, 1, 0, 0, VT_HUDFILL), 0, HUD_ROW, 40, 2);
    dirty = true;
    msgTimer = 0;
}

function drawGauge()
{
    let avail = 0;
    for (let i = 0; i < G_NUM; i++)
    {
        if (gauge_available(i)) avail |= 1 << i;
    }
    if (!dirty && avail === lastAvail && pl.gauge === lastGauge) return;
    lastAvail = avail;
    lastGauge = pl.gauge;
    for (let i = 0; i < G_NUM; i++)
    {
        // centre the label in a 6-wide slot
        const l = labels[i];
        const pad = (6 - l.length) >> 1;
        const buf = (' '.repeat(pad) + l + '      ').slice(0, 6);
        const variant = (i === pl.gauge) ? FONT_SEL : ((avail >> i) & 1) ? FONT_HUD : FONT_DIM;
        txt_draw(WINDOW, buf, 2 + i * 6, HUD_ROW, variant, PAL1);
    }
}

function drawScore()
{
    if (!dirty && score === lastScore && lives === lastLives) return;
    lastScore = score;
    lastLives = lives;
    const line = ' 1P ' + txt_u32(score, 8) + '  HI ' + txt_u32(score > hiScore ? score : hiScore, 8)
        + '   SHIP ' + (lives > 9 ? 9 : lives) + '  ';
    txt_draw(WINDOW, line, 0, HUD_ROW + 1, FONT_HUD, PAL1);
}

function hud_update()
{
    drawGauge();
    drawScore();
    dirty = false;
    if (msgTimer) msgTimer--;
}

// line 0 is the headline (gold), line 1 the detail (white). The glyphs are
// copied into a buffer and sent as one upload per line.
const msgBuf = [new Uint32Array(MSG_MAX * 8), new Uint32Array(MSG_MAX * 8)];

function loadLine(s, line)
{
    const variant = line ? FONT_TXT : FONT_GOLD;
    const dst = msgBuf[line];
    let n = 0;
    while (n < s.length && n < MSG_MAX)
    {
        const g = font_lut[s.charCodeAt(n) & 127];
        dst.set(font_tiles.subarray((variant + g) * 8, (variant + g) * 8 + 8), n * 8);
        n++;
    }
    msgLen[line] = n;
    // pad to a whole sprite of 4 tiles with blanks
    while (n & 3)
    {
        dst.set(font_tiles.subarray(variant * 8, variant * 8 + 8), n * 8);
        n++;
    }
    if (n) gfx_loadTileData(dst, VT_MSG + line * MSG_MAX, n, UP_LATER);
}

let autoLoaded = false;     // message line 1 holds "AUTO PLAY"

function hud_message(line1, line2, frames)
{
    autoLoaded = false;
    loadLine(line1, 0);
    if (line2 !== null && line2 !== undefined) loadLine(line2, 1);
    else msgLen[1] = 0;
    msgTimer = frames;
}

function hud_drawMessage()
{
    if (!msgTimer)
    {
        // AUTO PLAY blinks in the middle while no message is up
        if (!autoPlay) return;
        if (!autoLoaded)
        {
            loadLine(demoPlay ? 'DEMO PLAY' : 'AUTO PLAY', 1);
            autoLoaded = true;
        }
        if (frameCount & 32) return;
        const x = (SCREEN_W - 12 * 8) / 2;
        for (let k = 0; k < 12; k += 4)
            spr_raw(x + k * 8, 100, SPRITE_SIZE(4, 1), TILE_ATTR(PAL1, 1, 0, 0, VT_MSG + MSG_MAX + k));
        return;
    }
    // blink while entering and leaving
    if (msgTimer < 30 && (msgTimer & 4)) return;
    for (let line = 0; line < 2; line++)
    {
        const n = msgLen[line];
        if (!n) continue;
        const x = (SCREEN_W - n * 8) >> 1;
        const y = line ? 96 : 80;
        for (let k = 0; k < n; k += 4)
        {
            spr_raw(x + k * 8, y, SPRITE_SIZE(4, 1), TILE_ATTR(PAL1, 1, 0, 0, VT_MSG + line * MSG_MAX + k));
        }
    }
}

function hud_bossBar(hp, max)
{
    if (!barOn)
    {
        barOn = true;
        barHalves = 0xFFFF;
        playBottom = PLAY_H - 16;
        gfx_fillTileMapRect(WINDOW, TILE_ATTR(PAL1, 1, 0, 0, VT_HUDFILL), 0, BAR_ROW, 40, 1);
        txt_draw(WINDOW, 'BOSS', 2, BAR_ROW, FONT_HUD, PAL1);
        gfx_setWindowVPos(true, BAR_ROW);
    }
    if (hp < 0) hp = 0;
    // health in half cells, rounded up so a sliver still shows
    const halves = max > 0 ? divu(mul16u(hp, BAR_CELLS * 2) + max - 1, max) : 0;
    if (halves === barHalves) return;
    barHalves = halves;
    let buf = '';
    for (let k = 0; k < BAR_CELLS; k++)
    {
        const h = k * 2;
        buf += halves >= h + 2 ? '{' : halves === h + 1 ? '}' : '|';
    }
    txt_draw(WINDOW, buf, 8, BAR_ROW, FONT_HUD, PAL1);
}

function hud_bossBarOff()
{
    if (!barOn) return;
    barOn = false;
    playBottom = PLAY_H - 8;
    gfx_setWindowVPos(true, HUD_ROW);
}

function hud_messageActive()
{
    return msgTimer !== 0;
}

Object.assign(window, {
    hud_init, hud_update, hud_message, hud_drawMessage, hud_bossBar, hud_bossBarOff, hud_messageActive,
});
})();
