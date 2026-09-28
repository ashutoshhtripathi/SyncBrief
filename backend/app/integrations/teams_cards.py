from typing import Dict, Any, List

class TeamsCardGenerator:
    """
    Builds official Microsoft Teams Adaptive Cards (Schema 1.5)
    for async check-ins and executive digest broadcasts.
    """

    @staticmethod
    def generate_checkin_card(user_name: str, reminder_text: str = "Time for your 60-second async standup!") -> Dict[str, Any]:
        """Adaptive Card sent to user to prompt for standup check-in."""
        return {
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.5",
            "body": [
                {
                    "type": "Container",
                    "style": "emphasis",
                    "items": [
                        {
                            "type": "TextBlock",
                            "text": "⚡ SyncBrief AI — Daily Check-in",
                            "weight": "Bolder",
                            "size": "Medium",
                            "color": "Accent"
                        },
                        {
                            "type": "TextBlock",
                            "text": f"Hi {user_name}! {reminder_text}",
                            "isSubtle": True,
                            "wrap": True
                        }
                    ]
                },
                {
                    "type": "TextBlock",
                    "text": "1. What did you accomplish yesterday?",
                    "weight": "Bolder",
                    "spacing": "Medium"
                },
                {
                    "type": "Input.Text",
                    "id": "yesterday",
                    "placeholder": "e.g., Completed OAuth frontend flow & token refresh handler",
                    "isMultiline": True
                },
                {
                    "type": "TextBlock",
                    "text": "2. What is your primary focus today?",
                    "weight": "Bolder",
                    "spacing": "Medium"
                },
                {
                    "type": "Input.Text",
                    "id": "today",
                    "placeholder": "e.g., Testing tenant login endpoints and running end-to-end suite",
                    "isMultiline": True
                },
                {
                    "type": "TextBlock",
                    "text": "3. Any blockers or dependencies?",
                    "weight": "Bolder",
                    "spacing": "Medium"
                },
                {
                    "type": "Input.Text",
                    "id": "blockers_text",
                    "placeholder": "e.g., Blocked waiting for database migration script from backend team",
                    "isMultiline": True
                },
                {
                    "type": "TextBlock",
                    "text": "4. Energy & Mood Level",
                    "weight": "Bolder",
                    "spacing": "Medium"
                },
                {
                    "type": "Input.ChoiceSet",
                    "id": "mood",
                    "value": "4",
                    "choices": [
                        {"title": "⚡ 5 - Peak Momentum", "value": "5"},
                        {"title": "👍 4 - Good Progress", "value": "4"},
                        {"title": "😐 3 - Steady / Neutral", "value": "3"},
                        {"title": "🛑 2 - Blocked / Stalled", "value": "2"},
                        {"title": "🔥 1 - Critical Impediment", "value": "1"}
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.Submit",
                    "title": "🚀 Submit Check-in (SyncBrief AI)",
                    "style": "positive",
                    "data": {
                        "action": "submit_checkin"
                    }
                }
            ]
        }

    @staticmethod
    def generate_digest_card(digest_data: Dict[str, Any], web_app_url: str = "http://localhost:5173") -> Dict[str, Any]:
        """Adaptive Card broadcasted to #general or leadership channels."""
        date_str = digest_data.get("date", "Today")
        progress = digest_data.get("progress_by_person", [])
        blockers = digest_data.get("blockers_summary", [])
        risks = digest_data.get("risks", [])

        card_body: List[Dict[str, Any]] = [
            {
                "type": "Container",
                "style": "accent",
                "items": [
                    {
                        "type": "TextBlock",
                        "text": f"📋 Team Standup Digest — {date_str}",
                        "weight": "Bolder",
                        "size": "Large"
                    },
                    {
                        "type": "TextBlock",
                        "text": "Synthesized with Verifiable Chat Evidence • 0 Minutes in Meetings",
                        "isSubtle": True,
                        "wrap": True
                    }
                ]
            },
            {
                "type": "FactSet",
                "facts": [
                    {"title": "Check-ins Completed", "value": f"{len(progress)} members"},
                    {"title": "Active Blockers", "value": f"{len(blockers)} identified"},
                    {"title": "Time Saved Today", "value": f"{len(progress) * 0.5:.1f} hours ($150+)"}
                ]
            }
        ]

        if blockers:
            card_body.append({
                "type": "TextBlock",
                "text": "🛑 Key Blockers & Citations",
                "weight": "Bolder",
                "size": "Medium",
                "color": "Attention",
                "spacing": "Medium"
            })
            for b in blockers[:3]:
                sev = b.get("severity", "medium").upper()
                card_body.append({
                    "type": "TextBlock",
                    "text": f"• **[{sev}]** {b.get('summary')} *(Owner: {b.get('owner')})*",
                    "wrap": True
                })

        if risks:
            card_body.append({
                "type": "TextBlock",
                "text": "⚠️ Detected Risks & Dependencies",
                "weight": "Bolder",
                "color": "Warning",
                "spacing": "Medium"
            })
            for r in risks[:2]:
                card_body.append({
                    "type": "TextBlock",
                    "text": f"• {r}",
                    "wrap": True,
                    "isSubtle": True
                })

        return {
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.5",
            "body": card_body,
            "actions": [
                {
                    "type": "Action.OpenUrl",
                    "title": "🔍 View Full Digest in SyncBrief",
                    "url": f"{web_app_url}/digest"
                },
                {
                    "type": "Action.Submit",
                    "title": "✅ Acknowledge Digest",
                    "data": {
                        "action": "acknowledge_digest",
                        "digest_date": date_str
                    }
                }
            ]
        }
