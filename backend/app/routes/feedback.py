from fastapi import APIRouter, Depends, HTTPException

from ..config import load_config
from ..dependencies.auth import get_current_user
from ..models.auth import UserOut
from ..models.chat import FeedbackRequest, FeedbackResponse
from ..storage.chat_store import get_chat_store


router = APIRouter(
    prefix="/api/v1",
    tags=["feedback"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/feedback", response_model=FeedbackResponse)
def submit_feedback(payload: FeedbackRequest, current_user: UserOut = Depends(get_current_user)):
    cfg = load_config()
    store = get_chat_store(cfg)
    vote_val = 1 if payload.vote == "up" else -1
    try:
        store.add_feedback(user_id=current_user.id, answer_id=payload.answer_id, vote=vote_val)
    except Exception as e:
        # Don’t leak DB details to client
        raise HTTPException(status_code=500, detail="Failed to record feedback") from e
    return FeedbackResponse(ok=True)

