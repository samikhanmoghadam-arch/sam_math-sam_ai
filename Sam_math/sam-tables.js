/* SAM MATH · جدول‌های تصویری: غربال اراتستن (مرحله‌به‌مرحله)، جدول ساندرام و بررسی عدد در ساندرام.
   کاملاً آفلاین. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const fa = s => String(s).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  const sup = s => String(s).replace(/[0-9]/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
  const ord = i => fa(i) + 'ام';
  const toEn = s => String(s)
    .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
    .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .replace(/[−–]/g, '-')
    .trim();
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const isPrime = n => {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
    return true;
  };
  const factorize = n => {
    const parts = [];
    let m = n;
    for (let p = 2; p * p <= m; p++) {
      let c = 0;
      while (m % p === 0) { m /= p; c++; }
      if (c) parts.push(c > 1 ? fa(p) + sup(c) : fa(p));
    }
    if (m > 1) parts.push(fa(m));
    return parts.join(' × ');
  };
  // حلقهٔ پخش: هر بار یک مرحله، با فاصلهٔ زمانی انتخاب‌شده
  function player(cfg) {
    let timer = null;
    const label = (playing) => { cfg.playBtn.textContent = playing ? '⏸ توقف' : (cfg.isDone() ? '▶ دوباره' : '▶ ادامه'); };
    const stop = () => { clearTimeout(timer); timer = null; label(false); };
    const loop = () => {
      timer = null;
      if (cfg.isDone()) { label(false); return; }
      cfg.step();
      if (cfg.isDone()) { label(false); return; }
      timer = setTimeout(loop, cfg.delay());
      label(true);
    };
    return {
      stop,
      toggle() {
        if (timer) { stop(); return; }
        if (cfg.isDone()) { if (!cfg.build()) return; }
        else if (!cfg.ensure()) return;
        loop();
      },
      next() {
        stop();
        if (!cfg.ensure()) return;
        if (!cfg.isDone()) cfg.step();
        label(false);
      },
      all() {
        stop();
        if (!cfg.ensure()) return;
        while (!cfg.isDone()) cfg.step();
        label(false);
      }
    };
  }

  /* ================= غربال اراتستن ================= */
  function buildSieve(N) {
    const isP = new Array(N + 1).fill(true);
    isP[0] = false;
    isP[1] = false;
    const steps = [], events = [], by = Array.from({ length: N + 1 }, () => []);
    for (let p = 2; p * p <= N; p++) {
      if (!isP[p]) continue;
      const step = { p, index: steps.length + 1, strikes: [] };
      steps.push(step);
      for (let n = p * p; n <= N; n += p) {
        const ev = { n, p, step: step.index, seq: events.length + 1 };
        events.push(ev);
        step.strikes.push(ev);
        by[n].push(ev);
        isP[n] = false;
      }
    }
    const primes = [];
    for (let n = 2; n <= N; n++) if (isP[n]) primes.push(n);
    return { N, steps, events, by, primes, isP };
  }

  const SV = { data: null, cells: [], badges: [], counts: [], cur: null, idx: 0 };
  const sieveDelay = () => Number($('sieveVizSpeed').value) || 450;

  function sieveReadRange() {
    return { a: Math.floor(Number(toEn($('sieveFrom').value))), b: Math.floor(Number(toEn($('sieveTo').value))) };
  }

  function sieveBuild() {
    const { a, b } = sieveReadRange();
    const now = $('sieveVizNow');
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 1 || b < 2 || a > b) {
      now.textContent = 'بازه معتبر نیست؛ «از» باید ۱ یا بیشتر و «تا» کوچک‌تر از «از» نباشد.';
      SV.data = null;
      return false;
    }
    if (b > 1000) {
      now.textContent = 'جدول تصویری تا عدد ۱۰۰۰ است؛ بازه را کوچک‌تر کن.';
      SV.data = null;
      return false;
    }
    SV.data = buildSieve(b);
    SV.idx = 0;
    SV.cur = null;
    SV.counts = new Array(b + 1).fill(0);
    const grid = $('sieveGrid');
    const frag = document.createDocumentFragment();
    SV.cells = [null];
    SV.badges = [null];
    for (let n = 1; n <= b; n++) {
      const c = el('div', 'cell' + (n < a ? ' out' : '') + (n === 1 ? ' one' : ''), fa(n));
      c.dataset.n = String(n);
      const badge = el('i', 'cell-badge');
      c.append(badge);
      SV.cells[n] = c;
      SV.badges[n] = badge;
      frag.append(c);
    }
    grid.replaceChildren(frag);
    now.textContent = `آماده: جدول ۱ تا ${fa(b)}؛ ${fa(SV.data.steps.length)} مرحله (برای عددهای اول تا √${fa(b)}).`;
    const inRange = SV.data.primes.filter(p => p >= a).length;
    $('sieveInfo').replaceChildren(
      el('p', 'info-title', `بازهٔ ${fa(a)} تا ${fa(b)}: ${fa(inRange)} عدد اول`),
      el('p', 'info-line', `کل خط‌ها: ${fa(SV.data.events.length)} بار؛ اعداد اول کل جدول: ${fa(SV.data.primes.length)} عدد.`),
      el('p', 'info-line', 'روی هر عدد بزن تا همهٔ اطلاعاتش را ببینی.')
    );
    if (!SV.data.steps.length) sieveFinish();
    return true;
  }

  function sieveStep() {
    const d = SV.data;
    const st = d.steps[SV.idx];
    SV.idx++;
    if (SV.cur) SV.cur.classList.remove('cur');
    const pc = SV.cells[st.p];
    pc.classList.add('found', 'cur');
    SV.cur = pc;
    st.strikes.forEach((ev, i) => {
      const c = SV.cells[ev.n];
      SV.counts[ev.n]++;
      c.classList.add('struck');
      c.style.setProperty('--d', Math.min(i * 16, 700) + 'ms');
      SV.badges[ev.n].textContent = '×' + fa(SV.counts[ev.n]);
    });
    $('sieveVizNow').textContent =
      `مرحلهٔ ${fa(st.index)} از ${fa(d.steps.length)}: عدد اول ${fa(st.p)} پیدا شد و از ${fa(st.p * st.p)} شروع کرد به خط زدن مضرب‌هایش؛ ${fa(st.strikes.length)} عدد خط خورد.`;
    if (SV.idx >= d.steps.length) sieveFinish();
  }

  function sieveFinish() {
    const d = SV.data;
    if (SV.cur) { SV.cur.classList.remove('cur'); SV.cur = null; }
    for (let n = 2; n <= d.N; n++) if (d.isP[n]) SV.cells[n].classList.add('found', 'done');
    $('sieveVizNow').textContent = `پایان: ${fa(d.primes.length)} عدد اول تا ${fa(d.N)} پیدا شد (خانه‌های سبز).`;
    SV.idx = d.steps.length;
  }

  function sieveInfo(n) {
    const d = SV.data;
    if (!d || n < 1 || n > d.N) return;
    const lines = [];
    if (n === 1) {
      lines.push(['title', 'عدد ۱']);
      lines.push(['', '۱ نه اول است نه مرکب؛ در غربال هرگز خط نمی‌خورد و هیچ عددی را هم نمی‌شمارد.']);
    } else if (d.isP[n]) {
      lines.push(['title', `${fa(n)} عدد اول است (${ord(d.primes.indexOf(n) + 1)} عدد اول)`]);
      lines.push(['', 'هیچ عدد اول کوچک‌تری آن را نمی‌شمارد، پس هیچ‌وقت خط نمی‌خورد و سبز می‌ماند.']);
      const own = d.steps.find(s => s.p === n);
      if (own) {
        lines.push(['', `این عدد اول در مرحلهٔ ${fa(own.index)} ${fa(own.strikes.length)} عدد را خط زد: ${own.strikes.map(e => fa(e.n)).join('، ')}`]);
      } else {
        lines.push(['', `مربع این عدد از ${fa(d.N)} بزرگ‌تر است، پس مرحلهٔ خط زدن ندارد.`]);
      }
    } else {
      const hits = d.by[n];
      lines.push(['title', `${fa(n)} مرکب است: ${factorize(n)}`]);
      lines.push(['', `این عدد ${fa(hits.length)} بار خط خورده.`]);
      hits.forEach((ev, i) => lines.push(['', `${ord(i + 1)} خط: توسط ${fa(ev.p)} در مرحلهٔ ${fa(ev.step)}؛ این خط، خط شمارهٔ ${fa(ev.seq)} از کل ${fa(d.events.length)} خط بود.`]));
    }
    $('sieveInfo').replaceChildren(...lines.map(([k, t]) => el('p', k ? 'info-' + k : 'info-line', t)));
    document.querySelectorAll('#sieveGrid .cell.sel').forEach(x => x.classList.remove('sel'));
    if (SV.cells[n]) SV.cells[n].classList.add('sel');
  }

  const sieveRun = player({
    playBtn: $('sieveVizPlay'),
    isDone: () => !SV.data || SV.idx >= SV.data.steps.length,
    ensure: () => (SV.data ? true : sieveBuild()),
    build: sieveBuild,
    step: sieveStep,
    delay: sieveDelay
  });

  /* ================= جدول ساندرام ================= */
  // i + j + 2ij = ((2i+1)(2j+1) − 1) ÷ 2  ⇒  خط خوردن k یعنی 2k+1 مرکب است
  function buildSundaram(N) {
    const steps = [], events = [], by = Array.from({ length: N + 1 }, () => []);
    for (let i = 1; 2 * i + 2 * i * i <= N; i++) {
      const step = { i, index: steps.length + 1, items: [] };
      steps.push(step);
      for (let j = i; ; j++) {
        const k = i + j + 2 * i * j;
        if (k > N) break;
        const ev = { i, j, k, step: step.index, seq: events.length + 1 };
        events.push(ev);
        step.items.push(ev);
        by[k].push(ev);
      }
    }
    const remain = [];
    for (let k = 1; k <= N; k++) if (!by[k].length) remain.push(k);
    return { N, steps, events, by, remain };
  }

  // تحلیل یک k: مقسوم‌علیه‌های آزمایش‌شده و جفت‌های (i,j) که آن را می‌سازند
  function sunAnalyze(k) {
    const m = 2 * k + 1;
    const pairs = [], tested = [];
    for (let d = 3; d * d <= m; d += 2) {
      tested.push(d);
      if (m % d === 0) pairs.push({ i: (d - 1) / 2, j: (m / d - 1) / 2, d, e: m / d });
    }
    return { k, m, pairs, tested, prime: pairs.length === 0 };
  }

  const SD = { data: null, cells: [], badges: [], counts: [], cur: null, idx: 0 };

  function sundaramBuild() {
    const N = Math.floor(Number(toEn($('sunN').value)));
    const now = $('sunNow');
    if (!Number.isFinite(N) || N < 1 || N > 1000) {
      now.textContent = 'تعداد خانه‌ها باید بین ۱ تا ۱۰۰۰ باشد.';
      SD.data = null;
      return false;
    }
    SD.data = buildSundaram(N);
    SD.idx = 0;
    SD.cur = null;
    SD.counts = new Array(N + 1).fill(0);
    const frag = document.createDocumentFragment();
    SD.cells = [null];
    SD.badges = [null];
    for (let k = 1; k <= N; k++) {
      const c = el('div', 'cell', fa(k));
      c.dataset.k = String(k);
      const badge = el('i', 'cell-badge');
      c.append(badge);
      SD.cells[k] = c;
      SD.badges[k] = badge;
      frag.append(c);
    }
    $('sunGrid').replaceChildren(frag);
    $('sunPrimes').textContent = '';
    now.textContent = `آماده: k از ۱ تا ${fa(N)}؛ ${fa(SD.data.events.length)} خط در ${fa(SD.data.steps.length)} مرحله (برای هر i یک مرحله).`;
    $('sunInfo').replaceChildren(
      el('p', 'info-title', 'فرمول‌ها'),
      el('p', 'info-line', 'خط بزن: k = i + j + 2ij  (۱ ≤ i ≤ j)'),
      el('p', 'info-line', 'باقی‌مانده‌ی k ⇒ عدد اول فرد 2k + 1'),
      el('p', 'info-line', 'روی هر عدد بزن تا اثباتش را ببینی.')
    );
    if (!SD.data.steps.length) sundaramFinish();
    return true;
  }

  function sundaramStep() {
    const d = SD.data;
    const st = d.steps[SD.idx];
    SD.idx++;
    if (SD.cur) SD.cur.classList.remove('cur');
    let last = null;
    st.items.forEach((ev, t) => {
      const c = SD.cells[ev.k];
      SD.counts[ev.k]++;
      c.classList.add('struck');
      c.style.setProperty('--d', Math.min(t * 30, 700) + 'ms');
      SD.badges[ev.k].textContent = '(' + fa(ev.i) + ',' + fa(ev.j) + ')';
      last = c;
    });
    if (last) { last.classList.add('cur'); SD.cur = last; }
    const lastJ = st.items[st.items.length - 1].j;
    $('sunNow').textContent =
      `مرحلهٔ ${fa(st.index)} از ${fa(d.steps.length)}: i = ${fa(st.i)} ؛ j از ${fa(st.i)} تا ${fa(lastJ)} ⇒ ${fa(st.items.length)} خط زده شد (فرمول: ${fa(st.i)} + j + ۲×${fa(st.i)}×j).`;
    if (SD.idx >= d.steps.length) sundaramFinish();
  }

  function sundaramFinish() {
    const d = SD.data;
    if (SD.cur) { SD.cur.classList.remove('cur'); SD.cur = null; }
    d.remain.forEach(k => {
      SD.cells[k].classList.add('found', 'done');
      SD.badges[k].textContent = 'p=' + fa(2 * k + 1);
    });
    const primes = [2].concat(d.remain.map(k => 2 * k + 1));
    $('sunPrimes').textContent = 'عددهای اول تولیدشده با ساندرام: ' + primes.map(fa).join('، ');
    $('sunNow').textContent = `پایان: ${fa(d.remain.length)} خانهٔ باقی‌مانده؛ هر کدام k را به عدد اول 2k+1 تبدیل می‌کند (به‌علاوهٔ ۲).`;
    SD.idx = d.steps.length;
  }

  function sundaramInfo(k) {
    const d = SD.data;
    if (!d || k < 1 || k > d.N) return;
    const m = 2 * k + 1;
    const lines = [];
    if (d.by[k].length) {
      const a = sunAnalyze(k);
      lines.push(['title', `${fa(k)} حذف شد (خط خورد)`]);
      lines.push(['', `2k + ۱ = ${fa(m)} = ${factorize(m)} ⇒ مرکب است.`]);
      a.pairs.forEach(pr => lines.push(['', `اثبات: (i,j) = (${fa(pr.i)},${fa(pr.j)}) ⇒ ${fa(pr.i)} + ${fa(pr.j)} + ۲×${fa(pr.i)}×${fa(pr.j)} = ${fa(k)} ✓   و   (2i+1)(2j+1) = ${fa(2 * pr.i + 1)}×${fa(2 * pr.j + 1)} = ${fa(m)}`]));
    } else {
      const a = sunAnalyze(k);
      lines.push(['title', `${fa(k)} باقی ماند ⇒ ${fa(m)} = 2×${fa(k)}+۱ عدد اول است`]);
      lines.push(['', a.tested.length ? `مقسوم‌علیه‌های فرد آزمایش‌شده از ۳ تا √${fa(m)}: ${a.tested.map(fa).join('، ')}؛ هیچ‌کدام بخش‌پذیر نیست.` : `√${fa(m)} کوچک‌تر از ۳ است؛ پس بررسی لازم نیست.`]);
      lines.push(['', `هیچ جفت (i,j) ای نیست که ${fa(k)} را بسازد.`]);
    }
    $('sunInfo').replaceChildren(...lines.map(([kk, t]) => el('p', kk ? 'info-' + kk : 'info-line', t)));
    document.querySelectorAll('#sunGrid .cell.sel').forEach(x => x.classList.remove('sel'));
    if (SD.cells[k]) SD.cells[k].classList.add('sel');
  }

  const sundaramRun = player({
    playBtn: $('sunPlay'),
    isDone: () => !SD.data || SD.idx >= SD.data.steps.length,
    ensure: () => (SD.data ? true : sundaramBuild()),
    build: sundaramBuild,
    step: sundaramStep,
    delay: () => Number($('sunSpeed').value) || 450
  });

  /* ================= بررسی عدد در ساندرام (دستیار) ================= */
  function sunCheck() {
    const out = $('sunCheckOut');
    const mode = $('sunCheckMode').value;
    const v = Number(toEn($('sunCheckN').value));
    if (!Number.isInteger(v) || v < 1 || v > 1e9) {
      out.textContent = 'یک عدد صحیح مثبت (تا ۱۰۹) وارد کن.';
      return;
    }
    let k, p = null;
    if (mode === 'k') {
      k = v;
    } else {
      if (v < 3 || v % 2 === 0) {
        out.textContent = 'برای عدد اول فرد، یک عدد فرد بزرگ‌تر از ۲ بده (مثلاً ۳، ۵، ۷، ۱۱).';
        return;
      }
      p = v;
      k = (v - 1) / 2;
    }
    const a = sunAnalyze(k);
    const L = [];
    if (p !== null) {
      L.push(`ورودی p = ${fa(p)}  ⇒  k = (p − ۱) ÷ ۲ = ${fa(k)}`);
    }
    L.push(`k = ${fa(k)}  ،  2k + ۱ = ${fa(a.m)}`);
    if (a.prime) {
      L.push(a.tested.length
        ? `بررسی مقسوم‌علیه‌های فرد از ۳ تا √${fa(a.m)}: ${a.tested.map(fa).join('، ')} — هیچ‌کدام بخش‌پذیر نیست.`
        : `√${fa(a.m)} کوچک‌تر از ۳ است؛ بررسی مقسوم‌علیه لازم نیست.`);
      L.push(`پس ${fa(a.m)} عدد اول است.`);
      L.push(`نتیجه: ${fa(k)} در جدول ساندرام باقی می‌ماند (هست ✓).`);
      L.push(`و ${fa(a.m)} یکی از اعداد اول فرد ساندرام است.`);
    } else {
      L.push(`${fa(a.m)} = ${factorize(a.m)}  ⇒  مرکب است.`);
      a.pairs.forEach(pr => {
        L.push(`اثبات: i = ${fa(pr.i)} ، j = ${fa(pr.j)}  ⇒  ${fa(pr.i)} + ${fa(pr.j)} + ۲×${fa(pr.i)}×${fa(pr.j)} = ${fa(k)} ✓`);
        L.push(`   و (2i+1)(2j+1) = ${fa(2 * pr.i + 1)} × ${fa(2 * pr.j + 1)} = ${fa(a.m)}`);
      });
      L.push(`نتیجه: ${fa(k)} در جدول ساندرام حذف شده است (نیست ✗).`);
      if (p !== null) L.push(`و چون ${fa(p)} مرکب است، اول نیست.`);
    }
    out.textContent = L.join('\n');
  }

  /* ================= اتصال به صفحه ================= */
  const runSieveBtn = $('runSieve');
  if (runSieveBtn) runSieveBtn.addEventListener('click', () => { sieveBuild(); });
  if ($('sieveVizPlay')) {
    $('sieveVizPlay').addEventListener('click', () => sieveRun.toggle());
    $('sieveVizNext').addEventListener('click', () => sieveRun.next());
    $('sieveVizAll').addEventListener('click', () => sieveRun.all());
    $('sieveVizReset').addEventListener('click', () => { sieveRun.stop(); sieveBuild(); });
    $('sieveGrid').addEventListener('click', e => {
      const c = e.target.closest('.cell');
      if (c) sieveInfo(Number(c.dataset.n));
    });
    $('sieveGrid').addEventListener('pointerover', e => {
      const c = e.target.closest('.cell');
      if (c && e.pointerType === 'mouse') sieveInfo(Number(c.dataset.n));
    });
  }
  if ($('runSundaram')) {
    $('runSundaram').addEventListener('click', () => { sundaramRun.stop(); sundaramBuild(); });
    $('sunPlay').addEventListener('click', () => sundaramRun.toggle());
    $('sunNext').addEventListener('click', () => sundaramRun.next());
    $('sunAll').addEventListener('click', () => sundaramRun.all());
    $('sunGrid').addEventListener('click', e => {
      const c = e.target.closest('.cell');
      if (c) sundaramInfo(Number(c.dataset.k));
    });
    $('sunGrid').addEventListener('pointerover', e => {
      const c = e.target.closest('.cell');
      if (c && e.pointerType === 'mouse') sundaramInfo(Number(c.dataset.k));
    });
  }
  if ($('sunCheckBtn')) {
    $('sunCheckBtn').addEventListener('click', sunCheck);
    $('sunCheckN').addEventListener('keydown', e => { if (e.key === 'Enter') sunCheck(); });
  }
})();
