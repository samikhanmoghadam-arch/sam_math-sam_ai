/* SAM MATH: آرکید ریاضی (نسخهٔ کامل)
   دایناسور ریاضی، نقطه‌بازی، مثلث‌شمار، مار ریاضی، جفت‌های ریاضی، بالون‌ترکان، سودوکو و مربع جادویی. */
(() => {
'use strict';
window.SAM_ARCADE_PRO = true;

/* ---------- ابزارهای کمکی ---------- */
const $ = id => document.getElementById(id);
const fa = n => String(n).replace(/-/g, '−').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ذخیرهٔ امتیاز؛ اگر مرورگر اجازه ندهد، بازی بدون ذخیره ادامه پیدا می‌کند.
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem('sam-arcade-' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (_) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('sam-arcade-' + key, JSON.stringify(value)); } catch (_) { /* بدون ذخیره */ }
  }
};

const gradeNow = () => Number(($('arcadeGrade') || {}).value) || 8;
const arcadeVisible = () => { const s = $('samArcade'); return !!s && s.offsetParent !== null; };
const isTyping = e => ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target || {}).tagName);

// حلقهٔ انیمیشن با dt محدود؛ توقف و شروع دوباره امکان‌پذیر است.
function makeLoop(step) {
  let id = 0;
  let last = 0;
  const frame = ts => {
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
    last = ts;
    step(dt);
    id = requestAnimationFrame(frame);
  };
  return {
    start() { if (!id) { last = 0; id = requestAnimationFrame(frame); } },
    stop() { if (id) cancelAnimationFrame(id); id = 0; }
  };
}

// بوم با وضوح دوبرابر؛ CSS آن را به عرض صفحه می‌کشد (واکنش‌گرا).
function fitCanvas(canvas, w, h) {
  canvas.width = w * 2;
  canvas.height = h * 2;
  canvas.style.aspectRatio = `${w} / ${h}`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  return ctx;
}

// مختصات نقطهٔ کلیک/لمس در فضای منطقی بوم
function toLocal(canvas, e, w, h) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * w, y: (e.clientY - r.top) / r.height * h };
}

/* ---------- سؤال‌های ریاضی بر اساس پایه ---------- */
const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
const sup = n => String(n).split('').map(d => SUP[+d]).join('');
const signed = n => (n < 0 ? `(−${-n})` : String(n));
const usedMath = new Set();

// هر نوع سؤال یک متن (عبارت)، جواب عددی صحیح و گاهی «ask» دارد.
function mathCandidate(g) {
  const k = rnd(0, g <= 3 ? 2 : g <= 6 ? 3 : 4);
  if (g <= 3) {
    const max = g === 1 ? 10 : g === 2 ? 30 : 99;
    if (k === 0) { const a = rnd(1, max), b = rnd(1, max); return { text: `${a} + ${b}`, answer: a + b }; }
    if (k === 1) { const a = rnd(1, max), b = rnd(0, a); return { text: `${a} − ${b}`, answer: a - b }; }
    const a = rnd(2, 5), b = rnd(2, 9);
    return { text: `${a} × ${b}`, answer: a * b };
  }
  if (g <= 6) {
    if (k === 0) { const a = rnd(10, 500), b = rnd(10, 500); return { text: `${a} + ${b}`, answer: a + b }; }
    if (k === 1) { const a = rnd(3, 12), b = rnd(3, 12); return { text: `${a} × ${b}`, answer: a * b }; }
    if (k === 2) { const d = rnd(2, 12), q = rnd(2, 20); return { text: `${d * q} ÷ ${d}`, answer: q }; }
    const a = rnd(20, 500), b = rnd(20, 500);
    return { text: `${a} − ${b}`, answer: a - b };
  }
  if (g <= 9) {
    if (k === 0) { const a = rnd(-15, 15), b = rnd(-12, 12); return { text: `${signed(a)} × ${signed(b)}`, answer: a * b }; }
    if (k === 1) { const r = rnd(2, 30); return { text: `√${r * r}`, answer: r }; }
    if (k === 2) { const a = rnd(2, 15); return { text: `${a}²`, answer: a * a }; }
    if (k === 3) {
      const p = pick([5, 10, 15, 20, 25, 30, 40, 50, 75]), base = rnd(1, 30) * 20;
      return { text: `${p}٪ از ${base}`, answer: (p * base) / 100 };
    }
    const a = rnd(-30, 30), b = rnd(-30, 30);
    return { text: `${signed(a)} + ${signed(b)}`, answer: a + b };
  }
  if (k === 0) { const a = rnd(2, 9), n = rnd(2, 5), b = rnd(1, 20); return { text: `${a}${sup(n)} + ${b}`, answer: a ** n + b }; }
  if (k === 1) { const r = rnd(10, 40); return { text: `√${r * r}`, answer: r }; }
  if (k === 2) {
    const a = rnd(2, 9), x = rnd(-9, 12), b = rnd(-20, 20), c = a * x + b;
    return { text: `${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${c}`, answer: x, ask: 'x' };
  }
  if (k === 3) { const a = rnd(2, 15), b = rnd(2, 15); return { text: `(${a} + ${b})² − ${a * a} − ${b * b}`, answer: 2 * a * b }; }
  const p = pick([10, 15, 20, 25, 40, 60]), base = rnd(1, 40) * 20;
  return { text: `${base} + ${p}٪ از ${base}`, answer: base + (p * base) / 100 };
}

// چهار گزینهٔ متمایز: جواب درست و سه گزینهٔ نزدیک به آن
function makeOptions(answer) {
  const step = Math.max(1, Math.round(Math.abs(answer) / 6));
  const opts = new Set([answer]);
  for (const d of shuffle([-3, -2, -1, 1, 2, 3, 4, -4, 5, -5])) {
    if (opts.size >= 4) break;
    opts.add(answer + d * step);
  }
  for (let k = 1; opts.size < 4; k++) opts.add(answer + 20 * k);
  return shuffle([...opts]);
}

// سؤال بدون تکرار در این بازدید
function makeMath(grade) {
  let item = null;
  for (let tries = 0; tries < 40 && !item; tries++) {
    const cand = mathCandidate(grade);
    if (!usedMath.has(cand.text)) item = cand;
  }
  if (!item) { usedMath.clear(); item = mathCandidate(grade); }
  usedMath.add(item.text);
  return { text: item.text, answer: item.answer, ask: item.ask || '', options: makeOptions(item.answer) };
}

const questionText = item => item.text + (item.ask ? '  ⇒  x = ?' : ' = ?');

// کارت سؤال چهارگزینه‌ای؛ بعد از پاسخ قفل می‌شود.
function quizCard(item, onAnswer) {
  const card = document.createElement('div');
  card.className = 'ap-card';
  const q = document.createElement('p');
  q.className = 'ap-q';
  q.dir = 'ltr';
  q.textContent = questionText(item);
  const opts = document.createElement('div');
  opts.className = 'ap-opts';
  const buttons = item.options.map(v => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ap-opt';
    b.dir = 'ltr';
    b.textContent = String(v);
    b.onclick = () => {
      if (card.dataset.done) return;
      card.dataset.done = '1';
      buttons.forEach(x => {
        x.disabled = true;
        if (Number(x.textContent) === item.answer) x.classList.add('right');
      });
      const ok = v === item.answer;
      if (!ok) b.classList.add('wrong');
      onAnswer(ok);
    };
    return b;
  });
  opts.append(...buttons);
  card.append(q, opts);
  return card;
}

function setMsg(el, text, kind) {
  if (!el) return;
  el.textContent = text;
  el.className = 'ap-msg' + (kind ? ' ' + kind : '');
}

/* ---------- پوستهٔ آرکید: تب‌ها، پایه، کلیدها ---------- */
const registry = [];
function register(key, label, mount) { registry.push({ key, label, mount, api: null }); }
const findReg = key => registry.find(r => r.key === key);
let activeKey = null;

function show(key) {
  registry.forEach(r => {
    const view = $('apView-' + r.key);
    if (view) view.hidden = r.key !== key;
    const tab = document.querySelector(`#samArcade .ap-tab[data-game="${r.key}"]`);
    if (tab) tab.classList.toggle('active', r.key === key);
  });
  if (activeKey && activeKey !== key) {
    const prev = findReg(activeKey);
    if (prev && prev.api && prev.api.leave) prev.api.leave();
  }
  activeKey = key;
  const cur = findReg(key);
  if (cur && cur.api && cur.api.enter) cur.api.enter();
}

function onGlobalKey(e) {
  if (!activeKey || isTyping(e) || !arcadeVisible()) return;
  const r = findReg(activeKey);
  if (r && r.api && r.api.onKey) r.api.onKey(e);
}

function onGlobalKeyUp(e) {
  if (!activeKey || isTyping(e) || !arcadeVisible()) return;
  const r = findReg(activeKey);
  if (r && r.api && r.api.onKeyUp) r.api.onKeyUp(e);
}

function build() {
  const panel = $('challengePanel');
  if (!panel || $('samArcade')) return;
  let gradeOpts = '';
  for (let g = 1; g <= 12; g++) {
    gradeOpts += `<option value="${g}"${g === 8 ? ' selected' : ''}>پایهٔ ${fa(g)}</option>`;
  }
  const sec = document.createElement('section');
  sec.id = 'samArcade';
  sec.className = 'arcade-pro';
  sec.innerHTML = `
    <div class="ap-top">
      <div>
        <h2>🎮 آرکید ریاضی SAM</h2>
        <p class="ap-help">هشت بازی ریاضی و سرگرم‌کننده؛ یکی را انتخاب کن. سطح سؤال‌ها با «پایهٔ تحصیلی» تنظیم می‌شود.</p>
      </div>
      <label>پایهٔ تحصیلی<select id="arcadeGrade">${gradeOpts}</select></label>
    </div>
    <div class="ap-tabs" role="tablist">${registry.map(r =>
      `<button class="ap-tab" type="button" role="tab" data-game="${r.key}">${r.label}</button>`).join('')}</div>
    <div class="ap-views">${registry.map(r =>
      `<div class="ap-view" id="apView-${r.key}" hidden></div>`).join('')}</div>`;
  panel.append(sec);
  sec.querySelectorAll('.ap-tab').forEach(b => b.addEventListener('click', () => show(b.dataset.game)));
  registry.forEach(r => { r.api = r.mount($('apView-' + r.key)) || null; });
  window.addEventListener('keydown', onGlobalKey);
  window.addEventListener('keyup', onGlobalKeyUp);
  show(registry[0].key);
}

/* ---------- ۱. دایناسور ریاضی (الگوی دایناسور آفلاین کروم) ---------- */
register('dino', '🦖 دایناسور ریاضی', view => {
  view.innerHTML = `
    <p class="ap-help">راهنما: <b>Space</b> یا <b>↑</b> یا ضربه بالای صفحه = پرش · <b>↓</b> یا ضربه پایین صفحه = خم شدن.
    هر حدود ۲۵۰ امتیاز یک «دروازهٔ ریاضی» باز می‌شود: جواب درست ۵۰ امتیاز جایزه دارد و جواب غلط یک جان کم می‌کند.</p>
    <div class="ap-hud">
      <span>امتیاز <strong id="dnScore">۰</strong></span>
      <span>رکورد <strong id="dnHi">${fa(store.get('best-dino', 0))}</strong></span>
      <span>جان <strong id="dnLives">❤ ❤ ❤</strong></span>
      <button class="ap-btn ghost" id="dnPause" type="button">⏸ مکث</button>
    </div>
    <canvas id="dnCanvas" aria-label="صحنهٔ بازی دایناسور"></canvas>
    <div id="dnGate"></div>
    <p class="ap-msg" id="dnMsg">برای شروع Space را بزن یا روی صفحه ضربه بزن.</p>`;

  const W = 600, H = 200, GROUND = 170, DX = 50;
  const GRAVITY = 2200, JUMP_V = -620;
  const canvas = $('dnCanvas');
  const ctx = fitCanvas(canvas, W, H);
  const msg = $('dnMsg');
  const gateHost = $('dnGate');
  const loop = makeLoop(step);
  const stars = Array.from({ length: 22 }, () => ({ x: rnd(0, W), y: rnd(8, 110) }));

  let st = null;
  let best = store.get('best-dino', 0);

  function fresh() {
    return {
      phase: 'idle',          // idle | play | paused | gate | over
      score: 0,
      speed: 360,
      lives: 3,
      night: false,
      nextGate: 250,
      spawnIn: 320,
      hold: false,
      dino: { y: GROUND, vy: 0, onGround: true, duck: false, legT: 0 },
      obstacles: [],
      clouds: [rnd(60, 200), rnd(260, 400), rnd(440, 560)].map((x, i) => ({ x, y: 30 + i * 18, s: 0.8 + Math.random() * 0.5 })),
      bumps: Array.from({ length: 9 }, () => ({ x: rnd(0, W), w: rnd(2, 6) }))
    };
  }
  st = fresh();

  const hud = () => {
    $('dnScore').textContent = fa(Math.floor(st.score));
    $('dnHi').textContent = fa(Math.max(best, Math.floor(st.score)));
    $('dnLives').textContent = Array.from({ length: 3 }, (_, i) => (i < st.lives ? '❤' : '♡')).join(' ');
    $('dnPause').textContent = st.phase === 'paused' ? '▶ ادامه' : '⏸ مکث';
  };

  function start() {
    const keepBest = best;
    st = fresh();
    best = keepBest;
    st.phase = 'play';
    gateHost.innerHTML = '';
    setMsg(msg, '');
    hud();
  }

  function gameOver() {
    st.phase = 'over';
    const score = Math.floor(st.score);
    if (score > best) {
      best = score;
      store.set('best-dino', best);
    }
    setMsg(msg, `باختی! امتیاز ${fa(score)}. برای بازی دوباره Space را بزن یا روی صفحه ضربه بزن.`, 'bad');
    hud();
  }

  function togglePause() {
    if (st.phase === 'play') {
      st.phase = 'paused';
      setMsg(msg, 'مکث شد. برای ادامه ⏸ را بزن یا P را فشار بده.');
    } else if (st.phase === 'paused') {
      st.phase = 'play';
      setMsg(msg, '');
    }
    hud();
  }

  // هر ضربه/کلید: اگر بازی تمام شده یا منتظر است، شروع کن؛ وگرنه بپر.
  function act() {
    if (st.phase === 'idle' || st.phase === 'over') { start(); }
    if (st.phase === 'play' && st.dino.onGround) {
      st.dino.vy = JUMP_V;
      st.dino.onGround = false;
    }
  }

  function openGate() {
    st.phase = 'gate';
    st.nextGate = st.score + rnd(230, 280);
    const item = makeMath(gradeNow());
    gateHost.innerHTML = '';
    const head = document.createElement('p');
    head.className = 'ap-msg';
    head.textContent = '🚧 دروازهٔ ریاضی! جواب درست را بده تا ادامه دهی.';
    const card = quizCard(item, ok => {
      if (ok) {
        st.score += 50;
        setMsg(msg, 'آفرین! ۵۰ امتیاز جایزه گرفتی.', 'good');
      } else {
        st.lives -= 1;
        setMsg(msg, `غلط بود. جواب درست: ${fa(item.answer)}`, 'bad');
      }
      hud();
      setTimeout(() => {
        gateHost.innerHTML = '';
        if (st.lives <= 0) { gameOver(); return; }
        if (st.phase === 'gate') st.phase = 'play';
        hud();
      }, 1000);
    });
    gateHost.append(head, card);
    hud();
  }

  function spawnObstacle() {
    const roll = Math.random();
    if (st.score > 80 && roll < 0.25) {
      const top = pick([130, 100, 70]);
      st.obstacles.push({ type: 'bird', x: W + 20, y: top, w: 44, h: 30, f: 0 });
    } else {
      const n = pick([1, 1, 2, 3]);
      const big = Math.random() < 0.3;
      st.obstacles.push({ type: 'cactus', x: W + 20, n, big, w: n * 18, h: big ? 50 : 35 });
    }
    st.spawnIn = Math.round(st.speed * (0.9 + Math.random() * 0.7)) + 80;
  }

  function dinoBox() {
    const d = st.dino;
    return d.duck && d.onGround
      ? { x: DX + 6, y: d.y - 20, w: 50, h: 16 }
      : { x: DX + 8, y: d.y - 44, w: 28, h: 40 };
  }

  function obstacleBox(o) {
    return o.type === 'bird'
      ? { x: o.x + 6, y: o.y + 6, w: o.w - 12, h: o.h - 12 }
      : { x: o.x + 3, y: GROUND - o.h + 3, w: o.w - 6, h: o.h - 3 };
  }

  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function update(dt) {
    const d = st.dino;
    const sp = st.speed;
    st.score += dt * sp * 0.05;
    st.speed = Math.min(800, 360 + st.score * 0.8);

    const band = Math.floor(st.score / 700);
    st.night = band % 2 === 1;

    // فیزیک دایناسور
    d.duck = st.hold && d.onGround;
    if (!d.onGround) {
      d.vy += GRAVITY * dt * (st.hold ? 2 : 1);
      d.y += d.vy * dt;
      if (d.y >= GROUND) { d.y = GROUND; d.vy = 0; d.onGround = true; }
    } else {
      d.legT += dt * (sp / 60);
    }

    // مانع‌ها و پس‌زمینه
    st.obstacles.forEach(o => {
      o.x -= sp * dt;
      if (o.type === 'bird') o.f += dt * 6;
    });
    st.obstacles = st.obstacles.filter(o => o.x + o.w > -20);
    st.spawnIn -= sp * dt;
    if (st.spawnIn <= 0) spawnObstacle();
    st.clouds.forEach(c => { c.x -= sp * 0.3 * dt; if (c.x < -60) c.x = W + rnd(0, 120); });
    st.bumps.forEach(b => { b.x -= sp * dt; if (b.x < -10) b.x = W + rnd(0, 80); });

    // برخورد: یعنی بازی تمام شد
    const db = dinoBox();
    if (st.obstacles.some(o => overlaps(db, obstacleBox(o)))) { gameOver(); return; }

    // دروازهٔ سؤال
    if (st.score >= st.nextGate) openGate();
    hud();
  }

  function drawCloud(x, y, s) {
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(x, y, 22 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 14 * s, y - 5 * s, 14 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDino(color) {
    const d = st.dino;
    const y = d.y;
    ctx.fillStyle = color;
    if (d.duck && d.onGround) {
      const top = y - 25;
      ctx.fillRect(DX + 2, top + 8, 40, 11);        // بدن خمیده
      ctx.fillRect(DX + 34, top + 2, 22, 10);       // سر
      ctx.fillRect(DX + 12, y - 6, 7, 6);           // پای ۱
      ctx.fillRect(DX + 26, y - 6, 7, 6);           // پای ۲
      return;
    }
    ctx.fillRect(DX + 8, y - 30, 26, 22);           // بدن
    ctx.fillRect(DX + 22, y - 47, 22, 18);          // سر
    ctx.fillRect(DX + 38, y - 40, 6, 6);            // دهان
    ctx.fillRect(DX, y - 26, 12, 8);                // دم
    ctx.fillStyle = st.night ? '#e2e8f0' : '#0b1224';
    ctx.fillRect(DX + 36, y - 43, 4, 4);            // چشم
    ctx.fillStyle = color;
    const legs = d.onGround && Math.floor(d.legT) % 2 === 0;
    if (d.onGround) {
      ctx.fillRect(DX + 12, y - 8, 6, legs ? 8 : 4);
      ctx.fillRect(DX + 22, y - 8, 6, legs ? 4 : 8);
    } else {
      ctx.fillRect(DX + 12, y - 8, 6, 8);
      ctx.fillRect(DX + 22, y - 8, 6, 8);
    }
  }

  function drawObstacle(o, color) {
    ctx.fillStyle = color;
    if (o.type === 'cactus') {
      for (let i = 0; i < o.n; i++) {
        const x = o.x + i * 18;
        ctx.fillRect(x + 5, GROUND - o.h, 8, o.h);
        ctx.fillRect(x, GROUND - o.h * 0.6, 5, 10);
        ctx.fillRect(x + 13, GROUND - o.h * 0.45, 5, 10);
      }
      return;
    }
    const wingUp = Math.floor(o.f) % 2 === 0;
    ctx.fillRect(o.x + 8, o.y + 10, 26, 10);      // بدن
    ctx.fillRect(o.x + 30, o.y + 12, 8, 6);       // سر
    ctx.fillRect(o.x + 38, o.y + 14, 6, 2);       // نوک
    if (wingUp) ctx.fillRect(o.x + 14, o.y, 12, 10);
    else ctx.fillRect(o.x + 14, o.y + 18, 12, 8);
  }

  function draw() {
    const night = st.night;
    ctx.fillStyle = night ? '#050914' : '#0b1224';
    ctx.fillRect(0, 0, W, H);
    if (night) {
      ctx.fillStyle = '#94a3b8';
      stars.forEach(s => ctx.fillRect(s.x, s.y, 2, 2));
      ctx.beginPath();
      ctx.arc(540, 40, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    st.clouds.forEach(c => drawCloud(c.x, c.y, c.s));
    const sprite = night ? '#cbd5e1' : '#e2e8f0';
    ctx.fillStyle = sprite;
    ctx.fillRect(0, GROUND + 1, W, 2);
    st.bumps.forEach(b => ctx.fillRect(b.x, GROUND + 7, b.w, 1.5));
    st.obstacles.forEach(o => drawObstacle(o, sprite));
    drawDino(sprite);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px Vazirmatn, Tahoma, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(fa(Math.floor(st.score)), W - 14, 22);

    if (st.phase === 'idle' || st.phase === 'over' || st.phase === 'paused') {
      ctx.fillStyle = 'rgba(7,11,23,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f1f5ff';
      ctx.font = 'bold 20px Vazirmatn, Tahoma, sans-serif';
      ctx.textAlign = 'center';
      const label = st.phase === 'paused' ? 'مکث' : st.phase === 'over' ? 'بازی تمام شد' : 'Space برای شروع';
      ctx.fillText(label, W / 2, 105);
    }
  }

  function step(dt) {
    if (!arcadeVisible() && st.phase === 'play') { st.phase = 'paused'; hud(); }
    if (st.phase === 'play') update(dt);
    draw();
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    const p = toLocal(canvas, e, W, H);
    if (p.y < H * 0.7) act();
    else st.hold = true;
  });
  const release = () => { st.hold = false; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', release);

  $('dnPause').addEventListener('click', togglePause);

  return {
    enter() { hud(); loop.start(); },
    leave() { loop.stop(); if (st.phase === 'play') { st.phase = 'paused'; hud(); } },
    onKey(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (!e.repeat) act();
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        st.hold = true;
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        if (!e.repeat) togglePause();
      }
    },
    onKeyUp(e) {
      if (e.code === 'ArrowDown') st.hold = false;
    }
  };
});

/* ---------- ۲. نقطه‌بازی (Dots and Boxes) با سه قانون و ربات ---------- */
const DOT_COLORS = ['#a78bfa', '#22d3ee', '#f472b6', '#facc15'];
register('dots', '🔴 نقطه‌بازی', view => {
  view.innerHTML = `
    <p class="ap-help">راهنما: روی فاصلهٔ بین دو نقطه ضربه بزن تا خط کشیده شود.
    <b>کلاسیک</b>: با کامل کردن هر مربع یک امتیاز می‌گیری و دوباره نوبتت می‌شود.
    <b>نساختن مربع</b>: ساختن مربع جریمه دارد و کمترین جریمه برنده است.
    <b>مثلث‌ساز بازنده</b>: قطری‌ها هم کشیده می‌شوند؛ ساختن هر مثلث جریمه دارد.</p>
    <div class="ap-top" style="justify-content:flex-start">
      <label>تعداد بازیکن<select id="dtPlayers"><option value="2">۲ نفر</option><option value="3">۳ نفر</option><option value="4">۴ نفر</option></select></label>
      <label>اندازهٔ صفحه<select id="dtSize"><option value="4">۴ × ۴ نقطه</option><option value="5" selected>۵ × ۵ نقطه</option><option value="6">۶ × ۶ نقطه</option></select></label>
      <label>قانون<select id="dtRule"><option value="classic">کلاسیک (بیشترین مربع)</option><option value="nobox">نساختن مربع</option><option value="tri">مثلث‌ساز بازنده</option></select></label>
    </div>
    <div class="ap-top" id="dtSeats" style="justify-content:flex-start"></div>
    <div class="ap-hud" id="dtScores"></div>
    <div class="ap-dots-wrap"><canvas class="ap-dots" id="dtCanvas" aria-label="صفحهٔ نقطه‌بازی"></canvas></div>
    <div class="ap-top" style="margin-top:10px"><button class="ap-btn" id="dtNew" type="button">بازی تازه</button><span id="dtTurn" class="ap-msg"></span></div>
    <p class="ap-msg" id="dtMsg"></p>`;

  const W = 400, PAD = 36;
  const canvas = $('dtCanvas');
  const ctx = fitCanvas(canvas, W, W);
  const playersSel = $('dtPlayers');
  const sizeSel = $('dtSize');
  const ruleSel = $('dtRule');
  const seatsHost = $('dtSeats');
  const msg = $('dtMsg');
  const seatTypes = ['h', 'b', 'b', 'b'];   // h = انسان، b = ربات
  let G = null;
  let gidCounter = 0;
  let hoverId = -1;

  const seatName = i => (G && G.types[i] === 'b' ? `ربات ${fa(i + 1)}` : `بازیکن ${fa(i + 1)}`);

  function renderSeats() {
    const P = Number(playersSel.value);
    let html = '';
    for (let i = 0; i < P; i++) {
      html += `<label>بازیکن ${fa(i + 1)}<select data-seat="${i}">
        <option value="h"${seatTypes[i] === 'h' ? ' selected' : ''}>انسان</option>
        <option value="b"${seatTypes[i] === 'b' ? ' selected' : ''}>ربات</option></select></label>`;
    }
    seatsHost.innerHTML = html;
    seatsHost.querySelectorAll('select').forEach(sel => sel.addEventListener('change', () => {
      seatTypes[Number(sel.dataset.seat)] = sel.value;
      newGame();
    }));
  }

  // ساخت صفحه: یال‌های افقی و عمودی؛ در مثلث‌ساز قطرهای هر خانه هم.
  function buildGame() {
    const n = Number(sizeSel.value);
    const P = Number(playersSel.value);
    const rule = ruleSel.value;
    const edges = [];
    const addEdge = (r1, c1, r2, c2, kind) => {
      const e = { id: edges.length, a: r1 * n + c1, b: r2 * n + c2, kind, drawn: false, owner: -1, cells: [] };
      edges.push(e);
      return e;
    };
    const hId = [];
    const vId = [];
    for (let r = 0; r < n; r++) {
      hId[r] = [];
      for (let c = 0; c < n - 1; c++) hId[r][c] = addEdge(r, c, r, c + 1, 'h').id;
    }
    for (let r = 0; r < n - 1; r++) {
      vId[r] = [];
      for (let c = 0; c < n; c++) vId[r][c] = addEdge(r, c, r + 1, c, 'v').id;
    }
    const m = n - 1;                       // تعداد مربع‌ها در هر ضلع
    const cellIndex = (r, c) => r * m + c;
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < m; c++) {
        const sides = [hId[r][c], hId[r + 1][c], vId[r][c], vId[r][c + 1]];
        sides.forEach(id => edges[id].cells.push(cellIndex(r, c)));
      }
    }
    if (rule === 'tri') {
      for (let r = 0; r < m; r++) {
        for (let c = 0; c < m; c++) {
          addEdge(r, c, r + 1, c + 1, 'd');
          addEdge(r, c + 1, r + 1, c, 'd');
        }
      }
    }
    const adj = Array.from({ length: n * n }, () => new Set());
    return {
      gid: ++gidCounter, n, m, P, rule, edges, adj,
      cellSides: new Array(m * m).fill(0),
      cellOwner: new Array(m * m).fill(-1),
      drawnCount: 0,
      score: new Array(P).fill(0),
      pen: new Array(P).fill(0),
      types: seatTypes.slice(0, P),
      turn: 0, over: false, busy: false
    };
  }

  const dotXY = (g, dot) => ({
    x: PAD + (dot % g.n) * ((W - 2 * PAD) / (g.n - 1)),
    y: PAD + Math.floor(dot / g.n) * ((W - 2 * PAD) / (g.n - 1))
  });

  // بدون تغییر صفحه: چند مربع کامل می‌شود، چند مثلث ساخته می‌شود
  function evaluate(g, id) {
    const e = g.edges[id];
    let completes = 0;
    let creates3 = 0;
    let triangles = 0;
    if (e.kind !== 'd') {
      e.cells.forEach(cell => {
        const s = g.cellSides[cell];
        if (s === 3) completes++;
        else if (s === 2) creates3++;
      });
    }
    if (g.rule === 'tri') {
      g.adj[e.a].forEach(w => { if (g.adj[e.b].has(w)) triangles++; });
    }
    return { completes, creates3, triangles };
  }

  function applyMove(g, id, p) {
    const e = g.edges[id];
    const info = evaluate(g, id);
    e.drawn = true;
    e.owner = p;
    g.drawnCount++;
    g.adj[e.a].add(e.b);
    g.adj[e.b].add(e.a);
    if (e.kind !== 'd') {
      e.cells.forEach(cell => {
        g.cellSides[cell]++;
        if (g.cellSides[cell] === 4) g.cellOwner[cell] = p;
      });
    }
    let again = false;
    if (g.rule === 'classic') {
      if (info.completes > 0) { g.score[p] += info.completes; again = true; }
    } else if (g.rule === 'nobox') {
      g.pen[p] += info.completes;
    } else {
      g.pen[p] += info.triangles;
    }
    if (!again) g.turn = (g.turn + 1) % g.P;
    return info;
  }

  // ربات: قوانین را رعایت می‌کند و بهترین حرکت را با کمی تصادف انتخاب می‌کند.
  function botChoose(g) {
    let best = [];
    let bestScore = -Infinity;
    g.edges.forEach(e => {
      if (e.drawn) return;
      const info = evaluate(g, e.id);
      let s;
      if (g.rule === 'classic') {
        // اول مربع بگیر؛ وگرنه حرکتی که کمترین مربع «سه‌ضلعی» به حریف می‌دهد
        s = info.completes > 0 ? 1000 + info.completes * 10 : -info.creates3 * 100;
      } else if (g.rule === 'nobox') {
        // مربع کامل نکن؛ اگر ممکن است مربع سه‌ضلعی بساز تا حریف محدود شود
        s = -info.completes * 1000 + (info.creates3 > 0 ? 60 : 0);
      } else {
        // مثلث نساز؛ یال‌های افقی و عمودی امن‌ترند
        s = -info.triangles * 1000 + (e.kind === 'd' ? -8 : 0);
      }
      s += Math.random() * 4;
      if (s > bestScore + 1e-9) { bestScore = s; best = [e.id]; }
      else if (Math.abs(s - bestScore) <= 1e-9) best.push(e.id);
    });
    return pick(best);
  }

  function nearestEdge(g, p, limit) {
    let bestId = -1;
    let bestD = limit;
    g.edges.forEach(e => {
      if (e.drawn) return;
      const A = dotXY(g, e.a);
      const B = dotXY(g, e.b);
      const dx = B.x - A.x, dy = B.y - A.y;
      const t = Math.max(0, Math.min(1, ((p.x - A.x) * dx + (p.y - A.y) * dy) / (dx * dx + dy * dy)));
      const d = Math.hypot(p.x - (A.x + t * dx), p.y - (A.y + t * dy));
      if (d < bestD) { bestD = d; bestId = e.id; }
    });
    return bestId;
  }

  function winnerText(g) {
    const vals = g.rule === 'classic' ? g.score : g.pen;
    const best = g.rule === 'classic' ? Math.max(...vals) : Math.min(...vals);
    const winners = vals.map((v, i) => (v === best ? i : -1)).filter(i => i >= 0);
    const label = i => `${seatName(i)} (${g.rule === 'classic' ? fa(g.score[i]) + ' مربع' : fa(g.pen[i]) + ' جریمه'})`;
    return winners.length === 1
      ? `برندهٔ بازی: ${label(winners[0])}`
      : `مساوی! ${winners.map(label).join('، ')}`;
  }

  function render() {
    if (!G) return;
    const g = G;
    ctx.fillStyle = '#070b17';
    ctx.fillRect(0, 0, W, W);
    // مربع‌های تصاحب‌شده
    if (g.rule === 'classic') {
      for (let cell = 0; cell < g.m * g.m; cell++) {
        const owner = g.cellOwner[cell];
        if (owner < 0) continue;
        const r = Math.floor(cell / g.m), c = cell % g.m;
        const A = dotXY(g, r * g.n + c);
        const B = dotXY(g, (r + 1) * g.n + c + 1);
        ctx.fillStyle = DOT_COLORS[owner] + '55';
        ctx.fillRect(A.x, A.y, B.x - A.x, B.y - A.y);
      }
    }
    // یال‌ها
    g.edges.forEach(e => {
      const A = dotXY(g, e.a);
      const B = dotXY(g, e.b);
      ctx.lineCap = 'round';
      if (e.drawn) {
        ctx.strokeStyle = DOT_COLORS[e.owner];
        ctx.lineWidth = e.kind === 'd' ? 4 : 6;
        ctx.setLineDash(e.kind === 'd' ? [6, 4] : []);
      } else if (e.id === hoverId && g.types[g.turn] === 'h' && !g.over) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 5;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = e.kind === 'd' ? '#2b3a57' : '#33415f';
        ctx.lineWidth = e.kind === 'd' ? 2 : 3;
        ctx.setLineDash(e.kind === 'd' ? [4, 4] : []);
      }
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    // نقطه‌ها
    ctx.fillStyle = '#e2e8f0';
    for (let dot = 0; dot < g.n * g.n; dot++) {
      const P = dotXY(g, dot);
      ctx.beginPath();
      ctx.arc(P.x, P.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    renderHud();
  }

  function renderHud() {
    const g = G;
    const host = $('dtScores');
    host.innerHTML = g.types.map((_, i) => {
      const value = g.rule === 'classic' ? `${fa(g.score[i])} مربع` : `${fa(g.pen[i])} جریمه`;
      return `<span style="border-color:${DOT_COLORS[i]}">${seatName(i)}: <strong>${value}</strong></span>`;
    }).join('');
    const turnEl = $('dtTurn');
    if (g.over) turnEl.textContent = '';
    else if (g.busy) turnEl.textContent = `نوبت ${seatName(g.turn)}… (ربات فکر می‌کند)`;
    else turnEl.textContent = `نوبت ${seatName(g.turn)}`;
  }

  function endGame() {
    G.over = true;
    G.busy = false;
    setMsg(msg, winnerText(G), 'good');
    render();
  }

  // اگر نوبت با ربات است، با کمی تأخیر حرکت او را انجام بده.
  function scheduleBot() {
    const g = G;
    if (!g || g.over || g.types[g.turn] !== 'b') {
      if (g) g.busy = false;
      render();
      return;
    }
    g.busy = true;
    render();
    setTimeout(() => {
      if (!G || G.gid !== g.gid || G.over) return;
      const id = botChoose(g);
      applyMove(g, id, g.turn);
      afterMove(g);
    }, 420);
  }

  function afterMove(g) {
    if (g.drawnCount === g.edges.length) { endGame(); return; }
    setMsg(msg, '');
    scheduleBot();
  }

  function newGame() {
    G = buildGame();
    seatTypes.forEach((t, i) => { if (i < G.P) G.types[i] = t; });
    hoverId = -1;
    const rules = { classic: 'کلاسیک: هرکس مربع بیشتری بگیرد برنده است.', nobox: 'نساختن مربع: ساختن هر مربع جریمه دارد؛ کمترین جریمه برنده است.', tri: 'مثلث‌ساز بازنده: ساختن هر مثلث جریمه دارد؛ کمترین جریمه برنده است.' };
    setMsg(msg, rules[G.rule]);
    render();
    scheduleBot();
  }

  canvas.addEventListener('pointermove', e => {
    if (!G || G.over) return;
    hoverId = nearestEdge(G, toLocal(canvas, e, W, W), 14);
    render();
  });
  canvas.addEventListener('pointerleave', () => { hoverId = -1; if (G) render(); });
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (!G || G.over || G.busy || G.types[G.turn] !== 'h') return;
    const id = nearestEdge(G, toLocal(canvas, e, W, W), 14);
    if (id < 0) return;
    applyMove(G, id, G.turn);
    hoverId = -1;
    afterMove(G);
  });

  playersSel.addEventListener('change', () => { renderSeats(); newGame(); });
  sizeSel.addEventListener('change', newGame);
  ruleSel.addEventListener('change', newGame);
  $('dtNew').addEventListener('click', newGame);

  renderSeats();
  newGame();

  return {
    enter() { if (G) render(); },
    leave() { if (G && !G.over && !G.busy) render(); }
  };
});

/* ---------- ۳. مثلث‌شمار ---------- */
const triSeen = new Set();

function triCandidate(g) {
  const maxK = g <= 3 ? 3 : g <= 6 ? 5 : 9;
  const maxN = g <= 3 ? 2 : g <= 6 ? 3 : 5;
  const all = [];
  for (let k = 0; k <= maxK; k++) all.push({ type: 'base', k, sig: 'b' + k });
  for (let n = 2; n <= maxN; n++) all.push({ type: 'grid', n, sig: 'g' + n });
  let fresh = all.filter(c => !triSeen.has(c.sig));
  if (!fresh.length) { triSeen.clear(); fresh = all; }
  const c = pick(fresh);
  triSeen.add(c.sig);
  c.answer = c.type === 'base'
    ? ((c.k + 2) * (c.k + 1)) / 2
    : Math.floor((c.n * (c.n + 2) * (2 * c.n + 1)) / 8);
  return c;
}

function triOptions(answer) {
  const pool = shuffle([answer + 1, answer - 1, answer + 2, answer - 2, answer + 3, Math.round(answer * 1.5), answer + 5])
    .filter((v, i, arr) => v > 0 && v !== answer && arr.indexOf(v) === i);
  return shuffle([answer, ...pool.slice(0, 3)]);
}

// شکل: مثلث با نقطه‌های روی قاعده، یا مثلث شبکه‌ای
function triSvg(c) {
  if (c.type === 'base') {
    const k = c.k;
    const apex = { x: 150, y: 18 }, left = { x: 30, y: 200 }, right = { x: 270, y: 200 };
    let lines = `<polygon points="${apex.x},${apex.y} ${left.x},${left.y} ${right.x},${right.y}" fill="none" stroke="#67e8f9" stroke-width="3"/>`;
    for (let j = 1; j <= k; j++) {
      const x = left.x + ((right.x - left.x) * j) / (k + 1);
      lines += `<line x1="${apex.x}" y1="${apex.y}" x2="${x}" y2="${left.y}" stroke="#a78bfa" stroke-width="2.5"/>`;
      lines += `<circle cx="${x}" cy="${left.y}" r="4" fill="#f472b6"/>`;
    }
    return `<svg class="tri-svg" viewBox="0 0 300 220" role="img" aria-label="شکل مثلث">${lines}</svg>`;
  }
  const n = c.n;
  const s = Math.min(240 / n, 260 / (n * 0.866));
  const h = s * 0.866;
  const P = (r, col) => ({ x: 150 - (r * s) / 2 + col * s, y: 16 + r * h });
  let lines = '';
  for (let r = 0; r <= n; r++) {
    for (let col = 0; col <= r; col++) {
      const A = P(r, col);
      if (col < r) {
        const B = P(r, col + 1);
        lines += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="#67e8f9" stroke-width="2"/>`;
      }
      if (r < n) {
        const C = P(r + 1, col), D = P(r + 1, col + 1);
        lines += `<line x1="${A.x}" y1="${A.y}" x2="${C.x}" y2="${C.y}" stroke="#67e8f9" stroke-width="2"/>`;
        lines += `<line x1="${A.x}" y1="${A.y}" x2="${D.x}" y2="${D.y}" stroke="#67e8f9" stroke-width="2"/>`;
      }
    }
  }
  return `<svg class="tri-svg" viewBox="0 0 300 240" role="img" aria-label="شکل مثلث شبکه‌ای">${lines}</svg>`;
}

function triExplain(c) {
  if (c.type === 'base') {
    return `روی قاعده ${fa(c.k + 2)} نقطهٔ انتهایی و میانی داریم؛ هر دو تا با رأس بالا یک مثلث می‌سازند: ${fa(c.k + 2)} × ${fa(c.k + 1)} ÷ ۲ = ${fa(c.answer)}`;
  }
  return `مثلث‌ها در همهٔ اندازه‌ها شمرده می‌شوند؛ با فرمول n(n+2)(2n+1) ÷ ۸ برای n = ${fa(c.n)} می‌شود ${fa(c.answer)}`;
}

register('triangles', '🔺 مثلث‌شمار', view => {
  view.innerHTML = `
    <p class="ap-help">راهنما: تعداد کل مثلث‌های موجود در شکل را بشمار؛ مثلث‌های کوچک و بزرگ که روی هم افتاده‌اند هم حساب می‌شوند.
    هر دور ۱۰ سؤال دارد؛ جواب درست امتیاز می‌دهد و زنجیرهٔ جواب‌های درست پاداش بیشتری دارد.</p>
    <div class="ap-hud">
      <span>سؤال <strong id="trQ">۰ از ۱۰</strong></span>
      <span>امتیاز <strong id="trScore">۰</strong></span>
      <span>زنجیره <strong id="trStreak">۰</strong></span>
      <span>رکورد <strong id="trBest">${fa(store.get('best-triangles', 0))}</strong></span>
      <button class="ap-btn" id="trStart" type="button">دور تازه</button>
    </div>
    <div class="ap-card" id="trCard"><p class="ap-msg">برای شروع «دور تازه» را بزن.</p></div>`;

  let round = 0, score = 0, streak = 0, current = null, locked = false;
  const card = $('trCard');
  const setHud = () => {
    $('trQ').textContent = `${fa(Math.min(round, 10))} از ۱۰`;
    $('trScore').textContent = fa(score);
    $('trStreak').textContent = fa(streak);
  };

  function nextQuestion() {
    if (round >= 10) { finish(); return; }
    round++;
    locked = false;
    current = triCandidate(gradeNow());
    const options = triOptions(current.answer);
    card.innerHTML = '';
    const figure = document.createElement('div');
    figure.innerHTML = triSvg(current);
    const q = document.createElement('p');
    q.className = 'ap-q';
    q.textContent = 'چند مثلث در این شکل می‌بینی؟';
    const grid = document.createElement('div');
    grid.className = 'ap-opts';
    const explain = document.createElement('p');
    explain.className = 'ap-msg';
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'ap-btn';
    next.style.display = 'none';
    next.textContent = round >= 10 ? 'پایان دور' : 'سؤال بعدی';
    next.addEventListener('click', nextQuestion);
    const buttons = options.map(v => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ap-opt';
      b.dir = 'ltr';
      b.textContent = String(v);
      b.addEventListener('click', () => {
        if (locked) return;
        locked = true;
        const ok = v === current.answer;
        buttons.forEach(x => {
          x.disabled = true;
          if (Number(x.textContent) === current.answer) x.classList.add('right');
        });
        if (ok) {
          streak++;
          score += 10 + Math.min(streak, 5) * 2;
          setMsg(explain, '✔ درست! ' + triExplain(current), 'good');
        } else {
          streak = 0;
          b.classList.add('wrong');
          setMsg(explain, '✘ جواب درست ' + fa(current.answer) + ' است. ' + triExplain(current), 'bad');
        }
        setHud();
        next.style.display = '';
      });
      return b;
    });
    grid.append(...buttons);
    card.append(figure, q, grid, explain, next);
    setHud();
  }

  function finish() {
    const best = store.get('best-triangles', 0);
    if (score > best) store.set('best-triangles', score);
    $('trBest').textContent = fa(Math.max(best, score));
    card.innerHTML = `<p class="ap-q">دور تمام شد 🎉</p><p class="ap-msg good">امتیاز تو: ${fa(score)} از ${fa(200)}</p><button class="ap-btn" id="trAgain" type="button">دور تازه</button>`;
    $('trAgain').addEventListener('click', startRound);
  }

  function startRound() {
    round = 0;
    score = 0;
    streak = 0;
    nextQuestion();
  }

  $('trStart').addEventListener('click', startRound);
  return {};
});

/* ---------- ۴. مار ریاضی ---------- */
register('snake', '🐍 مار ریاضی', view => {
  view.innerHTML = `
    <p class="ap-help">راهنما: با کلیدهای جهت (یا WASD، یا دکمه‌های زیر صفحه) مار را هدایت کن و همان خانه‌ای را بخور که
    جوابش درست است. خوردن جواب غلط یک جان کم می‌کند؛ دیوار یا خودت هم همین‌طور.</p>
    <div class="ap-hud">
      <span>امتیاز <strong id="snScore">۰</strong></span>
      <span>جان <strong id="snLives">❤ ❤ ❤</strong></span>
      <span>رکورد <strong id="snHi">${fa(store.get('best-snake', 0))}</strong></span>
      <button class="ap-btn" id="snStart" type="button">شروع</button>
    </div>
    <p class="ap-q" id="snQ" dir="ltr">—</p>
    <canvas id="snCanvas" aria-label="صفحهٔ مار ریاضی"></canvas>
    <div class="ap-pad">
      <button type="button" data-dir="up">▲</button>
      <div style="flex-basis:100%;height:0"></div>
      <button type="button" data-dir="left">◀</button>
      <button type="button" data-dir="down">▼</button>
      <button type="button" data-dir="right">▶</button>
    </div>
    <p class="ap-msg" id="snMsg">برای شروع «شروع» را بزن.</p>`;

  const N = 16, CELL = 25, W = N * CELL;
  const canvas = $('snCanvas');
  const ctx = fitCanvas(canvas, W, W);
  const loop = makeLoop(step);
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  let snake = [], dir = [1, 0], queued = [], foods = [], question = null;
  let lives = 3, score = 0, phase = 'idle', acc = 0;
  let best = store.get('best-snake', 0);

  const hud = () => {
    $('snScore').textContent = fa(score);
    $('snLives').textContent = Array.from({ length: 3 }, (_, i) => (i < lives ? '❤' : '♡')).join(' ');
    $('snHi').textContent = fa(Math.max(best, score));
  };
  const occupied = (x, y) => snake.some(s => s.x === x && s.y === y) || foods.some(f => f.x === x && f.y === y);
  function freeCell() {
    let x, y, guard = 0;
    do { x = rnd(0, N - 1); y = rnd(0, N - 1); } while (occupied(x, y) && guard++ < 500);
    return { x, y };
  }

  function newQuestion() {
    question = makeMath(gradeNow());
    $('snQ').textContent = questionText(question);
    foods = question.options.map(v => ({ ...freeCell(), v, ok: v === question.answer }));
  }

  function replaceWrongFood(index) {
    let v;
    do { v = question.answer + pick([-4, -3, -2, -1, 1, 2, 3, 4, 6]) * (1 + Math.floor(Math.random() * 2)); }
    while (v === question.answer || foods.some(f => f.v === v));
    foods[index] = { ...freeCell(), v, ok: false };
  }

  function resetSnake() {
    snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
    dir = [1, 0];
    queued = [];
  }

  function start() {
    lives = 3;
    score = 0;
    acc = 0;
    resetSnake();
    newQuestion();
    phase = 'play';
    setMsg($('snMsg'), 'هر خانه‌ای که جوابش درست است را بخور!');
    hud();
  }

  function loseLife(text) {
    lives--;
    setMsg($('snMsg'), text, 'bad');
    if (lives <= 0) {
      phase = 'over';
      if (score > best) { best = score; store.set('best-snake', best); }
      setMsg($('snMsg'), `بازی تمام شد! امتیاز ${fa(score)}. برای بازی دوباره «شروع» را بزن.`, 'bad');
    } else {
      resetSnake();
    }
    hud();
  }

  function stepSnake() {
    if (queued.length) dir = queued.shift();
    const head = { x: snake[0].x + dir[0], y: snake[0].y + dir[1] };
    if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N) { loseLife('دیوار! یک جان کم شد.'); return; }
    if (snake.slice(0, -1).some(s => s.x === head.x && s.y === head.y)) { loseLife('به خودت خوردی! یک جان کم شد.'); return; }
    snake.unshift(head);
    const hit = foods.findIndex(f => f.x === head.x && f.y === head.y);
    if (hit >= 0) {
      const food = foods[hit];
      if (food.ok) {
        score += 10;
        setMsg($('snMsg'), 'آفرین! جواب درست بود.', 'good');
        newQuestion();
      } else {
        loseLife(`جواب غلط بود (${food.v}). یک جان کم شد.`);
        if (phase === 'play') replaceWrongFood(hit);
        return;
      }
    } else {
      snake.pop();
    }
    hud();
  }

  function step(dt) {
    if (!arcadeVisible() && phase === 'play') phase = 'paused';
    if (phase === 'play') {
      acc += dt * 1000;
      const interval = Math.max(90, 170 - Math.floor(score / 50) * 8);
      if (acc >= interval) { acc = 0; stepSnake(); }
    }
    draw();
  }

  function draw() {
    ctx.fillStyle = '#070b17';
    ctx.fillRect(0, 0, W, W);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= N; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, W); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(W, i * CELL); ctx.stroke();
    }
    foods.forEach(f => {
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.roundRect(f.x * CELL + 2, f.y * CELL + 2, CELL - 4, CELL - 4, 7);
      ctx.fill();
      ctx.fillStyle = '#f1f5ff';
      ctx.font = 'bold 12px Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(f.v), f.x * CELL + CELL / 2, f.y * CELL + CELL / 2 + 1);
    });
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? '#a78bfa' : '#22d3ee';
      ctx.beginPath();
      ctx.roundRect(s.x * CELL + 3, s.y * CELL + 3, CELL - 6, CELL - 6, 6);
      ctx.fill();
    });
    if (phase !== 'play') {
      ctx.fillStyle = 'rgba(7,11,23,0.5)';
      ctx.fillRect(0, 0, W, W);
    }
  }

  function setDir(name) {
    const d = DIRS[name];
    if (!d) return;
    const last = queued.length ? queued[queued.length - 1] : dir;
    if (last[0] + d[0] === 0 && last[1] + d[1] === 0) return; // برگشت به عقب ممنوع
    if (queued.length < 2) queued.push(d);
  }

  view.querySelectorAll('[data-dir]').forEach(b => b.addEventListener('click', () => setDir(b.dataset.dir)));
  $('snStart').addEventListener('click', start);

  // کشیدن انگشت یا ماوس روی بوم هم جهت را عوض می‌کند
  let touch = null;
  canvas.addEventListener('pointerdown', e => { touch = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', e => {
    if (!touch) return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    touch = null;
    if (Math.hypot(dx, dy) < 18) return;
    setDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });

  return {
    enter() { hud(); draw(); loop.start(); },
    leave() { loop.stop(); if (phase === 'play') phase = 'paused'; },
    onKey(e) {
      const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
      if (map[e.code]) { e.preventDefault(); setDir(map[e.code]); }
      else if ((e.code === 'Space' || e.code === 'Enter') && phase !== 'play' && !e.repeat) { e.preventDefault(); start(); }
    }
  };
});

/* ---------- ۵. جفت‌های ریاضی (حافظه) ---------- */
register('memory', '🃏 جفت‌های ریاضی', view => {
  view.innerHTML = `
    <p class="ap-help">راهنما: هر عبارت ریاضی را با جوابش جفت کن. هر بار دو کارت را باز می‌کنی؛ اگر جفت باشند می‌مانند.
    کمترین تعداد حرکت رکورد توست.</p>
    <div class="ap-hud">
      <span>حرکت <strong id="mmMoves">۰</strong></span>
      <span>زمان <strong id="mmTime">۰</strong> ثانیه</span>
      <span>جفت‌ها <strong id="mmPairs">۰ از ۰</strong></span>
      <span>رکورد <strong id="mmBest">${store.get('best-memory', 0) ? fa(store.get('best-memory', 0)) + ' حرکت' : '—'}</strong></span>
      <button class="ap-btn" id="mmStart" type="button">بازی تازه</button>
    </div>
    <div class="ap-grid" id="mmGrid"></div>
    <p class="ap-msg" id="mmMsg">برای شروع «بازی تازه» را بزن.</p>`;

  let cards = [], open = [], matched = 0, moves = 0, busy = false, startedAt = 0, timer = 0, pairTotal = 0;
  const grid = $('mmGrid');

  function stopTimer() { if (timer) clearInterval(timer); timer = 0; }

  function newDeck() {
    stopTimer();
    const g = gradeNow();
    const pairs = g <= 3 ? 6 : g <= 6 ? 8 : 10;
    const cols = g <= 3 ? 4 : g <= 6 ? 4 : 5;
    pairTotal = pairs;
    const items = Array.from({ length: pairs }, (_, i) => {
      const q = makeMath(g);
      const expr = q.text + (q.ask ? ' → x' : '');
      return [
        { pid: i, label: expr, kind: 'e' },
        { pid: i, label: String(q.answer), kind: 'r' }
      ];
    }).flat();
    cards = shuffle(items).map((c, i) => ({ ...c, i, up: false, done: false }));
    open = [];
    matched = 0;
    moves = 0;
    busy = false;
    startedAt = 0;
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    setMsg($('mmMsg'), 'کارتی را باز کن.');
    render();
  }

  function render() {
    grid.innerHTML = '';
    cards.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dir = 'ltr';
      b.className = 'ap-cell' + (c.done ? ' match' : c.up ? ' flip' : '');
      b.textContent = c.up || c.done ? c.label : '?';
      b.disabled = c.done;
      b.addEventListener('click', () => flip(c.i));
      grid.append(b);
    });
    $('mmMoves').textContent = fa(moves);
    $('mmPairs').textContent = `${fa(matched)} از ${fa(pairTotal)}`;
  }

  function flip(i) {
    const c = cards[i];
    if (busy || c.up || c.done) return;
    if (!startedAt) {
      startedAt = Date.now();
      timer = setInterval(() => { $('mmTime').textContent = fa(Math.floor((Date.now() - startedAt) / 1000)); }, 500);
    }
    c.up = true;
    open.push(c);
    render();
    if (open.length < 2) return;
    moves++;
    busy = true;
    const [a, b] = open;
    if (a.pid === b.pid && a.kind !== b.kind) {
      a.done = b.done = true;
      matched++;
      open = [];
      busy = false;
      setMsg($('mmMsg'), 'آفرین! جفت پیدا شد.', 'good');
      render();
      if (matched === pairTotal) finish();
    } else {
      setMsg($('mmMsg'), 'جفت نیست؛ دوباره تلاش کن.', 'bad');
      render();
      setTimeout(() => {
        a.up = b.up = false;
        open = [];
        busy = false;
        render();
      }, 900);
    }
  }

  function finish() {
    stopTimer();
    const secs = Math.floor((Date.now() - startedAt) / 1000);
    const bestMoves = store.get('best-memory', 0);
    if (!bestMoves || moves < bestMoves) store.set('best-memory', moves);
    $('mmBest').textContent = fa(Math.min(bestMoves || moves, moves)) + ' حرکت';
    setMsg($('mmMsg'), `همهٔ جفت‌ها پیدا شد! ${fa(moves)} حرکت و ${fa(secs)} ثانیه. 🎉`, 'good');
  }

  $('mmStart').addEventListener('click', newDeck);
  return {
    enter() { if (!cards.length) newDeck(); },
    leave() { stopTimer(); }
  };
});

/* ---------- ۶. بالون‌ترکان ---------- */
register('balloons', '🎈 بالون‌ترکان', view => {
  view.innerHTML = `
    <p class="ap-help">راهنما: سؤال بالای صفحه را ببین و بالونی را که جوابش درست است بترکان. هر بالون درست که از بالای صفحه بیرون برود یک جان کم می‌کند؛
    بالون غلط را بترکانی هم یک جان کم می‌شود.</p>
    <div class="ap-hud">
      <span>امتیاز <strong id="blScore">۰</strong></span>
      <span>جان <strong id="blLives">❤ ❤ ❤</strong></span>
      <span>رکورد <strong id="blHi">${fa(store.get('best-balloons', 0))}</strong></span>
      <button class="ap-btn ghost" id="blPause" type="button">⏸ مکث</button>
      <button class="ap-btn" id="blStart" type="button">شروع</button>
    </div>
    <p class="ap-q" id="blQ" dir="ltr">—</p>
    <canvas id="blCanvas" aria-label="صحنهٔ بالون‌ترکان"></canvas>
    <p class="ap-msg" id="blMsg">برای شروع «شروع» را بزن و روی بالون‌ها ضربه بزن.</p>`;

  const W = 600, H = 420;
  const canvas = $('blCanvas');
  const ctx = fitCanvas(canvas, W, H);
  const loop = makeLoop(step);
  const COLORS = ['#f472b6', '#a78bfa', '#22d3ee', '#facc15', '#34d399', '#fb923c'];
  let balloons = [], pending = [], question = null;
  let lives = 3, score = 0, phase = 'idle', t = 0;
  let best = store.get('best-balloons', 0);

  const hud = () => {
    $('blScore').textContent = fa(score);
    $('blLives').textContent = Array.from({ length: 3 }, (_, i) => (i < lives ? '❤' : '♡')).join(' ');
    $('blHi').textContent = fa(Math.max(best, score));
    $('blPause').textContent = phase === 'paused' ? '▶ ادامه' : '⏸ مکث';
  };

  // دور تازه: سؤال تازه و پنج بالون که یکی‌یکی از پایین می‌آیند
  function newRound() {
    question = makeMath(gradeNow());
    $('blQ').textContent = questionText(question);
    balloons = [];
    // مقادیر بالون‌ها یکتا هستند تا جواب درست با بالون دیگری اشتباه نشود
    const extra = question.answer + pick([-7, -5, 5, 7, 9]);
    const values = shuffle(question.options.includes(extra) ? [...question.options] : [...question.options, extra]);
    const xs = shuffle([70, 170, 270, 370, 470, 540]);
    pending = values.map((v, i) => ({ at: t + i * 0.7, v, ok: v === question.answer, x: xs[i] }));
  }

  function start() {
    score = 0;
    lives = 3;
    t = 0;
    phase = 'play';
    newRound();
    setMsg($('blMsg'), '');
    hud();
  }

  function spawnDue() {
    pending = pending.filter(p => {
      if (t < p.at) return true;
      balloons.push({ x: p.x, y: H + 40, r: 34, vy: 52 + score * 0.25, v: p.v, ok: p.ok, color: pick(COLORS), wob: Math.random() * 6 });
      return false;
    });
  }

  function step(dt) {
    if (!arcadeVisible() && phase === 'play') { phase = 'paused'; hud(); }
    if (phase !== 'play') { draw(); return; }
    t += dt;
    spawnDue();
    balloons.forEach(b => { b.y -= b.vy * dt; b.wob += dt * 2; });
    // بالونِ درست که فرار کند یک جان کم می‌کند
    const escaped = balloons.filter(b => b.y + b.r < 0);
    balloons = balloons.filter(b => b.y + b.r >= 0);
    if (escaped.some(b => b.ok)) {
      lives--;
      setMsg($('blMsg'), `جواب درست فرار کرد! جواب: ${question.answer}`, 'bad');
      if (lives <= 0) { gameOver(); return; }
      newRound();
    } else if (!balloons.length && !pending.length) {
      newRound();
    }
    hud();
    draw();
  }

  function gameOver() {
    phase = 'over';
    if (score > best) { best = score; store.set('best-balloons', best); }
    setMsg($('blMsg'), `بازی تمام شد! امتیاز ${fa(score)}. برای بازی دوباره «شروع» را بزن.`, 'bad');
    hud();
  }

  function pop(p) {
    const b = balloons[p];
    if (!b) return;
    if (b.ok) {
      score += 10;
      setMsg($('blMsg'), 'درست بود! +۱۰', 'good');
      newRound();
    } else {
      balloons.splice(p, 1);
      lives--;
      setMsg($('blMsg'), `بالون غلط بود (${b.v}). یک جان کم شد.`, 'bad');
      if (lives <= 0) gameOver();
    }
    hud();
  }

  function draw() {
    ctx.fillStyle = '#070b17';
    ctx.fillRect(0, 0, W, H);
    balloons.forEach(b => {
      const x = b.x + Math.sin(b.wob) * 8;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(x, b.y, b.r * 0.9, b.r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, b.y + b.r);
      ctx.quadraticCurveTo(x - 10, b.y + b.r + 16, x + 2, b.y + b.r + 34);
      ctx.stroke();
      ctx.fillStyle = '#0b1224';
      ctx.font = 'bold 20px Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(b.v), x, b.y);
    });
    if (phase !== 'play') {
      ctx.fillStyle = 'rgba(7,11,23,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f1f5ff';
      ctx.font = 'bold 22px Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(phase === 'paused' ? 'مکث' : phase === 'over' ? 'تمام شد' : 'آمادهٔ شروع؟', W / 2, H / 2);
    }
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (phase !== 'play') return;
    const p = toLocal(canvas, e, W, H);
    let hit = -1;
    balloons.forEach((b, i) => {
      const x = b.x + Math.sin(b.wob) * 8;
      if (Math.hypot(p.x - x, p.y - b.y) < b.r + 4) hit = i;
    });
    if (hit >= 0) pop(hit);
  });

  function togglePause() {
    if (phase === 'play') { phase = 'paused'; setMsg($('blMsg'), 'مکث شد.'); }
    else if (phase === 'paused') { phase = 'play'; setMsg($('blMsg'), ''); }
    hud();
  }

  $('blStart').addEventListener('click', start);
  $('blPause').addEventListener('click', togglePause);

  return {
    enter() { hud(); draw(); loop.start(); },
    leave() { loop.stop(); if (phase === 'play') { phase = 'paused'; hud(); } },
    onKey(e) {
      if ((e.code === 'Space' || e.code === 'Enter') && phase !== 'play' && !e.repeat) { e.preventDefault(); start(); }
      else if (e.code === 'KeyP' && !e.repeat) togglePause();
    }
  };
});

/* ---------- ۷. سودوکو (اندازهٔ جدول بر اساس پایهٔ تحصیلی) ---------- */
register('sudoku', '🧩 سودوکو', view => {
  view.innerHTML = `
    <p class="ap-help">راهنما: خانه‌ای را بزن، بعد عدد را از کلید عددی یا دکمه‌های پایین انتخاب کن. هر ردیف، ستون و جعبه باید همهٔ عددها را فقط یک بار داشته باشد. پایهٔ تحصیلی اندازهٔ جدول را تعیین می‌کند: پایه‌های ۱ تا ۳ جدول ۴×۴، ۴ تا ۶ جدول ۶×۶ و ۷ تا ۱۲ جدول ۹×۹.</p>
    <div class="ap-hud">
      <span>زمان <strong id="skTime">۰:۰۰</strong></span>
      <span>جدول <strong id="skSize">—</strong></span>
      <span>برد‌ها <strong id="skWins">${fa(store.get('sudoku-wins', 0))}</strong></span>
    </div>
    <div id="skBoard" class="sk-board" role="grid" aria-label="صفحهٔ سودوکو"></div>
    <div id="skPad" class="sk-pad"></div>
    <div class="ap-actions">
      <button class="ap-btn" id="skNew" type="button">جدول تازه</button>
      <button class="ap-btn ghost" id="skCheck" type="button">بررسی</button>
      <button class="ap-btn ghost" id="skHint" type="button">راهنمایی (+۳۰ ثانیه)</button>
      <button class="ap-btn ghost" id="skErase" type="button">پاک‌کردن</button>
    </div>
    <p class="ap-msg" id="skMsg"></p>`;

  const board = $('skBoard'), pad = $('skPad'), msgEl = $('skMsg');
  let n = 9, bw = 3, bh = 3, sol = [], grid = [], given = [], sel = null;
  let wrong = new Set(), done = false, elapsed = 0, timer = null, builtFor = null;

  const sizeFor = g => (g <= 3 ? [4, 2, 2] : g <= 6 ? [6, 3, 2] : [9, 3, 3]);
  const mmss = s => fa(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
  const say = (t, bad) => { msgEl.textContent = t; msgEl.classList.toggle('ap-bad', !!bad); };
  const setTime = () => { $('skTime').textContent = mmss(elapsed); };

  function startTimer() {
    stopTimer();
    if (done) return;
    timer = setInterval(() => { elapsed++; setTime(); }, 1000);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  function ok(g, r, c, v) {
    for (let i = 0; i < n; i++) if (g[r][i] === v || g[i][c] === v) return false;
    const r0 = Math.floor(r / bh) * bh, c0 = Math.floor(c / bw) * bw;
    for (let i = 0; i < bh; i++) for (let j = 0; j < bw; j++) if (g[r0 + i][c0 + j] === v) return false;
    return true;
  }
  function fill(g, pos = 0) {
    if (pos === n * n) return true;
    const r = Math.floor(pos / n), c = pos % n;
    if (g[r][c]) return fill(g, pos + 1);
    for (const v of shuffle(Array.from({ length: n }, (_, i) => i + 1))) {
      if (ok(g, r, c, v)) {
        g[r][c] = v;
        if (fill(g, pos + 1)) return true;
        g[r][c] = 0;
      }
    }
    return false;
  }
  // درست بودن کل جدول با قانون (نه فقط مقایسه با جواب ذخیره‌شده)
  function solvedByRules(g) {
    const good = arr => new Set(arr).size === n && arr.every(v => v >= 1 && v <= n);
    for (let i = 0; i < n; i++) {
      if (!good(g[i]) || !good(g.map(row => row[i]))) return false;
    }
    for (let br = 0; br < n / bh; br++) for (let bc = 0; bc < n / bw; bc++) {
      const box = [];
      for (let i = 0; i < bh; i++) for (let j = 0; j < bw; j++) box.push(g[br * bh + i][bc * bw + j]);
      if (!good(box)) return false;
    }
    return true;
  }

  function newPuzzle() {
    const g = gradeNow();
    [n, bw, bh] = sizeFor(g);
    builtFor = g;
    sol = Array.from({ length: n }, () => Array(n).fill(0));
    fill(sol);
    const blanks = n === 4 ? 7 : n === 6 ? 16 : g >= 10 ? 50 : 42;
    grid = sol.map(row => row.slice());
    given = Array.from({ length: n }, () => Array(n).fill(true));
    shuffle(Array.from({ length: n * n }, (_, i) => i)).slice(0, blanks).forEach(p => {
      const r = Math.floor(p / n), c = p % n;
      grid[r][c] = 0;
      given[r][c] = false;
    });
    sel = null; wrong = new Set(); done = false; elapsed = 0;
    $('skSize').textContent = `${fa(n)}×${fa(n)}`;
    setTime();
    render();
    say('یک خانهٔ خالی را انتخاب کن و عدد بگذار.');
    startTimer();
  }

  function render() {
    board.style.setProperty('--sk-n', n);
    board.replaceChildren();
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sk-cell';
      if (c % bw === 0 && c > 0) b.classList.add('sk-gap-l');
      if (r % bh === 0 && r > 0) b.classList.add('sk-gap-t');
      if (given[r][c]) b.classList.add('given');
      if (sel && sel.r === r && sel.c === c) b.classList.add('sel');
      else if (sel && grid[r][c] && grid[r][c] === grid[sel.r][sel.c]) b.classList.add('same');
      if (wrong.has(r * n + c)) b.classList.add('wrong');
      b.textContent = grid[r][c] ? fa(grid[r][c]) : '';
      b.setAttribute('aria-label', `ردیف ${fa(r + 1)} ستون ${fa(c + 1)}`);
      b.addEventListener('click', () => { if (!done) { sel = { r, c }; render(); } });
      board.append(b);
    }
    pad.replaceChildren();
    for (let v = 1; v <= n; v++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = fa(v);
      b.addEventListener('click', () => place(v));
      pad.append(b);
    }
    const erase = document.createElement('button');
    erase.type = 'button';
    erase.textContent = '✕';
    erase.addEventListener('click', () => place(0));
    pad.append(erase);
  }

  function place(v) {
    if (done) return;
    if (!sel) { say('اول یک خانه را انتخاب کن.', true); return; }
    const { r, c } = sel;
    if (given[r][c]) { say('این خانه از قبل پر است.', true); return; }
    grid[r][c] = v;
    wrong.delete(r * n + c);
    if (v) say('');
    render();
    if (v && solvedByRules(grid)) win();
  }

  function win() {
    done = true;
    stopTimer();
    store.set('sudoku-wins', store.get('sudoku-wins', 0) + 1);
    $('skWins').textContent = fa(store.get('sudoku-wins', 0));
    say(`🏆 آفرین! جدول را در ${mmss(elapsed)} کامل و درست حل کردی.`);
    sel = null;
    render();
  }

  function check() {
    wrong = new Set();
    let filled = 0, bad = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!grid[r][c] || given[r][c]) continue;
      filled++;
      if (grid[r][c] !== sol[r][c]) { wrong.add(r * n + c); bad++; }
    }
    render();
    if (!filled) say('هنوز خانه‌ای پر نشده است.', true);
    else if (bad) say(`${fa(bad)} خانهٔ قرمز اشتباه است؛ اصلاحشان کن.`, true);
    else say('تا اینجا همه‌چیز درست است. ادامه بده!');
  }

  function hint() {
    if (done) return;
    const empty = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!grid[r][c]) empty.push({ r, c });
    if (!empty.length) return;
    const { r, c } = pick(empty);
    grid[r][c] = sol[r][c];
    given[r][c] = true;
    wrong.delete(r * n + c);
    elapsed += 30;
    setTime();
    sel = { r, c };
    say('یک خانه برایت باز شد (۳۰ ثانیه جریمه).');
    render();
    if (solvedByRules(grid)) win();
  }

  function move(dr, dc) {
    if (!sel) sel = { r: 0, c: 0 };
    else sel = { r: Math.min(n - 1, Math.max(0, sel.r + dr)), c: Math.min(n - 1, Math.max(0, sel.c + dc)) };
    render();
  }

  $('skNew').addEventListener('click', newPuzzle);
  $('skCheck').addEventListener('click', check);
  $('skHint').addEventListener('click', hint);
  $('skErase').addEventListener('click', () => place(0));

  return {
    enter() {
      if (!grid.length || builtFor !== gradeNow()) newPuzzle();
      else { render(); if (!done) startTimer(); }
    },
    leave() { stopTimer(); },
    onKey(e) {
      if (done && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const d = /^[1-9]$/.test(e.key) ? Number(e.key) : (e.code && e.code.startsWith('Numpad') && /^[1-9]$/.test(e.code.slice(6)) ? Number(e.code.slice(6)) : null);
      if (d !== null && d <= n) { e.preventDefault(); place(d); }
      else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); place(0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1, 0); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(1, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(0, -1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); move(0, 1); }
    }
  };
});

/* ---------- ۸. مربع جادویی ---------- */
register('magic', '✨ مربع جادویی', view => {
  view.innerHTML = `
    <p class="ap-help">راهنما: عددهای ۱ تا N² را در خانه‌ها بگذار تا مجموع هر <b>ردیف</b>، <b>ستون</b> و <b>هر دو قطر</b> برابر «عدد جادویی» شود. ابتدا خانه را بزن، بعد عدد را از دکمه‌های پایین یا کلید عددی انتخاب کن (برای عدد دو رقمی دو کلید را پشت‌سرهم بزن). خانه‌های قرمز اشتباه‌اند.</p>
    <div class="ap-hud">
      <span>عدد جادویی <strong id="mgSum">—</strong></span>
      <span>زمان <strong id="mgTime">۰:۰۰</strong></span>
      <span>برد‌ها <strong id="mgWins">${fa(store.get('magic-wins', 0))}</strong></span>
    </div>
    <div id="mgBoard" class="mg-board" role="grid" aria-label="مربع جادویی"></div>
    <div id="mgLines" class="mg-lines"></div>
    <div id="mgPad" class="mg-pad"></div>
    <div class="ap-actions">
      <button class="ap-btn" id="mgNew" type="button">معمای تازه</button>
      <button class="ap-btn ghost" id="mgCheck" type="button">بررسی</button>
      <button class="ap-btn ghost" id="mgHint" type="button">راهنمایی (+۳۰ ثانیه)</button>
      <button class="ap-btn ghost" id="mgErase" type="button">پاک‌کردن</button>
    </div>
    <p class="ap-msg" id="mgMsg"></p>`;

  const board = $('mgBoard'), pad = $('mgPad'), linesEl = $('mgLines'), msgEl = $('mgMsg');
  let n = 3, N = 9, S = 15, sol = [], grid = [], given = [], sel = null;
  let conflicts = new Set(), done = false, elapsed = 0, timer = null, builtFor = null;
  let typed = '', typedAt = 0;

  const mmss = s => fa(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
  const say = (t, bad) => { msgEl.textContent = t; msgEl.classList.toggle('ap-bad', !!bad); };
  const setTime = () => { $('mgTime').textContent = mmss(elapsed); };
  function startTimer() { stopTimer(); if (!done) timer = setInterval(() => { elapsed++; setTime(); }, 1000); }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  // مربع پایه و هشت تقارن هندسی + قرینه‌سازی عدد (x → N+1-x) برای تنوع
  const BASE = {
    3: [[2, 7, 6], [9, 5, 1], [4, 3, 8]],
    4: [[16, 2, 3, 13], [5, 11, 10, 8], [9, 7, 6, 12], [4, 14, 15, 1]]
  };
  function variant(base) {
    let a = base.map(row => row.slice());
    const size = a.length;
    if (Math.random() < 0.5) a = a.map((_, i) => a.map(row => row[i]));
    for (let k = rnd(0, 3); k > 0; k--) a = a.map((_, i) => a.map(row => row[i]).reverse());
    if (Math.random() < 0.5) a = a.map(row => row.slice().reverse());
    if (Math.random() < 0.5) a = a.map(row => row.map(v => size * size + 1 - v));
    return a;
  }
  // خانه‌های شروع داده‌شده: کمترین تعداد لازم برای تمرین
  function lineList() {
    const list = [];
    for (let i = 0; i < n; i++) {
      list.push({ name: `ردیف ${fa(i + 1)}`, cells: Array.from({ length: n }, (_, j) => [i, j]) });
      list.push({ name: `ستون ${fa(i + 1)}`, cells: Array.from({ length: n }, (_, j) => [j, i]) });
    }
    list.push({ name: 'قطر اصلی', cells: Array.from({ length: n }, (_, i) => [i, i]) });
    list.push({ name: 'قطر فرعی', cells: Array.from({ length: n }, (_, i) => [i, n - 1 - i]) });
    return list;
  }

  function newPuzzle() {
    const g = gradeNow();
    builtFor = g;
    n = g >= 9 ? 4 : 3;
    N = n * n;
    S = n * (N + 1) / 2;
    sol = variant(BASE[n]);
    const clues = n === 3 ? (g <= 4 ? 5 : 3) : 6;
    grid = Array.from({ length: n }, () => Array(n).fill(0));
    given = Array.from({ length: n }, () => Array(n).fill(false));
    shuffle(Array.from({ length: N }, (_, i) => i)).slice(0, clues).forEach(p => {
      const r = Math.floor(p / n), c = p % n;
      grid[r][c] = sol[r][c];
      given[r][c] = true;
    });
    sel = null; conflicts = new Set(); done = false; elapsed = 0; typed = '';
    $('mgSum').textContent = fa(S);
    setTime();
    render();
    say(`مجموع هر ردیف، ستون و قطر باید ${fa(S)} شود.`);
    startTimer();
  }

  function computeConflicts() {
    const set = new Set();
    const seen = new Map();
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const v = grid[r][c];
      if (!v) continue;
      if (!seen.has(v)) seen.set(v, []);
      seen.get(v).push(r * n + c);
    }
    seen.forEach(list => { if (list.length > 1) list.forEach(i => set.add(i)); });
    const status = lineList().map(line => {
      const vals = line.cells.map(([r, c]) => grid[r][c]);
      const full = vals.every(Boolean);
      const sum = vals.reduce((a, b) => a + b, 0);
      if (full && sum !== S) line.cells.forEach(([r, c]) => set.add(r * n + c));
      return { name: line.name, sum, full, ok: full && sum === S };
    });
    conflicts = set;
    return status;
  }

  function render() {
    board.style.setProperty('--mg-n', n);
    board.replaceChildren();
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mg-cell';
      if (given[r][c]) b.classList.add('given');
      if (sel && sel.r === r && sel.c === c) b.classList.add('sel');
      if (conflicts.has(r * n + c)) b.classList.add('wrong');
      b.textContent = grid[r][c] ? fa(grid[r][c]) : '';
      b.addEventListener('click', () => { if (!done) { sel = { r, c }; typed = ''; render(); } });
      board.append(b);
    }
    const status = computeConflicts();
    const used = new Set(grid.flat().filter(Boolean));
    linesEl.replaceChildren();
    status.forEach(s => {
      const span = document.createElement('span');
      span.className = 'mg-line ' + (s.ok ? 'ok' : s.full ? 'bad' : '');
      span.textContent = `${s.name}: ${s.full ? fa(s.sum) : '…'}${s.ok ? ' ✓' : ''}`;
      linesEl.append(span);
    });
    pad.replaceChildren();
    for (let v = 1; v <= N; v++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = fa(v);
      if (used.has(v)) b.classList.add('used');
      b.addEventListener('click', () => place(v));
      pad.append(b);
    }
  }

  function place(v) {
    if (done) return;
    if (!sel) { say('اول یک خانه را انتخاب کن.', true); return; }
    const { r, c } = sel;
    if (given[r][c]) { say('این خانه از قبل پر است؛ خانهٔ دیگری را انتخاب کن.', true); return; }
    grid[r][c] = v;
    say('');
    render();
    if (v && isSolved()) win();
  }

  function isSolved() {
    if (conflicts.size) return false;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!grid[r][c]) return false;
    return computeConflicts().every(s => s.ok);
  }

  function win() {
    done = true;
    stopTimer();
    store.set('magic-wins', store.get('magic-wins', 0) + 1);
    $('mgWins').textContent = fa(store.get('magic-wins', 0));
    say(`🏆 مربع جادویی کامل شد در ${mmss(elapsed)}!`);
    sel = null;
    render();
  }

  function check() {
    const status = computeConflicts();
    render();
    const empty = grid.flat().filter(v => !v).length;
    if (conflicts.size) say('خانه‌های قرمز اشتباه‌اند (عدد تکراری یا جمع نادرست).', true);
    else if (empty) say(`${fa(empty)} خانه هنوز خالی است. ادامه بده!`);
    else say(status.every(s => s.ok) ? '🏆 همه‌چیز درست است!' : 'جمع بعضی ردیف‌ها یا قطرها درست نیست.', !status.every(s => s.ok));
  }

  function hint() {
    if (done) return;
    const empty = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!grid[r][c]) empty.push({ r, c });
    if (!empty.length) return;
    const { r, c } = pick(empty);
    const val = sol[r][c];
    // اگر این عدد جای دیگری بود، آن خانهٔ غیرثابت خالی می‌شود تا تکراری نماند
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (grid[i][j] === val && !given[i][j]) grid[i][j] = 0;
    }
    grid[r][c] = val;
    given[r][c] = true;
    elapsed += 30;
    setTime();
    sel = { r, c };
    say('یک خانه برایت باز شد (۳۰ ثانیه جریمه).');
    render();
    if (isSolved()) win();
  }

  function move(dr, dc) {
    sel = sel ? { r: Math.min(n - 1, Math.max(0, sel.r + dr)), c: Math.min(n - 1, Math.max(0, sel.c + dc)) } : { r: 0, c: 0 };
    typed = '';
    render();
  }

  $('mgNew').addEventListener('click', newPuzzle);
  $('mgCheck').addEventListener('click', check);
  $('mgHint').addEventListener('click', hint);
  $('mgErase').addEventListener('click', () => place(0));

  return {
    enter() {
      if (!grid.length || builtFor !== gradeNow()) newPuzzle();
      else { render(); if (!done) startTimer(); }
    },
    leave() { stopTimer(); },
    onKey(e) {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        if (done) return;
        const now = Date.now();
        // دو رقمی: اگر کمتر از ۸۰۰ میلی‌ثانیه بعد از رقم قبلی باشد، کنار آن می‌نشیند
        const candidate = Number(typed && now - typedAt < 800 ? typed + e.key : e.key);
        const value = candidate >= 1 && candidate <= N ? candidate : Number(e.key);
        if (value === 0) { typed = ''; place(0); return; }
        typed = String(value);
        typedAt = now;
        if (value >= 1 && value <= N) place(value);
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); typed = ''; place(0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1, 0); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(1, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(0, -1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); move(0, 1); }
    }
  };
});


build();
})();
