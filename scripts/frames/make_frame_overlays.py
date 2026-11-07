"""Turn Canva template exports (opaque; a sky/cloud/hill placeholder fills the photo window)
into transparent overlay PNGs plus the photo window rect of each template.

Every template uses the same placeholder picture, scaled to cover its window. We rebuild a
clean copy of that picture (per-pixel median over templates), align it to each template,
and make the pixels that match it transparent. Decorations drawn over the window stay.

Usage (repo root): python scripts/frames/make_frame_overlays.py <src_dir> <out_dir> <preview_dir>
Writes <out_dir>/<name>.png (RGBA) and frames.json (photo window per template). The slow
alignment step is cached in <out_dir>/align_params.json; delete it after changing templates.
See web/public/frames/README.md.
"""
import glob
import json
import os
import sys

import cv2
import numpy as np

src, out, prev = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
os.makedirs(prev, exist_ok=True)


def load(name):
    return cv2.imdecode(np.fromfile(os.path.join(src, f"{name}.png"), np.uint8), cv2.IMREAD_COLOR)


names = sorted((os.path.basename(p)[:-4] for p in glob.glob(os.path.join(src, "*.png"))), key=int)
imgs = {n: load(n) for n in names}
H, W = imgs[names[0]].shape[:2]

# Window of 1.png = reference size of the placeholder (scale 1)
PX, PY, PW, PH = 74, 69, 932, 1021
P = imgs["1"][PY:PY + PH, PX:PX + PW].copy()
cloud_box = (230, 60, 690, 310)  # x0, y0, x1, y1 inside P


def match_cloud(im, P):
    x0, y0, x1, y1 = cloud_box
    patch = P[y0:y1, x0:x1]
    best = None
    for s in np.linspace(0.96, 1.08, 25):
        c = cv2.resize(patch, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        r = cv2.matchTemplate(im, c, cv2.TM_CCOEFF_NORMED)
        _, mx, _, loc = cv2.minMaxLoc(r)
        if best is None or mx > best[0]:
            best = (mx, s, loc[0] - x0 * s, loc[1] - y0 * s)
    return best


def warp(P, s, ox, oy):
    M = np.float32([[s, 0, ox], [0, s, oy]])
    w = cv2.warpAffine(P, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    cov = cv2.warpAffine(np.full(P.shape[:2], 255, np.uint8), M, (W, H), flags=cv2.INTER_NEAREST)
    return w, cov


def inliers(im, P, s, ox, oy):
    w, cov = warp(P, s, ox, oy)
    d = np.abs(im.astype(int) - w.astype(int)).max(axis=2)
    return ((d < 16) & (cov > 0)).sum()


def refine(im, P, s, ox, oy):
    best = (inliers(im, P, s, ox, oy), s, ox, oy)
    for step_s, step_xy in ((0.004, 2.0), (0.002, 1.0), (0.001, 0.5)):
        improved = True
        while improved:
            improved = False
            _, s0, x0, y0 = best
            for ds in (-step_s, 0, step_s):
                for dx in (-step_xy, 0, step_xy):
                    for dy in (-step_xy, 0, step_xy):
                        cand = (s0 + ds, x0 + dx, y0 + dy)
                        v = inliers(im, P, *cand)
                        if v > best[0]:
                            best = (v, *cand)
                            improved = True
    return best[1:]


def align_all(P):
    params = {}
    for n in names:
        score, s, ox, oy = match_cloud(imgs[n], P)
        if score < 0.9:
            # cloud hidden by decorations: assume the window is 932 wide at x=74, same top as the
            # sky, and the placeholder covers it -> scale from the window height
            sky_top = int(np.argmax((np.abs(imgs[n][:, 540].astype(int) - P[5, 466].astype(int)).max(axis=1) < 12)))
            s = 1.046
            ox, oy = 74 - (PW * s - 932) / 2, sky_top
        params[n] = refine(imgs[n], P, s, ox, oy)
        print(n, "cloud=%.3f" % score, "-> s=%.4f ox=%.1f oy=%.1f" % params[n])
    return params


cache = os.path.join(out, "align_params.json")
params = json.load(open(cache)) if os.path.exists(cache) else None
if params is None:
    params = align_all(P)

# Clean placeholder: median over templates aligned at scale ~1
stack = []
for n, (s, ox, oy) in params.items():
    M = np.float32([[1 / s, 0, -ox / s], [0, 1 / s, -oy / s]])
    stack.append(cv2.warpAffine(imgs[n], M, (PW, PH), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE))
P = np.median(np.stack(stack), axis=0).astype(np.uint8)


def repair(P):
    """Remove decorations that several templates share (bottom-right, top corners) from P.
    The placeholder is simple: a vertical sky gradient, a cloud and two flat green hills."""
    P = P.copy()
    ref = imgs["1"][PY:PY + PH, PX:PX + PW]
    dark = np.median(ref[880:930, 100:700].reshape(-1, 3), axis=0)
    is_dark = np.abs(ref.astype(int) - dark).max(axis=2) < 12
    for x in range(PW):
        rows = np.where(is_dark[600:, x])[0]
        if len(rows):
            P[600 + rows[0] + 3:, x] = dark
    for y in range(0, 220):
        sky = np.median(np.concatenate([P[y, 140:220], P[y, 720:800]]), axis=0)
        P[y, :140] = sky
        P[y, 800:] = sky
    return P


P = repair(P)
cv2.imwrite(os.path.join(prev, "placeholder_clean.png"), P)
if not os.path.exists(cache):
    params = align_all(P)
    json.dump(params, open(cache, "w"), indent=2)

meta = {}
for n in names:
    im = imgs[n]
    s, ox, oy = params[n]
    w, cov = warp(P, s, ox, oy)
    cov = cv2.erode(cov, np.ones((3, 3), np.uint8))
    # The placeholder can be wider than the window (cover-fit); clip to the sky's columns
    sky = cv2.inRange(cv2.cvtColor(im, cv2.COLOR_BGR2HSV), (90, 8, 200), (110, 120, 255))
    k, lab, st, _ = cv2.connectedComponentsWithStats(sky, 8)
    sx, _, sw, _, _ = st[1 + int(np.argmax(st[1:, 4]))]
    cov[:, : max(0, sx - 1)] = 0
    cov[:, sx + sw + 1 :] = 0
    d = np.abs(im.astype(int) - w.astype(int)).max(axis=2)
    # Edges of the cloud / hills: alignment is never perfect there, so allow a larger difference
    grad = cv2.morphologyEx(cv2.cvtColor(w, cv2.COLOR_BGR2GRAY), cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    edge = cv2.dilate((grad > 10).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    placeholder = ((d < np.where(edge, 70, 22)) & (cov > 0)).astype(np.uint8)
    # the window is one connected area; ignore look-alike pixels elsewhere
    # (also keep bits seen through gaps in decorations, e.g. between gear teeth, inside its box)
    k, lab, st, _ = cv2.connectedComponentsWithStats(placeholder, 8)
    bx, by, bw, bh, _ = st[1 + int(np.argmax(st[1:, 4]))]
    box = np.zeros_like(placeholder)
    box[by:by + bh, bx:bx + bw] = 1
    main = (lab == 1 + int(np.argmax(st[1:, 4]))).astype(np.uint8)
    # detached bits must match strictly (no edge tolerance), or skin/white details would vanish
    strict = ((d < 22) & ~edge & (cov > 0)).astype(np.uint8) & box
    placeholder = main | strict
    inside = cv2.morphologyEx(placeholder, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))

    opaque = np.where(placeholder > 0, 0, 255).astype(np.uint8)
    # Residue = small blobs that sit on cloud/hill edges. Decorations (text, pixel art) are kept.
    k, lab, st, _ = cv2.connectedComponentsWithStats(((opaque > 0) & (inside > 0)).astype(np.uint8), 8)
    for i in range(1, k):
        blob = lab == i
        if st[i, 4] < 60 or (st[i, 4] < 3000 and edge[blob].mean() > 0.6):
            opaque[blob] = 0
    alpha = cv2.GaussianBlur(opaque, (3, 3), 0)

    cv2.imencode(".png", np.dstack([im, alpha]))[1].tofile(os.path.join(out, f"{n}.png"))
    ys, xs = np.where(alpha < 128)
    meta[n] = dict(x=int(xs.min()), y=int(ys.min()), w=int(xs.max() - xs.min() + 1), h=int(ys.max() - ys.min() + 1))
    print(n, meta[n])

    bg = np.zeros_like(im)
    bg[:] = (255, 0, 255)
    a = alpha[..., None] / 255.0
    cv2.imwrite(os.path.join(prev, f"prev_{n}.png"), (im * a + bg * (1 - a)).astype(np.uint8))

json.dump(meta, open(os.path.join(out, "frames.json"), "w"), indent=2)
