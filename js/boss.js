// The boss framework (the six bosses are boss1.js .. boss6.js).
'use strict';
(function () {

let hpMax = 0;             // total health at the start (weak point + parts)
let flashT = 0;            // frames left of the whole-boss hit flash
const flashPal = new Uint16Array(16);   // brightened copy of the boss palette

function totalHp()
{
    let t = boss.hp > 0 ? boss.hp : 0;
    for (let i = 0; i < BOSS_PARTS; i++)
        if (boss.partHp[i] > 0) t += boss.partHp[i];
    return s16(t);
}

function bossPal()
{
    return stage_gfx[stageNum].bossPal;
}

// every colour halfway to white
function makeFlashPal()
{
    const p = bossPal();
    for (let i = 0; i < 16; i++)
    {
        const c = p[i];
        let o = 0;
        for (let sh = 0; sh < 12; sh += 4)
        {
            let v = (c >> sh) & 0xE;
            v += ((14 - v) >> 1) & 0xE;
            o |= v << sh;
        }
        flashPal[i] = o;
    }
}
if (typeof bossBox !== 'undefined') bossBox[0] = 1;

// the defs, looked up when needed (the boss files may load after this one)
function defs() { return [boss1, boss2, boss3, boss4, boss5, boss6]; }
let cur = null;
let bodyShown = false;     // the stage's boss body is on plane A
let bodyMapIn = 0;

function clearBoss()
{
    boss.state = 0;
    boss.killed = false;
    boss.x = boss.y = 0;
    boss.vx = boss.vy = 0;
    boss.t = 0;
    boss.age = 0;
    boss.timeLimit = 0;
    boss.hp = 0;
    boss.flash = 0;
    boss.phase = 0;
    boss.partHp.fill(0);
    boss.partX.fill(0);
    boss.partY.fill(0);
    boss.partFlash.fill(0);
    boss.a = boss.b = boss.c = 0;
    boss.bodyX = boss.bodyY = 0;
    boss.hp0 = 0;
}

function boss_init()
{
    boss.state = B_OFF;
    boss.killed = FALSE;
    bossBox[0] = 1;
    bossBox[2] = 0;
}

const hpMul = [30, 22, 26, 8, 28, 15];   // tenths

function boss_start()
{
    cur = defs()[stageNum < 6 ? stageNum : 0];
    clearBoss();
    boss.state = B_ENTER;
    boss.timeLimit = 60 * 70;
    cur.start();
    // it stays at least until its song has played through, and a little
    const song = stageNum === 5 ? MUS_FINALBOSS : MUS_BOSS;
    const lim = (mus_frames[song - 1] + 60 * 5) & 0xFFFF;
    if (boss.timeLimit < lim) boss.timeLimit = lim;
    if (stageNum === 5) boss.timeLimit = 0xFFFF;    // the last boss never leaves
    stage_bossMode(TRUE);
    // hit points are in half-shots (see shot_damage)
    boss.hp = s16(boss.hp << 1);
    for (let i = 0; i < BOSS_PARTS; i++) boss.partHp[i] <<= 1;
    // ...and scaled to the ship's power: 70% against a bare ship, up to
    // 180% against a fully armed one
    boss.hp = s16(divu(mul16u(boss.hp, hpMul[stageNum < 6 ? stageNum : 0]), 10));
    const k = (70 + 11 * player_power()) & 0xFFFF;
    boss.hp = s16(divu(mul16u(boss.hp, k), 100));
    for (let i = 0; i < BOSS_PARTS; i++)
        if (boss.partHp[i] > 0) boss.partHp[i] = divu(mul16u(boss.partHp[i], k), 100) + 1;
    boss.hp0 = boss.hp;
    hpMax = totalHp();
    flashT = 0;
    makeFlashPal();
    // the boss's colours replace the enemy palette for the fight
    pal_setColors(32, bossPal(), 16, UP_LATER);
    // a big body on plane A: its tiles go where the terrain's were
    const g = stage_gfx[stageNum];
    bodyShown = g.bodyTiles != null;
    if (bodyShown)
    {
        stage_bossBody(TRUE);
        const c = g.bodyChunks;
        for (let i = 0; i < g.bodyNChunks; i++)
            gfx_loadTileData(g.bodyTiles, c[i * 3 + 1], c[i * 3 + 2], UP_NOW, c[i * 3] << 3);
        bodyMapIn = 3;
        stage_bossBodyAt(SCREEN_W, 0);     // out of sight until the boss places it
    }
    music_play(song);
}

function boss_active()
{
    return boss.state === B_ENTER || boss.state === B_FIGHT || boss.state === B_LEAVE;
}

function boss_done()
{
    return boss.state === B_DONE;
}

function boss_killed()
{
    return boss.killed;
}

function boss_beginDeath(bonus)
{
    boss.state = B_DYING;
    boss.killed = TRUE;
    boss.t = 0;
    game_addScore(bonus);
    ebullet_clear();
    sound_play(SFX_BIGEXPLODE);
    if (!flashT) pal_setColors(33, flashPal, 15, UP_LATER, 1);
    flashT = 8;
    stage_flash(4);
    stage_shake(20, 2);
}

function boss_inRect(x, y, x0, y0, x1, y1)
{
    return x >= x0 && x < x1 && y >= y0 && y < y1;
}

function boss_dmg(s)
{
    return shot_damage(s);
}

// Every damaging hit: a click, and the whole boss flashes pale for a few
// frames (its palette, so explosions on screen flash with it).
function boss_hitSound()
{
    sound_play(SFX_HIT);
    if (!flashT) pal_setColors(33, flashPal, 15, UP_LATER, 1);
    flashT = 3;
}

function boss_trackY(target, minY, maxY, maxV)
{
    if (target < minY) target = minY;
    if (target > maxY) target = maxY;
    if (target > boss.y + 2 && boss.vy < maxV) boss.vy++;
    else if (target < boss.y - 2 && boss.vy > -maxV) boss.vy--;
    else if ((boss.t & 3) === 0) boss.vy = boss.vy > 0 ? boss.vy - 1 : boss.vy < 0 ? boss.vy + 1 : 0;
    if ((boss.t & 1) === 0) boss.y = s16(boss.y + boss.vy);
}

function boss_contactRect(x0, y0, x1, y1)
{
    if (boss_inRect(PX(pl.x), PX(pl.y), x0, y0, x1, y1)) player_kill();
}

function updateBox()
{
    if (boss.state === B_FIGHT || boss.state === B_ENTER)
    {
        bossBox[0] = boss.x + cur.reach[0];
        bossBox[1] = boss.y + cur.reach[1];
        bossBox[2] = boss.x + cur.reach[2];
        bossBox[3] = boss.y + cur.reach[3];
    }
    else
    {
        bossBox[0] = 1;
        bossBox[2] = 0;
    }
}

function step()
{
    updateBox();
    if (boss.state === B_OFF || boss.state === B_DONE)
    {
        hud_bossBarOff();
        if (bodyShown)
        {
            bodyShown = FALSE;
            stage_bossBody(FALSE);
        }
        if (flashT)
        {
            flashT = 0;
            pal_setColors(33, bossPal(), 15, UP_LATER, 1);
        }
        return;
    }
    hud_bossBar(totalHp(), hpMax);
    if (flashT && --flashT === 0)
        pal_setColors(33, bossPal(), 15, UP_LATER, 1);
    // visible wear: sparks below half health, small blasts below a quarter
    if (boss.state === B_FIGHT)
    {
        const h = totalHp();
        const r = random();
        if (h * 4 < hpMax && (boss.t & 15) === 0)
            fx_explode(boss.x + modu(r, cur.width), boss.y + modu(r >> 7, cur.height), FALSE);
        else if (h * 2 < hpMax && (boss.t & 15) === 8)
            fx_spark(boss.x + modu(r, cur.width), boss.y + modu(r >> 7, cur.height));
    }
    boss.t = (boss.t + 1) & 0xFFFF;
    boss.age = (boss.age + 1) & 0xFFFF;
    if (boss.flash) boss.flash--;
    for (let i = 0; i < BOSS_PARTS; i++)
        if (boss.partFlash[i]) boss.partFlash[i]--;

    if (boss.state === B_DYING)
    {
        if ((boss.t & 7) === 0)
        {
            const r = random();
            fx_explode(boss.x + modu(r, cur.width), boss.y + modu(r >> 7, cur.height), (r & 0x100) !== 0);
            sound_play(SFX_BIGEXPLODE);
            stage_shake(6, 1);
        }
        if ((boss.t & 3) === 0) boss.y++;
        if (boss.t > 150)
        {
            fx_explode(boss.x + (cur.width >> 1), boss.y + (cur.height >> 1), TRUE);
            fx_explode(boss.x + (cur.width >> 2), boss.y + (cur.height >> 2), TRUE);
            fx_explode(boss.x + cur.width - (cur.width >> 2), boss.y + cur.height - (cur.height >> 2), TRUE);
            stage_flash(8);
            stage_shake(40, 3);
            boss.state = B_DONE;
        }
        return;
    }
    if (boss.state === B_FIGHT && boss.timeLimit !== 0xFFFF && boss.age > boss.timeLimit)
    {
        boss.state = B_LEAVE;
        boss.t = 0;
    }
    if (boss.state === B_LEAVE)
    {
        boss.x += 2;
        // a body on plane A wraps round the 512 px plane past the right edge
        if (boss.x > (bodyShown ? SCREEN_W - 2 : SCREEN_W + 16)) boss.state = B_DONE;
    }
    cur.update();
}

function boss_update()
{
    step();
    if (bodyMapIn && --bodyMapIn === 0 && bodyShown)
    {
        const g = stage_gfx[stageNum];
        gfx_setTileMapDataRect(BG_A, g.bodyMap, 0, 0, g.bodyW, g.bodyH, g.bodyW, UP_NOW);
    }
    if (bodyShown)
    {
        if (cur.bodySelf) stage_bossBodyAt(boss.bodyX, boss.bodyY);
        else stage_bossBodyAt(boss.x + cur.bodyX, boss.y + cur.bodyY);
    }
}

function boss_shotHit(s)
{
    // the caller has already checked the shot is inside bossBox
    const x = s16(PX(s.x) + (s.type === SH_LASER ? 28 : 4));
    const y = PX(s.y);
    return cur.shotHit(s, x, y);
}

function boss_draw()
{
    if (boss.state === B_OFF || boss.state === B_DONE) return;
    if (boss.state === B_DYING && (boss.t & 2)) return;
    cur.draw();
}

Object.assign(window, {
    boss_init, boss_start, boss_update, boss_draw, boss_active, boss_shotHit, boss_done, boss_killed,
    boss_beginDeath, boss_inRect, boss_dmg, boss_hitSound, boss_trackY, boss_contactRect,
});
})();
