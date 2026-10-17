// Music (looped tracks, fades) and synthesized sound effects.
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
        A.sfxGain.gain.value = 0.5;
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
function music_fmFree() { return cur.id !== MUS_NONE ? mus_fmfree[cur.id - 1] : 3; }

// ------------------------------------------------------------------ sound effects

const NOISE_WHITE = 1;

// chan 0..2 tone, 3 noise; freq: start Hz (tone) / noise rate selector;
// dfreq Hz per frame; vol: start attenuation 0 (loud) .. 15 (off);
// decay: frames per attenuation step; arp: if non-zero, arpeggio kind
const defs = [];
defs[SFX_SHOT]       = { chan: 2, prio: 1, len:  6, freq: 1800, dfreq: -180, vol: 4, decay: 2, noiseType: 0, arp: 0 };
defs[SFX_LASER]      = { chan: 2, prio: 1, len:  8, freq: 2600, dfreq: -120, vol: 5, decay: 2, noiseType: 0, arp: 0 };
defs[SFX_MISSILE]    = { chan: 1, prio: 1, len: 10, freq:  300, dfreq:  -12, vol: 6, decay: 3, noiseType: 0, arp: 0 };
defs[SFX_HIT]        = { chan: 1, prio: 2, len:  4, freq:  900, dfreq: -100, vol: 4, decay: 1, noiseType: 0, arp: 0 };
defs[SFX_EXPLODE]    = { chan: 3, prio: 3, len: 22, freq:    1, dfreq:    0, vol: 1, decay: 2, noiseType: NOISE_WHITE, arp: 0 };
defs[SFX_BIGEXPLODE] = { chan: 3, prio: 5, len: 60, freq:    2, dfreq:    0, vol: 0, decay: 4, noiseType: NOISE_WHITE, arp: 0 };
defs[SFX_CAPSULE]    = { chan: 1, prio: 4, len: 14, freq:  880, dfreq:   40, vol: 2, decay: 3, noiseType: 0, arp: 1 };
defs[SFX_POWERUP]    = { chan: 1, prio: 5, len: 24, freq:  440, dfreq:   35, vol: 1, decay: 3, noiseType: 0, arp: 1 };
defs[SFX_DIE]        = { chan: 3, prio: 6, len: 90, freq:    2, dfreq:    0, vol: 0, decay: 6, noiseType: NOISE_WHITE, arp: 0 };
defs[SFX_EXTEND]     = { chan: 1, prio: 6, len: 40, freq:  660, dfreq:   20, vol: 1, decay: 4, noiseType: 0, arp: 1 };
defs[SFX_SHIELDHIT]  = { chan: 1, prio: 3, len:  8, freq: 1400, dfreq: -140, vol: 3, decay: 2, noiseType: 0, arp: 0 };
defs[SFX_ALARM]      = { chan: 1, prio: 6, len: 50, freq:  700, dfreq:    0, vol: 2, decay: 0, noiseType: 0, arp: 2 };

const NOFM = 0xFF;
const voices = Array.from({ length: 4 }, () => ({ d: null, t: 0, vol: 0, decayCnt: 0, fm: NOFM }));

const nodes = [];
let noiseBufs = null;
let curNoise = -1;

function fmWave(ctx)
{
    const N = 1024;
    const beta = Math.PI;       // the feedback's modulation depth
    let y1 = 0, y2 = 0;
    const out = new Float32Array(N);
    for (let pass = 0; pass < 4; pass++)
        for (let n = 0; n < N; n++)
        {
            const y = Math.sin(2 * Math.PI * n / N + beta * (y1 + y2) / 2);
            y2 = y1;
            y1 = y;
            out[n] = y;
        }
    const H = 48;
    const re = new Float32Array(H), im = new Float32Array(H);
    for (let k = 1; k < H; k++)
    {
        let a = 0, b = 0;
        for (let n = 0; n < N; n++)
        {
            const ph = 2 * Math.PI * k * n / N;
            a += out[n] * Math.cos(ph);
            b += out[n] * Math.sin(ph);
        }
        re[k] = a * 2 / N;
        im[k] = b * 2 / N;
    }
    return ctx.createPeriodicWave(re, im, { disableNormalization: true });
}

function makeNoise(ctx, rate)
{
    const sr = ctx.sampleRate;
    const len = sr;             // a second, looped
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const shift = 13982.6 / (1 << rate);
    let lfsr = 0x8000, acc = 0;
    for (let i = 0; i < len; i++)
    {
        acc += shift / sr;
        while (acc >= 1)
        {
            acc -= 1;
            const bit = (lfsr ^ (lfsr >> 3)) & 1;
            lfsr = (lfsr >> 1) | (bit << 15);
        }
        d[i] = (lfsr & 1) ? 1 : -1;
    }
    return buf;
}

function sfxSetup()
{
    const ctx = A.ctx;
    const wave = fmWave(ctx);
    noiseBufs = [makeNoise(ctx, 0), makeNoise(ctx, 1), makeNoise(ctx, 2)];
    for (let c = 0; c < 4; c++)
    {
        const n = {};
        if (c < 3)
        {
            n.sq = ctx.createOscillator();
            n.sq.type = 'square';
            n.sqGain = ctx.createGain();
            n.sqGain.gain.value = 0;
            n.sq.connect(n.sqGain).connect(A.sfxGain);
            n.sq.start();
            n.fm = ctx.createOscillator();
            n.fm.setPeriodicWave(wave);
            n.fmGain = ctx.createGain();
            n.fmGain.gain.value = 0;
            n.fm.connect(n.fmGain).connect(A.sfxGain);
            n.fm.start();
        }
        else
        {
            n.gain = ctx.createGain();
            n.gain.gain.value = 0;
            n.gain.connect(A.sfxGain);
            n.src = null;
        }
        nodes[c] = n;
    }
}

const SQ_AMP = 0.16, FM_AMP = 0.2, NOISE_AMP = 0.2;

function setParam(p, v)
{
    const t = A.ctx.currentTime;
    p.cancelScheduledValues(t);
    p.setTargetAtTime(v, t, 0.003);
}

function toneSilence(c)
{
    if (!A.ctx) return;
    const n = nodes[c];
    if (c < 3) setParam(n.sqGain.gain, 0);
    else setParam(n.gain.gain, 0);
}

function fmStop(o)
{
    if (!A.ctx) return;
    setParam(nodes[o + 1].fmGain.gain, 0);
}

function fmTone(o, f, vol)
{
    if (!A.ctx) return;
    const n = nodes[o + 1];
    setParam(n.fm.frequency, f);
    const tl = 10 + Math.trunc(vol * 8 / 3);
    setParam(n.fmGain.gain, FM_AMP * Math.pow(10, -0.75 * (tl - 10) / 20));
}

function squareTone(c, f, vol)
{
    if (!A.ctx) return;
    const n = nodes[c];
    setParam(n.sq.frequency, f);
    setParam(n.sqGain.gain, vol >= 15 ? 0 : SQ_AMP * Math.pow(10, -2 * vol / 20));
}

function noiseTone(rate, vol)
{
    if (!A.ctx) return;
    const n = nodes[3];
    if (curNoise !== rate || !n.src)
    {
        if (n.src) try { n.src.stop(); } catch (e) { }
        n.src = A.ctx.createBufferSource();
        n.src.buffer = noiseBufs[rate & 3] || noiseBufs[2];
        n.src.loop = true;
        n.src.connect(n.gain);
        n.src.start();
        curNoise = rate;
    }
    setParam(n.gain.gain, vol >= 15 ? 0 : NOISE_AMP * Math.pow(10, -2 * vol / 20));
}

function sound_init()
{
    for (let c = 0; c < 4; c++) voices[c].d = null;
}

function sound_play(id)
{
    if (demoPlay) return;           // the title's demo plays to its song alone
    const d = defs[id];
    const v = voices[d.chan];
    if (v.d && v.d.prio > d.prio && v.t < v.d.len) return;
    v.d = d;
    v.t = 0;
    v.vol = d.vol;
    v.decayCnt = 0;
    v.fm = NOFM;
    const bit = d.chan === 1 ? 1 : d.chan === 2 ? 2 : 0;
    if ((music_fmFree() | 2) & bit) v.fm = d.chan - 1;
}

function sound_update()
{
    const free = music_fmFree() | 2;
    for (let c = 0; c < 4; c++)
    {
        const v = voices[c];
        const d = v.d;
        if (!d) continue;
        if (v.fm !== NOFM && !(free & (1 << v.fm)))
        {
            fmStop(v.fm);
            v.d = null;                 // a new song has the channel now
            continue;
        }
        if (v.t >= d.len)
        {
            if (v.fm !== NOFM) fmStop(v.fm);
            else toneSilence(c);
            v.d = null;
            continue;
        }
        if (d.decay && ++v.decayCnt >= d.decay)
        {
            v.decayCnt = 0;
            if (v.vol < 15) v.vol++;
        }
        const vol = v.vol;
        if (c === 3)
        {
            noiseTone(d.freq, vol);
            v.t++;
            continue;
        }
        let f = d.freq + d.dfreq * v.t;
        if (d.arp === 1)
        {
            // little rising arpeggio: root, major third, fifth, octave
            const b = d.freq;
            switch ((v.t >> 2) & 3)
            {
            case 0: f = b; break;
            case 1: f = b + (b >> 2); break;
            case 2: f = b + (b >> 1); break;
            default: f = b << 1; break;
            }
            f += d.dfreq * (v.t >> 2);
        }
        else if (d.arp === 2)
        {
            f = ((v.t >> 3) & 1) ? d.freq : d.freq + (d.freq >> 2) + (d.freq >> 4);
        }
        if (f < 60) f = 60;
        if (v.fm !== NOFM)
        {
            fmTone(v.fm, f, vol);
            v.t++;
            continue;
        }
        let period = divu(111861, f);
        if (period > 1023) period = 1023;
        squareTone(c, 111861 / period, vol);
        v.t++;
    }
}

Object.assign(window, {
    audio_unlock, audio_setMuted, audio_isMuted,
    music_init, music_lock, music_play, music_stop, music_fadeOut, music_update, music_frameDone,
    music_playing, music_serial, music_fmFree,
    sound_init, sound_play, sound_update,
});
})();
