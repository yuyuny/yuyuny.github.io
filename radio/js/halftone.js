/* 망점 조각. DOM을 건드리지 않는다(test/halftone.test.js가 Node에서 import).
   점은 16px 격자 칸 가운데(8+16k)에 놓이고 반지름은 7.2를 넘지 않는다. 그래서 16px 배수 경계로 자른 직사각형은 점을 반으로 가르지 않는다(stage.js의 제목 뚫기가 기댄다).
   조각은 무대의 빈자리 두 곳에만 찍는다. 무대 전체에 깔면 제목·정보 표·Spotify 버튼 뒤로 점이 지나가 어수선하고, 버튼의 둘째 잉크 그림자가 점에 묻힌다.
   - 재킷 뒤(BEHIND): LP 중심에서 퍼지고 재킷 위쪽으로만 보인다
   - 구석(CORNER): 정보 줄의 오른쪽 아래. 왼쪽(Spotify 버튼 자리)은 비운다
   중앙 한 점으로 모이는 방사형(집중선)은 만들지 않는다(사용자 결정). */

export const PITCH = 16,
  RMAX = 7.2;
const TAU = 2 * Math.PI;
const cl = (v) => (v < 0 ? 0 : v > 7.4 ? 7.4 : v);
const ramp = (a, b, v) => Math.min(1, Math.max(0, (v - a) / (b - a))); // a에서 0, b에서 1

// 무대 맨 위(머리말 아래)와 재킷 아래(제목 줄)에서 점을 줄여 없앤다. 맨 위에서 줄이지 않으면 점이 머리말 밑에서 잘린 것처럼 보인다
const keep = (cy, jh) => (y) =>
  ramp(-8, 56, y) * ramp(cy + 0.6 * jh, cy + 0.4 * jh, y);

/* 재킷 뒤 조각: ({x, y, jh}) => (px, py) => 반지름(px). x·y는 LP 중심, jh는 재킷 높이 */
export const BEHIND = [
  [
    "halo",
    ({ x: cx, y: cy, jh }) => {
      const R = 1.2 * jh,
        k = keep(cy, jh);
      return (x, y) => cl(7.6 * (1 - Math.hypot(x - cx, y - cy) / R)) * k(y);
    },
  ],
  // LP에서 퍼지는 전파
  [
    "rings",
    ({ x: cx, y: cy, jh }) => {
      const R = 1.7 * jh,
        p = 0.42 * jh,
        k = keep(cy, jh);
      return (x, y) => {
        const d = Math.hypot(x - cx, y - cy);
        return d > R
          ? 0
          : cl(8.6 * Math.cos((TAU * d) / p) * (1 - d / R)) * k(y);
      };
    },
  ],
  // 패널 경계와 같은 방향('/')의 띠
  [
    "stripes",
    ({ x: cx, y: cy, jh }) => {
      const R = 1.6 * jh,
        p = 0.5 * jh,
        k = keep(cy, jh);
      return (x, y) => {
        const d = Math.hypot(x - cx, y - cy),
          u = (x - cx + (y - cy)) / Math.SQRT2;
        return d > R
          ? 0
          : cl(8.6 * Math.cos((TAU * u) / p) * (1 - d / R)) * k(y);
      };
    },
  ],
];

/* 구석 조각: (w, h, y0) => (x, y) => 반지름(px). w·h는 무대 크기, y0은 정보 줄의 윗변 */
export const CORNER = [
  // 오른쪽으로 갈수록 높아진다. 왼쪽에선 물결이 무대 아래로 내려가 점이 없다
  [
    "wave",
    (w, h, y0) => {
      const H = h - y0;
      return (x, y) => {
        const t = ramp(0.3 * w, 0.8 * w, x),
          line = y0 + H * (1.1 - 0.95 * t) - 0.09 * H * Math.sin(x / 95);
        return cl((y - line) / (0.07 * H));
      };
    },
  ],
  [
    "disc",
    (w, h, y0) => {
      const H = h - y0,
        cx = 0.84 * w,
        cy = y0 + 0.62 * H,
        R = 0.92 * H;
      return (x, y) => cl(7.6 * (1 - Math.hypot(x - cx, y - cy) / R));
    },
  ],
  // 세 칸 찍고 한 칸 비운 막대. 오른쪽으로 갈수록 높아진다
  [
    "bars",
    (w, h, y0) => {
      const H = h - y0,
        x0 = 0.46 * w;
      return (x, y) => {
        if (x < x0 || x % 64 >= 48) return 0;
        const t = (x - x0) / (w - x0),
          level =
            0.35 + 0.4 * Math.abs(Math.sin(Math.floor(x / 64) * 1.7 + 0.4)),
          top = y0 + H * (0.85 - level * (0.35 + 0.65 * t));
        return cl((y - top) / (0.06 * H) + 1);
      };
    },
  ],
];

export const COUNT = BEHIND.length * CORNER.length;

/* v번째 조합(0..COUNT-1)의 반지름 함수. lp나 floor가 없으면(재킷이나 정보 줄이 화면에 없으면) 그 조각은 뺀다 */
export function shape(v, w, h, { lp, floor }) {
  const a = lp && BEHIND[v % BEHIND.length][1](lp),
    c = floor != null && CORNER[Math.floor(v / BEHIND.length)][1](w, h, floor);
  return (x, y) => Math.max(a ? a(x, y) : 0, c ? c(x, y) : 0);
}

/* 곡이 없을 때의 판: 바닥에 깔린 물결 */
export const blank = (w, h) => (x, y) =>
  cl((y - 0.82 * h - 0.045 * h * Math.sin(x / 95)) / (0.012 * h + 4));

export function dotsSvg(w, h, r) {
  let p = "";
  for (let y = PITCH / 2; y < h; y += PITCH)
    for (let x = PITCH / 2; x < w; x += PITCH) {
      const v = Math.min(RMAX, r(x, y));
      if (v > 0.4) p += `<circle cx="${x}" cy="${y}" r="${v.toFixed(1)}"/>`;
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${p}</svg>`;
}
