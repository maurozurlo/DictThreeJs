#!/usr/bin/env python3
"""Textures for the greenery family (rich palm, planter ladder, topiary bust), dict-three street props.

    python tools/texgen/greenery.py [--only <texture> ...] [--preview build/visual_gaps/greenery/tex]

Reads every size and rect from tools/texgen/greenery_layout.json and writes public/textures/map/<name>.png.
Tiny PS1 textures (32-64 px, NearestFilter in the game). The game lights the street with one ambient light
and ignores vertex colour, so occlusion is painted into the albedo: 'ramp' regions run light to dark in V
and the model script picks V from each vertex normal. Cut-outs are RGBA with hard alpha, nothing thinner
than 2 px. Every random source is seeded; a re-run writes identical bytes.
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
LAYOUT = os.path.join(ROOT, 'tools', 'texgen', 'greenery_layout.json')
SEED = 7341


def C(r, g, b):
    return tl.rgb(r, g, b)


def ramp_rows(h, top, bottom, gamma=1.0):
    """(h, 1) multiplier from `top` (row 0) to `bottom` (last row)."""
    t = (np.arange(h, dtype=F) + 0.5) / F(h)
    return (top + (bottom - top) * t ** F(gamma))[:, None]


def grain(img, seed, salt, lum=0.04, chroma=0.015):
    h, w = img.shape[:2]
    n = tl.white(w, h, seed, salt + '/l') - 0.5
    c = tl.rng(seed, salt, 'c').random((h, w, 3)).astype(F) - 0.5
    return np.clip(img * (1.0 + F(lum) * 2 * n[..., None]) + F(chroma) * c, 0, 1)


# ---------------------------------------------------------------------------------------------------------
# env_tree_rich_fronds

def paint_frond(w, h, seed, salt, shade):
    """One frond along U (base x = 0, tip x = w-1), rib between rows h/2-1 and h/2. Returns RGBA float."""
    X, Y = tl.coords(w, h)
    t = X / F(w)
    rib = F(h / 2)
    d = Y - rib  # <0 upper half, >=0 lower half
    ad = np.abs(d + 0.5) + 0.5 - 0.5  # symmetric distance around the fold line
    # half width profile: petiole stalk, swell, long taper to the tip
    narrow = 0.9 if shade else 1.0
    hw = np.where(t < 0.09, 1.6,
                  np.where(t < 0.36, 3.0 + 11.0 * np.sin(0.5 * math.pi * (t - 0.09) / 0.27),
                           2.0 + 12.0 * (1.0 - (t - 0.36) / 0.64) ** 0.85)) * F(narrow)
    hw = np.minimum(hw, F(h / 2 - 1))
    r = tl.rng(seed, salt, 'frond')
    k = 1.25 + 0.1 * r.random()           # leaflet slant: x advances k px per px away from the rib
    period = 4.0
    s = X - F(k) * ad
    jitter = tl.perlin(w, h, 8, 2, seed, salt + '/jit') * 0.8
    s = s + jitter
    phase = np.mod(s, F(period)) / F(period)  # 0..1 across one leaflet + gap
    leaf_id = np.floor(s / F(period)).astype(np.int64)
    # leaflet tips: each blade ends at its own length (serrated outline)
    lens = tl.rng(seed, salt, 'len').uniform(0.78, 1.05, 64)
    blade_len = lens[np.mod(leaf_id, 64)]
    inside = (ad <= hw * blade_len) & (X >= 0)
    outer = ad > hw * 0.38
    gap = (phase < 0.3) & outer
    stalk = (t < 0.09) & (ad <= 1.6)
    alpha = (inside & ~gap) | stalk
    alpha[int(rib) - 1:int(rib) + 1, :int(w * 0.97)] = True   # the rib is always solid
    # colour
    base = C(70, 98, 40) if not shade else C(42, 60, 27)
    tipc = C(118, 120, 46) if not shade else C(74, 70, 34)
    img = tl.solid(w, h, base)
    img = tl.mix(img, tipc, tl.smoothstep(0.55, 1.0, t) * 0.6)
    lv = tl.rng(seed, salt, 'lv').uniform(0.82, 1.15, 64)[np.mod(leaf_id, 64)]
    img = img * lv[..., None]
    # each blade lighter along its middle, darker by the gap and toward the rib
    mid = 1.0 - np.abs(phase - 0.62) * 0.5
    img = img * (0.88 + 0.2 * mid)[..., None]
    img = img * (0.8 + 0.2 * tl.smoothstep(0.0, 4.0, ad))[..., None]
    # dry tips on the shaded frond
    if shade:
        dry = (tl.rng(seed, salt, 'dry').random(64)[np.mod(leaf_id, 64)] > 0.75) & (ad > hw * 0.7)
        img = tl.mix(img, C(96, 74, 40), dry.astype(F) * 0.8)
    # rib: pale olive, 2 px
    ribm = (np.abs(d + 0.5) < 1.0).astype(F)
    img = tl.mix(img, C(128, 126, 70) if not shade else C(86, 82, 48), ribm * 0.85)
    # base occlusion at the crown: browner and darker
    occ = tl.smoothstep(0.0, 0.17, t)
    img = tl.mix(img, img * C(150, 110, 70) * 1.2, (1 - occ) * 0.7)
    img = img * (0.62 + 0.38 * occ)[..., None]
    img = grain(img, seed, salt, 0.05, 0.02)
    a = alpha.astype(F)
    return np.concatenate([np.clip(img, 0, 1), a[..., None]], axis=2)


def tex_fronds(spec):
    w, h = spec['size']
    out = np.zeros((h, w, 4), F)
    for name, shade in (('frond_lit', False), ('frond_shade', True)):
        x, y, rw, rh = spec['regions'][name]['rect']
        out[y:y + rh, x:x + rw] = paint_frond(rw, rh, SEED, name, shade)
    return out


# ---------------------------------------------------------------------------------------------------------
# env_tree_rich_trunk

def paint_trunk(w, h, seed):
    X, Y = tl.coords(w, h)
    fib = tl.fbm(w, h, 8, 3, seed, 'trunk/fib', octaves=3)            # streaky along V
    img = tl.solid(w, h, C(106, 72, 32)) * (1.0 + 0.18 * fib)[..., None]
    wob = tl.perlin(w, h, 4, 1, seed, 'trunk/wob') * 1.0
    yy = Y + wob
    ring_i = np.floor(yy / 4.0)
    ph = np.mod(yy, 4.0)
    # leaf-scar diamonds: every ring a row of V notches 8 px apart, offset 4 px every other ring
    off = np.where(np.mod(ring_i, 2) == 0, 0.0, 4.0)
    xn = np.mod(X + off, 8.0)
    notch = (np.abs(xn - 4.0) < (ph - 1.0) * 0.9) & (ph > 1.0)
    groove = ph < 1.0
    lip = (ph >= 1.0) & (ph < 2.0)
    img = np.where(groove[..., None], img * 0.52, img)
    img = np.where(lip[..., None], img * 1.22, img)
    img = np.where((notch & ~lip)[..., None], img * 0.86, img)
    img = tl.mix(img, C(120, 104, 80), tl.grime(w, h, seed, 4, 6, 0.25, salt='trunk/grey') * 0.35)
    img = img * ramp_rows(h, 1.0, 1.0)[..., None]
    top = tl.smoothstep(0.0, 9.0, Y)          # shadow under the crown
    foot = 1.0 - tl.smoothstep(h - 8.0, h, Y)  # dirt at the foot
    img = img * (0.6 + 0.4 * top)[..., None] * (0.75 + 0.25 * foot)[..., None]
    return grain(img, seed, 'trunk', 0.04, 0.012)


def paint_crown(w, h, seed):
    X, Y = tl.coords(w, h)
    img = tl.solid(w, h, C(66, 58, 32))
    fib = tl.fbm(w, h, 8, 2, seed, 'crown/fib', octaves=3)
    img = img * (1.0 + 0.25 * fib)[..., None]
    # overlapping sheath edges: diagonal bands
    band = np.mod(X * 0.5 + Y, 6.0)
    img = np.where((band < 1.0)[..., None], img * 0.6, img)
    img = tl.mix(img, C(84, 92, 40), tl.grime(w, h, seed, 4, 2, 0.3, salt='crown/g') * 0.5)
    img = img * ramp_rows(h, 1.05, 0.62)[..., None]
    return grain(img, seed, 'crown', 0.05, 0.015)


def tex_trunk(spec):
    w, h = spec['size']
    out = np.zeros((h, w, 3), F)
    x, y, rw, rh = spec['regions']['trunk']['rect']
    out[y:y + rh, x:x + rw] = paint_trunk(rw, rh, SEED)
    x, y, rw, rh = spec['regions']['crown']['rect']
    out[y:y + rh, x:x + rw] = paint_crown(rw, rh, SEED)
    return out


# ---------------------------------------------------------------------------------------------------------
# greenery_gold

GOLD_HI, GOLD, GOLD_LO = C(240, 205, 112), C(196, 146, 52), C(112, 76, 24)


def gilt_noise(w, h, seed, salt):
    f1, f2, cell = tl.voronoi(w, h, max(1, w // 4), max(1, h // 4), seed, salt + '/ham')
    dents = tl.cell_values(cell, (w // 4) * max(1, h // 4), seed, salt) - 0.5
    tarn = tl.grime(w, h, seed, 4, max(1, h // 8), 0.22, salt=salt + '/tarn')
    return dents, tarn


def paint_band(w, h, seed):
    X, Y = tl.coords(w, h)
    img = tl.mix(tl.solid(w, h, GOLD), GOLD_LO, tl.smoothstep(6.0, 13.0, Y))
    dents, tarn = gilt_noise(w, h, seed, 'band')
    img = img * (1.0 + 0.1 * dents)[..., None]
    row = np.floor(Y).astype(int)
    img = np.where((row <= 1)[..., None], GOLD_HI, img)
    img = np.where((row == 2)[..., None], GOLD_LO * 0.8, img)
    bead = tl.fill(tl.sd_circle(np.mod(X, 4.0), Y, 2.0, 4.5, 1.45), 0.6)
    beadrow = (row >= 3) & (row <= 5)
    img = np.where(beadrow[..., None], tl.mix(GOLD_LO * 0.85, GOLD_HI, bead), img)
    img = np.where((row == 13)[..., None], GOLD_LO * 0.7, img)
    img = np.where((row >= 14)[..., None], C(110, 75, 25), img)
    img = tl.tint(img, C(150, 120, 90), tarn * 0.4)
    return grain(img, seed, 'band', 0.03, 0.01)


def paint_railing(w, h, seed):
    """h = 24 rows; returns RGBA."""
    X, Y = tl.coords(w, h)
    row = np.floor(Y).astype(int)
    xm = np.mod(X, 8.0)
    top = row <= 2
    bottom = row >= 20
    baluster = (xm >= 3.0) & (xm < 5.0)
    knob = (xm >= 2.0) & (xm < 6.0) & (row >= 10) & (row <= 12)
    loz = (np.abs(np.mod(X + 4.0, 8.0) - 4.0) + np.abs(Y - 5.5) * 0.9) < 2.3   # diamond between balusters
    loz = loz & (row >= 3) & (row <= 8)
    a = top | bottom | baluster | knob | loz
    img = tl.solid(w, h, GOLD)
    # light top edges, dark bottom edges of each member
    img = np.where(((row == 0) | (row == 20) | (row == 10))[..., None], GOLD_HI, img)
    img = np.where(((row == 2) | (row == 23) | (row == 12))[..., None], GOLD_LO, img)
    img = np.where((baluster & (xm >= 4.0) & ~top & ~bottom & ~knob)[..., None], img * 0.72, img)
    img = np.where((loz & (Y > 5.5))[..., None], img * 0.78, img)
    dents, tarn = gilt_noise(w, h, seed, 'rail')
    img = tl.tint(img * (1.0 + 0.08 * dents)[..., None], C(150, 120, 90), tarn * 0.35)
    img = grain(img, seed, 'rail', 0.03, 0.01)
    return np.concatenate([np.clip(img, 0, 1), a.astype(F)[..., None]], axis=2)


def paint_gilt(w, h, seed):
    X, Y = tl.coords(w, h)
    t = (Y + 0.5) / F(h)
    img = tl.mix(tl.solid(w, h, C(246, 216, 122)), C(196, 146, 52), tl.smoothstep(0.0, 0.45, t))
    img = tl.mix(img, C(84, 56, 20), tl.smoothstep(0.45, 1.0, t))
    dents, tarn = gilt_noise(w, h, seed, 'gilt')
    img = img * (1.0 + 0.12 * dents)[..., None]
    img = tl.tint(img, C(160, 125, 95), tarn * 0.35)
    return grain(img, seed, 'gilt', 0.03, 0.01)


def tex_gold(spec):
    w, h = spec['size']
    out = np.ones((h, w, 4), F)
    r = spec['regions']
    x, y, rw, rh = r['band']['rect']
    out[y:y + rh, x:x + rw, :3] = paint_band(rw, rh, SEED)
    x, y, rw, rh = r['railing']['rect']
    out[y:y + rh, x:x + rw] = paint_railing(rw, rh, SEED)
    x, y, rw, rh = r['gilt']['rect']
    out[y:y + rh, x:x + rw, :3] = paint_gilt(rw, rh, SEED)
    return out


# ---------------------------------------------------------------------------------------------------------
# greenery_hedge

def leaf_clumps(w, h, seed, salt, cell=3.0):
    """Clipped-hedge leaf mass: voronoi clumps a few px across, lighter centres, dark gaps."""
    cx, cy = max(1, int(round(w / cell))), max(1, int(round(h / cell)))
    f1, f2, cid = tl.voronoi(w, h, cx, cy, seed, salt + '/v')
    v = tl.cell_values(cid, cx * cy, seed, salt)
    edge = tl.smoothstep(0.0, 1.4, f2 - f1)          # 0 on cell borders
    centre = 1.0 - tl.smoothstep(0.0, cell * 0.8, f1)
    lum = 0.7 + 0.35 * v + 0.15 * centre
    lum = lum * (0.55 + 0.45 * edge)
    return lum, v


def paint_hedge_ramp(w, h, seed):
    lum, v = leaf_clumps(w, h, seed, 'hedge')
    big = tl.fbm(w, h, 4, 3, seed, 'hedge/big', octaves=2)
    t = ((np.arange(h, dtype=F) + 0.5) / F(h))[:, None] * np.ones((1, w), F)
    top, mid, low = C(92, 116, 44), C(58, 76, 30), C(20, 28, 12)
    col = tl.mix(tl.solid(w, h, top), mid, tl.smoothstep(0.0, 0.5, t))
    col = tl.mix(col, low, tl.smoothstep(0.5, 1.0, t))
    img = col * (lum * (1.0 + 0.12 * big))[..., None]
    # a few yellow-green new shoots on the lit rows
    shoots = (v > 0.9) & (t < 0.45)
    img = tl.mix(img, C(130, 140, 60), shoots.astype(F) * 0.5)
    return grain(img, seed, 'hedgeramp', 0.04, 0.012)


def paint_flowers(w, h, seed, salt, lo, hi, edge_rows=2):
    lum, _ = leaf_clumps(w, h, seed, salt + '/leaf', cell=2.5)
    img = tl.solid(w, h, C(42, 60, 22)) * lum[..., None]
    r = tl.rng(seed, salt, 'heads')
    X, Y = tl.coords(w, h)
    heads = np.zeros((h, w), F)
    colour = np.zeros((h, w, 3), F)
    step = 3
    for gy in range(0, h, 3):
        for gx in range(0, w, step):
            if r.random() > 0.8:
                continue
            cx = gx + r.uniform(0, step) + (1 if (gy // 3) % 2 else 0)
            cy = gy + r.uniform(0, 3)
            sw, sh = (2, 2) if r.random() < 0.5 else (3, 2)
            c = tl.mix(np.asarray(lo, F)[None, None], hi, F(r.random()))[0, 0]
            x0, y0 = int(cx) % w, int(min(cy, h - sh))
            for yy in range(y0, min(h, y0 + sh)):
                for xx in range(x0, x0 + sw):
                    heads[yy, xx % w] = 1.0
                    colour[yy, xx % w] = c
            if r.random() < 0.6:
                colour[y0, x0 % w] = np.minimum(1.0, c * 1.25)
    img = np.where(heads[..., None] > 0, colour, img)
    img = img * (1.0 - 0.35 * tl.smoothstep(h - edge_rows - 0.5, h, Y))[..., None]
    return grain(img, seed, salt, 0.04, 0.012)


def tex_hedge(spec):
    w, h = spec['size']
    out = np.zeros((h, w, 3), F)
    r = spec['regions']
    x, y, rw, rh = r['ramp']['rect']
    out[y:y + rh, x:x + rw] = paint_hedge_ramp(rw, rh, SEED)
    x, y, rw, rh = r['flowers_red']['rect']
    out[y:y + rh, x:x + rw] = paint_flowers(rw, rh, SEED, 'red', C(176, 26, 26), C(224, 66, 44))
    x, y, rw, rh = r['flowers_gold']['rect']
    out[y:y + rh, x:x + rw] = paint_flowers(rw, rh, SEED, 'gold', C(222, 160, 28), C(250, 212, 76))
    return out


# ---------------------------------------------------------------------------------------------------------
# greenery_stone

def concrete(w, h, seed, salt, base, poor=False):
    X, Y = tl.coords(w, h)
    n = tl.fbm(w, h, 8, max(1, h // 6), seed, salt + '/n', octaves=4)
    img = tl.solid(w, h, base) * (1.0 + 0.1 * n)[..., None]
    pores = tl.speckle(w, h, seed, 0.06, (0.5, 0.8), (0.4, 0.9), wrap=tl.STRIP, salt=salt + '/p')
    img = img * (1.0 - 0.3 * pores)[..., None]
    stains = tl.grime(w, h, seed, 6, max(1, h // 6), 0.25 if not poor else 0.45, salt=salt + '/st')
    img = tl.tint(img, C(200, 190, 175) if not poor else C(150, 135, 115), stains * 0.35)
    return img


def paint_conc_side(w, h, seed, poor):
    X, Y = tl.coords(w, h)
    salt = 'poor' if poor else 'conc'
    img = concrete(w, h, seed, salt, C(124, 121, 114) if not poor else C(100, 96, 88), poor)
    row = np.floor(Y).astype(int)
    img = np.where((row == 0)[..., None], img * 1.18, img)
    if not poor:
        joint = (np.floor(X).astype(int) % 32 == 31)
        img = np.where((joint & (row > 0))[..., None], img * 0.8, img)
    else:
        rust = tl.streaks(w, h, seed, 7, (5.0, 12.0), (0.7, 1.4), (0.5, 1.0), wrap=tl.STRIP, salt='rust',
                          area=(0, 0, w, 3))
        img = tl.tint(img, C(140, 95, 60), rust * 0.7)
        soot = tl.streaks(w, h, seed, 6, (6.0, 13.0), (1.0, 2.0), (0.5, 1.0), wrap=tl.STRIP, salt='soot',
                          area=(0, 0, w, 2))
        img = tl.tint(img, C(70, 66, 62), soot * 0.6)
        cr = tl.cracks(w, h, seed, 3, (3, 6), (2.5, 4.0), 1.0, 0.5, 0.3, wrap=tl.STRIP, salt='cr',
                       area=(0, 0, w, 2))
        img = img * (1.0 - 0.55 * cr)[..., None]
        spall = tl.grime(w, h, seed, 8, 2, 0.08, 0.2, salt='spall')
        img = tl.mix(img, C(146, 140, 128), spall * 0.8)
        moss = tl.grime(w, h, seed, 12, 3, 0.6, salt='moss') * tl.smoothstep(h - 4.0, h - 1.0, Y)
        img = tl.mix(img, C(40, 48, 26), moss * 0.75)
    foot = tl.smoothstep(h - 4.5, h, Y)
    img = img * (1.0 - 0.4 * foot)[..., None]
    return grain(img, seed, salt + 'side', 0.04, 0.01)


def paint_conc_top(w, h, seed, poor):
    X, Y = tl.coords(w, h)
    salt = 'pooroftop' if poor else 'conctop'
    img = concrete(w, h, seed, salt, C(138, 135, 128) if not poor else C(112, 108, 100), poor)
    row = np.floor(Y).astype(int)
    img = np.where(((row == 0) | (row == h - 1))[..., None], img * 0.78, img)
    if poor:
        chips = tl.grime(w, h, seed, 10, 1, 0.22, 0.2, salt='chips')
        chips = chips * np.maximum(tl.smoothstep(1.5, 0.0, Y), tl.smoothstep(h - 1.5, h, Y) + 0.0)
        img = tl.mix(img, C(60, 58, 54), np.clip(chips * 1.5, 0, 1) * 0.8)
        cr = tl.cracks(w, h, seed, 2, (3, 5), (2.0, 3.0), 1.0, 0.8, 0.0, wrap=tl.STRIP, salt='topcr')
        img = img * (1.0 - 0.5 * cr)[..., None]
    return grain(img, seed, salt, 0.04, 0.01)


def marble(w, h, seed, salt, base, light=1.0):
    X, Y = tl.coords(w, h)
    warp = tl.fbm(w, h, 4, max(1, h // 8), seed, salt + '/w', octaves=3)
    vein = np.abs(np.sin((X * 0.22 + Y * 0.5 + warp * 6.0)))
    vein = 1.0 - tl.smoothstep(0.0, 0.18, vein)
    img = tl.solid(w, h, base) * F(light)
    img = img * (1.0 + 0.05 * tl.fbm(w, h, 8, max(1, h // 4), seed, salt + '/c', octaves=3))[..., None]
    img = tl.mix(img, C(160, 130, 130), vein * 0.55)
    return img


def paint_marble_side(w, h, seed):
    X, Y = tl.coords(w, h)
    img = marble(w, h, seed, 'mside', C(212, 192, 182))
    row = np.floor(Y).astype(int)
    img = np.where((row == 0)[..., None], np.minimum(1, img * 1.12), img)
    img = img * (1.0 - 0.32 * tl.smoothstep(h - 2.5, h, Y))[..., None]
    return grain(img, seed, 'mside', 0.03, 0.01)


def paint_marble_top(w, h, seed):
    X, Y = tl.coords(w, h)
    img = marble(w, h, seed, 'mtop', C(226, 210, 200))
    row = np.floor(Y).astype(int)
    img = np.where(((row == 0) | (row == h - 1))[..., None], img * 0.86, img)
    return grain(img, seed, 'mtop', 0.03, 0.01)


def paint_soil(w, h, seed, poor):
    X, Y = tl.coords(w, h)
    salt = 'soilpoor' if poor else 'soil'
    f1, f2, cid = tl.voronoi(w, h, w // 3, h // 3, seed, salt + '/clod')
    v = tl.cell_values(cid, (w // 3) * (h // 3), seed, salt)
    base = C(62, 46, 32) if not poor else C(80, 70, 56)
    img = tl.solid(w, h, base) * (0.8 + 0.35 * v)[..., None]
    img = img * (0.7 + 0.3 * tl.smoothstep(0.0, 1.2, f2 - f1))[..., None]
    grit = tl.speckle(w, h, seed, 0.03, (0.4, 0.6), (0.6, 1.0), wrap=tl.DECAL, salt=salt + '/g')
    img = tl.mix(img, C(150, 135, 110), grit * 0.6)
    r = tl.rng(seed, salt, 'litter')
    if poor:
        wet = tl.grime(w, h, seed, 4, 2, 0.25, salt='wet')
        img = img * (1.0 - 0.3 * wet)[..., None]
        for _ in range(7):   # cigarette butts 2x1 off-white with a tan end
            x, y = int(r.integers(3, w - 4)), int(r.integers(3, h - 3))
            img[y, x] = C(215, 205, 180)
            img[y, x + 1] = C(190, 140, 80)
        for _ in range(3):   # paper scraps 3x2
            x, y = int(r.integers(3, w - 5)), int(r.integers(3, h - 4))
            img[y:y + 2, x:x + 3] = C(176, 170, 156) * F(r.uniform(0.85, 1.05))
        x, y = int(r.integers(4, w - 5)), int(r.integers(4, h - 4))
        img[y:y + 2, x:x + 2] = C(160, 150, 120)     # bottle cap
        img[y, x] = C(200, 190, 150)
    # occlusion toward the planter walls
    dx = np.minimum(X, w - X)
    dy = np.minimum(Y, h - Y)
    edge = tl.smoothstep(0.0, 3.0, np.minimum(dx, dy))
    img = img * (0.6 + 0.4 * edge)[..., None]
    return grain(img, seed, salt, 0.05, 0.015)


def tex_stone(spec):
    w, h = spec['size']
    out = np.zeros((h, w, 3), F)
    r = spec['regions']
    jobs = {
        'conc_side': lambda rw, rh: paint_conc_side(rw, rh, SEED, False),
        'conc_top': lambda rw, rh: paint_conc_top(rw, rh, SEED, False),
        'poor_side': lambda rw, rh: paint_conc_side(rw, rh, SEED, True),
        'poor_top': lambda rw, rh: paint_conc_top(rw, rh, SEED, True),
        'marble_side': lambda rw, rh: paint_marble_side(rw, rh, SEED),
        'marble_top': lambda rw, rh: paint_marble_top(rw, rh, SEED),
        'soil': lambda rw, rh: paint_soil(rw, rh, SEED, False),
        'soil_poor': lambda rw, rh: paint_soil(rw, rh, SEED, True),
    }
    check_regions('greenery_stone', r, jobs)
    for name, fn in jobs.items():
        x, y, rw, rh = r[name]['rect']
        out[y:y + rh, x:x + rw] = fn(rw, rh)
    return out


# ---------------------------------------------------------------------------------------------------------
# greenery_cards (RGBA cut-outs + opaque trash decals)

def draw_stroke(alpha, col, pts, width, colour, shade_fn=None):
    """Polyline of `width` px into alpha/colour (hard)."""
    h, w = alpha.shape
    X, Y = tl.coords(w, h)
    for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
        d, t = tl.sd_segment(X, Y, x0, y0, x1, y1)
        m = d <= width * 0.5
        alpha[m] = 1.0
        col[m] = colour


def paint_weeds(w, h, seed, salt='weeds', tall=1.0, grass=False):
    alpha = np.zeros((h, w), F)
    col = np.zeros((h, w, 3), F)
    r = tl.rng(seed, salt)
    X, Y = tl.coords(w, h)
    # dense dry tuft at the bottom with a ragged top
    top = h - 8 + tl.perlin(w, 1, 6, 1, seed, salt + '/tuft')[0] * 3.0
    tuft = (Y >= top[None, :]) & (X > 2) & (X < w - 2)
    alpha[tuft] = 1.0
    col[tuft] = C(96, 82, 58)
    n = 8 if not grass else 22
    for i in range(n):
        x0 = r.uniform(4, w - 4)
        lean = r.normal(0, 4.0 if not grass else 2.5)
        ln = r.uniform(0.45, 0.85) * (h - 4) * tall
        bend = r.random() < 0.15 and not grass
        pts = [(x0, h - 2.0)]
        for k in range(1, 5):
            f = k / 4.0
            px = x0 + lean * f + (r.normal(0, 0.6))
            py = h - 2.0 - ln * f
            if bend and k >= 3:
                px += (k - 2) * 4.0
                py += (k - 2) * 3.0
            pts.append((px, py))
        c = tl.mix(C(110, 95, 70)[None, None], C(152, 132, 92), F(r.random()))[0, 0]
        if grass:
            c = tl.mix(C(132, 124, 76)[None, None], C(96, 104, 64), F(r.random()))[0, 0]
        draw_stroke(alpha, col, pts, 2.0, c)
        if not grass and r.random() < 0.6:   # seed head 3x3
            hx, hy = pts[-1]
            m = (np.abs(X - hx) <= 1.5) & (np.abs(Y - hy) <= 1.5)
            alpha[m] = 1.0
            col[m] = C(126, 104, 70)
    col = col * (0.75 + 0.25 * tl.smoothstep(h, h * 0.4, Y))[..., None]   # darker at the base
    col = grain(col, seed, salt, 0.06, 0.015)
    return np.concatenate([col, alpha[..., None]], axis=2)


def paint_flower_card(w, h, seed):
    alpha = np.zeros((h, w), F)
    col = np.zeros((h, w, 3), F)
    r = tl.rng(seed, 'flowercard')
    X, Y = tl.coords(w, h)
    # leafy clump at the bottom: overlapping ellipses
    for _ in range(9):
        cx, cy = r.uniform(4, w - 4), r.uniform(h - 9, h - 3)
        m = tl.sd_ellipse(X, Y, cx, cy, r.uniform(3, 5), r.uniform(2, 3.5)) < 0
        alpha[m] = 1.0
        col[m] = C(48, 78, 30) * F(r.uniform(0.8, 1.15))
    heads = [(C(196, 34, 30), 4), (C(232, 228, 214), 3), (C(232, 186, 40), 3), (C(186, 30, 40), 4),
             (C(226, 200, 60), 3), (C(240, 236, 224), 3)]
    for i, (c, s) in enumerate(heads):
        hx = 4 + (i + 0.5) * (w - 8) / len(heads) + r.normal(0, 1.0)
        hy = r.uniform(4, h - 14)
        draw_stroke(alpha, col, [(hx + r.normal(0, 1.5), h - 6.0), (hx, hy)], 2.0, C(56, 90, 34))
        m = (np.abs(X - hx) <= s / 2) & (np.abs(Y - hy) <= s / 2)
        alpha[m] = 1.0
        col[m] = c
        cm = (np.abs(X - hx) <= 0.5) & (np.abs(Y - hy) <= 0.5)
        col[cm] = c * 0.55
    col = grain(col, seed, 'flowercard', 0.05, 0.015)
    return np.concatenate([col, alpha[..., None]], axis=2)


def paint_glass(w, h, seed):
    X, Y = tl.coords(w, h)
    img = tl.solid(w, h, C(34, 78, 44))
    img = img * (0.6 + 0.4 * (1.0 - np.abs(X - w / 2) / (w / 2)))[..., None]
    hl = (X >= 4) & (X < 6)
    img = np.where(hl[..., None], C(120, 170, 120), img)
    dirt = tl.smoothstep(h - 5, h, Y)
    img = tl.mix(img, C(70, 60, 44), dirt * 0.6)
    return grain(img, seed, 'glass', 0.04, 0.01)


def paint_can(w, h, seed):
    X, Y = tl.coords(w, h)
    img = tl.solid(w, h, C(150, 150, 146))
    band = (Y > h * 0.3) & (Y < h * 0.72)
    img = np.where(band[..., None], C(150, 42, 36), img)
    crease = tl.scratches(w, h, seed, 5, (4, 9), (0.8, 1.2), (60, 120), wrap=tl.DECAL, salt='can')
    img = img * (1.0 - 0.45 * crease)[..., None]
    img = img * (0.7 + 0.3 * (1.0 - np.abs(X - w / 2) / (w / 2)))[..., None]
    return grain(img, seed, 'can', 0.04, 0.01)


def paint_paper(w, h, seed):
    X, Y = tl.coords(w, h)
    img = tl.solid(w, h, C(170, 165, 150))
    cols = ((np.mod(X, 5) < 3) & (np.mod(Y, 3) < 1) & (X > 1) & (X < w - 2) & (Y > 2) & (Y < h - 2))
    img = np.where(cols[..., None], img * 0.72, img)
    folds = tl.scratches(w, h, seed, 4, (6, 12), (0.8, 1.0), (0, 180), wrap=tl.DECAL, salt='paper')
    img = img * (1.0 - 0.35 * folds)[..., None]
    stain = tl.blobs(w, h, seed, 1, (2.5, 4.0), salt='paperstain', wrap=tl.DECAL)
    img = tl.tint(img, C(170, 130, 90), stain * 0.6)
    return grain(img, seed, 'paper', 0.04, 0.01)


def paint_rubble(w, h, seed):
    X, Y = tl.coords(w, h)
    img = tl.solid(w, h, C(140, 135, 125)) * (1.0 + 0.12 * tl.fbm(w, h, 4, 4, seed, 'rub', octaves=3))[..., None]
    pits = tl.speckle(w, h, seed, 0.12, (0.5, 0.9), (0.6, 1.0), wrap=tl.DECAL, salt='rubpits')
    img = img * (1.0 - 0.45 * pits)[..., None]
    edge = tl.smoothstep(0.0, 3.0, np.minimum(np.minimum(X, w - X), np.minimum(Y, h - Y)))
    img = img * (0.7 + 0.3 * edge)[..., None]
    return grain(img, seed, 'rubble', 0.04, 0.01)


def opaque(img):
    return np.concatenate([img, np.ones(img.shape[:2] + (1,), F)], axis=2)


def tex_cards(spec):
    w, h = spec['size']
    out = np.zeros((h, w, 4), F)
    r = spec['regions']
    jobs = {
        'weeds': lambda rw, rh: paint_weeds(rw, rh, SEED),
        'flowers': lambda rw, rh: paint_flower_card(rw, rh, SEED),
        'glass': lambda rw, rh: opaque(paint_glass(rw, rh, SEED)),
        'can': lambda rw, rh: opaque(paint_can(rw, rh, SEED)),
        'paper': lambda rw, rh: opaque(paint_paper(rw, rh, SEED)),
        'rubble': lambda rw, rh: opaque(paint_rubble(rw, rh, SEED)),
        'litter': lambda rw, rh: paint_weeds(rw, rh, SEED, 'grass', tall=1.0, grass=True),
    }
    check_regions('greenery_cards', r, jobs)
    for name, fn in jobs.items():
        x, y, rw, rh = r[name]['rect']
        out[y:y + rh, x:x + rw] = fn(rw, rh)
    return out


# ---------------------------------------------------------------------------------------------------------
# Driver

PAINTERS = {
    'env_tree_rich_fronds': tex_fronds,
    'env_tree_rich_trunk': tex_trunk,
    'greenery_gold': tex_gold,
    'greenery_hedge': tex_hedge,
    'greenery_stone': tex_stone,
    'greenery_cards': tex_cards,
}


def check_regions(tex, regions, jobs):
    if set(regions) != set(jobs):
        raise SystemExit(f'{tex}: contract regions {sorted(regions)} != painters {sorted(jobs)}')


def check_layout(name, spec):
    w, h = spec['size']
    rects = [(k, v['rect']) for k, v in spec.get('regions', {}).items()]
    for k, (x, y, rw, rh) in rects:
        if x < 0 or y < 0 or x + rw > w or y + rh > h:
            raise SystemExit(f'{name}/{k} leaves the sheet')
    for i, (a, ra) in enumerate(rects):
        for b, rb in rects[i + 1:]:
            if ra[0] < rb[0] + rb[2] and rb[0] < ra[0] + ra[2] and ra[1] < rb[1] + rb[3] and rb[1] < ra[1] + ra[3]:
                raise SystemExit(f'{name}: {a} overlaps {b}')


def save(path, img, mode):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    a = tl.to_u8(img)
    if mode == 'RGBA':
        a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)   # hard alpha
        # bleed colour into transparent texels so a filtered edge never pulls in black
        rgb = a[..., :3].astype(np.float32)
        m = (a[..., 3] > 0).astype(np.float32)
        acc, wsum = rgb * m[..., None], m.copy()
        for _ in range(3):
            acc = tl.blur(acc, 1.0, wrap=tl.DECAL)
            wsum = tl.blur(wsum, 1.0, wrap=tl.DECAL)
        fillc = acc / np.maximum(wsum, 1e-4)[..., None]
        a[..., :3] = np.where(m[..., None] > 0, a[..., :3], np.clip(fillc, 0, 255).astype(np.uint8))
        Image.fromarray(a, 'RGBA').save(path)
    else:
        Image.fromarray(a[..., :3], 'RGB').save(path)


def preview(outdir, layout, images):
    os.makedirs(outdir, exist_ok=True)
    items = []
    for name, img in images.items():
        spec = layout['textures'][name]
        im = Image.open(os.path.join(ROOT, spec['file'])).convert('RGBA')
        z = 6
        big = im.resize((im.width * z, im.height * z), Image.NEAREST)
        bg = Image.new('RGBA', big.size, (255, 0, 255, 255))
        chk = np.indices((big.height, big.width)).sum(0) // 24 % 2
        bg = Image.fromarray(np.where(chk[..., None] == 0, [200, 60, 200, 255], [120, 30, 120, 255]).astype(np.uint8), 'RGBA')
        bg.alpha_composite(big)
        regs = {k: [c * z for c in v['rect']] for k, v in spec.get('regions', {}).items()}
        out_l = tl.outline_regions(np.asarray(bg.convert('RGB'), np.float32) / 255.0, regs, scale=1)
        items.append((f'{name} {im.width}x{im.height} {spec["mode"]}', out_l))
    sheet = tl.contact_sheet(items, max_width=1400)
    sheet.save(os.path.join(outdir, 'greenery_textures.png'))
    # the textures at their real size next to the street's own, x4 nearest
    refs = ['leaves', 'trunk', 'treeguard', 'stone', 'park']
    row = []
    for n in refs:
        row.append((n, Image.open(os.path.join(ROOT, 'public', 'textures', 'map', n + '.png')).convert('RGBA')))
    for name in images:
        row.append((name, Image.open(os.path.join(ROOT, layout['textures'][name]['file'])).convert('RGBA')))
    row = [(n, i.resize((i.width * 4, i.height * 4), Image.NEAREST)) for n, i in row]
    flat = []
    for n, i in row:
        bg = Image.new('RGBA', i.size, (40, 40, 40, 255))
        bg.alpha_composite(i)
        flat.append((n, bg))
    tl.contact_sheet(flat, max_width=1600).save(os.path.join(outdir, 'greenery_vs_street.png'))
    print('preview ->', outdir)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*')
    ap.add_argument('--preview')
    args = ap.parse_args()
    with open(LAYOUT, encoding='utf-8') as fh:
        layout = json.load(fh)
    if set(layout['textures']) != set(PAINTERS):
        raise SystemExit(f'contract textures {sorted(layout["textures"])} != painters {sorted(PAINTERS)}')
    images = {}
    for name, fn in PAINTERS.items():
        if args.only and name not in args.only:
            continue
        spec = layout['textures'][name]
        check_layout(name, spec)
        img = fn(spec)
        w, h = spec['size']
        if img.shape[:2] != (h, w):
            raise SystemExit(f'{name}: painted {img.shape[:2]} != contract {(h, w)}')
        save(os.path.join(ROOT, spec['file']), img, spec['mode'])
        images[name] = img
        print('wrote', spec['file'])
    if args.preview:
        preview(args.preview, layout, images)


if __name__ == '__main__':
    main()
