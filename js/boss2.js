'use strict';
(function () {

const SHARDS = 6;

function start()
{
    boss.x = SCREEN_W + 8;    // top-left of the 32x48 crystal
    boss.y = 80;
    boss.hp = 52 + (loopNum ? 16 : 0);
    for (let i = 0; i < SHARDS; i++) boss.partHp[i] = 5;
    boss.a = 0;               // orbit angle, 1/256 turns
}

function orbit()
{
    const angry = boss.hp < (boss.hp0 >> 1);   // half health
    boss.a = s16(boss.a + (angry ? 3 : 2));    // 1/256 turns per frame
    const base = boss.a & 255;
    const r = angry ? 36 + (isin((boss.t * 2) & 255) >> 5) : 36;
    const cx = boss.x + 16, cy = boss.y + 24;
    for (let i = 0; i < SHARDS; i++)
    {
        const ang = (base + i * 43) & 255;
        boss.partX[i] = cx + s16(mul16s(icos(ang), r) >> 8);
        boss.partY[i] = cy + s16(mul16s(isin(ang), r) >> 8);
    }
}

function attack()
{
    const t = boss.t;
    const cx = boss.x + 16, cy = boss.y + 24;
    if (modu(t, loopNum ? 60 : 80) === 0)
        ebullet_spread(cx - 8, cy, game_bulletSpeed() + 2, 5, 10);
    if (modu(t, 150) === 75)
    {
        const off = (t >> 1) & 255;
        for (let k = 0; k < 12; k++)
        {
            const a = (off + k * 21) & 255;
            ebullet_fire(cx, cy, icos(a) >> 3, isin(a) >> 3);
        }
    }
    if (boss.hp < (boss.hp0 >> 1) && modu(t, 45) === 20)
        ebullet_aim(cx, cy, FP(2));
}

function update()
{
    if (boss.state === B_ENTER)
    {
        boss.x -= 1;
        if (boss.x <= 172) { boss.state = B_FIGHT; boss.t = 0; }
    }
    else if (boss.state === B_FIGHT)
    {
        // slow bob, a little sway toward the player
        const ty = 80 + Math.trunc((isin(boss.t & 255) >> 3) * 5 / 4);
        boss.y += (ty > boss.y) - (ty < boss.y);
        const tx = 162 + (isin((boss.t >> 1) & 255) >> 4);
        if ((boss.t & 3) === 0) boss.x += (tx > boss.x) - (tx < boss.x);
        attack();
    }
    orbit();
    if (boss.state !== B_LEAVE)
    {
        boss_contactRect(boss.x + 6, boss.y + 6, boss.x + 26, boss.y + 42);
        boss_contactRect(boss.x + 48, boss.y - 40, boss.x + 168, boss.y + 104);
        for (let i = 0; i < SHARDS; i++)
            if (boss.partHp[i] > 0)
                boss_contactRect(boss.partX[i] - 5, boss.partY[i] - 5, boss.partX[i] + 5, boss.partY[i] + 5);
    }
}

function shotHit(s, x, y)
{
    for (let i = 0; i < SHARDS; i++)
    {
        if (boss.partHp[i] <= 0) continue;
        if (abs(x - boss.partX[i]) < 8 && abs(y - boss.partY[i]) < 8)
        {
            boss.partHp[i] -= boss_dmg(s);
            boss.partFlash[i] = 4;
            shot_kill(s, TRUE);
            if (boss.partHp[i] <= 0)
            {
                fx_explode(boss.partX[i], boss.partY[i], FALSE);
                sound_play(SFX_EXPLODE);
                game_addScore(500);
            }
            else boss_hitSound();
            return TRUE;
        }
    }
    const cx = boss.x + 16, cy = boss.y + 24;
    // the crystal's diamond: |dx|/13 + |dy|/22 <= 1
    const dx = abs(x - cx), dy = abs(y - cy);
    if (dx < 14 && mul16u(dx, 22) + mul16u(dy, 13) <= 22 * 13)
    {
        boss.hp = s16(boss.hp - boss_dmg(s));
        boss.flash = 4;
        shot_kill(s, TRUE);
        if (boss.hp <= 0) boss_beginDeath(12000);
        else boss_hitSound();
        return TRUE;
    }
    if (boss_inRect(x, y, boss.x + 44, boss.y - 44, boss.x + 168, boss.y + 104))
    {
        shot_kill(s, TRUE);   // the ice fortress
        return TRUE;
    }
    return FALSE;
}

function draw()
{
    const t = boss.t;
    for (let i = 0; i < SHARDS; i++)
        if (boss.partHp[i] > 0)
            spr_q(FR_CRYOSHARD + ((boss.partFlash[i] || ((t >> 3) & 1)) ? 1 : 0),
                     boss.partX[i] - 8, boss.partY[i] - 8, (boss.partFlash[i] & 1) ? SF_PAL(1) : 0);
    spr_q(FR_CRYOCORE + ((t >> (boss.hp < (boss.hp0 >> 1) ? 2 : 3)) & 3), boss.x, boss.y,
             (boss.flash & 1) ? SF_PAL(1) : 0);
}

window.boss2 = { start, update, draw, shotHit, width: 160, height: 112, reach: [-40, -56, 172, 108], bodyX: -8, bodyY: -56, bodySelf: FALSE };
})();
