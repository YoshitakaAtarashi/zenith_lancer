// Runs the current stage's script (scripts.js).
'use strict';

const EV_WARNING = 0xF0, EV_BOSS = 0xF1, EV_SPEED = 0xF2, EV_WALL = 0xF3, EV_WAVE = 0xF4, EV_HEAT = 0xF5;

// Ev: { col, type, count, y, flags, interval, param }
//   y: air units: spawn height; volcano: rock interval; EV_SPEED: speed
//   param: per type (fans: x where they turn)
// (the macros of level.h; js/scripts.js calls them as it loads, so this
// file comes before it)
function EV(col, type, count, y, flags, interval, param)
{
    return { col, type, count, y, flags, interval, param };
}
const AIR = (c, t, n, y, f, iv, p) => EV(c, t, n, y, f, iv, p);
const GND = (c, t, f) => EV(c, t, 1, 0, f | EF_GROUND, 0, 0);
const GNDP = (c, t, f, p) => EV(c, t, 1, 0, f | EF_GROUND, 0, p);
const EVT = (c, t, v) => EV(c, t, 1, v, 0, 0, 0);
const FIX = (c, t, y) => EV(c, t, 1, y, EF_FIXEDY | EF_GROUND, 0, 0);
// the Glacier's ice storm: n cubes from the top edge, one every iv frames
const ICESTORM = (c, n, iv) => EV(c, EN_CUBE, n, 160, EF_TOP, iv, 0);
const END_SCRIPT = EV(0xFFFF, 0, 0, 0, 0, 0, 0);

(function () {

const MAX_PENDING = 6;
// yoff: an echo of a lone flyer comes in at another height
const pending = Array.from({ length: MAX_PENDING }, () => ({ ev: null, left: 0, timer: 0, group: 0, yoff: 0 }));

let script = null;
let cursor = 0;          // index into script

// Boss-rush start: a little before the stage's WARNING.
function level_bossCol(stage)
{
    for (const e of scripts[stage])
    {
        if (e.col === 0xFFFF) break;
        if (e.type === EV_WARNING) return e.col > 40 ? e.col - 40 : 0;
    }
    return 0;
}

function level_reset(startCol)
{
    script = scripts[stageNum];
    cursor = 0;
    // skipping ahead (boss rush): apply speed changes, spawn nothing
    while (script[cursor].col < startCol && script[cursor].type !== EV_WARNING && script[cursor].type !== EV_BOSS)
    {
        if (script[cursor].type === EV_SPEED) scrollSpeed = scrollTarget = script[cursor].y;
        if (script[cursor].type === EV_HEAT) stage_heat(script[cursor].y);
        cursor++;
    }
    for (let i = 0; i < MAX_PENDING; i++) pending[i].left = 0;
}

function spawnOne(ev, group, yoff)
{
    if (ev.flags & EF_TOP)
    {
        // a climb: in at the top edge, with the world (x is the script's y)
        const e = enemy_spawn(ev.type, ev.y, -16, ev.flags | EF_GROUND);
        if (e)
        {
            e.a = ev.param;
            e.group = group;
            if (ev.type === EN_MINI) e.vy = FP(2);
        }
        return;
    }
    if (ev.flags & EF_FIXEDY)
    {
        const e = enemy_spawn(ev.type, SCREEN_W + 16, ev.y, ev.flags);
        if (e) e.a = ev.param;
        return;
    }
    if (ev.flags & EF_GROUND)
    {
        const x = SCREEN_W + 16;
        const wx = cameraX + x;
        const ceil = (ev.flags & EF_CEIL) !== 0;
        const g = ceil ? stage_ceilAt(wx) : stage_floorAt(wx);
        if (!ceil && g >= NO_FLOOR) return;
        if (ceil && g <= NO_CEIL) return;
        const half = ev.type === EN_ICICLE ? 12 : ev.type === EN_SLED ? 6 : ev.type === EN_CANNON ? 12 :
                     ev.type === EN_CLAM ? 10 : 8;
        const e = enemy_spawn(ev.type, x, ceil ? g + half : g - half, ev.flags);
        if (e && (ev.type === EN_GATE || ev.type === EN_LCANNON || ev.type === EN_FLARE || ev.type === EN_LANCE || ev.type === EN_CLAM))
            e.a = ev.param;
        if (e && ev.type === EN_VOLCANO)
        {
            e.a = ev.y;
            e.cd = 1;
            e.y = FP(ceil ? g : g - 2);
        }
        return;
    }
    // (kept inside the passage where it comes in: a stage's walls may swing)
    let ay = ev.y + yoff;
    if (sg_swings())
    {
        const wx = cameraX + SCREEN_W + 16;
        const top = stage_ceilAt(wx) + 20, bot = stage_floorAt(wx) - 20;
        if (ay < top) ay = top;
        if (ay > bot) ay = bot;
    }
    // an echo never carries a capsule
    const e = enemy_spawn(ev.type, ev.type === EN_LANCER ? SCREEN_W - 20 : SCREEN_W + 16,
                          ay, yoff ? ev.flags & ~EF_CARRIER : ev.flags);
    if (!e) return;
    e.group = group;
    if (ev.type === EN_FAN) e.b = ev.param;
}

function level_update()
{
    const col = stageDist >> 3;
    while (script[cursor].col <= col)   // the end marker's column is never reached
    {
        const ev = script[cursor++];
        if (ev.type === EV_WARNING)
        {
            if (stageNum === NUM_STAGES - 1)
                hud_message('WARNING', 'THE ZENITH AWAKENS', 180);
            else
                hud_message('WARNING', 'A HUGE GUARDIAN APPROACHES', 150);
            sound_play(SFX_ALARM);
            music_fadeOut(150);
            continue;
        }
        if (ev.type === EV_BOSS)
        {
            boss_start();
            continue;
        }
        if (ev.type === EV_SPEED)
        {
            scrollTarget = ev.y;
            continue;
        }
        if (ev.type === EV_HEAT)
        {
            stage_heat(ev.y);
            continue;
        }
        if (ev.type === EV_WAVE)
        {
            stage_wave(ev.y);
            continue;
        }
        if (ev.type === EV_WALL)
        {
            // armour blocks stacked from roof to deck at the right edge
            const wx = cameraX + SCREEN_W + 16;
            const top = stage_ceilAt(wx);
            let bot = stage_floorAt(wx);
            if (bot > PLAY_H) bot = PLAY_H;
            for (let y = top + 16; y < bot; y += 32)
                enemy_spawn(EN_BLOCK, SCREEN_W + 16, y, EF_GROUND | EF_FIXEDY);
            continue;
        }
        // A strong ship meets more: formations grow, and lone flyers bring
        // a wingman at another height.
        const pw = player_power();
        const air = !(ev.flags & (EF_GROUND | EF_FIXEDY)) && ev.type !== EN_LANCER && ev.type !== EN_CUBE;
        let n = ev.count;
        if (air && n > 1 && pw >= 5) n += pw >= 8 ? 2 : 1;
        const group = n > 1 && ev.type !== EN_CUBE ? enemy_newGroup(n) : 0;
        spawnOne(ev, group, 0);
        let echo = 0;
        if (air && n === 1 && pw >= 6) echo = ev.y < 104 ? 48 : -48;
        if (n > 1 || echo)
        {
            for (let i = 0; i < MAX_PENDING; i++)
                if (!pending[i].left)
                {
                    pending[i].ev = ev;
                    pending[i].left = n > 1 ? n - 1 : 1;
                    pending[i].timer = n > 1 ? ev.interval : 24;
                    pending[i].group = group;
                    pending[i].yoff = echo;
                    break;
                }
        }
    }
    for (let i = 0; i < MAX_PENDING; i++)
    {
        const p = pending[i];
        if (!p.left) continue;
        p.timer = (p.timer - 1) & 255;
        if (p.timer === 0)
        {
            spawnOne(p.ev, p.group, p.yoff);
            p.left--;
            p.timer = p.ev.interval;
        }
    }
}

Object.assign(window, { level_bossCol, level_reset, level_update });
})();
