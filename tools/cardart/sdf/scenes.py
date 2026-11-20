"""카드별 장면. 각 함수는 dict(prims, ctx, h(높이), w(가로 반경), floor, target, el) 반환. 단위: 반지름 1 기준"""
import numpy as np
from sdfr import *

def fit(h, w, margin=1.22):
    rad = max(h * 0.5, w) * margin; return rad / np.sin(0.23)

def ogive(h, r=1.0, k=1.7, n=28, r_tip=0.0, y0=0.0):
    return [(0, y0), (r, y0)] + [(r_tip + (r - r_tip) * np.sqrt(max(0, 1 - (i / n) ** k)), y0 + h * i / n) for i in range(1, n + 1)] + [(0, y0 + h)]
def tube(h, r=1.0, y0=0.0): return [(0, y0), (r, y0), (r, y0 + h), (0, y0 + h)]
def frustum(h, r0, r1, y0=0.0): return [(0, y0), (r0, y0), (r1, y0 + h), (0, y0 + h)]

# ---------------- 구조 ----------------
def S_nose():
    h = 3.4; P = [revolve(ogive(h, y0=-h / 2), 'steeltile')]
    for sgn in (-1, 1): P.append(box((sgn * 1.02, -0.45, 0.1), (0.04, 0.6, 0.34), 'steeltile', R=rot_z(sgn * 0.1), rnd=0.02))
    return dict(prims=P, ctx=dict(ring=0.5, tile_dir=2.4, gv=0.25, meridians=32), h=h, w=1.45, floor=-h / 2)
def S_fairing():
    h = 3.6; n = 30; pts = [(0, -h / 2), (1.0, -h / 2)]
    for i in range(1, n + 1):
        t = i / n; y = -h / 2 + h * t
        r = 1.0 + 0.3 * sm(min(1, t / 0.14)) if t < 0.56 else 1.3 * np.sqrt(max(0, 1 - ((t - 0.56) / 0.44) ** 1.8))
        pts.append((r, y))
    pts.append((0, h / 2)); P = [revolve(pts, 'white'), revolve(tube(0.08, 1.02, -h / 2 + 0.1), 'alu')]
    return dict(prims=P, ctx=dict(gv=0.3, meridians=24), h=h, w=1.4, floor=-h / 2)
def S_capsule():
    h = 1.7; P = [revolve(frustum(h, 1.0, 0.42, -h / 2), 'white'), revolve(tube(0.22, 0.32, h / 2), 'alu'), revolve([(0, -h / 2 - 0.12), (0.98, -h / 2 - 0.02), (1.0, -h / 2 + 0.03), (0, -h / 2 + 0.03)], 'heatshield')]
    for a in (0.1, 0.75):
        P.append(box((np.sin(a) * 0.74, 0.25, np.cos(a) * 0.74), (0.11, 0.09, 0.03), 'amber', R=rot_y(a) @ rot_x(-0.36), rnd=0.02))
    for a in (1.6, -1.0): P.append(box((np.sin(a) * 0.86, -0.15, np.cos(a) * 0.86), (0.08, 0.06, 0.05), 'black', R=rot_y(a) @ rot_x(-0.36), rnd=0.01))
    return dict(prims=P, ctx=dict(gv=0.2, meridians=28), h=h + 0.4, w=1.15, floor=-h / 2 - 0.12)
def S_tank(h, mat, frost=None, name=''):
    P = [revolve(tube(h, 1.0, -h / 2), mat), revolve([(0, h / 2), (0.98, h / 2), (0.6, h / 2 + 0.25), (0, h / 2 + 0.32)], 'steel' if mat != 'alu' else 'alu')]
    ctx = dict(ring=0.6 if h < 6 else 0.75, gv=0.4, meridians=30)
    if frost is not None: ctx['frost_y'] = frost
    return dict(prims=P, ctx=ctx, h=h + 0.4, w=1.1, floor=-h / 2)
def S_tankS(): return S_tank(2.6, 'alu')
def S_tankM(): return S_tank(4.6, 'steel')
def S_tankL(): return S_tank(7.6, 'steel_frost', frost=-0.6)
def S_adapter():
    h = 1.5; P = [revolve(frustum(h, 1.0, 0.62, -h / 2), 'cfrp'), revolve(tube(0.06, 1.02, -h / 2), 'alu'), revolve(tube(0.06, 0.64, h / 2 - 0.06), 'alu')]
    return dict(prims=P, ctx=dict(gv=0.25, meridians=24), h=h + 0.3, w=1.1, floor=-h / 2)
def gridfin_prim(c, R, s=1.0, mat='steel'):
    fr = box(c, (0.42 * s, 0.30 * s, 0.03 * s), mat, R=R)
    cell = 0.07 * s; cc = np.asarray(c, np.float32)
    def holes(p):
        q = (p - cc) @ R; qx = (q[:, 0] + cell / 2) % cell - cell / 2; qy = (q[:, 1] + cell / 2) % cell - cell / 2
        inner = np.maximum(np.maximum(np.abs(qx) - cell * 0.4, np.abs(qy) - cell * 0.4), np.maximum(np.abs(q[:, 0]) - 0.38 * s, np.abs(q[:, 1]) - 0.26 * s))
        return inner
    return Prim(lambda p: np.maximum(fr.f(p), -holes(p)), mat)
def S_inter():
    h = 1.3; P = [revolve(tube(h, 1.0, -h / 2), 'cfrp')]
    for a in (0.9, -0.7): P.append(gridfin_prim((np.sin(a) * 1.07, 0.15, np.cos(a) * 1.07), rot_y(a), 0.9, 'alu'))
    return dict(prims=P, ctx=dict(gv=0.22, meridians=24), h=h + 0.3, w=1.25, floor=-h / 2)
def S_hotring():
    h = 0.55; ring = revolve(tube(h, 1.0, -h / 2), 'steel', shell=None); inner = revolve(tube(h + 0.2, 0.9, -h / 2 - 0.1), 'steel')
    shell = subtract(ring, inner); slot = box((0, 0, 1.0), (0.06, 0.17, 0.2), 'steel'); vents = subtract(shell, polar_rep(slot, 22))
    core = revolve(tube(h * 0.9, 0.86, -h * 0.45), 'black')
    return dict(prims=[vents, core], ctx=dict(gv=0.12, meridians=22, ring=0.25), h=1.2, w=1.15, floor=-h / 2, el=0.42)
def S_engbay():
    h = 0.9; P = [revolve(tube(h, 1.0, 0), 'steel')]
    pos = [(0, 0)] + [(0.6 * np.cos(k * np.pi / 3), 0.6 * np.sin(k * np.pi / 3)) for k in range(6)]
    for (x, z) in pos:
        P.append(revolve([(0, 0.02), (0.1, 0.02), (0.12, -0.15), (0.24, -0.5), (0, -0.5)], 'copper', c=(x, 0, z)))
    return dict(prims=P, ctx=dict(noz_top=0.02, noz_bot=-0.5, tubes=90, gv=0.3, meridians=24, ring=0.45), h=1.6, w=1.15, floor=-0.5, target=(0, 0.15, 0), el=0.16)

# ---------------- 엔진 ----------------
def engine(exit_r=0.62, noz_len=2.0, mat_noz='copper', head=1.0, vac=False, pumps=2, gg=False, tubes=140, y0=1.4):
    s = head; P = []
    hp = [(0, y0), (0.30 * s, y0), (0.36 * s, y0 - 0.15 * s), (0.36 * s, y0 - 0.55 * s), (0.30 * s, y0 - 0.75 * s), (0.20 * s, y0 - 0.9 * s), (0, y0 - 0.9 * s)]
    P.append(revolve(hp, 'steel')); ty = y0 - 0.9 * s; n = 26; noz = [(0, ty), (0.2 * s, ty)]
    for i in range(1, n + 1):
        t = i / n; r = 0.2 * s + (exit_r - 0.2 * s) * (np.sin(t * np.pi / 2) ** (0.6 if vac else 0.78)); noz.append((r, ty - noz_len * t))
    noz += [(exit_r - 0.02, ty - noz_len), (0, ty - noz_len)]; P.append(revolve(noz, mat_noz))
    if vac or mat_noz == 'niobium': P.append(revolve(tube(0.06, 0.24 * s + 0.03, ty - 0.35), 'steel'))
    P.append(capsule((0.5 * s, y0 - 0.2 * s, 0.0), (0.5 * s, y0 - 0.75 * s, 0.0), 0.13 * s, 'steel'))
    P.append(capsule((0.5 * s, y0 - 0.75 * s, 0.0), (0.24 * s, ty - 0.25, 0.0), 0.05 * s, 'steel'))
    P.append(capsule((0.5 * s, y0 - 0.2 * s, 0.0), (0.2 * s, y0 + 0.05 * s, 0.0), 0.06 * s, 'steel'))
    if pumps > 1:
        P.append(capsule((-0.42 * s, y0 - 0.25 * s, 0.25 * s), (-0.42 * s, y0 - 0.7 * s, 0.25 * s), 0.11 * s, 'steel'))
        P.append(capsule((-0.42 * s, y0 - 0.7 * s, 0.25 * s), (-0.2 * s, ty - 0.2, 0.12 * s), 0.045 * s, 'steel'))
    if gg: P.append(capsule((0.5 * s, y0 - 0.75 * s, 0.0), (0.75 * s, ty - noz_len * 0.55, 0.15), 0.07 * s, 'black'))
    P.append(box((0, y0 + 0.08 * s, 0), (0.22 * s, 0.08 * s, 0.22 * s), 'black', rnd=0.02))
    H = (y0 + 0.16 * s) - (ty - noz_len)
    return dict(prims=P, ctx=dict(noz_top=ty, noz_bot=ty - noz_len, tubes=tubes, ring=0.3, gv=0.2, meridians=36), h=H, w=max(exit_r, 0.8) * 1.05, floor=None, target=(0, y0 + 0.16 * s - H / 2, 0))
def S_raptor(): return engine()
def S_raptorvac(): return engine(exit_r=1.15, noz_len=3.0, mat_noz='niobium', vac=True)
def S_merlin(): return engine(exit_r=0.5, noz_len=1.5, mat_noz='nozzle_dark', head=0.85, pumps=1, gg=True, tubes=110)
def S_mvac(): return engine(exit_r=1.45, noz_len=3.6, mat_noz='niobium', head=0.8, pumps=1, gg=True, vac=True)
def S_rs25(): return engine(exit_r=0.82, noz_len=2.2, mat_noz='copper', head=1.15, tubes=200)
def S_rl10(): return engine(exit_r=0.95, noz_len=2.4, mat_noz='nozzle_dark', head=0.6, pumps=1, vac=True)
def S_be4(): return engine(exit_r=0.72, noz_len=2.1, mat_noz='copper', head=1.1, tubes=160)
def S_srb():
    h = 4.6; P = [revolve(tube(h, 0.62, -h / 2 + 0.6), 'srbcase'), revolve([(0, h / 2 + 0.6), (0.62, h / 2 + 0.6), (0.3, h / 2 + 1.05), (0, h / 2 + 1.12)], 'srbcase')]
    P.append(revolve([(0, -h / 2 + 0.62), (0.32, -h / 2 + 0.62), (0.22, -h / 2 + 0.35), (0.42, -h / 2 - 0.25), (0, -h / 2 - 0.25)], 'nozzle_dark'))
    for y in (-h / 2 + 1.0, h / 2): P.append(revolve(tube(0.08, 0.64, y), 'black'))
    return dict(prims=P, ctx=dict(noz_top=-h / 2 + 0.6, noz_bot=-h / 2 - 0.25, tubes=60, gv=0.45, meridians=26), h=h + 1.4, w=0.8, floor=-h / 2 - 0.25, target=(0, 0.42, 0))

# ---------------- 연료 ----------------
def dewar(x, col, frost=False, h=2.4, r=0.5):
    body = revolve([(0, -h / 2), (r, -h / 2), (r, h / 2 - 0.25), (r * 0.6, h / 2), (0, h / 2 + 0.05)], 'steel_frost' if frost else 'steel', c=(x, 0, 0))
    win = box((x, -0.05, r), (0.12, h * 0.33, 0.25), 'steel'); shell = subtract(body, win)
    liq = revolve([(0, -h / 2 + 0.1), (r * 0.9, -h / 2 + 0.1), (r * 0.9, 0.35), (0, 0.35)], 'liquid:' + col, c=(x, 0, 0))
    empty = revolve(tube(h * 0.33 - 0.05, r * 0.9, 0.36), 'black', c=(x, 0, 0))
    return [shell, liq, empty]
def S_fuel(c1, c2, frost=(True, True)):
    P = dewar(-0.62, c1, frost[0]) + dewar(0.62, c2, frost[1]) + [capsule((-0.62, 1.3, 0), (0.62, 1.3, 0), 0.06, 'steel'), capsule((0, 1.3, 0), (0, 1.6, 0), 0.06, 'steel')]
    return dict(prims=P, ctx=dict(ring=0.6, frost_y=-0.4, gv=0.3, meridians=24), h=3.4, w=1.3, floor=-1.2, target=(0, 0.2, 0), az=0.25)
def S_methalox(): return S_fuel('0.55,0.75,1.0', '0.78,0.70,0.98')
def S_kerolox(): return S_fuel('0.55,0.75,1.0', '0.95,0.70,0.30', (True, False))
def S_hydrolox(): return S_fuel('0.55,0.75,1.0', '0.88,0.96,1.0')
def S_hyper(): return S_fuel('0.80,0.28,0.10', '0.92,0.90,0.78', (False, False))
def S_solid():
    h = 2.6; case = subtract(revolve(tube(h, 1.0, -h / 2), 'srbcase'), revolve(tube(h + 0.4, 0.95, -h / 2 - 0.2), 'srbcase')); star = extrude([(0.55 * np.cos(k * np.pi / 6) * (1 if k % 2 == 0 else 0.5), 0.55 * np.sin(k * np.pi / 6) * (1 if k % 2 == 0 else 0.5)) for k in range(12)], h, 'rubber', R=rot_x(np.pi / 2))
    grain = subtract(revolve(tube(h, 0.94, -h / 2), 'rubber'), star); cut = box((0.7, 0.3, 0.7), (0.7, h, 0.7), 'rubber', R=rot_y(0.0))
    return dict(prims=[subtract(case, cut), subtract(grain, cut)], ctx=dict(gv=0.3, meridians=26), h=h + 0.3, w=1.2, floor=-h / 2, el=0.5)

# ---------------- 부착물 ----------------
def S_gridfin():
    P = [gridfin_prim((0, 0, 0), rot_y(0.5) @ rot_x(-0.25), 2.3, 'alu'), box((-1.05, -0.05, 0.55), (0.08, 0.2, 0.08), 'steel', R=rot_y(0.5))]
    return dict(prims=P, ctx=dict(gv=0.08, meridians=12), h=1.6, w=1.1, floor=None, el=0.25)
def S_legs():
    h = 1.2; P = [revolve(tube(h, 1.0, -0.2), 'steel')]
    for k in range(4):
        a = k * np.pi / 2 + np.pi / 4; dx, dz = np.sin(a), np.cos(a)
        P.append(capsule((dx * 1.0, 0.5, dz * 1.0), (dx * 2.0, -1.0, dz * 2.0), 0.07, 'cfrp'))
        P.append(capsule((dx * 1.0, -0.1, dz * 1.0), (dx * 1.65, -0.55, dz * 1.65), 0.035, 'alu'))
        P.append(cyl((dx * 2.05, -1.04, dz * 2.05), 0.22, 0.04, 'alu'))
    return dict(prims=P, ctx=dict(gv=0.3, meridians=24, ring=0.4), h=2.5, w=2.3, floor=-1.08, target=(0, -0.05, 0), el=0.28)
def S_flaps():
    h = 2.6; P = [revolve(tube(h, 1.0, -h / 2), 'steeltile')]
    for sgn in (-1, 1): P.append(extrude([(0, -0.9), (0.85, -0.7), (0.85, 0.75), (0, 0.9)], 0.04, 'steeltile', c=(sgn * 0.98, 0, 0.15), R=rot_y(0 if sgn > 0 else np.pi) @ rot_z(0.0)))
    return dict(prims=P, ctx=dict(ring=0.55, tile_dir=1.3, gv=0.3, meridians=28), h=h, w=1.95, floor=-h / 2)
def S_fins():
    h = 2.4; P = [revolve(tube(h, 0.7, -h / 2), 'white'), revolve([(0, h / 2), (0.7, h / 2), (0, h / 2 + 1.0)], 'white')]
    for k in range(4):
        a = k * np.pi / 2 + 0.4; P.append(extrude([(0, -h / 2), (0.95, -h / 2 - 0.2), (0.95, -h / 2 + 0.25), (0, -h / 2 + 1.1)], 0.03, 'black', c=(np.sin(a) * 0.68, 0, np.cos(a) * 0.68), R=rot_y(-(a - np.pi / 2))))
    return dict(prims=P, ctx=dict(gv=0.3, meridians=24), h=h + 1.3, w=1.7, floor=-h / 2 - 0.2, target=(0, 0.3, 0))

# ---------------- 단열재 패널 (홀로그램 전용, 실제는 render_real.py 결과 사용) ----------------
def panel(mat):
    R, A, HH, T = 2.0, 0.45, 0.9, 0.15
    def f(p):
        r = np.sqrt(p[:, 0] ** 2 + p[:, 2] ** 2); th = np.arctan2(p[:, 0], p[:, 2])
        dr = np.maximum(r - R, (R - T) - r); da = (np.abs(th) - A) * r; dy = np.abs(p[:, 1]) - HH
        return np.maximum(np.maximum(dr, da), dy)
    return dict(prims=[Prim(f, mat)], ctx=dict(gv=0.15, meridians=60), h=1.9, w=1.0, floor=None, target=(0, 0, 1.9), az=0.75, el=0.3)
for _m in ('hex', 'pica', 'cork', 'blanket', 'foam', 'mli', 'rcc'):
    globals()['S_' + _m] = (lambda mm: (lambda: panel('tp_' + mm)))(_m)

ALL = ['nose', 'fairing', 'capsule', 'tankS', 'tankM', 'tankL', 'adapter', 'inter', 'hotring', 'engbay',
       'raptor', 'raptorvac', 'merlin', 'mvac', 'rs25', 'rl10', 'be4', 'srb',
       'methalox', 'kerolox', 'hydrolox', 'hyper', 'solid', 'gridfin', 'legs', 'flaps', 'fins',
       'hex', 'pica', 'cork', 'blanket', 'foam', 'mli', 'rcc']
