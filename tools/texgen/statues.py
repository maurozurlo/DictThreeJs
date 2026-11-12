"""Textures for the statues family: the granite pedestal sheet and the three metal ramp sheets.

    python tools/texgen/statues.py [--only env_statue_bronze ...] [--preview build/visual_gaps/statues/tex]

Contract: tools/texgen/statues_layout.json (rects, sizes, looks). Writes public/textures/map/env_statue_*.png.
Every random source is seeded: a re-run writes identical bytes.

The game lights the street with one ambient light and no directional light, so the metals carry all of
their form in the albedo: the modeler maps every metal face onto an exposure ramp (image row = exposure,
see `metal_ramp_rule` in the contract). The decals (face, medals, polish) are painted as an exposure map
first and coloured through the same ramp, so they match the cast metal around them.
"""
import argparse
import json
import math
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import texlib as tl  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CONTRACT = os.path.join(ROOT, 'tools', 'texgen', 'statues_layout.json')
SEED = 20261112
F = np.float32


def load_contract():
    with open(CONTRACT, encoding='utf-8') as fh:
        return json.load(fh)


def check_rects(regions, size, what):
    w, h = size
    rects = {k: v['rect'] for k, v in regions.items()}
    for k, (x, y, rw, rh) in rects.items():
        if x < 0 or y < 0 or x + rw > w or y + rh > h:
            raise SystemExit(f'{what}: rect {k} leaves the sheet')
    names = list(rects)
    for i, a in enumerate(names):
        ax, ay, aw, ah = rects[a]
        for b in names[i + 1:]:
            bx, by, bw, bh = rects[b]
            if ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah:
                raise SystemExit(f'{what}: rects {a} and {b} overlap')


def grain(img, seed, salt, lum=0.035, chroma=0.012):
    h, w = img.shape[:2]
    n = tl.white(w, h, seed, salt + '/l') - 0.5
    c = np.stack([tl.white(w, h, seed, f'{salt}/c{i}') - 0.5 for i in range(3)], -1)
    return np.clip(img * (1.0 + F(lum * 2) * n[..., None]) + F(chroma * 2) * c, 0, 1)


def rotated_ellipse_sd(X, Y, cx, cy, rx, ry, ang):
    ca, sa = math.cos(ang), math.sin(ang)
    dx, dy = X - cx, Y - cy
    u = (dx * ca + dy * sa) / rx
    v = (-dx * sa + dy * ca) / ry
    return (np.sqrt(u * u + v * v) - 1.0) * min(rx, ry)


# ---------------------------------------------------------------------------------------------------------
# Granite (pedestal)

GRANITE = tl.rgb(118, 106, 102)


def granite(w, h, seed, salt, base=GRANITE, polish=1.0, rough=0.0):
    """Grey-pink granite: mottled base plus black, salmon and white crystal grains (1-2 px)."""
    m = tl.fbm(w, h, max(1, w // 16), max(1, h // 16), seed, salt + '/mot', octaves=4)
    img = tl.solid(w, h, base) * (1.0 + 0.10 * m[..., None])
    g = tl.uniform_rank(tl.blur(tl.white(w, h, seed, salt + '/g'), 0.6))
    img = tl.mix(img, tl.rgb(52, 48, 48), tl.smoothstep(0.89, 0.93, g) * 0.75)         # black mica
    p = tl.uniform_rank(tl.blur(tl.white(w, h, seed, salt + '/p'), 0.7))
    img = tl.mix(img, tl.rgb(166, 118, 102), tl.smoothstep(0.82, 0.88, p) * 0.6)       # salmon feldspar
    q = tl.white(w, h, seed, salt + '/q')
    img = tl.mix(img, tl.rgb(196, 190, 184), (q > 0.975).astype(F) * 0.6)               # quartz
    if rough:
        r = tl.fbm(w, h, max(1, w // 4), max(1, h // 4), seed, salt + '/rough', octaves=2)
        img = img * (1.0 + F(rough) * r[..., None])
    return img * F(polish)


def splats(w, h, seed, count, area, salt, wrap=tl.STRIP):
    """White bird droppings: lumpy dots with a darker core."""
    m = tl.blobs(w, h, seed, count, radius=(0.9, 1.8), rough=0.6, soft=0.6, area=area, wrap=wrap, salt=salt)
    return np.clip(m, 0, 1)


def paint_die(w, h):
    s = SEED
    X, Y = tl.coords(w, h)
    img = granite(w, h, s, 'die')
    st = tl.streaks(w, h, s, 14, length=(10.0, 40.0), width=(0.7, 1.4), strength=(0.35, 0.8),
                    area=(0, 2, w, 6), wrap=tl.STRIP, salt='die')
    img = tl.tint(img, tl.rgb(150, 160, 150) / tl.rgb(255, 255, 255) * 1.0, np.clip(st, 0, 1) * 0.6)
    img = tl.shade(img, 0.5 + 0.5 * tl.smoothstep(0.0, 3.5, Y))                             # under the cornice
    edge = (h - 8) + 2.5 * tl.fbm(w, h, 8, 1, s, 'die/gr', octaves=3)
    gm = tl.smoothstep(edge - 1.0, edge + 1.5, Y)
    img = tl.tint(img, tl.rgb(120, 112, 96), gm * 0.85)
    sp = tl.speckle(w, h, s, 0.02, radius=(0.4, 0.8), area=(0, h - 16, w, h - 6), wrap=tl.STRIP, salt='die/sp')
    img = tl.shade(img, 1.0 - 0.35 * np.clip(sp, 0, 1))
    return grain(img, s, 'die')


def paint_cap(w, h):
    s = SEED + 1
    X, Y = tl.coords(w, h)
    img = granite(w, h, s, 'cap', polish=1.08)
    slope = (Y < 8).astype(F)
    img = tl.tint(img, tl.rgb(255, 250, 238) / 255.0 * 1.0, slope * 0.0)
    img = img * (1.0 + 0.10 * slope[..., None])                                            # sloped: lighter, dusty
    img = tl.mix(img, tl.rgb(150, 140, 125), slope * 0.25 * np.clip(tl.fbm(w, h, 16, 2, s, 'dust') + 0.5, 0, 1))
    img = tl.shade(img, 1.0 - 0.45 * (np.abs(Y - 11.5) < 0.6))                             # incised groove
    img = tl.shade(img, 1.0 - 0.25 * tl.smoothstep(7.0, 8.0, Y) * (1 - tl.smoothstep(8.0, 9.5, Y)))  # arris
    wear = tl.edge_wear(tl.sd_rect(X, Y, -10, -10, w + 10, h - 0.5), s, w, h, 16, 2, depth=1.5, amount=0.4, salt='cap')
    img = tl.mix(img, tl.rgb(150, 140, 135), wear * 0.6)
    sp = splats(w, h, s, 9, (0, 0.5, w, 3.0), 'cap/splat')
    dr = tl.streaks(w, h, s, 9, length=(4.0, 10.0), width=(0.5, 0.9), strength=(0.5, 0.9),
                    area=(0, 2, w, 4), wrap=tl.STRIP, salt='cap/drip')
    img = tl.mix(img, tl.rgb(226, 224, 212), np.clip(sp + 0.6 * dr, 0, 1) * 0.9)
    return grain(img, s, 'cap')


def paint_step(w, h):
    s = SEED + 2
    X, Y = tl.coords(w, h)
    tread = (Y < 8).astype(F)
    img = granite(w, h, s, 'step', base=tl.rgb(108, 102, 100), rough=0.12)
    img = tl.mix(img, tl.rgb(146, 138, 124), tread * 0.45)                                 # dusty tread
    leaves = tl.blobs(w, h, s, 10, radius=(0.7, 1.4), rough=0.7, area=(0, 1, w, 7), wrap=tl.STRIP, salt='leaf')
    img = tl.mix(img, tl.rgb(70, 52, 34), np.clip(leaves, 0, 1) * 0.9)
    img = tl.shade(img, 1.0 - 0.35 * tl.smoothstep(7.0, 8.0, Y) * (1 - tl.smoothstep(8.0, 10.0, Y)))
    wear = tl.edge_wear(tl.sd_rect(X, Y, -10, 8.0, w + 10, h + 10), s, w, h, 16, 3, depth=2.0, amount=0.5, salt='step')
    img = tl.mix(img, tl.rgb(150, 145, 140), wear * 0.7)
    edge = (h - 5) + 2.0 * tl.fbm(w, h, 8, 1, s, 'step/dirt', octaves=3)
    img = tl.tint(img, tl.rgb(118, 108, 92), tl.smoothstep(edge - 1.5, edge + 1.5, Y) * 0.9)
    return grain(img, s, 'step')


def plaque_bronze(e):
    """Bronze colour for an exposure-like map e in [0, 1] (plaque: same ramp as the bronze statue)."""
    return colourize(METALS['bronze'], e)


def paint_plaque(w, h):
    s = SEED + 4
    X, Y = tl.coords(w, h)
    sd_out = tl.sd_rect(X, Y, 0.5, 0.5, w - 0.5, h - 0.5)
    sd_in = tl.sd_rect(X, Y, 3.0, 3.0, w - 3.0, h - 3.0)
    e = np.full((h, w), 0.55, F) + 0.06 * tl.fbm(w, h, 5, 3, s, 'pl', octaves=3)            # patina field
    frame = (sd_in > 0) & (sd_out < 0)
    e = np.where(frame, 0.72, e)
    e = np.where((sd_out > -1.0) & frame, 0.86, e)                                           # outer rim bright
    e = np.where((sd_in > 0) & (sd_in < 0.9), 0.18, e)                                       # inner groove dark
    tl_bright = frame & ((X < 3.0) | (Y < 3.0))
    e = np.where(tl_bright, np.maximum(e, 0.82), e)
    for cx, cy in ((5.5, 5.5), (w - 5.5, 5.5), (5.5, h - 5.5), (w - 5.5, h - 5.5)):
        dd = np.hypot(X - cx, Y - cy)
        e = np.where(dd < 1.3, 0.92, e)
        e = np.where((dd >= 1.3) & (dd < 2.0), np.minimum(e, 0.25), e)
    img = colourize(METALS['bronze'], e, s, 'plaque')
    src = [(x, h - 3.0) for x in np.linspace(4, w - 4, 7)] + [(5.5, 7.0), (w - 5.5, 7.0)]
    dr = tl.streaks(w, h, s, 9, length=(3.0, 8.0), width=(0.5, 1.0), strength=(0.6, 1.0), sources=src,
                    wrap=tl.DECAL, salt='plaque')
    img = tl.mix(img, METALS['bronze']['recess'], np.clip(dr, 0, 1) * 0.8)
    return grain(img, s, 'plaque', lum=0.03)


def paint_wreath(w, h):
    s = SEED + 5
    X, Y = tl.coords(w, h)
    r = tl.rng(s, 'wreath')
    img = tl.solid(w, h, tl.rgb(34, 30, 22))
    cols = [tl.rgb(96, 88, 48), tl.rgb(112, 92, 52), tl.rgb(84, 70, 40), tl.rgb(70, 84, 44),
            tl.rgb(120, 110, 80), tl.rgb(98, 96, 90)]
    for i in range(110):
        cx, cy = r.uniform(-2, w + 2), r.uniform(1.5, h - 1.5)
        ang = r.uniform(-0.9, 0.9) + (0.0 if r.random() < 0.5 else math.pi)
        droop = (cy / h) * 0.4
        sd = rotated_ellipse_sd(X, Y, cx, cy, r.uniform(2.2, 3.4), r.uniform(0.9, 1.4), ang + droop)
        for dx in (-w, w):  # leaves cross the seam between segments
            sd = np.minimum(sd, rotated_ellipse_sd(X, Y, cx + dx, cy, 2.8, 1.1, ang + droop))
        col = cols[int(r.integers(len(cols)))] * F(r.uniform(0.95, 1.3))
        leaf = tl.fill(sd, 0.6)
        mid = np.exp(-(sd + 0.6) ** 2 * 1.5) * 0.25                                          # leaf midrib shade
        img = tl.mix(img, col * (1.0 - mid[..., None]), leaf)
    img = tl.shade(img, 0.65 + 0.35 * tl.smoothstep(h, h * 0.3, Y))                         # inner edge darker
    return grain(img, s, 'wreath', lum=0.05)


def paint_ribbon(w, h):
    s = SEED + 6
    X, Y = tl.coords(w, h)
    img = tl.solid(w, h, tl.rgb(138, 82, 78)) * (1.0 + 0.08 * tl.fbm(w, h, 2, 4, s, 'rib', octaves=3)[..., None])
    stripe = ((np.abs(X - 3.5) < 1.0) | (np.abs(X - (w - 3.5)) < 1.0)).astype(F)
    img = tl.mix(img, tl.rgb(150, 128, 80), stripe * 0.85)
    stains = tl.grime(w, h, s, 2, 3, coverage=0.3, soft=0.8, salt='rib')
    img = tl.tint(img, tl.rgb(200, 185, 170), stains * 0.6)
    vcut = Y > (h - 3.5) + 2.5 * (1 - np.abs(X - w / 2) / (w / 2))
    img = np.where(vcut[..., None], img * 0.5, img)
    img = tl.shade(img, 1.0 - 0.3 * tl.smoothstep(h - 5, h, Y))
    return grain(img, s, 'ribbon')


PEDESTAL_PAINTERS = {'die': paint_die, 'cap': paint_cap, 'step': paint_step,
                     'plaque': paint_plaque, 'wreath': paint_wreath, 'ribbon': paint_ribbon}


# ---------------------------------------------------------------------------------------------------------
# Metals: exposure ramp + decals painted as exposure maps and coloured through the same ramp

METALS = {
    'bronze': dict(keys=[(0.0, (30, 25, 20)), (0.22, (56, 42, 30)), (0.48, (90, 60, 36)), (0.7, (118, 80, 46)),
                         (0.88, (160, 116, 64)), (1.0, (214, 172, 100))],
                   recess=tl.rgb(64, 112, 92), recess_deep=tl.rgb(30, 54, 46), recess_at=0.5, recess_amount=0.9,
                   sparkle=0.0, pits=0.5),
    'silver': dict(keys=[(0.0, (34, 36, 48)), (0.22, (72, 76, 92)), (0.48, (116, 120, 132)), (0.7, (156, 160, 172)),
                         (0.88, (198, 201, 210)), (1.0, (240, 242, 248))],
                   recess=tl.rgb(96, 84, 78), recess_deep=tl.rgb(40, 36, 40), recess_at=0.42, recess_amount=0.55,
                   sparkle=0.0, pits=0.3),
    'gold':   dict(keys=[(0.0, (70, 36, 12)), (0.22, (126, 72, 18)), (0.48, (200, 142, 38)), (0.7, (236, 186, 60)),
                         (0.88, (252, 222, 116)), (1.0, (255, 250, 196))],
                   recess=tl.rgb(150, 52, 30), recess_deep=tl.rgb(76, 24, 12), recess_at=0.38, recess_amount=0.55,
                   sparkle=0.03, pits=0.2),
}


def ramp_colour(metal, e):
    ts = np.array([k[0] for k in metal['keys']], np.float64)
    cols = np.array([k[1] for k in metal['keys']], np.float64) / 255.0
    out = np.empty(e.shape + (3,), F)
    for c in range(3):
        out[..., c] = np.interp(e.astype(np.float64), ts, cols[:, c])
    return out


def colourize(metal, e, seed=SEED, salt='m'):
    """Cast-metal colour for an exposure map e (h, w) in [0, 1]: ramp tone, mottling, brushed grain,
    pits, recess colour creeping in as ragged patches below `recess_at`, sparkle for the gilt."""
    h, w = e.shape
    img = ramp_colour(metal, e)
    mott = 0.11 * tl.fbm(w, h, max(1, w // 8), max(1, h // 8), seed, salt + '/mot', octaves=3) \
        + 0.05 * tl.fbm(w, h, max(1, w // 3), max(1, h // 3), seed, salt + '/mot2', octaves=2)
    brushed = (tl.blur(tl.white(w, h, seed, salt + '/br'), 2.5, 0.3) - 0.5) * 0.25
    img = img * (1.0 + mott + brushed)[..., None]
    rank = tl.uniform_rank(tl.fbm(w, h, max(1, w // 6), max(1, h // 6), seed, salt + '/rec', octaves=5, gain=0.6))
    thr = metal['recess_at']
    depth = tl.smoothstep(thr, thr - 0.35, e)
    m = tl.smoothstep(1.0 - depth - 0.16, 1.0 - depth + 0.16, rank) * F(metal['recess_amount'])
    rc = tl.mix(tl.solid(w, h, metal['recess_deep']), metal['recess'], np.clip(e / F(thr), 0, 1))
    rc = rc * (0.9 + 0.2 * rank[..., None])
    img = tl.mix(img, rc, m)
    if metal['pits']:
        pits = tl.speckle(w, h, seed, 0.03, radius=(0.4, 0.7), strength=(0.4, 1.0), salt=salt + '/pits')
        img = tl.shade(img, 1.0 - F(metal['pits']) * 0.45 * np.clip(pits, 0, 1) * tl.smoothstep(0.9, 0.5, e))
    if metal['sparkle']:
        sp = (tl.white(w, h, seed, salt + '/sp') > 1.0 - metal['sparkle']) & (e > 0.55)
        img = np.where(sp[..., None], np.minimum(img + 0.35, 1.0), img)
    return np.clip(img, 0, 1)


def ramp_exposure(h, rows):
    """Exposure per ramp row: row 1.5 -> 1.0, row (rows - 1.5) -> 0.0 (the contract's rule)."""
    y = np.arange(h, dtype=F) + 0.5
    t = 1.0 - (y - 1.5) / F(rows - 3)
    return np.clip(t, 0.0, 1.0)


def face_exposure(w, h, seed):
    X, Y = tl.coords(w, h)
    e = np.full((h, w), 0.6, F)
    e = np.where(Y < 3.0, 0.32, e)                                                    # forehead under the peak
    e = np.where((Y >= 3.0) & (Y < 5.0), 0.86, e)                                     # brow ridge
    for cx in (6.3, 13.7):
        e = np.where(tl.sd_ellipse(X, Y, cx, 6.6, 2.3, 1.4) < 0, 0.16, e)              # eye sockets
        e = np.where(tl.sd_ellipse(X, Y, cx - (1.6 if cx < 10 else -1.6), 10.0, 2.0, 1.6) < 0, 0.78, e)  # cheekbones
    e = np.where((np.abs(X - 10.0) < 1.1) & (Y >= 5.0) & (Y < 11.0), 0.92, e)         # nose ridge
    e = np.where((np.abs(X - 10.0) < 1.6) & (Y >= 11.0) & (Y < 12.0), 0.25, e)        # under the nose
    must_c = 12.0 + 1.2 * ((X - 10.0) / 7.0) ** 2                                      # moustache droops at the ends
    must = (np.abs(X - 10.0) < 7.2) & (Y >= must_c - 1.0) & (Y < must_c + 2.2)
    e = np.where(must, 0.7 + 0.06 * tl.fbm(w, h, 4, 2, seed, 'must', octaves=2), e)
    e = np.where(must & (Y < must_c), 0.95, e)                                         # bristly top edge
    e = np.where((np.abs(X - 10.0) < 7.0) & (Y >= must_c + 2.2) & (Y < must_c + 3.0), 0.12, e)  # underside
    e = np.where((np.abs(X - 10.0) < 2.8) & (Y >= 15.6) & (Y < 16.5), 0.12, e)         # mouth
    e = np.where((np.abs(X - 10.0) < 3.6) & (Y >= 16.5), 0.86, e)                      # square chin
    e = np.where((X < 1.5) | (X > w - 1.5), np.minimum(e, 0.42), e)                    # face turns away
    return np.clip(tl.blur(e, 0.45, wrap=tl.DECAL), 0, 1)


def medals_exposure(w, h, seed):
    X, Y = tl.coords(w, h)
    e = np.full((h, w), 0.34, F) + 0.04 * tl.fbm(w, h, 3, 3, seed, 'coat', octaves=2)
    r = tl.rng(seed, 'medals')
    ang = np.arctan2(Y - 4.5, X - 4.5)                                                 # big star, top left
    rr = np.hypot(X - 4.5, Y - 4.5)
    star_r = 2.0 + 1.6 * (0.5 + 0.5 * np.cos(5 * (ang + math.pi / 2)))
    e = np.where(rr < star_r + 0.6, 0.12, e)
    e = np.where(rr < star_r, 1.0, e)
    rows = [(1.0, [10.5, 14.8, 19.1]), (8.0, [3.0, 7.2, 11.4, 15.6, 19.8]), (14.0, [3.0, 7.2, 11.4, 15.6, 19.8])]
    for y0, xs in rows:
        for i, x0 in enumerate(xs):
            bar = (np.abs(X - x0) < 1.6) & (Y >= y0) & (Y < y0 + 2.0)
            e = np.where(bar, 0.62 if (i + int(y0)) % 2 else 0.78, e)
            d = np.hypot(X - x0, Y - (y0 + 3.6))
            e = np.where(d < 1.9, 0.14, e)
            e = np.where(d < 1.35, 0.97 - 0.1 * r.random(), e)
    return np.clip(e, 0, 1)


def polish_exposure(w, h, seed):
    return np.clip(0.95 + 0.05 * tl.fbm(w, h, 3, 3, seed, 'pol', octaves=2), 0, 1).astype(F)


def paint_metal(name, contract):
    metal = METALS[name]
    tex = contract['textures'][f'env_statue_{name}']
    w, h = tex['size']
    regions = contract['metal_regions']
    check_rects(regions, (w, h), f'env_statue_{name}')
    out = np.zeros((h, w, 3), F)
    s = SEED + {'bronze': 10, 'silver': 20, 'gold': 30}[name]
    for key, reg in regions.items():
        x, y, rw, rh = reg['rect']
        if key == 'ramp':
            e = np.repeat(ramp_exposure(rh, rh)[:, None], rw, axis=1)
        elif key == 'face':
            e = face_exposure(rw, rh, s)
        elif key == 'medals':
            e = medals_exposure(rw, rh, s)
        elif key == 'polish':
            e = polish_exposure(rw, rh, s)
        else:
            raise SystemExit(f'no painter for metal region {key}')
        img = colourize(metal, e, s, f'{name}/{key}')
        out[y:y + rh, x:x + rw] = grain(img, s, f'{name}/{key}', lum=0.03, chroma=0.01)
    return out


def paint_pedestal(contract):
    tex = contract['textures']['env_statue_pedestal']
    w, h = tex['size']
    regions = tex['regions']
    check_rects(regions, (w, h), 'env_statue_pedestal')
    if set(regions) != set(PEDESTAL_PAINTERS):
        raise SystemExit(f'pedestal regions {sorted(regions)} != painters {sorted(PEDESTAL_PAINTERS)}')
    out = np.zeros((h, w, 3), F)
    for key, reg in regions.items():
        x, y, rw, rh = reg['rect']
        out[y:y + rh, x:x + rw] = PEDESTAL_PAINTERS[key](rw, rh)
    return out


def preview(images, contract, outdir):
    from PIL import ImageDraw
    os.makedirs(outdir, exist_ok=True)
    items = []
    for name, img in images.items():
        im = Image.fromarray(tl.to_u8(img), 'RGB')
        big = im.resize((im.width * 4, im.height * 4), Image.NEAREST)
        regs = contract['textures'][name].get('regions') or contract['metal_regions']
        ol = big.copy()
        do = ImageDraw.Draw(ol)
        for k, r in regs.items():
            x, y, rw, rh = r['rect']
            do.rectangle([x * 4, y * 4, (x + rw) * 4 - 1, (y + rh) * 4 - 1], outline=(255, 0, 255))
            do.text((x * 4 + 2, y * 4 + 1), k, fill=(255, 255, 0))
        items.append((name + ' x4', big))
        items.append((name + ' regions', ol))
        if name != 'env_statue_pedestal':
            x, y, rw, rh = contract['metal_regions']['ramp']['rect']
            strip = np.tile(img[y:y + rh, x:x + rw], (1, 3, 1))
            sim = Image.fromarray(tl.to_u8(strip), 'RGB')
            items.append((name + ' ramp tiled 3x (x4)', sim.resize((sim.width * 4, sim.height * 4), Image.NEAREST)))
        else:
            for key in ('die', 'cap', 'step'):
                x, y, rw, rh = regs[key]['rect']
                strip = np.tile(img[y:y + rh, x:x + rw], (1, 2, 1))
                sim = Image.fromarray(tl.to_u8(strip), 'RGB')
                items.append((f'{key} tiled 2x (x3)', sim.resize((sim.width * 3, sim.height * 3), Image.NEAREST)))
    sheet = tl.contact_sheet(items, max_width=1800)
    path = os.path.join(outdir, 'statues_textures.png')
    sheet.save(path)
    print('PREVIEW', path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*')
    ap.add_argument('--preview')
    a = ap.parse_args()
    contract = load_contract()
    names = a.only or list(contract['textures'])
    images = {}
    for name in names:
        tex = contract['textures'][name]
        img = paint_pedestal(contract) if name == 'env_statue_pedestal' else paint_metal(tex['metal'], contract)
        path = os.path.join(ROOT, tex['file'])
        tl.save_rgb(path, img)
        images[name] = img
        print('WROTE', path, img.shape[1], 'x', img.shape[0])
    if a.preview:
        preview(images, contract, os.path.join(ROOT, a.preview))


if __name__ == '__main__':
    main()
