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

// fast-path sprites; ebF by heading
const ebF = Array.from({ length: 8 }, () => newFastSpr());
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
    for (let i = 0; i < MAX_WORMS; i++) wormUsed[i] = FALSE;
    if (assetVram[AS_WORMBODY]) spr_fastPrepare(wormF, FR_WORMBODY, 0);
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

function despawn(e)
{
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
    const big = e.hw > 10;
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
    // invisible emitter on a peak; a = interval
    const x = PX(e.x);
    e.cd = s16(e.cd - 1);
    if (e.cd > 0) return;
    // a bare ship gets about half the rocks a fully armed one does
    e.cd = s16(divu(mul16u(e.a, 190 - 7 * player_power()), 100));
    if (x > 0 && x < SCREEN_W)
    {
        const r = enemy_spawn(EN_ROCK, x, PX(e.y), 0);
        if (r)
        {
            const rnd = random();
            r.vx = (rnd & 31) - 22;
            r.vy = (e.flags & EF_CEIL) ? FP(1) + ((rnd >> 5) & 15) : -FP(4) - ((rnd >> 5) & 31);
            if (e.flags & EF_CEIL) r.flags |= EF_CEIL;
        }
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
        }
        if (!e.type) continue;
        e.x = s16(e.x + e.vx);
        e.y = s16(e.y + e.vy);
        if (e.flags & EF_GROUND) e.x = s16(e.x - FP(scrollStep));
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
        if (s.type === SH_LASER && ((si ^ frameCount) & 1)) continue;
        const sx = PX(s.x), sy = PX(s.y);
        if (bossOn)
        {
            const tx = sx + (s.type === SH_LASER ? 28 : 4);
            if (tx >= bossBox[0] && tx < bossBox[2] && sy >= bossBox[1] && sy < bossBox[3] &&
                boss_shotHit(s))
                continue;
        }
        if (wormBlocks(s, s.type === SH_LASER ? sx + 28 : sx + 4, sy)) continue;
        // the shot's own box
        let x0, x1;
        if (s.type === SH_LASER) { x0 = sx; x1 = sx + 32; }
        else { x0 = sx - 4; x1 = sx + 4; }
        const y0 = sy - 3, y1 = sy + 3;
        const b = cband(sy);
        const list = band[b];
        for (let j = 0; j < bandN[b]; j++)
        {
            const k = list[j];
            if (x1 <= bx0[k] || x0 >= bx1[k] || y1 <= by0[k] || y0 >= by1[k]) continue;
            const e = live[k];
            if (!e.type) continue;   // destroyed earlier this frame
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

function ebullet_init()
{
    ebLive = 0;
    ebSprN = 0;
    // Eight headings, clockwise from pointing right. The art has right,
    // down-right and down; the rest are those, mirrored.
    for (let d = 0; d < 8; d++)
    {
        let fr, fl;
        if (d <= 2)      { fr = d;     fl = 0; }
        else if (d <= 4) { fr = 4 - d; fl = SF_HFLIP; }
        else if (d <= 6) { fr = d - 4; fl = SF_HFLIP | SF_VFLIP; }
        else             { fr = 8 - d; fl = SF_VFLIP; }
        spr_fastPrepare(ebF[d], FR_EBULLET + fr, fl);
    }
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
    ebSprN = 0;
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
    let sp = 0;
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
        spr_stage(ebSpr, sp++, ebF[b.dir], x - 8, y - 8);
    }
    ebSprN = sp;
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

// ------------------------------------------------------------------ capsules

let capsDropped = 0;

function capsule_init()
{
    for (let i = 0; i < MAX_CAPS; i++) caps[i].on = FALSE;
    capsDropped = 0;
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

function capsule_update()
{
    for (let i = 0; i < MAX_CAPS; i++)
    {
        const c = caps[i];
        if (!c.on) continue;
        c.t = (c.t + 1) & 0xFFFF;
        // capsules drift slowly whatever the scroll speed, so there is time
        // to go and get them
        c.x = s16(c.x - 8);
        const x = PX(c.x), y = PX(c.y);
        if (x < -16) { c.on = FALSE; continue; }
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
    beam_fire, capsule_init, capsule_drop, capsule_update, capsule_draw,
});
})();
