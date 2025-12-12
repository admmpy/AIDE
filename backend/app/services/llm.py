import httpx
import re
from typing import Any

from app.config import get_settings

settings = get_settings()


DEFAULT_MODEL = settings.ollama_model


class OllamaClient:
    """Async client for Ollama LLM API. Uses qwen3:4b exclusively."""
    
    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float = 300.0,
    ):
        self.base_url = base_url or settings.ollama_base_url
        # Allow caller or env to choose model; fall back to configured default
        self.model = model or DEFAULT_MODEL
        self.timeout = timeout
    
    async def generate(
        self,
        prompt: str,
        system: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 768,
    ) -> str:
        """
        Generate text using Ollama.
        
        Args:
            prompt: The user prompt
            system: Optional system prompt
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate
        
        Returns:
            Generated text response
        """
        payload: dict[str, Any] = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        
        if system:
            payload["system"] = system
        # Ensure JSON-only output which avoids 'thinking' field confusion
        payload["format"] = "json"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")
    
    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 768,
    ) -> str:
        """
        Chat completion using Ollama.
        
        Args:
            messages: List of {"role": "user/assistant/system", "content": "..."}
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate
        
        Returns:
            Generated text response
        """
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        # Ensure JSON-only output for chat mode as well
        payload["format"] = "json"
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "")
    
    async def is_available(self) -> bool:
        """Check if Ollama is running and qwen3:4b is available."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code != 200:
                    return False
                
                data = response.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                # Check specifically for qwen3:4b
                return any("qwen3:4b" in m or m == "qwen3:4b" for m in models)
        except Exception:
            return False


def extract_json(text: str) -> str:
    """
    Extract JSON from LLM response, handling markdown code blocks.
    
    Args:
        text: Raw LLM response that may contain JSON
    
    Returns:
        Extracted JSON string
    
    Raises:
        ValueError: If no valid JSON found
    """
    # Remove thinking tags from qwen3 if present
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    
    # Helper to strip trailing commas that often break JSON parse
    def _remove_trailing_commas(txt: str) -> str:
        # comma followed by optional whitespace and either }} or ]]
        return re.sub(r",\s*(?=[}\]])", "", txt)

    # Try to find JSON in code blocks first
    code_block_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if code_block_match:
        return _remove_trailing_commas(code_block_match.group(1).strip())
    
    # Try to find raw JSON object
    json_match = re.search(r"\{[\s\S]*\}", text)
    if json_match:
        return _remove_trailing_commas(json_match.group(0))
    
    raise ValueError("No JSON found in response")


# Default client instance
llm_client = OllamaClient()
