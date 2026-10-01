from typing import Set, List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from backend.app.models import User, Task

def get_subordinate_ids(user: User, db: Session) -> Set[int]:
    """
    Recursively fetch all user IDs reporting directly or indirectly to the given user.
    """
    subordinates: Set[int] = set()
    queue: List[int] = [user.id]

    while queue:
        current_id = queue.pop(0)
        direct_reports = db.query(User).filter(User.reports_to_id == current_id).all()
        for report in direct_reports:
            if report.id not in subordinates:
                subordinates.add(report.id)
                queue.append(report.id)

    return subordinates

def can_view_user(current_user: User, target_user_id: int, db: Session) -> bool:
    """
    Visibility Rule Enforced in Backend:
    A user can view their own data, or data of anyone in their subordinate reporting tree.
    Top-level admin/director (role_level == 1 or role == 'admin') can view everyone.
    Peers and superiors cannot be viewed.
    """
    if current_user.id == target_user_id:
        return True
    
    if current_user.role in ["admin", "director"] or current_user.role_level == 1:
        return True

    subordinates = get_subordinate_ids(current_user, db)
    return target_user_id in subordinates

def enforce_hierarchy_access(current_user: User, target_user_id: int, db: Session) -> None:
    """
    Raises HTTP 403 if current_user does not have hierarchy access to target_user_id.
    """
    if not can_view_user(current_user, target_user_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only view your own records or those of direct and indirect reports in your organizational hierarchy."
        )

def calculate_task_points(difficulty: int, carried_over_count: int, penalty_pct: float = 25.0) -> float:
    """
    Points Formula:
    Completing a task within its initial sprint awards full points (difficulty).
    Each carry-over reduces points by penalty_pct (default 25%, min 0).
    Points = max(0, difficulty * (1 - (penalty_pct / 100) * carried_over_count))
    """
    factor = 1.0 - (penalty_pct / 100.0) * max(0, carried_over_count)
    earned = difficulty * factor
    return max(0.0, round(earned, 2))
