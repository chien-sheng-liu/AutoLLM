from fastapi import APIRouter, Depends, HTTPException, status

from ..config import load_config
from ..dependencies.auth import get_current_user
from ..models.auth import (
    LoginRequest,
    LogoutResponse,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from ..services.auth import create_access_token, hash_password, verify_password
from pydantic import BaseModel, Field
from ..services.users import to_user_out
from ..storage.user_store import get_user_store

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=6)
    new_password: str = Field(min_length=6)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest):
    cfg = load_config()
    store = get_user_store(cfg)
    hashed = hash_password(payload.password)
    try:
        # First user becomes admin automatically
        auth = "user"
        if store.count_users() == 0 and not store.any_admin_exists():
            auth = "admin"
        user = store.create_user(payload.email, hashed, payload.name, auth=auth)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered") from None
    return to_user_out(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    cfg = load_config()
    store = get_user_store(cfg)
    user = store.get_by_email(payload.email)
    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token(user_id=user["id"], email=user["email"], settings=cfg)
    return TokenResponse(access_token=token, user=to_user_out(user))


@router.get("/me", response_model=UserOut)
def me(current_user: UserOut = Depends(get_current_user)):
    return current_user


@router.post("/logout", response_model=LogoutResponse)
def logout() -> LogoutResponse:
    # Stateless JWT logout—client drops the token.
    return LogoutResponse()


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, current_user: UserOut = Depends(get_current_user)):
    cfg = load_config()
    store = get_user_store(cfg)
    record = store.get_by_id(current_user.id)
    if not record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not verify_password(payload.current_password, record["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")
    new_hashed = hash_password(payload.new_password)
    store.update_password(current_user.id, new_hashed)
    return {"ok": True}
