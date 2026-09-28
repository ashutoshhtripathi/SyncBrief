from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from backend.app.database import get_db
from backend.app.models import User
from backend.app.schemas import LoginRequest, DemoLoginRequest, TokenResponse, UserProfile
from backend.app.auth_utils import verify_password, create_access_token
from backend.app.auth_deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "title": user.title,
            "avatar_url": user.avatar_url,
            "timezone": user.timezone,
            "reminder_time": user.reminder_time,
            "streak_count": user.streak_count
        }
    }

@router.post("/demo-login", response_model=TokenResponse)
def demo_login(req: DemoLoginRequest, db: Session = Depends(get_db)):
    """1-Click login for hackathon judges and demo presentations."""
    if req.user_id:
        user = db.query(User).filter(User.id == req.user_id).first()
    elif req.role == "manager":
        user = db.query(User).filter(User.role == "manager").first()
    else:
        # Default member: Priya Sharma (hero scenario engineer)
        user = db.query(User).filter(User.full_name.ilike("%Priya%")).first() or db.query(User).filter(User.role == "member").first()

    if not user:
        raise HTTPException(status_code=404, detail="Demo user not found")

    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "title": user.title,
            "avatar_url": user.avatar_url,
            "timezone": user.timezone,
            "reminder_time": user.reminder_time,
            "streak_count": user.streak_count
        }
    }

@router.get("/me")
def get_current_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "title": current_user.title,
        "avatar_url": current_user.avatar_url,
        "timezone": current_user.timezone,
        "reminder_time": current_user.reminder_time,
        "streak_count": current_user.streak_count
    }

@router.get("/users", response_model=List[UserProfile])
def list_all_team_members(db: Session = Depends(get_db)):
    """List all team members across timezones."""
    return db.query(User).all()
