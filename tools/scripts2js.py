#!/usr/bin/env python3
"""shooting_genesis src/script1..6.c -> zenith_lancer js/scripts.js"""
import re, sys
src = sys.argv[1]
out = ['// The six stages\' scripts: what appears when.', "'use strict';", '']
for n in range(1, 7):
    t = open('%s/script%d.c' % (src, n)).read()
    lines = t.split('\n')
    head = lines[0]
    body = t[t.index('const Ev script'):]
    body = body[:body.index('};') + 2]
    body = body.replace('const Ev script%d[] = {' % n, 'const script%d = [' % n)
    body = re.sub(r'\{\s*([^{}]*?)\s*\}', lambda m: 'EV(' + m.group(1) + ')', body)
    body = body[:-2] + '];'
    # anything before the array other than the include: keep comments
    pre = t[:t.index('const Ev script')]
    pre = '\n'.join(l for l in pre.split('\n') if not l.startswith('#include'))
    out.append(pre.strip('\n'))
    out.append(body)
    out.append('')
out.append('const scripts = [script1, script2, script3, script4, script5, script6];')
open(sys.argv[2], 'w').write('\n'.join(out) + '\n')
