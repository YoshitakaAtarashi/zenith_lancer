// Sprites (metasprites, fast single-piece sprites, staged lists) and text.
'use strict';

const MAX_SPR = 80;
const VT_HUDFILL = VT_FONT + FONT_HUD;   // glyph ' ' of the HUD font = panel colour

function newFastSpr() { return { attr: 0, dx: 0, dy: 0, sizeLink: 0 }; }

function spr_fastPrepare(out, frame, flags)
{
    const f = ms_frames[frame];
    const p = ms_pieces[f.piece];
    const pal = (flags & SF_PAL_OVR) ? ((flags >> 4) & 3) : f.pal;
    out.attr = (TILE_ATTR(pal, 0, (flags & SF_VFLIP) ? 1 : 0, (flags & SF_HFLIP) ? 1 : 0, 0)
              + assetVram[f.asset] + p.tile) & 0xFFFF;
    out.dx = (flags & SF_HFLIP) ? s16(f.w - p.dx - p.w) : p.dx;
    out.dy = p.dy;
    out.sizeLink = p.size << 8;
}

function sprOff(x, y)
{
    return ((x + 32) & 0xFFFF) >= SCREEN_W + 32 || ((y + 32) & 0xFFFF) >= 224 + 32;
}

function sprPut(n, x, y, sizeLink, attr)
{
    const o = n * 4;
    spriteCache[o] = (y + 0x80) & 0xFFFF;
    spriteCache[o + 1] = sizeLink;
    spriteCache[o + 2] = attr;
    spriteCache[o + 3] = (x + 0x80) & 0xFFFF;
}

function spr_fast(f, x, y)
{
    if (sprN >= 80) return;
    x += f.dx;
    y += f.dy;
    if (sprOff(x, y)) return;
    sprN++;
    sprPut(sprN - 1, x, y, f.sizeLink | sprN, f.attr | sprPrio);
}

// Staged sprites: an update loop writes the finished entry (two longs,
// link 0) into its own list; the draw pass copies the list into the frame.
function spr_stage(list, i, f, x, y)
{
    list[i * 2] = ((((y + f.dy + 0x80) & 0xFFFF) << 16) | f.sizeLink) >>> 0;
    list[i * 2 + 1] = ((f.attr << 16) | ((x + f.dx + 0x80) & 0xFFFF)) >>> 0;
}

function spr_copyStaged(src, n, rot)
{
    let k = sprN;
    let c = MAX_SPR - k;
    if (c > n) c = n;
    if (!c) return;
    let s = rot >= n ? 0 : rot;
    for (; c; c--)
    {
        const a = src[s * 2], b = src[s * 2 + 1];
        ++k;
        const o = (k - 1) * 4;
        spriteCache[o] = a >>> 16;
        spriteCache[o + 1] = (a & 0xFFFF) | k;
        spriteCache[o + 2] = (b >>> 16) | sprPrio;
        spriteCache[o + 3] = b & 0xFFFF;
        if (++s === n) s = 0;
    }
    sprN = k;
}

// Every frame of the sprite bank, resolved at the stage start.
const qspr = Array.from({ length: NUM_FRAMES }, () => ({ attr: 0, dx: 0, dy: 0, dxF: 0, dyF: 0, sizeLink: 0, one: false }));

function spr_qPrepare()
{
    for (let i = 0; i < NUM_FRAMES; i++)
    {
        const f = ms_frames[i];
        const p = ms_pieces[f.piece];
        const q = qspr[i];
        q.one = f.count === 1;
        q.attr = (TILE_ATTR(f.pal, 0, 0, 0, 0) + assetVram[f.asset] + p.tile) & 0xFFFF;
        q.dx = p.dx;
        q.dy = p.dy;
        q.dxF = f.w - p.dx - p.w;
        q.dyF = f.h - p.dy - (((p.size & 3) + 1) << 3);
        q.sizeLink = p.size << 8;
    }
}

function spr_q(frame, x, y, flags)
{
    const q = qspr[frame];
    if (!q.one) { spr_meta(frame, x, y, flags); return; }
    if (sprN >= 80) return;
    let attr = q.attr;
    if (flags)
    {
        if (flags & SF_PAL_OVR) attr = (attr & ~0x6000) | ((flags & 0x30) << 9);
        if (flags & SF_HFLIP) { attr ^= 0x0800; x += q.dxF; } else x += q.dx;
        if (flags & SF_VFLIP) { attr ^= 0x1000; y += q.dyF; } else y += q.dy;
    }
    else { x += q.dx; y += q.dy; }
    if (sprOff(x, y)) return;
    sprN++;
    sprPut(sprN - 1, x, y, q.sizeLink | sprN, attr | sprPrio);
}

// Cursor for loops that add many fast sprites.
function sc_begin(c) { c.n = sprN; }
function sc_put(c, f, x, y)
{
    if (c.n >= 80) return;
    x += f.dx;
    y += f.dy;
    if (sprOff(x, y)) return;
    c.n++;
    sprPut(c.n - 1, x, y, f.sizeLink | c.n, f.attr | sprPrio);
}
function sc_end(c) { sprN = c.n; }

function loadAssets(ids, vt)
{
    for (let i = 0; ids[i] !== 0xFF; i++)
    {
        const id = ids[i];
        const n = asset_ntiles[id];
        gfx_loadTileData(asset_tiles[id], vt, n, UP_NOW);
        assetVram[id] = vt;
        vt += n;
    }
    return vt;
}

let hudFont = false;

function loadFontAndCommon(hud)
{
    hudFont = hud;
    let vt = VT_FONT;
    if (hud)
    {
        gfx_loadTileData(hudfont_tiles, vt, HUDFONT_TILES_NUM, UP_NOW);
        vt += HUDFONT_TILES_NUM;
    }
    else
    {
        gfx_loadTileData(font_tiles, vt, FONT_TILES_NUM, UP_NOW);
        vt += FONT_TILES_NUM;
    }
    loadAssets(common_assets, vt);
}

function video_init()
{
    gfx_setScrollingMode(HSCROLL_TILE, VSCROLL_PLANE);
    pal_setColors(0, stage_gfx[0].pal, 64, UP_NOW);
    loadFontAndCommon(false);
}

function video_loadPlanes(g)
{
    const c = g.chunks;
    for (let i = 0; i < g.nchunks; i++)
        gfx_loadTileData(g.planeTiles, c[i * 3 + 1], c[i * 3 + 2], UP_NOW, c[i * 3] << 3);
}

function video_loadStage(stage)
{
    const g = stage_gfx[stage];
    loadFontAndCommon(true);
    loadAssets(g.assets, VT_STAGE);
    spr_qPrepare();
    video_loadPlanes(g);
    pal_setColors(0, palette_black, 64, UP_NOW);   // the stage fades in (game.js)
}

function video_dimTitle()
{
    // a fade in may still be under way: stop it, and set the text and
    // logo colours in full
    pal_interruptFade();
    pal_setColors(0, title_pal_dim, 16, UP_LATER);
    pal_setColors(16, title_pal, 16, UP_LATER, 16);
    pal_setColors(32, pal_logo, 16, UP_LATER);
    pal_setColors(48, title_pal_dim, 16, UP_LATER, 16);
}

function video_loadTitle()
{
    loadFontAndCommon(false);
    video_loadPlanes(title_gfx);
    // black now, then a fade in to the picture and the logo
    const pal = new Uint16Array(64);
    pal.set(title_gfx.pal);
    pal.set(pal_logo, 32);              // the logo uses the enemy slot
    pal_setColors(0, palette_black, 64, UP_NOW);
    pal_fadeInAll(pal, 30, true);
}

function spr_begin()
{
    sprN = 0;
}

function spr_meta(frame, x, y, flags)
{
    const f = ms_frames[frame];
    const pal = (flags & SF_PAL_OVR) ? ((flags >> 4) & 3) : f.pal;
    const base = TILE_ATTR(pal, 0, (flags & SF_VFLIP) ? 1 : 0, (flags & SF_HFLIP) ? 1 : 0, 0)
             + assetVram[f.asset] + sprPrio;
    const flip = (flags & (SF_HFLIP | SF_VFLIP)) !== 0;
    let n = sprN;
    for (let i = 0; i < f.count; i++)
    {
        if (n >= MAX_SPR) break;
        const p = ms_pieces[f.piece + i];
        let sx, sy;
        if (!flip)
        {
            sx = x + p.dx;
            sy = y + p.dy;
        }
        else
        {
            sx = x + ((flags & SF_HFLIP) ? s16(f.w - p.dx - p.w) : p.dx);
            sy = y + ((flags & SF_VFLIP) ? s16(f.h - p.dy - (((p.size & 3) + 1) << 3)) : p.dy);
        }
        // off-screen pieces cost a slot for nothing
        if (sprOff(sx, sy)) continue;
        sprPut(n, sx, sy, (p.size << 8) | (n + 1), (base + p.tile) & 0xFFFF);
        n++;
    }
    sprN = n;
}

function spr_raw(x, y, size, attr)
{
    if (sprN >= MAX_SPR) return;
    sprPut(sprN, x, y, (size << 8) | (sprN + 1), attr);
    sprN++;
}

function spr_end()
{
    if (sprN === 0)
    {
        // one sprite parked off-screen keeps the list valid
        spriteCache.fill(0, 0, 4);
        sprN = 1;
    }
    spriteCache[(sprN - 1) * 4 + 1] &= 0xFF00;
    gfx_updateSprites(sprN, UP_LATER);
}

function spr_count()
{
    return sprN;
}

function txt_draw(plane, s, x, y, variant, pal)
{
    const buf = [];
    const n = Math.min(s.length, 40);
    if (hudFont)
    {
        // HUD layout: variants HUD, SEL, DIM of the HUD's glyphs only
        const base = VT_FONT + (variant === FONT_SEL ? HUDFONT_GLYPHS : variant === FONT_DIM ? 2 * HUDFONT_GLYPHS : 0);
        for (let i = 0; i < n; i++)
            buf.push(TILE_ATTR(pal, 1, 0, 0, base + hudfont_lut[font_lut[s.charCodeAt(i) & 127]]));
    }
    else
    {
        for (let i = 0; i < n; i++)
            buf.push(TILE_ATTR(pal, 1, 0, 0, VT_FONT + variant + font_lut[s.charCodeAt(i) & 127]));
    }
    if (n) gfx_setTileMapDataRow(plane, buf, y, x, n, UP_NOW);
}

function txt_clear(plane, x, y, w)
{
    gfx_fillTileMapRect(plane, 0, x, y, w, 1);
}

function txt_u32(v, digits)
{
    let s = String(Math.floor(v) % Math.pow(10, digits));
    while (s.length < digits) s = '0' + s;
    return s;
}
