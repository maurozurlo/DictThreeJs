"""Textures for the plaza_features family (burning trash can, normal and rich fountains, burned decal).

    python tools/texgen/plaza_features.py [--only <texture> ...] [--preview build/visual_gaps/plaza_features/tex]

Reads every size and rect from tools/texgen/plaza_features_layout.json and writes the PNGs it names under
public/textures/map/. One paint function per region; every random source is seeded (a re-run writes identical
bytes). RGBA textures are hard cut-outs (alpha 0 or 255) with the colour bled under the transparent pixels.

The game lights the street with one flat ambient light and ignores vertex colour, so form is baked into the
albedo here: occlusion in recesses, bright rims, darker water under the tiers.
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

F = np.float32
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
CONTRACT = os.path.join(ROOT, 'tools', 'texgen', 'plaza_features_layout.json')
SEED = 2026_11_12


# ---------------------------------------------------------------------------------------------------------
# Helpers

def C(r, g, b):
    return tl.rgb(r, g, b)


def ramp(t, stops):
    """Colour ramp: stops = [(t, (r, g, b)), ...] in 0-255; t is an (h, w) array."""
    t = np.clip(np.asarray(t, F), 0.0, 1.0)
    out = np.zeros(t.shape + (3,), F)
    ts = [s[0] for s in stops]
    cs = [C(*s[1]) for s in stops]
    out[:] = cs[0]
    for i in range(len(stops) - 1):
        a, b = ts[i], ts[i + 1]
        k = np.clip((t - a) / F(max(b - a, 1e-6)), 0.0, 1.0)[..., None]
        sel = (t >= a)[..., None]
        out = np.where(sel, cs[i] + (cs[i + 1] - cs[i]) * k, out)
    return out


def frac(w, h, cx, cy, seed, salt, octaves=5, gain=0.6):
    """Rank of a high-gain fBm: thresholding it gives fractal outlines (area fraction = 1 - threshold)."""
    return tl.uniform_rank(tl.fbm(w, h, cx, cy, seed, salt, octaves=octaves, gain=gain))


def cavity(hf, sigma, wrap=tl.TILE):
    """blur(h) - h over its standard deviation: positive in hollows, negative on ridges."""
    c = tl.blur(hf, sigma, wrap=wrap) - hf
    return c / F(max(float(c.std()), 1e-6))


def grain(img, seed, salt, lum=0.035, chroma=0.012):
    h, w = img.shape[:2]
    r = tl.rng(seed, 'grain', salt)
    g = r.normal(0.0, lum, (h, w, 1)).astype(F) + r.normal(0.0, chroma, (h, w, 3)).astype(F)
    return np.clip(img * (1.0 + g), 0.0, 1.0)


def vary(img, seed, salt, w, h, cx, cy, amount=0.12):
    """Broad periodic brightness variation (mineral, dirt) so flat fills don't read as vector art."""
    n = tl.fbm(w, h, cx, cy, seed, salt, octaves=4, gain=0.55)
    return tl.shade(img, 1.0 + F(amount) * n)


def bleed(rgb, alpha, iters=12):
    """Pushes the colour of opaque pixels into the transparent ones (no dark fringe at the cut)."""
    rgb = rgb.copy()
    known = alpha > 0.5
    h, w = known.shape
    for _ in range(iters):
        if known.all():
            break
        acc = np.zeros_like(rgb)
        cnt = np.zeros((h, w), F)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                src = np.zeros((h, w), bool)
                sh = np.zeros_like(rgb)
                ys = slice(max(dy, 0), h + min(dy, 0))
                yd = slice(max(-dy, 0), h + min(-dy, 0))
                xs = slice(max(dx, 0), w + min(dx, 0))
                xd = slice(max(-dx, 0), w + min(-dx, 0))
                src[yd, xd] = known[ys, xs]
                sh[yd, xd] = rgb[ys, xs]
                acc += sh * src[..., None]
                cnt += src
        new = (~known) & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]
        known = known | new
    if not known.all():
        rgb[~known] = rgb[alpha > 0.5].mean(axis=0) if (alpha > 0.5).any() else 0.5
    return rgb


def cut(a, t=0.5):
    return (np.asarray(a, F) > F(t)).astype(F)


def border_clear(alpha, px):
    h, w = alpha.shape
    a = alpha.copy()
    a[:px, :] = 0
    a[h - px:, :] = 0
    a[:, :px] = 0
    a[:, w - px:] = 0
    return a


def gold_ramp(t):
    """Painted gold: dark brown -> ochre -> gold -> pale highlight."""
    return ramp(t, [(0.0, (95, 60, 18)), (0.35, (170, 125, 35)), (0.62, (222, 178, 60)),
                    (0.85, (245, 215, 110)), (1.0, (255, 240, 170))])


# ---------------------------------------------------------------------------------------------------------
# env_trashcan_burning (opaque atlas)

def paint_drum_side(w, h, s):
    X, Y = tl.coords(w, h)
    rust_n = tl.fbm(w, h, 4, 2, s, 'rust', octaves=5, gain=0.6)
    rust = ramp(0.5 + 0.6 * rust_n, [(0.0, (95, 45, 25)), (0.45, (128, 64, 30)), (0.8, (155, 88, 42)),
                                    (1.0, (170, 105, 55))])
    paint_m = cut(frac(w, h, 6, 3, s, 'paint') - 0.42 + 0.0 * Y, 0.0)
    paint_m *= tl.smoothstep(8.0, 14.0, Y)
    paint = ramp(0.5 + 0.5 * tl.fbm(w, h, 8, 4, s, 'paintv'), [(0.0, (55, 62, 46)), (1.0, (84, 92, 68))])
    img = tl.mix(rust, paint, paint_m)
    # chipped paint edge: a dark rim just outside the islands
    rim = np.clip(tl.blur(paint_m, 0.7) - paint_m, 0.0, 1.0)
    img = tl.shade(img, 1.0 - 0.5 * rim)
    # scorched top: blistered black steel, heat tint band under it
    scorch = 1.0 - tl.smoothstep(4.0, 11.0, Y + 2.5 * tl.fbm(w, h, 8, 2, s, 'scorch'))
    black = ramp(0.5 + 0.5 * tl.fbm(w, h, 8, 4, s, 'blk'), [(0.0, (22, 19, 18)), (1.0, (52, 46, 42))])
    img = tl.mix(img, black, scorch)
    heat = np.exp(-((Y - 10.5) / 2.2) ** 2) * (1 - scorch)
    img = tl.mix(img, C(78, 64, 80), heat * 0.45)
    # rolling hoops: light row over a dark row, soft occlusion around
    for y0 in (10, 21):
        img[y0] = img[y0] * 1.35 + 0.03
        img[y0 + 1] = img[y0 + 1] * 0.62
        img[y0 - 1] = img[y0 - 1] * 0.85
        img[y0 + 2] = img[y0 + 2] * 0.85
    # rust streaks down from the hoops and the scorched band
    st = tl.streaks(w, h, s, 12, length=(5, 12), width=(0.6, 1.2), strength=(0.4, 0.9), salt='rst',
                    sources=[(float(x), float(y)) for x, y in zip(tl.rng(s, 'srcx').uniform(0, w, 12),
                                                                  [12, 23, 12, 23, 9, 12, 23, 12, 23, 9, 12, 23])],
                    wrap=(True, False))
    img = tl.tint(img, C(150, 80, 45) / F(0.6), st * 0.35)
    img = tl.shade(img, 1.0 - 0.35 * st)
    # dent: a soft dark oval with a lighter lower lip
    d = np.hypot((X - 40) / 4.5, (Y - 14) / 3.2)
    img = tl.shade(img, 1.0 - 0.38 * np.exp(-d * d * 1.3))
    img = tl.shade(img, 1.0 + 0.25 * np.exp(-((X - 40) / 4.0) ** 2 - ((Y - 17.5) / 1.0) ** 2))
    # ground contact grime
    img = tl.shade(img, 0.55 + 0.45 * tl.smoothstep(h - 0.5, h - 4.0, Y))
    img = vary(img, s, 'drumv', w, h, 4, 2, 0.1)
    return grain(img, s, 'drum')


def paint_lip(w, h, s):
    X, Y = tl.coords(w, h)
    base = ramp(0.5 + 0.6 * tl.fbm(w, h, 8, 1, s, 'lip', octaves=3), [(0.0, (40, 36, 34)), (1.0, (82, 76, 70))])
    fl = tl.speckle(w, h, s, 0.12, radius=(0.4, 0.7), salt='lipf', wrap=(True, False))
    img = tl.mix(base, C(120, 108, 95), fl * 0.8)
    img[h - 1] *= 0.35
    img[0] = img[0] * 1.2
    return grain(img, s, 'lip')


def paint_inner_wall(w, h, s):
    X, Y = tl.coords(w, h)
    flick = tl.fbm(w, h, 8, 2, s, 'flick', octaves=3)
    g = tl.smoothstep(3.5, 11.0, Y + 2.2 * flick)
    img = ramp(g, [(0.0, (18, 15, 14)), (0.35, (45, 25, 16)), (0.65, (190, 80, 22)), (0.85, (238, 125, 30)),
                   (1.0, (255, 195, 70))])
    soot = tl.speckle(w, h, s, 0.05, radius=(0.5, 0.9), salt='soot', wrap=(True, False))
    img = tl.shade(img, 1.0 - 0.5 * soot * (1 - g))
    return grain(img, s, 'inner', lum=0.05)


def paint_coals(w, h, s):
    X, Y = tl.coords(w, h)
    f1, f2, cell = tl.voronoi(w, h, 4, 4, s, 'coal', jitter=0.95)
    edge = 1.0 - tl.smoothstep(0.4, 1.6, f2 - f1)
    cv = tl.cell_values(cell, 16, s, 'coalv')
    chunk = ramp(cv, [(0.0, (18, 15, 14)), (1.0, (58, 46, 40))])
    centre = 1.0 - np.clip(np.hypot(X - w / 2, Y - h / 2) / (w * 0.62), 0.0, 1.0)
    glow_t = np.clip(edge * (0.55 + 0.6 * centre) + 0.25 * (cv > 0.8) * centre, 0.0, 1.0)
    glow = ramp(glow_t, [(0.0, (120, 40, 15)), (0.45, (235, 115, 28)), (0.8, (255, 190, 60)),
                         (1.0, (255, 230, 140))])
    img = tl.mix(chunk, glow, tl.smoothstep(0.15, 0.5, glow_t))
    return grain(img, s, 'coals', lum=0.05)


def paint_trash(w, h, s):
    X, Y = tl.coords(w, h)
    # left: black-green plastic bags with soft fold highlights and knots
    hb = tl.fbm(w, h, 6, 2, s, 'bagfold', octaves=4, gain=0.55)
    bag = ramp(0.5 + 0.7 * hb, [(0.0, (16, 20, 17)), (0.5, (32, 38, 32)), (0.85, (70, 78, 72)),
                                (1.0, (110, 116, 110))])
    cav = cavity(hb, 1.5)
    bag = tl.shade(bag, 1.0 - 0.18 * np.clip(cav, -1, 2))
    for kx in (6.0, 17.0):
        k = np.exp(-((X - kx) / 1.3) ** 2 - ((Y - 3.0) / 1.3) ** 2)
        bag = tl.mix(bag, C(85, 92, 86), k * 0.7)
    # right: cardboard, newspaper, flecks like trash.png
    f1, f2, cell = tl.voronoi(w, h, 9, 3, s, 'litter', jitter=0.9)
    cv = tl.cell_values(cell, 27, s, 'litterv')
    card = ramp(0.5 + 0.5 * tl.fbm(w, h, 8, 2, s, 'card'), [(0.0, (100, 74, 45)), (1.0, (140, 108, 70))])
    paper = ramp(0.5 + 0.5 * tl.fbm(w, h, 12, 4, s, 'paper'), [(0.0, (125, 122, 115)), (1.0, (175, 172, 162))])
    right = np.where((cv < 0.45)[..., None], card, paper)
    right = tl.shade(right, 1.0 - 0.45 * (1.0 - tl.smoothstep(0.3, 1.3, f2 - f1)))
    fl = tl.speckle(w, h, s, 0.06, radius=(0.5, 0.8), salt='flecks')
    cols = np.stack([C(170, 40, 35), C(40, 90, 160), C(200, 180, 60), C(220, 220, 215)])
    pick = (tl.white(w, h, s, 'fleckc') * 4).astype(int).clip(0, 3)
    right = tl.mix(right, cols[pick], fl)
    mixm = tl.smoothstep(22.0, 26.0, X + 2.0 * tl.fbm(w, h, 4, 2, s, 'split'))
    img = tl.mix(bag, right, mixm)
    img = tl.shade(img, 0.6 + 0.4 * tl.smoothstep(h - 0.5, h - 3.0, Y))
    return grain(img, s, 'trash')


# ---------------------------------------------------------------------------------------------------------
# env_trashcan_burning_fire (RGBA cut-outs)

FIRE_RAMP = [(0.0, (190, 55, 18)), (0.25, (232, 100, 22)), (0.5, (250, 150, 30)), (0.72, (255, 205, 55)),
             (0.9, (255, 238, 150)), (1.0, (255, 248, 190))]


def flame_field(w, h, s, salt, tongues):
    """tongues: (x centre, top y, half width at the base, lean px). Returns (field 0..1, heat 0..1)."""
    X, Y = tl.coords(w, h)
    b = F(h) - Y  # height above the rect bottom
    warp = tl.fbm(w, h, 3, 6, s, salt + 'warp', octaves=3) * 2.2
    field = np.zeros((h, w), F)
    core = np.zeros((h, w), F)
    for cx, top, hw, lean in tongues:
        ht = F(h - top)
        t = np.clip(b / ht, 0.0, 1.2)
        axis = cx + lean * t ** 1.5 + warp * t
        half = F(hw) * np.clip(1.0 - t, 0.0, 1.0) ** 0.55 + 0.45
        f = 1.0 - np.abs(X - axis) / half
        field = np.maximum(field, f * (t <= 1.0))
        core = np.maximum(core, np.clip(f, 0, 1) * (1.0 - t))
    base = tl.smoothstep(h - 13.0, h - 9.0, Y)
    field = np.maximum(field, base)
    rag = tl.fbm(w, h, 4, 8, s, salt + 'rag', octaves=3, gain=0.6)
    field = field + 0.28 * rag
    heat = np.clip(0.15 + 0.85 * core + 0.35 * base * (1.0 - np.abs(X - w / 2) / (w / 2)) - 0.25 * (b / h), 0, 1)
    return field, heat


def paint_flame(w, h, s, salt, tongues, flicks):
    X, Y = tl.coords(w, h)
    field, heat = flame_field(w, h, s, salt, tongues)
    alpha = cut(field, 0.42)
    for fx, fy, r in flicks:  # detached flickers above the tongues
        alpha = np.maximum(alpha, cut(tl.fill(tl.sd_ellipse(X, Y, fx, fy, r * 0.7, r * 1.3)), 0.5))
        heat = np.maximum(heat, 0.3 * np.exp(-((X - fx) ** 2 + (Y - fy) ** 2) / (r * r)))
    alpha = border_clear(alpha, 1) if False else alpha
    alpha[:2, :] = 0
    alpha[:, :1] = 0
    alpha[:, w - 1:] = 0
    heat = heat + 0.08 * tl.fbm(w, h, 4, 8, s, salt + 'heatn', octaves=2)
    img = ramp(heat, FIRE_RAMP)
    return grain(img, s, salt, lum=0.03, chroma=0.006), alpha


def paint_flame_a(w, h, s):
    return paint_flame(w, h, s, 'fa', [(12.0, 3.0, 7.5, -1.0), (6.0, 14.0, 6.0, -2.0), (18.0, 10.0, 6.0, 2.0),
                                       (12.0, 22.0, 11.0, 0.0)], [(8.5, 2.5, 1.2)])


def paint_flame_b(w, h, s):
    return paint_flame(w, h, s, 'fb', [(8.0, 6.0, 7.0, -3.0), (16.0, 9.0, 7.0, 3.0), (12.0, 24.0, 11.0, 0.0)],
                       [(4.5, 4.5, 1.1), (19.5, 6.0, 1.0)])


def paint_smoke(w, h, s):
    X, Y = tl.coords(w, h)
    r = tl.rng(s, 'puffs')
    hf = np.zeros((h, w), F)
    n = 9
    for i in range(n):
        t = i / (n - 1)
        cy = h - 5.0 - t * (h - 12.0)
        cx = w / 2 + r.uniform(-1.8, 1.8) + 1.5 * math.sin(i * 1.3)
        rad = 3.6 + 3.4 * t + r.uniform(-0.6, 0.6)
        d2 = ((X - cx) ** 2 + ((Y - cy) * 1.1) ** 2) / (rad * rad)
        hf = np.maximum(hf, np.sqrt(np.clip(1.0 - d2, 0.0, 1.0)))
    rag = tl.fbm(w, h, 2, 8, s, 'smrag', octaves=3, gain=0.6)
    up = 1.0 - Y / h  # 0 at the bottom, 1 at the top
    alpha = cut(hf + 0.25 * rag - 0.18 - 0.35 * tl.smoothstep(0.55, 1.0, up) * (0.5 + 0.5 * rag), 0.12)
    alpha[:2, :] = 0
    alpha[:, :1] = 0
    alpha[:, w - 1:] = 0
    # baked puff shading: lighter upper rims, darker undersides and creases
    upper = np.clip(hf - np.roll(hf, -1, axis=0), -1, 1)
    cav = cavity(hf, 1.2, wrap=tl.DECAL)
    t = np.clip(0.15 + 0.7 * up + 0.12 * rag, 0.0, 1.0)
    img = ramp(t, [(0.0, (48, 44, 41)), (0.5, (78, 73, 68)), (1.0, (112, 107, 101))])
    img = tl.shade(img, 1.0 - 0.6 * upper - 0.08 * np.clip(cav, -1.5, 2.0))
    return grain(img, s, 'smoke'), alpha


def paint_litter(w, h, s):
    X, Y = tl.coords(w, h)
    r = tl.rng(s, 'litterpieces')
    rgbimg = np.zeros((h, w, 3), F) + C(90, 85, 80)
    alpha = np.zeros((h, w), F)
    cols = [(170, 165, 150), (190, 186, 175), (125, 95, 60), (150, 152, 158), (35, 40, 36), (160, 60, 45)]
    for i in range(26):
        cx = r.uniform(3, w - 3) if i % 3 else r.uniform(2, 16)
        cy = r.uniform(3, h - 3)
        hw, hh = r.uniform(0.8, 2.6), r.uniform(0.6, 1.6)
        ang = r.uniform(0, math.pi)
        ca, sa = math.cos(ang), math.sin(ang)
        lx = (X - cx) * ca + (Y - cy) * sa
        ly = -(X - cx) * sa + (Y - cy) * ca
        m = tl.fill(tl.sd_box(lx, ly, 0.0, 0.0, hw, hh, 0.3))
        col = C(*cols[int(r.integers(0, len(cols)))]) * F(r.uniform(0.85, 1.1))
        shade_ = 0.85 + 0.25 * np.clip(-ly / max(hh, 0.5), -1, 1)
        rgbimg = tl.mix(rgbimg, col * shade_[..., None], cut(m))
        alpha = np.maximum(alpha, cut(m))
    ash = cut(frac(w, h, 6, 2, s, 'ash') * (1.0 - tl.smoothstep(6.0, 22.0, X)) - 0.15, 0.4)
    ashc = ramp(0.5 + 0.5 * tl.fbm(w, h, 12, 4, s, 'ashc'), [(0.0, (55, 52, 50)), (1.0, (110, 106, 100))])
    rgbimg = np.where((ash > alpha)[..., None], ashc, rgbimg)
    alpha = np.maximum(alpha, ash)
    alpha = border_clear(alpha, 1)
    return grain(rgbimg, s, 'litter'), alpha


# ---------------------------------------------------------------------------------------------------------
# env_fountain_normal (opaque atlas): drab precast concrete

def concrete(w, h, s, salt, base, cx=4, cy=1, spread=0.13):
    n = tl.fbm(w, h, cx, cy, s, salt + 'c', octaves=5, gain=0.55)
    img = tl.shade(tl.solid(w, h, C(*base)), 1.0 + F(spread) * n)
    agg = tl.speckle(w, h, s, 0.08, radius=(0.4, 0.7), strength=(0.3, 0.8), salt=salt + 'agg', wrap=(True, False))
    agg2 = tl.speckle(w, h, s, 0.05, radius=(0.4, 0.6), strength=(0.3, 0.7), salt=salt + 'agg2', wrap=(True, False))
    return tl.shade(img, 1.0 - 0.16 * agg + 0.12 * agg2)


def paint_fn_wall_out(w, h, s):
    X, Y = tl.coords(w, h)
    img = concrete(w, h, s, 'wo', (128, 125, 117), 4, 1)
    for jx in (0, 32):
        img[:, jx] *= 0.62
        img[:, (jx + 1) % w] = img[:, (jx + 1) % w] * 1.12
    st = tl.streaks(w, h, s, 14, length=(3, 9), width=(0.5, 1.1), strength=(0.4, 0.9), salt='wos',
                    sources=[(float(x), 0.5) for x in tl.rng(s, 'wosx').uniform(0, w, 14)], wrap=(True, False))
    img = tl.shade(img, 1.0 - 0.28 * st)
    chips = cut(frac(w, h, 16, 2, s, 'chip') - 0.72, 0.0) * (Y < 2.0)
    img = tl.mix(img, C(158, 154, 146), chips * 0.8)
    img[0] = img[0] * 1.1
    damp = tl.smoothstep(h - 3.0, h - 0.5, Y)
    img = tl.mix(img, tl.shade(img, 0.62) * (C(80, 88, 62) / C(128, 125, 117)), damp)
    return grain(img, s, 'wo')


def paint_fn_rim_top(w, h, s):
    X, Y = tl.coords(w, h)
    img = concrete(w, h, s, 'rt', (146, 143, 135), 8, 1, 0.1)
    cr = tl.cracks(w, h, s, 2, steps=(4, 7), step=(2.0, 3.0), width=0.8, salt='rtc', wrap=(True, False))
    img = tl.shade(img, 1.0 - 0.3 * cr)
    img[0] *= 0.8
    img[h - 1] *= 0.68
    return grain(img, s, 'rt')


def paint_fn_wall_in(w, h, s):
    X, Y = tl.coords(w, h)
    img = concrete(w, h, s, 'wi', (88, 89, 85), 4, 1, 0.12)
    img[0] *= 0.62
    img[1] *= 0.85
    img[3] = tl.mix(img[3], C(150, 152, 145), 0.55)
    alg = ramp(0.5 + 0.5 * tl.fbm(w, h, 8, 1, s, 'alg'), [(0.0, (48, 58, 42)), (1.0, (72, 80, 56))])
    img[4:] = alg[4:]
    return grain(img, s, 'wi')


def water_disc(w, h, s, salt, base, sheen, r_in, dark_rim_px, rim_amt):
    X, Y = tl.coords(w, h)
    cx, cy = w / 2.0, h / 2.0
    d = np.hypot(X - cx, Y - cy)
    n = tl.fbm(w, h, 3, 3, s, salt + 'sheen', octaves=4, gain=0.55)
    img = tl.mix(tl.solid(w, h, C(*base)), C(*sheen), tl.smoothstep(0.15, 0.6, n) * 0.55)
    img = tl.shade(img, 1.0 + 0.05 * tl.fbm(w, h, 6, 6, s, salt + 'fine', octaves=3))
    rim = tl.smoothstep(r_in - dark_rim_px, r_in, d)
    img = tl.shade(img, 1.0 - F(rim_amt) * rim)
    return img, d


def paint_fn_water(w, h, s):
    img, d = water_disc(w, h, s, 'fw', (78, 96, 108), (112, 130, 140), 21.0, 4.0, 0.32)
    rip = (0.5 + 0.5 * np.cos(d * 2.1)) * tl.smoothstep(3.5, 4.5, d) * (1.0 - tl.smoothstep(7.5, 10.0, d))
    img = tl.shade(img, 1.0 + 0.13 * rip)
    img = tl.shade(img, 1.0 - 0.18 * (1.0 - tl.smoothstep(2.3, 4.0, d)))
    lv = tl.speckle(w, h, s, 0.03, radius=(0.5, 0.9), salt='leaves', area=(6, 2, 36, 9), wrap=tl.DECAL)
    lv *= tl.smoothstep(14.0, 17.0, d)
    img = tl.mix(img, C(105, 78, 42), cut(lv, 0.4))
    return grain(img, s, 'fw', lum=0.025)


def paint_fn_column(w, h, s):
    X, Y = tl.coords(w, h)
    img = concrete(w, h, s, 'co', (136, 133, 125), 2, 2, 0.1)
    st = tl.streaks(w, h, s, 7, length=(8, 18), width=(0.5, 1.0), strength=(0.4, 0.8), salt='cos',
                    sources=[(float(x), 0.5) for x in tl.rng(s, 'cosx').uniform(0, w, 7)], wrap=(True, False))
    img = tl.shade(img, 1.0 - 0.25 * st)
    img[0] *= 0.7  # under the cap
    img = tl.shade(img, 1.0 - 0.32 * tl.smoothstep(h - 6.0, h - 1.0, Y))
    img[h - 1] = tl.mix(img[h - 1], C(60, 72, 50), 0.6)
    return grain(img, s, 'co')


def paint_fn_cap(w, h, s):
    img = concrete(w, h, s, 'cp', (138, 135, 127), 2, 1, 0.08)
    img[0] = img[0] * 1.18  # flare edge catches the eye
    img[3] *= 0.86
    img[4] *= 0.7  # where the flare meets the shaft
    img[5:] = tl.shade(img[5:], 0.72)  # wet top
    img[8] *= 0.6
    img[9] = tl.mix(img[9], C(120, 70, 40), 0.75)
    return grain(img, s, 'cp')


# ---------------------------------------------------------------------------------------------------------
# env_fountain_rich (opaque atlas): pink/white marble, gold, porphyry

def marble(w, h, s, salt, base, vein, freq=0.22, slope=0.35, amount=0.55, cx=4, cy=1):
    X, Y = tl.coords(w, h)
    warp = tl.fbm(w, h, cx, max(cy, 1), s, salt + 'mw', octaves=4, gain=0.6)
    k = 2 * math.pi * max(1, round(freq * w / (2 * math.pi))) / w  # whole cycles: periodic along x
    v = np.sin(X * F(k) + Y * F(slope) + 5.0 * warp)
    veins = 1.0 - tl.smoothstep(0.0, 0.14, np.abs(v))
    n = tl.fbm(w, h, cx * 2, max(cy, 1) * 2, s, salt + 'mn', octaves=3)
    img = tl.shade(tl.solid(w, h, C(*base)), 1.0 + 0.07 * n)
    return tl.mix(img, C(*vein), veins * F(amount))


def gold_rows(w, h, s, salt, profile):
    """A gold molding: profile = brightness per row (gold_ramp input) plus a fine hammered variation."""
    X, Y = tl.coords(w, h)
    t = np.asarray(profile, F)[Y.astype(int)]
    t = t + 0.06 * tl.fbm(w, h, max(1, w // 8), 1, s, salt + "g", octaves=2)
    return gold_ramp(t)


def paint_fr_wall(w, h, s):
    X, Y = tl.coords(w, h)
    img = marble(w, h, s, 'rw', (222, 172, 167), (245, 225, 222), cx=4)
    xm = X % 32
    inside = (xm >= 5) & (xm < 27) & (Y >= 6) & (Y < 16)
    frame = ((xm >= 4) & (xm < 28) & (Y >= 5) & (Y < 17)) & ~inside
    field = marble(w, h, s, 'rwp', (192, 120, 120), (220, 160, 158), freq=0.4, amount=0.4, cx=4)
    img = np.where(inside[..., None], field, img)
    img = np.where((inside & (Y < 7))[..., None], img * 0.72, img)
    img = np.where((inside & (xm < 6))[..., None], img * 0.86, img)
    gframe = gold_rows(w, h, s, 'rwf', [0.75] * h)
    img = np.where(frame[..., None], gframe * np.where(Y[..., None] < 6, 1.08, 0.92), img)
    egg = 0.5 + 0.5 * np.cos((X % 6 - 3) * F(math.pi / 3))  # egg-and-dart crown, 6 px pitch (128 = 21.3: see note)
    egg = 0.5 + 0.5 * np.cos((X % 8 - 4) * F(math.pi / 4))
    prof = np.array([0.95, 0.62, 0.62, 0.15] + [0.0] * (h - 4), F)
    crown = gold_ramp(prof[Y.astype(int)] + 0.25 * egg * ((Y >= 1) & (Y < 3)))
    img = np.where((Y < 4)[..., None], crown, img)
    img[4] *= 0.8  # shadow under the molding
    img[18:] = tl.mix(tl.shade(img[18:], 0.78), C(160, 100, 100), 0.4)
    return grain(img, s, 'rw', lum=0.025)


def paint_fr_rim_top(w, h, s):
    X, Y = tl.coords(w, h)
    img = marble(w, h, s, 'rr', (236, 229, 221), (200, 180, 182), freq=0.18, amount=0.5, cx=4)
    g = gold_rows(w, h, s, 'rrg', [0.6, 0.97, 0.66, 0, 0, 0])
    img = np.where((Y < 3)[..., None], g, img)
    img[3] *= 0.9
    img[h - 1] *= 0.6
    return grain(img, s, 'rr', lum=0.02)


def paint_fr_inner_wall(w, h, s):
    img = marble(w, h, s, 'ri', (152, 106, 106), (180, 140, 140), amount=0.35, cx=4)
    img[0] *= 0.7
    img[3] = tl.mix(img[3], C(205, 200, 190), 0.5)
    img[h - 1] = tl.mix(img[h - 1], C(60, 120, 135), 0.55)
    return grain(img, s, 'ri', lum=0.025)


def paint_fr_step(w, h, s):
    X, Y = tl.coords(w, h)
    img = marble(w, h, s, 'rs', (226, 221, 212), (185, 180, 178), freq=0.3, amount=0.4, cx=4)
    img[:, (X[0] % 32 < 1)] *= 0.7
    img[0] = img[0] * 1.08 + 0.02
    img[h - 2:] *= 0.72
    return grain(img, s, 'rs', lum=0.025)


def paint_fr_step_top(w, h, s):
    X, Y = tl.coords(w, h)
    img = marble(w, h, s, 'rst', (230, 225, 215), (190, 185, 182), freq=0.25, amount=0.35, cx=4)
    img[:, (X[0] % 32 < 1)] *= 0.72
    img[0] = img[0] * 1.05
    img[h - 1] *= 0.62
    img[h - 2] *= 0.85
    return grain(img, s, 'rst', lum=0.025)


def paint_fr_bowl_under(w, h, s):
    X, Y = tl.coords(w, h)
    img = marble(w, h, s, 'rb', (218, 165, 160), (240, 210, 206), freq=0.3, amount=0.4, cx=4)
    lobe = np.cos((X % 16 - 8) * F(math.pi / 16))  # 1 mid-lobe, 0 at the ribs
    img = tl.shade(img, 0.72 + 0.4 * lobe)
    rib = (X % 16) < 1
    g = gold_rows(w, h, s, 'rbg', [0.95, 0.55] + [0.7] * (h - 2))
    img = np.where(rib[..., None], g * 0.92, img)
    img = np.where((Y < 2)[..., None], g, img)
    img = tl.shade(img, 1.0 - 0.45 * tl.smoothstep(h - 6.0, h, Y))
    return grain(img, s, 'rb', lum=0.025)


def paint_fr_lip(w, h, s):
    X, Y = tl.coords(w, h)
    bead = 0.5 + 0.5 * np.cos((X % 4 - 2) * F(math.pi / 2))
    prof = np.array([0.62, 0.98, 0.6, 0.6, 0.6, 0.12], F)[Y.astype(int)]
    t = prof + 0.3 * (bead - 0.5) * ((Y >= 2) & (Y < 5))
    t = t + 0.05 * tl.fbm(w, h, 16, 1, s, 'lipg', octaves=2)
    return grain(gold_ramp(t), s, 'lip', lum=0.02)


def paint_fr_water(w, h, s):
    img, d = water_disc(w, h, s, 'rwt', (64, 128, 160), (112, 172, 196), 30.0, 3.0, 0.35)
    img = tl.shade(img, 1.0 - 0.25 * (1.0 - tl.smoothstep(16.0, 18.0, d)))
    rip = 0.5 + 0.5 * np.cos(d * 1.6)
    img = tl.shade(img, 1.0 + 0.07 * rip * tl.smoothstep(20.0, 22.0, d))
    img = tl.shade(img, 1.0 + 0.07 * rip * (1.0 - tl.smoothstep(14.0, 16.0, d)))
    foam = cut(np.exp(-((d - 18.6) / 1.3) ** 2) * (0.6 + 0.8 * frac(w, h, 10, 10, s, 'foam')), 0.65)
    img = tl.mix(img, C(205, 235, 238), foam)
    coins = tl.speckle(w, h, s, 0.025, radius=(0.5, 0.7), salt='coins', wrap=tl.DECAL)
    coins *= tl.smoothstep(21.0, 22.0, d) * (1.0 - tl.smoothstep(26.0, 27.0, d))
    img = tl.mix(img, C(240, 200, 70), cut(coins, 0.4))
    return grain(img, s, 'rwt', lum=0.02)


def paint_fr_water_tier(w, h, s):
    img, d = water_disc(w, h, s, 'rwtt', (64, 128, 160), (112, 172, 196), 14.0, 2.0, 0.35)
    rip = 0.5 + 0.5 * np.cos(d * 1.9)
    img = tl.shade(img, 1.0 + 0.1 * rip)
    boil = cut((1.0 - tl.smoothstep(2.5, 5.0, d)) * (0.6 + 0.8 * frac(w, h, 7, 7, s, 'boil')), 0.6)
    img = tl.mix(img, C(200, 230, 235), np.maximum(boil, 1.0 - tl.smoothstep(1.5, 2.5, d)))
    return grain(img, s, 'rwtt', lum=0.02)


def paint_fr_stem(w, h, s):
    X, Y = tl.coords(w, h)
    img = marble(w, h, s, 'rsm', (233, 227, 219), (205, 180, 182), freq=0.3, amount=0.35, cx=2, cy=1)
    groove = (X % 5) >= 3
    img = np.where(groove[..., None], img * 0.74, img)
    img = np.where(((X % 5) < 1)[..., None], img * 1.05, img)
    g = gold_rows(w, h, s, 'rsg', [0.95, 0.65, 0.2] + [0.6] * (h - 6) + [0.95, 0.65, 0.15])
    collar = (Y < 3) | (Y >= h - 3)
    img = np.where(collar[..., None], g, img)
    img[3] *= 0.78
    return grain(img, s, 'rsm', lum=0.02)


def star_mask(X, Y, cx, cy, ro, ri, rot=-math.pi / 2):
    pts = []
    for i in range(10):
        a = rot + i * math.pi / 5
        r = ro if i % 2 == 0 else ri
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    inside = np.zeros(X.shape, bool)
    for i in range(10):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % 10]
        cond = ((y0 > Y) != (y1 > Y)) & (X < (x1 - x0) * (Y - y0) / (y1 - y0 + 1e-9) + x0)
        inside ^= cond
    return inside


def paint_fr_pedestal(w, h, s):
    X, Y = tl.coords(w, h)
    n = tl.fbm(w, h, 3, 4, s, 'por', octaves=4)
    img = ramp(0.5 + 0.5 * n, [(0.0, (105, 22, 28)), (1.0, (150, 38, 42))])
    fl = tl.speckle(w, h, s, 0.1, radius=(0.4, 0.7), salt='porf', wrap=tl.DECAL)
    fl2 = tl.speckle(w, h, s, 0.04, radius=(0.4, 0.6), salt='porf2', wrap=tl.DECAL)
    img = tl.shade(img, 1.0 - 0.4 * fl + 0.35 * fl2)
    star = star_mask(X, Y, 12.0, 15.5, 6.5, 2.7)
    outline = (tl.blur(star.astype(F), 0.7, wrap=tl.DECAL) > 0.12) & ~star
    gs = gold_ramp(0.72 + 0.25 * (1.0 - (Y - 9) / 13.0) + 0.04 * n)
    img = np.where(outline[..., None], img * 0.45, img)
    img = np.where(star[..., None], gs, img)
    g = gold_rows(w, h, s, 'pedg', [0.95, 0.7, 0.2] + [0.6] * (h - 6) + [0.95, 0.65, 0.15])
    img = np.where(((Y < 3) | (Y >= h - 3))[..., None], g, img)
    img[3] *= 0.7
    return grain(img, s, 'ped', lum=0.025)


def gilt(w, h, s, salt):
    hi = tl.fbm(w, h, 2, 3, s, salt + 'hi', octaves=3, gain=0.55)
    ham = tl.value_noise(w, h, w // 2, h // 2, s, salt + 'ham')
    return gold_ramp(0.62 + 0.42 * hi + 0.08 * (ham - 0.5))


def paint_fr_gold(w, h, s):
    return grain(gilt(w, h, s, 'gold'), s, 'gold', lum=0.02)


def paint_fr_face(w, h, s):
    X, Y = tl.coords(w, h)
    img = gilt(w, h, s, 'face')
    img = tl.shade(img, 0.9 + 0.12 * np.cos((X - w / 2) / (w / 2) * F(math.pi / 2)))  # cheeks turn away
    img[0:3] = tl.shade(img[0:3], 0.42)  # under the visor
    bronze = C(78, 50, 20)
    for ex in (6, 13):
        img[5, ex:ex + 2] = bronze
    img[6:9, 9:11] = img[6:9, 9:11] * 1.18  # nose ridge
    must = (np.abs(X - 10.0) < 5.2 - 0.6 * (Y - 9.0)) & (Y >= 9) & (Y < 12)
    must |= ((X < 6.5) & (X > 4.0) & (Y >= 11) & (Y < 13)) | ((X > 13.5) & (X < 16.0) & (Y >= 11) & (Y < 13))
    img = np.where(must[..., None], bronze, img)
    img[12, 8:12] = img[12, 8:12] * 0.7  # mouth line under the moustache
    img[14:] = tl.shade(img[14:], 0.6)
    return img


def paint_fr_fish(w, h, s):
    X, Y = tl.coords(w, h)
    img = gilt(w, h, s, 'fish')
    row = np.floor(Y / 3.0)
    lx = (X + 2.0 * (row % 2)) % 4 - 2.0
    ly = Y % 3 - 0.5
    arc = np.abs(np.hypot(lx, ly) - 1.9) < 0.55
    img = np.where(arc[..., None], img * 0.84, img)
    img = tl.shade(img, 0.8 + 0.3 * (1.0 - Y / h))  # darker belly side
    eye = np.hypot(X - 3.5, Y - 3.5) < 1.3
    img = np.where(eye[..., None], C(40, 25, 10), img)
    img[3, 3] = C(255, 245, 190)
    img[:, :2] = C(50, 30, 12)
    return grain(img, s, 'fish', lum=0.02)


# ---------------------------------------------------------------------------------------------------------
# plaza_features_water (RGBA cut-outs, shared by both fountains)

def paint_frw_sheet(w, h, s):
    X, Y = tl.coords(w, h)
    r = tl.rng(s, 'streams')
    alpha = np.zeros((h, w), F)
    white = np.zeros((h, w), F)
    for i in range(5):  # sparse streams: the marble behind must show through
        x0 = (i + 0.5) * w / 5 + r.uniform(-1.2, 1.2)
        wd = r.uniform(1.6, 2.6)
        ph, fr = r.uniform(0, 2 * math.pi), r.uniform(0.08, 0.16)
        xc = x0 + 0.9 * np.sin(Y * F(fr) + F(ph)) * (Y / h)
        dd = np.abs(tl.wrap_delta(X - xc, w))
        alpha = np.maximum(alpha, (dd < wd * 0.5 * (1.0 + 0.5 * Y / h)).astype(F))
        white = np.maximum(white, (dd < 0.6).astype(F))
    gaps = cut(frac(w, h, 4, 8, s, 'sgap') - 0.88, 0.0) * (Y > 8)
    alpha = alpha * (1.0 - gaps)
    lip = 3.0 + 2.5 * (0.5 + 0.5 * np.cos(X * F(2 * math.pi * 5 / w)))  # overflow scallops at the lip
    alpha = np.maximum(alpha, (Y < lip).astype(F))
    foam = cut(tl.smoothstep(h - 8.0, h - 2.0, Y) * (0.45 + frac(w, h, 8, 8, s, 'sfoam')) - 0.6, 0.3)
    alpha = np.maximum(alpha, foam)
    drops = tl.speckle(w, h, s, 0.04, radius=(0.5, 0.8), salt='sdrop', wrap=(True, False), area=(0, h - 16, w, h))
    alpha = np.maximum(alpha, cut(drops, 0.4))
    alpha[h - 1] = 0.0
    t = np.clip(0.6 + 0.4 * white + 0.25 * foam + 0.08 * tl.fbm(w, h, 4, 8, s, 'sn', octaves=2), 0, 1)
    img = ramp(t, [(0.0, (90, 160, 185)), (0.5, (150, 206, 222)), (0.8, (200, 232, 240)), (1.0, (240, 250, 252))])
    return grain(img, s, 'sheet', lum=0.02), alpha


def paint_frw_spray(w, h, s):
    X, Y = tl.coords(w, h)
    r = tl.rng(s, 'jets')
    alpha = np.zeros((h, w), F)
    base_y = h - 4.0
    for i in range(8):
        a = math.radians(-60 + 120 * i / 7 + r.uniform(-6, 6))
        v = r.uniform(5.5, 6.8)
        vx, vy = v * math.sin(a) * 1.4, v * math.cos(a)
        g = 1.25
        x0, y0 = w / 2 + r.uniform(-3, 3), base_y
        pts = [(x0 + vx * k * 0.55, y0 - vy * k * 0.55 + 0.5 * g * (k * 0.55) ** 2) for k in range(14)]
        for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
            if min(ay, by) > base_y + 1:
                break
            dseg, _ = tl.sd_segment(X, Y, ax, ay, bx, by)
            alpha = np.maximum(alpha, (dseg < 0.75).astype(F))
        tipx, tipy = pts[5]
        alpha = np.maximum(alpha, cut(tl.speckle(w, h, s + i, 0.05, radius=(0.5, 0.8), salt=f'tip{i}',
                                                 wrap=tl.DECAL, area=(tipx - 3, tipy - 3, tipx + 3, tipy + 3)), 0.4))
    band = cut(tl.smoothstep(h - 6.0, h - 3.5, Y + 1.5 * tl.fbm(w, h, 6, 2, s, 'sband')) *
               (1.0 - tl.smoothstep(9.0, 13.0, np.abs(X - w / 2))), 0.5)
    alpha = border_clear(np.maximum(alpha, band), 1)
    t = np.clip(0.55 + 0.4 * (1.0 - Y / h) + 0.15 * tl.fbm(w, h, 4, 4, s, 'spn', octaves=2), 0, 1)
    img = ramp(t, [(0.0, (110, 180, 200)), (0.6, (190, 228, 236)), (1.0, (240, 248, 250))])
    return grain(img, s, 'spray', lum=0.02), alpha


def paint_frw_arc(w, h, s):
    X, Y = tl.coords(w, h)
    p0, p1, p2 = (0.0, 6.5), (13.0, -4.0), (26.0, 31.5)
    alpha = np.zeros((h, w), F)
    core = np.zeros((h, w), F)
    prev = p0
    for k in range(1, 25):
        t = k / 24
        q = ((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])
        dseg, _ = tl.sd_segment(X, Y, prev[0], prev[1], q[0], q[1])
        alpha = np.maximum(alpha, (dseg < 1.6 - 0.6 * t).astype(F))
        core = np.maximum(core, (dseg < 0.6).astype(F))
        prev = q
    drops = tl.speckle(w, h, s, 0.06, radius=(0.5, 0.8), salt='adrop', wrap=tl.DECAL, area=(18, 20, 31, 31))
    alpha = np.maximum(alpha, cut(drops, 0.4))
    alpha[:, w - 1:] = 0
    img = ramp(np.clip(0.45 + 0.5 * core, 0, 1), [(0.0, (90, 165, 190)), (0.5, (160, 212, 226)),
                                                 (1.0, (240, 248, 250))])
    return img, alpha


# ---------------------------------------------------------------------------------------------------------
# env_burned_decal (RGBA)

def paint_burned_decal(w, h, s):
    X, Y = tl.coords(w, h)
    cx, cy = 33.0, 31.0
    dx, dy = X - cx, Y - cy
    d = np.hypot(dx, dy)
    ang = np.arctan2(dy, dx)
    lobes = np.zeros_like(d)
    r = tl.rng(s, 'lobes')
    for k, amp in ((3, 0.12), (5, 0.08), (11, 0.07), (17, 0.06)):
        lobes += F(amp) * np.sin(ang * k + F(r.uniform(0, 2 * math.pi)))
    fing = np.maximum(0.0, np.sin(ang * 13 + F(r.uniform(0, 6.3)))) ** 6 * 0.22
    R = 22.0 * (1.0 + lobes + fing)
    fr = frac(w, h, 8, 8, s, 'bfrac')
    rn = d / R + 0.32 * (fr - 0.5)
    alpha = cut(1.0 - rn, 0.0)
    holes = cut(frac(w, h, 10, 10, s, 'bholes') - 0.78, 0.0) * tl.smoothstep(0.55, 0.85, d / R)
    alpha = alpha * (1.0 - holes)
    spots = tl.blobs(w, h, s, 14, radius=(0.8, 2.0), rough=0.4, salt='bspots', wrap=tl.DECAL, area=(4, 4, 60, 60))
    spots *= tl.smoothstep(0.95, 1.1, d / R)
    alpha = border_clear(np.maximum(alpha, cut(spots, 0.5)), 2)
    rad_streak = 0.5 + 0.5 * np.sin(ang * 23 + 3.0 * tl.fbm(w, h, 4, 4, s, 'bst'))
    t = np.clip(d / R + 0.15 * (fr - 0.5), 0, 1.2)
    img = ramp(t, [(0.0, (14, 12, 11)), (0.35, (22, 19, 17)), (0.6, (46, 40, 34)), (0.85, (62, 57, 52)),
                   (1.0, (78, 72, 66))])
    img = tl.shade(img, 1.0 + 0.18 * (rad_streak - 0.5) * tl.smoothstep(0.4, 0.8, t))
    tar = cut(frac(w, h, 6, 6, s, 'btar') - 0.7, 0.0) * (t < 0.5)
    img = tl.mix(img, C(8, 7, 7), tar * 0.8)
    ash = tl.speckle(w, h, s, 0.05, radius=(0.5, 0.9), strength=(0.6, 1.0), salt='bash', wrap=tl.DECAL) * (t < 0.8)
    img = tl.mix(img, C(150, 146, 138), cut(ash, 0.5) * 0.9)
    ash2 = tl.speckle(w, h, s, 0.02, radius=(0.4, 0.6), salt='bash2', wrap=tl.DECAL)
    img = tl.mix(img, C(196, 192, 185), cut(ash2, 0.4))
    scraps = tl.blobs(w, h, s, 5, radius=(1.0, 1.8), rough=0.5, salt='bscrap', wrap=tl.DECAL, area=(18, 16, 48, 46))
    img = tl.mix(img, C(70, 55, 38), cut(scraps, 0.5))
    return grain(img, s, 'burn', lum=0.03), alpha


# ---------------------------------------------------------------------------------------------------------
# Assembly

PAINTERS = {
    'env_trashcan_burning': {'drum_side': paint_drum_side, 'lip': paint_lip, 'inner_wall': paint_inner_wall,
                             'coals': paint_coals, 'trash': paint_trash},
    'env_trashcan_burning_fire': {'litter': paint_litter, 'flame_a': paint_flame_a, 'flame_b': paint_flame_b,
                                  'smoke': paint_smoke},
    'env_fountain_normal': {'wall_out': paint_fn_wall_out, 'rim_top': paint_fn_rim_top, 'wall_in': paint_fn_wall_in,
                            'water': paint_fn_water, 'column': paint_fn_column, 'cap': paint_fn_cap},
    'env_fountain_rich': {'wall': paint_fr_wall, 'rim_top': paint_fr_rim_top, 'inner_wall': paint_fr_inner_wall,
                          'step': paint_fr_step, 'step_top': paint_fr_step_top, 'bowl_under': paint_fr_bowl_under,
                          'lip': paint_fr_lip, 'water': paint_fr_water, 'water_tier': paint_fr_water_tier,
                          'stem': paint_fr_stem, 'pedestal': paint_fr_pedestal, 'gold': paint_fr_gold,
                          'face': paint_fr_face, 'fish': paint_fr_fish},
    'plaza_features_water': {'sheet': paint_frw_sheet, 'spray': paint_frw_spray, 'arc': paint_frw_arc},
    'env_burned_decal': {None: paint_burned_decal},
}


def region_seed(tex, reg):
    import zlib
    return (SEED + zlib.crc32(f'{tex}/{reg}'.encode('utf-8'))) & 0x7FFFFFFF


def build(name, spec):
    W, H = spec['size']
    regs = spec.get('regions') or {None: {'rect': [0, 0, W, H]}}
    if set(regs) != set(PAINTERS[name]):
        raise SystemExit(f'{name}: contract regions {sorted(map(str, regs))} != painters '
                         f'{sorted(map(str, PAINTERS[name]))}')
    rgb = np.zeros((H, W, 3), F)
    alpha = np.ones((H, W), F)
    cover = np.zeros((H, W), np.int32)
    for reg, r in regs.items():
        x, y, w, h = r['rect']
        if x < 0 or y < 0 or x + w > W or y + h > H:
            raise SystemExit(f'{name}/{reg}: rect {r["rect"]} leaves the {W}x{H} sheet')
        cover[y:y + h, x:x + w] += 1
        out = PAINTERS[name][reg](w, h, region_seed(name, reg))
        img, a = out if isinstance(out, tuple) else (out, None)
        if a is not None:
            alpha[y:y + h, x:x + w] = a
        if img.shape != (h, w, 3):
            raise SystemExit(f'{name}/{reg}: painter returned {img.shape}, want {(h, w, 3)}')
        rgb[y:y + h, x:x + w] = np.clip(img, 0.0, 1.0)
    if cover.max() > 1:
        raise SystemExit(f'{name}: regions overlap')
    if cover.min() < 1:
        print(f'  note: {name} has {(cover == 0).sum()} px outside every region')
    if spec.get('alpha'):
        alpha = cut(alpha)
        rgb = bleed(rgb, alpha)
    return rgb, alpha, regs


def save(path, rgb, alpha, with_alpha):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    u8 = tl.to_u8(rgb)
    if with_alpha:
        a = (alpha > 0.5).astype(np.uint8) * 255
        Image.fromarray(np.dstack([u8, a]), 'RGBA').save(path)
    else:
        Image.fromarray(u8, 'RGB').save(path)


def preview(out_dir, results):
    """Contact sheet: each texture blown up (alpha over a checker), its approximate in-game colour (flat warm
    ambient, x0.82 0.75 0.55), its regions outlined, and every U-strip tiled three times."""
    os.makedirs(out_dir, exist_ok=True)
    items = []
    for name, (rgb, alpha, regs, spec) in results.items():
        W, H = spec['size']
        k = 512 // max(W, H)
        if spec.get('alpha'):
            X, Y = tl.coords(W, H)
            chk = np.where(((X // 4 + Y // 4) % 2 == 0)[..., None], 0.75, 0.45).astype(F)
            comp = tl.mix(np.broadcast_to(chk, rgb.shape).astype(F), rgb, alpha)
        else:
            comp = rgb
        im = Image.fromarray(tl.to_u8(comp), 'RGB')
        items.append((name, im.resize((W * k, H * k), Image.NEAREST)))
        game = np.asarray(comp, np.float64) * np.array([0.82, 0.75, 0.55])
        items.append((name + ' (flat ambient approx)',
                      Image.fromarray(tl.to_u8(game), 'RGB').resize((W * k, H * k), Image.NEAREST)))
        if len(regs) > 1:
            items.append((name + ' regions', tl.outline_regions(comp, {n: tuple(r['rect']) for n, r in regs.items()},
                                                               scale=k)))
        for reg, r in regs.items():
            if reg is None or r.get('tiles') != 'u':
                continue
            x, y, w, h = r['rect']
            t = tl.tile(comp[y:y + h, x:x + w], 3, 1)
            kk = max(2, 768 // (w * 3))
            items.append((f'{name}/{reg} x3', Image.fromarray(tl.to_u8(t)).resize((w * 3 * kk, h * kk), Image.NEAREST)))
            ss = tl.seam_stats(comp[y:y + h, x:x + w], 'x')
            if not ss['pass']:
                print(f'  seam warning {name}/{reg}: wrap {ss["wrap"]:.1f} > p95 {ss["p95"]:.1f}')
    sheet = tl.contact_sheet(items, max_width=2200)
    path = os.path.join(out_dir, 'plaza_features_textures.png')
    sheet.save(path)
    print('preview', path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*')
    ap.add_argument('--preview')
    args = ap.parse_args()
    with open(CONTRACT, encoding='utf-8') as fh:
        contract = json.load(fh)
    results = {}
    for name, spec in contract['textures'].items():
        if args.only and name not in args.only:
            continue
        rgb, alpha, regs = build(name, spec)
        save(os.path.join(ROOT, spec['file']), rgb, alpha, spec.get('alpha'))
        extra = f' RGBA, {100 * float((alpha > 0.5).mean()):.0f}% opaque' if spec.get('alpha') else ' RGB'
        print(f'wrote {spec["file"]} {spec["size"][0]}x{spec["size"][1]}{extra}')
        results[name] = (rgb, alpha, regs, spec)
    if args.preview:
        preview(os.path.abspath(args.preview), results)


if __name__ == '__main__':
    main()

