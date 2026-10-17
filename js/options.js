// Options and the high score, saved in the browser.
'use strict';
(function () {

const SR_SIZE = 12;
const TAG = [0x5A, 0x4E, 0x4C, 0x31];   // "ZNL1"

function sumOf(b)
{
    let s = 0;
    for (let i = 0; i < SR_SIZE - 1; i++) s = (s + b[i]) & 255;
    return s;
}

function options_load()
{
    const b = new Uint8Array(SR_SIZE);
    save_enableRO();
    for (let i = 0; i < SR_SIZE; i++) b[i] = save_readByte(i);
    save_disable();
    let ok = sumOf(b) === b[SR_SIZE - 1];
    for (let i = 0; i < 4; i++)
        if (b[i] !== TAG[i]) ok = false;
    if (!ok || b[10] >= NUM_STAGES)
    {
        optContinue = 0;
        optInvincible = 0;
        optStartStage = 0;
        hiScore = 50000;
        return;
    }
    hiScore = ((b[4] << 24) | (b[5] << 16) | (b[6] << 8) | b[7]) >>> 0;
    optContinue = b[8] ? 1 : 0;
    optInvincible = b[9] ? 1 : 0;
    optStartStage = b[10];
}

function options_save()
{
    const b = new Uint8Array(SR_SIZE);
    for (let i = 0; i < 4; i++) b[i] = TAG[i];
    b[4] = hiScore >>> 24;
    b[5] = hiScore >>> 16;
    b[6] = hiScore >>> 8;
    b[7] = hiScore;
    b[8] = optContinue;
    b[9] = optInvincible;
    b[10] = optStartStage;
    b[11] = sumOf(b);
    save_enable();
    for (let i = 0; i < SR_SIZE; i++) save_writeByte(i, b[i]);
    save_disable();
}

Object.assign(window, { options_load, options_save });
})();
