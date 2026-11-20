import sys
from PIL import Image
names = sys.argv[1].split(','); mode = sys.argv[2]; T = 256; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
rows = (len(names) + cols - 1) // cols; im = Image.new('RGB', (cols * T, rows * T))
for k, n in enumerate(names):
    try: im.paste(Image.open(f'out/{mode}_{n}.png').resize((T, T)), ((k % cols) * T, (k // cols) * T))
    except Exception as e: pass
im.save(f'sheet_{mode}.png')
