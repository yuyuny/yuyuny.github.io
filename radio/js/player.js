import { $ } from "./util.js";
import { pickVideo, stepTrack } from "./video.js";

/* 무대에 올라온 곡(cur)과 방송 곡(air)을 따로 든다. 영상은 방송 곡 하나뿐이고, 방송 곡을 보고 있으면 모니터에서, 아니면 목록 아래 도크에서 나온다.
   - iframe은 DOM에서 옮기지 않는다. 다른 부모로 옮기면 다시 로드돼 재생이 끊기고, 상태를 지키며 옮기는 moveBefore는 Safari에 없다.
     그래서 플레이어(#pv)는 한 자리에 두고 모니터 화면이나 도크 칸 위에 위치와 크기만 맞춘다(place)
   - 유튜브 정책(Required Minimum Functionality): 플레이어는 200×200px 이상이어야 하고 그 앞을 아무것도 가리면 안 된다. 자동 재생은 플레이어가 보일 때만 */
const app = document.querySelector(".app"),
  stage = $("stage"),
  mon = $("mon"),
  screen = $("screen"),
  btn = $("play"),
  img = $("thumb"),
  link = $("yt"),
  cue = $("cue"),
  radio = $("radio"),
  dock = $("dock"),
  slot = $("slot"),
  pv = $("pv");
const failed = new Set(); // 이 세션에서 재생 오류가 난 영상 ID
const thumb = (id, size) =>
  `https://i.ytimg.com/vi/${encodeURIComponent(id)}/${size}.jpg`;
let cur = null,
  air = null, // 처음 재생을 누르기 전엔 null, 그 뒤로는 늘 있다
  airId = null,
  thumbId = null,
  yt = null, // Promise<YT.Player>. 세션에 하나만 만들고 곡이 바뀌면 영상만 바꾼다
  loaded = null, // 플레이어에 올린 영상 ID
  playing = false,
  api = null,
  raf = 0,
  on = null; // initPlayer의 콜백

/* 없는 크기는 404와 함께 120x90 회색 이미지가 오므로 onload에서도 폭으로 가린다. hqdefault는 항상 있다. */
img.onload = img.onerror = () => {
  if (img.naturalWidth <= 120 && !img.src.endsWith("/hqdefault.jpg"))
    img.src = thumb(thumbId, "hqdefault");
};

/* 모니터: 방송 곡을 보고 있으면 플레이어 자리, 아니면 고른 곡의 썸네일과 재생 버튼. 쓸 영상이 없으면 숨긴다.
   좁은 화면에서 방송 곡과 다른 곡을 보는 동안은 무대가 띠로 접힌다(stage.css의 .away) */
function render() {
  const here = !!cur && cur === air,
    id = here ? airId : cur ? pickVideo(cur, failed) : null;
  mon.hidden = !id;
  screen.classList.toggle("live", here);
  btn.hidden = here;
  cue.hidden = here || !id;
  stage.classList.toggle("away", !!air && !!cur && !here);
  lamp();
  queue();
  if (!id) return link.removeAttribute("href");
  link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  if (here) return;
  const label = `재생: ${cur.artist} ${cur.title}`;
  btn.setAttribute("aria-label", label);
  cue.setAttribute("aria-label", label);
  thumbId = id;
  img.removeAttribute("src");
  img.src = thumb(id, "sddefault");
}

/* ◆ 깜빡임과 LP 돌기(stage.css)는 재생·버퍼링 동안만. 모니터 쪽은 방송 곡을 보고 있을 때만 */
function lamp() {
  mon.classList.toggle("on", playing && cur === air);
  radio.classList.toggle("on", playing);
}

/* 바: 방송 곡 이름. 누르면 무대가 방송 곡으로 돌아온다 */
function tag() {
  radio.hidden = !air;
  if (!air) return;
  $("oaT").textContent = air.title || "제목 없음";
  $("oaA").textContent = air.artist || "";
  $("oat").setAttribute(
    "aria-label",
    `방송 곡 보기: ${air.artist} ${air.title}`,
  );
}

const queue = () => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(place);
};
/* 플레이어를 지금 자리에 겹친다. 모니터는 기울어 있어(player.css의 .mon) 같은 변형을 모니터 중심 기준으로 건다.
   좁은 화면에서 검색하거나 무대가 띠로 접혀 모니터가 사라지면(stage.css) 화면 폭이 0이 되어 도크로 내려간다 */
function place() {
  const here = !!air && cur === air && screen.offsetWidth > 0;
  dock.hidden = !air || here;
  pv.hidden = !air;
  if (!air) return;
  const a = app.getBoundingClientRect(),
    box = (x, y, w, h, transform = "none", transformOrigin = "") =>
      Object.assign(pv.style, {
        left: x + "px",
        top: y + "px",
        width: w + "px",
        height: h + "px",
        transform,
        transformOrigin,
      });
  if (!here) {
    const r = slot.getBoundingClientRect();
    return void box(r.left - a.left, r.top - a.top, r.width, r.height);
  }
  // 돌아간 모니터를 감싼 사각형이라도 중심은 같다
  const m = mon.getBoundingClientRect(),
    cx = (m.left + m.right) / 2 - a.left,
    cy = (m.top + m.bottom) / 2 - a.top,
    x = cx - mon.offsetWidth / 2 + mon.clientLeft + screen.offsetLeft,
    y = cy - mon.offsetHeight / 2 + mon.clientTop + screen.offsetTop;
  box(
    x,
    y,
    screen.offsetWidth,
    screen.offsetHeight,
    getComputedStyle(mon).transform,
    `${cx - x}px ${cy - y}px`,
  );
}

const loadApi = () =>
  (api ??= new Promise((ok, no) => {
    const s = document.createElement("script");
    window.onYouTubeIframeAPIReady = ok;
    s.onerror = () => {
      api = null;
      no();
    };
    s.src = "https://www.youtube.com/iframe_api";
    document.head.append(s);
  }));

const player = (id) =>
  (yt ??= loadApi().then(
    () =>
      new Promise((ok) => {
        loaded = id;
        const p = new YT.Player(pv.appendChild(document.createElement("div")), {
          host: "https://www.youtube-nocookie.com",
          width: "100%",
          height: "100%",
          videoId: id,
          playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
          events: { onReady: () => ok(p), onStateChange, onError },
        });
      }),
    (e) => {
      yt = null;
      throw e;
    },
  ));

function onStateChange(e) {
  const S = YT.PlayerState;
  playing = e.data === S.PLAYING || e.data === S.BUFFERING;
  lamp();
  if (e.data === S.ENDED) step(1);
}

/* 오류 코드(101·150 임베드 금지, 100 삭제, 그 밖의 것)는 구분하지 않는다. 같은 곡의 다음 ID로, 없으면 다음 곡으로 */
function onError(e) {
  failed.add(airId);
  const id = pickVideo(air, failed);
  if (!id) return step(1);
  airId = loaded = id;
  e.target.loadVideoById(id);
  if (cur === air) render();
}

/* t를 방송 곡으로 튼다. follow면 무대도 곧 t로 바뀌므로(on.show) 모니터는 그때 showPlayer가 그린다 */
async function tune(t, follow = false) {
  const id = pickVideo(t, failed);
  if (!id) return;
  const was = [air, airId];
  air = t;
  airId = id;
  tag();
  if (!follow) render(); // 플레이어 자리를 먼저 잡는다. 자동 재생은 플레이어가 보일 때만 시작해야 한다
  let p;
  try {
    p = await player(id);
  } catch {
    // 스크립트를 못 받은 건 영상 탓이 아니니 failed에 넣지 않고 틀기 전으로 돌린다
    [air, airId] = was;
    tag();
    return render();
  }
  if (airId === id && loaded !== id) {
    loaded = id;
    p.loadVideoById(id);
  }
}

/* PREV·NEXT와 곡이 끝났을 때. 방송 곡을 보고 있었으면 무대도 따라가고, 다른 곡을 보고 있었으면 도크만 바뀐다 */
function step(d) {
  const t = stepTrack(on.view(), air, d, failed);
  if (!t) return;
  const follow = cur === air;
  tune(t, follow);
  if (follow) on.show(t);
}

/* view(): 지금 목록(PREV·NEXT 순서), show(t): 무대에 t를 올린다(목록에 없는 곡일 수도 있다) */
export function initPlayer(cb) {
  on = cb;
  btn.onclick = cue.onclick = () => tune(cur);
  $("oat").onclick = () => on.show(air);
  $("prev").onclick = () => step(-1);
  $("next").onclick = () => step(1);
  const ro = new ResizeObserver(place);
  for (const el of [app, screen, slot]) ro.observe(el);
  // 좁은 화면의 INFO 시트와 목록의 건너뛰기 색인이 이 높이만큼 위에서 끝난다(stage.css, list.css). 시트가 플레이어를 가리면 안 된다
  new ResizeObserver(() =>
    document.documentElement.style.setProperty(
      "--radio-h",
      radio.offsetHeight + "px",
    ),
  ).observe(radio);
}

/* 필터·정렬을 바꾸면 main.js가 같은 곡으로 다시 부른다. 그때 썸네일을 다시 받지 않는다 */
export function showPlayer(t) {
  if (t === cur) return;
  cur = t;
  render();
}
export function clearPlayer() {
  cur = null;
  render();
}
