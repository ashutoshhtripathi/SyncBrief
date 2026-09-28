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
