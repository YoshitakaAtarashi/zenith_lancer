// The ship, its options, weapons and the power-up gauge.
'use strict';
(function () {

// This frame's shot sprites, written as the shots move (see spr_stage);
// a shot destroyed later in the frame parks its sprite above the screen.
const shotSpr = new Uint32Array(MAX_SHOTS * 2);
let shotSprN = 0;
// Live shots per source (ship + options) and type, kept up to date as
// shots are made and lost (shotNew / shotGone), and the free slots.
const counts = Array.from({ length: MAX_OPTIONS + 1 }, () => new Uint8Array(5));
// Laser segments are the most numerous objects in the game, so with many
// options the sources share a budget instead of each having three.
const LASER_BUDGET = 10;
let laserTotal = 0;
let shotFree = 0;

function shotGone(s)
{
    counts[s.src][s.type]--;
    if (s.type === SH_LASER) laserTotal--;
    shotFree++;
    s.type = SH_NONE;
}

const trailX = new Int16Array(TRAIL_LEN), trailY = new Int16Array(TRAIL_LEN);
let trailHead = 0;

const speedTab = [22, 30, 38, 46, 54, 62];

const FORCE_HP = 10;

function trailFill(x, y)
{
    trailX.fill(x);
    trailY.fill(y);
    trailHead = 0;
}

function player_clearShots()
{
    for (let i = 0; i < MAX_SHOTS; i++) shots[i].type = SH_NONE;
    shotSprN = 0;
    for (const c of counts) c.fill(0);
    laserTotal = 0;
    shotFree = MAX_SHOTS;
}

const shotF = newFastSpr(), diagF = newFastSpr();
const laserF = [newFastSpr(), newFastSpr()], missileF = [newFastSpr(), newFastSpr()];
const optionF = [newFastSpr(), newFastSpr(), newFastSpr(), newFastSpr()];

function player_init(keepPower)
{
    spr_fastPrepare(shotF, FR_SHOT, 0);
    spr_fastPrepare(diagF, FR_SHOTDIAG, 0);
    for (let k = 0; k < 2; k++)
    {
        spr_fastPrepare(laserF[k], FR_LASER + k, 0);
        spr_fastPrepare(missileF[k], FR_MISSILE + k, 0);
    }
    for (let k = 0; k < 4; k++) spr_fastPrepare(optionF[k], FR_OPTION + k, 0);
    pl.x = FP(56);
    pl.y = FP(96);
    pl.alive = true;
    pl.deadTimer = 0;
    pl.invuln = 120;
    pl.tilt = 0;
    pl.fireTimer = 0;
    pl.anim = 0;
    if (!keepPower)
    {
        pl.speedLv = 0;
        pl.missile = false;
        pl.weapon = WPN_NORMAL;
        pl.options = 0;
        pl.force = 0;
        pl.gauge = -1;
    }
    trailFill(PX(pl.x), PX(pl.y));
    for (let i = 0; i < MAX_OPTIONS; i++)
    {
        optX[i] = PX(pl.x);
        optY[i] = PX(pl.y);
    }
    player_clearShots();
}

function player_power()
{
    const p = (pl.speedLv > 3 ? 3 : pl.speedLv) + (pl.missile ? 1 : 0) + pl.options
          + (pl.weapon === WPN_LASER ? 2 : pl.weapon === WPN_DOUBLE ? 1 : 0) + (pl.force ? 1 : 0);
    return p > 10 ? 10 : p;
}

function gauge_available(slot)
{
    switch (slot)
    {
    case G_SPEED:   return pl.speedLv < 5;
    case G_MISSILE: return !pl.missile;
    case G_DOUBLE:  return pl.weapon !== WPN_DOUBLE;
    case G_LASER:   return pl.weapon !== WPN_LASER;
    case G_OPTION:  return pl.options < MAX_OPTIONS;
    case G_FORCE:   return pl.force < FORCE_HP / 2;
    }
    return false;
}

function player_capsule()
{
    pl.gauge++;
    if (pl.gauge >= G_NUM) pl.gauge = 0;
    sound_play(SFX_CAPSULE);
}

function usePower()
{
    if (pl.gauge < 0 || !gauge_available(pl.gauge)) return;
    switch (pl.gauge)
    {
    case G_SPEED:   pl.speedLv++; break;
    case G_MISSILE: pl.missile = true; break;
    case G_DOUBLE:  pl.weapon = WPN_DOUBLE; break;
    case G_LASER:   pl.weapon = WPN_LASER; break;
    case G_OPTION:
        // a new option appears at the end of the trail
        optX[pl.options] = PX(pl.x);
        optY[pl.options] = PX(pl.y);
        pl.options++;
        break;
    case G_FORCE:   pl.force = FORCE_HP; break;
    }
    pl.gauge = -1;
    sound_play(SFX_POWERUP);
}

// Free-slot search resumes where the last one left off: a volley from
// five sources asks for many slots in a row.
let shotHint = 0;

function shotNew(type, src)
{
    if (!shotFree) return null;
    let i = shotHint;
    for (let k = 0; k < MAX_SHOTS; k++)
    {
        if (shots[i].type === SH_NONE)
        {
            shotHint = (i + 1 < MAX_SHOTS) ? i + 1 : 0;
            const s = shots[i];
            s.type = type;
            s.src = src;
            counts[src][type]++;
            if (type === SH_LASER) laserTotal++;
            shotFree--;
            return s;
        }
        if (++i >= MAX_SHOTS) i = 0;
    }
    return null;
}

function shotCount(type, src)
{
    return counts[src][type];
}

function fireFrom(src, x, y)
{
    let s;
    let sfx = false;
    if (pl.weapon === WPN_LASER)
    {
        if (shotCount(SH_LASER, src) < 3 && laserTotal < LASER_BUDGET && (s = shotNew(SH_LASER, src)))
        {
            s.hitId = 0xFF;
            s.x = FP(x + 4);
            s.y = FP(y);
            s.vx = FP(10);
            s.vy = 0;
            sfx = true;
        }
    }
    else
    {
        if (shotCount(SH_SHOT, src) < (pl.weapon === WPN_DOUBLE ? 1 : 2) && (s = shotNew(SH_SHOT, src)))
        {
            s.x = FP(x + 10);
            s.y = FP(y);
            s.vx = FP(9);
            s.vy = 0;
            sfx = true;
        }
        if (pl.weapon === WPN_DOUBLE && shotCount(SH_DIAG, src) < 1 && (s = shotNew(SH_DIAG, src)))
        {
            s.x = FP(x + 6);
            s.y = FP(y - 4);
            s.vx = FP(6);
            s.vy = -FP(6);
            sfx = true;
        }
    }
    if (pl.missile && shotCount(SH_MISSILE, src) < 1 && (s = shotNew(SH_MISSILE, src)))
    {
        s.state = 0;
        s.x = FP(x);
        s.y = FP(y + 6);
        s.vx = FP(2);
        s.vy = FP(2);
        sound_play(SFX_MISSILE);
    }
    return sfx;
}

// Fire the guns whose turn it is: all of them on a fresh press; held down,
// the ship and each option take turns frame by frame (each still every 4
// frames), which spreads the work of a volley over the frames.
function fire(all, phase)
{
    let sfx = false;
    if (all || phase === 0) sfx = fireFrom(0, PX(pl.x), PX(pl.y)) || sfx;
    for (let i = 0; i < pl.options; i++)
        if (all || ((i + 1 + phase) & 3) === 0) sfx = fireFrom(i + 1, optX[i], optY[i]) || sfx;
    if (sfx && (all || phase === 0)) sound_play(pl.weapon === WPN_LASER ? SFX_LASER : SFX_SHOT);
}

function shot_kill(s, spark)
{
    if (!s.type) return;
    if (spark) fx_spark(PX(s.x), PX(s.y));
    shotGone(s);
    if (s.spr < MAX_SHOTS) shotSpr[s.spr * 2] = 0;
}

function updateShots()
{
    let sp = 0;
    const lf = laserF[frameCount & 1];
    for (let i = 0; i < MAX_SHOTS; i++)
    {
        const s = shots[i];
        if (s.type === SH_NONE) continue;
        s.spr = sp;
        if (s.type === SH_LASER)
        {
            // Lasers fly level at a fixed speed: no bounds on y.
            s.x = s16(s.x + FP(10));
            const lx = PX(s.x);
            if (lx > SCREEN_W + 16) { shotGone(s); continue; }
            const ly = PX(s.y);
            spr_stage(shotSpr, sp++, lf, lx, ly - 4);
            // (the rock by turns: the segment is 32 px long)
            if (!((i ^ frameCount) & 1) && !stageOpen && stage_solid(lx + 28, ly))
                shot_kill(s, !enemy_iceShot(lx + 28, ly) && (frameCount & 1));
            continue;
        }
        if (s.type === SH_MISSILE)
        {
            let sx = PX(s.x);
            let sy = PX(s.y);
            if ((i ^ frameCount) & 1)
            {
                // (the rock every other frame, by turns)
                if (s.state === 0) { s.x = s16(s.x + s.vx); s.y = s16(s.y + s.vy); }
                else s.x = s16(s.x + FP(3));
                sx = PX(s.x);
                sy = PX(s.y);
                if (sx > SCREEN_W + 8 || sy > PLAY_H + 8) { shotGone(s); continue; }
                spr_stage(shotSpr, sp++, missileF[s.state], sx - 4, sy - 4);
                continue;
            }
            const wx = cameraX + sx;
            const fl = stage_floorAt(wx);
            if (s.state === 0)
            {
                s.x = s16(s.x + s.vx);
                s.y = s16(s.y + s.vy);
                sy = PX(s.y);
                if (sy + 3 >= fl)
                {
                    s.state = 1;
                    s.y = FP(fl - 3);
                }
                else if (sy < stage_ceilAt(wx))
                {
                    shot_kill(s, true);
                    continue;
                }
            }
            else
            {
                s.x = s16(s.x + FP(3));
                const nfl = stage_floorAt(wx + 3);
                if (nfl >= NO_FLOOR)
                {
                    s.state = 0;   // ran off a ledge: fall again
                }
                else if (nfl < sy - 3)
                {
                    shot_kill(s, !enemy_iceShot(sx + 4, sy));   // hit a wall
                    continue;
                }
                else s.y = FP(nfl - 3);
            }
            sx = PX(s.x);
            sy = PX(s.y);
            if (sx > SCREEN_W + 8 || sy > PLAY_H + 8) { shotGone(s); continue; }
            spr_stage(shotSpr, sp++, missileF[s.state], sx - 4, sy - 4);
            continue;
        }
        s.x = s16(s.x + s.vx);
        const sx = PX(s.x);
        if (s.vy) s.y = s16(s.y + s.vy);
        const sy = PX(s.y);
        if (sx > SCREEN_W + 16 || sy < -8 || sy > PLAY_H)
        {
            shotGone(s);
            continue;
        }
        if (s.type === SH_SHOT) spr_stage(shotSpr, sp++, shotF, sx - 12, sy - 4);
        else spr_stage(shotSpr, sp++, diagF, sx - 4, sy - 4);
        if ((i ^ frameCount) & 1) continue;
        const tipX = sx + 4;
        if (!stageOpen && stage_solid(tipX, sy))
            shot_kill(s, !enemy_iceShot(tipX, sy));
    }
    shotSprN = sp;
}

function updateOptions()
{
    for (let i = 0; i < pl.options; i++)
    {
        const k = (trailHead - (i + 1) * OPT_SPACING) & (TRAIL_LEN - 1);
        optX[i] = trailX[k];
        optY[i] = trailY[k];
    }
}

function terrainHit()
{
    const x = PX(pl.x);
    const y = PX(pl.y);
    return stage_solid(x + 13, y) || stage_solid(x - 10, y - 3) || stage_solid(x - 10, y + 3)
        || stage_solid(x + 2, y - 3) || stage_solid(x + 2, y + 3);
}

function player_kill()
{
    if (!pl.alive || pl.invuln || cheatInvincible) return;
    pl.alive = false;
    pl.deadTimer = 150;
    fx_explode(PX(pl.x), PX(pl.y), true);
    fx_explode(PX(pl.x) - 10, PX(pl.y) + 4, false);
    fx_explode(PX(pl.x) + 10, PX(pl.y) - 4, false);
    sound_play(SFX_DIE);
    stage_shake(20, 2);
}

function player_hitTest(x, y, hw, hh)
{
    if (!pl.alive || pl.invuln) return false;
    const px = PX(pl.x) + 1;
    const py = PX(pl.y);
    // the ship's own hitbox is a forgiving 8x4
    return (abs(px - x) < hw + 4) && (abs(py - y) < hh + 2);
}

function player_update()
{
    if (!pl.alive)
    {
        updateShots();
        return;
    }
    pl.anim = (pl.anim + 1) & 0xFFFF;
    if (pl.invuln) pl.invuln--;

    const sp = speedTab[pl.speedLv];
    const ox = pl.x, oy = pl.y;
    pl.tilt = 0;
    if (padHeld & BUTTON_LEFT) pl.x -= sp;
    if (padHeld & BUTTON_RIGHT) pl.x += sp;
    if (padHeld & BUTTON_UP) { pl.y -= sp; pl.tilt = -1; }
    if (padHeld & BUTTON_DOWN) { pl.y += sp; pl.tilt = 1; }
    if (pl.x < FP(stage_leftLimit())) pl.x = FP(stage_leftLimit());
    if (pl.x > FP(SCREEN_W - 24)) pl.x = FP(SCREEN_W - 24);
    if (pl.y < FP(8)) pl.y = FP(8);
    if (pl.y > FP(playBottom)) pl.y = FP(playBottom);

    if (pl.x !== ox || pl.y !== oy)
    {
        trailHead = (trailHead + 1) & (TRAIL_LEN - 1);
        trailX[trailHead] = PX(pl.x);
        trailY[trailHead] = PX(pl.y);
    }
    updateOptions();

    if (padPressed & BTN_POWER) usePower();

    if (pl.fireTimer) pl.fireTimer--;
    if (padPressed & BTN_FIRE)
    {
        // a fresh press always fires at once (tapping beats autofire)
        fire(true, 0);
        pl.fireTimer = 4;
    }
    else if (padHeld & BTN_FIRE)
    {
        if (pl.fireTimer === 0) pl.fireTimer = 4;
        fire(false, pl.fireTimer & 3);
    }

    updateShots();

    if (!pl.invuln && !stageOpen && terrainHit()) player_kill();
}

const optCursor = { n: 0 };

function player_draw()
{
    if (!pl.alive) return;
    const x = PX(pl.x);
    const y = PX(pl.y);
    const show = !(pl.invuln && (pl.anim & 2));
    if (show)
    {
        const fr = pl.tilt < 0 ? 1 : pl.tilt > 0 ? 2 : 0;
        spr_q(FR_SHIP + fr, x - 16, y - 9, 0);
        spr_q(FR_FLAME + ((pl.anim >> 1) & 1), x - 22, y - 6, 0);
    }
    if (pl.force > 0 && (pl.force > 3 || (pl.anim & 4)))
        spr_q(FR_SHIELD + modu(pl.anim >> 2, FR_SHIELD_N), x + 8, y - 16, 0);
    const sc = optCursor;
    sc_begin(sc);
    const of = optionF[(pl.anim >> 2) & 3];
    for (let i = 0; i < pl.options; i++)
        sc_put(sc, of, optX[i] - 8, optY[i] - 8);
    sc_end(sc);
}

function player_drawShots()
{
    spr_copyStaged(shotSpr, shotSprN, 0);
}

Object.assign(window, {
    player_init, player_update, player_draw, player_drawShots, player_kill, player_hitTest,
    player_capsule, player_clearShots, player_power, gauge_available, shot_kill,
});
})();
