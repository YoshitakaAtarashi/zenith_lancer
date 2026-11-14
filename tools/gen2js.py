#!/usr/bin/env python3
"""Turn shooting_genesis's src/gen (assets.h, assets.c, data.s) into
zenith_lancer's data/assets.js and js/gen_assets.js.

usage: gen2js.py GEN_DIR OUT_ASSETS_JS OUT_GEN_ASSETS_JS
"""
import base64, json, re, struct, sys

TYPES = {'u8': ('B', 1), 's8': ('b', 1), 'u16': ('H', 2), 's16': ('h', 2),
         'u32': ('I', 4), 's32': ('i', 4)}

# arrays left out of the binary (the browser has its own music and drums)
def skipped(name):
    if name.startswith('pcm_') or name.startswith('xgm_'):
        return True
    if name.startswith('mus_') and name not in ('mus_fmfree', 'mus_frames'):
        return True
    return name in ('sfx_data',)


def parse_num(tok):
    tok = tok.strip()
    if not tok:
        return None
    neg = tok.startswith('-')
    if neg:
        tok = tok[1:].strip()
    tok = tok.rstrip('uUlL')
    v = int(tok, 16) if tok.lower().startswith('0x') else int(tok, 10)
    return -v if neg else v


def strip_comments(s):
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    s = re.sub(r'//[^\n]*', '', s)
    return s


def main():
    gen, out_bin, out_js = sys.argv[1:4]
    h = open(gen + '/assets.h').read()
    c = strip_comments(open(gen + '/assets.c').read())
    s = open(gen + '/data.s').read()

    # data.s: label -> values
    sdata = {}
    cur = None
    for line in s.splitlines():
        line = line.split('/*')[0].strip()
        m = re.match(r'^([A-Za-z_][A-Za-z0-9_]*):$', line)
        if m:
            cur = m.group(1)
            sdata[cur] = []
            continue
        m = re.match(r'^dc\.([lwb])\s+(.*)$', line)
        if m and cur:
            sdata[cur].extend(parse_num(t) for t in m.group(2).split(','))

    # assets.c: plain arrays
    cdata = {}
    for m in re.finditer(r'const\s+(u8|s8|u16|s16|u32|s32)\s+([a-z0-9_]+)\s*\[\s*\d*\s*\]\s*=\s*\{(.*?)\};', c, re.S):
        vals = [parse_num(t) for t in m.group(3).split(',')]
        cdata[m.group(2)] = [v for v in vals if v is not None]

    # header order: externs and defines
    consts = []
    entries = []
    for line in h.splitlines():
        m = re.match(r'^#define\s+([A-Z0-9_]+)\s+(-?\d+)\s*$', line)
        if m:
            consts.append((m.group(1), int(m.group(2))))
            continue
        m = re.match(r'^extern const (u8|s8|u16|s16|u32|s32) ([a-z0-9_]+)\[(\d*)\];', line)
        if m:
            t, name, n = m.group(1), m.group(2), m.group(3)
            if skipped(name) or any(e[1] == name for e in entries):
                continue
            entries.append((t, name, int(n)))

    blob = bytearray()
    index = {}
    for t, name, n in entries:
        fmt, size = TYPES[t]
        vals = sdata.get(name, cdata.get(name))
        if vals is None:
            raise SystemExit('no data for ' + name)
        if len(vals) != n:
            raise SystemExit('%s: %d values, header says %d' % (name, len(vals), n))
        while len(blob) % 4:
            blob.append(0)
        index[name] = [t, len(blob), n]
        mask = (1 << (8 * size)) - 1
        if fmt.isupper():
            vals = [v & mask for v in vals]
        else:
            vals = [((v + (1 << (8 * size - 1))) & mask) - (1 << (8 * size - 1)) for v in vals]
        blob += struct.pack('<%d%s' % (n, fmt), *vals)
    with open(out_bin, 'w') as f:
        f.write('window.ASSET_INDEX = ' + json.dumps(index, separators=(',', ':')) + ';\n')
        f.write('window.ASSET_BIN = "' + base64.b64encode(bytes(blob)).decode() + '";\n')

    # ------------------------------------------------ gen_assets.js
    out = ['// Asset constants and tables (data/assets.js holds the data).']
    for k, v in consts:
        if k == 'GEN_ASSETS_H' or k.startswith('PCM_'):
            continue
        out.append('const %s = %d;' % (k, v))
    out.append('')

    m = re.search(r'const MSPiece ms_pieces\[\d+\] = \{(.*?)\n\};', c, re.S)
    out.append('const ms_pieces = [')
    for p in re.findall(r'\{([^{}]*)\}', m.group(1)):
        dx, dy, size, w, tile = [parse_num(x) for x in p.split(',')]
        out.append('    { dx: %d, dy: %d, size: %d, w: %d, tile: %d },' % (dx, dy, size, w, tile))
    out.append('];')
    m = re.search(r'const MSFrame ms_frames\[\d+\] = \{(.*?)\n\};', c, re.S)
    out.append('const ms_frames = [')
    for p in re.findall(r'\{([^{}]*)\}', m.group(1)):
        piece, count, pal, w, hh, asset, pad = [parse_num(x) for x in p.split(',')]
        out.append('    { piece: %d, count: %d, pal: %d, w: %d, h: %d, asset: %d },' % (piece, count, pal, w, hh, asset))
    out.append('];')
    m = re.search(r'song_names\[\d+\] = \{(.*?)\};', c, re.S)
    out.append('const song_names = [%s];' % ', '.join(re.findall(r'"[^"]*"', m.group(1))))
    out.append('')
    out.append('let asset_tiles, stage_gfx, title_gfx, sfx_data;')
    out.append('')
    out.append('''function assets_bind(bin)
{
    const view = (t, off, n) => {
        switch (t) {
        case 'u8': return new Uint8Array(bin.buffer, off, n);
        case 's8': return new Int8Array(bin.buffer, off, n);
        case 'u16': return new Uint16Array(bin.buffer, off, n);
        case 's16': return new Int16Array(bin.buffer, off, n);
        case 'u32': return new Uint32Array(bin.buffer, off, n);
        default: return new Int32Array(bin.buffer, off, n);
        }
    };
    for (const name in ASSET_INDEX) {
        const [t, off, n] = ASSET_INDEX[name];
        window[name] = view(t, off, n);
    }''')
    m = re.search(r'asset_tiles\[\d+\] = \{(.*?)\};', c, re.S)
    out.append('    asset_tiles = [%s];' % ', '.join(x.strip() for x in m.group(1).split(',') if x.strip()))
    m = re.search(r'sfx_data\[\d+\] = \{(.*?)\};', c, re.S)
    if m:
        out.append('    sfx_data = [%s];' % ', '.join(x.strip() for x in m.group(1).split(',') if x.strip()))

    sg = re.findall(r'typedef struct\s*\{([^{}]*)\}\s*StageGfx;', strip_comments(h), re.S)[0]
    fields = []
    for decl in sg.split(';'):
        decl = decl.strip()
        if not decl:
            continue
        decl = re.sub(r'^(const\s+)?(u8|s8|u16|s16|u32|s32|char)\s*', '', decl)
        for f in decl.split(','):
            fields.append(f.strip().lstrip('*').strip())

    def gfx_obj(body):
        vals = []
        depth = 0
        tok = ''
        for ch in body:
            if ch == ',' and depth == 0:
                vals.append(tok.strip()); tok = ''
            else:
                if ch == '"':
                    depth ^= 1
                tok += ch
        if tok.strip():
            vals.append(tok.strip())
        if len(vals) != len(fields):
            raise SystemExit('StageGfx: %d values for %d fields' % (len(vals), len(fields)))
        parts = []
        for f, v in zip(fields, vals):
            v = 'null' if v == 'NULL' else v
            parts.append('%s: %s' % (f, v))
        return '{ ' + ', '.join(parts) + ' }'

    m = re.search(r'const StageGfx stage_gfx\[\d+\] = \{(.*?)\n\};', c, re.S)
    out.append('    stage_gfx = [')
    for body in re.findall(r'\{([^{}]*)\}', m.group(1)):
        out.append('        %s,' % gfx_obj(body))
    out.append('    ];')
    m = re.search(r'const StageGfx title_gfx = \{([^{}]*)\};', c, re.S)
    out.append('    title_gfx = %s;' % gfx_obj(m.group(1)))
    out.append('}')
    open(out_js, 'w').write('\n'.join(out) + '\n')


main()
