import { $ } from "./util.js";
import { loadTracks, loadVocab, filterTracks } from "./data.js";
import { setColors } from "./cover.js";
import { initStage, showStage, clearStage, swap, reveal } from "./stage.js";
import { initPlayer, showPlayer, clearPlayer } from "./player.js";
import {
  initList,
  controls,
  renderList,
  markRow,
  showLoadError,
  resetFilters,
} from "./list.js";

const st = { view: [], sel: 0, cur: null };

function pick(i, scroll = true) {
  if (!st.view.length) {
    swap(() => {
      clearStage();
      clearPlayer();
    }, null);
    return;
  }
  st.sel = Math.max(0, Math.min(st.view.length - 1, i));
  const t = st.view[st.sel];
  markRow(st.sel, scroll);
  put(t);
}
function put(t) {
  if (st.cur === t) return;
  st.cur = t;
  swap(() => {
    showPlayer(t); // 영상 유무를 먼저 정해야 showStage가 망점 배치를 고른다
    showStage(t);
  }, t);
}
/* 바의 곡 이름, 방송 곡을 따라가는 PREV·NEXT. 필터로 목록에서 빠진 방송 곡이면 무대만 바꾸고 목록 선택 표시를 지운다 */
function show(t) {
  const i = st.view.indexOf(t);
  if (i >= 0) return pick(i);
  markRow(-1, false);
  put(t);
}

/* first: 고르던 곡을 이어 갈 수 없을 때 고를 자리 */
function filter(data, keep, first = 0) {
  st.view = filterTracks(data, controls());
  renderList(st.view);
  const k = keep && st.cur ? st.view.indexOf(st.cur) : -1;
  st.cur = null;
  pick(k >= 0 ? k : first, k >= 0 || first > 0);
}

function start(data, vocab) {
  if (vocab) setColors(vocab.genres);
  initPlayer({ view: () => st.view, show });
  initList(data, vocab, st, {
    onFilter: (keep) => filter(data, keep),
    onPick: pick,
  });
  // 결과 없음 화면(clearStage)의 버튼
  $("blankB").onclick = () => {
    resetFilters();
    filter(data, false);
  };
  document.addEventListener("keydown", (e) => {
    const a = document.activeElement,
      typing = /INPUT|TEXTAREA|SELECT/.test(a?.tagName || "");
    if (e.key === "/" && !typing) {
      e.preventDefault();
      $("q").focus();
      return;
    }
    if (typing && a.id !== "q") return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      pick(st.sel + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      pick(st.sel - 1);
    }
  });
  // 처음엔 가장 최근에 추가한 곡이 아니라 무작위 곡으로 연다(사용자 결정). 목록도 그 행으로 옮긴다
  filter(data, false, Math.floor(Math.random() * data.length));
}

initStage();
const [data, vocab] = await Promise.all([
  loadTracks().catch(() => null),
  loadVocab(),
]);
if (data) start(data, vocab);
else {
  showLoadError();
  clearStage("error");
  $("blankB").onclick = () => location.reload();
}
reveal();
