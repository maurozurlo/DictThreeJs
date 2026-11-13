"""Checks an extra-buildings file against a road plan: every footprint inside a block `inner` (inset >= 1 u),
no footprint overlap (>= 1 u gap) incl. the plan's own buildings.

    python tools/roadplan/check_fill.py build/roadplan/avenida.json build/roadplan/avenida_extra_buildings.json
Footprints (game x, z half extents; mixeduse is offset in x): measured from the GLBs.
"""
import json
import sys

FOOT = {  # model: (x0, x1, z0, z1) relative to the pivot, y_ipl, height
    'env_bld_civic_normal': (-24.49, 24.49, -15.25, 15.25),
    'env_bld_commercial_normal': (-25.99, 25.99, -8.74, 8.74),
    'env_bld_apartment_normal': (-15.46, 15.46, -25.71, 25.71),
    'env_bld_mixeduse_normal': (-8.06, 9.46, -11.35, 11.35),
    'env_bld_residential_normal': (-6.2, 6.2, -13.5, 13.5),
    'env_scaffolding_large': (-3.38, 3.38, -13.09, 13.09),
    'env_bld_terrace_normal': (-50.0, 50.0, -11.0, 11.0),
    'env_bld_terrace_poor': (-50.0, 50.0, -11.0, 11.0),
}


def inside(p, poly):
    x, y = p
    c = False
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def dist_to_edges(p, poly):
    best = 1e9
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / max(dx * dx + dy * dy, 1e-9)))
        best = min(best, ((a[0] + t * dx - p[0]) ** 2 + (a[1] + t * dy - p[1]) ** 2) ** 0.5)
    return best


def rect(b):
    f = FOOT[b['model']]
    return (b['pos'][0] + f[0], b['pos'][0] + f[1], b['pos'][1] + f[2], b['pos'][1] + f[3])


def main():
    plan = json.load(open(sys.argv[1]))
    extra = json.load(open(sys.argv[2]))
    allb = [dict(b, src='plan') for b in plan['buildings']] + [dict(b, src='extra') for b in extra]
    bad = 0
    for b in allb:
        x0, x1, z0, z1 = rect(b)
        host = None
        for blk in plan['blocks']:
            if blk['kind'] == 'median':
                continue
            if inside(((x0 + x1) / 2, (z0 + z1) / 2), blk['inner']):
                host = blk
        if host is None:
            print('NO BLOCK', b); bad += 1; continue
        corners = [(x0, z0), (x1, z0), (x1, z1), (x0, z1), ((x0 + x1) / 2, z0), ((x0 + x1) / 2, z1), (x0, (z0 + z1) / 2), (x1, (z0 + z1) / 2)]
        for c in corners:
            if not inside(c, host['inner']) or dist_to_edges(c, host['inner']) < 1.0:
                if b['src'] == 'extra':
                    print('INSET<1', host['id'], b['model'], b['pos'], 'corner', c, round(dist_to_edges(c, host['inner']), 2)); bad += 1
                break
    for i, a in enumerate(allb):
        for b in allb[i + 1:]:
            ra, rb = rect(a), rect(b)
            if ra[0] < rb[1] + 1 and rb[0] < ra[1] + 1 and ra[2] < rb[3] + 1 and rb[2] < ra[3] + 1:
                if 'extra' in (a['src'], b['src']):
                    print('OVERLAP/<1 gap', a['model'], a['pos'], b['model'], b['pos']); bad += 1
    print('checked', len(allb), 'buildings;', bad, 'problems')


main()
