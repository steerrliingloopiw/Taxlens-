from PIL import Image, ImageDraw

S = 2
N = 1024 * S
W = (255, 255, 255, 255)
T = (238, 243, 252, 255)

mask = Image.linear_gradient("L").resize((N, N))
bg = Image.composite(
    Image.new("RGB", (N, N), (14, 96, 120)),
    Image.new("RGB", (N, N), (8, 22, 56)),
    mask,
).convert("RGBA")

im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
K = 0.82
c = (1 - K) * 512

def rr(x0, y0, x1, y1, r, col):
    d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], radius=r * S, fill=col)

def circle(x, y, r, **kw):
    d.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], **kw)

rr(250 * K + c, 250 * K + c, 774 * K + c, 380 * K + c, 28, T)
rr(446 * K + c, 250 * K + c, 578 * K + c, 790 * K + c, 28, T)

bx = 512 + (774 - 512) * K + 10
by = 512 + (790 - 512) * K - 52
circle(bx, by, 92, fill=(16, 185, 129, 255))
circle(bx, by, 92, outline=(8, 22, 56, 255), width=10 * S)
sc = 0.62
for dx, dy in ((-62, -62), (62, 62)):
    circle(bx + dx * sc, by + dy * sc, 38 * sc, fill=W)
d.line(
    [((bx + 58 * sc) * S, (by - 58 * sc) * S), ((bx - 58 * sc) * S, (by + 58 * sc) * S)],
    fill=W, width=int(30 * sc * S),
)

bb = im.getbbox()
dx = (bb[0] + bb[2]) // 2 - N // 2
dy = (bb[1] + bb[3]) // 2 - N // 2
im = im.transform(im.size, Image.AFFINE, (1, 0, dx, 0, 1, dy), resample=Image.BICUBIC)

Image.alpha_composite(bg, im).convert("RGB").resize((1024, 1024), Image.LANCZOS).save("icon-pro.png")

sm = im.resize((int(N * 0.8), int(N * 0.8)), Image.LANCZOS)
fg = Image.new("RGBA", (N, N), (0, 0, 0, 0))
o = (N - sm.width) // 2
fg.paste(sm, (o, o), sm)
fg.resize((1024, 1024), Image.LANCZOS).save("adaptive-icon-pro.png")
