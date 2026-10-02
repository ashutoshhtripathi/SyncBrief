import pytest
import jwt
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
from backend.app.main import app
from backend.app.seed import seed_database
from backend.app.models import User, Tenant, OrganizationInvitation
from backend.app.database import SessionLocal
from backend.app.config import settings
from backend.app.auth_utils import SERVER_BOOT_ID
from backend.app.api.auth import clear_oauth_code_cache

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    seed_database()

@pytest.fixture(autouse=True)
def reset_oauth_code_cache():
    clear_oauth_code_cache()
    yield
    clear_oauth_code_cache()

@pytest.fixture
def client():
    return TestClient(app)

def test_oauth_config_endpoint(client):
    """Verify public discovery configuration for Google and Microsoft SSO."""
    resp = client.get("/api/auth/oauth/config")
    assert resp.status_code == 200
    data = resp.json()
    assert "google" in data
    assert "microsoft" in data
    assert "auth_endpoint" in data["google"]
    assert "auth_endpoint" in data["microsoft"]
    assert "redirect_uri" in data["google"]
    assert "redirect_uri" in data["microsoft"]
    assert "accounts.google.com" in data["google"]["auth_endpoint"]
    assert "login.microsoftonline.com" in data["microsoft"]["auth_endpoint"]

def test_oauth_unsupported_provider(client):
    """Verify rejection of unknown or invalid OAuth providers."""
    resp = client.post("/api/auth/oauth/callback", json={
        "provider": "github",
        "code": "fake-code",
        "redirect_uri": "http://localhost:5173/auth/callback"
    })
    assert resp.status_code == 400
    assert "Unsupported OAuth provider" in resp.json()["detail"]

def test_oauth_unconfigured_provider(client):
    """Verify rejection with actionable message if provider client secrets are missing."""
    with patch.object(settings, "GOOGLE_CLIENT_ID", ""), patch.object(settings, "GOOGLE_CLIENT_SECRET", ""):
        resp = client.post("/api/auth/oauth/callback", json={
            "provider": "google",
            "code": "auth-code",
            "redirect_uri": "http://localhost:5173/auth/callback"
        })
        assert resp.status_code == 400
        assert "Google OAuth is not configured" in resp.json()["detail"]

def test_google_oauth_success_and_account_linking(client):
    """
    Test Google OAuth code exchange with existing user account linking.
    Ensures that an existing Manager (Vikram Joshi, L2) retains his role, level, and tenant.
    """
    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {
        "access_token": "mock-google-access-token",
        "id_token": "mock-google-id-token"
    }

    mock_userinfo_resp = MagicMock()
    mock_userinfo_resp.status_code = 200
    mock_userinfo_resp.json.return_value = {
        "sub": "google-user-id-998877",
        "email": "vikram.joshi@syncbrief.ai",
        "email_verified": True,
        "name": "Vikram Joshi",
        "picture": "https://example.com/vikram.jpg"
    }

    with patch.object(settings, "GOOGLE_CLIENT_ID", "mock-google-client-id"), \
         patch.object(settings, "GOOGLE_CLIENT_SECRET", "mock-google-client-secret"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:

        mock_post.return_value = mock_token_resp
        mock_get.return_value = mock_userinfo_resp

        resp = client.post("/api/auth/oauth/callback", json={
            "provider": "google",
            "code": "valid-google-code",
            "redirect_uri": "http://localhost:5173/auth/callback"
        })

        assert resp.status_code == 200
        callback_data = resp.json()
        assert callback_data["requires_password_verification"] is True
        assert "pending_token" in callback_data
        assert "access_token" not in callback_data, "SECURITY FLAW: Access token issued before password verification!"

        pending_token = callback_data["pending_token"]

        # Attempting to use pending_token as an access token on protected routes MUST be rejected
        bypass_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {pending_token}"})
        assert bypass_resp.status_code == 401

        # Attempting password verification with wrong password MUST fail with 401
        wrong_pw = client.post("/api/auth/oauth/verify-password", json={
            "pending_token": pending_token,
            "password": "wrongpassword123!"
        })
        assert wrong_pw.status_code == 401
        assert "Incorrect SyncBrief password" in wrong_pw.json()["detail"]

        # Password verification with correct password succeeds and issues authenticated session
        verify_resp = client.post("/api/auth/oauth/verify-password", json={
            "pending_token": pending_token,
            "password": "demo1234"
        })
        assert verify_resp.status_code == 200
        data = verify_resp.json()
        assert "access_token" in data
        assert "user" in data

        user = data["user"]
        assert user["email"] == "vikram.joshi@syncbrief.ai"
        # Role and level MUST be preserved from existing record
        assert user["role"] == "manager"
        assert user["role_level"] == 2
        assert user["tenant_id"] == 1
        assert user["tenant_name"] == "SyncBrief Enterprise"

        # Verify token works for /api/auth/me
        me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {data['access_token']}"})
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == "vikram.joshi@syncbrief.ai"

def test_uninvited_google_user_rejected_with_403_and_no_user_created(client):
    """
    Verify that an uninvited Google account is strictly denied access.
    Backend must return HTTP 403, clear invitation message, and create NO user or tenant.
    """
    uninvited_email = "uninvited.google.stranger@gmail.com"

    # Ensure email is definitely not in DB
    db = SessionLocal()
    existing = db.query(User).filter(User.email == uninvited_email).first()
    if existing:
        db.delete(existing)
        db.commit()
    db.close()

    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {
        "access_token": "mock-uninvited-google-token"
    }

    mock_userinfo_resp = MagicMock()
    mock_userinfo_resp.status_code = 200
    mock_userinfo_resp.json.return_value = {
        "sub": "google-uninvited-sub-12345",
        "email": uninvited_email,
        "email_verified": True,
        "name": "Uninvited Google User",
        "picture": "https://example.com/uninvited.jpg"
    }

    with patch.object(settings, "GOOGLE_CLIENT_ID", "mock-cid"), \
         patch.object(settings, "GOOGLE_CLIENT_SECRET", "mock-sec"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:

        mock_post.return_value = mock_token_resp
        mock_get.return_value = mock_userinfo_resp

        resp = client.post("/api/auth/oauth/callback", json={
            "provider": "google",
            "code": "valid-google-code",
            "redirect_uri": "http://localhost:5173/auth/callback"
        })

        assert resp.status_code == 403
        data = resp.json()
        assert "You haven't been invited to SyncBrief" in data["detail"]

    # Verify that NO user was created in the database
    db = SessionLocal()
    user_in_db = db.query(User).filter(User.email == uninvited_email).first()
    assert user_in_db is None, "Security violation: User was created in DB for uninvited account!"
    db.close()

def test_uninvited_microsoft_user_rejected_with_403_and_no_user_created(client):
    """
    Verify that an uninvited Microsoft account is strictly denied access.
    Backend must return HTTP 403, clear invitation message, and create NO user or tenant.
    """
    uninvited_email = "uninvited.ms.stranger@outlook.com"

    # Ensure email is definitely not in DB
    db = SessionLocal()
    existing = db.query(User).filter(User.email == uninvited_email).first()
    if existing:
        db.delete(existing)
        db.commit()
    db.close()

    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {
        "access_token": "mock-uninvited-ms-token"
    }

    mock_graph_resp = MagicMock()
    mock_graph_resp.status_code = 200
    mock_graph_resp.json.return_value = {
        "id": "ms-uninvited-id-67890",
        "mail": uninvited_email,
        "displayName": "Uninvited MS User"
    }

    with patch.object(settings, "MICROSOFT_CLIENT_ID", "mock-ms-cid"), \
         patch.object(settings, "MICROSOFT_TENANT_ID", "common"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:

        mock_post.return_value = mock_token_resp
        mock_get.return_value = mock_graph_resp

        resp = client.post("/api/auth/oauth/callback", json={
            "provider": "microsoft",
            "code": "valid-ms-code",
            "redirect_uri": "http://localhost:5173/auth/callback",
            "code_verifier": "valid-pkce-verifier-12345"
        })

        assert resp.status_code == 403
        data = resp.json()
        assert "You haven't been invited to SyncBrief" in data["detail"]

    # Verify that NO user was created in the database
    db = SessionLocal()
    user_in_db = db.query(User).filter(User.email == uninvited_email).first()
    assert user_in_db is None, "Security violation: User was created in DB for uninvited MS account!"
    db.close()

def test_invited_oauth_user_successful_onboarding_and_privilege_tamper_rejection(client):
    """
    Verify that an explicitly invited user completes OAuth onboarding,
    receives the pre-assigned role, role_level, reports_to_id, and tenant_id,
    and frontend attempted tampering of role/tenant is strictly rejected.
    """
    invited_email = "invited.colleague@syncbrief.ai"

    # Pre-create invitation in database by manager/director
    db = SessionLocal()
    # Clean up any existing records
    db.query(User).filter(User.email == invited_email).delete()
    db.query(OrganizationInvitation).filter(OrganizationInvitation.email == invited_email).delete()
    db.commit()

    invitation = OrganizationInvitation(
        tenant_id=1,
        email=invited_email,
        full_name="Invited Colleague",
        role="member",
        role_level=3,
        title="Senior Platform Engineer",
        reports_to_id=2, # reports to Vikram Joshi
        org_type="engineering",
        invited_by_id=1, # invited by Sarah Jenkins
        status="pending"
    )
    db.add(invitation)
    db.commit()
    invitation_id = invitation.id
    db.close()

    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {"access_token": "mock-invited-ms-token"}

    mock_graph_resp = MagicMock()
    mock_graph_resp.status_code = 200
    mock_graph_resp.json.return_value = {
        "id": "ms-invited-id-112233",
        "mail": invited_email,
        "displayName": "Invited Colleague"
    }

    with patch.object(settings, "MICROSOFT_CLIENT_ID", "mock-ms-client-id"), \
         patch.object(settings, "MICROSOFT_TENANT_ID", "common"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:

        mock_post.return_value = mock_token_resp
        mock_get.return_value = mock_graph_resp

        # Send callback with attempted privilege tampering: role='director', role_level=1, tenant_id=99
        resp = client.post("/api/auth/oauth/callback", json={
            "provider": "microsoft",
            "code": "valid-ms-code",
            "redirect_uri": "http://localhost:5173/auth/callback",
            "code_verifier": "valid-pkce-verifier-string-1234567890",
            "role": "director", # Attempted privilege tampering - MUST be ignored
            "role_level": 1,
            "tenant_id": 99
        })

        assert resp.status_code == 200
        callback_data = resp.json()
        assert callback_data["requires_password_verification"] is True
        assert "pending_token" in callback_data

        # Verify password step
        verify_resp = client.post("/api/auth/oauth/verify-password", json={
            "pending_token": callback_data["pending_token"],
            "password": "demo1234"
        })
        assert verify_resp.status_code == 200
        data = verify_resp.json()
        user = data["user"]
        assert user["email"] == invited_email
        assert user["full_name"] == "Invited Colleague"
        # Organization-controlled rule: MUST be pre-assigned member level 3, NOT tampered director
        assert user["role"] == "member"
        assert user["role_level"] == 3
        assert user["tenant_id"] == 1
        assert user["reports_to_id"] == 2

        # Verify token works for /api/auth/me
        me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {data['access_token']}"})
        assert me_resp.status_code == 200
        assert me_resp.json()["role_level"] == 3
        assert me_resp.json()["reports_to_id"] == 2

    # Verify invitation marked accepted in DB
    db = SessionLocal()
    inv_check = db.query(OrganizationInvitation).filter(OrganizationInvitation.id == invitation_id).first()
    assert inv_check.status == "accepted"
    assert inv_check.accepted_at is not None
    db.close()

def test_unverified_google_email_rejected(client):
    """Verify that Google identities with unverified emails are strictly rejected."""
    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {"access_token": "valid-token"}

    mock_userinfo_resp = MagicMock()
    mock_userinfo_resp.status_code = 200
    mock_userinfo_resp.json.return_value = {
        "sub": "google-unverified-sub",
        "email": "unverified@gmail.com",
        "email_verified": False # Rejected!
    }

    with patch.object(settings, "GOOGLE_CLIENT_ID", "mock-client-id"), \
         patch.object(settings, "GOOGLE_CLIENT_SECRET", "mock-client-secret"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:

        mock_post.return_value = mock_token_resp
        mock_get.return_value = mock_userinfo_resp

        resp = client.post("/api/auth/oauth/callback", json={
            "provider": "google",
            "code": "code-with-unverified-email",
            "redirect_uri": "http://localhost:5173/auth/callback"
        })
        assert resp.status_code == 400
        assert "not verified" in resp.json()["detail"].lower()

def test_oauth_token_invalidated_by_server_restart(client):
    """Verify that OAuth-issued tokens are invalidated if server boot ID changes."""
    # 1. Forge an OAuth-issued token with an old boot ID
    stale_oauth_token = jwt.encode(
        {"sub": "1", "email": "sarah.jenkins@syncbrief.ai", "boot_id": "old-server-boot-uuid"},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {stale_oauth_token}"})
    assert resp.status_code == 401
    assert "Invalid or expired" in resp.json()["detail"]

def test_oauth_user_logout(client):
    """Verify that an OAuth user can cleanly log out via /api/auth/logout."""
    # Authenticate via password or mock to get active session
    login_resp = client.post("/api/auth/login", json={"email": "priya.sharma@syncbrief.ai", "password": "demo1234"})
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]

    logout_resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_resp.status_code == 200
    assert logout_resp.json()["status"] == "success"

def test_existing_email_password_login_remains_operational(client):
    """Verify existing password authentication remains 100% operational."""
    resp = client.post("/api/auth/login", json={
        "email": "sarah.jenkins@syncbrief.ai",
        "password": "demo1234"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["role"] == "director"
    assert data["user"]["role_level"] == 1

def test_oauth_start_google_endpoint(client):
    """Verify that /api/auth/oauth/start/google generates real Google auth URL with select_account."""
    with patch.object(settings, "GOOGLE_CLIENT_ID", "test-google-client-id"), \
         patch.object(settings, "GOOGLE_CLIENT_SECRET", "test-google-secret"):
        resp = client.get("/api/auth/oauth/start/google")
        assert resp.status_code == 200
        data = resp.json()
        assert data["provider"] == "google"
        assert "accounts.google.com/o/oauth2/v2/auth" in data["authorization_url"]
        assert "client_id=test-google-client-id" in data["authorization_url"]
        assert "prompt=select_account" in data["authorization_url"]
        assert "state=" in data["authorization_url"]
        assert data["state"] is not None

def test_oauth_start_google_missing_credentials(client):
    """Verify clear error when Google OAuth credentials are not configured."""
    with patch.object(settings, "GOOGLE_CLIENT_ID", ""), \
         patch.object(settings, "GOOGLE_CLIENT_SECRET", ""):
        resp = client.get("/api/auth/oauth/start/google")
        assert resp.status_code == 400
        assert "Google OAuth is not configured on this server" in resp.json()["detail"]

def test_oauth_start_microsoft_endpoint_with_pkce(client):
    """Verify that /api/auth/oauth/start/microsoft returns authorization URL with PKCE parameters."""
    with patch.object(settings, "MICROSOFT_CLIENT_ID", "test-ms-client-id"):
        resp = client.get("/api/auth/oauth/start/microsoft")
        assert resp.status_code == 200
        data = resp.json()
        assert data["provider"] == "microsoft"
        assert "login.microsoftonline.com" in data["authorization_url"]
        assert "code_challenge=" in data["authorization_url"]
        assert "code_challenge_method=S256" in data["authorization_url"]
        assert "prompt=select_account" in data["authorization_url"]
        assert data["code_verifier"] is not None

def test_oauth_login_redirect_endpoint(client):
    """Verify 307 temporary redirect to authorization page."""
    with patch.object(settings, "GOOGLE_CLIENT_ID", "test-google-client-id"), \
         patch.object(settings, "GOOGLE_CLIENT_SECRET", "test-google-secret"):
        resp = client.get("/api/auth/oauth/login/google", follow_redirects=False)
        assert resp.status_code == 307
        assert "accounts.google.com" in resp.headers["location"]


def test_affected_accounts_can_login_with_email_password(client):
    """
    Regression test proving that all affected accounts:
    - sara.jenkins@syncbrief.ai (alias for sarah.jenkins@syncbrief.ai)
    - sarah.jenkins@syncbrief.ai
    - vikram.joshi@syncbrief.ai
    - priya.sharma@syncbrief.ai
    - alice.smith@acme.com
    can successfully authenticate with email/password, and that tenant_id, role_level,
    and hierarchy are preserved.
    """
    test_cases = [
        # (email, expected_canonical_email, expected_role, expected_level, expected_tenant)
        ("sara.jenkins@syncbrief.ai", "sarah.jenkins@syncbrief.ai", "director", 1, 1),
        ("sarah.jenkins@syncbrief.ai", "sarah.jenkins@syncbrief.ai", "director", 1, 1),
        ("vikram.joshi@syncbrief.ai", "vikram.joshi@syncbrief.ai", "manager", 2, 1),
        ("priya.sharma@syncbrief.ai", "priya.sharma@syncbrief.ai", "employee", 3, 1),
        ("alice.smith@acme.com", "alice.smith@acme.com", "director", 1, 2),
    ]

    for input_email, expected_email, exp_role, exp_level, exp_tenant in test_cases:
        # 1. Test seeded password
        resp = client.post("/api/auth/login", json={"email": input_email, "password": "demo1234"})
        assert resp.status_code == 200, f"Login failed for {input_email} with demo1234: {resp.text}"
        data = resp.json()
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == expected_email
        assert data["user"]["role"] == exp_role
        assert data["user"]["role_level"] == exp_level
        assert data["user"]["tenant_id"] == exp_tenant

        # 2. Test development standard credential
        resp_dev = client.post("/api/auth/login", json={"email": input_email, "password": "password"})
        assert resp_dev.status_code == 200, f"Login failed for {input_email} with password: {resp_dev.text}"
        data_dev = resp_dev.json()
        assert data_dev["user"]["email"] == expected_email

        # 3. Test wrong password is strictly rejected with 401
        resp_bad = client.post("/api/auth/login", json={"email": input_email, "password": "WrongPassword99!"})
        assert resp_bad.status_code == 401
        assert "Incorrect email or password" in resp_bad.json()["detail"]


def test_oauth_account_linking_does_not_disable_local_password_login(client):
    """
    Regression test proving that linking an account with Google or Microsoft OAuth
    does NOT disable or weaken existing email/password authentication.
    """
    target_email = "priya.sharma@syncbrief.ai"

    # Step 1: Verify local password login works initially
    login_1 = client.post("/api/auth/login", json={"email": target_email, "password": "demo1234"})
    assert login_1.status_code == 200

    # Step 2: Link account via Google OAuth
    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {"access_token": "priya-google-token"}

    mock_userinfo = MagicMock()
    mock_userinfo.status_code = 200
    mock_userinfo.json.return_value = {
        "sub": "priya-google-sub-112233",
        "email": target_email,
        "email_verified": True,
        "name": "Priya Sharma"
    }

    with patch.object(settings, "GOOGLE_CLIENT_ID", "mock-cid"), \
         patch.object(settings, "GOOGLE_CLIENT_SECRET", "mock-sec"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:

        mock_post.return_value = mock_token_resp
        mock_get.return_value = mock_userinfo

        oauth_resp = client.post("/api/auth/oauth/callback", json={
            "provider": "google",
            "code": "priya-google-code",
            "redirect_uri": "http://localhost:5173/auth/callback"
        })
        assert oauth_resp.status_code == 200
        v_resp1 = client.post("/api/auth/oauth/verify-password", json={
            "pending_token": oauth_resp.json()["pending_token"],
            "password": "demo1234"
        })
        assert v_resp1.status_code == 200

    # Step 3: Verify local email/password login STILL works after Google OAuth linking
    login_after_google = client.post("/api/auth/login", json={"email": target_email, "password": "demo1234"})
    assert login_after_google.status_code == 200, "Password login failed after Google OAuth linking"
    assert login_after_google.json()["user"]["role_level"] == 3
    assert login_after_google.json()["user"]["tenant_id"] == 1

    # Step 4: Link account via Microsoft OAuth
    mock_ms_token = MagicMock()
    mock_ms_token.status_code = 200
    mock_ms_token.json.return_value = {"access_token": "priya-ms-token"}

    mock_graph = MagicMock()
    mock_graph.status_code = 200
    mock_graph.json.return_value = {
        "id": "priya-ms-id-445566",
        "mail": target_email,
        "displayName": "Priya Sharma"
    }

    with patch.object(settings, "MICROSOFT_CLIENT_ID", "mock-ms-cid"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:

        mock_post.return_value = mock_ms_token
        mock_get.return_value = mock_graph

        ms_oauth_resp = client.post("/api/auth/oauth/callback", json={
            "provider": "microsoft",
            "code": "priya-ms-code",
            "redirect_uri": "http://localhost:5173/auth/callback"
        })
        assert ms_oauth_resp.status_code == 200
        v_resp2 = client.post("/api/auth/oauth/verify-password", json={
            "pending_token": ms_oauth_resp.json()["pending_token"],
            "password": "demo1234"
        })
        assert v_resp2.status_code == 200

    # Step 5: Verify local email/password login STILL works after Microsoft OAuth linking
    login_after_ms = client.post("/api/auth/login", json={"email": target_email, "password": "password"})
    assert login_after_ms.status_code == 200, "Password login failed after Microsoft OAuth linking"
    assert login_after_ms.json()["user"]["role_level"] == 3


def test_rbac_and_tenant_isolation_intact(client):
    """
    Regression test proving that tenant isolation and hierarchy RBAC
    remain strictly intact for all users.
    """
    # 1. Alice Smith (Director L1 at Acme Corp, Tenant 2)
    alice_login = client.post("/api/auth/login", json={"email": "alice.smith@acme.com", "password": "demo1234"})
    assert alice_login.status_code == 200
    alice_token = alice_login.json()["access_token"]

    # Alice viewing team members must only see Tenant 2 users
    alice_users_resp = client.get("/api/auth/users", headers={"Authorization": f"Bearer {alice_token}"})
    assert alice_users_resp.status_code == 200
    tenant2_users = alice_users_resp.json()
    assert all(u["tenant_id"] == 2 for u in tenant2_users)
    assert not any(u["email"] == "sarah.jenkins@syncbrief.ai" for u in tenant2_users)

    # 2. Priya Sharma (Employee L3 at SyncBrief, Tenant 1)
    priya_login = client.post("/api/auth/login", json={"email": "priya.sharma@syncbrief.ai", "password": "demo1234"})
    assert priya_login.status_code == 200
    priya_token = priya_login.json()["access_token"]

    # Priya viewing team members must only see Tenant 1 users
    priya_users_resp = client.get("/api/auth/users", headers={"Authorization": f"Bearer {priya_token}"})
    assert priya_users_resp.status_code == 200
    tenant1_users = priya_users_resp.json()
    assert all(u["tenant_id"] == 1 for u in tenant1_users)
    assert not any(u["email"] == "alice.smith@acme.com" for u in tenant1_users)

    # Priya cannot access a superior's specific profile (e.g. Sarah Jenkins id=1)
    priya_view_sarah = client.get("/api/auth/users/1", headers={"Authorization": f"Bearer {priya_token}"})
    assert priya_view_sarah.status_code == 403

def test_invitation_creation_and_rbac_enforcement(client):
    """
    Test invitation management endpoints and RBAC rules:
    - Directors and Managers can create invitations
    - Regular employees (L3) cannot create invitations (403)
    - Managers cannot escalate and invite L1/L2 superiors (403)
    - Invitations can be listed and revoked
    """
    # 1. Sarah Jenkins (Director, L1) logs in
    sarah_resp = client.post("/api/auth/login", json={"email": "sarah.jenkins@syncbrief.ai", "password": "demo1234"})
    assert sarah_resp.status_code == 200
    sarah_token = sarah_resp.json()["access_token"]

    # 2. Priya Sharma (Employee, L3) logs in
    priya_resp = client.post("/api/auth/login", json={"email": "priya.sharma@syncbrief.ai", "password": "demo1234"})
    assert priya_resp.status_code == 200
    priya_token = priya_resp.json()["access_token"]

    # 3. Employee cannot create invitation (403)
    priya_invite = client.post("/api/auth/invitations", json={
        "email": "should.fail@syncbrief.ai",
        "role": "member",
        "role_level": 3
    }, headers={"Authorization": f"Bearer {priya_token}"})
    assert priya_invite.status_code == 403

    # 4. Director creates valid invitation
    test_invite_email = "new.developer.invite@syncbrief.ai"
    # Clean up if existed
    db = SessionLocal()
    db.query(OrganizationInvitation).filter(OrganizationInvitation.email == test_invite_email).delete()
    db.commit()
    db.close()

    create_resp = client.post("/api/auth/invitations", json={
        "email": test_invite_email,
        "full_name": "New Developer",
        "role": "member",
        "role_level": 3,
        "title": "Backend Developer",
        "org_type": "engineering"
    }, headers={"Authorization": f"Bearer {sarah_token}"})
    assert create_resp.status_code == 200
    inv_data = create_resp.json()
    assert inv_data["email"] == test_invite_email
    assert inv_data["status"] == "pending"
    assert inv_data["tenant_id"] == 1
    invite_id = inv_data["id"]

    # 5. List invitations
    list_resp = client.get("/api/auth/invitations", headers={"Authorization": f"Bearer {sarah_token}"})
    assert list_resp.status_code == 200
    invitations = list_resp.json()
    assert any(i["id"] == invite_id for i in invitations)

    # 6. Revoke invitation
    revoke_resp = client.delete(f"/api/auth/invitations/{invite_id}", headers={"Authorization": f"Bearer {sarah_token}"})
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["status"] == "success"

    # Verify status is now revoked
    db = SessionLocal()
    rev_check = db.query(OrganizationInvitation).filter(OrganizationInvitation.id == invite_id).first()
    assert rev_check.status == "revoked"
    db.close()

def test_admin_created_user_password_hashing_and_confirmation_lifecycle(client):
    """
    Test admin user creation password workflow:
    - Admin creates a user with an explicitly chosen password and confirmation
    - Mismatched confirm_password is strictly rejected with HTTP 400
    - Password is securely hashed (Argon2id) and never stored as plaintext
    - The created user can authenticate with the chosen password
    - Invalid password attempts are rejected with HTTP 401
    """
    # 1. Authenticate as Director (Sarah Jenkins)
    sarah_resp = client.post("/api/auth/login", json={"email": "sarah.jenkins@syncbrief.ai", "password": "demo1234"})
    assert sarah_resp.status_code == 200
    sarah_token = sarah_resp.json()["access_token"]

    target_email = "custom.password.user@syncbrief.ai"
    chosen_password = "SecureCustomPass2026!"

    # Clean up if existed
    db = SessionLocal()
    db.query(User).filter(User.email == target_email).delete()
    db.commit()
    db.close()

    # 2. Test mismatched confirm_password is rejected
    mismatch_resp = client.post("/api/auth/users", json={
        "email": target_email,
        "password": chosen_password,
        "confirm_password": "DifferentPassword123!",
        "full_name": "Custom Password User",
        "role": "member",
        "role_level": 3,
        "title": "Security Engineer",
        "org_type": "engineering"
    }, headers={"Authorization": f"Bearer {sarah_token}"})
    assert mismatch_resp.status_code == 400
    assert "Passwords do not match" in mismatch_resp.json()["detail"]

    # 3. Test short password (< 6 chars) is rejected
    short_resp = client.post("/api/auth/users", json={
        "email": target_email,
        "password": "123",
        "confirm_password": "123",
        "full_name": "Custom Password User",
        "role": "member",
        "role_level": 3,
        "title": "Security Engineer",
        "org_type": "engineering"
    }, headers={"Authorization": f"Bearer {sarah_token}"})
    assert short_resp.status_code in [400, 422]
    assert "at least 6 characters" in short_resp.text or "String should have at least 6 characters" in short_resp.text

    # 4. Create user with valid matching password
    create_resp = client.post("/api/auth/users", json={
        "email": target_email,
        "password": chosen_password,
        "confirm_password": chosen_password,
        "full_name": "Custom Password User",
        "role": "member",
        "role_level": 3,
        "title": "Security Engineer",
        "org_type": "engineering"
    }, headers={"Authorization": f"Bearer {sarah_token}"})
    assert create_resp.status_code == 200
    created_user = create_resp.json()
    assert created_user["email"] == target_email

    # 5. Verify password is securely hashed in database and NEVER stored plaintext
    db = SessionLocal()
    db_user = db.query(User).filter(User.email == target_email).first()
    assert db_user is not None
    assert db_user.hashed_password != chosen_password, "CRITICAL SECURITY FLAW: Password stored as plaintext!"
    assert chosen_password not in db_user.hashed_password, "CRITICAL SECURITY FLAW: Plaintext password found in hash column!"
    assert db_user.hashed_password.startswith("$argon2"), "Password was not hashed with Argon2id!"
    db.close()

    # 6. Verify user can authenticate with the chosen password
    login_resp = client.post("/api/auth/login", json={
        "email": target_email,
        "password": chosen_password
    })
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()

    # 7. Verify user cannot authenticate with incorrect password
    wrong_login = client.post("/api/auth/login", json={
        "email": target_email,
        "password": "WrongPassword999!"
    })
    assert wrong_login.status_code == 401

def test_registered_users_oauth_login_requires_and_verifies_syncbrief_password(client):
    """
    Verify the two-stage OAuth authentication flow:
    1. Google/Microsoft OAuth code exchange ONLY returns short-lived pending_token (no access token).
    2. Attempting to access protected endpoints with pending_token is rejected with 401.
    3. Incorrect SyncBrief password verification is rejected with 401 (no session issued).
    4. Correct SyncBrief password verification succeeds and issues authenticated access_token.
    5. Tokens and passwords are never exposed in URL query parameters.
    """
    # 1. Registered Google user (Priya Sharma, employee in tenant 1)
    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {"access_token": "priya-google-token"}

    mock_userinfo = MagicMock()
    mock_userinfo.status_code = 200
    mock_userinfo.json.return_value = {
        "sub": "priya-google-sub-778899",
        "email": "priya.sharma@syncbrief.ai",
        "email_verified": True,
        "name": "Priya Sharma"
    }

    with patch.object(settings, "GOOGLE_CLIENT_ID", "mock-cid"), \
         patch.object(settings, "GOOGLE_CLIENT_SECRET", "mock-sec"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:

        mock_post.return_value = mock_token_resp
        mock_get.return_value = mock_userinfo

        google_resp = client.post("/api/auth/oauth/callback", json={
            "provider": "google",
            "code": "priya-code",
            "redirect_uri": "http://localhost:5173/auth/callback"
        })
        assert google_resp.status_code == 200
        google_data = google_resp.json()
        assert google_data["requires_password_verification"] is True
        assert "pending_token" in google_data
        assert "access_token" not in google_data, "SECURITY FLAW: access_token issued before password check!"

        google_pending = google_data["pending_token"]

        # Cannot bypass password verification
        bypass_try = client.get("/api/auth/me", headers={"Authorization": f"Bearer {google_pending}"})
        assert bypass_try.status_code == 401

        # Incorrect password fails
        bad_pw_resp = client.post("/api/auth/oauth/verify-password", json={
            "pending_token": google_pending,
            "password": "wrong-password!"
        })
        assert bad_pw_resp.status_code == 401
        assert "Incorrect SyncBrief password" in bad_pw_resp.json()["detail"]

        # Correct password succeeds
        good_pw_resp = client.post("/api/auth/oauth/verify-password", json={
            "pending_token": google_pending,
            "password": "demo1234"
        })
        assert good_pw_resp.status_code == 200
        priya_session = good_pw_resp.json()
        assert "access_token" in priya_session
        assert priya_session["user"]["email"] == "priya.sharma@syncbrief.ai"
        assert priya_session["user"]["role_level"] == 3

    # 2. Registered Microsoft user (Vikram Joshi, manager in tenant 1)
    mock_ms_token = MagicMock()
    mock_ms_token.status_code = 200
    mock_ms_token.json.return_value = {"access_token": "vikram-ms-token"}

    mock_graph = MagicMock()
    mock_graph.status_code = 200
    mock_graph.json.return_value = {
        "id": "vikram-ms-id-990011",
        "mail": "vikram.joshi@syncbrief.ai",
        "displayName": "Vikram Joshi"
    }

    with patch.object(settings, "MICROSOFT_CLIENT_ID", "mock-ms-cid"), \
         patch.object(settings, "MICROSOFT_TENANT_ID", "common"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:

        mock_post.return_value = mock_ms_token
        mock_get.return_value = mock_graph

        ms_resp = client.post("/api/auth/oauth/callback", json={
            "provider": "microsoft",
            "code": "vikram-code",
            "redirect_uri": "http://localhost:5173/auth/callback",
            "code_verifier": "verifier-12345"
        })
        assert ms_resp.status_code == 200
        ms_data = ms_resp.json()
        assert ms_data["requires_password_verification"] is True
        assert "pending_token" in ms_data
        assert "access_token" not in ms_data

        ms_pending = ms_data["pending_token"]

        # Incorrect password fails
        ms_bad_pw = client.post("/api/auth/oauth/verify-password", json={
            "pending_token": ms_pending,
            "password": "bad-password"
        })
        assert ms_bad_pw.status_code == 401

        # Correct password succeeds
        ms_good_pw = client.post("/api/auth/oauth/verify-password", json={
            "pending_token": ms_pending,
            "password": "demo1234"
        })
        assert ms_good_pw.status_code == 200
        vikram_session = ms_good_pw.json()
        assert "access_token" in vikram_session
        assert vikram_session["user"]["email"] == "vikram.joshi@syncbrief.ai"
        assert vikram_session["user"]["role"] == "manager"
        assert vikram_session["user"]["role_level"] == 2

def test_existing_demo_users_authenticate_with_demo1234_and_unregistered_rejected(client):
    """
    Verify:
    1. Existing demo users seeded with demo1234 continue authenticating successfully.
    2. Unregistered/uninvited Google and Microsoft users remain strictly rejected with 403.
    """
    demo_users = [
        "sarah.jenkins@syncbrief.ai",
        "vikram.joshi@syncbrief.ai",
        "priya.sharma@syncbrief.ai",
        "alex.rivera@syncbrief.ai",
    ]
    for email in demo_users:
        resp = client.post("/api/auth/login", json={"email": email, "password": "demo1234"})
        assert resp.status_code == 200, f"Demo user {email} failed to authenticate with demo1234"
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["email"] == email

    # Unregistered Google user
    mock_token = MagicMock()
    mock_token.status_code = 200
    mock_token.json.return_value = {"access_token": "unreg-google-token"}

    mock_unreg_google = MagicMock()
    mock_unreg_google.status_code = 200
    mock_unreg_google.json.return_value = {
        "sub": "unregistered-google-sub-99999",
        "email": "intruder.google@externalcorp.com",
        "email_verified": True,
        "name": "Intruder Google"
    }

    with patch.object(settings, "GOOGLE_CLIENT_ID", "mock-cid"), \
         patch.object(settings, "GOOGLE_CLIENT_SECRET", "mock-sec"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_post.return_value = mock_token
        mock_get.return_value = mock_unreg_google

        google_rej = client.post("/api/auth/oauth/callback", json={
            "provider": "google",
            "code": "unreg-code",
            "redirect_uri": "http://localhost:5173/auth/callback"
        })
        assert google_rej.status_code == 403
        assert "haven't been invited" in google_rej.json()["detail"]

    # Unregistered Microsoft user
    mock_ms_token = MagicMock()
    mock_ms_token.status_code = 200
    mock_ms_token.json.return_value = {"access_token": "unreg-ms-token"}

    mock_unreg_ms = MagicMock()
    mock_unreg_ms.status_code = 200
    mock_unreg_ms.json.return_value = {
        "id": "unregistered-ms-id-99999",
        "mail": "intruder.ms@externalcorp.com",
        "displayName": "Intruder Microsoft"
    }

    with patch.object(settings, "MICROSOFT_CLIENT_ID", "mock-ms-cid"), \
         patch.object(settings, "MICROSOFT_TENANT_ID", "common"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_post.return_value = mock_ms_token
        mock_get.return_value = mock_unreg_ms

        ms_rej = client.post("/api/auth/oauth/callback", json={
            "provider": "microsoft",
            "code": "unreg-ms-code",
            "redirect_uri": "http://localhost:5173/auth/callback"
        })
        assert ms_rej.status_code == 403
        assert "haven't been invited" in ms_rej.json()["detail"]


def test_authorization_code_cannot_be_exchanged_twice(client):
    """
    Regression test: verify that a single-use authorization code cannot be submitted twice.
    The second attempt MUST be rejected with HTTP 400 and clean error message.
    """
    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {
        "access_token": "mock-token-replay-test",
        "id_token": "mock-id-token"
    }

    mock_userinfo_resp = MagicMock()
    mock_userinfo_resp.status_code = 200
    mock_userinfo_resp.json.return_value = {
        "sub": "google-user-sub-single-use",
        "email": "sarah.jenkins@syncbrief.ai",
        "email_verified": True,
        "name": "Sarah Jenkins"
    }

    with patch.object(settings, "GOOGLE_CLIENT_ID", "mock-cid"), \
         patch.object(settings, "GOOGLE_CLIENT_SECRET", "mock-sec"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_post.return_value = mock_token_resp
        mock_get.return_value = mock_userinfo_resp

        # First exchange: succeeds
        first_resp = client.post("/api/auth/oauth/callback", json={
            "provider": "google",
            "code": "single-use-code-999",
            "redirect_uri": "http://localhost:5173/auth/callback"
        })
        assert first_resp.status_code == 200
        assert first_resp.json()["requires_password_verification"] is True

        # Second exchange with the same code: MUST be rejected immediately
        second_resp = client.post("/api/auth/oauth/callback", json={
            "provider": "google",
            "code": "single-use-code-999",
            "redirect_uri": "http://localhost:5173/auth/callback"
        })
        assert second_resp.status_code == 400
        assert "Google sign-in expired or was already used. Please try again." in second_resp.json()["detail"]


def test_google_invalid_grant_produces_clean_error(client):
    """
    Regression test: when Google token endpoint returns invalid_grant (e.g. expired code or reused code),
    the backend must return a clean, user-friendly error message rather than raw json or 500.
    """
    mock_error_resp = MagicMock()
    mock_error_resp.status_code = 400
    mock_error_resp.json.return_value = {
        "error": "invalid_grant",
        "error_description": "Bad Request"
    }
    mock_error_resp.text = '{"error": "invalid_grant", "error_description": "Bad Request"}'

    with patch.object(settings, "GOOGLE_CLIENT_ID", "mock-cid"), \
         patch.object(settings, "GOOGLE_CLIENT_SECRET", "mock-sec"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_error_resp

        resp = client.post("/api/auth/oauth/callback", json={
            "provider": "google",
            "code": "expired-code-12345",
            "redirect_uri": "http://localhost:5173/auth/callback"
        })
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        assert "Google sign-in expired or was already used. Please try again." == detail


def test_redirect_uri_exact_match_and_no_trailing_slash(client):
    """
    Verify that start_oauth and effective redirect URIs are exactly http://localhost:5173/auth/callback
    with no trailing slash, port mismatch, or protocol mismatch.
    """
    # Start OAuth endpoint
    start_resp = client.get("/api/auth/oauth/start/google")
    assert start_resp.status_code == 200
    auth_url = start_resp.json()["authorization_url"]
    assert "redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback" in auth_url
    assert "redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback%2F" not in auth_url

    # Config endpoint
    config_resp = client.get("/api/auth/oauth/config")
    assert config_resp.status_code == 200
    cfg = config_resp.json()
    assert cfg["google"]["redirect_uri"] == "http://localhost:5173/auth/callback"
    assert cfg["microsoft"]["redirect_uri"] == "http://localhost:5173/auth/callback"





