# Docker Compose로 실행하기

구성: `web`(React 빌드 + nginx) → `backend`(FastAPI) → Ollama

## 사전 준비

- Docker Desktop (또는 Docker Engine + Compose)
- Ollama가 내 PC에서 실행 중이고 모델이 받아져 있어야 합니다.
  ```bash
  ollama pull qwen3.5:4b
  ```

## 실행

```bash
docker compose up -d --build
```

접속: `http://localhost:8081`

`.env` 파일은 선택 사항입니다. 모델이나 주소를 바꾸고 싶을 때만 만드세요.

```bash
cp .env.example .env      # Windows cmd: copy .env.example .env
```

## 다른 Ollama 서버를 쓰는 경우

`.env`에서 주소와 모델명을 바꿉니다.

```
OLLAMA_URL=https://내-ollama-서버
OLLAMA_MODEL=서버에-있는-모델명
```

적용: `docker compose up -d`

## 확인

```bash
docker compose ps
docker compose logs -f backend
curl http://localhost:8081/api/        # {"status":"ok","model":"..."}
```

## 설정 (.env)

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `OLLAMA_URL` | `http://host.docker.internal:11434` | Ollama 서버 주소 |
| `OLLAMA_MODEL` | `qwen3.5:4b` | 모델명 |
| `TEMPERATURE` | `0` | 생성 온도 |
| `WEB_PORT` | `8081` | 외부 접속 포트 |

## 종료

```bash
docker compose down
```
