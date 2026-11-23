import { esc } from "./util.js";

/* 장면색 c, 그 위 글자색 i(대비 4.5:1 이상, 최저 5.5), 둘째 잉크 p */
export const RISO = [
  { c: "#ff3d8b", i: "#0b0b0b", p: "#1b3bff" },
  { c: "#1b3bff", i: "#f7f3ea", p: "#ffd60a" },
  { c: "#ff3b1f", i: "#0b0b0b", p: "#1b3bff" },
  { c: "#ffd60a", i: "#0b0b0b", p: "#ff3b1f" },
  { c: "#00b86b", i: "#0b0b0b", p: "#ff3d8b" },
  { c: "#3fb8f0", i: "#0b0b0b", p: "#ff3b1f" },
  { c: "#b8e835", i: "#0b0b0b", p: "#1b3bff" },
  { c: "#efe6d2", i: "#0b0b0b", p: "#ff3b1f" },
];
export const hash = (s) => {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h >>> 0;
};
let COLOR = {}; // 장르 → RISO 항목. site/vocab.json의 color. 표에 없으면 해시로 고른다
export const setColors = (genres) => {
  COLOR = {};
  for (const g of genres) {
    const r = RISO.find((x) => x.c === g.color);
    if (r) COLOR[g.name] = r;
  }
};
export const tone = (t) =>
  COLOR[t.genres[0]] || RISO[hash(t.genres[0] || t.title) % RISO.length];
const yr = (t) => parseInt(t.released) || 0;

// 아래 띠의 워드마크는 index.html 머리말에 둔 symbol #wm-block을 쓴다. 페이지 밖에서 쓰면 띠가 비어 보인다
export function genCover(t, tn) {
  const h = hash(t.title + "|" + t.artist),
    k = (h >>> 5) % 4,
    a = RISO[(h >>> 2) % RISO.length].c,
    b = tn.c === a ? "#0b0b0b" : tn.c;
  let p = "";
  // 무늬에 중앙으로 모이는 집중선은 쓰지 않는다(사용자 결정)
  if (k === 0)
    for (let r = 230, j = 0; r > 0; r -= 24, j++)
      p += `<circle cx="${150 + (j % 2) * 6}" cy="150" r="${r}" fill="${j % 2 ? a : b}"/>`;
  else if (k === 1)
    for (let x = -320; x < 640; x += 40)
      p += `<rect x="${x}" y="-60" width="20" height="420" fill="${b}" transform="rotate(-30 150 150)"/>`;
  else if (k === 2)
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 6; x++) {
        if ((x + y) % 2)
          p += `<rect x="${x * 50}" y="${y * 50}" width="50" height="50" fill="${b}"/>`;
      }
  else
    for (let y = 12; y < 300; y += 28)
      for (let x = 12; x < 300; x += 28)
        p += `<circle cx="${x}" cy="${y}" r="${4 + ((x * y + h) % 8)}" fill="${b}"/>`;
  const ch = esc(
    [...String(t.title).replace(/^[^\p{L}\p{N}]+/u, "")][0] || "♪",
  );
  return `<svg viewBox="0 0 300 300" role="img" aria-label="${esc(t.album || t.title)}"><rect width="300" height="300" fill="${a}"/>${p}
  <text x="157" y="163" text-anchor="middle" dominant-baseline="middle" font-family="Gasoek One,Dela Gothic One" font-size="175" fill="${tn.p}">${ch}</text>
  <text x="150" y="156" text-anchor="middle" dominant-baseline="middle" font-family="Gasoek One,Dela Gothic One" font-size="175" fill="#0b0b0b" stroke="#f7f3ea" stroke-width="5" paint-order="stroke">${ch}</text>
  <g transform="translate(0 262)" style="--c:#0b0b0b;--ci:#f7f3ea;--cp:#ff3d8b"><rect width="300" height="38" fill="#0b0b0b"/><use href="#wm-block" x="8" y="5" width="103" height="28"/></g><text x="288" y="289" text-anchor="end" font-family="Saira Extra Condensed" font-style="italic" font-weight="900" font-size="24" fill="${tn.c}">${esc(yr(t) || "")}</text></svg>`;
}
export function swatch(t) {
  const tn = tone(t),
    h = hash(t.title + "|" + t.artist),
    a = RISO[(h >>> 2) % RISO.length].c;
  return `background:linear-gradient(135deg,${a} 0 50%,${tn.c === a ? "#0b0b0b" : tn.c} 50% 100%)`;
}
