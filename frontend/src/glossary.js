// 영어 → 한국어 반도체 용어집
// 용어집은 "영어": "한국어" 한 쌍씩 적습니다. 한국어 → 영어 번역에서는 자동으로 뒤집어서 쓰므로
// 한국어 번역어(값)는 서로 겹치지 않게 적어야 합니다.
// 아래 "삼성반도체이야기 반도체 용어 모음" 항목은 삼성반도체 용어 모음의 한글·영어 표기를 참고했습니다.
// 번역어는 교재나 공개 기술 자료로 한 번 더 확인하세요.
export const SEMICONDUCTOR_GLOSSARY = {
  // ── 기본 10개 (실험에서 쓴 용어) ──
  "yield rate": "수율",
  wafer: "웨이퍼",
  defect: "결함",
  etching: "식각",
  deposition: "증착",
  photoresist: "포토레지스트",
  lot: "로트",
  "control chart": "관리도",
  "out of specification": "규격 이탈",
  "corrective action": "시정 조치",

  // ── 삼성반도체이야기 반도체 용어 모음 참고 ──
  // 소자·재료
  ingot: "잉곳",
  mask: "마스크",
  "oxide film": "산화막",
  transistor: "트랜지스터",
  capacitor: "커패시터",
  capacitance: "커패시턴스",
  diode: "다이오드",
  conductor: "도체",
  insulator: "부도체",
  "n-type semiconductor": "n형 반도체",
  "p-type semiconductor": "p형 반도체",
  "integrated circuit": "집적회로",
  finfet: "핀펫",

  // 메모리·시스템 반도체
  "memory semiconductor": "메모리 반도체",
  "system semiconductor": "시스템 반도체",
  "flash memory": "플래시 메모리",
  "nand flash memory": "낸드 플래시 메모리",
  "nor flash memory": "노어 플래시 메모리",
  dram: "D램",
  sram: "S램",
  "system on chip": "시스템 온 칩",
  "neural processing unit": "신경망처리장치",
  "image sensor": "이미지센서",
  "cmos image sensor": "CMOS 이미지센서",

  // 공정·패키징·산업
  "lead frame": "리드 프레임",
  "flip chip": "플립칩",
  packaging: "패키징",
  "through silicon via": "실리콘 관통전극",
  foundry: "파운드리",
  fabless: "팹리스",
  "integrated device manufacturer": "종합 반도체 업체",
};
