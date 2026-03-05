from ..models.auth import UserOut
from ..storage.user_store import UserRecord


def to_user_out(record: UserRecord) -> UserOut:
    return UserOut(
        id=record["id"],
        email=record["email"],
        name=record.get("name"),
        created_at=record["created_at"],
    )
