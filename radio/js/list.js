import { $, esc, fmt } from "./util.js";
import { swatch } from "./cover.js";
import { uniq } from "./data.js";
import { groups } from "./group.js";

/* 고른 태그를 고른 순서대로 [종류, 값]으로 둔다. 종류: g 장르, s 세부 장르, m 무드, b 최애곡 연도 */
let picks = [];
const has = (k, v) => picks.some((p) => p[0] === k && p[1] === v);
const vals = (k) => picks.filter((p) => p[0] === k).map((p) => p[1]);
const any = (k) => picks.some((p) => p[0] === k);
const toggle = (k, v) =>
  (picks = has(k, v)
    ? picks.filter((p) => p[0] !== k || p[1] !== v)
    : [...picks, [k, v]]);

export function readouts(data) {
  const a = new Set(data.map((t) => t.artist)).size,
    c = data.filter((t) => t.comment).length;
  $("read").innerHTML = [
    [data.length, "곡"],
    [a, "아티스트"],
    [c, "코멘트"],
  ]
    .map(([n, l]) => `<div><b>${fmt(n)}</b><span>${l}</span></div>`)
    .join("");
}
/* 태그 줄은 [전체 | 장르 | 무드 갈래 넷 | 최애곡] 한 줄. 버튼을 누르면 그 칩만 아래 #mpanel에 편다.
   고른 태그는 첫 버튼 자리에 고른 순서대로 "■ 인디팝 ✕"·"베드룸 팝 ✕"·"#무드 ✕"·"★ 2023 ✕"로 남아 접어도 보이고, 누르면 그것만 푼다. 그 태그가 든 묶음의 버튼엔 장면색 판이 붙는다.
   장르 버튼의 칩 영역엔 장르 칩 다음에 구분선을 두고 세부 장르 칩이 온다. 최애곡 버튼은 곡에 best가 하나라도 있을 때만 그린다.
   여러 개를 고를 수 있고 곡은 고른 태그를 모두 가져야 남는다 */
let mgroups = [],
  years = [],
  gl = [],
  sl = [],
  openG = "";
// openG가 최애곡·장르 칩을 편 상태일 때의 값. 갈래 이름과 겹치지 않는다
const BEST = "\0best",
  GENRE = "\0genre";
const dot = (c) => (c ? `<span class="gd" style="--gc:${esc(c)}"></span>` : "");
function options(data, vocab) {
  const inData = (k) => {
    const s = new Set(data.flatMap((t) => t[k]));
    return (x) => s.has(x.name);
  };
  gl = vocab
    ? vocab.genres.filter(inData("genres"))
    : uniq(data, "genres").map((name) => ({ name }));
  sl = Array.isArray(vocab?.subgenres)
    ? vocab.subgenres.filter(inData("sub"))
    : [];
  if (vocab) {
    const ms = vocab.moods.filter(inData("moods"));
    mgroups = [...new Set(ms.map((m) => m.group))].map((g) => ({
      g,
      ms: ms.filter((m) => m.group === g).map((m) => m.name),
    }));
  } else mgroups = [{ g: "무드", ms: uniq(data, "moods") }];
  years = [...new Set(data.flatMap((t) => t.best))].sort().reverse(); // "인생"이 맨 앞, 그다음 최근 연도부터
  moodsUi();
}
// 고른 태그 칩(✕)은 data-x, 칩 영역의 칩은 data-k·data-v라서 같은 값이어도 포커스를 따로 찾는다
const attrOf = (b) => {
  const q = (n) => `[data-${n}="${CSS.escape(b.dataset[n])}"]`;
  return b.dataset.x != null
    ? q("x")
    : b.dataset.k != null
      ? q("k") + q("v")
      : b.dataset.g != null
        ? q("g")
        : b.dataset.b != null
          ? "[data-b]"
          : b.dataset.gb != null
            ? "[data-gb]"
            : "[data-all]";
};
function moodsUi() {
  const f = document.activeElement,
    box = [$("moods"), $("mpanel")],
    sel = box.some((b) => b.contains(f)) ? attrOf(f) : null; // 다시 그려도 포커스를 같은 버튼에 둔다
  const x = (k, v, label, text) =>
    `<button class="mb mx" type="button" data-x="${k}:${esc(v)}" aria-label="${label} 풀기">${text}<i aria-hidden="true">✕</i></button>`;
  const gc = (n) => gl.find((g) => g.name === n)?.color;
  const picked = picks
    .map(([k, v]) =>
      k === "g"
        ? x(k, v, `장르 ${esc(v)}`, dot(gc(v)) + esc(v))
        : k === "s"
          ? x(k, v, `세부 장르 ${esc(v)}`, esc(v))
          : k === "m"
            ? x(k, v, `무드 #${esc(v)}`, `#${esc(v)}`)
            : x(k, v, `최애곡 ${esc(v)}`, `★ ${esc(v)}`),
    )
    .join("");
  const btn = (attr, label, open, on) =>
    `<button class="mb mg" type="button" ${attr} aria-expanded="${open}" aria-controls="mpanel"${on ? " data-on" : ""}>${label}<i aria-hidden="true">▾</i></button>`;
  $("moods").innerHTML =
    (picked ||
      `<button class="mb" type="button" data-all aria-pressed="true">전체</button>`) +
    (gl.length
      ? btn("data-gb", "장르", openG === GENRE, any("g") || any("s"))
      : "") +
    mgroups
      .map(({ g, ms }) =>
        btn(
          `data-g="${esc(g)}"`,
          esc(g),
          g === openG,
          ms.some((m) => has("m", m)),
        ),
      )
      .join("") +
    (years.length ? btn("data-b", "★ 최애곡", openG === BEST, any("b")) : "");
  const o = mgroups.find((x) => x.g === openG),
    yo = openG === BEST,
    go = openG === GENRE;
  $("mpanel").hidden = !o && !yo && !go;
  $("mpanel").setAttribute(
    "aria-label",
    go ? "장르" : yo ? "최애곡 연도" : o ? `${openG} 무드` : "무드",
  );
  const chip = (k, v, text, cls = "chip") =>
    `<button class="${cls}" type="button" data-k="${k}" data-v="${esc(v)}" aria-pressed="${has(k, v)}">${text}</button>`;
  $("mpanel").innerHTML = go
    ? gl
        .map(({ name, color }) =>
          chip("g", name, dot(color) + esc(name), "chip gn"),
        )
        .join("") +
      (sl.length
        ? `<span class="sep" role="separator"></span>` +
          sl.map(({ name }) => chip("s", name, esc(name))).join("")
        : "")
    : yo
      ? years.map((y) => chip("b", y, `★ ${y}`)).join("")
      : o
        ? o.ms.map((m) => chip("m", m, `#${esc(m)}`)).join("")
        : "";
  if (sel)
    (
      box.map((b) => b.querySelector(sel)).find(Boolean) ||
      $("moods").firstElementChild
    )?.focus();
}
export const controls = () => ({
  q: $("q").value,
  sort: $("sort").value,
  genres: vals("g"),
  subs: vals("s"),
  moods: vals("m"),
  bests: vals("b"),
});
const narrow = matchMedia("(width <= 56.25em)");
// 좁은 화면에서 접어 둔 고른 태그 수와 기본이 아닌 정렬(1)을 필터 버튼에 붙인다
const fcount = () => {
  const n = picks.length + ($("sort").value !== "recent");
  $("fbtn").textContent = n ? `필터 ${n}` : "필터";
};

/* 가상 스크롤: 보이는 행 ± BUF만 DOM에 둔다. 빠진 행의 높이는 .wheel의 ::before/::after(--pt, --pb)가 채운다.
   .wheel li:nth-child(4n+…) 들여쓰기가 어긋나지 않도록 창의 시작(lo)은 항상 4의 배수. */
const BUF = 12;
let rows = [],
  lo = 0,
  hi = 0,
  curIdx = -1,
  pitch = 62.5; // pitch: 행 높이 + 행 사이 여백. 그린 뒤 실제 값으로 다시 잰다

const rowHtml = (t, i) =>
  `<li><button class="rb" data-i="${i}" aria-current="${i === curIdx}"><span class="sw" style="${swatch(t)}"></span><span><span class="rt">${esc(t.title)}${t.comment ? '<span class="dot" aria-label="코멘트 있음">★</span>' : ""}</span><span class="ra">${esc(t.artist)}${t.album ? " · " + esc(t.album) : ""}</span></span><span class="rg">${esc(t.genres[0] || "")}</span></button></li>`;
const rowEl = (i) =>
  i >= lo && i < hi ? $("wheel").children[i - lo]?.firstElementChild : null;

function pad(w, top, bottom) {
  w.style.setProperty("--pt", top + "px");
  w.style.setProperty("--pb", bottom + "px");
}

function draw() {
  const w = $("wheel"),
    n = rows.length;
  // 필터를 연 동안 목록은 숨는다(list.css). 숨은 채 그리면 행 높이를 0으로 재서 pitch가 틀어진다. 다시 보이면 ResizeObserver가 그린다
  if (!n || !w.clientHeight) return;
  const a = Math.max(0, Math.floor((w.scrollTop - 6) / pitch)),
    b = Math.min(n, Math.ceil((w.scrollTop + w.clientHeight) / pitch));
  if (hi > lo && a >= lo && b <= hi) return;
  lo = Math.max(0, (a - BUF) & ~3);
  hi = Math.min(n, b + BUF);
  const fi = w.contains(document.activeElement)
    ? document.activeElement.closest(".rb")?.dataset.i
    : null;
  pad(w, lo * pitch, (n - hi) * pitch);
  w.innerHTML = rows
    .slice(lo, hi)
    .map((t, k) => rowHtml(t, lo + k))
    .join("");
  if (fi != null) rowEl(+fi)?.focus({ preventScroll: true });
  // 선택 행은 글자가 커서 조금 더 높다
  const li = [...w.children].find(
    (x) => x.firstElementChild.getAttribute("aria-current") !== "true",
  );
  if (!li) return;
  const p =
    li.getBoundingClientRect().height +
    parseFloat(getComputedStyle(li).marginTop);
  if (Math.abs(p - pitch) > 0.25) {
    pitch = p;
    lo = hi = 0;
    draw();
  }
}

function jumpIndex(view) {
  const f = { artist: "artist", title: "title", recent: "added" }[
      $("sort").value
    ],
    g = f ? groups(view, f) : [];
  $("jump").hidden = !g.length;
  $("jump").classList.toggle("yr", f === "added");
  $("jump").setAttribute(
    "aria-label",
    f === "added" ? "추가한 연도로 건너뛰기" : "초성·알파벳으로 건너뛰기",
  );
  $("jump").innerHTML = g
    .map(
      ({ key, index }) =>
        `<button type="button" data-i="${index}" aria-label="${esc(key)} 묶음의 첫 곡으로">${esc(key)}</button>`,
    )
    .join("");
}

/* 좁은 화면에서 목록을 직접 내렸거나 필터를 연 동안 무대를 띠로 접는다(stage.css의 .fold). 목록을 맨 위로 올리면 편다.
   - 코드가 옮긴 스크롤(곡 고르기·PREV·NEXT·RANDOM, 처음 무작위 곡)로는 접지도 펴지도 않는다. 접으면 고른 곡이 무대에서 작아지고, 펴면 누른 행이 밀린다
   - 접어서 목록이 다 들어가면 스크롤이 0으로 당겨진다. 그때 펴면 다시 접고 펴기를 되풀이하므로, 스크롤할 게 남아 있을 때만 편다
   - 방송 영상이 모니터에 있을 때(.screen.live) 필터를 열면 접지 않는다. 접으면 영상이 아래 도크로 내려가 필터 자리를 먹는다. 대신 제목 줄과 방송 바를 숨긴다(stage.css) */
let down = false,
  auto = 0; // 코드가 마지막으로 옮긴 스크롤 위치. 그 위치로 오는 scroll 이벤트 한 번을 빼고 나면 지운다
// 가로로 눕힌 휴대폰은 무대와 목록이 두 열이라(stage.css) 접어도 목록이 늘지 않는다
const flat = matchMedia("(orientation: landscape) and (height <= 33.75em)");
const fold = () =>
  $("stage").classList.toggle(
    "fold",
    !flat.matches &&
      (down ||
        ($("fbtn").getAttribute("aria-expanded") === "true" &&
          !$("screen").classList.contains("live"))),
  );
flat.addEventListener("change", fold);
function onScroll() {
  const w = $("wheel"),
    y = w.scrollTop,
    byCode = y === auto;
  auto = NaN;
  if (!byCode && y > 0) down = true;
  else if (!byCode && w.scrollHeight > w.clientHeight) down = false;
  fold();
  draw();
}

export function renderList(view) {
  const w = $("wheel");
  $("cnt").textContent = `${fmt(view.length)}곡`;
  rows = view;
  curIdx = -1;
  lo = hi = 0;
  w.scrollTop = auto = 0; // 조건이 바뀌면 목록은 맨 위부터 보인다(사용자 결정). 고르던 곡이 남아 있어도 그 행으로 옮기지 않는다(main.js의 filter)
  down = false;
  fold();
  jumpIndex(view);
  if (!view.length) {
    pad(w, 0, 0);
    w.innerHTML = `<li class="none">조건에 맞는 곡이 없어요</li>`;
    return;
  }
  pad(w, 0, view.length * pitch);
  w.innerHTML = "";
  draw();
}

export function markRow(sel, scroll) {
  const w = $("wheel"),
    prev = curIdx;
  curIdx = sel;
  if (scroll && (sel < lo || sel >= hi)) {
    w.scrollTop = sel * pitch - (w.clientHeight - pitch) / 2;
    draw();
  }
  rowEl(prev)?.setAttribute("aria-current", "false");
  const b = rowEl(sel);
  b?.setAttribute("aria-current", "true");
  if (!scroll) return;
  b?.scrollIntoView({ block: "nearest" });
  auto = w.scrollTop;
}

/* 검색어와 고른 태그를 모두 푼다(정렬은 그대로). 목록을 다시 거르는 건 부른 쪽이 한다 */
export function resetFilters() {
  $("q").value = "";
  picks = [];
  openG = "";
  moodsUi();
  fcount();
}

export function showLoadError() {
  $("wheel").innerHTML = `<li class="none">곡 목록을 불러오지 못했어요</li>`;
}

/* st: main.js가 가진 선택 상태 {view, sel}. onFilter(keep)는 조건이 바뀔 때, onPick(i)는 행을 고를 때 */
export function initList(data, vocab, st, { onFilter, onPick }) {
  readouts(data);
  options(data, vocab);
  // 좁은 화면에서 검색 중(키보드가 떠 있음)이면 행을 눌러도 포커스를 옮기지 않는다. 옮기면 접혀 있던 무대가 click 전에 펼쳐져 행이 밀린다(stage.css)
  $("wheel").addEventListener("mousedown", (e) => {
    if (narrow.matches && document.activeElement === $("q")) e.preventDefault();
  });
  $("wheel").addEventListener("click", (e) => {
    const b = e.target.closest(".rb");
    if (!b) return;
    if (narrow.matches) $("q").blur();
    onPick(+b.dataset.i);
  });
  $("fbtn").addEventListener("click", () => {
    const f = $("fbtn"),
      o = f.getAttribute("aria-expanded") !== "true";
    f.setAttribute("aria-expanded", o);
    f.closest(".flt").classList.toggle("open", o);
    // 숨어 있던 목록은 맨 위부터 다시 보인다(숨는 동안 조건이 바뀌었으면 renderList의 맨 위가 숨은 목록엔 먹지 않는다)
    if (!o) $("wheel").scrollTop = auto = 0;
    down = false;
    fold();
  });
  $("wheel").addEventListener("scroll", onScroll, { passive: true });
  // 이미 맨 위면 더 끌어내려도 scroll 이벤트가 나지 않는다. 끌어내리는 손가락·휠로 편다
  let ty = 0;
  const unfold = () => {
    if (down && $("wheel").scrollTop <= 0) {
      down = false;
      fold();
    }
  };
  $("wheel").addEventListener(
    "touchstart",
    (e) => (ty = e.touches[0].clientY),
    { passive: true },
  );
  $("wheel").addEventListener(
    "touchmove",
    (e) => e.touches[0].clientY - ty > 30 && unfold(),
    { passive: true },
  );
  $("wheel").addEventListener("wheel", (e) => e.deltaY < 0 && unfold(), {
    passive: true,
  });
  // 색인은 곡을 고르지 않는다(고르면 무대가 바뀌고 재생이 멈춘다). 그 행으로 옮기고 포커스만 준다. Enter가 행의 click이 된다
  $("jump").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const i = +b.dataset.i;
    $("wheel").scrollTop = i * pitch - 6;
    draw();
    rowEl(i)?.focus({ preventScroll: true });
  });
  // 색인은 목록 스크롤 영역과 같은 높이에 둔다(검색창 줄이 접히면 목록 위치가 바뀐다). 목록이 커지거나(무대가 접힘) 다시 보이면 행을 더 그린다
  new ResizeObserver(() => {
    $("jump").style.top = $("wheel").offsetTop + 14 + "px";
    draw();
  }).observe($("wheel"));
  const pickMood = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.g != null || b.dataset.b != null || b.dataset.gb != null) {
      const g = b.dataset.g ?? (b.dataset.b != null ? BEST : GENRE);
      openG = openG === g ? "" : g;
      moodsUi();
      return;
    }
    const [k, v] =
      b.dataset.x != null
        ? [b.dataset.x[0], b.dataset.x.slice(2)]
        : [b.dataset.k, b.dataset.v];
    if (!k) return; // 전체 버튼
    toggle(k, v); // 고른 칩을 다시 누르거나 ✕를 누르면 푼다
    moodsUi();
    fcount();
    onFilter(true);
  };
  $("moods").addEventListener("click", pickMood);
  $("mpanel").addEventListener("click", pickMood);
  // 정렬은 곡을 빼지 않아 keep이면 선택이 늘 그대로라, 바뀐 순서를 첫 곡부터 보여 준다(사용자 결정)
  $("sort").addEventListener("change", () => {
    fcount();
    onFilter(false);
  });
  $("q").addEventListener("input", () => onFilter(false));
  $("dice").addEventListener("click", () => {
    if (st.view.length > 1) {
      let n;
      do n = Math.floor(Math.random() * st.view.length);
      while (n === st.sel);
      onPick(n);
    }
  });
}
