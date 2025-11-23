from __future__ import annotations

from collections import Counter
from typing import List, Optional, Sequence, Tuple
import json
import os

from .models import Bundle, Order, Product
from .llm_client import call_llm_json, load_llm_config


def rank_bundles(
    bundles: Sequence[Bundle],
    orders: Optional[Sequence[Order]] = None,
    top_n: Optional[int] = None,
) -> List[Tuple[Bundle, float]]:
    """
    Score bundles using a lightweight heuristic:
    - demand boost if items appeared in recent orders
    - preference for healthier margin
    - slight penalty for very expensive bundles to keep prices accessible
    """
    order_counts: Counter[str] = Counter()
    if orders:
        for order in orders:
            order_counts[order.product_sku] += order.quantity

    scored: List[Tuple[Bundle, float]] = []
    for bundle in bundles:
        if getattr(bundle, "max_bundle_stock", 0) <= 0:
            continue

        demand_score = sum(order_counts[item.product.sku] * item.quantity for item in bundle.items)
        margin = max(0.0, bundle.final_price - bundle.base_price)
        price_penalty = bundle.final_price * 0.01
        stock_factor = 1.0 + min(bundle.max_bundle_stock, 50) / 100.0

        score = (demand_score * 2.0 + margin - price_penalty) * stock_factor
        scored.append((bundle, score))

    scored.sort(key=lambda pair: pair[1], reverse=True)
    if top_n:
        return scored[:top_n]
    return scored


def select_and_enrich_top_bundles_with_llm(
    ranked_bundles: Sequence[Bundle],
    orders: Sequence[Order],
) -> List[Bundle]:
    """
    Primește bundle-urile deja ordonate clasic (rank_bundles).
    Trimite la LLM doar primele N candidați, LLM alege M din ei
    și generează marketing copy pentru M.
    Restul rămân cu copy fallback.
    """
    if not ranked_bundles:
        return []

    cfg = load_llm_config()
    if cfg.provider == "none":
        max_selected = int(os.getenv("AI_MAX_SELECTED_BY_LLM", "5"))
        return list(ranked_bundles)[:max_selected]

    max_candidates = int(os.getenv("AI_MAX_CANDIDATES_FOR_LLM", "10"))
    candidates = list(ranked_bundles[:max_candidates])

    # Demand score din comenzi
    order_counts: Counter[str] = Counter()
    for o in orders:
        order_counts[o.product_sku] += o.quantity

    # Pregătim payload-ul pentru LLM
    candidates_payload = []
    for b in candidates:
        demand_score = sum(order_counts[item.product.sku] * item.quantity for item in b.items)
        items_summary = [
            {
                "sku": item.product.sku,
                "name": item.product.name,
                "qty": item.quantity,
                "brand": item.product.brand,
                "category": item.product.category,
            }
            for item in b.items
        ]
        candidates_payload.append(
            {
                "sku": b.sku,
                "brand": b.brand,
                "category": b.category,
                "final_price": b.final_price,
                "base_price": b.base_price,
                "max_stock": getattr(b, "max_bundle_stock", 0),
                "demand_score": demand_score,
                "items": items_summary,
            }
        )

    max_selected = int(os.getenv("AI_MAX_SELECTED_BY_LLM", "5"))

    prompt_obj = {
        "goal": "Select and enrich the best bundle offers for a small retailer.",
        "instructions": [
            "You are a senior e-commerce merchandiser and marketing copywriter.",
            "You receive up to 10 bundle candidates as JSON.",
            "Each bundle has: price, stock, a demand_score, and items with brand/category.",
            f"Your task is to select up to {max_selected} bundles that are most promising to promote.",
            "Then, for each selected bundle, you must write Romanian marketing copy.",
            "Prefer bundles that:",
            "- combine products that make sense together (brand/category)",
            "- have reasonable final_price for end customers",
            "- have enough stock",
            "- have decent demand_score",
            "Return STRICT JSON with this shape:",
            "{",
            '  "selected": [',
            "    {",
            '      "sku": "bundle_sku",',
            '      "score": 0-100,',
            '      "reason": "short explanation in English",',
            '      "title": "short Romanian title (max 120 chars)",',
            '      "description": "2-3 sentences in Romanian",',
            '      "benefits": ["bullet 1", "bullet 2", ...]',
            "    },",
            "    ...",
            "  ]",
            "}",
        ],
        "candidates": candidates_payload,
    }

    system_prompt = (
        "You are an expert retail merchandiser and Romanian e-commerce copywriter. "
        "You must respond ONLY with valid JSON as described."
    )

    result = call_llm_json(
        prompt=json.dumps(prompt_obj, ensure_ascii=False),
        cfg=cfg,
        system_prompt=system_prompt,
    )

    selected_info = result.get("selected", []) or []
    if not isinstance(selected_info, list):
        selected_info = []

    info_by_sku = {entry.get("sku"): entry for entry in selected_info if entry.get("sku")}

    enhanced: List[Bundle] = []
    for b in candidates:
        entry = info_by_sku.get(b.sku)
        if not entry:
            continue

        b.llm_score = float(entry.get("score", 0.0))
        b.llm_reason = entry.get("reason") or ""

        b.marketing_title = entry.get("title") or b.title
        b.marketing_description = entry.get("description") or ""
        benefits = entry.get("benefits")
        if isinstance(benefits, list):
            b.marketing_benefits = "\n".join(f"- {txt}" for txt in benefits)
        elif isinstance(benefits, str):
            b.marketing_benefits = benefits
        else:
            b.marketing_benefits = ""

        enhanced.append(b)

    enhanced.sort(key=lambda x: x.llm_score or 0.0, reverse=True)
    return enhanced


def choose_best_bundles_with_llm(
    bundles: Sequence[Bundle],
    products: Sequence[Product],
    top_n: int = 10,
    client: Optional[object] = None,
    orders: Optional[Sequence[Order]] = None,
) -> List[Bundle]:
    """
    Wrapper to keep backward compatibility with earlier interface.
    Uses select_and_enrich_top_bundles_with_llm when LLM is configured, otherwise falls back to heuristic top N.
    """
    orders = orders or []
    ranked = rank_bundles(bundles, orders=orders, top_n=top_n * 2 if top_n else None)
    ranked_bundles = [b for b, _ in ranked] if ranked and isinstance(ranked[0], tuple) else ranked

    cfg = load_llm_config()
    if cfg.provider == "none":
        return ranked_bundles[:top_n] if top_n else ranked_bundles

    enhanced = select_and_enrich_top_bundles_with_llm(ranked_bundles, orders)
    if not enhanced:
        return ranked_bundles[:top_n] if top_n else ranked_bundles
    return enhanced[:top_n] if top_n else enhanced


def enrich_bundle_with_marketing_text(
    bundle: Bundle,
    products: Sequence[Product],
    client: Optional[object] = None,
) -> Bundle:
    """
    Simple enrichment: ask LLM for title/description JSON.
    If LLM not configured or fails, returns the bundle unchanged.
    """
    cfg = load_llm_config()
    if cfg.provider == "none":
        return bundle

    item_lines = []
    for it in bundle.items:
        item_lines.append(f"- {it.quantity} x {it.product.name} ({it.product.brand}, {it.product.category})")

    prompt_obj = {
        "goal": "Create a short marketing title and 2-sentence description for this bundle.",
        "bundle": {
            "sku": bundle.sku,
            "price": bundle.final_price,
            "stock": bundle.max_bundle_stock,
        },
        "items": item_lines,
        "response_format": {"title": "string", "description": "string"},
    }

    system_prompt = "You are a concise e-commerce copywriter. Respond with JSON: {\"title\": \"...\", \"description\": \"...\"}."
    result = call_llm_json(prompt=json.dumps(prompt_obj, ensure_ascii=False), cfg=cfg, system_prompt=system_prompt)
    if not isinstance(result, dict):
        return bundle

    try:
        bundle.title = result.get("title", bundle.title)
        bundle.description = result.get("description", bundle.description)
    except Exception:
        pass
    return bundle
