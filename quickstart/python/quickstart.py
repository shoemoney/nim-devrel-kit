# /// script
# dependencies = ["openai>=1.40"]
# ///
"""Run with: uv run quickstart/python/quickstart.py"""
import os
import sys
import time
from urllib.parse import urlparse


def main():
    base = os.getenv("NIM_BASE_URL", "https://integrate.api.nvidia.com/v1").rstrip("/")
    key = os.getenv("NVIDIA_API_KEY", "")
    if urlparse(base).hostname == "integrate.api.nvidia.com" and not key:
        sys.exit("Set NVIDIA_API_KEY first. Get a free key at https://build.nvidia.com.")
    try:
        from openai import OpenAI, APIStatusError
    except ImportError:
        sys.exit("Install openai: pip install -r quickstart/python/requirements.txt (or use uv run).")

    try:
        client = OpenAI(api_key=key or "not-needed", base_url=base,
                        timeout=float(os.getenv("NIM_TIMEOUT_SECONDS", "120")), max_retries=0)
        ids = [model.id for model in client.models.list()]
        preferred = ["nvidia/nemotron-3.5-bolt-e4b", "nvidia/nemotron-3.5-lightning-30b-a3b",
                     "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"]
        model = os.getenv("NIM_MODEL") or next((m for m in preferred if m in ids), None)
        if not model:
            sys.exit("Set NIM_MODEL to a chat model from /v1/models. Catalog: " + ", ".join(ids[:8]))
        start, first = time.perf_counter(), None
        stream = client.chat.completions.create(
            model=model, messages=[{"role": "user", "content": "Say hello in one short sentence."}],
            max_tokens=512, stream=True)
        with stream:
            for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                text = delta.content or getattr(delta, "reasoning_content", "") or ""
                if text:
                    first = first if first is not None else time.perf_counter()
                    print(text, end="", flush=True)
        if first is None:
            sys.exit("No text returned. Try another chat model or raise max_tokens for reasoning models.")
        print(f"\nmodel={model} ttft_ms={(first-start)*1000:.0f} total_ms={(time.perf_counter()-start)*1000:.0f}")
    except APIStatusError as exc:
        if exc.status_code == 410:
            body = exc.body if isinstance(exc.body, dict) else {}
            sys.exit("410: " + str(body.get("detail", "Model reached end of life.")) + " Pick another model from /v1/models.")
        messages = {401: "401: Check NVIDIA_API_KEY or your server credentials.", 403: "403: Check NVIDIA_API_KEY or your server credentials.",
                    429: "429: Rate limit reached. Wait before trying again.",
                    404: "404: Model not found. Pick a chat model from /v1/models."}
        sys.exit(messages.get(exc.status_code, f"HTTP {exc.status_code}: Request failed. Check the server and model."))
    except Exception:
        sys.exit("Request failed. Check NIM_BASE_URL, connectivity and NIM_TIMEOUT_SECONDS.")


if __name__ == "__main__":
    main()
