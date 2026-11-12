#!/usr/bin/env python3
"""Textures for the street_furniture family: poor and rich streetlights and park benches.

    python tools/texgen/street_furniture.py [--only <texture> ...] [--preview build/visual_gaps/street_furniture/tex]

Reads every rect from tools/texgen/street_furniture_layout.json and stops if the contract and the painters
disagree. Writes public/textures/map/<texture>.png (RGB, or RGBA where the contract says alpha). Every random
source is seeded: a re-run writes identical bytes.

The game lights the street with one flat ambient light and ignores vertex colour, so each region bakes its own
form: undersides and side faces darker, recesses dark, gilt highlights on curls.

Painting: each region is painted at SS x the final resolution in final-pixel coordinates (x 0..w, y 0..h, y
down), box-filtered down, alpha thresholded at 0.5 (fully opaque or fully cut), then a little per-pixel grain.
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

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
CONTRACT = os.path.join(ROOT, 'tools', 'texgen', 'street_furniture_layout.json')
SEED = 4417
SS = 4
F = np.float32


def C(r, g, b):
    return tl.rgb(r, g, b)


def ramp(t, stops):
    """Colour ramp: t (h, w) in [0, 1], stops [(pos, colour), ...] sorted by pos."""
    t = np.clip(np.asarray(t, F), 0.0, 1.0)
    out = np.zeros(t.shape + (3,), F)
    out[...] = stops[0][1]
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        k = np.clip((t - p0) / F(max(p1 - p0, 1e-6)), 0.0, 1.0)[..., None]
        sel = (t >= p0)[..., None]
        out = np.where(sel, c0 + (c1 - c0) * k, out)
    return out


class Region:
    """Hi-res canvas for one region; coordinates in final pixels."""

    def __init__(self, tex, name, rect):
        self.tex, self.name = tex, name
        self.x0, self.y0, self.w, self.h = rect
        self.W, self.H = self.w * SS, self.h * SS
        X, Y = tl.coords(self.W, self.H)
        self.X, self.Y = X / F(SS), Y / F(SS)

    def n(self, fx, fy, salt, octaves=4, gain=0.5):
        """fBm in [-1, 1] with features about (w / fx, h / fy) final pixels."""
        return tl.fbm(self.W, self.H, max(1, int(round(fx))), max(1, int(round(fy))), SEED,
                      f'{self.tex}/{self.name}/{salt}', octaves=octaves, gain=gain)

    def rank(self, fx, fy, salt, octaves=4):
        return tl.uniform_rank(self.n(fx, fy, salt, octaves))

    def white(self, salt):
        return tl.white(self.W, self.H, SEED, f'{self.tex}/{self.name}/{salt}')

    def rng(self, salt=''):
        return tl.rng(SEED, self.tex, self.name, salt)


# ---------------------------------------------------------------------------------------------------------
# Stroke shapes (signed distances in final pixels, negative inside)

def sd_stroke_seg(X, Y, x0, y0, x1, y1, width):
    d, _ = tl.sd_segment(X, Y, x0, y0, x1, y1)
    return d - F(width * 0.5)


def sd_stroke_arc(X, Y, cx, cy, r, a0, a1, width):
    """Arc of radius r from angle a0 to a1 (radians, y down so positive angles turn clockwise on screen)."""
    ang = np.arctan2(Y - cy, X - cx)
    mid, half = (a0 + a1) * 0.5, abs(a1 - a0) * 0.5
    da = np.abs(np.angle(np.exp(1j * (ang - mid))))
    on = da <= half
    d_arc = np.abs(np.hypot(X - cx, Y - cy) - F(r))
    ex = [(cx + r * math.cos(a), cy + r * math.sin(a)) for a in (a0, a1)]
    d_end = np.minimum(np.hypot(X - ex[0][0], Y - ex[0][1]), np.hypot(X - ex[1][0], Y - ex[1][1]))
    return np.where(on, d_arc, d_end) - F(width * 0.5)


def sd_stroke_spiral(X, Y, cx, cy, r_out, turns, width, rot=0.0, cw=True):
    """Archimedean spiral from r_out inwards over `turns` turns, starting at angle rot."""
    b = r_out / (2 * math.pi * (turns + 0.25))
    dx, dy = X - cx, Y - cy
    ang = np.arctan2(dy, dx) - F(rot)
    if not cw:
        ang = -ang
    ang = np.mod(ang, 2 * math.pi)  # angle travelled from the start, mod one turn
    r = np.hypot(dx, dy)
    # spiral radius at travel t: r_out - b * t ; t = ang + 2 pi k
    best = np.full(r.shape, 1e9, F)
    for k in range(int(turns) + 2):
        t = ang + F(2 * math.pi * k)
        rs = F(r_out) - F(b) * t
        valid = (t <= 2 * math.pi * turns) & (rs > 0)
        best = np.where(valid, np.minimum(best, np.abs(r - rs)), best)
    return best - F(width * 0.5)


def sd_poly(X, Y, pts):
    """Signed distance to a closed polygon (negative inside)."""
    d = np.full(X.shape, 1e9, F)
    inside = np.zeros(X.shape, bool)
    n = len(pts)
    for i in range(n):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % n]
        dd, _ = tl.sd_segment(X, Y, x0, y0, x1, y1)
        d = np.minimum(d, dd)
        cond = ((y0 > Y) != (y1 > Y)) & (X < (x1 - x0) * (Y - y0) / (y1 - y0 + 1e-9) + x0)
        inside ^= cond
    return np.where(inside, -d, d)


def union(*sds):
    out = sds[0]
    for s in sds[1:]:
        out = np.minimum(out, s)
    return out


# ---------------------------------------------------------------------------------------------------------
# Materials

GOLD = [(0.0, C(70, 40, 12)), (0.35, C(150, 100, 28)), (0.65, C(212, 165, 55)), (0.88, C(246, 214, 112)),
        (1.0, C(255, 244, 196))]
IRON = [(0.0, C(14, 18, 16)), (0.5, C(30, 38, 34)), (1.0, C(58, 66, 60))]
RUST = [(0.0, C(62, 34, 20)), (0.45, C(112, 58, 30)), (0.8, C(150, 84, 42)), (1.0, C(172, 108, 60))]
MARBLE = [(0.0, C(176, 166, 164)), (0.5, C(226, 218, 212)), (1.0, C(244, 238, 232))]
VELVET = [(0.0, C(62, 6, 10)), (0.4, C(118, 14, 20)), (0.75, C(172, 30, 36)), (1.0, C(210, 62, 62))]


def gilt(R, sd, width, tone=1.0):
    """Gold tube shading from a stroke's signed distance: bright along the centre line, dark at the rims."""
    prof = tl.bevel(sd, max(width * 0.5, 0.6))
    var = R.n(R.w / 3, R.h / 3, 'giltvar', 2) * 0.08
    rgb = ramp(np.clip((0.25 + 0.75 * prof) * tone + var, 0, 1), GOLD)
    return rgb, tl.fill(sd, 0.6)


def steel_poor(R, rust_amount, salt, base=C(108, 116, 106)):
    """Flaking grey-green paint over rust."""
    paint = base * (1.0 + 0.08 * R.n(R.w / 2, R.h / 3, salt + 'p', 3))[..., None]
    rust = ramp(0.5 + 0.5 * R.n(R.w / 2, R.h / 2, salt + 'r', 3), RUST)
    u = R.rank(max(2, R.w / 2), max(2, R.h / 2.5), salt + 'm', 5)
    m = tl.smoothstep(1.0 - rust_amount - 0.04, 1.0 - rust_amount + 0.04, u) if np.ndim(rust_amount) == 0 else \
        tl.smoothstep(1.0 - rust_amount - 0.04, 1.0 - rust_amount + 0.04, u)
    out = tl.mix(paint, rust, m)
    # a dark rim where paint flakes off
    rim = tl.smoothstep(1.0 - rust_amount - 0.12, 1.0 - rust_amount - 0.04, u) * (1 - m)
    return tl.shade(out, 1.0 - 0.25 * rim)


def soot(R, img, amount):
    return tl.mix(img, C(26, 24, 22), np.clip(amount, 0, 1) * 0.85)


def concrete(R, salt, base=C(118, 116, 110)):
    v = R.n(R.w / 2, R.h / 2, salt, 4)
    img = base * (1.0 + 0.10 * v)[..., None]
    pits = tl.smoothstep(0.93, 0.97, R.white(salt + 'pit'))
    return tl.shade(img, 1.0 - 0.3 * pits)


def wood(R, salt, base, grain_dir='u'):
    """Grey-brown weathered wood; grain runs along U."""
    X, Y = R.X, R.Y
    g = R.n(max(1, R.w / 8), max(2, R.h * 1.5), salt + 'g', 3)
    lines = 0.5 + 0.5 * np.sin((Y * 2.2 + g * 2.5) * math.pi)
    img = base * (0.85 + 0.25 * lines)[..., None]
    img = img * (1.0 + 0.10 * R.n(R.w / 3, R.h / 2, salt + 'v', 3))[..., None]
    return img


def marble(R, salt):
    v = R.n(max(1, R.w / 6), max(1, R.h / 6), salt + 'v', 5, 0.6)
    veins = 1.0 - tl.smoothstep(0.0, 0.12, np.abs(v))
    base = ramp(0.6 + 0.3 * R.n(R.w / 4, R.h / 4, salt + 'b', 3), MARBLE)
    base = tl.mix(base, C(232, 200, 196), 0.25 * (0.5 + 0.5 * R.n(2, 2, salt + 'pink', 2)))
    return tl.mix(base, C(150, 140, 142), veins * 0.55)


def leader_profile(X, Y, cx, cy, s):
    """Signed distance of the leader's bust in profile, facing left: a tall peaked cap with a jutting visor,
    nose, a bushy moustache, broad shoulders. (cx, cy) is the centre of the head, s the head radius in px."""
    head = tl.sd_ellipse(X, Y, cx, cy, 0.8 * s, 0.95 * s)
    cap = sd_poly(X, Y, [(cx - 0.85 * s, cy - 0.45 * s), (cx + 0.9 * s, cy - 0.45 * s), (cx + 1.35 * s, cy - 1.35 * s),
                         (cx - 0.95 * s, cy - 1.6 * s)])
    visor = sd_poly(X, Y, [(cx - 0.7 * s, cy - 0.65 * s), (cx - 1.75 * s, cy - 0.3 * s),
                           (cx - 1.7 * s, cy - 0.1 * s), (cx - 0.7 * s, cy - 0.3 * s)])
    nose = sd_poly(X, Y, [(cx - 0.7 * s, cy - 0.2 * s), (cx - 1.25 * s, cy + 0.3 * s), (cx - 0.7 * s, cy + 0.32 * s)])
    tache = tl.sd_ellipse(X, Y, cx - 0.95 * s, cy + 0.5 * s, 0.5 * s, 0.24 * s)
    chin = tl.sd_ellipse(X, Y, cx - 0.4 * s, cy + 0.8 * s, 0.45 * s, 0.32 * s)
    neck = tl.sd_rect(X, Y, cx - 0.4 * s, cy + 0.5 * s, cx + 0.6 * s, cy + 1.5 * s)
    shoulders = sd_poly(X, Y, [(cx - 1.6 * s, cy + 3.0 * s), (cx - 1.1 * s, cy + 1.5 * s), (cx + 0.2 * s, cy + 1.2 * s),
                               (cx + 1.7 * s, cy + 1.45 * s), (cx + 2.2 * s, cy + 3.0 * s)])
    return union(head, cap, visor, nose, tache, chin, neck, shoulders)


# ---------------------------------------------------------------------------------------------------------
# env_streetlight_poor (32 x 32, opaque)

def sp_pole(R, tone):
    X, Y = R.X, R.Y
    t = Y / F(R.h)
    img = steel_poor(R, 0.18 + 0.45 * t ** 1.5, 'pole')
    # rust runs from two bolt holes
    for bx, by in ((1.5, 5.0), (3.5, 15.0)):
        run = np.exp(-((X - bx) / 0.7) ** 2) * (Y > by) * np.exp(-(Y - by) / 7.0)
        img = tl.mix(img, C(120, 62, 30), np.clip(run, 0, 1) * 0.8)
        img = tl.mix(img, C(40, 30, 26), tl.fill(tl.sd_circle(X, Y, bx, by, 0.6)))
    # soot rising from the bottom and patchy
    s = tl.smoothstep(0.72, 1.0, t) + 0.4 * tl.smoothstep(0.55, 0.75, R.rank(2, 6, 'soot', 4)) * t
    img = soot(R, img, s)
    # bottom 1 px occlusion at the collar, top 1 px shadow under the arm joint
    img = tl.shade(img, 1.0 - 0.35 * tl.smoothstep(R.h - 1.2, R.h, Y) - 0.3 * tl.smoothstep(1.0, 0.0, Y))
    if R.name == 'pole_front':  # open access hatch hole
        hole = tl.fill(tl.sd_rect(X, Y, 1.0, 25.0, 4.0, 28.0))
        img = tl.mix(img, C(12, 10, 9), hole)
    return tl.shade(img, tone)


def sp_arm(R, tone):
    img = steel_poor(R, 0.45, 'arm', base=C(112, 116, 110))
    t = R.X / F(R.w)
    img = soot(R, img, 0.5 * tl.smoothstep(0.6, 1.0, t))
    if R.name == 'arm_top':
        specks = tl.smoothstep(0.9, 0.95, R.white('droppings'))
        img = tl.mix(img, C(206, 204, 196), specks)
    if R.name == 'arm_side':
        for bx in (3.0, 9.0, 16.0):
            run = np.exp(-((R.X - bx) / 0.8) ** 2) * tl.smoothstep(0.5, 2.5, R.Y)
            img = tl.mix(img, C(118, 60, 28), run * 0.7)
    return tl.shade(img, tone)


def sp_head_out(R, tone):
    X, Y = R.X, R.Y
    img = steel_poor(R, 0.5, 'head', base=C(118, 120, 116))
    dents = R.n(3, 3, 'dent', 3)
    img = tl.shade(img, 1.0 + 0.18 * dents)
    img = soot(R, img, 0.45 * tl.smoothstep(0.4, 0.8, R.rank(2, 2, 'hsoot', 3)))
    rim = tl.smoothstep(R.h - 2.0, R.h - 1.4, Y)
    img = tl.mix(img, C(150, 146, 136), rim * 0.8)
    img = tl.shade(img, 1.0 - 0.2 * tl.smoothstep(2.0, 0.0, Y))
    return tl.shade(img, tone)


def sp_head_in(R, tone):
    X, Y = R.X, R.Y
    cx, cy = R.w / 2, R.h / 2
    img = tl.solid(R.W, R.H, C(26, 20, 16)) * (1.0 + 0.2 * R.n(3, 3, 'in', 3))[..., None]
    r = np.hypot((X - cx) / (R.w / 2), (Y - cy) / (R.h / 2))
    ang = np.arctan2(Y - cy, X - cx)
    jag = 0.78 + 0.12 * np.sin(ang * 7 + 1.3) + 0.06 * np.sin(ang * 13)
    glass = (r > jag) & (r < 1.05)
    gl = ramp(0.5 + 0.5 * R.n(4, 4, 'gl', 2), [(0, C(120, 140, 150)), (1, C(200, 214, 220))])
    img = np.where(glass[..., None], gl, img)
    socket = tl.fill(tl.sd_circle(X, Y, cx + 0.5, cy, 1.4))
    img = tl.mix(img, C(120, 100, 60), socket)
    stub = tl.fill(tl.sd_circle(X, Y, cx + 0.2, cy - 0.3, 0.7))
    img = tl.mix(img, C(190, 196, 190), stub * 0.8)
    return tl.shade(img, tone)


def sp_base_side(R, tone):
    X, Y = R.X, R.Y
    img = concrete(R, 'bs')
    crack = sd_stroke_seg(X, Y, 3.0, 0.0, 4.5, 3.5, 0.5)
    crack = union(crack, sd_stroke_seg(X, Y, 4.5, 3.5, 3.8, 8.0, 0.5))
    img = tl.mix(img, C(40, 38, 36), tl.fill(crack) * 0.9)
    chip = tl.fill(tl.sd_circle(X, Y, 9.5, 0.0, 1.6))
    img = tl.mix(img, C(160, 156, 148), chip)
    # rust dribble from the pole at the top centre
    run = np.exp(-((X - 6.5) / 0.8) ** 2) * np.exp(-Y / 3.5)
    img = tl.mix(img, C(126, 70, 36), np.clip(run, 0, 1) * 0.7)
    grime = tl.smoothstep(R.h - 3.0, R.h, Y) + 0.3 * tl.smoothstep(0.6, 0.9, R.rank(3, 2, 'g', 4))
    img = soot(R, img, grime * 0.8)
    return tl.shade(img, tone)


def sp_base_top(R, tone):
    X, Y = R.X, R.Y
    img = concrete(R, 'bt', base=C(132, 130, 124))
    d = tl.sd_circle(X, Y, R.w / 2, R.h / 2, 1.8)
    img = tl.mix(img, C(120, 66, 34), tl.ring(d, 1.4) * 0.8)
    img = tl.mix(img, C(70, 50, 36), tl.fill(d))
    img = tl.mix(img, C(90, 88, 84), tl.fill(tl.sd_circle(X, Y, R.w, 0, 1.8)))
    return tl.shade(img, tone)


def sp_wire(R, tone):
    X, Y = R.X, R.Y
    img = tl.solid(R.W, R.H, C(36, 34, 33))
    img = tl.mix(img, C(70, 68, 64), tl.fill(np.abs(X - 1.5) - 0.5))
    cu = tl.smoothstep(R.h - 3.2, R.h - 2.8, Y)
    strands = 0.5 + 0.5 * np.sin(X * 5.0)
    img = tl.mix(img, ramp(strands, [(0, C(120, 70, 30)), (1, C(200, 130, 60))]), cu)
    return tl.shade(img, tone)


def sp_hatch(R, tone):
    X, Y = R.X, R.Y
    img = steel_poor(R, 0.6, 'hatch')
    border = tl.ring(tl.sd_rect(X, Y, 0.5, 0.5, R.w - 0.5, R.h - 0.5), 1.0)
    img = tl.shade(img, 1.0 - 0.35 * border)
    return tl.shade(img, tone)


def sp_shard(R, tone):
    img = concrete(R, 'sh', base=C(84, 82, 80))
    fl = tl.smoothstep(0.82, 0.86, R.white('fl'))
    img = tl.mix(img, C(196, 210, 216), fl)
    return tl.shade(img, tone)


# ---------------------------------------------------------------------------------------------------------
# env_streetlight_rich (64 x 64, RGBA)

def sr_shaft(R, tone):
    X, Y = R.X, R.Y
    # two flutes per face: groove centres at w/4 and 3w/4
    fw = R.w / 2.0
    fx = np.mod(X, fw) / F(fw)  # 0..1 across a flute
    groove = np.sin(fx * math.pi)  # 0 at the ridges, 1 in the groove centre
    img = ramp(0.75 - 0.55 * groove + 0.08 * R.n(2, 8, 'v', 3), IRON)
    ridge = tl.smoothstep(0.82, 0.95, 1.0 - groove)
    g, _ = gilt(R, -tl.smoothstep(0.0, 1.0, ridge) * 2 + 0.5, 1.0)
    img = tl.mix(img, g, ridge)
    # gilt bands top and bottom (2 px) and a thin one at 3/4
    for y0, y1 in ((0.0, 2.0), (R.h - 2.0, R.h)):
        band = tl.fill(tl.sd_rect(X, Y, -1, y0, R.w + 1, y1))
        gb, _ = gilt(R, -(1.0 - np.abs((Y - (y0 + y1) / 2) / ((y1 - y0) / 2 + 0.01))) * 1.5 + 0.2, 2.0)
        img = tl.mix(img, gb, band)
    return tl.shade(img, tone), None


def sr_base(R, tone):
    X, Y = R.X, R.Y
    fw = R.w / 2.0
    fx = np.mod(X, fw) / F(fw)
    groove = np.sin(fx * math.pi)
    img = ramp(0.7 - 0.5 * groove, IRON)
    gl, _ = gilt(R, (groove - 0.6) * 3.0, 2.0)
    img = tl.mix(img, gl, tl.smoothstep(0.75, 0.9, 1.0 - groove))
    # acanthus band near the bottom: gold leaves (pointed arches) on dark ground, y 14..20
    lx = np.mod(X, fw) - fw / 2
    leaf = sd_poly(X * 0 + lx, Y, [(-2.6, 20.0), (0.0, 13.0), (2.6, 20.0)])
    lg, _ = gilt(R, leaf, 3.0)
    img = tl.mix(img, lg, tl.fill(leaf) * tl.fill(tl.sd_rect(X, Y, -1, 12.5, R.w + 1, 21.0)))
    # gold rings at the top (shoulder) and at the bottom
    for y0, y1 in ((0.0, 2.5), (21.0, 24.0)):
        prof = 1.0 - np.abs((Y - (y0 + y1) / 2) / ((y1 - y0) / 2))
        gb = ramp(np.clip(0.3 + 0.7 * prof, 0, 1), GOLD)
        img = tl.mix(img, gb, tl.fill(tl.sd_rect(X, Y, -1, y0, R.w + 1, y1)))
    img = tl.shade(img, 1.0 - 0.25 * tl.smoothstep(16.0, 24.0, Y) * (Y < 21))
    return tl.shade(img, tone), None


def sr_finial(R, tone):
    X, Y = R.X, R.Y
    cx = R.w / 2
    spike = sd_poly(X, Y, [(cx - 1.2, 9.0), (cx, 0.3), (cx + 1.2, 9.0)])
    ringd = tl.sd_circle(X, Y, cx, 11.0, 3.6)
    ring_s = np.abs(ringd) - 0.8
    star_pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        r = 3.0 if i % 2 == 0 else 1.25
        star_pts.append((cx + r * math.cos(a), 11.2 + r * math.sin(a)))
    star = sd_poly(X, Y, star_pts)
    stem = tl.sd_rect(X, Y, cx - 0.9, 14.0, cx + 0.9, R.h)
    gold_sd = union(spike, ring_s, stem)
    g, ga = gilt(R, gold_sd, 2.0)
    img = g
    img = tl.mix(img, C(200, 20, 20) * 1.0, tl.fill(star))
    a = np.maximum(ga, tl.fill(star))
    return tl.shade(img, tone), a


def sr_iron(R, tone):
    X, Y = R.X, R.Y
    img = ramp(0.55 + 0.1 * R.n(4, 2, 'i', 2), IRON)
    edge = tl.fill(Y - 1.0) + tl.fill((R.h - 1.0) - Y)
    g = ramp(F(0.8) + 0 * X, GOLD)
    img = tl.mix(img, g, np.clip(edge, 0, 1))
    return tl.shade(img, tone), None


def sr_plinth_side(R, tone):
    X, Y = R.X, R.Y
    img = marble(R, 'ps')
    line = tl.fill(np.abs(Y - 1.5) - 0.6)
    img = tl.mix(img, ramp(F(0.75) + 0 * X, GOLD), line)
    img = tl.shade(img, 1.0 - 0.3 * tl.smoothstep(R.h - 2.5, R.h, Y))
    return tl.shade(img, tone), None


def sr_plinth_top(R, tone):
    img = marble(R, 'pt')
    d = tl.sd_rect(R.X, R.Y, 0.5, 0.5, R.w - 0.5, R.h - 0.5)
    img = tl.mix(img, ramp(F(0.75) + 0 * R.X, GOLD), tl.ring(d, 1.0))
    return tl.shade(img, tone), None


def sr_gold(R, tone):
    v = 0.5 + 0.5 * R.n(3, 3, 'g', 3)
    t = {'gold_lit': 0.62, 'gold_mid': 0.5, 'gold_shade': 0.3}[R.name]
    img = ramp(np.clip(t + 0.3 * (v - 0.5), 0, 1), GOLD)
    glint = tl.smoothstep(0.9, 0.95, R.white('glint')) * (0.6 if R.name != 'gold_shade' else 0.3)
    img = tl.mix(img, C(255, 246, 200), glint)
    return img, None


def sr_globe(R, tone):
    X, Y = R.X, R.Y
    cx, cy = R.w / 2, R.h / 2
    r = np.hypot(X - cx, Y - cy) / F(R.w / 2)
    img = ramp(1.0 - np.clip(r, 0, 1) ** 2, [(0.0, C(214, 194, 150)), (0.5, C(240, 228, 192)),
                                              (0.85, C(254, 250, 230)), (1.0, C(255, 254, 244))])
    ribs = 0.5 + 0.5 * np.cos((X - cx) * math.pi / 2.0)
    img = tl.shade(img, 1.0 - 0.05 * ribs * tl.smoothstep(0.2, 0.9, r))
    return img, None


def sr_banner(R, tone):
    X, Y = R.X, R.Y
    w, h = R.w, R.h
    # swallowtail: notch from the bottom centre up to 0.78 h
    shape = sd_poly(X, Y, [(0.4, 1.0), (w - 0.4, 1.0), (w - 0.4, h - 0.3), (w / 2, h * 0.78), (0.4, h - 0.3)])
    folds = 0.5 + 0.5 * np.sin(X / F(w) * math.pi * 5.0 + 0.6 * R.n(1, 3, 'fold', 2))
    img = ramp(0.35 + 0.45 * folds + 0.06 * R.n(4, 6, 'v', 3), VELVET)
    # gold fringe / pole sleeve at the top
    top = tl.fill(Y - 3.0)
    img = tl.mix(img, ramp(np.clip(0.4 + 0.5 * np.sin(X * 2.0) * 0.5 + 0.3, 0, 1), GOLD), top)
    # gold edging along the sides and tails
    img = tl.mix(img, ramp(F(0.7) + 0 * X, GOLD), tl.ring(shape, 1.2) * (Y > 3))
    # roundel with the leader's bust
    cx, cy, rr = w / 2, h * 0.36, w * 0.33
    rd = tl.sd_circle(X, Y, cx, cy, rr)
    img = tl.mix(img, C(236, 224, 190), tl.fill(rd))
    img = tl.mix(img, ramp(F(0.75) + 0 * X, GOLD), tl.ring(rd, 1.4))
    bust = np.maximum(leader_profile(X, Y, cx + 1.0, cy - 0.6, rr * 0.4), rd + 0.7)
    img = tl.mix(img, C(22, 16, 14), tl.fill(bust))
    # gold star under the roundel
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        r = 2.6 if i % 2 == 0 else 1.1
        pts.append((cx + r * math.cos(a), cy + rr + 4.0 + r * math.sin(a)))
    img = tl.mix(img, ramp(F(0.85) + 0 * X, GOLD), tl.fill(sd_poly(X, Y, pts)))
    a = tl.fill(shape)
    return tl.shade(img, tone), a


def sr_scroll_cross(R, tone):
    X, Y = R.X, R.Y
    w, h = R.w, R.h
    # left half: a C-scroll from the centre top curling down-left into a volute; mirrored
    Xm = np.where(X < w / 2, X, w - X)
    top = sd_stroke_seg(Xm, Y, 0.5, 1.0, w / 2, 1.0, 1.6)
    arc = sd_stroke_arc(Xm, Y, w / 2 - 2.5, 3.6, 2.6, -math.pi * 0.5, math.pi * 0.6, 1.4)
    vol = sd_stroke_spiral(Xm, Y, 3.2, 4.4, 2.6, 1.3, 1.1, rot=-math.pi / 2, cw=False)
    sd = union(top, arc, vol)
    img, a = gilt(R, sd, 1.5)
    return tl.shade(img, tone), a


def sr_scroll_swan(R, tone):
    X, Y = R.X, R.Y
    w, h = R.w, R.h
    # top rail along the arm (y 1), a big volute at the pole end, a wave scroll along the arm
    rail = sd_stroke_seg(X, Y, 0.5, 1.2, w - 0.5, 1.2, 1.6)
    vol = sd_stroke_spiral(X, Y, 7.0, 8.0, 6.4, 1.6, 1.5, rot=math.pi * 0.5, cw=True)
    pole = sd_stroke_seg(X, Y, 0.9, 1.0, 0.9, h - 0.5, 1.6)
    wave = []
    for i, x in enumerate(np.arange(14.0, w - 2.0, 7.0)):
        r = max(1.4, 3.0 - i * 0.35)
        wave.append(sd_stroke_spiral(X, Y, x, 1.2 + r + 0.3, r, 1.1, 1.2, rot=-math.pi * 0.5, cw=(i % 2 == 0)))
    curve = sd_stroke_arc(X, Y, 14.0, 1.2 - 10.0, 15.0, math.pi * 0.25, math.pi * 0.75, 1.3)
    sd = union(rail, vol, pole, curve, *wave)
    img, a = gilt(R, sd, 1.5)
    return tl.shade(img, tone), a


# ---------------------------------------------------------------------------------------------------------
# env_parkbench_poor (32 x 32, RGBA)

def bench_frame_sd(X, Y, w, h, broken):
    """Side profile of a cast-iron bench end in a w x h rect: front at the left, top = backrest top."""
    s = w / 14.0
    seat_y = h * 0.625  # seat bearer centre (model z -0.32: slats sit on it with their tops at -0.14)
    parts = [
        sd_stroke_seg(X, Y, 2.0 * s, seat_y, w - 2.6 * s, seat_y - 0.4, 2.4),            # seat bearer
        sd_stroke_seg(X, Y, w - 3.2 * s, h - 0.6, w - 1.2 * s, 0.8, 2.4),                 # back leg + back support
        sd_stroke_seg(X, Y, 1.8 * s, seat_y - 3.0, w - 2.6 * s, seat_y - 3.6, 1.9),       # armrest
        sd_stroke_seg(X, Y, 1.8 * s, seat_y - 3.0, 2.4 * s, seat_y, 1.9),                 # armrest post
        tl.sd_rect(X, Y, w - 4.4 * s, h - 1.2, w - 1.8 * s, h),                            # back foot
    ]
    if broken:
        parts.append(sd_stroke_seg(X, Y, 2.6 * s, seat_y, 3.2 * s, seat_y + 2.6, 2.4))    # stump of the front leg
        parts[2] = sd_stroke_seg(X, Y, 1.8 * s, seat_y - 2.0, w - 2.6 * s, seat_y - 3.6, 1.9)  # bent armrest
    else:
        parts.append(sd_stroke_seg(X, Y, 2.6 * s, seat_y, 2.2 * s, h - 0.6, 2.4))         # front leg
        parts.append(tl.sd_rect(X, Y, 1.0 * s, h - 1.2, 3.8 * s, h))                        # front foot
    return union(*parts)


def iron_rusty(R, sd, rust):
    prof = tl.bevel(sd, 0.9)
    img = ramp(0.25 + 0.6 * prof, [(0, C(18, 16, 14)), (0.6, C(46, 40, 34)), (1, C(78, 70, 60))])
    u = R.rank(R.w / 3, R.h / 3, 'rust', 4)
    rm = tl.smoothstep(1 - rust - 0.05, 1 - rust + 0.05, u)
    img = tl.mix(img, ramp(0.3 + 0.6 * prof, RUST), rm)
    return img


def bp_frame(R, tone):
    sd = bench_frame_sd(R.X, R.Y, R.w, R.h, R.name == 'frame_broken')
    img = iron_rusty(R, sd, 0.45 if R.name == 'frame' else 0.65)
    return tl.shade(img, tone), tl.fill(sd, 0.7)


def bp_leg_front(R, tone):
    X, Y = R.X, R.Y
    w, h = R.w, R.h
    seat_y = h * 0.625
    post = tl.sd_rect(X, Y, 1.0, seat_y - 3.0, 3.0, h)
    foot = tl.sd_rect(X, Y, 0.2, h - 1.3, 3.8, h)
    cap = tl.sd_rect(X, Y, 0.4, seat_y - 3.6, 3.6, seat_y - 2.6)
    sd = union(post, foot, cap)
    img = iron_rusty(R, sd, 0.5)
    return tl.shade(img, tone), tl.fill(sd, 0.7)


def bp_slat(R, tone):
    X, Y = R.X, R.Y
    base = C(104, 92, 76) if R.name != 'slat_top2' else C(92, 80, 66)
    img = wood(R, R.name, base)
    stains = tl.smoothstep(0.7, 0.85, R.rank(5, 1, 'stain', 4))
    img = tl.shade(img, 1.0 - 0.45 * stains)
    for bx in (2.0, R.w - 2.0):
        bolt = tl.fill(tl.sd_circle(X, Y, bx, R.h / 2, 0.7))
        img = tl.mix(img, C(120, 62, 30), bolt)
    if R.name == 'slat_top2':
        split = tl.fill(np.abs(Y - R.h * 0.55 - 0.3 * np.sin(X * 0.7)) - 0.25) * (X > 8) * (X < 26)
        img = tl.mix(img, C(26, 20, 16), split)
        wet = tl.fill(tl.sd_ellipse(X, Y, 15.0, R.h / 2, 4.5, 2.5))
        img = tl.shade(img, 1.0 - 0.35 * wet)
    if R.name == 'slat_edge':
        img = tl.shade(img, 0.6)
    # the slat's long edges are a touch darker (rounded arris)
    if R.name != 'slat_edge':
        img = tl.shade(img, 1.0 - 0.25 * (tl.smoothstep(0.8, 0.0, Y) + tl.smoothstep(R.h - 0.8, R.h, Y)))
    return tl.shade(img, tone), None


def bp_slat_broken(R, tone):
    X, Y = R.X, R.Y
    img = wood(R, 'broken', C(98, 86, 70))
    img = tl.shade(img, 1.0 - 0.25 * (tl.smoothstep(0.8, 0.0, Y) + tl.smoothstep(R.h - 0.8, R.h, Y)))
    jag = R.w - 3.0 + 1.6 * np.sin(Y * 3.1) + 0.8 * np.sin(Y * 7.3 + 1.0)
    fresh = tl.smoothstep(jag - 2.0, jag - 0.5, X)
    img = tl.mix(img, C(178, 150, 110), fresh * 0.8)
    a = (X < jag).astype(F)
    return tl.shade(img, tone), a


def bp_litter(R, tone):
    X, Y = R.X, R.Y
    paper = tl.sd_ellipse(X, Y, 3.5, 3.5, 3.2, 2.3) + 0.6 * R.n(3, 3, 'crump', 2)
    img = ramp(0.5 + 0.5 * R.n(4, 3, 'p', 3), [(0, C(120, 118, 108)), (1, C(186, 182, 170))])
    lines = tl.fill(np.abs(np.mod(Y, 1.4) - 0.7) - 0.18) * 0.4
    img = tl.shade(img, 1.0 - lines)
    bottle = union(tl.sd_box(X, Y, 8.8, 3.6, 2.4, 1.3, 0.8), tl.sd_box(X, Y, 11.4, 3.6, 1.2, 0.5))
    bprof = tl.bevel(bottle, 0.8)
    bimg = ramp(0.3 + 0.6 * bprof, [(0, C(30, 50, 26)), (1, C(110, 140, 80))])
    img = tl.mix(img, bimg, tl.fill(bottle))
    a = np.maximum(tl.fill(paper), tl.fill(bottle))
    return tl.shade(img, tone), a


# ---------------------------------------------------------------------------------------------------------
# env_parkbench_rich (64 x 64, RGBA)

def br_end(R, tone):
    X, Y = R.X, R.Y
    w, h = R.w, R.h
    s = w / 24.0
    seat_y = h * 0.66   # seat rail: just under the marble slab (model z -0.4)
    arm_y = seat_y - 9.0  # armrest rail (model z about 0.45)
    parts = [
        # front cabriole leg: knee forward then back to a paw
        sd_stroke_arc(X, Y, 4.6 * s, seat_y + 2.6, 2.8, -math.pi * 0.5, math.pi * 0.4, 2.0),
        sd_stroke_seg(X, Y, 5.4 * s, seat_y + 5.0, 4.0 * s, h - 1.6, 1.9),
        tl.sd_ellipse(X, Y, 3.4 * s, h - 1.2, 2.3, 1.2),                                   # paw
        # back leg sweeping back, rising into the back support
        sd_stroke_seg(X, Y, w - 4.2 * s, seat_y, w - 2.2 * s, h - 1.5, 2.0),
        sd_stroke_seg(X, Y, w - 4.2 * s, seat_y + 0.5, w - 2.0 * s, 1.4, 2.0),
        tl.sd_ellipse(X, Y, w - 2.0 * s, h - 1.1, 1.9, 1.1),
        # seat rail
        sd_stroke_seg(X, Y, 2.5 * s, seat_y, w - 3.0 * s, seat_y, 2.0),
        # armrest: rolled rail from the back support forward, ending in a volute
        sd_stroke_seg(X, Y, 6.2 * s, arm_y - 1.0, w - 3.4 * s, arm_y - 1.6, 2.2),
        sd_stroke_spiral(X, Y, 5.0 * s, arm_y + 1.6, 2.8, 1.4, 1.3, rot=-math.pi * 0.5, cw=False),
        sd_stroke_seg(X, Y, 5.0 * s, arm_y + 4.2, 6.0 * s, seat_y - 0.2, 1.8),           # arm post
        # S-scroll filler under the armrest
        sd_stroke_spiral(X, Y, 12.0 * s, arm_y + 4.4, 2.4, 1.1, 1.1, rot=math.pi * 0.5, cw=True),
        sd_stroke_arc(X, Y, 12.0 * s, arm_y + 4.4, 3.4, -math.pi * 0.2, math.pi * 0.5, 1.1),
        sd_stroke_spiral(X, Y, 16.5 * s, arm_y + 5.0, 2.0, 1.0, 1.0, rot=-math.pi * 0.5, cw=False),
        # back finial ball on top of the back support
        tl.sd_circle(X, Y, w - 2.0 * s, 1.6, 1.5),
    ]
    sd = union(*parts)
    img, a = gilt(R, sd, 2.0)
    return tl.shade(img, tone), a


def br_volute(R, tone):
    X, Y = R.X, R.Y
    cx, cy = R.w / 2, R.h / 2
    disc = tl.sd_circle(X, Y, cx, cy, R.w / 2 - 0.4)
    sp = sd_stroke_spiral(X, Y, cx, cy, R.w / 2 - 1.2, 2.2, 1.3, rot=-math.pi / 2)
    prof = tl.bevel(disc, R.w / 2)
    img = ramp(0.25 + 0.5 * prof, GOLD)
    hi, _ = gilt(R, sp, 1.6)
    img = tl.mix(img, hi, tl.fill(sp))
    img = tl.shade(img, 1.0 - 0.3 * tl.fill(sp + 1.2) * (1 - tl.fill(sp)))
    return tl.shade(img, tone), tl.fill(disc)


def br_leg(R, tone):
    X, Y = R.X, R.Y
    w, h = R.w, R.h
    cx = w / 2
    width = (1.0 + 1.6 * np.exp(-((Y - 3.5) / 3.0) ** 2) + 0.4 * np.clip(1 - Y / h, 0, 1))  # knee bulge at top
    leg = np.abs(X - cx) - width
    leg = np.where(Y < h - 3.0, leg, 1e3)
    paw = tl.sd_ellipse(X, Y, cx, h - 1.8, 3.2, 1.8)
    top = tl.sd_rect(X, Y, 0.6, 0.0, w - 0.6, 1.6)
    sd = union(leg, paw, top)
    img, a = gilt(R, sd, 3.0)
    toes = tl.fill(np.abs(np.mod(X - cx + 0.8, 1.6) - 0.8) - 0.2) * tl.fill(tl.sd_rect(X, Y, 0, h - 2.2, w, h))
    img = tl.shade(img, 1.0 - 0.4 * toes)
    return tl.shade(img, tone), a


def tufted(R, X, Y, cell_w, cell_h, salt):
    """Diamond tufting: puff height field, 1 at the puff centres, 0 at the buttons and creases."""
    u = X / F(cell_w)
    v = Y / F(cell_h)
    a = u + v
    b = u - v
    da = np.abs(a - np.round(a))
    db = np.abs(b - np.round(b))
    crease = np.minimum(da, db)
    puff = tl.smoothstep(0.0, 0.5, crease)
    # buttons where both are near integers (crease intersections)
    button = tl.fill(np.hypot(da * cell_w, db * cell_h) * 0.7 - 0.55)
    return puff, button


def velvet(R, puff, extra=0.0):
    sheen = 0.25 + 0.6 * puff + 0.05 * R.n(R.w / 3, R.h / 3, 'vv', 3) + extra
    return ramp(np.clip(sheen, 0, 1), VELVET)


def br_velvet_top(R, tone):
    X, Y = R.X, R.Y
    puff, button = tufted(R, X, Y, 4.0, R.h / 2.0, 'vt')
    img = velvet(R, puff)
    img = tl.mix(img, ramp(F(0.85) + 0 * X, GOLD), button)
    img = tl.shade(img, 1.0 - 0.3 * (tl.smoothstep(1.0, 0.0, Y) + tl.smoothstep(R.h - 1.0, R.h, Y)))
    return tl.shade(img, tone), None


def br_velvet_side(R, tone):
    X, Y = R.X, R.Y
    img = velvet(R, 0.3 + 0.2 * np.sin(X * 0.8) ** 2, -0.05)
    pipe = tl.fill(np.abs(Y - 0.7) - 0.6)
    img = tl.mix(img, ramp(F(0.75) + 0 * X, GOLD), pipe)
    img = tl.shade(img, 1.0 - 0.35 * tl.smoothstep(1.5, R.h, Y))
    return tl.shade(img, tone), None


def br_back_front(R, tone):
    X, Y = R.X, R.Y
    w, h = R.w, R.h
    frame = tl.sd_rect(X, Y, 2.0, 2.0, w - 2.0, h - 2.0, 1.5)
    puff, button = tufted(R, X - 2.0, Y - 2.0, 4.0, 5.0, 'bf')
    img = velvet(R, puff)
    img = tl.mix(img, ramp(F(0.85) + 0 * X, GOLD), button)
    # inner shadow under the frame
    img = tl.shade(img, 1.0 - 0.4 * tl.smoothstep(-2.0, 0.0, frame))
    prof = 1.0 - np.clip(np.abs(frame + 1.0) / 2.0, 0, 1)
    gold = ramp(np.clip(0.3 + 0.7 * prof, 0, 1), GOLD)
    img = tl.mix(img, gold, tl.fill(-frame - 0.0 + 0) * 0 + (frame > -0.2))
    # medallion
    cx, cy = w / 2, h / 2
    md = tl.sd_ellipse(X, Y, cx, cy, 3.6, 5.0)
    img = tl.mix(img, ramp(F(0.7) + 0 * X, GOLD), tl.fill(md))
    img = tl.mix(img, C(236, 224, 190), tl.fill(md + 1.0))
    bust = np.maximum(leader_profile(X, Y, cx + 0.5, cy - 0.6, 1.4), md + 1.2)
    img = tl.mix(img, C(22, 16, 14), tl.fill(bust))
    return tl.shade(img, tone), None


def br_back_rear(R, tone):
    X, Y = R.X, R.Y
    frame = tl.sd_rect(X, Y, 1.5, 1.5, R.w - 1.5, R.h - 1.5)
    img = ramp(0.3 + 0.05 * R.n(4, 2, 'br', 3), VELVET)
    img = tl.mix(img, ramp(F(0.6) + 0 * X, GOLD), (frame > -0.1).astype(F))
    return tl.shade(img, tone), None


def br_marble(R, tone):
    X, Y = R.X, R.Y
    img = marble(R, R.name)
    if R.name == 'marble_edge':
        img = tl.mix(img, ramp(F(0.8) + 0 * X, GOLD), tl.fill(np.abs(Y - 1.0) - 0.7))
        img = tl.shade(img, 1.0 - 0.3 * tl.smoothstep(3.0, R.h, Y))
    return tl.shade(img, tone), None


def br_gold(R, tone):
    v = 0.5 + 0.5 * R.n(3, 3, 'g', 3)
    t = 0.62 if R.name == 'gold' else 0.3
    img = ramp(np.clip(t + 0.3 * (v - 0.5), 0, 1), GOLD)
    return img, None


def br_crest(R, tone):
    X, Y = R.X, R.Y
    w, h = R.w, R.h
    cx, cy, rr = w / 2, h * 0.55, h * 0.4
    rd = tl.sd_circle(X, Y, cx, cy, rr)
    Xm = np.where(X < cx, X, w - X)
    # laurel C-scrolls either side, a base bar, a star on top
    sc = union(
        sd_stroke_spiral(Xm, Y, cx - rr - 4.2, cy + 0.5, 3.8, 1.3, 1.5, rot=math.pi * 0.5, cw=True),
        sd_stroke_seg(Xm, Y, 1.0, h - 1.2, cx, h - 1.2, 1.6),
        sd_stroke_arc(Xm, Y, cx, cy, rr + 1.6, math.pi * 0.55, math.pi * 1.25, 1.2),
    )
    leaves = []
    for i in range(4):
        a = math.pi * (0.62 + 0.17 * i)
        lx, ly = cx + (rr + 2.8) * math.cos(a), cy + (rr + 2.8) * math.sin(a)
        leaves.append(tl.sd_ellipse(Xm, Y, lx, ly, 1.3, 0.8))
    sc = union(sc, *leaves)
    img, a = gilt(R, sc, 1.8)
    img = tl.mix(img, ramp(F(0.75) + 0 * X, GOLD), tl.fill(rd))
    img = tl.mix(img, C(180, 22, 24), tl.fill(rd + 1.2))
    img = tl.mix(img, C(236, 224, 190), tl.fill(rd + 2.2))
    bust = np.maximum(leader_profile(X, Y, cx + 0.6, cy - 0.4, rr * 0.34), rd + 2.4)
    img = tl.mix(img, C(22, 16, 14), tl.fill(bust))
    a = np.maximum(a, tl.fill(rd))
    return tl.shade(img, tone), a


# ---------------------------------------------------------------------------------------------------------

PAINTERS = {
    'env_streetlight_poor': {
        'pole_front': (sp_pole, 1.0), 'pole_side': (sp_pole, 0.78), 'arm_top': (sp_arm, 1.1),
        'arm_side': (sp_arm, 0.9), 'arm_under': (sp_arm, 0.55), 'head_out': (sp_head_out, 1.0),
        'head_in': (sp_head_in, 1.0), 'base_side': (sp_base_side, 0.9), 'base_top': (sp_base_top, 1.05),
        'wire': (sp_wire, 1.0), 'hatch': (sp_hatch, 0.9), 'shard': (sp_shard, 1.0),
    },
    'env_streetlight_rich': {
        'shaft': (sr_shaft, 1.0), 'base': (sr_base, 1.0), 'finial': (sr_finial, 1.0), 'iron': (sr_iron, 1.0),
        'plinth_side': (sr_plinth_side, 0.92), 'plinth_top': (sr_plinth_top, 1.05),
        'gold_shade': (sr_gold, 1.0), 'gold_lit': (sr_gold, 1.0), 'gold_mid': (sr_gold, 1.0),
        'globe': (sr_globe, 1.0), 'banner': (sr_banner, 1.0), 'scroll_cross': (sr_scroll_cross, 1.0),
        'scroll_swan': (sr_scroll_swan, 1.0),
    },
    'env_parkbench_poor': {
        'frame': (bp_frame, 1.0), 'frame_broken': (bp_frame, 1.0), 'leg_front': (bp_leg_front, 1.0),
        'slat_top': (bp_slat, 1.0), 'slat_top2': (bp_slat, 1.0), 'slat_edge': (bp_slat, 1.0),
        'slat_broken': (bp_slat_broken, 1.0), 'litter': (bp_litter, 1.0),
    },
    'env_parkbench_rich': {
        'end': (br_end, 1.0), 'volute': (br_volute, 1.0), 'leg': (br_leg, 1.0),
        'velvet_top': (br_velvet_top, 1.0), 'velvet_side': (br_velvet_side, 0.85),
        'back_front': (br_back_front, 1.0), 'back_rear': (br_back_rear, 0.8),
        'marble_top': (br_marble, 1.05), 'marble_edge': (br_marble, 0.9),
        'gold': (br_gold, 1.0), 'gold_shade': (br_gold, 1.0), 'crest': (br_crest, 1.0),
    },
}

FILLER = {'env_streetlight_poor': C(70, 64, 58), 'env_streetlight_rich': C(30, 36, 32),
          'env_parkbench_poor': C(60, 52, 44), 'env_parkbench_rich': C(150, 100, 28)}


def paint_texture(name, spec):
    W, H = spec['size']
    alpha = spec.get('alpha', False)
    regions = spec['regions']
    painters = PAINTERS[name]
    if set(painters) != set(regions):
        raise SystemExit(f'{name}: contract regions {sorted(regions)} != painters {sorted(painters)}')
    rgb = np.zeros((H, W, 3), F)
    rgb[...] = FILLER[name]
    a_out = np.zeros((H, W), F) if alpha else np.ones((H, W), F)
    for rname, r in regions.items():
        x, y, w, h = r['rect']
        if x < 0 or y < 0 or x + w > W or y + h > H:
            raise SystemExit(f'{name}/{rname} leaves the sheet')
        fn, tone = painters[rname]
        R = Region(name, rname, r['rect'])
        res = fn(R, tone)
        img, a = res if isinstance(res, tuple) else (res, None)
        if a is None:
            a = np.ones((R.H, R.W), F)
        # alpha-weighted box filter down to the final size
        a_small = tl.downsample(a[..., None], SS)[..., 0]
        c_small = tl.downsample(img * a[..., None], SS) / np.maximum(a_small[..., None], 1e-4)
        mean = (c_small * a_small[..., None]).sum((0, 1)) / max(a_small.sum(), 1e-4)
        c_small = np.where(a_small[..., None] > 1e-3, c_small, mean)
        # photo grain
        g = tl.white(w, h, SEED, f'{name}/{rname}/grain') - 0.5
        g2 = tl.rng(SEED, name, rname, 'chroma').random((h, w, 3)).astype(F) - 0.5
        c_small = c_small * (1.0 + 0.05 * g)[..., None] * (1.0 + 0.02 * g2)
        rgb[y:y + h, x:x + w] = np.clip(c_small, 0, 1)
        if alpha:
            a_out[y:y + h, x:x + w] = (a_small >= 0.5).astype(F)
    # check overlaps
    rects = [(n, r['rect']) for n, r in regions.items()]
    for i, (n0, (x0, y0, w0, h0)) in enumerate(rects):
        for n1, (x1, y1, w1, h1) in rects[i + 1:]:
            if x0 < x1 + w1 and x1 < x0 + w0 and y0 < y1 + h1 and y1 < y0 + h0:
                raise SystemExit(f'{name}: {n0} overlaps {n1}')
    u8 = tl.to_u8(rgb)
    if alpha:
        im = Image.fromarray(np.dstack([u8, (a_out * 255).astype(np.uint8)]), 'RGBA')
    else:
        im = Image.fromarray(u8, 'RGB')
    return im


def preview(images, contract, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    items = []
    for name, im in images.items():
        W, H = im.size
        z = 512 // max(W, H)
        big = im.resize((W * z, H * z), Image.NEAREST)
        if im.mode == 'RGBA':
            bg = Image.new('RGBA', big.size, (255, 0, 255, 255))
            bg.alpha_composite(big)
            big = bg.convert('RGB')
        regs = [(n, r['rect']) for n, r in contract['textures'][name]['regions'].items()]
        out = tl.outline_regions(np.asarray(big.convert('RGB'), F) / 255.0,
                                 {n: [v * z for v in rect] for n, rect in regs}, scale=1) \
            if False else big
        items.append((f'{name} {W}x{H}', out))
        big.save(os.path.join(out_dir, f'{name}_x{z}.png'))
    tl.contact_sheet(items, max_width=2200).save(os.path.join(out_dir, 'contact.png'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*')
    ap.add_argument('--preview')
    args = ap.parse_args()
    with open(CONTRACT, encoding='utf-8') as fh:
        contract = json.load(fh)
    images = {}
    for name, spec in contract['textures'].items():
        if args.only and name not in args.only:
            continue
        im = paint_texture(name, spec)
        path = os.path.join(ROOT, spec['file'])
        os.makedirs(os.path.dirname(path), exist_ok=True)
        im.save(path)
        images[name] = im
        print('wrote', spec['file'], im.size, im.mode)
    if args.preview:
        preview(images, contract, args.preview)


if __name__ == '__main__':
    main()
