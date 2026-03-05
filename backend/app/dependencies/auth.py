from fastapi import Header, HTTPException, status

from ..config import load_config
from ..models.auth import UserOut
from ..services.auth import AuthError, decode_access_token
from ..services.users import to_user_out
from ..storage.user_store import get_user_store


def get_current_user(authorization: str | None = Header(default=None, alias="Authorization")) -> UserOut:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization header")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header")
    token = parts[1]
    cfg = load_config()
    try:
        payload = decode_access_token(token, cfg)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    store = get_user_store(cfg)
    record = store.get_by_id(user_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return to_user_out(record)
