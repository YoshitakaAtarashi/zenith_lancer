// The game's flow: lives, extends, pause, stage clear, continue, game over.
'use strict';
(function () {

let nextExtend = 0;
let paused = false;
let clearTimer = 0;
let overTimer = 0;
let startColumn = 0;
let contTimer = 0;     // > 0 while "CONTINUE?" counts down
let continues = 0;
let cheated = false;   // invincibility was on: no high score
let quitFade = false;

function contMessage()
{
    const s = divu(contTimer, 60);
    hud_message('CONTINUE?', 'PRESS START   ' + (s > 9 ? 9 : s), 0xFFFF);
}

function stageMusic()
{
    const tab = [MUS_STAGE1, MUS_STAGE2, MUS_STAGE3, MUS_STAGE4, MUS_STAGE5, MUS_STAGE6];
    return tab[curStage];
}

// Both also follow the ship's power (player_power, 0..10): against a bare
// ship bullets are 20% slower and fired 40% less often, against a fully
// armed one 20% faster and 25% more often.
function game_bulletSpeed()
{
    const s = FP(1) + curStage * 3 + loopNum * 10;  // 1.0 px/f in stage 1 .. ~1.9 in stage 6
    return divu(mul16u(s, 80 + 4 * player_power()), 100);
}

function game_fireCd(base)
{
    if (loopNum) base -= base >> 2;
    else if (curStage === 0) base += base >> 1;
    else if (curStage === 1) base += base >> 2;
    else if (curStage === 5) base -= base >> 2;     // the last stage fights hardest
    return s16(divu(mul16u(base, 140 - Math.trunc(13 * player_power() / 2)), 100));
}

function shot_damage(s)
{
    return s.type === SH_MISSILE ? 3 : s.type === SH_LASER ? 1 : 2;
}

function game_addScore(pts)
{
    score += pts;
    if (score >= nextExtend)
    {
        nextExtend += nextExtend === 20000 ? 50000 : 70000;
        if (lives < 9) lives++;
        sound_play(SFX_EXTEND);
    }
}

// After a lost ship: if it had any power-ups, two red capsules drift in
// toward the new one, so a run can recover instead of starting from bare.
function respawn()
{
    const had = pl.speedLv || pl.missile || pl.weapon !== WPN_NORMAL || pl.options || pl.force;
    player_init(false);
    if (had)
    {
        capsule_drop(200, PX(pl.y) - 24, false);
        capsule_drop(232, PX(pl.y) + 24, false);
    }
}

function stageStart(keepPower)
{
    gfx_setEnable(false);
    stage_init(curStage, startColumn);
    video_loadStage(curStage);
    stage_drawInitial();
    gfx_setEnable(true);
    pal_fadeInAll(stage_gfx[curStage].pal, 24, true);

    enemy_init();
    ebullet_init();
    capsule_init();
    fx_init();
    boss_init();
    level_reset(startColumn);
    player_init(keepPower);
    if (cheatInvincible && startColumn)
    {
        // boss rush starts armed so the fight can be checked quickly
        pl.speedLv = 2;
        pl.missile = true;
        pl.weapon = WPN_LASER;
        pl.options = 2;
    }
    hud_init();
    clearTimer = 0;
    overTimer = 0;
    paused = false;
    music_play(stageMusic());
    let line = (demoPlay ? 'DEMO PLAY  STAGE ' : autoPlay ? 'AUTO PLAY  STAGE ' : 'STAGE ') + (curStage + 1);
    if (loopNum) line += '  LOOP ' + (1 + (loopNum > 8 ? 8 : loopNum));
    hud_message(line, stage_title(), 150);
}

function game_start(stage, startCol)
{
    curStage = stage;
    startColumn = startCol;
    score = 0;
    lives = 3;
    continues = 0;
    contTimer = 0;
    cheated = cheatInvincible || !!autoPlay;
    loopNum = 0;
    nextExtend = 20000;
    stageStart(false);
}

// The game over screen stays while its song plays through, then fades
// (24 frames): never shorter than it was, never over 10 s.
function overFrames()
{
    const n = mus_frames[MUS_GAMEOVER - 1] + 24;
    return n < 180 ? 180 : n > 600 ? 600 : n;
}

function game_update()
{
    if (contTimer)
    {
        // the world holds still while the player decides
        const before = divu(contTimer, 60);
        contTimer--;
        if (padPressed & BUTTON_START)
        {
            contTimer = 0;
            continues++;
            lives = 3;
            respawn();
            hud_message('', null, 0);
            sound_play(SFX_EXTEND);
            hud_update();
            return GAME_RUN;
        }
        if (contTimer === 0)
        {
            overTimer = overFrames();
            hud_message('GAME OVER', null, overTimer);
            music_play(MUS_GAMEOVER);
        }
        else if (divu(contTimer, 60) !== before) contMessage();
        hud_update();
        return GAME_RUN;
    }
    if ((padPressed & BUTTON_START) && !overTimer && !clearTimer)
    {
        paused = !paused;
        if (paused) hud_message('PAUSE', 'C BUTTON  QUIT', 0xFFFF);
        else hud_message('', null, 0);
    }
    if (paused && (padPressed & BUTTON_C))
    {
        // quit to the title (the only way out of invincibility but a reset)
        paused = false;
        hud_message('', null, 0);
        pal_fadeOutAll(20, true);
        quitFade = true;
        return GAME_OVER;
    }
    if (paused)
    {
        hud_update();
        return GAME_RUN;
    }

    stage_update();
    level_update();
    player_update();
    enemy_update();
    boss_update();
    enemy_collideShots();
    ebullet_update();
    capsule_update();
    fx_update();

    // death and respawn
    if (!pl.alive && !overTimer)
    {
        if (pl.deadTimer) pl.deadTimer--;
        if (pl.deadTimer === 0)
        {
            if (lives > 1 || autoPlay)
            {
                if (!autoPlay) lives--;    // the auto player never runs out
                respawn();
            }
            else if (optContinue)
            {
                lives = 0;
                contTimer = 60 * 10 - 1;
                contMessage();
            }
            else
            {
                lives = 0;
                overTimer = overFrames();
                hud_message('GAME OVER', null, overTimer);
                music_play(MUS_GAMEOVER);
            }
        }
    }
    if (overTimer)
    {
        if (overTimer === 24) pal_fadeOutAll(24, true);
        overTimer--;
        if (overTimer === 0)
        {
            if (score > hiScore && !cheated)
            {
                hiScore = score;
                options_save();
            }
            return GAME_OVER;
        }
    }

    // stage clear
    if (boss_done() && !clearTimer && pl.alive)
    {
        clearTimer = 300;
        if (boss_killed())
        {
            hud_message('STAGE CLEAR', 'BONUS 5000', 240);
            game_addScore(5000);
        }
        else hud_message('THE GUARDIAN ESCAPED', null, 240);
        music_play(MUS_CLEAR);
    }
    if (clearTimer)
    {
        // fly the ship off to the right once the fanfare is going
        if (clearTimer < 200) pl.x = s16(pl.x + FP(3));
        if (clearTimer === 24) pal_fadeOutAll(24, true);
        if (--clearTimer === 0)
        {
            startColumn = 0;
            if (++curStage >= NUM_STAGES)
            {
                // the ending once: from the second loop on, straight round
                if (!loopNum) return GAME_ENDING;
                game_afterEnding();
                return GAME_RUN;
            }
            stageStart(true);
        }
    }

    hud_update();
    return GAME_RUN;
}

function game_takeQuitFade()
{
    const q = quitFade;
    quitFade = false;
    return q;
}

function game_afterEnding()
{
    curStage = 0;
    loopNum++;
    stageStart(true);
}

function game_draw()
{
    spr_begin();
    hud_drawMessage();
    player_draw();
    ebullet_draw();
    boss_draw();
    enemy_draw();
    capsule_draw();
    fx_draw();
    player_drawShots();
    spr_end();
}

Object.assign(window, {
    game_bulletSpeed, game_fireCd, shot_damage, game_addScore, game_start, game_update,
    game_afterEnding, game_draw, game_takeQuitFade,
});
})();
