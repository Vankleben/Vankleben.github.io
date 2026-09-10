"""生成 assets/fig-advisor.png —— advisor-agent 项目的悬停配图。

风格规范取自同目录既有配图 fig-bear.png / fig-esm.png 的实测参数：
  - 画布 760x464 RGBA，完全透明背景（不画黑色底版）
  - 只允许四种颜色：--em #34d17b / --em-hi #7cffb2 / --dim #8fa89a / --ink #e9f6ee
  - 等宽字体、全大写英文；标题亮、副标题灰绿、关键结论亮翠绿
  - 1px 细引导线 @ 约 25% 透明度；主体笔画硬边，发光交给网页 CSS
用法：python tools/make_fig_advisor.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SS = 4  # 超采样倍数，缩回后得到干净的抗锯齿边缘

W, H = 760, 464

EM = (52, 209, 123)
EM_HI = (124, 255, 178)
DIM = (143, 168, 154)
INK = (233, 246, 238)

FONT = "C:/Windows/Fonts/consola.ttf"
FONT_B = "C:/Windows/Fonts/consolab.ttf"

OUT = Path(__file__).resolve().parent.parent / "assets" / "fig-advisor.png"


def s(v):
    """把设计稿像素换算成超采样画布上的像素。"""
    return int(round(v * SS))


def font(path, size):
    return ImageFont.truetype(path, s(size))


def draw_text(draw, xy, text, f, fill, anchor="la"):
    draw.text((s(xy[0]), s(xy[1])), text, font=f, fill=fill, anchor=anchor)


def plate(y, x0, w, h, skew, fill_rgba, stroke_rgba, top_rgba):
    """一块平行四边形"校验层"：填充 + 2px 描边 + 顶部 2px 亮边。"""
    layer = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    pts = [
        (s(x0), s(y)),
        (s(x0 + w), s(y)),
        (s(x0 + w - skew), s(y + h)),
        (s(x0 - skew), s(y + h)),
    ]
    d.polygon(pts, fill=fill_rgba)
    d.line(pts + [pts[0]], fill=stroke_rgba, width=s(2), joint="curve")
    d.line([pts[0], pts[1]], fill=top_rgba, width=s(2))
    return layer


def ticks(y, x0, w, skew, h, color, count=3):
    """每层右端的校验刻度。"""
    layer = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    right = x0 + w - skew * 0.0
    for i in range(count):
        x = right - 20 - i * 9
        d.line([(s(x), s(y + 12)), (s(x), s(y + h - 12))], fill=color, width=s(2))
    return layer


def vtext(text, f, fill):
    """竖排文字（自下而上阅读）。"""
    box = f.getbbox(text)
    tw, th = box[2] - box[0], box[3] - box[1]
    tile = Image.new("RGBA", (tw + s(6), th + s(6)), (0, 0, 0, 0))
    ImageDraw.Draw(tile).text((s(3) - box[0], s(3) - box[1]), text, font=f, fill=fill)
    return tile.rotate(90, expand=True)


def downscale(img):
    """4x4 块均值降采样（浮点预乘，数学上精确复原色板值）。

    直接用 PIL 缩放 RGBA 会因 8 位量化把低 alpha 处的舍入误差放大成纯白，
    或因直通 alpha 与透明黑混合产生暗边；这里全程用浮点预乘计算避免两者。
    """
    import numpy as np

    a = np.asarray(img, dtype=np.float64)
    rgb, al = a[:, :, :3], a[:, :, 3:4] / 255.0

    def block_mean(x):
        h, w, c = x.shape
        return x.reshape(h // SS, SS, w // SS, SS, c).mean(axis=(1, 3))

    pm, mean_a = block_mean(rgb * al), block_mean(al)
    out = np.empty((H, W, 4), dtype=np.float64)
    solid = mean_a[:, :, 0] > 0.002
    out[:, :, :3] = np.where(solid[:, :, None], pm / np.maximum(mean_a, 1e-9), 255.0)
    out[:, :, 3] = np.where(solid, mean_a[:, :, 0] * 255.0, 0.0)
    return Image.fromarray(np.clip(out, 0, 255).round().astype("uint8"), "RGBA")


def main():
    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))

    # ---- 版心细线（1px 翠绿 @25%）----
    guides = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(guides)
    for x in (40, W - 40):
        gd.line([(s(x), s(62)), (s(x), s(413))], fill=EM + (64,), width=s(1))
    img = Image.alpha_composite(img, guides)

    # ---- 三层校验（自上而下：最亮 → 渐暗）----
    layers = [
        dict(y=140, label="CARD LAYER", rgba=(124, 255, 178, 205), stroke=EM_HI + (255,)),
        dict(y=218, label="PAPER LAYER", rgba=(52, 209, 123, 200), stroke=EM + (235,)),
        dict(y=296, label="DEEP-DIVE", rgba=(52, 209, 123, 110), stroke=EM + (170,)),
    ]
    for i, L in enumerate(layers):
        x0 = 196 + i * 16
        img = Image.alpha_composite(
            img,
            plate(L["y"], x0, 400, 46, 46, L["rgba"], L["stroke"], EM_HI + (255,)),
        )
        img = Image.alpha_composite(
            img, ticks(L["y"], x0, 400, 46, 46, EM_HI + (235,))
        )

    # ---- 文字 ----
    txt = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(txt)

    # 左上两行标题
    draw_text(d, (36, 14), "ADVISOR AGENT — SOURCE-GROUNDED", font(FONT_B, 13), INK)
    draw_text(d, (36, 45), "LLM FUNCTION CALLING · 3-LAYER VERIFY", font(FONT, 9), DIM)

    # 每层左侧的小标签（右对齐到版心细线内侧）
    for i, L in enumerate(layers):
        draw_text(d, (172 + i * 16, L["y"] + 18), L["label"], font(FONT, 8), DIM + (230,), anchor="ra")

    # 底部关键结论
    draw_text(
        d, (W // 2, 453), "36 ADVISOR CARDS FROM ONE SCHOOL NAME",
        font(FONT, 8), EM_HI, anchor="ma",
    )

    img = Image.alpha_composite(img, txt)

    # 左右竖排注释
    for text, x, anchor_y in (
        ("18 TOOLS · PYTHON · MIT", 2, 157),
        ("EVIDENCE VERBATIM OR FLAGGED", W - 10, 157),
    ):
        tile = vtext(text, font(FONT, 8), DIM + (225,))
        img.alpha_composite(tile, (s(x), s(anchor_y)))

    img = downscale(img)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT)
    print(f"written: {OUT}  {img.size}  {img.mode}")


if __name__ == "__main__":
    main()
