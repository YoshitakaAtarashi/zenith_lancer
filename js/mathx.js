// Table trigonometry.
'use strict';
(function () {

// angle 0..255 (0 = right, 64 = down); returns sin/cos * 256
function isin(a)
{
    return s16(sin_tab[a & 255]);
}

function icos(a)
{
    return s16(sin_tab[(a + 64) & 255]);
}

// Angle of (dx, dy) in 1/256 turns, 0 = right, 64 = down.
function iatan2(dy, dx)
{
    const ax = dx < 0 ? -dx : dx;
    const ay = dy < 0 ? -dy : dy;
    let a;
    if (ax === 0 && ay === 0) return 0;
    if (ax >= ay)
        a = atan_tab[divu(ay << 6, ax)];
    else
        a = (64 - atan_tab[divu(ax << 6, ay)]) & 255;
    // a is the first-octant angle; fold into the right quadrant
    if (dx < 0) a = (128 - a) & 255;
    if (dy < 0) a = (256 - a) & 255;
    return a;
}

Object.assign(window, { isin, icos, iatan2 });
})();
