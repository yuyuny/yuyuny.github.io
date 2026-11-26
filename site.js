// 모든 페이지가 같이 쓰는 스크립트. 기능마다 필요한 요소가 있을 때만 켠다.
(() => {
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = name => getComputedStyle(root).getPropertyValue(name).trim();
  const $ = sel => document.querySelector(sel);
  const $$ = sel => [...document.querySelectorAll(sel)];

  const BAYER8 = [
    0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
  ].map(v => (v + 0.5) / 64);
  const bayer = (x, y) => BAYER8[((y & 7) << 3) | (x & 7)];
  const hash = (x, y) => {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  // ImageData의 Uint32는 리틀 엔디언이라 ABGR 순서
  const toABGR = hex => { const n = parseInt(hex.slice(1), 16); return (255 << 24) | ((n & 255) << 16) | (n & 0xff00) | (n >> 16); };

  // ---------- 디더 필드: 이름 글자(홈)와 글 머리 띠(글) ----------
  // 부드러운 값 필드를 팔레트 단계로 나누고 경계만 Bayer+잡음으로 섞는다. 화면 밖이면 그리지 않는다.
  function field(canvas, { px, wave, blob, mask }) {
    const ctx = canvas.getContext('2d');
    const s = { W: 0, H: 0, img: null, buf: null, mask: null, pal: [], seed: 1.7, on: true };
    const mouse = { x: -1, y: -1, tx: -1, ty: -1, rest: [-1, -1] };

    s.resize = () => {
      if (mask) Object.assign(s, mask(canvas, px));
      else { s.W = Math.ceil(canvas.clientWidth / px); s.H = Math.ceil(canvas.clientHeight / px); }
      canvas.width = s.W; canvas.height = s.H;
      s.img = ctx.createImageData(s.W, s.H);
      s.buf = new Uint32Array(s.img.data.buffer);
    };
    s.draw = t => {
      const { W, H, buf, pal } = s;
      if (!W || !pal.length) return;
      const n = pal.length - 1, aspect = H / W;
      mouse.x += (mouse.tx - mouse.x) * .07;
      mouse.y += (mouse.ty - mouse.y) * .07;
      for (let y = 0; y < H; y++) {
        const v = y / H;
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (s.mask && !s.mask[i]) { buf[i] = 0; continue; }
          const u = x / W;
          let f = .5 + wave(u, v, t, s.seed);
          const dx = u - mouse.x, dy = (v - mouse.y) * aspect;
          f += blob[0] * Math.exp(-(dx * dx + dy * dy) * blob[1]);
          f = Math.min(.9999, Math.max(0, f)) * n;
          const base = f | 0;
          const frac = Math.min(1, Math.max(0, (f - base - .5) * 1.5 + .5));
          const th = bayer(x, y) * .6 + hash(x, y) * .4;
          buf[i] = pal[frac > th ? Math.min(n, base + 1) : base];
        }
      }
      ctx.putImageData(s.img, 0, 0);
    };
    s.point = (e, el) => {
      const r = el.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / r.width;
      mouse.ty = (e.clientY - r.top) / r.height;
    };
    s.rest = (x, y) => { mouse.rest = [x, y]; mouse.tx = x; mouse.ty = y; };
    s.leave = () => { mouse.tx = mouse.rest[0]; mouse.ty = mouse.rest[1]; };

    new IntersectionObserver(([en]) => { s.on = en.isIntersecting; }).observe(canvas);
    let last = 0, rz;
    const loop = now => {
      if (s.on && now - last > 60) { s.draw(now / 1000); last = now; }
      requestAnimationFrame(loop);
    };
    s.start = () => { s.resize(); s.draw(0); if (!still) requestAnimationFrame(loop); };
    addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { s.resize(); s.draw(performance.now() / 1000); }, 150); });
    return s;
  }

  const fields = [];

  // ---------- 테마 ----------
  const THEMES = ['black', 'white', 'blue', 'red'];
  function setTheme(name) {
    if (!THEMES.includes(name)) name = 'black';
    root.dataset.theme = name;
    try { localStorage.setItem('theme', name); } catch (e) {}
    $$('.themes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === name));
    fields.forEach(f => { f.pal = f.palette().map(toABGR); if (still) f.draw(0); });
  }
  $$('.themes button').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.t)));

  // ---------- 홈: 이름 "YUN KIM" 글자 안에서만 흐르는 디더 ----------
  // 글자는 캔버스에 직접 그린 것이라 getImageData로 마스크를 읽어도 보안 오류가 나지 않는다
  const nameCanvas = $('#field');
  if (nameCanvas) {
    const box = $('#name');
    const f = field(nameCanvas, {
      px: 4,
      blob: [.5, 30],
      wave: (u, v, t, seed) =>
        .36 * Math.sin(u * 5.2 + Math.sin(v * 2.4 + t * .4 + seed) * 1.8 + t * .23)
        + .22 * Math.cos(v * 3.1 - u * 3.7 - t * .31 + seed * 2),
      mask(canvas, px) {
        const cssW = canvas.clientWidth;
        const lines = cssW < 640 ? ['YUN', 'KIM'] : ['YUN KIM'];
        const W = Math.ceil(cssW / px);
        const off = document.createElement('canvas').getContext('2d');
        off.font = '700 100px "IBM Plex Mono", monospace';
        const size = 100 * (W / Math.max(...lines.map(l => off.measureText(l).width)));
        const lineH = size * .78;
        const H = Math.ceil(lineH * lines.length + size * .06);
        canvas.style.height = H * px + 'px';
        off.canvas.width = W; off.canvas.height = H;
        off.font = `700 ${size}px "IBM Plex Mono", monospace`;
        lines.forEach((l, i) => off.fillText(l, (W - off.measureText(l).width) / 2, lineH * (i + 1) - size * .02));
        const a = off.getImageData(0, 0, W, H).data;
        const m = new Uint8Array(W * H);
        for (let i = 0; i < m.length; i++) m[i] = a[i * 4 + 3] > 110 ? 1 : 0;
        return { W, H, mask: m };
      },
    });
    // 글자 안: 대부분 글자색, 양 끝에 강조색 두 개
    f.palette = () => [css('--hi2'), css('--fg'), css('--fg'), css('--hi')];
    f.rest(.7, .5);
    box.addEventListener('pointermove', e => f.point(e, nameCanvas));
    box.addEventListener('pointerleave', f.leave);
    box.addEventListener('click', () => { f.seed = Math.random() * 6.28; if (still) f.draw(0); });
    fields.push(f);
    // 폰트가 늦게 오면 글자 모양이 달라지니 기다렸다가 마스크를 만든다
    document.fonts.load('700 100px "IBM Plex Mono"').catch(() => {}).then(f.start);
  }

  // ---------- 글: 머리 디더 띠. 글 주소로 시드를 정해 같은 글은 늘 같은 무늬로 시작한다 ----------
  const band = $('.band');
  if (band) {
    let h = 2166136261;
    for (const c of band.dataset.seed || '') h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    const baseSeed = ((h >>> 0) / 4294967296) * 6.283;
    const f = field(band, {
      px: 6,
      blob: [.45, 9],
      wave: (u, v, t, seed) =>
        .34 * Math.sin(u * 4.1 + Math.sin(v * 3 + t * .3 + seed) * 2.2 + t * .15 + seed)
        + .2 * Math.cos(v * 2.6 - u * 2.9 - t * .2 + seed * 3),
    });
    f.seed = baseSeed;
    f.palette = () => [css('--bg'), css('--hi2'), css('--fg'), css('--hi')];
    band.addEventListener('pointermove', e => f.point(e, band));
    band.addEventListener('pointerleave', f.leave);
    band.addEventListener('click', () => {
      f.seed = Math.random() * 6.283;
      if (still) return f.draw(0);
      setTimeout(() => { f.seed = baseSeed; }, 1500); // 잠깐 섞였다가 이 글의 무늬로 돌아온다
    });
    fields.push(f);
    f.start();
  }

  setTheme(root.dataset.theme);

  // ---------- 홈: 티커 · 시계 · 글리치 띠 ----------
  const ticker = $('.ticker-in');
  if (ticker) ticker.innerHTML += ticker.innerHTML; // -50%까지 흘러도 끊기지 않게 한 벌 더

  const clock = $('#clock');
  if (clock) {
    const tick = () => { clock.textContent = 'SEOUL ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul', hour12: false }); };
    tick(); setInterval(tick, 1000);
  }

  const glitch = $('#glitch');
  if (glitch) {
    let s = 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    let html = '';
    for (let r = 0; r < 8; r++) {
      const top = 30 + r * 10;
      html += `<hr style="top:${top + 9}px">`;
      let x = 28 + r * 6 + rnd() * 10;
      while (x < 100) {
        const w = 3 + rnd() * 9, c = rnd();
        if (rnd() < .75) html += `<i class="${c < .1 ? 'r' : c < .18 ? 'p' : ''}" style="top:${top}px;left:${x}%;width:${w}%"></i>`;
        x += w + rnd() * 4;
      }
    }
    glitch.innerHTML = html;
  }

  // ---------- 글 목록 표: 행 어디를 눌러도 이동 ----------
  $$('.idx tr[data-href]').forEach(tr => tr.addEventListener('click', e => {
    if (!e.target.closest('a')) location.href = tr.dataset.href;
  }));

  // ---------- 홈: trace.log (site 줄 + radio 줄) ----------
  const entries = $('#entries');
  const FILTERS = ['all', 'site', 'radio'];
  function setFilter(f) {
    entries.dataset.f = f;
    $$('.filters button').forEach(b => b.setAttribute('aria-pressed', b.dataset.f === f));
  }
  if (entries) {
    $$('.filters button').forEach(b => b.addEventListener('click', () => setFilter(b.dataset.f)));
    // 계약: /radio/log.json = { total, days: [{ date: "YYYY-MM-DD", count, first }] } (kims-radio-club pipeline/build.ts addedLog)
    fetch('/radio/log.json').then(r => (r.ok ? r.json() : null)).then(log => {
      if (!log || !Array.isArray(log.days)) return;
      const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
      for (const d of log.days) {
        const li = document.createElement('li');
        li.dataset.type = 'radio';
        li.dataset.date = d.date;
        li.innerHTML = `<a class="e" href="/radio/"><span class="ts">${esc(d.date.slice(5))}</span><span class="ty">radio</span><span class="tx"><b>+${Number(d.count)}곡</b> ${esc(d.first)}${d.count > 1 ? ' 외' : ''}</span></a>`;
        // 같은 날이면 site 줄 다음에 온다
        const after = [...entries.children].find(el => el.dataset.date < d.date);
        entries.insertBefore(li, after || null);
      }
      while (entries.children.length > 12) entries.lastElementChild.remove();
    }).catch(() => {});
  }

  // ---------- 홈: 터미널. 실제로 입력할 수 있다 ----------
  const out = $('#out'), input = $('#cmd-in');
  if (out && input) {
    const LINKS = { about: '/about/', posts: '/posts/', radio: '/radio/', silver: 'https://silver-lingo.vercel.app', french: '/french/', github: 'https://github.com/yuyuny' };
    const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
    const history = [];
    let hIdx = 0;
    const print = (html, cls) => {
      const p = document.createElement('p');
      if (cls) p.className = cls;
      p.innerHTML = html;
      out.append(p);
      out.scrollTop = out.scrollHeight;
    };
    const count = sel => document.querySelectorAll(sel).length;
    const COMMANDS = {
      help: () => print(
        '<b>ls</b>목록\n' +
        '<b>cd work|posts</b>이동\n' +
        '<b>open 이름</b>' + Object.keys(LINKS).join(', ') + '\n' +
        '<b>theme 색</b>black, white, blue, red\n' +
        '<b>log site|radio</b>업데이트 기록\n' +
        '<b>whoami</b>누구\n' +
        '<b>clear</b>지우기'),
      ls: () => print(`work/    ${count('.proj')}\nposts/   ${count('#posts tbody tr')}\ntrace.log\n${Object.keys(LINKS).join('    ')}`),
      whoami: () => print('Yun Kim · 사이버 창고'),
      clear: () => { out.innerHTML = ''; },
      cd: arg => {
        const id = { work: 'work', posts: 'posts', '~': 'top', '': 'top' }[arg ?? ''];
        if (!id) return print(`cd: no such directory: ${esc(arg)}`, 'err');
        const behavior = still ? 'auto' : 'smooth';
        id === 'top' ? scrollTo({ top: 0, behavior }) : document.getElementById(id).scrollIntoView({ block: 'start', behavior });
      },
      open: arg => {
        if (!LINKS[arg]) return print(`open: ${esc(arg || '')} 없음. ${Object.keys(LINKS).join(', ')} 중 하나`, 'err');
        print(`opening ${LINKS[arg]} ...`, 'dim');
        setTimeout(() => { location.href = LINKS[arg]; }, 400);
      },
      theme: arg => {
        if (!THEMES.includes(arg)) return print(`theme: ${THEMES.join(', ')} 중 하나`, 'err');
        setTheme(arg);
        print(`theme → ${arg}`, 'dim');
      },
      // trace.log 창을 같은 조건으로 걸러 두고, 창 내용을 읽어 출력한다 (데이터는 창 한 곳)
      log: arg => {
        const f = arg || 'all';
        if (!entries || !FILTERS.includes(f)) return print('log: site, radio 중 하나', 'err');
        setFilter(f);
        const rows = [...entries.children]
          .filter(li => f === 'all' || li.dataset.type === f).slice(0, 5)
          .map(li => `${li.querySelector('.ts').textContent}  ${li.dataset.type.padEnd(5)}  ${esc(li.querySelector('.tx').textContent)}`);
        print(rows.join('\n') || '(비어 있음)');
      },
    };
    const run = line => {
      const text = line.trim();
      print(esc(text), 'cmd');
      if (!text) return;
      history.push(text); hIdx = history.length;
      const [cmd, ...rest] = text.split(/\s+/);
      const fn = COMMANDS[cmd.toLowerCase()];
      fn ? fn(rest.join(' ').toLowerCase() || undefined) : print(`zsh: command not found: ${esc(cmd)}`, 'err');
    };

    $('#cmd').addEventListener('submit', e => { e.preventDefault(); run(input.value); input.value = ''; });
    input.addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      hIdx = Math.max(0, Math.min(history.length, hIdx + (e.key === 'ArrowUp' ? -1 : 1)));
      input.value = history[hIdx] ?? '';
    });
    $('#term').addEventListener('click', e => { if (!e.target.closest('button')) input.focus({ preventScroll: true }); });

    // 칩: 한 글자씩 쳐 넣은 뒤 실행
    let typing = false;
    $$('.chips button').forEach(b => b.addEventListener('click', () => {
      if (typing) return;
      const cmd = b.dataset.cmd;
      if (still) return run(cmd);
      typing = true; input.value = '';
      let i = 0;
      const t = setInterval(() => {
        input.value = cmd.slice(0, ++i);
        if (i === cmd.length) { clearInterval(t); setTimeout(() => { run(cmd); input.value = ''; typing = false; }, 160); }
      }, 45);
    }));
  }

  // ---------- 글: 목차 · 읽은 만큼 ----------
  const article = $('.toc-list') && $('.article');
  if (article) {
    const heads = [...article.querySelectorAll('h2')];
    const toc = $('.toc-list');
    const items = [{ id: '', text: '처음' }];
    heads.forEach((h, i) => {
      if (!h.id) h.id = 'h-' + (i + 1);
      h.dataset.n = String(i + 1).padStart(2, '0');
      items.push({ id: h.id, text: h.textContent });
    });
    toc.innerHTML = items.map(it => `<li><a href="#${it.id}"></a></li>`).join('');
    toc.querySelectorAll('a').forEach((a, i) => { a.textContent = items[i].text; });
    $('.toc-count').textContent = String(heads.length).padStart(2, '0');
    const links = [...toc.querySelectorAll('a')];
    links[0].addEventListener('click', e => { e.preventDefault(); scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' }); });

    const bar = $('#bar'), pct = $('#pct');
    const onScroll = () => {
      const r = article.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * .5 - r.top) / r.height));
      if (bar) bar.style.width = p * 100 + '%';
      if (pct) pct.textContent = Math.round(p * 100) + '%';
      let cur = 0;
      heads.forEach((h, i) => { if (h.getBoundingClientRect().top < 140) cur = i + 1; });
      links.forEach((a, i) => a.classList.toggle('on', i === cur));
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    onScroll();
  }

  // ---------- 이미지 등장: 덮개가 위에서 아래로 걷히고, 디더는 경계 띠에만 (한 번만) ----------
  // 그림 전체에 바둑판을 깔면 눈이 아파서 무작위 없이 띠로만 남긴다.
  // 홈 Work는 강조색으로 0.6초, 글 속 그림은 연회색으로 0.45초.
  // 이미지 load를 기다리지 않는다: 이미지가 실패하면 덮개가 영영 안 걷힌다.
  const BAND = 0.22;
  function reveal(fig) {
    const c = fig.querySelector('.veil');
    if (!c) return;
    const quiet = !!fig.closest('.article');
    const color = quiet ? css('--veil') : css('--hi');
    const dur = quiet ? 450 : 600;
    c.style.background = 'none';
    const cell = 8;
    const w = c.width = Math.ceil(fig.clientWidth / cell);
    const h = c.height = Math.ceil(fig.clientHeight / cell);
    const g = c.getContext('2d');
    const start = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - start) / dur);
      g.clearRect(0, 0, w, h);
      g.fillStyle = color;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if ((y / h) * (1 - BAND) + bayer(x, y) * BAND >= p) g.fillRect(x, y, 1, 1);
      p < 1 ? requestAnimationFrame(step) : c.remove();
    })(start);
    setTimeout(() => c.remove(), dur + 200); // 탭이 백그라운드라 rAF가 멈춰도 반드시 드러나게
  }
  if (!still && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      reveal(en.target);
    }), { threshold: .3 });
    $$('.reveal, .article .shots figure').forEach(fig => {
      // 이미 화면 위쪽으로 지나간 그림(새로고침 후 복원된 스크롤 등)은 덮지 않는다
      if (fig.getBoundingClientRect().bottom < 0) return;
      const c = document.createElement('canvas');
      c.className = 'veil';
      c.setAttribute('aria-hidden', 'true');
      fig.append(c);
      io.observe(fig);
    });
  }
})();
