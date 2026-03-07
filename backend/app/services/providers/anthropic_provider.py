from __future__ import annotations
from typing import List
import json
from urllib import request

from .base import ChatProvider


def _http_post(url: str, payload: dict, headers: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, headers={"Content-Type": "application/json", **headers}, method="POST")
    with request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body)


class AnthropicChatProvider(ChatProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def complete(self, messages: List[dict], model: str, temperature: float = 0.2, *, max_tokens: int | None = None, top_p: float | None = None, **_: dict) -> str:
        # Anthropic Messages API expects system prompt separately and messages without system
        system = None
        converted: List[dict] = []
        for m in messages:
            role = m.get("role")
            if role == "system" and system is None:
                system = m.get("content", "")
            else:
                if role not in ("user", "assistant"):
                    role = "user"
                converted.append({"role": role, "content": m.get("content", "")})
        payload = {
            "model": model,
            "max_tokens": int(max_tokens) if max_tokens is not None else 1024,
            "temperature": temperature,
            "messages": converted,
        }
        if top_p is not None:
            payload["top_p"] = float(top_p)
        if system:
            payload["system"] = system
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
        }
        data = _http_post("https://api.anthropic.com/v1/messages", payload, headers)
        try:
            return data["content"][0]["text"]
        except Exception:
            return data.get("output_text") or ""
