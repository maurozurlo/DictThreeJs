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
    if poor:
        # grime streaks under every sill, damp rising from the plinth, peeled plaster revealing brick
        streak = noise(W, H, 80, 4, 'streak', 2)
        for hi in range(W // 32):
            for wx in (5, 21):
                for ya in (18, 38):
                    cv.shade(hi * 32 + wx + 0.5, ya + 2, hi * 32 + wx + 5.5, ya + 14, 0.78)
        cv.vgrad(0, 44, W, 61, (0, 0, 0), (0, 0, 0), 0.0)
        damp = np.linspace(0, 1, H * S, dtype=F)[:, None, None]
        cv.a *= (1 - 0.25 * np.clip((damp - 0.7) / 0.3, 0, 1))
        peel = noise(W, H, 24, 5, 'peel', 3)
        mask = (peel > 0.42).astype(F)[..., None]
        brick = np.array([138, 86, 66], F) / 255.0
        cv.a = cv.a * (1 - mask * 0.6) + brick * mask * 0.6 * (0.8 + 0.4 * noise(W, H, 80, 16, 'b')[..., None])
        desat(cv, 0.45, 0.66)
        cv.a *= (1 - 0.18 * np.clip(streak[..., None], 0, 1))
    else:
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


PAINTERS = {'bld_terrace_facade': paint_facade, 'bld_terrace_brick': paint_brick,
            'bld_terrace_roof': paint_roof, 'bld_terrace_trim': paint_trim}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', default=None)
    args = ap.parse_args()
    sheet = []
    for name, fn in PAINTERS.items():
        for poor in (False, True):
            img = fn(poor)
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
