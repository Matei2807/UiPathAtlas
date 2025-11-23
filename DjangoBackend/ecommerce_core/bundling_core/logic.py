from __future__ import annotations

from collections import Counter, defaultdict
from itertools import combinations_with_replacement
from typing import Dict, Iterable, List, Optional, Tuple

from .models import (
    Bundle,
    BundleConfig,
    BundleItem,
    Order,
    PricingConfig,
    Product,
)


def _bundle_key(items: List[BundleItem]) -> Tuple[Tuple[str, int], ...]:
    pairs = [(item.product.sku, item.quantity) for item in items]
    return tuple(sorted(pairs, key=lambda p: p[0]))


def _build_title(brand: str, items: List[BundleItem]) -> str:
    total_qty = sum(item.quantity for item in items)
    unique_skus = {item.product.sku for item in items}
    if len(unique_skus) == 1:
        return f"Set {total_qty} x {items[0].product.name}"
    parts = [f"{item.quantity}x {item.product.name}" for item in items]
    return f"Set {total_qty} {brand} Mix: " + ", ".join(parts)


def _build_sku(items: List[BundleItem]) -> str:
    parts = ["PACK"]
    for item in sorted(items, key=lambda i: i.product.sku):
        parts.append(f"{item.product.sku}-x{item.quantity}")
    return "-".join(parts)


def _build_description(items: List[BundleItem], brand: str) -> str:
    lines = [f"Promotional bundle for {brand} containing:"]
    for item in items:
        lines.append(f"- {item.quantity} x {item.product.name}")
    return "\n".join(lines)


def _is_compatible(items: List[BundleItem]) -> bool:
    brands = {item.product.brand for item in items}
    categories = {item.product.category for item in items}
    return len(brands) == 1 or len(categories) == 1


def compute_max_bundle_stock(
    component_skus: List[str],
    component_quantities: List[int],
    products: List[Product],
) -> int:
    """
    Compute how many bundles can be produced given available stock per component.
    Returns 0 if any component is missing or insufficient.
    """
    if len(component_skus) != len(component_quantities):
        return 0

    product_by_sku: Dict[str, Product] = {p.sku: p for p in products}
    max_bundles = float("inf")

    for sku, qty in zip(component_skus, component_quantities):
        if qty <= 0:
            return 0
        product = product_by_sku.get(sku)
        if not product:
            return 0
        stock = product.available_stock if product.available_stock is not None else 0
        if stock < qty:
            return 0
        max_bundles = min(max_bundles, stock // qty)

    return 0 if max_bundles == float("inf") else int(max_bundles)


def _can_support_quantities(product: Product, qty: int) -> bool:
    if product.available_stock is None:
        return True
    return product.available_stock >= qty


def _create_bundle(
    brand: str,
    items: List[BundleItem],
    pricing: PricingConfig,
    bundle_config: BundleConfig,
    all_products: List[Product],
) -> Optional[Bundle]:
    base_price = sum(item.product.price_with_vat * item.quantity for item in items)
    final_price = pricing.final_price_for_base(base_price)
    if final_price < pricing.min_price:
        return None

    title = _build_title(brand, items)
    sku = _build_sku(items)
    category = (
        items[0].product.category
        if len({i.product.sku for i in items}) == 1
        else f"{items[0].product.category} Mix"
    )
    description = _build_description(items, brand)

    total_units = sum(item.quantity * (item.product.units_per_pack or 1) for item in items)
    if total_units > bundle_config.max_total_units:
        return None
    vat_rate = items[0].product.vat_rate if items else 0

    component_skus = [item.product.sku for item in items]
    component_quantities = [item.quantity for item in items]
    max_bundle_stock = compute_max_bundle_stock(component_skus, component_quantities, all_products)
    if max_bundle_stock <= 0:
        return None

    return Bundle(
        sku=sku,
        title=title,
        brand=brand,
        category=category,
        items=items,
        base_price=round(base_price, 2),
        final_price=final_price,
        vat_rate=vat_rate,
        total_units=total_units,
        max_bundle_stock=max_bundle_stock,
        description=description,
    )


def _eligible_products(products: Iterable[Product]) -> List[Product]:
    eligible = []
    for product in products:
        if not product.bundle_enabled:
            continue
        if product.price_with_vat <= 0:
            continue
        if product.available_stock is not None and product.available_stock <= 0:
            continue
        eligible.append(product)
    return eligible


def build_transactions_from_orders(orders: List[Order]) -> Dict[str, Dict[str, int]]:
    """Build a mapping: order_id -> {product_sku: quantity}."""
    tx: Dict[str, Dict[str, int]] = defaultdict(dict)
    for order in orders:
        order_id = str(order.order_id)
        sku = str(order.product_sku)
        tx[order_id][sku] = tx[order_id].get(sku, 0) + int(order.quantity)
    return tx


def _pattern_candidates_from_orders(
    products: List[Product],
    orders: List[Order],
    bundle_config: BundleConfig,
    pricing: PricingConfig,
) -> List[Bundle]:
    """Generate candidates from co-occurrence patterns (1+1, 2+1, 3+2) grounded in orders."""
    product_by_sku: Dict[str, Product] = {p.sku: p for p in _eligible_products(products)}
    tx = build_transactions_from_orders(orders)
    patterns = [
        (1, 1, "1+1"),
        (2, 1, "2+1"),
        (3, 2, "3+2"),
    ]
    min_occurrences = 1
    pattern_counts: Counter[Tuple[str, str, Tuple[int, int, str]]] = Counter()

    for items in tx.values():
        skus = list(items.keys())
        for i in range(len(skus)):
            for j in range(i + 1, len(skus)):
                s1, s2 = skus[i], skus[j]
                q1, q2 = items[s1], items[s2]
                for a_qty, b_qty, label in patterns:
                    if q1 >= a_qty and q2 >= b_qty:
                        pattern_counts[(s1, s2, (a_qty, b_qty, label))] += 1
                    if q2 >= a_qty and q1 >= b_qty:
                        pattern_counts[(s2, s1, (a_qty, b_qty, label))] += 1

    bundles: List[Bundle] = []
    seen_keys: set = set()
    for (sku_a, sku_b, (qa, qb, label)), count in pattern_counts.items():
        if count < min_occurrences:
            continue
        prod_a = product_by_sku.get(sku_a)
        prod_b = product_by_sku.get(sku_b)
        if not prod_a or not prod_b:
            continue
        if not (prod_a.bundle_enabled and prod_b.bundle_enabled):
            continue
        items = [
            BundleItem(product=prod_a, quantity=qa),
            BundleItem(product=prod_b, quantity=qb),
        ]
        if not _is_compatible(items):
            continue
        key = _bundle_key(items)
        if key in seen_keys:
            continue
        brand = prod_a.brand if prod_a.brand == prod_b.brand else "Mixed"
        bundle = _create_bundle(brand, items, pricing, bundle_config, products)
        if bundle:
            bundle.title = f"{bundle.title} ({label})"
            seen_keys.add(key)
            bundles.append(bundle)

    return bundles


def _fallback_brand_bundles(
    products: List[Product],
    pricing: PricingConfig,
    bundle_config: BundleConfig,
) -> List[Bundle]:
    """Original brand-based generation as a fallback when no orders exist."""
    bundles: List[Bundle] = []
    seen_keys: Dict[str, set] = defaultdict(set)

    products_by_brand: Dict[str, List[Product]] = defaultdict(list)
    for product in _eligible_products(products):
        products_by_brand[product.brand].append(product)

    for brand, brand_products in products_by_brand.items():
        max_for_brand = bundle_config.max_bundles_for_brand(len(brand_products))
        count_for_brand = 0

        # Individual bundles
        for product in brand_products:
            for size in bundle_config.individual_sizes:
                if count_for_brand >= max_for_brand:
                    break
                if not _can_support_quantities(product, size):
                    continue
                items = [BundleItem(product=product, quantity=size)]
                key = _bundle_key(items)
                if key in seen_keys[brand]:
                    continue
                bundle = _create_bundle(brand, items, pricing, bundle_config, products)
                if bundle:
                    bundles.append(bundle)
                    seen_keys[brand].add(key)
                    count_for_brand += 1

        # Mixed bundles
        for size in bundle_config.mixed_sizes:
            combos = combinations_with_replacement(brand_products, size)
            for combo in combos:
                if count_for_brand >= max_for_brand:
                    break
                counts = Counter(p.sku for p in combo)
                if len(counts) <= 1:
                    continue
                stock_ok = True
                for sku, qty in counts.items():
                    product = next(p for p in combo if p.sku == sku)
                    if not _can_support_quantities(product, qty):
                        stock_ok = False
                        break
                if not stock_ok:
                    continue
                items = [
                    BundleItem(
                        product=next(p for p in combo if p.sku == sku),
                        quantity=qty,
                    )
                    for sku, qty in counts.items()
                ]
                key = _bundle_key(items)
                if key in seen_keys[brand]:
                    continue
                bundle = _create_bundle(brand, items, pricing, bundle_config, products)
                if bundle:
                    bundles.append(bundle)
                    seen_keys[brand].add(key)
                    count_for_brand += 1

    return bundles


def generate_bundles(
    products: List[Product],
    pricing: PricingConfig,
    bundle_config: BundleConfig,
    orders: Optional[List[Order]] = None,
) -> List[Bundle]:
    """Generate bundle proposals using order-driven patterns when available, else fallback."""
    orders = orders or []
    if orders:
        bundles = _pattern_candidates_from_orders(products, orders, bundle_config, pricing)
        if bundles:
            return bundles
    return _fallback_brand_bundles(products, pricing, bundle_config)
