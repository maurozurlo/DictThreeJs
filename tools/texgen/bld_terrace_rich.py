"""bld_terrace_rich textures: the gentrified attached townhouse row for dict-three's Street tab.

    python tools/texgen/bld_terrace_rich.py [--preview build/terrace/rich/tex]

Reads tools/texgen/bld_terrace_rich_layout.json and writes under public/textures/map/:
    bld_terrace_rich_facade.png   320 x 64  the whole 100 u front once (10 houses of 32 px)
    bld_terrace_rich_wall.png      32 x 32  end / back walls and chimney shafts (cream ashlar)
    bld_terrace_rich_roof.png     256 x 32  slate, once per slope
    bld_terrace_rich_trim.png      64 x 64  16 x 16 cells: white stucco shades, gold, planter, dormer, awning ...
    bld_terrace_rich_cutout.png   128 x 32  RGBA: stone balustrade and wrought-iron railing (alpha clip)

Same family as the normal terrace painter (tools/texgen/bld_terrace.py): everything is drawn at S x the final
size in native-pixel coordinates and box-filtered down, noise is seeded, and the game's single ambient light
means every painter bakes its own form (lintel / sill shadows, window recess, cornice shadow band, plinth).
Colours follow the rich family (bld_b_rich_trim, env_bld_*_rich_facade): cream / pastel stucco, crisp white
trim, gold accents, warm lit windows.
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
LAYOUT = json.load(open(os.path.join(ROOT, 'tools', 'texgen', 'bld_terrace_rich_layout.json'), encoding='utf-8'))
OUT = os.path.join(ROOT, 'public', 'textures', 'map')
TX = LAYOUT['textures']
SEED = 8842
S = 4
F = np.float32

WHITE = (250, 246, 234)
WHITE_MID = (232, 226, 212)
WHITE_DARK = (206, 198, 182)
GOLD = (216, 172, 68)
GOLD_L = (250, 226, 140)
GOLD_D = (150, 108, 36)
IRON = (38, 34, 38)
GLASS_WARM = [((255, 234, 164), (226, 168, 96)), ((250, 220, 140), (206, 146, 82)),
              ((236, 204, 150), (186, 140, 100))]
CURTAIN = (248, 238, 214)


class Canvas:
    """Float RGB canvas at S x resolution, addressed in native pixels (floats allowed)."""

    def __init__(self, w, h, base):
        self.w, self.h = w, h
        self.a = np.broadcast_to(np.asarray(base, F) / 255.0, (h * S, w * S, 3)).copy()

    def rect(self, x0, y0, x1, y1, col, alpha=1.0):
        col = np.asarray(col, F) / 255.0
        ys, ye = max(int(round(y0 * S)), 0), min(int(round(y1 * S)), self.h * S)
        xs, xe = max(int(round(x0 * S)), 0), min(int(round(x1 * S)), self.w * S)
        if xe <= xs or ye <= ys:
            return
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

    def ellipse(self, cx, cy, rx, ry, col, alpha=1.0, upper=False):
        x0, x1 = max(int(math.floor((cx - rx) * S)), 0), min(int(math.ceil((cx + rx) * S)), self.w * S)
        y0, y1 = max(int(math.floor((cy - ry) * S)), 0), min(int(math.ceil((cy + ry) * S)), self.h * S)
        if x1 <= x0 or y1 <= y0:
            return
        X = (np.arange(x0, x1, dtype=F) + 0.5) / S
        Y = (np.arange(y0, y1, dtype=F) + 0.5) / S
        m = ((X[None, :] - cx) / rx) ** 2 + ((Y[:, None] - cy) / ry) ** 2 <= 1.0
        if upper:
            m &= Y[:, None] <= cy
        sub = self.a[y0:y1, x0:x1]
        sub[m] = sub[m] * (1 - alpha) + np.asarray(col, F) / 255.0 * alpha

    def triangle(self, xl, xr, ybase, ypeak, col, alpha=1.0):
        n = max(2, int(round(abs(ybase - ypeak) * S)))
        for i in range(n):
            t = (i + 0.5) / n
            inset = (xr - xl) / 2 * t
            y = ybase + (ypeak - ybase) * i / n
            self.rect(xl + inset, min(y, y + (ypeak - ybase) / n), xr - inset,
                      max(y, y + (ypeak - ybase) / n), col, alpha)

    def finish(self):
        return self.a.reshape(self.h, S, self.w, S, 3).mean(axis=(1, 3))


def noise(w, h, cx, cy, salt, octaves=3):
    return tl.fbm(w * S, h * S, cx, cy, SEED, salt, octaves=octaves)


def apply_noise(cv, salt, amt, cx, cy):
    n = noise(cv.w, cv.h, cx, cy, salt)
    cv.a = np.clip(cv.a * (1.0 + n[..., None] * amt), 0, 1)


# ---------------------------------------------------------------------------------------------------------
# facade

FAC = TX['bld_terrace_rich_facade']
FW, FH = FAC['size']
ROWS = FAC['rows_px']
DP = FAC['door_px']
FLOWERS = [(226, 60, 84), (250, 150, 180), (252, 214, 70), (250, 250, 244), (190, 90, 200)]


def flower_dots(cv, r, x0, x1, y0, y1, n):
    cv.rect(x0, y0 + 0.4, x1, y1, (58, 112, 60))
    for _ in range(n):
        fx, fy = r.uniform(x0, x1 - 0.7), r.uniform(y0, y1 - 0.5)
        cv.rect(fx, fy, fx + 0.7, fy + 0.6, FLOWERS[int(r.integers(0, len(FLOWERS)))])


def window(cv, r, x, y0, y1, w, hood, lit=True):
    """One rich window: hood (pediment | flat | none), white surround, warm glass, mullions, sill + shadows."""
    x1 = x + w
    cx = (x + x1) / 2
    if hood == 'pediment':
        cv.shade(x - 2.4, y0 - 4.4, x1 + 2.4, y0 - 1.4, 0.86)
        cv.rect(x - 2.0, y0 - 2.4, x1 + 2.0, y0 - 1.3, WHITE)
        cv.triangle(x - 2.0, x1 + 2.0, y0 - 2.4, y0 - 4.2, WHITE)
        cv.triangle(x - 0.8, x1 + 0.8, y0 - 2.5, y0 - 3.6, WHITE_MID)
        cv.rect(cx - 0.45, y0 - 3.4, cx + 0.45, y0 - 2.6, GOLD)
    elif hood == 'flat':
        cv.shade(x - 2.2, y0 - 3.0, x1 + 2.2, y0 - 1.0, 0.86)
        cv.rect(x - 1.9, y0 - 2.2, x1 + 1.9, y0 - 1.0, WHITE)
        cv.rect(x - 1.9, y0 - 1.2, x1 + 1.9, y0 - 1.0, WHITE_DARK)
        cv.rect(cx - 0.5, y0 - 2.2, cx + 0.5, y0 - 1.0, GOLD)
    cv.rect(x - 1.1, y0 - 1.0, x1 + 1.1, y1 + 0.5, WHITE)
    cv.rect(x - 1.1, y0 - 1.0, x - 0.8, y1 + 0.5, WHITE_MID)
    top, bot = GLASS_WARM[int(r.integers(0, 3))] if lit else ((90, 100, 118), (40, 46, 58))
    cv.vgrad(x, y0, x1, y1, top, bot)
    if r.random() < 0.8:
        cv.rect(x, y0, x + 1.1, y1, CURTAIN, 0.6)
        cv.rect(x1 - 1.1, y0, x1, y1, CURTAIN, 0.6)
    cv.rect(x, y0, x1, y0 + 0.9, (90, 56, 24), 0.4)           # recess shadow at the top
    cv.rect(x, y0, x + 0.6, y1, (90, 56, 24), 0.3)
    cv.rect(cx - 0.22, y0, cx + 0.22, y1, WHITE, 0.95)         # mullion
    for f in (0.36, 0.68):
        cv.rect(x, y0 + (y1 - y0) * f, x1, y0 + (y1 - y0) * f + 0.4, WHITE, 0.9)
    cv.rect(x - 1.6, y1 + 0.3, x1 + 1.6, y1 + 1.2, WHITE)     # sill
    cv.rect(x - 1.6, y1 + 1.0, x1 + 1.6, y1 + 1.2, WHITE_DARK)
    cv.shade(x - 1.3, y1 + 1.2, x1 + 1.3, y1 + 2.6, 0.80)      # shadow under the sill


def shop(cv, r, x0, hi, hs):
    """Boutique: dark fascia with a gold letter block, lit display window, glazed door on the right."""
    col = np.array(hs['door_col'], F)
    cv.rect(x0 + 1.4, 44.0, x0 + 30.6, 47.6, col * 0.9)
    cv.rect(x0 + 1.4, 44.0, x0 + 30.6, 44.5, GOLD)
    cv.rect(x0 + 1.4, 47.1, x0 + 30.6, 47.6, GOLD)
    k = x0 + 5.0
    while k < x0 + 27.0:
        ln = float(r.uniform(1.4, 3.4))
        cv.rect(k, 45.3, min(k + ln, x0 + 27.0), 46.3, GOLD_L, 0.95)
        k += ln + 0.7
    cv.shade(x0 + 1.4, 47.6, x0 + 30.6, 49.2, 0.66)             # awning shadow
    cv.rect(x0 + 1.4, 47.6, x0 + 3.0, 60, WHITE)                # pilasters
    cv.rect(x0 + 29.0, 47.6, x0 + 30.6, 60, WHITE)
    cv.rect(x0 + 3.0, 47.6, x0 + 3.5, 60, WHITE_DARK)
    cv.rect(x0 + 3.0, 49.0, x0 + 22.2, 60, WHITE)               # display frame
    cv.vgrad(x0 + 3.7, 49.7, x0 + 21.5, 59.4, (255, 236, 170), (222, 164, 94))
    for sy in (53.4, 57.0):
        cv.rect(x0 + 3.7, sy, x0 + 21.5, sy + 0.45, WHITE, 0.85)
        kx = x0 + 4.2
        while kx < x0 + 20.8:
            cw = float(r.uniform(1.0, 2.0))
            cv.rect(kx, sy - float(r.uniform(1.2, 2.4)), kx + cw, sy,
                    [(190, 40, 60), (40, 70, 150), (244, 244, 234), (60, 130, 90), (250, 190, 60)][int(r.integers(0, 5))])
            kx += cw + float(r.uniform(0.6, 1.6))
    for mx in (x0 + 9.6, x0 + 15.6):
        cv.rect(mx, 49.7, mx + 0.5, 59.4, WHITE)
    cv.shade(x0 + 3.7, 49.7, x0 + 21.5, 50.9, 0.78)
    # glazed door
    cv.rect(x0 + 22.6, 48.8, x0 + 29.0, 60, col)
    cv.vgrad(x0 + 23.4, 50.0, x0 + 28.2, 56.4, (255, 232, 160), (214, 150, 86))
    cv.rect(x0 + 25.7, 50.0, x0 + 25.9, 56.4, col)
    cv.rect(x0 + 23.2, 58.0, x0 + 28.4, 59.4, GOLD, 0.9)
    cv.rect(x0 + 23.6, 56.8, x0 + 24.1, 58.0, GOLD_L)           # pull handle


def door(cv, r, x0, hi, hs):
    dx = x0 + (DP['left_x'] if hs['door'] == 'left' else DP['right_x'])
    dw = DP['w']
    col = np.array(hs['door_col'], F)
    cx = dx + dw / 2
    cv.rect(dx - 1.8, 43.6, dx + dw + 1.8, 45.8, WHITE)         # entablature
    cv.rect(dx - 1.8, 45.4, dx + dw + 1.8, 45.8, WHITE_DARK)
    cv.rect(dx - 1.4, 45.8, dx, 60.2, WHITE)                    # pilasters
    cv.rect(dx + dw, 45.8, dx + dw + 1.4, 60.2, WHITE)
    cv.rect(dx - 0.4, 45.8, dx, 60.2, WHITE_DARK)
    cv.ellipse(cx, 51.2, 4.9, 4.4, WHITE, upper=True)           # archivolt
    cv.rect(dx, 51.2, dx + dw, 60.2, (30, 26, 22))              # reveal
    cv.ellipse(cx, 51.2, 4.1, 3.6, (34, 28, 24), upper=True)
    cv.ellipse(cx, 51.2, 3.5, 3.0, (255, 230, 150), upper=True)  # fanlight glass
    cv.rect(cx - 3.5, 49.2, cx + 3.5, 51.2, (232, 164, 92), 0.0)
    cv.vgrad(cx - 3.5, 49.6, cx + 3.5, 51.2, (255, 226, 140), (236, 170, 96), 0.0)
    for k in (-2.4, -1.2, 0.0, 1.2, 2.4):                       # fanlight spokes
        cv.rect(cx + k - 0.15, 49.0 + abs(k) * 0.35, cx + k + 0.15, 51.2, WHITE, 0.9)
    cv.rect(cx - 3.5, 51.0, cx + 3.5, 51.5, WHITE)              # transom bar
    cv.rect(dx + 0.7, 51.5, dx + dw - 0.7, 60.2, col)           # door leaf
    cv.rect(dx + 0.7, 51.5, dx + 1.1, 60.2, (0, 0, 0), 0.25)
    for (ya, yb) in ((52.5, 55.6), (56.6, 59.0)):               # raised panels
        cv.rect(dx + 1.7, ya, dx + dw - 1.7, yb, (0, 0, 0), 0.22)
        cv.rect(dx + 1.7, ya, dx + dw - 1.7, ya + 0.4, (255, 255, 255), 0.18)
        cv.rect(dx + 1.7, ya, dx + 2.1, yb, (255, 255, 255), 0.12)
    cv.rect(dx + dw - 2.4, 55.4, dx + dw - 1.5, 56.4, GOLD_L)    # brass handle
    cv.rect(dx + 2.4, 53.6, dx + dw - 2.4, 54.0, GOLD)           # letter plate
    cv.rect(dx + 1.2, 59.0, dx + dw - 1.2, 60.0, GOLD, 0.9)      # kick plate
    cv.rect(dx + dw + 1.6, 49.6, dx + dw + 2.5, 51.2, GOLD_L) if hs['door'] == 'left' else None
    lx = dx + dw + 2.2 if hs['door'] == 'left' else dx - 3.2
    cv.rect(lx - 0.9, 48.2, lx + 1.9, 52.6, (255, 236, 170), 0.28)  # lantern halo
    cv.rect(lx, 49.0, lx + 1.0, 51.4, GOLD)
    cv.rect(lx + 0.15, 49.4, lx + 0.85, 50.9, (255, 244, 190))
    # ground-floor window on the other side of the house
    wx = x0 + (18 if hs['door'] == 'left' else 3)
    window(cv, r, wx, 48.5, 57.4, 9, 'flat')
    flower_dots(cv, r, wx - 1.4, wx + 10.4, 57.4, 58.9, 14)    # painted flower box on the sill
    cv.rect(wx - 1.3, 58.9, wx + 10.3, 60.2, (196, 110, 74))
    cv.rect(wx - 1.3, 58.9, wx + 10.3, 59.3, (222, 142, 98))
    cv.shade(wx - 1.3, 59.9, wx + 10.3, 60.2, 0.7)


def paint_facade():
    W, H = FW, FH
    r = tl.rng(SEED, 'facade')
    cv = Canvas(W, H, (240, 230, 206))
    houses = FAC['houses']
    for hs in houses:
        cv.rect(hs['x'], 0, hs['x'] + 32, H, hs['plaster'])
    apply_noise(cv, 'plaster', 0.035, 20, 4)
    # rustication on the ground floor, belt courses between the storeys
    for hs in houses:
        x0 = hs['x']
        y = 46.0
        while y < 60.0:
            cv.rect(x0, y, x0 + 32, y + 0.4, (0, 0, 0), 0.13)
            cv.rect(x0, y + 0.4, x0 + 32, y + 0.8, (255, 255, 255), 0.16)
            y += 2.6
    for (ya, yb) in ((20.6, 22.2), (41.4, 43.2)):
        cv.rect(0, ya, W, yb, WHITE)
        cv.rect(0, yb - 0.4, W, yb, WHITE_DARK)
        cv.shade(0, yb, W, yb + 1.8, 0.80)
    for hi, hs in enumerate(houses):
        x0 = hs['x']
        for k, wx in enumerate((5, 21)):
            window(cv, r, x0 + wx, 7.5, 17.6, 6, 'flat', lit=r.random() < 0.85)           # storey 3
            window(cv, r, x0 + wx, 26.5, 38.0, 6, 'pediment' if hi % 2 == 0 else 'flat',  # storey 2
                   lit=r.random() < 0.85)
        if hs['shop']:
            shop(cv, r, x0, hi, hs)
        else:
            door(cv, r, x0, hi, hs)
    # pilasters at every party wall with a shaded inner edge
    for hs in houses:
        x0 = hs['x']
        cv.rect(x0 - 0.2, 6.5, x0 + 1.3, 60.2, WHITE)
        cv.rect(x0 + 1.3, 6.5, x0 + 2.0, 60.2, (0, 0, 0), 0.12)
        cv.rect(x0 - 0.2, 6.5, x0 + 0.25, 60.2, WHITE_DARK)
    cv.rect(W - 1.3, 6.5, W, 60.2, WHITE)
    cv.rect(W - 1.3, 6.5, W - 0.9, 60.2, WHITE_DARK)
    # cornice (0-3 px, mapped on the projecting band), frieze with gold swags below its shadow
    cv.rect(0, 0, W, 3.0, WHITE)
    cv.rect(0, 0, W, 0.5, (255, 255, 250))
    k = 0.4
    while k < W:
        cv.rect(k, 1.5, k + 1.0, 2.7, WHITE_DARK)                 # modillions
        k += 2.0
    cv.rect(0, 2.6, W, 3.0, GOLD)
    cv.shade(0, 3.0, W, 4.0, 0.74)
    cv.shade(0, 4.0, W, 6.4, 0.9)
    k = 0.0
    while k < W:
        for dxs, dys in ((0.0, 4.5), (1.0, 5.0), (2.0, 5.0), (3.0, 4.5)):
            cv.rect(k + dxs, dys, k + dxs + 1.0, dys + 0.7, GOLD)
        cv.rect(k, 4.2, k + 0.5, 4.5, GOLD_L)
        k += 4.0
    # plinth (polished marble) and a gold-lined step at the base
    cv.rect(0, 60.2, W, H, (214, 206, 190))
    cv.rect(0, 60.2, W, 60.8, (252, 248, 238), 0.7)
    cv.shade(0, 63.0, W, H, 0.86)
    apply_noise(cv, 'grain', 0.02, 80, 16)
    return cv.finish()


# ---------------------------------------------------------------------------------------------------------
# wall, roof

def paint_wall():
    W, H = TX['bld_terrace_rich_wall']['size']
    cv = Canvas(W, H, (238, 228, 204))
    r = tl.rng(SEED, 'wall')
    for row in range(H // 4):
        off = (row % 2) * 4
        for k in range(-1, W // 8 + 1):
            t = 0.96 + 0.08 * r.random()
            cv.rect(k * 8 + off + 0.4, row * 4 + 0.4, k * 8 + off + 7.6, row * 4 + 3.6,
                    np.array([242, 233, 210]) * t)
        cv.rect(0, row * 4, W, row * 4 + 0.4, (196, 184, 160), 0.7)
    apply_noise(cv, 'walln', 0.04, 4, 4)
    cv.a *= (1 - 0.14 * np.clip((np.linspace(0, 1, H * S, dtype=F)[:, None, None] - 0.8) / 0.2, 0, 1))
    return cv.finish()


def paint_roof():
    W, H = TX['bld_terrace_rich_roof']['size']
    cv = Canvas(W, H, (84, 94, 112))
    r = tl.rng(SEED, 'roof')
    rowh, tw = 2, 6
    for row in range(H // rowh):
        off = (row % 2) * (tw // 2)
        band = row in (5, 6, 7, 24, 25, 26)
        for k in range(-1, W // tw + 2):
            t = 0.82 + 0.34 * r.random()
            base = np.array([138, 150, 164] if band else [86, 98, 118]) * t
            x = k * tw + off
            cv.rect(x, row * rowh, x + tw, (row + 1) * rowh, base)
            cv.rect(x, row * rowh, x + 0.4, (row + 1) * rowh, (0, 0, 0), 0.22)
        cv.rect(0, (row + 1) * rowh - 0.7, W, (row + 1) * rowh, (0, 0, 0), 0.28)
        cv.rect(0, row * rowh, W, row * rowh + 0.35, (230, 240, 255), 0.10)
    apply_noise(cv, 'roofn', 0.06, 16, 2)
    return cv.finish()


# ---------------------------------------------------------------------------------------------------------
# trim atlas

def paint_trim():
    W, H = TX['bld_terrace_rich_trim']['size']
    R = TX['bld_terrace_rich_trim']['regions']
    cv = Canvas(W, H, WHITE)
    r = tl.rng(SEED, 'trim')

    def reg(n):
        return R[n]

    x, y, w, h = reg('white')
    cv.rect(x, y, x + w, y + h, WHITE)
    cv.rect(x, y, x + w, y + 1, (255, 255, 252))
    x, y, w, h = reg('white_dark')
    cv.rect(x, y, x + w, y + h, WHITE_DARK)
    x, y, w, h = reg('white_mid')
    cv.rect(x, y, x + w, y + h, WHITE_MID)
    x, y, w, h = reg('gold')
    cv.vgrad(x, y, x + w, y + h, GOLD_L, GOLD_D)
    cv.rect(x, y + 4, x + w, y + 6, (255, 244, 180), 0.8)
    cv.rect(x, y + h - 2, x + w, y + h, (96, 64, 20), 0.6)
    # planter: top half = foliage and flowers seen from above, bottom half = terracotta box front
    x, y, w, h = reg('planter')
    cv.rect(x, y, x + w, y + 8, (50, 106, 56))
    for _ in range(26):
        fx, fy = r.uniform(x, x + w - 1), r.uniform(y, y + 7)
        cv.rect(fx, fy, fx + 1.2, fy + 1.0, (74, 140, 70), 0.8)
    for _ in range(18):
        fx, fy = r.uniform(x, x + w - 1), r.uniform(y, y + 7.2)
        cv.rect(fx, fy, fx + 1.0, fy + 1.0, FLOWERS[int(r.integers(0, len(FLOWERS)))])
    cv.rect(x, y + 8, x + w, y + h, (198, 112, 76))
    cv.rect(x, y + 8, x + w, y + 9.5, (226, 148, 102))
    cv.rect(x, y + h - 2, x + w, y + h, (130, 66, 44))
    for k in range(2, 14, 4):
        cv.rect(x + k, y + 10.5, x + k + 2, y + 13, (214, 132, 92))
    # dormer front: white pediment tympanum over a cream wall with a lit window
    x, y, w, h = reg('dormer')
    cv.rect(x, y, x + w, y + h, (244, 234, 208))
    cv.rect(x, y, x + w, y + 5.2, WHITE)
    cv.rect(x, y + 5.0, x + w, y + 6.0, WHITE_DARK)
    cv.ellipse(x + 8, y + 3.4, 1.2, 1.2, GOLD)
    cv.rect(x + 3.2, y + 6.4, x + 12.8, y + 14.6, WHITE)
    cv.vgrad(x + 4.2, y + 7.4, x + 11.8, y + 13.4, (255, 232, 160), (222, 160, 90))
    cv.rect(x + 4.2, y + 7.4, x + 11.8, y + 8.2, (90, 56, 24), 0.4)
    cv.rect(x + 7.7, y + 7.4, x + 8.3, y + 13.4, WHITE)
    cv.rect(x + 4.2, y + 10.0, x + 11.8, y + 10.5, WHITE)
    cv.rect(x + 2.4, y + 14.2, x + 13.6, y + 15.2, WHITE)
    cv.shade(x + 2.4, y + 15.2, x + 13.6, y + 16, 0.78)
    # awning: cream and gold stripes, top face rows 0-10, valance rows 11-15
    x, y, w, h = reg('awning')
    for k in range(8):
        c = GOLD if k % 2 == 0 else (252, 246, 228)
        cv.rect(x + k * 2, y, x + k * 2 + 2, y + h, c)
    cv.shade(x, y, x + w, y + 3, 0.92)
    cv.rect(x, y + 11, x + w, y + 11.6, (0, 0, 0), 0.30)
    cv.shade(x, y + 14, x + w, y + h, 0.78)
    for k in range(8):                                          # scallops
        cv.ellipse(x + k * 2 + 1, y + 14.2, 1.0, 1.4, GOLD if k % 2 == 0 else (252, 246, 228), 0.9)
    # copper (verdigris ridge cap)
    x, y, w, h = reg('copper')
    cv.rect(x, y, x + w, y + h, (92, 152, 130))
    cv.rect(x, y, x + w, y + 3, (140, 196, 170), 0.7)
    for k in range(4, 16, 4):
        cv.rect(x, y + k, x + w, y + k + 0.6, (60, 112, 92), 0.7)
    # marble step top
    x, y, w, h = reg('marble')
    cv.rect(x, y, x + w, y + h, (234, 230, 220))
    cv.rect(x, y + 5, x + w, y + 5.6, (190, 186, 178), 0.5)
    cv.rect(x + 9, y, x + 9.5, y + h, (200, 196, 188), 0.45)
    # slab / canopy / cap edge: white, gold line, shaded underside
    x, y, w, h = reg('balcony_front')
    cv.rect(x, y, x + w, y + 9, WHITE)
    cv.rect(x, y + 9, x + w, y + 11, GOLD)
    cv.rect(x, y + 11, x + w, y + 13, WHITE_MID)
    cv.rect(x, y + 13, x + w, y + h, WHITE_DARK)
    apply_noise(cv, 'trimn', 0.015, 4, 4)
    return cv.finish()


# ---------------------------------------------------------------------------------------------------------
# cutout (RGBA, native pixels, alpha 0 or 255)

def paint_cutout():
    W, H = TX['bld_terrace_rich_cutout']['size']
    R = TX['bld_terrace_rich_cutout']['regions']
    a = np.zeros((H, W, 4), np.uint8)
    a[..., :3] = (214, 206, 190)                                # opaque-looking colour under cleared pixels

    def px(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            a[y, x] = (*c, 255)

    # balustrade: piers, top rail, base rail, vase balusters (white lit side, shaded side)
    bx, by, bw, bh = R['balustrade']
    for yy in range(bh):
        for xx in range(bw):
            if xx < 4 or xx >= bw - 4:
                c = WHITE if xx in (0, 1, bw - 4, bw - 3) else WHITE_MID if xx in (2, bw - 2) else WHITE_DARK
                px(bx + xx, by + yy, c)
            elif yy == 0:
                px(bx + xx, by + yy, (255, 252, 244))
            elif yy == 1:
                px(bx + xx, by + yy, WHITE_MID)
            elif yy == bh - 2:
                px(bx + xx, by + yy, WHITE)
            elif yy == bh - 1:
                px(bx + xx, by + yy, WHITE_DARK)
    for k in range(18):
        x = 5 + 4 * k
        for yy in range(2, bh - 2):
            wide = 3 if 4 <= yy <= 6 else 2
            for j in range(wide):
                c = WHITE if j == 0 else (WHITE_MID if (wide == 3 and j == 1) else WHITE_DARK)
                px(bx + x + j, by + yy, c)
    for xx in (0, 1, 2, 3, bw - 4, bw - 3, bw - 2, bw - 1):     # gold pier caps
        px(bx + xx, by, GOLD)
    # railing: iron posts with gold ball finials, rails, bars every 3 px, scroll rings, gold finials
    rx, ry, rw, rh = R['railing']
    for xx in range(rw):
        px(rx + xx, ry + 2, (92, 84, 78))
        px(rx + xx, ry + 3, IRON)
        px(rx + xx, ry + rh - 2, IRON)
        px(rx + xx, ry + rh - 1, (20, 18, 20))
    for xx in range(1, rw - 1, 3):
        for yy in range(3, rh - 1):
            px(rx + xx, ry + yy, IRON)
        if (xx - 1) % 6 == 0:
            px(rx + xx, ry + 1, GOLD)
    for k in range(rw // 8):
        cx, cy = rx + 4 + 8 * k, ry + 6
        for ang in range(0, 360, 20):
            px(int(round(cx + 2.7 * math.cos(math.radians(ang)))), int(round(cy + 2.7 * math.sin(math.radians(ang)))),
               GOLD_D if k % 2 else IRON)
        px(cx, cy, GOLD_L)
    for xx in (0, 1, rw - 2, rw - 1):
        for yy in range(1, rh):
            px(rx + xx, ry + yy, IRON)
    px(rx, ry, GOLD)
    px(rx + 1, ry, GOLD)
    px(rx + rw - 2, ry, GOLD)
    px(rx + rw - 1, ry, GOLD)
    return a


PAINTERS = {'bld_terrace_rich_facade': paint_facade, 'bld_terrace_rich_wall': paint_wall,
            'bld_terrace_rich_roof': paint_roof, 'bld_terrace_rich_trim': paint_trim}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', default=None)
    args = ap.parse_args()
    sheet = []
    for name, fn in PAINTERS.items():
        img = fn()
        out = os.path.join(OUT, name + '.png')
        tl.save_rgb(out, img)
        print('WROTE', out, img.shape[1], 'x', img.shape[0])
        sheet.append((name, Image.fromarray(tl.to_u8(img), 'RGB')))
    cut = paint_cutout()
    out = os.path.join(OUT, 'bld_terrace_rich_cutout.png')
    Image.fromarray(cut, 'RGBA').save(out)
    print('WROTE', out, cut.shape[1], 'x', cut.shape[0])
    sheet.append(('bld_terrace_rich_cutout', Image.fromarray(cut, 'RGBA')))
    if args.preview:
        os.makedirs(args.preview, exist_ok=True)
        for name, im in sheet:
            sc = 4 if im.width > 100 else 8
            bg = Image.new('RGBA', im.size, (90, 140, 200, 255))
            bg.alpha_composite(im.convert('RGBA'))
            bg.resize((bg.width * sc, bg.height * sc), Image.NEAREST).convert('RGB').save(
                os.path.join(args.preview, name + '.png'))


main()
