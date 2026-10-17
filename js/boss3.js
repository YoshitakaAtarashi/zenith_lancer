'use strict';
(function () {

const TENT = 4;
const SEGS = 5;
const CYCLE = 360;         // closed 0..149, opening ..165, open ..329, closing ..359

const segX = Array.from({ length: TENT }, () => new Int16Array(SEGS));
const segY = Array.from({ length: TENT }, () => new Int16Array(SEGS));
// per-arm boxes, this frame
const tbx0 = new Int16Array(TENT), tby0 = new Int16Array(TENT), tbx1 = new Int16Array(TENT), tby1 = new Int16Array(TENT);
const rootDX = [88, 108, 108, 88];
const rootDY = [16, 44, 84, 112];
const rootAng = [176, 150, 106, 80];   // pointing up-left .. down-left

function lidPhase()
{
    return modu(boss.t, CYCLE);
}

function lidFrame()
{
    const p = lidPhase();
    if (p < 150) return 0;
    if (p < 166) return 1;
    if (p < 330) return 2;
    return 1;
}

const tentF = [newFastSpr(), newFastSpr()];

function start()
{
    spr_fastPrepare(tentF[0], FR_TENTACLE, 0);
    spr_fastPrepare(tentF[1], FR_TENTACLE + 1, 0);
    boss.x = SCREEN_W;
    boss.y = 40;
    boss.hp = 28 + (loopNum ? 12 : 0);
}

// Each frame recomputes two of the four arms (they sway slowly enough
// that a 30 Hz update per arm does not show).
function tentacles(all)
{
    const t = boss.t & 255;
    for (let k = (all ? 0 : (boss.t & 1)); k < TENT; k += (all ? 1 : 2))
    {
        let x = boss.x + rootDX[k];
        let y = boss.y + rootDY[k];
        let ang = rootAng[k];
        for (let s = 0; s < SEGS; s++)
        {
            // each joint bends a little more, travelling wave along the arm
            ang = (ang + (isin((t * 2 + k * 64 + s * 24) & 255) >> 6)) & 255;
            x = s16(x + s16(mul16s(icos(ang), 14) >> 8));
            y = s16(y + s16(mul16s(isin(ang), 14) >> 8));
            segX[k][s] = x;
            segY[k][s] = y;
        }
        let x0 = 32767, y0 = 32767, x1 = -32767, y1 = -32767;
        for (let s = 0; s < SEGS; s++)
        {
            if (segX[k][s] < x0) x0 = segX[k][s];
            if (segX[k][s] > x1) x1 = segX[k][s];
            if (segY[k][s] < y0) y0 = segY[k][s];
            if (segY[k][s] > y1) y1 = segY[k][s];
        }
        tbx0[k] = x0 - 12; tbx1[k] = x1 + 12;
        tby0[k] = y0 - 12; tby1[k] = y1 + 12;
    }
}

function attack()
{
    const p = lidPhase();
    if (p < 150)
    {
        // shut: tentacle tips take turns
        if (modu(boss.t, loopNum ? 22 : 34) === 0)
        {
            const k = modu(divu(boss.t, 34), TENT);
            ebullet_aim(segX[k][SEGS - 1], segY[k][SEGS - 1], FP(1) + 10);
        }
    }
    else if (p >= 166 && p < 330)
    {
        if (modu(p, 40) === 6)
            ebullet_spread(boss.x + 36, boss.y + 64, FP(1) + 14, loopNum ? 9 : 7, 12);
    }
}

function update()
{
    if (boss.state === B_ENTER)
    {
        boss.x -= 1;
        if (boss.x <= 176) { boss.state = B_FIGHT; boss.t = 0; }
    }
    else if (boss.state === B_FIGHT)
    {
        const ty = 40 + (isin(boss.t & 255) >> 3);
        if ((boss.t & 1) === 0) boss.y += (ty > boss.y) - (ty < boss.y);
        attack();
    }
    tentacles(boss.state !== B_FIGHT);
    if (boss.state !== B_LEAVE)
    {
        boss_contactRect(boss.x + 24, boss.y + 20, boss.x + 120, boss.y + 112);
        const px = PX(pl.x), py = PX(pl.y);
        for (let k = 0; k < TENT; k++)
            if (px >= tbx0[k] && px <= tbx1[k] && py >= tby0[k] && py <= tby1[k])
            for (let s = 2; s < SEGS; s++)
                boss_contactRect(segX[k][s] - 8, segY[k][s] - 8, segX[k][s] + 8, segY[k][s] + 8);
    }
}

function shotHit(s, x, y)
{
    // nothing of the boss reaches further left than this
    if (x < boss.x - 24) return FALSE;
    // tentacles soak shots (each arm's box first)
    for (let k = 0; k < TENT; k++)
        if (x >= tbx0[k] && x <= tbx1[k] && y >= tby0[k] && y <= tby1[k])
        for (let seg = 0; seg < SEGS; seg++)
            if (abs(x - segX[k][seg]) < 10 && abs(y - segY[k][seg]) < 10)
            {
                shot_kill(s, TRUE);
                return TRUE;
            }
    const ex = boss.x + 48, ey = boss.y + 64;
    if (abs(x - ex) < 26 && abs(y - ey) < 26)
    {
        shot_kill(s, TRUE);
        if (lidFrame() === 2)
        {
            boss.hp = s16(boss.hp - boss_dmg(s));
            boss.flash = 4;
            if (boss.hp <= 0) boss_beginDeath(14000);
            else boss_hitSound();
        }
        else sound_play(SFX_SHIELDHIT);
        return TRUE;
    }
    if (boss_inRect(x, y, boss.x + 20, boss.y + 16, boss.x + 124, boss.y + 116))
    {
        shot_kill(s, TRUE);
        return TRUE;
    }
    return FALSE;
}

function draw()
{
    const sc = { n: 0 };
    sc_begin(sc);
    for (let k = 0; k < TENT; k++)
        for (let s = 0; s < SEGS; s++)
            sc_put(sc, tentF[s === SEGS - 1 ? 1 : 0], segX[k][s] - 12, segY[k][s] - 12);
    sc_end(sc);
    const lid = lidFrame();
    if (lid)
    {
        // the iris looks at the player
        let dx = (PX(pl.x) - (boss.x + 48)) >> 4;
        let dy = (PX(pl.y) - (boss.y + 64)) >> 4;
        if (dx < -5) dx = -5;
        if (dx > 2) dx = 2;
        if (dy < -4) dy = -4;
        if (dy > 4) dy = 4;
        if (lid === 2)
            spr_q(FR_IRIS, boss.x + 32 + dx * 2, boss.y + 48 + dy * 2, (boss.flash & 1) ? SF_PAL(1) : 0);
    }
    spr_q(FR_EYELID + lid, boss.x + 16, boss.y + 32, (boss.flash & 1) ? SF_PAL(1) : 0);
}

window.boss3 = { start, update, draw, shotHit, width: 128, height: 128, reach: [-24, -64, 140, 196], bodyX: 0, bodyY: 0, bodySelf: FALSE };
})();
