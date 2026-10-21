# ⚡ SyncBrief AI
> **"Async updates. Verifiable evidence. Zero status meetings."**  
> *Enterprise Async Work Intelligence & Real-Time AI Operations Platform*

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18_%2B_Vite-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Design](https://img.shields.io/badge/Design-Enterprise_Minimalist_SaaS-0078D4.svg)](https://microsoft.com)
[![Pytest](https://img.shields.io/badge/Pytest-27_Passed-success.svg)](https://pytest.org)
[![Vitest](https://img.shields.io/badge/Vitest-5_Passed-success.svg)](https://vitest.dev)
[![Security](https://img.shields.io/badge/Security-Argon2_%2B_RBAC_%2B_Audit_Logs-blue.svg)](https://github.com)


---

## 🎯 What is SyncBrief AI?
Distributed engineering teams spend **30 to 45 minutes every morning** stuck in synchronous daily standup meetings. Managers struggle to verify whether blockers are genuine or which cross-team dependency is holding up a pull request.

**SyncBrief AI replaces synchronous standup meetings with high-fidelity async signals:**
1. **60-Second Async Check-in**: Members submit updates using speech-to-text or quick bullets with autosave and streak tracking.
2. **AI Blocker Detection with Verifiable Evidence Citations (The Hero Feature)**: Every extracted blocker is strictly verified against opted-in team channels. Clickable citation badges link directly to the verbatim source message in Microsoft Teams.
3. **Executive Daily Digest**: Synthesizes team progress, identified risks, missing check-ins, and actionable unblocking recommendations for managers.
4. **Kanban Blocker Board + Azure DevOps**: 1-click sync creating Work Items flagged as `Blocked=Yes` with citation payloads.
5. **Team Velocity & Meeting Recovery**: Interactive calculator showing recovered engineering hours and dollar savings with editable assumptions.
6. **Privacy First**: Zero DM scraping. Only opted-in channels are analyzed. Full AI governance audit trail.

---

## 🏗️ Architecture Diagram

```mermaid
graph TD
    subgraph Client ["Client Layer (React 18 + Vite + TS + Tailwind)"]
        UI[App Shell & Microsoft Fluent Theme]
        CheckinUI["Guided Task Check-in & Slider"]
        SprintUI["Sprint Kanban Board & Carryover"]
        PointsUI["My Points & Appraisal Matrix"]
        JiraUI["SyncBrief vs Jira & CSV Importer"]
        HierarchyUI["Org Hierarchy & Backend RBAC"]
        DigestUI["Daily Digest & PDF/MD Export"]
        KanbanUI["Blocker Board & ADO Sync"]
        SimUI["Teams Channel Simulator"]
        InsightsUI["Productivity Recovery Calculator"]
    end

    subgraph Backend ["Backend API (Python FastAPI + Pydantic v2 + SQLite)"]
        AuthAPI["/api/auth (JWT, Hierarchy Tree, Admin CRUD)"]
        SprintAPI["/api/sprints (Lifecycle, Carry-over, Close)"]
        TaskAPI["/api/tasks (CRUD, Kanban Status Patch, Filters)"]
        PointsAPI["/api/points (My Points, Appraisal, CSV Export)"]
        JiraAPI["/api/jira (CSV Parser & Sprint Importer)"]
        CheckinAPI["/api/checkins (Task-guided Standup, Autosave)"]
        DigestAPI["/api/digest (AI Synthesis & Adaptive Cards)"]
        BlockerAPI["/api/blockers (Kanban & ADO Sync)"]
        ChannelsAPI["/api/channels (Simulator & Opt-in Toggles)"]
    end

    subgraph AI_Engine ["AI & Evidence Engine"]
        ProviderRouter{AI Provider Router}
        AzureOpenAI["Azure OpenAI Provider (GPT-4o)"]
        MockAI["Deterministic Demo AI (Offline)"]
        Validator["Strict Citation Validator (Verbatim Matcher)"]
        AuditTrail["Governance Audit Log"]
    end

    subgraph Microsoft_Ecosystem ["Microsoft Ecosystem Integrations"]
        TeamsBot["Microsoft Teams Bot Framework & Adaptive Cards"]
        ADO["Azure DevOps REST API (JSON-Patch)"]
    end

    Client --> Backend
    Backend --> ProviderRouter
    ProviderRouter -->|Keys Configured| AzureOpenAI
    ProviderRouter -->|Offline / Keys Missing| MockAI
    AI_Engine --> Validator
    AI_Engine --> AuditTrail
    Backend --> Microsoft_Ecosystem
```

---

## 🗄️ Database Schema (Entity-Relationship Diagram)

```mermaid
erDiagram
    USERS ||--o{ USERS : "reports_to (Hierarchy)"
    USERS ||--o{ TASKS : "assigned_to"
    USERS ||--o{ CHECKINS : "submits"
    USERS ||--o{ MESSAGES : "authors"

    SPRINTS ||--o{ TASKS : "contains"
    
    CHECKINS ||--o| TASKS : "references_task"
    CHECKINS ||--o{ BLOCKERS : "triggers"
    
    BLOCKERS ||--o{ CITATIONS : "proves"
    CHANNELS ||--o{ MESSAGES : "contains"
    MESSAGES ||--o{ CITATIONS : "cited_by"

    USERS {
        int id PK
        string email UK
        string full_name
        string role
        string title
        int role_level "1=Director, 2=Manager, 3=Employee"
        int reports_to_id FK
        string org_type "engineering"
        int streak_count
    }

    SPRINTS {
        int id PK
        string name
        datetime start_date
        datetime end_date
        string status "planned / active / closed"
        string goal
    }

    TASKS {
        int id PK
        string title
        string description
        int assignee_id FK
        string priority "High / Medium / Low"
        int difficulty "1, 2, 3, 5, 8 (Fibonacci)"
        string status "To do / In progress / Blocked / Done"
        int progress_pct
        int carried_over_count
        int sprint_id FK
        datetime completed_at
    }

    CHECKINS {
        int id PK
        int user_id FK
        int task_id FK
        string task_title
        int progress_pct
        string progress_note
        string next_steps
        string sync_needed_with_json
        string other_task_ids_json
        string yesterday
        string today
        string blockers_text
        int mood "1 to 5"
        int streak_count
    }

    BLOCKERS {
        int id PK
        int checkin_id FK
        string summary
        string severity "low / medium / high"
        string status "open / in_progress / resolved"
        string owner_name
        string blocked_by
        string related_work_item
        string devops_work_item_id
    }

    CITATIONS {
        int id PK
        int blocker_id FK
        string message_id FK
        string channel
        string author
        string quote
        string status "VERIFIED / UNVERIFIED"
        string rejection_reason
    }

    CHANNELS {
        int id PK
        string name UK
        string description
        boolean is_syncbrief_enabled
        int member_count
    }

    MESSAGES {
        string id PK
        int channel_id FK
        string author_name
        string content
        string thread_id
        datetime timestamp
    }
```

---

## 🚀 Quickstart in 3 Steps

### Option A: Non-Docker Path (Recommended for local dev)
SyncBrief AI is pre-configured with a 1-command startup script:

```bash
# Step 1: Clone the repository
git clone https://github.com/ashutoshhtripathi/SyncBrief.git
cd SyncBrief

# Step 2: Install dependencies & seed realistic data
make install && make seed

# Step 3: Run the app
./run.sh
# or run 'make dev'
```
- Open **http://localhost:5173** in your browser.
- Backend API docs available at **http://localhost:8000/docs**.

---

### Option B: Docker Compose Path

```bash
# Run with Docker Compose
docker compose up --build
```
- Access the web application at **http://localhost:3000** or **http://localhost:5173**.

---

## ⚡ Real-Time AI Powered by Groq Cloud LPUs

SyncBrief AI features a real-time conversational work-intelligence chatbot powered by **Groq Cloud LPUs** running **`openai/gpt-oss-120b`** with sub-second streaming token inference, zero hallucination, and strict database grounding across active sprints, tasks, check-ins, blockers, dependencies, and hierarchy.

To configure Groq:
```env
GROQ_API_KEY="gsk_..."
GROQ_MODEL="openai/gpt-oss-120b"
GROQ_BASE_URL="https://api.groq.com/openai/v1"
```

## 🔑 Dual Cloud AI & Offline Capability

SyncBrief AI is architected with flexible AI capability: it runs locally with a deterministic engine out-of-the-box without requiring API keys, or connects directly with high-performance Groq Cloud LPUs or Azure OpenAI.

To enable live Azure OpenAI GPT-4o and Microsoft Teams webhooks:
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Populate your Azure OpenAI credentials:
   ```env
   AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
   AZURE_OPENAI_KEY="your-azure-openai-key"
   AZURE_OPENAI_DEPLOYMENT="gpt-4o"
   AZURE_OPENAI_API_VERSION="2024-08-01-preview"
   ```
3. (Optional) Connect live Microsoft Teams:
   ```env
   TEAMS_WEBHOOK_URL="https://outlook.office.com/webhook/..."
   ```
   *See [docs/teams-setup.md](file:///Users/ashutoshtripathi/Anti%20Gravity/SyncBrief/docs/teams-setup.md) for the complete Azure Bot Service setup guide.*
4. (Optional) Connect live Azure DevOps:
   ```env
   AZURE_DEVOPS_ORG="your-org"
   AZURE_DEVOPS_PROJECT="your-project"
   AZURE_DEVOPS_PAT="your-personal-access-token"
   ```
5. Restart the server. SyncBrief AI will automatically detect the keys, switch to live cloud execution, and display the **"Azure OpenAI (GPT-4o)"** badge in the UI!

---

## 🌟 Key Features Walkthrough

| Feature | Description |
| :--- | :--- |
| **Hero Verifiable Citations** | Blocker extraction that validates quotes against database records. Clicking citation badges scrolls and highlights the source chat message. |
| **60-Second Check-in** | Streamlined async check-in with Web Speech API voice-to-text, mood rating, autosave drafts, and confetti streaks. |
| **Teams Simulator** | Channel simulator (#backend, #frontend, #devops) showing real chat evidence and instant opt-in privacy toggles. |
| **Executive Daily Digest** | Automated synthesis of accomplishments, blockers, cross-team risks, missing check-ins, and suggested actions. Export to Markdown or PDF. |
| **Blocker Kanban Board** | Drag-and-drop workflow with direct Azure DevOps REST integration to create work items flagged as `Blocked=Yes`. |
| **Meeting Savings Calculator** | Interactive, editable model calculating engineering hours and dollar savings recovered from status meetings. |
| **Team Timezone Strip** | Live presence indicators showing local time, working hours, and standup streaks across India, the UK, and the US. |
| **Hallucination Detection** | 1-click test button demonstrating how the citation validator catches and rejects fake messages. |
| **AI Governance Audit Trail** | Full explainability log capturing model name, prompt versions, and input IDs. |

---

## 🧪 Automated Test Suite

Run the full backend and frontend test suite with:

```bash
# Run backend pytest (13 tests)
PYTHONPATH=. backend/.venv/bin/pytest backend/tests -v

# Run frontend Vitest (2 tests)
cd frontend && npm test -- --run
```

All 15 automated tests pass:
- Citation Validator: valid citations, fake message IDs, hallucinated quotes, and privacy opt-out enforcement.
- Blocker Extraction: hero scenario detection, "None" handling, and executive digest synthesis.
- API Endpoints: health check, 1-click demo login, check-in CRUD, blocker drag-and-drop, and Azure DevOps payload generation.
- Frontend: CitationBadge verification status and channel routing rendering.

---

## 🎬 2-Minute Product Demo Walkthrough
Follow the step-by-step 120-second walkthrough in [docs/demo-script.md](file:///Users/ashutoshtripathi/Anti%20Gravity/SyncBrief/docs/demo-script.md).

---

## ⚠️ Known Limitations
1. **Web Speech API Browser Compatibility**: Native speech-to-text uses the W3C Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`), which is natively supported on Google Chrome, Microsoft Edge, and Safari, but may require manual permission approval on Firefox.
2. **SQLite Document Mode**: While models use JSON columns and document structures compatible with Azure Cosmos DB and PostgreSQL, the local dev instance defaults to SQLite for lightweight zero-configuration setup.
3. **Channel Simulator vs Live Graph API**: The built-in simulator provides an isolated, reliable demo environment for local testing and staging without requiring tenant admin privileges on a live Microsoft 365 tenant. Production deployment connects via the Bot Framework endpoint at `/api/teams/messages`.
