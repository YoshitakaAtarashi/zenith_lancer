# tools

ZENITH LANCER is a port of shooting_genesis (the same game for the Mega
Drive / Genesis, written in C with SGDK). These bring its data over; the
game's code in `js/` is ported from its `src/` by hand, file for file.

| script | from shooting_genesis | to |
|---|---|---|
| `gen2js.py GEN_DIR data/assets.js js/gen_assets.js` | `src/gen/` (assets.h, assets.c, data.s) | the graphics, stage data and tables |
| `scripts2js.py SRC_DIR js/scripts.js` | `src/script1.c` .. `script6.c` | the stage scripts |
| `sfx2js.py SFX_DIR music/sfx.js` | `music/sfx/*.wav` | the sound effects (needs numpy) |
| `playtest.py . OUT_DIR` | | plays every stage headless by AUTO PLAY (Playwright and Chrome), reports errors and takes screenshots |

Last synced with shooting_genesis at e4425aa (2026-11-05).
