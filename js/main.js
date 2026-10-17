// Start-up, the title screen and the main loop.
'use strict';
(function () {

const ST_TITLE = 0, ST_MENU = 1, ST_GAME = 2, ST_ENDING = 3;

let titleT = 0;
let selStage = 0;     // hidden stage select (hold A, press left/right)
let selUsed = false;
let inMenu = false;

function readPad()
{
    const s = pad_read(PAD_1);
    padPressed = s & ~padHeld;
    padHeld = s;
}

function drawStageSel()
{
    if (selStage) txt_draw(BG_A, 'START STAGE ' + (1 + selStage), 13, 19, FONT_TXT, PAL1);
    else txt_clear(BG_A, 13, 19, 13);
}

function titleSetup()
{
    gfx_setEnable(false);
    gfx_setWindowOff();
    gfx_clearPlane(BG_A, true);
    gfx_clearPlane(WINDOW, true);
    video_loadTitle();
    // the illustration fills plane B; the logo sits over its sky
    for (let ty = 0; ty < 9; ty++)
        gfx_setTileMapDataRow(BG_A, logo_map, 1 + ty, 0, 40, UP_NOW, ty * 40);
    txt_draw(BG_A, 'A HORIZONTAL SHOOTING GAME', 7, 11, FONT_TXT, PAL1);
    txt_draw(BG_A, 'HI SCORE ' + txt_u32(hiScore, 8), 12, 23, FONT_GOLD, PAL1);
    txt_draw(BG_A, '(C)2026 Y.ATARASHI', 11, 26, FONT_TXT, PAL1);
    stage_titleBackdrop(0, true);
    drawStageSel();
    gfx_setEnable(true);
    music_play(MUS_TITLE);
    titleT = 0;
    inMenu = false;
}

// The title's demo: left alone this long, the title plays a stage by
// AUTO PLAY (each time the next one) to its own song, for DEMO_FRAMES or
// until a button.
const DEMO_IDLE = 60 * 15;
const DEMO_FRAMES = 60 * 30;
let idleT = 0, demoT = 0, demoStage = 0;

function titleUpdate()
{
    titleT = (titleT + 1) & 0xFFFF;
    if (padPressed) idleT = 0;
    else idleT++;
    stage_titleBackdrop((titleT * 2) & 0xFFFF, false);
    if (!inMenu)
    {
        if (titleT & 32)
            txt_draw(BG_A, 'PUSH START BUTTON', 12, 21, FONT_TXT, PAL1);
        else
            txt_clear(BG_A, 12, 21, 17);
    }
    if (padHeld & BUTTON_A)
    {
        if (padPressed & BUTTON_RIGHT) { selStage = selStage + 1 >= NUM_STAGES ? 0 : selStage + 1; selUsed = true; drawStageSel(); }
        if (padPressed & BUTTON_LEFT) { selStage = selStage ? selStage - 1 : NUM_STAGES - 1; selUsed = true; drawStageSel(); }
    }
    spr_begin();
    spr_end();
    return (padPressed & BUTTON_START) !== 0;
}

// back from the demo (or any game) to the title: the music is the game's
// again, the title's song still playing if it was
function endDemo()
{
    demoPlay = false;
    music_lock(false);
    idleT = 0;
}

async function main()
{
    video_init();
    sound_init();
    music_init();
    pad_init();
    options_load();

    let state = ST_TITLE;
    titleSetup();
    idleT = 0;
    padHeld = 0xFFFF;   // ignore buttons held through reset
    let autoHeld = 0;

    while (true)
    {
        readPad();
        frameCount = (frameCount + 1) & 0xFFFF;
        frame: {
            if (state === ST_TITLE)
            {
                const start = titleUpdate();
                if (!start && idleT >= DEMO_IDLE)
                {
                    // the demo, to the title's song
                    await pal_fadeOutAll(20, false);
                    demoPlay = true;
                    demoT = 0;
                    music_lock(true);
                    autoplay_start(3);
                    cheatInvincible = false;
                    setRandomSeed(titleT);
                    game_start(demoStage, 0);
                    demoStage = demoStage + 1 >= NUM_STAGES ? 0 : demoStage + 1;
                    state = ST_GAME;
                    break frame;
                }
                if (start)
                {
                    // test codes: A+B+C+Start = invincible, B+C+Start = invincible,
                    // armed, starting just before the boss. Plain Start opens the menu.
                    const abc = BUTTON_A | BUTTON_B | BUTTON_C;
                    const bc = BUTTON_B | BUTTON_C;
                    if ((padHeld & bc) === bc)
                    {
                        cheatInvincible = true;
                        setRandomSeed(titleT);
                        const st = selUsed ? selStage : optStartStage;
                        game_start(st, (padHeld & abc) === bc ? level_bossCol(st) : 0);
                        state = ST_GAME;
                    }
                    else
                    {
                        pal_interruptFade();
                        txt_clear(BG_A, 12, 21, 17);
                        txt_clear(BG_A, 13, 25, 13);
                        txt_clear(BG_A, 0, 11, 40);
                        video_dimTitle();
                        inMenu = true;
                        menu_open();
                        state = ST_MENU;
                    }
                }
            }
            else if (state === ST_MENU)
            {
                titleT = (titleT + 1) & 0xFFFF;
                stage_titleBackdrop((titleT * 2) & 0xFFFF, false);
                spr_begin();
                spr_end();
                if (menu_update())
                {
                    await pal_fadeOutAll(20, false);
                    if (autoPlay) autoplay_start(autoPlay);
                    cheatInvincible = !!optInvincible;
                    setRandomSeed(titleT);
                    game_start(selUsed ? selStage : optStartStage, 0);
                    state = ST_GAME;
                }
            }
            else if (state === ST_GAME)
            {
                if (autoPlay)
                {
                    // the real pad only stops the demo; the auto player flies
                    const quit = demoPlay ? (padPressed !== 0 || ++demoT >= DEMO_FRAMES)
                                          : (padPressed & BUTTON_START) !== 0;
                    const s = autoplay_pad();
                    padPressed = s & ~autoHeld;
                    padHeld = autoHeld = s;
                    if (quit)
                    {
                        autoPlay = 0;
                        await pal_fadeOutAll(20, false);
                        endDemo();
                        state = ST_TITLE;
                        titleSetup();
                        padHeld = 0xFFFF;
                        break frame;
                    }
                }
                const r = game_update();
                if (game_takeQuitFade()) await pal_waitFade();
                if (r === GAME_OVER || (r === GAME_ENDING && demoPlay))
                {
                    autoPlay = 0;
                    endDemo();
                    state = ST_TITLE;
                    titleSetup();
                    padHeld = 0xFFFF;
                }
                else if (r === GAME_ENDING)
                {
                    ending_start();
                    state = ST_ENDING;
                }
                else
                {
                    game_draw();
                    if (autoPlay) autoplay_think();
                }
            }
            else
            {
                if (!ending_update())
                {
                    game_afterEnding();
                    state = ST_GAME;
                }
            }
        }
        sound_update();
        music_update();
        await nextFrame();
        music_frameDone();
    }
}

window.game_main = main;
})();
