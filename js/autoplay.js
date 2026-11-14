// AUTO PLAY: the ship flies itself, at one of three skills.
'use strict';
(function () {

// autoPlay (0 = off, 1 novice, 2 normal, 3 expert) lives in globals.js.

// every:     frames from one decision to the next (3 at least)
// lag:       frames between decision and pad
// vision:    px around the ship it attends to
// samples:   how many of the look-ahead moments it weighs
// slip:      chance in 256 of keeping the old move
// margin:    extra px kept from bullets
// room:      px it likes to keep from enemies
// powerWait: frames before it takes the lit power-up
const skills = [
    { every: 8, lag: 6, vision: 72,  samples: 3, slip: 30, margin: 1, room: 6,  powerWait: 90 },
    { every: 5, lag: 3, vision: 120, samples: 4, slip: 12, margin: 2, room: 14, powerWait: 30 },
    { every: 3, lag: 1, vision: 160, samples: 5, slip: 0,  margin: 3, room: 20, powerWait: 5 },
];

// look-ahead moments, frames (2, 4, 8, 12, 16: shifts, see add())
const when = [2, 4, 8, 12, 16];
const dirX = [0, -1, 1, 0, 0, -1, 1, -1, 1];
const dirY = [0, 0, 0, -1, 1, -1, -1, 1, 1];
const dirPad = [0, BUTTON_LEFT, BUTTON_RIGHT, BUTTON_UP, BUTTON_DOWN,
                BUTTON_LEFT | BUTTON_UP, BUTTON_RIGHT | BUTTON_UP,
                BUTTON_LEFT | BUTTON_DOWN, BUTTON_RIGHT | BUTTON_DOWN];
const speedTab = [22, 30, 38, 46, 54, 62];

const MAXN = 12;
// bullets at each moment, px
const nx = Array.from({ length: 5 }, () => new Int16Array(MAXN));
const ny = Array.from({ length: 5 }, () => new Int16Array(MAXN));
const nhw = new Uint8Array(MAXN), nhh = new Uint8Array(MAXN);   // their half boxes (enemies are bigger)
const nw = new Uint16Array(MAXN);                               // cost of touching one
let nn = 0;

let move = 0, timer = 0, powerT = 0, phase = 0;     // u8
const queue = new Uint16Array(8);
let qpos = 0;

function autoplay_start(skill)
{
    autoPlay = skill & 255;
    move = timer = powerT = phase = 0;
    qpos = 0;
    queue.fill(0);
}

function cannonDanger(x, y, dt)
{
    if (stageNum != 4 || boss.state != B_FIGHT) return 0;
    const p = modu(boss.t + dt, 290);       // dt frames from now
    const d = abs(y - (boss.y + 48)) & 0xFFFF;
    return (p >= 180 && p < 262 && x < boss.x + 40 && d < 18) ? 18 - d : 0;
}

// A plane laser that burns or is about to (pbeam.js), as a box round the
// part of it nearest the ship: sets bnX, bnY (centre) and bnW, bnH (half
// sizes) in px.
let bnX = 0, bnY = 0, bnW = 0, bnH = 0;
function beamNear(b, px, py)
{
    if (!b.used || b.state === PB_OFF) return false;
    const bx = pbeam_screenBox(b);
    const x0 = bx[0] - 3, y0 = bx[1] - 3, x1 = bx[2] + 3, y1 = bx[3] + 3;   // the box the beam will burn
    if (b.vert)
    {
        bnX = (x0 + x1) >> 1; bnW = (((x1 - x0) >> 1) + 2) & 255;
        bnY = py < y0 + 12 ? y0 + 12 : py > y1 - 12 ? y1 - 12 : py; bnH = 40;
    }
    else
    {
        bnY = (y0 + y1) >> 1; bnH = (((y1 - y0) >> 1) + 2) & 255;
        bnX = px < x0 + 12 ? x0 + 12 : px > x1 - 12 ? x1 - 12 : px; bnW = 40;
    }
    return (abs(bnX - px) & 0xFFFF) < 90 && (abs(bnY - py) & 0xFFFF) < 90;
}

function add(x, y, vx, vy, hw, hh, w, k)
{
    if (nn >= MAXN) return;
    // positions at 2, 4, 8, 12 and 16 frames, 12.4 fixed point, by shifts
    const x2 = s16(vx << 1), y2 = s16(vy << 1), x4 = s16(vx << 2), y4 = s16(vy << 2),
        x8 = s16(vx << 3), y8 = s16(vy << 3);
    nx[0][nn] = PX(x + x2);        ny[0][nn] = PX(y + y2);
    nx[1][nn] = PX(x + x4);        ny[1][nn] = PX(y + y4);
    nx[2][nn] = PX(x + x8);        ny[2][nn] = PX(y + y8);
    nx[3][nn] = PX(x + x8 + x4);   ny[3][nn] = PX(y + y8 + y4);
    nx[4][nn] = PX(x + (x8 << 1)); ny[4][nn] = PX(y + (y8 << 1));
    nhw[nn] = hw;
    nhh[nn] = hh;
    nw[nn] = w;
    nn++;
}

// an enemy that does not fly straight (worm, fish, ground unit): its own
// prediction at the five moments
const when5 = [2, 4, 8, 12, 16];
function addEnemy(e, hw, hh, w)
{
    if (nn >= MAXN) return;
    for (let s = 0; s < 5; s++)
    {
        const p = enemy_predict(e, when5[s]);
        nx[s][nn] = PX(s16(p.x));
        ny[s][nn] = PX(s16(p.y));
    }
    nhw[nn] = hw;
    nhh[nn] = hh;
    nw[nn] = w;
    nn++;
}

function curved(e)
{
    return e.type == EN_WORM || e.type == EN_FISH;
}

// Small things a shot breaks (rocks, mini craft, cells, spores, flakes,
// falling ice) coming down the ship's line of fire, still a way ahead: the
// gun held down meets them first, so they are not worth a dodge -- the
// bullets, which nothing stops, are.
function shotDown(e, px, py)
{
    switch (e.type)
    {
    case EN_ROCK: case EN_MINI: case EN_CELL: case EN_SPORE: case EN_FLAKE: case EN_CUBE:
        break;
    default:
        return false;
    }
    if (e.hp > 2 || (e.flags & EF_NOSHOT)) return false;
    const dx = PX(e.x) - px, dy = PX(e.y) - py;
    return dx > 28 && dx < 200 && dy > -e.hh - 2 && dy < e.hh + 2;
}

function nearShip(x, y, px, py, v)
{
    return (abs(x - px) & 0xFFFF) < v && (abs(y - py) & 0xFFFF) < v;
}

// The power-up this player is after, from what the ship has (-2: none).
function wanted()
{
    if (pl.speedLv < 1) return G_SPEED;
    if (!pl.missile) return G_MISSILE;
    if (pl.options < 2) return G_OPTION;
    if (pl.weapon != WPN_LASER) return G_LASER;
    if (pl.speedLv < 2) return G_SPEED;
    if (pl.options < 4) return G_OPTION;
    if (pl.force <= 0) return G_FORCE;
    return -2;
}

let best = 0;
let bestCost = 0xFFFFFFFF;
let tx = 0, ty = 0;
let bossOn = false;

const gDts = [2, 4, 8, 12, 16];
const gFx = new Int16Array(7), gFy = new Int16Array(7);
const gWx = Array.from({ length: 6 }, () => new Int16Array(5));
const gWy = Array.from({ length: 6 }, () => new Int16Array(5));

function gather(k)
{
    const px = PX(pl.x), py = PX(pl.y);
    const v = k.vision;
    nn = 0;
    for (let i = 0; i < MAX_EBULLETS; i++)
    {
        const b = eb[i];
        if (b.on && nearShip(PX(b.x), PX(b.y), px, py, v))
            add(b.x, b.y, b.vx, b.vy, 6 + k.margin, 4 + k.margin, 1000, k);
    }
    for (let i = 0; i < MAX_BEAMS; i++)
    {
        const b = beams[i];
        if (b.on && (abs(PX(b.y) - py) & 0xFFFF) < v)
            add(s16(b.x + FP(16)), b.y, b.vx, 0, 20 + k.margin, 4 + k.margin, 1000, k);
    }
    // the Zenith's loops of flame: all of each loop that burns or will
    // (the body, and the head's way on), fixed in the world, kept clear of
    if (stageNum == 5)
    {
        const n = enemy_flareZone(px + 8, py, 56, gFx, gFy, 7);
        for (let i = 0; i < n; i++)
            add(FP(gFx[i]), FP(gFy[i]), -FP(scrollStep), 0, 13 + k.margin, 13 + k.margin, 1000, k);
    }
    // plane lasers: they move with the rock
    for (let i = 0; i < MAX_PBEAMS && pbeamCount; i++)
        if (beamNear(pbeams[i], px, py))
            add(FP(bnX), FP(bnY), -FP(scrollStep), -FP(scrollStepY), bnW + k.margin, bnH + k.margin, 1000, k);
    // something to line up with: the nearest enemy ahead
    let bestAhead = 32767;
    ty = 104;
    tx = 64;
    for (let i = 0; i < MAX_ENEMIES; i++)
    {
        const e = enemies[i];
        if (!e.type || !e.hw) continue;
        const ex = PX(e.x), ey = PX(e.y);
        if (!nearShip(ex, ey, px, py, v)) continue;
        if (shotDown(e, px, py))
        {
            // keep it in the sights -- if it comes across, not down (lined
            // up under falling things, the ship would follow them down)
            if (e.type != EN_CUBE && e.vx < 0 && (abs(e.vy) & 0xFFFF) < ((-e.vx) & 0xFFFF)) { ty = ey; bestAhead = 0; }
            continue;
        }
        if (curved(e)) addEnemy(e, e.hw + 2 + k.room, e.hh + k.room, 800);
        else if (e.flags & EF_GROUND)
            add(e.x, e.y, s16(e.vx - FP(scrollStep)), s16(e.vy - FP(scrollStepY)), e.hw + 2 + k.room, e.hh + k.room, 800, k);
        else add(e.x, e.y, e.vx, e.vy, e.hw + 2 + k.room, e.hh + k.room, 800, k);
        // a fan yet to turn will sweep back right at the ship's height: wait
        // for it on the near side of its turning point
        if (e.type == EN_FAN && e.a < 2 && e.b > 48 && tx > e.b - 32) tx = s16(e.b - 32);
        // (falling ice is no target: lined up under it, the ship would
        // follow it down onto the lake)
        if (ex > px + 8 && ex - px < bestAhead && !(e.flags & EF_NOSHOT) && e.type != EN_CUBE)
        {
            bestAhead = s16(ex - px);
            ty = ey;
        }
    }
    // the Archive's clam geysers, gaping or blowing: a column to the roof
    if (clamsAwake)
        for (let i = 0; i < MAX_ENEMIES; i++)
        {
            const g = enemy_geyser(enemies[i]);
            if (!g || (abs(g.x - px) & 0xFFFF) > v) continue;
            const hh = ((g.y1 - g.y0) & 0xFFFF) >> 1;
            add(FP(g.x), FP(g.y0 + hh), -FP(scrollStep), 0, 12 + k.margin, hh > 120 ? 120 : hh, 1000, k);
        }
    // worm bodies, where the trail will take them
    if (stageNum == 2)
    {
        const n = enemy_wormAhead(px, py, 72, gDts, 5, gWx, gWy, 6);
        for (let i = 0; i < n && nn < MAXN; i++, nn++)
        {
            for (let s = 0; s < 5; s++)
            {
                nx[s][nn] = gWx[i][s];
                ny[s][nn] = gWy[i][s];
            }
            nhw[nn] = 9 + k.room;
            nhh[nn] = 7 + k.room;
            nw[nn] = 800;
        }
    }
    bossOn = bossBox[0] <= bossBox[2];
    if (bossOn)
    {
        ty = (bossBox[1] + bossBox[3]) >> 1;
        tx = s16(bossBox[0] - 60);
        if (tx < 24) tx = 24;
        if (tx > 96) tx = 96;
    }
    for (let i = 0; i < MAX_CAPS; i++)
        if (caps[i].on && (PX(caps[i].y) & 0xFFFF) < 224 && nearShip(PX(caps[i].x), PX(caps[i].y), px, py, v) &&
            !(bossOn && (stageNum == 3 ? PX(caps[i].x) > 120 : PX(caps[i].x) + 24 > bossBox[0])))
        {
            tx = PX(caps[i].x);
            ty = PX(caps[i].y);
            break;
        }
    // a laser gate coming while it rests: through it now, or be pinned
    // against the left edge when it burns (and in a climb, a barrier
    // coming down: up through it)
    for (let i = 0; i < MAX_PBEAMS && pbeamCount; i++)
    {
        const b = pbeams[i];
        if (!b.used || b.state != PB_OFF) continue;
        const bx = pbeam_screenBox(b);
        const x0 = bx[0], y0 = bx[1], x1 = bx[2], y1 = bx[3];
        if (b.vert && x0 > px - 8 && x0 < px + 110 && y0 < py && y1 > py)
            tx = x1 + 36;
        else if (!b.vert && scrollStepY < 0 && y1 < py + 8 && y1 > py - 100 && x0 < px && x1 > px)
            ty = y0 - 28;
    }
    // Where the Hive's walls swing (the screen's left is shut, stage_leftLimit): not up
    // against that edge, where there is only up and down left to dodge in.
    if (colWave && sg_swings() && tx < stage_leftLimit() + 40) tx = stage_leftLimit() + 40;
    // stay inside the gap the terrain leaves a little ahead: a pillar seen
    // late cannot be climbed in time. The look reaches 20 frames of scroll
    // (80 px at the normal speed, 4 times that in a rush) and stops before
    // a gap that does not overlap the nearer ones: that is the next wall's
    // opening, steered for once this one is passed.
    if (!stageOpen)
    {
        let top = 0, bot = PLAY_H;
        const reach = scrollStep > 1 ? s16(scrollStep * 80) : 80;
        for (let a = 16; a <= reach; a += 16)
        {
            const wx = (cameraX | 0) + px + 13 + a;
            const f = stage_floorAt(wx), c = stage_ceilAt(wx);
            if ((c > top ? c : top) + 24 >= (f < bot ? f : bot))
                break;
            if (c > top) top = c;
            if (f < bot) bot = f;
        }
        top += 12;
        bot -= 12;
        if (top < bot)
        {
            if (ty < top) ty = top;
            if (ty > bot) ty = bot;
        }
    }
    bestCost = 0xFFFFFFFF;
    best = 0;
}

function decideStep(k, budget)
{
    if (phase == 0)
    {
        gather(k);
        phase = 1;
    }
    const sp = speedTab[pl.speedLv];
    while (phase <= 9 && budget-- > 0)
    {
        const d = phase - 1;
        phase++;
        let cost = 0;                       // u32
        let sx = pl.x, sy = pl.y;
        let t = 0;
        for (let s = 0; s < k.samples; s++)
        {
            while (t < when[s])
            {
                if (dirX[d] > 0) sx = s16(sx + sp); else if (dirX[d] < 0) sx = s16(sx - sp);
                if (dirY[d] > 0) sy = s16(sy + sp); else if (dirY[d] < 0) sy = s16(sy - sp);
                t++;
            }
            if (sx < FP(stage_leftLimit())) sx = FP(stage_leftLimit());
            if (sx > FP(SCREEN_W - 24)) sx = FP(SCREEN_W - 24);
            if (sy < FP(8)) sy = FP(8);
            if (sy > FP(playBottom)) sy = FP(playBottom);
            const x = PX(sx);
            let y = PX(sy);
            const w = k.samples + 1 - s;    // sooner matters more
            const ax = nx[s], ay = ny[s];
            for (let j = 0; j < nn; j++)
            {
                let ddx = s16(x + 1 - ax[j]);
                if (ddx < 0) ddx = -ddx;
                if ((ddx & 0xFFFF) >= nhw[j]) continue;
                let ddy = s16(y - ay[j]);
                if (ddy < 0) ddy = -ddy;
                if ((ddy & 0xFFFF) < nhh[j]) cost = (cost + mul16u(nw[j], w)) >>> 0;
            }
            const cd = cannonDanger(x, y, t);
            if (cd) cost = (cost + mul16u(500 + 60 * cd, w)) >>> 0;
            if (bossOn && x + 12 > bossBox[0] - 4 && x + 12 < bossBox[2] && y > bossBox[1] - 4 && y < bossBox[3])
                cost = (cost + mul16u(300, w)) >>> 0;
            if (!stageOpen)
            {
                const wx = (cameraX | 0) + mul16u(scrollStep, t);
                y = s16(y + scrollStepY * t);
                if (y + 4 >= stage_floorAt(wx + x + 13) || y - 4 < stage_ceilAt(wx + x + 13) ||
                    y + 4 >= stage_floorAt(wx + x - 10) || y - 4 < stage_ceilAt(wx + x - 10))
                    cost = (cost + mul16u(2000, w)) >>> 0;
                // and what lies just ahead of that point
                else if (y + 4 >= stage_floorAt(wx + x + 37) || y - 4 < stage_ceilAt(wx + x + 37))
                    cost = (cost + mul16u(400, w)) >>> 0;
            }
            if (cost >= bestCost) break;     // already worse than the best move
        }
        const x = PX(sx), y = PX(sy);
        cost = (cost + (abs(y - ty) & 0xFFFF) * 2 + ((abs(x - tx) & 0xFFFF) >> 1)) >>> 0;
        if (d == move && cost > 3) cost -= 3;
        if (cost < bestCost) { bestCost = cost; best = d; }
    }
    if (phase <= 9) return FALSE;
    phase = 0;
    if ((random() & 255) >= k.slip) move = best;
    return TRUE;
}

function autoplay_think()
{
    const k = skills[autoPlay - 1];
    if (!pl.alive) return;

    if (phase || timer >= k.every)
    {
        if (decideStep(k, 9)) timer = 0;
    }
}

// Emergency dodge, every frame and first of all: anything within a short
// box round the ship (bullets, beams, enemies) is projected 1, 2, 4 and 8
// frames ahead; if the current move runs into it, the nine directions are
// tried against just those and the safest is taken at once. Returns the
// direction, or 0xFF when the current move is safe.
const EM_N = 12;
const ex_ = Array.from({ length: 4 }, () => new Int16Array(EM_N));
const ey_ = Array.from({ length: 4 }, () => new Int16Array(EM_N));
const ehw = new Uint8Array(EM_N), ehh = new Uint8Array(EM_N);
let en_ = 0;

function emAdd(x, y, vx, vy, hw, hh)
{
    if (en_ >= EM_N) return;
    // keep it only if it can come within reach of the ship in 8 frames
    // (the ship moves at most ~32 px in that time); the path is a straight
    // line, so one side of the reach box holding both ends rules it out
    // before the moments in between are worked out
    const px = PX(pl.x), py = PX(pl.y);
    const rx = s16(hw + 34), ry = s16(hh + 34);
    const x1 = s16(PX(x + vx) - px), x8 = s16(PX(x + (vx << 3)) - px);
    const y1 = s16(PX(y + vy) - py), y8 = s16(PX(y + (vy << 3)) - py);
    if ((x1 >= rx && x8 >= rx) || (x1 <= -rx && x8 <= -rx) ||
        (y1 >= ry && y8 >= ry) || (y1 <= -ry && y8 <= -ry))
        return;
    ex_[0][en_] = x1 + px;           ey_[0][en_] = y1 + py;
    ex_[1][en_] = PX(x + (vx << 1)); ey_[1][en_] = PX(y + (vy << 1));
    ex_[2][en_] = PX(x + (vx << 2)); ey_[2][en_] = PX(y + (vy << 2));
    ex_[3][en_] = x8 + px;           ey_[3][en_] = y8 + py;
    for (let s = 0; s < 4; s++)
        if ((abs(ex_[s][en_] - px) & 0xFFFF) < (rx & 0xFFFF) && (abs(ey_[s][en_] - py) & 0xFFFF) < (ry & 0xFFFF))
        {
            ehw[en_] = hw;
            ehh[en_] = hh;
            en_++;
            return;
        }
}

// the same for something whose four positions (px) are already known
function emAddPath(xs, ys, hw, hh)
{
    if (en_ >= EM_N) return;
    const px = PX(pl.x), py = PX(pl.y);
    for (let s = 0; s < 4; s++)
        if ((abs(xs[s] - px) & 0xFFFF) < hw + 34 && (abs(ys[s] - py) & 0xFFFF) < hh + 34)
        {
            for (let j = 0; j < 4; j++)
            {
                ex_[j][en_] = xs[j];
                ey_[j][en_] = ys[j];
            }
            ehw[en_] = hw;
            ehh[en_] = hh;
            en_++;
            return;
        }
}

const eaXs = new Int16Array(4), eaYs = new Int16Array(4);
function emAddEnemy(e, hw, hh)
{
    for (let s = 0; s < 4; s++)
    {
        const p = enemy_predict(e, 1 << s);
        eaXs[s] = PX(s16(p.x));
        eaYs[s] = PX(s16(p.y));
    }
    emAddPath(eaXs, eaYs, hw, hh);
}

// the same for something that stays put (pixel position)
function emAddStill(x, y, hw, hh)
{
    if (en_ >= EM_N) return;
    if ((abs(x - PX(pl.x)) & 0xFFFF) >= hw + 34 || (abs(y - PX(pl.y)) & 0xFFFF) >= hh + 34) return;
    for (let s = 0; s < 4; s++)
    {
        ex_[s][en_] = x;
        ey_[s][en_] = y;
    }
    ehw[en_] = hw;
    ehh[en_] = hh;
    en_++;
}

const emT = [1, 2, 4, 8, 16];   // [4]: terrain only
const EM_S = 3;                 // moments weighed: 2, 4, 8 frames (index 1..3)

function emAddFan(e, py)
{
    if (en_ >= EM_N) return;
    let x = e.x, y = e.y, vx = e.vx, vy = e.vy;
    let a = e.a & 255;
    for (let t = 1, s = 0; t <= 8; t++)
    {
        if (a == 0 && x < FP(e.b)) a = 1;
        else if (a == 1)
        {
            vx = s16(vx + 6);
            vy = (py > y) ? FP(2) : -FP(2);
            if (abs(py - y) < FP(2)) vy = 0;
            if (vx >= FP(3)) { vx = FP(3) + 8; vy = 0; a = 2; }
        }
        x = s16(x + vx);
        y = s16(y + vy);
        if (t == emT[s])
        {
            ex_[s][en_] = PX(x);
            ey_[s][en_] = PX(y);
            s++;
        }
    }
    ehw[en_] = e.hw + 6;
    ehh[en_] = e.hh + 4;
    en_++;
}

// Terrain limits for emCost, per sample moment and x choice (left, still,
// right: the only three places the ship can be at that moment): the ship
// hits rock at that moment if y >= emF or y < emC.
const emF = Array.from({ length: 5 }, () => new Int16Array(3));
const emC = Array.from({ length: 5 }, () => new Int16Array(3));

function emX(s, sp, xi)
{
    let x = PX(pl.x);
    const off = s16(mul16s(sp, emT[s]) >> 4);
    x += xi > 0 ? off : xi < 0 ? -off : 0;
    if (x < stage_leftLimit()) x = stage_leftLimit();
    if (x > SCREEN_W - 24) x = SCREEN_W - 24;
    return x;
}

function emTerrain(sp, xi)
{
    for (let s = 4 - EM_S; s < 5; s++)
    {
        const wx = (cameraX | 0) + emX(s, sp, xi) + mul16u(scrollStep, emT[s]);
        // (a climbing camera moves the rock down the screen as it goes)
        const vy = s16(scrollStepY * emT[s]);
        let f = stage_floorAt(wx + 14) - 4 - vy, c = stage_ceilAt(wx + 14) + 4 - vy;
        let f2 = stage_floorAt(wx + 2) - 5 - vy, c2 = stage_ceilAt(wx + 2) + 5 - vy;
        if (f2 < f) f = f2;
        if (c2 > c) c = c2;
        f2 = stage_floorAt(wx - 10) - 5 - vy; c2 = stage_ceilAt(wx - 10) + 5 - vy;
        if (f2 < f) f = f2;
        if (c2 > c) c = c2;
        emF[s][xi + 1] = f;
        emC[s][xi + 1] = c;
    }
}

// Rock 16 frames on: a pillar seen only 8 frames ahead can be too tall to
// climb in time (the plan may be stale when frames are busy)
function emFar(d, sp)
{
    if (stageOpen) return 0;
    const xi = dirX[d] + 1;
    let y = PX(pl.y);
    y += dirY[d] > 0 ? sp : dirY[d] < 0 ? -sp : 0;   // sp * 16 frames, 12.4
    if (y < 8) y = 8;
    if (y > playBottom) y = playBottom;
    return (y >= emF[4][xi] || y < emC[4][xi]) ? 100 : 0;
}

function emCost(d, sp, bound)
{
    let cost = 0;
    const xi = dirX[d];
    for (let s = 4 - EM_S; s < 4; s++)
    {
        const x = emX(s, sp, xi);
        let y = PX(pl.y);
        const off = s16(mul16s(sp, emT[s]) >> 4);
        y += dirY[d] > 0 ? off : dirY[d] < 0 ? -off : 0;
        if (y < 8) y = 8;
        if (y > playBottom) y = playBottom;
        const w = 8 >> s;                   // the nearest moment counts most
        for (let j = 0; j < en_; j++)
        {
            let dx = s16(x + 1 - ex_[s][j]), dy = s16(y - ey_[s][j]);
            if (dx < 0) dx = -dx;
            if (dy < 0) dy = -dy;
            if ((dx & 0xFFFF) < ehw[j] && (dy & 0xFFFF) < ehh[j]) cost = (cost + 100 * w) & 0xFFFF;
        }
        const cd = cannonDanger(x, y, emT[s]);
        if (cd) cost = (cost + (40 + 6 * cd) * w) & 0xFFFF;
        if (cost >= bound) return cost;     // no better than one already found
        if (!stageOpen && (y >= emF[s][xi + 1] || y < emC[s][xi + 1]))
            cost = (cost + 150 * w) & 0xFFFF;
        // the boss's own box (not the Leviathan's: it spans the screen)
        if (stageNum != 3 && bossBox[0] <= bossBox[2] && x + 14 > bossBox[0] && x - 10 < bossBox[2] &&
            y + 4 > bossBox[1] && y - 4 < bossBox[3])
            cost = (cost + 60 * w) & 0xFFFF;
        // in a boss fight, the far side of the screen is the boss's
        if (boss.state == B_FIGHT && x > 140) cost = (cost + ((x - 140) >> 3) * w) & 0xFFFF;
    }
    return (cost + emFar(d, sp)) & 0xFFFF;
}

// emCost for all nine directions in one pass: at each moment the ship can
// only be in three columns and three rows, so an object is tested against
// those six lines and only a hit in both marks the directions it touches.
// `cost` is a Uint16Array(9), filled in place.
const caXs = new Int16Array(3), caYs = new Int16Array(3);
function emCostAll(sp, cost)
{
    for (let d = 0; d < 9; d++) cost[d] = 0;
    const py = PX(pl.y);
    for (let s = 4 - EM_S; s < 4; s++)
    {
        const off = s16(mul16s(sp, emT[s]) >> 4);
        const xs = caXs, ys = caYs;
        for (let i = 0; i < 3; i++)
        {
            xs[i] = emX(s, sp, i - 1);
            let y = s16(py + (i == 0 ? -off : i == 2 ? off : 0));
            if (y < 8) y = 8;
            if (y > playBottom) y = playBottom;
            ys[i] = y;
        }
        const w = 8 >> s;
        const ax = ex_[s], ay = ey_[s];
        for (let j = 0; j < en_; j++)
        {
            const hw = ehw[j], hh = ehh[j];
            let xm = 0, ym = 0;
            for (let i = 0; i < 3; i++)
            {
                if ((abs(xs[i] + 1 - ax[j]) & 0xFFFF) < hw) xm |= 1 << i;
                if ((abs(ys[i] - ay[j]) & 0xFFFF) < hh) ym |= 1 << i;
            }
            if (!xm || !ym) continue;
            for (let d = 0; d < 9; d++)
                if ((xm >> (dirX[d] + 1)) & (ym >> (dirY[d] + 1)) & 1) cost[d] += 100 * w;
        }
        for (let d = 0; d < 9; d++)
        {
            const xi = dirX[d] + 1;
            const x = xs[xi], y = ys[dirY[d] + 1];
            let c = 0;
            const cd = cannonDanger(x, y, emT[s]);
            if (cd) c += (40 + 6 * cd) * w;
            if (!stageOpen && (y >= emF[s][xi] || y < emC[s][xi])) c += 150 * w;
            if (stageNum != 3 && bossBox[0] <= bossBox[2] && x + 14 > bossBox[0] && x - 10 < bossBox[2] &&
                y + 4 > bossBox[1] && y - 4 < bossBox[3])
                c += 60 * w;
            if (boss.state == B_FIGHT && x > 140) c += ((x - 140) >> 3) * w;
            cost[d] += c & 0xFFFF;          // Uint16Array: wraps like u16
        }
    }
    for (let d = 0; d < 9; d++) cost[d] += emFar(d, sp);
}

const emDts = [1, 2, 4, 8];
const emWx = Array.from({ length: 7 }, () => new Int16Array(5));
const emWy = Array.from({ length: 7 }, () => new Int16Array(5));
const emCosts = new Uint16Array(9);
const emFx = new Int16Array(6), emFy = new Int16Array(6);
let emSkip = false;

function emergency()
{
    const px = PX(pl.x), py = PX(pl.y);
    en_ = 0;
    for (let i = 0; i < MAX_EBULLETS; i++)
    {
        const b = eb[i];
        if (!b.on) continue;
        const dx = PX(b.x) - px, dy = PX(b.y) - py;
        if (dx > -24 && dx < 56 && dy > -40 && dy < 40) emAdd(b.x, b.y, b.vx, b.vy, 8, 6);
    }
    for (let i = 0; i < MAX_BEAMS; i++)
    {
        const b = beams[i];
        if (b.on && (abs(PX(b.y) - py) & 0xFFFF) < 24 && PX(b.x) < px + 120)
            emAdd(s16(b.x + FP(16)), b.y, b.vx, 0, 22, 6);
    }
    for (let i = 0; i < MAX_PBEAMS && pbeamCount; i++)
        if (beamNear(pbeams[i], px, py))
            emAdd(FP(bnX), FP(bnY), -FP(scrollStep), -FP(scrollStepY), bnW, bnH);
    for (let i = 0; i < MAX_ENEMIES; i++)
    {
        const e = enemies[i];
        if (!e.type || !e.hw) continue;
        const dx = PX(e.x) - px, dy = PX(e.y) - py;
        if (dx > -48 && dx < 64 && dy > -48 && dy < 48 && !shotDown(e, px, py))
        {
            if (e.type == EN_FAN && e.a < 2) emAddFan(e, pl.y);
            else if (curved(e)) emAddEnemy(e, e.hw + 4, e.hh + 2);
            else if (e.flags & EF_GROUND) emAdd(e.x, e.y, s16(e.vx - FP(scrollStep)), s16(e.vy - FP(scrollStepY)), e.hw + 4, e.hh + 2);
            else emAdd(e.x, e.y, e.vx, e.vy, e.hw + 4, e.hh + 2);
        }
    }
    // clam geysers
    if (clamsAwake)
        for (let i = 0; i < MAX_ENEMIES; i++)
        {
            const g = enemy_geyser(enemies[i]);
            if (!g || (abs(g.x - px) & 0xFFFF) > 64) continue;
            const cy = py < g.y0 ? g.y0 : py > g.y1 ? g.y1 : py;      // the part of it nearest the ship
            emAdd(FP(g.x), FP(cy), -FP(scrollStep), 0, 12, 10);
        }
    // worm bodies: each segment goes where the head has been
    if (stageNum == 2)
    {
        const n = enemy_wormAhead(px + 12, py, 56, emDts, 4, emWx, emWy, 7);
        for (let i = 0; i < n; i++) emAddPath(emWx[i], emWy[i], 11, 9);
    }
    // the Zenith's star flares: each fireball where the arc takes it
    if (stageNum == 5)
    {
        const n = enemy_flareZone(px + 8, py, 36, emFx, emFy, 6);
        for (let i = 0; i < n; i++) emAdd(FP(emFx[i]), FP(emFy[i]), -FP(scrollStep), 0, 12, 12);
    }
    if (stageNum == 3 && boss.state == B_FIGHT)
    {
        if ((abs(boss.x - px) & 0xFFFF) < 72 && (abs(boss.y - py) & 0xFFFF) < 56)
            emAddStill(boss.x, boss.y, 22, 15);
        for (let i = 0; i < 10; i++)
            if ((abs(boss.partX[i] - px) & 0xFFFF) < 64 && (abs(boss.partY[i] - py) & 0xFFFF) < 48)
                emAddStill(boss.partX[i], boss.partY[i], 14, 13);
    }
    // orbiting boss parts: the Cryo Sentinel's shards, The Zenith's halo
    if ((stageNum == 1 || stageNum == 5) && boss.state == B_FIGHT)
        for (let i = 0; i < BOSS_PARTS; i++)
            if (boss.partHp[i] > 0 && (abs(boss.partX[i] - px) & 0xFFFF) < 64 && (abs(boss.partY[i] - py) & 0xFFFF) < 48)
                emAddStill(boss.partX[i], boss.partY[i], 10, 9);
    const sp = speedTab[pl.speedLv];
    // terrain for the current course first: usually it is all that is needed
    if (!stageOpen) emTerrain(sp, dirX[move]);
    const cur = emCost(move, sp, 0xFFFF);
    if (!cur) return 0xFF;
    if (!stageOpen)
        for (let xi = -1; xi <= 1; xi++)
            if (xi != dirX[move]) emTerrain(sp, xi);
    const cost = emCosts;
    emCostAll(sp, cost);
    let bst = move, bc = cost[move];
    for (let d = 0; d < 9 && bc; d++)
        if (cost[d] < bc) { bc = cost[d]; bst = d; }
    // no way out in 8 frames (a slow ship in a wide beam): every way costs
    // the same, and the old course, kept, can be into the screen's left
    // edge -- going nowhere. Away, up or down, from what it is in the
    // middle of (up in a climb): it gets out in time.
    if (bc && bc >= cur && dirX[bst] <= 0 && dirY[bst] == 0 && px <= stage_leftLimit() + 24)
    {
        let side = 0;
        for (let j = 0; j < en_; j++)
            side += ey_[3][j] < py ? 1 : -1;
        const v = side >= 0 && scrollStepY >= 0 ? 4 : 3;   // down : up
        if (cost[v] <= bc) bst = v;
        else if (cost[7 - v] <= bc) bst = 7 - v;  // (the other way)
    }
    return bst;
}

// The pad as this player would hold it this frame.
function autoplay_pad()
{
    const k = skills[autoPlay - 1];
    let pad = BUTTON_A;                 // fire held
    if (timer < 255) timer++;
    if (pl.alive)
    {
        // Every frame while it is dodging, every other frame when all is clear
        // (it looks 8 frames ahead).
        if (emSkip) emSkip = false;
        else
        {
            const em = emergency();
            const alert = em != 0xFF;
            emSkip = !alert;
            if (alert)
            {
                // dodge now: no lag, and the plan restarts from the new course
                move = em;
                phase = 0;
                timer = 0;
                const out = pad | dirPad[em];
                queue[qpos] = out;
                qpos = (qpos + 1) & 7;
                return out;
            }
        }
        pad |= dirPad[move];
        const want = wanted();
        if (pl.gauge >= 0 && (pl.gauge == want || (want >= 0 && pl.gauge > want)))
        {
            powerT = (powerT + 1) & 255;
            if (powerT > (pl.gauge == want ? k.powerWait : k.powerWait * 3))
            {
                pad |= BUTTON_B;
                powerT = 0;
            }
        }
        else powerT = 0;
    }
    // the hands follow a little late
    queue[qpos] = pad;
    const out = queue[(qpos - k.lag) & 7];
    qpos = (qpos + 1) & 7;
    return out;
}

Object.assign(window, { autoplay_start, autoplay_pad, autoplay_think });
})();
