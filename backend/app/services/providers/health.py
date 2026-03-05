from __future__ import annotations
from typing import Dict, Any
import json
from urllib import request, parse

from ...config import Settings


def _http_get(url: str, headers: dict) -> dict:
    req = request.Request(url, headers=headers, method="GET")
    with request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
        try:
            return json.loads(body)
        except Exception:
            return {"raw": body}


def check_chat_provider(cfg: Settings) -> Dict[str, Any]:
    name = (cfg.chat_provider or "openai").lower()
    try:
        if name == "openai":
            # List models as a lightweight auth check
            from openai import OpenAI

            client = OpenAI(api_key=cfg.openai_api_key)
            _ = client.models.list()
            return {"provider": name, "ok": True}
        if name in ("gemini", "google"):
            key = cfg.google_api_key
            if not key:
                return {"provider": name, "ok": False, "error": "GOOGLE_API_KEY missing"}
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={parse.quote(key)}"
            data = _http_get(url, headers={})
            ok = bool(data.get("models")) or "raw" in data
            return {"provider": name, "ok": ok, "details": "models listed"}
        if name in ("anthropic", "claude"):
            key = cfg.anthropic_api_key
            if not key:
                return {"provider": name, "ok": False, "error": "ANTHROPIC_API_KEY missing"}
            data = _http_get("https://api.anthropic.com/v1/models", headers={"x-api-key": key, "anthropic-version": "2023-06-01"})
            ok = bool(data.get("data")) or "raw" in data
            return {"provider": name, "ok": ok, "details": "models listed"}
        return {"provider": name, "ok": False, "error": f"Unknown provider {name}"}
    except Exception as e:
        return {"provider": name, "ok": False, "error": str(e)}


def check_embedding_provider(cfg: Settings) -> Dict[str, Any]:
    name = (cfg.embedding_provider or "openai").lower()
    try:
        if name == "openai":
            from openai import OpenAI

            client = OpenAI(api_key=cfg.openai_api_key)
            _ = client.models.list()
            return {"provider": name, "ok": True}
        if name in ("gemini", "google"):
            key = cfg.google_api_key
            if not key:
                return {"provider": name, "ok": False, "error": "GOOGLE_API_KEY missing"}
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={parse.quote(key)}"
            data = _http_get(url, headers={})
            ok = bool(data.get("models")) or "raw" in data
            return {"provider": name, "ok": ok, "details": "models listed"}
        if name in ("anthropic", "claude"):
            return {"provider": name, "ok": False, "error": "Embeddings not supported; choose openai or gemini"}
        return {"provider": name, "ok": False, "error": f"Unknown provider {name}"}
    except Exception as e:
        return {"provider": name, "ok": False, "error": str(e)}

