import { $, esc, calm } from "./util.js";
import { hash, tone, genCover } from "./cover.js";
import { clean, fitTitle, pickBoxes } from "./title.js";
import { COUNT, shape, blank, dotsSvg, PITCH } from "./halftone.js";
import { dur } from "./data.js";

const TAGMAX = 8,
  FONT = '"Gasoek One","Dela Gothic One"',
  wide = matchMedia("(min-width: 901px)");
const date = (s) =>
  !s
    ? ""
    : s.length >= 10
      ? s.slice(0, 10).replace(/-/g, ".")
      : s.length === 7
        ? s.replace("-", ".")
        : s;
const ctx = document.createElement("canvas").getContext("2d");
const measure = (s) => {
  ctx.font = `100px ${FONT}`;
  return ctx.measureText(s).width / 100;
};
let shown = null,
  allTags = false,
  raf = 0;

/* 제목: 줄과 크기는 title.js가 정하고 여기선 그리기만 한다. 높이는 무대 칸이 정한다(좁은 화면은 두 줄 높이의 띠) */
function drawTitle(t) {
  const el = $("ttl"),
    text = clean(t.title) || "제목 없음",
    boxes = pickBoxes(text, hash(t.artist + "|" + text));
  const width = el.clientWidth,
    height = el.clientHeight,
    min = wide.matches ? 28 : 18;
  const maxLines = !wide.matches ? 2 : $("mon").hidden ? 4 : 3;
  const r = fitTitle(text, {
    width,
    height,
    measure,
    max: Math.min(height / 1.02, 240),
    min,
    maxLines,
    boxes,
  });
  el.style.setProperty("--fs", r.size + "px");
  el.innerHTML = r.lines
    .map((l) => {
      let s = "",
        j = 0;
      for (const c of l.text) {
        s +=
          boxes.includes(l.a + j) && text[l.a + j] === c
            ? `<span class="bx">${esc(c)}</span>`
            : esc(c);
        j += c.length;
      }
      return `<span class="ln">${s}</span>`;
    })
    .join("");
  el.title = r.clipped ? text : "";
  cancelAnimationFrame(koRaf);
  koRaf = requestAnimationFrame(() => knockout(el, r.size)); // 칠하기 직전에 잰다. 여기서 재면 곡 고르기마다 레이아웃을 한 번 더 강제한다
}
/* 망점 판에서 제목 글자 자리를 뚫는다(stage.css의 .ht mask의 --ko). 경계는 점 격자(16px)에 맞춰 점이 반쪽으로 잘리지 않게 한다.
   줄 상자로 계산하면 틀린다: Gasoek은 획이 줄 상자 밖으로 나오고, 상자 글자(.bx, inline-block)가 든 줄은 상자가 더 높다.
   그래서 글자 조각마다 실제 위치(Range)를 읽고 세로는 잉크 범위(기준선 ± canvas actualBoundingBox)로 잡는다.
   줄(.ln) 안에서의 상대 위치만 Range로 읽고 줄 자리는 offset(변형 전)으로 잡는다 */
let koRaf = 0;
function knockout(el, fs) {
  const rg = document.createRange(),
    k = fs / 100;
  let x0 = 1 / 0,
    x1 = -1 / 0,
    y0 = 1 / 0,
    y1 = -1 / 0,
    n;
  ctx.font = `100px ${FONT}`;
  for (const ln of el.children) {
    const lr = ln.getBoundingClientRect(),
      ox = el.offsetLeft + ln.offsetLeft - lr.left,
      oy = el.offsetTop + ln.offsetTop - lr.top,
      w = document.createTreeWalker(ln, NodeFilter.SHOW_TEXT);
    while ((n = w.nextNode())) {
      rg.selectNodeContents(n);
      const q = rg.getBoundingClientRect(),
        m = ctx.measureText(n.data),
        base = oy + q.top + m.fontBoundingBoxAscent * k;
      x0 = Math.min(x0, ox + q.left);
      x1 = Math.max(x1, ox + q.right);
      y0 = Math.min(y0, base - m.actualBoundingBoxAscent * k);
      y1 = Math.max(y1, base + m.actualBoundingBoxDescent * k);
    }
  }
  if (x0 > x1) return $("stage").style.removeProperty("--ko");
  const g = (v) => Math.floor(v / PITCH) * PITCH,
    G = (v) => Math.ceil(v / PITCH) * PITCH,
    p = 0.05 * fs;
  x0 = g(x0 - p);
  y0 = g(y0 - p);
  x1 = G(x1 + p);
  y1 = G(y1 + p);
  $("stage").style.setProperty(
    "--ko",
    `${x0}px ${y0}px/${x1 - x0}px ${y1 - y0}px`,
  );
}
function memoFit() {
  const m = $("memo"),
    p = $("memoP");
  m.classList.remove("over");
  if (!m.hidden)
    m.classList.toggle("over", p.scrollHeight > p.clientHeight + 1);
}
function refit() {
  if (shown) {
    drawTitle(shown);
    memoFit();
  }
}

/* 망점: 판 한 장(#ht). 조합마다 SVG를 무대 크기로 한 번 만들어 mask 이미지 URL로 두고, 곡을 고를 땐 URL만 바꿔 끼운다.
   곡 사이의 전환은 swap의 View Transition이 무대 전체와 함께 한 획으로 넘긴다 */
const BLANK_PLATE = COUNT; // 결과 없음 화면의 판 번호. 조합 번호(0..COUNT-1)와 겹치지 않는다
// 장르는 이미 장면색을 정하므로 조합은 곡 ID로. "ht|"는 재킷 무늬(cover.js) 해시와 따로 놀게 한다
const shapeOf = (t) => hash("ht|" + (t.id || t.title + "|" + t.artist)) % COUNT;
const idle = window.requestIdleCallback || ((f) => setTimeout(f, 50)); // Safari엔 requestIdleCallback이 없다
let ht = null,
  curShape = -1,
  size = "",
  set = null;
/* 배치(무대 크기 + 영상 없음 "n" / 결과 없음 "e") → {k, w, h, lp, floor, urls}. 영상이 없으면 재킷이 커져 조각 자리가 달라지므로 따로 둔다.
   좁은 화면은 영상 유무·검색 키보드로 무대 높이가 곡마다 오가서 배치가 여러 벌 생긴다 */
const sets = new Map();
/* 조각을 맞출 자리를 잰다. 레이아웃을 강제하므로 배치마다 한 번만 부른다 */
function frame(k) {
  const s = $("stage"),
    b = s.getBoundingClientRect(),
    j = document.querySelector(".jwrap").getBoundingClientRect(),
    i = $("info").getBoundingClientRect();
  return {
    k,
    w: s.clientWidth,
    h: s.clientHeight,
    // LP 중심. stage.css의 .vinyl(right:0; top:4%; height:94%)에서 나온 값이다
    lp: j.width
      ? {
          x: j.right - b.left - 0.47 * j.height,
          y: j.top - b.top + 0.51 * j.height,
          jh: j.height,
        }
      : null,
    floor: wide.matches && i.height ? i.top - b.top : null, // 좁은 화면에선 정보가 시트 안에 있어 구석 조각을 찍지 않는다
    urls: [],
  };
}
// blob URL로 둔다. 100KB 넘는 data URL을 CSS 변수에 넣으면 곡을 고를 때마다 스타일 계산이 그 문자열을 다시 읽어 곡 고르기가 3ms 남짓 늘었다
function shapeUrl(v, s = set) {
  if (!s.urls[v]) {
    const r = v === BLANK_PLATE ? blank(s.w, s.h) : shape(v, s.w, s.h, s);
    s.urls[v] =
      `url(${URL.createObjectURL(new Blob([dotsSvg(s.w, s.h, r)], { type: "image/svg+xml" }))})`;
  }
  return s.urls[v];
}
/* 지금 배치의 판 묶음을 고른다. 바뀌었으면 true. 영상 유무는 player.js가 먼저 정해 둔다(main.js의 pick 순서) */
function useSet() {
  const k =
    size +
    ($("stage").classList.contains("empty") ? "e" : $("mon").hidden ? "n" : "");
  if (set?.k === k) return false;
  if (!sets.has(k)) {
    if (sets.size > 8) {
      for (const s of sets.values())
        s.urls.forEach((x) => URL.revokeObjectURL(x.slice(4, -1)));
      sets.clear();
    }
    sets.set(k, frame(k));
  }
  const s = (set = sets.get(k));
  // 나머지 조합은 쉴 때 미리 만든다. 곡을 고를 때 처음 만들면 그 한 번이 SVG 문자열 만드는 만큼 늦어진다
  let v = 0;
  const warm = () => {
    if (s !== set || k.endsWith("e")) return;
    while (s.urls[v]) v++;
    if (v < COUNT) {
      shapeUrl(v, s);
      idle(warm);
    }
  };
  idle(warm);
  return true;
}
function sizeDots() {
  const s = $("stage");
  if (!s.clientWidth) return;
  size = s.clientWidth + "x" + s.clientHeight;
  if (useSet() && curShape >= 0)
    ht.style.setProperty("--dots", shapeUrl(curShape));
}
function swapDots(v) {
  if (!size) sizeDots();
  const moved = useSet(); // 영상 있는 곡과 없는 곡은 같은 조합이라도 조각 자리가 다르다
  if (v === curShape && !moved) return;
  curShape = v;
  ht.style.setProperty("--dots", shapeUrl(v));
  ht.hidden = false;
}

/* 곡 사이의 전환: '/' 사선 경계가 왼쪽에서 오른쪽으로 지나가며 경계 왼쪽은 새 곡, 오른쪽은 옛 곡을 보인다.
   무대(.stage)는 범위 지정 View Transition으로 옛 그림과 새 그림(살아 있는 그림)을 나눠 자르고, 무대 밖 장면색은 #wipe(옛 색)로 같은 경계를 쓸어낸다.
   - 문서 전체 전환(document.startViewTransition)은 쓰지 않는다. 전환 동안 모든 클릭·휠이 <html>로 가서 목록이 먹지 않는다(::view-transition에 pointer-events:none을 줘도 같다)
   - 옛 그림은 다음 프레임에 찍히므로 무대를 바꾸는 DOM 변경(플레이어 포함)은 전부 fn 안에 둬야 한다. 밖에서 먼저 바꾸면 옛 그림에 새 상태가 찍힌다 */
const SWEEP = { duration: 420, easing: "cubic-bezier(.7,0,.2,1)" },
  QUICK = 150; // ms. 이보다 빨리 연달아 고르면 새 획을 시작하지 않는다
let vt = null,
  pending = false,
  lastSwap = -Infinity;
/* next: 새로 보일 곡(결과 없음 화면이면 null). 지금 보이는 곡과 같으면(정렬·필터로 같은 곡이 다시 골라짐) 획 없이 그린다 */
export function swap(fn, next) {
  const quick = performance.now() - lastSwap < QUICK,
    st = $("stage");
  lastSwap = performance.now();
  // 앞 획이 옛 그림을 찍기 전이면 그 fn 뒤에 잇는다. 먼저 돌면 옛 그림에 새 상태가 찍히고 순서도 뒤집힌다
  if (pending) return void vt.updateCallbackDone.finally(fn);
  // quick: 키를 누르고 있을 때처럼 연달아 고르면 새 획 없이 바꾼다(진행 중인 획이 있으면 그 새 그림이 따라 바뀐다). 획마다 옛 그림을 찍느라 프레임이 하나씩 빠진다.
  // 좁은 화면의 정보 시트(.open, position:fixed)는 무대 그림 밖으로 나가 있어 열려 있으면 그냥 바꾼다
  if (quick || next === shown || calm || st.classList.contains("open"))
    return fn();
  // 범위 지정 View Transition(Element.startViewTransition)이 없는 브라우저: 무대는 바로 바뀌고 장면색만 같은 획으로 쓸어낸다
  if (!st.startViewTransition) {
    const was = getComputedStyle(document.documentElement).getPropertyValue(
      "--c",
    );
    fn();
    return void sweep(null, was);
  }
  let old;
  pending = true;
  const v = (vt = st.startViewTransition(() => {
    pending = false;
    old = getComputedStyle(document.documentElement).getPropertyValue("--c");
    fn();
  }));
  v.ready.then(
    () => {
      if (v !== vt) return;
      const anims = sweep(st, old);
      // fill:forwards라 끝난 뒤에도 남는다. 전환이 끝나면 지운다(먼저 지우면 끝 프레임에 옛 그림이 통째로 비친다)
      v.finished.then(() => anims.forEach((x) => x.cancel()));
    },
    () => {},
  );
}
/* 경계는 화면 좌표로 위 끝 x = p, 아래 끝 x = p - 장면 높이/2(좁은 화면에서도 같은 각도). p가 0에서 끝까지 간다.
   요소 b(무대, 장면)마다 자기 좌표로 옮겨 경계 왼쪽(left) 또는 오른쪽 다각형을 만든다 */
function sweep(st, old) {
  const a = document.querySelector(".scene").getBoundingClientRect(),
    end = a.width + a.height / 2,
    far = 1e4;
  const poly = (b, p, left) => {
    const ox = b.left - a.left,
      oy = b.top - a.top,
      t = p - oy / 2 - ox,
      u = p - (oy + b.height) / 2 - ox;
    return {
      clipPath: left
        ? `polygon(${-far}px 0,${t}px 0,${u}px 100%,${-far}px 100%)`
        : `polygon(${t}px 0,${far}px 0,${far}px 100%,${u}px 100%)`,
    };
  };
  const run = (el, left, pseudoElement) => {
    const b = el.getBoundingClientRect();
    return el.animate([poly(b, 0, left), poly(b, end, left)], {
      ...SWEEP,
      pseudoElement,
      fill: "forwards",
    });
  };
  // st가 없으면(View Transition 없이 부른 경우) 장면색만 쓸어낸다
  const anims = st
    ? [
        run(st, true, "::view-transition-new(root)"),
        run(st, false, "::view-transition-old(root)"),
      ]
    : [];
  // 장면색이 같으면 쓸지 않는다. #wipe가 장르 글자를 덮으므로 쓸면 같은 색에서 글자만 사라졌다 다시 나온다
  const w = $("wipe"),
    same =
      old ===
      getComputedStyle(document.documentElement).getPropertyValue("--c");
  for (const x of w.getAnimations()) x.cancel();
  w.style.background = same ? "" : old;
  if (!same)
    run(w, false).onfinish = () => {
      w.style.background = ""; // 다각형이 px라 끝난 뒤 창이 넓어지면 옛 색이 드러난다
    };
  return anims;
}

function paint(tn) {
  const r = document.documentElement.style;
  r.setProperty("--c", tn.c);
  r.setProperty("--ci", tn.i);
  r.setProperty("--cp", tn.p);
}
function tagsHtml(t) {
  const all = [
    ...t.genres.map((g) => [g, "g"]),
    ...t.sub.map((x) => [x, "s"]),
    ...t.moods.map((m) => [m, ""]),
  ];
  const bests = t.best
    .map((y) => `<span class="best">★ ${y} 최애곡</span>`)
    .join(""); // TAGMAX에 세지 않는다
  if (!all.length) return bests + `<span class="notag">NO TAG</span>`;
  const show = allTags ? all : all.slice(0, TAGMAX),
    rest = all.length - show.length;
  return (
    bests +
    show
      .map(([v, c]) => `<span class="tag ${c}">${c ? "" : "#"}${esc(v)}</span>`)
      .join("") +
    (rest > 0
      ? `<button class="more" id="more">+${rest}</button>`
      : all.length > TAGMAX
        ? `<button class="more" id="more">접기</button>`
        : "")
  );
}
function cover(t, tn) {
  const box = $("cov");
  box.innerHTML = genCover(t, tn);
  if (t.cover) {
    const im = new Image();
    im.alt = t.album || t.title;
    im.onload = () => {
      if (shown === t) {
        box.innerHTML = "";
        box.append(im);
      }
    };
    im.src = t.cover;
  }
}

export function initStage() {
  ht = $("ht");
  $("tags").addEventListener("click", (e) => {
    if (e.target.id === "more") {
      allTags = !allTags;
      $("tags").innerHTML = tagsHtml(shown);
    }
  });
  const note = $("note");
  $("memo").addEventListener("click", () => {
    if (!$("memo").classList.contains("over")) return;
    $("noteP").textContent = shown.comment;
    note.showModal();
  });
  // 바깥(::backdrop)이나 닫기. Esc는 dialog가 처리
  note.addEventListener("click", (e) => {
    if (e.target === note || e.target.id === "noteX") note.close();
  });
  addEventListener("resize", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(refit);
  });
  // 좁은 화면: INFO가 정보·코멘트 시트를 연다. 시트는 무대 아래 끝부터 덮으므로 그 위치를 따라간다
  const stage = $("stage"),
    tog = $("tog"),
    open = (v) => {
      stage.classList.toggle("open", v);
      tog.setAttribute("aria-expanded", v);
    };
  tog.addEventListener("click", () => open(!stage.classList.contains("open")));
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && stage.classList.contains("open") && !note.open)
      open(false);
  });
  const top = () =>
    document.documentElement.style.setProperty(
      "--sheet-top",
      stage.getBoundingClientRect().bottom + "px",
    );
  const ro = new ResizeObserver(() => {
    top();
    sizeDots();
  });
  ro.observe(stage);
  ro.observe(document.querySelector(".bar"));
}

// 같은 글을 짝수 번 이어 붙여야 -50% 이동이 이음매 없이 돈다. 글자 수를 40자쯤으로 맞춰 흐르는 속도를 고르게 한다
const giant = (w) => {
  const g = w + " ";
  $("giant").textContent = g.repeat(2 * Math.ceil(20 / [...g].length));
};

/* 곡이 없을 때의 무대. none: 검색·필터 결과 없음, error: 곡 목록을 못 불러옴. 버튼 동작은 main.js가 #blankB에 단다 */
const BLANK = {
  none: [
    "NO<br>SIGNAL",
    "조건에 맞는 곡이 없어요",
    "검색어를 줄이거나 장르 · 무드 · 최애곡 조건을 풀어 보세요",
    "조건 모두 지우기",
    "no signal",
  ],
  error: [
    "OFF<br>AIR",
    "곡 목록을 불러오지 못했어요",
    "네트워크를 확인하고 다시 불러와 보세요",
    "다시 불러오기",
    "off air",
  ],
};
export function clearStage(kind = "none") {
  const [h, p, s, b, g] = BLANK[kind];
  shown = null;
  if ($("note").open) $("note").close();
  $("blankH").innerHTML = h;
  $("blankP").textContent = p;
  $("blankS").textContent = s;
  $("blankB").textContent = b;
  giant(g);
  const st = $("stage");
  st.classList.add("empty");
  st.classList.remove("open");
  $("tog").setAttribute("aria-expanded", false);
  cancelAnimationFrame(koRaf);
  st.style.removeProperty("--ko");
  swapDots(BLANK_PLATE);
}

export function showStage(t) {
  const again = t === shown;
  shown = t;
  allTags = false;
  $("stage").classList.remove("empty");
  if ($("note").open) $("note").close();
  const tn = tone(t);
  paint(tn);
  swapDots(shapeOf(t));
  cover(t, tn);
  giant(t.genres[0] || "radio");
  $("edge").textContent = [date(t.released) || "----", "KIM'S RADIO CLUB"].join(
    " ★ ",
  );
  $("ttl").setAttribute("aria-label", clean(t.title) || "제목 없음");
  $("who").textContent = t.artist || "";
  // ARTIST·ALBUM은 넓은 화면에서 한 줄을 다 쓰고(w), 나머지는 나란히 놓는다(줄 나눔은 stage.css가 정보 칸 폭으로 정한다). LENGTH·ADDED는 값이 없으면 뺀다
  const len = dur(t.len),
    rows = [
      ["ARTIST", t.artist, "w"],
      ["ALBUM", t.album, "w"],
      ["RELEASE", date(t.released), "d"],
      ...(len ? [["LENGTH", len, "d"]] : []),
      ...(t.added ? [["ADDED", date(t.added), "d"]] : []),
    ];
  $("spec").innerHTML = rows
    .map(
      ([k, v, c]) =>
        `<dt class="${k.toLowerCase()}">${k}</dt><dd class="${c}"${v ? ` title="${esc(v)}"` : ""}>${v ? esc(v) : "정보 없음"}</dd>`,
    )
    .join("");
  $("sp").hidden = !t.id;
  if (t.id)
    $("sp").href = `https://open.spotify.com/track/${encodeURIComponent(t.id)}`;
  $("tags").innerHTML = tagsHtml(t);
  $("memoP").textContent = t.comment;
  $("memo").hidden = !t.comment;
  drawTitle(t);
  memoFit();
  // 글꼴이 늦게 오면 폭이 바뀐다
  document.fonts.load(`100px ${FONT}`, t.title || "제목 없음").then(() => {
    if (shown === t) refit();
  });
  // 등장은 재킷만. 제목·정보·모니터까지 움직이면 획이 드러내는 자리에 반투명한 중간 상태가 비친다
  if (!calm && !again) {
    $("cov").animate(
      [
        {
          transform: "translate(-70px,30px) rotate(-20deg) scale(1.15)",
          opacity: 0,
        },
        {
          transform: "translate(4px,-3px) rotate(-4deg)",
          opacity: 1,
          offset: 0.7,
        },
        { transform: "rotate(-5deg)" },
      ],
      { duration: 440, easing: "cubic-bezier(.2,.9,.3,1)" },
    );
  }
}
