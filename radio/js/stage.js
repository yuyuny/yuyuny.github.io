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
   줄(.ln)은 등장 애니메이션으로 translate 중일 수 있으니 줄 안에서의 상대 위치만 Range로 읽고 줄 자리는 offset(변형 전)으로 잡는다 */
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

/* 망점: 판 두 장(#htA·#htB)을 번갈아 쓴다. 조합마다 SVG를 무대 크기로 한 번 만들어 mask 이미지 URL로 두고, 곡을 고를 땐 URL만 바꿔 끼운다.
   나가는 판은 #wipe와 같은 다각형·시간·곡선으로 쓸려 나가 장면색 쓸어내기와 한 획으로 보인다 */
const SWEEP = { duration: 420, easing: "cubic-bezier(.7,0,.2,1)" },
  BLANK_PLATE = COUNT; // 결과 없음 화면의 판 번호. 조합 번호(0..COUNT-1)와 겹치지 않는다
// 장르는 이미 장면색을 정하므로 조합은 곡 ID로. "ht|"는 재킷 무늬(cover.js) 해시와 따로 놀게 한다
const shapeOf = (t) => hash("ht|" + (t.id || t.title + "|" + t.artist)) % COUNT;
const idle = window.requestIdleCallback || ((f) => setTimeout(f, 50)); // Safari엔 requestIdleCallback이 없다
let ht = [],
  front = 0,
  curShape = -1,
  size = "",
  set = null,
  sweepBox = [0, 0, 0, 0];
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
  // #wipe는 화면 전체(.scene) 기준 다각형이다. 판이 같은 가장자리로 쓸려 가도록 장면 크기와 무대 위치를 무대 좌표로 둔다
  const a = document.querySelector(".scene").getBoundingClientRect(),
    b = s.getBoundingClientRect();
  sweepBox = [a.left - b.left, a.top - b.top, a.width, a.height];
  if (!s.clientWidth) return;
  size = s.clientWidth + "x" + s.clientHeight;
  if (useSet() && curShape >= 0)
    ht[front].style.setProperty("--dots", shapeUrl(curShape));
}
/* oldCp: 장면색이 바뀌면 나가는 판을 이전 둘째 잉크로 칠해 둔다(바뀌지 않으면 "") */
function swapDots(v, oldCp) {
  if (!size) sizeDots();
  const moved = useSet(); // 영상 있는 곡과 없는 곡은 같은 조합이라도 조각 자리가 다르다
  if (v === curShape && !oldCp && !moved) return;
  const first = curShape < 0,
    out = ht[front];
  curShape = v;
  front ^= 1;
  const inn = ht[front];
  for (const e of ht) for (const a of e.getAnimations()) a.cancel();
  inn.style.background = "";
  inn.style.setProperty("--dots", shapeUrl(v));
  inn.hidden = false;
  out.before(inn); // 나가는 판이 위
  if (calm || first) {
    out.hidden = true;
    return;
  }
  out.style.background = oldCp;
  const [x, y, W, H] = sweepBox,
    P = (pts) =>
      `polygon(${pts.map(([u, v]) => `${x + u * W}px ${y + v * H}px`)})`; // showStage의 #wipe와 같은 점
  out.animate(
    [
      {
        clipPath: P([
          [0, 0],
          [1.3, 0],
          [1, 1],
          [0, 1],
        ]),
      },
      {
        clipPath: P([
          [1.2, 0],
          [1.3, 0],
          [1, 1],
          [0.9, 1],
        ]),
      },
    ],
    { ...SWEEP, fill: "forwards" },
  ).onfinish = () => {
    if (out === ht[front]) return; // finish 이벤트는 늦게 온다. 그사이 곡을 또 바꿔 이 판이 들어오는 판이 됐으면 그대로 둔다
    out.hidden = true;
    out.style.background = "";
    for (const a of out.getAnimations()) a.cancel();
  };
  inn.animate([{ translate: "-10px 6px" }, { translate: "0 0" }], SWEEP); // 판이 어긋나 찍혔다가 맞는다
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
  ht = [$("htA"), $("htB")];
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
  swapDots(BLANK_PLATE, "");
}

export function showStage(t) {
  shown = t;
  allTags = false;
  $("stage").classList.remove("empty");
  if ($("note").open) $("note").close();
  const tn = tone(t),
    oldCp = document.documentElement.style.getPropertyValue("--cp"),
    old = getComputedStyle(document.documentElement)
      .getPropertyValue("--c")
      .trim();
  if (!calm && old && old !== tn.c) {
    const w = $("wipe");
    w.style.background = old;
    paint(tn);
    w.animate(
      [
        { clipPath: "polygon(0 0,130% 0,100% 100%,0 100%)" },
        { clipPath: "polygon(120% 0,130% 0,100% 100%,90% 100%)" },
      ],
      { duration: 420, easing: "cubic-bezier(.7,0,.2,1)", fill: "forwards" },
    ).onfinish = () => {
      w.style.background = "transparent";
    };
  } else paint(tn);
  swapDots(shapeOf(t), oldCp && oldCp !== tn.p ? oldCp : "");
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
  if (!calm) {
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
    $("ttl")
      .querySelectorAll(".ln")
      .forEach((l, j) =>
        l.animate(
          [
            { transform: "translateY(.4em)", clipPath: "inset(0 0 100% 0)" },
            { transform: "none", clipPath: "inset(0 0 -20% 0)" },
          ],
          {
            duration: 280,
            delay: 40 + j * 60,
            easing: "cubic-bezier(.2,.9,.3,1)",
            fill: "backwards",
          },
        ),
      );
    [$("info"), $("memo"), $("mon")].forEach((e, j) =>
      e.animate(
        [
          { translate: "-30px 0", opacity: 0 },
          { translate: "0 0", opacity: 1 },
        ],
        {
          duration: 260,
          delay: 110 + j * 50,
          easing: "ease-out",
          fill: "backwards",
        },
      ),
    );
  }
}
