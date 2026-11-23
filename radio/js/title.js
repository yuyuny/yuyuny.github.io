/* 제목 레터링 계산. DOM을 건드리지 않는다(test/title.test.js가 Node에서 import).
   measure(str)는 font-size 1px일 때 str의 폭(px)을 돌려준다. 브라우저에선 canvas measureText를 넘긴다. */

const BREAK_EACH =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303F＀-￯]/u; // 글자마다 줄을 바꿔도 되는 문자
const STACK =
  /^[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{1,4}$/u; // 쌓아 볼 제목: 공백 없는 네 글자 이하
const AVOID = /[iIjlt1!|.,:;'"`fr()[\]{}\-\sgpqy]/; // 상자에 넣지 않는다: 얇은 글자는 괄호처럼 읽히고, 아래로 처지는 글자는 상자 밖으로 삐져나온다
const LETTER = /[\p{L}\p{N}]/u;

export const clean = (s) =>
  String(s ?? "")
    .trim()
    .replace(/\s+/g, " ");

/* 줄을 바꿀 수 있는 단위. 공백으로 나뉜 단어, 한자·가나는 한 글자씩. {a,b}는 text 안의 [a,b) */
export function units(text) {
  const out = [],
    cs = [...text];
  let a = -1,
    pos = 0;
  const flush = (end) => {
    if (a >= 0) {
      out.push({ a, b: end });
      a = -1;
    }
  };
  for (const c of cs) {
    const end = pos + c.length;
    if (c === " ") flush(pos);
    else if (BREAK_EACH.test(c)) {
      flush(pos);
      out.push({ a: pos, b: end });
    } else if (a < 0) a = pos;
    pos = end;
  }
  flush(pos);
  return out;
}

/* 상자를 씌울 글자 위치(UTF-16 index). AVOID는 피하고 seed로 고른다. 글자 12개 넘으면 둘 */
export function pickBoxes(text, seed) {
  const idx = [];
  let pos = 0;
  for (const c of text) {
    if (LETTER.test(c) && !AVOID.test(c)) idx.push(pos);
    pos += c.length;
  }
  if (idx.length < 2) return [];
  const out = [idx[seed % idx.length]];
  if ([...text].filter((c) => LETTER.test(c)).length > 12 && idx.length > 1)
    // 반대쪽 절반에서
    out.push(
      idx[((seed % idx.length) + Math.floor(idx.length / 2)) % idx.length],
    );
  return out.sort((x, y) => x - y);
}

/* 단위들을 폭 cap(px) 안에서 앞에서부터 채운다. 한 단위가 cap보다 넓으면 그 줄은 넘친다 */
function wrap(us, cap, w) {
  const lines = [];
  let cur = null;
  for (const u of us) {
    if (cur && w(cur.a, u.b) <= cap) cur.b = u.b;
    else {
      if (cur) lines.push(cur);
      cur = { a: u.a, b: u.b };
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * 제목을 줄로 나누고 크기를 정한다.
 * width·height: 제목 상자(px). max·min: 글자 크기 한계(px). lh: line-height(배수).
 * boxPad: 상자 글자 하나가 더하는 폭(em). 큰 크기부터 step씩 줄이며 maxLines·height 안에 드는 첫 크기를 쓴다.
 * min에서도 안 들면 단어를 글자 단위로 끊고, 그래도 넘치면 마지막 줄을 "…"로 자른다(clipped).
 * 공백 없는 네 글자 이하 한글·한자 제목은 쌓아 본다: 2~3자는 한 글자씩 세로로, 4자는 2×2나 세로로.
 * 쌓은 쪽이 더 클 때만 쓴다(stacked). 낮고 넓은 칸에선 한 줄이 이긴다.
 * 반환: {size, lines:[{a,b,text}], clipped, stacked}. a·b는 원문 index라 상자 위치와 맞춰 쓸 수 있다.
 */
export function fitTitle(
  raw,
  {
    width,
    height,
    measure,
    max,
    min = 28,
    lh = 1.02,
    maxLines = 3,
    boxes = [],
    boxPad = 0.16,
    step = 2,
  },
) {
  const text = clean(raw);
  if (!text) return { size: min, lines: [], clipped: false, stacked: false };
  const w = (a, b) => {
    const s = text.slice(a, b);
    let n = 0;
    for (const i of boxes) if (i >= a && i < b) n++;
    return measure(s) + n * boxPad;
  };
  const us = units(text);
  const fits = (lines, s) =>
    lines.length <= maxLines &&
    lines.length * s * lh <= height &&
    lines.every((l) => w(l.a, l.b) * s <= width);
  const out = (lines, size, extra = {}) => ({
    size,
    lines: lines.map((l) => ({ ...l, text: l.text ?? text.slice(l.a, l.b) })),
    clipped: false,
    stacked: false,
    ...extra,
  });

  let best = null;
  for (let s = Math.floor(max); s >= min; s -= step) {
    const ls = wrap(us, width / s, w);
    if (fits(ls, s)) {
      best = out(ls, s);
      break;
    }
  }

  if (STACK.test(text)) {
    const cs = [];
    let pos = 0;
    for (const c of text) {
      cs.push({ a: pos, b: pos + c.length });
      pos += c.length;
    }
    const ways = [
      cs.length > 1 && cs.length <= maxLines ? cs : null,
      cs.length === 4
        ? [
            { a: cs[0].a, b: cs[1].b },
            { a: cs[2].a, b: cs[3].b },
          ]
        : null,
    ].filter(Boolean);
    for (const ls of ways) {
      const s = Math.floor(
        Math.min(
          max,
          height / (ls.length * lh),
          ...ls.map((l) => width / w(l.a, l.b)),
        ),
      );
      if (s >= min && s > (best?.size ?? 0))
        best = out(ls, s, { stacked: true });
    }
  }
  if (best) return best;

  // min에서도 안 든다: 글자 단위로 끊고 maxLines까지만, 넘치면 말줄임
  const chars = [];
  let pos = 0;
  for (const c of text) {
    if (c !== " ") chars.push({ a: pos, b: pos + c.length });
    pos += c.length;
  }
  const fine = us.flatMap((u) =>
    w(u.a, u.b) * min <= width
      ? [u]
      : chars.filter((c) => c.a >= u.a && c.b <= u.b),
  );
  const rows = Math.max(1, Math.min(maxLines, Math.floor(height / (min * lh))));
  const ls = wrap(fine, width / min, w);
  if (ls.length <= rows) return out(ls, min);
  const kept = ls.slice(0, rows),
    last = kept[rows - 1];
  let b = last.b;
  while (b > last.a && (w(last.a, b) + measure("…")) * min > width)
    b -= text.codePointAt(b - 1) > 0xffff && b - 2 >= last.a ? 2 : 1;
  kept[rows - 1] = {
    a: last.a,
    b,
    text: text.slice(last.a, b).trimEnd() + "…",
  };
  return out(kept, min, { clipped: true });
}
