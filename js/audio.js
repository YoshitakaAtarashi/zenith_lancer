// Music (looped tracks, fades) and the sound effects (samples).
'use strict';
(function () {

// ------------------------------------------------------------------ context

const A = {
    ctx: null, master: null, musicGain: null, sfxGain: null,
    codec: null, buffers: {}, loading: {},
    volume: 1, muted: false,
};

function audio_unlock()
{
    if (!A.ctx)
    {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        A.ctx = new AC();
        A.master = A.ctx.createGain();
        A.master.connect(A.ctx.destination);
        A.musicGain = A.ctx.createGain();
        A.musicGain.connect(A.master);
        A.sfxGain = A.ctx.createGain();
        A.sfxGain.gain.value = 1.0;
        A.sfxGain.connect(A.master);
        applyVolume();
        sfxSetup();
        // a song asked for before the sound could start
        if (cur.id !== MUS_NONE) startSong(cur.id, cur.serial);
        preloadAll();
    }
    if (A.ctx.state === 'suspended') A.ctx.resume();
}

function applyVolume()
{
    if (A.master) A.master.gain.value = A.muted ? 0 : A.volume;
}
function audio_setMuted(m) { A.muted = m; applyVolume(); }
function audio_isMuted() { return A.muted; }

function pickCodec()
{
    if (A.codec) return A.codec;
    const a = document.createElement('audio');
    A.codec = a.canPlayType && a.canPlayType('audio/ogg; codecs="opus"') ? 'opus' : 'mp3';
    return A.codec;
}

function key(id) { return (id < 10 ? '0' : '') + id; }

// the songs are scripts (base64), so the game also runs from file://
function loadSong(id)
{
    if (A.buffers[id]) return Promise.resolve(A.buffers[id]);
    if (A.loading[id]) return A.loading[id];
    const name = key(id) + '.' + pickCodec();
    A.loading[id] = new Promise((resolve, reject) => {
        const done = () => {
            const b64 = window.MUSIC_DATA && window.MUSIC_DATA[name];
            if (!b64) { reject(new Error('no ' + name)); return; }
            const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            delete window.MUSIC_DATA[name];
            A.ctx.decodeAudioData(bin.buffer).then((buf) => {
                A.buffers[id] = buf;
                resolve(buf);
            }, reject);
        };
        if (window.MUSIC_DATA && window.MUSIC_DATA[name]) { done(); return; }
        const s = document.createElement('script');
        s.src = 'music/' + name + '.js';
        s.onload = done;
        s.onerror = () => reject(new Error('load ' + name));
        document.head.appendChild(s);
    });
    A.loading[id].catch((e) => { console.warn(e); delete A.loading[id]; });
    return A.loading[id];
}

async function preloadAll()
{
    // the title's song first, then the rest in game order
    for (let id = 1; id < MUS_COUNT; id++)
    {
        try { await loadSong(id); } catch (e) { }
    }
}

// ------------------------------------------------------------------ music

const cur = { id: MUS_NONE, serial: 0, src: null, gain: null };
let serial = 0;
let locked = false;     // the demo: the title's song plays on (music_lock)

function stopSource(fadeSecs)
{
    if (!cur.src) return;
    const src = cur.src, g = cur.gain;
    cur.src = null;
    cur.gain = null;
    if (fadeSecs && A.ctx)
    {
        const t = A.ctx.currentTime;
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + fadeSecs);
        try { src.stop(t + fadeSecs + 0.05); } catch (e) { }
    }
    else
    {
        try { src.stop(); } catch (e) { }
    }
}

function startSong(id, ser)
{
    if (!A.ctx) return;
    loadSong(id).then((buf) => {
        // still the song wanted, and not started meanwhile?
        if (cur.id !== id || cur.serial !== ser || cur.src) return;
        const info = window.MUSIC_LOOPS[key(id)];
        const src = A.ctx.createBufferSource();
        src.buffer = buf;
        if (info && info.loop)
        {
            src.loop = true;
            src.loopStart = info.loopStart;
            src.loopEnd = Math.min(info.loopEnd, buf.duration);
        }
        const g = A.ctx.createGain();
        src.connect(g);
        g.connect(A.musicGain);
        src.start();
        cur.src = src;
        cur.gain = g;
    }, () => { });
}

function music_init() { }

function music_lock(on) { locked = on; }

function music_play(id)
{
    if (locked) return;
    if (id >= MUS_COUNT) id = MUS_NONE;
    if (id === cur.id && id !== MUS_NONE) return;
    stopSource(0);
    cur.id = id;
    serial = (serial + 1) & 0xFFFF;
    cur.serial = serial;
    if (id !== MUS_NONE) startSong(id, serial);
}

function music_stop() { music_play(MUS_NONE); }

// down to silence over about this many frames
function music_fadeOut(frames)
{
    if (locked) return;
    if (cur.id === MUS_NONE) return;
    stopSource(frames / 60);
    cur.id = MUS_NONE;     // (so the next song starts afresh, whatever it is)
}

function music_update() { }
function music_frameDone() { }
function music_playing() { return cur.id !== MUS_NONE; }
function music_serial() { return serial; }

// ------------------------------------------------------------------ sound effects

// Samples (music/sfx.js): the console's FM and PSG sounds, recorded. One
// channel, as on the console: a stronger effect cuts a weaker one, and a
// weaker one waits until the stronger has had its frames (sfx_frames).
const prios = [];
prios[SFX_SHOT] = 1; prios[SFX_LASER] = 1; prios[SFX_MISSILE] = 1; prios[SFX_HIT] = 2;
prios[SFX_EXPLODE] = 3; prios[SFX_BIGEXPLODE] = 5; prios[SFX_CAPSULE] = 4; prios[SFX_POWERUP] = 5;
prios[SFX_DIE] = 6; prios[SFX_EXTEND] = 6; prios[SFX_SHIELDHIT] = 3; prios[SFX_ALARM] = 6;
prios[SFX_LASERGATE] = 2; prios[SFX_LASERCANNON] = 4;

const sfxBufs = [];
let sfxSrc = null;
let curPrio = 0, left = 0;      // what the channel has, frames to go

function sfxSetup()
{
    const d = window.SFX_PCM;
    if (!d) return;
    for (let id = 0; id < SFX_COUNT && id < d.data.length; id++)
    {
        const bin = Uint8Array.from(atob(d.data[id]), (c) => c.charCodeAt(0));
        const pcm = new Int16Array(bin.buffer, 0, bin.length >> 1);
        const buf = A.ctx.createBuffer(1, pcm.length || 1, d.rate);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
        sfxBufs[id] = buf;
    }
}

function sound_init()
{
    left = 0;
}

function sound_play(id)
{
    if (demoPlay) return;           // the title's demo plays to its song alone
    const p = prios[id];
    if (left && p < curPrio) return;
    curPrio = p;
    left = sfx_frames[id];
    if (!A.ctx || !sfxBufs[id]) return;
    if (sfxSrc) { try { sfxSrc.stop(); } catch (e) { } }
    const src = A.ctx.createBufferSource();
    src.buffer = sfxBufs[id];
    src.connect(A.sfxGain);
    src.onended = () => { if (sfxSrc === src) sfxSrc = null; };
    src.start();
    sfxSrc = src;
}

function sound_update()
{
    if (left) left--;
}

Object.assign(window, {
    audio_unlock, audio_setMuted, audio_isMuted,
    music_init, music_lock, music_play, music_stop, music_fadeOut, music_update, music_frameDone,
    music_playing, music_serial,
    sound_init, sound_play, sound_update,
});
})();
