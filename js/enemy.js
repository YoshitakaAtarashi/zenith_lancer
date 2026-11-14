// Enemies, enemy bullets, boss beams and capsules.
'use strict';
(function () {

// Worms: the head is an enemy; its body segments follow the head's path.
const MAX_WORMS = 3;
const WORM_SEGS = 7;
const WORM_GAP = 5;
const WORM_HIST = 64;
const wormX = Array.from({ length: MAX_WORMS }, () => new Int16Array(WORM_HIST));
const wormY = Array.from({ length: MAX_WORMS }, () => new Int16Array(WORM_HIST));
const wormHead = new Uint8Array(MAX_WORMS);
const wormUsed = [false, false, false];
// this frame's segment positions and the box round them (updWorm)
const wsegX = Array.from({ length: MAX_WORMS }, () => new Int16Array(WORM_SEGS));
const wsegY = Array.from({ length: MAX_WORMS }, () => new Int16Array(WORM_SEGS));
const wbx0 = new Int16Array(MAX_WORMS), wbx1 = new Int16Array(MAX_WORMS);
const wby0 = new Int16Array(MAX_WORMS), wby1 = new Int16Array(MAX_WORMS);

// fast-path sprites; ebF: the blink
const ebF = [newFastSpr(), newFastSpr()];
// the clams (64 x 48: several pieces) and their bubbles, resolved once
const CLAM_PIECES = 6;
const clamF = [Array.from({ length: CLAM_PIECES }, () => newFastSpr()), Array.from({ length: CLAM_PIECES }, () => newFastSpr())];
const bubF = [newFastSpr()];
const clamN = new Uint8Array(2);
const beamF = [newFastSpr(), newFastSpr()];
const wormF = newFastSpr();

// Formation bookkeeping: a capsule appears when every member was shot.
const MAX_GROUPS = 8;
const groupLeft = new Uint8Array(MAX_GROUPS);
const groupClean = [false, false, false, false, false, false, false, false];

let nextGroup = 1;

function enemy_newGroup(members)
{
    const g = nextGroup;
    nextGroup = nextGroup >= MAX_GROUPS - 1 ? 1 : nextGroup + 1;
    groupLeft[g] = members;
    groupClean[g] = TRUE;
    return g;
}

function enemy_init()
{
    for (let i = 0; i < MAX_ENEMIES; i++)
    {
        enemies[i].type = EN_NONE;
        enemies[i].id = i;
    }
    for (let i = 0; i < MAX_GROUPS; i++) groupLeft[i] = 0;
    clamsAwake = 0;
    for (let i = 0; i < MAX_WORMS; i++) wormUsed[i] = FALSE;
    if (assetVram[AS_WORMBODY]) spr_fastPrepare(wormF, FR_WORMBODY, 0);
    if (assetVram[AS_CLAM])
    {
        for (let k = 0; k < 2; k++)
        {
            const f = ms_frames[FR_CLAM + k];
            clamN[k] = f.count < CLAM_PIECES ? f.count : CLAM_PIECES;
            for (let i = 0; i < clamN[k]; i++)
            {
                const p = ms_pieces[f.piece + i];
                const q = clamF[k][i];
                q.attr = TILE_ATTR(f.pal, 0, 0, 0, assetVram[f.asset] + p.tile);
                q.dx = p.dx;
                q.dy = p.dy;
                q.sizeLink = p.size << 8;
            }
        }
        spr_fastPrepare(bubF[0], FR_BUBBLET + 1, 0);
    }
}

function enemy_count()
{
    let n = 0;
    for (let i = 0; i < MAX_ENEMIES; i++)
        if (enemies[i].type) n++;
    return n;
}

function groupLost(e, shot)
{
    if (!e.group) return;
    const g = e.group;
    if (!shot) groupClean[g] = FALSE;
    if (groupLeft[g]) groupLeft[g]--;
    if (groupLeft[g] === 0 && groupClean[g] && shot)
        capsule_drop(PX(e.x), PX(e.y), FALSE);
    e.group = 0;
}

function dropBeam(e)
{
    if (e.pb) { pbeam_free(e.pb); e.pb = null; }
}

function despawn(e)
{
    dropBeam(e);
    if (e.type === EN_FLARE) flareClear(e);
    if (e.type === EN_LANCE) lanceClear();
    if (e.type === EN_CLAM) clamGone(e);
    if (e.type === EN_WORM && e.a >= 0) wormUsed[e.a] = FALSE;
    groupLost(e, FALSE);
    e.type = EN_NONE;
}

function enemy_spawn(type, x, y, flags)
{
    let e = null;
    for (let i = 0; i < MAX_ENEMIES; i++)
        if (!enemies[i].type) { e = enemies[i]; break; }
    if (!e) return null;
    e.type = type;
    e.flags = flags & 0xFF;
    e.group = 0;
    e.x = FP(x);
    e.y = FP(y);
    e.vx = 0;
    e.vy = 0;
    e.t = 0;
    e.a = 0;
    e.b = 0;
    e.flash = 0;
    e.pb = null;
    e.c = 0;
    e.d = 0;
    e.cd = s16(game_fireCd(20 + (random() & 63)));
    switch (type)
    {
    case EN_FAN:    e.hp = 1;  e.hw = 6;  e.hh = 6;  e.score = 100; e.vx = -FP(3); break;
    case EN_DART:   e.hp = 1;  e.hw = 7;  e.hh = 5;  e.score = 150; e.vx = -FP(2) - 8; break;
    case EN_TURRET: e.hp = 2;  e.hw = 6;  e.hh = 6;  e.score = 200; break;
    case EN_WALKER: e.hp = 2;  e.hw = 6;  e.hh = 7;  e.score = 200; e.vx = -FP(1) + 4; break;
    case EN_HATCH:  e.hp = 14; e.hw = 13; e.hh = 7;  e.score = 1000; break;
    case EN_MINI:   e.hp = 1;  e.hw = 4;  e.hh = 3;  e.score = 50;  break;
    case EN_ROCK:   e.hp = 2;  e.hw = 6;  e.hh = 6;  e.score = 30;  break;
    case EN_CRAB:   e.hp = 16; e.hw = 13; e.hh = 9;  e.score = 800; e.vx = -FP(1); break;
    case EN_VOLCANO: e.hp = 1; e.hw = 0;  e.hh = 0;  e.score = 0;   e.flags |= EF_NOSHOT | EF_GROUND; break;
    case EN_ICICLE: e.hp = 1;  e.hw = 4;  e.hh = 10; e.score = 100; break;
    case EN_FLAKE:  e.hp = 1;  e.hw = 6;  e.hh = 6;  e.score = 100; e.vx = -FP(2); e.b = s16(y); break;
    case EN_SLED:   e.hp = 3;  e.hw = 11; e.hh = 6;  e.score = 300; e.vx = -FP(2); break;
    case EN_SPORE:  e.hp = 2;  e.hw = 6;  e.hh = 6;  e.score = 150; e.vx = -FP(1); e.b = s16(y); break;
    case EN_AMOEBA: e.hp = 6;  e.hw = 9;  e.hh = 9;  e.score = 400; e.vx = -FP(1) + 4; break;
    case EN_CELL:   e.hp = 1;  e.hw = 5;  e.hh = 5;  e.score = 100; break;
    case EN_JELLY:  e.hp = 2;  e.hw = 6;  e.hh = 7;  e.score = 150; e.vx = -8; break;
    case EN_FISH:   e.hp = 1;  e.hw = 6;  e.hh = 3;  e.score = 100; e.vx = -FP(2); e.b = s16(y); break;
    case EN_MINE:   e.hp = 1;  e.hw = 6;  e.hh = 6;  e.score = 200; e.vx = -8; e.b = s16(y); break;
    case EN_BLOCK:  e.hp = 6;  e.hw = 8;  e.hh = 16; e.score = 100; break;
    case EN_CANNON: e.hp = 10; e.hw = 13; e.hh = 9;  e.score = 1000; break;
    case EN_ORB:    e.hp = 4;  e.hw = 6;  e.hh = 6;  e.score = 500; e.vx = -FP(2); break;
    case EN_LANCER: e.hp = 2;  e.hw = 11; e.hh = 4;  e.score = 300; break;
    case EN_GATE:   e.hp = 8;  e.hw = 7;  e.hh = 7;  e.score = 500; break;
    case EN_LCANNON: e.hp = 12; e.hw = 14; e.hh = 7; e.score = 1500; break;
    case EN_BARRIER: e.hp = 1; e.hw = 7;  e.hh = 7;  e.score = 0;   e.flags |= EF_NOSHOT; break;
    case EN_CLAM:   e.hp = 12; e.hw = 12; e.hh = 9;  e.score = 1500; break;
    case EN_FLARE:  e.hp = 1;  e.hw = 0;  e.hh = 0;  e.score = 0;   e.flags |= EF_NOSHOT; break;
    case EN_LANCE:  e.hp = 1;  e.hw = 0;  e.hh = 0;  e.score = 0;   e.flags |= EF_NOSHOT; break;
    case EN_CUBE:   e.hp = 2;  e.hw = 14; e.hh = 14; e.score = 30;  e.flags |= EF_GROUND; break;
    case EN_WORM:
    {
        e.hp = 8;  e.hw = 6;  e.hh = 6;  e.score = 1500; e.vx = -FP(1) - 8; e.b = s16(y);
        e.a = -1;
        for (let k = 0; k < MAX_WORMS; k++)
            if (!wormUsed[k])
            {
                wormUsed[k] = TRUE;
                wormHead[k] = 0;
                for (let h = 0; h < WORM_HIST; h++) { wormX[k][h] = x; wormY[k][h] = y; }
                for (let g = 0; g < WORM_SEGS; g++) { wsegX[k][g] = x; wsegY[k][g] = y; }
                wbx0[k] = 1; wbx1[k] = 0;   // no box until it first moves
                e.a = k;
                break;
            }
        if (e.a < 0) e.type = EN_NONE;   // no trail slot free: skip it
        break;
    }
    }
    // armour walls: a bare ship must be able to break through in time
    if (type === EN_BLOCK) e.hp = 2 + (player_power() >> 1);
    // hit points are in half-shots: a normal shot does 2, a laser 1
    e.hp = s16(e.hp << 1);
    if (loopNum && type !== EN_VOLCANO) e.hp = s16(e.hp + (e.hp >> 1));
    return e;
}

// Where an enemy will be k frames from now (fixed point), for the auto
// player: most fly straight (ground units also drift with the scroll),
// worms and fish ride a sine of their own clock.
// C wrote through pointers (s16 *x, s16 *y); here it returns { x, y }.
function enemy_predict(e, k)
{
    let nx = s16(e.x + s16(e.vx * s16(k)));
    if (e.flags & EF_GROUND) nx = s16(nx - FP(s16(scrollStep * k)));
    let y;
    switch (e.type)
    {
    case EN_WORM: y = s16(FP(e.b) + Math.trunc(mul16s(isin(((e.t + k) * 3) & 255), 9) / 4)); break;
    case EN_FISH: y = s16(FP(e.b) + (isin(((e.t + k) * 4) & 255) >> 4) * 16); break;
    default:      y = s16(e.y + s16(e.vy * s16(k))); break;
    }
    if (e.flags & EF_GROUND) y = s16(y - FP(s16(scrollStepY * k)));
    return { x: nx, y: y };
}

// Worm body segments within (r px of) a point, with where each will be
// dts[j] frames on (up to 5 moments): a segment goes where the head was,
// so that is in the trail (moments past the head's present place fall
// back on it).
// xs, ys: arrays (length >= max) of Int16Array(5), filled in place.
function enemy_wormAhead(px, py, r, dts, ndt, xs, ys, max)
{
    let n = 0;
    for (let k = 0; k < MAX_WORMS && n < max; k++)
    {
        if (!wormUsed[k]) continue;
        for (let s = 1; s <= WORM_SEGS && n < max; s++)
        {
            const h = (wormHead[k] - s * WORM_GAP) & (WORM_HIST - 1);
            if (abs(wormX[k][h] - px) >= r || abs(wormY[k][h] - py) >= r) continue;
            for (let j = 0; j < ndt; j++)
            {
                const back = s16(s * WORM_GAP - dts[j]);
                const hj = back > 0 ? (wormHead[k] - back) & (WORM_HIST - 1) : wormHead[k];
                xs[n][j] = wormX[k][hj];
                ys[n][j] = wormY[k][hj];
            }
            n++;
        }
    }
    return n;
}

function enemy_killAll(withScore)
{
    for (let i = 0; i < MAX_ENEMIES; i++)
    {
        const e = enemies[i];
        if (!e.type || (e.flags & EF_NOSHOT)) continue;
        const x = PX(e.x), y = PX(e.y);
        if (x < -8 || x > SCREEN_W + 8) continue;
        fx_explode(x, y, e.hw > 10);
        if (withScore) game_addScore(e.score);
        despawn(e);
    }
}

function destroy(e)
{
    const x = PX(e.x), y = PX(e.y);
    const big = e.hw > 10 && e.type !== EN_CUBE;    // (ice shatters: one burst, sparks)
    fx_explode(x, y, big);
    if (big)
    {
        fx_explode(x - 8, y + 4, FALSE);
        fx_explode(x + 8, y - 4, FALSE);
    }
    sound_play(big ? SFX_BIGEXPLODE : SFX_EXPLODE);
    if (big) stage_shake(6, 1);
    game_addScore(e.score);
    if (e.flags & EF_CARRIER) capsule_drop(x, y, FALSE);
    groupLost(e, TRUE);
    dropBeam(e);
    if (e.type === EN_CUBE) { fx_spark(x - 4, y - 4); fx_spark(x + 4, y + 4); }
    if (e.type === EN_CLAM) clamGone(e);
    const type = e.type;
    e.type = EN_NONE;
    switch (type)
    {
    case EN_MINE:
    case EN_SPORE:      // bursts: a ring of bullets, thinner against a weak ship
    {
        const n = loopNum ? 12 : 5 + divu(player_power(), 3);
        const step = divu(256, n) & 255;
        for (let k = 0; k < n; k++)
        {
            const a = (k * step + 16) & 255;
            ebullet_fire(x, y, icos(a) >> 3, isin(a) >> 3);
        }
        break;
    }
    case EN_AMOEBA:     // splits in two
    {
        let c = enemy_spawn(EN_CELL, x, y - 4, 0);
        if (c) { c.vx = -FP(1); c.vy = -FP(1) - 4; }
        c = enemy_spawn(EN_CELL, x, y + 4, 0);
        if (c) { c.vx = -FP(1); c.vy = FP(1) + 4; }
        break;
    }
    case EN_WORM:
        if (e.a >= 0)
        {
            const k = e.a;
            for (let s = 1; s <= WORM_SEGS; s++)
            {
                const h = (wormHead[k] - s * WORM_GAP) & (WORM_HIST - 1);
                fx_explode(wormX[k][h], wormY[k][h], FALSE);
            }
            wormUsed[k] = FALSE;
        }
        break;
    }
}

function enemy_damage(e, dmg)
{
    if (e.flags & EF_NOSHOT) return;
    if (e.type === EN_CLAM && !e.a)
    {
        // asleep, it is stone: the shot is spent on it (a spark now and
        // then: a laser held on it would make one every frame)
        if (!(e.t & 3) && e.flash === 0)
        {
            e.flash = 2;
            fx_spark(PX(e.x) - 8 + (random() & 15), PX(e.y) + 4);
        }
        return;
    }
    e.hp = s16(e.hp - dmg);
    if (e.hp <= 0) destroy(e);
    else
    {
        e.flash = 3;
        sound_play(SFX_HIT);
    }
}

function bulletSpeed()
{
    return game_bulletSpeed();
}

function inFireZone(e)
{
    const x = PX(e.x);
    return x > 24 && x < SCREEN_W - 16 && pl.alive;
}

// ------------------------------------------------------------------ behaviours

function updFan(e)
{
    const py = pl.y;
    switch (e.a)
    {
    case 0:
        if (e.x < FP(e.b)) { e.a = 1; e.t = 0; }
        break;
    case 1:   // swing round toward the player's height
        e.vx += 6;
        e.vy = (py > e.y) ? FP(2) : -FP(2);
        if (abs(py - e.y) < FP(2)) e.vy = 0;
        if (e.vx >= FP(3)) { e.vx = FP(3) + 8; e.vy = 0; e.a = 2; }
        break;
    case 2:
        if (e.t === 50 && loopNum && inFireZone(e)) ebullet_aim(PX(e.x), PX(e.y), bulletSpeed());
        break;
    }
}

function updDart(e)
{
    const dy = s16(pl.y - e.y);
    if (e.t < 90)
    {
        if (dy > FP(4)) e.vy += 2;
        else if (dy < -FP(4)) e.vy -= 2;
        if (e.vy > FP(1)) e.vy = FP(1);
        if (e.vy < -FP(1)) e.vy = -FP(1);
    }
    if (e.t === 36 && (curStage || loopNum) && inFireZone(e)) ebullet_aim(PX(e.x), PX(e.y), bulletSpeed());
}

function updTurret(e)
{
    e.cd = s16(e.cd - 1);
    if (e.cd <= 0)
    {
        e.cd = s16(game_fireCd(110));
        if (inFireZone(e))
            ebullet_aim(PX(e.x), PX(e.y) + ((e.flags & EF_CEIL) ? 4 : -4), bulletSpeed());
    }
}

function updWalker(e)
{
    const wx = cameraX + PX(e.x);
    const ahead = (e.vx < 0) ? -6 : 6;
    let g;
    if (e.flags & EF_CEIL) g = stage_ceilAt(wx + ahead) + 8;
    else g = stage_floorAt(wx + ahead) - 8;
    if (abs(g - PX(e.y)) > 6 || g <= 8 || g >= NO_FLOOR - 8)
        e.vx = s16(-e.vx);      // too steep (or a ledge): turn round
    else
        e.y = FP(g);
    // walk toward the player, loosely
    if ((e.t & 63) === 0)
        e.vx = (pl.x < e.x) ? -FP(1) + 4 : FP(1) - 4;
    e.cd = s16(e.cd - 1);
    if (e.cd <= 0)
    {
        e.cd = s16(game_fireCd(96));
        if (inFireZone(e)) ebullet_aim(PX(e.x), PX(e.y), bulletSpeed());
    }
}

function updHatch(e)
{
    const x = PX(e.x);
    // a = door state 0..3, b = fighters launched
    const gentle = curStage === 0 && !loopNum;
    // a weak ship faces fewer fighters (4 .. 7 by power)
    const count = gentle ? 4 : (4 + divu(player_power(), 3) + loopNum * 2) & 0xFFFF;
    if (x < SCREEN_W - 40 && e.b < count)
    {
        if (e.a < 3 && (e.t & 7) === 0) e.a++;
        if (e.a === 3 && modu(e.t, gentle ? 48 : 32) === 0)
        {
            const ceil = (e.flags & EF_CEIL) !== 0;
            const m = enemy_spawn(EN_MINI, x, PX(e.y) + (ceil ? 8 : -8), ceil ? EF_CEIL : 0);
            if (m) m.vy = ceil ? FP(2) : -FP(2);
            e.b++;
        }
    }
    else if (e.b >= count && e.a > 0 && (e.t & 7) === 0) e.a--;
}

// Hatch fighters home in on the player. On the first loop of stage 1 they
// steer much more lazily, for less time, and fly slower.
function updMini(e)
{
    const gentle = curStage === 0 && !loopNum;
    const speed = gentle ? FP(1) + 10 : FP(2) + 8;
    const turn = gentle ? 1 : 3;              // vertical acceleration per frame
    const maxVy = gentle ? 6 : FP(1);         // 0.4 px/f vs 1 px/f
    const until = gentle ? 50 : 80;           // frames of homing
    if (e.t === 18)
    {
        e.vx = (pl.x < e.x) ? -speed : speed;
        e.vy = 0;
    }
    if (e.t > 18 && e.t < until)
    {
        const dy = s16(pl.y - e.y);
        if (dy > FP(2)) e.vy += turn;
        else if (dy < -FP(2)) e.vy -= turn;
        if (e.vy > maxVy) e.vy = maxVy;
        if (e.vy < -maxVy) e.vy = -maxVy;
    }
}

function updRock(e)
{
    e.vy = s16(e.vy + 5);   // gravity
}

function updVolcano(e)
{
    // invisible emitter on a peak; a = interval. It erupts: a fan of rocks at once, with
    // a shudder, thrown high enough to rain on the whole screen. A bare ship gets about
    // half the rocks a fully armed one does. (Others must still have room to fly in.)
    const x = PX(e.x);
    e.cd = s16(e.cd - 1);
    if (e.cd > 0) return;
    const power = player_power();
    e.cd = s16(divu(mul16u(e.a, 240 - 10 * power), 100));
    if (x > 0 && x < SCREEN_W)
    {
        const n = 4 + divu(power, 3);
        for (let k = 0; k < n && enemy_count() < 18; k++)
        {
            const r = enemy_spawn(EN_ROCK, x, PX(e.y), 0);
            if (!r) break;
            const rnd = random();
            // (spread across the fan, a little behind the scroll as they were)
            r.vx = (2 * k - (n - 1)) * 14 - 6 + (rnd & 15);
            r.vy = (e.flags & EF_CEIL) ? FP(1) + ((rnd >> 5) & 31) : -FP(5) - ((rnd >> 5) & 47);
            if (e.flags & EF_CEIL) r.flags |= EF_CEIL;
        }
        stage_shake(8, 1);
        sound_play(SFX_EXPLODE);
    }
}

function updCrab(e)
{
    // glide in, hover with a bob, leave after a while
    if (e.a === 0)
    {
        if (e.x < FP(232)) { e.a = 1; e.vx = 0; }
    }
    else if (e.a === 1)
    {
        e.vy = isin((e.t * 2) & 255) >> 3;
        if (e.t > 420) { e.a = 2; e.vx = -FP(3); }
    }
    if (e.a === 1 && (e.cd = s16(e.cd - 1)) <= 0)
    {
        e.cd = s16(game_fireCd(70));
        if (inFireZone(e)) ebullet_spread(PX(e.x) - 12, PX(e.y), bulletSpeed(), loopNum ? 5 : 3, 9);
    }
}

function updIcicle(e)
{
    // a = 0 hanging, 1 shaking loose, 2 falling
    if (e.a === 0)
    {
        const dx = PX(pl.x) - PX(e.x);
        if (dx > -56 && dx < 24 && pl.y > e.y && pl.alive) { e.a = 1; e.b = 0; }
    }
    else if (e.a === 1)
    {
        if (++e.b > 14) e.a = 2;
    }
    else
    {
        e.vy += 6;
        if (e.vy > FP(5)) e.vy = FP(5);
        if (stage_solid(PX(e.x), PX(e.y) + 12))
        {
            fx_explode(PX(e.x), PX(e.y) + 8, FALSE);
            e.type = EN_NONE;   // shatters, no score
        }
    }
}

function updFlake(e)
{
    e.y = s16(FP(e.b) + (isin((e.t * 3) & 255) >> 2) * 6);
    if (loopNum && e.t === 60 && inFireZone(e)) ebullet_aim(PX(e.x), PX(e.y), bulletSpeed());
}

function updSled(e)
{
    const wx = cameraX + PX(e.x);
    const g = stage_floorAt(wx + (e.vx < 0 ? -10 : 10));
    if (g >= NO_FLOOR - 8 || abs(g - 6 - PX(e.y)) > 10) e.vx = s16(-e.vx);   // ledge or wall
    else e.y = FP(g - 6);
    e.cd = s16(e.cd - 1);
    if (e.cd <= 0)
    {
        e.cd = s16(game_fireCd(90));
        if (inFireZone(e))
        {
            ebullet_fire(PX(e.x), PX(e.y) - 6, -FP(1), -FP(1) - 8);
            ebullet_fire(PX(e.x), PX(e.y) - 6, 0, -FP(1) - 12);
            ebullet_fire(PX(e.x), PX(e.y) - 6, FP(1), -FP(1) - 8);
        }
    }
}

function updSpore(e)
{
    e.y = s16(FP(e.b) + (isin((e.t * 2) & 255) >> 3) * 3);
    // drift toward the player's height
    if ((e.t & 7) === 0) e.b = s16(e.b + ((PX(pl.y) > e.b) ? 1 : 0) - ((PX(pl.y) < e.b) ? 1 : 0));
}

function updAmoeba(e)
{
    const dy = s16(pl.y - e.y);
    if (dy > FP(4)) e.vy += 1;
    else if (dy < -FP(4)) e.vy -= 1;
    if (e.vy > 10) e.vy = 10;
    if (e.vy < -10) e.vy = -10;
    e.cd = s16(e.cd - 1);
    if (e.cd <= 0)
    {
        e.cd = s16(game_fireCd(100));
        if (inFireZone(e)) ebullet_aim(PX(e.x), PX(e.y), bulletSpeed());
    }
}

function updCell(e)
{
    // bounce off the walls of the gullet
    const x = PX(e.x), y = PX(e.y);
    if ((e.vy > 0 && stage_solid(x, y + 6)) || (e.vy < 0 && stage_solid(x, y - 6)))
        e.vy = s16(-e.vy);
}

function updWorm(e)
{
    // sine path, swinging harder as it goes
    e.y = s16(FP(e.b) + Math.trunc(mul16s(isin((e.t * 3) & 255), 9) / 4));
    if (e.a < 0) return;
    const k = e.a;
    wormHead[k] = (wormHead[k] + 1) & (WORM_HIST - 1);
    wormX[k][wormHead[k]] = PX(e.x);
    wormY[k][wormHead[k]] = PX(e.y);
    // the trail scrolls left with the head's motion only, so segments
    // trace the same wave
    let x0 = 32767, y0 = 32767, x1 = -32767, y1 = -32767;
    for (let s = 1; s <= WORM_SEGS; s++)
    {
        const h = (wormHead[k] - s * WORM_GAP) & (WORM_HIST - 1);
        const x = wsegX[k][s - 1] = wormX[k][h];
        const y = wsegY[k][s - 1] = wormY[k][h];
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (player_hitTest(x, y, 5, 5)) player_kill();
    }
    // the box a shot must be in to touch a segment (wormBlocks)
    wbx0[k] = x0 - 8; wbx1[k] = x1 + 8;
    wby0[k] = y0 - 7; wby1[k] = y1 + 7;
    e.cd = s16(e.cd - 1);
    if (e.cd <= 0)
    {
        e.cd = s16(game_fireCd(80));
        if (inFireZone(e)) ebullet_aim(PX(e.x) - 6, PX(e.y), bulletSpeed());
    }
}

// TRUE if the shot hit an armoured worm segment (and was absorbed). Each
// worm's segments and the box round them are noted by updWorm().
function wormBlocks(s, sx, sy)
{
    for (let k = 0; k < MAX_WORMS; k++)
    {
        if (!wormUsed[k] || sx <= wbx0[k] || sx >= wbx1[k] || sy <= wby0[k] || sy >= wby1[k]) continue;
        const xs = wsegX[k], ys = wsegY[k];
        for (let i = 0; i < WORM_SEGS; i++)
            if (((xs[i] - sx + 7) & 0xFFFF) < 15 && ((ys[i] - sy + 6) & 0xFFFF) < 13)
            {
                shot_kill(s, TRUE);
                return TRUE;
            }
    }
    return FALSE;
}

function updJelly(e)
{
    // pulse up, drift down
    const p = e.t & 63;
    if (p === 0) e.vy = -FP(1) - 10;
    else if (e.vy < 8) e.vy += 1;
    if (e.y < FP(16)) e.vy = 8;
}

function updFish(e)
{
    e.y = s16(FP(e.b) + (isin((e.t * 4) & 255) >> 4) * 16);
}

function updMine(e)
{
    e.y = s16(FP(e.b) + (isin((e.t * 2) & 255) >> 5) * 4);
    const dx = PX(pl.x) - PX(e.x), dy = PX(pl.y) - PX(e.y);
    if (pl.alive && abs(dx) < 30 && abs(dy) < 30) enemy_damage(e, 99);  // proximity fuse
}

function updCannon(e)
{
    if (e.a) e.a--;      // recoil frames
    e.cd = s16(e.cd - 1);
    if (e.cd <= 0)
    {
        e.cd = s16(game_fireCd(130));
        if (inFireZone(e))
        {
            ebullet_spread(PX(e.x) - 8, PX(e.y) - 8, FP(1) + 4, player_power() < 4 ? 2 : 3, 10);
            e.a = 8;
        }
    }
}

// ------------------------------------------------------------------ lasers on plane A (pbeam.js)

// A laser gate: emitters on the deck and the roof, a beam between them
// that rests, blinks a warning, then burns. Shooting the deck emitter
// switches it off for good. a = phase within the cycle.
function updGate(e)
{
    if (e.t === 1)
    {
        // line it up with the plane's cells: two columns, deck to roof
        const wx = cameraX + PX(e.x);
        const c0 = (wx >> 3) - 1;
        e.x = FP((c0 << 3) + 8 - cameraX);
        const fl = terrFloor[wx], cl = terrCeil[wx];
        e.b = fl - cl;                        // the roof emitter's offset
        e.pb = pbeam_new(true, 2);
        if (e.pb)
        {
            e.pb.c0 = c0;
            e.pb.c1 = c0 + 2;
            e.pb.r0 = (cl + 8) >> 3;
            e.pb.r1 = (fl - 8) >> 3;
        }
    }
    if (!e.pb) return;
    const k = modu(e.t + e.a, 176);
    e.pb.state = k < 88 ? PB_OFF : k < 128 ? PB_WARN : PB_ON;
    // past the screen's first third it rests: a ship that waited at the
    // left edge for it to open must not be pinned there
    if (PX(e.x) < 112 && e.pb.state !== PB_ON) e.pb.state = PB_OFF;
    if (PX(e.x) < 96) e.pb.state = PB_OFF;
    if (k === 128 && PX(e.x) < SCREEN_W) sound_play(SFX_LASERGATE);
}

// A laser cannon on a rail from the roof to the deck: it slides up and
// down after the ship's height (a little slower than the ship), then
// locks there -- a sight line flashes across the screen at that height --
// and its beam shoots out to the left edge (or the rock) and holds a
// moment; then it hunts again. Only from the right half of the screen.
// a: 0 hunting, 1 locked (sight line), 2 shooting out, 3 holding;
// b the beam's head (column), c its reach (column), cd frames to the next.
function updLCannon(e)
{
    const x = PX(e.x), y = PX(e.y);
    if (e.t === 1)
    {
        e.pb = pbeam_new(false, 3);
        e.a = 0;
        e.cd = 80;
    }
    const b = e.pb;
    if (!b) return;
    const wx = cameraX + x;
    const cm = (wx - 14) >> 3;                // the muzzle's column
    b.c1 = cm;
    e.vy = 0;
    switch (e.a)
    {
    case 0:     // hunting along the rail
    {
        b.state = PB_OFF;
        if (x > SCREEN_W - 24 || x < 136 || !pl.alive) break;
        const dy = PX(pl.y) - y;
        const lo = stage_ceilAt(wx) + 12, hi = stage_floorAt(wx) - 12;
        if (dy > 2 && y < hi) e.vy = FP(1) + 6;
        else if (dy < -2 && y > lo) e.vy = -FP(1) - 6;
        e.cd = s16(e.cd - 1);
        if (e.cd > 0) break;
        // locked: the beam's rows, and how far it will reach (the left
        // edge, or the first rock: found once)
        b.r0 = (cameraY + y - 12) >> 3;
        b.r1 = b.r0 + 3;
        const left = cameraX >> 3;
        let reach = cm;
        while (reach > left && !stage_cellSolid(reach - 1, b.r0) && !stage_cellSolid(reach - 1, b.r0 + 1) &&
               !stage_cellSolid(reach - 1, b.r1 - 1)) reach--;
        e.c = reach;
        e.a = 1;
        e.cd = 30;
        break;
    }
    case 1:     // the sight line
        b.c0 = e.c;
        b.state = PB_WARN;
        e.cd = s16(e.cd - 1);
        if (e.cd <= 0) { e.a = 2; e.b = cm; sound_play(SFX_LASERCANNON); stage_shake(6, 1); }
        break;
    case 2:     // the beam shoots out
        b.state = PB_ON;
        e.b -= 5;
        if (e.b <= e.c) { e.b = e.c; e.a = 3; e.cd = 40; }
        b.c0 = e.b;
        break;
    case 3:     // holds, then stops
        b.state = PB_ON;
        e.cd = s16(e.cd - 1);
        if (e.cd <= 0) e.a = 4;
        break;
    case 4:     // gives out, from the far end
        b.c0 += 8;
        if (b.c0 >= b.c1) { b.state = PB_OFF; e.a = 0; e.cd = s16(game_fireCd(80)); }
        break;
    }
}

// A barrier across a shaft: emitter on the left wall, beam to the right
// wall, on a cycle. a = phase, b = width in px.
function updBarrier(e)
{
    if (e.t === 1)
    {
        const wx = cameraX + PX(e.x);
        const c0 = (wx >> 3) + 1;
        const r = ((cameraY + PX(e.y)) >> 3) - 1;
        let c1 = c0;
        while (c1 < c0 + 40 && !stage_cellSolid(c1, r) && !stage_cellSolid(c1, r + 1)) c1++;
        e.b = (c1 - c0) * 8 + 8;
        e.pb = pbeam_new(false, 2);
        if (e.pb) { e.pb.c0 = c0; e.pb.c1 = c1; e.pb.r0 = r; e.pb.r1 = r + 2; }
    }
    if (!e.pb) return;
    const k = modu(e.t + e.a, 168);
    e.pb.state = k < 76 ? PB_OFF : k < 116 ? PB_WARN : PB_ON;
    // (the same near the bottom of the shaft)
    if (PX(e.y) > 136 && e.pb.state !== PB_ON) e.pb.state = PB_OFF;
    if (PX(e.y) > 152) e.pb.state = PB_OFF;
    if (k === 116 && PX(e.y) > 0 && PX(e.y) < PLAY_H) sound_play(SFX_LASERGATE);
}

// ------------------------------------------------------------------ ice cubes

// The Glacier's ice storm: glass blocks rain down on the frozen lake, each
// falling straight down a 32 px world column (so it scrolls with the
// lake), and where one lands it stays: the pile is terrain from then on
// (iceH, painted into plane A with the block's tiles: no sprite, however
// high the ice grows). A shot breaks a block in flight (two hits) or in the
// pile (three hits on the same block): the blocks above it then come down
// again. The storm comes from the script (EF_TOP: from the top edge,
// anywhere ahead of the ship); a block shaken loose has no flag.
const ICE_MAX = 3;          // a pile's height in blocks: the lake (y 192) up to 96
const iceHitLvl = new Uint8Array(ICE_SLOTS), iceHits = new Uint8Array(ICE_SLOTS);

// world column k's blocks from level l0 to l1 (excl.): painted, or the
// lake's own cells back (restore)
function iceCells(k, l0, l1, restore)
{
    const r = terrFloor[k << 5] >> 3;           // the lake's first row
    const c = k << 2;
    const t = TILE_ATTR(PAL2, 0, 0, 0, assetVram[AS_CUBE]);
    for (let q = 0; q < 4; q++)
    {
        if (restore) { stage_paintCol(c + q, r - 4 * l1, r - 4 * l0, 0xFFFF); continue; }
        for (let l = l0; l < l1; l++)
            stage_paintColSeq(c + q, r - 4 * l - 4, r - 4 * l, t + (q << 2), 1);
    }
}

// A shot at screen (sx, sy) that has hit rock: true if it was the ice
// (the shot is spent on it).
function enemy_iceShot(sx, sy)
{
    if (!iceOn) return false;
    const wx = cameraX + sx;
    const k = (wx >>> 5) & 0xFFFF, sl = k & (ICE_SLOTS - 1);
    if (iceTag[sl] !== k || !iceH[sl]) return false;
    const base = terrFloor[k << 5] - cameraY;
    const l = (base - 1 - sy) >> 5;
    if (sy >= base || l >= iceH[sl]) return false;
    if (iceHitLvl[sl] !== l) { iceHitLvl[sl] = l; iceHits[sl] = 0; }
    const cx = (k << 5) + 16 - cameraX;
    if (++iceHits[sl] < 3)
    {
        if (iceHits[sl] === 1) fx_spark(sx, sy);
        return true;
    }
    // the block breaks; the ones above it come down again
    const h = iceH[sl];
    iceHits[sl] = 0;
    iceH[sl] = l;
    iceCells(k, l, h, true);
    for (let m = l + 1; m < h; m++)
    {
        const f = enemy_spawn(EN_CUBE, cx, base - 32 * m - 16, 0);
        if (f) f.vy = FP(1) >> 1;
    }
    const cy = base - 32 * l - 16;
    fx_spark(cx - 8, cy - 8);
    fx_spark(cx + 8, cy + 6);
    fx_spark(cx, cy);
    game_addScore(50);
    sound_play(SFX_SHIELDHIT);
    return true;
}

function updCube(e)
{
    if (e.t === 1)
    {
        iceOn = true;
        if (e.flags & EF_TOP)
        {
            // from the top edge, into a column anywhere ahead of the ship:
            // it comes down in front of it, not on it
            const r = random();
            let lo = PX(pl.x) + 96;
            if (lo > 272) lo = 272;
            const wx = cameraX + lo + modu(r, 352 - lo);
            e.x = FP((wx & ~31) + 16 - cameraX);
            e.y = FP(-16 - ((r >> 10) & 31));
            e.vy = FP(1);
        }
    }
    // a little heavier every frame, up to 2.5 px
    if (e.vy < FP(2) + 8) e.vy += 2;
    const x = PX(e.x), y = PX(e.y);
    if (y < 0 || x > SCREEN_W - 20) return;     // (its column is not on the plane yet)
    if (x < -16) { despawn(e); return; }
    // half of them look down each frame
    if ((e.t ^ e.id) & 1) return;
    const wx = cameraX + x;
    const top = stage_floorAt(wx);
    if (y + 16 < top) return;
    // landed: on the pile, or shattered on the rock, or on a full pile
    const k = (wx >>> 5) & 0xFFFF, sl = k & (ICE_SLOTS - 1);
    if (iceTag[sl] !== k) { iceTag[sl] = k; iceH[sl] = 0; iceHitLvl[sl] = 0xFF; }
    const w0 = k << 5;
    if (iceH[sl] >= ICE_MAX || terrFloor[w0] !== terrFloor[w0 + 31] || (terrFloor[w0] & 7))
    {
        fx_spark(x - 6, y + 8);
        fx_spark(x + 6, y + 10);
        despawn(e);
        return;
    }
    iceCells(k, iceH[sl], iceH[sl] + 1, false);
    iceH[sl]++;
    sound_play(SFX_SHIELDHIT);
    despawn(e);
}

// ------------------------------------------------------------------ star flares

// A captive star (a horizon of plasma) throws up loops of flame, from one
// side of the screen's corridor to the other. An invisible anchor (the
// script's param: the star's column; EF_CEIL for one hanging from the roof;
// two a star, running opposite ways) sends a head along a half sine: a
// fireball 64 px across, a painted sprite. The loop's body behind it,
// FLARE_TAIL steps long, is plane A: 32 px blocks of plasma the head lays and
// the tail takes up, so a rope of fire 32 px thick across the screen costs
// no sprites. Sparks at the root warn of a loop; it bursts out with a flash,
// a shudder and a spray of bullets.
// a: 0 resting, 1 warning, 2 burning; b: the loop's height, c: where it
// starts (px from the centre), score its width (signed; the anchor is never
// scored), cd: frames left / steps run; hh: its tables.
const FLARE_SEGS = 22;     // the body as the burn test and the auto pilot see it:
const FLARE_GAP = 2;       // FLARE_SEGS points FLARE_GAP steps apart (some 10 px)
const FLARE_TAIL = FLARE_SEGS * FLARE_GAP;
const FLARE_STEPS = 64;
const FLARE_WARN = 30;
const SUN_FLOOR_Y = 158;   // the loops' base, inside the star
const SUN_CEIL_Y = 50;

// The loop is worked out while its warning sparks (two points a frame)
// into a table. Two tables: the two anchors of the star on screen.
const flX = [new Int16Array(FLARE_STEPS + 2), new Int16Array(FLARE_STEPS + 2)];
const flY = [new Int16Array(FLARE_STEPS + 2), new Int16Array(FLARE_STEPS + 2)];
let flareSlot = 0;
// the body's blocks, in the order laid: world cell of the top left of each
// 4x4, and the step it was laid at
const FL_BLOCKS = 32;
const flBX = [new Int16Array(FL_BLOCKS), new Int16Array(FL_BLOCKS)];
const flBY = [new Int16Array(FL_BLOCKS), new Int16Array(FL_BLOCKS)];
const flBP = [new Uint8Array(FL_BLOCKS), new Uint8Array(FL_BLOCKS)];
const flB0 = new Uint8Array(2), flBN = new Uint8Array(2);
let flAnimT = 0;

function flareCompute(e, p)
{
    // p 0..FLARE_STEPS along the loop: half a sine (128 of 256) in 64 steps
    const h = mul16s(s16(sin_tab[(p << 1) & 255]), e.b) >> 8;
    flX[e.hh][p] = e.c + (mul16s(p, e.score) >> 6);
    flY[e.hh][p] = (e.flags & EF_CEIL) ? h : -h;
}

let fpX = 0, fpY = 0;
function flarePoint(e, p)
{
    fpX = PX(e.x) + flX[e.hh][p];
    fpY = PX(e.y) + flY[e.hh][p];
}

// a 32 px block of plane cells at world cell (cx, cy), or the terrain back.
// k picks its look: bit 0 the frame, bits 1 and 2 the flips
function flareBlock(cx, cy, k, restore)
{
    for (let q = 0; q < 4; q++)
    {
        if (restore) { stage_paintCol(cx + q, cy, cy + 4, 0xFFFF); continue; }
        const hf = (k >> 1) & 1, vf = (k >> 2) & 1;
        const t = assetVram[AS_FLAREBODY] + ((k & 1) << 4) + ((hf ? 3 - q : q) << 2) + (vf ? 3 : 0);
        stage_paintColSeq(cx + q, cy, cy + 4, TILE_ATTR(PAL1, 0, vf, hf, t), vf ? 0xFFFF : 1);
    }
}

// the head has reached step p: a new block where it has moved on from the
// last one laid (they overlap a little, so the rope has no gaps)
function flareLay(e, p)
{
    const h = e.hh;
    flarePoint(e, p);
    const x = fpX, y = fpY;
    if (stage_solid(x, y)) return;       // (inside the star: the head rises out of it)
    const cx = (cameraX + x - 16) >> 3, cy = (cameraY + y - 16) >> 3;
    if (flBN[h])
    {
        const l = (flB0[h] + flBN[h] - 1) & (FL_BLOCKS - 1);
        const dx = cx - flBX[h][l], dy = cy - flBY[h][l];
        if (dx > -3 && dx < 3 && dy > -3 && dy < 3) return;
        if (flBN[h] >= FL_BLOCKS) return;
    }
    const l = (flB0[h] + flBN[h]) & (FL_BLOCKS - 1);
    flBX[h][l] = cx;
    flBY[h][l] = cy;
    flBP[h][l] = p;
    flBN[h]++;
    flareBlock(cx, cy, l, false);
}

// the tail has passed step p: up go the blocks laid at or before it (and the
// next one is laid again, over the cells they shared)
function flareLift(e, p)
{
    const h = e.hh;
    while (flBN[h] && flBP[h][flB0[h]] <= p)
    {
        const o = flB0[h], nx = (o + 1) & (FL_BLOCKS - 1);
        const cx = flBX[h][o], cy = flBY[h][o];
        flB0[h] = nx;
        flBN[h]--;
        if (!flBN[h]) { flareBlock(cx, cy, 0, true); continue; }
        const x2 = flBX[h][nx], y2 = flBY[h][nx];
        for (let c = cx; c < cx + 4; c++)
        {
            if (c < x2 || c >= x2 + 4) { stage_paintCol(c, cy, cy + 4, 0xFFFF); continue; }
            if (y2 > cy) stage_paintCol(c, cy, y2 < cy + 4 ? y2 : cy + 4, 0xFFFF);
            if (y2 + 4 < cy + 4) stage_paintCol(c, y2 + 4 > cy ? y2 + 4 : cy, cy + 4, 0xFFFF);
        }
    }
}

function flareClear(e)
{
    if (e.a === 2) flareLift(e, 0x7FFF);
}

function updFlare(e)
{
    if (e.t === 1)
    {
        // on the star's centre, at the loops' base
        e.x = FP((e.a << 3) - cameraX);
        e.y = FP(((e.flags & EF_CEIL) ? SUN_CEIL_Y : SUN_FLOOR_Y) - cameraY);
        e.a = 0;
        e.hh = flareSlot;
        e.cd = 4 + 24 * flareSlot;            // the second loop comes on the first's heels
        flareSlot ^= 1;
    }
    const x = PX(e.x);
    switch (e.a)
    {
    case 0:
        if (x < 24) break;
        e.cd = s16(e.cd - 1);
        if (e.cd > 0) break;
        {
            // the roots: on the plane (the columns past the right edge are
            // not there yet), and the left one out of the screen's left
            // part while it burns, where a ship has no way round it.
            // The top stays low enough to leave a way over it, and it is
            // gone within a second. A star's two loops run opposite ways.
            const r = random();
            const back = e.hh;
            const root = 112 + (r & 15);
            let c0 = -root, c1 = root - 8 + ((r >> 4) & 15);
            const lo = (back ? 128 : 96) - x;
            if (c0 < lo) c0 = lo;
            if (c1 > SCREEN_W - 8 - x) c1 = SCREEN_W - 8 - x;
            if (c1 - c0 < 110) { e.cd = 6; break; }
            if (back) { e.c = c1; e.score = s16(c0 - c1); }
            else { e.c = c0; e.score = s16(c1 - c0); }
            e.b = 78 + ((r >> 8) & 7) + ((r >> 12) & 7);
        }
        e.a = 1;
        e.cd = FLARE_WARN;
        break;
    case 1:
        {
            const k = (FLARE_WARN - e.cd) * 2;
            if (k <= FLARE_STEPS) flareCompute(e, k);
            if (k + 1 <= FLARE_STEPS) flareCompute(e, k + 1);
        }
        if ((e.cd & 3) === 0)
        {
            flarePoint(e, 8);
            fx_spark(fpX - 8 + (random() & 15), fpY);
        }
        e.cd = s16(e.cd - 1);
        if (e.cd <= 0)
        {
            for (let k = FLARE_WARN * 2; k <= FLARE_STEPS; k++) flareCompute(e, k);   // (the rest of it)
            e.a = 2;
            e.cd = 0;
            flB0[e.hh] = flBN[e.hh] = 0;
            flareLay(e, 0);
            sound_play(SFX_LASERCANNON);
            if (!e.hh) stage_flash(3);
            stage_shake(12, 2);
            // a spray of bullets from the root, away from the star
            flarePoint(e, 10);
            const sx = fpX, sy = fpY;
            const vy = (e.flags & EF_CEIL) ? FP(1) + 6 : -FP(1) - 6;
            for (let k = -1; k <= 1; k++) ebullet_fire(sx, sy, k * (FP(1) - 2) - 8, vy);
        }
        break;
    case 2:
    {
        // the blocks' tiles boil: the two frames change places
        if (flAnimT !== frameCount && !(frameCount & 3))
        {
            flAnimT = frameCount;
            const ph = (frameCount >> 2) & 1;
            const src = asset_tiles[AS_FLAREBODY];
            gfx_loadTileData(src, assetVram[AS_FLAREBODY], 16, UP_LATER, ph << 7);
            gfx_loadTileData(src, assetVram[AS_FLAREBODY] + 16, 16, UP_LATER, (ph ^ 1) << 7);
        }
        // two steps a frame: the head whips round the loop in 32 frames
        e.cd += 2;
        if (e.cd - 1 <= FLARE_STEPS) flareLay(e, e.cd - 1);
        if (e.cd <= FLARE_STEPS) flareLay(e, e.cd);
        if (e.cd > FLARE_TAIL) flareLift(e, e.cd - FLARE_TAIL);
        if (e.cd > FLARE_STEPS + FLARE_TAIL)
        {
            flareLift(e, 0x7FFF);
            e.a = 0;
            e.cd = s16(game_fireCd(10));
            break;
        }
        // the loop burns the ship: the head, and the body every 2 steps
        if (!pl.alive || pl.invuln) break;
        const px = PX(pl.x), py = PX(pl.y);
        // (the body by turns, every other point: they overlap, the ship is slow)
        for (let i = 0; i <= FLARE_SEGS; i = i ? i + 2 : 1 + (frameCount & 1))
        {
            const p = e.cd - i * FLARE_GAP;
            if (p < 0) break;
            if (p > FLARE_STEPS) continue;
            flarePoint(e, p);
            const sx = fpX, sy = fpY;
            if (((sx - px + 32) & 0xFFFF) > 64 || ((sy - py + 32) & 0xFFFF) > 64) continue;
            const r = i === 0 ? 18 : 11;
            if (player_hitTest(sx, sy, r, r)) { player_kill(); break; }
        }
        break;
    }
    }
}

function enemy_flareZone(px, py, r, xs, ys, max)
{
    let n = 0;
    for (let k = 0; k < MAX_ENEMIES && n < max; k++)
    {
        const e = enemies[k];
        if (e.type !== EN_FLARE || e.a === 0) continue;
        // all that burns or will: the body and the head's way on (while the
        // warning sparks, the part of the way worked out so far)
        let p0 = 0, p1 = FLARE_STEPS;
        if (e.a === 1) p1 = (FLARE_WARN - e.cd) * 2;
        else if (e.cd > FLARE_TAIL) p0 = e.cd - FLARE_TAIL;
        if (p1 > FLARE_STEPS) p1 = FLARE_STEPS;
        for (let p = p0; p <= p1 && n < max; p += 3)
        {
            flarePoint(e, p);
            const x = fpX, y = fpY;
            if (((x - px + r) & 0xFFFF) > ((2 * r) & 0xFFFF) || ((y - py + r) & 0xFFFF) > ((2 * r) & 0xFFFF)) continue;
            xs[n] = x;
            ys[n] = y;
            n++;
        }
    }
    return n;
}

// ------------------------------------------------------------------ the star's lasers

// The second captive star hangs quiet, then opens fire: salvos of lasers on
// plane A (pbeam.js), straight down from under its surface and, against a
// ship waiting at the left edge, across the screen from the right. Each salvo
// is locked on the ship, shows sight lines, then the beams shoot out, hold and
// give out from the root. An upright beam never burns in the screen's left
// part (it would pin a ship against the edge).
// An invisible anchor (the script's param: the star's column).
// a: the phase, b: the salvo, c: the first shot's big flash done, cd: frames left.
const LANCE_BOTTOM = 26;    // the plane rows the playfield ends at (PLAY_H)
const LANCE_LEFT = 112;     // upright beams lock on no further left than this
const LANCE_OUT = 64;       // ... and stop if the scroll takes them this far
const LANCE_ACROSS = 48;    // a beam's columns across (streamed in as the camera moves on)
const LANCE_WARN = 36;
const LP_REST = 0, LP_WARN = 1, LP_GROW = 2, LP_HOLD = 3, LP_DROP = 4;
const LS_AIM = 0, LS_COMB = 1, LS_COMB2 = 2, LS_CROSS = 3, LS_GRID = 4;
const lance = new Array(MAX_PBEAMS).fill(null);
let lanceN = 0;

function lanceClear()
{
    for (let i = 0; i < lanceN; i++) pbeam_free(lance[i]);
    lanceN = 0;
}

function lanceDown(cx, thick)
{
    const b = pbeam_new(true, thick);
    if (!b) return;
    const wx = cameraX + cx;
    b.c0 = (wx >> 3) - (thick >> 1);
    b.c1 = b.c0 + thick;
    const r = (stage_ceilAt(wx) >> 3) - 1;     // from just inside the star
    b.r0 = r < 0 ? 0 : r;
    b.r1 = LANCE_BOTTOM;
    b.state = PB_WARN;
    lance[lanceN++] = b;
}

function lanceAcross(y)
{
    const b = pbeam_new(false, 3);
    if (!b) return;
    b.r0 = (y - 12) >> 3;
    b.r1 = b.r0 + 3;
    b.c0 = cameraX >> 3;
    b.c1 = b.c0 + LANCE_ACROSS;
    b.state = PB_WARN;
    lance[lanceN++] = b;
}

function lanceClamp(x, lo, hi)
{
    return x < lo ? lo : x > hi ? hi : x;
}

// Locks a salvo on the ship. false: the star has gone too far to fire.
const lanceOrder = [LS_AIM, LS_COMB, LS_COMB2, LS_CROSS, LS_AIM, LS_GRID];
function lanceSalvo(e)
{
    const star = PX(e.x);
    const lo = star - 168 < LANCE_LEFT ? LANCE_LEFT : star - 168;
    const hi = star + 168 > SCREEN_W - 16 ? SCREEN_W - 16 : star + 168;
    if (hi - lo < 64) return false;
    const sx = pl.alive ? PX(pl.x) + 1 : 160, sy = pl.alive ? PX(pl.y) : 104;
    const kind = lanceOrder[e.b];
    e.b = e.b + 1 < lanceOrder.length ? e.b + 1 : 3;     // (round the last three)
    // (the left of the screen is out of the upright beams' reach, not out of this)
    if (sx < lo - 16 && kind < LS_CROSS) lanceAcross(lanceClamp(sy, 24, 192));
    switch (kind)
    {
    case LS_AIM:
        lanceDown(lanceClamp(sx, lo, hi), 6);
        break;
    case LS_COMB:
    case LS_COMB2:
    {
        // beams 72 px apart: the first on the ship, the second either side of it
        let x = sx + (kind === LS_COMB2 ? 36 : 0);
        while (x - 72 >= lo) x -= 72;
        while (x < lo) x += 72;
        for (let k = 0; k < 4 && x <= hi; k++, x += 72) lanceDown(x, 3);
        break;
    }
    case LS_CROSS:
        // up or down out of the one, with the others either side
        lanceAcross(lanceClamp(sy, 24, 192));
        if (sx - 72 >= lo) lanceDown(sx - 72, 3);
        if (sx + 72 >= lo && sx + 72 <= hi) lanceDown(sx + 72, 3);
        break;
    case LS_GRID:
        // two across with a lane between them, and one down through the lane
        if (sy - 56 >= 24) lanceAcross(sy - 56);
        if (sy + 56 <= 192) lanceAcross(sy + 56);
        lanceDown(lanceClamp(sx, lo, hi), 4);
        break;
    }
    return lanceN !== 0;
}

function updLance(e)
{
    if (e.t === 1)
    {
        e.x = FP((e.a << 3) - cameraX);
        e.y = FP(50);
        e.a = LP_REST;
        e.b = 0;
        e.c = 0;
        e.cd = 44;          // long enough to take it for a quiet star
        lanceN = 0;
    }
    switch (e.a)
    {
    case LP_REST:
        e.cd = s16(e.cd - 1);
        if (e.cd > 0) break;
        if (lanceSalvo(e))
        {
            e.a = LP_WARN;
            e.cd = loopNum ? LANCE_WARN - 8 : LANCE_WARN;
            sound_play(SFX_LASERGATE);
        }
        else e.cd = 30;
        break;
    case LP_WARN:
        if ((e.cd & 3) === 0)
        {
            const b = lance[(e.cd >> 2) % lanceN];
            if (b.vert) fx_spark(((b.c0 << 3) - cameraX) + 8 * (b.thick >> 1),
                                 (b.r0 << 3) + 12 + (random() & 7));
        }
        e.cd = s16(e.cd - 1);
        if (e.cd > 0) break;
        for (let i = 0; i < lanceN; i++)
        {
            const b = lance[i];
            b.state = PB_ON;
            if (b.vert) b.r1 = b.r0 + 2;
            else b.c0 = (cameraX >> 3) + 40;
        }
        e.a = LP_GROW;
        sound_play(SFX_LASERCANNON);
        // the first shot is the one nobody expects
        stage_flash(e.c ? 2 : 6);
        stage_shake(e.c ? 10 : 24, e.c ? 2 : 3);
        e.c = 1;
        break;
    case LP_GROW:
    {
        let done = true;
        const left = cameraX >> 3;
        for (let i = 0; i < lanceN; i++)
        {
            const b = lance[i];
            if (b.vert)
            {
                b.r1 += 3;
                if (b.r1 >= LANCE_BOTTOM) b.r1 = LANCE_BOTTOM;
                else done = false;
            }
            else
            {
                b.c0 -= 6;
                if (b.c0 <= left) b.c0 = left;
                else done = false;
            }
        }
        // (long enough to hem the ship in, not to pin it)
        if (done) { e.a = LP_HOLD; e.cd = lanceN === 1 ? 90 : 72; }
        break;
    }
    case LP_HOLD:
    {
        e.cd = s16(e.cd - 1);
        let out = e.cd <= 0;
        for (let i = 0; i < lanceN; i++)
            if (lance[i].vert && (lance[i].c0 << 3) - cameraX < LANCE_OUT) out = true;
        if (out) e.a = LP_DROP;
        break;
    }
    case LP_DROP:
    {
        const right = (cameraX >> 3) + 41;
        for (let i = 0; i < lanceN;)
        {
            const b = lance[i];
            let gone;
            if (b.vert) { b.r0 += 4; gone = b.r0 >= b.r1; }
            else { b.c0 += 6; gone = b.c0 >= right; }
            if (gone)
            {
                pbeam_free(b);
                lance[i] = lance[--lanceN];
            }
            else i++;
        }
        if (!lanceN) { e.a = LP_REST; e.cd = 16; }
        break;
    }
    }
}

// ------------------------------------------------------------------ giant clams

// The Sunken Archive's giant clams, half buried in the sea floor. Shut,
// they are armour (shots spark off). Then they gape, the great pearl
// glowing (the only time they can be broken), trickle bubbles for a
// warning, and blow a geyser of bubbles up to the roof: a column the ship
// must not be in. The geyser is plane A cells, 32 px wide, laid a row a
// frame as it shoots up and taken up again as it sinks; its bubbles rise
// because the tile data scrolls.
// The enemy's box is the pearl; the geyser rises from just above it.
// a: 0 shut, 1 gaping (warning), 2 erupting; cd frames to the next state;
// b the geyser's height (px); c the roof's height over it (screen y);
// d its rows on the plane.
const CLAM_WARN = 44;
const CLAM_BLOW = 96;

let geyT = 0;
const geyCol = [new Uint32Array(64), new Uint32Array(64), new Uint32Array(64), new Uint32Array(64)];

// the geyser's tiles, risen k rows: a column of the 32x32 tile block runs
// down its tiles, so rising is a rotation of each column, from a copy of it
// laid twice end to end, every other frame
function geyserTiles()
{
    if (geyT === frameCount || (frameCount & 1)) return;
    if (!geyT)
        for (let col = 0; col < 4; col++)
        {
            const src = asset_tiles[AS_GEYSER].subarray(col << 5, (col << 5) + 32);
            geyCol[col].set(src, 0);
            geyCol[col].set(src, 32);
        }
    geyT = frameCount | 1;
    const k = (frameCount << 2) & 31;            // rows (4 bytes each)
    for (let col = 0; col < 4; col++)
        gfx_loadTileData(geyCol[col], assetVram[AS_GEYSER] + col * 4, 4, UP_LATER, k);
}

// the geyser's cells: rows (world) from the mouth up
function geyserRows(e, from, to, restore)
{
    const x = PX(e.x);
    const c0 = (cameraX + x - 12) >> 3;
    const rb = (cameraY + PX(e.y) - 8) >> 3;    // the row above the mouth
    const t = TILE_ATTR(PAL2, 0, 0, 0, assetVram[AS_GEYSER]);
    for (let k = from; k < to; k++)
    {
        const r = rb - k;
        stage_paintRowSeq(r, c0, c0 + 4, restore ? 0xFFFF : t + (r & 3), 4);
    }
}

function geyserClear(e)
{
    if (e.d > 0) geyserRows(e, 0, e.d, true);
    e.d = 0;
}

// a clam gone (shot, or off the screen): no longer awake
function clamGone(e)
{
    geyserClear(e);
    if (e.a && clamsAwake) clamsAwake--;
    e.a = 0;
}

function updClam(e)
{
    if (e.t === 1) { e.cd = 60 + e.a; e.a = 0; e.d = 0; }
    const x = PX(e.x), y = PX(e.y);
    if (x > SCREEN_W - 24) return;
    e.cd = s16(e.cd - 1);
    if (e.cd <= 0)
    {
        // it gapes only on the right of the screen: a geyser is a wall to
        // the roof, drifting left with the rock, and a ship left of it must
        // have room (one drifting into the left 80 px sinks early)
        if (e.a === 0 && x > 176) { e.a = 1; e.cd = CLAM_WARN; e.b = 0; clamsAwake++; }
        else if (e.a === 0) e.cd = 8;
        else if (e.a === 1) { e.a = 2; e.cd = CLAM_BLOW; sound_play(SFX_LASERGATE); }
        else { e.a = 0; e.cd = s16(game_fireCd(120)); e.b = 0; geyserClear(e); clamsAwake--; }
    }
    if (!e.a) return;
    // the roof over the geyser (the clam drifts with the rock: found anew)
    const c = stage_ceilAt(cameraX + x);
    e.c = c < 0 ? 0 : c;
    if (e.a === 1)
    {
        if ((e.cd & 7) === 0) fx_spark(x - 2 + (random() & 7), y - 12);
        return;
    }
    // the geyser shoots up 8 px a frame, and sinks back in its last frames
    if (x < 80 && e.cd > 16) e.cd = 16;
    const full = y - 8 - e.c;
    if (e.cd > 16) { e.b += 8; if (e.b > full) e.b = full; }
    else e.b -= full >> 4;
    if (e.b < 0) e.b = 0;
    geyserTiles();
    const rows = (e.b + 7) >> 3;
    if (rows > e.d) geyserRows(e, e.d, rows, false);
    else if (rows < e.d) geyserRows(e, rows, e.d, true);
    e.d = rows;
    if (pl.alive && !pl.invuln && e.b > 0)
    {
        const dx = PX(pl.x) - x, py = PX(pl.y);
        if (dx > -16 && dx < 16 && py < y - 6 && py > y - 8 - e.b) player_kill();
    }
}

// the geyser as a box (for the auto pilot): null when it is not coming,
// else { x, y0, y1 }
const geyOut = { x: 0, y0: 0, y1: 0 };
function enemy_geyser(e)
{
    if (e.type !== EN_CLAM || !e.a) return null;
    const y = PX(e.y);
    geyOut.x = PX(e.x);
    geyOut.y1 = y - 6;
    geyOut.y0 = e.a === 1 ? e.c : y - 8 - e.b;     // gaping: all of it is coming
    return geyOut;
}

function updOrb(e)
{
    // glide in, hover, spin out a four-way pattern, leave
    if (e.t < 60) { if (e.vx < 0) e.vx += 3; else e.vx = 0; }
    if (e.t > 420) e.vx = s16(e.vx - 4);
    e.vy = isin((e.t * 3) & 255) >> 4;
    if (e.t > 40 && e.t < 420 && (e.t & 31) === 0 && inFireZone(e))
    {
        let a = (e.t << 1) & 255;
        for (let k = 0; k < 4; k++, a = (a + 64) & 255)
            ebullet_fire(PX(e.x), PX(e.y), icos(a) >> 4, isin(a) >> 4);
    }
}

function updLancer(e)
{
    // hang at the edge, blinking, then charge
    if (e.t === 40)
    {
        e.vx = -FP(6);
        sound_play(SFX_MISSILE);
    }
}

function enemy_update()
{
    for (let i = 0; i < MAX_ENEMIES; i++)
    {
        const e = enemies[i];
        if (!e.type) continue;
        e.t = (e.t + 1) & 0xFFFF;
        if (e.flash) e.flash--;
        switch (e.type)
        {
        case EN_FAN:    updFan(e); break;
        case EN_DART:   updDart(e); break;
        case EN_TURRET: updTurret(e); break;
        case EN_WALKER: updWalker(e); break;
        case EN_HATCH:  updHatch(e); break;
        case EN_MINI:   updMini(e); break;
        case EN_ROCK:   updRock(e); break;
        case EN_VOLCANO: updVolcano(e); break;
        case EN_CRAB:   updCrab(e); break;
        case EN_ICICLE: updIcicle(e); break;
        case EN_FLAKE:  updFlake(e); break;
        case EN_SLED:   updSled(e); break;
        case EN_SPORE:  updSpore(e); break;
        case EN_AMOEBA: updAmoeba(e); break;
        case EN_CELL:   updCell(e); break;
        case EN_WORM:   updWorm(e); break;
        case EN_JELLY:  updJelly(e); break;
        case EN_FISH:   updFish(e); break;
        case EN_MINE:   updMine(e); break;
        case EN_CANNON: updCannon(e); break;
        case EN_ORB:    updOrb(e); break;
        case EN_LANCER: updLancer(e); break;
        case EN_GATE:   updGate(e); break;
        case EN_LCANNON: updLCannon(e); break;
        case EN_BARRIER: updBarrier(e); break;
        case EN_CUBE:   updCube(e); break;
        case EN_FLARE:  updFlare(e); break;
        case EN_LANCE:  updLance(e); break;
        case EN_CLAM:   updClam(e); break;
        }
        if (!e.type) continue;
        e.x = s16(e.x + e.vx);
        e.y = s16(e.y + e.vy);
        if (e.flags & EF_GROUND) { e.x = s16(e.x - FP(scrollStep)); e.y = s16(e.y - FP(scrollStepY)); }
        const x = PX(e.x), y = PX(e.y);
        if (x < -48 || x > SCREEN_W + 64 || y < -48 || y > PLAY_H + 48)
        {
            despawn(e);
            continue;
        }
        // body contact (cheap distance test first)
        const cdx = x - PX(pl.x);
        if (cdx > -32 && cdx < 32 &&
            !(e.flags & EF_NOSHOT) && player_hitTest(x, y, e.hw - 2, e.hh - 2))
        {
            player_kill();
            if (e.type !== EN_HATCH && e.type !== EN_BLOCK && e.type !== EN_CANNON) enemy_damage(e, 99);
        }
    }
}

function turretFrame(e)
{
    const dx = PX(pl.x) - PX(e.x);
    let dy = PX(pl.y) - PX(e.y);
    if (e.flags & EF_CEIL) dy = -dy;
    if (dy > 0) return dx < 0 ? 0 : 4;      // player below the barrel line
    // compare slope to 1:2 and 2:1 to pick among 5 directions
    const ady = -dy, adx = abs(dx);
    if (adx > ady * 2) return dx < 0 ? 0 : 4;
    if (ady > adx * 2) return 2;
    return dx < 0 ? 1 : 3;
}

const tmpQ = newFastSpr();
const flareTurn = [0, SF_HFLIP, SF_HFLIP | SF_VFLIP, SF_VFLIP];
function enemy_draw()
{
    let i = frameCount & 15;     // rotating start, see game_draw()
    for (let k = 0; k < MAX_ENEMIES; k++, i++)
    {
        if (i >= MAX_ENEMIES) i -= MAX_ENEMIES;
        const e = enemies[i];
        if (!e.type) continue;
        const x = PX(e.x), y = PX(e.y);
        let fl = 0;
        if (e.flash & 1) fl = SF_PAL(1);
        else if ((e.flags & EF_CARRIER) && (frameCount & 8)) fl = SF_PAL(1);
        if (e.flags & EF_CEIL) fl |= SF_VFLIP;
        switch (e.type)
        {
        case EN_FAN:    spr_q(FR_FAN + ((e.t >> 1) & 7), x - 8, y - 8, fl); break;
        case EN_DART:   spr_q(FR_DART, x - 8, y - 8, fl | (e.vx > 0 ? SF_HFLIP : 0)); break;
        case EN_TURRET: spr_q(FR_TURRET + turretFrame(e), x - 8, y - 8, fl); break;
        case EN_WALKER: spr_q(FR_WALKER + ((e.t >> 3) & 3), x - 8, y - 8, fl | (e.vx > 0 ? SF_HFLIP : 0)); break;
        case EN_HATCH:  spr_q(FR_HATCH + e.a, x - 16, y - 8, fl); break;
        case EN_MINI:   spr_q(FR_MINI + ((e.t >> 2) & 1), x - 4, y - 4, fl | (e.vx > 0 ? SF_HFLIP : 0)); break;
        case EN_ROCK:   spr_q(FR_ROCK + ((e.t >> 3) & 3), x - 8, y - 8, fl & ~SF_VFLIP); break;
        case EN_CRAB:   spr_q(FR_CRAB + ((e.t >> 4) & 1), x - 16, y - 12, fl); break;
        case EN_ICICLE:
        {
            const jig = (e.a === 1) ? ((e.t & 2) ? 1 : -1) : 0;
            spr_q(FR_ICICLE + (e.a ? 1 : 0), x - 4 + jig, y - 12, fl & ~SF_VFLIP);
            break;
        }
        case EN_FLAKE:  spr_q(FR_FLAKE + modu(e.t >> 2, 6), x - 8, y - 8, fl); break;
        case EN_SLED:   spr_q(FR_SLED + ((e.t >> 3) & 1), x - 12, y - 8, fl | (e.vx > 0 ? SF_HFLIP : 0)); break;
        case EN_SPORE:  spr_q(FR_SPORE + ((e.t >> 3) & 1), x - 8, y - 8, fl); break;
        case EN_AMOEBA: spr_q(FR_AMOEBA + ((e.t >> 4) & 1), x - 12, y - 12, fl); break;
        case EN_CELL:   spr_q(FR_CELL + ((e.t >> 3) & 1), x - 8, y - 8, fl); break;
        case EN_JELLY:
        {
            const p = e.t & 63;
            spr_q(FR_JELLY + (p < 8 ? 2 : p < 16 ? 1 : 0), x - 8, y - 8, fl);
            break;
        }
        case EN_FISH:   spr_q(FR_FISH + ((e.t >> 3) & 1), x - 8, y - 4, fl); break;
        case EN_MINE:   spr_q(FR_MINE + ((e.t >> 4) & 1), x - 8, y - 8, fl); break;
        case EN_BLOCK:  spr_q(FR_BLOCK + (e.hp <= 3 ? 1 : 0), x - 8, y - 16, fl); break;
        case EN_CANNON: spr_q(FR_CANNON + (e.a > 4 ? 1 : 0), x - 16, y - 12, fl); break;
        case EN_ORB:    spr_q(FR_ORB + ((e.t >> 3) & 1), x - 8, y - 8, fl); break;
        case EN_CLAM:
        {
            // the pearl (the box) sits at (17, 32) in the 64 x 48 picture
            // (a hit flashes the pearl: the shell drawn in the player's palette)
            const jig = e.a === 1 ? ((e.t >> 1) & 1) : 0;
            const k = e.a ? 1 : 0;
            const hit = k && (e.flash & 1);
            for (let i = 0; i < clamN[k]; i++)
            {
                const q = clamF[k][i];
                tmpQ.attr = hit ? (q.attr & ~0x6000) | 0x2000 : q.attr;   // the player's palette: a flash
                tmpQ.dx = q.dx; tmpQ.dy = q.dy; tmpQ.sizeLink = q.sizeLink;
                spr_fast(tmpQ, x - 17 + jig, y - 32);
            }
            if (e.a === 1 && (e.t & 8))
            {
                // gaping: a thin trickle, the warning
                const by = y - 16 - ((e.t << 1) & 31);
                spr_fast(bubF[0], x - 8 + ((e.t >> 2) & 1), by);
            }
            break;
        }
        case EN_FLARE:
            // the head (the body is plane cells)
            if (e.a === 2 && e.cd <= FLARE_STEPS)
            {
                flarePoint(e, e.cd);
                // (it boils by turning over)
                spr_q(FR_FLAREHEAD, fpX - 32, fpY - 32, flareTurn[(e.t >> 2) & 3]);
            }
            break;
        case EN_LANCE:
            // a big beam leaves the star in a ball of fire
            for (let q = 0; q < lanceN; q++)
            {
                const b = lance[q];
                if (!b.vert || b.thick < 4 || b.state !== PB_ON || (e.a !== LP_GROW && e.a !== LP_HOLD)) continue;
                const sx = ((b.c0 + (b.thick >> 1)) << 3) - cameraX;
                spr_q(FR_FLAREHEAD, sx - 32, (b.r0 << 3) - 16, flareTurn[(e.t >> 2) & 3]);
            }
            break;
        case EN_CUBE:
            spr_q(FR_CUBE + ((e.t >> 3) & 3), x - 16, y - 16, fl & ~SF_VFLIP);
            break;
        case EN_GATE:
        {
            const f = !e.pb ? 0 : e.pb.state;
            spr_q(FR_EMITTER + f, x - 8, y - 8, fl);
            spr_q(FR_EMITTER + f, x - 8, y + 8 - e.b, (fl & ~SF_VFLIP) | SF_VFLIP);
            break;
        }
        case EN_BARRIER:
        {
            const f = !e.pb ? 0 : e.pb.state;
            spr_q(FR_EMITTER + 3 + f, x - 8, y - 8, fl);
            spr_q(FR_EMITTER + 3 + f, x - 8 + e.b, y - 8, fl | SF_HFLIP);
            break;
        }
        case EN_LCANNON:
        {
            // the rail, roof to deck, behind it
            const wx = cameraX + x;
            let r0 = stage_ceilAt(wx), r1 = stage_floorAt(wx);
            if (r0 < 0) r0 = 0;
            if (r1 > PLAY_H) r1 = PLAY_H;
            for (let ry = r0; ry < r1; ry += 32)
                if (ry + 32 < y - 8 || ry > y + 8) spr_q(FR_RAIL, x - 4, ry, 0);
            spr_q(FR_LCANNON + (!e.pb ? 0 : e.a === 1 ? 1 : e.a >= 2 ? 2 : 0), x - 16, y - 8,
                  e.a === 1 && (e.t & 2) ? (fl | SF_PAL(1)) : fl);
            break;
        }
        case EN_LANCER:
            // never invisible: the warning before the charge is a flash
            spr_q(FR_LANCER + ((e.t >> 1) & 1), x - 12, y - 8,
                     (e.t < 40 && (e.t & 4)) ? (fl | SF_PAL(1)) : fl);
            break;
        case EN_WORM:
            spr_q(FR_WORMHEAD + ((e.t >> 3) & 1), x - 8, y - 8, fl);
            if (e.a >= 0)
            {
                const k = e.a;
                for (let s = 0; s < WORM_SEGS; s++)
                    spr_fast(wormF, wsegX[k][s] - 8, wsegY[k][s] - 8);
            }
            break;
        }
    }
}

// ------------------------------------------------------------------ collisions with player shots

// Bands of 32 lines for the shot test: each enemy is listed in every band
// its box (grown by a shot's half height) touches, so a shot only looks at
// the enemies listed in the band of its own centre.
const CBANDS = 8;

function cband(y)
{
    if (y < 0) return 0;
    y >>= 5;
    return y >= CBANDS ? CBANDS - 1 : y;
}

const live = new Array(MAX_ENEMIES).fill(null);
const bx0 = new Int16Array(MAX_ENEMIES), bx1 = new Int16Array(MAX_ENEMIES);
const by0 = new Int16Array(MAX_ENEMIES), by1 = new Int16Array(MAX_ENEMIES);
const band = Array.from({ length: CBANDS }, () => new Uint8Array(MAX_ENEMIES));
const bandN = new Uint16Array(CBANDS);

function enemy_collideShots()
{
    // Gather the live, shootable enemies once, as plain boxes: the inner
    // loop then is four compares per pair.
    bandN.fill(0);
    let nlive = 0;
    for (let i = 0; i < MAX_ENEMIES; i++)
    {
        const e = enemies[i];
        if (!e.type || (e.flags & EF_NOSHOT)) continue;
        const x = PX(e.x), y = PX(e.y);
        live[nlive] = e;
        bx0[nlive] = x - e.hw;
        bx1[nlive] = x + e.hw;
        by0[nlive] = y - e.hh;
        by1[nlive] = y + e.hh;
        // a shot (y +-3) can touch it with its centre in by0-2 .. by1+2
        for (let b = cband(by0[nlive] - 2), b1 = cband(by1[nlive] + 2); b <= b1; b++)
            band[b][bandN[b]++] = nlive;
        nlive++;
    }
    const bossOn = bossBox[0] <= bossBox[2];
    if (!nlive && !bossOn) return;

    for (let si = 0; si < MAX_SHOTS; si++)
    {
        const s = shots[si];
        if (!s.type) continue;
        // A laser segment is 32 px long and moves 10 px a frame, so testing
        // each one every other frame (alternating halves) cannot miss
        // anything, and with four options there are fifteen of them.
        // A plain shot flies level too, 9 px a frame: tested as well by turns,
        // its box reaching back over the frame skipped.
        if ((s.type === SH_LASER || s.type === SH_SHOT) && ((si ^ frameCount) & 1)) continue;
        const sx = PX(s.x), sy = PX(s.y);
        if (bossOn)
        {
            const tx = sx + (s.type === SH_LASER ? 28 : 4);
            if (tx >= bossBox[0] && tx < bossBox[2] && sy >= bossBox[1] && sy < bossBox[3] &&
                boss_shotHit(s))
                continue;
        }
        if (stageNum === 2 && wormBlocks(s, s.type === SH_LASER ? sx + 28 : sx + 4, sy)) continue;
        // the shot's own box
        let x0, x1;
        if (s.type === SH_LASER) { x0 = sx; x1 = sx + 32; }
        else { x0 = s.type === SH_SHOT ? sx - 13 : sx - 4; x1 = sx + 4; }
        const y0 = sy - 3, y1 = sy + 3;
        const b = cband(sy);
        const list = band[b];
        for (let j = 0; j < bandN[b]; j++)
        {
            const k = list[j];
            if (x1 <= bx0[k] || x0 >= bx1[k] || y1 <= by0[k] || y0 >= by1[k]) continue;
            const e = live[k];
            if (!e.type) continue;   // destroyed earlier this frame
            // a shut clam is armour: the shot just stops
            if (e.type === EN_CLAM && !e.a)
            {
                enemy_damage(e, 0);
                shot_kill(s, FALSE);
                break;
            }
            if (s.type === SH_LASER)
            {
                // lasers pierce: hurt each enemy once per segment
                if (s.hitId === e.id) continue;
                s.hitId = e.id;
                enemy_damage(e, shot_damage(s));
                if (e.type && e.hp > 0)
                {
                    shot_kill(s, TRUE);   // something tough stops the beam
                    break;
                }
                continue;
            }
            enemy_damage(e, shot_damage(s));
            shot_kill(s, TRUE);
            break;
        }
    }
}

// ------------------------------------------------------------------ enemy bullets

let ebLive = 0;   // how many are on
const ebSpr = new Uint32Array(2 * MAX_EBULLETS);   // this frame's bullet sprites
let ebSprN = 0, ebRot = 0;
// Bullets that have passed the ship (behind it, flying away) can no longer
// hurt it: they are staged from the list's far end and drawn last of all,
// after the ship's shots, so a crowded line drops them first.
let ebPassN = 0, ebPassRot = 0;

function ebullet_init()
{
    ebLive = 0;
    ebSprN = ebPassN = 0;
    // a round orb (no heading): two frames, blinking
    for (let k = 0; k < 2; k++)
        spr_fastPrepare(ebF[k], FR_EBULLET + k, 0);
    for (let k = 0; k < 2; k++)
        spr_fastPrepare(beamF[k], FR_BEAM + k, 0);
    for (let i = 0; i < MAX_EBULLETS; i++) eb[i].on = FALSE;
    for (let i = 0; i < MAX_BEAMS; i++) beams[i].on = FALSE;
}

function ebullet_clear()
{
    for (let i = 0; i < MAX_EBULLETS; i++)
        if (eb[i].on)
        {
            fx_spark(PX(eb[i].x), PX(eb[i].y));
            eb[i].on = FALSE;
        }
    ebLive = 0;
    ebSprN = ebPassN = 0;
    for (let i = 0; i < MAX_BEAMS; i++) beams[i].on = FALSE;
}

function ebullet_fire(x, y, vx, vy)
{
    vx = s16(vx); vy = s16(vy);
    for (let i = 0; i < MAX_EBULLETS; i++)
        if (!eb[i].on)
        {
            eb[i].on = TRUE;
            ebLive++;
            eb[i].x = FP(x);
            eb[i].y = FP(y);
            eb[i].vx = vx;
            eb[i].vy = vy;
            eb[i].dir = ((iatan2(vy, vx) + 16) >> 5) & 7;
            return;
        }
}

function ebullet_aim(x, y, speed)
{
    const dx = PX(pl.x) - x;
    const dy = PX(pl.y) - y;
    // don't fire point-blank: it reads as unfair
    if (abs(dx) < 24 && abs(dy) < 24) return;
    const a = iatan2(dy, dx) & 255;
    ebullet_fire(x, y, mul16s(icos(a), speed) >> 8, mul16s(isin(a), speed) >> 8);
}

// step: angle between bullets in 1/256 turns
function ebullet_spread(x, y, speed, n, step)
{
    let a = iatan2(s16(PX(pl.y) - y), s16(PX(pl.x) - x)) & 255;
    a = (a - (((step * (n - 1)) >> 1) & 255)) & 255;
    for (let k = 0; k < n; k++, a = (a + step) & 255)
        ebullet_fire(x, y, mul16s(icos(a), speed) >> 8, mul16s(isin(a), speed) >> 8);
}

function beam_fire(x, y)
{
    for (let i = 0; i < MAX_BEAMS; i++)
        if (!beams[i].on)
        {
            beams[i].on = TRUE;
            beams[i].x = FP(x);
            beams[i].y = FP(y);
            beams[i].vx = -FP(7);
            return;
        }
}

function forceAbsorb(x, y, cost)
{
    if (pl.force <= 0 || !pl.alive) return FALSE;
    const px = PX(pl.x), py = PX(pl.y);
    if (x >= px + 6 && x <= px + 26 && y >= py - 16 && y <= py + 16)
    {
        pl.force -= cost;
        if (pl.force < 0) pl.force = 0;
        sound_play(SFX_SHIELDHIT);
        return TRUE;
    }
    return FALSE;
}

function ebullet_update()
{
    const px = PX(pl.x), py = PX(pl.y);
    let seen = 0;
    const live = ebLive;
    let sp = 0, spP = MAX_EBULLETS;
    const f0 = ebF[(frameCount >> 2) & 1], f1 = ebF[((frameCount >> 2) & 1) ^ 1];
    for (let i = 0; i < MAX_EBULLETS && seen < live; i++)
    {
        const b = eb[i];
        if (!b.on) continue;
        seen++;
        b.x = s16(b.x + b.vx);
        b.y = s16(b.y + b.vy);
        const x = PX(b.x), y = PX(b.y);
        if (x < -8 || x > SCREEN_W + 8 || y < -8 || y > PLAY_H + 4)
        {
            b.on = FALSE;
            ebLive--;
            continue;
        }
        // most bullets are nowhere near the ship: one cheap test first
        const ddx = x - px, ddy = y - py;
        if (ddx >= -16 && ddx <= 32 && ddy >= -20 && ddy <= 20)
        {
            if (forceAbsorb(x, y, 1))
            {
                fx_spark(x, y);
                b.on = FALSE;
                ebLive--;
                continue;
            }
            if (player_hitTest(x, y, 2, 2))
            {
                player_kill();
                b.on = FALSE;
                ebLive--;
                continue;
            }
        }
        // (half the bullets blink in turn with the other half)
        const f = (i & 1) ? f1 : f0;
        if (ddx < -12 && b.vx <= 0) spr_stage(ebSpr, --spP, f, x - 8, y - 8);
        else spr_stage(ebSpr, sp++, f, x - 8, y - 8);
    }
    ebSprN = sp;
    ebPassN = MAX_EBULLETS - spP;
    for (let i = 0; i < MAX_BEAMS; i++)
    {
        const b = beams[i];
        if (!b.on) continue;
        b.x = s16(b.x + b.vx);
        const x = PX(b.x), y = PX(b.y);
        if (x < -40) { b.on = FALSE; continue; }
        if (forceAbsorb(x, y, 3)) { fx_spark(x, y); b.on = FALSE; continue; }
        if (player_hitTest(x + 16, y, 16, 2)) player_kill();
    }
}

function ebullet_draw()
{
    const f = (frameCount >> 2) & 1;
    // the starting bullet steps on each frame (see game_draw())
    ebRot = (ebRot + 5) & 0xFFFF;
    while (ebRot >= ebSprN && ebSprN) ebRot -= ebSprN;
    spr_copyStaged(ebSpr, ebSprN, ebRot);
    for (let i = 0; i < MAX_BEAMS; i++)
        if (beams[i].on) spr_fast(beamF[f], PX(beams[i].x), PX(beams[i].y) - 4);
}

function ebullet_drawPassed()
{
    if (!ebPassN) return;
    ebPassRot += 3;
    while (ebPassRot >= ebPassN) ebPassRot -= ebPassN;
    spr_copyStaged(ebSpr.subarray((MAX_EBULLETS - ebPassN) * 2), ebPassN, ebPassRot);
}

// ------------------------------------------------------------------ capsules

let capsDropped = 0;
let capVX = 0, capVY = 0;       // the drift, easing to the scroll's direction

function capsule_init()
{
    for (let i = 0; i < MAX_CAPS; i++) caps[i].on = FALSE;
    capsDropped = 0;
    capVX = scrollDirX;
    capVY = scrollDirY;
}

function capsule_drop(x, y, blue)
{
    // every 9th capsule is a blue one (clears the screen)
    if (++capsDropped >= 9)
    {
        capsDropped = 0;
        blue = TRUE;
    }
    for (let i = 0; i < MAX_CAPS; i++)
        if (!caps[i].on)
        {
            caps[i].on = TRUE;
            caps[i].blue = blue;
            caps[i].x = FP(x);
            caps[i].y = FP(y);
            caps[i].t = 0;
            return;
        }
}

function capsule_dropToward(x, y, side, frames)
{
    x -= mul16s(scrollDirX, frames) >> 4;
    y -= mul16s(scrollDirY, frames) >> 4;
    if (abs(scrollDirX) >= abs(scrollDirY))
    {
        y += side * 24;
        // (a slope may reverse before it arrives: not from out of reach)
        if (y < 24) y = 24;
        if (y > 184) y = 184;
    }
    else x += side * 16;
    capsule_drop(x, y, FALSE);
}

function capsule_update()
{
    // the drift eases round when the scroll turns
    if (capVX !== scrollDirX) capVX += capVX < scrollDirX ? 1 : -1;
    if (capVY !== scrollDirY) capVY += capVY < scrollDirY ? 1 : -1;
    for (let i = 0; i < MAX_CAPS; i++)
    {
        const c = caps[i];
        if (!c.on) continue;
        c.t = (c.t + 1) & 0xFFFF;
        // capsules go the way the scroll goes, but slowly whatever its speed, so
        // there is time to go and get them
        c.x = s16(c.x + capVX);
        c.y = s16(c.y + capVY);
        const x = PX(c.x), y = PX(c.y);
        // (gone once past the edge it is heading for: it may start beyond the one behind)
        if ((capVX < 0 && x < -16) || (capVX > 0 && x > SCREEN_W + 16) ||
            (capVY < 0 && y < -16) || (capVY > 0 && y > 240))
        {
            c.on = FALSE;
            continue;
        }
        if (pl.alive && abs(PX(pl.x) - x) < 16 && abs(PX(pl.y) - y) < 12)
        {
            c.on = FALSE;
            game_addScore(500);
            if (c.blue)
            {
                enemy_killAll(TRUE);
                stage_flash(6);
                stage_shake(14, 2);
                ebullet_clear();
                sound_play(SFX_BIGEXPLODE);
            }
            else player_capsule();
        }
    }
}

function capsule_draw()
{
    for (let i = 0; i < MAX_CAPS; i++)
    {
        const c = caps[i];
        if (!c.on) continue;
        const fr = (c.blue ? FR_CAPBLUE : FR_CAPRED) + ((c.t >> 3) & 1);
        spr_q(fr, PX(c.x) - 8, PX(c.y) - 8, 0);
    }
}

Object.assign(window, {
    enemy_init, enemy_spawn, enemy_update, enemy_draw, enemy_damage, enemy_killAll, enemy_count,
    enemy_newGroup, enemy_collideShots, enemy_wormAhead, enemy_predict,
    ebullet_init, ebullet_fire, ebullet_aim, ebullet_spread, ebullet_update, ebullet_draw, ebullet_clear,
    ebullet_drawPassed, beam_fire, capsule_init, capsule_drop, capsule_dropToward, capsule_update, capsule_draw,
    enemy_iceShot, enemy_geyser, enemy_flareZone,
});
})();
