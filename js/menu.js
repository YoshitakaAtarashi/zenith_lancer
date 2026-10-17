// The title menu, the options page and the music player.
'use strict';
(function () {

const M_MAIN = 0, M_OPTIONS = 1, M_MUSIC = 2;
const MAIN_ITEMS = 4;

const SONGS = MUS_COUNT - 1;
const LIST_ROWS = 5;
const HINT_ROW = 24;

let song = 0, top = 0, playing = 0;   // music mode: cursor, first visible, now playing (0 = none)
const O_CONTINUE = 0, O_INVINCIBLE = 1, O_STAGE = 2, O_EXIT = 3, O_COUNT = 4;

const ROW0 = 17;

let page = 0, cursor = 0;

function clearRows()
{
    for (let r = ROW0; r < ROW0 + 5; r++) txt_clear(BG_A, 0, r, 40);   // row 23 is the hi score
}

function line(row, label, value, sel)
{
    let buf = (sel ? '> ' : '  ') + label;
    if (value)
    {
        while (buf.length < 18) buf += ' ';
        buf += value;
    }
    txt_clear(BG_A, 0, row, 40);
    txt_draw(BG_A, buf, 9, row, sel ? FONT_GOLD : FONT_TXT, PAL1);
}

function drawMusic()
{
    for (let k = 0; k < LIST_ROWS; k++)
    {
        const i = top + k;
        const row = ROW0 + k;
        txt_clear(BG_A, 0, row, 40);
        if (i >= SONGS) continue;
        const n = i + 1;
        const buf = (i === song ? '>' : ' ') + (n === playing ? '*' : ' ')
            + Math.floor(n / 10) + (n % 10) + ' ' + song_names[i];
        txt_draw(BG_A, buf, 6, row, i === song ? FONT_GOLD : FONT_TXT, PAL1);
    }
    txt_clear(BG_A, 0, HINT_ROW, 40);
    txt_draw(BG_A, 'A PLAY   B BACK', 12, HINT_ROW, FONT_TXT, PAL1);
}

function draw()
{
    clearRows();
    if (page === M_MAIN)
    {
        line(ROW0 + 1, 'GAME START', null, cursor === 0);
        line(ROW0 + 2, 'AUTO PLAY', null, cursor === 1);
        line(ROW0 + 3, 'OPTIONS', null, cursor === 2);
        line(ROW0 + 4, 'MUSIC MODE', null, cursor === 3);
        return;
    }
    if (page === M_MUSIC)
    {
        drawMusic();
        return;
    }
    line(ROW0, 'CONTINUE', optContinue ? 'INFINITE' : 'OFF', cursor === O_CONTINUE);
    line(ROW0 + 1, 'INVINCIBLE', optInvincible ? 'ON' : 'OFF', cursor === O_INVINCIBLE);
    line(ROW0 + 2, 'START STAGE', String(1 + optStartStage), cursor === O_STAGE);
    line(ROW0 + 3, 'EXIT', null, cursor === O_EXIT);
}

function menu_open()
{
    page = M_MAIN;
    cursor = 0;
    draw();
}

// Returns TRUE when the player chose GAME START.
function menu_update()
{
    const p = padPressed;
    if (page === M_MAIN)
    {
        if (p & BUTTON_UP) { cursor = cursor ? cursor - 1 : MAIN_ITEMS - 1; sound_play(SFX_HIT); draw(); }
        if (p & BUTTON_DOWN) { cursor = cursor + 1 >= MAIN_ITEMS ? 0 : cursor + 1; sound_play(SFX_HIT); draw(); }
        if (p & (BUTTON_START | BUTTON_A | BUTTON_C))
        {
            autoPlay = 0;
            if (cursor === 0) return true;
            if (cursor === 1)
            {
                autoPlay = 3;           // the expert pilot
                return true;
            }
            if (cursor === 2)
            {
                page = M_OPTIONS;
                cursor = 0;
                sound_play(SFX_CAPSULE);
            }
            else
            {
                page = M_MUSIC;
                song = 0;
                top = 0;
                playing = 0;
                music_stop();
            }
            draw();
        }
        return false;
    }
    if (page === M_MUSIC)
    {
        if (p & BUTTON_UP) song = song ? song - 1 : SONGS - 1;
        if (p & BUTTON_DOWN) song = song + 1 >= SONGS ? 0 : song + 1;
        if (p & BUTTON_LEFT) song = song >= LIST_ROWS ? song - LIST_ROWS : 0;
        if (p & BUTTON_RIGHT) song = song + LIST_ROWS < SONGS ? song + LIST_ROWS : SONGS - 1;
        if (song < top) top = song;
        if (song >= top + LIST_ROWS) top = song - LIST_ROWS + 1;
        if (p & (BUTTON_A | BUTTON_C | BUTTON_START))
        {
            music_stop();               // restart even if it is the same song
            music_play(song + 1);
            playing = song + 1;
        }
        if (p & (BUTTON_UP | BUTTON_DOWN | BUTTON_LEFT | BUTTON_RIGHT | BUTTON_A | BUTTON_C | BUTTON_START))
            drawMusic();
        if (p & BUTTON_B)
        {
            txt_clear(BG_A, 0, HINT_ROW, 40);
            music_play(MUS_TITLE);
            page = M_MAIN;
            cursor = 3;
            draw();
        }
        return false;
    }
    // options page
    if (p & BUTTON_UP) { cursor = cursor ? cursor - 1 : O_COUNT - 1; sound_play(SFX_HIT); draw(); }
    if (p & BUTTON_DOWN) { cursor = cursor + 1 >= O_COUNT ? 0 : cursor + 1; sound_play(SFX_HIT); draw(); }
    let dir = (p & BUTTON_RIGHT) ? 1 : (p & BUTTON_LEFT) ? -1 : 0;
    if ((p & (BUTTON_A | BUTTON_C)) && cursor !== O_EXIT) dir = 1;
    if (dir)
    {
        switch (cursor)
        {
        case O_CONTINUE:   optContinue ^= 1; break;
        case O_INVINCIBLE: optInvincible ^= 1; break;
        case O_STAGE:
            if (dir > 0) optStartStage = optStartStage + 1 >= NUM_STAGES ? 0 : optStartStage + 1;
            else optStartStage = optStartStage ? optStartStage - 1 : NUM_STAGES - 1;
            break;
        }
        if (cursor !== O_EXIT) { sound_play(SFX_POWERUP); draw(); }
    }
    if ((p & (BUTTON_B | BUTTON_START)) || ((p & (BUTTON_A | BUTTON_C)) && cursor === O_EXIT))
    {
        options_save();
        page = M_MAIN;
        cursor = 2;
        draw();
    }
    return false;
}

Object.assign(window, { menu_open, menu_update });
})();
