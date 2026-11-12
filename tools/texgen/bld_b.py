#!/usr/bin/env python3
"""Textures for the bld_b family: rich-tier mall, corporate HQ and grand hotel (dict-three street).

    python tools/texgen/bld_b.py [--only <texture> ...] [--preview <dir>]

Reads every size and rect from tools/texgen/bld_b_layout.json (the contract shared with
tools/blender/bld_b.py) and writes public/textures/map/<texture>.png. Every random source is seeded:
a re-run writes identical bytes. --preview writes outlined atlases, strips tiled along U and a contact
sheet beside the street's existing textures (build/visual_gaps/bld_b/textures/ is the usual place).

The game lights the street with one flat ambient light and ignores vertex colour, so form is baked into
the albedo: *_side regions are the *_front ones at ~0.78 value, and plain trim regions carry `bands`
copies at the contract's `band_shades` (the modeler picks a band from each face's normal).
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
LAYOUT = os.path.join(ROOT, 'tools', 'texgen', 'bld_b_layout.json')
SEED = 4711
SIDE = 0.78

C = tl.rgb
GOLD_SH, GOLD_MID, GOLD_HI = C(112, 80, 30), C(184, 144, 62), C(232, 198, 112)
MARBLE, VEIN = C(214, 203, 191), C(182, 144, 138)
CREAM = C(212, 198, 174)
RED, RED_DK = C(168, 26, 26), C(104, 15, 18)
GRANITE = C(52, 46, 48)
WARM = C(232, 176, 92)


# ---------------------------------------------------------------------------------------------------------
# Helpers

def ramp(t, *stops):
    """Piecewise-linear colour ramp; t (h, w) in [0, 1], stops evenly spaced colours."""
    t = np.clip(np.asarray(t, F), 0.0, 1.0) * (len(stops) - 1)
    i = np.minimum(t.astype(int), len(stops) - 2)
    f = (t - i)[..., None]
    s = np.stack(stops).astype(F)
    return s[i] * (1 - f) + s[i + 1] * f


def grain(img, seed, salt, lum=0.035, chroma=0.012):
    h, w = img.shape[:2]
    g = (tl.white(w, h, seed, salt + 'l') - 0.5) * 2 * lum
    c = (np.stack([tl.white(w, h, seed, salt + k) for k in 'rgb'], -1) - 0.5) * 2 * chroma
    return np.clip(img * (1 + g[..., None]) + c, 0, 1)


def put(sheet, rect, img):
    x, y, w, h = rect
    assert img.shape[:2] == (h, w), (rect, img.shape)
    sheet[y:y + h, x:x + w, :img.shape[2]] = img


def mask3(m):
    return np.asarray(m, F)[..., None]


def over(base, colour, m):
    """Paints colour (rgb or image) over base with coverage m."""
    return base * (1 - mask3(m)) + np.asarray(colour, F) * mask3(m)


def gold_field(w, h, seed, salt, wrap=tl.STRIP, cx=None):
    """Gilded metal: mottled ramp shadow-mid-highlight with faint vertical brush streaks."""
    cx = cx or max(2, w // 16)
    n = tl.fbm(w, h, cx, max(1, h // 8), seed, salt + 'g', octaves=3) * 0.5 + 0.5
    X, _ = tl.coords(w, h)
    streak = tl.fbm(w, h, max(4, w // 4), 1, seed, salt + 's', octaves=2) * 0.08
    return ramp(np.clip(0.25 + n * 0.55 + streak, 0, 1), GOLD_SH, GOLD_MID, GOLD_HI)


def marble_field(w, h, seed, salt, base=MARBLE, vein=VEIN):
    """Polished marble: pale base, warped ridge veins."""
    warp = tl.fbm(w, h, max(2, w // 32), max(1, h // 16), seed, salt + 'w', octaves=3)
    X, Y = tl.coords(w, h)
    v = tl.fbm(w, h, max(2, w // 24), max(1, h // 12), seed, salt + 'v', octaves=4)
    ridge = 1.0 - np.abs(np.sin((v * 3.0 + warp * 2.0) * math.pi))
    veins = tl.smoothstep(0.82, 0.97, ridge)
    tone = tl.fbm(w, h, max(2, w // 16), max(1, h // 8), seed, salt + 't', octaves=3) * 0.05
    img = np.asarray(base, F) * (1 + tone[..., None])
    return over(img, vein, veins * 0.55)


def bands(painter, w, band_h, shades, seed, salt):
    """Stacks len(shades) copies of painter(w, band_h, seed, salt+k), each multiplied by its shade."""
    return np.concatenate([painter(w, band_h, seed, f'{salt}{k}') * F(s) for k, s in enumerate(shades)], 0)


def bleed(rgb, alpha, sigma=1.5):
    """Colour of transparent pixels taken from nearby opaque ones (no dark fringe in mips)."""
    a = mask3(alpha)
    num = tl.blur(rgb * a, sigma, wrap=tl.DECAL)
    den = tl.blur(a, sigma, wrap=tl.DECAL)
    filled = num / np.maximum(den, 1e-4)
    for _ in range(4):
        num = tl.blur(filled * 1, 3.0, wrap=tl.DECAL)
        filled = np.where(den > 1e-3, filled, num)
    return np.where(a > 0.5, rgb, filled)


# ---------------------------------------------------------------------------------------------------------
# bld_b_rich_trim

def p_gold(w, h, seed, salt, shades):
    bh = h // len(shades)

    def one(w, h, seed, salt):
        img = gold_field(w, h, seed, salt)
        img[0] = img[0] * 0.6 + GOLD_HI * 0.4
        img[-1] = img[-1] * 0.75
        return img
    return bands(one, w, bh, shades, seed, salt)


def p_marble(w, h, seed, salt, shades):
    bh = h // len(shades)

    def one(w, h, seed, salt):
        img = marble_field(w, h, seed, salt)
        X, _ = tl.coords(w, h)
        joint = (np.floor(X) % 32 == 0)
        return img * (1 - 0.12 * mask3(joint))
    return bands(one, w, bh, shades, seed, salt)


def p_cornice(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    img = marble_field(w, h, seed, salt, base=CREAM)
    g = gold_field(w, h, seed, salt)
    egg = tl.fill(tl.sd_ellipse(X % 4, Y, 2.0, 2.0, 1.6, 1.1)) * ((Y >= 1) & (Y < 3))
    img = over(img, g * 0.75, ((Y >= 1) & (Y < 3)))
    img = over(img, g * 1.15, egg)
    dent = ((np.floor(X) % 4) < 2) & (Y >= 4) & (Y < 6)
    img = over(img, g, dent)
    img = over(img, g * 0.45, (~dent) & (Y >= 4) & (Y < 6))
    img = over(img, C(40, 34, 30), (Y >= 6) * np.where(Y >= 7, 1.0, 0.6))
    return np.clip(img, 0, 1)


def p_awning(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    sx = X % 8
    stripe = sx < 5
    img = np.where(mask3(stripe), RED, RED * 0.72 + RED_DK * 0.28)
    sag = 0.85 + 0.15 * np.sin(sx / 8 * math.pi * 2 + 0.6)
    img = img * mask3(sag)
    img = img * mask3(1 - 0.18 * np.clip((Y - 3) / 5, 0, 1) * (Y < 8))
    # valance rows 8-11: scallops every 8 px
    sc = tl.fill(tl.sd_circle(X % 8, Y, 4.0, 8.0, 3.6))
    val = (Y >= 8)
    img = np.where(mask3(val), RED * 0.95, img)
    img = over(img, gold_field(w, h, seed, salt), (Y >= 10) & (Y < 11) & (sc > 0.3))
    img = over(img, C(30, 18, 16), (Y >= 11) * (1 - sc))
    img = over(img, RED * 0.6, (Y >= 11) * sc * 0.6)
    g = tl.grime(w, h, seed, 16, 2, 0.35, salt=salt)
    return np.clip(img * mask3(1 - 0.12 * g), 0, 1)


def p_glass(w, h, seed, salt, shades):
    bh = h // len(shades)

    def one(w, h, seed, salt):
        X, Y = tl.coords(w, h)
        n = tl.fbm(w, h, 8, 1, seed, salt + 'c', octaves=3) * 0.5 + 0.5
        img = ramp(0.3 + 0.5 * n, C(70, 110, 120), C(150, 190, 195), C(205, 225, 222))
        rib = (np.floor(X) % 16) < 2
        img = over(img, gold_field(w, h, seed, salt), rib)
        img = over(img, C(120, 92, 40), (Y < 1) & ~rib)
        return img
    return bands(one, w, bh, shades, seed, salt)


def p_roof(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    n = tl.fbm(w, h, 8, 1, seed, salt, octaves=4) * 0.5 + 0.5
    img = ramp(0.2 + 0.6 * n, C(48, 44, 42), C(78, 72, 66), C(98, 92, 84))
    seam = np.floor(X) % 16
    img = over(img, C(118, 112, 104), seam == 0)
    img = over(img, C(36, 32, 30), seam == 1)
    tar = tl.grime(w, h, seed, 8, 2, 0.3, salt=salt + 't')
    return img * mask3(1 - 0.25 * tar)


def p_banner(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    folds = 0.9 + 0.1 * np.sin(X / w * math.pi * 6)
    img = (RED * 1.05)[None, None] * mask3(folds) * mask3(1 - 0.12 * (Y / h))
    # tunic and epaulettes
    tunic = tl.fill(tl.sd_ellipse(X, Y, 16, 47, 13.5, 11))
    img = over(img, C(78, 84, 52), tunic)
    img = over(img, C(58, 62, 38), tunic * tl.fill(tl.sd_box(X, Y, 16, 44, 1.0, 8)))
    for ex in (5.5, 26.5):
        img = over(img, GOLD_MID, tl.fill(tl.sd_box(X, Y, ex, 38.5, 3, 1.4, 1)))
        img = over(img, GOLD_HI, tl.fill(tl.sd_box(X, Y, ex, 37.6, 2.4, 0.5)))
    for i, (mx, my, col) in enumerate([(9, 41, C(210, 40, 40)), (11, 41, GOLD_HI), (13, 41, C(60, 110, 200)),
                                       (10, 43, GOLD_MID), (12, 43, C(230, 230, 230))]):
        img = over(img, col, tl.fill(tl.sd_circle(X, Y, mx + 0.5, my + 0.5, 0.75)))
    # neck and face
    img = over(img, C(176, 128, 96), tl.fill(tl.sd_box(X, Y, 16, 33, 3.6, 3)))
    face = tl.fill(tl.sd_ellipse(X, Y, 16, 25, 6.6, 8.2))
    skin = ramp(np.clip((X - 10) / 12, 0, 1), C(226, 182, 142), C(200, 150, 112), C(150, 104, 78))
    img = over(img, skin, face)
    img = over(img, C(140, 96, 72), tl.fill(tl.sd_ellipse(X, Y, 9.6, 25, 1.2, 2)))
    img = over(img, C(140, 96, 72), tl.fill(tl.sd_ellipse(X, Y, 22.4, 25, 1.2, 2)))
    # brows, eyes, nose shadow
    for ex in (13.0, 19.0):
        img = over(img, C(40, 28, 22), tl.fill(tl.sd_box(X, Y, ex, 21.0, 2.0, 0.55)))
        img = over(img, C(30, 22, 20), tl.fill(tl.sd_box(X, Y, ex, 22.8, 1.0, 0.7)))
    img = over(img, C(168, 118, 88), tl.fill(tl.sd_box(X, Y, 16.8, 25.5, 0.8, 2.0)))
    # moustache: thick, drooping ends
    mou = np.maximum(tl.fill(tl.sd_ellipse(X, Y, 16, 28.4, 5.2, 1.6)),
                     np.maximum(tl.fill(tl.sd_ellipse(X, Y, 11.4, 29.6, 1.4, 1.5)),
                                tl.fill(tl.sd_ellipse(X, Y, 20.6, 29.6, 1.4, 1.5))))
    img = over(img, C(28, 20, 18), mou)
    img = over(img, C(120, 60, 52), tl.fill(tl.sd_box(X, Y, 16, 30.8, 2.0, 0.45)))
    # peaked cap: crown, gold band, badge, visor
    crown = np.maximum(tl.fill(tl.sd_ellipse(X, Y, 16, 12.0, 10.5, 4.6)), tl.fill(tl.sd_box(X, Y, 16, 15, 8.2, 2.4)))
    img = over(img, ramp(np.clip((X - 6) / 20, 0, 1), C(88, 96, 60), C(66, 72, 44), C(44, 48, 30)), crown)
    img = over(img, GOLD_MID, tl.fill(tl.sd_box(X, Y, 16, 16.3, 7.8, 0.8)))
    img = over(img, GOLD_HI, tl.fill(tl.sd_circle(X, Y, 16, 12.6, 1.8)))
    img = over(img, RED, tl.fill(tl.sd_circle(X, Y, 16, 12.6, 0.7)))
    img = over(img, C(22, 20, 18), tl.fill(tl.sd_ellipse(X, Y, 16, 18.2, 7.2, 1.3)))
    # gold border and fringe
    border = (X < 2) | (X > w - 2) | (Y < 2)
    img = over(img, gold_field(w, h, seed, salt + 'b', wrap=tl.DECAL), border)
    fringe = (Y >= h - 3)
    img = over(img, np.where(mask3((np.floor(X) % 2) == 0), GOLD_MID, GOLD_SH), fringe)
    return grain(np.clip(img, 0, 1), seed, salt, 0.025, 0.008)


def p_portal(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    img = marble_field(w, h, seed, salt)
    img = img * mask3(1 - 0.12 * (np.floor(Y) % 6 == 0))
    arch = np.minimum(tl.sd_rect(X, Y, 4, 18, 28, 45), 1e3)
    arch = np.minimum(arch, tl.sd_circle(X, Y, 16, 18, 12))
    # recess shadow around the opening
    img = img * mask3(1 - 0.35 * tl.fill(arch - 2.5, 2.0))
    inside = tl.fill(arch + 1.5)
    deep = ramp(np.clip((Y - 8) / 36, 0, 1), C(60, 40, 22), C(110, 72, 34), C(150, 100, 48))
    img = over(img, deep, inside)
    # fanlight in the arch: gold bars radiating from (16, 22)
    fan = inside * (Y < 22)
    ang = np.arctan2(Y - 22, X - 16)
    bar = (np.abs(np.sin(ang * 5)) < 0.25)
    img = over(img, WARM * 0.9, fan * 0.6)
    img = over(img, GOLD_HI, fan * bar)
    img = over(img, GOLD_MID, inside * ((Y >= 22) & (Y < 23.5)))
    # doors: two warm glazed leaves with gold frames
    for x0 in (7, 16.5):
        d = tl.sd_rect(X, Y, x0, 24, x0 + 8.5, 44)
        img = over(img, ramp(np.clip((Y - 24) / 20, 0, 1), C(250, 214, 140), C(214, 150, 72)), tl.fill(d) * inside)
        img = over(img, GOLD_MID, tl.ring(d, 1.2) * inside)
        img = over(img, GOLD_SH, tl.fill(tl.sd_box(X, Y, x0 + 4.25, 34, 4.2, 0.5)) * inside)
    img = over(img, GOLD_MID, tl.ring(arch + 0.5, 1.5))
    img = over(img, GOLD_HI, tl.fill(tl.sd_box(X, Y, 16, 6.5, 1.8, 1.6)))  # keystone
    steps = (Y >= 45)
    img = over(img, MARBLE * np.where(mask3(np.floor(Y) == 46), 0.8, 1.0), steps)
    return grain(np.clip(img, 0, 1), seed, salt, 0.025, 0.008)


def p_medallion(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    g = gold_field(w, h, seed, salt, wrap=tl.DECAL)
    disc = tl.sd_circle(X, Y, 16, 16, 15.5)
    img = g * 0.8
    # profile (facing left): cranium, cap with visor, nose, moustache, chin, neck
    prof = np.minimum.reduce([
        tl.sd_ellipse(X, Y, 18.0, 15.5, 6.5, 6.5),
        tl.sd_rect(X, Y, 10.5, 8.5, 25.0, 12.0, 1.0),          # cap crown
        tl.sd_ellipse(X, Y, 18.5, 8.2, 7.0, 2.6),
        tl.sd_rect(X, Y, 7.0, 11.5, 13.0, 13.0),               # visor
        tl.sd_rect(X, Y, 10.0, 15.0, 13.0, 18.5),              # nose bridge
        tl.sd_ellipse(X, Y, 10.6, 18.0, 1.6, 1.3),             # nose tip
        tl.sd_ellipse(X, Y, 12.2, 20.0, 2.6, 1.3),             # moustache
        tl.sd_ellipse(X, Y, 14.0, 22.2, 3.0, 2.2),             # chin
        tl.sd_rect(X, Y, 15.0, 20.0, 22.5, 27.5),              # neck
    ])
    pm = tl.fill(prof)
    img = over(img, g * 1.05, pm)
    # emboss: highlight on the upper-left edge, shadow on the lower-right
    sh = np.roll(np.roll(pm, 1, 0), 1, 1)
    hi = np.roll(np.roll(pm, -1, 0), -1, 1)
    img = over(img, GOLD_HI, np.clip(pm - sh, 0, 1))
    img = over(img, GOLD_SH * 0.8, np.clip(sh - pm, 0, 1))
    img = over(img, C(80, 56, 20), tl.fill(tl.sd_ellipse(X, Y, 12.5, 20.0, 2.4, 0.9)) * 0.6)  # moustache groove
    img = over(img, C(90, 64, 24), tl.fill(tl.sd_box(X, Y, 18, 12.4, 6.8, 0.5)) * 0.7)          # cap band line
    img = over(img, C(90, 64, 24), tl.fill(tl.sd_circle(X, Y, 13.6, 15.2, 0.7)))               # eye
    # laurel arc along the lower rim
    for k in range(9):
        a = math.radians(200 + k * 17.5)
        lx, ly = 16 + 11.6 * math.cos(a), 16 - 11.6 * math.sin(a)
        img = over(img, GOLD_HI * 0.95, tl.fill(tl.sd_ellipse(X, Y, lx, ly, 1.3, 0.8)))
    # rim
    rim = tl.ring(disc + 1.5, 3.0)
    lit = np.clip(0.5 - ((X - 16) + (Y - 16)) / 32, 0, 1)
    img = over(img, ramp(lit, GOLD_SH, GOLD_MID, GOLD_HI), rim)
    img = over(img, g * 0.75, tl.fill(-disc))  # corners: plain gold
    return grain(np.clip(img, 0, 1), seed, salt, 0.02, 0.006)


def p_revdoor(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    img = marble_field(w, h, seed, salt)
    inner = (X >= 4) & (X < 28) & (Y >= 4) & (Y < 30)
    img = over(img, ramp(np.clip((Y - 4) / 26, 0, 1), C(60, 42, 24), C(120, 84, 40)), inner)
    # three wings: centre wing face-on, two oblique
    for x0, x1, k in ((13, 19, 1.0), (6, 12, 0.75), (20, 26, 0.75)):
        d = tl.sd_rect(X, Y, x0, 6, x1, 29)
        img = over(img, ramp(np.clip((Y - 6) / 23, 0, 1), C(200, 220, 222), C(150, 170, 172)) * k, tl.fill(d))
        img = over(img, GOLD_MID, tl.ring(d, 1.0))
    img = over(img, gold_field(w, h, seed, salt, wrap=tl.DECAL), (Y < 4) & (X >= 1) & (X < 31))
    img = over(img, C(60, 44, 20), (Y >= 3) & (Y < 4))
    img = over(img, GOLD_MID, ((X >= 3) & (X < 4) | (X >= 28) & (X < 29)) & (Y >= 4))
    img = over(img, GRANITE, Y >= 30)
    return grain(np.clip(img, 0, 1), seed, salt, 0.02, 0.006)


def p_hoteldoor(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    img = marble_field(w, h, seed, salt)
    img = over(img, C(70, 48, 26), tl.fill(tl.sd_rect(X, Y, 5, 1, 27, 15)))
    tr = tl.sd_rect(X, Y, 6, 2, 26, 5)
    img = over(img, WARM, tl.fill(tr))
    img = over(img, GOLD_MID, tl.ring(tr, 1.0))
    for x0 in (6, 16.5):
        d = tl.sd_rect(X, Y, x0, 6, x0 + 9.5, 15)
        img = over(img, ramp(np.clip((Y - 6) / 9, 0, 1), C(250, 214, 140), C(200, 140, 70)), tl.fill(d))
        img = over(img, GOLD_MID, tl.ring(d, 1.0))
    img = over(img, GRANITE, Y >= 15)
    return grain(np.clip(img, 0, 1), seed, salt, 0.02, 0.006)


def p_canopy(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    fold = 0.86 + 0.14 * np.sin(X / 4 * math.pi)
    img = RED[None, None] * mask3(fold) * mask3(1 - 0.15 * Y / 12)
    img = over(img, GOLD_MID, (Y >= 1) & (Y < 2))
    img = over(img, gold_field(w, h, seed, salt, wrap=tl.STRIP), Y >= 12)
    img = over(img, GOLD_SH, (Y >= 14) & ((np.floor(X) % 2) == 1))
    return np.clip(img, 0, 1)


def paint_trim(spec, shades, seed):
    w, h = spec['size']
    sheet = np.zeros((h, w, 3), F)
    R = spec['regions']
    for name, fn in (('gold', p_gold), ('marble', p_marble), ('glass', p_glass)):
        x, y, rw, rh = R[name]['rect']
        assert rh % R[name]['bands'] == 0
        put(sheet, R[name]['rect'], fn(rw, rh, seed, name, shades[:R[name]['bands']]))
    for name, fn in (('cornice', p_cornice), ('awning', p_awning), ('roof', p_roof), ('banner', p_banner),
                     ('portal', p_portal), ('medallion', p_medallion), ('revdoor', p_revdoor),
                     ('hoteldoor', p_hoteldoor), ('canopy', p_canopy)):
        x, y, rw, rh = R[name]['rect']
        put(sheet, R[name]['rect'], fn(rw, rh, seed, name))
    return sheet


# ---------------------------------------------------------------------------------------------------------
# bld_b_rich_cutout (RGBA, alpha-tested)

def c_cresting(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    sx = X % 8
    rail = (Y >= h - 1.5)
    spike = tl.fill(tl.sd_segment(sx, Y, 4.0, 0.6, 4.0, 7.5)[0] - 0.6)
    lis = np.maximum(tl.fill(tl.sd_ellipse(sx, Y, 2.6, 2.6, 1.0, 1.6)), tl.fill(tl.sd_ellipse(sx, Y, 5.4, 2.6, 1.0, 1.6)))
    scroll = tl.ring(tl.sd_circle(sx, Y, 0.0, 5.6, 1.6), 0.9) * (Y > 3.5)
    a = np.clip(np.maximum.reduce([rail * 1.0, spike, lis * (Y < 4.5), scroll]), 0, 1)
    lit = np.clip(1.0 - Y / h * 0.6, 0, 1)
    rgb = ramp(lit * 0.9, GOLD_SH, GOLD_MID, GOLD_HI)
    return rgb, (a > 0.45).astype(F)


def c_balustrade(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    sx = X % 4
    rail = (Y < 3) | (Y >= h - 3)
    prof = 0.55 + 0.95 * np.exp(-((Y - 9.0) / 2.6) ** 2) - 0.25 * np.exp(-((Y - 5.0) / 1.0) ** 2)
    bal = np.abs(sx - 2.0) < prof
    a = (rail | bal).astype(F)
    rgb = marble_field(w, h, seed, salt)
    shade = np.where(rail, 1.0, 0.92 - 0.25 * np.clip((Y - 9) / 4, 0, 1) - 0.12 * np.clip((sx - 2.0) / 1.5, 0, 1))
    rgb = rgb * mask3(shade)
    rgb = over(rgb, C(60, 52, 48), ((Y >= 3) & (Y < 3.8)) | (Y >= h - 1))
    return rgb, a


def c_flag_a(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    fold = 0.82 + 0.18 * np.sin(X / w * math.pi * 3 + 0.4)
    rgb = RED[None, None] * mask3(fold)
    rgb = over(rgb, GOLD_MID, ((Y < 1.5) | (Y >= h - 1.5)))
    cx, cy = 10.5, 10.0
    wreath = tl.ring(tl.sd_circle(X, Y, cx, cy, 5.2), 1.6) * (Y > 5.5)
    ang = np.arctan2(Y - cy, X - cx)
    r = np.hypot(X - cx, Y - cy)
    star = r < 2.2 + 1.6 * np.maximum(0, np.cos(ang * 5 + math.pi / 2)) ** 3
    rgb = over(rgb, GOLD_MID * mask3(fold), wreath)
    rgb = over(rgb, GOLD_HI * mask3(fold), star)
    return rgb, np.ones((h, w), F)


def c_flag_b(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    fold = 0.82 + 0.18 * np.sin(X / w * math.pi * 3 + 1.1)
    band = (Y >= 6.5) & (Y < 13.5)
    rgb = np.where(mask3(band), GOLD_MID[None, None], RED[None, None])
    head = np.minimum.reduce([tl.sd_ellipse(X, Y, 16.5, 10.5, 2.6, 2.6), tl.sd_rect(X, Y, 13.0, 7.0, 19.5, 9.0),
                              tl.sd_rect(X, Y, 12.0, 8.6, 15.0, 9.4), tl.sd_ellipse(X, Y, 14.2, 11.6, 1.2, 0.8)])
    rgb = over(rgb, C(24, 18, 16), tl.fill(head) * band)
    return rgb * mask3(fold), np.ones((h, w), F)


def c_railing(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    rails = (Y < 2) | (Y >= h - 1)
    vert = (np.floor(X) % 4 == 0)
    circ = tl.ring(tl.sd_circle(X % 16, Y, 8.0, 6.0, 3.0), 1.0) > 0.4
    a = (rails | vert | circ).astype(F)
    rgb = gold_field(w, h, seed, salt) * mask3(1 - 0.25 * Y / h)
    return rgb, a


def paint_cutout(spec, seed):
    w, h = spec['size']
    rgb = np.zeros((h, w, 3), F)
    alpha = np.zeros((h, w), F)
    R = spec['regions']
    for name, fn in (('cresting', c_cresting), ('balustrade', c_balustrade), ('flag_a', c_flag_a),
                     ('flag_b', c_flag_b), ('railing', c_railing)):
        x, y, rw, rh = R[name]['rect']
        c, a = fn(rw, rh, seed, name)
        put(rgb, R[name]['rect'], c)
        alpha[y:y + rh, x:x + rw] = a
    rgb = bleed(rgb, alpha)
    return np.concatenate([rgb, alpha[..., None]], -1)


# ---------------------------------------------------------------------------------------------------------
# Facades

def dirt(img, seed, salt, w, h, amount=0.12, cx=8, cy=4, foot=0.0):
    """Blotchy grime, vertical rain streaks and (foot > 0) soot rising from the bottom rows."""
    g = tl.grime(w, h, seed, cx, cy, 0.4, salt=salt)
    st = tl.blur(tl.fbm(w, h, max(4, w // 4), 1, seed, salt + 'rain', octaves=3) * 0.5 + 0.5, 0.6, 0, wrap=tl.STRIP)
    _, Y = tl.coords(w, h)
    soot = np.clip((Y / h - (1 - foot)) / max(foot, 1e-3), 0, 1) if foot > 0 else 0.0
    return img * mask3(1 - amount * g - 0.08 * tl.smoothstep(0.55, 0.85, st) - 0.18 * soot)


def f_commercial(w, h, seed, salt):
    """Mall wing: attic, piano nobile, shopfront over 64 rows (4 bays of 32 px)."""
    X, Y = tl.coords(w, h)
    bx = X % 32
    img = marble_field(w, h, seed, salt + 'm', base=CREAM)
    gold = gold_field(w, h, seed, salt + 'g')
    pink = marble_field(w, h, seed, salt + 'p', base=C(214, 172, 166), vein=C(170, 120, 118))
    # attic frieze: garland swag and roundel per bay
    swag = tl.fill(np.abs(Y - (2.5 + 4.2 * np.sin(math.pi * bx / 32))) - 0.8) * (Y < 9)
    img = over(img, gold * 0.95, swag)
    img = over(img, gold * 1.1, tl.fill(tl.sd_circle(bx, Y, 16, 4.0, 2.3)))
    img = over(img, RED, tl.fill(tl.sd_circle(bx, Y, 16, 4.0, 1.0)))
    img = over(img, C(70, 60, 52), (Y >= 9) & (Y < 10))
    # cornice line
    img = over(img, gold, (Y >= 10) & (Y < 13))
    img = over(img, gold * 1.2, ((Y >= 10) & (Y < 11)))
    img = over(img, C(40, 32, 28), (Y >= 13) & (Y < 14))
    # piano nobile
    pil = ((bx < 3) | (bx >= 29)) & (Y >= 14) & (Y < 34)
    img = over(img, pink, pil)
    img = over(img, gold, pil & (Y < 16))
    img = over(img, pink * 0.82, (((bx >= 2) & (bx < 3)) | (bx >= 31)) & (Y >= 16) & (Y < 34))
    win = np.minimum(tl.sd_rect(bx, Y, 10, 21, 22, 33), tl.sd_circle(bx, Y, 16, 21, 6))
    img = img * mask3(1 - 0.3 * tl.fill(win - 1.5, 1.5))
    glass = ramp(np.clip((Y - 15) / 18, 0, 1), C(40, 52, 78), C(56, 62, 84), C(170, 120, 64))
    img = over(img, glass, tl.fill(win))
    img = over(img, gold, tl.ring(win + 0.5, 1.0))
    img = over(img, gold * 1.1, tl.fill(tl.sd_box(bx, Y, 16, 14.6, 1.2, 1.0)))
    img = over(img, gold * 0.9, tl.fill(tl.sd_box(bx, Y, 16, 33.0, 7.5, 0.6)))
    # string course
    img = over(img, gold, (Y >= 34) & (Y < 36))
    img = over(img, gold * 0.7, (Y >= 36) & (Y < 37))
    img = over(img, C(36, 30, 26), (Y >= 37) & (Y < 38))
    # shopfront
    pier = ((bx < 4) | (bx >= 28)) & (Y >= 38) & (Y < 62)
    img = over(img, pink * 0.95, pier)
    shop = tl.sd_rect(bx, Y, 5, 39, 27, 61)
    inside = ramp(np.clip((Y - 39) / 22, 0, 1), C(150, 96, 48), C(236, 186, 112), C(212, 152, 82))
    r = tl.rng(seed, salt, 'goods')
    goods = np.zeros_like(Y)
    goodc = np.zeros((h, w, 3), F)
    for b in range(4):
        for k in range(7):
            gx = 32 * b + r.uniform(8, 24)
            gy = r.uniform(47, 58)
            col = [C(250, 236, 200), GOLD_HI, C(200, 40, 40), C(240, 240, 240), C(120, 40, 120)][int(r.integers(0, 5))]
            m = tl.fill(tl.sd_ellipse(X, Y, gx, gy, r.uniform(0.9, 1.8), r.uniform(1.2, 3.0)))
            goods = np.maximum(goods, m)
            goodc = over(goodc, col, m)
        ch = tl.fill(tl.sd_circle(X, Y, 32 * b + 16, 44.5, 1.3))
        goodc = over(goodc, C(255, 240, 190), ch)
        goods = np.maximum(goods, ch)
    inside = over(inside, goodc, goods)
    img = over(img, inside, tl.fill(shop))
    img = over(img, C(46, 36, 30), tl.fill(shop) * ((Y >= 41) & (Y < 42)))
    img = over(img, gold, tl.ring(shop + 0.5, 1.0))
    img = img * mask3(1 - 0.25 * tl.fill(shop + 1.5) * (1 - tl.fill(shop)))
    img = over(img, GRANITE, Y >= 62)
    img = dirt(img, seed, salt, w, h, 0.14, foot=0.2)
    return grain(np.clip(img, 0, 1), seed, salt)


def f_glass(w, h, seed, salt, storey=18):
    X, Y = tl.coords(w, h)
    sy = Y % storey
    sky = ramp(np.clip(sy / storey, 0, 1), C(160, 196, 206), C(104, 146, 166), C(64, 100, 122))
    diag = 0.5 + 0.5 * np.sin(2 * math.pi * (X / w * 3 + Y / h * 1.0))
    cloud = tl.fbm(w, h, 6, 2, seed, salt + 'c', octaves=3) * 0.5 + 0.5
    img = sky * mask3(0.9 + 0.12 * diag + 0.1 * (cloud - 0.5))
    pid = np.floor(X / 8) + 37 * np.floor(Y / storey)
    tint = tl.rng(seed, salt, 't').uniform(-0.05, 0.05, 1024).astype(F)
    img = img * mask3(1 + tint[(pid.astype(int)) % 1024])
    gold = gold_field(w, h, seed, salt + 'g')
    img = over(img, gold * 0.6, (np.floor(X) % 8) == 0)
    img = over(img, gold, sy < 2)
    img = over(img, C(30, 34, 40), (sy >= 2) & (sy < 3))
    return grain(np.clip(img, 0, 1), seed, salt, 0.02, 0.008)


def f_podium(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    img = marble_field(w, h, seed, salt)
    img = img * mask3(1 - 0.14 * ((np.floor(X) % 16 == 0) | (np.floor(Y) == 14)))
    gold = gold_field(w, h, seed, salt + 'g')
    img = over(img, gold, Y < 3)
    img = over(img, C(50, 42, 34), (Y >= 3) & (Y < 4))
    bx = X % 16
    win = tl.sd_rect(bx, Y, 4, 6, 12, 23)
    img = img * mask3(1 - 0.28 * tl.fill(win - 1.4, 1.2))
    img = over(img, ramp(np.clip((Y - 6) / 17, 0, 1), C(130, 160, 172), C(46, 56, 66), C(70, 60, 50)), tl.fill(win))
    img = over(img, gold, tl.ring(win + 0.5, 1.0))
    img = over(img, GRANITE, Y >= 25)
    img = over(img, GRANITE * 1.4, (Y >= 25) & (Y < 26))
    img = dirt(img, seed, salt, w, h, 0.10, foot=0.3)
    return grain(np.clip(img, 0, 1), seed, salt, 0.025, 0.008)


def f_hotel_upper(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    bx = X % 16
    sy = Y % 20
    stucco = C(214, 188, 172)
    img = marble_field(w, h, seed, salt, base=stucco, vein=C(202, 176, 160))
    img = img * mask3(1 - 0.07 * ((np.floor(Y) % 4) == 3))
    img = over(img, C(238, 222, 204), sy < 1.5)
    img = over(img, C(120, 96, 84), (sy >= 1.5) & (sy < 2.5))
    win = tl.sd_rect(bx, sy, 5, 6, 11, 17)
    img = img * mask3(1 - 0.3 * tl.fill(win - 1.3, 1.2))
    r = tl.rng(seed, salt, 'win')
    states = r.integers(0, 3, 64)
    wid = (np.floor(X / 16) + 8 * np.floor(Y / 20)).astype(int)
    st = states[wid % 64]
    glass = ramp(np.clip((sy - 6) / 11, 0, 1), C(44, 46, 58), C(52, 50, 60))
    lit = ramp(np.clip((sy - 6) / 11, 0, 1), C(200, 150, 84), C(236, 186, 110))
    glass = np.where(mask3(st == 1), lit, glass)
    curtain = (st == 2) & ((bx < 6.6) | (bx >= 9.4))
    glass = over(glass, C(222, 206, 172), curtain)
    img = over(img, glass, tl.fill(win))
    img = over(img, C(242, 228, 210), tl.fill(tl.sd_box(bx, sy, 8, 4.2, 4.2, 0.8)))   # pediment
    img = over(img, C(110, 88, 76), tl.fill(tl.sd_box(bx, sy, 8, 5.3, 3.6, 0.35)))
    rail = (sy >= 14) & (sy < 17) & (bx >= 4) & (bx < 12) & (((np.floor(bx) % 2) == 0) | (sy < 15))
    img = over(img, GOLD_MID, rail)
    img = over(img, C(236, 220, 200), (sy >= 17) & (sy < 18) & (bx >= 4) & (bx < 12))
    streak = tl.blur(((sy >= 18) & (bx >= 5) & (bx < 11)).astype(F), 0.8, 1.5, wrap=tl.STRIP)
    img = img * mask3(1 - 0.12 * streak)
    img = dirt(img, seed, salt, w, h, 0.13)
    return grain(np.clip(img, 0, 1), seed, salt)


def f_hotel_ground(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    bx = X % 16
    img = marble_field(w, h, seed, salt, base=C(200, 180, 162), vein=C(184, 162, 144))
    chan = (np.floor(Y) % 3) == 2
    img = img * mask3(1 - 0.22 * chan)
    win = np.minimum(tl.sd_rect(bx, Y, 4, 10, 12, 20), tl.sd_circle(bx, Y, 8, 10, 4))
    img = img * mask3(1 - 0.3 * tl.fill(win - 1.3, 1.2))
    img = over(img, ramp(np.clip((Y - 6) / 14, 0, 1), C(160, 110, 60), C(236, 188, 112)), tl.fill(win))
    img = over(img, C(80, 60, 40), tl.fill(win) * (np.abs(bx - 8) < 0.5))
    img = over(img, GOLD_MID, tl.ring(win + 0.5, 1.0))
    img = over(img, C(236, 222, 204), tl.fill(tl.sd_box(bx, Y, 8, 5.4, 1.3, 1.4)))
    img = over(img, GRANITE, Y >= 22)
    img = dirt(img, seed, salt, w, h, 0.14, foot=0.35)
    return grain(np.clip(img, 0, 1), seed, salt)


def f_mansard(w, h, seed, salt):
    X, Y = tl.coords(w, h)
    row = np.floor(Y / 3)
    sx = (X + (row % 2) * 2) % 4
    sy = Y % 3
    scale = tl.fill(tl.sd_ellipse(sx, sy, 2.0, 0.6, 2.2, 2.4))
    base = C(70, 78, 94)
    v = tl.white(w, h, seed, salt + 'v')
    tone = tl.fbm(w, h, 4, 4, seed, salt + 't', octaves=3) * 0.08
    img = base[None, None] * mask3(0.9 + 0.12 * scale + tone + 0.05 * (v - 0.5))
    img = img * mask3(1 - 0.25 * (sy >= 2.2))
    img = over(img, C(112, 116, 122), Y < 2)
    img = over(img, C(60, 62, 66), (Y >= 2) & (Y < 2.8))
    bx = X % 32
    sur = tl.sd_ellipse(bx, Y, 16, 15, 4.6, 5.4)
    img = img * mask3(1 - 0.4 * tl.fill(sur - 1.5, 1.5) * (Y > 15))
    img = over(img, C(214, 200, 180), tl.fill(sur))
    wnd = tl.sd_circle(bx, Y, 16, 15.4, 2.7)
    img = over(img, ramp(np.clip((Y - 13) / 5, 0, 1), C(60, 50, 50), C(220, 168, 96)), tl.fill(wnd))
    img = over(img, GOLD_MID, tl.ring(wnd, 0.9))
    img = over(img, GOLD_HI, tl.fill(tl.sd_box(bx, Y, 16, 8.6, 1.6, 0.9)))
    img = over(img, GOLD_MID, Y >= 30)
    img = over(img, GOLD_SH, Y >= 31)
    return grain(np.clip(img, 0, 1), seed, salt, 0.025, 0.008)


def side_of(name):
    return name.replace('_side', '_front').replace('side', 'front')


def paint_facade(spec, seed, painters):
    """painters: {region: fn(w, h, seed, salt)}; *_side regions are painted from their *_front twin."""
    w, h = spec['size']
    sheet = np.zeros((h, w, 3), F)
    for name, reg in spec['regions'].items():
        x, y, rw, rh = reg['rect']
        if name in painters:
            img = painters[name](rw, rh, seed, name)
        else:
            twin = side_of(name)
            k = 0.75 if ('glass' in name or 'mansard' in name) else SIDE
            img = painters[twin](rw, rh, seed, twin) * F(k)
            if 'glass' in name:
                img = img + np.array([-0.01, 0.01, 0.015], F)
        put(sheet, reg['rect'], np.clip(img, 0, 1))
    return sheet


PAINTERS = {
    'env_bld_commercial_rich_facade': {'front': f_commercial},
    'env_bld_mixeduse_rich_facade': {'glass_front': f_glass, 'podium_front': f_podium},
    'env_bld_residential_rich_facade': {'upper_front': f_hotel_upper, 'ground_front': f_hotel_ground},
    'env_bld_residential_rich_roof': {'mansard_front': f_mansard},
}


# ---------------------------------------------------------------------------------------------------------
# Main and previews

def check_layout(spec, name):
    w, h = spec['size']
    occ = np.zeros((h, w), int)
    for rn, reg in spec['regions'].items():
        x, y, rw, rh = reg['rect']
        assert x >= 0 and y >= 0 and x + rw <= w and y + rh <= h, (name, rn, 'leaves the sheet')
        occ[y:y + rh, x:x + rw] += 1
    assert occ.max() <= 1, (name, 'regions overlap')


def paint(name, spec, layout):
    check_layout(spec, name)
    shades = layout['lighting']['band_shades']
    if name == 'bld_b_rich_trim':
        return paint_trim(spec, shades, SEED)
    if name == 'bld_b_rich_cutout':
        return paint_cutout(spec, SEED)
    missing = [r for r in spec['regions'] if r not in PAINTERS[name] and side_of(r) not in PAINTERS[name]]
    assert not missing, (name, 'no painter for', missing)
    return paint_facade(spec, SEED, PAINTERS[name])


def save(path, img):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    mode = 'RGBA' if img.shape[2] == 4 else 'RGB'
    Image.fromarray(tl.to_u8(img), mode).save(path, optimize=True)


def preview(outdir, results, layout):
    os.makedirs(outdir, exist_ok=True)
    items = []
    for name, img in results.items():
        spec = layout['textures'][name]
        rgb = img[..., :3]
        if img.shape[2] == 4:
            chk = ((np.indices(rgb.shape[:2]).sum(0) // 4) % 2)[..., None] * 0.25 + 0.35
            rgb = rgb * img[..., 3:4] + chk * (1 - img[..., 3:4])
        regs = {k: v['rect'] for k, v in spec['regions'].items()}
        im = tl.outline_regions(rgb, regs, scale=4)
        im.save(os.path.join(outdir, f'{name}_regions.png'))
        items.append((name + ' x4', im))
        tiled = Image.fromarray(tl.to_u8(np.tile(rgb, (1, 2, 1))), 'RGB')
        items.append((name + ' tiled 2x along U (x3)', tiled.resize((tiled.width * 3, tiled.height * 3), Image.NEAREST)))
    ref = []
    for n in ('building1', 'building2', 'building4', 'building5', 'flag', 'billboard'):
        p = os.path.join(ROOT, 'public', 'textures', 'map', n + '.png')
        im = Image.open(p).convert('RGB')
        ref.append((n + ' (ref x4)', im.resize((im.width * 4, im.height * 4), Image.NEAREST)))
    tl.contact_sheet(items + ref, max_width=2200).save(os.path.join(outdir, 'contact.png'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*')
    ap.add_argument('--preview')
    a = ap.parse_args()
    with open(LAYOUT, encoding='utf-8') as fh:
        layout = json.load(fh)
    results = {}
    for name, spec in layout['textures'].items():
        if a.only and name not in a.only:
            continue
        img = paint(name, spec, layout)
        assert list(img.shape[1::-1]) == spec['size'], (name, img.shape)
        save(os.path.join(ROOT, spec['file']), img)
        results[name] = img
        print('wrote', spec['file'], img.shape[1], 'x', img.shape[0])
    if a.preview:
        preview(a.preview, results, layout)


if __name__ == '__main__':
    main()
