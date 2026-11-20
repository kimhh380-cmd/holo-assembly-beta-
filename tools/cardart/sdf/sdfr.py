"""부품 카드 그림 렌더러 — numpy SDF 레이마칭.
같은 장면을 두 셰이더로: real(스튜디오 사진 같은 PBR) / holo(Grok 엔진 그림 같은 청록 홀로그램).
"""
import numpy as np
from PIL import Image, ImageFilter
f32 = np.float32

# ---------- 수학 ----------
def norm(v): return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)
def frac(x): return x - np.floor(x)
def sm(t): return t * t * (3 - 2 * t)
def h2(ix, iy, s=0.0): return frac(np.sin(ix * 127.1 + iy * 311.7 + s * 74.7) * 43758.5453)
def vnoise(u, v, s=0.0):
    i, j = np.floor(u), np.floor(v); fu, fv = sm(u - i), sm(v - j)
    a, b, c, d = h2(i, j, s), h2(i + 1, j, s), h2(i, j + 1, s), h2(i + 1, j + 1, s)
    return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv
def fbm(u, v, s=0.0, o=4):
    t, a, f, n = 0, 1.0, 1.0, 0
    for k in range(o): t = t + a * vnoise(u * f, v * f, s + k * 13.1); n += a; a *= 0.5; f *= 2.03
    return t / n
def worley(u, v, s=0.0):
    iu, iv = np.floor(u), np.floor(v); F1 = np.full(u.shape, 9.0, f32); F2 = np.full(u.shape, 9.0, f32); ID = np.zeros(u.shape, f32)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            cx, cy = iu + dx, iv + dy; px = cx + h2(cx, cy, s); py = cy + h2(cx, cy, s + 7.3)
            d = np.sqrt((px - u) ** 2 + (py - v) ** 2); m = d < F1
            F2 = np.where(m, F1, np.minimum(F2, d)); ID = np.where(m, h2(cx, cy, s + 3.1), ID); F1 = np.where(m, d, F1)
    return F1, F2, ID
def rot_y(a): c, s = np.cos(a), np.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], f32)
def rot_x(a): c, s = np.cos(a), np.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], f32)
def rot_z(a): c, s = np.cos(a), np.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], f32)

# ---------- 기본형 SDF (p: (N,3)) ----------
def poly2d(qx, qy, V):
    V = np.asarray(V, f32); M = len(V); d = np.full(qx.shape, 1e9, f32); s = np.ones(qx.shape, f32)
    for i in range(M):
        a, b = V[i], V[(i + 1) % M]; ex, ey = b[0] - a[0], b[1] - a[1]; wx, wy = qx - a[0], qy - a[1]
        t = np.clip((wx * ex + wy * ey) / max(ex * ex + ey * ey, 1e-12), 0, 1); bx, by = wx - ex * t, wy - ey * t
        d = np.minimum(d, bx * bx + by * by)
        c1 = qy >= a[1]; c2 = qy < b[1]; c3 = ex * wy > ey * wx
        s = np.where((c1 & c2 & c3) | (~c1 & ~c2 & ~c3), -s, s)
    return s * np.sqrt(d)
class Prim:
    def __init__(self, f, mat, uvf=None): self.f, self.mat, self.uvf = f, mat, uvf
def revolve(profile, mat, c=(0, 0, 0), shell=None):
    """profile: [(r, y)] 축(r=0)을 포함해 닫힌 다각형. shell 두께를 주면 속이 빈 껍데기"""
    c = np.asarray(c, f32)
    def f(p):
        q = p - c; r = np.sqrt(q[:, 0] ** 2 + q[:, 2] ** 2); d = poly2d(r, q[:, 1], profile)
        return np.abs(d) - shell if shell else d
    return Prim(f, mat)
def box(c, h, mat, R=None, rnd=0.0):
    c = np.asarray(c, f32); h = np.asarray(h, f32); Rm = np.eye(3, dtype=f32) if R is None else R
    def f(p):
        q = np.abs((p - c) @ Rm) - (h - rnd); return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(1), 0) - rnd
    return Prim(f, mat)
def capsule(a, b, r, mat):
    a = np.asarray(a, f32); b = np.asarray(b, f32); ba = b - a; bb = float(ba @ ba)
    def f(p):
        pa = p - a; t = np.clip(pa @ ba / bb, 0, 1); return np.linalg.norm(pa - t[:, None] * ba, axis=1) - r
    return Prim(f, mat)
def sphere(c, r, mat):
    c = np.asarray(c, f32); return Prim(lambda p: np.linalg.norm(p - c, axis=1) - r, mat)
def cyl(c, r, h, mat, R=None):
    c = np.asarray(c, f32); Rm = np.eye(3, dtype=f32) if R is None else R
    def f(p):
        q = (p - c) @ Rm; dr = np.sqrt(q[:, 0] ** 2 + q[:, 2] ** 2) - r; dy = np.abs(q[:, 1]) - h
        return np.minimum(np.maximum(dr, dy), 0) + np.sqrt(np.maximum(dr, 0) ** 2 + np.maximum(dy, 0) ** 2)
    return Prim(f, mat)
def extrude(poly, thick, mat, c=(0, 0, 0), R=None):
    """xy 평면 다각형을 z 방향 두께로 돌출"""
    c = np.asarray(c, f32); Rm = np.eye(3, dtype=f32) if R is None else R
    def f(p):
        q = (p - c) @ Rm; d2 = poly2d(q[:, 0], q[:, 1], poly); dz = np.abs(q[:, 2]) - thick
        return np.minimum(np.maximum(d2, dz), 0) + np.sqrt(np.maximum(d2, 0) ** 2 + np.maximum(dz, 0) ** 2)
    return Prim(f, mat)
def subtract(a, b): return Prim(lambda p: np.maximum(a.f(p), -b.f(p)), a.mat)
def intersect_(a, b): return Prim(lambda p: np.maximum(a.f(p), b.f(p)), a.mat)
def polar_rep(prim, n, mat=None):
    """y축 둘레로 n번 반복 (prim은 +z 방향에 놓기)"""
    def f(p):
        a = np.arctan2(p[:, 0], p[:, 2]); sec = 2 * np.pi / n; a2 = (a + sec / 2) % sec - sec / 2; r = np.sqrt(p[:, 0] ** 2 + p[:, 2] ** 2)
        q = np.stack([r * np.sin(a2), p[:, 1], r * np.cos(a2)], 1); return prim.f(q)
    return Prim(f, mat or prim.mat)

def scene_sdf(prims, p, want_mat=False):
    d = np.full(len(p), 1e9, f32); m = np.zeros(len(p), np.int16)
    for i, pr in enumerate(prims):
        di = pr.f(p)
        if want_mat: upd = di < d; m = np.where(upd, i, m)
        d = np.minimum(d, di)
    return (d, m) if want_mat else d

# ---------- 레이마칭 ----------
def camera(target, dist, az, el, fov, S):
    tg = np.asarray(target, f32); cam = tg + dist * np.array([np.sin(az) * np.cos(el), np.sin(el), np.cos(az) * np.cos(el)], f32)
    fw = norm(tg - cam); rt = norm(np.cross(fw, [0, 1, 0])); up = np.cross(rt, fw); k = np.tan(fov / 2)
    xs = (np.arange(S, dtype=f32) + 0.5) / S * 2 - 1; X, Y = np.meshgrid(xs, -xs)
    d = norm(fw + X[..., None] * k * rt + Y[..., None] * k * up).reshape(-1, 3).astype(f32)
    return cam, d, 2 * k / S
def march(prims, o, d, tmax, steps=110):
    N = len(d); t = np.zeros(N, f32); hit = np.zeros(N, bool); act = np.arange(N)
    for it in range(steps):
        if len(act) == 0: break
        p = o + d[act] * t[act, None]; dist = scene_sdf(prims, p)
        h = dist < 0.0006 * (1 + t[act]); hit[act[h]] = True
        t[act] += np.maximum(dist, 0.0004) * 0.9
        act = act[(~h) & (t[act] < tmax)]
    return t, hit
def normals(prims, p, e=6e-4):
    ex = np.array([e, 0, 0], f32); ey = np.array([0, e, 0], f32); ez = np.array([0, 0, e], f32)
    n = np.stack([scene_sdf(prims, p + ex) - scene_sdf(prims, p - ex), scene_sdf(prims, p + ey) - scene_sdf(prims, p - ey), scene_sdf(prims, p + ez) - scene_sdf(prims, p - ez)], 1)
    return norm(n)
def soft_shadow(prims, p, L, k=10, steps=40, tmax=6):
    res = np.ones(len(p), f32); t = np.full(len(p), 0.01, f32)
    for i in range(steps):
        h = scene_sdf(prims, p + L * t[:, None]); res = np.minimum(res, k * np.maximum(h, 0) / t); t += np.clip(h, 0.01, 0.4)
        if (t > tmax).all(): break
    return np.clip(res, 0, 1)
def ambient_occ(prims, p, n):
    occ = np.zeros(len(p), f32)
    for i, hh in enumerate((0.02, 0.06, 0.12, 0.22, 0.35)):
        occ += (hh - scene_sdf(prims, p + n * hh)) * (0.75 ** i)
    return np.clip(1 - 1.6 * occ, 0.25, 1)

# ---------- 재질 (실제) ----------
def cyl_uv(p):
    th = np.arctan2(p[:, 0], p[:, 2]); return th, p[:, 1]
def mat_real(name, p, n, ctx):
    """반환: albedo(N,3) sRGB, rough(N), metal(N), height(N) (범프용)"""
    N = len(p); th, y = cyl_uv(p); r = np.sqrt(p[:, 0] ** 2 + p[:, 2] ** 2); u = th * np.maximum(r, 0.05)
    one = np.ones(N, f32); z = np.zeros(N, f32)
    def C(c): return np.broadcast_to(np.asarray(c, f32), (N, 3)).copy()
    if name in ('steel', 'steel_frost'):
        streak = fbm(u * 70, y * 2.5, 3, 3); seam = np.exp(-((frac(y / ctx.get('ring', 0.55)) - 0.5) / 0.012) ** 2)
        alb = C((0.80, 0.80, 0.82)) * (0.88 + 0.16 * streak[:, None]) * (1 - 0.25 * seam[:, None])
        rough = 0.16 + 0.12 * streak + 0.2 * seam; h = -0.001 * seam
        if name == 'steel_frost':
            fr = np.clip((ctx.get('frost_y', 0) - y) * 3 + fbm(u * 6, y * 6, 5) * 1.2 - 0.6, 0, 1)
            alb = alb * (1 - fr[:, None]) + C((0.93, 0.95, 0.97)) * fr[:, None]; rough = rough * (1 - fr) + 0.85 * fr; h = h + 0.003 * fr * fbm(u * 40, y * 40, 7)
            return alb, rough, 1 - fr, h
        return alb, rough, one, h
    if name == 'steeltile':
        a_s, r_s, m_s, h_s = mat_real('steel', p, n, ctx); a_t, r_t, m_t, h_t = mat_real('tiles', p, n, ctx)
        side = np.cos(th - ctx.get('tile_dir', 0.6)) > 0.0
        return np.where(side[:, None], a_t, a_s), np.where(side, r_t, r_s), np.where(side, 0.0, 1.0), np.where(side, h_t, h_s)
    if name == 'alu':
        g = fbm(u * 20, y * 20, 9, 3); return C((0.86, 0.87, 0.89)) * (0.92 + 0.1 * g[:, None]), 0.38 + 0.1 * g, one, 0.0002 * g
    if name == 'white':
        g = fbm(u * 8, y * 8, 11, 3); seam = np.exp(-((frac(u / 1.2) - 0.5) / 0.004) ** 2)
        return C((0.90, 0.90, 0.89)) * (0.95 + 0.06 * g[:, None]) * (1 - 0.3 * seam[:, None]), 0.42 + 0.1 * g, z, -0.0006 * seam
    if name == 'cfrp':
        pp = 0.03; iu, iv = np.floor(u / pp), np.floor(y / pp); fu, fv = frac(u / pp), frac(y / pp); hz = ((iu + iv) % 2) == 0
        tow = np.where(hz, np.sin(fv * np.pi), np.sin(fu * np.pi)); return C((0.06, 0.065, 0.07)) * (0.6 + 0.6 * tow[:, None]), 0.28 + 0.2 * (1 - tow), z, 0.0008 * tow
    if name == 'black':
        g = fbm(u * 10, y * 10, 13, 3); return C((0.05, 0.05, 0.055)) * (0.8 + 0.4 * g[:, None]), 0.5 + 0.2 * g, z, 0.0003 * g
    if name in ('copper', 'niobium', 'nozzle_dark'):
        y0, y1 = ctx.get('noz_top', 0), ctx.get('noz_bot', -1); k = np.clip((y0 - y) / max(y0 - y1, 1e-3), 0, 1)
        tubes = 0.5 + 0.5 * np.cos(th * ctx.get('tubes', 120))
        if name == 'copper':
            base = C((0.86, 0.52, 0.36)) * (1 - k[:, None] * 0.55) + C((0.25, 0.18, 0.2)) * k[:, None] * 0.55
            heat = np.exp(-((k - 0.35) / 0.15) ** 2); base = base + C((0.25, 0.1, 0.25)) * heat[:, None] * 0.5
            return base * (0.94 + 0.06 * tubes[:, None]), 0.3 + 0.15 * k, one, 0.0004 * tubes * (k < 0.6)
        if name == 'niobium':
            band = 0.5 + 0.5 * np.sin(k * 16); base = C((0.42, 0.42, 0.45)) * (0.93 + 0.07 * band[:, None]); heat = np.exp(-((k - 0.15) / 0.12) ** 2)
            return base + C((0.25, 0.12, 0.3)) * heat[:, None] * 0.6, 0.35 + 0.1 * band, one, 0.0004 * band
        return C((0.12, 0.12, 0.13)) * (0.85 + 0.2 * tubes[:, None]), 0.45, z, 0.0008 * tubes
    if name == 'tiles':
        s = 0.11; q = (np.sqrt(3) / 3 * u - y / 3) / s; rr = (2 / 3 * y) / s; x_, z_ = q, rr; y_ = -x_ - z_
        rx, ry, rz = np.round(x_), np.round(y_), np.round(z_); dx_, dy_, dz_ = np.abs(rx - x_), np.abs(ry - y_), np.abs(rz - z_)
        c1 = (dx_ > dy_) & (dx_ > dz_); c2 = (~c1) & (dy_ > dz_); rx = np.where(c1, -ry - rz, rx); rz = np.where(c2 | c1, rz, -rx - ry)
        cx = s * np.sqrt(3) * (rx + rz / 2); cy = s * 1.5 * rz; lx, ly = np.abs(u - cx), np.abs(y - cy); kk = np.maximum(lx, 0.5 * lx + 0.866 * ly); edge = s * 0.866 - kk
        tile = np.clip(edge / 0.004 - 0.5, 0, 1); tid = h2(rx, rz, 3)
        alb = C((0.03, 0.03, 0.033)) * (0.7 + 0.6 * tid[:, None]); alb = alb * tile[:, None] + C((0.25, 0.25, 0.24)) * (1 - tile[:, None])
        return alb, 0.25 + 0.15 * tid, z, 0.002 * np.sqrt(np.clip(edge / 0.012, 0, 1))
    if name == 'heatshield':
        F1, F2, _ = worley(u * 12, y * 12, 4); cr = np.clip(1 - (F2 - F1) / 0.06, 0, 1); g = fbm(u * 30, y * 30, 5, 3)
        return C((0.13, 0.09, 0.06)) * (0.7 + 0.5 * g[:, None]) * (1 - 0.5 * cr[:, None]), 0.85 + z, z, 0.001 * g - 0.001 * cr
    if name == 'rubber':
        g = fbm(u * 25, y * 25, 21, 3); return C((0.55, 0.5, 0.45)) * (0.85 + 0.25 * g[:, None]), 0.85 + z, z, 0.0005 * g
    if name.startswith('liquid:'):
        c = [float(t) for t in name.split(':')[1].split(',')]; g = 0.5 + 0.5 * np.sin(y * 30 + th * 3)
        return C(c) * (0.9 + 0.15 * g[:, None]), 0.05 + z, z, 0.0002 * g
    if name == 'glass':
        return C((0.9, 0.95, 1.0)), 0.03 + z, z, z
    if name == 'gold':
        cr = fbm(u * 6, y * 5, 41, 4); return C((1.0, 0.77, 0.34)), 0.1 + 0.08 * cr, one, 0.006 * cr
    if name == 'amber':  # 창문 등 발광
        return C((1.0, 0.75, 0.35)), 0.2 + z, z, z
    if name == 'srbcase':
        seg = np.exp(-((frac(y / 0.9) - 0.5) / 0.01) ** 2); g = fbm(u * 6, y * 6, 31, 3)
        return C((0.88, 0.88, 0.86)) * (0.95 + 0.05 * g[:, None]) * (1 - 0.35 * seg[:, None]), 0.5 + z, z, -0.001 * seg
    return C((0.6, 0.6, 0.6)), 0.5 + z, z, z

# ---------- 셰이딩 ----------
LK = norm(np.array([-0.55, 0.78, 0.55], f32)); LF = norm(np.array([0.9, 0.2, 0.4], f32)); LRim = norm(np.array([0.3, 0.5, -0.85], f32))
def env(rd, rough):
    y = rd[:, 1]; xz = np.arctan2(rd[:, 0], rd[:, 2]); w = 0.08 + rough * 0.6
    box_ = np.exp(-((y - 0.55) / (0.28 + w)) ** 2 - ((xz + 0.9) / (0.55 + w)) ** 2) * 3.2
    strip = np.exp(-((xz - 1.2) / (0.08 + w * 0.8)) ** 2) * np.clip(1 - np.abs(y - 0.2) * 1.6, 0, 1) * 2.0
    base = 0.22 + 0.42 * np.clip(y + 0.3, 0, 1) + 0.12 * np.exp(-((xz - 2.6) / 0.6) ** 2); return ((base + box_ + strip) / (1 + rough * 3))[:, None] * np.array([1, 0.98, 0.95], f32)
def ggx(n, v, l, rough, F0):
    h = norm(v + l); nh = np.clip((n * h).sum(1), 0, 1); nl = np.clip((n * l).sum(1), 0, 1); nv = np.clip((n * v).sum(1), 1e-3, 1); vh = np.clip((v * h).sum(1), 0, 1)
    a2 = np.maximum(rough, 0.04) ** 4; D = a2 / (np.pi * (nh * nh * (a2 - 1) + 1) ** 2); k = (rough + 1) ** 2 / 8
    G = nl / (nl * (1 - k) + k) * nv / (nv * (1 - k) + k); F = F0 + (1 - F0) * ((1 - vh) ** 5)[:, None]
    return (D * G / (4 * nv * np.maximum(nl, 1e-3)))[:, None] * F * nl[:, None]

def shade_real(prims, P, n, V, mids, ctx):
    N = len(P); alb = np.zeros((N, 3), f32); rough = np.zeros(N, f32); metal = np.zeros(N, f32); hgt = np.zeros(N, f32); emis = np.zeros((N, 3), f32)
    for i, pr in enumerate(prims):
        m = mids == i
        if not m.any(): continue
        a, r_, me, h = mat_real(pr.mat, P[m], n[m], ctx)
        alb[m] = a; rough[m] = np.broadcast_to(r_, m.sum()); metal[m] = np.broadcast_to(me, m.sum()); hgt[m] = np.broadcast_to(h, m.sum())
        if pr.mat == 'amber': emis[m] = np.array([1.6, 1.0, 0.45], f32)
    # 범프: 높이를 법선에 반영 (화면 공간 근사 대신 재질을 약간 옮겨 다시 평가)
    e = 0.004; t1 = norm(np.cross(n, np.array([0, 1, 0], f32)) + 1e-6); t2 = np.cross(n, t1)
    for i, pr in enumerate(prims):
        m = mids == i
        if not m.any() or pr.mat in ('glass',): continue
        hu = np.broadcast_to(mat_real(pr.mat, P[m] + t1[m] * e, n[m], ctx)[3], m.sum()); hv = np.broadcast_to(mat_real(pr.mat, P[m] + t2[m] * e, n[m], ctx)[3], m.sum())
        n[m] = norm(n[m] - ((hu - hgt[m]) / e)[:, None] * t1[m] - ((hv - hgt[m]) / e)[:, None] * t2[m])
    alb = np.clip(alb, 0, 1) ** 2.2; F0 = 0.04 * (1 - metal[:, None]) + alb * metal[:, None]; diff = alb * (1 - metal[:, None])
    sh = soft_shadow(prims, P + n * 0.004, LK) ; ao = ambient_occ(prims, P, n)
    col = np.zeros((N, 3), f32)
    for L, Lc, s in ((LK, np.array([2.4, 2.3, 2.15], f32), sh), (LF, np.array([0.55, 0.65, 0.8], f32), 1.0), (LRim, np.array([1.4, 1.5, 1.7], f32), 1.0)):
        nl = np.clip((n * L).sum(1), 0, 1)[:, None]; Lb = np.broadcast_to(L, n.shape)
        col += Lc * (diff * nl * 0.9 + ggx(n, V, Lb, rough, F0)) * np.reshape(s, (-1, 1)) if np.ndim(s) else Lc * (diff * nl * 0.9 + ggx(n, V, Lb, rough, F0))
    rd = norm(2 * (n * V).sum(1, keepdims=True) * n - V); nv = np.clip((n * V).sum(1), 0, 1)[:, None]; Fr = F0 + (1 - F0) * (1 - nv) ** 5
    col += env(rd, rough) * Fr * (1 - rough[:, None] * 0.6) * (0.5 + 0.5 * ao[:, None])
    col += diff * (0.07 + 0.07 * np.clip(n[:, 1], 0, 1))[:, None] * ao[:, None]
    return col * (0.55 + 0.45 * ao[:, None]) + emis

# ---------- 홀로그램 ----------
CYAN = np.array([0.25, 0.94, 1.0], f32)
ACCENT = {'gold': (1.0, 0.8, 0.35), 'copper': (1.0, 0.6, 0.35), 'amber': (1.0, 0.76, 0.29), 'tp_mli': (1.0, 0.82, 0.35), 'tp_foam': (1.0, 0.55, 0.22), 'tp_pica': (1.0, 0.55, 0.25), 'tp_cork': (0.9, 0.65, 0.4)}
def holo_lines(name, p, ctx, w):
    """재질별 홀로그램 선 무늬 강도 (0~1). w: 픽셀 크기(세계 단위)"""
    th, y = cyl_uv(p); r = np.sqrt(p[:, 0] ** 2 + p[:, 2] ** 2); u = th * np.maximum(r, 0.05)
    def grid(val, step, width=1.0): f = np.abs(frac(val / step + 0.5) - 0.5) * step; return np.clip(1 - f / (w * width), 0, 1)
    gu = ctx.get('gu', 0.16); gv = ctx.get('gv', 0.16)
    mer = np.clip(1 - (np.abs(frac(th / (2 * np.pi / ctx.get('meridians', 28)) + 0.5) - 0.5) * (2 * np.pi / ctx.get('meridians', 28)) * np.maximum(r, 0.05)) / w, 0, 1)
    ring = grid(y, gv)
    lines = np.maximum(mer * 0.7, ring * 0.8)
    if name == 'tiles':
        s = 0.11; q = (np.sqrt(3) / 3 * u - y / 3) / s; rr = (2 / 3 * y) / s; x_, z_ = q, rr; y_ = -x_ - z_
        rx, ry, rz = np.round(x_), np.round(y_), np.round(z_); dx_, dy_, dz_ = np.abs(rx - x_), np.abs(ry - y_), np.abs(rz - z_)
        c1 = (dx_ > dy_) & (dx_ > dz_); c2 = (~c1) & (dy_ > dz_); rx = np.where(c1, -ry - rz, rx); rz = np.where(c2 | c1, rz, -rx - ry)
        cx = s * np.sqrt(3) * (rx + rz / 2); cy = s * 1.5 * rz; lx, ly = np.abs(u - cx), np.abs(y - cy); kk = np.maximum(lx, 0.5 * lx + 0.866 * ly)
        lines = np.clip(1 - np.abs(s * 0.866 - kk) / w, 0, 1)
    elif name in ('copper', 'niobium', 'nozzle_dark'):
        lines = np.maximum(np.clip(1 - (np.abs(frac(th * ctx.get('tubes', 120) / (2 * np.pi) / 3 + 0.5) - 0.5) * (2 * np.pi / ctx.get('tubes', 120) * 3) * np.maximum(r, 0.05)) / w, 0, 1) * 0.6, ring)
    elif name == 'steeltile':
        side = np.cos(th - ctx.get('tile_dir', 0.6)) > 0.0
        lines = np.where(side, holo_lines('tiles', p, ctx, w), lines)
    elif name == 'cfrp':
        lines = np.maximum(grid(u, 0.09), grid(y, 0.09)) * 0.8
    elif name.startswith('tp_'):
        k = name[3:]
        if k == 'hex': return holo_lines('tiles', p, ctx, w)
        if k == 'pica':
            iso = fbm(u * 4, y * 4, 77) + y * 0.5; c = np.clip(1 - np.abs(frac(iso * 12) - 0.5) * 2 / (w * 70), 0, 1) * (y > -0.1)
            return np.maximum(np.maximum(grid(u, 0.3, 1.4), grid(y, 0.3, 1.4)), c * 0.6)
        if k == 'cork':
            F1, F2, _ = worley(u * 28, y * 28, 2); return np.clip(1 - (F2 - F1) / (w * 28 * 1.6), 0, 1) * 0.75
        if k == 'blanket':
            q = 0.11; e = np.maximum(grid(u, q, 1.2), grid(y, q, 1.2)); dash = (frac((u + y) / 0.03) > 0.4); return np.maximum(e * dash, grid(u + y, q * 2, 0.6) * 0.0)
        if k == 'foam':
            iso = fbm(u * 6, y * 6, 31); return np.clip(1 - np.abs(frac(iso * 14) - 0.5) * 2 / (w * 90), 0, 1) * 0.8
        if k == 'mli':
            iso = fbm(u * 3.2, y * 2.4, 41); seam = grid(u, 0.6, 2.0); return np.maximum(np.clip(1 - np.abs(frac(iso * 10) - 0.5) * 2 / (w * 50), 0, 1) * 0.7, seam)
        if k == 'rcc':
            pp = 0.06; iu, iv = np.floor(u / pp), np.floor(y / pp); hz = ((iu + iv) % 2) == 0
            fu, fv = frac(u / pp), frac(y / pp); edge = np.where(hz, np.minimum(fv, 1 - fv), np.minimum(fu, 1 - fu)) * pp
            return np.maximum(np.clip(1 - edge / (w * 1.1), 0, 1) * 0.7, np.maximum(grid(u, pp, 0.6), grid(y, pp, 0.6)) * 0.3)
    elif name == 'gold':
        lines = np.clip(1 - np.abs(fbm(u * 6, y * 5, 41, 4) * 10 % 1 - 0.5) * 2 * 0.5 / (w * 25), 0, 1) * 0.7
    return lines

def shade_holo(prims, P, n, V, mids, ctx, w):
    N = len(P); nv = np.abs((n * V).sum(1)); fres = (1 - nv) ** 2.2
    col = np.zeros((N, 3), f32); acc = np.zeros((N, 3), f32)
    for i, pr in enumerate(prims):
        m = mids == i
        if not m.any(): continue
        ln = holo_lines(pr.mat, P[m], ctx, w[m])
        tint = np.array(ACCENT.get(pr.mat.split(':')[0], CYAN), f32)
        if pr.mat.startswith('liquid:'): tint = np.clip(np.array([float(t) for t in pr.mat.split(':')[1].split(',')], f32) * 1.2, 0, 1)
        c = CYAN[None] * (0.035 + 0.75 * fres[m, None] ** 1.3 + 0.95 * ln[:, None]) + tint[None] * (0.03 + 0.10 * (1 - nv[m, None]))
        col[m] = c
    # 위에서 오는 은은한 광원
    col *= (0.75 + 0.35 * np.clip((n * LK).sum(1), 0, 1))[:, None]
    return col

# ---------- 렌더 ----------
def render(prims, ctx, out_real, out_holo, S=700, OUT=512, az=0.62, el=0.32, fov=0.46, target=(0, 0, 0), dist=6.0, floor_y=None):
    cam, d, pix = camera(target, dist, az, el, fov, S)
    t, hit = march(prims, cam, d, dist * 2.5)
    P = cam + d * t[:, None]; idx = np.where(hit)[0]; Ph = P[idx]
    _, mids = scene_sdf(prims, Ph, want_mat=True); n = normals(prims, Ph); V = -d[idx]
    yy = np.repeat(np.linspace(1, 0, S, dtype=f32), S)
    for mode, out in (('real', out_real), ('holo', out_holo)):
        if not out: continue
        img = np.zeros((S * S, 3), f32)
        if mode == 'real':
            X0, Y0 = np.meshgrid(np.linspace(-1, 1, S), np.linspace(-1, 1, S)); spot = np.exp(-(X0 ** 2 / 0.4 + (Y0 + 0.05) ** 2 / 0.5)).reshape(-1).astype(f32)
            img[:] = np.array([0.018, 0.028, 0.045], f32) * (0.6 + 0.8 * yy[:, None]); img += np.array([0.05, 0.075, 0.11], f32) * spot[:, None]
            if floor_y is not None:
                tf = (floor_y - cam[1]) / np.where(np.abs(d[:, 1]) < 1e-6, -1e-6, d[:, 1]); fm = (~hit) & (tf > 0)
                if fm.any():
                    Pf = cam + d[fm] * tf[fm, None]; dd = np.sqrt(Pf[:, 0] ** 2 + Pf[:, 2] ** 2)
                    sh = soft_shadow(prims, Pf + np.array([0, 0.002, 0], f32), LK, k=6, steps=36)
                    ao = np.clip(scene_sdf(prims, Pf + np.array([0, 0.05, 0], f32)) / 0.5, 0.15, 1)
                    fc = np.array([0.035, 0.042, 0.055], f32) * (1.6 / (1 + 0.15 * dd ** 2))[:, None] * ((0.35 + 0.65 * sh) * ao)[:, None]
                    img[fm] = fc + img[fm] * 0.15
            img[idx] = shade_real(prims, Ph, n.copy(), V, mids, ctx)
            img = img.reshape(S, S, 3); X, Y = np.meshgrid(np.linspace(-1, 1, S), np.linspace(-1, 1, S)); img *= (1 - 0.25 * (X ** 2 + Y ** 2))[..., None]
            a, b, c, d2, e = 2.51, 0.03, 2.43, 0.59, 0.14; img = np.clip((img * (a * img + b)) / (img * (c * img + d2) + e), 0, 1) ** (1 / 2.2)
        else:
            img[:] = np.array([0.02, 0.043, 0.078], f32) * (0.7 + 0.6 * yy[:, None])
            w = t[idx] * pix * 1.3
            img[idx] = shade_holo(prims, Ph, n, V, mids, ctx, w)
            img = img.reshape(S, S, 3)
            # 블룸
            pil = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)); bl = np.asarray(pil.filter(ImageFilter.GaussianBlur(S / 90)), f32) / 255
            bl2 = np.asarray(pil.filter(ImageFilter.GaussianBlur(S / 30)), f32) / 255; img = np.clip(img + bl * 0.55 + bl2 * 0.35, 0, 1)
            rng = np.random.default_rng(2)
            for _ in range(80):
                yx = rng.integers(0, S, 2); img[yx[0], yx[1]] = np.maximum(img[yx[0], yx[1]], CYAN * rng.uniform(0.2, 0.6))
            img[::3] *= 0.93
        Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).resize((OUT, OUT), Image.LANCZOS).save(out)
