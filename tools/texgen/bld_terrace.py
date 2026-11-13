"""bld_terrace family textures (attached townhouse row, poor + normal) for dict-three's Street tab.

    python tools/texgen/bld_terrace.py [--preview build/roadplan/scratch/terrace_tex]

Reads sizes and house layout from tools/texgen/bld_terrace_layout.json and writes the PNGs it names under
public/textures/map/ (bld_terrace_{facade,brick,roof,trim}[_poor].png). Everything is painted at S x the
final size in native-pixel coordinates and box-filtered down; all noise is seeded and periodic on whole
lattices so the strips tile and re-runs are identical.

The game lights the street with one ambient light and ignores vertex colour, so each painter bakes its
own form: sill / lintel shadows, window recess, a cornice shadow band, a darker plinth.
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import texlib as tl  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LAYOUT = json.load(open(os.path.join(ROOT, 'tools', 'texgen', 'bld_terrace_layout.json'), encoding='utf-8'))
OUT = os.path.join(ROOT, 'public', 'textures', 'map')
SEED = 7311
S = 4
F = np.float32


class Canvas:
    """Float RGB canvas at S x resolution, addressed in native pixels (floats allowed)."""

    def __init__(self, w, h, base):
        self.w, self.h = w, h
        self.a = np.broadcast_to(np.asarray(base, F) / 255.0, (h * S, w * S, 3)).copy()

    def rect(self, x0, y0, x1, y1, col, alpha=1.0, wrap=True):
        col = np.asarray(col, F) / 255.0
        ys, ye = int(round(y0 * S)), int(round(y1 * S))
        xs, xe = int(round(x0 * S)), int(round(x1 * S))
        ys, ye = max(ys, 0), min(ye, self.h * S)
        if xe <= xs or ye <= ys:
            return
        if wrap:
            idx = np.arange(xs, xe) % (self.w * S)
            sub = self.a[ys:ye][:, idx]
            self.a[ys:ye][:, idx] = sub * (1 - alpha) + col * alpha
        else:
            xs, xe = max(xs, 0), min(xe, self.w * S)
            sub = self.a[ys:ye, xs:xe]
            self.a[ys:ye, xs:xe] = sub * (1 - alpha) + col * alpha

    def vgrad(self, x0, y0, x1, y1, top, bottom, alpha=1.0):
        n = max(1, int(round((y1 - y0) * S)))
        for i in range(n):
            t = i / max(1, n - 1)
            c = np.asarray(top, F) * (1 - t) + np.asarray(bottom, F) * t
            self.rect(x0, y0 + i / S, x1, y0 + (i + 1) / S, c, alpha)

    def shade(self, x0, y0, x1, y1, factor):
        self.rect(x0, y0, x1, y1, (0, 0, 0), 1 - factor)

    def finish(self):
        img = self.a.reshape(self.h, S, self.w, S, 3).mean(axis=(1, 3))
        return img


def noise(w, h, cx, cy, salt, octaves=3):
    return tl.fbm(w * S, h * S, cx, cy, SEED, salt, octaves=octaves)


def apply_noise(cv, salt, amt, cx, cy):
    n = noise(cv.w, cv.h, cx, cy, salt)
    cv.a = np.clip(cv.a * (1.0 + n[..., None] * amt), 0, 1)


def desat(cv, k, mult):
    g = cv.a.mean(axis=2, keepdims=True)
    cv.a = (cv.a * (1 - k) + g * k) * mult


# ---------------------------------------------------------------------------------------------------------
# facade

STONE = (226, 216, 196)
GLASS_T, GLASS_B = (74, 84, 94), (28, 32, 38)
TEAL = (70, 104, 98)
BROWN = (84, 58, 40)
IRON = (28, 26, 26)


def window(cv, x, y0, y1, w, state, shutters, plaster, bars=False):
    """One window: lintel/sill shading on the wall, recessed glass, frame; state normal|broken|boarded."""
    x1 = x + w
    cv.shade(x - 0.5, y0 - 1.6, x1 + 0.5, y0 - 0.4, 0.78)          # shadow above the lintel
    cv.rect(x - 1, y0 - 1, x1 + 1, y1 + 0.6, STONE, 0.55)           # surround
    if state == 'boarded':
        cv.rect(x, y0, x1, y1, (96, 72, 50))
        for k in range(int(y0) + 2, int(y1), 3):
            cv.rect(x, k, x1, k + 0.35, (50, 36, 26))
    else:
        cv.vgrad(x, y0, x1, y1, GLASS_T, GLASS_B)
        cv.rect(x, y0, x1, y0 + 1.0, (20, 22, 26), 0.55)          # recess shadow at the top
        cv.rect(x, y0, x + 0.9, y1, (20, 22, 26), 0.4)
        cv.rect((x + x1) / 2 - 0.2, y0, (x + x1) / 2 + 0.2, y1, (220, 214, 196), 0.8)   # mullion
        cv.rect(x, (y0 + y1) / 2, x1, (y0 + y1) / 2 + 0.4, (220, 214, 196), 0.6)         # transom
        if state == 'broken':
            cv.rect(x + 1, y0 + 1, x1 - 1, y1 - 1, (8, 8, 10), 0.85)
            cv.rect(x + w * 0.3, y0, x + w * 0.5, y0 + 2.5, (180, 190, 195), 0.7)       # shard
    cv.rect(x - 1.2, y1, x1 + 1.2, y1 + 0.9, (240, 232, 214))        # sill
    cv.shade(x - 1, y1 + 0.9, x1 + 1, y1 + 2.4, 0.74)                # shadow under the sill
    if bars:
        for k in np.arange(x + 1, x1, 1.6):
            cv.rect(k, y0, k + 0.35, y1, IRON, 0.9)
    if shutters and state != 'boarded':
        for sx in (x - 2.2, x1 + 0.2):
            cv.rect(sx, y0 - 0.5, sx + 2.0, y1 + 0.5, TEAL)
            cv.rect(sx, y0 - 0.5, sx + 0.4, y1 + 0.5, (20, 40, 38), 0.5)


def paint_facade(poor):
    W, H = LAYOUT['textures']['bld_terrace_facade']['size']
    rows = LAYOUT['textures']['bld_terrace_facade']['rows_px']
    r = tl.rng(SEED, 'facade', poor)
    cv = Canvas(W, H, (200, 190, 160))
    houses = LAYOUT['textures']['bld_terrace_facade']['houses']
    dp = LAYOUT['textures']['bld_terrace_facade']['door_px']
    for hi, hs in enumerate(houses):
        x0 = hs['x']
        cv.rect(x0, 0, x0 + 32, H, hs['plaster'])
        # party wall seam (a thin recess shadow between neighbouring houses)
        cv.rect(x0, 0, x0 + 0.7, H, (0, 0, 0), 0.28)
        cv.rect(x0 + 0.7, 0, x0 + 1.4, H, (255, 255, 255), 0.07)
    apply_noise(cv, 'plaster', 0.10, 20, 4)
    for hi, hs in enumerate(houses):
        x0 = hs['x']
        plaster = hs['plaster']
        shutters = (hi % 2 == 0) and not poor or (poor and hi == 0)
        # storey windows
        for (ya, yb, bal) in ((7, 18, False), (26, 38, hs['balcony'])):
            for wx in (5, 21):
                state = 'normal'
                if poor:
                    roll = r.random()
                    state = 'boarded' if roll < 0.30 else 'broken' if roll < 0.55 else 'normal'
                window(cv, x0 + wx, ya, yb, 6, state, shutters and not (poor and r.random() < 0.6), plaster)
            if bal:  # wrought-iron balcony across both windows
                cv.rect(x0 + 3, yb + 0.9, x0 + 29, yb + 3.2, (0, 0, 0), 0.0)
                cv.rect(x0 + 3, yb + 2.0, x0 + 29, yb + 2.7, IRON)
                for k in np.arange(x0 + 3, x0 + 29, 1.6):
                    cv.rect(k, yb + 0.9, k + 0.4, yb + 2.2, IRON, 0.85)
                cv.shade(x0 + 3, yb + 2.7, x0 + 29, yb + 4.2, 0.8)
        # ground floor
        door_left = hs['door'] == 'left'
        dx = x0 + (dp['left_x'] if door_left else dp['right_x'])
        dh = dp['h']
        if hs['shop']:
            # shopfront: glass, sign band and a striped awning, door on the right
            cv.rect(x0 + 2, 47.5, x0 + 30, 61, (52, 46, 40))
            cv.vgrad(x0 + 3, 50.5, x0 + 21, 60, (96, 104, 108), (32, 34, 38))
            cv.vgrad(x0 + 23, 50, x0 + 29, 61, (110, 70, 44), (60, 38, 26))
            cv.rect(x0 + 2, 44, x0 + 30, 47.2, (150, 40, 34) if not poor else (96, 60, 52))
            for k in range(16):
                if k % 2 == 0:
                    cv.rect(x0 + 2 + k * 1.75, 47.2, x0 + 2 + (k + 1) * 1.75, 50.2, (236, 226, 200))
                else:
                    cv.rect(x0 + 2 + k * 1.75, 47.2, x0 + 2 + (k + 1) * 1.75, 50.2, (160, 44, 36))
            cv.shade(x0 + 2, 50.2, x0 + 30, 52.4, 0.7)               # awning shadow on the glass
            cv.rect(x0 + 4, 45, x0 + 28, 46.4, (240, 220, 170), 0.9)  # sign lettering block
        else:
            cv.shade(dx - 1, 44.0, dx + dp['w'] + 1, 45.8, 0.78)
            cv.rect(dx - 1, 45.8, dx + dp['w'] + 1, 47.0, STONE)    # lintel
            cv.rect(dx, 47.0, dx + dp['w'], 61, (46, 40, 34))        # reveal
            cv.rect(dx + 0.8, 47.8, dx + dp['w'] - 0.8, 61, (66, 112, 106) if hi % 2 == 0 else BROWN)
            cv.rect(dx + 1.6, 52, dx + dp['w'] - 1.6, 56, (0, 0, 0), 0.22)      # panel recess
            cv.rect(dx + 1.2, 48.4, dx + dp['w'] - 1.2, 50.4, (36, 44, 52))     # fanlight
            cv.rect(dx + dp['w'] - 2.2, 55, dx + dp['w'] - 1.4, 56, (214, 170, 70))  # handle
            wx = x0 + (18 if door_left else 3)
            state = 'normal'
            if poor:
                roll = r.random()
                state = 'boarded' if roll < 0.4 else 'normal'
            window(cv, wx, 49, 58, 9, state, False, plaster, bars=True)
    # cornice, cornice shadow, plinth
    cv.rect(0, rows['cornice'][0], W, rows['cornice'][1], STONE)
    cv.rect(0, 1.2, W, 1.7, (255, 255, 255), 0.25)
    cv.shade(0, rows['cornice'][1], W, rows['cornice'][1] + 1.0, 0.62)
    cv.shade(0, rows['cornice'][1] + 1.0, W, rows['cornice'][1] + 3.5, 0.84)
    cv.rect(0, rows['plinth'][0], W, rows['plinth'][1], (122, 112, 100))
    cv.rect(0, rows['plinth'][0], W, rows['plinth'][0] + 0.6, (240, 232, 214), 0.5)
    apply_noise(cv, 'grain', 0.05, 80, 16)
    desat(cv, 0.08, 1.0)
    return cv.finish()


# ---------------------------------------------------------------------------------------------------------
# brick, roof, trim

def paint_brick(poor):
    W, H = LAYOUT['textures']['bld_terrace_brick']['size']
    cv = Canvas(W, H, (110, 62, 48))
    r = tl.rng(SEED, 'brick', poor)
    course = 4
    for row in range(H // course):
        off = (row % 2) * 4
        for k in range(-1, W // 8 + 1):
            tint = 0.82 + 0.3 * r.random()
            base = np.array([138, 78, 58]) * tint
            x = k * 8 + off
            cv.rect(x + 0.5, row * course + 0.5, x + 7.5, (row + 1) * course - 0.5, base)
        cv.rect(0, row * course, W, row * course + 0.5, (176, 160, 138), 0.8)   # mortar line
    apply_noise(cv, 'brickn', 0.12, 4, 4)
    cv.a *= (1 - 0.25 * np.clip((np.linspace(0, 1, H * S, dtype=F)[:, None, None] - 0.75) / 0.25, 0, 1))
    if poor:
        desat(cv, 0.4, 0.62)
        cv.a *= (1 - 0.35 * np.clip(noise(W, H, 4, 4, 'soot', 3)[..., None], 0, 1))
    return cv.finish()


def paint_roof(poor):
    W, H = LAYOUT['textures']['bld_terrace_roof']['size']
    cv = Canvas(W, H, (140, 76, 52))
    r = tl.rng(SEED, 'roof', poor)
    rowh = 4
    for row in range(H // rowh):
        off = (row % 2) * 2
        for k in range(-1, W // 4 + 1):
            t = 0.8 + 0.35 * r.random()
            x = k * 4 + off
            cv.rect(x, row * rowh, x + 4, (row + 1) * rowh, np.array([156, 84, 58]) * t)
            cv.rect(x, row * rowh, x + 0.4, (row + 1) * rowh, (0, 0, 0), 0.25)
        cv.rect(0, (row + 1) * rowh - 1.2, W, (row + 1) * rowh, (0, 0, 0), 0.32)  # course shadow
        cv.rect(0, row * rowh, W, row * rowh + 0.6, (255, 220, 190), 0.12)
    apply_noise(cv, 'roofn', 0.10, 16, 2)
    if poor:
        desat(cv, 0.5, 0.66)
        moss = (noise(W, H, 16, 2, 'moss', 3) > 0.15).astype(F)[..., None]
        cv.a = cv.a * (1 - 0.6 * moss) + np.array([70, 84, 54], F) / 255.0 * 0.6 * moss
        miss = (noise(W, H, 32, 4, 'miss', 2) > 0.40).astype(F)[..., None]
        cv.a = cv.a * (1 - miss) + np.array([40, 30, 28], F) / 255.0 * miss
    return cv.finish()


def paint_trim(poor):
    W, H = LAYOUT['textures']['bld_terrace_trim']['size']
    cv = Canvas(W, H, (200, 192, 176))
    apply_noise(cv, 'trimn', 0.12, 4, 4)
    cv.rect(0, 0, W, 0.7, (255, 255, 255), 0.15)
    if poor:
        desat(cv, 0.4, 0.62)
    return cv.finish()


# ---------------------------------------------------------------------------------------------------------
# POOR tier: a dilapidated version of the same row. Painted at 2x the normal resolution (the poor model
# has real geometry damage -- boards, pits, tarps -- that the texture has to line up with), in the same
# 320 x 64 "virtual pixel" coordinates as the normal facade so layout numbers are shared.

POOR = LAYOUT['poor']
ATLAS = POOR['atlas']


class SCanvas(Canvas):
    """Canvas addressed in virtual pixels; the real raster is k x bigger. No wrap (these never tile)."""

    def __init__(self, w, h, base, k):
        self.k = k
        super().__init__(w * k, h * k, base)

    def rect(self, x0, y0, x1, y1, col, alpha=1.0, wrap=False):
        k = self.k
        super().rect(x0 * k, y0 * k, x1 * k, y1 * k, col, alpha, False)


def rnoise(cv, cx, cy, salt, octaves=3):
    """Noise over the whole real raster; cx, cy are lattice cell counts across width / height."""
    return noise(cv.w, cv.h, cx, cy, salt, octaves)


def faded(c, k=0.5, m=0.74):
    c = np.asarray(c, F)
    return tuple((c * (1 - k) + c.mean() * k) * m)


def brick_pattern(shape, bw, bh, salt):
    """Running-bond brick colours over a (H, W) super-sampled raster; bw, bh in REAL pixels."""
    H, W = shape
    yy, xx = np.mgrid[0:H, 0:W]
    ry, rx = (yy + 0.5) / S, (xx + 0.5) / S
    row = np.floor(ry / bh).astype(np.int64)
    cxp = (rx + (row % 2) * bw / 2) / bw
    col = np.floor(cxp).astype(np.int64)
    fx, fy = cxp - col, ry / bh - row
    mortar = (fx < 0.10) | (fy < 0.16)
    h = ((row * 73856093) ^ (col * 19349663) ^ (SEED + salt)) % 1000 / 1000.0
    tint = (0.72 + 0.5 * h).astype(F)[..., None]
    out = np.array([126, 70, 54], F) / 255.0 * tint
    return np.where(mortar[..., None], np.array([128, 118, 104], F) / 255.0 * 0.85, out)


def desat_arr(a, k=0.35):
    return a * (1 - k) + a.mean(axis=2, keepdims=True) * k


def crack(cv, r, x, y, ln, ang=None, col=(26, 24, 22), a=0.8, w=0.3):
    ang = r.uniform(1.0, 2.1) if ang is None else ang
    for i in range(int(ln * 3)):
        cv.rect(x, y, x + w, y + w, col, a)
        ang += r.uniform(-0.45, 0.45)
        x += np.cos(ang) * 0.35
        y += abs(np.sin(ang)) * 0.35
        if r.random() < 0.03:
            crack(cv, r, x, y, ln * 0.35, ang + r.choice([-0.8, 0.8]), col, a, w)


def tag(cv, r, x, y, w, h, col):
    """A spray-paint scribble inside a w x h box, with drips."""
    px, py = x + r.random() * w * 0.2, y + r.random() * h
    for _ in range(int(w * 2.2)):
        nx = px + r.uniform(-0.2, 1.0) * 0.9
        ny = float(np.clip(py + r.uniform(-1.4, 1.4), y, y + h))
        for t in np.linspace(0, 1, 4):
            qx, qy = px + (nx - px) * t, py + (ny - py) * t
            cv.rect(qx, qy, qx + 0.7, qy + 0.7, col, 0.85)
        px, py = min(nx, x + w), ny
        if r.random() < 0.06:
            cv.rect(px, py, px + 0.4, py + r.uniform(2, 5), col, 0.55)


def pwindow(cv, r, x, y0, y1, w, state, bars=False):
    """Poor window: grimy glass | broken glass | dark (no glass) | boarded (black; planks are geometry)."""
    x1 = x + w
    cv.shade(x - 0.6, y0 - 2.4, x1 + 0.6, y0 - 0.3, 0.7)             # soot above the lintel
    cv.rect(x - 1, y0 - 1, x1 + 1, y1 + 0.6, (170, 162, 146), 0.5)     # dirty surround
    if state in ('boarded', 'dark'):
        cv.rect(x, y0, x1, y1, (12, 11, 12))
        cv.rect(x, y0, x1, y0 + 1.2, (0, 0, 0), 0.7)
        if state == 'dark':
            cv.rect(x + 0.3, y0, x + w * 0.42, y0 + (y1 - y0) * 0.6, (92, 66, 66), 0.85)   # rag curtain
            cv.rect(x + w * 0.62, y0, x1 - 0.2, y0 + (y1 - y0) * 0.3, (70, 70, 80), 0.7)
    else:
        cv.vgrad(x, y0, x1, y1, (62, 72, 76), (24, 28, 32))
        cv.rect(x, y0, x1, y0 + 1.0, (10, 12, 14), 0.55)
        cv.rect((x + x1) / 2 - 0.25, y0, (x + x1) / 2 + 0.25, y1, (190, 184, 170), 0.8)
        cv.rect(x, (y0 + y1) / 2, x1, (y0 + y1) / 2 + 0.4, (190, 184, 170), 0.6)
        if state == 'broken':
            for j in np.arange(y0, y1, 0.5):                          # jagged black hole biting in from a corner
                f = 0.35 + 0.5 * abs(np.sin(j * 1.7 + x)) * (1 - (j - y0) / (y1 - y0) * 0.5)
                cv.rect(x, j, x + w * f, j + 0.5, (8, 8, 10), 0.95)
            cv.rect(x + w * 0.6, y1 - 3, x1, y1, (170, 180, 184), 0.5)  # shards left in the frame
    cv.rect(x - 1.2, y1, x1 + 1.2, y1 + 0.9, (186, 178, 160))        # sill
    cv.shade(x - 1, y1 + 0.9, x1 + 1, y1 + 2.4, 0.72)
    cv.shade(x + 0.5, y1 + 2.4, x1 - 0.5, y1 + 9 + r.random() * 6, 0.82)   # water streak under the sill
    if bars:
        for k in np.arange(x + 1, x1, 1.6):
            cv.rect(k, y0, k + 0.35, y1, IRON, 0.9)


def paint_facade_poor():
    spec = POOR['textures']['bld_terrace_facade_poor']
    k = spec['scale']
    fac = LAYOUT['textures']['bld_terrace_facade']
    W, H = fac['size']
    rows, houses, dp = fac['rows_px'], fac['houses'], fac['door_px']
    r = tl.rng(SEED, 'facade_poor')
    cv = SCanvas(W, H, (140, 130, 112), k)
    for hs in houses:
        cv.rect(hs['x'], 0, hs['x'] + 32, H, faded(hs['plaster']))
        cv.rect(hs['x'], 0, hs['x'] + 0.8, H, (0, 0, 0), 0.4)
        cv.rect(hs['x'] + 0.8, 0, hs['x'] + 1.4, H, (255, 255, 255), 0.05)
    apply_noise(cv, 'pplaster', 0.15, 40, 8)
    # whole-wall weathering: darker towards the top (soot) and the plinth (damp)
    t = np.linspace(0, 1, cv.a.shape[0], dtype=F)[:, None, None]
    cv.a *= 1 - 0.20 * np.clip((0.28 - t) / 0.28, 0, 1) - 0.22 * np.clip((t - 0.72) / 0.28, 0, 1)

    # missing render: patches of bare brick, thicker towards the plinth
    n = rnoise(cv, 30, 6, 'ppeel', 3)
    ty = np.linspace(0, 1, cv.a.shape[0], dtype=F)[:, None]
    peel = n > (0.36 - 0.16 * np.clip((ty - 0.35) / 0.65, 0, 1))
    bp = brick_pattern(cv.a.shape[:2], 6.0, 3.0, 1)
    bp = desat_arr(bp) * (0.78 + 0.25 * rnoise(cv, 80, 16, 'pb')[..., None])
    rim = np.roll(np.roll(peel, S, axis=0), S, axis=1) & ~peel
    cv.a = np.where(peel[..., None], bp, cv.a)
    cv.a = np.where(rim[..., None], cv.a * 0.6, cv.a)

    for hi, (hs, ps) in enumerate(zip(houses, POOR['houses'])):
        x0 = hs['x']
        door_left = hs['door'] == 'left'
        for key, (ya, yb) in (('w3', (7, 18)), ('w2', (26, 38))):
            for side, wx in enumerate((5, 21)):
                if ps[key][side] == 'gone':
                    continue
                if key + 'LR'[side] in ps['shutter_paint']:
                    sx = x0 + wx - 2.2
                    cv.rect(sx, ya - 0.5, sx + 2.0, yb + 0.5, (66, 92, 86))
                    cv.rect(sx, ya - 0.5, sx + 0.5, yb + 0.5, (20, 30, 28), 0.5)
                    cv.rect(sx, ya + 3, sx + 2.0, ya + 5.5, (118, 118, 108), 0.55)    # peeled
                pwindow(cv, r, x0 + wx, ya, yb, 6, ps[key][side])
        bal = ps['balcony']
        if bal:
            yb = 38
            xa = x0 + 16 if bal == 'stub' else x0 + 3
            xb = x0 + 29
            for kx in np.arange(xa, xb, 1.6):
                drop = 5.5 * (1 - (kx - (x0 + 3)) / 26.0) if bal == 'droop' else 0.0
                if r.random() < (0.18 if bal == 'ok' else 0.3):
                    continue                                        # missing baluster
                cv.rect(kx, yb + 0.9 + drop, kx + 0.4, yb + 2.2 + drop, IRON, 0.8)
            for kx in np.arange(xa, xb, 0.8):
                drop = 5.5 * (1 - (kx - (x0 + 3)) / 26.0) if bal == 'droop' else 0.0
                cv.rect(kx, yb + 2.0 + drop, kx + 0.9, yb + 2.7 + drop, IRON, 0.9)
            cv.shade(xa, yb + 2.7, xb, yb + 4.4, 0.75)
        # ground floor
        gf, door = ps['gf'], ps['door']
        dx = x0 + (dp['left_x'] if door_left else dp['right_x'])
        if hs['shop']:
            cv.rect(x0 + 2, 47.5, x0 + 30, 61, (40, 36, 32))
            if gf == 'shop_roller':
                cv.rect(x0 + 3, 48, x0 + 21, 60.4, (102, 104, 100))
                for yy in np.arange(48, 60.4, 1.0):
                    cv.rect(x0 + 3, yy, x0 + 21, yy + 0.35, (50, 52, 50), 0.7)
                cv.rect(x0 + 3, 59, x0 + 21, 60.4, (60, 54, 46), 0.6)
            else:
                cv.vgrad(x0 + 3, 50.5, x0 + 21, 60, (66, 74, 78), (18, 20, 24))
                for j in np.arange(50.5, 60, 0.5):
                    f = 0.3 + 0.5 * abs(np.sin(j * 1.3))
                    cv.rect(x0 + 3, j, x0 + 3 + 18 * f * 0.6, j + 0.5, (6, 6, 8), 0.95)
            cv.vgrad(x0 + 23, 50, x0 + 29, 61, (82, 60, 44), (44, 32, 24))      # shop door, dull
            cv.rect(x0 + 2, 44, x0 + 30, 47.2, (88, 66, 58))                   # sign band, faded
            cv.rect(x0 + 6, 45.2, x0 + 20, 46.2, (176, 160, 120), 0.45)       # ghost lettering
            for kk in range(16):                                                # torn awning
                if r.random() < 0.18:
                    continue
                col = (178, 168, 146) if kk % 2 == 0 else (118, 74, 66)
                ln = 3.0 - r.random() * (2.2 if kk in (3, 4, 11) else 0.6)
                cv.rect(x0 + 2 + kk * 1.75, 47.2, x0 + 2 + (kk + 1) * 1.75, 47.2 + ln, col)
            cv.shade(x0 + 2, 50.2, x0 + 30, 52.4, 0.68)
        else:
            cv.shade(dx - 1, 44.0, dx + dp['w'] + 1, 45.8, 0.72)
            cv.rect(dx - 1, 45.8, dx + dp['w'] + 1, 47.0, (172, 164, 148))
            cv.rect(dx, 47.0, dx + dp['w'], 61, (28, 24, 22))
            if door == 'ok':
                col = (62, 84, 78) if hi % 2 == 0 else (70, 52, 38)
                cv.rect(dx + 0.8, 47.8, dx + dp['w'] - 0.8, 61, col)
                cv.rect(dx + 1.6, 52, dx + dp['w'] - 1.6, 56, (0, 0, 0), 0.25)
                cv.rect(dx + 1.2, 48.4, dx + dp['w'] - 1.2, 50.4, (20, 24, 28))
                cv.rect(dx + dp['w'] - 2.2, 55, dx + dp['w'] - 1.4, 56, (160, 130, 60))
                cv.rect(dx + 2, 56.5, dx + 5, 61, (120, 118, 108), 0.5)          # peeled paint at the foot
            elif door == 'open':
                cv.rect(dx + 0.8, 47.8, dx + dp['w'] - 0.8, 61, (6, 5, 6))
                cv.rect(dx + 0.8, 47.8, dx + 1.8, 61, (70, 50, 38))                  # door ajar, edge-on
            else:  # boarded: black recess, boards are geometry
                cv.rect(dx + 0.8, 47.8, dx + dp['w'] - 0.8, 61, (10, 9, 10))
            wx = x0 + (18 if door_left else 3)
            pwindow(cv, r, wx, 49, 58, 9, gf, bars=(gf != 'boarded'))
    # cornice, plinth
    cv.rect(0, rows['cornice'][0], W, rows['cornice'][1], (156, 150, 138))
    cv.rect(0, 1.2, W, 1.7, (255, 255, 255), 0.15)
    cv.shade(0, rows['cornice'][1], W, rows['cornice'][1] + 1.0, 0.55)
    cv.shade(0, rows['cornice'][1] + 1.0, W, rows['cornice'][1] + 3.5, 0.82)
    cv.rect(0, rows['plinth'][0], W, rows['plinth'][1], (78, 72, 66))
    cv.rect(0, rows['plinth'][0], W, rows['plinth'][0] + 0.6, (176, 170, 156), 0.4)
    apply_noise(cv, 'pgrain', 0.06, 160, 32)

    # cracks, and green-black runs down the wall from the broken gutters
    for hi in range(10):
        for _ in range(2):
            crack(cv, r, hi * 32 + 2 + r.random() * 28, 3 + r.random() * 34, 6 + r.random() * 8)
    for hi, ps in enumerate(POOR['houses']):
        if ps['gutter'] in ('missing', 'hang', 'sag'):
            sx = hi * 32 + (6 if ps['gutter'] == 'hang' else 20)
            for dy in range(0, 56):
                cv.rect(sx + r.uniform(-0.5, 0.5), 3 + dy, sx + 3.0, 4 + dy, (30, 36, 24), 0.22 * (1 - dy / 60.0))
    # final tone: grey, cold, dark
    g = cv.a.mean(axis=2, keepdims=True)
    cv.a = (cv.a * 0.78 + g * 0.22) * 0.9
    # graffiti (after the tone pass so it stays readable)
    cols = [(188, 60, 120), (70, 190, 150), (214, 190, 70), (30, 30, 34), (70, 130, 210)]
    for hi in (1, 3, 5, 7):
        tag(cv, r, hi * 32 + 13.5, 49.5, 6, 8, cols[hi % len(cols)])
    tag(cv, r, 6 * 32 + 12, 14, 8, 24, cols[0])
    tag(cv, r, 8 * 32 + 3.5, 49, 17, 10, cols[1])
    tag(cv, r, 4 * 32 + 18, 49.5, 9, 7, cols[3])
    return cv.finish()


def paint_brick_poor():
    k = POOR['textures']['bld_terrace_brick_poor']['scale']
    W, H = LAYOUT['textures']['bld_terrace_brick']['size']
    cv = SCanvas(W, H, (90, 56, 44), k)
    r = tl.rng(SEED, 'brick_poor')
    cv.a = brick_pattern(cv.a.shape[:2], 8.0, 4.0, 2)
    apply_noise(cv, 'pbrickn', 0.16, 8, 8)
    desat(cv, 0.45, 0.62)
    plast = rnoise(cv, 6, 6, 'pplast', 3)[..., None] > 0.30        # old render left on the wall
    cv.a = np.where(plast, cv.a * 0.4 + np.array([130, 124, 110], F) / 255.0 * 0.6, cv.a)
    cv.a *= 1 - 0.45 * np.clip(rnoise(cv, 4, 4, 'psoot', 3)[..., None], 0, 1)
    for _ in range(14):                                              # chipped bricks
        x, y = r.uniform(0, W), r.uniform(0, H)
        cv.rect(x, y, x + 2 + r.random() * 3, y + 1.5 + r.random() * 1.5, (24, 20, 18), 0.8)
    return cv.finish()


def paint_roof_poor():
    k = POOR['textures']['bld_terrace_roof_poor']['scale']
    W, H = LAYOUT['textures']['bld_terrace_roof']['size']
    cv = SCanvas(W, H, (110, 70, 54), k)
    r = tl.rng(SEED, 'roof_poor')
    rowh = 4
    for row in range(H // rowh):
        off = (row % 2) * 2
        for kk in range(-1, W // 4 + 1):
            t = 0.7 + 0.4 * r.random()
            x = kk * 4 + off
            cv.rect(x, row * rowh, x + 4, (row + 1) * rowh, np.array([150, 82, 58]) * t)
            cv.rect(x, row * rowh, x + 0.4, (row + 1) * rowh, (0, 0, 0), 0.3)
            if r.random() < 0.06:                                      # slipped tile
                cv.rect(x, row * rowh + 1.5, x + 4, (row + 1) * rowh, (0, 0, 0), 0.45)
        cv.rect(0, (row + 1) * rowh - 1.2, W, (row + 1) * rowh, (0, 0, 0), 0.4)
    apply_noise(cv, 'proofn', 0.14, 32, 4)
    desat(cv, 0.5, 0.66)
    moss = (rnoise(cv, 32, 4, 'pmoss')[..., None] > 0.12).astype(F)
    cv.a = cv.a * (1 - 0.65 * moss) + np.array([62, 78, 48], F) / 255.0 * 0.65 * moss
    miss = rnoise(cv, 48, 4, 'pmiss', 2)[..., None] > 0.34             # missing tiles: bare battens
    yy = np.arange(cv.a.shape[0], dtype=F) / (S * k)
    batt = ((yy % 4.0) < 0.7).astype(F)[:, None, None] * 0.12
    cv.a = np.where(miss, np.array([34, 26, 22], F) / 255.0 + batt, cv.a)
    cv.a *= 1 - 0.3 * np.clip(rnoise(cv, 8, 2, 'pdirt')[..., None], 0, 1)
    return cv.finish()


def paint_trim_poor():
    """64 x 64 atlas of 16 x 16 cells (see layout.json poor.atlas)."""
    cv = SCanvas(64, 64, (96, 92, 86), 1)
    r = tl.rng(SEED, 'atlas_poor')

    x0, y0, x1, y1 = ATLAS['stone']
    cv.rect(x0, y0, x1, y1, (150, 144, 132))
    cv.rect(x0 + 2, y0 + 5, x0 + 14, y0 + 5.5, (60, 56, 52), 0.7)
    cv.rect(x0 + 8, y0 + 5, x0 + 8.6, y0 + 12, (60, 56, 52), 0.7)
    x0, y0, x1, y1 = ATLAS['planks']
    for p in range(4):
        base = np.array([[118, 98, 76], [100, 84, 66], [128, 112, 92], [92, 78, 62]][p])
        cv.rect(x0, y0 + p * 4, x1, y0 + p * 4 + 4, base)
        cv.rect(x0, y0 + p * 4 + 3.4, x1, y0 + p * 4 + 4, (20, 16, 12), 0.65)
        for g in range(6):
            gy = y0 + p * 4 + 0.6 + r.random() * 2.4
            cv.rect(x0 + r.random() * 8, gy, x0 + 6 + r.random() * 10, gy + 0.3, (40, 30, 22), 0.35)
        for nx in (x0 + 1.0, x1 - 2.0):
            cv.rect(nx, y0 + p * 4 + 1.3, nx + 1, y0 + p * 4 + 2.3, (30, 30, 34), 0.9)
    x0, y0, x1, y1 = ATLAS['tarp']
    cv.vgrad(x0, y0, x1, y1, (66, 96, 140), (44, 66, 100))
    for i in range(5):
        cv.rect(x0 + i * 3.2, y0, x0 + i * 3.2 + 0.6, y1, (150, 176, 210), 0.22)
    cv.rect(x0, y0, x1, y0 + 0.9, (30, 40, 60), 0.5)
    for gx in (x0 + 1, x1 - 2):
        cv.rect(gx, y1 - 2.5, gx + 1, y1 - 1.5, (190, 190, 180), 0.9)
    cv.rect(x0 + 3, y0 + 6, x0 + 9, y0 + 11, (50, 44, 34), 0.35)
    x0, y0, x1, y1 = ATLAS['tin']
    for i in range(8):
        cv.rect(x0 + i * 2, y0, x0 + i * 2 + 1, y1, (146, 88, 54) if i % 2 == 0 else (98, 60, 40))
    cv.rect(x0 + 4, y0 + 2, x0 + 9, y0 + 7, (160, 160, 154), 0.55)
    cv.rect(x0 + 9, y0 + 9, x0 + 12, y0 + 13, (30, 22, 18), 0.8)
    x0, y0, x1, y1 = ATLAS['dark']
    cv.rect(x0, y0, x1, y1, (22, 18, 16))
    for i in range(6):
        cv.rect(x0 + r.random() * 14, y0 + r.random() * 14, x0 + 3 + r.random() * 8, y0 + 1 + r.random() * 2, (50, 40, 32), 0.6)
    x0, y0, x1, y1 = ATLAS['shutter']
    cv.rect(x0, y0, x1, y1, (84, 116, 106))
    for yy in range(0, 16, 2):
        cv.rect(x0, y0 + yy, x1, y0 + yy + 0.6, (36, 56, 52), 0.7)
    cv.rect(x0 + 2, y0 + 4, x0 + 9, y0 + 9, (118, 112, 100), 0.7)
    x0, y0, x1, y1 = ATLAS['rust']
    cv.rect(x0, y0, x1, y1, (100, 62, 42))
    for i in range(7):
        cv.rect(x0 + r.random() * 14, y0, x0 + 1.5 + r.random() * 14, y1, (60, 36, 26), 0.35)
    cv.rect(x0, y0 + 6, x1, y0 + 8, (150, 100, 66), 0.35)
    x0, y0, x1, y1 = ATLAS['cloth']
    for i, c in enumerate(((176, 176, 168), (156, 62, 58), (204, 192, 112), (72, 102, 154))):
        cv.rect(x0 + i * 4, y0, x0 + i * 4 + 4, y1, c)
    x0, y0, x1, y1 = ATLAS['wallpaper']
    cv.rect(x0, y0, x1, y1, (130, 100, 98))
    for i in range(0, 16, 4):
        cv.rect(x0 + i, y0, x0 + i + 2, y1, (108, 82, 82))
    cv.rect(x0 + 3, y0 + 2, x0 + 10, y0 + 9, (40, 34, 30), 0.8)
    cv.rect(x0 + 9, y0 + 8, x0 + 15, y0 + 15, (60, 52, 46), 0.7)
    x0, y0, x1, y1 = ATLAS['timber']
    cv.rect(x0, y0, x1, y1, (72, 54, 40))
    for i in range(8):
        cv.rect(x0 + r.random() * 15, y0, x0 + 0.5 + r.random() * 15, y1, (30, 22, 16), 0.5)
    x0, y0, x1, y1 = ATLAS['dish']
    cv.rect(x0, y0, x1, y1, (176, 176, 170))
    cv.rect(x0 + 3, y0 + 3, x0 + 8, y0 + 8, (130, 80, 52), 0.6)
    cv.rect(x0 + 7, y0 + 9, x0 + 12, y0 + 13, (130, 80, 52), 0.5)
    return cv.finish()


POOR_PAINTERS = {'bld_terrace_facade': paint_facade_poor, 'bld_terrace_brick': paint_brick_poor,
                 'bld_terrace_roof': paint_roof_poor, 'bld_terrace_trim': paint_trim_poor}


PAINTERS = {'bld_terrace_facade': paint_facade, 'bld_terrace_brick': paint_brick,
            'bld_terrace_roof': paint_roof, 'bld_terrace_trim': paint_trim}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', default=None)
    args = ap.parse_args()
    sheet = []
    for name, fn in PAINTERS.items():
        for poor in (False, True):
            img = POOR_PAINTERS[name]() if poor else fn(False)
            out = os.path.join(OUT, name + ('_poor' if poor else '') + '.png')
            tl.save_rgb(out, img)
            print('WROTE', out, img.shape[1], 'x', img.shape[0])
            sheet.append(tl.to_u8(img))
    if args.preview:
        os.makedirs(args.preview, exist_ok=True)
        for i, a in enumerate(sheet):
            im = Image.fromarray(a, 'RGB')
            im = im.resize((im.width * 6, im.height * 6), Image.NEAREST)
            im.save(os.path.join(args.preview, f'tex_{i}.png'))


main()
