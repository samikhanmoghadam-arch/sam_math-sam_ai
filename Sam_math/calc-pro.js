/* SAM MATH: ماشین‌حساب چندحالته (مثل ماشین‌حساب ویندوز)
   استاندارد · علمی · برنامه‌نویس · تاریخ شمسی · تبدیل واحد
   محاسبه‌ها با تجزیه‌گر امن انجام می‌شود؛ هیچ eval یا Function در کار نیست. */
'use strict';
(() => {
  const panel = document.getElementById('calculatorPanel');
  if (!panel) return;
  const $ = id => document.getElementById(id);
  const exprOut = $('calcExpression');
  const resultOut = $('calcResult');
  const grid = $('calcKeys');
  if (!exprOut || !resultOut || !grid) return;

  /* ---------- ابزارهای کمکی ---------- */
  const LS = { mode: 'sam-calc-pro-mode', hist: 'sam-calc-pro-history', deg: 'sam-calc-pro-deg' };
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* حافظه در دسترس نیست */ }
    }
  };
  const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
  const ARABIC = '٠١٢٣٤٥٦٧٨٩';
  const toLatin = s => String(s ?? '')
    .replace(/[۰-۹]/g, d => String(PERSIAN.indexOf(d)))
    .replace(/[٠-٩]/g, d => String(ARABIC.indexOf(d)))
    .replace(/[٫،]/g, '.').replace(/[٬\s]/g, '').replace(/−/g, '-');
  const faNum = s => String(s).replace(/[0-9]/g, d => PERSIAN[Number(d)]);
  const mod = (a, b) => ((a % b) + b) % b;

  class CalcError extends Error {}

  const MODE_LABEL = { standard: 'استاندارد', scientific: 'علمی', programmer: 'برنامه‌نویس', date: 'تاریخ', convert: 'تبدیل واحد' };
  const BASE_NAME = { 10: 'DEC', 16: 'HEX', 8: 'OCT', 2: 'BIN' };
  const BASE_FA = { 10: 'ده‌دهی', 16: 'شانزده‌شانزدهی', 8: 'هشت‌هشتی', 2: 'دودویی' };

  /* ---------- تجزیه‌گر عبارت (بازگشتی با اولویت) ---------- */
  const FUNCS = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'log', 'ln',
    'abs', 'sqrt', 'cbrt', 'exp', 'floor', 'ceil', 'round', 'inv', 'fact']);
  const CONSTS = new Set(['pi', 'e', 'Ans']);
  const BIN_OPS = {
    OR: { p: 1, a: 'L' }, XOR: { p: 2, a: 'L' }, AND: { p: 3, a: 'L' }, '<<': { p: 4, a: 'L' }, '>>': { p: 4, a: 'L' },
    '+': { p: 5, a: 'L' }, '-': { p: 5, a: 'L' }, '*': { p: 6, a: 'L' }, '/': { p: 6, a: 'L' }, mod: { p: 6, a: 'L' },
    P: { p: 7, a: 'L' }, C: { p: 7, a: 'L' }, '^': { p: 8, a: 'R' }
  };
  const POSTFIX = { '!': 'fact', '%': 'pct', '²': 'sq', '³': 'cube' };

  function tokenize(src, prog, base) {
    const s = String(src).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    const out = [];
    let i = 0;
    while (i < s.length) {
      const rest = s.slice(i);
      const ch = rest[0];
      let m;
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '(') { out.push({ t: 'lp' }); i++; continue; }
      if (ch === ')') { out.push({ t: 'rp' }); i++; continue; }
      if (ch === 'π') { out.push({ t: 'id', v: 'pi' }); i++; continue; }
      if (ch === '√') { out.push({ t: 'id', v: 'sqrt' }); i++; continue; }
      if ((m = /^(<<|>>)/.exec(rest))) { out.push({ t: 'op', v: m[1] }); i += 2; continue; }
      if ('+-*/^!%²³'.includes(ch)) { out.push({ t: 'op', v: ch }); i++; continue; }
      if (prog && (m = /^0([xXbBoO])([0-9A-Fa-f]+)/.exec(rest))) {
        const p = m[1].toLowerCase();
        if (!(p === 'b' && base === 16)) {
          out.push({ t: 'num', v: m[2].toUpperCase(), base: p === 'x' ? 16 : p === 'b' ? 2 : 8 });
          i += m[0].length;
          continue;
        }
      }
      if ((m = /^(AND|OR|XOR|NOT|mod)/.exec(rest)) && (prog || m[1] === 'mod')) {
        out.push({ t: 'op', v: m[1] }); i += m[1].length; continue;
      }
      if (prog && (m = /^[0-9A-Fa-f]+/.exec(rest))) {
        out.push({ t: 'num', v: m[0].toUpperCase() }); i += m[0].length; continue;
      }
      if (!prog && (m = /^(?:\d+\.?\d*|\.\d+)(?:E[+-]?\d+)?/.exec(rest))) {
        out.push({ t: 'num', v: m[0] }); i += m[0].length; continue;
      }
      if ((m = /^[A-Za-z]+/.exec(rest))) {
        const w = m[0];
        out.push(!prog && (w === 'P' || w === 'C') ? { t: 'op', v: w } : { t: 'id', v: w });
        i += w.length; continue;
      }
      throw new CalcError(`این علامت پشتیبانی نمی‌شود: ${ch}`);
    }
    return out;
  }

  function evaluate(src, env, base) {
    const toks = tokenize(src, env.prog, base);
    if (!toks.length) throw new CalcError('اول یک عبارت وارد کن.');
    let pos = 0;
    const peek = () => toks[pos];
    const next = () => toks[pos++];
    const startsOperand = t => t && (t.t === 'num' || t.t === 'lp' || t.t === 'id' || (t.t === 'op' && t.v === 'NOT'));

    function parsePrimary() {
      const t = next();
      if (!t) throw new CalcError('عبارت ناقص است.');
      if (t.t === 'num') return env.num(t.v, t.base);
      if (t.t === 'lp') {
        const v = parseExpr(0);
        const c = next();
        if (!c || c.t !== 'rp') throw new CalcError('پرانتز بسته نشده است.');
        return v;
      }
      if (t.t === 'id') {
        if (CONSTS.has(t.v)) return env.constant(t.v);
        if (FUNCS.has(t.v)) {
          const p = next();
          if (!p || p.t !== 'lp') throw new CalcError(`بعد از ${t.v} باید ( بیاید.`);
          const v = parseExpr(0);
          const c = next();
          if (!c || c.t !== 'rp') throw new CalcError('پرانتز بسته نشده است.');
          return env.fn(t.v, v);
        }
        throw new CalcError(`«${t.v}» شناخته نشد.`);
      }
      throw new CalcError('خطای نگارشی در عبارت.');
    }

    function parsePostfix() {
      let v = parsePrimary();
      for (;;) {
        const t = peek();
        if (t && t.t === 'op' && POSTFIX[t.v]) { next(); v = env.un(POSTFIX[t.v], v); }
        else break;
      }
      return v;
    }

    function parseUnary() {
      const t = peek();
      if (t && t.t === 'op' && (t.v === '-' || t.v === '+')) {
        next();
        const v = parseExpr(8);
        return t.v === '-' ? env.un('neg', v) : v;
      }
      if (t && t.t === 'op' && t.v === 'NOT') { next(); return env.un('not', parseExpr(8)); }
      return parsePostfix();
    }

    function parseExpr(minP) {
      let left = parseUnary();
      for (;;) {
        const t = peek();
        if (!t) break;
        if (t.t === 'op' && BIN_OPS[t.v]) {
          const info = BIN_OPS[t.v];
          if (info.p < minP) break;
          next();
          const right = parseExpr(info.a === 'R' ? info.p : info.p + 1);
          left = env.bin(t.v, left, right);
          continue;
        }
        if (startsOperand(t) && 6 >= minP) {
          left = env.bin('*', left, parseExpr(7));
          continue;
        }
        break;
      }
      return left;
    }

    const value = parseExpr(0);
    if (pos < toks.length) {
      const t = peek();
      throw new CalcError(t.t === 'rp' ? 'پرانتز اضافی داری.' : 'عبارت کامل نیست.');
    }
    return value;
  }

  /* ---------- محیط محاسبه: استاندارد (عدد اعشاری) ---------- */
  function stdEnv(deg, ans) {
    const toRad = x => (deg ? x * Math.PI / 180 : x);
    const fromRad = x => (deg ? x * 180 / Math.PI : x);
    const domain = () => new CalcError('ورودی خارج از دامنهٔ این تابع است.');
    const perm = (n, r) => {
      if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) throw new CalcError('nPr فقط برای عدد صحیح و r ≤ n است.');
      let p = 1; for (let i = 0; i < r; i++) p *= (n - i); return p;
    };
    const comb = (n, r) => {
      if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) throw new CalcError('nCr فقط برای عدد صحیح و r ≤ n است.');
      let c = 1; for (let i = 1; i <= r; i++) c = c * (n - r + i) / i; return Math.round(c);
    };
    const fact = x => {
      if (!Number.isInteger(x) || x < 0 || x > 170) throw new CalcError('فاکتوریل فقط برای عدد صحیح ۰ تا ۱۷۰ است.');
      let r = 1; for (let i = 2; i <= x; i++) r *= i; return r;
    };
    const FN = {
      sin: x => Math.sin(toRad(x)),
      cos: x => Math.cos(toRad(x)),
      tan: x => {
        if (deg && Math.abs(mod(x, 180) - 90) < 1e-12) throw new CalcError('تانژانت این زاویه تعریف نشده است.');
        return Math.tan(toRad(x));
      },
      asin: x => { if (Math.abs(x) > 1) throw domain(); return fromRad(Math.asin(x)); },
      acos: x => { if (Math.abs(x) > 1) throw domain(); return fromRad(Math.acos(x)); },
      atan: x => fromRad(Math.atan(x)),
      sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
      log: x => { if (x <= 0) throw domain(); return Math.log10(x); },
      ln: x => { if (x <= 0) throw domain(); return Math.log(x); },
      abs: Math.abs,
      sqrt: x => { if (x < 0) throw domain(); return Math.sqrt(x); },
      cbrt: Math.cbrt, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round,
      inv: x => { if (x === 0) throw new CalcError('معکوس صفر تعریف نشده است.'); return 1 / x; },
      fact
    };
    return {
      prog: false,
      num: text => Number(text.replace('E', 'e')),
      constant: name => (name === 'pi' ? Math.PI : name === 'e' ? Math.E : Number(ans) || 0),
      fn: (name, v) => FN[name](v),
      bin(op, a, b) {
        switch (op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': if (b === 0) throw new CalcError('تقسیم بر صفر ممکن نیست.'); return a / b;
          case 'mod': if (b === 0) throw new CalcError('باقی‌مانده بر صفر تعریف نشده.'); return a % b;
          case '^': return Math.pow(a, b);
          case 'P': return perm(a, b);
          case 'C': return comb(a, b);
          default: throw new CalcError(`عملگر «${op}» در این حالت نیست.`);
        }
      },
      un(op, a) {
        switch (op) {
          case 'neg': return -a;
          case 'fact': return fact(a);
          case 'pct': return a / 100;
          case 'sq': return a * a;
          case 'cube': return a * a * a;
          default: throw new CalcError(`عملگر «${op}» در این حالت نیست.`);
        }
      }
    };
  }

  /* ---------- محیط محاسبه: برنامه‌نویس (عدد صحیح ۶۴ بیتی با BigInt) ---------- */
  const LIM_LO = -(2n ** 63n);
  const LIM_HI = 2n ** 64n;
  const u64 = v => BigInt.asUintN(64, v);
  const ck = v => {
    if (v < LIM_LO || v >= LIM_HI) throw new CalcError('سرریز: عدد از محدودهٔ ۶۴ بیتی بیشتر است.');
    return v;
  };

  function progEnv(base, ans) {
    return {
      prog: true,
      num(text, lit) {
        const b = lit ?? base;
        const B = BigInt(b);
        let v = 0n;
        for (const ch of text) {
          const d = parseInt(ch, 16);
          if (!(d < b)) throw new CalcError(`رقم «${ch}» در مبنای ${BASE_FA[b]} مجاز نیست.`);
          v = v * B + BigInt(d);
        }
        return ck(v);
      },
      constant(name) {
        if (name === 'Ans') return ans ?? 0n;
        throw new CalcError(`ثابت «${name}» در حالت برنامه‌نویس نیست.`);
      },
      fn(name) { throw new CalcError(`تابع «${name}» در حالت برنامه‌نویس نیست.`); },
      bin(op, a, b) {
        const shiftOk = () => {
          if (b < 0n || b > 63n) throw new CalcError('تعداد شیفت باید بین ۰ تا ۶۳ باشد.');
        };
        switch (op) {
          case '+': return ck(a + b);
          case '-': return ck(a - b);
          case '*': return ck(a * b);
          case '/': if (b === 0n) throw new CalcError('تقسیم بر صفر ممکن نیست.'); return ck(a / b);
          case 'mod': if (b === 0n) throw new CalcError('باقی‌مانده بر صفر تعریف نشده.'); return ck(a % b);
          case 'AND': return u64(a) & u64(b);
          case 'OR': return u64(a) | u64(b);
          case 'XOR': return u64(a) ^ u64(b);
          case '<<': shiftOk(); return ck(a << b);
          case '>>': shiftOk(); return ck(a >> b);
          default: throw new CalcError(`عملگر «${op}» در این حالت نیست.`);
        }
      },
      un(op, a) {
        if (op === 'neg') return ck(-a);
        if (op === 'not') return u64(~u64(a));
        throw new CalcError(`عملگر «${op}» در این حالت نیست.`);
      }
    };
  }

  /* ---------- قالب‌بندی جواب ---------- */
  function fmtNum(v) {
    if (!Number.isFinite(v)) throw new CalcError('نتیجه تعریف‌نشده یا خیلی بزرگ است.');
    if (Math.abs(v) < 1e-12) v = 0;
    return String(Number(v.toPrecision(12)));
  }
  function formatProg(v, b) {
    if (b === 10) return v.toString(10);
    return u64(v).toString(b).toUpperCase();
  }

  /* ---------- وضعیت و کلیدها ---------- */
  const state = {
    mode: 'standard',
    expr: '',
    fresh: false,
    resultText: '',
    base: 10,
    deg: store.get(LS.deg, true) !== false,
    mem: 0,
    ansStd: 0,
    ansProg: 0n,
    hist: []
  };
  const isExprMode = () => state.mode === 'standard' || state.mode === 'scientific' || state.mode === 'programmer';
  const isMemMode = () => state.mode === 'standard' || state.mode === 'scientific';

  const K = (k, label, cls = '', w = 1) => ({ k, label, cls, w });
  const LAYOUT = {
    standard: { cols: 4, keys: [
      K('AC', 'AC', 'key-special'), K('DEL', '⌫', 'key-special'), K('(', '('), K(')', ')'),
      K('7', '7'), K('8', '8'), K('9', '9'), K('÷', '÷', 'key-op'),
      K('4', '4'), K('5', '5'), K('6', '6'), K('×', '×', 'key-op'),
      K('1', '1'), K('2', '2'), K('3', '3'), K('−', '−', 'key-op'),
      K('0', '0'), K('.', '.'), K('%', '%', 'key-op'), K('+', '+', 'key-op'),
      K('sqrt(', '√', 'key-fn'), K('square', 'x²', 'key-fn'), K('pi', 'π', 'key-fn'), K('=', '=', 'key-equals'),
      K('sin(', 'sin', 'key-fn'), K('cos(', 'cos', 'key-fn'), K('tan(', 'tan', 'key-fn'), K('log(', 'log', 'key-fn'),
      K('ln(', 'ln', 'key-fn'), K('abs(', '|x|', 'key-fn'), K('e', 'e', 'key-fn'), K('^', 'xʸ', 'key-op')
    ] },
    scientific: { cols: 6, keys: [
      K('DEG', 'DEG', 'key-mode'), K('sin(', 'sin', 'key-fn'), K('cos(', 'cos', 'key-fn'), K('tan(', 'tan', 'key-fn'), K('log(', 'log', 'key-fn'), K('ln(', 'ln', 'key-fn'),
      K('asin(', 'sin⁻¹', 'key-fn'), K('acos(', 'cos⁻¹', 'key-fn'), K('atan(', 'tan⁻¹', 'key-fn'), K('abs(', '|x|', 'key-fn'), K('!', 'n!', 'key-fn'), K('sqrt(', '√', 'key-fn'),
      K('^', 'xʸ', 'key-op'), K('square', 'x²', 'key-fn'), K('cube', 'x³', 'key-fn'), K('cbrt(', '∛', 'key-fn'), K('inv(', '1/x', 'key-fn'), K('E', 'EXP', 'key-fn'),
      K('P', 'nPr', 'key-fn'), K('C', 'nCr', 'key-fn'), K('mod', 'mod', 'key-op'), K('pi', 'π', 'key-fn'), K('e', 'e', 'key-fn'), K('Ans', 'Ans', 'key-fn'),
      K('M+', 'M+', 'key-mem'), K('M-', 'M−', 'key-mem'), K('MR', 'MR', 'key-mem'), K('MC', 'MC', 'key-mem'), K('(', '('), K(')', ')'),
      K('7', '7'), K('8', '8'), K('9', '9'), K('÷', '÷', 'key-op'), K('AC', 'AC', 'key-special'), K('DEL', '⌫', 'key-special'),
      K('4', '4'), K('5', '5'), K('6', '6'), K('×', '×', 'key-op'), K('floor(', 'floor', 'key-fn'), K('ceil(', 'ceil', 'key-fn'),
      K('1', '1'), K('2', '2'), K('3', '3'), K('−', '−', 'key-op'), K('round(', 'round', 'key-fn'), K('exp(', 'eˣ', 'key-fn'),
      K('0', '0', '', 2), K('.', '.'), K('%', '%', 'key-op'), K('+', '+', 'key-op'), K('sinh(', 'sinh', 'key-fn'),
      K('=', '=', 'key-equals', 6)
    ] },
    programmer: { cols: 6, keys: [
      K('A', 'A', 'key-hex'), K('B', 'B', 'key-hex'), K('C', 'C', 'key-hex'), K('D', 'D', 'key-hex'), K('E', 'E', 'key-hex'), K('F', 'F', 'key-hex'),
      K('AND', 'AND', 'key-op'), K('OR', 'OR', 'key-op'), K('XOR', 'XOR', 'key-op'), K('NOT', 'NOT', 'key-op'), K('<<', '<<', 'key-op'), K('>>', '>>', 'key-op'),
      K('(', '('), K(')', ')'), K('mod', 'mod', 'key-op'), K('DEL', '⌫', 'key-special'), K('AC', 'AC', 'key-special'), K('÷', '÷', 'key-op'),
      K('7', '7'), K('8', '8'), K('9', '9'), K('×', '×', 'key-op'), K('−', '−', 'key-op'), K('+', '+', 'key-op'),
      K('4', '4'), K('5', '5'), K('6', '6'), K('=', '=', 'key-equals', 3),
      K('1', '1'), K('2', '2'), K('3', '3'), K('0', '0')
    ] }
  };
  const INSERT = {
    square: '²', cube: '³', pi: 'π', mod: ' mod ', AND: ' AND ', OR: ' OR ', XOR: ' XOR ',
    NOT: 'NOT ', '<<': ' << ', '>>': ' >> ', P: ' P ', C: ' C ', E: 'E', Ans: 'Ans', '!': '!'
  };
  const OPERATOR_KEYS = new Set(['÷', '×', '−', '+', '^', '%', '!', '²', '³', 'square', 'cube', 'mod', 'AND', 'OR', 'XOR', '<<', '>>', 'P', 'C']);
  const DEL_TOKENS = ['asin(', 'acos(', 'atan(', 'sinh(', 'cosh(', 'tanh(', 'sin(', 'cos(', 'tan(', 'log(', 'ln(',
    'abs(', 'sqrt(', 'cbrt(', 'inv(', 'exp(', 'floor(', 'ceil(', 'round(', 'fact(', ' mod ', ' AND ', ' OR ', ' XOR ',
    'NOT ', ' << ', ' >> ', ' P ', ' C ', 'Ans', 'pi', 'π', '²', '³'].sort((a, b) => b.length - a.length);

  /* ---------- ارزیابی و نمایش ---------- */
  function evalCurrent(expr) {
    if (state.mode === 'programmer') {
      return evaluate(expr, progEnv(state.base, state.ansProg), state.base);
    }
    return evaluate(expr, stdEnv(state.deg, state.ansStd), null);
  }
  function fmtValue(v) {
    if (typeof v === 'bigint') return formatProg(v, state.base);
    return fmtNum(v);
  }
  function setAns(v) {
    if (typeof v === 'bigint') state.ansProg = v; else state.ansStd = v;
  }
  function tryValue(expr) {
    try { return evalCurrent(expr); } catch { return null; }
  }

  const expressionValueFor = expr => {
    const v = tryValue(expr);
    if (v === null) throw new CalcError('عبارت معتبر نیست.');
    return v;
  };

  /* ---------- نمایش ---------- */
  let statusEl = null;
  let basesEl = null;
  let baseBarEl = null;
  let historyEl = null;
  let historyList = null;
  let panelBox = null;

  function showError(msg) {
    resultOut.textContent = msg;
    resultOut.classList.add('error');
  }

  function render() {
    resultOut.classList.remove('error');
    exprOut.textContent = state.expr || '0';
    if (!state.expr) resultOut.textContent = 'نتیجه';
    else if (state.fresh) resultOut.textContent = '= ' + state.resultText;
    else {
      const v = tryValue(state.expr);
      resultOut.textContent = v === null ? '…' : fmtValue(v);
    }
    renderStatus();
    renderBases();
  }

  function renderStatus() {
    if (!statusEl) return;
    const parts = [MODE_LABEL[state.mode]];
    if (isMemMode()) parts.push(state.deg ? 'DEG' : 'RAD');
    if (state.mode === 'programmer') parts.push(BASE_NAME[state.base]);
    if (isMemMode() && state.mem !== 0) parts.push('M');
    statusEl.textContent = parts.join(' · ');
  }

  function renderBases() {
    if (!basesEl || state.mode !== 'programmer') return;
    let v = null;
    if (state.fresh) v = state.ansProg;
    else v = tryValue(state.expr || '0');
    basesEl.querySelectorAll('[data-b]').forEach(row => {
      const b = Number(row.dataset.b);
      row.querySelector('strong').textContent = v === null || typeof v !== 'bigint' ? '—' : formatProg(v, b);
    });
  }

  /* ---------- عملیات کلیدها ---------- */
  function beginInput(key) {
    if (state.fresh) {
      state.fresh = false;
      state.expr = OPERATOR_KEYS.has(key) ? state.resultText : '';
    }
  }

  function deleteLast() {
    if (state.fresh) { state.fresh = false; state.expr = ''; return; }
    const hit = DEL_TOKENS.find(t => state.expr.endsWith(t));
    state.expr = hit ? state.expr.slice(0, -hit.length) : state.expr.slice(0, -1);
  }

  function equals() {
    if (!state.expr.trim() || state.fresh) return;
    try {
      const v = evalCurrent(state.expr);
      const text = fmtValue(v);
      setAns(v);
      state.resultText = text;
      state.fresh = true;
      addHistory(state.expr, text);
      render();
    } catch (e) {
      showError(e instanceof CalcError ? e.message : 'عبارت معتبر نیست.');
    }
  }

  function memory(key) {
    if (key === 'MC') { state.mem = 0; return render(); }
    if (key === 'MR') {
      beginInput('MR');
      state.expr += `(${String(Number(state.mem.toPrecision(15)))})`;
      return render();
    }
    try {
      const cur = state.fresh ? Number(state.ansStd) : Number(expressionValueFor(state.expr));
      state.mem = key === 'M+' ? state.mem + cur : state.mem - cur;
      render();
    } catch (e) {
      showError(e instanceof CalcError ? e.message : 'عبارت معتبر نیست.');
    }
  }

  function press(key) {
    if (!isExprMode()) return;
    switch (key) {
      case 'AC': state.expr = ''; state.fresh = false; state.resultText = ''; return render();
      case 'DEL': deleteLast(); return render();
      case 'DEG': state.deg = !state.deg; store.set(LS.deg, state.deg); return render();
      case 'M+': case 'M-': case 'MR': case 'MC':
        if (isMemMode()) memory(key);
        return;
      case '=': return equals();
      default:
        beginInput(key);
        state.expr += INSERT[key] ?? key;
        render();
    }
  }

  function setBase(b) {
    if (b === state.base) return;
    let v = null;
    if (state.fresh) v = state.ansProg;
    else if (state.expr) v = tryValue(state.expr);
    state.base = b;
    state.fresh = false;
    state.resultText = '';
    state.expr = typeof v === 'bigint' ? formatProg(v, b) : '';
    updateBaseButtons();
    updateKeyStates();
    render();
  }

  /* ---------- تاریخچه ---------- */
  function addHistory(expr, res) {
    state.hist = [{ mode: state.mode, base: state.base, expr, res }, ...state.hist].slice(0, 20);
    store.set(LS.hist, state.hist);
    renderHistory();
  }

  function renderHistory() {
    if (!historyList) return;
    historyList.replaceChildren();
    if (!state.hist.length) {
      const li = document.createElement('li');
      li.className = 'hint';
      li.textContent = 'هنوز محاسبه‌ای نکرده‌ای.';
      historyList.append(li);
      return;
    }
    state.hist.forEach(item => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cp-hx';
      const ex = document.createElement('span');
      ex.className = 'cp-hx-expr';
      ex.textContent = `${MODE_LABEL[item.mode] || ''}: ${item.expr}`;
      const val = document.createElement('strong');
      val.textContent = '= ' + item.res;
      btn.append(ex, val);
      btn.addEventListener('click', () => {
        if (item.mode !== state.mode) setMode(item.mode, false);
        if (item.mode === 'programmer') state.base = item.base || state.base;
        state.expr = item.res;
        state.fresh = false;
        state.resultText = '';
        render();
        updateBaseButtons();
        updateKeyStates();
      });
      li.append(btn);
      historyList.append(li);
    });
  }

  function clearHistory() {
    state.hist = [];
    store.set(LS.hist, state.hist);
    renderHistory();
  }

  /* ---------- ساخت DOM ---------- */
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const kid of kids) if (kid) el.append(kid);
    return el;
  }

  const MODES = [
    { id: 'standard', label: 'استاندارد' },
    { id: 'scientific', label: 'علمی' },
    { id: 'programmer', label: 'برنامه‌نویس' },
    { id: 'date', label: 'تاریخ شمسی' },
    { id: 'convert', label: 'تبدیل واحد' }
  ];
  const HINTS = {
    standard: 'از کیبورد هم می‌شود استفاده کرد. ٪ یعنی تقسیم بر ۱۰۰. مثلاً ۲+۳×۴ = ۱۴ و (۲+۳)×۴ = ۲۰.',
    scientific: 'زاویه‌ها در حالت DEG بر حسب درجه‌اند؛ با کلید DEG به RAD برو. M+ و M− حافظه را جمع و کم می‌کنند.',
    programmer: 'عددها را در مبنای انتخابی وارد کن. پیشوند 0x و 0b و 0o هم کار می‌کند. محدودهٔ عدد ۶۴ بیتی است.'
  };

  function buildTabs() {
    const tabs = h('div', { class: 'cp-tabs', role: 'tablist', 'aria-label': 'حالت ماشین‌حساب' },
      ...MODES.map(m => h('button', {
        type: 'button', class: 'cp-tab', role: 'tab', 'data-cp-mode': m.id, text: m.label,
        onclick: () => setMode(m.id)
      })));
    panel.prepend(tabs);
  }

  function buildBaseBar() {
    baseBarEl = h('div', { class: 'cp-base-bar', hidden: '' },
      ...[10, 16, 8, 2].map(b => h('button', {
        type: 'button', class: 'cp-base', 'data-base': String(b), text: BASE_NAME[b],
        onclick: () => setBase(b)
      })));
    basesEl = h('div', { class: 'cp-bases', hidden: '' },
      ...[10, 16, 8, 2].map(b => h('div', { class: 'cp-base-row', 'data-b': String(b) },
        h('span', { text: BASE_NAME[b] }), h('strong', { text: '—' }))));
    grid.before(baseBarEl, basesEl);
  }

  function buildHistory() {
    historyList = h('ul', { class: 'cp-hx-list' });
    historyEl = h('section', { class: 'cp-history' },
      h('div', { class: 'cp-history-head' },
        h('h3', { text: 'تاریخچه (۲۰ محاسبهٔ آخر)' }),
        h('button', { type: 'button', class: 'ghost-btn', text: 'پاک کردن', onclick: clearHistory })),
      historyList,
      h('p', { class: 'hint', text: 'روی هر مورد بزنی، جوابش دوباره وارد عبارت می‌شود.' }));
    panelBox = h('div', { id: 'cpPanel', class: 'cp-panel', hidden: '' });
    panel.append(historyEl, panelBox);
  }

  function buildStatus() {
    statusEl = h('span', { class: 'cp-status' });
    display().prepend(statusEl);
  }
  function display() { return panel.querySelector(':scope > .calc-display'); }

  function buildKeys() {
    const L = LAYOUT[state.mode];
    if (!L) return;
    grid.className = 'calc-grid cp-grid';
    grid.style.setProperty('--cp-cols', String(L.cols));
    grid.replaceChildren(...L.keys.map(key => {
      let label = key.label;
      if (key.k === 'DEG') label = state.deg ? 'DEG' : 'RAD';
      const b = h('button', { type: 'button', class: `key ${key.cls} cp-k`.trim(), 'data-key': key.k, text: label });
      if (key.w > 1) b.classList.add('cp-w' + key.w);
      return b;
    }));
    updateKeyStates();
  }

  function updateKeyStates() {
    if (state.mode !== 'programmer') {
      grid.querySelectorAll('button[data-key]').forEach(b => { b.disabled = false; b.classList.remove('cp-off'); });
      return;
    }
    grid.querySelectorAll('button[data-key]').forEach(b => {
      const k = b.dataset.key;
      const isDigit = /^[0-9A-F]$/.test(k);
      const off = isDigit && parseInt(k, 16) >= state.base;
      b.disabled = off;
      b.classList.toggle('cp-off', off);
    });
    baseBarEl.querySelectorAll('[data-base]').forEach(b => { b.classList.toggle('active', Number(b.dataset.base) === state.base); });
  }
  function updateBaseButtons() {
    if (!baseBarEl) return;
    baseBarEl.querySelectorAll('[data-base]').forEach(b => b.classList.toggle('active', Number(b.dataset.base) === state.base));
  }

  /* ---------- جابه‌جایی حالت ---------- */
  function setMode(id, save = true) {
    if (!MODES.some(m => m.id === id)) id = 'standard';
    state.mode = id;
    state.expr = '';
    state.fresh = false;
    state.resultText = '';
    if (save) store.set(LS.mode, id);
    panel.querySelectorAll('.cp-tab').forEach(t => {
      const on = t.dataset.cpMode === id;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const panelMode = id === 'date' || id === 'convert';
    const shown = [display(), grid, hintEl, extrasEl, historyEl];
    shown.forEach(el => { if (el) el.hidden = panelMode; });
    if (panelMode) {
      panelBox.hidden = false;
      baseBarEl.hidden = true; basesEl.hidden = true;
      if (id === 'date') buildDate(); else buildConvert();
      return;
    }
    panelBox.hidden = true;
    baseBarEl.hidden = id !== 'programmer';
    basesEl.hidden = id !== 'programmer';
    buildKeys();
    updateBaseButtons();
    renderHistory();
    render();
  }

  /* ---------- تقویم شمسی و میلادی (الگوریتم خودِ برنامه، بدون کتابخانه) ---------- */
  function jToJdn(jy, jm, jd) {
    const epbase = jy - (jy >= 0 ? 474 : 473);
    const epyear = 474 + mod(epbase, 2820);
    return jd + (jm <= 7 ? (jm - 1) * 31 : (jm - 1) * 30 + 6)
      + Math.floor((epyear * 682 - 110) / 2816) + (epyear - 1) * 365
      + Math.floor(epbase / 2820) * 1029983 + 1948320;
  }
  function jdnToJalali(jd) {
    const depoch = jd - jToJdn(475, 1, 1);
    const cycle = Math.floor(depoch / 1029983);
    const cyear = mod(depoch, 1029983);
    let ycycle;
    if (cyear === 1029982) ycycle = 2820;
    else {
      const a1 = Math.floor(cyear / 366);
      const a2 = mod(cyear, 366);
      ycycle = Math.floor((2134 * a1 + 2816 * a2 + 2815) / 1028522) + a1 + 1;
    }
    let y = ycycle + 2820 * cycle + 474;
    if (y <= 0) y--;
    const yday = jd - jToJdn(y, 1, 1) + 1;
    const m = yday <= 186 ? Math.ceil(yday / 31) : Math.ceil((yday - 6) / 30);
    const d = jd - jToJdn(y, m, 1) + 1;
    return { y, m, d };
  }
  function jMonthLen(y, m) {
    return m < 12 ? jToJdn(y, m + 1, 1) - jToJdn(y, m, 1) : jToJdn(y + 1, 1, 1) - jToJdn(y, 12, 1);
  }
  function gToJdn(y, m, d) {
    const a = Math.floor((14 - m) / 12);
    const yy = y + 4800 - a;
    const mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
      - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }
  function jdnToG(jd) {
    const a = jd + 32044;
    const b = Math.floor((4 * a + 3) / 146097);
    const c = a - Math.floor(146097 * b / 4);
    const d = Math.floor((4 * c + 3) / 1461);
    const e = c - Math.floor(1461 * d / 4);
    const m = Math.floor((5 * e + 2) / 153);
    return {
      y: 100 * b + d - 4800 + Math.floor(m / 10),
      m: m + 3 - 12 * Math.floor(m / 10),
      d: e - Math.floor((153 * m + 2) / 5) + 1
    };
  }
  const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
  const JMONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const GMONTHS = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
  const weekdayOf = jdn => WEEKDAYS[(jdn + 1) % 7];
  const fmtJ = j => `${faNum(j.d)} ${JMONTHS[j.m - 1]} ${faNum(j.y)}`;
  const fmtG = g => `${faNum(g.d)} ${GMONTHS[g.m - 1]} ${faNum(g.y)}`;

  /* ---------- حالت تاریخ ---------- */
  const today = () => {
    const n = new Date();
    return jdnToJalali(gToJdn(n.getFullYear(), n.getMonth() + 1, n.getDate()));
  };

  function dateField(title, initial, onChange) {
    const yIn = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: faNum(initial.y), 'aria-label': `${title}: سال` });
    const mSel = h('select', { 'aria-label': `${title}: ماه` }, ...JMONTHS.map((n, i) => h('option', { value: String(i + 1), text: n })));
    mSel.value = String(initial.m);
    const dIn = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: faNum(initial.d), 'aria-label': `${title}: روز` });
    const gOut = h('small', { class: 'cp-greg' });
    const err = h('p', { class: 'cp-err', hidden: '' });
    const read = () => {
      const y = parseInt(toLatin(yIn.value), 10);
      const d = parseInt(toLatin(dIn.value), 10);
      const m = parseInt(mSel.value, 10);
      if (!Number.isInteger(y) || y < 1 || y > 3000) throw new CalcError('سال شمسی معتبر نیست.');
      if (!Number.isInteger(d) || d < 1 || d > jMonthLen(y, m)) throw new CalcError(`روز باید بین ۱ تا ${faNum(jMonthLen(y, m))} باشد.`);
      return { y, m, d };
    };
    const refresh = () => {
      try {
        const j = read();
        gOut.textContent = 'میلادی: ' + fmtG(jdnToG(jToJdn(j.y, j.m, j.d)));
        err.hidden = true;
      } catch (e) {
        gOut.textContent = '';
        err.textContent = e.message;
        err.hidden = false;
      }
      onChange();
    };
    [yIn, dIn].forEach(i => i.addEventListener('input', refresh));
    mSel.addEventListener('change', refresh);
    const el = h('div', { class: 'cp-date-field' },
      h('span', { class: 'cp-field-title', text: title }),
      h('div', { class: 'cp-row' }, yIn, mSel, dIn), gOut, err);
    return { el, read, refresh };
  }

  // تفاوت تقویمی تقریبی (سال، ماه، روز) بین دو تاریخ شمسی که lo <= hi
  function calBreak(lo, hi) {
    let y = hi.y - lo.y;
    let m = hi.m - lo.m;
    let d = hi.d - lo.d;
    if (d < 0) {
      m--;
      let pm = hi.m - 1, py = hi.y;
      if (pm === 0) { pm = 12; py--; }
      d += jMonthLen(py, pm);
    }
    if (m < 0) { y--; m += 12; }
    return { y, m, d };
  }

  function buildDate() {
    const t = today();
    panelBox.replaceChildren();
    const out1 = h('pre', { class: 'result', 'aria-live': 'polite' });
    const out2 = h('p', { class: 'result', 'aria-live': 'polite' });
    const recalcDiff = () => {
      try {
        const a = fA.read();
        const b = fB.read();
        const ja = jToJdn(a.y, a.m, a.d);
        const jb = jToJdn(b.y, b.m, b.d);
        const diff = jb - ja;
        const n = Math.abs(diff);
        const lo = diff >= 0 ? a : b;
        const hi = diff >= 0 ? b : a;
        const cal = calBreak(lo, hi);
        out1.textContent = [
          `اختلاف: ${faNum(n)} روز`,
          `معادل ${faNum(Math.floor(n / 7))} هفته و ${faNum(n % 7)} روز`,
          `تقریباً ${faNum(cal.y)} سال، ${faNum(cal.m)} ماه و ${faNum(cal.d)} روز`,
          diff < 0 ? '(تاریخ دوم قبل از تاریخ اول است)' : ''
        ].filter(Boolean).join('\n');
        out1.classList.remove('error');
      } catch (e) {
        out1.textContent = e.message;
        out1.classList.add('error');
      }
    };
    const fA = dateField('تاریخ اول', t, recalcDiff);
    const fB = dateField('تاریخ دوم', t, recalcDiff);

    const fD = dateField('تاریخ مبدأ', t, () => recalcAdd());
    const nIn = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: '30', 'aria-label': 'تعداد روز' });
    const recalcAdd = () => {
      try {
        const base = fD.read();
        const n = parseInt(toLatin(nIn.value), 10);
        if (!Number.isInteger(n)) throw new CalcError('تعداد روز را به صورت عدد صحیح وارد کن (می‌تواند منفی باشد).');
        const r = jdnToJalali(jToJdn(base.y, base.m, base.d) + n);
        const rj = jToJdn(r.y, r.m, r.d);
        out2.textContent = [
          `نتیجه: ${weekdayOf(rj)} ${fmtJ(r)}`,
          `میلادی: ${fmtG(jdnToG(rj))}`
        ].join('\n');
        out2.classList.remove('error');
      } catch (e) {
        out2.textContent = e.message;
        out2.classList.add('error');
      }
    };
    nIn.addEventListener('input', recalcAdd);
    panelBox.append(
      h('section', { class: 'cp-card' },
        h('h3', { text: 'اختلاف دو تاریخ' }),
        fA.el, fB.el, out1),
      h('section', { class: 'cp-card' },
        h('h3', { text: 'تاریخ + یا − چند روز' }),
        fD.el,
        h('div', { class: 'cp-row' },
          h('label', { class: 'cp-label' }, h('span', { text: 'تعداد روز (منفی = قبل)' }), nIn)),
        out2),
      h('p', { class: 'hint', text: 'تاریخ‌ها شمسی‌اند و معادل میلادی‌شان هم نشان داده می‌شود.' })
    );
    recalcDiff();
    recalcAdd();
  }

  /* ---------- حالت تبدیل واحد ---------- */
  const UNIT_CATS = [
    { id: 'length', label: 'طول', units: [['mm', 'میلی‌متر', 0.001], ['cm', 'سانتی‌متر', 0.01], ['m', 'متر', 1], ['km', 'کیلومتر', 1000], ['in', 'اینچ', 0.0254], ['ft', 'فوت', 0.3048], ['yd', 'یارد', 0.9144], ['mi', 'مایل', 1609.344]] },
    { id: 'mass', label: 'جرم', units: [['mg', 'میلی‌گرم', 1e-6], ['g', 'گرم', 0.001], ['kg', 'کیلوگرم', 1], ['t', 'تن', 1000], ['lb', 'پوند', 0.45359237], ['oz', 'اونس', 0.028349523125]] },
    { id: 'temp', label: 'دما', units: [['C', 'سلسیوس'], ['F', 'فارنهایت'], ['K', 'کلوین']] },
    { id: 'area', label: 'مساحت', units: [['cm2', 'سانتی‌متر مربع', 1e-4], ['m2', 'متر مربع', 1], ['km2', 'کیلومتر مربع', 1e6], ['ha', 'هکتار', 1e4], ['ft2', 'فوت مربع', 0.09290304], ['acre', 'ایکر', 4046.8564224]] },
    { id: 'volume', label: 'حجم', units: [['ml', 'میلی‌لیتر', 0.001], ['l', 'لیتر', 1], ['m3', 'متر مکعب', 1000], ['gal', 'گالن آمریکا', 3.785411784], ['floz', 'اونس مایع آمریکا', 0.0295735295625]] },
    { id: 'speed', label: 'سرعت', units: [['ms', 'متر بر ثانیه', 1], ['kmh', 'کیلومتر بر ساعت', 1 / 3.6], ['mph', 'مایل بر ساعت', 0.44704], ['kn', 'گره دریایی', 0.514444]] },
    { id: 'time', label: 'زمان', units: [['ms', 'میلی‌ثانیه', 0.001], ['s', 'ثانیه', 1], ['min', 'دقیقه', 60], ['h', 'ساعت', 3600], ['d', 'روز', 86400], ['wk', 'هفته', 604800], ['yr', 'سال (۳۶۵٫۲۴۲۵ روز)', 31556952]] },
    { id: 'data', label: 'داده', units: [['bit', 'بیت', 0.125], ['B', 'بایت', 1], ['KB', 'کیلوبایت (۱۰۲۴ بایت)', 1024], ['MB', 'مگابایت', 1048576], ['GB', 'گیگابایت', 1073741824], ['TB', 'ترابایت', 1099511627776]] }
  ];
  const toKelvin = (v, u) => (u === 'C' ? v + 273.15 : u === 'F' ? (v - 32) * 5 / 9 + 273.15 : v);
  const fromKelvin = (k, u) => (u === 'C' ? k - 273.15 : u === 'F' ? (k - 273.15) * 9 / 5 + 32 : k);
  function convertUnit(cat, v, from, to) {
    if (cat.id === 'temp') return fromKelvin(toKelvin(v, from), to);
    const f = cat.units.find(u => u[0] === from)[2];
    const t = cat.units.find(u => u[0] === to)[2];
    return v * f / t;
  }
  const fmtUnit = x => (Number.isFinite(x) ? String(Number(x.toPrecision(10))) : '—');

  function buildConvert() {
    panelBox.replaceChildren();
    const catSel = h('select', { 'aria-label': 'دسته‌بندی' }, ...UNIT_CATS.map(c => h('option', { value: c.id, text: c.label })));
    const fromSel = h('select', { 'aria-label': 'واحد مبدأ' });
    const toSel = h('select', { 'aria-label': 'واحد مقصد' });
    const inEl = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', value: '1', 'aria-label': 'مقدار' });
    const outEl = h('input', { type: 'text', readonly: '', 'aria-label': 'نتیجه' });
    const note = h('p', { class: 'hint' });
    const cat = () => UNIT_CATS.find(c => c.id === catSel.value);
    const fillUnits = (c, from, to) => {
      const opts = u => u.map(x => h('option', { value: x[0], text: `${x[1]} (${x[0]})` }));
      fromSel.replaceChildren(...opts(c.units));
      toSel.replaceChildren(...opts(c.units));
      fromSel.value = from || c.units[0][0];
      toSel.value = to || c.units[1][0];
    };
    const recalc = () => {
      const c = cat();
      const v = parseFloat(toLatin(inEl.value).replace(',', '.'));
      outEl.value = Number.isFinite(v) ? fmtUnit(convertUnit(c, v, fromSel.value, toSel.value)) : 'عدد معتبر وارد کن';
      note.textContent = c.id === 'data' ? '۱ کیلوبایت = ۱۰۲۴ بایت (مطابق ویندوز)' : (c.id === 'temp' ? 'دما بین سلسیوس، فارنهایت و کلوین تبدیل می‌شود.' : '');
    };
    catSel.addEventListener('change', () => { fillUnits(cat()); recalc(); });
    fromSel.addEventListener('change', recalc);
    toSel.addEventListener('change', recalc);
    inEl.addEventListener('input', recalc);
    const swap = h('button', { type: 'button', class: 'ghost-btn cp-swap', text: '⇅ جابه‌جایی', 'aria-label': 'جابه‌جا کردن واحدها', onclick: () => {
      const a = fromSel.value; fromSel.value = toSel.value; toSel.value = a; recalc();
    } });
    panelBox.append(h('section', { class: 'cp-card' },
      h('h3', { text: 'تبدیل واحد' }),
      h('label', { class: 'cp-label' }, h('span', { text: 'دسته‌بندی' }), catSel),
      h('div', { class: 'cp-unit-grid' },
        h('label', { class: 'cp-label' }, h('span', { text: 'مقدار' }), inEl),
        h('label', { class: 'cp-label' }, h('span', { text: 'از' }), fromSel),
        h('label', { class: 'cp-label' }, h('span', { text: 'نتیجه' }), outEl),
        h('label', { class: 'cp-label' }, h('span', { text: 'به' }), toSel)),
      h('div', { class: 'cp-row' }, swap),
      note));
    const c = cat();
    fillUnits(c, c.id === 'length' ? 'km' : undefined, c.id === 'length' ? 'mi' : undefined);
    recalc();
  }

  /* ---------- کیبورد ---------- */
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!isExprMode() || panel.hidden || panel.offsetParent === null) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const prog = state.mode === 'programmer';
    let key = null;
    if (/^[0-9]$/.test(e.key)) key = e.key;
    else if (e.key === 'Enter' || e.key === '=') key = '=';
    else if (e.key === 'Backspace') key = 'DEL';
    else if (e.key === 'Escape' || e.key === 'Delete') key = 'AC';
    else if (e.key === '.' || e.key === ',') key = prog ? null : '.';
    else if (e.key === '+') key = '+';
    else if (e.key === '-') key = '−';
    else if (e.key === '*') key = '×';
    else if (e.key === '/') key = '÷';
    else if (e.key === '^') key = '^';
    else if (e.key === '%') key = '%';
    else if (e.key === '!') key = '!';
    else if (e.key === '(' || e.key === ')') key = e.key;
    else if (prog && /^[a-fA-F]$/.test(e.key)) key = e.key.toUpperCase();
    else if (!prog && e.key === 'p') key = 'pi';
    else if (!prog && e.key === 'e') key = 'e';
    if (!key) return;
    if (prog && /^[0-9A-F]$/.test(key) && parseInt(key, 16) >= state.base) {
      e.preventDefault();
      showError(`رقم «${key}» در مبنای ${BASE_FA[state.base]} مجاز نیست.`);
      return;
    }
    e.preventDefault();
    press(key);
  });

  /* ---------- راه‌اندازی ---------- */
  let extrasEl = null;
  let hintEl = null;
  function init() {
    panel.querySelectorAll(':scope > .calc-modebar').forEach(n => n.remove());
    const oldHistory = panel.querySelector(':scope > .calc-history');
    if (oldHistory) oldHistory.hidden = true;
    hintEl = panel.querySelector(':scope > .hint');
    extrasEl = panel.querySelector(':scope > .calc-extras');
    grid.classList.remove('calc-standard-mode');
    buildTabs();
    buildStatus();
    buildBaseBar();
    buildHistory();
    state.hist = store.get(LS.hist, []);
    if (!Array.isArray(state.hist)) state.hist = [];
    renderHistory();
    grid.addEventListener('click', e => {
      const b = e.target.closest('button[data-key]');
      if (b && !b.disabled) press(b.dataset.key);
    });
    const saved = store.get(LS.mode, 'standard');
    const startMode = MODES.some(m => m.id === saved) ? saved : 'standard';
    if (hintEl) hintEl.textContent = HINTS.standard;
    setMode(startMode, false);
    if (hintEl && HINTS[state.mode]) hintEl.textContent = HINTS[state.mode];
  }

  // کلیدهای دایره‌ای از پیش ثبت‌شده در بخش‌های دیگر را هم پوشش می‌دهیم
  window.SAMCalcPro = { evaluate, stdEnv, progEnv, jToJdn, jdnToJalali, gToJdn, jdnToG, convertUnit, setMode, press, getState: () => ({ ...state, hist: undefined }) };
  init();
})();
