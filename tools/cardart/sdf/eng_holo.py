"""엔진 8종의 실제 그림 — Grok 홀로그램 그림과 같은 모양·구도로
좌표: 그림 픽셀(256 기준) → 세계 단위. x = (px - 128)/100, y = (128 - py)/100. 정면에서 조금 위(el 0.1)로 봄."""
import sys, time
import numpy as np
from sdfr import *

f32 = np.float32
Y = lambda py: (128 - py) / 100.0
Rr = lambda px: px / 100.0

def bell(rows, mat):
    """rows: [(py, r_px)] 위→아래. 바깥면을 따라 회전체로"""
    prof = [(0.0, Y(rows[0][0]))] + [(Rr(r), Y(py)) for py, r in rows] + [(0.0, Y(rows[-1][0]))]
    return revolve(prof, mat)
def stack(rows, mat):
    return bell(rows, mat)
def smooth_rows(pts, step=4):
    """[(py, r)] 몇 개 점을 부드럽게 이은 행 목록"""
    pts = sorted(pts); ys = np.arange(pts[0][0], pts[-1][0] + 1e-6, step)
    rs = np.interp(ys, [p[0] for p in pts], [p[1] for p in pts]); k = np.array([1, 2, 3, 2, 1], float); k /= k.sum()
    rp = np.pad(rs, 2, mode='edge'); rs = np.convolve(rp, k, 'valid'); return list(zip(ys, rs))

class Pipes(Prim):
    def __init__(self, segs, mat):
        S = np.asarray([s[0] for s in segs], f32); E = np.asarray([s[1] for s in segs], f32); R = np.asarray([s[2] for s in segs], f32)
        def f(p):
            d = np.full(len(p), 1e9, f32)
            for a, b, r in zip(S, E, R):
                ba = b - a; bb = float(ba @ ba) or 1e-9; pa = p - a; t = np.clip(pa @ ba / bb, 0, 1)
                d = np.minimum(d, np.linalg.norm(pa - t[:, None] * ba, axis=1) - r)
            return d
        super().__init__(f, mat)

def plumbing(seed, y_top, y_bot, r_in, r_out, n=14, rad=(2.0, 3.5), side_bias=0.7, fine=True):
    """배관: 몸통(r_in)에서 나와 바깥(r_out)으로 돌아 세로로 내려가다 다시 들어가는 관. 단위: 그림 픽셀"""
    rng = np.random.default_rng(seed); segs = []
    for i in range(n):
        a = rng.uniform(0, 2 * np.pi)
        if rng.uniform() < side_bias: a = (np.pi / 2 if rng.uniform() < 0.5 else -np.pi / 2) + rng.normal(0, 0.5)
        ya = rng.uniform(y_top, y_bot); yb = np.clip(ya + rng.uniform(15, 60) * (1 if rng.uniform() < 0.6 else -1), y_top, y_bot)
        ro = rng.uniform(r_in(ya) + 6, max(r_in(ya) + 8, r_out(ya) - 2)); r = rng.uniform(*rad)
        def P(rr, py, aa=a): return (Rr(rr) * np.sin(aa), Y(py), Rr(rr) * np.cos(aa))
        da = rng.normal(0, 0.15)
        pts = [P(r_in(ya) - 1, ya), P(ro, ya + 3), P(ro, yb - 3, a + da), P(r_in(yb) - 1, yb, a + da)]
        for p0, p1 in zip(pts, pts[1:]): segs.append((p0, p1, Rr(r)))
        if rng.uniform() < 0.35: segs.append((P(ro, (ya + yb) / 2 - 3, a + da / 2), P(ro, (ya + yb) / 2 + 3, a + da / 2), Rr(r * 1.9)))  # 밸브
    if fine and n > 6: segs += plumbing(seed + 100, y_top, y_bot, r_in, r_out, n=int(n * 0.8), rad=(rad[0] * 0.5, rad[0] * 0.75), side_bias=side_bias, fine=False)
    return segs

def env_fn(pts):
    pts = sorted(pts); return lambda py: float(np.interp(py, [p[0] for p in pts], [p[1] for p in pts]))

def ctx_for(top, bot): return dict(noz_top=Y(top), noz_bot=Y(bot), tubes=150, ring=0.3, gv=0.2, meridians=36)

def E_raptor():
    core = [(5, 0), (8, 12), (12, 17), (18, 21), (30, 22), (38, 20), (42, 15), (47, 16), (52, 21), (62, 21), (66, 16.5), (92, 16.5), (97, 14)]
    b = smooth_rows([(97, 14), (104, 18), (112, 23), (120, 27), (128, 31), (144, 37), (160, 41.5), (176, 46.5), (192, 50), (208, 53.5), (224, 57), (240, 59.5), (262, 61)])
    P = [stack(core, 'steel'), bell(b, 'copper'), revolve([(0, Y(131)), (Rr(39), Y(131)), (Rr(39), Y(126)), (0, Y(126))], 'steel')]
    rin = env_fn(core + [(130, 30)]); rout = env_fn([(0, 40), (16, 51), (40, 58), (60, 56), (80, 46), (100, 43), (125, 38)])
    P.append(Pipes(plumbing(1, 6, 118, rin, rout, n=18), 'steel'))
    P.append(cyl((Rr(-34), Y(78), Rr(6)), Rr(5), Rr(10), 'steel')); P.append(cyl((Rr(30), Y(92), Rr(4)), Rr(5), Rr(12), 'steel'))
    return P, ctx_for(97, 262)
def E_raptorvac():
    core = [(-5, 37), (36, 37), (38, 30), (44, 27), (52, 27.5), (60, 26), (66, 21), (72, 18.5)]
    b = smooth_rows([(72, 18.5), (80, 21.5), (88, 25), (96, 28.5), (112, 33.5), (128, 39), (144, 44), (160, 48), (176, 52), (192, 55), (208, 58.5), (220, 61), (227, 62)], 3)
    P = [stack(core, 'steel'), bell(b, 'niobium')]
    for py in (8, 16, 24, 32, 46, 56): P.append(revolve([(0, Y(py + 1.2)), (Rr(core[1][1] + 1.2 if py < 36 else 29), Y(py + 1.2)), (Rr(core[1][1] + 1.2 if py < 36 else 29), Y(py - 1.2)), (0, Y(py - 1.2))], 'steel'))
    P.append(cyl((Rr(44), Y(18), Rr(4)), Rr(7), Rr(22), 'steel')); P.append(cyl((Rr(-42), Y(24), Rr(6)), Rr(5), Rr(14), 'steel'))
    rin = env_fn(core); rout = env_fn([(0, 42), (40, 40), (70, 30)])
    P.append(Pipes(plumbing(2, 0, 64, rin, rout, n=8, rad=(1.6, 2.6)), 'steel'))
    return P, ctx_for(72, 228)
def E_merlin():
    core = [(56, 0), (60, 12), (66, 21), (74, 27), (82, 29.5), (92, 28), (102, 24), (110, 21), (116, 22)]
    b = smooth_rows([(116, 22), (124, 27), (136, 32), (152, 37), (168, 44), (184, 51), (200, 57), (216, 62.5), (232, 66.5), (248, 70.5), (262, 73)])
    P = [stack(core, 'steel'), bell(b, 'nozzle_dark'), revolve([(0, Y(120)), (Rr(30), Y(120)), (Rr(30), Y(116)), (0, Y(116))], 'steel')]
    P.append(cyl((Rr(25), Y(18), Rr(-4)), Rr(17), Rr(19), 'steel')); P.append(cyl((Rr(-34), Y(16), Rr(-2)), Rr(13), Rr(14), 'alu'))
    P.append(sphere((Rr(-34), Y(2), Rr(-2)), Rr(13), 'alu'))
    rin = env_fn([(0, 12), (56, 10), (60, 14), (80, 29), (110, 21), (125, 28)]); rout = env_fn([(0, 58), (40, 60), (70, 52), (100, 48), (125, 44)])
    P.append(Pipes(plumbing(3, 4, 122, rin, rout, n=20), 'steel'))
    return P, ctx_for(116, 262)
def E_mvac():
    core = [(22, 0), (26, 9), (32, 14), (40, 15.5), (48, 13), (56, 15), (66, 17), (76, 19.5), (80, 20)]
    b = smooth_rows([(80, 20), (88, 24.5), (96, 28.5), (104, 32.5), (120, 39.5), (136, 45), (152, 50.5), (168, 55.5), (184, 60), (200, 64), (216, 67), (232, 70), (248, 72), (262, 73.5)])
    P = [stack(core, 'steel'), bell(b, 'niobium')]
    P.append(sphere((Rr(30), Y(44), Rr(6)), Rr(10), 'steel')); P.append(sphere((Rr(-40), Y(38), Rr(4)), Rr(7), 'steel')); P.append(cyl((Rr(-12), Y(10), Rr(-8)), Rr(10), Rr(12), 'steel'))
    rin = env_fn(core); rout = env_fn([(0, 46), (30, 46), (60, 40), (78, 30)])
    P.append(Pipes(plumbing(4, 0, 74, rin, rout, n=14, rad=(1.6, 2.8)), 'steel'))
    return P, ctx_for(80, 262)
def E_rs25():
    core = [(-5, 26), (66, 26), (70, 33), (92, 34), (94, 45), (101, 45), (102, 38)]
    b = smooth_rows([(102, 38), (112, 39.5), (124, 41), (136, 42.5), (152, 46), (168, 51.5), (184, 57), (200, 62), (216, 66.5), (232, 70.5), (248, 74.5), (262, 77)])
    P = [stack(core, 'steel'), bell(b, 'copper'), sphere((Rr(-30), Y(4), Rr(-6)), Rr(20), 'steel')]
    rin = env_fn([(0, 24), (66, 24), (70, 31), (100, 32)]); rout = env_fn([(0, 64), (30, 64), (60, 59), (90, 58), (110, 52), (140, 46)])
    P.append(Pipes(plumbing(5, 2, 130, rin, rout, n=16, rad=(4.0, 6.5), side_bias=0.55), 'steel'))
    P.append(Pipes(plumbing(15, 4, 100, rin, rout, n=10, rad=(1.6, 2.4)), 'alu'))
    return P, ctx_for(102, 262)
def E_rl10():
    core = [(-5, 25), (14, 25), (20, 22), (23, 35), (30, 35), (31, 30), (52, 30), (54, 34), (58, 34), (60, 17), (78, 15), (84, 15)]
    b = smooth_rows([(84, 15), (90, 18), (98, 23), (106, 27.5), (120, 33), (136, 39.5), (152, 45), (168, 50), (184, 54.5), (200, 59), (216, 63), (232, 67.5), (248, 71.5), (262, 74)])
    P = [stack(core, 'steel'), bell(b, 'nozzle_dark')]
    for k in range(6):
        a = k * np.pi / 3 + 0.3; P.append(capsule((Rr(32) * np.sin(a), Y(58), Rr(32) * np.cos(a)), (Rr(17) * np.sin(a + 0.25), Y(90), Rr(17) * np.cos(a + 0.25)), Rr(1.6), 'steel'))
    rin = env_fn([(0, 24), (22, 33), (30, 33), (32, 28), (52, 28)]); rout = env_fn([(0, 38), (50, 38)])
    P.append(Pipes(plumbing(6, 18, 56, rin, rout, n=8, rad=(1.4, 2.2)), 'steel'))
    return P, ctx_for(84, 262)
def E_be4():
    core = [(2, 0), (5, 20), (10, 28), (14, 30), (86, 30), (92, 27), (104, 24), (114, 22)]
    b = smooth_rows([(114, 22), (124, 24), (136, 26), (144, 27.5), (152, 30.5), (168, 36.5), (184, 41.5), (200, 46.5), (216, 50.5), (232, 55), (248, 58.5), (262, 61)])
    P = [stack(core, 'steel'), bell(b, 'copper')]
    for py in (14, 30, 52, 70, 86): P.append(revolve([(0, Y(py + 1.3)), (Rr(31.5), Y(py + 1.3)), (Rr(31.5), Y(py - 1.3)), (0, Y(py - 1.3))], 'steel'))
    rin = env_fn([(0, 28), (86, 28), (110, 21), (130, 25)]); rout = env_fn([(0, 52), (40, 56), (80, 56), (110, 48), (130, 40)])
    P.append(Pipes(plumbing(7, 6, 124, rin, rout, n=20, rad=(2.0, 3.2)), 'steel'))
    return P, ctx_for(114, 262)
def E_srb():
    case = [(-5, 40.5), (176, 40.5), (180, 41.5), (184, 38), (192, 34), (200, 30), (206, 25)]
    noz = smooth_rows([(206, 25), (212, 23), (220, 23.5), (232, 26), (248, 31), (262, 34)], 3)
    P = [stack(case, 'srbcase'), bell(noz, 'nozzle_dark')]
    for py in (2, 178): P.append(revolve([(0, Y(py + 2)), (Rr(42), Y(py + 2)), (Rr(42), Y(py - 2)), (0, Y(py - 2))], 'black'))
    c = ctx_for(206, 262); c.update(tubes=60, ring=0.9)
    return P, c

ENG = dict(raptor=E_raptor, raptorvac=E_raptorvac, merlin=E_merlin, mvac=E_mvac, rs25=E_rs25, rl10=E_rl10, be4=E_be4, srb=E_srb)
if __name__ == '__main__':
    names = list(ENG) if sys.argv[1] == 'all' else sys.argv[1].split(','); S = int(sys.argv[2]) if len(sys.argv) > 2 else 600
    for n in names:
        t0 = time.time(); P, ctx = ENG[n]()
        render(P, ctx, f'out/real_{n}.png', None, S=S, az=0.0, el=0.1, fov=0.46, target=(0, 0, 0), dist=1.28 / np.tan(0.23), floor_y=None)
        print(n, round(time.time() - t0, 1), 's', flush=True)
