"""bld_a family textures (rich apartment tower, rich civic palace) for dict-three's Street tab.

    python tools/texgen/bld_a.py [--only <texture> ...] [--preview build/visual_gaps/bld_a/tex]

Reads every size and rect from tools/texgen/bld_a_layout.json and writes the PNGs it names under
public/textures/map/. The mixed-use normal model reuses existing textures (building4, concrete_*), so
nothing is painted for it. Everything is painted at S x the final size in native-pixel coordinates and
box-filtered down, so edges are anti-aliased but every final pixel is a deliberate one. All noise is
seeded (SEED) and periodic on whole-number lattices, so strips tile along U and re-runs are identical.

The game lights the street with one flat ambient light and ignores vertex colour: every painter bakes
its own form (cylindrical shading on columns, shade under cornices and balcony slabs, darker '_shade'
variants for the side faces).
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
LAYOUT = os.path.join(ROOT, 'tools', 'texgen', 'bld_a_layout.json')
SEED = 4417
S = 4  # supersampling factor
F = np.float32

# ---------------------------------------------------------------------------------------------------------
# Palette (0-1 floats)
MARBLE = tl.rgb(230, 212, 200)
MARBLE_PINK = tl.rgb(222, 184, 176)
VEIN = tl.rgb(150, 130, 135)
RED = tl.rgb(168, 26, 24)
RED_DARK = tl.rgb(96, 12, 14)
CREAM = tl.rgb(236, 222, 192)
INK = tl.rgb(30, 20, 18)
GOLD_LO = tl.rgb(105, 66, 18)
GOLD_MID = tl.rgb(200, 150, 52)
GOLD_HI = tl.rgb(250, 218, 128)
GLASS_DARK = tl.rgb(42, 46, 58)


def grid(w, h):
    """Pixel-centre grids at S x resolution, in NATIVE pixel units (so shapes are specified in final px)."""
    X, Y = np.meshgrid((np.arange(w * S, dtype=F) + F(0.5)) / S, (np.arange(h * S, dtype=F) + F(0.5)) / S)
    return X, Y


def noise(w, h, cx, cy, salt, octaves=4, gain=0.5):
    return tl.fbm(w * S, h * S, cx, cy, SEED, salt, octaves=octaves, gain=gain)


def fill(sd, aa=0.6):
    """Coverage of a signed distance given in native px (aa in native px)."""
    return tl.smoothstep(aa, -aa, sd)


def gold(t):
    """Gilt ramp: t 0 = shadow, 0.5 = body, 1 = highlight (t may be an array)."""
    t = np.clip(np.asarray(t, F), 0, 1)[..., None]
    lo = GOLD_LO + (GOLD_MID - GOLD_LO) * np.clip(t * 2, 0, 1)
    return lo + (GOLD_HI - GOLD_MID) * np.clip(t * 2 - 1, 0, 1)


def down(img):
    """Box filter S x S back to native size."""
    h, w = img.shape[0] // S, img.shape[1] // S
    return img.reshape(h, S, w, S, -1).mean(axis=(1, 3))


def grain(img, salt, amount=0.035):
    """Photo grain at native resolution (luminance + a little per channel)."""
    r = tl.rng(SEED, 'grain', salt)
    h, w = img.shape[:2]
    lum = r.normal(0, amount, (h, w, 1)).astype(F)
    ch = r.normal(0, amount * 0.35, (h, w, 3)).astype(F)
    out = img.copy()
    out[..., :3] = np.clip(img[..., :3] * (1 + lum) + ch, 0, 1)
    return out


def marble(w, h, salt, base=MARBLE, tile_u=True, vein_amt=0.22):
    """Veined marble at S x: warped fBm veins (thin dark lines) and soft mottling. Periodic when tile_u."""
    n1 = noise(w, h, max(1, w // 16), max(1, h // 16), salt + 'm1', 4, 0.55)
    n2 = noise(w, h, max(1, w // 8), max(1, h // 8), salt + 'm2', 3, 0.5)
    v = np.abs(np.sin((n1 * 3.2 + n2 * 1.3) * math.pi))
    veins = tl.smoothstep(0.12, 0.0, v)
    img = tl.solid(w * S, h * S, base) * (0.95 + 0.06 * n2)[..., None]
    return tl.mix(img, VEIN, veins * vein_amt)


def sd_star(X, Y, cx, cy, r, points=5, inner=0.45, rot=-math.pi / 2):
    """Approximate signed distance to a star polygon (good enough for filled, anti-aliased stars)."""
    dx, dy = X - cx, Y - cy
    a = np.arctan2(dy, dx) - rot
    rad = np.hypot(dx, dy)
    seg = 2 * math.pi / points
    t = np.abs(((a % seg) + seg) % seg - seg / 2) / (seg / 2)  # 0 at a point, 1 between points
    edge = r * (inner + (1 - inner) * (1 - t) ** 1.6)
    return rad - edge


def sd_leader(X, Y, cx, cy, R):
    """The leader's bust in a peaked cap, three-quarter profile facing +x, fitted in a circle of radius R.
    Returns (signed distance of the silhouette, signed distance of the gold cap badge)."""
    u, v = (X - cx) / R, (Y - cy) / R
    v = v + 0.12                                         # whole bust sits a little high
    tilt = v + 0.12 * u                                  # cap crown tilts up toward the front
    parts = [
        tl.sd_ellipse(u, v, -0.05, 0.9, 1.05, 0.42),     # shoulders
        tl.sd_box(u, v, -0.02, 0.42, 0.18, 0.2),         # neck
        tl.sd_ellipse(u, v, -0.02, 0.0, 0.3, 0.34),      # head
        tl.sd_ellipse(u, v, 0.14, 0.23, 0.18, 0.13),     # jaw / chin
        tl.sd_circle(u, v, 0.3, 0.0, 0.085),             # nose
        tl.sd_ellipse(u, v, 0.25, 0.13, 0.2, 0.1),       # moustache
        tl.sd_ellipse(u, tilt, -0.02, -0.44, 0.52, 0.16),  # cap crown (wide, flat)
        tl.sd_box(u, v, 0.02, -0.29, 0.34, 0.1),         # cap band
        tl.sd_ellipse(u, v, 0.33, -0.2, 0.18, 0.075),    # visor
    ]
    sd = parts[0]
    for p in parts[1:]:
        sd = np.minimum(sd, p)
    badge = tl.sd_circle(u, v, 0.08, -0.36, 0.08)
    epaulettes = np.minimum(tl.sd_ellipse(u, v, -0.62, 0.58, 0.24, 0.08), tl.sd_ellipse(u, v, 0.5, 0.58, 0.24, 0.08))
    return sd * R, np.minimum(badge, epaulettes) * R


def medallion(img, X, Y, cx, cy, R, ring=2.0):
    """Gold ring, cream field, black bust. Paints into img (S x canvas) in place and returns it."""
    d = tl.sd_circle(X, Y, cx, cy, R)
    ring_t = 0.5 + 0.5 * np.cos(np.clip((d + ring / 2) / (ring / 2), -1, 1) * math.pi / 2)
    field = tl.solid(X.shape[1], X.shape[0], CREAM) * (0.86 + 0.14 * tl.smoothstep(R, 0, np.hypot(X - cx, Y - cy + R * 0.3)))[..., None]
    img = tl.mix(img, field, fill(d + ring))
    sil, badge = sd_leader(X, Y, cx, cy + R * 0.08, R - ring)
    inside = fill(d + ring)
    img = tl.mix(img, INK, fill(sil) * inside)
    img = tl.mix(img, gold(0.85), fill(badge) * inside)
    img = tl.mix(img, gold(ring_t * 0.9 + 0.05), fill(np.abs(d + ring / 2) - ring / 2))
    return img


def shading_profile(x, w, depth=0.3):
    """Cylindrical shading across a face of width w: 1 in the middle, 1 - depth at the edges."""
    t = (x - w / 2) / (w / 2)
    return 1 - depth * np.clip(t, -1, 1) ** 2


# ---------------------------------------------------------------------------------------------------------
# bld_a_rich_trim

def paint_column(w, h):
    X, Y = grid(w, h)
    img = marble(w, h, 'col', MARBLE, vein_amt=0.15)
    flutes = sum(fill(np.abs(X - fx) - 0.45) for fx in (4.0, 8.0, 12.0))
    img = tl.shade(img, 1 - 0.18 * flutes * ((Y > 14) & (Y < 88)))
    # capital (rows 0-14): abacus, volutes, two rows of acanthus
    cap = Y < 14
    t = 0.55 + 0.2 * noise(w, h, 2, 6, 'capn')
    t = np.where(Y < 2.2, 0.85, t)                                   # abacus
    t = np.where((Y >= 2.2) & (Y < 3.0), 0.12, t)                    # shadow under abacus
    for vx in (2.6, 13.4):
        dv = tl.sd_circle(X, Y, vx, 5.0, 2.4)
        spiral = 0.5 + 0.5 * np.sin(np.hypot(X - vx, Y - 5.0) * 3.2 + np.arctan2(Y - 5.0, X - vx))
        t = np.where(dv < 0, 0.35 + 0.6 * spiral, t)
    for row_y, xs, rr in ((10.5, (2.0, 6.0, 10.0, 14.0), 2.3), (7.8, (4.0, 8.0, 12.0), 2.0)):
        for lx in xs:
            dl = tl.sd_ellipse(X, Y, lx, row_y, rr * 0.8, rr)
            leaf = np.clip(-dl / rr, 0, 1)
            t = np.where((dl < 0) & (Y > 3), 0.4 + 0.55 * leaf, t)
    t = np.where((Y > 12.8) & (Y < 14), 0.15, t)                     # necking shadow
    img = np.where(cap[..., None], gold(t), img)
    # base (rows 88-96): torus, scotia, plinth
    tb = np.where(Y < 89, 0.15, np.where(Y < 91.5, 0.9 - 0.5 * np.abs(Y - 90.2) / 1.3,
                  np.where(Y < 92.5, 0.2, 0.55 - 0.25 * (Y - 92.5) / 3.5)))
    img = np.where((Y >= 88)[..., None], gold(tb), img)
    img = tl.shade(img, shading_profile(X, w, 0.32))
    return img


def paint_banner(w, h):
    X, Y = grid(w, h)
    folds = 0.86 + 0.14 * np.sin(X * 2 * math.pi / 7.0 + 0.6 * noise(w, h, 2, 6, 'fold'))
    img = tl.solid(w * S, h * S, RED) * folds[..., None]
    img = tl.mix(img, RED_DARK, 0.25 * tl.smoothstep(60, 90, Y))
    border = (X < 2) | (X > w - 2)
    img = np.where(border[..., None], gold(0.45 + 0.3 * folds), img)
    img = np.where(((Y > 80) & (Y < 81.5) | (Y > 83) & (Y < 84))[..., None], gold(0.6), img)
    fringe = Y > 91
    comb = 0.5 + 0.5 * np.cos(X * 2 * math.pi / 2.0)
    img = np.where(fringe[..., None], gold(0.2 + 0.6 * comb * tl.smoothstep(96, 92, Y)), img)
    rod = Y < 6
    img = np.where(rod[..., None], gold(0.9 - 0.7 * np.abs(Y - 2.5) / 3.5), img)
    img = np.where((rod & ((X < 1.5) | (X > w - 1.5)))[..., None], gold(0.1), img)
    img = tl.shade(img, 1 - 0.25 * tl.smoothstep(6, 9, Y) * tl.smoothstep(12, 6, Y) * 0 - 0.18 * tl.smoothstep(9, 6, Y) * (Y >= 6))
    img = medallion(img, X, Y, 16.0, 30.0, 13.0)
    img = tl.mix(img, gold(0.75), fill(sd_star(X, Y, 16.0, 54.0, 5.0)))
    for sx in (7.0, 25.0):
        img = tl.mix(img, gold(0.6), fill(sd_star(X, Y, sx, 54.5, 2.6)))
    return img


def paint_door(w, h):
    X, Y = grid(w, h)
    img = marble(w, h, 'door', MARBLE_PINK, vein_amt=0.12)
    arch_c, arch_r = (16.0, 19.0), 10.5
    d_open = np.minimum(tl.sd_circle(X, Y, *arch_c, arch_r), tl.sd_rect(X, Y, 5.5, 19.0, 26.5, 45.0))
    # moulding ring around the opening
    img = tl.mix(img, tl.shade(img, 0.75), fill(np.abs(d_open - 1.6) - 0.8))
    img = tl.mix(img, gold(0.8), fill(tl.sd_box(X, Y, 16, 7.4, 2.2, 1.8)))       # keystone
    inside = fill(d_open)
    fan = Y < 19.5
    ang = np.arctan2(Y - 19.5, X - 16.0)
    bars = fill(np.abs(np.sin(ang * 6)) - 0.18)
    fan_img = tl.mix(tl.solid(w * S, h * S, GLASS_DARK), gold(0.6), bars * 0.9)
    leaf = gold(0.5 + 0.12 * noise(w, h, 2, 4, 'leaf'))
    for (x0, x1) in ((6.5, 15.0), (17.0, 25.5)):
        for (y0, y1) in ((22.0, 31.0), (33.0, 43.0)):
            dp = tl.sd_rect(X, Y, x0, y0, x1, y1)
            leaf = tl.mix(leaf, gold(0.25), fill(np.abs(dp) - 0.45))
            leaf = tl.mix(leaf, gold(0.72), fill(dp + 1.2) * 0.6)
    leaf = tl.mix(leaf, gold(0.95), fill(np.abs(X - 16.0) - 0.5))
    door_img = np.where(fan[..., None], fan_img, leaf)
    door_img = tl.shade(door_img, 1 - 0.35 * tl.smoothstep(-2.5, 0, d_open))   # reveal occlusion
    img = tl.mix(img, door_img, inside)
    img = np.where((Y > 45)[..., None], tl.solid(w * S, h * S, RED) * 0.9, img)
    return img


def paint_gilt(w, h):
    X, Y = grid(w, h)
    v = 1 - Y / h                                    # 0 at the rim, 1 at the apex
    t = 0.45 + 0.3 * np.exp(-((v - 0.45) / 0.22) ** 2) - 0.25 * tl.smoothstep(0.2, 0.0, v)
    sx, sy = 8.0, 6.0                                # fish-scale rows
    row = np.floor(Y / sy)
    xs = X + (row % 2) * sx / 2
    scale_d = np.hypot(tl.wrap_delta(xs - sx / 2, sx), (Y - row * sy) - 0.0) - sx / 2
    t = t - 0.12 * fill(np.abs(scale_d) - 0.35)
    t = t + 0.06 * noise(w, h, 3, 3, 'gn')
    dist = np.minimum(X, w - X)
    t = np.where(dist < 2.4, 0.95 - 0.25 * dist / 2.4, t)          # rib (half on each edge)
    t = np.where((dist >= 2.4) & (dist < 3.4), 0.12, t)            # line beside it
    return gold(t)


def paint_canopy(w, h):
    X, Y = grid(w, h)
    folds = 0.9 + 0.1 * np.sin(Y * 2 * math.pi / 4.0)
    img = tl.solid(w * S, h * S, RED) * folds[..., None]
    edge = (X < 3) | (X > w - 3) | (Y < 3) | ((Y > 13) & (Y < 16))
    img = np.where(edge[..., None], gold(0.6), img)
    sc = np.hypot(tl.wrap_delta(X - 2.0, 4.0), Y - 19.0) - 2.6     # scallops hanging from row 19
    val = gold(0.7 - 0.3 * (Y - 16) / 8)
    scallop = tl.mix(gold(0.35 + 0.4 * (0.5 + 0.5 * np.cos(X * math.pi))), RED_DARK * 0.6, fill(-sc))
    val = np.where((Y >= 19)[..., None], scallop, val)
    img = np.where((Y >= 16)[..., None], val, img)
    return img


def paint_flag(w, h):
    X, Y = grid(w, h)
    folds = 0.85 + 0.15 * np.sin(X * 2 * math.pi / 10.0 + Y * 0.15)
    img = tl.solid(w * S, h * S, RED) * folds[..., None]
    img = tl.mix(img, gold(0.75), fill(sd_star(X, Y, 10.0, 12.0, 5.0)))
    ring = np.abs(tl.sd_circle(X, Y, 10.0, 12.0, 7.6)) - 0.7
    gap = (np.abs(X - 10.0) < 2.0) & (Y < 8)
    img = tl.mix(img, gold(0.6), fill(ring) * (~gap))
    return img


def paint_marble_pavers(w, h):
    X, Y = grid(w, h)
    img = marble(w, h, 'pav', MARBLE, vein_amt=0.18)
    cell = 12.0
    ids = (np.floor(X / cell) + 7 * np.floor(Y / cell)) % 5
    img = tl.shade(img, 0.94 + 0.03 * ids)
    joint = fill(np.minimum(np.abs(tl.wrap_delta(X, cell)), np.abs(tl.wrap_delta(Y, cell))) - 0.5)
    img = tl.shade(img, 1 - 0.22 * joint)
    edge = np.minimum(np.minimum(X, w - X), np.minimum(Y, h - Y))
    img = tl.shade(img, 0.7 + 0.3 * tl.smoothstep(0.5, 3.0, edge))
    return img


def paint_cornice(w, h):
    X, Y = grid(w, h)
    t = np.full_like(X, 0.5)
    t = np.where(Y < 2, 0.9 - 0.2 * Y / 2, t)                                          # lip
    dent = (np.abs(tl.wrap_delta(X - 1.0, 4.0)) < 1.0) & (Y >= 2) & (Y < 4.2)
    t = np.where((Y >= 2) & (Y < 4.2), np.where(dent, 0.62, 0.12), t)                  # dentils
    t = np.where((Y >= 4.2) & (Y < 5), 0.2, t)
    egg = tl.sd_ellipse(tl.wrap_delta(X - 4.0, 8.0), Y - 7.4, 0.0, 0.0, 2.2, 2.4)
    dart = np.abs(tl.wrap_delta(X, 8.0)) - 0.5 * tl.smoothstep(10, 5.5, Y)
    band = (Y >= 5) & (Y < 10)
    t = np.where(band, 0.3, t)
    t = np.where(band & (egg < 0), 0.45 + 0.5 * np.clip(-egg / 2.2, 0, 1), t)
    t = np.where(band & (dart < 0) & (egg > 0.4), 0.8, t)
    t = np.where(Y >= 10, 0.35 - 0.3 * (Y - 10) / 2, t)                                # cast shadow
    return gold(t)


def paint_rail(w, h):
    """Returns RGBA (alpha in the 4th channel)."""
    X, Y = grid(w, h)
    dx = tl.wrap_delta(X - 4.0, 8.0)
    yy = (Y - 2) / 8.0                                            # 0..1 down the baluster
    half = 0.9 + 1.1 * np.exp(-((yy - 0.62) / 0.2) ** 2) - 0.35 * np.exp(-((yy - 0.15) / 0.08) ** 2)
    bal = fill(np.abs(dx) - half) * ((Y > 2) & (Y < 10.5))
    rails = ((Y < 2.2) | (Y > 10.2)).astype(F)
    a = np.clip(bal + rails, 0, 1)
    t = np.where(Y < 2.2, 0.85 - 0.3 * Y / 2.2, 0.45 + 0.4 * np.clip(1 - np.abs(dx) / np.maximum(half, 0.1), 0, 1))
    t = np.where(Y > 10.2, 0.4, t)
    rgb = gold(t)
    return np.concatenate([rgb, a[..., None]], axis=-1)


def paint_carpet(w, h):
    X, Y = grid(w, h)
    pile = 0.9 + 0.1 * noise(w, h, 16, 1, 'pile', 3)
    img = tl.solid(w * S, h * S, tl.rgb(150, 18, 26)) * pile[..., None]
    lines = (np.abs(Y - 1.5) < 0.5) | (np.abs(Y - 6.5) < 0.5)
    img = np.where(lines[..., None], gold(0.7), img)
    img = tl.shade(img, 0.85 + 0.15 * tl.smoothstep(0, 1.0, np.minimum(Y, h - Y)))
    return img


TRIM_PAINTERS = {
    'column': paint_column, 'banner': paint_banner, 'door': paint_door, 'gilt': paint_gilt,
    'canopy': paint_canopy, 'flag': paint_flag, 'marble': paint_marble_pavers,
    'cornice': paint_cornice, 'rail': paint_rail, 'carpet': paint_carpet,
}


# ---------------------------------------------------------------------------------------------------------
# env_bld_apartment_rich_facade (strips tile along U: every period divides the width)

def paint_tower(w, h):
    X, Y = grid(w, h)
    # gold-mirror glass with diagonal reflection streaks and a soft sky blotch
    # bronze-gold mirror glass: darker and browner than the gilt trim, with pale sky streaks, so the
    # glass bands and the gilt read as two materials
    refl = 0.5 + 0.5 * np.sin((X + 0.9 * Y) * 2 * math.pi / 32.0)
    sky = noise(w, h, 4, 1, 'sky', 3)
    t = 0.3 + 0.16 * refl ** 3 + 0.08 * sky
    glass = gold(t) * tl.rgb(215, 190, 170)
    glass = tl.mix(glass, tl.rgb(200, 190, 165), 0.35 * tl.smoothstep(0.75, 1.0, refl) * (sky > -0.1))
    glass = tl.shade(glass, 0.85 + 0.15 * (1 - (Y - 9) / 18.0))
    mull = fill(np.abs(tl.wrap_delta(X, 8.0)) - 0.4) + fill(np.abs(Y - 14.0) - 0.4)
    glass = tl.mix(glass, tl.rgb(60, 42, 24), np.clip(mull, 0, 1))
    img = marble(w, h, 'twr', MARBLE_PINK, vein_amt=0.15)
    img = np.where(((Y >= 9) & (Y < 27))[..., None], glass, img)
    img = tl.mix(img, gold(0.75), fill(np.abs(Y - 27.3) - 0.5))                    # sill line
    img = tl.mix(img, gold(0.6), fill(np.abs(Y - 8.3) - 0.45))                     # head line
    img = tl.shade(img, np.where(Y < 6, 0.66 + 0.34 * Y / 6.0, 1.0))               # under the slab above
    img = tl.shade(img, 1 - 0.3 * tl.smoothstep(10.5, 9.0, Y) * (Y >= 9))          # glass head shadow
    pil = np.abs(tl.wrap_delta(X, 32.0))                                           # marble piers, gilt edges
    pier = marble(w, h, 'pier', MARBLE, vein_amt=0.12)
    img = np.where(((pil < 2.0) & (Y >= 9) & (Y < 27))[..., None], pier, img)
    img = tl.mix(img, gold(0.7), fill(np.abs(pil - 2.3) - 0.45) * ((Y >= 9) & (Y < 27)))
    img = tl.mix(img, tl.shade(img, 0.7), fill(np.abs(pil - 3.1) - 0.4) * ((Y >= 9) & (Y < 27)))
    return img


def paint_podium(w, h):
    X, Y = grid(w, h)
    img = marble(w, h, 'pod', tl.rgb(232, 206, 196), vein_amt=0.12)
    course = np.floor(Y / 5.0)
    groove = fill(np.abs(tl.wrap_delta(Y, 5.0)) - 0.45)
    vj = fill(np.abs(tl.wrap_delta(X + (course % 2) * 8.0, 16.0)) - 0.45)
    img = tl.shade(img, 1 - 0.25 * np.clip(groove + vj, 0, 1))
    bx = tl.wrap_delta(X - 16.0, 32.0)                       # window centred in each 32 px bay
    d_win = np.minimum(tl.sd_circle(bx, Y, 0.0, 15.0, 7.0), tl.sd_rect(bx, Y, -7.0, 15.0, 7.0, 29.0))
    interior = tl.solid(w * S, h * S, tl.rgb(205, 150, 78)) * (0.55 + 0.45 * tl.smoothstep(29, 12, Y))[..., None]
    interior = tl.mix(interior, tl.rgb(255, 235, 170), fill(np.hypot(bx, Y - 17.0) - 1.3))   # chandelier
    interior = tl.mix(interior, tl.rgb(80, 50, 30), fill(np.abs(bx) - 0.4) * (Y > 15))       # mullion
    img = tl.mix(img, interior, fill(d_win))
    img = tl.mix(img, gold(0.7), fill(np.abs(d_win - 0.8) - 0.7))                             # frame
    img = tl.mix(img, gold(0.85), fill(tl.sd_box(bx, Y, 0.0, 7.0, 1.6, 1.4)))                 # keystone
    img = tl.shade(img, 1 - 0.28 * tl.smoothstep(-2.5, 0.0, d_win) * (d_win < 0))
    img = tl.shade(img, np.where(Y < 5, 0.55 + 0.45 * Y / 5.0, 1.0))                          # entablature shade
    img = tl.shade(img, np.where(Y > 30, 0.8, 1.0))                                           # plinth
    return img


# ---------------------------------------------------------------------------------------------------------
# env_bld_civic_rich_facade

def paint_palace_wall(w, h):
    X, Y = grid(w, h)
    img = marble(w, h, 'pal', tl.rgb(230, 208, 192), vein_amt=0.1)
    # rusticated base (rows 46-64)
    base = Y >= 46
    stone = marble(w, h, 'rus', tl.rgb(196, 166, 158), vein_amt=0.1)
    course = np.floor((Y - 46) / 4.5)
    groove = fill(np.abs(tl.wrap_delta(Y - 46, 4.5)) - 0.55) + fill(np.abs(tl.wrap_delta(X + (course % 2) * 4.0, 8.0)) - 0.5)
    stone = tl.shade(stone, 1 - 0.35 * np.clip(groove, 0, 1))
    img = np.where(base[..., None], stone, img)
    bx = tl.wrap_delta(X - 8.0, 16.0)
    d_arch = np.minimum(tl.sd_circle(bx, Y, 0, 54.0, 4.0), tl.sd_rect(bx, Y, -4.0, 54.0, 4.0, 64.5))
    dark = tl.solid(w * S, h * S, tl.rgb(52, 40, 38)) * (0.7 + 0.3 * tl.smoothstep(54, 64, Y))[..., None]
    img = tl.mix(img, dark, fill(d_arch))
    img = tl.mix(img, gold(0.65), fill(np.abs(d_arch - 0.7) - 0.6))
    # gold pilasters between bays (rows 6-46)
    pil = np.abs(tl.wrap_delta(X, 16.0))
    img = np.where(((pil < 1.2) & (Y >= 6) & (Y < 46))[..., None], gold(0.75 - 0.3 * pil / 1.2), img)
    img = tl.mix(img, tl.shade(img, 0.75), fill(np.abs(pil - 1.6) - 0.35) * ((Y >= 6) & (Y < 46)))
    # windows: upper storey rows 11-22, piano nobile rows 30-43
    bay = np.floor((X - 8.0) / 16.0 + 0.5)
    for (y0, y1) in ((11.0, 22.0), (30.0, 43.0)):
        d_w = tl.sd_rect(bx, Y, -3.0, y0, 3.0, y1)
        glint = 0.8 + 0.35 * tl.smoothstep(y1, y0, Y) * (np.abs(bx + 1) < 1)
        glass = tl.solid(w * S, h * S, GLASS_DARK) * glint[..., None]
        glass = tl.mix(glass, tl.rgb(110, 90, 60), np.clip(fill(np.abs(bx) - 0.35) + fill(np.abs(Y - (y0 + y1) / 2 + 2) - 0.35), 0, 1))
        img = tl.mix(img, glass, fill(d_w))
        img = tl.mix(img, gold(0.7), fill(np.abs(d_w - 0.6) - 0.55))
        img = tl.mix(img, tl.shade(img, 0.7), fill(tl.sd_rect(bx, Y, -3.5, y1 + 1.0, 3.5, y1 + 2.0)))  # sill shadow
    # pediments over the piano nobile: triangular on even bays, segmental on odd
    d_tri = np.maximum(Y - 29.2, (np.abs(bx) * 0.6) - (Y - 25.2))
    d_seg = np.maximum(Y - 29.2, tl.sd_circle(bx, Y, 0, 31.5, 5.0))
    d_ped = np.where((bay % 2) == 0, d_tri, d_seg)
    d_ped = np.maximum(d_ped, np.abs(bx) - 4.2)
    img = tl.mix(img, gold(0.62 + 0.25 * tl.smoothstep(29, 25, Y)), fill(d_ped))
    img = tl.mix(img, tl.shade(img, 0.72), fill(np.abs(Y - 29.9) - 0.5) * (np.abs(bx) < 4.2))
    # string courses and cornice
    img = tl.mix(img, gold(0.6), fill(np.abs(Y - 26.0) - 0.45))
    img = tl.mix(img, gold(0.7), fill(np.abs(Y - 45.6) - 0.6))
    img = tl.shade(img, np.where((Y > 46.2) & (Y < 48.5), 0.72, 1.0))
    t = np.where(Y < 2, 0.85, np.where(Y < 4, np.where(np.abs(tl.wrap_delta(X, 4.0)) < 1.0, 0.6, 0.15), 0.1))
    img = np.where((Y < 6)[..., None], gold(t), img)
    img = tl.shade(img, np.where((Y >= 6) & (Y < 9), 0.6 + 0.4 * (Y - 6) / 3.0, 1.0))           # cornice shadow
    img = tl.shade(img, 1 - 0.12 * tl.smoothstep(54, 64, Y))                                   # ground grime
    return img


# ---------------------------------------------------------------------------------------------------------
# env_bld_civic_rich_parts

def paint_drum(w, h):
    X, Y = grid(w, h)
    img = marble(w, h, 'drum', tl.rgb(232, 212, 196), vein_amt=0.1)
    bx = tl.wrap_delta(X - 8.0, 16.0)
    d_w = np.minimum(tl.sd_circle(bx, Y, 0, 12.0, 3.0), tl.sd_rect(bx, Y, -3.0, 12.0, 3.0, 27.0))
    img = tl.mix(img, tl.solid(w * S, h * S, GLASS_DARK) * (0.8 + 0.3 * tl.smoothstep(27, 10, Y))[..., None], fill(d_w))
    img = tl.mix(img, gold(0.7), fill(np.abs(d_w - 0.6) - 0.5))
    px = np.abs(tl.wrap_delta(X, 16.0))
    for off in (1.6, 3.4):
        img = np.where(((np.abs(px - off) < 0.7) & (Y > 4) & (Y < 29))[..., None], gold(0.75), img)
    img = np.where((Y < 4)[..., None], gold(np.where(Y < 1.5, 0.85, np.where(Y < 3, 0.45, 0.15))), img)
    img = tl.shade(img, np.where((Y >= 4) & (Y < 6), 0.65 + 0.35 * (Y - 4) / 2, 1.0))
    img = tl.shade(img, np.where(Y > 29, 0.6, 1.0))
    return img


def paint_stair(w, h):
    X, Y = grid(w, h)
    img = marble(w, h, 'stair', tl.rgb(226, 214, 204), vein_amt=0.12)
    img = tl.shade(img, 0.92 + 0.08 * noise(w, h, 8, 1, 'worn'))
    img = tl.shade(img, np.where(Y < 10, 0.9 + 0.12 * Y / 10.0, 0.66 + 0.1 * (Y - 10) / 6.0))
    img = tl.mix(img, tl.rgb(245, 238, 228), fill(np.abs(Y - 9.3) - 0.5))       # nosing highlight
    img = tl.shade(img, np.where((Y >= 10) & (Y < 11.5), 0.6, 1.0))
    return img


def paint_attic(w, h):
    X, Y = grid(w, h)
    img = marble(w, h, 'attic', tl.rgb(230, 210, 194), vein_amt=0.1)
    bx = tl.wrap_delta(X - 16.0, 32.0)
    d_p = tl.sd_rect(bx, Y, -12.0, 8.0, 12.0, 26.0)
    img = tl.shade(img, np.where(d_p < 0, 0.88, 1.0))
    img = tl.mix(img, tl.shade(img, 0.65), fill(np.abs(d_p) - 0.6))
    ring = np.abs(np.hypot(bx, Y - 17.0) - 6.0) - 1.0
    leaves = 0.5 + 0.5 * np.cos(np.arctan2(Y - 17.0, bx) * 14)
    img = tl.mix(img, gold(0.35 + 0.5 * leaves), fill(ring) * (np.abs(bx) > 1.2))
    img = tl.mix(img, gold(0.8), fill(sd_star(bx, Y, 0.0, 17.0, 3.6)))
    pil = np.abs(tl.wrap_delta(X, 32.0))
    img = tl.mix(img, tl.shade(img, 1.08), fill(pil - 2.0))
    img = tl.mix(img, tl.shade(img, 0.7), fill(np.abs(pil - 2.4) - 0.4))
    img = np.where((Y < 2.5)[..., None], gold(0.8 - 0.4 * Y / 2.5), img)
    img = tl.shade(img, np.where(Y > 28, 0.7, 1.0))
    return img


def paint_tympanum(w, h):
    X, Y = grid(w, h)
    # triangle: base (0, h)-(w, h), apex (w/2, 0); d_side < 0 inside, in px from the nearer slope
    slope = h / (w / 2.0)
    d_side = ((h - (w / 2.0 - np.abs(X - w / 2.0)) * slope) - Y) / math.hypot(1, slope)
    img = marble(w, h, 'tym', MARBLE_PINK, vein_amt=0.12)
    ang = np.arctan2(Y - (h - 2), X - w / 2.0)
    rays = 0.5 + 0.5 * np.cos(ang * 18)
    img = tl.mix(img, gold(0.55 + 0.3 * rays), (rays > 0.55) * 0.85)
    img = medallion(img, X, Y, w / 2.0, h - 17.0, 11.0)
    edge_t = 0.85 - 0.6 * np.clip(-d_side / 3.0, 0, 1)
    img = np.where((d_side > -3.0)[..., None], gold(edge_t), img)
    img = np.where((Y > h - 2)[..., None], gold(0.5), img)
    return img


def paint_roof(w, h):
    X, Y = grid(w, h)
    img = tl.solid(w * S, h * S, tl.rgb(122, 150, 136)) * (0.93 + 0.07 * noise(w, h, 4, 3, 'roof'))[..., None]
    seam = np.abs(tl.wrap_delta(X - 3.0, 6.0))
    img = tl.mix(img, tl.rgb(170, 190, 175), fill(seam - 0.5))
    img = tl.mix(img, tl.rgb(80, 100, 92), fill(np.abs(seam - 1.0) - 0.35) * 0.6)
    streak = tl.smoothstep(0.3, 0.8, noise(w, h, 12, 2, 'verd', 3))
    img = tl.mix(img, tl.rgb(120, 175, 150), streak * 0.35)
    edge = np.minimum(np.minimum(X, w - X), np.minimum(Y, h - Y))
    img = tl.shade(img, 0.62 + 0.38 * tl.smoothstep(0.5, 3.5, edge))
    return img


PAINTERS = {
    'bld_a_rich_trim': TRIM_PAINTERS,
    'env_bld_apartment_rich_facade': {'tower_lit': paint_tower, 'tower_shade': paint_tower,
                                      'podium_lit': paint_podium, 'podium_shade': paint_podium},
    'env_bld_civic_rich_facade': {'wall_lit': paint_palace_wall, 'wall_shade': paint_palace_wall},
    'env_bld_civic_rich_parts': {'drum': paint_drum, 'stair': paint_stair, 'attic': paint_attic,
                                 'tympanum': paint_tympanum, 'roof': paint_roof},
}
SHADE = np.array([0.80, 0.82, 0.86], F)   # multiplier for '_shade' regions: 18 % darker, cooler


def check_rects(name, tex):
    w, h = tex['size']
    rects = {k: r['rect'] for k, r in tex['regions'].items()}
    if set(rects) != set(PAINTERS[name]):
        raise SystemExit(f'{name}: contract regions {sorted(rects)} != painters {sorted(PAINTERS[name])}')
    occ = np.zeros((h, w), int)
    for k, (x, y, rw, rh) in rects.items():
        if x < 0 or y < 0 or x + rw > w or y + rh > h:
            raise SystemExit(f'{name}.{k} leaves the sheet')
        occ[y:y + rh, x:x + rw] += 1
    if occ.max() > 1:
        raise SystemExit(f'{name}: regions overlap')
    return rects


def build(name, tex):
    w, h = tex['size']
    rgba = tex.get('mode') == 'RGBA'
    sheet = np.zeros((h, w, 4 if rgba else 3), F)
    if rgba:
        sheet[..., 3] = 1
    rects = check_rects(name, tex)
    for k, (x, y, rw, rh) in rects.items():
        img = down(PAINTERS[name][k](rw, rh))
        if k.endswith('_shade'):
            img[..., :3] = img[..., :3] * SHADE
        if rgba and img.shape[-1] == 3:
            img = np.concatenate([img, np.ones(img.shape[:2] + (1,), F)], axis=-1)
        img = grain(img, name + k)
        sheet[y:y + rh, x:x + rw] = img[..., :sheet.shape[-1]]
    sheet = np.clip(sheet, 0, 1)
    path = os.path.join(ROOT, tex['file'])
    Image.fromarray(tl.to_u8(sheet), 'RGBA' if rgba else 'RGB').save(path)
    print('WROTE', path, sheet.shape)
    return sheet, rects


def preview(name, tex, sheet, rects, out):
    os.makedirs(out, exist_ok=True)
    rgb = sheet[..., :3]
    if sheet.shape[-1] == 4:   # alpha holes as magenta
        a = sheet[..., 3:4]
        rgb = rgb * a + np.array([1, 0, 1], F) * (1 - a)
    tl.outline_regions(rgb, {k: tuple(v) for k, v in rects.items()}, scale=4).save(os.path.join(out, f'{name}_regions.png'))
    items = [(f'{name} x4', Image.fromarray(tl.to_u8(rgb)).resize((rgb.shape[1] * 4, rgb.shape[0] * 4), Image.NEAREST))]
    lines = []
    for k, r in tex['regions'].items():
        if r.get('tiles') == 'u':
            x, y, rw, rh = r['rect']
            strip = rgb[y:y + rh, x:x + rw]
            st = tl.seam_stats(strip, 'x')
            lines.append(f'{name}.{k}: wrap {st["wrap"]:.1f} p95 {st["p95"]:.1f} pass {st["pass"]}')
            t3 = tl.tile(strip, 3, 1)
            items.append((f'{k} x3', Image.fromarray(tl.to_u8(t3)).resize((t3.shape[1] * 3, t3.shape[0] * 3), Image.NEAREST)))
    tl.contact_sheet(items, max_width=1700).save(os.path.join(out, f'{name}_sheet.png'))
    with open(os.path.join(out, f'{name}_seams.txt'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*')
    ap.add_argument('--preview')
    a = ap.parse_args()
    with open(LAYOUT, encoding='utf-8') as fh:
        layout = json.load(fh)
    for name, tex in layout['textures'].items():
        if a.only and name not in a.only:
            continue
        sheet, rects = build(name, tex)
        if a.preview:
            preview(name, tex, sheet, rects, a.preview)


if __name__ == '__main__':
    main()
