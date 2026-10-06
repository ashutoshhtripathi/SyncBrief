import json
import re
from typing import List, Dict, Any
from backend.app.ai.base import AIProvider

class MockProvider(AIProvider):
    @property
    def name(self) -> str:
        return "Deterministic Demo AI (Offline)"

    @property
    def is_mock(self) -> bool:
        return True

    async def extract_blockers(
        self,
        checkin_data: Dict[str, Any],
        channel_messages: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Deterministic rule-based blocker extractor.
        Scans checkin blocker text and accurately pairs citations with matching channel messages.
        """
        blockers_text = (checkin_data.get("blockers_text") or "").strip()
        author_name = checkin_data.get("user_name") or checkin_data.get("author_name") or "Team Member"
        pr_link = checkin_data.get("pr_link") or ""
        work_item_id = checkin_data.get("work_item_id") or ""

        if not blockers_text or blockers_text.lower() in ["none", "no blockers", "n/a", "nil", "all good", "nothing"]:
            return []

        results = []

        # HERO SCENARIO: PR #184 / Migration / Auth API
        lower_text = blockers_text.lower()
        if "184" in blockers_text or "migration" in lower_text or "auth" in lower_text or "backend" in lower_text:
            # Look for msg_492 in channel messages
            matching_msg = None
            for m in channel_messages:
                if m.get("id") == "msg_492" or "0042_oauth_tenants.sql" in m.get("content", ""):
                    matching_msg = m
                    break

            citations = []
            if matching_msg:
                # Verbatim quote from message content
                raw_content = matching_msg.get("content", "")
                quote = "The v2.4 Auth schema migration script 0042_oauth_tenants.sql is currently blocked on the security audit review."
                if quote not in raw_content:
                    # extract actual matching sentence
                    sentences = [s.strip() for s in raw_content.split(".") if "blocked" in s.lower() or "migration" in s.lower()]
                    quote = sentences[0] + "." if sentences else raw_content[:100]

                citations.append({
                    "message_id": matching_msg.get("id"),
                    "channel": matching_msg.get("channel_name", "#backend"),
                    "author": matching_msg.get("author_name", "Vikram Joshi"),
                    "timestamp": str(matching_msg.get("timestamp", "")),
                    "quote": quote
                })

            results.append({
                "blocker_summary": "PR #184 Auth API is blocked waiting for database migration script from the backend team",
                "severity": "high",
                "owner": author_name,
                "blocked_by": "Backend Team (Vikram Joshi)",
                "related_work_item": "PR #184" if "184" in blockers_text else (work_item_id or "PR #184"),
                "confidence": 0.98,
                "citations": citations
            })
            return results

        # DevOps / Ingress / Cluster scenario
        if "cluster" in lower_text or "staging" in lower_text or "ingress" in lower_text or "cert" in lower_text or "devops" in lower_text:
            matching_msg = next((m for m in channel_messages if "staging" in m.get("content", "").lower() or "ingress" in m.get("content", "").lower()), None)
            citations = []
            if matching_msg:
                citations.append({
                    "message_id": matching_msg.get("id"),
                    "channel": matching_msg.get("channel_name", "#devops"),
                    "author": matching_msg.get("author_name", "DevOps Bot"),
                    "timestamp": str(matching_msg.get("timestamp", "")),
                    "quote": matching_msg.get("content", "")[:120]
                })

            results.append({
                "blocker_summary": blockers_text,
                "severity": "medium",
                "owner": author_name,
                "blocked_by": "DevOps Infrastructure Team",
                "related_work_item": work_item_id or "ADO-3310",
                "confidence": 0.91,
                "citations": citations
            })
            return results

        # General scenario: search available channel messages for matching words
        words = [w for w in re.split(r"\W+", blockers_text) if len(w) > 4 and w.lower() not in ["waiting", "blocked", "because", "please", "issue"]]
        citations = []
        best_msg = None
        for m in channel_messages:
            content_lower = m.get("content", "").lower()
            for w in words:
                if w.lower() in content_lower:
                    best_msg = m
                    break
            if best_msg:
                break

        if best_msg:
            # find sentence containing the word
            sentences = best_msg.get("content", "").split(".")
            quote = sentences[0].strip() if sentences else best_msg.get("content", "")[:90]
            citations.append({
                "message_id": best_msg.get("id"),
                "channel": best_msg.get("channel_name", "#general"),
                "author": best_msg.get("author_name", "Team Member"),
                "timestamp": str(best_msg.get("timestamp", "")),
                "quote": quote
            })

        results.append({
            "blocker_summary": blockers_text,
            "severity": "medium" if "urgent" not in lower_text else "high",
            "owner": author_name,
            "blocked_by": "External Team / Dependency",
            "related_work_item": work_item_id or pr_link or None,
            "confidence": 0.88,
            "citations": citations
        })

        return results

    async def generate_digest(
        self,
        checkins: List[Dict[str, Any]],
        blockers: List[Dict[str, Any]],
        team_members: List[Dict[str, Any]],
        digest_date: str
    ) -> Dict[str, Any]:
        """Generate executive digest from team updates."""
        progress_by_person = []
        checked_in_names = set()

        for c in checkins:
            name = c.get("user_name") or "Engineer"
            checked_in_names.add(name)
            has_b = bool(c.get("blockers_text") and c.get("blockers_text").lower() not in ["none", "n/a", "no"])
            progress_by_person.append({
                "name": name,
                "yesterday": c.get("yesterday", "Completed scheduled tasks"),
                "today": c.get("today", "Continuing sprint deliverables"),
                "mood": c.get("mood", 4),
                "has_blockers": has_b
            })

        all_names = [m.get("full_name") for m in team_members if m.get("full_name")]
        missing_checkins = [name for name in all_names if name not in checked_in_names]
        if not missing_checkins and len(all_names) > len(checked_in_names):
            missing_checkins = ["Rohan Patel"]

        blockers_summary = []
        for b in blockers:
            blockers_summary.append({
                "summary": b.get("summary"),
                "severity": b.get("severity", "medium"),
                "owner": b.get("owner_name", "Team Member"),
                "blocked_by": b.get("blocked_by", "Pending"),
                "citation_count": len(b.get("citations") or [])
            })

        risks = [
            "PR #184 schema dependency may push sprint release by 24h if migration script audit isn't prioritized by 4 PM today.",
            "Cross-timezone handoff between Seattle (US-West) and Bengaluru (IST) has a 4.5-hour sync window."
        ]
        if any(b.get("severity") == "high" for b in blockers):
            risks.insert(0, "High severity backend blocker actively stalling API test suite.")

        suggested_actions = [
            "Manager ping Vikram Joshi (Backend Lead) in #backend thread msg_492 to request fast-track security review on 0042_oauth_tenants.sql.",
            "Ensure Priya Sharma has fallback mocks to proceed with tenant login frontend tests.",
            "Send automated Teams nudge to members who have not checked in before 10:30 AM local time."
        ]

        # Beautiful markdown formatting
        md = f"""# 🚀 SyncBrief Daily Standup Digest — {digest_date}
*Generated automatically by SyncBrief AI at 09:30 UTC*

---

### 📊 Executive Summary
- **Total Check-ins**: {len(checkins)} / {len(team_members)} ({int(len(checkins)/max(1, len(team_members))*100)}% compliance)
- **Active Blockers**: {len(blockers)} ({len([b for b in blockers if b.get('severity') == 'high'])} High Severity)
- **Time Saved Today**: {len(team_members) * 0.5:.1f} engineering hours (~${len(team_members) * 0.5 * 75:.0f})

---

### 🛑 Critical Blockers (with Verifiable Evidence)
"""
        for b in blockers:
            sev_badge = "🔴 HIGH" if b.get("severity") == "high" else ("🟡 MEDIUM" if b.get("severity") == "medium" else "🟢 LOW")
            md += f"- **{sev_badge}**: {b.get('summary')}\n"
            md += f"  - *Owner*: {b.get('owner_name')} | *Blocked By*: {b.get('blocked_by')}\n"
            citations = b.get("citations") or []
            if citations:
                for cit in citations:
                    status_emoji = "✅ Verified Link" if cit.get("status") == "VERIFIED" else "⚠️ Unverified Link"
                    md += f"  - [{status_emoji}]: {cit.get('channel')} by {cit.get('author')}: *\"{cit.get('quote')}\"* (ID: `{cit.get('message_id')}`)\n"
            else:
                md += "  - *Citations*: None detected in opted-in channels.\n"

        md += "\n---\n\n### 👥 Member Updates\n"
        for p in progress_by_person:
            mood_stars = "⭐" * p.get("mood", 4)
            b_flag = "⚠️ Blocked" if p.get("has_blockers") else "✅ On Track"
            md += f"#### **{p.get('name')}** ({b_flag} | Mood: {mood_stars})\n"
            md += f"- **Yesterday**: {p.get('yesterday')}\n"
            md += f"- **Today**: {p.get('today')}\n\n"

        if missing_checkins:
            md += f"---\n\n### ⏳ Missing Check-ins\n"
            for m in missing_checkins:
                md += f"- ⚠️ **{m}** (Reminder sent to Teams DM)\n"

        md += "\n---\n\n### ⚡ Recommended Manager Actions\n"
        for act in suggested_actions:
            md += f"1. {act}\n"

        return {
            "date": digest_date,
            "progress_by_person": progress_by_person,
            "blockers_summary": blockers_summary,
            "risks": risks,
            "missing_checkins": missing_checkins,
            "suggested_actions": suggested_actions,
            "markdown_content": md,
            "teams_card_json": {}
        }

    async def analyze_what_changed(
        self,
        delta_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Deterministic, offline intelligence synthesizer for 'What Changed Since Yesterday?'.
        Operates strictly on database-derived facts passed in delta_context.
        Never fabricates tasks, users, blockers, or evidence.
        """
        target_date = delta_context.get("target_date", "")
        prev_work_day = delta_context.get("previous_working_day", "")
        window_start = delta_context.get("window_start", "")
        window_end = delta_context.get("window_end", "")
        is_weekend = delta_context.get("is_weekend_lookback", False)
        team_scope = delta_context.get("team_scope", {
            "manager_id": 0,
            "manager_name": "Manager",
            "member_count": 0,
            "checked_in_count": 0
        })

        # 1. Progress: Completed work
        completed_work = []
        for t in delta_context.get("completed_tasks", []):
            task_id = t.get("id")
            title = t.get("title", f"Task #{task_id}")
            owner = t.get("assignee_name") or "Unassigned"
            completed_at = t.get("completed_at") or target_date
            diff = t.get("difficulty", 3)
            pts = float(t.get("points_earned", diff))
            evidence = [{
                "source_type": "task",
                "source_id": str(task_id),
                "title": title,
                "author_or_owner": owner,
                "timestamp": completed_at,
                "excerpt": f"Task '{title}' completed with status Done ({diff} difficulty points)",
                "verified": True,
                "rejection_reason": None
            }]
            completed_work.append({
                "task_id": task_id,
                "title": title,
                "owner": owner,
                "completed_at": completed_at,
                "difficulty": diff,
                "points_earned": pts,
                "evidence": evidence
            })

        # 2. Progress: Meaningful task progress
        meaningful_task_progress = []
        for t in delta_context.get("progressed_tasks", []):
            task_id = t.get("id")
            title = t.get("title", f"Task #{task_id}")
            owner = t.get("assignee_name") or "Unassigned"
            delta_pct = t.get("progress_delta_pct", 0)
            curr_pct = t.get("current_progress_pct", 0)
            note = t.get("note", "")
            pr_link = t.get("pr_link")
            excerpt_text = f"Progress updated to {curr_pct}%" + (f": {note}" if note else "")
            evidence = [{
                "source_type": "task",
                "source_id": str(task_id),
                "title": title,
                "author_or_owner": owner,
                "timestamp": t.get("updated_at") or target_date,
                "excerpt": excerpt_text,
                "verified": True,
                "rejection_reason": None
            }]
            meaningful_task_progress.append({
                "task_id": task_id,
                "title": title,
                "owner": owner,
                "progress_delta_pct": delta_pct,
                "current_progress_pct": curr_pct,
                "note": note,
                "pr_link": pr_link,
                "evidence": evidence
            })

        # 3. Progress: Sprint progress delta
        sprint_progress = None
        sprint_data = delta_context.get("sprint_info")
        if sprint_data:
            s_id = sprint_data.get("id")
            s_name = sprint_data.get("name", "Active Sprint")
            total_pts = sprint_data.get("total_points", 0)
            c_yest = sprint_data.get("completed_points_yesterday", 0)
            c_today = sprint_data.get("completed_points_today", 0)
            delta_pts = sprint_data.get("delta_points", c_today - c_yest)
            evidence = [{
                "source_type": "sprint",
                "source_id": str(s_id) if s_id is not None else "sprint_active",
                "title": s_name,
                "author_or_owner": "Sprint Automation",
                "timestamp": target_date,
                "excerpt": f"Sprint points delta: +{delta_pts} pts completed (total {c_today}/{total_pts})",
                "verified": True,
                "rejection_reason": None
            }]
            sprint_progress = {
                "sprint_id": s_id,
                "sprint_name": s_name,
                "total_points": total_pts,
                "completed_points_yesterday": c_yest,
                "completed_points_today": c_today,
                "delta_points": delta_pts,
                "evidence": evidence
            }

        # 4. Progress: Checkin updates
        checkin_updates = []
        for c in delta_context.get("checkins", []):
            c_id = c.get("id")
            u_id = c.get("user_id")
            u_name = c.get("user_name", "Team Member")
            y_achieve = c.get("yesterday", "")
            t_plan = c.get("today", "")
            mood = c.get("mood", 4)
            excerpt = y_achieve if y_achieve else t_plan
            evidence = [{
                "source_type": "checkin",
                "source_id": str(c_id),
                "title": f"Check-in by {u_name}",
                "author_or_owner": u_name,
                "timestamp": c.get("created_at") or target_date,
                "excerpt": excerpt[:150] if excerpt else "Standup check-in submitted",
                "verified": True,
                "rejection_reason": None
            }]
            checkin_updates.append({
                "user_id": u_id,
                "user_name": u_name,
                "yesterday_achievement": y_achieve,
                "today_plan": t_plan,
                "mood": mood,
                "evidence": evidence
            })

        # 5. Blockers: New blockers
        new_blockers = []
        for b in delta_context.get("new_blockers", []):
            b_id = b.get("id")
            summary = b.get("summary", "")
            sev = b.get("severity", "medium")
            owner = b.get("owner_name", "Unassigned")
            blocked_by = b.get("blocked_by", "Pending")
            created_at = b.get("created_at") or target_date
            evidence = [{
                "source_type": "blocker",
                "source_id": str(b_id),
                "title": f"Blocker #{b_id}",
                "author_or_owner": owner,
                "timestamp": created_at,
                "excerpt": summary,
                "verified": True,
                "rejection_reason": None
            }]
            new_blockers.append({
                "blocker_id": b_id,
                "summary": summary,
                "severity": sev,
                "owner": owner,
                "blocked_by": blocked_by,
                "created_at": created_at,
                "evidence": evidence
            })

        # 6. Blockers: Existing unresolved blockers
        existing_unresolved_blockers = []
        for b in delta_context.get("existing_blockers", []):
            b_id = b.get("id")
            summary = b.get("summary", "")
            sev = b.get("severity", "medium")
            owner = b.get("owner_name", "Unassigned")
            blocked_by = b.get("blocked_by", "Pending")
            age_days = b.get("age_days", 1)
            evidence = [{
                "source_type": "blocker",
                "source_id": str(b_id),
                "title": f"Blocker #{b_id}",
                "author_or_owner": owner,
                "timestamp": b.get("created_at") or target_date,
                "excerpt": f"Unresolved blocker ({age_days}d): {summary}",
                "verified": True,
                "rejection_reason": None
            }]
            existing_unresolved_blockers.append({
                "blocker_id": b_id,
                "summary": summary,
                "severity": sev,
                "owner": owner,
                "blocked_by": blocked_by,
                "age_days": age_days,
                "evidence": evidence
            })

        # 7. Risks: Inferred deterministically from actual facts
        risks = []
        all_blockers = new_blockers + existing_unresolved_blockers
        high_blockers = [b for b in all_blockers if b.get("severity") == "high"]
        for hb in high_blockers:
            risks.append({
                "risk_id": f"risk_blocker_{hb['blocker_id']}",
                "severity": "high",
                "summary": f"Critical blocker on {hb['owner']}: {hb['summary'][:100]}",
                "rationale": f"Stalled by {hb['blocked_by']}. Risks missing scheduled milestone if unresolved today.",
                "evidence": hb["evidence"]
            })

        # Check for low mood risks
        low_mood_checkins = [c for c in checkin_updates if c.get("mood", 5) <= 2]
        for c in low_mood_checkins:
            risks.append({
                "risk_id": f"risk_mood_{c['user_id']}",
                "severity": "medium",
                "summary": f"Drop in sentiment for {c['user_name']} (mood rating: {c['mood']}/5)",
                "rationale": "Sustained low sentiment is an early indicator of developer friction or delivery drag.",
                "evidence": c["evidence"]
            })

        # Check for missing check-in risks
        missing_checkins = delta_context.get("missing_checkins", [])
        if len(missing_checkins) >= 2:
            risks.append({
                "risk_id": "risk_standup_compliance",
                "severity": "medium",
                "summary": f"{len(missing_checkins)} team members have missing standups today ({', '.join(missing_checkins[:3])})",
                "rationale": "Incomplete reporting impairs sprint velocity transparency and cross-team alignment.",
                "evidence": []
            })

        # 8. Needs Manager Attention: Actionable manager tasks
        needs_manager_attention = []
        for hb in high_blockers:
            needs_manager_attention.append({
                "item_id": f"attn_blocker_{hb['blocker_id']}",
                "priority": "urgent",
                "action": f"Intervene to unblock {hb['owner']} on '{hb['summary'][:80]}'",
                "target_person": hb["owner"],
                "suggested_channel": "#backend" if "backend" in hb["summary"].lower() else "Teams DM",
                "evidence": hb["evidence"]
            })

        for m_name in missing_checkins:
            needs_manager_attention.append({
                "item_id": f"attn_nudge_{m_name.lower().replace(' ', '_')}",
                "priority": "medium",
                "action": f"Send async standup reminder to {m_name}",
                "target_person": m_name,
                "suggested_channel": "Teams DM",
                "evidence": []
            })

        # 9. Insufficient Data
        is_insufficient = (
            len(completed_work) == 0 and
            len(meaningful_task_progress) == 0 and
            len(checkin_updates) == 0 and
            len(new_blockers) == 0
        )
        notes = []
        if is_insufficient:
            notes.append(f"No task completions, status updates, or check-ins recorded since {prev_work_day}.")
        if missing_checkins:
            notes.append(f"{len(missing_checkins)} team member(s) have pending check-ins.")

        return {
            "target_date": target_date,
            "previous_working_day": prev_work_day,
            "window_start": window_start,
            "window_end": window_end,
            "is_weekend_lookback": is_weekend,
            "team_scope": team_scope,
            "progress": {
                "completed_work": completed_work,
                "meaningful_task_progress": meaningful_task_progress,
                "sprint_progress": sprint_progress,
                "checkin_updates": checkin_updates
            },
            "blockers": {
                "new_blockers": new_blockers,
                "existing_unresolved_blockers": existing_unresolved_blockers
            },
            "risks": risks,
            "needs_manager_attention": needs_manager_attention,
            "insufficient_data": {
                "is_insufficient": is_insufficient,
                "missing_checkins": missing_checkins,
                "notes": notes
            }
        }

