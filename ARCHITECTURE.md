# 🏛️ SyncBrief AI — Technical Architecture

This document provides a comprehensive technical overview of **SyncBrief AI**, detailing every framework, library, and architectural decision, along with the engineering rationale behind each choice.

---

## 1. High-Level System Architecture

SyncBrief AI is built on a decoupled **Client-Server-Agentic** architecture optimized for Microsoft enterprise environments:

```
[ React 18 + Vite SPA ] 
         │ (REST / JSON + JWT Auth)
         ▼
[ Python FastAPI Backend ] ───► [ SQLite / SQLAlchemy ORM ]
         │
         ├──► [ Evidence & Citation Validator ] ───► [ Opted-in Channel Message Store ]
         ├──► [ AI Provider Router: Azure OpenAI / Offline Deterministic LLM ]
         ├──► [ Azure DevOps Work Item JSON-Patch Client ]
         └──► [ Microsoft Teams Bot Framework / Adaptive Card Generator ]
```

---

## 2. Technology Stack & Rationale

### A. Backend Layer

| Technology | Role | Why We Chose It |
|---|---|---|
| **Python 3.14 & FastAPI** | Core API Framework | High-throughput asynchronous ASGI web framework. Automatic interactive OpenAPI (`/docs`) generation, native Python type hints, and low latency for LLM streaming and JSON serialization. |
| **Pydantic v2** | Data Validation & Schemas | Rust-powered schema validation that ensures strict API request/response hygiene, eliminates invalid data entering models, and compiles fast JSON payloads. |
| **SQLAlchemy 2.0 ORM** | Object-Relational Mapping | Standard enterprise ORM providing clean relationship mapping (`User`, `Sprint`, `Task`, `Checkin`, `Blocker`, `Citation`) and robust query composition for hierarchy traversal. |
| **SQLite (Production-Ready File DB)** | Persistence Engine | Zero-dependency, self-contained, ACID-compliant database ideal for rapid local development, Docker deployments, and deterministic test suites. Directly migratable to Azure PostgreSQL or Azure Cosmos DB via connection string change. |
| **Pytest & TestClient** | Automated Testing | High-speed test harness validating 100% of hierarchy access control (403 Forbidden on peers/superiors), sprint carry-over mathematics, and citation validator accuracy. |
| **BCrypt** | Credential Hashing | Secure, salted password hashing directly executed via Python's native bcrypt engine, safeguarding against timing and collision attacks. |

---

### B. Frontend Layer

| Technology | Role | Why We Chose It |
|---|---|---|
| **React 18 + TypeScript** | Client-Side SPA Framework | Component-based modular UI with compile-time type safety across API schemas, sprint tasks, and Kanban drag-and-drop states. |
| **Vite 6** | Build & Dev Server | Sub-second Hot Module Replacement (HMR) and optimized Rollup tree-shaking for instantaneous development cycles and small production bundles. |
| **Tailwind CSS (Fluent 2 Palette)** | Design System & Styling | Utility-first CSS using Microsoft Fluent design tokens (Electric Blue `#0078D4`, cobalt accents, glassmorphic backdrops, full dark mode support). Zero runtime CSS overhead. |
| **Lucide React** | Iconography | Lightweight, consistent SVG icon set matching Microsoft enterprise aesthetics. |
| **HTML5 Drag and Drop API** | Kanban Board Movement | Native browser drag-and-drop without bulky external library dependencies (e.g. `react-beautiful-dnd`), ensuring 60fps card transitions between sprint columns. |
| **Web Speech API** | Voice-to-Text Input | Native browser speech recognition providing zero-latency speech-to-text for the 60-second async check-in without requiring third-party audio streaming APIs. |
| **Canvas Confetti** | Micro-interactions | Visual reward feedback triggered upon successful standup submission to drive daily check-in habit formation and team streaks. |
| **Vitest & React Testing Library** | Unit Testing | Lightning-fast ESM test runner with JSDOM environment for automated UI assertions. |

---

## 3. Core Architectural Differentiators

### 1. Hierarchy & Backend-Enforced Role-Based Access Control (RBAC)
- **Problem**: In Jira or traditional task managers, URL parameter tampering allows curious team members to snoop on peers' appraisals or incomplete tasks.
- **SyncBrief Solution**: In `backend/app/hierarchy.py`, every request to `/api/checkins?user_id=X` or `/api/points/user/X` executes a recursive subordinate tree check.
  - A user can only access records for themselves and individuals who sit strictly below them in their reporting chain.
  - Any request to view a peer (same level) or superior raises an HTTP `403 Forbidden: Hierarchy access violation`.

### 2. Task Points with Carry-Over Formula
- **Points Formula**:
  $$\text{Points} = \text{Difficulty} \times \max\left(0, 1.0 - 0.25 \times \text{carried\_over\_count}\right)$$
- Full points awarded for delivering on time within the sprint.
- Each carry-over reduces points earned by 25% (0 points awarded after 4 carry-overs), transparently discouraging scope slippage while rewarding completion.

### 3. AI Evidence & Citation Engine with Hallucination Guard
- **Problem**: LLMs frequently hallucinate blocker causes or attribute them to the wrong engineer.
- **SyncBrief Solution**: The multi-step Citation Validator inspects all extracted blockers:
  - Validates that the cited `message_id` exists in the opted-in channel message store.
  - Verifies that the author and timestamp match.
  - Confirms verbatim substring inclusion of the quote.
  - Any fabricated citation is marked `UNVERIFIED` with an explicit audit rejection reason.

### 4. Privacy-First Channel Boundaries
- Private DMs and non-opted-in channels are physically omitted from message retrieval queries.
- Teams maintain complete control over which channels SyncBrief is permitted to index for blocker verification.

### 5. Optimistic Concurrency Control (Lost Update Prevention)
- **Problem**: In distributed teams, multiple engineers or managers modifying the same task or blocker simultaneously cause silent overwrites.
- **SyncBrief Solution**: Every `Task` record maintains an incremental `version: Integer` column.
  - When clients update a task, they include the version they read (`version: client_v`).
  - If `client_v != server_v`, the backend immediately raises **HTTP 409 Conflict**.
  - The client displays a live conflict banner and re-synchronizes with the latest server state without losing uncommitted edits.

### 6. Enterprise Cryptography & Session Management
- **Credential Storage**: Passwords hashed using **Argon2id** (`argon2-cffi`) with backward-compatible fallback to bcrypt.
- **Dual-Token JWT**: Short-lived (60m) access tokens for stateless API authorization combined with 7-day refresh tokens (`User.refresh_token`) stored in the database for instant session invalidation via `POST /api/auth/logout`.
- **Security Headers Middleware**: Automatically injects strict CSP, HSTS (`max-age=31536000`), `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`.
- **Token Bucket Rate Limiting**: In-memory sliding window limiter restricting requests per IP address to safeguard against DoS attacks.

### 7. Soft Delete & Immutable Audit Log
- All destructive operations execute soft-delete (`deleted_at = datetime.utcnow()`).
- Tasks can be inspected in the audit log and restored via `POST /api/tasks/{task_id}/restore`.
- Every mutation appends an immutable entry to `audit_logs` storing `actor_id`, `action`, `entity_type`, `old_values_json`, `new_values_json`, and `timestamp`.

### 8. Audit-Grade Points Recomputation & Mathematical Proof
- Appraisal points are **recomputable and verified** from first principles:
  $$\text{Points} = \sum_{t \in \text{CompletedTasks}} \max(0, t.\text{difficulty} \times (1 - 0.25 \times t.\text{carry\_over}))$$
- An automated audit endpoint (`GET /api/points/recompute/{user_id}`) returns the step-by-step mathematical proof confirming that cached summary points match raw records with zero divergence.

### 9. AI Prompt Injection Hardening
- Untrusted user input and chat messages are segregated inside explicit XML boundary delimiters: `<untrusted_user_input>` and `<untrusted_chat_evidence>`.
- System instructions strictly prohibit following instructions or overriding system constraints within untrusted tags.

