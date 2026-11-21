/* SAM MATH · قابلیت‌های نسخهٔ ۲
   شناسهٔ دستگاه، تاریخچهٔ ماشین‌حساب، درصد پیشرفته، توضیح ساده، چالش ذهنی،
   پیشرفت و نشان‌ها، ارتباط با Gmail. همه چیز روی همین دستگاه ذخیره می‌شود. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const KEYS = {
    profile: 'sam_profile_v1',
    device: 'sam_device_v1',
    stats: 'sam_stats_v1',
    calc: 'sam_calc_history_v1',
    best: 'sam_challenge_best_v1'
  };
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ---------- ابزارهای کمکی ---------- */
  const read = (key, fallback) => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  };
  const faDigits = s => String(s).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  const numFmt = x => faDigits(String(Math.round(x * 10000) / 10000)).replace('.', '٫');
  const toEnDigits = s => String(s)
    .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
    .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .replace(/[٫،]/g, '.');
  const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const numberOf = input => Number(toEnDigits(input ? input.value : '').trim().replace(/,/g, ''));

  // کپی با روش مطمئن: اول API کلیپ‌بورد، بعد روش قدیمی برای وقتی که API نیست یا بسته است
  function copyText(text, done) {
    const finish = ok => { if (typeof done === 'function') done(ok); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => finish(true), () => fallbackCopy(text, finish));
    } else {
      fallbackCopy(text, finish);
    }
  }
  function fallbackCopy(text, finish) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    finish(ok);
  }

  /* ---------- شناسهٔ دستگاه؛ بدون ورود یا ساخت حساب ---------- */
  function getDeviceId() {
    let id = read(KEYS.device, '');
    if (typeof id !== 'string' || id.length < 8) {
      id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      write(KEYS.device, id);
    }
    return id;
  }
  const getProfile = () => null;
  const message = $('message');
  function setMessage(text) { if (message) message.textContent = text; }
  // اطلاعات پروفایل قدیمی پاک می‌شود تا هیچ حساب یا ایمیل قبلی فعال نماند.
  try { localStorage.removeItem(KEYS.profile); } catch { /* ignore */ }

  /* ---------- آمار و نشان‌ها ---------- */
  const getStats = () => ({ calcs: 0, tools: 0, games: 0, correct: 0, bestScore: 0, ...read(KEYS.stats, {}) });
  function bump(field, by = 1) {
    const stats = getStats();
    stats[field] = (stats[field] || 0) + by;
    write(KEYS.stats, stats);
  }

  const BADGES = [
    { icon: 'Σ', title: 'اولین حساب', desc: 'یک بار در ماشین‌حساب جواب گرفتی.', ok: s => s.calcs >= 1 },
    { icon: '10', title: 'حساب‌گر', desc: 'ده بار در ماشین‌حساب محاسبه کردی.', ok: s => s.calcs >= 10 },
    { icon: '⌘', title: 'ابزارساز', desc: 'پنج بار از ابزارهای ریاضی استفاده کردی.', ok: s => s.tools >= 5 },
    { icon: '▶', title: 'بازیکن جدی', desc: 'پنج بازی را کامل کن.', ok: s => s.games >= 5 },
    { icon: 'Δ', title: 'واکنش سریع', desc: 'در یک بازی به امتیاز ۲۵۰ برس.', ok: s => s.bestScore >= 250 },
    { icon: '★', title: 'قهرمان آرکید', desc: 'در یک بازی به امتیاز ۵۰۰ برس.', ok: s => s.bestScore >= 500 }
  ];

  function renderProgress() {
    const panel = $('progressPanel');
    if (!panel) return;
    const stats = getStats();
    const profile = getProfile() || {};
    $('progName').textContent = profile.name ? profile.name : 'مهمان';
    $('progJoined').textContent = profile.joinedAt
      ? 'عضو از ' + new Date(profile.joinedAt).toLocaleDateString('fa-IR')
      : 'برای ذخیرهٔ پیشرفت، اسمت را وارد کن.';

    const cards = [
      ['Σ', stats.calcs, 'محاسبه در ماشین‌حساب'],
      ['⌘', stats.tools, 'بار استفاده از ابزار'],
      ['▶', stats.games, 'بازی کامل‌شده'],
      ['✓', stats.correct || 0, 'پاسخ درست'],
      ['★', stats.bestScore, 'بالاترین امتیاز'],
      ['Σ', stats.totalGameScore || 0, 'مجموع امتیاز بازی‌ها']
    ];
    $('progStats').replaceChildren(...cards.map(([icon, value, label]) => {
      const card = el('div', 'prog-card');
      card.append(el('span', 'prog-icon', icon), el('strong', 'prog-value', faDigits(value)), el('small', '', label));
      return card;
    }));

    $('progBadges').replaceChildren(...BADGES.map(badge => {
      const ok = badge.ok(stats);
      const card = el('div', 'badge' + (ok ? ' on' : ''));
      card.append(el('span', 'badge-icon', ok ? badge.icon : '▣'), el('strong', '', badge.title), el('small', '', badge.desc));
      return card;
    }));

    const unlocked = BADGES.filter(b => b.ok(stats)).length;
    $('progSummary').textContent = `${faDigits(unlocked)} از ${faDigits(BADGES.length)} نشان گرفته‌ای. ادامه بده!`;
  }

  /* ---------- ماشین‌حساب: تاریخچه و کپی ---------- */
  function initCalculator() {
    const keys = $('calcKeys');
    const exprOut = $('calcExpression');
    const resultOut = $('calcResult');
    const list = $('calcHistoryList');
    const copyBtn = $('copyResult');
    const clearBtn = $('clearCalcHistory');
    if (!keys || !exprOut || !resultOut) return;

    let pendingExpr = '';
    let history = read(KEYS.calc, []);
    if (!Array.isArray(history)) history = [];

    function renderHistory() {
      if (!list) return;
      if (!history.length) {
        list.replaceChildren(el('li', 'hint', 'هنوز محاسبه‌ای نکردی.'));
        return;
      }
      list.replaceChildren(...history.map(item => {
        const li = document.createElement('li');
        const btn = el('button', 'calc-history-item');
        btn.type = 'button';
        btn.title = 'کپی این جواب';
        btn.append(el('span', 'hx-expr', item.expr), el('strong', 'hx-val', '= ' + item.value));
        btn.addEventListener('click', () => copyText(item.value, ok => {
          btn.classList.toggle('flash-ok', ok);
          setTimeout(() => btn.classList.remove('flash-ok'), 900);
        }));
        li.append(btn);
        return li;
      }));
    }

    function recordResult() {
      const text = resultOut.textContent.trim();
      if (!text.startsWith('=') || resultOut.classList.contains('error')) return;
      const value = text.replace(/^=\s*/, '');
      const expr = pendingExpr.trim();
      pendingExpr = '';
      if (!value || !expr || expr === '0' || expr === value) return;
      history = [{ expr, value, at: Date.now() }, ...history].slice(0, 10);
      write(KEYS.calc, history);
      bump('calcs');
      renderHistory();
    }

    // مقدار عبارت را قبل از «=» ذخیره می‌کنیم؛ بعد از اینکه ماشین‌حساب اصلی جواب را نوشت، ثبتش می‌کنیم
    keys.addEventListener('click', event => {
      if (event.target.closest('button[data-key="="]')) pendingExpr = exprOut.textContent;
    }, true);
    keys.addEventListener('click', event => {
      if (event.target.closest('button[data-key="="]')) setTimeout(recordResult, 0);
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      pendingExpr = exprOut.textContent;
      setTimeout(recordResult, 0);
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const value = resultOut.textContent.trim().replace(/^=\s*/, '');
        if (!value || value === 'نتیجه' || resultOut.classList.contains('error')) {
          copyBtn.textContent = 'اول یک جواب بگیر';
          setTimeout(() => { copyBtn.textContent = '📋 کپی جواب'; }, 1400);
          return;
        }
        copyText(value, ok => {
          copyBtn.textContent = ok ? 'کپی شد ✓' : 'کپی نشد';
          setTimeout(() => { copyBtn.textContent = '📋 کپی جواب'; }, 1300);
        });
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        history = [];
        write(KEYS.calc, history);
        renderHistory();
      });
    }
    renderHistory();
  }

  /* ---------- ابزارها: درصد پیشرفته و توضیح ساده ---------- */
  function initPercent() {
    const mode = $('pctMode');
    const run = $('pctRun');
    const out = $('pctResult');
    const explain = $('pctExplain');
    if (!mode || !run) return;

    const labels = {
      of: ['درصد', 'از این عدد'],
      what: ['عدد اول', 'عدد کل'],
      change: ['قیمت قبلی', 'قیمت جدید']
    };

    function syncLabels() {
      const [first, second] = labels[mode.value];
      $('pctALabel').textContent = first;
      $('pctBLabel').textContent = second;
      out.textContent = 'جواب اینجا می‌آید.';
      out.classList.remove('error');
      explain.textContent = '';
    }

    function fail(text) {
      out.textContent = text;
      out.classList.add('error');
      explain.textContent = '';
    }

    run.addEventListener('click', () => {
      const x = numberOf($('pctA'));
      const y = numberOf($('pctB'));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return fail('هر دو عدد را وارد کن.');
      out.classList.remove('error');

      if (mode.value === 'of') {
        const result = x * y / 100;
        out.textContent = `${numFmt(x)}٪ از ${numFmt(y)} = ${numFmt(result)}`;
        explain.textContent = `یعنی ${numFmt(y)} را به ۱۰۰ قسمت مساوی تقسیم کن (هر قسمت ${numFmt(y / 100)} می‌شود) و ${numFmt(x)} قسمت از آن‌ها را بردار. جواب می‌شود ${numFmt(result)}.`;
      } else if (mode.value === 'what') {
        if (y === 0) return fail('عدد کل نباید صفر باشد.');
        const percent = x / y * 100;
        out.textContent = `${numFmt(x)} از ${numFmt(y)} = ${numFmt(percent)}٪`;
        explain.textContent = `اول ${numFmt(x)} را بر ${numFmt(y)} تقسیم کن، بعد در ۱۰۰ ضرب کن. اگر جواب بیشتر از ۱۰۰٪ شد، یعنی عدد اول از کل بزرگ‌تر است.`;
      } else {
        if (x === 0) return fail('قیمت قبلی نباید صفر باشد.');
        const diff = y - x;
        const percent = diff / x * 100;
        const word = diff >= 0 ? 'افزایش' : 'کاهش';
        out.textContent = `از ${numFmt(x)} به ${numFmt(y)}: ${word} ${numFmt(Math.abs(percent))}٪`;
        explain.textContent = `اول تفاوت را پیدا کن: ${numFmt(y)} − ${numFmt(x)} = ${numFmt(diff)}. بعد آن را بر قیمت قبلی (${numFmt(x)}) تقسیم و در ۱۰۰ ضرب کن.`;
      }
    });

    mode.addEventListener('change', syncLabels);
    syncLabels();
  }

  // دکمهٔ «ساده‌تر بگو» زیر کارت‌ها: توضیح را از همان عددهای ورودی می‌سازد
  function attachSimpleExplain(buttonId, resultId, build) {
    const btn = $(buttonId);
    const result = $(resultId);
    if (!btn || !result) return;
    const details = el('details', 'advanced simple-explain');
    const summary = el('summary', '', '🧒 ساده‌تر بگو');
    const body = el('p', 'hint', 'بعد از حساب کردن، این بخش توضیح قدم‌به‌قدم را نشان می‌دهد.');
    details.append(summary, body);
    result.insertAdjacentElement('afterend', details);
    btn.addEventListener('click', () => {
      body.textContent = build();
    });
  }

  const divisorsOf = n => {
    const found = [];
    for (let i = 1; i * i <= n; i++) {
      if (n % i === 0) {
        found.push(i);
        if (i * i !== n) found.push(n / i);
      }
    }
    return found.sort((p, q) => p - q);
  };
  const listOf = arr => arr.map(numFmt).join('، ');

  function initSimpleExplanations() {
    attachSimpleExplain('solveGcd', 'gcdResult', () => {
      const a = Math.trunc(numberOf($('gcdA')));
      const b = Math.trunc(numberOf($('gcdB')));
      if (!(a > 0 && b > 0 && a <= 10000 && b <= 10000)) {
        return 'این توضیح برای دو عدد مثبت تا ۱۰٬۰۰۰ است.';
      }
      const da = divisorsOf(a);
      const db = divisorsOf(b);
      const common = da.filter(x => db.includes(x));
      return `شمارنده‌های ${numFmt(a)}: ${listOf(da)}\n` +
        `شمارنده‌های ${numFmt(b)}: ${listOf(db)}\n` +
        `عددهایی که در هر دو فهرست هستند: ${listOf(common)}\n` +
        `بزرگ‌ترینشان ب.م.م است: ${numFmt(Math.max(...common))}`;
    });

    attachSimpleExplain('solveQuad', 'quadResult', () => {
      const a = numberOf($('quadA'));
      const b = numberOf($('quadB'));
      const c = numberOf($('quadC'));
      if (![a, b, c].every(Number.isFinite) || a === 0) {
        return 'برای این توضیح، a و b و c باید عدد باشند و a نباید صفر باشد.';
      }
      const d = b * b - 4 * a * c;
      let text = `مرحله ۱: Δ = b² − ۴ac = (${numFmt(b)})² − ۴×${numFmt(a)}×${numFmt(c)} = ${numFmt(d)}\n`;
      if (d < 0) text += 'مرحله ۲: Δ منفی است؛ پس جواب حقیقی نداریم.';
      else if (d === 0) text += 'مرحله ۲: Δ صفر است؛ پس فقط یک جواب داریم.';
      else text += 'مرحله ۲: Δ مثبت است؛ پس دو جواب داریم: x = (−b ± √Δ) ÷ (۲a).';
      return text;
    });
  }

  /* ---------- آرکید چالش ذهنی: بیش از ۴۰ بازی، ۴ سطح، جواب درست و مرور اشتباه‌ها ---------- */
  const CH_LEVELS = [
    { label: 'پایهٔ هفتم · آسان', scale: 10 },
    { label: 'پایهٔ نهم · متوسط', scale: 25 },
    { label: 'پایهٔ یازدهم · سخت', scale: 60 },
    { label: 'المپیادی · فوق‌حرفه‌ای', scale: 120 }
  ];
  const chGcd = (a, b) => (b ? chGcd(b, a % b) : Math.abs(a));
  const chLcm = (a, b) => (a * b) / chGcd(a, b);
  const chIsPrime = n => {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
    return true;
  };
  const chNum = x => faDigits(String(Math.round(x * 1e6) / 1e6)).replace('.', '٫');
  const CH_TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25], [20, 21, 29], [9, 40, 41]];
  const CH_SQRT_BASES = [2, 3, 5, 6, 7];
  // سازندهٔ سؤال: متن، جواب درست، نمایش جواب، توضیح کوتاه و تلورانس اعشاری
  const chQ = (text, ans, why, opt) => {
    const o = opt || {};
    return { text, ans, show: o.show !== undefined ? o.show : chNum(ans), why: why || '', tol: o.tol || 0 };
  };

  const CH_GAMES = [
    { id: 'add', label: 'شتاب جمع', gen: (lv, s) => {
      const a = randInt(2, s), b = randInt(2, s);
      return chQ(`${a} + ${b}`, a + b, `${a} و ${b} را کنار هم جمع کن.`);
    } },
    { id: 'subtract', label: 'تفریق برق‌آسا', gen: (lv, s) => {
      const a = randInt(2, s), b = randInt(2, s);
      return chQ(`${a + b} − ${b}`, a, `از ${a + b} عدد ${b} را کم کن.`);
    } },
    { id: 'multiply', label: 'ضرب موشکی', gen: (lv, s) => {
      const a = randInt(2, s), b = randInt(2, Math.max(3, Math.floor(s / 2)));
      return chQ(`${a} × ${b}`, a * b, `${a} را ${b} بار جمع کن.`);
    } },
    { id: 'divide', label: 'تقسیم دقیق', gen: (lv, s) => {
      const a = randInt(2, s), b = randInt(2, Math.max(3, Math.floor(s / 2)));
      return chQ(`${a * b} ÷ ${a}`, b, `${a} × ${b} = ${a * b} است، پس جواب ${b} است.`);
    } },
    { id: 'percent', label: 'درصدشکن', gen: (lv, s) => {
      const p = [10, 20, 25, 50][randInt(0, 3)], n = randInt(2, Math.max(3, Math.floor(s / 2))) * 20;
      return chQ(`${p}٪ از ${n}`, p * n / 100, `${n} را در ${p} ضرب کن و بر ۱۰۰ تقسیم کن.`);
    } },
    { id: 'square', label: 'مربع‌ساز', gen: (lv, s) => {
      const a = randInt(2, Math.max(4, Math.floor(s / 2)));
      return chQ(`${a} به توان ۲`, a * a, `${a} × ${a} = ${a * a}`);
    } },
    { id: 'root', label: 'جذر‌یاب', gen: (lv, s) => {
      const n = randInt(2, Math.max(3, Math.floor(s / 2)));
      return chQ(`√${n * n}`, n, `عددی که مربعش ${n * n} شود، ${n} است.`);
    } },
    { id: 'power', label: 'توان‌پلاس', gen: lv => {
      const n = randInt(2, lv >= 3 ? 5 : 4), e = randInt(2, lv >= 3 ? 4 : 3);
      return chQ(`${n} به توان ${e}`, n ** e, `${n} را ${e} بار در خودش ضرب کن.`);
    } },
    { id: 'missing', label: 'عدد گمشده', gen: (lv, s) => {
      const a = randInt(2, s), b = randInt(2, s);
      return chQ(`${a} × ؟ = ${a * b}`, b, `${a * b} را بر ${a} تقسیم کن.`);
    } },
    { id: 'compare', label: 'نبرد بزرگ‌ترها', gen: (lv, s) => {
      const a = randInt(2, s), b = randInt(2, s), x = a * b, y = a + b;
      return chQ(`بزرگ‌تر کدام است؟ ${x} یا ${y}`, Math.max(x, y), `${x} و ${y} را حساب کن و بزرگ‌تر را بنویس.`);
    } }
  ];
  // بازی‌های بعدی را به همین فهرست اضافه می‌کنیم
  CH_GAMES.push(
    { id: 'sequence', label: 'دنباله‌یاب', gen: () => {
      const d = randInt(2, 9), n = randInt(1, 10);
      return chQ(`دنباله: ${n}، ${n + d}، ${n + 2 * d}، ؟`, n + 3 * d, `اختلاف ثابت ${d} است؛ پس ${n + 2 * d} + ${d} = ${n + 3 * d}`);
    } },
    { id: 'even', label: 'زوج یا فرد', gen: () => {
      const n = randInt(10, 99), z = n % 2 === 0;
      return chQ(`${n} زوج است یا فرد؟ (زوج = ۲ ، فرد = ۱)`, z ? 2 : 1, `${n} بر ۲ ${z ? 'بخش‌پذیر' : 'بخش‌پذیر نیست'} است.`, { show: z ? 'زوج (۲)' : 'فرد (۱)' });
    } },
    { id: 'prime', label: 'شکار عدد اول', gen: lv => {
      const n = randInt(2, lv >= 3 ? 60 : 30);
      let x = n + 1;
      while (!chIsPrime(x)) x++;
      return chQ(`کوچک‌ترین عدد اول بزرگ‌تر از ${n} چیست؟`, x, `عددهای ${n + 1} به بعد را یکی‌یکی امتحان کن؛ اولین اول همین است.`);
    } },
    { id: 'fraction', label: 'کسر برتر', gen: () => {
      const x = randInt(1, 9), y = randInt(2, 10), u = randInt(1, 9), v = randInt(2, 10);
      const l = x * v, r = u * y, code = l === r ? 0 : (l > r ? 1 : 2);
      const show = code === 0 ? 'برابرند (۰)' : code === 1 ? `${x}/${y} بزرگ‌تر است (۱)` : `${u}/${v} بزرگ‌تر است (۲)`;
      return chQ(`کدام کسر بزرگ‌تر است؟ ${x}/${y} یا ${u}/${v}؟ (اولی = ۱ ، دومی = ۲ ، برابر = ۰)`, code, `${x}×${v} = ${l} و ${u}×${y} = ${r} را مقایسه کن.`, { show });
    } },
    { id: 'gcd', label: 'ب.م.م سریع', gen: (lv, s) => {
      const k = randInt(1, 5), a = randInt(2, Math.max(3, Math.floor(s / 3))), b = randInt(2, Math.max(3, Math.floor(s / 3)));
      const x = a * b * 2, y = a * (b + k);
      return chQ(`ب.م.م ${x} و ${y}`, chGcd(x, y), `بزرگ‌ترین عدد که هر دو را می‌شمارد.`);
    } },
    { id: 'lcm', label: 'ک.م.م سریع', gen: lv => {
      const x = randInt(2, lv >= 3 ? 20 : 12), y = randInt(2, lv >= 3 ? 20 : 12);
      return chQ(`ک.م.مِ ${x} و ${y}`, chLcm(x, y), `مضرب‌های ${x} و ${y} را بنویس تا اولین مشترک را پیدا کنی.`);
    } },
    { id: 'double', label: 'دوبرابر کن', gen: (lv, s) => {
      const n = randInt(2, s * 2);
      return chQ(`دو برابرِ ${n}`, 2 * n, `${n} + ${n} = ${2 * n}`);
    } },
    { id: 'triple', label: 'سه‌برابر کن', gen: (lv, s) => {
      const n = randInt(2, s * 2);
      return chQ(`سه برابرِ ${n}`, 3 * n, `${n} + ${n} + ${n} = ${3 * n}`);
    } },
    { id: 'estimate', label: 'محاسبهٔ ذهنی', gen: lv => {
      const lo = lv >= 3 ? 100 : 11, hi = lv >= 3 ? 999 : 99;
      const x = randInt(lo, hi), y = randInt(lo, hi);
      return chQ(`حاصل ${x} + ${y} چقدر است؟`, x + y, `یکان‌ها، دهگان‌ها و صدگان‌ها را جداگانه جمع کن.`);
    } },
    { id: 'reverse', label: 'عملیات معکوس', gen: (lv, s) => {
      const a = randInt(2, s), b = randInt(2, Math.max(3, Math.floor(s / 2)));
      return chQ(`${a * b} ÷ ؟ = ${b}`, a, `${a * b} را بر ${b} تقسیم کن.`);
    } }
  );
  CH_GAMES.push(
    { id: 'negpow', label: 'توان منفی', gen: lv => {
      const a = randInt(2, lv >= 3 ? 9 : 5), b = randInt(1, lv >= 3 ? 3 : 2);
      const v = 1 / a ** b;
      return chQ(`${a} به توان −${b} (اعشاری، تا ۴ رقم)`, v, `${a} به توان −${b} یعنی ۱ ÷ ${a ** b}`, { tol: 0.0005, show: chNum(Number(v.toFixed(4))) });
    } },
    { id: 'sqrtapprox', label: 'جذر تقریبی', gen: (lv, s) => {
      let n;
      do { n = randInt(2, Math.max(10, s * 2)); } while (Number.isInteger(Math.sqrt(n)));
      const f = Math.floor(Math.sqrt(n));
      return chQ(`√${n} را تا دو رقم اعشار بنویس`, Math.sqrt(n), `${f} < √${n} < ${f + 1}`, { tol: 0.006, show: chNum(Number(Math.sqrt(n).toFixed(2))) });
    } },
    { id: 'digitsum', label: 'مجموع ارقام', gen: lv => {
      const hi = lv >= 3 ? 9999 : lv >= 2 ? 999 : 99;
      const n = randInt(10, hi), digits = String(n).split('');
      const sum = digits.reduce((t, d) => t + Number(d), 0);
      return chQ(`مجموع ارقام ${n} چند است؟`, sum, `${digits.join(' + ')} = ${sum}`);
    } },
    { id: 'avg', label: 'عدد گمشدهٔ میانگین', gen: (lv, s) => {
      const m = randInt(5, s), x = randInt(1, m), y = randInt(1, m), z = 3 * m - x - y;
      return chQ(`میانگین سه عدد ${x}، ${y} و ؟ برابر ${m} است. عدد سوم چیست؟`, z, `مجموع باید ${3 * m} شود؛ پس ${3 * m} − ${x} − ${y} = ${z}`);
    } },
    { id: 'perimeter', label: 'محیط مستطیل', gen: (lv, s) => {
      const l = randInt(2, s), w = randInt(2, s);
      return chQ(`محیط مستطیلی به طول ${l} و عرض ${w} چقدر است؟`, 2 * (l + w), `2 × (${l} + ${w}) = ${2 * (l + w)}`);
    } },
    { id: 'triarea', label: 'مساحت مثلث', gen: (lv, s) => {
      const b = 2 * randInt(1, Math.max(2, Math.floor(s / 2))), h = randInt(2, s);
      return chQ(`مساحت مثلثی با قاعدهٔ ${b} و ارتفاع ${h}`, b * h / 2, `(${b} × ${h}) ÷ ۲ = ${b * h / 2}`);
    } },
    { id: 'pyth', label: 'قضیهٔ فیثاغورس', gen: lv => {
      const pool = CH_TRIPLES.slice(0, lv >= 3 ? CH_TRIPLES.length : lv === 2 ? 5 : 3);
      const [p, q, r] = pool[randInt(0, pool.length - 1)];
      if (Math.random() < 0.5) return chQ(`در مثلث قائم‌الزاویه، ضلع‌های قائم ${p} و ${q}؛ وتر چقدر است؟`, r, `${p}² + ${q}² = ${p * p + q * q} ⇒ وتر = ${r}`);
      return chQ(`وتر ${r} و یک ضلع قائم ${p}؛ ضلع قائم دیگر چقدر است؟`, q, `${r}² − ${p}² = ${r * r - p * p} ⇒ ضلع = ${q}`);
    } },
    { id: 'vieta', label: 'ریشهٔ بزرگ‌تر', gen: (lv, s) => {
      const top = Math.max(3, Math.floor(s / 3));
      const r1 = randInt(1, top), r2 = randInt(1, top), S = r1 + r2, P = r1 * r2;
      return chQ(`معادلهٔ x² − ${S}x + ${P} = ۰ ؛ بزرگ‌ترین ریشه چیست؟`, Math.max(r1, r2), `دو عدد با جمع ${S} و حاصل‌ضرب ${P}: ${r1} و ${r2}`);
    } },
    { id: 'geoseq', label: 'دنبالهٔ هندسی', gen: lv => {
      const a = randInt(1, 9), r = randInt(2, lv >= 3 ? 5 : 3);
      return chQ(`دنباله: ${a}، ${a * r}، ${a * r * r}، ؟`, a * r ** 3, `هر جمله ${r} برابر جملهٔ قبلی است؛ ${a * r * r} × ${r} = ${a * r ** 3}`);
    } },
    { id: 'fibo', label: 'فیبوناچی ساختگی', gen: (lv, s) => {
      const top = Math.max(2, Math.floor(s / 4)), x = randInt(1, top), y = randInt(1, top);
      return chQ(`دنباله: ${x}، ${y}، ${x + y}، ${x + 2 * y}، ؟`, 2 * x + 3 * y, `هر جمله مجموع دو جملهٔ قبلی است: ${x + y} + ${x + 2 * y} = ${2 * x + 3 * y}`);
    } },
    { id: 'polyangle', label: 'زاویه‌های چندضلعی', gen: lv => {
      const n = randInt(3, lv >= 3 ? 14 : 10);
      return chQ(`مجموع زاویه‌های داخلی یک ${n}‌ضلعی محدب چند درجه است؟`, (n - 2) * 180, `(${n} − ۲) × ۱۸۰° = ${(n - 2) * 180}°`);
    } },
    { id: 'diag', label: 'قطرهای چندضلعی', gen: lv => {
      const n = randInt(4, lv >= 3 ? 20 : 12);
      return chQ(`یک ${n}‌ضلعی محدب چند قطر دارد؟`, n * (n - 3) / 2, `${n} × (${n} − ۳) ÷ ۲ = ${n * (n - 3) / 2}`);
    } }
  );
  CH_GAMES.push(
    { id: 'trig', label: 'مثلثات زوایای ویژه', gen: lv => {
      const pool = [['sin', 30, 0.5], ['cos', 60, 0.5], ['sin', 90, 1], ['cos', 0, 1], ['tan', 45, 1], ['sin', 0, 0],
        ['cos', 90, 0], ['tan', 60, Math.sqrt(3)], ['sin', 60, Math.sqrt(3) / 2], ['cos', 30, Math.sqrt(3) / 2]];
      const [f, deg, v] = pool[randInt(0, lv >= 3 ? pool.length - 1 : 5)];
      return chQ(`${f} ${deg}° = ؟ (تا دو رقم اعشار)`, v, `مقدار ${f} ${deg}° را از جدول زوایای ویژه بخوان.`, { tol: 0.006, show: chNum(Number(v.toFixed(2))) });
    } },
    { id: 'primecount', label: 'شمارش اعداد اول', gen: lv => {
      const n = randInt(10, lv >= 3 ? 100 : lv >= 2 ? 50 : 30), primes = [];
      for (let i = 2; i <= n; i++) if (chIsPrime(i)) primes.push(i);
      return chQ(`چند عدد اول کوچک‌تر یا مساوی ${n} وجود دارد؟`, primes.length, `اعداد اول: ${primes.join('، ')}`);
    } },
    { id: 'divcount', label: 'تعداد شمارنده‌ها', gen: lv => {
      const n = randInt(6, lv >= 3 ? 200 : lv >= 2 ? 80 : 40), d = divisorsOf(n);
      return chQ(`${n} چند شمارنده دارد؟`, d.length, `شمارنده‌های ${n}: ${d.join('، ')}`);
    } },
    { id: 'percentup', label: 'افزایش درصدی', gen: (lv, s) => {
      const k = randInt(1, Math.max(2, Math.floor(s / 5))), p = [10, 20, 25, 50][randInt(0, 3)], x = 100 * k;
      return chQ(`قیمت ${x} را ${p}٪ افزایش دادیم؛ قیمت جدید چند شد؟`, x + k * p, `${p}٪ از ${x} = ${k * p}؛ پس ${x} + ${k * p} = ${x + k * p}`);
    } },
    { id: 'ratio2', label: 'تناسب ساده', gen: lv => {
      const a = randInt(2, 9), b = randInt(2, 9), k = randInt(2, lv >= 3 ? 12 : 9);
      return chQ(`${a} : ${b} = ${a * k} : ؟`, b * k, `هر دو طرف را در ${k} ضرب کن؛ ${b} × ${k} = ${b * k}`);
    } },
    { id: 'modulo', label: 'باقی‌مانده', gen: (lv, s) => {
      const a = randInt(10, Math.max(12, s * 5)), m = randInt(2, 12);
      return chQ(`باقی‌مانده تقسیم ${a} بر ${m} چند است؟`, a % m, `${a} = ${m} × ${Math.floor(a / m)} + ${a % m}`);
    } },
    { id: 'expo', label: 'قانون توان‌ها', gen: lv => {
      const b = randInt(2, 5), x = randInt(1, lv >= 3 ? 6 : 4), y = randInt(1, lv >= 3 ? 6 : 4);
      return chQ(`${b}^${x} × ${b}^${y} = ${b}^؟`, x + y, `پایه‌ها یکی‌اند پس توان‌ها جمع می‌شوند: ${x} + ${y} = ${x + y}`);
    } },
    { id: 'between', label: 'اعداد صحیح بین دو عدد', gen: (lv, s) => {
      const a = randInt(-s, s), b = a + randInt(2, Math.max(3, Math.floor(s / 2)));
      return chQ(`چند عدد صحیح بین ${a} و ${b} هست؟ (خود ${a} و ${b} حساب نمی‌شوند)`, b - a - 1, `از ${a + 1} تا ${b - 1} تعداد ${b - a - 1} عدد است.`);
    } },
    { id: 'negadd', label: 'اعداد منفی', gen: (lv, s) => {
      const a = randInt(1, s), b = randInt(1, s), c = randInt(1, s);
      return chQ(`${a} − ${b} − ${c} = ؟`, a - b - c, `${a} − ${b} = ${a - b}؛ سپس ${a - b} − ${c} = ${a - b - c}`);
    } },
    { id: 'order', label: 'اولویت عملیات', gen: (lv, s) => {
      const a = randInt(1, s), b = randInt(2, Math.max(3, Math.floor(s / 2))), c = randInt(2, Math.max(3, Math.floor(s / 2)));
      return chQ(`${a} + ${b} × ${c} = ؟`, a + b * c, `اول ضرب: ${b} × ${c} = ${b * c}؛ سپس ${a} + ${b * c}`);
    } },
    { id: 'sqrtmult', label: 'ضریب بیرون رادیکال', gen: lv => {
      const a = randInt(2, lv >= 3 ? 9 : 5), b = CH_SQRT_BASES[randInt(0, lv >= 3 ? 4 : 2)];
      return chQ(`√${a * a * b} را به شکل ضریب × √عدد بنویس؛ ضریب چیست؟`, a, `${a * a * b} = ${a * a} × ${b} ⇒ √${a * a * b} = ${a}√${b}`);
    } }
  );

  function initChallenge() {
    const levelSel = $('chLevel'), gameSel = $('chGame'), startBtn = $('chStart');
    if (!levelSel || !gameSel || !startBtn) return;
    const timeEl = $('chTime'), scoreEl = $('chScore'), bestEl = $('chBest'), qEl = $('chQuestion');
    const form = $('chForm'), input = $('chAnswer'), fb = $('chFeedback');
    const TOTAL = 60000;
    let timer = null, endAt = 0, score = 0, correctCount = 0, answered = 0;
    let level = 1, streak = 0, bestStreak = 0, current = null, running = false, misses = [];
    const bestVal = () => Number(read(KEYS.best, 0)) || 0;

    // نوار زمان، بخش مرور و دکمهٔ «جواب را ببین» را در همین صفحه می‌سازیم
    const bar = el('div', 'ch-bar');
    const barFill = el('span');
    bar.append(barFill);
    qEl.insertAdjacentElement('beforebegin', bar);
    const review = el('div', 'ch-review');
    review.hidden = true;
    fb.insertAdjacentElement('afterend', review);
    const skipBtn = el('button', 'ch-skip', 'جواب را ببین ⏭');
    skipBtn.type = 'button';
    form.append(skipBtn);

    // فهرست بازی‌ها و سطح‌ها از همین تعریف‌ها ساخته می‌شود
    const gameOpts = [{ id: 'mixed', label: 'آرکید ترکیبی (همهٔ بازی‌ها)' }].concat(CH_GAMES);
    gameSel.replaceChildren(...gameOpts.map(g => {
      const o = el('option', '', g.label);
      o.value = g.id;
      return o;
    }));
    levelSel.replaceChildren(...CH_LEVELS.map((lv, i) => {
      const o = el('option', '', lv.label);
      o.value = String(i + 1);
      return o;
    }));
    bestEl.textContent = faDigits(bestVal());

    const scaleOf = lv => CH_LEVELS[lv - 1].scale;
    const parseAnswer = raw => Number(toEnDigits(raw).replace(/[−–]/g, '-').replace(/\s/g, '').replace(/,/g, ''));
    const isCorrect = (q, val) => Number.isFinite(val) && Math.abs(val - q.ans) <= (q.tol || 0) + 1e-9;

    function makeQuestion(gameId, lv) {
      const pool = gameId === 'mixed' ? CH_GAMES : CH_GAMES.filter(g => g.id === gameId);
      const g = pool[randInt(0, pool.length - 1)];
      const q = g.gen(lv, scaleOf(lv));
      q.game = g.label;
      return q;
    }

    function pulse(kind) {
      qEl.classList.remove('ch-ok', 'ch-bad');
      void qEl.offsetWidth;
      qEl.classList.add(kind);
    }

    function next() {
      current = makeQuestion(gameSel.value, level);
      qEl.textContent = faDigits(current.text.includes('؟') ? current.text : current.text + ' = ؟');
      input.value = '';
      input.focus();
    }

    function recordMiss(yours) {
      misses.push({ text: current.text, your: yours, show: current.show, why: current.why, game: current.game });
      if (misses.length > 200) misses.shift();
    }

    function tick() {
      const left = Math.max(0, endAt - Date.now());
      timeEl.textContent = faDigits(Math.ceil(left / 1000));
      barFill.style.width = (left / TOTAL * 100) + '%';
      if (!left) finish();
    }

    function start() {
      score = 0; correctCount = 0; answered = 0; streak = 0; bestStreak = 0; misses = [];
      level = Number(levelSel.value) || 1;
      scoreEl.textContent = '۰';
      fb.textContent = '';
      fb.classList.remove('error');
      review.hidden = true;
      review.replaceChildren();
      running = true;
      endAt = Date.now() + TOTAL;
      input.disabled = false;
      skipBtn.disabled = false;
      startBtn.textContent = 'شروع دوباره';
      next();
      clearInterval(timer);
      timer = setInterval(tick, 150);
      tick();
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!running || !current) return;
      const raw = toEnDigits(input.value).trim();
      if (!raw) return;
      const val = parseAnswer(raw);
      answered++;
      if (isCorrect(current, val)) {
        streak++;
        bestStreak = Math.max(bestStreak, streak);
        correctCount++;
        const gained = Math.round((12 + level * 5 + Math.min(streak, 8) * 2) * (1 + (streak >= 5 ? 0.25 : 0)));
        score += gained;
        fb.textContent = `✓ درست | +${faDigits(gained)} امتیاز` + (streak >= 5 ? ` | زنجیرهٔ ${faDigits(streak)} تایی 🔥` : '');
        fb.classList.remove('error');
        pulse('ch-ok');
        if (streak % 5 === 0 && level < CH_LEVELS.length) {
          level++;
          fb.textContent += ' | مرحلهٔ بالاتر ⬆';
        }
      } else {
        streak = 0;
        recordMiss(raw);
        fb.textContent = `✗ جواب درست: ${current.show}` + (current.why ? ` — ${faDigits(current.why)}` : '');
        fb.classList.add('error');
        pulse('ch-bad');
      }
      scoreEl.textContent = faDigits(score);
      next();
    });

    skipBtn.addEventListener('click', () => {
      if (!running || !current) return;
      answered++;
      streak = 0;
      recordMiss('—');
      fb.textContent = `⏭ جواب درست: ${current.show}` + (current.why ? ` — ${faDigits(current.why)}` : '');
      fb.classList.add('error');
      pulse('ch-bad');
      next();
    });

    function renderReview(accuracy) {
      review.replaceChildren();
      review.append(
        el('h3', '', 'مرور بازی'),
        el('p', 'ch-summary', `پاسخ‌ها: ${faDigits(answered)} | درست: ${faDigits(correctCount)} | دقت: ${faDigits(accuracy)}٪ | بهترین زنجیره: ${faDigits(bestStreak)}`)
      );
      if (!misses.length) {
        review.append(el('p', 'ch-perfect', answered ? 'بی‌نقص بودی! هیچ اشتباهی نداشتی 🎉' : 'هنوز سؤالی جواب داده نشد.'));
      } else {
        const list = el('ol', 'ch-miss-list');
        misses.slice(-40).forEach(m => {
          const li = el('li', '');
          li.append(
            el('span', 'ch-miss-q', faDigits(m.text)),
            el('span', 'ch-miss-your', m.your === '—' ? 'رد شد' : 'جوابت: ' + faDigits(m.your)),
            el('strong', 'ch-miss-ok', 'درست: ' + m.show)
          );
          if (m.why) li.append(el('small', 'ch-miss-why', faDigits(m.why)));
          list.append(li);
        });
        review.append(list);
      }
      review.hidden = false;
    }

    function finish() {
      if (!running) return;
      running = false;
      clearInterval(timer);
      timeEl.textContent = '۰';
      barFill.style.width = '0%';
      qEl.textContent = 'پایان بازی | امتیاز: ' + faDigits(score);
      input.disabled = true;
      skipBtn.disabled = true;
      const accuracy = answered ? Math.round(correctCount / answered * 100) : 0;
      const stats = getStats();
      stats.games = (stats.games || 0) + 1;
      stats.correct = (stats.correct || 0) + correctCount;
      stats.bestScore = Math.max(stats.bestScore || 0, score);
      stats.totalGameScore = (stats.totalGameScore || 0) + score;
      stats.gameStreak = Math.max(stats.gameStreak || 0, bestStreak);
      write(KEYS.stats, stats);
      if (score > bestVal()) {
        write(KEYS.best, score);
        bestEl.textContent = faDigits(score);
        fb.textContent = `رکورد تازه ثبت شد 🏆 | دقت: ${faDigits(accuracy)}٪`;
      } else {
        fb.textContent = `رکورد فعلی: ${faDigits(bestVal())} | دقت این بازی: ${faDigits(accuracy)}٪`;
      }
      fb.classList.remove('error');
      renderReview(accuracy);
      startBtn.textContent = 'بازی تازه';
      renderProgress();
    }

    startBtn.addEventListener('click', start);
  }

  /* ---------- شمارش استفاده از ابزارها ---------- */
  const toolsPanel = $('toolsPanel');
  if (toolsPanel) {
    toolsPanel.addEventListener('click', event => {
      if (event.target.closest('button.primary-btn')) bump('tools');
    });
  }

  document.querySelectorAll('.nav-item[data-mode]').forEach(btn => {
    if (btn.dataset.mode === 'progress') btn.addEventListener('click', renderProgress);
  });
  window.addEventListener('sam:profile-changed', renderProgress);

  /* ---------- Enter داخل فرم‌ها ----------
     کد اصلی ماشین‌حساب روی Enter کل صفحه را می‌گیرد و «=» اجرا می‌کند و پیش‌فرض مرورگر را لغو می‌کند.
     برای همین داخل فرم‌های این بخش، Enter را به بیرون نمی‌فرستیم تا فرم و متن‌باکس طبیعی کار کنند. */
  document.querySelectorAll('#chForm input').forEach(field => {
    field.addEventListener('keydown', event => { if (event.key === 'Enter') event.stopPropagation(); });
  });

  /* ---------- راه‌اندازی ---------- */
  getDeviceId();
  setMessage('SAM MATH آماده است ✦');

  initCalculator();
  initPercent();
  initSimpleExplanations();
  initChallenge();
  renderProgress();
})();
