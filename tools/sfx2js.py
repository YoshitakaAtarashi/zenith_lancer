#!/usr/bin/env python3
"""music/sfx/*.wav (shooting_genesis) -> music/sfx.js: 16-bit mono PCM at 22050 Hz, base64."""
import base64, json, sys, wave
import numpy as np
NAMES = ['shot', 'laser', 'missile', 'hit', 'explode', 'bigexplode', 'capsule', 'powerup',
         'die', 'extend', 'shieldhit', 'alarm', 'lasergate', 'lasercannon']
RATE = 22050
# the recordings are at the chip's own level; the browser's songs are rendered louder
GAIN = 3.0
src, out = sys.argv[1], sys.argv[2]
data = []
for n in NAMES:
    with wave.open('%s/%s.wav' % (src, n)) as w:
        assert w.getnchannels() == 1 and w.getsampwidth() == 2
        x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64)
        fs = w.getframerate()
    # resample: a short low-pass (the console's sounds have little above 10 kHz), then linear
    if fs != RATE:
        k = np.array([1, 4, 6, 4, 1], dtype=np.float64) / 16
        x = np.convolve(x, k, mode='same')
        t = np.arange(int(len(x) * RATE / fs)) * (fs / RATE)
        x = np.interp(t, np.arange(len(x)), x)
    x = x * GAIN
    pcm = np.clip(np.round(x), -32768, 32767).astype('<i2').tobytes()
    data.append(base64.b64encode(pcm).decode())
with open(out, 'w') as f:
    f.write('// The sound effects (the console\'s FM and PSG sounds, recorded), 16-bit PCM at %d Hz.\n' % RATE)
    f.write('window.SFX_PCM = { rate: %d, data: %s };\n' % (RATE, json.dumps(data)))
