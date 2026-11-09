import { useEffect, useRef, useState } from "react";
import { API_URL, checkHealth, translateText } from "./api.js";
import { SEMICONDUCTOR_GLOSSARY } from "./glossary.js";

const LANGUAGES = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
];
const MAX_CHARS = 2000;
const BUILTIN_COUNT = Object.keys(SEMICONDUCTOR_GLOSSARY).length;

// ─────────────────────────────────────────────
// 1. 도우미 함수 (화면과 상관없는 계산만 모아 둠)
// ─────────────────────────────────────────────

// 번역 방향에 맞는 용어집을 만든다.
// 용어집은 "영어 → 한국어" 쌍으로 관리하고, 한국어 → 영어 번역이면 key와 value를 뒤집어서 보낸다.
function buildGlossary(useSemiconductor, customTerms, sourceLang) {
  const enToKo = {};

  if (useSemiconductor) {
    Object.assign(enToKo, SEMICONDUCTOR_GLOSSARY);
  }
  for (const term of customTerms) {
    const en = term.en.trim();
    const ko = term.ko.trim();
    if (en && ko) enToKo[en] = ko; // 같은 영어 단어면 사용자가 입력한 값이 우선
  }

  if (sourceLang === "en") return enToKo;

  const koToEn = {};
  for (const [en, ko] of Object.entries(enToKo)) {
    koToEn[ko] = en;
  }
  return koToEn;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 번역문에서 용어집 번역어를 찾아 [일반, 용어, 일반, 용어, ...] 순서로 쪼갠다.
// split에 괄호( )를 쓰면 찾은 용어도 결과에 남기 때문에, 홀수 번째 조각이 항상 용어다.
function splitByTerms(translated, used) {
  const values = Object.values(used).filter(Boolean);
  if (values.length === 0) return [translated];

  const pattern = values
    .map(escapeRegExp)
    .sort((a, b) => b.length - a.length) // 긴 용어를 먼저 찾아야 짧은 용어에 먹히지 않는다
    .join("|");
  return translated.split(new RegExp(`(${pattern})`, "gi"));
}

// 형광펜으로 표시한 번역어의 원래 용어를 찾는다. (마우스를 올렸을 때 보여주는 용도)
function sourceTermOf(matched, used) {
  const hit = Object.entries(used).find(
    ([, target]) => target.toLowerCase() === matched.toLowerCase()
  );
  return hit ? hit[0] : "";
}

function timeNote(meta) {
  if (!meta) return "";
  // 첫 요청은 모델을 메모리에 올리느라 오래 걸린다. 그 시간을 번역 시간으로 보여주면 오해하기 쉽다.
  if (meta.load_sec >= 1) return "처음 요청이라 모델을 불러왔어요.";
  return `${Number(meta.total_sec).toFixed(2)}초`;
}

// ─────────────────────────────────────────────
// 2. 작은 화면 조각
// ─────────────────────────────────────────────

function WaferIcon() {
  return (
    <svg className="logo" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <clipPath id="wafer-clip">
          <circle cx="20" cy="20" r="17" />
        </clipPath>
      </defs>
      <circle cx="20" cy="20" r="17" fill="#e6eef5" />
      <g clipPath="url(#wafer-clip)" stroke="#24547e" strokeWidth="1" opacity="0.55">
        {[8, 14, 20, 26, 32].map((p) => (
          <g key={p}>
            <line x1={p} y1="0" x2={p} y2="40" />
            <line x1="0" y1={p} x2="40" y2={p} />
          </g>
        ))}
      </g>
      <circle cx="20" cy="20" r="17" fill="none" stroke="#24547e" strokeWidth="2" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// 3. 메인 화면
// ─────────────────────────────────────────────

export default function App() {
  // ── 상태(state): 값이 바뀌면 화면이 다시 그려진다 ──
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("ko");
  const [useSemiconductor, setUseSemiconductor] = useState(true);
  const [text, setText] = useState("");
  const [result, setResult] = useState(null); // { translated, meta }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [customTerms, setCustomTerms] = useState([]); // [{ id, en, ko }]
  const [server, setServer] = useState({ status: "checking", model: "" });
  const nextTermId = useRef(1);

  // ── 서버 상태 확인 ──
  async function refreshServerStatus() {
    setServer({ status: "checking", model: "" });
    try {
      const health = await checkHealth();
      setServer({ status: "online", model: health.model || "" });
    } catch {
      setServer({ status: "offline", model: "" });
    }
  }

  useEffect(() => {
    refreshServerStatus(); // 화면이 처음 나타날 때 한 번만 실행
  }, []);

  // ── 언어 선택 ──
  function changeSource(code) {
    setSourceLang(code);
    if (code === targetLang) setTargetLang(code === "ko" ? "en" : "ko"); // 같은 언어 방지
    setResult(null);
  }

  function changeTarget(code) {
    setTargetLang(code);
    if (code === sourceLang) setSourceLang(code === "ko" ? "en" : "ko");
    setResult(null);
  }

  function swapLanguages() {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    if (result) {
      setText(result.translated); // 번역 결과를 원문 칸으로 올려서 다시 번역할 수 있게 한다
      setResult(null);
    }
  }

  // ── 번역 ──
  async function handleTranslate() {
    if (!text.trim() || loading) return;

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const glossary = buildGlossary(useSemiconductor, customTerms, sourceLang);
      const data = await translateText({
        text,
        source: sourceLang,
        target: targetLang,
        glossary,
      });
      setResult(data);
      setServer((prev) =>
        prev.status === "online"
          ? prev
          : { status: "online", model: data.meta?.model || "" }
      );
    } catch (err) {
      setError(err.message);
      refreshServerStatus();
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event) {
    // Ctrl+Enter (맥은 Cmd+Enter)로 번역
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      handleTranslate();
    }
  }

  function clearAll() {
    setText("");
    setResult(null);
    setError("");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result.translated);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("복사하지 못했어요. 번역문을 직접 선택해서 복사해 주세요.");
    }
  }

  // ── 사용자 용어 추가/수정/삭제 ──
  function addTerm() {
    setCustomTerms([...customTerms, { id: nextTermId.current++, en: "", ko: "" }]);
  }

  function updateTerm(id, field, value) {
    setCustomTerms(customTerms.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  }

  function removeTerm(id) {
    setCustomTerms(customTerms.filter((t) => t.id !== id));
  }

  // ── 화면에 보여줄 값 계산 ──
  const meta = result?.meta;
  const usedGlossary = meta?.used_glossary ?? {};
  const usedEntries = Object.entries(usedGlossary); // [[원문 용어, 번역어], ...]
  const parts = result ? splitByTerms(result.translated, usedGlossary) : [];

  const statusLabel = {
    checking: "서버 확인 중",
    online: server.model ? `${server.model} 연결됨` : "연결됨",
    offline: "서버에 연결되지 않음",
  }[server.status];

  const placeholder = useSemiconductor
    ? "번역하면 결과가 여기에 표시돼요. 용어집에 있는 용어는 형광펜으로 표시돼요."
    : "번역하면 결과가 여기에 표시돼요.";

  return (
    <div className="page">
      {/* ── 머리말 ── */}
      <header className="masthead">
        <div className="brand">
          <WaferIcon />
          <div>
            <h1>반도체 용어 번역기</h1>
            <p className="tagline">번역 모델이 이 PC에서 돌아가요. 문서는 밖으로 나가지 않아요.</p>
          </div>
        </div>
        <button
          type="button"
          className="status"
          data-state={server.status}
          onClick={refreshServerStatus}
          title="누르면 서버 상태를 다시 확인해요"
        >
          <span className="dot" aria-hidden="true" />
          {statusLabel}
        </button>
      </header>

      {/* ── 용어집 켜기/끄기 ── */}
      <label className="switch">
        <input
          type="checkbox"
          role="switch"
          checked={useSemiconductor}
          onChange={(e) => setUseSemiconductor(e.target.checked)}
        />
        <span className="switch-track" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
        <span className="switch-label">반도체 용어집 적용</span>
        <span className="switch-note">{BUILTIN_COUNT}개 용어</span>
      </label>

      {/* ── 번역 작업대: 원문과 결과를 하나의 테두리 안에 둔다 ── */}
      <section className="stage" aria-label="번역">
        <div className="langbar">
          <select
            aria-label="원문 언어"
            value={sourceLang}
            onChange={(e) => changeSource(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="swap"
            onClick={swapLanguages}
            aria-label="원문 언어와 번역 언어 바꾸기"
          >
            ⇄
          </button>
          <select
            aria-label="번역 언어"
            value={targetLang}
            onChange={(e) => changeTarget(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="panes">
          {/* 원문 */}
          <div className="pane">
            <textarea
              id="source-text"
              className="source-input"
              aria-label="번역할 원문"
              placeholder="번역할 문장을 입력하세요."
              value={text}
              maxLength={MAX_CHARS}
              lang={sourceLang}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="pane-foot">
              <span className={text.length > MAX_CHARS * 0.9 ? "counter near-limit" : "counter"}>
                {text.length} / {MAX_CHARS}
              </span>
              <div className="foot-actions">
                <button type="button" className="btn btn-quiet" onClick={clearAll} disabled={!text && !result}>
                  지우기
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleTranslate}
                  disabled={!text.trim() || loading}
                >
                  {loading ? "번역 중…" : "번역하기"}
                </button>
              </div>
            </div>
          </div>

          {/* 번역 결과 */}
          <div className="pane pane-result">
            <div className="output" aria-live="polite" aria-busy={loading}>
              {loading && <p className="placeholder">번역 중…</p>}
              {!loading && !result && <p className="placeholder">{placeholder}</p>}
              {!loading && result && (
                <p className="output-text" lang={targetLang}>
                  {parts.map((part, i) =>
                    i % 2 === 1 ? (
                      <mark key={i} title={`원문 용어: ${sourceTermOf(part, usedGlossary)}`}>
                        {part}
                      </mark>
                    ) : (
                      part
                    )
                  )}
                </p>
              )}
            </div>
            <div className="pane-foot">
              <span className="time-note">{!loading && timeNote(meta)}</span>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={handleCopy}
                disabled={!result || loading}
              >
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 오류 안내 ── */}
      {error && (
        <div className="notice-error" role="alert">
          {error}
        </div>
      )}

      {/* ── 적용된 용어 검수: 서버가 실제로 적용한 용어가 번역문에 들어갔는지 확인한다 ── */}
      {result && (
        <section className="inspection" aria-label="적용된 용어">
          {usedEntries.length === 0 ? (
            <p className="inspection-empty">이 문장에는 적용된 용어가 없어요.</p>
          ) : (
            <>
              <h2>적용된 용어 {usedEntries.length}개</h2>
              <ul className="term-list">
                {usedEntries.map(([source, target]) => {
                  const reflected = result.translated.toLowerCase().includes(target.toLowerCase());
                  return (
                    <li key={source} className={reflected ? "term-item ok" : "term-item miss"}>
                      <span className="term-pair">
                        <span lang={sourceLang}>{source}</span>
                        <span className="term-arrow" aria-hidden="true">→</span>
                        <strong lang={targetLang}>{target}</strong>
                      </span>
                      <span className="term-state">{reflected ? "반영됨" : "번역문에 없음"}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}

      {/* ── 접었다 펼 수 있는 패널 ── */}
      <div className="panels">
        <details className="panel">
          <summary>용어집 보기·추가</summary>
          <div className="panel-body">
            {useSemiconductor ? (
              <>
                <p className="panel-note">반도체 용어집 {BUILTIN_COUNT}개가 적용돼요.</p>
                <ul className="term-grid">
                  {Object.entries(SEMICONDUCTOR_GLOSSARY).map(([en, ko]) => (
                    <li key={en}>
                      <span lang="en">{en}</span>
                      <span className="term-arrow" aria-hidden="true">→</span>
                      <strong lang="ko">{ko}</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="panel-note">반도체 용어집이 꺼져 있어요. 위의 스위치를 켜면 적용돼요.</p>
            )}

            <p className="panel-note">
              내 용어 추가: 영어와 한국어를 한 쌍씩 입력해요. 한국어 → 영어 번역에서는 자동으로 뒤집어서 적용돼요.
            </p>
            {customTerms.map((term) => (
              <div className="term-row" key={term.id}>
                <input
                  className="term-en"
                  aria-label="영어 용어"
                  placeholder="English"
                  lang="en"
                  value={term.en}
                  onChange={(e) => updateTerm(term.id, "en", e.target.value)}
                />
                <input
                  className="term-ko"
                  aria-label="한국어 용어"
                  placeholder="한국어"
                  lang="ko"
                  value={term.ko}
                  onChange={(e) => updateTerm(term.id, "ko", e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-outline term-remove"
                  onClick={() => removeTerm(term.id)}
                  aria-label="이 용어 삭제"
                >
                  삭제
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-outline" onClick={addTerm}>
              용어 추가
            </button>
          </div>
        </details>

        <details className="panel">
          <summary>상세 정보</summary>
          <div className="panel-body">
            {meta ? (
              <dl className="meta">
                <div>
                  <dt>모델</dt>
                  <dd>{meta.model}</dd>
                </div>
                <div>
                  <dt>temperature</dt>
                  <dd>{meta.temperature}</dd>
                </div>
                <div>
                  <dt>전체 시간</dt>
                  <dd>{meta.total_sec}초</dd>
                </div>
                <div>
                  <dt>모델 불러오기</dt>
                  <dd>{meta.load_sec}초</dd>
                </div>
                <div>
                  <dt>생성 속도</dt>
                  <dd>{meta.eval_rate ? `${meta.eval_rate} tokens/s` : "-"}</dd>
                </div>
                <div>
                  <dt>서버 주소</dt>
                  <dd>{API_URL}</dd>
                </div>
              </dl>
            ) : (
              <p className="panel-note">번역하면 모델과 속도 정보가 여기에 표시돼요.</p>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
