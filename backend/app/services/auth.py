from datetime import datetime, timedelta
from typing import Any, Dict

import jwt
from passlib.context import CryptContext

from ..config import Settings

# bcrypt_sha256 avoids the 72-byte bcrypt password limit by hashing with sha256 first.
pwd_context = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto")


class AuthError(Exception):
    """Raised when authentication fails."""


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(password, hashed_password)
    except ValueError:
        return False


def create_access_token(user_id: str, email: str, settings: Settings, expires_minutes: int | None = None) -> str:
    lifetime = expires_minutes or settings.jwt_access_token_minutes
    expire = datetime.utcnow() + timedelta(minutes=lifetime)
    payload = {"sub": user_id, "email": email, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str, settings: Settings) -> Dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthError("invalid token") from exc
