"""Burns tier_preview.py's slot labels into its renders and stacks them into one sheet (Pillow).

    python tools/blender/label_sheet.py <out_sheet.png> <title> <render.png> [<render.png> ...]

Each render has a `<render>.png.labels.txt` written by tier_preview.py (x fraction, label, extra line).
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont


def font(size):
    for name in ('arialbd.ttf', 'arial.ttf', 'DejaVuSans-Bold.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def labelled(path):
    im = Image.open(path).convert('RGB')
    lab_path = path + '.labels.txt'
    if not os.path.exists(lab_path):
        return im
    band = 64
    out = Image.new('RGB', (im.width, im.height + band), (24, 24, 28))
    out.paste(im, (0, 0))
    d = ImageDraw.Draw(out)
    big, small = font(26), font(16)
    with open(lab_path, encoding='utf-8') as fh:
        for line in fh:
            xf, lab, extra = line.rstrip('\n').split('\t')
            x = float(xf) * im.width
            for txt, f, y, col in ((lab, big, im.height + 6, (250, 230, 120)),
                                   (extra, small, im.height + 38, (200, 200, 205))):
                w = d.textlength(txt, font=f)
                d.text((x - w / 2, y), txt, font=f, fill=col)
    return out


def main():
    out, title, *renders = sys.argv[1:]
    ims = [labelled(r) for r in renders]
    w = max(i.width for i in ims)
    head = 48
    sheet = Image.new('RGB', (w, head + sum(i.height for i in ims)), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    d.text((16, 10), title, font=font(26), fill=(240, 240, 240))
    y = head
    for i in ims:
        sheet.paste(i, (0, y))
        y += i.height
    sheet.save(out)
    print('wrote', out)


main()
