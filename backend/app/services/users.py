from ..models.auth import UserOut
from ..storage.user_store import UserRecord


def to_user_out(record: UserRecord) -> UserOut:
    # Prefer 'auth'; fallback to legacy 'role'
    auth = (record.get("auth") or "").lower() if isinstance(record.get("auth"), str) else ""
    role = (record.get("role") or "").lower() if isinstance(record.get("role"), str) else ""
    # normalize
    if auth == 'administrator':
        auth = 'admin'
    if not auth:
        auth = 'admin' if role == 'admin' else 'user'
    return UserOut(
        id=record["id"],
        email=record["email"],
        name=record.get("name"),
        role='admin' if auth == 'admin' else 'user',
        auth=auth,
        created_at=record["created_at"],
    )
