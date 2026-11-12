"""Dumps the street's IDE + IPL TypeScript data to JSON for Blender scripts (plain Python).

    python tools/blender/street_layout_dump.py <out.json>

Reads src/assets/data/street-objects.ide.ts and street-placement.ipl.ts by converting their object
literals to JSON (comments dropped, keys quoted, single quotes swapped, trailing commas removed).
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def ts_array(path, key):
    src = open(path, encoding='utf-8').read()
    src = re.sub(r'//[^\n]*', '', src)
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    start = src.index(key + ':')
    i = src.index('[', start)
    depth = 0
    for j in range(i, len(src)):
        if src[j] == '[':
            depth += 1
        elif src[j] == ']':
            depth -= 1
            if depth == 0:
                break
    body = src[i:j + 1]
    body = body.replace("'", '"')
    body = re.sub(r'([{,]\s*)([A-Za-z_]\w*)\s*:', r'\1"\2":', body)
    body = re.sub(r',(\s*[}\]])', r'\1', body)
    return json.loads(body)


def main():
    out = sys.argv[1]
    ide = ts_array(os.path.join(ROOT, 'src/assets/data/street-objects.ide.ts'), 'objs')
    ipl = ts_array(os.path.join(ROOT, 'src/assets/data/street-placement.ipl.ts'), 'inst')
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump({'ide': ide, 'ipl': ipl}, fh, indent=1)
    print(len(ide), 'objs', len(ipl), 'inst ->', out)


main()
