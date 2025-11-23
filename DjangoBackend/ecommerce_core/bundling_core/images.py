from __future__ import annotations

import os
import re
from io import BytesIO
from typing import Dict, Optional

import cloudinary
import cloudinary.uploader
import requests
from PIL import Image, ImageDraw, ImageFont

from .models import Bundle, CloudinaryConfig, CollageConfig, Product


def _font(path: Optional[str], size: int) -> ImageFont.FreeTypeFont:
    try:
        if path and os.path.exists(path):
            return ImageFont.truetype(path, size=size)
    except Exception:
        pass
    return ImageFont.load_default()


def download_product_image(product: Product, timeout: int = 20) -> Optional[Image.Image]:
    if not product.image_url:
        print(f"[images] no image_url for SKU {product.sku}")
        return None
    try:
        response = requests.get(product.image_url, timeout=timeout)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "").lower()
        if "image" not in content_type:
            print(f"[images] non-image content-type for SKU {product.sku}: {content_type}")
            return None
        return Image.open(BytesIO(response.content)).convert("RGBA")
    except Exception as exc:
        print(f"[images] failed to download SKU {product.sku}: {exc}")
        return None


def _placeholder(product: Product, size: tuple[int, int] = (600, 600)) -> Image.Image:
    img = Image.new("RGB", size, (240, 240, 240))
    draw = ImageDraw.Draw(img)
    font = _font(None, 18)
    text = product.name[:40] or product.sku
    bbox = draw.textbbox((0, 0), text, font=font)
    x = (size[0] - (bbox[2] - bbox[0])) // 2
    y = (size[1] - (bbox[3] - bbox[1])) // 2
    draw.text((x, y), text, font=font, fill=(60, 60, 60))
    return img


def _resize_keep_ratio(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    ratio = min(max_w / img.width, max_h / img.height)
    new_size = (max(1, int(img.width * ratio)), max(1, int(img.height * ratio)))
    return img.resize(new_size, Image.Resampling.LANCZOS)


def generate_collage(
    bundle: Bundle,
    product_images: Dict[str, Image.Image],
    collage_cfg: CollageConfig,
    output_dir: str,
) -> str:
    os.makedirs(output_dir, exist_ok=True)

    canvas = Image.new("RGB", (collage_cfg.width, collage_cfg.height), collage_cfg.background_color)
    text_band_height = int(collage_cfg.height * collage_cfg.text_band_ratio)
    product_area_height = collage_cfg.height - text_band_height
    draw = ImageDraw.Draw(canvas)

    # Prepare product tiles
    tiles = []
    for item in bundle.items:
        for _ in range(item.quantity):
            img = product_images.get(item.product.sku)
            if img is None:
                print(f"[images] using placeholder for SKU {item.product.sku} in bundle {bundle.sku}")
                img = _placeholder(item.product)
            tiles.append(img)

    cols = max(1, int(len(tiles) ** 0.5))
    rows = max(1, (len(tiles) + cols - 1) // cols)
    cell_w = collage_cfg.width // cols
    cell_h = product_area_height // rows

    for idx, img in enumerate(tiles):
        r, c = divmod(idx, cols)
        resized = _resize_keep_ratio(img, cell_w - 12, cell_h - 12)
        x = c * cell_w + (cell_w - resized.width) // 2
        y = r * cell_h + (cell_h - resized.height) // 2
        canvas.paste(resized, (x, y), mask=resized if resized.mode == "RGBA" else None)

    # Text band
    band_top = product_area_height
    draw.rectangle([0, band_top, collage_cfg.width, collage_cfg.height], fill=collage_cfg.accent_color)
    font = _font(collage_cfg.font_path, 26)
    subtitle_font = _font(collage_cfg.font_path, 16)
    title = bundle.title
    subtitle = f"x{sum(item.quantity for item in bundle.items)}"
    title_pos = (16, band_top + 12)
    draw.text(title_pos, title, font=font, fill=(255, 255, 255))
    title_bbox = draw.textbbox(title_pos, title, font=font)
    subtitle_y = title_bbox[3] + 4
    draw.text((16, subtitle_y), subtitle, font=subtitle_font, fill=(255, 255, 255))

    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", bundle.sku) or "bundle"
    output_path = os.path.join(output_dir, f"{safe_name}.jpg")
    canvas.save(output_path, "JPEG", quality=90, optimize=True)
    return output_path


def configure_cloudinary(cfg: CloudinaryConfig) -> None:
    if cfg.is_configured:
        cloudinary.config(cloud_name=cfg.cloud_name, api_key=cfg.api_key, api_secret=cfg.api_secret)


def upload_to_cloudinary(image_path: str, cfg: CloudinaryConfig) -> Optional[str]:
    if not cfg.is_configured:
        return None
    configure_cloudinary(cfg)
    public_id = os.path.splitext(os.path.basename(image_path))[0]
    try:
        response = cloudinary.uploader.upload(
            image_path,
            folder=cfg.folder,
            public_id=public_id,
            overwrite=True,
        )
        return response.get("secure_url")
    except Exception as exc:
        print(f"[cloudinary] upload failed for {image_path}: {exc}")
        return None
