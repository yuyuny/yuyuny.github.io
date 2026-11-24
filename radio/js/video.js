/* 곡에서 지금 쓸 유튜브 영상 ID. mv, audio 순이고 failed(Set)에 든 ID는 건너뛴다. 없으면 null. */
export const pickVideo = (t, failed) =>
  [t.mv, t.audio].find((id) => id && !failed.has(id)) ?? null;

/* 목록 view에서 from의 다음(d=1)·이전(d=-1) 곡 중 쓸 영상이 있는 곡. 끝에 닿으면 반대쪽 끝으로 돈다.
   from이 목록에 없으면(필터로 빠짐) 다음은 첫 곡부터, 이전은 끝 곡부터 찾는다. 없으면 null */
export function stepTrack(view, from, d, failed) {
  const n = view.length,
    i = view.indexOf(from),
    s = i >= 0 ? i : d > 0 ? -1 : n;
  for (let k = 1; k <= n; k++) {
    const t = view[(((s + d * k) % n) + n) % n];
    if (pickVideo(t, failed)) return t;
  }
  return null;
}
