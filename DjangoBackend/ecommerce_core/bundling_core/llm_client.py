from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests


@dataclass
class LLMConfig:
    provider: str  # "openrouter" or "none"
    model: str
    temperature: float = 0.3


def _call_openrouter_json(
    prompt: str,
    cfg: LLMConfig,
    system_prompt: Optional[str],
) -> Dict[str, Any]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY missing")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    system_msg = system_prompt or "You are a helpful AI that replies with strict JSON only."

    data = {
        "model": cfg.model,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": prompt},
        ],
        "temperature": cfg.temperature,
    }

    resp = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        json=data,
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    return json.loads(content)


def load_llm_config() -> LLMConfig:
    provider = os.getenv("AI_PROVIDER", "none").lower()
    model = os.getenv("AI_MODEL", "")
    if provider == "openrouter" and not model:
        model = "openrouter/auto"
    return LLMConfig(provider=provider, model=model or "")


def call_llm_json(
    prompt: str,
    cfg: Optional[LLMConfig] = None,
    system_prompt: Optional[str] = None,
) -> Dict[str, Any]:
    cfg = cfg or load_llm_config()
    if cfg.provider == "openrouter":
        try:
            return _call_openrouter_json(prompt, cfg, system_prompt)
        except requests.HTTPError as exc:
            print(f"[llm] HTTP error: {exc}")
            return {}
        except Exception as exc:
            print(f"[llm] error calling LLM: {exc}")
            return {}
    return {}


class LLMClient:
    """Compatibility wrapper for existing imports."""

    def __init__(self, cfg: LLMConfig):
        self.cfg = cfg

    @classmethod
    def from_env(cls) -> Optional["LLMClient"]:
        cfg = load_llm_config()
        if cfg.provider == "none":
            return None
        return cls(cfg)

    def chat(self, messages: list[dict], max_tokens: int = 256, temperature: float = 0.2) -> Optional[str]:
        prompt_parts = []
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            prompt_parts.append(f"{role}: {content}")
        prompt = "\n".join(prompt_parts)
        cfg = self.cfg
        cfg.temperature = temperature
        try:
            result = call_llm_json(prompt, cfg=cfg, system_prompt=None)
            if isinstance(result, dict) and "content" in result:
                return str(result["content"])
            if isinstance(result, dict):
                return json.dumps(result)
            return None
        except Exception:
            return None
