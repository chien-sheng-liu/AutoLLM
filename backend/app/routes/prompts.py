"""
Prompt management API — admin only.

GET  /api/v1/prompts         List all sections with default + current values
PUT  /api/v1/prompts         Save one or more section overrides
DELETE /api/v1/prompts/{key} Reset a single section to default
POST /api/v1/prompts/reset   Reset ALL sections to default
"""
from typing import Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..config import load_config, save_config
from ..dependencies.auth import require_admin
from ..services.prompts.defaults import list_sections, list_keys, get_default

router = APIRouter(
    prefix="/api/v1/prompts",
    tags=["prompts"],
    dependencies=[Depends(require_admin)],
)


class PromptSection(BaseModel):
    key: str
    label: str
    agent: str
    description: str
    default_value: str
    current_value: str
    is_overridden: bool


class PromptsResponse(BaseModel):
    sections: List[PromptSection]


class PromptUpdatePayload(BaseModel):
    overrides: Dict[str, str]


@router.get("", response_model=PromptsResponse)
def get_prompts():
    """Return all prompt sections with their default and current (overridden) values."""
    cfg = load_config()
    overrides: Dict[str, str] = cfg.prompt_overrides or {}
    sections = []
    for meta in list_sections():
        current = overrides.get(meta.key, "")
        sections.append(PromptSection(
            key=meta.key,
            label=meta.label,
            agent=meta.agent,
            description=meta.description,
            default_value=meta.default_value,
            current_value=current if current else meta.default_value,
            is_overridden=bool(current),
        ))
    return PromptsResponse(sections=sections)


@router.put("")
def update_prompts(payload: PromptUpdatePayload):
    """Save one or more prompt section overrides. Empty string resets that section."""
    cfg = load_config()
    overrides: Dict[str, str] = dict(cfg.prompt_overrides or {})
    valid_keys = set(list_keys())

    for key, value in payload.overrides.items():
        if key not in valid_keys:
            continue  # silently ignore unknown keys
        if value.strip():
            overrides[key] = value.strip()
        else:
            overrides.pop(key, None)  # empty string = reset

    cfg.prompt_overrides = overrides
    save_config(cfg)
    return {"ok": True, "overrides_count": len(overrides)}


@router.delete("/{key}")
def reset_prompt(key: str):
    """Reset a single prompt section to its default value."""
    valid_keys = set(list_keys())
    if key not in valid_keys:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Unknown prompt section: {key}")
    cfg = load_config()
    overrides: Dict[str, str] = dict(cfg.prompt_overrides or {})
    overrides.pop(key, None)
    cfg.prompt_overrides = overrides
    save_config(cfg)
    return {"ok": True, "key": key, "default_value": get_default(key)}


@router.post("/reset")
def reset_all_prompts():
    """Reset ALL prompt sections to their default values."""
    cfg = load_config()
    cfg.prompt_overrides = {}
    save_config(cfg)
    return {"ok": True}
