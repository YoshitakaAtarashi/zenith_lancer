#!/usr/bin/env python3
"""Plays zenith_lancer headless: each stage from its start by AUTO PLAY (expert),
invincible or not, frames pumped as fast as they go. Logs errors, deaths,
progress, and saves screenshots at chosen frames.

usage: playtest.py GAME_DIR OUT_DIR [--stages 0,1,..] [--frames N] [--shots f1,f2] [--mortal]
"""
import argparse, json, os, sys
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument('game')
ap.add_argument('out')
ap.add_argument('--stages', default='0,1,2,3,4,5')
ap.add_argument('--frames', type=int, default=20000)
ap.add_argument('--shots', default='')
ap.add_argument('--mortal', action='store_true')
ap.add_argument('--boss', action='store_true', help='start at the boss')
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
shots = [int(x) for x in a.shots.split(',') if x]

PUMP = r"""
async (n) => {
    clock.paused = true;
    for (let i = 0; i < n; i++) {
        let tries = 0;
        while (!clock.waiting && tries < 2000) { await null; tries++; }
        if (!clock.waiting) return 'stuck';
        const w = clock.waiting; clock.waiting = null; w();
    }
    for (let j = 0; j < 200 && !clock.waiting; j++) await null;
    return 'ok';
}
"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 800, 'height': 700})
    errors = []
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    pg.goto('file://' + os.path.abspath(a.game) + '/index.html')
    pg.wait_for_selector('#go:not([hidden])', timeout=30000)
    pg.click('#overlay')
    pg.evaluate(PUMP, 30)
    results = []
    for st in [int(x) for x in a.stages.split(',')]:
        # hidden stage select (hold A, press right) then A+B+C+Start (or B+C+Start: the boss)
        pg.evaluate("() => { input.keys = BUTTON_A; }")
        pg.evaluate(PUMP, 3)
        # back to stage 1 first: selStage cycles
        for _ in range(12):
            if pg.evaluate("() => document.title") is None: break
        pg.evaluate("""(st) => {
            // drive the stage select to st
            window.__want = st;
        }""", st)
        # press right until the select shows the stage (it starts at 0 each fresh page)
        cur = pg.evaluate("() => window.__sel || 0")
        k = (st - cur) % 6
        for _ in range(k):
            pg.evaluate("() => { input.keys = BUTTON_A | BUTTON_RIGHT; }")
            pg.evaluate(PUMP, 2)
            pg.evaluate("() => { input.keys = BUTTON_A; }")
            pg.evaluate(PUMP, 2)
        pg.evaluate("(s) => { window.__sel = s; }", st)
        combo = 'BUTTON_B | BUTTON_C' if a.boss else 'BUTTON_A | BUTTON_B | BUTTON_C'
        pg.evaluate("() => { input.keys = %s; }" % combo)
        pg.evaluate(PUMP, 2)
        pg.evaluate("() => { input.keys = %s | BUTTON_START; }" % combo)
        pg.evaluate(PUMP, 2)
        pg.evaluate("() => { input.keys = 0; }")
        pg.evaluate(PUMP, 40)
        pg.evaluate("(m) => { autoplay_start(3); if (m) cheatInvincible = false; window.__deaths = 0; "
                    "if (!window.__pk) { window.__pk = player_kill; window.player_kill = function () { if (pl.alive && !pl.invuln && !cheatInvincible) window.__deaths++; return window.__pk(); }; } }", a.mortal)
        info = {'stage': st, 'frames': 0}
        f = 0
        step = 200
        while f < a.frames:
            r = pg.evaluate(PUMP, step)
            f += step
            for s in shots:
                if f - step < s <= f:
                    pg.evaluate("() => screen_render()")
                    pg.locator('#screen').screenshot(path='%s/s%d_f%05d.png' % (a.out, st + 1, s))
            state = pg.evaluate("() => ({ stage: curStage, dist: stageDist, camY: cameraY, cleared: boss_done ? boss_done() : false, lives, deaths: window.__deaths, enemies: enemy_count(), beams: pbeamCount, auto: autoPlay })")
            if r != 'ok':
                info['stuck'] = f
                break
            if state['stage'] != st or state['auto'] == 0:
                info['left_at'] = f
                break
        info.update(state)
        info['frames'] = f
        pg.evaluate("() => screen_render()")
        pg.locator('#screen').screenshot(path='%s/s%d_end.png' % (a.out, st + 1))
        results.append(info)
        print(json.dumps(info), flush=True)
        # back to the title for the next: quit the AUTO PLAY with Start
        pg.evaluate("() => { input.keys = BUTTON_START; }")
        pg.evaluate(PUMP, 3)
        pg.evaluate("() => { input.keys = 0; }")
        pg.evaluate(PUMP, 60)
        pg.evaluate("() => { autoPlay = 0; }")
    print('ERRORS', len(errors))
    for e in errors[:40]:
        print(e)
    b.close()
