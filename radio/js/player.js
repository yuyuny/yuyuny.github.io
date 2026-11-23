import { $ } from "./util.js";
import { pickVideo } from "./video.js";

/* 곡을 고르면 썸네일과 재생 버튼만 그린다. iframe은 재생을 눌렀을 때만 만든다. */
const mon = $("mon"),
  screen = $("screen"),
  btn = $("play"),
  img = $("thumb"),
  link = $("yt");
const failed = new Set(); // 이 세션에서 재생 오류가 난 영상 ID
const thumb = (id, size) =>
  `https://i.ytimg.com/vi/${encodeURIComponent(id)}/${size}.jpg`;
let cur = null,
  id = null,
  pl = null,
  gen = 0,
  api = null;

/* 없는 크기는 404와 함께 120x90 회색 이미지가 오므로 onload에서도 폭으로 가린다. hqdefault는 항상 있다. */
img.onload = img.onerror = () => {
  if (img.naturalWidth <= 120 && !img.src.endsWith("/hqdefault.jpg"))
    img.src = thumb(id, "hqdefault");
};

function show() {
  link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}

/* 재생을 멈추고 썸네일 상태로. 쓸 영상이 없으면 모니터를 숨긴다. */
function render() {
  gen++;
  pl?.destroy();
  pl = null;
  mon.classList.remove("on");
  screen.classList.remove("live");
  id = cur ? pickVideo(cur, failed) : null;
  mon.hidden = !id;
  img.removeAttribute("src");
  if (!id) return link.removeAttribute("href");
  show();
  btn.hidden = btn.disabled = false;
  btn.setAttribute("aria-label", `재생: ${cur.artist} ${cur.title}`);
  img.src = thumb(id, "sddefault");
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

/* 오류 코드(101·150 임베드 금지, 100 삭제, 그 밖의 것)는 구분하지 않고 다음 ID로 넘어간다. */
function onError(e) {
  if (e.target !== pl) return;
  failed.add(id);
  const next = pickVideo(cur, failed);
  if (!next) return render();
  id = next;
  show();
  pl.loadVideoById(next);
}

async function play() {
  const g = gen;
  btn.disabled = true;
  try {
    await loadApi();
  } catch {
    // 스크립트를 못 받은 건 영상 탓이 아니니 failed에 넣지 않는다
    btn.disabled = false;
    return;
  }
  if (g !== gen) return;
  const box = document.createElement("div");
  screen.append(box);
  btn.hidden = true;
  screen.classList.add("live");
  pl = new YT.Player(box, {
    host: "https://www.youtube-nocookie.com",
    width: "100%",
    height: "100%",
    videoId: id,
    playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
    events: {
      onStateChange: (e) => {
        if (e.target !== pl) return;
        if (e.data === YT.PlayerState.ENDED) return render();
        mon.classList.toggle(
          "on",
          e.data === YT.PlayerState.PLAYING ||
            e.data === YT.PlayerState.BUFFERING,
        );
      },
      onError,
    },
  });
}
btn.onclick = play;

/* 필터·정렬을 바꾸면 main.js가 같은 곡으로 다시 부른다. 그때 재생을 끊지 않는다. */
export function showPlayer(t) {
  if (t === cur) return;
  cur = t;
  render();
}
export function clearPlayer() {
  cur = null;
  render();
}
