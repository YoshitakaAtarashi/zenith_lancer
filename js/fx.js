// Explosions and sparks.
'use strict';
(function () {

const MAX_FX = 24;

// kind: 0 free, 1 small, 2 big, 3 spark; x, y: px, top-left of the frame
const fx = Array.from({ length: MAX_FX }, () => ({ kind: 0, t: 0, x: 0, y: 0 }));
const fxSpr = new Uint32Array(MAX_FX * 2);   // this frame's sprites (see spr_stage)
let fxSprN = 0;
let sparks = 0;   // live sparks (capped: a laser on a boss makes dozens)

const exsF = Array.from({ length: FR_EXSMALL_N }, newFastSpr);
const exbF = Array.from({ length: FR_EXBIG_N }, newFastSpr);
const sparkF = Array.from({ length: FR_SPARK_N }, newFastSpr);

function fx_init()
{
    sparks = 0;
    fxSprN = 0;
    for (let k = 0; k < FR_EXSMALL_N; k++) spr_fastPrepare(exsF[k], FR_EXSMALL + k, 0);
    for (let k = 0; k < FR_EXBIG_N; k++) spr_fastPrepare(exbF[k], FR_EXBIG + k, 0);
    for (let k = 0; k < FR_SPARK_N; k++) spr_fastPrepare(sparkF[k], FR_SPARK + k, 0);
    for (let i = 0; i < MAX_FX; i++) fx[i].kind = 0;
}

function alloc()
{
    for (let i = 0; i < MAX_FX; i++)
        if (!fx[i].kind) return fx[i];
    // steal the oldest-looking spark
    for (let i = 0; i < MAX_FX; i++)
        if (fx[i].kind === 3) return fx[i];
    return null;
}

function fx_explode(x, y, big)
{
    const f = alloc();
    if (!f) return;
    if (f.kind === 3) sparks--;   // took over a spark's slot
    f.kind = big ? 2 : 1;
    f.t = 0;
    f.x = x - (big ? 16 : 8);
    f.y = y - (big ? 16 : 8);
}

function fx_spark(x, y)
{
    if (sparks >= 8) return;
    const f = alloc();
    if (!f) return;
    if (f.kind !== 3) sparks++;
    f.kind = 3;
    f.t = 0;
    f.x = x - 4;
    f.y = y - 4;
}

function fx_update()
{
    let sp = 0;
    for (let i = 0; i < MAX_FX; i++)
    {
        const f = fx[i];
        if (!f.kind) continue;
        f.t = (f.t + 1) & 255;
        f.x = s16(f.x - scrollStep);   // debris stays with the world
        let fr;
        const k = f.t >> 2;
        if (f.kind === 1)
        {
            if (k >= FR_EXSMALL_N) { f.kind = 0; continue; }
            fr = exsF[k];
        }
        else if (f.kind === 2)
        {
            if (k >= FR_EXBIG_N) { f.kind = 0; continue; }
            fr = exbF[k];
        }
        else
        {
            if (k >= FR_SPARK_N) { f.kind = 0; sparks--; continue; }
            fr = sparkF[k];
        }
        const x = f.x + fr.dx, y = f.y + fr.dy;
        if (!sprOff(x, y))
            spr_stage(fxSpr, sp++, fr, f.x, f.y);
    }
    fxSprN = sp;
}

function fx_draw()
{
    spr_copyStaged(fxSpr, fxSprN, 0);
}

Object.assign(window, { fx_init, fx_explode, fx_spark, fx_update, fx_draw });
})();
