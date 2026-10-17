# ZENITH LANCER

A horizontal shooting game for the browser: six stages, six bosses, a
capsule power-up gauge, options that follow the ship, an AUTO PLAY pilot,
an attract demo and a second loop.

Open `index.html` in a browser. Nothing to install or build, and no server
needed (it runs from `file://` too). Click or press a key once to start the
sound.

## Controls

| Input | Action |
|---|---|
| Arrows / WASD | Move |
| Z / C / Space (hold) | Shoot |
| X | Take the lit power-up |
| Enter | Start / pause (on the title: the menu) |
| C (while paused) | Back to the title |
| M / F | Sound on/off / fullscreen |

Gamepads (standard layout) and touch screens work too. The high score and
the options are kept in the browser.

## Power-ups

Red capsules (from flashing carriers and from wiping out a formation)
move the lit slot of the gauge; X takes it: SPEED, MISSL (missiles that
crawl along the ground), DOUBL (an upward shot), LASER (a piercing beam),
OPTN (a helper that copies your shots, up to four), FORCE (a barrier in
front). Every ninth capsule is blue and destroys everything on screen.

## Options

| Option | |
|---|---|
| CONTINUE: OFF / INFINITE | Continue where you fell, with 3 ships |
| INVINCIBLE: OFF / ON | Nothing can hit the ship (no high score) |
| START STAGE: 1-6 | The stage a new game starts on |

## Code

Plain JavaScript, no dependencies: `js/display.js` draws the tile planes
and sprites into a canvas, `js/system.js` has the engine services, the
game itself is the other files in `js/`. The music is in `music/`, the
graphics and stage data in `data/assets.js`.

(C) 2026 Y.ATARASHI
