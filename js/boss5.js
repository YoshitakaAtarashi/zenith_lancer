'use strict';
(function () {

// One attack cycle, in frames: doors shut, opening, charging (core open and
// safe to approach), firing the main beam, closing.
const SHUT_END = 120;
const OPEN_END = 140;
const CHARGE_END = 200;
const BEAM_END = 260;
const CYCLE = 290;
const PODS = 2;

const podDX = [75, 75];
const podDY = [0, 84];

function phase()
{
    return modu(boss.t, CYCLE);
}

// 0 = shut .. 22 = wide open
function doorOpen()
{
    const p = phase();
    if (p < SHUT_END) return 0;
    if (p < OPEN_END) return (p - SHUT_END) + 2;
    if (p < BEAM_END) return 22;
    return ((CYCLE - 1 - p) * 3) >> 2;   // 30 frames -> 22 px
}

function firing()
{
    const p = phase();
    return p >= CHARGE_END && p < BEAM_END;
}

function start()
{
    boss.x = SCREEN_W;      // the plane A hull wraps if it starts further right
    boss.y = 56;
    boss.hp = 40 + (loopNum ? 12 : 0);
    for (let i = 0; i < PODS; i++) boss.partHp[i] = 14;
}

function attack()
{
    const p = phase();
    const t = boss.t;
    for (let i = 0; i < PODS; i++)
        if (boss.partHp[i] > 0 && modu(t + i * 30, loopNum ? 44 : 64) === 0)
            ebullet_aim(boss.x + podDX[i] + 12, boss.y + podDY[i] + 12, FP(1) + 12);
    // the bridge sprays while the doors are shut
    if (p < SHUT_END && modu(t, 90) === 45)
        ebullet_spread(boss.x + 120, boss.y + 6, FP(1), 5, 14);
    if (p === OPEN_END) sound_play(SFX_ALARM);
    if (p >= OPEN_END && p < CHARGE_END && (t & 3) === 0)
        fx_spark(boss.x + 33 - (random() & 15), boss.y + 48 + (random() & 7) - 4);
    if (p === CHARGE_END)
    {
        sound_play(SFX_BIGEXPLODE);
        stage_shake(12, 1);
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
        // hold still while firing so the beam can be dodged
        if (!firing() && phase() < OPEN_END) boss_trackY(PX(pl.y) - 48, 4, PLAY_H - 104, 1);
        attack();
        if (firing())
        {
            const cy = boss.y + 48;
            const py = PX(pl.y);
            if (PX(pl.x) < boss.x + 33 && py > cy - 13 && py < cy + 13) player_kill();
        }
    }
    if (boss.state !== B_LEAVE)
        boss_contactRect(boss.x + 9, boss.y + 15, boss.x + 192, boss.y + 81);
}

function shotHit(s, x, y)
{
    const bx = boss.x, by = boss.y;
    for (let i = 0; i < PODS; i++)
    {
        if (boss.partHp[i] <= 0) continue;
        const px = bx + podDX[i] + 12, py = by + podDY[i] + 12;
        if (abs(x - px) < 12 && abs(y - py) < 12)
        {
            boss.partHp[i] -= boss_dmg(s);
            boss.partFlash[i] = 4;
            shot_kill(s, TRUE);
            if (boss.partHp[i] <= 0)
            {
                fx_explode(px, py, TRUE);
                sound_play(SFX_BIGEXPLODE);
                game_addScore(2000);
            }
            else boss_hitSound();
            return TRUE;
        }
    }
    // The bay is open to the front: at its height nothing stops a shot
    // before the doors / core. (The old hull had a nose in front of the bay
    // that swallowed every shot aimed at the core.)
    if (y >= by + 33 && y < by + 63)
    {
        if (x < bx + 27) return FALSE;
        shot_kill(s, TRUE);
        // any visible opening counts
        if (doorOpen() > 4 && x < bx + 63)
        {
            boss.hp = s16(boss.hp - boss_dmg(s));
            boss.flash = 4;
            if (boss.hp <= 0) boss_beginDeath(18000);
            else boss_hitSound();
        }
        else sound_play(SFX_SHIELDHIT);
        return TRUE;
    }
    if (boss_inRect(x, y, bx + 6, by + 12, bx + 192, by + 84))
    {
        shot_kill(s, TRUE);
        return TRUE;
    }
    return FALSE;
}

function draw()
{
    const bx = boss.x, by = boss.y;
    if (firing())
    {
        // the main cannon's beam, three rows thick, out to the left edge
        const f = (boss.t >> 1) & 1;
        for (let x = bx + 33 - 32; x > -32; x -= 32)
        {
            spr_q(FR_BEAM + f, x, by + 36, 0);
            spr_q(FR_BEAM + (f ^ 1), x, by + 44, 0);
            spr_q(FR_BEAM + f, x, by + 52, 0);
        }
    }
    for (let i = 0; i < PODS; i++)
        if (boss.partHp[i] > 0)
            spr_q(FR_POD + ((boss.t >> 3) & 1), bx + podDX[i], by + podDY[i],
                     (boss.partFlash[i] & 1) ? SF_PAL(1) : 0);
    // the doors as the bay shows them (clipped frames: the hull is a plane)
    const o = doorOpen();
    spr_q(FR_BAYDOORS + (o < 3 ? 0 : o < 9 ? 1 : o < 16 ? 2 : 3), bx + 33, by + 30, 0);
    const cf = (phase() >= OPEN_END && phase() < BEAM_END) ? 2 - ((boss.t >> 2) & 1) : modu(boss.t >> 3, 3);
    spr_q(FR_B5CORE + cf, bx + 33, by + 36, (boss.flash & 1) ? SF_PAL(1) : 0);
}

window.boss5 = { start, update, draw, shotHit, width: 192, height: 96, reach: [0, -6, 198, 114], bodyX: 0, bodyY: 0, bodySelf: FALSE };
})();
