/* دستیار صوتی SAM AI: دکمهٔ شناور در همهٔ صفحات.
   - وضعیت روشن/خاموش در localStorage ("sam-voice-on") ذخیره می‌شود و با تغییر صفحه باقی می‌ماند.
   - صدا تولید نمی‌کند و متن را داخل صفحه نمی‌نویسد؛ فقط یک پنل کوچک نشان می‌دهد.
   - دستورهای محلی (ناوبری و هندسه) آفلاین کار می‌کنند؛ بقیهٔ پرسش‌ها به SAM AI فرستاده می‌شوند. */
(() => {
  'use strict';
  if (window.__samVoiceLoaded) return;
  window.__samVoiceLoaded = true;

  const KEY = 'sam-voice-on';
  const SAM_AI_URL = 'https://sam-ai-backend.sami-math-lab.workers.dev';
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  /* ---------- استایل و ساختار (خودکفا) ---------- */
  const css = `
  .sv-root{position:fixed;left:18px;bottom:18px;z-index:2000;font-family:Vazirmatn,Tahoma,sans-serif;direction:rtl}
  .sv-btn{display:flex;align-items:center;gap:8px;border:1px solid #67e8f966;border-radius:999px;padding:10px 16px 10px 12px;background:linear-gradient(120deg,#1e1b4b,#0e3a4a);color:#f1f5ff;font:inherit;font-weight:700;font-size:.9rem;cursor:pointer;box-shadow:0 10px 30px #0008,0 0 22px #8b5cf633;transition:transform .15s}
  .sv-btn:hover{transform:translateY(-2px)}
  .sv-btn[aria-pressed="true"]{border-color:#34d399;background:linear-gradient(120deg,#064e3b,#0e4a5a)}
  .sv-ico{font-size:1.15rem}
  .sv-dot{width:10px;height:10px;border-radius:50%;background:#64748b}
  .sv-btn[aria-pressed="true"] .sv-dot{background:#34d399;box-shadow:0 0 0 0 #34d399;animation:svPulse 1.4s infinite}
  .sv-btn.sv-listening .sv-dot{background:#67e8f9}
  @keyframes svPulse{0%{box-shadow:0 0 0 0 #34d39999}70%{box-shadow:0 0 0 10px #34d39900}100%{box-shadow:0 0 0 0 #34d39900}}
  .sv-panel{position:absolute;left:0;bottom:56px;width:min(340px,86vw);max-height:46vh;overflow:auto;padding:14px 14px 12px;border:1px solid #67e8f955;border-radius:18px;background:#0f1729f2;color:#e2e8f0;box-shadow:0 20px 50px #000a;font-size:.88rem;line-height:1.8}
  .sv-panel[hidden]{display:none}
  .sv-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;color:#67e8f9}
  .sv-x{border:1px solid #334155;background:#1e293b;color:#cbd5e1;border-radius:9px;width:28px;height:28px;cursor:pointer;font:inherit}
  .sv-heard{color:#c4b5fd;font-weight:700;margin:4px 0;word-break:break-word}
  .sv-reply{white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 0}
  .sv-reply.sv-err{color:#fda4af}
  .sv-note{font-size:.76rem;color:#94a3b8;margin-top:8px;border-top:1px solid #334155;padding-top:6px}
  .sv-hint{position:absolute;left:0;bottom:56px;white-space:nowrap;padding:8px 12px;border-radius:12px;background:#312e81;color:#e0e7ff;font-size:.8rem;box-shadow:0 10px 24px #0008}
  .sv-hint[hidden]{display:none}
  @media(max-width:520px){.sv-root{left:10px;bottom:10px}.sv-btn{padding:9px 12px 9px 10px;font-size:.8rem}}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'sv-root';
  root.innerHTML = `
    <div class="sv-panel" hidden>
      <div class="sv-head"><strong>دستیار صوتی SAM AI</strong><button type="button" class="sv-x" aria-label="بستن پنل">×</button></div>
      <div class="sv-heard"></div>
      <div class="sv-reply"></div>
      <div class="sv-note">دستور بده: «برو به هندسه»، «یک دایره با شعاع ۵ بساز»، «کره بساز» یا هر پرسشی. پاسخ‌های هوش مصنوعی به اینترنت نیاز دارند.</div>
    </div>
    <div class="sv-hint" hidden>یک‌بار دیگر دکمه را بزن</div>
    <button type="button" class="sv-btn" aria-pressed="false" title="دستیار صوتی SAM AI">
      <span class="sv-dot"></span><span class="sv-ico">🎙</span><span class="sv-label">دستیار صوتی: خاموش</span>
    </button>`;
  document.body.appendChild(root);

  const btn = root.querySelector('.sv-btn');
  const label = root.querySelector('.sv-label');
  const panel = root.querySelector('.sv-panel');
  const heardEl = root.querySelector('.sv-heard');
  const replyEl = root.querySelector('.sv-reply');
  const hintEl = root.querySelector('.sv-hint');
  root.querySelector('.sv-x').addEventListener('click', () => { panel.hidden = true; });

  /* ---------- متن: نرمال‌سازی فارسی ---------- */
  const WORDS = { 'صفر': 0, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10, 'بیست': 20, 'سی': 30, 'پنجاه': 50, 'صد': 100 };
  function norm(s) {
    let t = String(s || '')
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
      .replace(/[ً-ٟـ]/g, '')
      .replace(/[‌‏‎]/g, ' ')
      .replace(/[.،,!؟?:؛"'«»()]/g, ' ')
      .replace(/\s+/g, ' ').trim().toLowerCase();
    t = t.split(' ').map(w => (w in WORDS ? String(WORDS[w]) : w)).join(' ');
    return t;
  }
  const squash = s => norm(s).replace(/\s/g, '');
  const numbersIn = t => (t.match(/\d+(\.\d+)?/g) || []).map(Number);

  /* ---------- دستورهای محلی ---------- */
  const NAV = [
    ['سامایآی', 'sam-ai.html', 'سام ای آی'],
    ['ماشینحساب', 'index.html?mode=calculator', 'ماشین‌حساب'],
    ['ابزارریاضی', 'index.html?mode=tools', 'ابزارها'],
    ['ابزارها', 'index.html?mode=tools', 'ابزارها'],
    ['دستیاریاضی', 'index.html?mode=assistant', 'دستیار ریاضی'],
    ['دستیار', 'index.html?mode=assistant', 'دستیار ریاضی'],
    ['آزمون', 'index.html?mode=exam', 'ساخت آزمون'],
    ['تاریخچه', 'index.html?mode=history', 'تاریخچهٔ ریاضیات'],
    ['هندسه', 'geometry.html', 'هندسه'],
    ['چکنویس', 'sketch.html', 'چک‌نویس'],
    ['تخته', 'sketch.html', 'چک‌نویس'],
    ['خانه', 'index.html', 'خانه']
  ];
  const SOLIDS = [
    ['نیمکره', 'hemisphere'], ['مکعبمستطیل', 'cuboid'], ['مکعب', 'cube'], ['هشتوجهی', 'octa'],
    ['چهاروجهی', 'tetra'], ['هرمشش', 'hexpyramid'], ['هرم', 'pyramid'], ['استوانه', 'cylinder'],
    ['مخروطناقص', 'truncone'], ['مخروط', 'cone'], ['منشور', 'prism'], ['کره', 'sphere']
  ];

  function matchNavigation(t) {
    const s = squash(t);
    const wantsGo = /برو|بازکن|نشانبده|بیابه/.test(s);
    if (!wantsGo) return null;
    for (const [key, url, name] of NAV) if (s.includes(key)) return { url, name };
    return null;
  }

  // «یک» عمداً تبدیل نمی‌شود چون حرف تعریف هم هست (یک دایره)
  // دستور هندسه به همان زبان دستور بوم هندسه تبدیل می‌شود (مثلاً "circle 5")
  function geometryCommand(t) {
    const s = squash(t);
    const n = numbersIn(t);
    if (s.includes('سهبعدی')) return '3d';
    if (s.includes('دوبعدی')) return '2d';
    if (s.includes('پاککن') || s.includes('خالیکن')) return 'clear';
    if (!s.includes('دایره') || s.includes('سهبعدی')) {
      for (const [key, kind] of SOLIDS) if (s.includes(key)) return `solid ${kind}`;
    }
    if (s.includes('مستطیل')) return n.length >= 2 ? `rectangle ${n[0]} ${n[1]}` : 'rectangle 8 5';
    if (s.includes('مثلث')) return 'triangle';
    if (s.includes('دایره')) return `circle ${n[0] || 3}`;
    if (s.includes('پارهخط')) return `segment ${n[0] || 5}`;
    return null;
  }

  // برای صفحهٔ هندسه: اجرا روی بوم فعلی؛ در غیر این صورت به صفحهٔ هندسه می‌رود
  function runGeometry(cmd) {
    if (window.SAMGeometry && typeof window.SAMGeometry.run === 'function') {
      return { done: true, text: String(window.SAMGeometry.run(cmd)) };
    }
    return { done: false, url: 'geometry.html?cmd=' + encodeURIComponent(cmd) };
  }

  /* ---------- هوش مصنوعی برای پرسش‌های آزاد ---------- */
  async function askAi(text) {
    if (navigator.onLine === false) {
      return 'اینترنت وصل نیست؛ پاسخ هوش مصنوعی فقط با اینترنت ممکن است. دستورهای محلی مثل «برو به هندسه» آفلاین کار می‌کنند.';
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(SAM_AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: text }], attachment: null, web: false, site: '' }),
        signal: controller.signal
      });
      let data;
      try { data = await res.json(); } catch { throw new Error('پاسخ سرور قابل خواندن نیست.'); }
      if (!res.ok) throw new Error(data.error || `خطای سرور (HTTP ${res.status})`);
      if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('پاسخ خالی بود.');
      return data.answer.trim().slice(0, 1500);
    } catch (error) {
      const why = error.name === 'AbortError' ? 'زمان پاسخ تمام شد.' : error.message;
      return `هوش مصنوعی (نیاز به اینترنت) در دسترس نیست: ${why}`;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- نمایش ---------- */
  function showPanel(heard, reply, isError = false) {
    panel.hidden = false;
    heardEl.textContent = heard ? `شنیده شد: ${heard}` : '';
    replyEl.textContent = reply || '';
    replyEl.classList.toggle('sv-err', isError);
  }
  let hintTimer = 0;
  function showHint(text) {
    hintEl.textContent = text;
    hintEl.hidden = false;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { hintEl.hidden = true; }, 6000);
  }

  /* ---------- پردازش یک جمله ---------- */
  async function handle(raw) {
    const heard = String(raw || '').trim();
    if (!heard) return;
    const t = norm(heard);

    const nav = matchNavigation(t);
    if (nav) {
      showPanel(heard, `در حال رفتن به «${nav.name}»…`);
      location.href = nav.url;
      return;
    }

    const cmd = geometryCommand(t);
    if (cmd) {
      const r = runGeometry(cmd);
      if (r.done) showPanel(heard, r.text);
      else {
        showPanel(heard, 'به صفحهٔ هندسه می‌روم تا این شکل ساخته شود…');
        location.href = r.url;
      }
      return;
    }

    showPanel(heard, 'در حال پرسیدن از SAM AI…');
    const answer = await askAi(heard);
    const failed = /در دسترس نیست|اینترنت وصل نیست/.test(answer);
    showPanel(heard, `پاسخ هوش مصنوعی (نیاز به اینترنت):\n${answer}`, failed);
  }

  /* ---------- شناخت گفتار ---------- */
  let rec = null;
  let on = false;
  let listening = false;
  let backoff = 300;
  let restartTimer = 0;

  function render() {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('sv-listening', on && listening);
    label.textContent = on
      ? (listening ? 'در حال گوش دادن…' : 'دستیار صوتی: روشن')
      : 'دستیار صوتی: خاموش';
  }

  function saveState() {
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) {}
  }

  function buildRecognizer() {
    rec = new SR();
    rec.lang = 'fa-IR';
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => { listening = true; backoff = 300; render(); };
    rec.onresult = event => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) handle(event.results[i][0].transcript);
      }
    };
    rec.onerror = event => {
      const code = event.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        on = false;
        saveState();
        render();
        showPanel('', 'دسترسی میکروفون داده نشد. اجازهٔ میکروفون را در تنظیمات مرورگر بده و دوباره دکمه را روشن کن.', true);
      } else if (code === 'audio-capture') {
        showPanel('', 'میکروفونی پیدا نشد.', true);
      } else if (code === 'network') {
        showPanel('', 'تشخیص صدا به اینترنت نیاز دارد؛ اتصال را بررسی کن.', true);
      }
      // no-speech و aborted طبیعی‌اند؛ onend دوباره شروع می‌کند
    };
    rec.onend = () => {
      listening = false;
      render();
      if (!on) return;
      clearTimeout(restartTimer);
      restartTimer = setTimeout(startRecognition, backoff);
      backoff = Math.min(backoff * 2, 5000);
    };
  }

  function startRecognition() {
    if (!on) return;
    if (!SR) {
      on = false;
      saveState();
      render();
      showPanel('', 'این مرورگر تشخیص صدا را پشتیبانی نمی‌کند. Chrome یا Edge را امتحان کن.', true);
      return;
    }
    if (!rec) buildRecognizer();
    try {
      rec.start();
    } catch (_) {
      // شروع دوباره وقتی هنوز فعال است خطا می‌دهد؛ نادیده گرفته می‌شود
      if (!listening) showHint('یک‌بار دیگر دکمه را بزن');
    }
  }

  function setOn(next) {
    on = next;
    saveState();
    render();
    if (on) {
      if (!SR) {
        on = false;
        saveState();
        render();
        showPanel('', 'این مرورگر تشخیص صدا را پشتیبانی نمی‌کند. Chrome یا Edge را امتحان کن.', true);
        return;
      }
      startRecognition();
    } else {
      clearTimeout(restartTimer);
      try { rec && rec.stop(); } catch (_) {}
      listening = false;
      render();
      showPanel('', 'دستیار صوتی خاموش شد.');
    }
  }

  btn.addEventListener('click', () => setOn(!on));

  /* ---------- راه‌اندازی ---------- */
  let saved = false;
  try { saved = localStorage.getItem(KEY) === '1'; } catch (_) {}
  on = saved;
  render();
  if (on) {
    if (!SR) {
      on = false;
      saveState();
      render();
      showPanel('', 'این مرورگر تشخیص صدا را پشتیبانی نمی‌کند. Chrome یا Edge را امتحان کن.', true);
    } else {
      // شروع خودکار؛ اگر مرورگر اجازه نداد، راهنمای یک‌بار کلیک نشان داده می‌شود
      try {
        buildRecognizer();
        rec.start();
      } catch (_) {
        showHint('یک‌بار دیگر دکمه را بزن');
      }
      setTimeout(() => { if (on && !listening) showHint('یک‌بار دیگر دکمه را بزن'); }, 2500);
    }
  }
  window.SAMVoice = { handle, isOn: () => on };
})();
