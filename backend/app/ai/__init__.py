from backend.app.ai.base import AIProvider
from backend.app.ai.azure_openai import AzureOpenAIProvider
from backend.app.ai.mock_provider import MockProvider
from backend.app.ai.validator import CitationValidator, EvidenceValidator
from backend.app.config import settings

_ai_instance = None

def get_ai_provider() -> AIProvider:
    global _ai_instance
    if _ai_instance is None:
        if settings.AZURE_OPENAI_ENDPOINT and settings.AZURE_OPENAI_KEY:
            _ai_instance = AzureOpenAIProvider()
        else:
            _ai_instance = MockProvider()
    return _ai_instance

__all__ = ["get_ai_provider", "AIProvider", "CitationValidator", "EvidenceValidator", "MockProvider", "AzureOpenAIProvider"]

