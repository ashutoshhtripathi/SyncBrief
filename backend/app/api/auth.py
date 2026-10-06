from fastapi import APIRouter, Depends, HTTPException, status, Request
from starlette.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urlencode
import httpx
import secrets
import hashlib
import base64
import logging
import asyncio
import time
from backend.app.database import get_db

logger = logging.getLogger(__name__)

# Single-use authorization code tracking & concurrency guard to prevent code reuse and replay attacks
_exchanged_oauth_codes: Dict[str, float] = {}
_oauth_exchange_lock = asyncio.Lock()

def clear_oauth_code_cache():
    """Helper to reset consumed authorization codes (used for test isolation)."""
    _exchanged_oauth_codes.clear()

def _cleanup_old_oauth_codes():
    """Remove authorization codes older than 15 minutes."""
    cutoff = time.time() - 900
    expired = [c for c, ts in _exchanged_oauth_codes.items() if ts < cutoff]
    for c in expired:
        _exchanged_oauth_codes.pop(c, None)
from backend.app.models import User, Checkin, Task, Tenant, OrganizationInvitation
from backend.app.config import settings
from backend.app.audit import log_audit_event
from backend.app.schemas import (
    LoginRequest, 
    DemoLoginRequest, 
    TokenResponse, 
    UserProfile, 
    UserCreate, 
    UserUpdate, 
    RefreshTokenRequest,
    TenantResponse,
    OAuthCallbackRequest,
    OAuthPendingResponse,
    OAuthPasswordVerifyRequest,
    OAuthConfigResponse,
    OAuthProviderConfig,
    OAuthStartResponse,
    InvitationCreate,
    InvitationResponse
)

def generate_pkce_pair() -> Tuple[str, str]:
    code_verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return code_verifier, code_challenge
from backend.app.auth_utils import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    hash_password,
    create_pending_oauth_token,
    decode_pending_oauth_token,
)
from backend.app.auth_deps import get_current_user
from backend.app.hierarchy import (
    can_view_user, 
    enforce_hierarchy_access, 
    get_subordinate_ids,
    enforce_can_manage_user,
    enforce_can_assign_role,
    enforce_can_assign_reports_to,
    enforce_tenant_access
)

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
    email_clean = req.email.lower().strip()
    # Normalize common alias for Sarah Jenkins
    if email_clean == "sara.jenkins@syncbrief.ai":
        email_clean = "sarah.jenkins@syncbrief.ai"

    user = db.query(User).filter(User.email == email_clean, User.deleted_at.is_(None)).first()
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

@router.get("/oauth/config", response_model=OAuthConfigResponse)
def get_oauth_config():
    """
    Returns public OAuth client IDs and discovery endpoints.
    Secrets are strictly maintained server-side and never exposed.
    """
    return {
        "google": {
            "enabled": bool(settings.GOOGLE_CLIENT_ID),
            "client_id": settings.GOOGLE_CLIENT_ID or None,
            "redirect_uri": settings.effective_google_redirect_uri,
            "auth_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
            "tenant_id": None
        },
        "microsoft": {
            "enabled": bool(settings.MICROSOFT_CLIENT_ID),
            "client_id": settings.MICROSOFT_CLIENT_ID or None,
            "tenant_id": settings.MICROSOFT_TENANT_ID,
            "redirect_uri": settings.effective_microsoft_redirect_uri,
            "auth_endpoint": f"https://login.microsoftonline.com/{settings.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize"
        }
    }

@router.get("/oauth/start/{provider}", response_model=OAuthStartResponse)
def start_oauth(provider: str, redirect_uri: Optional[str] = None):
    """
    Initializes real OAuth/OIDC flow for the specified provider (google or microsoft).
    Validates server-side credentials and returns authorization URL with account selection prompt.
    """
    prov = provider.lower().strip()
    state = secrets.token_urlsafe(32)

    if prov == "google":
        if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google OAuth is not configured on this server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend environment."
            )
        eff_redirect = settings.effective_google_redirect_uri if settings.GOOGLE_REDIRECT_URI else (redirect_uri or settings.effective_google_redirect_uri)
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": eff_redirect,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "select_account"
        }
        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        return {
            "provider": "google",
            "authorization_url": auth_url,
            "state": state,
            "code_verifier": None
        }

    elif prov == "microsoft":
        if not settings.MICROSOFT_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Microsoft OAuth is not configured on this server. Please set MICROSOFT_CLIENT_ID in backend environment."
            )
        eff_redirect = settings.effective_microsoft_redirect_uri if settings.MICROSOFT_REDIRECT_URI else (redirect_uri or settings.effective_microsoft_redirect_uri)
        code_verifier, code_challenge = generate_pkce_pair()
        tenant = settings.MICROSOFT_TENANT_ID or "common"
        params = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": eff_redirect,
            "scope": "openid profile email User.Read",
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "prompt": "select_account"
        }
        auth_url = f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?{urlencode(params)}"
        return {
            "provider": "microsoft",
            "authorization_url": auth_url,
            "state": state,
            "code_verifier": code_verifier
        }

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported OAuth provider: '{provider}'. Supported providers are 'google' and 'microsoft'."
        )

@router.get("/oauth/login/{provider}")
def login_oauth_redirect(provider: str, redirect_uri: Optional[str] = None):
    """
    Direct HTTP 307 redirect endpoint to provider authorization page.
    """
    start_info = start_oauth(provider, redirect_uri=redirect_uri)
    return RedirectResponse(url=start_info["authorization_url"], status_code=status.HTTP_307_TEMPORARY_REDIRECT)

@router.post("/oauth/callback", response_model=OAuthPendingResponse)
async def oauth_callback(req: OAuthCallbackRequest, db: Session = Depends(get_db)):
    """
    Handles server-to-server OAuth code exchange and identity verification.
    Links verified identities to existing SyncBrief accounts (preserving hierarchy and role),
    or applies controlled onboarding for new users (assigning base Employee level 3, never privileged Director/Manager).
    """
    provider = req.provider.lower().strip()
    if provider not in ["google", "microsoft"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported OAuth provider. Must be google or microsoft."
        )

    # Replay protection: check if authorization code was already submitted or exchanged
    _cleanup_old_oauth_codes()
    async with _oauth_exchange_lock:
        if req.code in _exchanged_oauth_codes:
            logger.warning(
                "OAuth authorization code reuse attempt blocked",
                extra={
                    "provider": provider,
                    "redirect_uri": req.redirect_uri,
                    "has_code": bool(req.code),
                    "has_state": bool(req.state),
                }
            )
            provider_title = "Google" if provider == "google" else "Microsoft"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{provider_title} sign-in expired or was already used. Please try again."
            )
        _exchanged_oauth_codes[req.code] = time.time()

    verified_email: Optional[str] = None
    verified_name: Optional[str] = None
    verified_avatar: Optional[str] = None
    provider_user_id: Optional[str] = None

    if provider == "google":
        if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google OAuth is not configured on this server. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
            )

        eff_redirect = settings.effective_google_redirect_uri if settings.GOOGLE_REDIRECT_URI else (req.redirect_uri or settings.effective_google_redirect_uri)
        token_url = "https://oauth2.googleapis.com/token"
        token_payload = {
            "code": req.code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": eff_redirect,
            "grant_type": "authorization_code"
        }

        # Safe diagnostic logging (no secrets, codes, tokens, or passwords logged)
        logger.info(
            "Initiating OAuth token exchange",
            extra={
                "provider": provider,
                "redirect_uri": eff_redirect,
                "has_code": bool(req.code),
                "has_state": bool(req.state),
            }
        )

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                token_resp = await client.post(token_url, data=token_payload)
            except Exception as e:
                logger.error(
                    "OAuth token exchange request failed",
                    extra={
                        "provider": provider,
                        "redirect_uri": eff_redirect,
                        "has_code": bool(req.code),
                        "has_state": bool(req.state),
                        "error": str(e)
                    }
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to communicate with Google authentication services: {str(e)}"
                )

            google_error_code = None
            resp_text = token_resp.text or ""
            if token_resp.status_code != 200:
                try:
                    err_json = token_resp.json()
                    google_error_code = err_json.get("error")
                except Exception:
                    google_error_code = "unknown"

            logger.info(
                "OAuth token exchange response received",
                extra={
                    "provider": provider,
                    "redirect_uri": eff_redirect,
                    "has_code": bool(req.code),
                    "has_state": bool(req.state),
                    "status_code": token_resp.status_code,
                    "error_code": google_error_code
                }
            )

            if token_resp.status_code != 200:
                if google_error_code == "invalid_grant" or "invalid_grant" in resp_text:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Google sign-in expired or was already used. Please try again."
                    )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Google authorization code exchange failed: {google_error_code or token_resp.status_code}"
                )

            tokens = token_resp.json()
            access_token = tokens.get("access_token")
            if not access_token:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Missing access_token from Google token response."
                )

            # Retrieve verified identity from Google OpenID userinfo endpoint
            userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"
            try:
                userinfo_resp = await client.get(userinfo_url, headers={"Authorization": f"Bearer {access_token}"})
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to retrieve Google user profile: {str(e)}"
                )

            if userinfo_resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to verify Google user profile."
                )

            google_user = userinfo_resp.json()
            if not google_user.get("email_verified", False):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Google account email is not verified by Google."
                )

            verified_email = google_user["email"].lower().strip()
            verified_name = google_user.get("name") or verified_email.split("@")[0]
            verified_avatar = google_user.get("picture")
            provider_user_id = google_user.get("sub")

    elif provider == "microsoft":
        if not settings.MICROSOFT_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Microsoft OAuth is not configured on this server. Please configure MICROSOFT_CLIENT_ID."
            )

        ms_tenant = settings.MICROSOFT_TENANT_ID or "common"
        token_url = f"https://login.microsoftonline.com/{ms_tenant}/oauth2/v2.0/token"
        eff_redirect = settings.effective_microsoft_redirect_uri if settings.MICROSOFT_REDIRECT_URI else (req.redirect_uri or settings.effective_microsoft_redirect_uri)
        token_payload = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "code": req.code,
            "redirect_uri": eff_redirect,
            "grant_type": "authorization_code",
        }
        if settings.MICROSOFT_CLIENT_SECRET:
            token_payload["client_secret"] = settings.MICROSOFT_CLIENT_SECRET
        if req.code_verifier:
            token_payload["code_verifier"] = req.code_verifier

        logger.info(
            "Initiating OAuth token exchange",
            extra={
                "provider": provider,
                "redirect_uri": eff_redirect,
                "has_code": bool(req.code),
                "has_state": bool(req.state),
            }
        )

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                token_resp = await client.post(token_url, data=token_payload)
            except Exception as e:
                logger.error(
                    "OAuth token exchange request failed",
                    extra={
                        "provider": provider,
                        "redirect_uri": eff_redirect,
                        "has_code": bool(req.code),
                        "has_state": bool(req.state),
                        "error": str(e)
                    }
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to communicate with Microsoft authentication services: {str(e)}"
                )

            ms_error_code = None
            resp_text = token_resp.text or ""
            if token_resp.status_code != 200:
                try:
                    err_json = token_resp.json()
                    ms_error_code = err_json.get("error")
                except Exception:
                    ms_error_code = "unknown"

            logger.info(
                "OAuth token exchange response received",
                extra={
                    "provider": provider,
                    "redirect_uri": eff_redirect,
                    "has_code": bool(req.code),
                    "has_state": bool(req.state),
                    "status_code": token_resp.status_code,
                    "error_code": ms_error_code
                }
            )

            if token_resp.status_code != 200:
                if ms_error_code == "invalid_grant" or "invalid_grant" in resp_text:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Microsoft sign-in expired or was already used. Please try again."
                    )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Microsoft authorization code exchange failed: {ms_error_code or token_resp.status_code}"
                )

            tokens = token_resp.json()
            access_token = tokens.get("access_token")
            if not access_token:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Missing access_token from Microsoft token response."
                )

            # Retrieve verified identity from Microsoft Graph API
            graph_url = "https://graph.microsoft.com/v1.0/me"
            try:
                graph_resp = await client.get(graph_url, headers={"Authorization": f"Bearer {access_token}"})
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to retrieve Microsoft Graph profile: {str(e)}"
                )

            if graph_resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to verify Microsoft user profile."
                )

            ms_user = graph_resp.json()
            email_candidate = ms_user.get("mail") or ms_user.get("userPrincipalName")
            if not email_candidate:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No email address found in Microsoft identity profile."
                )

            verified_email = email_candidate.lower().strip()
            verified_name = ms_user.get("displayName") or verified_email.split("@")[0]
            provider_user_id = ms_user.get("id")

    if not verified_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to extract verified email from OAuth identity provider."
        )

    # Normalize common alias for Sarah Jenkins
    if verified_email == "sara.jenkins@syncbrief.ai":
        verified_email = "sarah.jenkins@syncbrief.ai"

    # --- User Matching, Account Linking & Invite-Only Onboarding ---
    user = db.query(User).filter(User.email == verified_email, User.deleted_at.is_(None)).first()

    if user:
        # Existing account: PRESERVE user_id, tenant_id, role, role_level, reports_to_id, permissions strictly
        user.auth_provider = provider
        if provider_user_id:
            user.auth_provider_id = str(provider_user_id)
        if not user.avatar_url and verified_avatar:
            user.avatar_url = verified_avatar

        log_audit_event(
            db=db,
            action="OAUTH_IDENTITY_VERIFIED",
            entity_type="User",
            entity_id=user.id,
            actor_id=user.id,
            actor_name=user.full_name,
            input_summary=f"OAuth identity verified via {provider} for existing user ({user.role}, L{user.role_level})",
            tenant_id=user.tenant_id
        )
        db.commit()
    else:
        # Check if user has an explicit pending invitation from the organization
        invitation = db.query(OrganizationInvitation).filter(
            OrganizationInvitation.email == verified_email,
            OrganizationInvitation.status == "pending"
        ).first()

        if invitation:
            # Complete onboarding strictly using organization-assigned tenant and role
            user = User(
                email=verified_email,
                hashed_password=hash_password("demo1234"),
                full_name=invitation.full_name or verified_name or "Team Member",
                role=invitation.role,
                role_level=invitation.role_level,
                title=invitation.title,
                avatar_url=verified_avatar,
                tenant_id=invitation.tenant_id,
                reports_to_id=invitation.reports_to_id,
                org_type=invitation.org_type,
                auth_provider=provider,
                auth_provider_id=str(provider_user_id) if provider_user_id else None,
                streak_count=0
            )
            db.add(user)
            invitation.status = "accepted"
            invitation.accepted_at = datetime.utcnow()
            db.flush()

            log_audit_event(
                db=db,
                action="OAUTH_INVITE_ONBOARDING",
                entity_type="User",
                entity_id=user.id,
                actor_id=user.id,
                actor_name=user.full_name,
                input_summary=f"Invited user registered via {provider} OAuth into tenant {user.tenant_id} as {user.role} (L{user.role_level})",
                tenant_id=user.tenant_id
            )
            db.commit()
            db.refresh(user)
        else:
            # Strictly reject uninvited accounts
            log_audit_event(
                db=db,
                action="OAUTH_LOGIN_DENIED_UNINVITED",
                entity_type="User",
                entity_id=None,
                actor_id=None,
                actor_name=verified_name or verified_email,
                input_summary=f"Uninvited OAuth attempt via {provider} for email {verified_email} was rejected",
                tenant_id=1
            )
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You haven't been invited to SyncBrief. Please contact your organization administrator."
            )

    # Issue short-lived pending OAuth token (valid for 10 minutes)
    # Stamped with SERVER_BOOT_ID and strictly requiring SyncBrief password verification
    pending_token = create_pending_oauth_token({
        "sub": str(user.id),
        "email": user.email,
        "provider": provider,
        "provider_user_id": str(provider_user_id) if provider_user_id else None,
        "verified_avatar": verified_avatar,
        "verified_name": verified_name
    })

    return {
        "requires_password_verification": True,
        "pending_token": pending_token,
        "email": user.email,
        "provider": provider,
        "user_name": user.full_name
    }

@router.post("/oauth/verify-password", response_model=TokenResponse)
def verify_oauth_password(req: OAuthPasswordVerifyRequest, db: Session = Depends(get_db)):
    """
    Verify the user's SyncBrief password following successful Google/Microsoft OAuth authentication.
    Only upon valid server-side password verification is an authenticated application session (JWT) issued.
    """
    payload = decode_pending_oauth_token(req.pending_token)
    if not payload or payload.get("token_type") != "pending_oauth":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OAuth verification session. Please sign in again."
        )

    user_id = int(payload.get("sub"))
    email = payload.get("email")
    provider = payload.get("provider", "oauth")

    user = db.query(User).filter(User.id == user_id, User.email == email, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account not found.")

    # Server-side verification using existing password hashing/verification implementation
    if not verify_password(req.password, user.hashed_password):
        log_audit_event(
            db=db,
            action="OAUTH_PASSWORD_VERIFICATION_FAILED",
            entity_type="User",
            entity_id=user.id,
            actor_id=user.id,
            actor_name=user.full_name,
            input_summary=f"Failed password verification for {provider} OAuth login ({user.email})",
            tenant_id=user.tenant_id
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect SyncBrief password."
        )

    # Successful password verification: finalize account linking
    user.auth_provider = provider
    if payload.get("provider_user_id"):
        user.auth_provider_id = str(payload["provider_user_id"])
    if not user.avatar_url and payload.get("verified_avatar"):
        user.avatar_url = payload["verified_avatar"]

    # Issue standard authenticated SyncBrief application tokens stamped with SERVER_BOOT_ID
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

    log_audit_event(
        db=db,
        action="OAUTH_LOGIN_SUCCESS",
        entity_type="User",
        entity_id=user.id,
        actor_id=user.id,
        actor_name=user.full_name,
        input_summary=f"Successful OAuth login via {provider} with verified SyncBrief password",
        tenant_id=user.tenant_id
    )
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_to_profile(user)
    }


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

    is_director = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    is_manager = current_user.role == "manager" or (current_user.role_level is not None and current_user.role_level == 2)

    if not is_director and not is_manager:
        raise HTTPException(status_code=403, detail="Only Managers or Directors can create new users")

    # Enforce role assignment rules (e.g., Managers cannot create L1/L2 privileged users)
    enforce_can_assign_role(current_user, req.role, req.role_level)

    existing = db.query(User).filter(User.email == req.email.lower().strip(), User.deleted_at.is_(None)).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Determine reporting relationship and validate
    reports_to = req.reports_to_id if req.reports_to_id is not None else current_user.id
    enforce_can_assign_reports_to(current_user, reports_to, db)

    # Validate password confirmation
    if req.confirm_password is not None and req.password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match. Password and Confirm Password must be identical."
        )
    if not req.password or len(req.password.strip()) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

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

    user = db.query(User).filter(
        User.id == user_id,
        User.deleted_at.is_(None)
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Enforce strict tenant isolation
    enforce_tenant_access(current_user, user.tenant_id)

    is_director = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)

    if current_user.id == user_id:
        # Self profile update: non-directors cannot escalate or alter organizational roles/hierarchy
        if not is_director:
            if req.role is not None and req.role.lower() != user.role.lower():
                raise HTTPException(status_code=403, detail="Forbidden: You cannot modify your own organizational role.")
            if req.role_level is not None and req.role_level != user.role_level:
                raise HTTPException(status_code=403, detail="Forbidden: You cannot modify your own role level.")
            if "reports_to_id" in req.model_fields_set and req.reports_to_id != user.reports_to_id:
                raise HTTPException(status_code=403, detail="Forbidden: You cannot modify your own reporting manager.")
            if req.org_type is not None and req.org_type != user.org_type:
                raise HTTPException(status_code=403, detail="Forbidden: You cannot modify your own organization department.")
    else:
        # Managing another user: enforce hierarchy management authority
        enforce_can_manage_user(current_user, user, db)

        # Enforce privilege escalation checks on role and role_level
        if req.role is not None or req.role_level is not None:
            enforce_can_assign_role(current_user, req.role, req.role_level)

        # Enforce reporting hierarchy assignment checks
        if "reports_to_id" in req.model_fields_set:
            if req.reports_to_id is not None and req.reports_to_id == user.id:
                raise HTTPException(status_code=400, detail="User cannot report to themselves")
            enforce_can_assign_reports_to(current_user, req.reports_to_id, db)

    old_vals = {"full_name": user.full_name, "role": user.role, "role_level": user.role_level, "reports_to_id": user.reports_to_id}

    if req.full_name is not None: user.full_name = req.full_name
    if req.title is not None: user.title = req.title
    if req.role is not None: user.role = req.role
    if req.avatar_url is not None: user.avatar_url = req.avatar_url
    if req.timezone is not None: user.timezone = req.timezone
    if req.reminder_time is not None: user.reminder_time = req.reminder_time
    if req.role_level is not None: user.role_level = req.role_level
    if "reports_to_id" in req.model_fields_set:
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

    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    user = db.query(User).filter(
        User.id == user_id,
        User.deleted_at.is_(None)
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Enforce tenant isolation & management authority
    enforce_tenant_access(current_user, user.tenant_id)
    enforce_can_manage_user(current_user, user, db)

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

# --- Organization Invitations Management ---
@router.post("/invitations", response_model=InvitationResponse)
def create_invitation(
    req: InvitationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Invite a new team member to the organization's tenant.
    Restricted to Directors (L1) and Managers (L2).
    Enforces role assignment and hierarchy reporting constraints.
    """
    is_director = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    is_manager = current_user.role == "manager" or (current_user.role_level is not None and current_user.role_level == 2)

    if not is_director and not is_manager:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Managers or Directors can invite new users")

    # Enforce privilege escalation checks on role and role_level
    enforce_can_assign_role(current_user, req.role, req.role_level)

    email_clean = req.email.lower().strip()
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == email_clean, User.deleted_at.is_(None)).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User with this email already exists")

    # Check if pending invitation already exists in this tenant
    existing_invite = db.query(OrganizationInvitation).filter(
        OrganizationInvitation.email == email_clean,
        OrganizationInvitation.tenant_id == current_user.tenant_id,
        OrganizationInvitation.status == "pending"
    ).first()
    if existing_invite:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A pending invitation already exists for this email")

    # Validate reports_to_id
    reports_to = req.reports_to_id if req.reports_to_id is not None else current_user.id
    enforce_can_assign_reports_to(current_user, reports_to, db)

    invitation = OrganizationInvitation(
        tenant_id=current_user.tenant_id,
        email=email_clean,
        full_name=req.full_name,
        role=req.role,
        role_level=req.role_level,
        title=req.title,
        reports_to_id=reports_to,
        org_type=req.org_type,
        invited_by_id=current_user.id,
        status="pending"
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    log_audit_event(
        db=db,
        action="CREATE_INVITATION",
        entity_type="OrganizationInvitation",
        entity_id=invitation.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        new_values={"email": invitation.email, "role": invitation.role, "role_level": invitation.role_level}
    )

    return invitation

@router.get("/invitations", response_model=List[InvitationResponse])
def list_invitations(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List invitations for the caller's tenant.
    Restricted to Directors (L1) and Managers (L2).
    """
    is_director = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    is_manager = current_user.role == "manager" or (current_user.role_level is not None and current_user.role_level == 2)

    if not is_director and not is_manager:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Managers or Directors can view invitations")

    query = db.query(OrganizationInvitation).filter(
        OrganizationInvitation.tenant_id == current_user.tenant_id
    )
    if status_filter:
        query = query.filter(OrganizationInvitation.status == status_filter)
    
    return query.order_by(OrganizationInvitation.created_at.desc()).all()

@router.delete("/invitations/{invitation_id}")
def revoke_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Revoke a pending invitation.
    Restricted to Directors (L1) and Managers (L2).
    """
    is_director = current_user.role in ["admin", "director"] or (current_user.role_level is not None and current_user.role_level <= 1)
    is_manager = current_user.role == "manager" or (current_user.role_level is not None and current_user.role_level == 2)

    if not is_director and not is_manager:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Managers or Directors can revoke invitations")

    invitation = db.query(OrganizationInvitation).filter(
        OrganizationInvitation.id == invitation_id,
        OrganizationInvitation.tenant_id == current_user.tenant_id
    ).first()
    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    invitation.status = "revoked"
    db.commit()

    log_audit_event(
        db=db,
        action="REVOKE_INVITATION",
        entity_type="OrganizationInvitation",
        entity_id=invitation.id,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        tenant_id=current_user.tenant_id
    )

    return {"status": "success", "message": "Invitation revoked successfully"}
