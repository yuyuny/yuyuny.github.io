/* 곡에서 지금 쓸 유튜브 영상 ID. mv, audio 순이고 failed(Set)에 든 ID는 건너뛴다. 없으면 null. */
export const pickVideo = (t, failed) =>
  [t.mv, t.audio].find((id) => id && !failed.has(id)) ?? null;
