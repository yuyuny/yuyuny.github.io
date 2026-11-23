import { $ } from "./util.js";
import { loadTracks, loadVocab, filterTracks } from "./data.js";
import { setColors } from "./cover.js";
import { initStage, showStage, clearStage } from "./stage.js";
import { showPlayer, clearPlayer } from "./player.js";
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
    clearStage();
    clearPlayer();
    return;
  }
  st.sel = Math.max(0, Math.min(st.view.length - 1, i));
  const t = st.view[st.sel];
  markRow(st.sel, scroll);
  if (st.cur === t) return;
  st.cur = t;
  showPlayer(t);
  showStage(t);
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
