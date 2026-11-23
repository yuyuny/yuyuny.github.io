export const $ = (id) => document.getElementById(id);
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const fmt = (n) => Number(n).toLocaleString("ko-KR");
export const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
