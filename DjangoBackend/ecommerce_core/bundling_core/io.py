from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable, List, Optional

import pandas as pd
from dotenv import load_dotenv

from .models import Order, Product


def load_environment(dotenv_path: str = ".env") -> None:
    """Load environment variables from a .env file if it exists."""
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path)


def _bool_value(value: object, default: bool = True) -> bool:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    value_str = str(value).strip().lower()
    return value_str in {"1", "true", "t", "yes", "y"}


def _safe_float(value: object, default: Optional[float] = 0.0) -> Optional[float]:
    try:
        if pd.isna(value):  # type: ignore[attr-defined]
            return default
        return float(value)
    except Exception:
        return default


def _safe_int(value: object, default: Optional[int] = 0) -> Optional[int]:
    try:
        if pd.isna(value):  # type: ignore[attr-defined]
            return default
        return int(value)
    except Exception:
        return default


def read_products(excel_path: str, sheet_name: str = "products") -> List[Product]:
    """Read products from Excel into strongly typed objects."""
    df = pd.read_excel(excel_path, sheet_name=sheet_name, engine="openpyxl")
    df.columns = [c.strip().lower() for c in df.columns]

    products: List[Product] = []
    for _, row in df.iterrows():
        desc = row.get("description")
        if pd.isna(desc):
            desc = None
        site_desc = row.get("site_description")
        if pd.isna(site_desc):
            site_desc = None
        final_desc = desc or site_desc

        product = Product(
            sku=str(row.get("sku")),
            name=str(row.get("name", "")).strip(),
            brand=str(row.get("brand", "")).strip(),
            category=str(row.get("category", "")).strip() or "Uncategorized",
            price_with_vat=_safe_float(row.get("price_with_vat")),
            vat_rate=_safe_float(row.get("vat_rate"), default=21.0),
            available_stock=_safe_int(row.get("available_stock")),
            bundle_enabled=_bool_value(row.get("bundle_enabled"), default=True),
            fragrance=row.get("fragrance"),
            volume_qty=_safe_float(row.get("volume_qty"), default=None)  # type: ignore[arg-type]
            if not pd.isna(row.get("volume_qty"))
            else None,
            volume_unit=row.get("volume_unit"),
            units_per_pack=_safe_int(row.get("units_per_pack"), default=None)  # type: ignore[arg-type]
            if not pd.isna(row.get("units_per_pack"))
            else None,
            image_url=row.get("image_url") or row.get("image"),
            description=final_desc,
        )
        products.append(product)
    return products


def read_orders(excel_path: str, sheet_name: str = "orders") -> List[Order]:
    df = pd.read_excel(excel_path, sheet_name=sheet_name, engine="openpyxl")
    df.columns = [c.strip().lower() for c in df.columns]

    orders: List[Order] = []
    for _, row in df.iterrows():
        orders.append(
            Order(
                order_id=str(row.get("order_id")),
                product_sku=str(row.get("product_sku")),
                quantity=_safe_int(row.get("quantity"), default=1),
                channel=str(row.get("channel", "UNKNOWN")).strip(),
            )
        )
    return orders


def write_catalog(bundles: Iterable, output_path: str) -> None:
    """Write generated bundles to an Excel catalog."""
    records = []
    for bundle in bundles:
        desc_value = getattr(bundle, "marketing_description", None) or getattr(bundle, "description", "")
        title_value = getattr(bundle, "marketing_title", None) or bundle.title
        records.append(
            {
                "bundle_sku": bundle.sku,
                "title": title_value,
                "description": desc_value,
                "brand": bundle.brand,
                "category": bundle.category,
                "items": bundle.item_summary,
                "base_price": bundle.base_price,
                "final_price": bundle.final_price,
                "vat_rate": bundle.vat_rate,
                "max_bundle_stock": getattr(bundle, "max_bundle_stock", None),
                "image_path": bundle.image_path,
                "image_url": bundle.image_url,
            }
        )

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    path_obj = Path(output_path)
    candidates = [path_obj]
    if path_obj.suffix:
        candidates.append(path_obj.with_name(f"{path_obj.stem}_alt1{path_obj.suffix}"))
        candidates.append(path_obj.with_name(f"{path_obj.stem}_alt2{path_obj.suffix}"))

    last_error: Optional[Exception] = None
    for candidate in candidates:
        try:
            pd.DataFrame(records).to_excel(candidate, index=False, engine="openpyxl")
            return
        except PermissionError as exc:
            last_error = exc
            continue
    if last_error:
        raise last_error
