import json
import logging
from typing import List, Dict, Any, Optional
from openai import AsyncAzureOpenAI
from backend.app.ai.base import AIProvider
from backend.app.ai.mock_provider import MockProvider
from backend.app.config import settings

logger = logging.getLogger(__name__)

class AzureOpenAIProvider(AIProvider):
    def __init__(self):
        self.endpoint = settings.AZURE_OPENAI_ENDPOINT
        self.api_key = settings.AZURE_OPENAI_KEY
        self.deployment = settings.AZURE_OPENAI_DEPLOYMENT
        self.api_version = settings.AZURE_OPENAI_API_VERSION
        self.mock_fallback = MockProvider()

        if self.endpoint and self.api_key:
            self.client = AsyncAzureOpenAI(
                azure_endpoint=self.endpoint,
                api_key=self.api_key,
                api_version=self.api_version
            )
        else:
            self.client = None

    @property
    def name(self) -> str:
        if self.client:
            return f"Azure OpenAI ({self.deployment})"
        return "Deterministic Demo AI (Fallback)"

    @property
    def is_mock(self) -> bool:
        return self.client is None

    async def extract_blockers(
        self,
        checkin_data: Dict[str, Any],
        channel_messages: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Call Azure OpenAI GPT-4o to extract blockers with citations."""
        if not self.client:
            logger.info("Azure OpenAI credentials not set, using MockProvider.")
            return await self.mock_fallback.extract_blockers(checkin_data, channel_messages)

        try:
            # Read prompt template
            with open("backend/app/ai/prompts/blocker_v1.txt", "r") as f:
                prompt_template = f.read()

            prompt = prompt_template.format(
                author_name=checkin_data.get("user_name", "Team Member"),
                yesterday=checkin_data.get("yesterday", ""),
                today=checkin_data.get("today", ""),
                blockers_text=checkin_data.get("blockers_text", ""),
                pr_link=checkin_data.get("pr_link", "None"),
                work_item_id=checkin_data.get("work_item_id", "None"),
                channel_messages_json=json.dumps(channel_messages, indent=2, default=str)
            )

            # Attempt structured generation with 1 retry
            for attempt in range(2):
                try:
                    response = await self.client.chat.completions.create(
                        model=self.deployment,
                        messages=[
                            {"role": "system", "content": "You are a precise JSON-only extraction engine."},
                            {"role": "user", "content": prompt}
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.1
                    )
                    content = response.choices[0].message.content
                    data = json.loads(content)
                    if isinstance(data, dict) and "blockers" in data:
                        return data["blockers"]
                    elif isinstance(data, list):
                        return data
                    elif isinstance(data, dict):
                        return [data]
                except json.JSONDecodeError as json_err:
                    if attempt == 1:
                        raise json_err
                    logger.warning(f"JSON decode retry {attempt}: {json_err}")

        except Exception as e:
            logger.error(f"Azure OpenAI blocker extraction error, falling back to mock: {e}")
            return await self.mock_fallback.extract_blockers(checkin_data, channel_messages)

        return []

    async def generate_digest(
        self,
        checkins: List[Dict[str, Any]],
        blockers: List[Dict[str, Any]],
        team_members: List[Dict[str, Any]],
        digest_date: str
    ) -> Dict[str, Any]:
        """Call Azure OpenAI to synthesize daily standup digest."""
        if not self.client:
            return await self.mock_fallback.generate_digest(checkins, blockers, team_members, digest_date)

        try:
            with open("backend/app/ai/prompts/digest_v1.txt", "r") as f:
                prompt_template = f.read()

            prompt = prompt_template.format(
                checkins_json=json.dumps(checkins, indent=2, default=str),
                blockers_json=json.dumps(blockers, indent=2, default=str),
                members_json=json.dumps(team_members, indent=2, default=str),
                digest_date=digest_date
            )

            response = await self.client.chat.completions.create(
                model=self.deployment,
                messages=[
                    {"role": "system", "content": "You are a precise JSON-only executive standup digest synthesizer."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.2
            )
            content = response.choices[0].message.content
            return json.loads(content)

        except Exception as e:
            logger.error(f"Azure OpenAI digest generation error, falling back to mock: {e}")
            return await self.mock_fallback.generate_digest(checkins, blockers, team_members, digest_date)

    async def analyze_what_changed(
        self,
        delta_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Call Azure OpenAI to synthesize team delta intelligence since previous working day."""
        if not self.client:
            logger.info("Azure OpenAI credentials not set, using MockProvider for what-changed.")
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
                completed_tasks_json=json.dumps(delta_context.get("completed_tasks", []), indent=2, default=str),
                progressed_tasks_json=json.dumps(delta_context.get("progressed_tasks", []), indent=2, default=str),
                sprint_info_json=json.dumps(delta_context.get("sprint_info", {}), indent=2, default=str),
                new_blockers_json=json.dumps(delta_context.get("new_blockers", []), indent=2, default=str),
                existing_blockers_json=json.dumps(delta_context.get("existing_blockers", []), indent=2, default=str),
                missing_checkins_json=json.dumps(delta_context.get("missing_checkins", []), indent=2, default=str),
                checkins_json=json.dumps(delta_context.get("checkins", []), indent=2, default=str)
            )

            # Retry loop for robust structured JSON generation
            for attempt in range(2):
                try:
                    response = await self.client.chat.completions.create(
                        model=self.deployment,
                        messages=[
                            {"role": "system", "content": "You are a precise JSON-only executive engineering delta analyzer."},
                            {"role": "user", "content": prompt}
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.1
                    )
                    content = response.choices[0].message.content
                    data = json.loads(content)
                    if isinstance(data, dict):
                        return data
                except json.JSONDecodeError as json_err:
                    if attempt == 1:
                        raise json_err
                    logger.warning(f"JSON decode retry {attempt}: {json_err}")

        except Exception as e:
            logger.error(f"Azure OpenAI what-changed analysis error, falling back to mock: {e}")
            return await self.mock_fallback.analyze_what_changed(delta_context)

        return await self.mock_fallback.analyze_what_changed(delta_context)

    async def ask_syncbrief(
        self,
        context_data: Dict[str, Any],
        user_message: str,
        conversation_history: List[Dict[str, str]],
        user_role: str,
        user_name: str
    ) -> Dict[str, Any]:
        """Ask SyncBrief assistant powered by Azure OpenAI with fallback to MockProvider."""
        if not self.client:
            return await self.mock_fallback.ask_syncbrief(
                context_data, user_message, conversation_history, user_role, user_name
            )

        try:
            system_prompt = (
                "You are SyncBrief, an enterprise work-intelligence assistant.\n"
                "Rules:\n"
                "1. Answer only from supplied verified context.\n"
                "2. Never invent facts.\n"
                "3. Never invent citations.\n"
                "4. Never reveal information outside supplied authorized context.\n"
                "5. Never expose private manager notes unless present in authorized context.\n"
                "6. If evidence is insufficient, say so.\n"
                "7. Do not make promotion decisions.\n"
                "8. Do not recommend salary increases.\n"
                "9. Do not recommend termination.\n"
                "10. Do not assign subjective employee ratings.\n"
                "11. Keep factual statements traceable to supplied sources.\n\n"
                "Format your response strictly as a JSON object with this exact structure:\n"
                "{\n"
                '  "answer": "Clear, professional, concise response answering the user\'s question",\n'
                '  "citations": [{"source_type": "task|blocker|dependency|goal|checkin|sprint", "source_id": "...", "title": "...", "author_or_owner": "...", "excerpt": "...", "timestamp": "..."}],\n'
                '  "insufficient_data": false\n'
                "}"
            )

            messages = [{"role": "system", "content": system_prompt}]
            for turn in conversation_history[-4:]:
                role = "assistant" if turn.get("role") == "assistant" else "user"
                messages.append({"role": role, "content": turn.get("content", "")})

            user_prompt = (
                f"User: {user_name} (Role: {user_role})\n"
                f"Question: {user_message}\n\n"
                f"Verified Authorized Context:\n"
                f"{json.dumps(context_data, indent=2, default=str)}"
            )
            messages.append({"role": "user", "content": user_prompt})

            response = await self.client.chat.completions.create(
                model=self.deployment,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.1
            )
            content = response.choices[0].message.content
            data = json.loads(content)
            if isinstance(data, dict) and "answer" in data:
                return data

        except Exception as e:
            logger.error(f"Azure OpenAI assistant chat error, falling back to mock: {e}")

        return await self.mock_fallback.ask_syncbrief(
            context_data, user_message, conversation_history, user_role, user_name
        )

