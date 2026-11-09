import os

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3.5:4b")

LANG_NAMES = {
    "auto": "the detected language",
    "ko": "Korean",
    "en": "English",
    "ja": "Japanese",
    "zh": "Chinese",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
}

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TranslateRequest(BaseModel):
    text: str
    source: str = "auto"
    target: str = "en"


@app.get("/")
def health():
    return {"status": "ok", "model": OLLAMA_MODEL}


@app.post("/translate")
async def translate(req: TranslateRequest):
    if not req.text.strip():
        return {"translated": ""}

    source = LANG_NAMES.get(req.source, req.source)
    target = LANG_NAMES.get(req.target, req.target)
    system = (
        f"You are a professional translator. Translate the user's text from {source} "
        f"into {target}. Output only the translation, with no explanations, quotes, or notes."
    )

    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": req.text},
        ],
        "stream": False,
        "think": False,
    
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
            r.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Ollama request failed: {e}")

    translated = r.json().get("message", {}).get("content", "").strip()
    return {"translated": translated}
