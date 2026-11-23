/* DOM을 건드리지 않는다. Node에서 import해 테스트한다. */
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const BASE = { ㄲ: "ㄱ", ㄸ: "ㄷ", ㅃ: "ㅂ", ㅆ: "ㅅ", ㅉ: "ㅈ" }; // 쌍자음은 기본 자음 묶음에 합친다
const cho = (c) => BASE[c] || c;

/* 한글은 초성, 영문은 대문자(악센트 제거), 가나는 あ, 한자는 漢, 숫자와 그 밖은 # */
export function groupKey(s) {
  const ch = [...String(s ?? "").trimStart()][0];
  if (!ch) return "#";
  const c = ch.codePointAt(0);
  if (c >= 0xac00 && c <= 0xd7a3)
    return cho(CHO[Math.floor((c - 0xac00) / 588)]);
  if (c >= 0x3131 && c <= 0x314e) return cho(ch); // 낱자 자음. 모음 낱자는 #
  const l = ch.normalize("NFD")[0].toUpperCase();
  if (/^[A-Z]$/.test(l)) return l;
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(ch)) return "あ";
  if (/\p{Script=Han}/u.test(ch)) return "漢";
  return "#";
}

/* 추가한 날 "YYYY-MM-DD"의 연도. 날짜가 없으면 # */
export const yearKey = (s) => String(s || "").slice(0, 4) || "#";

/* 정렬된 목록에서 묶음별 첫 행 [{key,index}]. 처음 나온 순서를 따른다(한자는 한글 사이에 섞여 정렬되므로 묶음이 이어지지 않을 수 있다).
   field가 added면 연도별, 아니면 초성·알파벳별 */
export function groups(view, field) {
  const seen = new Map(),
    keyOf = field === "added" ? yearKey : groupKey;
  view.forEach((t, i) => {
    const k = keyOf(t[field]);
    if (!seen.has(k)) seen.set(k, i);
  });
  return [...seen].map(([key, index]) => ({ key, index }));
}
