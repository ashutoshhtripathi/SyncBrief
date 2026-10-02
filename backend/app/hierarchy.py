from typing import Set, List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from backend.app.models import User, Task

def get_subordinate_ids(user: User, db: Session) -> Set[int]:
    """
    Recursively fetch all user IDs reporting directly or indirectly to the given user,
    strictly restricted to the user's tenant organization.
    """
    subordinates: Set[int] = set()
    queue: List[int] = [user.id]

    while queue:
        current_id = queue.pop(0)
        query = db.query(User).filter(
            User.reports_to_id == current_id,
            User.deleted_at.is_(None)
        )
        if user.tenant_id is not None:
            query = query.filter(User.tenant_id == user.tenant_id)
            
        direct_reports = query.all()
        for report in direct_reports:
            if report.id not in subordinates:
                subordinates.add(report.id)
                queue.append(report.id)

    return subordinates

def get_accessible_user_ids(current_user: User, db: Session) -> Set[int]:
    """
    Returns the set of user IDs whose data the current_user is authorized to view.
    - Director/Admin: All active users in the same tenant organization.
    - Manager: The manager themselves plus their direct and indirect subordinate reports.
    - Employee: Strictly only their own user ID.
    """
    if current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1):
        query = db.query(User.id).filter(User.deleted_at.is_(None))
        if current_user.tenant_id is not None:
            query = query.filter(User.tenant_id == current_user.tenant_id)
        return {u[0] for u in query.all()}

    subordinates = get_subordinate_ids(current_user, db)
    if current_user.role in ["manager"] or (current_user.role_level is not None and current_user.role_level == 2) or len(subordinates) > 0:
        return {current_user.id} | subordinates

    # Regular employee with no reports
    return {current_user.id}

def can_view_user(current_user: User, target_user_id: int, db: Session) -> bool:
    """
    Visibility Rule Enforced in Backend:
    1. Multi-tenant barrier: Target user must belong to the exact same tenant organization.
    2. Hierarchy rule: A user can view their own data, or data of anyone in their subordinate reporting tree.
       Top-level admin/director (role_level == 1 or role == 'admin') can view everyone within their organization.
       Peers and superiors cannot be viewed.
    """
    if current_user.id == target_user_id:
        return True

    target_user = db.query(User).filter(User.id == target_user_id, User.deleted_at.is_(None)).first()
    if not target_user:
        return False

    # Multi-tenant isolation boundary
    if current_user.tenant_id and target_user.tenant_id and current_user.tenant_id != target_user.tenant_id:
        return False

    if current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1):
        return True

    subordinates = get_subordinate_ids(current_user, db)
    return target_user_id in subordinates

def enforce_hierarchy_access(current_user: User, target_user_id: int, db: Session) -> None:
    """
    Raises HTTP 403 or 404 if current_user does not have hierarchy access to target_user_id.
    """
    if current_user.id == target_user_id:
        return

    target_user = db.query(User).filter(User.id == target_user_id).first()
    if not target_user or target_user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found."
        )

    if current_user.tenant_id and target_user.tenant_id and current_user.tenant_id != target_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot access users from a different organization."
        )

    if not can_view_user(current_user, target_user_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only view your own records or those of direct and indirect reports in your organizational hierarchy."
        )

def enforce_tenant_access(current_user: User, entity_tenant_id: Optional[int]) -> None:
    """
    Enforces that an entity belongs to the current user's tenant organization.
    """
    if current_user.tenant_id is not None and entity_tenant_id is not None and current_user.tenant_id != entity_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Access denied to resource in a different organization."
        )

def can_manage_user(current_user: User, target_user: User, db: Session) -> bool:
    """
    Determines if current_user has management authority to edit or delete target_user.
    - Multi-tenant isolation: Both must belong to the exact same tenant organization.
    - Users cannot administratively manage or delete themselves.
    - Director (L1) / Admin: Can manage any user within their tenant organization.
    - Manager (L2):
        * Can NOT modify or delete Director (L1) accounts.
        * Can NOT modify or delete peer Manager (L2) accounts.
        * Can ONLY manage Employees (L3+) who are strictly in their own subordinate reporting hierarchy.
    - Employee (L3+):
        * Cannot manage or delete any users.
    """
    if current_user.tenant_id is not None and target_user.tenant_id is not None and current_user.tenant_id != target_user.tenant_id:
        return False

    if current_user.id == target_user.id:
        return False

    # Director / Admin (Level 1)
    if current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1):
        return True

    # Manager (Level 2)
    is_manager = current_user.role == "manager" or (current_user.role_level is not None and current_user.role_level == 2)
    if is_manager:
        # Cannot modify Director
        if target_user.role in ["admin", "director"] or (target_user.role_level is not None and target_user.role_level <= 1):
            return False
        # Cannot modify peer Manager
        if target_user.role == "manager" or (target_user.role_level is not None and target_user.role_level <= 2):
            return False
        # Must be in caller's reporting hierarchy
        subordinates = get_subordinate_ids(current_user, db)
        return target_user.id in subordinates

    # Employee (Level 3+)
    return False

def enforce_can_manage_user(current_user: User, target_user: User, db: Session) -> None:
    """
    Enforces that current_user has management authority over target_user.
    Raises HTTP 403 Forbidden with clear diagnostic error message.
    """
    if current_user.tenant_id is not None and target_user.tenant_id is not None and current_user.tenant_id != target_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot manage users from a different organization."
        )

    # Check caller authority: only Director (L1) and Manager (L2) can manage other users
    is_director = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    is_manager = current_user.role == "manager" or (current_user.role_level is not None and current_user.role_level == 2)
    if not is_director and not is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Employees do not have permission to manage other users."
        )

    # Manager restrictions
    if not is_director:
        target_is_director = target_user.role in ["admin", "director"] or (target_user.role_level is not None and target_user.role_level <= 1)
        if target_is_director:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Managers cannot modify or delete Director accounts."
            )

        target_is_manager = target_user.role == "manager" or (target_user.role_level is not None and target_user.role_level <= 2)
        if target_is_manager:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Managers cannot modify or delete peer Manager accounts."
            )

    if not can_manage_user(current_user, target_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have authorization to manage this user."
        )

def enforce_can_assign_role(
    current_user: User,
    target_role: Optional[str],
    target_role_level: Optional[int]
) -> None:
    """
    Prevents unauthorized privilege escalation when creating or updating a user.
    - Only Directors/Admins (L1) can assign Director (L1) or Manager (L2) roles or levels <= 2.
    - Managers (L2) can ONLY create/update users to Employee roles (role_level >= 3, not admin/director/manager).
    - Employees (L3) cannot assign any roles or role levels.
    """
    is_director = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    if is_director:
        return

    is_manager = current_user.role == "manager" or (current_user.role_level is not None and current_user.role_level == 2)
    if is_manager:
        if target_role and target_role.lower() in ["admin", "director", "manager"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Managers cannot create or promote users to Director or Manager roles."
            )
        if target_role_level is not None and target_role_level <= 2:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Managers cannot grant role level 1 or 2 privileges."
            )
        return

    # Employee
    if target_role or target_role_level is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Employees cannot modify organizational roles or role levels."
        )

def enforce_can_assign_reports_to(
    current_user: User,
    reports_to_id: Optional[int],
    db: Session
) -> None:
    """
    Validates that current_user has authority to assign the given reporting relationship.
    - Director (L1) can assign reports_to to any manager in their tenant, or None (for top-level).
    - Manager (L2) can ONLY assign reports_to to themselves (current_user.id) or to a subordinate manager
      in their own reporting hierarchy. They CANNOT reassign to Director (L1), another Manager, or None.
    - Employee (L3) cannot modify reporting relationships.
    """
    is_director = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    if is_director:
        if reports_to_id is not None:
            mgr = db.query(User).filter(
                User.id == reports_to_id,
                User.tenant_id == current_user.tenant_id,
                User.deleted_at.is_(None)
            ).first()
            if not mgr:
                raise HTTPException(status_code=400, detail="Reporting manager not found in current organization")
        return

    is_manager = current_user.role == "manager" or (current_user.role_level is not None and current_user.role_level == 2)
    if is_manager:
        if reports_to_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Managers cannot detach users from the reporting hierarchy."
            )
        subordinates = get_subordinate_ids(current_user, db)
        if reports_to_id != current_user.id and reports_to_id not in subordinates:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Managers can only assign reporting relationships within their own hierarchy."
            )
        mgr = db.query(User).filter(
            User.id == reports_to_id,
            User.tenant_id == current_user.tenant_id,
            User.deleted_at.is_(None)
        ).first()
        if not mgr:
            raise HTTPException(status_code=400, detail="Reporting manager not found in current organization")
        return

    # Employee
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Forbidden: Employees cannot modify reporting relationships."
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

