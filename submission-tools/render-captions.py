from __future__ import annotations

import re
import sys
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def seconds(value: str) -> float:
    hours, minutes, rest = value.split(":")
    secs, millis = rest.split(",")
    return int(hours) * 3600 + int(minutes) * 60 + int(secs) + int(millis) / 1000


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: render-captions.py <captions.srt> <output-directory>")

    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    blocks = re.split(r"\n\s*\n", source.read_text().strip())
    concat = ["ffconcat version 1.0"]
    last_path: Path | None = None

    for index, block in enumerate(blocks, start=1):
        lines = block.splitlines()
        start, end = lines[1].split(" --> ")
        caption = " ".join(lines[2:])
        wrapped = textwrap.wrap(caption, width=78)
        if len(wrapped) > 2:
            wrapped = [" ".join(wrapped[:-1]), wrapped[-1]]

        image = Image.new("RGBA", (1800, 150), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle((0, 0, 1799, 149), radius=24, fill=(5, 11, 24, 218))
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 38)
        text_value = "\n".join(wrapped)
        bounds = draw.multiline_textbbox((0, 0), text_value, font=font, spacing=9, align="center")
        text_width = bounds[2] - bounds[0]
        text_height = bounds[3] - bounds[1]
        draw.multiline_text(
            ((1800 - text_width) / 2, (150 - text_height) / 2 - 4),
            text_value,
            font=font,
            fill=(238, 244, 255, 255),
            spacing=9,
            align="center",
        )

        path = output / f"caption-{index:03d}.png"
        image.save(path)
        duration = max(seconds(end) - seconds(start), 0.1)
        concat.append(f"file '{path}'")
        concat.append(f"duration {duration:.3f}")
        last_path = path

    if last_path is not None:
        concat.append(f"file '{last_path}'")
    (output / "captions.ffconcat").write_text("\n".join(concat) + "\n")


if __name__ == "__main__":
    main()
