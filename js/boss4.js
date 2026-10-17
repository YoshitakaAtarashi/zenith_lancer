'use strict';
(function () {

const SEGS = 10;
const GAP = 9;
const HIST = 128;

const hx = new Int16Array(HIST), hy = new Int16Array(HIST);
let head = 0;            // u8
let bbx0 = 0, bby0 = 0, bbx1 = 0, bby1 = 0;   // box around head and body, this frame
let cx = 0;              // centre of the figure eight (slides in on entry)
let facingRight = false;

// body segment positions, refreshed once per frame by swim()
const segX = new Int16Array(SEGS), segY = new Int16Array(SEGS);
// for the shot test: per band of 32 lines, the segments a shot centred in
// that band can touch (bit s = segment s)
const segBand = new Uint16Array(8);

function segPos(s)
{
    return [segX[s], segY[s]];
}

const segF = newFastSpr(), tailF = newFastSpr();

function start()
{
    spr_fastPrepare(segF, FR_LEVSEG, 0);
    spr_fastPrepare(tailF, FR_LEVTAIL, 0);
    cx = SCREEN_W + 120;
    boss.hp = 40 + (loopNum ? 16 : 0);
    boss.x = cx;
    boss.y = 100;
    head = 0;
    for (let i = 0; i < HIST; i++) { hx[i] = boss.x; hy[i] = boss.y; }
    for (let i = 0; i < SEGS; i++) { segX[i] = boss.x; segY[i] = boss.y; }
}

function swim()
{
    const a = (boss.t >> 1) & 255;
    const nx = s16(cx + s16(mul16s(isin(a), 96) >> 8));
    const ny = s16(100 + s16(mul16s(isin((a * 2) & 255), 62) >> 8));
    facingRight = nx > boss.x;
    boss.x = nx;
    boss.y = ny;
    head = (head + 1) & (HIST - 1);
    hx[head] = nx;
    hy[head] = ny;
    bbx0 = bbx1 = nx;
    bby0 = bby1 = ny;
    for (let s = 0; s < SEGS; s++)
    {
        const h = (head - (s + 1) * GAP) & (HIST - 1);
        const x = segX[s] = hx[h];
        const y = segY[s] = hy[h];
        boss.partX[s] = x;      // for the auto player (partHp stays 0)
        boss.partY[s] = y;
        if (x < bbx0) bbx0 = x;
        if (x > bbx1) bbx1 = x;
        if (y < bby0) bby0 = y;
        if (y > bby1) bby1 = y;
    }
    bbx0 -= 24; bby0 -= 24; bbx1 += 24; bby1 += 24;
    segBand.fill(0);
    for (let s = 0; s < SEGS; s++)
    {
        const y0 = segY[s] - 13, y1 = segY[s] + 13;
        let b0 = y0 < 0 ? 0 : y0 >> 5, b1 = y1 < 0 ? 0 : y1 >> 5;
        if (b1 > 7) b1 = 7;
        if (b0 > 7) b0 = 7;
        for (let b = b0; b <= b1; b++) segBand[b] |= 1 << s;
    }
    // the archway stands round the figure eight; it waits at the right edge
    // (a plane wraps past it) until the swim brings it in
    boss.bodyX = cx - 88 < SCREEN_W ? cx - 88 : SCREEN_W;
    boss.bodyY = 12;
}

function attack()
{
    const t = boss.t;
    if (modu(t, loopNum ? 36 : 50) === 0)
        ebullet_spread(boss.x + (facingRight ? 18 : -18), boss.y, FP(1) + 12, 3, 12);
    if (modu(t, 160) === 80)
    {
        for (let s = 1; s < SEGS; s += 2)
        {
            const [x, y] = segPos(s);
            ebullet_aim(x, y, FP(1) + 4);
        }
    }
}

function update()
{
    if (boss.state === B_ENTER)
    {
        cx -= 1;
        if (cx <= 196) { boss.state = B_FIGHT; boss.t = 0; }
    }
    else if (boss.state === B_FIGHT)
        attack();
    if (boss.state === B_LEAVE) cx += 2;
    swim();
    if (boss.state !== B_LEAVE)
    {
        boss_contactRect(boss.x - 18, boss.y - 12, boss.x + 18, boss.y + 12);
        const px = PX(pl.x), py = PX(pl.y);
        if (px >= bbx0 && px <= bbx1 && py >= bby0 && py <= bby1)
        for (let s = 0; s < SEGS; s++)
        {
            const [x, y] = segPos(s);
            if (abs(x - px) < 32) boss_contactRect(x - 11, y - 11, x + 11, y + 11);
        }
    }
}

function shotHit(s, x, y)
{
    if (x < bbx0 || x > bbx1 || y < bby0 || y > bby1) return FALSE;
    if (abs(x - boss.x) < 19 && abs(y - boss.y) < 15)
    {
        boss.hp = s16(boss.hp - boss_dmg(s));
        boss.flash = 4;
        shot_kill(s, TRUE);
        if (boss.hp <= 0)
        {
            for (let k = 0; k < SEGS; k += 2)
            {
                const [sx, sy] = segPos(k);
                fx_explode(sx, sy, TRUE);
            }
            boss_beginDeath(15000);
        }
        else boss_hitSound();
        return TRUE;
    }
    let m = segBand[y < 0 ? 0 : y >= 224 ? 7 : y >> 5];
    for (let k = 0; m; k++, m >>= 1)
        if ((m & 1) && abs(x - segX[k]) < 14 && abs(y - segY[k]) < 14)
        {
            shot_kill(s, TRUE);
            return TRUE;
        }
    return FALSE;
}

function draw()
{
    const fl = (boss.flash & 1) ? SF_PAL(1) : 0;
    spr_q(FR_LEVHEAD + ((boss.t >> 4) & 1), boss.x - 24, boss.y - 24,
             fl | (facingRight ? SF_HFLIP : 0));
    const sc = { n: 0 };
    sc_begin(sc);
    for (let k = 0; k < SEGS; k++)
        sc_put(sc, k === SEGS - 1 ? tailF : segF, segX[k] - 16, segY[k] - 16);
    sc_end(sc);
}

// the dying explosions use x,y as a top-left box: centre it on the head
window.boss4 = { start, update, draw, shotHit, width: 48, height: 48, reach: [-400, -300, 400, 300], bodyX: 0, bodyY: 0, bodySelf: TRUE };
})();
