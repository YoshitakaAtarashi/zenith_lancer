'use strict';
(function () {

const SHUTTERS = 3;
const shutX = [-24, -4, 16];  // front to back, relative to x

function start()
{
    boss.x = SCREEN_W;      // a body wider than 184 px must not start past 320
    boss.y = 40;
    boss.hp = 32 + (loopNum ? 12 : 0);
    for (let i = 0; i < SHUTTERS; i++) boss.partHp[i] = 10;
}

function bare()
{
    return boss.partHp[SHUTTERS - 1] <= 0;
}

function attack()
{
    const t = boss.t;
    const period = loopNum ? 36 : 52;
    // the two gun turrets, top and bottom, take turns
    if (modu(t, period) === 0)
        ebullet_aim(boss.x + 100, (divu(t, period) & 1) ? boss.y + 110 : boss.y + 18,
                    game_bulletSpeed() + 4);
    const bt = modu(t, 170);
    if (bt >= 100 && bt < 130 && modu(bt, 10) === 0)
    {
        beam_fire(boss.x + 8, boss.y + 46);
        beam_fire(boss.x + 8, boss.y + 82);
        sound_play(SFX_LASER);
    }
    // once the core is bare it panics: radial bursts
    if (bare() && modu(t, 90) === 45)
    {
        for (let k = 0; k < 8; k++)
        {
            const a = (k * 32 + (t & 16)) & 255;
            ebullet_fire(boss.x + 52, boss.y + 64, (icos(a) * 3) >> 5, (isin(a) * 3) >> 5);
        }
    }
}

function update()
{
    if (boss.state === B_ENTER)
    {
        boss.x -= 1;
        if (boss.x <= 124) { boss.state = B_FIGHT; boss.t = 0; }
    }
    else if (boss.state === B_FIGHT)
    {
        boss_trackY(PX(pl.y) - 64, 4, PLAY_H - 136, 2);
        attack();
    }
    if (boss.state !== B_LEAVE)
    {
        const px = PX(pl.x), py = PX(pl.y);
        if (boss_inRect(px, py, boss.x + 24, boss.y + 12, boss.x + 192, boss.y + 116) &&
            !boss_inRect(px, py, boss.x, boss.y + 44, boss.x + 60, boss.y + 86))
            player_kill();
    }
}

function shotHit(s, x, y)
{
    const bx = boss.x, by = boss.y;
    if (y >= by + 42 && y < by + 88)
    {
        for (let i = 0; i < SHUTTERS; i++)
        {
            if (boss.partHp[i] <= 0) continue;
            if (x < bx + shutX[i]) return FALSE;   // not there yet
            boss.partHp[i] -= boss_dmg(s);
            boss.partFlash[i] = 4;
            if (boss.partHp[i] <= 0)
            {
                fx_explode(bx + shutX[i] + 8, by + 56, TRUE);
                fx_explode(bx + shutX[i] + 8, by + 76, TRUE);
                sound_play(SFX_BIGEXPLODE);
                stage_shake(10, 2);
                game_addScore(1000);
            }
            else boss_hitSound();
            shot_kill(s, TRUE);
            return TRUE;
        }
        if (x < bx + 36) return FALSE;
        if (y >= by + 48 && y < by + 80)
        {
            boss.hp = s16(boss.hp - boss_dmg(s));
            boss.flash = 4;
            shot_kill(s, TRUE);
            if (boss.hp <= 0) boss_beginDeath(10000);
            else boss_hitSound();
            return TRUE;
        }
        shot_kill(s, TRUE);   // notch wall
        return TRUE;
    }
    if (boss_inRect(x, y, bx + 24, by + 12, bx + 192, by + 116))
    {
        shot_kill(s, TRUE);
        return TRUE;
    }
    return FALSE;
}

function draw()
{
    const t = boss.t;
    let coreFr = modu(t >> 3, 3);
    if (bare()) coreFr = 2 - ((t >> 2) & 1);
    for (let i = 0; i < SHUTTERS; i++)
        if (boss.partHp[i] > 0)
            spr_q(FR_SHUTTER + (boss.partFlash[i] ? 1 : 0), boss.x + shutX[i], boss.y + 40, 0);
    spr_q(FR_B1CORE + coreFr, boss.x + 36, boss.y + 48, (boss.flash & 1) ? SF_PAL(1) : 0);
}

window.boss1 = { start, update, draw, shotHit, width: 192, height: 128, reach: [-32, 0, 200, 128], bodyX: 0, bodyY: 0, bodySelf: FALSE };
})();
