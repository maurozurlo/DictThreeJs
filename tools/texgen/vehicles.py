#!/usr/bin/env python3
"""Street vehicles' textures: car_sedan_* (normal), car_limo_* (rich), car_jeep_military_* (security >= 8) and
car_ambulance_* (health >= 8) in public/textures/vehicles.

    python tools/texgen/vehicles.py [car_sedan|car_limo|car_jeep_military|car_ambulance ...] [--preview build/visual_gaps/vehicles/tex]

Reads tools/texgen/vehicles_layout.json (the contract shared with tools/blender/vehicles.py): every rect,
every world-to-pixel frame and every feature position (windows, doors, arches, cabin) comes from it.
Seeded: a re-run writes identical bytes.

The game lights the street with one flat ambient light and ignores vertex colour, so every face shows its
albedo flat: form is baked in here (tops lighter than sides, darker sills, arch shadow, chrome highlights).
car_sedan_body is grayscale because Vehicles.tsx tints it per car (material.color multiplies through).
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
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LAYOUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vehicles_layout.json')
SEED = 4207


# ---------------------------------------------------------------------------------------------------
# Regions and frames

class Region:
    """A rect of a texture plus its world frame (see the contract's _doc)."""

    def __init__(self, name, spec):
        self.name = name
        self.x, self.y, self.w, self.h = spec['rect']
        self.frame = spec.get('frame')

    def px(self):
        return tl.coords(self.w, self.h)

    def world(self):
        X, Y = self.px()
        (_, u0, u1), (_, v0, v1) = self.frame['u'], self.frame['v']
        return (F(u0) + X / F(self.w) * F(u1 - u0)).astype(F), (F(v0) + Y / F(self.h) * F(v1 - v0)).astype(F)

    def ppu(self):
        """Pixels per world unit along U and V, and their mean (to turn world distances into px)."""
        (_, u0, u1), (_, v0, v1) = self.frame['u'], self.frame['v']
        pu, pv = self.w / abs(u1 - u0), self.h / abs(v1 - v0)
        return pu, pv, 0.5 * (pu + pv)


def lerp(a, b, t):
    t = np.asarray(t, F)
    if np.ndim(a) == 1 or np.ndim(b) == 1:
        t = t[..., None]
    return a + (b - a) * t


def grain(img, seed, salt, lum=0.035, chan=0.012):
    """Photo grain: luminance plus a little per channel."""
    h, w = img.shape[:2]
    n = tl.white(w, h, seed, salt + '/l') - 0.5
    out = img * (1.0 + F(lum * 2) * n)[..., None] if img.ndim == 3 else img * (1.0 + F(lum * 2) * n)
    if img.ndim == 3 and chan:
        for c in range(3):
            out[..., c] += F(chan * 2) * (tl.white(w, h, seed, f'{salt}/c{c}') - 0.5)
    return np.clip(out, 0.0, 1.0)


def mottle(w, h, seed, salt, cx=3, cy=2, amp=0.04, octaves=4):
    """Low-frequency multiplier around 1 (uneven paint, light dust) for a decal-like region."""
    return 1.0 + F(amp) * tl.fbm(w, h, cx, cy, seed, salt, octaves=octaves)


def frac_mask(w, h, seed, salt, cx, cy, coverage, soft=0.15, octaves=5):
    """Fractal-outline patches covering about `coverage` of the region (rank of a gain-0.6 fBm)."""
    u = tl.uniform_rank(tl.fbm(w, h, cx, cy, seed, salt, octaves=octaves, gain=0.6))
    return tl.smoothstep(1.0 - coverage - soft * coverage, 1.0 - coverage + soft * coverage, u)


# ---------------------------------------------------------------------------------------------------
# Geometry helpers shared by both cars (world units, side elevation: U = x, V = z)

def top_z_at(g, x):
    pts = sorted(g['top_z'])
    xs, zs = [p[0] for p in pts], [p[1] for p in pts]
    return np.interp(x, xs, zs).astype(F)


def cabin_front_x(g, z):
    c = g['cabin']
    t = (z - c['z_bottom']) / (c['z_top'] - c['z_bottom'])
    return F(c['x_bottom'][0]) + (F(c['x_top'][0]) - F(c['x_bottom'][0])) * t


def cabin_rear_x(g, z):
    c = g['cabin']
    t = (z - c['z_bottom']) / (c['z_top'] - c['z_bottom'])
    return F(c['x_bottom'][1]) + (F(c['x_top'][1]) - F(c['x_bottom'][1])) * t


def window_sd(g, U, Z, k):
    """Signed distance (world units, negative inside) to side window k."""
    x0, x1 = g['windows_x'][k]
    z0, z1 = g['window_z']
    terms = [U - F(x0), U - (cabin_front_x(g, Z) - F(g['a_pillar'])),
             F(x1) - U, (cabin_rear_x(g, Z) + F(g['c_pillar'])) - U,
             Z - F(z1), F(z0) - Z]
    return np.max(np.stack(terms), axis=0)


def cabin_sd(g, U, Z):
    """Signed distance to the cabin side trapezoid (world units)."""
    c = g['cabin']
    terms = [U - cabin_front_x(g, Z), cabin_rear_x(g, Z) - U, Z - F(c['z_top']), F(c['z_bottom']) - Z]
    return np.max(np.stack(terms), axis=0)


def arch_distance(g, U, Z):
    """Distance (world units) to the nearest wheel-arch notch outline, and a mask of the notch itself."""
    a = g['arch']
    zs, zt, hl, hh = g['z_sill'], a['z_top'], a['half_low'], a['half_high']
    best = np.full(U.shape, 1e3, F)
    inside = np.zeros(U.shape, F)
    for ax in g['axles']:
        for (x0, z0, x1, z1) in ((ax + hl, zs, ax + hh, zt), (ax + hh, zt, ax - hh, zt), (ax - hh, zt, ax - hl, zs)):
            d, _ = tl.sd_segment(U, Z, x0, z0, x1, z1)
            best = np.minimum(best, d)
        t = np.clip((Z - zs) / (zt - zs), 0, 1)
        half = hl + (hh - hl) * t
        inside = np.maximum(inside, ((np.abs(U - ax) < half) & (Z < zt)).astype(F))
    return best, inside


def seam_lines(U, xs, px_per_unit, width_px=1.0):
    """Coverage of vertical 1 px lines at world x positions."""
    m = np.zeros(U.shape, F)
    for x in xs:
        m = np.maximum(m, tl.fill(np.abs(U - F(x)) * F(px_per_unit) - F(width_px) * 0.5, 0.75))
    return m


def hline(V, z, ppu, width_px=1.0):
    return tl.fill(np.abs(V - F(z)) * F(ppu) - F(width_px) * 0.5, 0.75)


# ---------------------------------------------------------------------------------------------------
# Shared paint building blocks

def glass_value(Z, z0, z1, U, seed, salt, dark=0.15, sky=0.42):
    """Grey glass: dark, a pale sky reflection in the upper part, one soft diagonal streak."""
    t = np.clip((Z - z0) / F(z1 - z0), 0, 1)
    v = dark + (sky - dark) * tl.smoothstep(0.55, 1.0, t)
    streak = np.exp(-(((U * 0.9 + Z * 1.0) % 2.6) - 1.3) ** 2 / 0.06)
    return (v + 0.07 * streak * (1 - t)).astype(F)


def chrome_profile(V01):
    """Chrome strip across its height (V01 = 0 at the top edge, 1 at the bottom): reflected sky over
    reflected street, a dark band and a bright lower lip."""
    stops = [(0.0, 0.97), (0.12, 0.88), (0.3, 0.78), (0.42, 0.5), (0.62, 0.3), (0.78, 0.22), (0.9, 0.62), (1.0, 0.5)]
    xs, vs = zip(*stops)
    return np.interp(V01, xs, vs).astype(F)


def disc_coords(r):
    """Normalised (dx, dy, radius) over a disc region, radius 1 at the rect's inscribed circle."""
    X, Y = r.px()
    dx, dy = (X - r.w / 2) / F(r.w / 2), (Y - r.h / 2) / F(r.h / 2)
    return dx, dy, np.hypot(dx, dy)


def tread(r, seed, salt, rubber=0.085, shoulder=0.16):
    X, Y = r.px()
    V = Y / F(r.h)
    v = np.full((r.h, r.w), rubber, F)
    ribs = (np.abs(V - 0.36) < 0.04) | (np.abs(V - 0.64) < 0.04)
    v = np.where(ribs, F(0.035), v)
    # lateral grooves, staggered per rib (U wraps round the tyre: whole periods across the width)
    rib = np.floor(V * 3).astype(int)
    phase = (X + rib * 2.0) % 6.0
    v = np.where((phase < 1.2) & ~ribs, F(0.04), v)
    edge = np.minimum(V, 1 - V)
    v = lerp(v, F(shoulder), tl.smoothstep(0.14, 0.02, edge))
    return grain(v * mottle(r.w, r.h, seed, salt, 2, 2, 0.08), seed, salt, 0.05, 0)


# ---------------------------------------------------------------------------------------------------
# car_sedan (grayscale body, tinted in the game)

def sedan_side(r, g, seed):
    U, Z = r.world()
    pu, pv, pm = r.ppu()
    w, h = r.w, r.h
    zs, zw = g['z_sill'], g['z_waist']
    topz = top_z_at(g, U)
    base = F(0.64) * mottle(w, h, seed, 'side/m', 4, 1, 0.035)
    on_cabin = cabin_sd(g, U, Z) < 0.02
    low = F(0.66) + F(0.34) * tl.smoothstep(zs, zw - 0.2, Z)
    shoulder = 1.0 + F(0.07) * tl.smoothstep(zw, zw + 0.15, Z)
    v = base * np.where(Z < zw, low, shoulder)
    v = np.where(on_cabin & (Z > topz), base * F(1.08), v)  # cabin sides lean in: a touch lighter
    # waist crease: shadow under it, highlight over it; the shoulder's top edge catches light
    v *= 1 - 0.35 * hline(Z, zw - 0.5 / pv, pv)
    v = lerp(v, base * 1.18, 0.7 * hline(Z, zw + 0.5 / pv, pv))
    v = lerp(v, base * 1.15, 0.6 * hline(Z, topz - 0.5 / pv, pv) * (~on_cabin))
    # rubbing strip and door seams
    v = lerp(v, F(0.17), hline(Z, g['trim_z'], pv, 2.0))
    seams = seam_lines(U, g['doors_x'], pu) * (Z > zs + 0.06) * (Z < topz)
    v *= 1 - 0.55 * seams
    dx = g['doors_x']
    for xf, xr in zip(dx[:-1], dx[1:]):
        hx = xr + 0.36
        sd = tl.sd_box(U * F(pu), Z * F(pv), hx * pu, (zw + 0.13) * pv, 1.6, 0.6)
        v = lerp(v, F(0.22), tl.fill(sd, 0.8))
    # sill, arch shadow, grime and mud spray behind the wheels
    v *= 1 - 0.38 * tl.smoothstep(zs + 0.26, zs + 0.04, Z)
    d, _ = arch_distance(g, U, Z)
    v *= 1 - 0.5 * np.exp(-d / 0.14)
    lowmask = 1 - tl.smoothstep(zs, zs + 0.75, Z)
    spray = np.zeros_like(v)
    hl = g['arch']['half_low']
    for ax in g['axles']:
        spray = np.maximum(spray, tl.smoothstep(ax - hl + 0.1, ax - hl - 0.3, U) * tl.smoothstep(ax - hl - 1.6, ax - hl - 0.4, U)
                           * (1 - tl.smoothstep(zs, zs + 1.0, Z)))
    dirt = frac_mask(w, h, seed, 'side/dirt', 6, 2, 0.55) * np.clip(0.8 * lowmask + spray, 0, 1)
    v = lerp(v, base * 0.55, 0.65 * dirt)
    rust = frac_mask(w, h, seed, 'side/rust', 8, 3, 0.04) * lowmask
    v = lerp(v, F(0.38), 0.5 * rust)
    # cabin: window glass with a rubber seal, the line where the cabin meets the body
    for k in range(len(g['windows_x'])):
        sd = window_sd(g, U, Z, k) * F(pm)
        gl = glass_value(Z, g['window_z'][0], g['window_z'][1], U, seed, f'win{k}')
        v = lerp(v, gl, tl.fill(sd, 0.8))
        v = lerp(v, F(0.1), 0.85 * tl.ring(sd - 0.6, 1.0))
    c = g['cabin']
    v = lerp(v, F(0.2), 0.6 * hline(Z, c['z_bottom'] + 0.5 / pv, pv) * (cabin_sd(g, U, Z + 0.1) < 0))
    v = lerp(v, base * 1.2, 0.5 * hline(Z, c['z_top'] - 0.5 / pv, pv) * (cabin_sd(g, U, Z - 0.1) < 0))
    return grain(np.clip(v, 0, 1), seed, 'side/g', 0.04, 0)


def sedan_top(r, g, seed):
    X, Y = r.world()
    pu, pv, pm = r.ppu()
    w, h = r.w, r.h
    c = g['cabin']
    base = F(0.83) * mottle(w, h, seed, 'top/m', 4, 2, 0.04)
    hw = g['half_width'] - g['shoulder_inset']
    v = base * (1 - 0.13 * tl.smoothstep(hw - 0.3, hw + 0.02, np.abs(Y)))
    # nose and tail ends roll over: darker last 0.2
    v *= 1 - 0.1 * tl.smoothstep(g['x_nose'] - 0.2, g['x_nose'], X) - 0.1 * tl.smoothstep(g['x_tail'] + 0.2, g['x_tail'], X)

    def panel_ring(x0, x1, half):
        sd = tl.sd_rect(X * F(pu), Y * F(pv), x0 * pu, -half * pv, x1 * pu, half * pv, 1.5)
        return tl.ring(sd, 1.0)

    v *= 1 - 0.5 * panel_ring(c['x_bottom'][0] + 0.2, g['x_nose'] - 0.1, hw - 0.18)
    v *= 1 - 0.5 * panel_ring(g['x_tail'] + 0.12, c['x_bottom'][1] - 0.14, hw - 0.2)
    cowl = (X > c['x_bottom'][0] - 0.05) & (X < c['x_bottom'][0] + 0.17) & (np.abs(Y) < hw - 0.15)
    slots = ((Y * F(pv)) % 3.0 < 1.0)
    v = np.where(cowl, np.where(slots, F(0.22), F(0.4)), v)
    roof = tl.fill(tl.sd_rect(X * F(pu), Y * F(pv), c['x_top'][1] * pu, -c['half_top'] * pv,
                              c['x_top'][0] * pu, c['half_top'] * pv, 2.0))
    v = lerp(v, base * 1.05, roof)
    for s in (-1, 1):
        v *= 1 - 0.4 * hline(Y, s * (c['half_top'] - 0.1), pv) * roof
    dust = tl.speckle(w, h, seed, 0.05, (0.5, 0.8), (0.3, 0.7), tl.DECAL, salt='top/dust')
    v = lerp(v, F(0.9), 0.35 * dust)
    grime = frac_mask(w, h, seed, 'top/grime', 6, 3, 0.25) * tl.smoothstep(hw - 0.6, hw, np.abs(Y))
    v = lerp(v, base * 0.7, 0.45 * grime)
    return grain(np.clip(v, 0, 1), seed, 'top/g', 0.035, 0)


def slant_len(g, front):
    c = g['cabin']
    i = 0 if front else 1
    return math.hypot(c['x_bottom'][i] - c['x_top'][i], c['z_top'] - c['z_bottom'])


def glass_sd(r, g, front, inset_side=0.1, inset_top=0.1, inset_bottom=0.08):
    """Signed distance (px) of a windshield/rear-window region's glass; also returns (Yw, S, half)."""
    Yw, S = r.world()
    c = g['cabin']
    L = slant_len(g, front)
    half = F(c['half_bottom']) + (F(c['half_top']) - F(c['half_bottom'])) * S
    pu = r.w / abs(r.frame['u'][2] - r.frame['u'][1])
    pv = r.h / L
    sd = np.maximum((np.abs(Yw) - (half - F(inset_side))) * F(pu),
                    np.maximum((S - (1 - inset_top / L)) * F(L * pv), (inset_bottom / L - S) * F(L * pv)))
    return sd, Yw, S, half


def sedan_glass(r, g, seed, front):
    sd, Yw, S, half = glass_sd(r, g, front)
    w, h = r.w, r.h
    paint = F(0.74) * mottle(w, h, seed, 'glass/p', 2, 1, 0.03)
    gl = glass_value(S, 0.0, 1.0, Yw * 0.5, seed, 'wsg', 0.16, 0.44)
    if front:
        clean = np.zeros_like(S)
        L = slant_len(g, True)
        for py in (-0.8, 0.85):
            clean = np.maximum(clean, tl.fill((np.hypot(Yw - py, S * L) - 1.25) * 12, 1.0))
        gl = lerp(gl, F(0.36), 0.5 * (1 - clean) * tl.smoothstep(0.75, 0.0, S))
    else:
        gl = np.where(S < 0.12, F(0.09), gl)
        lines = (((1 - S) * h) % 3.0 < 1.0) & (S > 0.2) & (S < 0.85) & (np.abs(Yw) < half - 0.4)
        gl = np.where(lines, gl * 0.8, gl)
    v = lerp(paint, gl, tl.fill(sd, 0.8))
    v = lerp(v, F(0.1), 0.85 * tl.ring(sd - 0.6, 1.0))
    return grain(np.clip(v, 0, 1), seed, 'glass/g' + str(front), 0.03, 0)


def flat_dark(r, seed, salt, value=0.1, mud=0.22):
    v = np.full((r.h, r.w), value, F) * mottle(r.w, r.h, seed, salt, 2, 2, 0.15)
    m = frac_mask(r.w, r.h, seed, salt + '/mud', 3, 3, 0.4)
    return grain(lerp(v, F(mud), 0.5 * m), seed, salt + '/g', 0.05, 0)


def flat_paint(r, seed, salt, value):
    v = F(value) * mottle(r.w, r.h, seed, salt, 4, 1, 0.04)
    return grain(v, seed, salt + '/g', 0.035, 0)


# ---------------------------------------------------------------------------------------------------
# Colour helpers

C = tl.rgb


def col(v):
    """Grey value(s) to an (h, w, 3) colour."""
    v = np.asarray(v, F)
    return np.repeat(v[..., None], 3, axis=-1)


def put(img, colour, mask):
    """Blend a colour (rgb triple or (h, w, 3)) into img by mask."""
    m = np.asarray(mask, F)[..., None]
    return img + (np.asarray(colour, F) - img) * m


def box_px(r, yc, zc, hy, hz, rad=0.0):
    """sd (px) of a world-space box on a (u, v) planar region; centre (yc, zc), half sizes (hy, hz)."""
    U, V = r.world()
    pu, pv, _ = r.ppu()
    return tl.sd_box(U * F(pu), V * F(pv), yc * pu, zc * pv, hy * pu, hz * pv, rad)


def lamp(img, r, yc, zc, hy, hz, glass, rim=0.86, rad=1.0, reflector=True):
    sd = box_px(r, yc, zc, hy, hz, rad)
    img = put(img, col(F(rim)), tl.fill(sd - 1.0, 0.7))
    img = put(img, glass, tl.fill(sd + 0.2, 0.7))
    if reflector:
        sdi = box_px(r, yc, zc, hy * 0.45, hz * 0.45, rad)
        img = put(img, np.asarray(glass, F) * F(0.8), 0.6 * tl.ring(sdi, 1.0))
        hi = box_px(r, yc - hy * 0.35, zc + hz * 0.35, hy * 0.18, hz * 0.18)
        img = put(img, C(250, 250, 245), 0.8 * tl.fill(hi, 0.7))
    return img


def chrome_strip(r, seed, salt, tint=(1.0, 1.0, 1.0), pits=True):
    X, Y = r.px()
    v = chrome_profile(Y / F(r.h)) * mottle(r.w, r.h, seed, salt, 4, 1, 0.05)
    img = col(v) * np.asarray(tint, F)
    if pits:
        p = tl.speckle(r.w, r.h, seed, 0.04, (0.5, 0.7), (0.3, 0.6), tl.STRIP, salt=salt + '/pit')
        img = img * (1 - 0.35 * p)[..., None]
    return grain(np.clip(img, 0, 1), seed, salt + '/g', 0.02, 0.008)


# ---------------------------------------------------------------------------------------------------
# car_sedan lights and wheels (colour, not tinted)

def sedan_nose(r, g, seed):
    Yw, Z = r.world()
    pu, pv, _ = r.ppu()
    ztop = top_z_at(g, g['x_nose'])
    img = col(np.full((r.h, r.w), 0.07, F))
    panel = (Z > 1.1) & (Z < ztop - 0.1)
    grille = col(F(0.1)) * F(1.0)
    img = put(img, grille, panel)
    bars = ((((Z - 1.1) * F(pv)) % 3.0) < 1.0) & (np.abs(Yw) < 1.0) & (Z > 1.22) & (Z < 1.8)
    img = put(img, col(F(0.58)), bars * 1.0)
    img = put(img, col(F(0.82)), tl.ring(box_px(r, 0, 1.51, 1.04, 0.3, 0.8), 1.0))
    img = put(img, col(F(0.52)), (Z >= ztop - 0.1) * 1.0)               # paint lip under the hood edge
    img = put(img, col(F(0.36)), hline(Z, ztop - 0.1, pv) * (np.abs(Yw) < 1.95))
    hy = 0.31
    for s in (-1, 1):
        img = lamp(img, r, s * 1.45, 1.55, hy, hy, C(232, 226, 196), rad=0.6)
        img = lamp(img, r, s * 1.45, 1.17, 0.26, 0.055, C(236, 140, 30), rim=0.7, rad=0.0, reflector=False)
    img = put(img, col(F(0.5)), (np.abs(Yw) > 1.9) * (Z > 1.1) * 1.0)  # body-colour wrap at the corners
    return grain(np.clip(img, 0, 1), seed, 'nose/g', 0.03, 0.01)


def sedan_tail(r, g, seed):
    Yw, Z = r.world()
    pu, pv, _ = r.ppu()
    ztop = top_z_at(g, g['x_tail'])
    img = col(np.full((r.h, r.w), 0.07, F))
    img = put(img, col(F(0.15)), ((Z > 1.1) & (Z < ztop - 0.12)) * 1.0)   # black rear panel
    img = put(img, col(F(0.52)), (Z >= ztop - 0.12) * 1.0)
    img = put(img, col(F(0.3)), hline(Z, ztop - 0.12, pv))
    for s in (-1, 1):
        yc = s * 1.5
        sd = box_px(r, yc, 1.54, 0.4, 0.25, 0.6)
        img = put(img, col(F(0.8)), tl.fill(sd - 1.0, 0.7))
        img = put(img, C(185, 28, 22), tl.fill(sd + 0.2, 0.7) * (Z > 1.6))
        img = put(img, C(230, 130, 25), tl.fill(sd + 0.2, 0.7) * (Z <= 1.6) * (Z > 1.45))
        img = put(img, np.where((np.abs(Yw) < 1.45)[..., None], C(220, 220, 214), C(160, 24, 20)),
                  tl.fill(sd + 0.2, 0.7) * (Z <= 1.45))
        img = put(img, col(F(0.35)), 0.6 * seam_lines(Yw, [yc - 0.13, yc + 0.13], pu) * (tl.fill(sd + 0.2) > 0.5))
    plate = box_px(r, 0, 1.36, 0.66, 0.2, 0.5)
    img = put(img, col(F(0.2)), tl.fill(plate - 1.0, 0.7))
    img = put(img, C(212, 210, 200), tl.fill(plate + 0.3, 0.7))
    for s in (-1, 1):
        img = put(img, col(F(0.45)), tl.fill(box_px(r, s * 0.5, 1.36, 0.04, 0.04), 0.7))
    img = put(img, col(F(0.5)), (np.abs(Yw) > 1.92) * (Z > 1.1) * 1.0)
    return grain(np.clip(img, 0, 1), seed, 'tail/g', 0.03, 0.01)


def rubber(r, seed, salt, value=0.07):
    v = np.full((r.h, r.w), value, F) + F(0.08) * tl.speckle(r.w, r.h, seed, 0.05, (0.4, 0.7), (0.3, 0.8), tl.DECAL, salt=salt)
    return col(grain(v, seed, salt + '/g', 0.05, 0))


def wheel_face(r, seed, salt, whitewall=False):
    dx, dy, rad = disc_coords(r)
    pxr = r.w / 2.0                                   # px per unit radius
    ang = np.arctan2(dy, dx)
    tyre = F(0.085) + F(0.03) * tl.smoothstep(0.78, 0.82, rad) * tl.smoothstep(0.86, 0.82, rad)
    img = col(tyre)
    img = put(img, col(F(0.2)), tl.smoothstep(0.9, 1.0, rad))          # dusty tread shoulder
    if whitewall:
        ww = tl.fill((np.abs(rad - 0.77) - 0.085) * pxr, 0.8)
        img = put(img, C(232, 228, 214), ww)
        hub_r, rim_r = 0.62, 0.62
        img = put(img, col(F(0.06)), tl.fill((rad - rim_r) * pxr, 0.8))
        dome = F(0.95) - F(0.4) * rad / F(hub_r)
        img = put(img, col(dome), tl.fill((rad - hub_r + 0.04) * pxr, 0.8))
        img = put(img, col(F(0.98)), 0.9 * tl.ring((rad - (hub_r - 0.07)) * pxr, 1.0))
        slots = (np.abs(rad - 0.43) < 0.06) & ((ang * 8 / (2 * math.pi)) % 1.0 < 0.45)
        img = put(img, col(F(0.15)), slots * 1.0)
        img = put(img, C(222, 172, 60), tl.fill((rad - 0.13) * pxr, 0.8))
        img = put(img, C(255, 230, 140), tl.fill((np.hypot(dx + 0.04, dy + 0.04) - 0.04) * pxr, 0.8))
    else:
        rim_r, hub_r = 0.62, 0.3
        steel = F(0.3) + F(0.06) * np.cos(ang * 2)
        img = put(img, col(steel), tl.fill((rad - rim_r) * pxr, 0.8))
        img = put(img, col(F(0.55)), 0.8 * tl.ring((rad - (rim_r - 0.04)) * pxr, 1.0))
        holes = (np.abs(rad - 0.46) < 0.05) & ((ang * 6 / (2 * math.pi)) % 1.0 < 0.35)
        img = put(img, col(F(0.06)), holes * 1.0)
        img = put(img, col(F(0.82) - F(0.25) * rad / F(hub_r)), tl.fill((rad - hub_r) * pxr, 0.8))
        img = put(img, col(F(0.95)), 0.7 * tl.ring((rad - (hub_r - 0.05)) * pxr, 1.0))
        img = put(img, col(F(0.25)), tl.fill((rad - 0.08) * pxr, 0.8))
    return grain(np.clip(img, 0, 1), seed, salt, 0.03, 0.006)


# ---------------------------------------------------------------------------------------------------
# car_limo (fixed black paint, chrome, curtains, flags)

BLACK_SIDE = C(26, 27, 31)
BLACK_LOW = C(18, 19, 22)
SHEEN = C(70, 76, 88)
BLACK_TOP = C(44, 46, 54)
CREAM = C(222, 208, 170)
GOLD = C(214, 168, 64)
GLASS_TINT = np.array([0.92, 1.05, 1.02], F)


def curtain(U, Z, z0, z1, pu, seed, salt):
    """Closed pleated cream curtain: vertical folds 2-3 px apart, a gather at the middle height."""
    folds = 0.5 + 0.5 * np.sin(U * F(pu) * F(2 * math.pi / 2.6))
    t = np.clip((Z - z0) / F(z1 - z0), 0, 1)
    shade = F(0.78) + F(0.22) * folds
    shade *= 1 - 0.25 * np.exp(-((t - 0.45) / 0.08) ** 2)          # tie-back gather
    shade *= 1 - 0.18 * tl.smoothstep(0.75, 1.0, t)                 # pelmet shadow at the top
    return CREAM * shade[..., None]


def limo_side(r, g, seed):
    U, Z = r.world()
    pu, pv, pm = r.ppu()
    w, h = r.w, r.h
    zs, zw, zt = g['z_sill'], g['z_waist'], g['trim_z']
    topz = top_z_at(g, U)
    m = mottle(w, h, seed, 'lside/m' + r.name, 4, 1, 0.05)[..., None]
    img = np.where((Z < zt)[..., None], BLACK_LOW, BLACK_SIDE) * m
    band = tl.smoothstep(zw - 0.05, zw + 0.1, Z) * (1 - 0.5 * tl.smoothstep(zw + 0.2, topz, Z))
    img = put(img, SHEEN, 0.75 * band)
    on_cabin = cabin_sd(g, U, Z) < 0.02
    img = np.where((on_cabin & (Z > topz))[..., None], C(36, 38, 44) * m, img)
    img = put(img, GOLD, 0.9 * hline(Z, topz - 0.5 / pv, pv) * (~on_cabin))   # gold pinstripe on the shoulder
    img = put(img, col(F(0.06)), 0.8 * hline(Z, zw - 0.5 / pv, pv))
    # chrome: trim strip, sill moulding
    img = put(img, col(F(0.92)), hline(Z, zt + 0.5 / pv, pv))
    img = put(img, col(F(0.55)), hline(Z, zt - 0.5 / pv, pv))
    img = put(img, col(F(0.7)), hline(Z, zs + 0.12, pv))
    # door seams with a lit edge, chrome handles
    seams = seam_lines(U, g['doors_x'], pu) * (Z > zs + 0.06) * (Z < topz)
    lit = seam_lines(U, [x - 1.0 / pu for x in g['doors_x']], pu) * (Z > zs + 0.06) * (Z < topz)
    img = put(img, col(F(0.01)), seams)
    img = put(img, C(60, 64, 74), 0.7 * lit * (1 - seams))
    dx = g['doors_x']
    for xf, xr in zip(dx[:-1], dx[1:]):
        if xf - xr < 1.0:
            continue
        sd = tl.sd_box(U * F(pu), Z * F(pv), (xr + 0.36) * pu, (zw + 0.12) * pv, 1.8, 0.6)
        img = put(img, col(F(0.88)), tl.fill(sd, 0.8))
    # arches: shadow inside a thin lit lip
    d, _ = arch_distance(g, U, Z)
    img = img * (1 - 0.45 * np.exp(-d / 0.18))[..., None]
    img = put(img, C(96, 100, 110), 0.8 * tl.fill(np.abs(d * F(pm) - 1.2) - 0.5, 0.7))
    # gold badge behind the front arch
    bx = g['axles'][0] - g['arch']['half_low'] - 0.45
    sd = tl.sd_box(U * F(pu), Z * F(pv), bx * pu, 1.58 * pv, 2.6, 1.1, 1.0)
    img = put(img, GOLD, tl.fill(sd, 0.8))
    img = put(img, C(255, 232, 150), tl.fill(sd + 1.0, 0.8) * 0.6)
    # cabin glass: frames, curtains
    z0, z1 = g['window_z']
    for k in range(len(g['windows_x'])):
        sd = window_sd(g, U, Z, k) * F(pm)
        if g['curtains'][k]:
            gl = curtain(U, Z, z0, z1, pu, seed, f'cur{k}')
            gl = put(gl, C(150, 168, 175), 0.3 * tl.smoothstep(0.7, 1.0, (Z - z0) / (z1 - z0)))
        else:
            gl = np.clip(glass_value(Z, z0, z1, U, seed, f'lw{k}', 0.1, 0.4)[..., None] * GLASS_TINT, 0, 1)
        img = put(img, gl, tl.fill(sd, 0.8))
        img = put(img, col(F(0.86)), 0.95 * tl.ring(sd - 0.6, 1.0))
    c = g['cabin']
    img = put(img, col(F(0.8)), 0.8 * hline(Z, c['z_top'] - 0.5 / pv, pv) * (cabin_sd(g, U, Z - 0.1) < 0))
    # gold crest on the C-pillar
    zc = 0.5 * (z0 + z1)
    xc = 0.5 * (g['windows_x'][-1][1] + float(cabin_rear_x(g, zc)))
    if min(r.frame['u'][1:]) <= xc <= max(r.frame['u'][1:]):
        sd = tl.sd_circle(U * F(pu), Z * F(pv), xc * pu, zc * pv, 2.2)
        img = put(img, GOLD, tl.fill(sd, 0.8))
        img = put(img, C(160, 20, 18), tl.fill(sd + 1.2, 0.8))
    return grain(np.clip(img, 0, 1), seed, 'lside/g' + r.name, 0.02, 0.006)


def limo_top(r, g, seed, part):
    X, Y = r.world()
    pu, pv, _ = r.ppu()
    w, h = r.w, r.h
    hw = g['half_width'] - g['shoulder_inset']
    sheen = 1.0 + 0.12 * tl.fbm(w, h, 2, 2, seed, 'ltop/' + part, octaves=3)
    img = BLACK_TOP * sheen[..., None]
    img = img * (1 - 0.35 * tl.smoothstep(hw - 0.35, hw, np.abs(Y)))[..., None]
    c = g['cabin']
    if part == 'hood':
        img = put(img, col(F(0.85)), hline(Y, 0.0, pv) * (X > c['x_bottom'][0] + 0.25))
        for s in (-1, 1):
            img = put(img, col(F(0.04)), hline(Y, s * (hw - 0.25), pv) * (X > c['x_bottom'][0] + 0.2))
        img = put(img, col(F(0.04)), seam_lines(X, [c['x_bottom'][0] + 0.2], pu))
        img = img * (1 - 0.3 * tl.smoothstep(g['x_nose'] - 0.25, g['x_nose'], X))[..., None]
    elif part == 'roof':
        for s in (-1, 1):
            img = put(img, col(F(0.82)), hline(Y, s * (c['half_top'] - 0.08), pv))
        img = img * (1 + 0.15 * tl.smoothstep(1.2, 0.0, np.abs(Y)))[..., None]
    else:
        sd = tl.sd_rect(X * F(pu), Y * F(pv), (g['x_tail'] + 0.15) * pu, -(hw - 0.25) * pv,
                        (c['x_bottom'][1] - 0.15) * pu, (hw - 0.25) * pv, 1.0)
        img = put(img, col(F(0.04)), tl.ring(sd, 1.0))
        img = put(img, col(F(0.85)), seam_lines(X, [g['x_tail'] + 0.06], pu) * (np.abs(Y) < hw - 0.1))
    return grain(np.clip(img, 0, 1), seed, 'ltop/g' + part, 0.02, 0.006)


def limo_nose(r, g, seed):
    Yw, Z = r.world()
    pu, pv, _ = r.ppu()
    ztop = top_z_at(g, g['x_nose'])
    img = col(np.full((r.h, r.w), 0.05, F))
    img = put(img, BLACK_SIDE * 1.2, (Z > 1.12) * 1.0)
    img = put(img, BLACK_TOP, (Z > ztop - 0.12) * 1.0)
    # grille: chrome surround, vertical bars
    sd = box_px(r, 0, 1.5, 1.0, 0.4, 1.0)
    img = put(img, col(F(0.9)), tl.fill(sd - 1.2, 0.7))
    inside = tl.fill(sd + 0.6, 0.7)
    bars = np.where(((Yw * F(pu)) % 3.0) < 1.6, F(0.82), F(0.12))
    bars = bars * (0.8 + 0.25 * tl.smoothstep(1.1, 1.9, Z))
    img = put(img, col(bars), inside)
    for s in (-1, 1):
        for yc in (1.42, 1.84):
            img = lamp(img, r, s * yc, 1.6, 0.18, 0.18, C(236, 232, 210), rim=0.9, rad=0.8)
        img = lamp(img, r, s * 1.63, 1.24, 0.38, 0.05, C(236, 140, 30), rim=0.8, reflector=False)
    # gold emblem over the grille
    sd = tl.sd_circle(Yw * F(pu), Z * F(pv), 0, 1.97 * pv, 1.6)
    img = put(img, GOLD, tl.fill(sd, 0.8))
    return grain(np.clip(img, 0, 1), seed, 'lnose/g', 0.02, 0.006)


def limo_tail(r, g, seed):
    Yw, Z = r.world()
    pu, pv, _ = r.ppu()
    ztop = top_z_at(g, g['x_tail'])
    img = col(np.full((r.h, r.w), 0.05, F))
    img = put(img, BLACK_SIDE * 1.2, (Z > 1.12) * 1.0)
    img = put(img, BLACK_TOP, (Z > ztop - 0.12) * 1.0)
    img = put(img, col(F(0.85)), hline(Z, ztop - 0.12, pv))
    for s in (-1, 1):
        sd = box_px(r, s * 1.65, 1.52, 0.42, 0.17, 0.5)
        img = put(img, col(F(0.88)), tl.fill(sd - 1.0, 0.7))
        img = put(img, C(196, 26, 20), tl.fill(sd + 0.2, 0.7))
    plate = box_px(r, 0, 1.4, 0.62, 0.2, 0.5)
    img = put(img, col(F(0.85)), tl.fill(plate - 1.0, 0.7))
    img = put(img, C(214, 212, 202), tl.fill(plate + 0.2, 0.7))
    return grain(np.clip(img, 0, 1), seed, 'ltail/g', 0.02, 0.006)


def limo_glass(r, g, seed, front):
    sd, Yw, S, half = glass_sd(r, g, front, 0.14, 0.1, 0.1)
    img = BLACK_TOP * np.ones((r.h, r.w, 1), F)
    if front:
        gl = glass_value(S, 0.0, 1.0, Yw * 0.5, seed, 'lws', 0.1, 0.42)[..., None] * GLASS_TINT
    else:
        pu = r.w / abs(r.frame['u'][2] - r.frame['u'][1])
        gl = curtain(Yw, S, 0.0, 1.0, pu, seed, 'lrw')
    img = put(img, np.clip(gl, 0, 1), tl.fill(sd, 0.8))
    img = put(img, col(F(0.88)), 0.95 * tl.ring(sd - 0.6, 1.0))
    return grain(np.clip(img, 0, 1), seed, 'lglass/g' + str(front), 0.02, 0.006)


def flag(r, seed):
    X, Y = r.px()
    u = X / F(r.w)
    wave = 1.0 + 0.12 * np.sin(u * F(2 * math.pi * 1.5) + 0.6)
    img = C(178, 18, 16) * wave[..., None]
    border = (X < 1.0) | (X > r.w - 1.0) | (Y < 1.0) | (Y > r.h - 1.0)
    img = np.where(border[..., None], GOLD * wave[..., None], img)
    cx, cy, R = r.w * 0.3, r.h * 0.5, 3.4
    ang = np.arctan2(-(Y - cy), X - cx) - math.pi / 2
    k = (0.5 + 0.5 * np.cos(5 * ang)) ** 3
    star = np.hypot(X - cx, Y - cy) < R * (0.42 + 0.58 * k)
    img = np.where(star[..., None], C(246, 206, 90), img)
    return grain(np.clip(img, 0, 1), seed, 'flag/g', 0.02, 0.006)


def gold(r, seed):
    dx, dy, rad = disc_coords(r)
    v = 0.85 + 0.25 * (0.5 - 0.5 * dy) - 0.2 * rad
    img = GOLD * v[..., None]
    img = put(img, C(255, 240, 180), tl.fill((np.hypot(dx + 0.3, dy + 0.3) - 0.18) * r.w / 2, 0.8))
    return grain(np.clip(img, 0, 1), seed, 'gold/g', 0.02, 0.006)


# ---------------------------------------------------------------------------------------------------
# Emblems shared by the service vehicles

def star5_mask(X, Y, cx, cy, R):
    """Filled five-point star (point up), hard-edged at pixel scale."""
    ang = np.arctan2(-(Y - cy), X - cx) - math.pi / 2
    k = (0.5 + 0.5 * np.cos(5 * ang)) ** 3
    return (np.hypot(X - cx, Y - cy) < R * (0.42 + 0.58 * k)).astype(F)


def roundel(img, X, Y, cx, cy, R):
    """The regime roundel: gold ring, red disc, gold five-point star (the limo pennant's star)."""
    d = np.hypot(X - cx, Y - cy)
    img = put(img, GOLD * 0.85, tl.fill(d - R, 0.7))
    img = put(img, C(170, 22, 18), tl.fill(d - (R - 1.2), 0.7))
    img = put(img, C(240, 196, 80), star5_mask(X, Y, cx, cy, R * 0.72))
    return img


def star_of_life(img, X, Y, cx, cy, R, blue=C(36, 84, 190)):
    """Six-armed blue star (three bars at 60 degrees) with a white staff down the middle. Not a red cross."""
    m = np.zeros(X.shape, F)
    for a in (0.0, math.pi / 3, 2 * math.pi / 3):
        ca, sa = math.cos(a), math.sin(a)
        u = (X - cx) * ca + (Y - cy) * sa
        v = -(X - cx) * sa + (Y - cy) * ca
        m = np.maximum(m, tl.fill(np.maximum(np.abs(u) - R * 0.3, np.abs(v) - R), 0.7))
    img = put(img, blue, m)
    staff = tl.fill(np.maximum(np.abs(X - cx) - max(0.5, R * 0.07), np.abs(Y - cy) - R * 0.72), 0.6)
    return put(img, C(245, 245, 240), staff)


# ---------------------------------------------------------------------------------------------------
# car_jeep_military (olive drab, fixed colour)

OLIVE = C(92, 98, 56)
OLIVE_DARK = C(62, 66, 38)
SAND = C(150, 132, 96)
KHAKI = C(122, 114, 76)


def olive(w, h, seed, salt, base=OLIVE):
    m = mottle(w, h, seed, salt, 4, 2, 0.07)[..., None]
    fade = frac_mask(w, h, seed, salt + '/fade', 5, 3, 0.3)[..., None]
    img = base * m
    return img + (base * 1.12 + C(6, 4, 0) - img) * (0.22 * fade)


def mud(img, w, h, seed, salt, weight, colour=SAND, amount=0.75):
    d = frac_mask(w, h, seed, salt, 6, 3, 0.5) * np.clip(weight, 0, 1)
    sp = tl.speckle(w, h, seed, 0.03, (0.5, 0.9), (0.5, 1.0), tl.DECAL, salt=salt + '/sp') * np.clip(weight * 1.5, 0, 1)
    return put(img, colour, np.clip(amount * d + 0.6 * sp, 0, 1))


def jeep_side(r, g, seed):
    U, Z = r.world()
    pu, pv, pm = r.ppu()
    X, Y = r.px()
    w, h = r.w, r.h
    zs = g['z_sill']
    topz = top_z_at(g, U)
    img = olive(w, h, seed, 'jside')
    img = img * (0.86 + 0.14 * tl.smoothstep(zs, zs + 0.9, Z))[..., None]          # lower side in shadow
    img = put(img, OLIVE * 1.3, 0.8 * hline(Z, topz - 0.5 / pv, pv))              # rim edge catches light
    img = put(img, OLIVE_DARK * 0.8, 0.6 * hline(Z, topz - 1.5 / pv, pv))
    rivets = (((U * F(pu)) % 6.0) < 1.0) & (np.abs(Z - (topz - 2.5 / pv)) < 0.5 / pv)
    img = put(img, OLIVE * 1.35, rivets * 0.8)
    # door outline: seams and a top edge, canvas strap handle, roundel
    x0, x1 = g['doors_x']
    z0, z1 = g['door_z']
    sd = tl.sd_rect(U * F(pu), Z * F(pv), x1 * pu, z0 * pv, x0 * pu, z1 * pv)
    img = put(img, OLIVE_DARK * 0.55, 0.85 * tl.ring(sd, 1.0))
    hd = tl.sd_box(U * F(pu), Z * F(pv), (x1 + 0.35) * pu, (z1 - 0.3) * pv, 2.0, 0.7)
    img = put(img, KHAKI * 0.7, tl.fill(hd, 0.7))
    rx, rz, rr = g['roundels']['door']
    img = roundel(img, U * F(pu), Z * F(pv), rx * pu, rz * pv, rr * pm)
    # arch shadow, mud and dust from the sill, chipped edges
    d, _ = arch_distance(g, U, Z)
    img = img * (1 - 0.5 * np.exp(-d / 0.15))[..., None]
    img = mud(img, w, h, seed, 'jside/mud', 1 - tl.smoothstep(zs, zs + 0.8, Z) + 0.6 * np.exp(-d / 0.25))
    chips = tl.speckle(w, h, seed, 0.02, (0.5, 0.8), (0.6, 1.0), tl.DECAL, salt='jside/chips')
    img = put(img, C(130, 128, 96), 0.7 * chips)
    return grain(np.clip(img, 0, 1), seed, 'jside/g', 0.04, 0.012)


def jeep_top(r, g, seed):
    X, Y = r.world()
    pu, pv, pm = r.ppu()
    Xp, Yp = r.px()
    w, h = r.w, r.h
    hw = g['half_width'] - g['shoulder_inset']
    t = g['tub']
    inner = hw - t['wall']
    img = olive(w, h, seed, 'jtop') * F(1.1)                                        # tops a touch lighter
    in_tub = (X < t['x'][0]) & (X > t['x'][1])
    hood = X >= t['x'][0]
    # hood: side seams, hinge line, latches, roundel
    for s in (-1, 1):
        img = put(img, OLIVE_DARK * 0.6, 0.8 * hline(Y, s * (hw - 0.28), pv) * hood)
    img = put(img, OLIVE_DARK * 0.6, 0.8 * seam_lines(X, [t['x'][0] + 0.12], pu) * (np.abs(Y) < hw - 0.28))
    rx, ry, rr = g['roundels']['hood']
    img = roundel(img, X * F(pu), Y * F(pv), rx * pu, ry * pv, rr * pm)
    # tub: rims light at the edge, floor dark and ribbed with sand in the ribs
    floor = in_tub & (np.abs(Y) < inner)
    ribs = ((Y * F(pv)) % 3.0) < 1.0
    fl = OLIVE_DARK * np.where(ribs, F(0.75), F(1.0))[..., None]
    fl = mud(fl, w, h, seed, 'jtop/floor', floor * 1.0, SAND * 0.8, 0.5)
    img = np.where(floor[..., None], fl, img)
    img = put(img, OLIVE * 1.3, 0.7 * hline(np.abs(Y), hw - 0.5 / pv, pv) * in_tub)
    img = put(img, OLIVE_DARK * 0.5, 0.8 * hline(np.abs(Y), inner + 0.5 / pv, pv) * in_tub)
    dust = 1 - tl.smoothstep(hw - 0.6, hw, np.abs(Y))
    img = mud(img, w, h, seed, 'jtop/dust', 0.35 * (1 - dust) * (~floor), SAND, 0.5)
    chips = tl.speckle(w, h, seed, 0.015, (0.5, 0.8), (0.6, 1.0), tl.DECAL, salt='jtop/chips')
    img = put(img, C(132, 130, 98), 0.6 * chips * (~floor))
    return grain(np.clip(img, 0, 1), seed, 'jtop/g', 0.04, 0.012)


def jeep_inner(r, g, seed):
    U, Z = r.world()
    img = olive(r.w, r.h, seed, 'jinner', OLIVE * 0.8)
    t = np.clip((Z - g['tub']['z_floor']) / (g['top_z'][-1][1] - g['tub']['z_floor']), 0, 1)
    img = img * (0.6 + 0.4 * t)[..., None]
    img = mud(img, r.w, r.h, seed, 'jinner/mud', 1 - t, SAND * 0.7, 0.5)
    return grain(np.clip(img, 0, 1), seed, 'jinner/g', 0.04, 0.01)


def jeep_windscreen(r, g, seed):
    X, Y = r.px()
    S = 1 - Y / F(r.h)
    img = olive(r.w, r.h, seed, 'jws')
    frame = (X < 2) | (X > r.w - 2) | (Y < 2) | (Y > r.h - 2) | (np.abs(X - r.w / 2) < 1)
    gl = (C(40, 48, 44) + (C(120, 132, 136) - C(40, 48, 44)) * tl.smoothstep(0.6, 1.0, S)[..., None])
    img = np.where(frame[..., None], img, gl)
    img = put(img, C(20, 22, 16), 0.7 * ((X == 2.5) | (X == r.w - 2.5) | (Y == 2.5) | (Y == r.h - 2.5)) * (~frame))
    return grain(np.clip(img, 0, 1), seed, 'jws/g', 0.03, 0.01)


def canvas(r, seed, salt, base):
    X, Y = r.px()
    img = base * mottle(r.w, r.h, seed, salt, 2, 2, 0.08)[..., None]
    weave = ((X + Y) % 2.0 < 1.0)
    img = img * np.where(weave, F(1.03), F(0.97))[..., None]
    seams = ((X % 8.0) < 1.0) | (Y < 1.0) | (Y > r.h - 1.0)
    img = put(img, base * 0.6, seams * 0.8)
    return grain(np.clip(img, 0, 1), seed, salt + '/g', 0.04, 0.01)


def jeep_nose(r, g, seed):
    Yw, Z = r.world()
    pu, pv, pm = r.ppu()
    img = olive(r.w, r.h, seed, 'jnose')
    img = put(img, C(24, 24, 18), (Z < 1.5) * 1.0)
    slots = (np.abs(Yw) < 0.95) & (Z > 1.6) & (Z < 2.55) & (((Yw * F(pu)) % 3.0) < 1.4)
    img = put(img, C(18, 20, 14), slots * 1.0)
    for s in (-1, 1):
        img = lamp(img, r, s * 1.42, 2.05, 0.3, 0.3, C(214, 210, 180), rim=0.42, rad=3.5)
        img = lamp(img, r, s * 1.9, 1.68, 0.1, 0.08, C(220, 130, 40), rim=0.3, reflector=False)
    img = put(img, OLIVE * 1.3, hline(Z, top_z_at(g, g['x_nose']) - 0.5 / pv, pv))
    img = mud(img, r.w, r.h, seed, 'jnose/mud', 1 - tl.smoothstep(1.4, 2.0, Z), SAND, 0.6)
    return grain(np.clip(img, 0, 1), seed, 'jnose/g', 0.03, 0.01)


def jeep_tail(r, g, seed):
    Yw, Z = r.world()
    pu, pv, pm = r.ppu()
    img = olive(r.w, r.h, seed, 'jtail')
    img = img * (0.85 + 0.15 * tl.smoothstep(1.2, 2.2, Z))[..., None]
    for s in (-1, 1):
        img = lamp(img, r, s * 1.85, 2.45, 0.16, 0.12, C(180, 26, 20), rim=0.3, reflector=False)
    rivets = (((Yw * F(pu)) % 6.0) < 1.0) & (np.abs(Z - 2.7) < 0.5 / pv)
    img = put(img, OLIVE * 1.35, rivets * 0.8)
    img = put(img, C(24, 24, 18), (Z < 1.3) * 1.0)
    img = mud(img, r.w, r.h, seed, 'jtail/mud', 1 - tl.smoothstep(1.2, 1.9, Z), SAND, 0.6)
    return grain(np.clip(img, 0, 1), seed, 'jtail/g', 0.03, 0.01)


def gunmetal(r, seed):
    X, Y = r.px()
    v = 0.16 + 0.12 * tl.smoothstep(r.h * 0.4, 0, Y)
    img = C(46, 50, 54) * (v / 0.2)[..., None]
    return grain(np.clip(img, 0, 1), seed, 'gunmetal/g', 0.04, 0.01)


def ammo_box(r, seed):
    X, Y = r.px()
    img = olive(r.w, r.h, seed, 'ammo')
    img = put(img, OLIVE * 1.35, (Y < 2) * 1.0)
    img = put(img, OLIVE_DARK * 0.6, (np.abs(Y - 2.5) < 0.5) * 1.0)
    img = put(img, C(60, 60, 50), ((np.abs(X - r.w / 2) < 2) & (Y > 2) & (Y < 6)) * 1.0)
    return grain(np.clip(img, 0, 1), seed, 'ammo/g', 0.04, 0.01)


def olive_tube(r, seed):
    X, Y = r.px()
    t = Y / F(r.h)
    img = OLIVE * (1.3 - 0.6 * t)[..., None]
    chips = tl.speckle(r.w, r.h, seed, 0.03, (0.5, 0.8), (0.6, 1.0), tl.DECAL, salt='tube/chips')
    img = put(img, C(70, 66, 56), 0.7 * chips)
    return grain(np.clip(img, 0, 1), seed, 'tube/g', 0.04, 0.01)


def jerry_can(r, seed):
    X, Y = r.px()
    img = olive(r.w, r.h, seed, 'jerry')
    cx, cy = r.w / 2, r.h / 2
    for sgn in (1, -1):
        d, _ = tl.sd_segment(X, Y, cx - r.w * 0.38, cy - sgn * r.h * 0.36, cx + r.w * 0.38, cy + sgn * r.h * 0.36)
        img = put(img, OLIVE * 1.3, tl.fill(d - 0.6, 0.6))
    border = (X < 1) | (X > r.w - 1) | (Y < 1) | (Y > r.h - 1)
    img = put(img, OLIVE_DARK * 0.6, border * 1.0)
    return grain(np.clip(img, 0, 1), seed, 'jerry/g', 0.04, 0.01)


def jeep_wheel_face(r, seed):
    dx, dy, rad = disc_coords(r)
    pxr = r.w / 2.0
    ang = np.arctan2(dy, dx)
    img = col(F(0.08) + F(0.03) * tl.smoothstep(0.8, 0.84, rad) * tl.smoothstep(0.9, 0.86, rad))
    lugs = (rad > 0.9) & ((ang * 16 / (2 * math.pi)) % 1.0 < 0.5)
    img = put(img, col(F(0.16)), lugs * 1.0)
    img = put(img, SAND * 0.7, 0.35 * tl.smoothstep(0.7, 1.0, rad) * (dy > 0.2))
    rim_r = 0.58
    img = put(img, OLIVE * (1.0 + 0.1 * np.cos(ang))[..., None], tl.fill((rad - rim_r) * pxr, 0.8))
    img = put(img, OLIVE_DARK * 0.6, 0.8 * tl.ring((rad - rim_r) * pxr, 1.0))
    for k in range(5):
        a = 2 * math.pi * k / 5
        img = put(img, col(F(0.55)), tl.fill((np.hypot(dx - 0.3 * math.cos(a), dy - 0.3 * math.sin(a)) - 0.06) * pxr, 0.7))
    img = put(img, col(F(0.12)), tl.fill((rad - 0.14) * pxr, 0.8))
    return grain(np.clip(img, 0, 1), seed, 'jface/g', 0.03, 0.006)


def jeep_tread(r, seed):
    X, Y = r.px()
    V = Y / F(r.h)
    chevron = ((X + np.abs(V - 0.5) * 8.0) % 5.0) < 2.2
    v = np.where(chevron, F(0.1), F(0.035))
    img = col(v)
    img = mud(img, r.w, r.h, seed, 'jtread/mud', (~chevron) * 0.8, SAND * 0.7, 0.5)
    return grain(np.clip(img, 0, 1), seed, 'jtread/g', 0.05, 0.0)


# ---------------------------------------------------------------------------------------------------
# car_ambulance (cream, red band, blue marks, fixed colour)

CREAM_SIDE = C(214, 210, 192)
CREAM_TOP = C(232, 229, 214)
BAND = C(176, 30, 26)
FROST = C(204, 212, 214)


def amb_glass(Z, z0, z1, frosted):
    t = np.clip((Z - z0) / F(z1 - z0), 0, 1)[..., None]
    if frosted:
        return FROST * (0.9 + 0.1 * t)
    return C(36, 44, 50) + (C(130, 146, 156) - C(36, 44, 50)) * tl.smoothstep(0.55, 1.0, t)


def amb_side(r, g, seed):
    U, Z = r.world()
    pu, pv, pm = r.ppu()
    w, h = r.w, r.h
    zs, zw = g['z_sill'], g['z_waist']
    c = g['cabin']
    img = CREAM_SIDE * mottle(w, h, seed, 'aside/m', 4, 2, 0.025)[..., None]
    img = img * (0.8 + 0.2 * tl.smoothstep(zs, zw, Z))[..., None]
    img = put(img, C(240, 238, 228), 0.7 * hline(Z, zw + 0.5 / pv, pv))
    img = put(img, C(150, 146, 132), 0.6 * hline(Z, zw - 0.5 / pv, pv))
    b0, b1 = g['band_z']
    img = put(img, BAND, tl.fill(np.maximum(Z - b1, b0 - Z) * F(pv), 0.7))
    img = put(img, C(200, 196, 180), 0.8 * hline(Z, c['z_top'] - 1.5 / pv, pv))     # gutter
    # doors: cab door and side door outlines up to their tops, handles
    dx = g['doors_x']
    for (x0, x1), top in zip(((dx[0], dx[1]), (dx[2], dx[3])), g['door_tops']):
        sd = tl.sd_rect(U * F(pu), Z * F(pv), x1 * pu, (zs + 0.08) * pv, x0 * pu, top * pv, 1.0)
        img = put(img, C(90, 88, 80), 0.85 * tl.ring(sd, 1.0))
        hd = tl.sd_box(U * F(pu), Z * F(pv), (x1 + 0.3) * pu, (b1 + 0.25) * pv, 1.6, 0.6)
        img = put(img, col(F(0.8)), tl.fill(hd, 0.7))
    # windows
    for k in range(len(g['windows_x'])):
        z0, z1 = g['windows_z'][k]
        gk = dict(g, window_z=[z0, z1])
        sd = window_sd(gk, U, Z, k) * F(pm)
        img = put(img, amb_glass(Z, z0, z1, g['frosted'][k]), tl.fill(sd, 0.8))
        if g['frosted'][k]:
            ribs = (((Z * F(pv)) % 3.0) < 1.0)
            img = put(img, FROST * 0.9, 0.5 * ribs * tl.fill(sd + 1, 0.8))
        img = put(img, C(30, 30, 30), 0.85 * tl.ring(sd - 0.6, 1.0))
    # medical star on the side door, regime star on the band
    mx, mz, mr = g['marks']['side']
    img = star_of_life(img, U * F(pu), Z * F(pv), mx * pu, mz * pv, mr * pm)
    sx, sz, sr = g['regime_star']
    img = put(img, C(240, 196, 80), star5_mask(U * F(pu), Z * F(pv), sx * pu, sz * pv, sr * pm + 0.6))
    d, _ = arch_distance(g, U, Z)
    img = img * (1 - 0.45 * np.exp(-d / 0.16))[..., None]
    dirt = frac_mask(w, h, seed, 'aside/dirt', 6, 3, 0.5) * (1 - tl.smoothstep(zs, zs + 0.9, Z))
    img = put(img, C(120, 112, 96), 0.5 * dirt)
    return grain(np.clip(img, 0, 1), seed, 'aside/g', 0.03, 0.008)


def amb_top(r, g, seed):
    X, Y = r.world()
    pu, pv, pm = r.ppu()
    w, h = r.w, r.h
    c = g['cabin']
    img = CREAM_TOP * mottle(w, h, seed, 'atop/m', 4, 2, 0.025)[..., None]
    roof = X < c['x_top'][0]
    ribs = roof & ((((X - c['x_top'][1]) * F(pu)) % 10.0) < 1.0) & (np.abs(Y) < c['half_top'] - 0.3)
    img = put(img, C(196, 192, 176), ribs * 0.8)
    for s in (-1, 1):
        img = put(img, C(170, 166, 150), 0.8 * hline(Y, s * (c['half_top'] - 0.12), pv) * roof)
        img = put(img, C(150, 146, 130), 0.7 * hline(Y, s * (g['half_width'] - 0.35), pv) * (~roof))
    mx, my, mr = g['marks']['roof']
    img = star_of_life(img, X * F(pu), Y * F(pv), mx * pu, my * pv, mr * pm)
    img = img * (1 - 0.15 * tl.smoothstep(g['half_width'] - 0.4, g['half_width'], np.abs(Y)))[..., None]
    dust = tl.speckle(w, h, seed, 0.03, (0.5, 0.8), (0.3, 0.6), tl.DECAL, salt='atop/dust')
    img = put(img, C(180, 172, 150), 0.4 * dust)
    return grain(np.clip(img, 0, 1), seed, 'atop/g', 0.03, 0.008)


def amb_windshield(r, g, seed):
    sd, Yw, S, half = glass_sd(r, g, True, 0.16, 0.0, 0.0)
    img = CREAM_SIDE * mottle(r.w, r.h, seed, 'aws/m', 2, 1, 0.03)[..., None]
    glass = (S > 0.14) & (S < 0.86)
    gl = C(36, 44, 50) + (C(130, 146, 156) - C(36, 44, 50)) * tl.smoothstep(0.55, 0.86, S)[..., None]
    inside = tl.fill(np.maximum(sd, np.maximum((0.14 - S), (S - 0.86)) * r.h), 0.8)
    img = put(img, gl, inside)
    img = put(img, C(30, 30, 30), 0.85 * tl.ring(np.maximum(sd, np.maximum((0.14 - S), (S - 0.86)) * r.h) - 0.6, 1.0))
    return grain(np.clip(img, 0, 1), seed, 'aws/g', 0.03, 0.008)


def amb_rear(r, g, seed):
    Yw, S = r.world()
    pu = r.w / abs(r.frame['u'][2] - r.frame['u'][1])
    c = g['cabin']
    H = c['z_top'] - c['z_bottom']
    Z = c['z_bottom'] + S * H
    pv = r.h / H
    img = CREAM_SIDE * mottle(r.w, r.h, seed, 'arear/m', 2, 1, 0.03)[..., None]
    b0, b1 = g['band_z']
    img = put(img, BAND, tl.fill(np.maximum(Z - b1, b0 - Z) * F(pv), 0.7))
    img = put(img, C(60, 60, 56), seam_lines(Yw, [0.0], pu))
    sd = tl.sd_rect(Yw * F(pu), Z * F(pv), -2.0 * pu, (c['z_bottom'] + 0.05) * pv, 2.0 * pu, (c['z_top'] - 0.15) * pv, 1.0)
    img = put(img, C(90, 88, 80), 0.85 * tl.ring(sd, 1.0))
    for s in (-1, 1):
        wsd = tl.sd_rect(Yw * F(pu), Z * F(pv), min(s * 0.25, s * 1.75) * pu, 3.8 * pv, max(s * 0.25, s * 1.75) * pu, 4.8 * pv, 1.0)
        img = put(img, amb_glass(Z, 3.8, 4.8, True), tl.fill(wsd, 0.7))
        img = put(img, C(30, 30, 30), 0.85 * tl.ring(wsd - 0.6, 1.0))
    img = put(img, col(F(0.8)), tl.fill(tl.sd_box(Yw * F(pu), Z * F(pv), 0.35 * pu, 3.45 * pv, 1.6, 0.6), 0.7))
    mx, mz, mr = g['marks']['rear']
    img = star_of_life(img, Yw * F(pu), Z * F(pv), -1.0 * pu, (b1 + 0.45) * pv, mr * pu)
    return grain(np.clip(img, 0, 1), seed, 'arear/g', 0.03, 0.008)


def amb_nose(r, g, seed):
    Yw, Z = r.world()
    pu, pv, _ = r.ppu()
    ztop = top_z_at(g, g['x_nose'])
    img = col(np.full((r.h, r.w), 0.07, F))
    img = put(img, CREAM_SIDE * 0.95, (Z > 1.12) * 1.0)
    grille = (np.abs(Yw) < 1.0) & (Z > 1.3) & (Z < 2.15)
    bars = np.where(((Z * F(pv)) % 3.0) < 1.2, F(0.55), F(0.18))
    img = put(img, col(bars), grille * 1.0)
    for s in (-1, 1):
        img = lamp(img, r, s * 1.5, 1.8, 0.3, 0.3, C(232, 228, 200), rim=0.85, rad=3.0)
        img = lamp(img, r, s * 1.5, 1.32, 0.24, 0.07, C(236, 140, 30), rim=0.7, reflector=False)
    img = put(img, C(150, 146, 132), 0.7 * hline(Z, ztop - 0.12, pv))
    return grain(np.clip(img, 0, 1), seed, 'anose/g', 0.03, 0.008)


def amb_tail(r, g, seed):
    Yw, Z = r.world()
    pu, pv, _ = r.ppu()
    img = col(np.full((r.h, r.w), 0.07, F))
    img = put(img, CREAM_SIDE * 0.92, (Z > 1.12) * 1.0)
    for s in (-1, 1):
        sd = box_px(r, s * 1.8, 1.75, 0.32, 0.35, 0.5)
        img = put(img, col(F(0.75)), tl.fill(sd - 1.0, 0.7))
        img = put(img, C(185, 28, 22), tl.fill(sd + 0.2, 0.7) * (Z > 1.6))
        img = put(img, C(230, 130, 25), tl.fill(sd + 0.2, 0.7) * (Z <= 1.6))
    plate = box_px(r, 0, 1.55, 0.6, 0.2, 0.5)
    img = put(img, col(F(0.2)), tl.fill(plate - 1.0, 0.7))
    img = put(img, C(212, 210, 200), tl.fill(plate + 0.3, 0.7))
    img = put(img, col(F(0.25)), (Z > 2.45) * 1.0)
    return grain(np.clip(img, 0, 1), seed, 'atail/g', 0.03, 0.008)


def grey_bumper(r, seed):
    X, Y = r.px()
    t = Y / F(r.h)
    v = np.interp(t, [0, 0.15, 0.5, 1.0], [0.62, 0.5, 0.36, 0.22]).astype(F)
    return grain(np.clip(col(v), 0, 1), seed, 'abump/g', 0.03, 0.0)


def beacon(r, seed):
    X, Y = r.px()
    t = Y / F(r.h)
    img = C(40, 90, 228) * (1.15 - 0.6 * t)[..., None]
    img = put(img, C(170, 210, 255), tl.fill((np.abs(t - 0.3) - 0.08) * r.h, 0.7))
    img = put(img, C(20, 30, 70), (t > 0.88) * 1.0)
    return grain(np.clip(img, 0, 1), seed, 'beacon/g', 0.02, 0.0)


def amb_wheel_face(r, seed):
    dx, dy, rad = disc_coords(r)
    pxr = r.w / 2.0
    img = col(F(0.085) + F(0.03) * tl.smoothstep(0.78, 0.82, rad) * tl.smoothstep(0.86, 0.82, rad))
    img = put(img, col(F(0.2)), tl.smoothstep(0.9, 1.0, rad))
    img = put(img, CREAM_SIDE * 0.9, tl.fill((rad - 0.6) * pxr, 0.8))
    img = put(img, C(150, 146, 132), 0.8 * tl.ring((rad - 0.6) * pxr, 1.0))
    img = put(img, col(F(0.85) - F(0.25) * rad / F(0.3)), tl.fill((rad - 0.3) * pxr, 0.8))
    img = put(img, col(F(0.3)), tl.fill((rad - 0.08) * pxr, 0.8))
    return grain(np.clip(img, 0, 1), seed, 'aface/g', 0.03, 0.006)


# ---------------------------------------------------------------------------------------------------
# Driver

def painters(seed):
    """(texture, region) -> fn(region, geometry) returning a (h, w) grey or (h, w, 3) colour array."""
    s = seed
    return {
        ('car_sedan_body', 'side'): lambda r, g: sedan_side(r, g, s),
        ('car_sedan_body', 'top'): lambda r, g: sedan_top(r, g, s),
        ('car_sedan_body', 'windshield'): lambda r, g: sedan_glass(r, g, s, True),
        ('car_sedan_body', 'rear_window'): lambda r, g: sedan_glass(r, g, s, False),
        ('car_sedan_body', 'dark'): lambda r, g: flat_dark(r, s, 'sdark'),
        ('car_sedan_body', 'paint'): lambda r, g: flat_paint(r, s, 'spaint', 0.64),
        ('car_sedan_lights', 'nose'): lambda r, g: sedan_nose(r, g, s),
        ('car_sedan_lights', 'tail'): lambda r, g: sedan_tail(r, g, s),
        ('car_sedan_lights', 'chrome'): lambda r, g: chrome_strip(r, s, 'schrome'),
        ('car_sedan_lights', 'rubber'): lambda r, g: rubber(r, s, 'srubber'),
        ('car_sedan_wheels', 'face'): lambda r, g: wheel_face(r, s, 'sface'),
        ('car_sedan_wheels', 'tread'): lambda r, g: tread(r, s, 'stread'),
        ('car_limo_body', 'side_front'): lambda r, g: limo_side(r, g, s),
        ('car_limo_body', 'side_rear'): lambda r, g: limo_side(r, g, s),
        ('car_limo_body', 'hood'): lambda r, g: limo_top(r, g, s, 'hood'),
        ('car_limo_body', 'roof'): lambda r, g: limo_top(r, g, s, 'roof'),
        ('car_limo_body', 'trunk'): lambda r, g: limo_top(r, g, s, 'trunk'),
        ('car_limo_body', 'dark'): lambda r, g: col(flat_dark(r, s, 'ldark', 0.05, 0.1)),
        ('car_limo_body', 'spare'): lambda r, g: np.broadcast_to(BLACK_SIDE, (r.h, r.w, 3)).copy(),
        ('car_limo_lights', 'nose'): lambda r, g: limo_nose(r, g, s),
        ('car_limo_lights', 'tail'): lambda r, g: limo_tail(r, g, s),
        ('car_limo_lights', 'windshield'): lambda r, g: limo_glass(r, g, s, True),
        ('car_limo_lights', 'rear_window'): lambda r, g: limo_glass(r, g, s, False),
        ('car_limo_lights', 'chrome'): lambda r, g: chrome_strip(r, s, 'lchrome', pits=False),
        ('car_limo_lights', 'flag'): lambda r, g: flag(r, s),
        ('car_limo_lights', 'gold'): lambda r, g: gold(r, s),
        ('car_limo_wheels', 'face'): lambda r, g: wheel_face(r, s, 'lface', whitewall=True),
        ('car_limo_wheels', 'tread'): lambda r, g: tread(r, s, 'ltread', rubber=0.07, shoulder=0.12),
        ('car_jeep_military_body', 'side'): lambda r, g: jeep_side(r, g, s),
        ('car_jeep_military_body', 'top'): lambda r, g: jeep_top(r, g, s),
        ('car_jeep_military_body', 'inner'): lambda r, g: jeep_inner(r, g, s),
        ('car_jeep_military_body', 'windscreen'): lambda r, g: jeep_windscreen(r, g, s),
        ('car_jeep_military_body', 'seats'): lambda r, g: canvas(r, s, 'jseats', KHAKI),
        ('car_jeep_military_body', 'dark'): lambda r, g: flat_dark(r, s, 'jdark', 0.09, 0.2),
        ('car_jeep_military_body', 'paint'): lambda r, g: grain(np.clip(mud(olive(r.w, r.h, s, 'jpaint'), r.w, r.h, s,
                                                                           'jpaint/mud', 0.6), 0, 1), s, 'jpaint/g', 0.04, 0.01),
        ('car_jeep_military_body', 'canvas'): lambda r, g: canvas(r, s, 'jcanvas', KHAKI * 0.85),
        ('car_jeep_military_lights', 'nose'): lambda r, g: jeep_nose(r, g, s),
        ('car_jeep_military_lights', 'tail'): lambda r, g: jeep_tail(r, g, s),
        ('car_jeep_military_lights', 'metal'): lambda r, g: gunmetal(r, s),
        ('car_jeep_military_lights', 'ammo'): lambda r, g: ammo_box(r, s),
        ('car_jeep_military_lights', 'bar'): lambda r, g: olive_tube(r, s),
        ('car_jeep_military_lights', 'jerry'): lambda r, g: jerry_can(r, s),
        ('car_jeep_military_wheels', 'face'): lambda r, g: jeep_wheel_face(r, s),
        ('car_jeep_military_wheels', 'tread'): lambda r, g: jeep_tread(r, s),
        ('car_ambulance_body', 'side'): lambda r, g: amb_side(r, g, s),
        ('car_ambulance_body', 'top'): lambda r, g: amb_top(r, g, s),
        ('car_ambulance_body', 'windshield'): lambda r, g: amb_windshield(r, g, s),
        ('car_ambulance_body', 'rear'): lambda r, g: amb_rear(r, g, s),
        ('car_ambulance_body', 'dark'): lambda r, g: flat_dark(r, s, 'adark', 0.08, 0.16),
        ('car_ambulance_body', 'paint'): lambda r, g: grain(CREAM_SIDE * mottle(r.w, r.h, s, 'apaint', 2, 1, 0.03)[..., None],
                                                            s, 'apaint/g', 0.03, 0.008),
        ('car_ambulance_lights', 'nose'): lambda r, g: amb_nose(r, g, s),
        ('car_ambulance_lights', 'tail'): lambda r, g: amb_tail(r, g, s),
        ('car_ambulance_lights', 'bumper'): lambda r, g: grey_bumper(r, s),
        ('car_ambulance_lights', 'beacon'): lambda r, g: beacon(r, s),
        ('car_ambulance_lights', 'rubber'): lambda r, g: rubber(r, s, 'arubber'),
        ('car_ambulance_wheels', 'face'): lambda r, g: amb_wheel_face(r, s),
        ('car_ambulance_wheels', 'tread'): lambda r, g: tread(r, s, 'atread'),
    }


def check_rects(name, size, regions):
    w, h = size
    occ = np.zeros((h, w), int)
    for rn, spec in regions.items():
        x, y, rw, rh = spec['rect']
        if x < 0 or y < 0 or x + rw > w or y + rh > h:
            raise SystemExit(f'{name}/{rn}: rect leaves the sheet')
        occ[y:y + rh, x:x + rw] += 1
    if occ.max() > 1:
        raise SystemExit(f'{name}: rects overlap')
    return int((occ == 0).sum())


def build(preview=None, only=()):
    with open(LAYOUT, encoding='utf-8') as fh:
        layout = json.load(fh)
    table = painters(SEED)
    used = set()
    sheet_items, outlined = [], []
    for car, cspec in layout['cars'].items():
        if only and car not in only:
            continue
        g = cspec['geometry']
        for tname, tspec in cspec['textures'].items():
            w, h = tspec['size']
            free = check_rects(tname, (w, h), tspec['regions'])
            img = np.zeros((h, w, 3), F)
            for rn, rspec in tspec['regions'].items():
                key = (tname, rn)
                if key not in table:
                    raise SystemExit(f'no painter for {key}')
                used.add(key)
                r = Region(rn, rspec)
                out = np.asarray(table[key](r, g), F)
                if out.ndim == 2:
                    out = col(out)
                if out.shape != (r.h, r.w, 3):
                    raise SystemExit(f'{key}: painter returned {out.shape}')
                img[r.y:r.y + r.h, r.x:r.x + r.w] = out
            if tspec.get('grayscale'):
                grey = img.mean(axis=2)
                img = col(grey)
            path = os.path.join(ROOT, tspec['file'])
            os.makedirs(os.path.dirname(path), exist_ok=True)
            tl.save_rgb(path, img)
            print(f'wrote {tspec["file"]} {w}x{h} (unused px {free})')
            big = Image.fromarray(tl.to_u8(img), 'RGB').resize((w * 4, h * 4), Image.NEAREST)
            sheet_items.append((tname, big))
            outlined.append((tname, tl.outline_regions(img, {k: v['rect'] for k, v in tspec['regions'].items()}, 4)))
    missing = set(table) - used
    if missing and not only:
        raise SystemExit(f'painters without a region: {sorted(missing)}')
    if preview:
        os.makedirs(preview, exist_ok=True)
        tl.contact_sheet(sheet_items, 1400).save(os.path.join(preview, 'vehicles_textures.png'))
        tl.contact_sheet(outlined, 1400).save(os.path.join(preview, 'vehicles_regions.png'))
        ref = [('car_junker_body (existing)', Image.open(os.path.join(ROOT, 'public/textures/vehicles/car_junker_body.png')).convert('RGB').resize((512, 512), Image.NEAREST))]
        tl.contact_sheet(ref + [it for it in sheet_items if it[0].endswith('_body')], 1800).save(
            os.path.join(preview, 'vehicles_vs_junker.png'))
        print('previews in', preview)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cars', nargs='*', help='car names to repaint (default: all)')
    ap.add_argument('--preview', default=None)
    a = ap.parse_args()
    build(a.preview, tuple(a.cars))
