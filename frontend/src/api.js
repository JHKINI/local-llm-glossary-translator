// FastAPI 서버 주소. 다른 주소를 쓰려면 프로젝트 폴더에 .env 파일을 만들고
// VITE_API_URL=http://127.0.0.1:8000 처럼 적으면 된다.
export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8002";

// 서버가 켜져 있는지 확인한다. 응답 예: { status: "ok", model: "qwen3.5:4b" }
export async function checkHealth() {
  const res = await fetch(`${API_URL}/`);
  if (!res.ok) throw new Error("서버 상태 확인에 실패했어요.");
  return res.json();
}

// 번역을 요청한다. 응답 예: { translated: "...", meta: { used_glossary: {...}, total_sec: 0.3, ... } }
export async function translateText({ text, source, target, glossary }) {
  let res;
  try {
    res = await fetch(`${API_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source, target, glossary }),
    });
  } catch {
    // 서버가 꺼져 있거나 주소가 틀리면 fetch 자체가 실패한다.
    throw new Error(
      "서버에 연결할 수 없어요. FastAPI 서버(포트 8002)가 켜져 있는지 확인해 주세요."
    );
  }

  if (!res.ok) {
    if (res.status === 502) {
      throw new Error("번역 모델이 응답하지 않아요. Ollama가 켜져 있는지 확인해 주세요.");
    }
    if (res.status === 422) {
      throw new Error("요청 형식이 올바르지 않아요. 입력한 내용을 확인해 주세요.");
    }
    throw new Error(
      `서버에서 오류가 발생했어요(${res.status}). 서버를 켠 창에서 에러 로그를 확인해 주세요.`
    );
  }
  return res.json();
}
