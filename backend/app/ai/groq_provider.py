import json
import logging
import re
from typing import List, Dict, Any, Optional, AsyncGenerator
from openai import AsyncOpenAI
from backend.app.ai.base import AIProvider
from backend.app.ai.mock_provider import MockProvider
from backend.app.config import settings

logger = logging.getLogger(__name__)

def is_conversational_or_greeting(msg: str) -> bool:
    """Detect casual greetings and polite conversational chit-chat."""
    lower = msg.strip().lower()
    cleaned = re.sub(r'[^\w\s]', '', lower).strip()
    greetings = {
        "hi", "hello", "hey", "how are you", "how are you today", "hows it going",
        "how are you doing", "good morning", "good afternoon", "good evening",
        "thanks", "thank you", "who are you", "what can you do", "help",
        "what are you", "are you an ai", "whats up", "sup", "yo"
    }
    if cleaned in greetings:
        return True
    if any(cleaned.startswith(g + " ") for g in ["hi", "hello", "hey", "good morning", "good evening"]):
        if len(cleaned.split()) <= 4:
            return True
    return False

def filter_relevant_citations(
    citations: List[Dict[str, Any]],
    user_msg: str,
    answer_text: str
) -> List[Dict[str, Any]]:
    """
    Ensure the assistant replies normally without dumping 40 verified items.
    Only returns specific citations if asked or specifically cited in the answer.
    """
    if not citations:
        return []
    if is_conversational_or_greeting(user_msg):
        return []

    lower_user = user_msg.lower()
    lower_ans = answer_text.lower()
    wants_citations = any(k in lower_user for k in [
        "verified link", "verified links", "show link", "show links", "citation", "citations",
        "source", "sources", "evidence", "proof", "where did you get", "verify", "links", "link"
    ])

    relevant = []
    seen = set()
    for c in citations:
        if not isinstance(c, dict):
            continue
        cid = str(c.get("source_id", "")).strip().lower()
        title = (c.get("title") or "").strip().lower()
        owner = (c.get("author_or_owner") or "").strip().lower()
        key = f"{c.get('source_type')}_{cid}"
        if key in seen:
            continue

        # Check if explicitly mentioned in answer or user query
        is_mentioned = False
        if cid and (f"#{cid}" in lower_ans or f"#{cid}" in lower_user or f"id {cid}" in lower_ans):
            is_mentioned = True
        elif title and len(title) > 6 and (title in lower_ans or title in lower_user):
            is_mentioned = True
        elif owner and len(owner) > 4 and owner in lower_ans and c.get("source_type") in ["blocker", "dependency", "task"]:
            is_mentioned = True

        if is_mentioned or wants_citations:
            seen.add(key)
            relevant.append(c)
            if len(relevant) >= (4 if wants_citations else 2):
                break

    return relevant

class GroqProvider(AIProvider):
    """
    High-Performance Real-Time AI Provider powered by Groq Cloud LPUs.
    Provides sub-second latency and real-time streaming inference for SyncBrief.
    """
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.base_url = settings.GROQ_BASE_URL
        self.model = settings.GROQ_MODEL or "openai/gpt-oss-120b"
        self.fallback_models = ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
        self.mock_fallback = MockProvider()

    def _get_models_to_try(self) -> List[str]:
        models = [self.model]
        for fb in self.fallback_models:
            if fb not in models:
                models.append(fb)
        return models

    @property
    def client(self) -> Optional[AsyncOpenAI]:
        if not self.api_key:
            return None
        return AsyncOpenAI(base_url=self.base_url, api_key=self.api_key)

    @property
    def name(self) -> str:
        if self.client:
            return f"Groq ({self.model})"
        return "Deterministic Demo AI (Fallback)"

    @property
    def is_mock(self) -> bool:
        return self.client is None

    @property
    def is_groq(self) -> bool:
        return True

    def _format_compact_context(self, context_data: Dict[str, Any]) -> str:
        """Serialize context data into token-efficient structured markdown text."""
        lines = []

        if context_data.get("sprint"):
            s = context_data["sprint"]
            lines.append(f"CURRENT SPRINT: {s.get('name', 'Sprint')} ({s.get('status', 'active')}) | Goal: {s.get('goal', 'N/A')}")

        if context_data.get("blockers"):
            lines.append("\nACTIVE BLOCKERS:")
            for b in context_data["blockers"][:8]:
                lines.append(f"- Blocker #{b.get('id')}: {b.get('summary')} (Owner: {b.get('owner_name')}, Blocked by: {b.get('blocked_by')}, Severity: {b.get('severity')}, Age: {b.get('age_days', 1)}d)")

        if context_data.get("tasks"):
            lines.append("\nTASKS IN SCOPE:")
            for t in context_data["tasks"][:18]:
                lines.append(f"- Task #{t.get('id')}: {t.get('title')} (Assignee: {t.get('owner')}, Status: {t.get('status')}, Priority: {t.get('priority')}, Progress: {t.get('progress_pct', 0)}%, Points: {t.get('difficulty_points', 3)})")

        if context_data.get("checkins"):
            lines.append("\nRECENT STANDUP CHECK-INS:")
            for c in context_data["checkins"][:8]:
                b_str = f" | Blocker: {c.get('blockers_text')}" if c.get("blockers_text") else ""
                lines.append(f"- {c.get('user_name')}: Yesterday: {c.get('yesterday')}. Today: {c.get('today')}.{b_str}")

        if context_data.get("dependencies"):
            lines.append("\nCROSS-TEAM DEPENDENCIES:")
            for d in context_data["dependencies"][:6]:
                lines.append(f"- {d.get('summary')} (Source: {d.get('source_owner')}, Waiting on: {d.get('dependency_team')} ({d.get('dependency_owner')}), Status: {d.get('status')})")

        if context_data.get("performance_dossier"):
            d = context_data["performance_dossier"]
            metrics = d.get("current_cycle_metrics", {})
            lines.append(f"\nPERFORMANCE DOSSIER ({d.get('employee_name')}):")
            lines.append(f"Cycle: {metrics.get('cycle_name')}, Earned Points: {metrics.get('earned_points')}, Assigned: {metrics.get('assigned_points')}, Completion: {metrics.get('completion_rate_pct')}%")
            if d.get("goals"):
                lines.append("Goals:")
                for g in d["goals"][:5]:
                    lines.append(f"  * {g.get('title')} (Status: {g.get('status')}, Progress: {g.get('current_progress_percentage')}%)")

        if context_data.get("team_members"):
            lines.append("\nTEAM DIRECTORY:")
            for m in context_data["team_members"][:10]:
                lines.append(f"- {m.get('name')} ({m.get('role')}, {m.get('title')}) - Manager: {m.get('manager')}")

        if context_data.get("channel_discussions"):
            lines.append("\nRECENT TEAM DISCUSSIONS:")
            for msg in context_data["channel_discussions"][:6]:
                lines.append(f"- [{msg.get('channel')}] {msg.get('author')}: {msg.get('content')}")

        return "\n".join(lines)

    def _build_syncbrief_messages(
        self,
        context_data: Dict[str, Any],
        user_message: str,
        conversation_history: List[Dict[str, str]],
        user_role: str,
        user_name: str
    ) -> List[Dict[str, str]]:
        """Construct the prompt and messages payload for SyncBrief grounding."""
        system_prompt = (
            "You are SyncBrief AI, the real-time enterprise work intelligence assistant.\n"
            "Your job is to answer questions accurately and authoritatively based STRICTLY on the supplied verified database records.\n\n"
            "CORE PRINCIPLES & GUARDRAILS:\n"
            "1. Ground all answers strictly in the provided verified context (tasks, checkins, standups, blockers, dependencies, performance, team members, discussions).\n"
            "2. Never hallucinate, invent, or assume facts not present in the data.\n"
            "3. If the user sends a friendly greeting or conversational message (e.g. 'how are you today?', 'hello', 'hi', 'thanks'), respond naturally, warmly, and politely as a professional assistant without unprompted lists of citations or disclaimers.\n"
            "4. Reply normally and cleanly in conversational paragraphs. Only list verified links or sources when specifically asked.\n"
            "5. If the user asks about something not present in the workspace data or completely outside work intelligence (such as general trivia or unrelated questions), politely explain that you can only answer questions grounded in SyncBrief workspace data.\n"
            "6. Never disclose confidential records outside the user's authorized role hierarchy.\n"
            "7. Never reveal private manager notes or unauthorized employee appraisals.\n"
            "8. Never recommend salary changes, termination, or biased ratings.\n"
            "9. Keep responses concise, clear, professional, and directly actionable.\n"
            "10. Always mention relevant owner names, task titles, dates, blockers, and progress percentages when discussing work items.\n"
            "11. READABILITY & PRESENTATION:\n"
            "    - Present information cleanly and beautifully using short paragraphs and styled bullet points (•).\n"
            "    - Bold key owner names and metrics (e.g. **Priya Sharma**, **Sprint 43**) for quick scannability.\n"
            "    - DO NOT generate ascii pipe tables (|---|---|); instead format multi-point summaries using clear, attractive bullet lists.\n"
            "    - NEVER use raw HTML tags such as <br> or <div>."
        )

        messages = [{"role": "system", "content": system_prompt}]

        for turn in conversation_history[-4:]:
            role = "assistant" if turn.get("role") == "assistant" else "user"
            content = turn.get("content", "")
            if content:
                messages.append({"role": role, "content": content})

        compact_context = self._format_compact_context(context_data)

        user_content = (
            f"User Profile: {user_name} | Role: {user_role}\n"
            f"Question: {user_message}\n\n"
            f"Verified Authorized Workspace Context:\n"
            f"{compact_context}"
        )
        messages.append({"role": "user", "content": user_content})
        return messages

    async def ask_syncbrief(
        self,
        context_data: Dict[str, Any],
        user_message: str,
        conversation_history: List[Dict[str, str]],
        user_role: str,
        user_name: str
    ) -> Dict[str, Any]:
        """
        Synchronous answer with verified citations powered by Groq.
        """
        if not self.client:
            return await self.mock_fallback.ask_syncbrief(
                context_data, user_message, conversation_history, user_role, user_name
            )

        if context_data.get("insufficient_data"):
            return {
                "answer": context_data.get("insufficient_reason", "I don't have enough verified SyncBrief data to answer that."),
                "citations": [],
                "insufficient_data": True
            }

        try:
            messages = self._build_syncbrief_messages(
                context_data, user_message, conversation_history, user_role, user_name
            )

            response = None
            for model_to_try in self._get_models_to_try():
                try:
                    response = await self.client.chat.completions.create(
                        model=model_to_try,
                        messages=messages,
                        temperature=0.1,
                        max_tokens=600
                    )
                    break
                except Exception as model_err:
                    logger.warning(f"Groq {model_to_try} failed, trying fallback: {model_err}")

            if response and response.choices:
                raw_text = response.choices[0].message.content.strip()
                if raw_text:
                    return {
                        "answer": raw_text,
                        "citations": filter_relevant_citations(context_data.get("citations", []), user_message, raw_text),
                        "insufficient_data": False
                    }

        except Exception as e:
            logger.error(f"Groq ask_syncbrief error, falling back to mock: {e}")

        return await self.mock_fallback.ask_syncbrief(
            context_data, user_message, conversation_history, user_role, user_name
        )

    async def stream_ask_syncbrief(
        self,
        context_data: Dict[str, Any],
        user_message: str,
        conversation_history: List[Dict[str, str]],
        user_role: str,
        user_name: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Real-time token streaming generator powered by Groq.
        Yields {"type": "token", "content": "..."} chunks as they generate,
        followed by {"type": "done", "citations": [...], "insufficient_data": ...}
        """
        if not self.client:
            mock_res = await self.mock_fallback.ask_syncbrief(
                context_data, user_message, conversation_history, user_role, user_name
            )
            answer = mock_res.get("answer", "")
            words = answer.split(" ")
            for i, w in enumerate(words):
                chunk = w + (" " if i < len(words) - 1 else "")
                yield {"type": "token", "content": chunk}
            yield {
                "type": "done",
                "answer": answer,
                "citations": mock_res.get("citations", []),
                "insufficient_data": mock_res.get("insufficient_data", False)
            }
            return

        if context_data.get("insufficient_data"):
            reason = context_data.get("insufficient_reason", "I don't have enough verified SyncBrief data to answer that.")
            yield {"type": "token", "content": reason}
            yield {
                "type": "done",
                "answer": reason,
                "citations": [],
                "insufficient_data": True
            }
            return

        full_answer = []
        try:
            messages = self._build_syncbrief_messages(
                context_data, user_message, conversation_history, user_role, user_name
            )

            stream = None
            last_err = None
            for model_to_try in self._get_models_to_try():
                try:
                    stream = await self.client.chat.completions.create(
                        model=model_to_try,
                        messages=messages,
                        stream=True,
                        temperature=0.1,
                        max_tokens=600
                    )
                    break
                except Exception as m_err:
                    last_err = m_err
                    logger.warning(f"Groq streaming with {model_to_try} failed, trying fallback: {m_err}")

            if stream:
                async for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta.content:
                        token_text = chunk.choices[0].delta.content
                        full_answer.append(token_text)
                        yield {"type": "token", "content": token_text}

                complete_text = "".join(full_answer)
                yield {
                    "type": "done",
                    "answer": complete_text,
                    "citations": filter_relevant_citations(context_data.get("citations", []), user_message, complete_text),
                    "insufficient_data": False
                }
                return
            else:
                raise last_err or RuntimeError("No Groq stream available")

        except Exception as e:
            logger.error(f"Groq stream error, falling back: {e}")
            mock_res = await self.mock_fallback.ask_syncbrief(
                context_data, user_message, conversation_history, user_role, user_name
            )
            yield {"type": "token", "content": mock_res.get("answer", "")}
            yield {
                "type": "done",
                "answer": mock_res.get("answer", ""),
                "citations": mock_res.get("citations", []),
                "insufficient_data": mock_res.get("insufficient_data", False)
            }

    async def extract_blockers(
        self,
        checkin_data: Dict[str, Any],
        channel_messages: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Call Groq to extract blockers with citations, with fallback."""
        if not self.client:
            return await self.mock_fallback.extract_blockers(checkin_data, channel_messages)

        try:
            prompt_path = "backend/app/ai/prompts/blocker_v1.txt"
            with open(prompt_path, "r") as f:
                prompt_template = f.read()

            prompt = prompt_template.format(
                author_name=checkin_data.get("user_name", "Team Member"),
                yesterday=checkin_data.get("yesterday", ""),
                today=checkin_data.get("today", ""),
                blockers_text=checkin_data.get("blockers_text", ""),
                pr_link=checkin_data.get("pr_link", "None"),
                work_item_id=checkin_data.get("work_item_id", "None"),
                channel_messages_json=json.dumps(channel_messages[:15], indent=2, default=str)
            )

            data = None
            for model_to_try in self._get_models_to_try():
                try:
                    response = await self.client.chat.completions.create(
                        model=model_to_try,
                        messages=[
                            {"role": "system", "content": "You are a precise JSON-only extraction engine."},
                            {"role": "user", "content": prompt}
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.1
                    )
                    content = response.choices[0].message.content
                    data = json.loads(content)
                    break
                except Exception as model_err:
                    logger.warning(f"Groq blocker extraction with {model_to_try} failed: {model_err}")

            if isinstance(data, dict) and "blockers" in data:
                return data["blockers"]
            elif isinstance(data, list):
                return data
            elif isinstance(data, dict):
                return [data]
        except Exception as e:
            logger.error(f"Groq blocker extraction error, falling back to mock: {e}")

        return await self.mock_fallback.extract_blockers(checkin_data, channel_messages)

    async def generate_digest(
        self,
        checkins: List[Dict[str, Any]],
        blockers: List[Dict[str, Any]],
        team_members: List[Dict[str, Any]],
        digest_date: str
    ) -> Dict[str, Any]:
        """Call Groq to generate executive digest from team updates."""
        if not self.client:
            return await self.mock_fallback.generate_digest(checkins, blockers, team_members, digest_date)

        try:
            prompt_path = "backend/app/ai/prompts/digest_v1.txt"
            with open(prompt_path, "r") as f:
                prompt_template = f.read()

            prompt = prompt_template.format(
                checkins_json=json.dumps(checkins[:10], indent=2, default=str),
                blockers_json=json.dumps(blockers[:8], indent=2, default=str),
                members_json=json.dumps(team_members[:10], indent=2, default=str),
                digest_date=digest_date
            )

            data = None
            for model_to_try in self._get_models_to_try():
                try:
                    response = await self.client.chat.completions.create(
                        model=model_to_try,
                        messages=[
                            {"role": "system", "content": "You are an executive engineering digest synthesizer. Output strict JSON."},
                            {"role": "user", "content": prompt}
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.1
                    )
                    content = response.choices[0].message.content
                    data = json.loads(content)
                    break
                except Exception as model_err:
                    logger.warning(f"Groq digest generation with {model_to_try} failed: {model_err}")

            if isinstance(data, dict):
                return data
        except Exception as e:
            logger.error(f"Groq digest generation error, falling back to mock: {e}")

        return await self.mock_fallback.generate_digest(checkins, blockers, team_members, digest_date)

    async def analyze_what_changed(
        self,
        delta_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze team progress, blockers, risks, and manager actions with Groq."""
        if not self.client:
            return await self.mock_fallback.analyze_what_changed(delta_context)

        try:
            prompt_path = "backend/app/ai/prompts/what_changed_v1.txt"
            with open(prompt_path, "r") as f:
                prompt_template = f.read()

            prompt = prompt_template.format(
                target_date=delta_context.get("target_date", ""),
                previous_working_day=delta_context.get("previous_working_day", ""),
                window_start=delta_context.get("window_start", ""),
                window_end=delta_context.get("window_end", ""),
                is_weekend_lookback="true" if delta_context.get("is_weekend_lookback") else "false",
                team_scope_json=json.dumps(delta_context.get("team_scope", {}), indent=2, default=str),
                completed_tasks_json=json.dumps(delta_context.get("completed_tasks", [])[:10], indent=2, default=str),
                progressed_tasks_json=json.dumps(delta_context.get("progressed_tasks", [])[:10], indent=2, default=str),
                sprint_info_json=json.dumps(delta_context.get("sprint_info", {}), indent=2, default=str),
                new_blockers_json=json.dumps(delta_context.get("new_blockers", [])[:8], indent=2, default=str),
                existing_blockers_json=json.dumps(delta_context.get("existing_blockers", [])[:8], indent=2, default=str),
                missing_checkins_json=json.dumps(delta_context.get("missing_checkins", [])[:8], indent=2, default=str),
                checkins_json=json.dumps(delta_context.get("checkins", [])[:8], indent=2, default=str)
            )

            data = None
            for model_to_try in self._get_models_to_try():
                try:
                    response = await self.client.chat.completions.create(
                        model=model_to_try,
                        messages=[
                            {"role": "system", "content": "You are a precise JSON-only executive engineering delta analyzer."},
                            {"role": "user", "content": prompt}
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.1
                    )
                    content = response.choices[0].message.content
                    data = json.loads(content)
                    break
                except Exception as model_err:
                    logger.warning(f"Groq what-changed with {model_to_try} failed: {model_err}")

            if isinstance(data, dict):
                # Ensure all required top-level fields are present
                data.setdefault("target_date", delta_context.get("target_date", ""))
                data.setdefault("previous_working_day", delta_context.get("previous_working_day", ""))
                data.setdefault("window_start", delta_context.get("window_start", ""))
                data.setdefault("window_end", delta_context.get("window_end", ""))
                data.setdefault("is_weekend_lookback", bool(delta_context.get("is_weekend_lookback", False)))
                data.setdefault("team_scope", delta_context.get("team_scope", {"manager_id": 0, "manager_name": "Manager"}))
                data.setdefault("progress", {"completed_work": [], "meaningful_task_progress": [], "checkin_updates": []})
                data.setdefault("blockers", {"new_blockers": [], "existing_unresolved_blockers": []})
                data.setdefault("risks", [])
                data.setdefault("needs_manager_attention", [])
                data.setdefault("insufficient_data", {
                    "is_insufficient": False,
                    "missing_checkins": delta_context.get("missing_checkins", []),
                    "notes": []
                })

                # Ensure missing check-ins always have individual manager attention nudges
                missing_checkins = delta_context.get("missing_checkins", [])
                attention_items = data.setdefault("needs_manager_attention", [])
                existing_targets = {
                    (a.get("target_person") or "") + " " + (a.get("action") or "")
                    for a in attention_items if isinstance(a, dict)
                }
                for m_name in missing_checkins:
                    if not any(m_name in t for t in existing_targets):
                        attention_items.append({
                            "item_id": f"attn_nudge_{m_name.lower().replace(' ', '_')}",
                            "priority": "medium",
                            "action": f"Send async standup reminder to {m_name}",
                            "target_person": m_name,
                            "suggested_channel": "Teams DM",
                            "evidence": []
                        })
                return data
        except Exception as e:
            logger.error(f"Groq what-changed error, falling back to mock: {e}")

        return await self.mock_fallback.analyze_what_changed(delta_context)

