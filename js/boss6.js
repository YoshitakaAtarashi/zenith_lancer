'use strict';
(function () {

const SATS = 8;

function start()
{
    boss.x = SCREEN_W + 40;   // core centre
    boss.y = 104;
    boss.phase = 0;
    boss.hp = 50 + (loopNum ? 20 : 0);
    for (let i = 0; i < SATS; i++) boss.partHp[i] = 6 + (loopNum ? 3 : 0);
    boss.a = 0;
}

function satsLeft()
{
    let n = 0;
    for (let i = 0; i < SATS; i++)
        if (boss.partHp[i] > 0) n++;
    return n;
}

function halo()
{
    // the fewer satellites remain, the faster the halo turns
    boss.a = s16(boss.a + 1 + ((SATS - satsLeft()) >> 2));
    for (let i = 0; i < SATS; i++)
    {
        const ang = ((boss.a & 255) + i * 32) & 255;
        boss.partX[i] = boss.x + s16(mul16s(icos(ang), 50) >> 8);
        boss.partY[i] = boss.y + s16(mul16s(isin(ang), 42) >> 8);
    }
}

function attack()
{
    const t = boss.t;
    if (boss.phase === 0)
    {
        if (modu(t, loopNum ? 14 : 20) === 0)
        {
            // next live satellite in turn fires at the player
            let k = modu(divu(t, 20), SATS);
            for (let n = 0; n < SATS; n++, k = (k + 1) & 7)
                if (boss.partHp[k] > 0)
                {
                    ebullet_aim(boss.partX[k], boss.partY[k], FP(1) + 8);
                    break;
                }
        }
    }
    else if (boss.phase === 2)
    {
        if ((t & 7) === 0)
        {
            const a = (t << 1) & 255;
            ebullet_fire(boss.x, boss.y, icos(a) >> 3, isin(a) >> 3);
            ebullet_fire(boss.x, boss.y, icos((a + 128) & 255) >> 3, isin((a + 128) & 255) >> 3);
        }
        if (modu(t, 110) === 55)
            ebullet_spread(boss.x - 12, boss.y, FP(2), loopNum ? 7 : 5, 10);
        if (boss.hp < (boss.hp0 >> 1) && modu(t, 70) === 0)   // half health
        {
            beam_fire(boss.x - 20, boss.y - 10);
            beam_fire(boss.x - 20, boss.y + 10);
        }
    }
}

function update()
{
    if (boss.state === B_ENTER)
    {
        boss.x -= 1;
        if (boss.x <= 220) { boss.state = B_FIGHT; boss.t = 0; }
    }
    else if (boss.state === B_FIGHT)
    {
        if (boss.phase === 0 && satsLeft() === 0)
        {
            boss.phase = 1;
            boss.c = 0;
            ebullet_clear();
            sound_play(SFX_BIGEXPLODE);
        }
        if (boss.phase === 1)
        {
            // cracking open
            if ((boss.c & 7) === 0)
                fx_explode(boss.x - 12 + (random() & 23), boss.y - 12 + (random() & 23), FALSE);
            boss.c = s16(boss.c + 1);
            if (boss.c > 90) { boss.phase = 2; sound_play(SFX_ALARM); }
        }
        const ty = 104 + Math.trunc((isin((boss.t >> 1) & 255) >> 3) * 5 / 2);
        if ((boss.t & 1) === 0) boss.y += (ty > boss.y) - (ty < boss.y);
        attack();
    }
    halo();
    if (boss.state !== B_LEAVE)
    {
        boss_contactRect(boss.x - 18, boss.y - 18, boss.x + 18, boss.y + 18);
        for (let i = 0; i < SATS; i++)
            if (boss.partHp[i] > 0)
                boss_contactRect(boss.partX[i] - 6, boss.partY[i] - 6, boss.partX[i] + 6, boss.partY[i] + 6);
    }
}

function shotHit(s, x, y)
{
    for (let i = 0; i < SATS; i++)
    {
        if (boss.partHp[i] <= 0) continue;
        if (abs(x - boss.partX[i]) < 8 && abs(y - boss.partY[i]) < 8)
        {
            boss.partHp[i] -= boss_dmg(s);
            boss.partFlash[i] = 4;
            shot_kill(s, TRUE);
            if (boss.partHp[i] <= 0)
            {
                fx_explode(boss.partX[i], boss.partY[i], TRUE);
                sound_play(SFX_BIGEXPLODE);
                game_addScore(1500);
            }
            else boss_hitSound();
            return TRUE;
        }
    }
    if (abs(x - boss.x) < 21 && abs(y - boss.y) < 21)
    {
        shot_kill(s, TRUE);
        if (boss.phase === 2)
        {
            boss.hp = s16(boss.hp - boss_dmg(s));
            boss.flash = 4;
            if (boss.hp <= 0)
            {
                for (let k = 0; k < 6; k++)
                    fx_explode(boss.x - 20 + (random() & 39), boss.y - 20 + (random() & 39), TRUE);
                boss_beginDeath(50000);
            }
            else boss_hitSound();
        }
        else sound_play(SFX_SHIELDHIT);
        return TRUE;
    }
    return FALSE;
}

function draw()
{
    for (let i = 0; i < SATS; i++)
        if (boss.partHp[i] > 0)
            spr_q(FR_ZSAT + ((boss.t >> 3) & 1), boss.partX[i] - 8, boss.partY[i] - 8,
                     (boss.partFlash[i] & 1) ? SF_PAL(1) : 0);
    const f = boss.phase === 0 ? 0 : boss.phase === 1 ? 1 : 2;
    spr_q(FR_ZCORE + f, boss.x - 24, boss.y - 24, (boss.flash & 1) ? SF_PAL(1) : 0);
}

// death explosions use x,y as a top-left box, so give it the core's span
window.boss6 = { start, update, draw, shotHit, width: 40, height: 40, reach: [-66, -56, 66, 56], bodyX: -88, bodyY: -88, bodySelf: FALSE };
})();
