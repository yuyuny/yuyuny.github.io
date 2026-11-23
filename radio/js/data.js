/* DOM을 건드리지 않는다. Node에서 import해 테스트한다. */
export const norm = (t) => ({
  ...t,
  album: t.album || "",
  released: String(t.released ?? t.year ?? ""),
  genres: [].concat(t.genres || []),
  sub: [].concat(t.sub || []),
  moods: [].concat(t.moods || []),
  best: [].concat(t.best || []),
  added: t.added || "",
  comment: t.comment || "",
});

export async function loadTracks() {
  const r = await fetch("./tracks.json");
  if (!r.ok) throw new Error(`tracks.json ${r.status}`);
  return (await r.json()).map(norm);
}

/* site/vocab.json: {genres:[{name,color?}], moods:[{name,group}], subgenres?:[{name}]}. 못 읽으면 null(목록은 곡에서 값을 모아 뜬다) */
export const loadVocab = () =>
  fetch("./vocab.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((v) =>
      Array.isArray(v?.genres) && Array.isArray(v?.moods) ? v : null,
    )
    .catch(() => null);

const ko = (x, y) => x.localeCompare(y, "ko");
export const SORTS = {
  recent: (x, y) => y.added.localeCompare(x.added), // 날짜 없는 곡("")은 맨 뒤. 같은 날은 들어온 순서 그대로(sort는 안정 정렬)
  artist: (x, y) => ko(x.artist, y.artist) || ko(x.title, y.title),
  title: (x, y) => ko(x.title, y.title),
  new: (x, y) => (y.released || "0").localeCompare(x.released || "0"),
  old: (x, y) => (x.released || "9999").localeCompare(y.released || "9999"),
  note: (x, y) => !!y.comment - !!x.comment || ko(x.artist, y.artist),
};

export function filterTracks(
  data,
  {
    q = "",
    sort = "recent",
    genres = [],
    subs = [],
    moods = [],
    bests = [],
  } = {},
) {
  q = q.trim().toLowerCase();
  return data
    .filter(
      (t) =>
        genres.every((g) => t.genres.includes(g)) &&
        subs.every((s) => t.sub.includes(s)) &&
        moods.every((m) => t.moods.includes(m)) &&
        bests.every((b) => t.best.includes(b)) &&
        (!q ||
          [t.title, t.artist, t.album].join(" ").toLowerCase().includes(q)),
    )
    .sort(SORTS[sort]);
}

/* 곡 길이(초) → "3:41", 한 시간 이상은 "1:02:03". 값이 없거나 0이면 "" */
export function dur(sec) {
  const n = Math.round(Number(sec) || 0);
  if (n <= 0) return "";
  const h = Math.floor(n / 3600),
    m = Math.floor((n % 3600) / 60),
    s = String(n % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export const uniq = (data, key) =>
  [...new Set(data.flatMap((t) => t[key]))].sort(ko);
