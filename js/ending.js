// The ending: a few pages of text, then the next loop.
'use strict';
(function () {

const PAGE_MIN = 330;          // frames a page shows at the least

// Lines are centred one by one: the credits' are padded to one length so
// their two columns line up.
const pages = [
    ['THE ZENITH GATE FALLS SILENT.', '', 'ITS LIGHT, AT LAST, GOES OUT.', null, null],
    ['THE LANCER TURNS FOR HOME', '', 'ACROSS SIX BROKEN WORLDS.', null, null],
    ['BASALT REACH   GLACIER VEIL  ', 'HIVE NEBULA    SUNKEN ARCHIVE', 'IRON CITADEL   ZENITH GATE   ', null, null],
    ['ZENITH LANCER', '',
     'DIRECTION       Y.ATARASHI',
     'MUSIC COMPOSE   Y.ATARASHI',
     'PROGRAM, ART    CLAUDE    '],
    ['THANK YOU FOR PLAYING', '', 'BUT THE STARS ARE RESTLESS...', 'THE NEXT LOOP BEGINS', null],
];
const NPAGES = pages.length;

let t = 0, page = 0, pageFrames = 0;
let total = 0;     // frames since the ending began

function drawPage()
{
    // rows 28-31 of plane A may hold title tiles
    gfx_clearTileMapRect(BG_A, 0, 0, 64, 28);
    for (let i = 0; i < 5; i++)
    {
        const s = pages[page][i];
        if (!s) continue;
        txt_draw(BG_A, s, (40 - s.length) >> 1, 10 + i * 2, i === 0 ? FONT_GOLD : FONT_TXT, PAL1);
    }
}

function ending_start()
{
    gfx_setEnable(false);
    gfx_setWindowOff();
    gfx_clearPlane(BG_A, true);
    gfx_clearPlane(WINDOW, true);
    video_loadTitle();
    video_dimTitle();
    stage_titleBackdrop(0, true);
    gfx_setEnable(true);
    t = 0;
    total = 0;
    page = 0;
    pageFrames = divu(mus_frames[MUS_ENDING - 1], NPAGES);
    if (pageFrames < PAGE_MIN) pageFrames = PAGE_MIN;
    drawPage();
    music_play(MUS_ENDING);
}

function ending_update()
{
    t++;
    total++;
    stage_titleBackdrop(total, false);
    if (page + 1 < NPAGES)
    {
        if (t >= pageFrames || ((padPressed & BUTTON_START) && t > 30))
        {
            t = 0;
            page++;
            drawPage();
        }
    }
    else if (t >= pageFrames || (padPressed & BUTTON_START))
    {
        // the last page: over once the song has come round, Start or not
        if (total >= mus_frames[MUS_ENDING - 1])
            return false;
    }
    spr_begin();
    // the ship drifts home, right to left, flipped
    const sx = SCREEN_W - modu((total >> 2) & 0xFFFF, SCREEN_W + 64);
    spr_meta(FR_SHIP, sx, 160, SF_HFLIP);
    spr_meta(FR_FLAME + ((t >> 1) & 1), sx + 30, 163, SF_HFLIP);
    spr_end();
    return true;
}

Object.assign(window, { ending_start, ending_update });
})();
