/* چک‌نویس هوشمند: تخته‌سفید دست‌نویس + حل محلی (آفلاین) + بررسی هوشمند (آنلاین). */
'use strict';
(() => {
  const SAM_AI_URL = "https://sam-ai-backend.sami-math-lab.workers.dev";
  const AI_KEY = 'sam-sketch-ai';
  const BOARD_KEY = 'sam-sketch-board-v1';
  const AUTO_DELAY = 2000;
  const $ = id => document.getElementById(id);

  const canvas = $('skCanvas');
  const board = $('skBoard');
  const ctx = canvas.getContext('2d');
  const widthInput = $('skWidth');
  const aiToggle = $('skAiToggle');
  const checkBtn = $('skCheckAi');
  const modeEl = $('skMode');
  const statusEl = $('skStatus');
  const aiResult = $('skAiResult');
  const formula = $('skFormula');
  const solveBtn = $('skSolve');
  const solveOut = $('skSolveOut');

  let W = 0, H = 0, dpr = 1;
  let items = [];            // خطوط و متن‌ها (مختصات نرمال‌شده 0..1)
  let undoStack = [], redoStack = [];
  let current = null;        // خط در حال کشیدن
  let tool = 'pen', color = '#1e293b';
  let aiOn = false, aiBusy = false, dirty = false, autoTimer = 0;
  let lastAiImage = null;

  const fa = n => String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  function setStatus(text, bad = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('error', bad);
  }
  function setMode() {
    if (aiOn) {
      modeEl.className = 'sk-mode on';
      modeEl.textContent = navigator.onLine === false
        ? '● هوش مصنوعی روشن — اینترنت ندارید'
        : '● هوش مصنوعی روشن (آنلاین)';
    } else {
      modeEl.className = 'sk-mode off';
      modeEl.textContent = '● هوش مصنوعی خاموش (آفلاین)';
    }
    checkBtn.disabled = !aiOn || aiBusy;
  }

  /* ---------- تخته: اندازه، رسم ---------- */

  function resize() {
    const r = board.getBoundingClientRect();
    W = Math.max(200, r.width);
    H = Math.max(200, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    redraw();
  }

  function redraw() {
    if (!canvas.width) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#fdfdfb';
    ctx.fillRect(0, 0, W, H);
    for (const it of items) {
      if (it.type === 'stroke') drawStroke(it);
      else if (it.type === 'text') drawText(it);
    }
    if (current) drawStroke(current);
  }

  function drawStroke(s) {
    const pts = s.pts;
    if (!pts.length) return;
    ctx.save();
    ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (pts.length === 1) {
      const p = pts[0];
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, s.width * p.f / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    // هر نقطه با ضخامت خودش (فشار قلم) رسم می‌شود
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      ctx.beginPath();
      ctx.lineWidth = s.width * (a.f + b.f) / 2;
      ctx.moveTo(a.x * W, a.y * H);
      ctx.lineTo(b.x * W, b.y * H);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawText(t) {
    ctx.save();
    ctx.fillStyle = t.color;
    ctx.font = `${t.size}px Vazirmatn, Tahoma, sans-serif`;
    ctx.direction = 'ltr';
    t.text.split('\n').forEach((line, i) => {
      ctx.fillText(line, t.x * W, t.y * H + i * t.size * 1.4);
    });
    ctx.restore();
  }

  function pointFrom(event) {
    const r = canvas.getBoundingClientRect();
    const x = clamp01((event.clientX - r.left) / r.width);
    const y = clamp01((event.clientY - r.top) / r.height);
    // فشار قلم (اگر پشتیبانی شود) ضخامت را تغییر می‌دهد؛ ماوس و انگشت مقدار ثابت ۰٫۸ تا ۱ دارند
    let f = 1;
    if (event.pointerType === 'pen' && event.pressure > 0) f = 0.35 + event.pressure * 1.1;
    else if (event.pointerType === 'touch') f = 0.95;
    return { x, y, f };
  }
  const clamp01 = v => Math.max(0, Math.min(1, v));

  /* ---------- تاریخچه ---------- */

  function commitChange() {
    redoStack = [];
    saveBoard();
    dirty = true;
    scheduleAuto();
  }

  function pushUndo() {
    undoStack.push(items.slice());
    if (undoStack.length > 120) undoStack.shift();
  }

  function undo() {
    if (!undoStack.length) return setStatus('تغییری برای بازگشت نیست.');
    redoStack.push(items.slice());
    items = undoStack.pop();
    afterHistory('بازگشت انجام شد.');
  }

  function redo() {
    if (!redoStack.length) return setStatus('تغییری برای جلو رفتن نیست.');
    undoStack.push(items.slice());
    items = redoStack.pop();
    afterHistory('جلو رفتن انجام شد.');
  }

  function afterHistory(msg) {
    saveBoard();
    redraw();
    dirty = true;
    setStatus(msg);
    scheduleAuto();
  }

  function clearBoard() {
    if (!items.length) return setStatus('تخته از قبل خالی است.');
    pushUndo();
    items = [];
    redoStack = [];
    saveBoard();
    redraw();
    setStatus('تخته پاک شد. با «بازگشت» می‌توانی برگردانی.');
  }

  /* ---------- ذخیره در مرورگر ---------- */

  function saveBoard() {
    try {
      const data = JSON.stringify(items.slice(-400));
      if (data.length > 3_000_000) return;
      localStorage.setItem(BOARD_KEY, data);
    } catch (_) { /* حافظه پر یا مسدود */ }
  }

  function loadBoard() {
    try {
      const data = JSON.parse(localStorage.getItem(BOARD_KEY) || '[]');
      if (Array.isArray(data)) items = data.filter(it => it && (it.type === 'stroke' || it.type === 'text'));
    } catch (_) { items = []; }
  }

  /* ---------- ابزار رسم با ماوس، قلم و انگشت ---------- */

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button > 0) return;
    canvas.setPointerCapture(event.pointerId);
    pushUndo();
    current = {
      type: 'stroke',
      erase: tool === 'eraser',
      color,
      width: Number(widthInput.value) * (tool === 'eraser' ? 2.4 : 1),
      pts: [pointFrom(event)]
    };
    redraw();
  });

  canvas.addEventListener('pointermove', event => {
    if (!current) return;
    const events = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
    for (const e of events.length ? events : [event]) current.pts.push(pointFrom(e));
    redraw();
  });

  function finishStroke() {
    if (!current) return;
    if (current.pts.length) items.push(current);
    current = null;
    redoStack = [];
    redraw();
    commitChange();
  }
  canvas.addEventListener('pointerup', finishStroke);
  canvas.addEventListener('pointercancel', finishStroke);

  /* ---------- نوار ابزار ---------- */

  document.querySelectorAll('[data-tool]').forEach(btn => btn.addEventListener('click', () => {
    tool = btn.dataset.tool;
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b === btn));
    canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
    setStatus(tool === 'eraser' ? 'پاک‌کن فعال است.' : 'قلم فعال است.');
  }));

  document.querySelectorAll('[data-color]').forEach(btn => btn.addEventListener('click', () => {
    color = btn.dataset.color;
    if (tool === 'eraser') document.querySelector('[data-tool="pen"]').click();
    document.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('active', b === btn));
  }));

  $('skUndo').addEventListener('click', undo);
  $('skRedo').addEventListener('click', redo);
  $('skClear').addEventListener('click', clearBoard);
  $('skSave').addEventListener('click', () => {
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const o = out.getContext('2d');
    o.fillStyle = '#fdfdfb';
    o.fillRect(0, 0, out.width, out.height);
    o.drawImage(canvas, 0, 0);
    out.toBlob(blob => {
      if (!blob) return setStatus('ساخت تصویر ممکن نشد.', true);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sam-math-chernevis.png';
      a.click();
      URL.revokeObjectURL(url);
      setStatus('تصویر تخته ذخیره شد.');
    });
  });

  document.addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
  });

  /* ---------- حالت هوش مصنوعی ---------- */

  function setAi(on) {
    aiOn = on;
    aiToggle.checked = on;
    try { localStorage.setItem(AI_KEY, on ? '1' : '0'); } catch (_) {}
    setMode();
    if (on) {
      setStatus(navigator.onLine === false
        ? 'هوش مصنوعی روشن است، اما اینترنت وصل نیست. تا وصل شدن، از حل محلی استفاده کن.'
        : 'هوش مصنوعی روشن است (آنلاین). بعد از چند ثانیه مکث، دست‌نوشته بررسی می‌شود.');
    } else {
      clearTimeout(autoTimer);
      setStatus('حالت آفلاین: تخته و حل محلی کار می‌کنند. خواندن دست‌خط به هوش مصنوعی نیاز دارد.');
    }
  }

  aiToggle.addEventListener('change', () => setAi(aiToggle.checked));

  function scheduleAuto() {
    clearTimeout(autoTimer);
    if (!aiOn || !items.length) return;
    autoTimer = setTimeout(() => {
      if (dirty && aiOn && !aiBusy && !current) runAi(false);
    }, AUTO_DELAY);
  }

  checkBtn.addEventListener('click', () => {
    if (!aiOn) return setStatus('اول هوش مصنوعی را روشن کن.', true);
    runAi(true);
  });

  // تصویر تخته با پس‌زمینهٔ سفید
  function boardPng() {
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const o = out.getContext('2d');
    o.fillStyle = '#ffffff';
    o.fillRect(0, 0, out.width, out.height);
    o.drawImage(canvas, 0, 0);
    return out.toDataURL('image/png');
  }

  const AI_PROMPT = [
    'این تصویر یک دست‌نوشتهٔ ریاضی است. فقط یک شیء JSON معتبر برگردان، بدون هیچ متن دیگر، با این کلیدها:',
    '{"expression":"آنچه نوشته شده، با نماد ساده مثل 2x+3=11",',
    '"continuation":"اگر معادله یا عبارت ناقص است، ادامهٔ پیشنهادی را بنویس (مثلاً برای 2x = نوشته شده، بقیه را پیشنهاد بده)؛ اگر کامل است خالی بگذار",',
    '"steps":["مرحلهٔ حل به فارسی، کوتاه","..."] (فقط اگر معادله کامل است؛ در غیر این صورت آرایهٔ خالی),',
    '"result":"جواب نهایی یا خالی"}'
  ].join('\n');

  function parseAiJson(text) {
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    if (s < 0 || e <= s) throw new Error('پاسخ هوش مصنوعی ساختار قابل خواندن نداشت.');
    return JSON.parse(text.slice(s, e + 1));
  }

  async function runAi(manual) {
    if (aiBusy) return;
    if (!items.length) return setStatus('تخته خالی است؛ اول چیزی بنویس.', true);
    if (navigator.onLine === false) return setStatus('اینترنت وصل نیست؛ هوش مصنوعی در دسترس نیست.', true);
    aiBusy = true;
    dirty = false;
    checkBtn.disabled = true;
    modeEl.className = 'sk-mode busy';
    modeEl.textContent = '● در حال خواندن دست‌نوشته…';
    setStatus('در حال بررسی تخته با هوش مصنوعی…');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const dataUrl = boardPng();
      lastAiImage = dataUrl;
      const response = await fetch(SAM_AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: AI_PROMPT }],
          attachment: { name: 'chernevis.png', type: 'image/png', data: dataUrl },
          web: false,
          site: ''
        }),
        signal: controller.signal
      });
      let data;
      try { data = await response.json(); }
      catch { throw new Error(`پاسخ سرور قابل خواندن نیست (HTTP ${response.status}).`); }
      if (!response.ok) throw new Error(data.error || `خطای سرور (HTTP ${response.status})`);
      if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error(data.error || 'پاسخ خالی دریافت شد.');
      renderAiResult(parseAiJson(data.answer));
      setStatus('بررسی تخته انجام شد.');
    } catch (error) {
      const msg = error.name === 'AbortError'
        ? 'زمان بررسی تمام شد؛ دوباره تلاش کن.'
        : (error.message || 'بررسی با هوش مصنوعی ناموفق بود.');
      showError(aiResult, `خطا: ${msg}\nتخته همچنان قابل استفاده است.`);
      setStatus(msg, true);
    } finally {
      clearTimeout(timer);
      aiBusy = false;
      setMode();
    }
  }

  /* ---------- نمایش نتیجه‌ها ---------- */

  function showError(box, text) {
    box.hidden = false;
    box.className = 'sk-result error';
    box.textContent = text;
  }

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    for (const c of children) node.append(c);
    return node;
  }

  function renderResultBox(box, { title, lines, expression, continuation, result }) {
    box.hidden = false;
    box.className = 'sk-result';
    box.replaceChildren();
    if (title) box.append(el('strong', { textContent: title }));
    if (expression) box.append(el('div', { className: 'sk-kv', dir: 'ltr', textContent: `خوانده‌شده: ${expression}` }));
    for (const line of lines || []) box.append(el('div', { dir: 'ltr', textContent: line }));
    if (result) box.append(el('div', { className: 'sk-kv', dir: 'ltr', textContent: `جواب: ${result}` }));
    const row = el('div', { className: 'sk-btn-row' });
    if (continuation) {
      row.append(el('button', {
        type: 'button',
        textContent: `پذیرفتن ادامه: ${continuation}`,
        onclick: () => acceptText(continuation)
      }));
    }
    const plain = [...(lines || []), result ? `جواب: ${result}` : ''].filter(Boolean).join('\n');
    if (plain) {
      row.append(el('button', {
        type: 'button',
        textContent: 'نوشتن جواب روی تخته',
        onclick: () => writeOnBoard(plain)
      }));
    }
    if (row.childNodes.length) box.append(row);
  }

  function renderAiResult(data) {
    const steps = Array.isArray(data.steps) ? data.steps.map(s => String(s)).slice(0, 20) : [];
    const cont = typeof data.continuation === 'string' ? data.continuation.trim() : '';
    const result = typeof data.result === 'string' ? data.result.trim() : '';
    const expr = typeof data.expression === 'string' ? data.expression.trim() : '';
    if (!expr && !steps.length && !cont && !result) {
      showError(aiResult, 'هوش مصنوعی چیزی از تخته تشخیص نداد؛ واضح‌تر بنویس.');
      return;
    }
    renderResultBox(aiResult, {
      title: 'نتیجهٔ هوش مصنوعی',
      expression: expr,
      lines: steps.map((s, i) => `${i + 1}. ${s}`),
      continuation: cont || '',
      result
    });
  }

  // ادامه‌ای که پیشنهاد شده، به‌صورت متن تایپ‌شده وارد کادر و تخته می‌شود
  function acceptText(text) {
    formula.value = text;
    formula.focus();
    writeOnBoard(text);
  }

  function writeOnBoard(text) {
    const lines = String(text).split('\n').filter(Boolean);
    if (!lines.length) return;
    pushUndo();
    let y = 0.08;
    for (const it of items) {
      if (it.type === 'stroke') for (const p of it.pts) y = Math.max(y, p.y);
      else if (it.type === 'text') y = Math.max(y, it.y + it.size * 1.4 * it.text.split('\n').length / H);
    }
    y = Math.min(0.9, y + 0.04);
    items.push({ type: 'text', x: 0.06, y, text: lines.join('\n'), size: 26, color: '#1e293b' });
    redraw();
    commitChange();
    setStatus('متن روی تخته نوشته شد.');
  }

  /* ---------- حل محلی (آفلاین) ---------- */

  const FUNCS = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan };

  function normalizeMath(s) {
    return String(s || '')
      .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/٫/g, '.')
      .replace(/[×·✕]/g, '*')
      .replace(/[÷]/g, '/')
      .replace(/[−–]/g, '-')
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/π/g, 'pi')
      .replace(/√/g, 'sqrt')
      .replace(/\s+/g, '');
  }

  function tokenize(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (/[0-9.]/.test(ch)) {
        let j = i;
        while (j < src.length && /[0-9.]/.test(src[j])) j++;
        const v = Number(src.slice(i, j));
        if (!Number.isFinite(v)) throw new Error(`عدد «${src.slice(i, j)}» نامعتبر است`);
        out.push({ k: 'num', v });
        i = j;
      } else if (/[a-zA-Z]/.test(ch)) {
        let j = i;
        while (j < src.length && /[a-zA-Z]/.test(src[j])) j++;
        out.push({ k: 'id', v: src.slice(i, j) });
        i = j;
      } else if ('+-*/^()'.includes(ch)) {
        out.push({ k: 'op', v: ch });
        i++;
      } else {
        throw new Error(`نماد «${ch}» پشتیبانی نمی‌شود`);
      }
    }
    return out;
  }

  // تجزیه‌گر خطی: هر عبارت به شکل c·x + k نگه داشته می‌شود (c ضریب x، k عدد ثابت)
  function parseLinear(src) {
    const toks = tokenize(src);
    let p = 0;
    const ctx = { v: null };
    const isOp = o => toks[p] && toks[p].k === 'op' && toks[p].v === o;
    const isConst = L => L.c === 0;
    const startsPrimary = () => toks[p] && (toks[p].k === 'num' || toks[p].k === 'id' || isOp('('));
    const nonLinear = () => new Error('این ابزار فقط معادلهٔ خطی (درجهٔ اول) را حل می‌کند؛ برای درجهٔ بالاتر از هوش مصنوعی کمک بگیر.');

    function expr() {
      let L = term();
      while (isOp('+') || isOp('-')) {
        const s = toks[p].v === '+' ? 1 : -1;
        p++;
        const R = term();
        L = { c: L.c + s * R.c, k: L.k + s * R.k };
      }
      return L;
    }
    function term() {
      let L = factor();
      for (;;) {
        if (isOp('*')) { p++; L = mul(L, factor()); }
        else if (isOp('/')) {
          p++;
          const R = factor();
          if (!isConst(R)) throw nonLinear();
          if (R.k === 0) throw new Error('تقسیم بر صفر امکان‌پذیر نیست');
          L = { c: L.c / R.k, k: L.k / R.k };
        } else if (startsPrimary()) L = mul(L, factor());
        else break;
      }
      return L;
    }
    function mul(a, b) {
      if (!isConst(a) && !isConst(b)) throw nonLinear();
      return { c: a.c * b.k + b.c * a.k, k: a.k * b.k };
    }
    function factor() {
      const B = unary();
      if (isOp('^')) {
        p++;
        const E = unary();
        if (!isConst(E)) throw nonLinear();
        if (isConst(B)) return { c: 0, k: Math.pow(B.k, E.k) };
        if (E.k === 1) return B;
        if (E.k === 0) return { c: 0, k: 1 };
        throw nonLinear();
      }
      return B;
    }
    function unary() {
      if (isOp('-')) { p++; const U = unary(); return { c: -U.c, k: -U.k }; }
      if (isOp('+')) { p++; return unary(); }
      return primary();
    }
    function primary() {
      const t = toks[p];
      if (!t) throw new Error('عبارت ناتمام است');
      if (t.k === 'num') { p++; return { c: 0, k: t.v }; }
      if (isOp('(')) {
        p++;
        const L = expr();
        if (!isOp(')')) throw new Error('پرانتز بسته نشده است');
        p++;
        return L;
      }
      if (t.k === 'id') {
        const name = t.v.toLowerCase();
        if (name === 'pi') { p++; return { c: 0, k: Math.PI }; }
        if (FUNCS[name]) {
          p++;
          if (!isOp('(')) throw new Error(`بعد از ${name} باید پرانتز بیاید`);
          p++;
          const A = expr();
          if (!isOp(')')) throw new Error('پرانتز بسته نشده است');
          p++;
          if (!isConst(A)) throw nonLinear();
          const val = FUNCS[name](A.k);
          if (!Number.isFinite(val)) throw new Error(`حاصل ${name} تعریف نشده است`);
          return { c: 0, k: val };
        }
        if (t.v.length === 1) {
          p++;
          if (ctx.v === null) ctx.v = t.v;
          else if (ctx.v !== t.v) throw new Error('فقط یک متغیر در هر معادله مجاز است');
          return { c: 1, k: 0 };
        }
        throw new Error(`نماد «${t.v}» ناشناخته است`);
      }
      throw new Error('ساختار عبارت نادرست است');
    }

    const L = expr();
    if (p < toks.length) throw new Error('بخشی از عبارت خوانده نشد؛ پرانتز یا علامت اضافه داری؟');
    return { L, v: ctx.v };
  }

  function fmt(n) {
    if (!Number.isFinite(n)) return '—';
    const r = Math.round(n * 1e9) / 1e9;
    return Number.isInteger(r) ? String(r) : String(+r.toFixed(6));
  }
  // عدد منفی داخل پرانتز نوشته می‌شود تا «− −۱» پیش نیاید
  const fmtP = n => (n < 0 ? `(${fmt(n)})` : fmt(n));
  // کسر ساده برای عددهای ناصحیح، مثلاً 0.5 = 1/2
  function fracOf(n) {
    for (let d = 2; d <= 100; d++) {
      const num = Math.round(n * d);
      if (Math.abs(num / d - n) < 1e-9) return `${num}/${d}`;
    }
    return null;
  }
  const withFrac = n => {
    const f = fracOf(n);
    return f && !Number.isInteger(n) ? `${fmt(n)} = ${f}` : fmt(n);
  };

  function solveLocal(raw) {
    const s = normalizeMath(raw);
    if (!s) throw new Error('اول یک عبارت یا معادله بنویس.');
    const parts = s.split('=');
    if (parts.length > 2) throw new Error('فقط یک علامت «=» مجاز است.');
    const [lhs, rhs] = parts;

    if (parts.length === 1) {
      const A = parseLinear(lhs);
      if (A.v) return { title: 'عبارت خطی', expression: s, lines: [`ساده‌شده: ${fmt(A.L.c)}${A.v} + ${fmt(A.L.k)}`, 'برای حل، عبارت را برابر عددی قرار بده؛ مثلاً ...=0'] };
      return { title: 'محاسبه', expression: s, lines: [`${s} = ${withFrac(A.L.k)}`], result: withFrac(A.L.k) };
    }

    if (rhs === '') {
      const A = parseLinear(lhs);
      if (A.v) throw new Error('معادله ناقص است؛ بعد از = عددی یا عبارتی بنویس.');
      const value = withFrac(A.L.k);
      return { title: 'ادامهٔ محاسبه', expression: `${s}`, lines: [`${lhs} = ${value}`], continuation: fmt(A.L.k), result: value };
    }

    const A = parseLinear(lhs);
    const B = parseLinear(rhs);
    const v = A.v || B.v;
    if (!v) {
      const a = A.L.k, b = B.L.k;
      const ok = Math.abs(a - b) < 1e-9;
      return {
        title: 'بررسی برابری',
        expression: s,
        lines: [`${lhs} = ${withFrac(a)}`, `${rhs} = ${withFrac(b)}`, ok ? 'دو طرف برابرند ✓' : 'دو طرف برابر نیستند ✗'],
        result: ok ? 'درست' : 'نادرست'
      };
    }

    const coef = A.L.c - B.L.c;
    const konst = B.L.k - A.L.k;
    const lines = [
      `معادله: ${lhs} = ${rhs}`,
      `جمله‌های شامل ${v} را به یک طرف و عددها را به طرف دیگر می‌بریم:`,
      `(${fmtP(A.L.c)} − ${fmtP(B.L.c)})${v} = ${fmtP(B.L.k)} − ${fmtP(A.L.k)}`,
      `(${fmt(coef)})${v} = ${fmt(konst)}`
    ];
    if (Math.abs(coef) < 1e-12) {
      const same = Math.abs(konst) < 1e-12;
      lines.push(same ? 'ضریب صفر است و دو طرف یکی‌اند؛ هر عددی جواب است.' : 'ضریب صفر است ولی دو طرف یکی نیستند؛ معادله جواب ندارد.');
      return { title: 'حل معادله', expression: s, lines, result: same ? 'هر عددی' : 'بدون جواب' };
    }
    const x = konst / coef;
    lines.push(`${v} = ${fmt(konst)} ÷ ${fmt(coef)} = ${withFrac(x)}`);
    const check = Math.abs(A.L.c * x + A.L.k - (B.L.c * x + B.L.k)) < 1e-6;
    lines.push(`بررسی: با گذاشتن ${v} = ${fmt(x)} دو طرف ${check ? 'برابرند ✓' : 'برابر نیستند (احتمالاً خطای نوشتاری)'}`);
    return { title: 'حل معادلهٔ خطی', expression: s, lines, result: `${v} = ${withFrac(x)}` };
  }

  function renderLocal(res) {
    renderResultBox(solveOut, {
      title: res.title,
      expression: res.expression,
      lines: res.lines,
      continuation: res.continuation,
      result: res.result
    });
  }

  solveBtn.addEventListener('click', () => {
    try {
      renderLocal(solveLocal(formula.value));
      setStatus('حل محلی انجام شد (آفلاین).');
    } catch (error) {
      showError(solveOut, error.message);
      setStatus(error.message, true);
    }
  });
  formula.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); solveBtn.click(); } });

  document.querySelectorAll('[data-insert]').forEach(btn => btn.addEventListener('click', () => {
    const val = btn.dataset.insert;
    const start = formula.selectionStart ?? formula.value.length;
    const end = formula.selectionEnd ?? start;
    formula.value = formula.value.slice(0, start) + val + formula.value.slice(end);
    // اگر قالب پرانتز دارد، مکان‌نما داخل پرانتز می‌ایستد
    const caret = val.endsWith(')') ? start + val.length - 1 : start + val.length;
    formula.focus();
    formula.setSelectionRange(caret, caret);
  }));

  /* ---------- راه‌اندازی ---------- */

  window.addEventListener('online', setMode);
  window.addEventListener('offline', setMode);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(board);
  else window.addEventListener('resize', resize);

  loadBoard();
  resize();
  const savedAi = (() => { try { return localStorage.getItem(AI_KEY) === '1'; } catch (_) { return false; } })();
  setAi(savedAi);
  if (!savedAi) setStatus('حالت آفلاین: تخته و حل محلی کار می‌کنند. خواندن دست‌خط به هوش مصنوعی نیاز دارد.');
})();
