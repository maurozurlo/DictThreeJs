#!/usr/bin/env python3
"""Small procedural texture library for the tools/texgen generators (numpy + Pillow only).

Conventions:
    - Images are float32 numpy arrays in [0, 1]: masks are (h, w), colours (h, w, 3) in sRGB.
    - Coordinates are pixels, pixel centres at i + 0.5, x to the right (U) and y down (Blender v = 1 - y / h).
    - Noise periods are integer cell counts across the whole image, so noise sampled over the full image
      tiles. Blur and the stamp helpers take a per-axis wrap flag (x, y): (True, True) for a tiling material,
      (True, False) for a trim strip that tiles along U only, (False, False) for a decal.
    - Every random source takes a seed plus salts, so a re-run writes the same bytes.

The verification helpers at the bottom (tiled previews, mips, seam statistics, outlined atlases, contact
sheets) are what the generators' --preview option writes.

Import it from a generator next to it:  import texlib as tl
"""

import math
import zlib

import numpy as np
from PIL import Image, ImageDraw

F = np.float32

TILE = (True, True)
STRIP = (True, False)
DECAL = (False, False)


# ---------------------------------------------------------------------------------------------------------
# Basics

def rng(seed, *salt):
    """numpy Generator from an int seed plus salts (strings or ints), stable across runs."""
    words = [int(seed) & 0xFFFFFFFF] + [zlib.crc32(str(s).encode('utf-8')) for s in salt]
    return np.random.default_rng(np.random.SeedSequence(words))


def coords(w, h):
    """Pixel-centre coordinate grids X, Y, each (h, w)."""
    return np.meshgrid(np.arange(w, dtype=F) + F(0.5), np.arange(h, dtype=F) + F(0.5))


def rgb(r, g, b):
    """Colour from 0-255 ints."""
    return np.array([r, g, b], F) / F(255.0)


def solid(w, h, colour):
    return np.broadcast_to(np.asarray(colour, F), (h, w, 3)).copy()


def smoothstep(e0, e1, x):
    t = np.clip((np.asarray(x, F) - e0) / F(e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def levels(a, lo, hi, gamma=1.0):
    """Maps [lo, hi] to [0, 1], clamps, then applies gamma."""
    t = np.clip((a - lo) / F(hi - lo), 0.0, 1.0)
    return t if gamma == 1.0 else t ** F(gamma)


def normalize(a):
    lo, hi = float(a.min()), float(a.max())
    return ((a - lo) / F(max(hi - lo, 1e-6))).astype(F)


def _m(mask):
    mask = np.asarray(mask, F)
    return mask[..., None] if mask.ndim == 2 else mask


def mix(base, top, mask):
    """Blends towards top (a colour or an image) by mask."""
    return base + (np.asarray(top, F) - base) * _m(mask)


def shade(img, factor):
    """Multiplies an image by a scalar mask (shading, occlusion)."""
    return img * _m(factor)


def tint(img, colour, mask):
    """Multiplies by colour where mask is 1 (stains, dirt that keeps the detail underneath)."""
    return img * (1.0 + (np.asarray(colour, F) - 1.0) * _m(mask))


def wrap_delta(d, period):
    """Signed distance folded into [-period/2, period/2): repeats a shape every period pixels."""
    return d - F(period) * np.round(d / F(period))


# ---------------------------------------------------------------------------------------------------------
# Noise. cx, cy are cell counts across the image width and height (integers, so the noise wraps).

def _fade(t):
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)


def _lattice(w, h, cx, cy):
    X, Y = coords(w, h)
    u = X * F(cx / w)
    v = Y * F(cy / h)
    i0 = np.floor(u).astype(np.int64)
    j0 = np.floor(v).astype(np.int64)
    fu = (u - i0).astype(F)
    fv = (v - j0).astype(F)
    i0 %= cx
    j0 %= cy
    return i0, j0, (i0 + 1) % cx, (j0 + 1) % cy, fu, fv


def perlin(w, h, cx, cy, seed, salt=''):
    """Periodic gradient noise, roughly in [-1, 1]."""
    r = rng(seed, 'perlin', salt, cx, cy)
    ang = r.uniform(0.0, 2.0 * math.pi, size=(cy, cx))
    gx, gy = np.cos(ang).astype(F), np.sin(ang).astype(F)
    i0, j0, i1, j1, fu, fv = _lattice(w, h, cx, cy)
    n00 = gx[j0, i0] * fu + gy[j0, i0] * fv
    n10 = gx[j0, i1] * (fu - 1.0) + gy[j0, i1] * fv
    n01 = gx[j1, i0] * fu + gy[j1, i0] * (fv - 1.0)
    n11 = gx[j1, i1] * (fu - 1.0) + gy[j1, i1] * (fv - 1.0)
    su, sv = _fade(fu), _fade(fv)
    a = n00 + (n10 - n00) * su
    b = n01 + (n11 - n01) * su
    return ((a + (b - a) * sv) * F(math.sqrt(2.0))).astype(F)


def fbm(w, h, cx, cy, seed, salt='', octaves=4, gain=0.5, lacunarity=2):
    """Fractal sum of perlin octaves (integer lacunarity keeps every octave periodic), roughly [-1, 1].
    Octaves whose cells would be smaller than 2 px are dropped."""
    total = np.zeros((h, w), F)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        fx, fy = cx * lacunarity ** o, cy * lacunarity ** o
        if fx > w / 2 or fy > h / 2:
            break
        total += F(amp) * perlin(w, h, fx, fy, seed, f'{salt}/{o}')
        norm += amp
        amp *= gain
    return total / F(norm)


def value_noise(w, h, cx, cy, seed, salt=''):
    """Periodic value noise in [0, 1] (smooth blobs, cheaper and blockier than perlin)."""
    lat = rng(seed, 'value', salt, cx, cy).random((cy, cx)).astype(F)
    i0, j0, i1, j1, fu, fv = _lattice(w, h, cx, cy)
    su, sv = _fade(fu), _fade(fv)
    a = lat[j0, i0] + (lat[j0, i1] - lat[j0, i0]) * su
    b = lat[j1, i0] + (lat[j1, i1] - lat[j1, i0]) * su
    return a + (b - a) * sv


def white(w, h, seed, salt=''):
    """Per-pixel uniform noise in [0, 1]."""
    return rng(seed, 'white', salt).random((h, w)).astype(F)


def voronoi(w, h, cx, cy, seed, salt='', jitter=0.9):
    """Periodic cellular noise on a jittered cx x cy grid (keep the cells roughly square in pixels).
    Returns (f1, f2, cell): distances in pixels to the nearest and second-nearest feature point, and the
    nearest cell's index (0 .. cx*cy-1, use cell_values to colour cells)."""
    pts = (0.5 + (rng(seed, 'voronoi', salt, cx, cy).random((cy, cx, 2)) - 0.5) * jitter).astype(F)
    X, Y = coords(w, h)
    sx, sy = w / cx, h / cy
    u, v = X / F(sx), Y / F(sy)
    ci, cj = np.floor(u).astype(np.int64), np.floor(v).astype(np.int64)
    f1 = np.full((h, w), np.inf, F)
    f2 = np.full((h, w), np.inf, F)
    cell = np.zeros((h, w), np.int64)
    for dj in (-1, 0, 1):
        for di in (-1, 0, 1):
            ni, nj = ci + di, cj + dj
            wi, wj = ni % cx, nj % cy
            p = pts[wj, wi]
            dx = (ni + p[..., 0] - u) * F(sx)
            dy = (nj + p[..., 1] - v) * F(sy)
            d = np.sqrt(dx * dx + dy * dy)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d))
            cell = np.where(closer, wj * cx + wi, cell)
            f1 = np.where(closer, d, f1)
    return f1, f2, cell


def cell_values(cell, count, seed, salt=''):
    """A random value in [0, 1] per cell id (voronoi cells, bricks, planks)."""
    return rng(seed, 'cells', salt).random(count).astype(F)[cell]


# ---------------------------------------------------------------------------------------------------------
# Blur and occlusion

def _kernel(sigma):
    r = max(1, int(math.ceil(sigma * 3.0)))
    k = np.exp(-0.5 * (np.arange(-r, r + 1, dtype=np.float64) / sigma) ** 2)
    return (k / k.sum()).astype(F), r


def blur(a, sigma, sigma_y=None, wrap=TILE):
    """Separable Gaussian blur of a mask or colour image. wrap=(x, y): a wrapped axis blurs across the
    opposite edge (tiling), the other mirrors at the border (decals, the free edges of strips)."""
    sy = sigma if sigma_y is None else sigma_y
    out = np.asarray(a, F)
    for axis, s, wr in ((1, sigma, wrap[0]), (0, sy, wrap[1])):
        if s <= 0:
            continue
        k, r = _kernel(s)
        n = out.shape[axis]
        pad = [(0, 0)] * out.ndim
        pad[axis] = (r, r)
        p = np.pad(out, pad, mode='wrap' if wr else 'symmetric')
        acc = np.zeros_like(out)
        for i in range(2 * r + 1):
            sl = [slice(None)] * out.ndim
            sl[axis] = slice(i, i + n)
            acc += k[i] * p[tuple(sl)]
        out = acc
    return out


def occlusion(cavity, sigma, strength, wrap=TILE):
    """Soft ambient occlusion: darkening around a cavity mask (grooves, gaps, recesses), no direction.
    Returns a multiplier in [1 - strength, 1]."""
    return 1.0 - F(strength) * np.clip(blur(cavity, sigma, wrap=wrap), 0.0, 1.0)


# ---------------------------------------------------------------------------------------------------------
# Shapes: signed distances in pixels (negative inside) and coverage

def sd_box(x, y, cx, cy, hw, hh, r=0.0):
    """Rounded rectangle centred at (cx, cy) with half sizes hw, hh and corner radius r."""
    qx = np.abs(x - cx) - F(hw - r)
    qy = np.abs(y - cy) - F(hh - r)
    outside = np.hypot(np.maximum(qx, 0.0), np.maximum(qy, 0.0))
    return outside + np.minimum(np.maximum(qx, qy), 0.0) - F(r)


def sd_rect(x, y, x0, y0, x1, y1, r=0.0):
    """Rounded rectangle from its pixel-edge bounds [x0, x1) x [y0, y1)."""
    return sd_box(x, y, (x0 + x1) * 0.5, (y0 + y1) * 0.5, (x1 - x0) * 0.5, (y1 - y0) * 0.5, r)


def sd_circle(x, y, cx, cy, r):
    return np.hypot(x - cx, y - cy) - F(r)


def sd_ellipse(x, y, cx, cy, rx, ry):
    """Approximate ellipse distance (exact on the axes, good enough for anti-aliasing)."""
    k = np.hypot((x - cx) / F(rx), (y - cy) / F(ry))
    return (k - 1.0) * F(min(rx, ry))


def sd_segment(x, y, x0, y0, x1, y1):
    """Unsigned distance to a line segment; returns (distance, t along the segment in [0, 1])."""
    px, py = x - x0, y - y0
    bx, by = x1 - x0, y1 - y0
    t = np.clip((px * bx + py * by) / F(bx * bx + by * by + 1e-9), 0.0, 1.0)
    return np.hypot(px - bx * t, py - by * t), t


def fill(sd, aa=1.0):
    """Anti-aliased coverage of a signed distance (aa = edge width in pixels)."""
    return np.clip(0.5 - sd / F(aa), 0.0, 1.0)


def ring(sd, width, aa=1.0):
    """Anti-aliased band of the given width centred on the shape's outline."""
    return fill(np.abs(sd) - F(width) * 0.5, aa)


def bevel(sd, width):
    """0 at the outline rising to 1 at `width` pixels inside: a soft rounded-edge profile."""
    return smoothstep(0.0, width, -sd)


def gradient(w, h, x0, y0, x1, y1):
    """Linear ramp 0 at (x0, y0) to 1 at (x1, y1), clamped."""
    X, Y = coords(w, h)
    dx, dy = x1 - x0, y1 - y0
    return np.clip(((X - x0) * dx + (Y - y0) * dy) / F(dx * dx + dy * dy), 0.0, 1.0)


def stencil_bars(w, h, x0, y0, x1, y1, lines, bar_h, seed, salt='', gap=3.0, bridge=6.0, min_len=4.0,
                 max_len=14.0):
    """A block of horizontal bars that reads as stencilled lettering without any letters: `lines` rows of
    word-length segments separated by `gap`, each segment cut by 1 px stencil bridges every ~`bridge` px."""
    r = rng(seed, 'stencil', salt)
    X, Y = coords(w, h)
    m = np.zeros((h, w), F)
    pitch = (y1 - y0) / max(lines, 1)
    for li in range(lines):
        cy = y0 + pitch * (li + 0.5)
        end = x1 - r.uniform(0.0, (x1 - x0) * 0.3) if li == lines - 1 else x1
        x = x0
        while x < end - min_len:
            seg = min(r.uniform(min_len, max_len), end - x)
            box = fill(sd_rect(X, Y, x, cy - bar_h * 0.5, x + seg, cy + bar_h * 0.5))
            n = max(1, int(round(seg / bridge)))
            for b in range(1, n):
                bx = x + seg * b / n
                box *= 1.0 - fill(np.abs(X - F(bx)) - 0.5)
            m = np.maximum(m, box)
            x += seg + gap
    return m


def running_bond(w, h, cols, rows, offset=0.5):
    """Brick / block courses: `rows` courses of `cols` units across the image, every other course shifted
    by `offset` of a unit. Joints sit on whole pixels (units differ by up to 1 px when w / cols or h / rows is
    fractional), and the layout wraps in both axes when rows is even. Returns (d, unit): the distance from
    each pixel centre to the nearest joint centreline (a 2 px joint is d < 1), and a unit id
    (0 .. rows*cols-1)."""
    X, Y = coords(w, h)
    yb = np.round(np.arange(rows + 1) * (h / rows))
    row = np.clip(np.searchsorted(yb, Y[:, 0], side='right') - 1, 0, rows - 1)
    dy = np.minimum(Y[:, 0] - yb[row], yb[row + 1] - Y[:, 0]).astype(F)
    xs = X[0]
    pitch = w / cols
    d = np.empty((h, w), F)
    unit = np.empty((h, w), np.int64)
    for r in range(rows):
        joints = np.round(np.arange(-1, cols + 2) * pitch + (r % 2) * offset * pitch)
        dist = np.abs(xs[:, None] - joints[None, :]).min(axis=1).astype(F)
        col = (np.searchsorted(joints, xs, side='right') - 2) % cols
        sel = row == r
        d[sel] = np.minimum(dist[None, :], dy[sel][:, None])
        unit[sel] = r * cols + col[None, :]
    return d, unit


def wood_grain(w, h, seed, salt='', period=6.0, warp=6.0, flame=2.5, knots=()):
    """Growth-ring mask for boards whose grain runs along x: 1 on the darker latewood lines, 0 between.
    The rings wander (warp px), bow in long flames, and bend around knots given as (x, y, rx, ry).
    Periodic along x (the knot influence wraps too), so a strip of it tiles along U."""
    X, Y = coords(w, h)
    r = rng(seed, 'grain', salt)
    yy = Y + F(warp) * (perlin(w, h, 3, 1, seed, f'grain/{salt}/a') + 0.4 * perlin(w, h, 7, 2, seed, f'grain/{salt}/b'))
    k = int(r.integers(1, 4))
    yy = yy + F(flame) * np.sin(F(2 * math.pi * k / w) * X + F(r.uniform(0, 2 * math.pi)))
    for kx, ky, rx, ry in knots:
        dx = wrap_delta(X - F(kx), w)
        dy = Y - F(ky)
        infl = np.exp(-(dx / F(rx * 2.6)) ** 2 - (dy / F(ry * 2.2)) ** 2)
        yy = yy + np.sign(dy) * infl * F(ry * 1.6)
    rings = 0.5 + 0.5 * np.sin(yy * F(2 * math.pi / period) + F(r.uniform(0, 2 * math.pi)))
    return smoothstep(0.55, 0.95, rings)


# ---------------------------------------------------------------------------------------------------------
# Stamps: shapes evaluated on a small window and folded into the canvas (wrapped or clipped per axis)

def _window(size, lo, hi, wrap):
    idx = np.arange(int(math.floor(lo)), int(math.ceil(hi)))
    if wrap:
        idx = idx[:size]
        return idx, idx % size
    idx = idx[(idx >= 0) & (idx < size)]
    return idx, idx


def stamp(canvas, box, fn, wrap=TILE, op=np.maximum):
    """Evaluates fn(X, Y) over the pixel window box = (x0, y0, x1, y1) (X, Y unwrapped pixel centres)
    and combines it into the (h, w) canvas in place with op (default max)."""
    h, w = canvas.shape[:2]
    xs, xi = _window(w, box[0], box[2], wrap[0])
    ys, yi = _window(h, box[1], box[3], wrap[1])
    if len(xs) == 0 or len(ys) == 0:
        return canvas
    X, Y = np.meshgrid(xs.astype(F) + F(0.5), ys.astype(F) + F(0.5))
    ix = np.ix_(yi, xi)
    canvas[ix] = op(canvas[ix], np.asarray(fn(X, Y), F))
    return canvas


def _area(w, h, area):
    return (0.0, 0.0, float(w), float(h)) if area is None else area


def speckle(w, h, seed, density, radius=(0.5, 0.9), strength=(0.5, 1.0), wrap=TILE, area=None, salt=''):
    """Sparse round dots (aggregate, pores, pits); density is the expected dots per pixel."""
    r = rng(seed, 'speckle', salt)
    x0, y0, x1, y1 = _area(w, h, area)
    count = int(round((x1 - x0) * (y1 - y0) * density))
    m = np.zeros((h, w), F)
    for _ in range(count):
        cx, cy = r.uniform(x0, x1), r.uniform(y0, y1)
        rad, s = r.uniform(*radius), r.uniform(*strength)
        stamp(m, (cx - rad - 1, cy - rad - 1, cx + rad + 1, cy + rad + 1),
              lambda X, Y, cx=cx, cy=cy, rad=rad, s=s: fill(sd_circle(X, Y, cx, cy, rad)) * F(s), wrap)
    return m


def blobs(w, h, seed, count, radius=(2.0, 5.0), rough=0.35, soft=1.0, strength=(1.0, 1.0), centres=None,
          wrap=TILE, area=None, kind='fill', salt=''):
    """Irregular round spots (paint chips, stains, rust): discs whose radius wobbles with the angle.
    kind='fill' gives the spot, kind='rim' only its edge (dried spill rings), kind='sdf' the raw distance
    minimum (for callers that build their own profile; strength is ignored)."""
    r = rng(seed, 'blobs', salt)
    x0, y0, x1, y1 = _area(w, h, area)
    m = np.full((h, w), 1e3 if kind == 'sdf' else 0.0, F)
    for i in range(count):
        if centres is not None:
            cx, cy = centres[i % len(centres)]
        else:
            cx, cy = r.uniform(x0, x1), r.uniform(y0, y1)
        rad = r.uniform(*radius)
        s = r.uniform(*strength)
        ph = r.uniform(0, 2 * math.pi, 3)
        amp = r.uniform(0.4, 1.0, 3) * np.array([1.0, 0.6, 0.25]) * rough / 1.4  # low harmonics: lumpy, not starry

        def fn(X, Y, cx=cx, cy=cy, rad=rad, s=s, ph=ph, amp=amp):
            a = np.arctan2(Y - cy, X - cx)
            rr = rad * (1.0 + amp[0] * np.sin(2 * a + ph[0]) + amp[1] * np.sin(3 * a + ph[1])
                        + amp[2] * np.sin(5 * a + ph[2]))
            sd = np.hypot(X - cx, Y - cy) - rr
            if kind == 'sdf':
                return sd
            if kind == 'rim':
                return np.exp(-(sd / F(soft)) ** 2) * F(s)
            return fill(sd, soft) * F(s)

        reach = rad * (1.0 + rough) + soft * 3 + 1
        stamp(m, (cx - reach, cy - reach, cx + reach, cy + reach), fn, wrap,
              op=np.minimum if kind == 'sdf' else np.maximum)
    return m


def streaks(w, h, seed, count, length=(20.0, 80.0), width=(1.0, 2.5), strength=(0.4, 1.0), sources=None,
            wobble=1.0, wrap=TILE, area=None, salt=''):
    """Vertical drips running down (+y) from their source and fading out (water, rust, grime).
    sources: optional list of (x, y) start points, used in turn; otherwise random inside area."""
    r = rng(seed, 'streaks', salt)
    x0, y0, x1, y1 = _area(w, h, area)
    m = np.zeros((h, w), F)
    for i in range(count):
        if sources is not None:
            sx, sy = sources[i % len(sources)]
        else:
            sx, sy = r.uniform(x0, x1), r.uniform(y0, y1)
        ln, wd, s = r.uniform(*length), r.uniform(*width), r.uniform(*strength)
        ph, fr = r.uniform(0, 2 * math.pi), r.uniform(0.05, 0.14)

        def fn(X, Y, sx=sx, sy=sy, ln=ln, wd=wd, s=s, ph=ph, fr=fr):
            t = np.clip((Y - sy) / F(ln), 0.0, 1.0)
            xo = sx + F(wobble) * np.sin(F(ph) + (Y - sy) * F(fr)) * t
            ww = F(wd) * (1.0 + 0.5 * t)
            across = np.exp(-((X - xo) / ww) ** 2)
            along = (1.0 - t) ** 1.4 * smoothstep(0.0, 2.0, Y - sy)
            return across * along * F(s) * (Y >= sy)

        reach = 3 * wd * 1.5 + wobble + 1
        stamp(m, (sx - reach, sy, sx + reach, sy + ln + 1), fn, wrap)
    return m


def scratches(w, h, seed, count, length=(4.0, 16.0), width=(0.8, 1.4), angle=(0.0, 180.0),
              strength=(0.3, 1.0), wrap=TILE, area=None, salt=''):
    """Short straight strokes with tapered ends (scratches, scuffs, cleat marks). angle in degrees,
    0 = along +x."""
    r = rng(seed, 'scratches', salt)
    x0, y0, x1, y1 = _area(w, h, area)
    m = np.zeros((h, w), F)
    for _ in range(count):
        cx, cy = r.uniform(x0, x1), r.uniform(y0, y1)
        ln, wd, s = r.uniform(*length), r.uniform(*width), r.uniform(*strength)
        a = math.radians(r.uniform(*angle))
        dx, dy = math.cos(a) * ln * 0.5, math.sin(a) * ln * 0.5

        def fn(X, Y, cx=cx, cy=cy, dx=dx, dy=dy, wd=wd, s=s):
            d, t = sd_segment(X, Y, cx - dx, cy - dy, cx + dx, cy + dy)
            taper = np.sqrt(np.clip(np.sin(t * math.pi), 0.0, 1.0))
            return fill(d - F(wd) * 0.5 * taper, 1.0) * F(s) * taper

        reach = abs(dx) + abs(dy) + wd + 2
        stamp(m, (cx - reach, cy - reach, cx + reach, cy + reach), fn, wrap)
    return m


def cracks(w, h, seed, count, steps=(6, 14), step=(4.0, 8.0), width=1.0, turn=0.45, branch=0.2,
           wrap=TILE, area=None, salt=''):
    """Meandering hairline cracks (random-walk polylines with the odd branch); 1 on the crack."""
    r = rng(seed, 'cracks', salt)
    x0, y0, x1, y1 = _area(w, h, area)
    m = np.zeros((h, w), F)

    def walk(px, py, ang, n, wd):
        for _ in range(n):
            ang += r.normal(0.0, turn)
            ln = r.uniform(*step)
            qx, qy = px + math.cos(ang) * ln, py + math.sin(ang) * ln

            def fn(X, Y, px=px, py=py, qx=qx, qy=qy, wd=wd):
                d, _ = sd_segment(X, Y, px, py, qx, qy)
                return fill(d - F(wd) * 0.5, 1.0)

            stamp(m, (min(px, qx) - 2, min(py, qy) - 2, max(px, qx) + 2, max(py, qy) + 2), fn, wrap)
            if r.random() < branch:
                walk(qx, qy, ang + r.choice([-1, 1]) * r.uniform(0.6, 1.2), max(2, n // 3), wd * 0.7)
            px, py = qx, qy

    for _ in range(count):
        walk(r.uniform(x0, x1), r.uniform(y0, y1), r.uniform(0, 2 * math.pi), int(r.integers(*steps)), width)
    return m


def grime(w, h, seed, cx, cy, coverage=0.3, soft=0.5, octaves=5, salt=''):
    """Blotchy mask from thresholded fBm covering about `coverage` of the image; soft (in noise standard
    deviations) sets how gradual the edges are."""
    n = fbm(w, h, cx, cy, seed, f'grime/{salt}', octaves=octaves)
    t = float(np.quantile(n, 1.0 - coverage))
    s = soft * float(n.std())
    return smoothstep(t - s, t + s, n)


def uniform_rank(a):
    """Remaps values to their rank in [0, 1] (a flat histogram), so thresholds read as area fractions."""
    order = np.argsort(a.ravel(), kind='stable')
    u = np.empty(a.size, F)
    u[order] = np.linspace(0.0, 1.0, a.size, dtype=F)
    return u.reshape(a.shape)


def edge_wear(sd, seed, w, h, cx, cy, depth=3.0, amount=0.5, octaves=2, salt=''):
    """Chips along a shape's outline (sd from the shape functions, negative inside): about `amount` of the
    outline is worn through, thinning out to nothing `depth` pixels in. Noise is periodic (cx, cy cells);
    cells of 12-20 px give chips that stay readable after mipmapping."""
    u = uniform_rank(fbm(w, h, cx, cy, seed, f'edgewear/{salt}', octaves=octaves))
    closeness = 1.0 - smoothstep(0.0, depth, -sd)
    t = 1.0 - F(amount) * closeness
    return smoothstep(t - 0.03, t + 0.03, u) * smoothstep(0.0, 0.15, closeness) * fill(sd)


# ---------------------------------------------------------------------------------------------------------
# Output and verification

def to_u8(img):
    return np.clip(np.asarray(img, np.float64) * 255.0 + 0.5, 0, 255).astype(np.uint8)


def save_rgb(path, img):
    Image.fromarray(to_u8(img), 'RGB').save(path)


def tile(img, nx, ny):
    return np.tile(img, (ny, nx, 1))


def downsample(img, f):
    """Box-filtered 1/f mip (both sides must divide by f)."""
    h, w = img.shape[:2]
    return img.reshape(h // f, f, w // f, f, -1).mean(axis=(1, 3))


def mip_strip(img, levels_=(1, 2, 4), zoom=True):
    """Mips side by side; with zoom each is blown back up to full size (nearest) so its pixels show."""
    h, w = img.shape[:2]
    parts = []
    for f in levels_:
        m = downsample(img, f) if f > 1 else img
        if zoom and f > 1:
            m = np.repeat(np.repeat(m, f, axis=0), f, axis=1)
        pad = np.zeros((h, w, 3), F)
        pad[:m.shape[0], :m.shape[1]] = m
        parts.append(pad)
        parts.append(np.full((h, 4, 3), 0.15, F))
    return np.concatenate(parts[:-1], axis=1)


def seam_stats(img, axis):
    """How the wrap-around step compares with ordinary neighbour steps, in 0-255 units.
    axis='x' checks the U seam (last column against the first), 'y' the V seam. Returns a dict with the
    wrap step, the median, 95th percentile and max of the interior steps, and pass = wrap <= p95."""
    a = to_u8(img).astype(np.float64)
    if axis == 'y':
        a = a.transpose(1, 0, 2)
    steps = np.abs(np.diff(a, axis=1)).mean(axis=(0, 2))
    wrap = float(np.abs(a[:, 0] - a[:, -1]).mean())
    p95 = float(np.percentile(steps, 95))
    return {'wrap': wrap, 'median': float(np.median(steps)), 'p95': p95, 'max': float(steps.max()),
            'pass': wrap <= p95}


def outline_regions(img, regions, scale=2):
    """Atlas preview: nearest-upscaled copy with each region's rectangle and name drawn on it.
    regions: {name: (x, y, w, h)}."""
    im = Image.fromarray(to_u8(img), 'RGB')
    im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    d = ImageDraw.Draw(im)
    for name, (x, y, w, h) in regions.items():
        box = (x * scale, y * scale, (x + w) * scale - 1, (y + h) * scale - 1)
        d.rectangle(box, outline=(255, 0, 255))
        tx, ty = box[0] + 4, box[1] + 3
        d.rectangle((tx - 2, ty - 1, tx + 7 * len(name) + 2, ty + 11), fill=(0, 0, 0))
        d.text((tx, ty), name, fill=(255, 255, 0))
    return im


def contact_sheet(items, max_width=1600, pad=8, bg=(40, 40, 40)):
    """Lays (label, PIL image) pairs out at their native pixel size (so texel scales compare), labels
    above, starting a new row when one would pass max_width."""
    lab_h = 14
    rows, row, x = [], [], pad
    for label, im in items:
        if row and x + im.width + pad > max_width:
            rows.append(row)
            row, x = [], pad
        row.append((label, im))
        x += im.width + pad
    rows.append(row)
    w = max(sum(im.width + pad for _, im in r) + pad for r in rows)
    h = sum(max(im.height for _, im in r) + lab_h + pad for r in rows) + pad
    sheet = Image.new('RGB', (w, h), bg)
    d = ImageDraw.Draw(sheet)
    y = pad
    for r in rows:
        x = pad
        for label, im in r:
            d.text((x, y - 2), label, fill=(230, 230, 230))
            sheet.paste(im.convert('RGB'), (x, y + lab_h))
            x += im.width + pad
        y += max(im.height for _, im in r) + lab_h + pad
    return sheet
