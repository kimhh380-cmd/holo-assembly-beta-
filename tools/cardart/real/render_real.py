"""사실적인 단열재 패널 렌더러 (numpy 레이 트레이싱)
곡면 패널(로켓 외피 조각)을 스튜디오 조명 아래 비스듬히 본 모습. 재질은 절차적 텍스처 + 범프 + GGX 반사.
사용: python3 render_real.py hex,pica,...   → out/<id>.png (512x512)
"""
import sys, numpy as np
from PIL import Image

f32 = np.float32
S = 1024            # 내부 렌더 해상도 (2배 슈퍼샘플)
R, A, HH, T = 2.0, 0.45, 0.9, 0.15   # 반지름, 반각, 반높이, 두께 (m)
CAM = np.array([3.55, 1.3, 2.75], f32); TGT = np.array([0.05, -0.02, -0.22], f32); FOV = np.radians(30)

def norm(v): return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)
def frac(x): return x - np.floor(x)
def smooth(t): return t * t * (3 - 2 * t)
def h2(ix, iy, s=0.0): return frac(np.sin(ix * 127.1 + iy * 311.7 + s * 74.7) * 43758.5453)
def vnoise(u, v, s=0.0):
    i, j = np.floor(u), np.floor(v); fu, fv = smooth(u - i), smooth(v - j)
    a, b, c, d = h2(i, j, s), h2(i + 1, j, s), h2(i, j + 1, s), h2(i + 1, j + 1, s)
    return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv
def fbm(u, v, s=0.0, o=5, g=0.5):
    tot, amp, f, n = 0, 1.0, 1.0, 0
    for k in range(o):
        tot = tot + amp * vnoise(u * f, v * f, s + k * 13.1); n += amp; amp *= g; f *= 2.03
    return tot / n
def worley(u, v, s=0.0):
    iu, iv = np.floor(u), np.floor(v); F1 = np.full(u.shape, 9.0, f32); F2 = np.full(u.shape, 9.0, f32); ID = np.zeros(u.shape, f32)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            cx, cy = iu + dx, iv + dy; px = cx + h2(cx, cy, s); py = cy + h2(cx, cy, s + 7.3)
            d = np.sqrt((px - u) ** 2 + (py - v) ** 2); m = d < F1
            F2 = np.where(m, F1, np.minimum(F2, d)); ID = np.where(m, h2(cx, cy, s + 3.1), ID); F1 = np.where(m, d, F1)
    return F1, F2, ID

# ---------------- 카메라·광선 ----------------
def camera_rays():
    fw = norm(TGT - CAM); rt = norm(np.cross(fw, np.array([0, 1, 0], f32))); up = np.cross(rt, fw)
    xs = (np.arange(S, dtype=f32) + 0.5) / S * 2 - 1; X, Y = np.meshgrid(xs, -xs); k = np.tan(FOV / 2)
    d = norm(fw[None, None] + X[..., None] * k * rt + Y[..., None] * k * up)
    return np.broadcast_to(CAM, d.shape).copy(), d

def intersect(o, d):
    """패널(바깥면·오른쪽 면·윗면)과 바닥. 반환: t, 면 번호(0 없음,1 바깥,2 오른쪽,3 위,4 바닥), 면 좌표"""
    oz = o[..., 2] + R; ox, oy = o[..., 0], o[..., 1]; dx, dy, dz = d[..., 0], d[..., 1], d[..., 2]
    t_best = np.full(ox.shape, np.inf, f32); face = np.zeros(ox.shape, np.int8)
    # 바깥 원통면
    a = dx * dx + dz * dz; b = 2 * (ox * dx + oz * dz); c = ox * ox + oz * oz - R * R; disc = b * b - 4 * a * c
    t1 = np.where(disc > 0, (-b - np.sqrt(np.maximum(disc, 0))) / (2 * a + 1e-9), np.inf)
    px, py, pz = ox + t1 * dx, oy + t1 * dy, oz + t1 * dz; th = np.arctan2(px, pz)
    m = (t1 > 1e-4) & (np.abs(th) <= A) & (np.abs(py) <= HH); t_best = np.where(m, t1, t_best); face[m] = 1
    # 오른쪽 면 (θ = A)
    n = np.array([np.cos(A), 0, -np.sin(A)], f32); den = dx * n[0] + dz * n[2]
    t2 = -(ox * n[0] + oz * n[2]) / np.where(np.abs(den) < 1e-9, 1e-9, den)
    px, py, pz = ox + t2 * dx, oy + t2 * dy, oz + t2 * dz; r = px * np.sin(A) + pz * np.cos(A)
    m = (t2 > 1e-4) & (t2 < t_best) & (r >= R - T) & (r <= R) & (np.abs(py) <= HH); t_best = np.where(m, t2, t_best); face[m] = 2
    # 윗면 (y = HH)
    t3 = (HH - oy) / np.where(np.abs(dy) < 1e-9, 1e-9, dy); px, pz = ox + t3 * dx, oz + t3 * dz; r = np.sqrt(px * px + pz * pz); th = np.arctan2(px, pz)
    m = (t3 > 1e-4) & (t3 < t_best) & (r >= R - T) & (r <= R) & (np.abs(th) <= A); t_best = np.where(m, t3, t_best); face[m] = 3
    return t_best, face

def floor_hit(o, d):
    t = (-HH - o[..., 1]) / np.where(np.abs(d[..., 1]) < 1e-9, -1e-9, d[..., 1])
    return np.where(t > 0, t, np.inf)

# ---------------- 조명 ----------------
LK = norm(np.array([-0.55, 0.75, 0.62], f32)); LF = norm(np.array([0.9, 0.25, 0.45], f32)); LR = norm(np.array([0.35, 0.55, -0.85], f32))
CK, CF, CR = np.array([2.3, 2.2, 2.05], f32), np.array([0.55, 0.65, 0.8], f32), np.array([1.4, 1.5, 1.7], f32)
def env(rd, rough):
    """스튜디오 환경: 위 왼쪽 큰 소프트박스, 오른쪽 세로 스트립, 어두운 바닥"""
    y = rd[..., 1]; xz = np.arctan2(rd[..., 0], rd[..., 2]); w = 0.08 + rough * 0.6
    box = np.exp(-((y - 0.55) / (0.28 + w)) ** 2 - ((xz + 0.9) / (0.55 + w)) ** 2) * 3.2
    strip = np.exp(-((xz - 1.15) / (0.08 + w * 0.8)) ** 2) * np.clip(1 - np.abs(y - 0.25) * 1.6, 0, 1) * 2.2
    base = 0.12 + 0.22 * np.clip(y + 0.2, 0, 1)
    v = (base + box + strip) / (1 + rough * 3)
    return v[..., None] * np.array([1.0, 0.98, 0.95], f32)

def ggx(n, v, l, rough, F0):
    h = norm(v + l); nh = np.clip((n * h).sum(-1), 0, 1); nl = np.clip((n * l).sum(-1), 0, 1); nv = np.clip((n * v).sum(-1), 1e-3, 1); vh = np.clip((v * h).sum(-1), 0, 1)
    a2 = np.maximum(rough, 0.03) ** 4; D = a2 / (np.pi * (nh * nh * (a2 - 1) + 1) ** 2); k = (rough + 1) ** 2 / 8
    G = nl / (nl * (1 - k) + k) * nv / (nv * (1 - k) + k); F = F0 + (1 - F0) * ((1 - vh) ** 5)[..., None]
    return (D * G / (4 * nv * np.maximum(nl, 1e-3)))[..., None] * F * nl[..., None]

# ---------------- 재질 ----------------
# 각 재질 함수: (u, v, face, depth) → albedo(…,3), height(…), rough(…), metal(…), ao 보정
def layer_side(dep, layers):
    """두께 단면: [(두께m, 색)] 바깥부터"""
    col = np.zeros(dep.shape + (3,), f32); rough = np.full(dep.shape, 0.8, f32); acc = 0.0
    for k, (th, c, rg) in enumerate(layers):
        hi = acc + th if k < len(layers) - 1 else 9.0
        m = (dep >= acc) & (dep < hi); col[m] = c; rough[m] = rg; acc += th
    return col, rough
STEEL = (np.array([0.55, 0.56, 0.58], f32), 0.35)

def mat_hex(u, v, face, dep):
    s = 0.105; q = (np.sqrt(3) / 3 * u - v / 3) / s; r = (2 / 3 * v) / s
    x_, z_ = q, r; y_ = -x_ - z_; rx, ry, rz = np.round(x_), np.round(y_), np.round(z_)
    dx_, dy_, dz_ = np.abs(rx - x_), np.abs(ry - y_), np.abs(rz - z_)
    c1 = (dx_ > dy_) & (dx_ > dz_); c2 = (~c1) & (dy_ > dz_)
    rx = np.where(c1, -ry - rz, rx); rz = np.where(c2 | c1, rz, -rx - ry)
    cxp = s * np.sqrt(3) * (rx + rz / 2); cyp = s * 1.5 * rz; lx, ly = np.abs(u - cxp), np.abs(v - cyp)
    k = np.maximum(lx, 0.5 * lx + 0.866 * ly); edge = s * 0.866 - k
    tid = h2(rx, rz, 3.0); gap = 0.0035
    tile = np.clip(edge / gap - 0.6, 0, 1); bevel = np.clip(edge / 0.012, 0, 1)
    micro = fbm(u * 160, v * 160, 2, 3)
    alb = np.stack([0.010 + 0.007 * tid + 0.006 * micro] * 3, -1); alb[..., 2] += 0.003
    gapcol = np.array([0.30, 0.29, 0.27], f32)
    alb = alb * tile[..., None] + gapcol * (1 - tile[..., None]) * 0.25
    hgt = 0.004 * np.sqrt(bevel) + 0.0003 * micro - 0.002 * (1 - tile)
    rough = 0.22 + 0.10 * tid + 0.10 * micro; rough = np.where(tile > 0.5, rough, 0.9)
    if face != 1:
        col, rg = layer_side(dep, [(0.004, (0.02, 0.02, 0.025), 0.2), (0.068, (0.88, 0.88, 0.85), 0.9), (0.016, (0.42, 0.42, 0.40), 0.95), (0.012, *STEEL)])
        return col, 0.001 * fbm(u * 200, v * 200, 5, 3), rg, np.where(dep > 0.088, 1.0, 0.0)
    return alb, hgt, rough, 0.0

def mat_pica(u, v, face, dep):
    bs = 0.30; fu, fv = frac(u / bs), frac(v / bs); gx = np.minimum(fu, 1 - fu) * bs; gy = np.minimum(fv, 1 - fv) * bs; g = np.minimum(gx, gy)
    gap = np.clip((g - 0.003) / 0.002, 0, 1); bid = h2(np.floor(u / bs), np.floor(v / bs), 5)
    por = fbm(u * 260, v * 260, 7, 4); fib = fbm(u * 60, v * 400, 9, 3)
    charB = (v + 0.25 * fbm(u * 3, v * 3, 11) - 0.05) * 2.2; char = np.clip(charB, 0, 1)
    F1, F2, _ = worley(u * 9, v * 9, 4); crack = np.clip(1 - (F2 - F1) / 0.05, 0, 1) * char
    virgin = np.array([0.20, 0.125, 0.07], f32) * (0.75 + 0.5 * por[..., None]) * (0.9 + 0.2 * bid[..., None])
    charred = np.array([0.035, 0.03, 0.028], f32) * (0.7 + 0.6 * por[..., None])
    alb = virgin * (1 - char[..., None]) + charred * char[..., None]; alb = alb * (1 - 0.7 * crack[..., None])
    alb = alb * gap[..., None] + np.array([0.33, 0.33, 0.32], f32) * (1 - gap[..., None])
    hgt = 0.0012 * por + 0.0006 * fib - 0.0015 * crack - 0.003 * (1 - gap) - 0.0015 * char * fbm(u * 20, v * 20, 13)
    rough = 0.9 - 0.15 * fib * (1 - char)
    if face != 1:
        col, rg = layer_side(dep, [(0.012, (0.04, 0.035, 0.03), 0.95), (0.07, (0.24, 0.15, 0.085), 0.9), (0.006, (0.5, 0.5, 0.48), 0.9), (0.012, *STEEL)])
        return col * (0.8 + 0.4 * fbm(u * 300, dep * 300, 1, 3))[..., None], 0.0008 * fbm(u * 200, dep * 200, 3, 3), rg, np.where(dep > 0.088, 1.0, 0.0)
    return alb, hgt, rough, 0.0

def mat_cork(u, v, face, dep):
    F1, F2, gid = worley(u * 170, v * 170, 2); edge = np.clip((F2 - F1) / 0.18, 0, 1)
    base = np.array([0.50, 0.33, 0.18], f32) * (0.6 + 0.65 * gid[..., None]) * (0.55 + 0.45 * edge[..., None])
    stain = fbm(u * 4, v * 4, 8, 4); base = base * (0.85 + 0.3 * stain[..., None])
    hgt = 0.0012 * edge * (0.5 + gid) + 0.0005 * stain; rough = 0.75 + 0.15 * (1 - edge)
    if face != 1:
        col, rg = layer_side(dep, [(0.03, (0.45, 0.30, 0.17), 0.85), (0.004, (0.25, 0.25, 0.24), 0.9), (0.066, (0.72, 0.73, 0.75), 0.3)])
        F1s, F2s, g2 = worley(u * 170, dep * 170, 5); col = np.where((dep < 0.03)[..., None], col * (0.6 + 0.6 * g2[..., None]), col)
        return col, 0.0008 * g2 * (dep < 0.03), rg, np.where(dep > 0.034, 1.0, 0.0)
    return base, hgt, rough, 0.0

def mat_blanket(u, v, face, dep):
    q = 0.11; fu, fv = frac(u / q), frac(v / q); pil = np.sin(fu * np.pi) * np.sin(fv * np.pi)
    stitch = np.clip(1 - np.minimum(np.minimum(fu, 1 - fu), np.minimum(fv, 1 - fv)) * q / 0.0025, 0, 1)
    dash = (frac((u + v) / 0.012) > 0.45).astype(f32); thread = stitch * dash
    weave = 0.5 + 0.25 * np.sin(u * 2 * np.pi / 0.0025) * np.sin(v * 2 * np.pi / 0.0025); dirt = fbm(u * 6, v * 6, 21, 4)
    alb = np.array([0.86, 0.85, 0.81], f32) * (0.8 + 0.2 * weave[..., None]) * (0.85 + 0.2 * dirt[..., None]) * (1 - 0.12 * stitch[..., None])
    alb = alb * (1 - thread[..., None]) + np.array([0.75, 0.72, 0.62], f32) * thread[..., None]
    hgt = 0.012 * pil ** 0.7 + 0.00015 * weave - 0.001 * stitch; rough = 0.85 - 0.1 * weave
    if face != 1:
        col, rg = layer_side(dep, [(0.002, (0.86, 0.85, 0.81), 0.9), (0.03, (0.93, 0.92, 0.88), 0.95), (0.002, (0.86, 0.85, 0.81), 0.9), (0.066, *STEEL)])
        return col * (0.85 + 0.25 * fbm(u * 400, dep * 400, 4, 3))[..., None], 0.0006 * fbm(u * 300, dep * 300, 6, 3), rg, np.where(dep > 0.034, 1.0, 0.0)
    return alb, hgt, rough, 0.0

def mat_foam(u, v, face, dep):
    F1, F2, gid = worley(u * 26, v * 26, 31); pop = 1 - np.clip(F1 / 0.75, 0, 1)
    F1b, _, _ = worley(u * 70, v * 70, 33); pop2 = 1 - np.clip(F1b / 0.75, 0, 1)
    swirl = fbm(u * 3 + 0.5 * fbm(u * 2, v * 2, 3), v * 3, 35, 5); burn = fbm(u * 1.5, v * 1.5, 37, 3)
    alb = np.array([0.80, 0.40, 0.13], f32) * (0.75 + 0.35 * swirl[..., None]) * (0.85 + 0.2 * pop[..., None])
    alb = alb * (1 - 0.35 * burn[..., None] * np.array([0.6, 0.9, 1.0], f32))
    hgt = 0.006 * pop ** 1.5 + 0.0018 * pop2 + 0.002 * swirl; rough = 0.72 - 0.15 * pop
    if face != 1:
        col, rg = layer_side(dep, [(0.035, (0.82, 0.48, 0.18), 0.85), (0.065, (0.72, 0.73, 0.75), 0.3)])
        pores = worley(u * 300, dep * 300, 39)[0]; col = np.where((dep < 0.035)[..., None], col * (0.75 + 0.5 * np.clip(pores, 0, 1))[..., None], col)
        return col, 0.0005 * pores * (dep < 0.035), rg, np.where(dep >= 0.035, 1.0, 0.0)
    return alb, hgt, rough, 0.0

def mat_mli(u, v, face, dep):
    # 큰 주름(접힌 면) + 날카로운 접힘선 + 아주 매끈한 금박
    fold = fbm(u * 3.2, v * 2.4, 41, 4); crease = 1 - np.abs(2 * fbm(u * 6.5 + 2 * fold, v * 5, 43, 3) - 1)
    cr = fold * 0.7 + 0.3 * crease ** 3; ridge = crease ** 6
    seam = np.abs(frac(u / 0.6 + 0.5) - 0.5) * 0.6; tape = np.clip(1 - (seam - 0.018) / 0.002, 0, 1)
    sew = np.abs(frac(v / 0.006) - 0.5) < 0.18; stitchline = (np.abs(seam - 0.024) < 0.0012) & sew
    gold = np.array([1.0, 0.76, 0.33], f32); silver = np.array([0.86, 0.87, 0.88], f32)
    alb = gold * (1 - tape[..., None]) + silver * tape[..., None]; alb = np.where(stitchline[..., None], np.array([0.3, 0.3, 0.3], f32), alb)
    hgt = (0.010 * cr + 0.0018 * ridge) * (1 - tape) + 0.0006 * tape; rough = 0.07 + 0.06 * ridge * (1 - tape) + 0.12 * tape
    metal = np.where(stitchline, 0.0, 1.0)
    if face != 1:
        n_l = 18; li = np.floor(dep / 0.0022); within = frac(dep / 0.0022)
        col = np.where((li < n_l)[..., None], np.where((within < 0.45)[..., None], gold * 0.9, np.array([0.12, 0.1, 0.08], f32)), STEEL[0])
        met = np.where((li < n_l) & (within < 0.45), 1.0, np.where(li < n_l, 0.0, 1.0)); rg = np.where(li < n_l, 0.3, 0.35)
        return col, 0.0004 * np.sin(u * 300 + li), rg, met
    return alb, hgt, rough, metal

def mat_rcc(u, v, face, dep):
    p = 0.012; iu, iv = np.floor(u / p), np.floor(v / p); fu, fv = frac(u / p), frac(v / p); horiz = ((iu + iv) % 2) == 0
    tow = np.where(horiz, np.sin(fv * np.pi), np.sin(fu * np.pi)); fil = np.where(horiz, np.sin(fv * np.pi * 9), np.sin(fu * np.pi * 9)) ** 2
    F1, F2, _ = worley(u * 14, v * 14, 51); craze = np.clip(1 - (F2 - F1) / 0.03, 0, 1)
    mott = fbm(u * 5, v * 5, 53, 5)
    alb = np.array([0.20, 0.21, 0.23], f32) * (0.7 + 0.35 * tow[..., None] + 0.1 * fil[..., None]) * (0.8 + 0.35 * mott[..., None]) * (1 - 0.55 * craze[..., None])
    alb = alb + np.array([0.04, 0.05, 0.07], f32) * np.clip(mott - 0.55, 0, 1)[..., None] * 3
    hgt = 0.0009 * tow + 0.00015 * fil - 0.0006 * craze; rough = 0.5 + 0.2 * (1 - tow) + 0.2 * craze
    if face != 1:
        col, rg = layer_side(dep, [(0.002, (0.5, 0.53, 0.56), 0.6), (0.010, (0.11, 0.11, 0.12), 0.7), (0.002, (0.5, 0.53, 0.56), 0.6), (0.086, (0.05, 0.05, 0.055), 0.95)])
        lam = np.sin(dep * 2 * np.pi / 0.0015) * (dep < 0.012); col = col * (0.85 + 0.15 * lam)[..., None]
        return col, 0.0002 * lam, rg, 0.0
    return alb, hgt, rough, 0.0

MATS = dict(hex=mat_hex, pica=mat_pica, cork=mat_cork, blanket=mat_blanket, foam=mat_foam, mli=mat_mli, rcc=mat_rcc)

def surf_coords(P, face):
    """면 좌표: 바깥면 (u=호 길이, v=높이), 옆·윗면 (u=모서리 따라, dep=바깥에서 깊이). 법선 N, 접선 Tu(u 방향), Tv(v 또는 깊이 방향)"""
    px, py, pz = P[..., 0], P[..., 1], P[..., 2] + R; th = np.arctan2(px, pz); r = np.sqrt(px * px + pz * pz)
    N = np.zeros(P.shape, f32); Tu = np.zeros(P.shape, f32); Tv = np.zeros(P.shape, f32); z = np.zeros_like(px)
    if face == 1:
        N[..., 0], N[..., 2] = np.sin(th), np.cos(th); Tu[..., 0], Tu[..., 2] = np.cos(th), -np.sin(th); Tv[..., 1] = 1
        return R * th, py, z, N, Tu, Tv
    if face == 2:
        N[...] = [np.cos(A), 0, -np.sin(A)]; Tu[..., 1] = 1; Tv[...] = [-np.sin(A), 0, -np.cos(A)]
        return py, z, R - r, N, Tu, Tv
    N[..., 1] = 1; Tu[..., 0], Tu[..., 2] = np.cos(th), -np.sin(th); Tv[..., 0], Tv[..., 2] = -np.sin(th), -np.cos(th)
    return R * th, z, R - r, N, Tu, Tv

def shade_face(mat, P, face, V):
    u, v, dep, N, Tu, Tv = surf_coords(P, face)
    alb, hgt, rough, metal = mat(u, v, face, dep)
    e = 0.0005
    hu = mat(u + e, v, face, dep)[1]
    hv = mat(u, v + e, face, dep)[1] if face == 1 else mat(u, v, face, dep + e)[1]
    hgt = np.broadcast_to(np.asarray(hgt, f32), u.shape)
    dhu = (np.broadcast_to(np.asarray(hu, f32), u.shape) - hgt) / e; dhv = (np.broadcast_to(np.asarray(hv, f32), u.shape) - hgt) / e
    if face != 1: dhv = -dhv
    n = norm(N - dhu[..., None] * Tu - dhv[..., None] * Tv)
    rough = np.broadcast_to(np.asarray(rough, f32), u.shape); metal = np.broadcast_to(np.asarray(metal, f32), u.shape)
    alb = np.clip(np.broadcast_to(np.asarray(alb, f32), u.shape + (3,)), 0, 1) ** 2.2
    cav = np.clip(1 + (hgt - hgt.mean()) * 70, 0.5, 1.15)
    F0 = 0.04 * (1 - metal[..., None]) + alb * metal[..., None]; diffc = alb * (1 - metal[..., None])
    col = np.zeros(u.shape + (3,), f32)
    for Ld, Lc in ((LK, CK), (LF, CF), (LR, CR)):
        nl = np.clip((n * Ld).sum(-1), 0, 1)[..., None]
        col += Lc * (diffc * nl * 0.9 + ggx(n, V, np.broadcast_to(Ld, n.shape), rough, F0))
    rd = norm(2 * (n * V).sum(-1, keepdims=True) * n - V)
    nv = np.clip((n * V).sum(-1), 0, 1)[..., None]; Fr = F0 + (1 - F0) * (1 - nv) ** 5
    col += env(rd, rough) * Fr * (1 - rough[..., None] * 0.6)
    col += diffc * (0.06 + 0.06 * np.clip(n[..., 1], 0, 1)[..., None])
    return col * cav[..., None]

def render(mid):
    o, d = camera_rays(); t, face = intersect(o, d); tf = floor_hit(o, d)
    img = np.zeros((S, S, 3), f32)
    # 배경: 스튜디오 무한 배경 (위는 짙은 남색, 아래로 갈수록 바닥과 이어짐)
    yy = np.linspace(1, 0, S, dtype=f32)[:, None]; img[...] = (np.array([0.018, 0.028, 0.045], f32) * (0.6 + 0.8 * yy[..., None]))
    # 바닥
    fm = (face == 0) & np.isfinite(tf); Pf = o + d * tf[..., None]
    # 배경 스포트: 패널 뒤를 은은하게 밝혀 어두운 재질이 배경과 구분되게
    X0, Y0 = np.meshgrid(np.linspace(-1, 1, S), np.linspace(-1, 1, S)); spot = np.exp(-((X0 + 0.05) ** 2 / 0.35 + (Y0 + 0.05) ** 2 / 0.45)).astype(f32)
    img = img + (np.array([0.05, 0.075, 0.11], f32) * spot[..., None])
    if fm.any():
        dist = np.sqrt(Pf[..., 0] ** 2 + (Pf[..., 2] + 0.3) ** 2); floorc = np.array([0.035, 0.042, 0.055], f32) * (1.6 / (1 + 0.3 * dist ** 2))[..., None]
        sh = np.zeros(fm.shape, f32); rng = np.random.default_rng(3); K = 6
        for k in range(K):
            Lj = norm(LK + rng.normal(0, 0.12, 3).astype(f32)); so = Pf + Lj * 1e-3; ts, fs = intersect(so, np.broadcast_to(Lj, so.shape).copy()); sh += (fs > 0)
        sh /= K
        # 패널 밑동과의 거리 → 접촉 그림자
        px, pz = Pf[..., 0], Pf[..., 2] + R; th = np.clip(np.arctan2(px, pz), -A, A); r = np.sqrt(px * px + pz * pz)
        rr = np.clip(r, R - T, R); qx, qz = rr * np.sin(th), rr * np.cos(th); cd = np.sqrt((px - qx) ** 2 + (pz - qz) ** 2)
        ao = 1 - 0.8 * np.exp(-cd / 0.12)
        floorc = floorc * ((0.35 + 0.65 * (1 - sh)) * ao)[..., None]
        img = np.where(fm[..., None], floorc + img * 0.15, img)
    V = -d
    for fid in (1, 2, 3):
        m = face == fid
        if not m.any(): continue
        P = (o + d * t[..., None])[m]; col = shade_face(MATS[mid], P, fid, V[m]); img[m] = col
    # 비네트, 톤매핑(ACES), 감마
    X, Y = np.meshgrid(np.linspace(-1, 1, S), np.linspace(-1, 1, S)); vig = 1 - 0.28 * (X ** 2 + Y ** 2)
    img = img * vig[..., None].astype(f32) * 1.0
    a, b, c, d2, e = 2.51, 0.03, 2.43, 0.59, 0.14; img = np.clip((img * (a * img + b)) / (img * (c * img + d2) + e), 0, 1)
    img = img ** (1 / 2.2)
    rng = np.random.default_rng(1); img = np.clip(img + rng.normal(0, 0.006, img.shape), 0, 1)
    im = Image.fromarray((img * 255).astype(np.uint8)).resize((512, 512), Image.LANCZOS)
    im.save(f'out/{mid}.png')

if __name__ == '__main__':
    import os; os.makedirs('out', exist_ok=True)
    for m in sys.argv[1].split(','): render(m); print('done', m, flush=True)
