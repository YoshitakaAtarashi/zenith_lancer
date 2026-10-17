// Page start-up: assets, screen size, the start overlay, buttons, touch pad.
'use strict';
(function () {

const canvas = document.getElementById('screen');
const stageEl = document.getElementById('stage');
const overlay = document.getElementById('overlay');

function fit()
{
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    const aspect = 320 * 1.0 / 224;
    let cw = w, ch = Math.round(w / aspect);
    if (ch > h) { ch = h; cw = Math.round(h * aspect); }
    // whole multiples when there is room, so the pixels stay even
    const k = Math.floor(ch / 224);
    if (k >= 2 && k * 224 >= ch * 0.9) { ch = k * 224; cw = k * 320; }
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
}
window.addEventListener('resize', fit);

function decodeAssets()
{
    const bin = Uint8Array.from(atob(window.ASSET_BIN), (c) => c.charCodeAt(0));
    delete window.ASSET_BIN;
    assets_bind(bin);
}

// ------------------------------------------------------------------ tools

const muteBtn = document.getElementById('mute');
function setMute(m)
{
    audio_setMuted(m);
    muteBtn.textContent = m ? '♪ OFF' : '♪ ON';
    try { localStorage.setItem('zenith-lancer-mute', m ? '1' : '0'); } catch (e) { }
}
muteBtn.addEventListener('click', (e) => { audio_unlock(); setMute(!audio_isMuted()); e.currentTarget.blur(); });
document.getElementById('full').addEventListener('click', (e) => { toggleFull(); e.currentTarget.blur(); });
function toggleFull()
{
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { });
}
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') setMute(!audio_isMuted());
    if (e.code === 'KeyF') toggleFull();
});
document.addEventListener('fullscreenchange', fit);

// ------------------------------------------------------------------ touch pad

function setupTouch()
{
    const stick = document.getElementById('tp-stick');
    const knob = stick.querySelector('.knob');
    let stickId = null;
    const stickMove = (e) => {
        const r = stick.getBoundingClientRect();
        let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const R = r.width / 2;
        const len = Math.hypot(dx, dy);
        if (len > R) { dx *= R / len; dy *= R / len; }
        knob.style.transform = 'translate(' + dx * 0.6 + 'px,' + dy * 0.6 + 'px)';
        let b = 0;
        const dead = R * 0.28;
        if (dx < -dead) b |= BUTTON_LEFT;
        if (dx > dead) b |= BUTTON_RIGHT;
        if (dy < -dead) b |= BUTTON_UP;
        if (dy > dead) b |= BUTTON_DOWN;
        input.touch = (input.touch & ~0x0F) | b;
    };
    stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stickMove(e); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
    const stickEnd = (e) => {
        if (e.pointerId !== stickId) return;
        stickId = null;
        knob.style.transform = 'translate(0,0)';
        input.touch &= ~0x0F;
    };
    stick.addEventListener('pointerup', stickEnd);
    stick.addEventListener('pointercancel', stickEnd);

    const button = (id, bit) => {
        const el = document.getElementById(id);
        const on = (e) => { audio_unlock(); el.setPointerCapture(e.pointerId); el.classList.add('on'); input.touch |= bit; };
        const off = () => { el.classList.remove('on'); input.touch &= ~bit; };
        el.addEventListener('pointerdown', on);
        el.addEventListener('pointerup', off);
        el.addEventListener('pointercancel', off);
    };
    button('tp-a', BUTTON_A);
    button('tp-b', BUTTON_B);
    button('tp-start', BUTTON_START);
}

function isTouch()
{
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}

// ------------------------------------------------------------------ start

function boot()
{
    decodeAssets();
    screen_attach(canvas);
    fit();
    if (isTouch()) document.body.classList.add('touch');
    setupTouch();
    try { if (localStorage.getItem('zenith-lancer-mute') === '1') setMute(true); } catch (e) { }
    document.getElementById('loading').hidden = true;
    document.getElementById('go').hidden = false;

    // the sound may only start on a gesture: the overlay asks for one and
    // the game starts behind it at once
    let started = false;
    const start = () => {
        audio_unlock();
        overlay.classList.add('hidden');
        if (started) return;
        started = true;
    };
    overlay.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
    window.addEventListener('pointerdown', () => audio_unlock());
    // a gamepad button counts as a gesture only for the overlay; the sound
    // still needs a key, click or tap in some browsers
    const padPoll = () => {
        if (!started && pad_read(0)) start();
        if (!started) requestAnimationFrame(padPoll);
    };
    requestAnimationFrame(padPoll);

    clock_start();
    game_main().catch((e) => { console.error(e); });
}

boot();
})();
