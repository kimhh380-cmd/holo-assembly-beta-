import time, sys
from scenes import *
names = ALL if sys.argv[1] == 'all' else sys.argv[1].split(','); S = int(sys.argv[2]) if len(sys.argv) > 2 else 700
modes = sys.argv[3] if len(sys.argv) > 3 else 'both'
TPS = {'hex', 'pica', 'cork', 'blanket', 'foam', 'mli', 'rcc'}
for name in names:
    sc = globals()['S_' + name](); t0 = time.time()
    real = None if (name in TPS or modes == 'holo') else f'out/real_{name}.png'
    holo = None if modes == 'real' else f'out/holo_{name}.png'
    render(sc['prims'], sc['ctx'], real, holo, S=S, target=sc.get('target', (0, 0, 0)), dist=fit(sc['h'], sc['w']), floor_y=sc['floor'], az=sc.get('az', 0.62), el=sc.get('el', 0.32))
    print(name, round(time.time() - t0, 1), 's', flush=True)
