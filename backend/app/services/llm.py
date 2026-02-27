import httpx
import re
from typing import Any

from app.config import get_settings

settings = get_settings()


DEFAULT_MODEL = settings.openrouter_default_model


class OpenRouterClient:
    """Async client for OpenRouter chat completions API."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
        timeout: float = 300.0,
    ):
        self.base_url = base_url or settings.openrouter_base_url
        self.api_key = api_key or settings.openrouter_api_key
        self.model = model or DEFAULT_MODEL
        self.timeout = timeout

    async def generate(
        self,
        prompt: str,
        system: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 1200,
        model: str | None = None,
    ) -> str:
        """Generate text using OpenRouter chat completions."""
        if not self.api_key:
            raise ValueError("OpenRouter API key is not configured")

        payload: dict[str, Any] = {
            "model": model or self.model,
            "messages": [],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
        }

        if system:
            payload["messages"].append({"role": "system", "content": system})
        payload["messages"].append({"role": "user", "content": prompt})

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-Title": "AIDE SQL Practice",
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            if not content:
                raise ValueError("OpenRouter returned empty content")
            return content

    async def is_available(self) -> bool:
        """Check OpenRouter connectivity and key validity."""
        if not self.api_key:
            return False

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/models", headers=headers)
                return response.status_code == 200
        except Exception:
            return False


def extract_json(text: str) -> str:
    """
    Extract JSON from model response, handling markdown code blocks.
    """
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)

    def _remove_trailing_commas(txt: str) -> str:
        return re.sub(r",\s*(?=[}\]])", "", txt)

    code_block_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if code_block_match:
        return _remove_trailing_commas(code_block_match.group(1).strip())

    json_match = re.search(r"\{[\s\S]*\}", text)
    if json_match:
        return _remove_trailing_commas(json_match.group(0))

    raise ValueError("No JSON found in response")


llm_client = OpenRouterClient()
