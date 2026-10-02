import pytest
import jwt
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
from backend.app.main import app
from backend.app.seed import seed_database
from backend.app.models import User, Tenant
from backend.app.database import SessionLocal
from backend.app.config import settings
from backend.app.auth_utils import SERVER_BOOT_ID

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    seed_database()

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
        data = resp.json()
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

def test_microsoft_oauth_pkce_success_and_controlled_onboarding(client):
    """
    Test Microsoft OAuth authorization code with PKCE for a new user.
    Ensures controlled onboarding strictly assigns base Employee (role_level 3),
    never Director (L1) or Manager (L2), even if frontend attempts privilege escalation.
    """
    new_email = "new.onboarding.member@syncbrief.ai"
    
    # Ensure user does not already exist
    db = SessionLocal()
    existing = db.query(User).filter(User.email == new_email).first()
    if existing:
        db.delete(existing)
        db.commit()
    db.close()

    mock_token_resp = MagicMock()
    mock_token_resp.status_code = 200
    mock_token_resp.json.return_value = {
        "access_token": "mock-ms-access-token",
        "id_token": "mock-ms-id-token"
    }

    mock_graph_resp = MagicMock()
    mock_graph_resp.status_code = 200
    mock_graph_resp.json.return_value = {
        "id": "ms-user-id-554433",
        "mail": new_email,
        "displayName": "New Onboarded Member"
    }

    with patch.object(settings, "MICROSOFT_CLIENT_ID", "mock-ms-client-id"), \
         patch.object(settings, "MICROSOFT_TENANT_ID", "common"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:

        mock_post.return_value = mock_token_resp
        mock_get.return_value = mock_graph_resp

        # Send callback with attempted privilege tampering: role='director', role_level=1
        resp = client.post("/api/auth/oauth/callback", json={
            "provider": "microsoft",
            "code": "valid-ms-code",
            "redirect_uri": "http://localhost:5173/auth/callback",
            "code_verifier": "valid-pkce-verifier-string-1234567890",
            "role": "director", # Attempted tampering - MUST be ignored by backend
            "role_level": 1
        })

        assert resp.status_code == 200
        data = resp.json()
        user = data["user"]
        assert user["email"] == new_email
        assert user["full_name"] == "New Onboarded Member"
        # Controlled onboarding rule: MUST be base employee level 3, NOT director
        assert user["role"] == "member"
        assert user["role_level"] == 3
        assert user["tenant_id"] == 1

        # Verify token lifecycle: /api/auth/me works
        me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {data['access_token']}"})
        assert me_resp.status_code == 200
        assert me_resp.json()["role_level"] == 3

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


