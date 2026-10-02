from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Any, Optional
from backend.app.database import get_db
from backend.app.models import User, Checkin, Task, Tenant
from backend.app.schemas import (
    LoginRequest, 
    DemoLoginRequest, 
    TokenResponse, 
    UserProfile, 
    UserCreate, 
    UserUpdate, 
    RefreshTokenRequest,
    TenantResponse
)
from backend.app.auth_utils import verify_password, create_access_token, create_refresh_token, decode_access_token, hash_password
from backend.app.auth_deps import get_current_user
from backend.app.hierarchy import can_view_user, enforce_hierarchy_access, get_subordinate_ids

router = APIRouter(prefix="/auth", tags=["Authentication & Hierarchy"])

def user_to_profile(u: User) -> Dict[str, Any]:
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "title": u.title,
        "avatar_url": u.avatar_url,
        "timezone": u.timezone,
        "reminder_time": u.reminder_time,
        "streak_count": u.streak_count,
        "role_level": u.role_level or 5,
        "reports_to_id": u.reports_to_id,
        "org_type": u.org_type or "engineering",
        "manager_name": u.manager.full_name if u.manager else None,
        "tenant_id": u.tenant_id or 1,
        "tenant_name": u.tenant.name if u.tenant else "SyncBrief Enterprise"
    }

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user using verified Argon2id/bcrypt password hash.
    Enforces real account authentication. Issues JWT bearer token enriched with tenant_id.
    """
    user = db.query(User).filter(User.email == req.email.lower().strip(), User.deleted_at.is_(None)).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    access_token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "tenant_id": user.tenant_id or 1
    })
    refresh_token = create_refresh_token({
        "sub": str(user.id),
        "tenant_id": user.tenant_id or 1
    })
    user.refresh_token = refresh_token
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_to_profile(user)
    }

@router.post("/demo-login", response_model=TokenResponse)
def demo_login():
    """
    Disabled: 1-Click unauthenticated demo login has been removed.
    All users must authenticate with valid credentials via /api/auth/login.
    """
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Demo 1-click login has been disabled in secure multi-tenant mode. Please authenticate via /api/auth/login with registered user credentials."
    )

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(req: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Rotate access token using a valid refresh token."""
    payload = decode_access_token(req.refresh_token)
    if not payload or payload.get("token_type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id), User.deleted_at.is_(None)).first()
    if not user or user.refresh_token != req.refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked or invalid")

    new_access_token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "tenant_id": user.tenant_id or 1
    })
    new_refresh_token = create_refresh_token({
        "sub": str(user.id),
        "tenant_id": user.tenant_id or 1
    })
    user.refresh_token = new_refresh_token
    db.commit()

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "user": user_to_profile(user)
    }

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Invalidate session and refresh token."""
    current_user.refresh_token = None
    db.commit()
    return {"status": "success", "message": "Successfully logged out"}

@router.get("/me")
def get_current_profile(current_user: User = Depends(get_current_user)):
    return user_to_profile(current_user)

@router.get("/tenant", response_model=TenantResponse)
def get_current_tenant(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return organization details for the authenticated user's tenant."""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant organization not found")
    return tenant

@router.get("/users", response_model=List[UserProfile])
def list_all_team_members(
    org_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all team members within the authenticated user's tenant organization."""
    query = db.query(User).filter(
        User.deleted_at.is_(None),
        User.tenant_id == current_user.tenant_id
    )
    if org_type:
        query = query.filter(User.org_type == org_type)
    users = query.order_by(User.role_level.asc(), User.id.asc()).all()
    return [user_to_profile(u) for u in users]

@router.get("/users/my-reports", response_model=List[UserProfile])
def get_my_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns only users who report directly or indirectly to current_user."""
    sub_ids = get_subordinate_ids(current_user, db)
    if not sub_ids:
        return []
    reports = db.query(User).filter(
        User.id.in_(sub_ids),
        User.tenant_id == current_user.tenant_id,
        User.deleted_at.is_(None)
    ).order_by(User.role_level.asc()).all()
    return [user_to_profile(u) for u in reports]

@router.get("/users/{user_id}", response_model=UserProfile)
def get_user_by_id(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get profile of a user.
    ENFORCES HIERARCHY ACCESS: A user can only view themselves or their reports.
    Peers and superiors cannot be viewed.
    """
    enforce_hierarchy_access(current_user, user_id, db)
    user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == current_user.tenant_id,
        User.deleted_at.is_(None)
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_to_profile(user)

@router.get("/hierarchy")
def get_org_hierarchy(
    org_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the organization hierarchy tree scoped strictly to the current user's tenant."""
    query = db.query(User).filter(
        User.deleted_at.is_(None),
        User.tenant_id == current_user.tenant_id
    )
    if org_type:
        query = query.filter(User.org_type == org_type)
    all_users = query.all()

    user_map = {u.id: {**user_to_profile(u), "children": []} for u in all_users}
    roots = []

    for u in all_users:
        node = user_map[u.id]
        if u.reports_to_id and u.reports_to_id in user_map:
            user_map[u.reports_to_id]["children"].append(node)
        else:
            roots.append(node)

    return roots

# --- PII Data Export & Account Deletion (Enterprise Security) ---
@router.get("/me/export")
def export_my_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export all personal data and activity records in compliance with GDPR/PII."""
    from backend.app.api.points import build_user_points_summary

    checkins = db.query(Checkin).filter(Checkin.user_id == current_user.id).all()
    tasks = db.query(Task).filter(Task.assignee_id == current_user.id).all()
    points_summary = build_user_points_summary(current_user, db)

    return {
        "user_profile": user_to_profile(current_user),
        "exported_at": datetime.utcnow().isoformat(),
        "checkins": [
            {
                "id": c.id,
                "date": c.created_at.strftime("%Y-%m-%d") if c.created_at else None,
                "yesterday": c.yesterday,
                "today": c.today,
                "blockers_text": c.blockers_text,
                "status": c.status,
                "created_at": c.created_at.isoformat() if c.created_at else None
            }
            for c in checkins
        ],
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "priority": t.priority,
                "difficulty": t.difficulty,
                "status": t.status,
                "progress_pct": t.progress_pct,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None
            }
            for t in tasks
        ],
        "points_summary": points_summary
    }

@router.post("/me/delete-account")
def delete_my_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Self-service soft delete of user account."""
    from backend.app.audit import log_audit_event

    current_user.deleted_at = datetime.utcnow()
    current_user.refresh_token = None
    db.commit()

    log_audit_event(
        db,
        action="USER_SELF_DELETE",
        entity_type="user",
        entity_id=current_user.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        new_values={"deleted_at": current_user.deleted_at.isoformat()}
    )
    db.commit()

    return {"status": "success", "message": "Account successfully scheduled for deletion"}

# --- Admin User CRUD ---
@router.post("/users", response_model=UserProfile)
def create_user(
    req: UserCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Top-level / manager user creating a new team member."""
    from backend.app.audit import log_audit_event

    if current_user.role not in ["admin", "manager", "director"] and current_user.role_level > 2:
        raise HTTPException(status_code=403, detail="Only Managers or Directors can create new users")

    existing = db.query(User).filter(User.email == req.email.lower().strip(), User.deleted_at.is_(None)).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    reports_to = req.reports_to_id or current_user.id
    if reports_to:
        mgr = db.query(User).filter(
            User.id == reports_to,
            User.tenant_id == current_user.tenant_id,
            User.deleted_at.is_(None)
        ).first()
        if not mgr:
            raise HTTPException(status_code=400, detail="Reporting manager not found in current organization")

    new_user = User(
        email=req.email.lower().strip(),
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        role=req.role,
        title=req.title,
        avatar_url=req.avatar_url or f"https://api.dicebear.com/7.x/avataaars/svg?seed={req.full_name}",
        timezone=req.timezone,
        reminder_time=req.reminder_time,
        role_level=req.role_level,
        reports_to_id=reports_to,
        org_type=req.org_type,
        tenant_id=current_user.tenant_id,
        streak_count=1
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit_event(
        db,
        action="CREATE_USER",
        entity_type="user",
        entity_id=new_user.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        new_values={"email": new_user.email, "role": new_user.role, "role_level": new_user.role_level, "tenant_id": new_user.tenant_id}
    )
    db.commit()

    return user_to_profile(new_user)

@router.put("/users/{user_id}", response_model=UserProfile)
def update_user(
    user_id: int,
    req: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from backend.app.audit import log_audit_event

    if current_user.role not in ["admin", "manager", "director"] and current_user.role_level > 2 and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Permission denied to edit user")

    user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == current_user.tenant_id,
        User.deleted_at.is_(None)
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_vals = {"full_name": user.full_name, "role": user.role, "role_level": user.role_level, "reports_to_id": user.reports_to_id}

    if req.full_name is not None: user.full_name = req.full_name
    if req.title is not None: user.title = req.title
    if req.role is not None: user.role = req.role
    if req.avatar_url is not None: user.avatar_url = req.avatar_url
    if req.timezone is not None: user.timezone = req.timezone
    if req.reminder_time is not None: user.reminder_time = req.reminder_time
    if req.role_level is not None: user.role_level = req.role_level
    if req.reports_to_id is not None:
        if req.reports_to_id == user.id:
            raise HTTPException(status_code=400, detail="User cannot report to themselves")
        mgr = db.query(User).filter(
            User.id == req.reports_to_id,
            User.tenant_id == current_user.tenant_id,
            User.deleted_at.is_(None)
        ).first()
        if not mgr:
            raise HTTPException(status_code=400, detail="Reporting manager not found in current organization")
        user.reports_to_id = req.reports_to_id
    if req.org_type is not None: user.org_type = req.org_type

    log_audit_event(
        db,
        action="UPDATE_USER",
        entity_type="user",
        entity_id=user.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        old_values=old_vals,
        new_values={"full_name": user.full_name, "role": user.role, "role_level": user.role_level, "reports_to_id": user.reports_to_id}
    )

    db.commit()
    db.refresh(user)
    return user_to_profile(user)

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete user (Admin/Director/Manager only, confirmation required)."""
    from backend.app.audit import log_audit_event

    if current_user.role not in ["admin", "manager", "director"] and current_user.role_level > 2:
        raise HTTPException(status_code=403, detail="Only Directors/Managers can delete users")

    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == current_user.tenant_id,
        User.deleted_at.is_(None)
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Reassign direct reports within the tenant to the deleted user's manager
    db.query(User).filter(
        User.reports_to_id == user_id,
        User.tenant_id == current_user.tenant_id
    ).update({"reports_to_id": user.reports_to_id})
    user.deleted_at = datetime.utcnow()
    user.refresh_token = None

    log_audit_event(
        db,
        action="DELETE_USER",
        entity_type="user",
        entity_id=user.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        new_values={"deleted_at": user.deleted_at.isoformat(), "reassigned_reports_to": user.reports_to_id}
    )

    db.commit()
    return {"status": "success", "message": f"User {user.full_name} deactivated successfully (soft delete)"}
