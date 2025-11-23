from __future__ import annotations
from typing import Optional
import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class Product:
    sku: str
    name: str
    brand: str
    category: str
    price_with_vat: float
    vat_rate: float
    available_stock: int
    bundle_enabled: bool = True
    fragrance: Optional[str] = None
    volume_qty: Optional[float] = None
    volume_unit: Optional[str] = None
    units_per_pack: Optional[int] = None
    image_url: Optional[str] = None
    description: Optional[str] = None


@dataclass
class Order:
    order_id: str
    product_sku: str
    quantity: int
    channel: str


@dataclass
class BundleItem:
    product: Product
    quantity: int


@dataclass
class Bundle:
    sku: str
    title: str
    brand: str
    category: str
    items: List[BundleItem]
    base_price: float
    final_price: float
    vat_rate: float
    total_units: int
    max_bundle_stock: int
    description: str
    image_path: Optional[str] = None
    image_url: Optional[str] = None
    marketing_title: Optional[str] = None
    marketing_description: Optional[str] = None
    marketing_benefits: Optional[str] = None
    llm_score: Optional[float] = None
    llm_reason: Optional[str] = None
    
    @property
    def item_summary(self) -> str:
        return ", ".join(f"{item.quantity}x {item.product.name}" for item in self.items)


@dataclass
class PricingConfig:
    commission_rate: float = 0.10
    fixed_cost: float = 12.0
    min_price: float = 40.0

    def final_price_for_base(self, base_price: float) -> float:
        price = (base_price + self.fixed_cost) / max(1e-9, (1.0 - self.commission_rate))
        return math.ceil(price * 100.0) / 100.0


@dataclass
class BundleConfig:
    individual_sizes: List[int] = field(default_factory=lambda: [2, 3, 4, 6])
    mixed_sizes: List[int] = field(default_factory=lambda: [2, 3, 4, 6])
    max_multiplier_per_brand: int = 11
    max_total_units: int = 10

    def max_bundles_for_brand(self, product_count: int) -> int:
        return product_count * self.max_multiplier_per_brand


@dataclass
class CollageConfig:
    width: int = 600
    height: int = 900
    text_band_ratio: float = 0.2
    background_color: tuple = (255, 255, 255)
    accent_color: tuple = (237, 125, 49)
    font_path: Optional[str] = None


@dataclass
class CloudinaryConfig:
    cloud_name: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    folder: str = "smart_bundles"

    @property
    def is_configured(self) -> bool:
        return bool(self.cloud_name and self.api_key and self.api_secret)


BundleGroup = Dict[str, List[Bundle]]
