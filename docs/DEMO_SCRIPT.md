# SyncBrief AI - Product Demo Script & Walkthrough
**Platform**: SyncBrief AI — Enterprise Async Work Intelligence & Real-Time AI Operations  
**Tagline**: *"Async updates. Verifiable evidence. Zero status meetings."*  
**Duration**: 3 to 5 minutes  

---

## 🎯 North Star Objective
Demonstrate that SyncBrief AI is distinctly **faster, calmer, and clearer** than Jira and SharePoint. Show how distributed teams eliminate morning standup meetings using 60-second async check-ins with AI-extracted blockers cited to exact chat messages.

---

## ⏱️ Step-by-Step Demo Flow

### Phase 1: The Engineer's 60-Second Async Standup (1 min)
1. **Login as Priya Sharma (Employee)**:
   - Use the 1-click persona switcher on the top bar or click **"Demo Login: Priya Sharma (Engineer)"**.
   - Note the role-tailored **Today** home screen: clean, calm, 8px grid, zero meeting clutter.
2. **Submit Daily Standup**:
   - Click **"Check In Now (<60s)"** or press shortcut `G C`.
   - Show how yesterday's task is prefilled.
   - Adjust the progress slider to **85%**.
   - Speak or type blockers: *"Blocked on Payments API webhook signature verification from Rohan."*
   - Mention PR link and click **"Submit Check-in"**.
   - Notice instant optimistic confirmation and streak counter increment.

---

### Phase 2: AI Blocker Extraction with Verifiable Citations (1.5 min)
1. **Switch to Sarah Chen (Engineering Manager)**:
   - Click persona switcher -> **Sarah Chen (Manager)**.
2. **View Verified Citations**:
   - Navigate to **"Daily Standup Digest & Blockers"** (`G D`).
   - Highlight the blocker: *"Payments webhook verification failing on signature secret drift"*.
   - Point out the **Citation Badge**: `[#backend • msg_492] (96% Confidence - VERIFIED)`.
   - Click on the badge: the chat inspection modal opens instantly showing the **exact, word-for-word message from Rohan Patel** in `#backend`.
   - **Key Operational Value**: Sarah didn't have to call a 30-minute status meeting or ping 4 engineers to verify what broke. The proof is right there.
3. **1-Click Azure DevOps Work Item Creation**:
   - Click **"Create Azure DevOps Task"**.
   - Show the generated work item card (`ADO-7492`) linked to the citation evidence.
4. **Send Microsoft Teams Adaptive Card**:
   - Click **"Send Teams Summary Card"**.
   - Open the preview to display the formatted JSON Adaptive Card ready for Teams channel webhooks.

---

### Phase 3: Sprints, Kanban Board & Optimistic Concurrency (1 min)
1. **Navigate to Sprint Board** (`G B`):
   - Four clean Kanban columns: *To do*, *In progress*, *Blocked*, *Done*.
   - Notice zero emojis in UI chrome; clean Lucide icons and subtle motion.
2. **Slide-Over Task Drawer**:
   - Click on any task card (e.g. `Task #1`).
   - The slide-over `Drawer` opens smoothly.
   - Show the **Optimistic Concurrency Tag**: `Locking v1`.
3. **Simulate 409 Conflict Protection**:
   - Click **"Test Conflict Handling (Simulate Stale Version)"**.
   - A live toast appears: *"Conflict (HTTP 409): Task was modified by another user. Reloading latest state..."*.
   - Demonstrates how SyncBrief protects concurrent distributed updates without data loss.

---

### Phase 4: Strict Backend RBAC & Audit-Grade Points (1 min)
1. **Fair Appraisal & Mathematical Points Proof**:
   - Navigate to **"Quarterly Appraisal"** (`G A`).
   - Click on an employee's appraisal card.
   - Click **"Verify Formula Proof"**: calls `GET /api/points/recompute/{user_id}` live.
   - Shows the exact formula calculation:
     $$\text{Points} = \max(0, \text{Difficulty} \times (1 - 0.25 \times \text{Carry-overs}))$$
   - Displays `is_mathematically_verified: true` with individual task difficulty breakdowns.
2. **Backend Security Proof**:
   - Show how peers cannot access each other's data (backend returns HTTP 403 Forbidden).
   - Show the **Immutable Audit Log** (`/api/audit-logs`) tracking every task mutation, user edit, and sprint transition.

---

## 💡 Key Takeaway
> *"Jira manages tickets. SharePoint stores files. SyncBrief AI manages reality: async updates, cryptographic proof of blockers, and zero status meetings."*
