from abc import ABC, abstractmethod
from typing import List, Dict, Any

class AIProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the provider, e.g. 'Azure OpenAI (GPT-4o)' or 'Deterministic Mock AI'"""
        pass

    @property
    @abstractmethod
    def is_mock(self) -> bool:
        """True if offline/mock provider, False if cloud LLM"""
        pass

    @abstractmethod
    async def extract_blockers(
        self,
        checkin_data: Dict[str, Any],
        channel_messages: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Extract blockers from checkin and find citations in channel messages."""
        pass

    @abstractmethod
    async def generate_digest(
        self,
        checkins: List[Dict[str, Any]],
        blockers: List[Dict[str, Any]],
        team_members: List[Dict[str, Any]],
        digest_date: str
    ) -> Dict[str, Any]:
        """Generate executive digest from team updates."""
        pass

    @abstractmethod
    async def analyze_what_changed(
        self,
        delta_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze team progress, blockers, risks, and manager actions since previous working day."""
        pass

