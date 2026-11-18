import sys
from playwright.sync_api import sync_playwright
ids=sys.argv[2].split(',')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':512,'height':512})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+sys.argv[1]); pg.wait_for_timeout(200)
    for i in ids:
        pg.evaluate(f"render('{i}')"); pg.locator('#c').screenshot(path=f'out/{i}.png')
    print('errs',errs)
