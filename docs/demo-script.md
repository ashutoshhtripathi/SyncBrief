# ⏱️ SyncBrief AI — 2-Minute Product Demo Walkthrough
**Enterprise Async Work Intelligence & Real-Time Operations**
*Tagline: "Async updates. Verifiable evidence. Zero status meetings."*

---

## 🎬 Demo Narrative Overview
- **The Problem**: Distributed engineering teams spend 30-45 minutes every morning in synchronous daily standups. Managers waste time chasing down whether reported blockers are real, which pull requests are stalled, and who is waiting on whom.
- **The Solution**: SyncBrief AI gives members a frictionless 60-second async check-in (with speech-to-text), synthesizes progress into executive digests, and **strictly cites the exact Microsoft Teams chat message that proves every blocker**.
- **The Wow Moment**: Clicking a citation jumps directly to the source thread in the channel simulator, highlighting the verbatim evidence with a green verified link badge.

---

## 🕒 Timestamped Walkthrough (120 Seconds)

### **0:00 – 0:25 | The Hook & Landing Page**
1. **Show Landing Page**:
   - Highlight the tagline: *"Async updates. Verifiable evidence. Zero status meetings."*
   - Point out the platform status badge and the AI capability mode (explaining that SyncBrief works 100% offline out-of-the-box or with live Groq Cloud LPUs and Azure OpenAI).
2. **Click "Try Live Demo as Manager"** or the top navigation bar.

---

### **0:25 – 0:50 | The 60-Second Async Check-in (Hero Feature)**
1. Navigate to **Check-in** (`/checkin`).
2. Show the **1-click Role Switcher** in the top navbar: *"Switch to Priya Sharma (Senior Frontend Engineer)"*.
3. Click the quick scenario helper button: **"Fill Hero Scenario (PR #184 Blocker)"**:
   - *Yesterday*: Completed OAuth frontend flow & token refresh handler.
   - *Today*: Testing tenant login endpoints.
   - *Blocker*: PR #184 Auth API is blocked waiting for database migration script from the backend team.
   - *Mood*: 2 / 5 (Blocked/Stalled).
4. Tap the **Voice Input (Web Speech API)** icon to show real-time browser speech transcription.
5. Click **"Submit 60-Second Check-in"**:
   - Confetti explodes on submission celebration!
   - Standup streak increments.
   - Underneath, SyncBrief AI's **Blocker Extraction & Citation Validator** automatically surfaces:
     - Blocker: *PR #184 Auth API is blocked waiting for database migration script from the backend team*
     - Green Badge: **[✓ Verified Link: #backend • msg_492]**

---

### **0:50 – 1:15 | The Verifiable Evidence Link (The Hero Proof)**
1. **Click the Green Citation Badge**:
   - Instantly jumps into the **Teams Channel Simulator** (`/channels?channel=backend&highlight=msg_492`).
   - The exact chat message from Vikram Joshi in `#backend` thread `msg_492` is highlighted with an animated green pulsating border:
     > *"The v2.4 Auth schema migration script `0042_oauth_tenants.sql` is currently blocked on the security audit review. ETA is tomorrow 4 PM. Do not merge PR #184 until this runs."*
2. **Explain the Innovation**:
   - *"The AI doesn't just summarize — it proves it. Our strict validator requires verbatim substring matching against the database. Unverified references are discarded."*
3. Show the **Channel Privacy Opt-in Toggle**: SyncBrief only reads opted-in channels; private DMs are strictly off-limits.

---

### **1:15 – 1:35 | Executive Digest & Azure DevOps Work Items**
1. Navigate to **Daily Digest** (`/digest`):
   - Show the Executive KPI summary: *5/6 check-ins completed (83%), 3 active blockers, 3.0 engineering hours saved today*.
   - Point out **Suggested Manager Actions**: *"Sarah (Manager) contact SecOps Lead to expedite audit on 0042_oauth_tenants.sql (cited in #backend msg_492)"*.
   - Click **"Post to Teams"**: View the interactive Microsoft Teams Adaptive Card (Schema 1.5) preview.
   - Click **"Export PDF"**: Downloads a clean standup executive summary.
2. Navigate to **Blocker Board** (`/blockers`):
   - Show the drag-and-drop Kanban columns (*Open*, *In Resolution*, *Resolved*).
   - Click **"+ Create ADO Work Item"**: Inspect the official JSON-Patch payload (`/fields/Microsoft.VSTS.CMMI.Blocked = "Yes"`) and the returned mock ID `ADO-4820`.
   - Click **"Test Hallucination Detection"**: Watch the strict validator catch and flag a fabricated quote with a red unverified badge!

---

### **1:35 – 2:00 | Team Insights & Meeting Recovery Calculator**
1. Navigate to **Team Insights** (`/insights`):
   - Point to the **Team Timezone Strip**: Shows Vikram and Priya online in Bengaluru (IST), James in London (BST), and Sarah in Seattle (PDT).
   - Adjust the **Meeting Time Saved Calculator**:
     - Drag the *Team Size* or *Meeting Duration* slider: Watch the recovered hours and dollar savings recalculate live transparently.
   - Show the Recharts trend for team mood and blocker age distribution.
2. **Closing Punchline**:
   - *"SyncBrief AI restores 30 minutes of deep work to every engineer, gives managers verified certainty with zero status meetings, and integrates natively with Microsoft Teams and Azure DevOps."*
