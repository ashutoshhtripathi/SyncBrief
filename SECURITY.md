# SyncBrief AI - Enterprise Security & Threat Model

SyncBrief AI is built to enterprise-grade compliance standards for distributed engineering organizations. This document details the threat model, mitigation strategies, cryptographic controls, and data integrity guarantees implemented across the stack.

---

## 1. Threat Model & Mitigations

| Threat Category | Potential Attack Vector | SyncBrief AI Mitigation Architecture | Status |
| :--- | :--- | :--- | :--- |
| **Credential Compromise** | Rainbow tables, dictionary attacks | **Argon2id** password hashing (`argon2-cffi`) with backward-compatible fallback to bcrypt for legacy credentials. | Active |
| **Session Hijacking** | Leaked long-lived access tokens | Dual-token authentication: short-lived JWT access tokens + rotated 7-day refresh tokens (`POST /api/auth/refresh`) with instant revocation on logout (`POST /api/auth/logout`). | Active |
| **IDOR / Privilege Escalation** | Manipulating URL query params or IDs | **Strict Backend Hierarchy Enforcement**: Visibility is checked against the database reporting graph (`get_subordinate_ids`). Peers attempting to view peers receive **HTTP 403 Forbidden**. | Active |
| **Lost Updates / Race Conditions** | Two engineers updating a task concurrently | **Optimistic Concurrency Control**: Tasks maintain an incremental `version` column. Stale submissions return **HTTP 409 Conflict** with client re-synchronization. | Active |
| **Data Loss / Destructive Writes** | Accidental or malicious record deletion | **Soft Delete Pattern**: All deletions set `deleted_at: timestamp`. Tasks can be restored with full audit history via `POST /api/tasks/{id}/restore`. | Active |
| **Data Tampering & Unfair Appraisals** | Arbitrary points modification | **Audit-Grade Mathematical Derivation**: Points cannot be forged. They are dynamically recomputed from raw completed task difficulty and carry-over penalties: `max(0, difficulty * (1 - 0.25 * carry_overs))`. Verified via `GET /api/points/recompute/{user_id}`. | Active |
| **AI Prompt Injection** | Adversarial instructions hidden in chat evidence or check-ins | **XML Delimiter Isolation**: Untrusted messages are fenced within `<untrusted_user_input>` and `<untrusted_chat_evidence>` tags with system instructions explicitly prohibiting command execution inside untrusted boundaries. | Active |
| **Cross-Site Scripting (XSS) & Clickjacking** | Malicious script execution in iframe | **Enterprise Security Headers Middleware**: Enforces `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Strict-Transport-Security`. | Active |
| **Denial of Service (DoS)** | Automated endpoint flooding | **Token Bucket Rate Limiting**: In-memory sliding window limiter restricting requests per IP address with HTTP 429 Too Many Requests response. | Active |
| **PII / GDPR Compliance** | User rights to access & erasure | Self-service data export (`GET /api/auth/me/export`) and self-service account deactivation (`POST /api/auth/me/delete-account`). | Active |

---

## 2. Authentication & Cryptography

### Credential Hashing
- Algorithm: **Argon2id**
- Library: `argon2-cffi`
- Fallback: Transparent verification of legacy bcrypt hashes (`$2b$`) to ensure zero disruption during upgrades.

### JWT Tokens
- **Access Token**: Short-lived (60 minutes default), signed with HMAC-SHA256 (`HS256`).
- **Refresh Token**: 7-day validity, bound to user database record (`User.refresh_token`). Rotated upon each refresh; invalidated upon `POST /api/auth/logout`.

---

## 3. Organizational Hierarchy & Visibility Rule (RBAC)

The backend guarantees that:
$$\text{CanView}(A, B) \iff (A = B) \lor (B \in \text{Subordinates}(A)) \lor (\text{Role}(A) \in \{\text{director}, \text{admin}\})$$

1. **Employees** can only view their own tasks, check-ins, and appraisal points.
2. **Peers** at the same reporting level cannot see each other's updates.
3. **Managers** can view their own data and everyone reporting directly or indirectly to them.
4. **Directors/Admins** have full organizational visibility.

Every endpoint (`/api/checkins/user/{id}`, `/api/tasks`, `/api/points/user/{id}`, `/api/points/recompute/{id}`) enforces this rule in Python code before database queries are returned.

---

## 4. Immutable Audit Trail

Every state change produces an immutable record in `audit_logs`:
- `actor_id` & `actor_name`
- `action` (e.g. `CREATE_TASK`, `UPDATE_TASK`, `UPDATE_TASK_STATUS`, `DELETE_TASK`, `RESTORE_TASK`, `CREATE_USER`, `UPDATE_USER`, `DELETE_USER`)
- `entity_type` & `entity_id`
- `old_values_json` (snapshot before change)
- `new_values_json` (snapshot after change)
- `created_at` timestamp

Audit logs are accessible via `GET /api/audit-logs` strictly scoped to the user's reporting tree.

---

## 5. Security Vulnerability Reporting

To report potential vulnerabilities in SyncBrief AI:
1. Contact the security team at `security@syncbrief.ai`.
2. Please provide reproducible proof of concept steps.
3. Vulnerabilities will be triaged within 24 business hours.
