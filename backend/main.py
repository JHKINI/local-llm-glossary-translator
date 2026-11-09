
import os
import re

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3.5:4b")
TEMPERATURE = float(os.getenv("TEMPERATURE", "0"))

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

    # 1. 빈 문자열 검사
    if not req.text.strip():
        return {"translated": "", "meta": None}

    # 2. 언어 설정
    source = LANG_NAMES.get(req.source, req.source)
    target = LANG_NAMES.get(req.target, req.target)

    # 3. 시스템 프롬프트 생성
    system = (
        f"You are a professional translator. Translate the user's text from {source} "
        f"into {target}. Output only the translation, with no explanations, quotes, or notes."
    )

    # 4. 원문에 실제 포함된 용어집만 추출
    used = {}

    for k, v in req.glossary.items():
        if not k:
            continue

        if k.isascii():
            # 영어 용어: 단어 경계(\b)로 찾는다 (slot 안의 lot 같은 오탐 방지)
            found = re.search(
                rf"\b{re.escape(k)}(s|es)?\b",
                req.text,
                re.IGNORECASE
            )
        else:
            # 한국어 용어: 조사가 붙어서 \b가 안 먹으므로 포함 여부로 찾는다
            found = k in req.text

        if found:
            used[k] = v
    # 5. 용어집이 있다면 프롬프트에 추가
    if used:
        pairs = "\n".join(
            f"- {k} = {v}" for k, v in used.items()
        )

        system += (
            f"\nUse exactly these translations for these terms:\n{pairs}"
        )

    # 6. Ollama 요청 데이터 생성
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": req.text},
        ],
        "stream": False,
        "think": False,
        "options": {
            "temperature": TEMPERATURE
        },
    }

    # 7. Ollama API 호출
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json=payload
            )
            r.raise_for_status()

    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Ollama request failed: {e}"
        )

     # 8. 번역 결과 추출
    data = r.json()

    translated = (
        data.get("message", {})
        .get("content", "")
        .strip()
    )

    # 9. 속도 정보 계산 (Ollama는 시간을 나노초로 줌 → 초로 변환)
    eval_count = data.get("eval_count", 0)
    eval_sec = data.get("eval_duration", 0) / 1e9

    # 10. 결과 반환
    return {
        "translated": translated,
        "meta": {
            "model": OLLAMA_MODEL,
            "temperature": TEMPERATURE,
            "source": req.source,
            "target": req.target,
            "used_glossary": used,
            "total_sec": round(data.get("total_duration", 0) / 1e9, 2),
            "load_sec": round(data.get("load_duration", 0) / 1e9, 2),
            "eval_rate": round(eval_count / eval_sec, 2) if eval_sec else None,
        },
    }