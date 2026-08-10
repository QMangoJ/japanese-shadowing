#!/usr/bin/env python3
"""Render the Japanese Shadowing home-screen icons from the vector design."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = {
    512: ROOT / "public" / "icon-512.png",
    192: ROOT / "public" / "icon-192.png",
    180: ROOT / "public" / "apple-touch-icon.png",
}


def render(size: int) -> Image.Image:
    scale = size / 512
    point = lambda value: round(value * scale)
    image = Image.new("RGBA", (size, size), "#1c5547")
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle((0, 0, size, size), radius=point(118), fill="#1c5547")
    draw.ellipse((point(150), point(150), point(362), point(362)), fill="#e77950")

    # Headphones: an arched band and two padded earcups.
    draw.arc((point(144), point(144), point(368), point(368)), 180, 360, fill="#fffaf2", width=point(32))
    draw.rounded_rectangle((point(128), point(256), point(186), point(366)), radius=point(28), fill="#fffaf2")
    draw.rounded_rectangle((point(326), point(256), point(384), point(366)), radius=point(28), fill="#fffaf2")

    # Three spoken-sound bars.
    for x, y1, y2 in ((220, 222, 290), (256, 196, 316), (292, 244, 268)):
        draw.line((point(x), point(y1), point(x), point(y2)), fill="#1c5547", width=point(20))
        radius = point(10)
        draw.ellipse((point(x) - radius, point(y1) - radius, point(x) + radius, point(y1) + radius), fill="#1c5547")
        draw.ellipse((point(x) - radius, point(y2) - radius, point(x) + radius, point(y2) + radius), fill="#1c5547")

    draw.ellipse((point(243), point(384), point(269), point(410)), fill="#b7dcc2")
    return image


for pixels, output in OUTPUTS.items():
    render(pixels).convert("RGB").save(output, "PNG", optimize=True)
