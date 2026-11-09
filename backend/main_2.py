import os

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3.5:4b")
TEMPERATURE = float(os.getenv("TEMPERATURE", "0"))  # 0 = 매번 같은 결과

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
    glossary: dict[str, str] = {}  # 추가: 예) {"yield rate": "수율"}


@app.get("/")
def health():
    return {"status": "ok", "model": OLLAMA_MODEL}


@app.post("/translate")
async def translate(req: TranslateRequest):
    if not req.text.strip():
        return {"translated": "", "meta": None}

    source = LANG_NAMES.get(req.source, req.source)
    target = LANG_NAMES.get(req.target, req.target)
    system = (
        f"You are a professional translator. Translate the user's text from {source} "
        f"into {target}. Output only the translation, with no explanations, quotes, or notes."
    )

    # 추가: 용어집이 있으면 시스템 프롬프트 끝에 붙이기
    if req.glossary:
        pairs = "\n".join(f"- {k} = {v}" for k, v in req.glossary.items())
        system += f"\nUse exactly these translations for these terms:\n{pairs}"

    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": req.text},
        ],
        "stream": False,
        "think": False,
        "options": {"temperature": 0},
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
            r.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Ollama request failed: {e}")

    data = r.json()
    translated = data.get("message", {}).get("content", "").strip()

    # 추가: Ollama가 주는 시간 정보(나노초)를 초로 바꿔서 meta로 내려주기
    eval_count = data.get("eval_count", 0)
    eval_sec = data.get("eval_duration", 0) / 1e9
    meta = {
        "model": OLLAMA_MODEL,
        "temperature": TEMPERATURE,
        "total_sec": round(data.get("total_duration", 0) / 1e9, 2),
        "load_sec": round(data.get("load_duration", 0) / 1e9, 2),
        "eval_rate": round(eval_count / eval_sec, 2) if eval_sec else None,
    }
    return {"translated": translated, "meta": meta}