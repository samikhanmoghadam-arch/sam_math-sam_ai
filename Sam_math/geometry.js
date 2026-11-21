"use strict";

(() => {
  const canvas = document.getElementById("geometryCanvas");
  const shell = document.getElementById("canvasShell");
  const ctx = canvas.getContext("2d");

  const $ = id => document.getElementById(id);
  const status = $("status");
  const help = $("helpText");
  const props = $("propertiesText");
  const coords = $("coordinates");
  const zoomLabel = $("zoomValue");

  // بوم محدود: روی هر محور از −LIMIT تا +LIMIT (واحد مختصات).
  const LIMIT = 20;
  const MIN_SCALE = 8;
  const MAX_SCALE = 150;

  let W = 0, H = 0, dpr = 1;
  let scale = 40, ox = 0, oy = 0, viewReady = false;
  let objects = [], history = [], nextId = 1;
  let tool = "select", pending = [], polygonIds = [];
  let dragPoint = null, dragBefore = null, panStart = null, selectedId = null;
  // شکلی که برای ابزارهای تبدیل (انتقال، چرخش، قرینه، تجانس) انتخاب شده است
  let pickedId = null;

  const palette = {
    point: "#67e8f9",
    segment: "#a78bfa",
    line: "#c4b5fd",
    circle: "#38bdf8",
    polygon: "#34d399",
    angle: "#fbbf24",
    perpbis: "#f0abfc",
    bisector: "#fb923c",
    derived: "#f472b6",
    stroke: "#e879f9",
    measure: "#fde047",
    ray: "#93c5fd",
    vector: "#fb7185",
    pdist: "#f87171",
    arc: "#7dd3fc",
    ellipse: "#a5b4fc",
    parabola: "#f9a8d4"
  };

  const toolNames = {
    select: "انتخاب و جابه‌جایی",
    point: "نقطه",
    segment: "پاره‌خط",
    line: "خط",
    circle: "دایره",
    polygon: "چندضلعی",
    angle: "اندازه‌گیری زاویه",
    midpoint: "نقطهٔ وسط",
    perp: "عمودمنصف",
    bisector: "نیمساز زاویه",
    stroke: "قلم آزاد",
    measure: "اندازه‌گیری فاصله",
    intersect: "تقاطع دو خط",
    foot: "پای عمود",
    parallel: "خط موازی",
    perpline: "خط عمود",
    ray: "نیم‌خط",
    vector: "بردار",
    pdist: "فاصلهٔ نقطه از خط",
    circle3: "دایره از سه نقطه",
    circleRad: "دایره با شعاع معین",
    compass: "پرگار",
    tangent: "مماس بر دایره",
    arc3: "کمان از سه نقطه",
    semicircle: "نیم‌دایره",
    sector: "قطاع دایره",
    regular: "چندضلعی منتظم",
    angleGiven: "زاویهٔ معین",
    translate: "انتقال با بردار",
    rotate: "چرخش",
    reflectline: "قرینه نسبت به خط",
    reflectpt: "قرینه نسبت به نقطه",
    dilate: "تجانس",
    ellipse: "بیضی",
    parabola: "سهمی"
  };

  // نام نوع نقطه‌های وابسته، برای نمایش در اطلاعات شکل
  const depNames = {
    midpoint: "نقطهٔ وسط",
    centroid: "مرکز ثقل",
    circumcenter: "مرکز دایرهٔ محیطی",
    incenter: "مرکز دایرهٔ محاطی",
    orthocenter: "مرکز ارتفاعی",
    intersect: "نقطهٔ تقاطع",
    foot: "پای عمود",
    translate: "تصویر انتقال",
    rotate: "تصویر چرخش",
    reflectpt: "تصویر قرینهٔ نقطه‌ای",
    reflectline: "تصویر قرینهٔ خطی",
    dilate: "تصویر تجانس",
    regular: "رأس چندضلعی منتظم",
    tangent: "نقطهٔ تماس مماس"
  };

  // برچسب کادر عدد ورودی برای هر ابزار
  const paramLabels = {
    circleRad: "شعاع دایره",
    rotate: "زاویهٔ چرخش (درجه؛ مثبت = خلاف عقربه‌ها)",
    dilate: "ضریب تجانس (مثلاً ۲ = دو برابر)",
    angleGiven: "اندازهٔ زاویه (درجه، بین ۰ تا ۱۸۰)",
    regular: "تعداد ضلع‌ها (۳ تا ۲۴)"
  };
  const paramDefaults = { circleRad: "3", rotate: "90", dilate: "2", angleGiven: "60", regular: "6" };

  const fmt = n => Number.isFinite(n) ? String(+n.toFixed(3)) : "—";
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const getPoint = id => objects.find(o => o.id === id && o.type === "point");

  // حالت روز/شب و رنگ متن روی بوم
  const isDay = () => document.body.classList.contains("day");
  const isIn3D = () => document.body.classList.contains("dim-3d");
  function tint(hex) {
    if (!isDay() || typeof hex !== "string" || hex[0] !== "#" || hex.length !== 7) return hex;
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * 0.5);
    const g = Math.round(((n >> 8) & 255) * 0.5);
    const b = Math.round((n & 255) * 0.5);
    return `rgb(${r},${g},${b})`;
  }
  const pal = key => tint(palette[key]);
  // بزرگ‌نمایی‌ای که بوم کامل را در کادر جا می‌دهد
  const fitScale = () => Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(W, H) / (2 * LIMIT) * 0.96));

  // مختصات را داخل مرز بوم نگه می‌دارد
  const clampWorld = p => ({
    x: Math.max(-LIMIT, Math.min(LIMIT, p.x)),
    y: Math.max(-LIMIT, Math.min(LIMIT, p.y))
  });
  const inBoard = p => Math.abs(p.x) <= LIMIT + 1e-9 && Math.abs(p.y) <= LIMIT + 1e-9;

  // مرکزی را طوری جابه‌جا می‌کند که شکلی به نیم‌عرض half داخل بوم بماند
  const fitCenter = (base, half) => {
    const lim = Math.max(0, LIMIT - half);
    return Math.max(-lim, Math.min(lim, base));
  };

  const snapPoint = p => clampWorld($("snapToggle")?.checked
    ? { x: Math.round(p.x), y: Math.round(p.y) }
    : p);

  function say(text) {
    status.textContent = text;
  }
  let shapeDrag = null, strokeDraw = null, hasSavedScale = false;

  /* ---------- history / persistence ---------- */

  // Runs one user action as a single undo step. A snapshot is stored only
  // when the action actually changed something.
  function transact(fn) {
    const before = JSON.stringify(objects);
    fn();
    if (JSON.stringify(objects) !== before) pushHistory(before);
    refresh();
  }

  function pushHistory(serialized) {
    history.push(serialized);
    if (history.length > 60) history.shift();
  }

  function refresh() {
    saveLocal();
    draw();
    updateProperties();
  }

  function saveLocal() {
    try {
      localStorage.setItem("SAM MATH_GEOMETRY_STUDIO", JSON.stringify({
        objects, nextId, scale
      }));
    } catch (_) {
      say("مرورگر اجازهٔ ذخیرهٔ محلی نداد.");
    }
  }

  /* ---------- coordinates & view ---------- */

  function worldToScreen(p) {
    return { x: ox + p.x * scale, y: oy - p.y * scale };
  }

  function screenToWorld(x, y) {
    return { x: (x - ox) / scale, y: (oy - y) / scale };
  }

  function canvasPosition(event) {
    const r = canvas.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }

  // نمای بوم را طوری نگه می‌دارد که مرز بوم از کادر بیرون نرود.
  // اگر بوم از صفحه کوچک‌تر باشد، وسط صفحه قرار می‌گیرد.
  function clampView() {
    const half = LIMIT * scale;
    ox = 2 * half <= W ? W / 2 : Math.max(W - half, Math.min(half, ox));
    oy = 2 * half <= H ? H / 2 : Math.max(H - half, Math.min(half, oy));
  }

  /* ---------- object creation (no history / redraw here) ---------- */

  function addObject(data) {
    const object = { id: nextId++, ...data };
    objects.push(object);
    selectedId = object.id;
    return object;
  }

  function nextLabel() {
    const used = new Set(objects.filter(o => o.type === "point").map(o => o.label));
    for (let i = 0; ; i++) {
      const label = String.fromCharCode(65 + i % 26) + (i >= 26 ? Math.floor(i / 26) : "");
      if (!used.has(label)) return label;
    }
  }

  function uniqueLabel(base) {
    const used = new Set(objects.filter(o => o.type === "point").map(o => o.label));
    if (!used.has(base)) return base;
    for (let i = 2; ; i++) if (!used.has(base + i)) return base + i;
  }

  function createPoint(p) {
    const q = clampWorld(p);
    return addObject({ type: "point", x: q.x, y: q.y, label: nextLabel() });
  }

  // A point whose position is computed from other points (moves with them).
  function addDerivedPoint(kind, base, of, extra) {
    const p = addObject({
      type: "point", x: 0, y: 0, label: uniqueLabel(base), dep: { kind, of, ...(extra || {}) }
    });
    computeDep(p);
    return p;
  }

  function createLineBetween(a, b, type) {
    if (!a || !b || a.id === b.id) {
      say("دو نقطهٔ متفاوت انتخاب کن.");
      return;
    }
    addObject({ type, a: a.id, b: b.id });
    pending = [];
    say(type === "line" ? "خط رسم شد." : "پاره‌خط رسم شد.");
  }

  /* ---------- geometry helpers ---------- */

  function radiusOf(o) {
    if (o.inradius) {
      const P = o.inradius.map(getPoint);
      if (P.every(Boolean)) {
        const [a, b, c] = P;
        const perimeter = dist(b, c) + dist(c, a) + dist(a, b);
        const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
        return perimeter > 1e-9 ? 2 * area / perimeter : 0;
      }
    }
    const c = getPoint(o.center);
    const through = o.through != null ? getPoint(o.through) : null;
    return c && through ? dist(c, through) : o.radius;
  }

  function circumcenter(a, b, c) {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-9) return null;
    const a2 = a.x * a.x + a.y * a.y;
    const b2 = b.x * b.x + b.y * b.y;
    const c2 = c.x * c.x + c.y * c.y;
    return {
      x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
      y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d
    };
  }

  function computeDep(p) {
    const P = p.dep.of.map(getPoint);
    if (P.some(q => !q)) return;
    if (p.dep.kind === "intersect") {
      const [p1, p2, p3, p4] = P;
      const den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
      if (Math.abs(den) < 1e-9) return;
      const t1 = p1.x * p2.y - p1.y * p2.x, t2 = p3.x * p4.y - p3.y * p4.x;
      Object.assign(p, clampWorld({
        x: (t1 * (p3.x - p4.x) - (p1.x - p2.x) * t2) / den,
        y: (t1 * (p3.y - p4.y) - (p1.y - p2.y) * t2) / den
      }));
      return;
    }
    if (p.dep.kind === "foot") {
      const [q, A, B] = P;
      const dx = B.x - A.x, dy = B.y - A.y, len2 = dx * dx + dy * dy;
      if (len2 < 1e-12) return;
      const t = ((q.x - A.x) * dx + (q.y - A.y) * dy) / len2;
      Object.assign(p, clampWorld({ x: A.x + t * dx, y: A.y + t * dy }));
      return;
    }
    if (TRANSFORM_KINDS.includes(p.dep.kind)) {
      const q = transformCoords(p.dep, P);
      if (q) Object.assign(p, clampWorld(q));
      return;
    }

    const [a, b, c] = P;
    let r = null;

    if (p.dep.kind === "midpoint") {
      r = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    } else if (p.dep.kind === "centroid") {
      r = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
    } else if (p.dep.kind === "circumcenter") {
      r = circumcenter(a, b, c);
    } else if (p.dep.kind === "incenter") {
      const la = dist(b, c), lb = dist(c, a), lc = dist(a, b);
      const s = la + lb + lc;
      if (s > 1e-9) r = { x: (la * a.x + lb * b.x + lc * c.x) / s, y: (la * a.y + lb * b.y + lc * c.y) / s };
    } else if (p.dep.kind === "orthocenter") {
      const o = circumcenter(a, b, c);
      if (o) r = { x: a.x + b.x + c.x - 2 * o.x, y: a.y + b.y + c.y - 2 * o.y };
    }

    if (r) {
      // نقطه‌های محاسبه‌شده هم باید داخل بوم بمانند
      const q = clampWorld(r);
      p.x = q.x;
      p.y = q.y;
    }
  }

  // Parents are always created before children, so one pass in order is enough.
  function updateDependents() {
    for (const o of objects) if (o.type === "point" && o.dep) computeDep(o);
  }

  function perpBisectorScreen(o) {
    const a = getPoint(o.a), b = getPoint(o.b);
    if (!a || !b) return null;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return null;
    return {
      m: worldToScreen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }),
      dir: { x: -dy / len, y: -dx / len }
    };
  }

  function bisectorScreen(o) {
    const a = getPoint(o.a), v = getPoint(o.vertex), c = getPoint(o.c);
    if (!a || !v || !c) return null;
    const ul = Math.hypot(a.x - v.x, a.y - v.y);
    const wl = Math.hypot(c.x - v.x, c.y - v.y);
    if (ul < 1e-9 || wl < 1e-9) return null;
    const ux = (a.x - v.x) / ul, uy = (a.y - v.y) / ul;
    const wx = (c.x - v.x) / wl, wy = (c.y - v.y) / wl;
    let dx = ux + wx, dy = uy + wy;
    let len = Math.hypot(dx, dy);
    if (len < 1e-9) { dx = -uy; dy = ux; len = 1; }
    return { q: worldToScreen(v), dir: { x: dx / len, y: -dy / len } };
  }

  function polygonStats(ps) {
    const perimeter = ps.reduce((sum, p, i) => sum + dist(p, ps[(i + 1) % ps.length]), 0);
    let area = 0;
    ps.forEach((p, i) => {
      const q = ps[(i + 1) % ps.length];
      area += p.x * q.y - q.x * p.y;
    });
    return { perimeter, area: Math.abs(area) / 2 };
  }

  function angleDegrees(o) {
    const a = getPoint(o.a), v = getPoint(o.vertex), c = getPoint(o.c);
    if (!a || !v || !c) return null;
    const ux = a.x - v.x, uy = a.y - v.y;
    const wx = c.x - v.x, wy = c.y - v.y;
    const den = Math.hypot(ux, uy) * Math.hypot(wx, wy);
    if (den < 1e-9) return null;
    const cos = Math.max(-1, Math.min(1, (ux * wx + uy * wy) / den));
    return Math.acos(cos) * 180 / Math.PI;
  }

  /* ---------- ابزارهای جدید: تبدیل، کمان، بیضی، سهمی ---------- */

  // نوع‌های نقطهٔ وابسته که مختصاتشان از تبدیل یا ساختار دیگری به دست می‌آید
  const TRANSFORM_KINDS = ["translate", "rotate", "reflectpt", "reflectline", "dilate", "regular", "tangent"];

  // مختصات نقطهٔ وابسته را از نقطه‌های والد حساب می‌کند (null یعنی ساخت ممکن نیست).
  // P: آرایه‌ای از نقطه‌های والد به ترتیب dep.of
  function transformCoords(dep, P) {
    const k = dep.kind, par = dep.par;
    if (k === "translate") {
      const [s, A, B] = P;
      return { x: s.x + B.x - A.x, y: s.y + B.y - A.y };
    }
    if (k === "rotate") {
      const [s, C] = P;
      const t = (par || 0) * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t);
      const dx = s.x - C.x, dy = s.y - C.y;
      return { x: C.x + dx * c - dy * sn, y: C.y + dx * sn + dy * c };
    }
    if (k === "dilate") {
      const [s, C] = P;
      return { x: C.x + par * (s.x - C.x), y: C.y + par * (s.y - C.y) };
    }
    if (k === "reflectpt") {
      const [s, C] = P;
      return { x: 2 * C.x - s.x, y: 2 * C.y - s.y };
    }
    if (k === "reflectline") {
      const [s, A, B] = P;
      const dx = B.x - A.x, dy = B.y - A.y, len2 = dx * dx + dy * dy;
      if (len2 < 1e-12) return null;
      const t = ((s.x - A.x) * dx + (s.y - A.y) * dy) / len2;
      const fx = A.x + t * dx, fy = A.y + t * dy;
      return { x: 2 * fx - s.x, y: 2 * fy - s.y };
    }
    if (k === "regular") {
      // دو رأس اول A و B؛ رأس k ام روی دایرهٔ محیطی چندضلعی منتظم با n ضلع
      const [A, B] = P;
      const n = par, idx = dep.k;
      const s = dist(A, B);
      if (s < 1e-9 || !Number.isInteger(n) || n < 3) return null;
      const ux = (B.x - A.x) / s, uy = (B.y - A.y) / s;
      const h = s / (2 * Math.tan(Math.PI / n));
      const cx = (A.x + B.x) / 2 - uy * h, cy = (A.y + B.y) / 2 + ux * h;
      const R = s / (2 * Math.sin(Math.PI / n));
      const phi = Math.atan2(A.y - cy, A.x - cx) + idx * 2 * Math.PI / n;
      return { x: cx + R * Math.cos(phi), y: cy + R * Math.sin(phi) };
    }
    if (k === "tangent") {
      // P نقطهٔ بیرونی، O مرکز، A روی دایره؛ dep.k = 0 یا 1 برای دو نقطهٔ تماس
      const [Pt, O, A] = P;
      const r = dist(O, A), d = dist(Pt, O);
      if (r < 1e-9 || d <= r + 1e-9) return null;
      const phi = Math.atan2(Pt.y - O.y, Pt.x - O.x);
      const th = Math.acos(r / d) * (dep.k === 0 ? 1 : -1);
      return { x: O.x + r * Math.cos(phi + th), y: O.y + r * Math.sin(phi + th) };
    }
    return null;
  }

  // مشخصات کمان/قطاع/نیم‌دایره در دستگاه جهانی: مرکز، شعاع، زاویهٔ شروع و جارو
  function arcSpec(o) {
    const O = getPoint(o.center), A = getPoint(o.a), C = getPoint(o.c);
    if (!O || !A || !C) return null;
    const r = dist(O, A);
    if (r < 1e-9) return null;
    const TAU = 2 * Math.PI;
    const norm = t => ((t % TAU) + TAU) % TAU;
    const alpha = Math.atan2(A.y - O.y, A.x - O.x);
    const beta = Math.atan2(C.y - O.y, C.x - O.x);
    let ccw, sweep;
    if (o.sector) {
      ccw = true;
      sweep = norm(beta - alpha);
    } else {
      // نقطهٔ عبور: اگر b باشد همان، وگرنه برای نیم‌دایره سمت چپ خط A→C
      const B = o.b != null ? getPoint(o.b) : null;
      const gamma = B
        ? Math.atan2(B.y - O.y, B.x - O.x)
        : Math.atan2(C.x - A.x, -(C.y - A.y)) ;
      ccw = norm(gamma - alpha) < norm(beta - alpha);
      sweep = ccw ? norm(beta - alpha) : norm(alpha - beta);
    }
    return { O, r, alpha, sweep, ccw, sector: !!o.sector };
  }

  // مشخصات بیضی: مرکز، نیم‌محورها و بردار واحد محور بزرگ
  function ellipseSpec(o) {
    const F1 = getPoint(o.f1), F2 = getPoint(o.f2), P = getPoint(o.p);
    if (!F1 || !F2 || !P) return null;
    const c2 = dist(F1, F2);
    if (c2 < 1e-9) return null;
    const c = c2 / 2;
    const a = (dist(P, F1) + dist(P, F2)) / 2;
    if (a - c < 1e-6) return null;
    const b = Math.sqrt(a * a - c * c);
    const u = { x: (F2.x - F1.x) / c2, y: (F2.y - F1.y) / c2 };
    return { M: { x: (F1.x + F2.x) / 2, y: (F1.y + F2.y) / 2 }, a, b, u };
  }

  // مشخصات سهمی: کانون، پای عمود کانون بر خط هادی، بردار هادی u و بردار عمود n و فاصلهٔ کانون تا خط هادی f
  function parabolaSpec(o) {
    const F = getPoint(o.f), A = getPoint(o.a), B = getPoint(o.b);
    if (!F || !A || !B) return null;
    const len = dist(A, B);
    if (len < 1e-9) return null;
    const u = { x: (B.x - A.x) / len, y: (B.y - A.y) / len };
    const n = { x: -u.y, y: u.x };
    const f = (F.x - A.x) * n.x + (F.y - A.y) * n.y;
    if (Math.abs(f) < 1e-6) return null;
    return { Fp: { x: F.x - n.x * f, y: F.y - n.y * f }, u, n, f, A };
  }

  // خط بی‌نهایت گذرنده از دو نقطهٔ جهانی (به صورت نقطه و جهت روی صفحهٔ نمایش)
  function dirlineScreen(o) {
    const P = getPoint(o.p), A = getPoint(o.a), B = getPoint(o.b);
    if (!P || !A || !B) return null;
    let dx = B.x - A.x, dy = B.y - A.y;
    if (o.perp) { const t = dx; dx = -dy; dy = t; }
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return null;
    return { m: worldToScreen(P), dir: { x: dx / len, y: -dy / len } };
  }

  // کوتاه‌ترین فاصلهٔ یک نقطهٔ صفحه تا یک چندضلعی باز (برای برخورد موس با منحنی‌ها)
  function polyHit(x, y, pts, tol) {
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSegment(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) < tol) return true;
    }
    return false;
  }

  // عدد ورودی را می‌خواند؛ اگر معتبر نباشد null برمی‌گرداند
  function readParam() {
    const raw = ($("paramIn")?.value || "").trim();
    const v = Number(window.SAMNormalizeDigits ? window.SAMNormalizeDigits(raw) : raw);
    return raw !== "" && Number.isFinite(v) ? v : null;
  }

  // شناسه‌های نقطه‌هایی که یک شکل به آن‌ها وابسته است
  function refIds(o) {
    const ids = [o.a, o.b, o.c, o.vertex, o.center, o.through, o.p, o.f, o.f1, o.f2, ...(o.points || [])];
    return [...new Set(ids.filter(id => id != null && getPoint(id)))];
  }

  // انواع شکلی که می‌توانند تصویر بگیرند
  const COPYABLE = ["segment", "line", "ray", "vector", "circle", "polygon", "angle", "arc", "dirline", "perpbis", "bisector"];

  // داده‌های شکل تصویر، با جایگزینی هر نقطه با تصویرش (M)
  function copyShape(o, M) {
    switch (o.type) {
      case "segment": case "line": case "ray": case "vector":
        return { type: o.type, a: M(o.a), b: M(o.b) };
      case "circle":
        if (o.inradius || o.through == null) return null;
        return { type: "circle", center: M(o.center), through: M(o.through), radius: 0 };
      case "polygon":
        return { type: "polygon", points: o.points.map(M) };
      case "angle":
        return { type: "angle", a: M(o.a), vertex: M(o.vertex), c: M(o.c) };
      case "bisector":
        return { type: "bisector", a: M(o.a), vertex: M(o.vertex), c: M(o.c) };
      case "perpbis":
        return { type: "perpbis", a: M(o.a), b: M(o.b) };
      case "arc":
        return { type: "arc", center: M(o.center), a: M(o.a), c: M(o.c), b: o.b != null ? M(o.b) : null, sector: !!o.sector };
      case "dirline":
        return { type: "dirline", p: M(o.p), a: M(o.a), b: M(o.b), perp: !!o.perp };
    }
    return null;
  }

  /* ---------- hit testing ---------- */

  function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function distToLine(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (!len) return Infinity;
    return Math.abs((px - ax) * dy - (py - ay) * dx) / len;
  }

  function pointInPolygon(px, py, ss) {
    let inside = false;
    for (let i = 0, j = ss.length - 1; i < ss.length; j = i++) {
      const a = ss[i], b = ss[j];
      if ((a.y > py) !== (b.y > py) &&
          px < (b.x - a.x) * (py - a.y) / (b.y - a.y) + a.x) {
        inside = !inside;
      }
    }
    return inside;
  }

  function hitPoint(x, y) {
    let result = null, best = 15;
    for (const p of objects.filter(o => o.type === "point")) {
      const s = worldToScreen(p);
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < best) {
        best = d;
        result = p;
      }
    }
    return result;
  }

  // Finds a non-point shape under the cursor. Edges win over polygon interiors.
  function hitShape(x, y) {
    const tol = 8;

    for (let k = objects.length - 1; k >= 0; k--) {
      const o = objects[k];

      if (o.type === "stroke") {
        for (let i = 0; i < o.pts.length - 1; i++) {
          const p = worldToScreen(o.pts[i]), q = worldToScreen(o.pts[i + 1]);
          if (distToSegment(x, y, p.x, p.y, q.x, q.y) < tol) return o;
        }
        continue;
      }
      if (o.type === "measure") {
        const a = getPoint(o.a), b = getPoint(o.b);
        if (!a || !b) continue;
        const p = worldToScreen(a), q = worldToScreen(b);
        if (distToSegment(x, y, p.x, p.y, q.x, q.y) < tol) return o;
        continue;
      }

      if (o.type === "dirline") {
        const s = dirlineScreen(o);
        if (s && distToLine(x, y, s.m.x, s.m.y, s.m.x + s.dir.x, s.m.y + s.dir.y) < tol) return o;
        continue;
      }
      if (o.type === "pdist") {
        const P = getPoint(o.p), A = getPoint(o.a), B = getPoint(o.b);
        const F = P && A && B ? footWorld(P, A, B) : null;
        if (F) {
          const s = worldToScreen(P), t = worldToScreen(F);
          if (distToSegment(x, y, s.x, s.y, t.x, t.y) < tol) return o;
        }
        continue;
      }
      if (o.type === "arc") {
        const s = arcSpec(o);
        if (s && arcHit(x, y, s, tol)) return o;
        continue;
      }
      if (o.type === "ellipse") {
        const e = ellipseSpec(o);
        if (e && polyHit(x, y, ellipsePoints(e), tol)) return o;
        continue;
      }
      if (o.type === "parabola") {
        const pb = parabolaSpec(o);
        if (pb && polyHit(x, y, parabolaPoints(pb), tol)) return o;
        continue;
      }

      if (o.type === "segment" || o.type === "line" || o.type === "ray" || o.type === "vector") {
        const a = getPoint(o.a), b = getPoint(o.b);
        if (!a || !b) continue;
        const p = worldToScreen(a), q = worldToScreen(b);
        let d;
        if (o.type === "line") {
          d = distToLine(x, y, p.x, p.y, q.x, q.y);
        } else if (o.type === "ray") {
          const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
          const reach = Math.hypot(W, H) * 2;
          d = distToSegment(x, y, p.x, p.y, p.x + (q.x - p.x) / len * reach, p.y + (q.y - p.y) / len * reach);
        } else {
          d = distToSegment(x, y, p.x, p.y, q.x, q.y);
        }
        if (d < tol) return o;
      } else if (o.type === "circle") {
        const c = getPoint(o.center);
        if (!c) continue;
        const p = worldToScreen(c);
        if (Math.abs(Math.hypot(x - p.x, y - p.y) - radiusOf(o) * scale) < tol) return o;
      } else if (o.type === "perpbis") {
        const s = perpBisectorScreen(o);
        if (!s) continue;
        if (distToLine(x, y, s.m.x, s.m.y, s.m.x + s.dir.x, s.m.y + s.dir.y) < tol) return o;
      } else if (o.type === "bisector") {
        const s = bisectorScreen(o);
        if (!s) continue;
        const reach = Math.hypot(W, H) * 2;
        if (distToSegment(x, y, s.q.x, s.q.y, s.q.x + s.dir.x * reach, s.q.y + s.dir.y * reach) < tol) return o;
      } else if (o.type === "angle") {
        const a = getPoint(o.a), v = getPoint(o.vertex), c = getPoint(o.c);
        if (!a || !v || !c) continue;
        const p = worldToScreen(a), q = worldToScreen(v), r = worldToScreen(c);
        if (distToSegment(x, y, p.x, p.y, q.x, q.y) < tol ||
            distToSegment(x, y, q.x, q.y, r.x, r.y) < tol) return o;
      } else if (o.type === "polygon") {
        const ss = o.points.map(getPoint).filter(Boolean).map(worldToScreen);
        for (let i = 0; i < ss.length; i++) {
          const s = ss[i], t = ss[(i + 1) % ss.length];
          if (distToSegment(x, y, s.x, s.y, t.x, t.y) < tol) return o;
        }
      }
    }

    for (let k = objects.length - 1; k >= 0; k--) {
      const o = objects[k];
      if (o.type !== "polygon") continue;
      const ss = o.points.map(getPoint).filter(Boolean).map(worldToScreen);
      if (ss.length >= 3 && pointInPolygon(x, y, ss)) return o;
    }

    return null;
  }

  /* ---------- canvas sizing ---------- */

  function resize() {
    const rect = shell.getBoundingClientRect();
    W = Math.max(280, rect.width);
    H = Math.max(300, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";

    if (!viewReady) {
      if (!hasSavedScale) scale = fitScale();
      ox = W / 2;
      oy = H / 2;
      viewReady = true;
    }
    clampView();
    draw();
  }

  /* ---------- drawing ---------- */

  function drawGrid() {
    const L = LIMIT * scale;
    const x0 = ox - L, x1 = ox + L, y0 = oy - L, y1 = oy + L;

    // بیرون بوم
    ctx.fillStyle = isDay() ? "#dfe8f3" : "#06090f";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();

    // داخل بوم
    ctx.fillStyle = isDay() ? "#f8fbff" : "#0b1221";
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    const unit = scale >= 70 ? 1 : scale >= 30 ? 2 : 5;
    const spacing = unit * scale;
    const k = Math.floor(LIMIT / unit);

    ctx.strokeStyle = isDay() ? "rgba(71,85,105,.22)" : "rgba(148,163,184,.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -k; i <= k; i++) {
      const x = ox + i * spacing;
      const y = oy + i * spacing;
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();

    ctx.strokeStyle = tint("#9aabc4");
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x0, oy);
    ctx.lineTo(x1, oy);
    ctx.moveTo(ox, y0);
    ctx.lineTo(ox, y1);
    ctx.stroke();

    ctx.restore();

    // مرز بوم
    ctx.strokeStyle = "rgba(103,232,249,.55)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

    // برچسب محورها و عددها
    const cx = v => Math.min(Math.max(v, 4), W - 14);
    const cy = v => Math.min(Math.max(v, 14), H - 4);
    ctx.fillStyle = tint("#9aabc4");
    ctx.font = "12px system-ui";
    ctx.fillText("x", cx(x1 - 14), cy(oy - 8));
    ctx.fillText("y", cx(ox + 8), cy(y0 + 14));
    ctx.fillText("O", cx(ox + 6), cy(oy + 15));

    for (let i = -k; i <= k; i++) {
      if (i === 0) continue;
      const v = i * unit;
      const x = ox + v * scale, y = oy - v * scale;
      if (x > 0 && x < W && oy + 15 < H) ctx.fillText(String(v), x + 3, oy + 15);
      if (y > 0 && y < H && ox + 6 < W - 20) ctx.fillText(String(v), ox + 6, y - 4);
    }
  }

  function drawPoint(p) {
    const s = worldToScreen(p);
    ctx.beginPath();
    ctx.arc(s.x, s.y, selectedId === p.id ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = selectedId === p.id ? "#fff" : (p.dep ? pal("derived") : pal("point"));
    ctx.fill();
    ctx.strokeStyle = p.dep ? pal("derived") : pal("point");
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "bold 13px system-ui";
    ctx.fillStyle = tint("#f1f5f9");
    ctx.fillText(p.label, s.x + 9, s.y - 8);
    ctx.font = "11px system-ui";
    ctx.fillStyle = tint("#9aabc4");
    ctx.fillText(`(${fmt(p.x)}, ${fmt(p.y)})`, s.x + 9, s.y + 9);
  }

  function drawSegment(o) {
    const a = getPoint(o.a), b = getPoint(o.b);
    if (!a || !b) return;

    const p = worldToScreen(a), q = worldToScreen(b);
    const dx = q.x - p.x, dy = q.y - p.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.001) return;

    ctx.strokeStyle = pal(o.type);
    ctx.lineWidth = selectedId === o.id ? 4 : 2.5;
    ctx.beginPath();

    if (o.type === "line") {
      const reach = Math.hypot(W, H) * 2;
      ctx.moveTo(p.x - dx / length * reach, p.y - dy / length * reach);
      ctx.lineTo(p.x + dx / length * reach, p.y + dy / length * reach);
    } else if (o.type === "ray") {
      const reach = Math.hypot(W, H) * 2;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + dx / length * reach, p.y + dy / length * reach);
    } else {
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();

    if (o.type === "vector") {
      // نوک پیکان در انتهای بردار
      const ux = dx / length, uy = dy / length, head = 12;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x - ux * head - uy * head * .5, q.y - uy * head + ux * head * .5);
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x - ux * head + uy * head * .5, q.y - uy * head - ux * head * .5);
      ctx.stroke();
      ctx.fillStyle = tint("#fecdd3");
      ctx.font = "12px system-ui";
      ctx.fillText(`بردار ${fmt(dist(a, b))}`, (p.x + q.x) / 2 + 6, (p.y + q.y) / 2 - 7);
    }

    if (o.type === "segment") {
      ctx.fillStyle = tint("#ddd6fe");
      ctx.font = "12px system-ui";
      ctx.fillText(`طول ${fmt(dist(a, b))}`,
        (p.x + q.x) / 2 + 6, (p.y + q.y) / 2 - 7);
    }
  }

  function drawPerpBisector(o) {
    const s = perpBisectorScreen(o);
    if (!s) return;
    const reach = Math.hypot(W, H) * 2;

    ctx.save();
    ctx.strokeStyle = pal("perpbis");
    ctx.lineWidth = selectedId === o.id ? 4 : 2.2;
    ctx.setLineDash([9, 6]);
    ctx.beginPath();
    ctx.moveTo(s.m.x - s.dir.x * reach, s.m.y - s.dir.y * reach);
    ctx.lineTo(s.m.x + s.dir.x * reach, s.m.y + s.dir.y * reach);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = pal("perpbis");
    ctx.font = "12px system-ui";
    ctx.fillText("عمودمنصف", s.m.x + 8, s.m.y - 8);
  }

  function drawBisector(o) {
    const s = bisectorScreen(o);
    if (!s) return;
    const reach = Math.hypot(W, H) * 2;

    ctx.save();
    ctx.strokeStyle = pal("bisector");
    ctx.lineWidth = selectedId === o.id ? 4 : 2.2;
    ctx.setLineDash([9, 6]);
    ctx.beginPath();
    ctx.moveTo(s.q.x, s.q.y);
    ctx.lineTo(s.q.x + s.dir.x * reach, s.q.y + s.dir.y * reach);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = pal("bisector");
    ctx.font = "12px system-ui";
    ctx.fillText("نیمساز", s.q.x + s.dir.x * 70 + 6, s.q.y + s.dir.y * 70 - 6);
  }

  function drawCircle(o) {
    const c = getPoint(o.center);
    if (!c) return;
    const p = worldToScreen(c);
    const radius = radiusOf(o);

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * scale, 0, Math.PI * 2);
    ctx.strokeStyle = pal("circle");
    ctx.lineWidth = selectedId === o.id ? 4 : 2.5;
    ctx.stroke();

    ctx.fillStyle = tint("#bae6fd");
    ctx.font = "12px system-ui";
    ctx.fillText(`r = ${fmt(radius)}`, p.x + radius * scale * .55, p.y - 8);
  }

  function drawPolygon(o) {
    const ps = o.points.map(getPoint);
    if (ps.length < 3 || ps.some(p => !p)) return;
    const ss = ps.map(worldToScreen);

    ctx.beginPath();
    ctx.moveTo(ss[0].x, ss[0].y);
    ss.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = "rgba(52,211,153,.12)";
    ctx.fill();
    ctx.strokeStyle = pal("polygon");
    ctx.lineWidth = selectedId === o.id ? 4 : 2.5;
    ctx.stroke();

    const { perimeter, area } = polygonStats(ps);
    const cx = ss.reduce((sum, p) => sum + p.x, 0) / ss.length;
    const cy = ss.reduce((sum, p) => sum + p.y, 0) / ss.length;

    ctx.fillStyle = tint("#a7f3d0");
    ctx.font = "12px system-ui";
    ctx.fillText(`محیط ${fmt(perimeter)}`, cx + 5, cy);
    ctx.fillText(`مساحت ${fmt(area)}`, cx + 5, cy + 15);
  }

  function drawStroke(o) {
    if (!o.pts || o.pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = pal("stroke");
    ctx.lineWidth = selectedId === o.id ? 5 : 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    o.pts.forEach((q, i) => {
      const s = worldToScreen(q);
      if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function drawMeasure(o) {
    const a = getPoint(o.a), b = getPoint(o.b);
    if (!a || !b) return;
    const p = worldToScreen(a), q = worldToScreen(b);
    ctx.save();
    ctx.strokeStyle = pal("measure");
    ctx.lineWidth = selectedId === o.id ? 3 : 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = tint("#fde047");
    ctx.font = "bold 12px system-ui";
    ctx.fillText(`${fmt(dist(a, b))} واحد`, (p.x + q.x) / 2 + 8, (p.y + q.y) / 2 - 8);
    ctx.restore();
  }

  function drawAngle(o) {
    const a = getPoint(o.a), v = getPoint(o.vertex), c = getPoint(o.c);
    const degrees = angleDegrees(o);
    if (!a || !v || !c || degrees === null) return;

    const p = worldToScreen(a), q = worldToScreen(v), r = worldToScreen(c);
    ctx.strokeStyle = pal("angle");
    ctx.lineWidth = selectedId === o.id ? 4 : 2.5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.lineTo(r.x, r.y);
    ctx.stroke();

    // Directions of both rays on screen, and the signed sweep between them
    // (always the smaller of the two possible angles).
    const a1 = Math.atan2(p.y - q.y, p.x - q.x);
    const a2 = Math.atan2(r.y - q.y, r.x - q.x);
    let sweep = a2 - a1;
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    while (sweep <= -Math.PI) sweep += 2 * Math.PI;

    ctx.lineWidth = 1.8;
    ctx.beginPath();

    if (Math.abs(degrees - 90) < 0.5) {
      // Right angle: small square marker.
      const s = 16;
      const e1 = { x: Math.cos(a1), y: Math.sin(a1) };
      const e2 = { x: Math.cos(a2), y: Math.sin(a2) };
      ctx.moveTo(q.x + e1.x * s, q.y + e1.y * s);
      ctx.lineTo(q.x + (e1.x + e2.x) * s, q.y + (e1.y + e2.y) * s);
      ctx.lineTo(q.x + e2.x * s, q.y + e2.y * s);
    } else {
      ctx.arc(q.x, q.y, 28, a1, a1 + sweep, sweep < 0);
    }
    ctx.stroke();

    const mid = a1 + sweep / 2;
    ctx.fillStyle = tint("#fde68a");
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${fmt(degrees)}°`, q.x + Math.cos(mid) * 48, q.y + Math.sin(mid) * 48);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  // پای عمود نقطهٔ P بر خط AB (در دستگاه جهانی)
  function footWorld(P, A, B) {
    const dx = B.x - A.x, dy = B.y - A.y, len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return null;
    const t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2;
    return { x: A.x + t * dx, y: A.y + t * dy };
  }

  // نقطه‌های نمونه‌برداری‌شدهٔ بیضی روی صفحه
  function ellipsePoints(e) {
    const n = { x: -e.u.y, y: e.u.x }, pts = [];
    for (let i = 0; i <= 160; i++) {
      const t = i / 160 * 2 * Math.PI;
      const ca = e.a * Math.cos(t), sb = e.b * Math.sin(t);
      pts.push(worldToScreen({
        x: e.M.x + ca * e.u.x + sb * n.x,
        y: e.M.y + ca * e.u.y + sb * n.y
      }));
    }
    return pts;
  }

  // نقطه‌های نمونه‌برداری‌شدهٔ سهمی روی صفحه: y = (x² + f²) / (2f) در دستگاه محلی
  function parabolaPoints(pb) {
    const f = pb.f, X = Math.sqrt(Math.max(LIMIT * LIMIT, 6 * LIMIT * Math.abs(f) - f * f)), N = 300, pts = [];
    for (let i = 0; i <= N; i++) {
      const x = -X + 2 * X * i / N;
      const y = (x * x + f * f) / (2 * f);
      pts.push(worldToScreen({
        x: pb.Fp.x + x * pb.u.x + y * pb.n.x,
        y: pb.Fp.y + x * pb.u.y + y * pb.n.y
      }));
    }
    return pts;
  }

  // برخورد موس با کمان یا قطاع (شعاع‌های قطاع هم حساب می‌شوند)
  function arcHit(x, y, s, tol) {
    const c = worldToScreen(s.O), R = s.r * scale;
    const d = Math.hypot(x - c.x, y - c.y);
    const TAU = 2 * Math.PI;
    const norm = t => ((t % TAU) + TAU) % TAU;
    const theta = Math.atan2(-(y - c.y), x - c.x);
    const inside = s.ccw ? norm(theta - s.alpha) <= s.sweep + 1e-9 : norm(s.alpha - theta) <= s.sweep + 1e-9;
    if (inside && Math.abs(d - R) < tol) return true;
    if (!s.sector) return false;
    // در قطاع، دو شعاع مرزی هم قابل انتخاب‌اند
    const end = s.ccw ? s.alpha + s.sweep : s.alpha - s.sweep;
    for (const t of [s.alpha, end]) {
      const e = { x: c.x + R * Math.cos(-t), y: c.y + R * Math.sin(-t) };
      if (distToSegment(x, y, c.x, c.y, e.x, e.y) < tol) return true;
    }
    return false;
  }

  function drawDirLine(o) {
    const s = dirlineScreen(o);
    if (!s) return;
    const reach = Math.hypot(W, H) * 2;
    ctx.save();
    ctx.strokeStyle = pal("line");
    ctx.lineWidth = selectedId === o.id ? 4 : 2.2;
    if (o.perp) ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(s.m.x - s.dir.x * reach, s.m.y - s.dir.y * reach);
    ctx.lineTo(s.m.x + s.dir.x * reach, s.m.y + s.dir.y * reach);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = pal("line");
    ctx.font = "12px system-ui";
    ctx.fillText(o.perp ? "عمود" : "موازی", s.m.x + 8, s.m.y - 8);
  }

  function drawPDist(o) {
    const P = getPoint(o.p), A = getPoint(o.a), B = getPoint(o.b);
    if (!P || !A || !B) return;
    const F = footWorld(P, A, B);
    if (!F) return;
    const s = worldToScreen(P), t = worldToScreen(F);
    const sa = worldToScreen(A), sb = worldToScreen(B);
    ctx.save();
    // خط مرجع کم‌رنگ
    const reach = Math.hypot(W, H) * 2;
    const dx = sb.x - sa.x, dy = sb.y - sa.y, len = Math.hypot(dx, dy) || 1;
    ctx.strokeStyle = "rgba(248,113,113,.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sa.x - dx / len * reach, sa.y - dy / len * reach);
    ctx.lineTo(sa.x + dx / len * reach, sa.y + dy / len * reach);
    ctx.stroke();
    // فاصلهٔ عمودی
    ctx.strokeStyle = pal("pdist");
    ctx.lineWidth = selectedId === o.id ? 3.5 : 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = tint("#fecaca");
    ctx.font = "bold 12px system-ui";
    ctx.fillText(`d = ${fmt(dist(P, F))}`, (s.x + t.x) / 2 + 8, (s.y + t.y) / 2 - 6);
    ctx.restore();
  }

  function drawArc(o) {
    const s = arcSpec(o);
    if (!s) return;
    const c = worldToScreen(s.O), R = s.r * scale;
    const a0 = -s.alpha, a1 = -s.alpha + (s.ccw ? -s.sweep : s.sweep);
    ctx.save();
    ctx.strokeStyle = pal("arc");
    ctx.lineWidth = selectedId === o.id ? 4 : 2.5;
    ctx.beginPath();
    if (o.sector) ctx.moveTo(c.x, c.y);
    ctx.arc(c.x, c.y, R, a0, a1, s.ccw);
    if (o.sector) {
      ctx.closePath();
      ctx.fillStyle = "rgba(125,211,252,.15)";
      ctx.fill();
    }
    ctx.stroke();
    const mid = s.alpha + (s.ccw ? s.sweep / 2 : -s.sweep / 2);
    const label = o.sector ? "قطاع" : (o.b == null ? "نیم‌دایره" : "کمان");
    ctx.fillStyle = tint("#bae6fd");
    ctx.font = "12px system-ui";
    ctx.fillText(`${label} r = ${fmt(s.r)}`, c.x + Math.cos(mid) * (R + 10), c.y - Math.sin(mid) * (R + 10));
    ctx.restore();
  }

  function drawEllipse(o) {
    const e = ellipseSpec(o);
    if (!e) return;
    const s = worldToScreen(e.M);
    ctx.save();
    ctx.strokeStyle = pal("ellipse");
    ctx.lineWidth = selectedId === o.id ? 4 : 2.5;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, e.a * scale, e.b * scale, Math.atan2(-e.u.y, e.u.x), 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = tint("#c7d2fe");
    ctx.font = "12px system-ui";
    ctx.fillText(`بیضی a = ${fmt(e.a)} · b = ${fmt(e.b)}`, s.x + 8, s.y - e.b * scale - 8);
    ctx.restore();
  }

  function drawParabola(o) {
    const pb = parabolaSpec(o);
    if (!pb) return;
    const reach = Math.hypot(W, H) * 2;
    const sa = worldToScreen(pb.A);
    ctx.save();
    ctx.strokeStyle = "rgba(249,168,212,.45)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(sa.x - pb.u.x * reach, sa.y + pb.u.y * reach);
    ctx.lineTo(sa.x + pb.u.x * reach, sa.y - pb.u.y * reach);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = pal("parabola");
    ctx.lineWidth = selectedId === o.id ? 4 : 2.5;
    ctx.beginPath();
    parabolaPoints(pb).forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
    ctx.fillStyle = tint("#fbcfe8");
    ctx.font = "12px system-ui";
    ctx.fillText("سهمی", sa.x + 8, sa.y + 16);
    ctx.restore();
  }

  function draw() {
    if (!canvas.width || !canvas.height) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    updateDependents();
    drawGrid();

    for (const o of objects) {
      if (o.type === "segment" || o.type === "line" || o.type === "ray" || o.type === "vector") drawSegment(o);
      if (o.type === "dirline") drawDirLine(o);
      if (o.type === "pdist") drawPDist(o);
      if (o.type === "arc") drawArc(o);
      if (o.type === "ellipse") drawEllipse(o);
      if (o.type === "parabola") drawParabola(o);
      if (o.type === "circle") drawCircle(o);
      if (o.type === "polygon") drawPolygon(o);
      if (o.type === "angle") drawAngle(o);
      if (o.type === "perpbis") drawPerpBisector(o);
      if (o.type === "bisector") drawBisector(o);
      if (o.type === "stroke") drawStroke(o);
      if (o.type === "measure") drawMeasure(o);
    }
    for (const p of objects.filter(o => o.type === "point")) drawPoint(p);

    if (strokeDraw && strokeDraw.pts.length > 1) drawStroke({ id: -1, pts: strokeDraw.pts });

    if (polygonIds.length) {
      const ps = polygonIds.map(getPoint).filter(Boolean).map(worldToScreen);
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = tint("#fbbf24");
      ctx.beginPath();
      ps.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.stroke();
      ctx.restore();
    }

    zoomLabel.textContent = Math.round(scale / 40 * 100) + "%";
  }

  /* ---------- properties panel ---------- */

  function updateProperties() {
    const o = objects.find(o => o.id === selectedId);
    if (!o) {
      props.textContent = "هنوز شکلی انتخاب نشده است.";
      return;
    }

    if (o.type === "point") {
      const kind = o.dep ? ` · ${depNames[o.dep.kind] || "وابسته"}` : "";
      props.innerHTML = `<b>نقطه ${o.label}</b>${kind}<br>x: ${fmt(o.x)}<br>y: ${fmt(o.y)}`;
    } else if (o.type === "segment") {
      const a = getPoint(o.a), b = getPoint(o.b);
      props.textContent = a && b
        ? `پاره‌خط · طول: ${fmt(dist(a, b))} واحد`
        : "پاره‌خط";
    } else if (o.type === "circle") {
      const r = radiusOf(o);
      props.textContent =
        `${o.name || "دایره"} · شعاع: ${fmt(r)} · محیط: ${fmt(2 * Math.PI * r)} · مساحت: ${fmt(Math.PI * r ** 2)}`;
    } else if (o.type === "polygon") {
      const ps = o.points.map(getPoint).filter(Boolean);
      const { perimeter, area } = polygonStats(ps);
      props.textContent = `چندضلعی · تعداد رأس: ${ps.length} · محیط: ${fmt(perimeter)} · مساحت: ${fmt(area)}`;
    } else if (o.type === "line") {
      props.textContent = o.name || "خط بی‌نهایت از دو نقطه";
    } else if (o.type === "perpbis") {
      const a = getPoint(o.a), b = getPoint(o.b);
      props.textContent = a && b
        ? `عمودمنصف پاره‌خط ${a.label}${b.label} · از وسط آن می‌گذرد و بر آن عمود است`
        : "عمودمنصف";
    } else if (o.type === "bisector") {
      const a = getPoint(o.a), v = getPoint(o.vertex), c = getPoint(o.c);
      const full = angleDegrees(o);
      props.textContent = a && v && c && full !== null
        ? `نیمساز زاویهٔ ${a.label}${v.label}${c.label} · هر نیمه ${fmt(full / 2)} درجه`
        : "نیمساز";
    } else if (o.type === "stroke") {
      props.textContent = `قلم آزاد · ${o.pts.length} نقطه`;
    } else if (o.type === "measure") {
      const a = getPoint(o.a), b = getPoint(o.b);
      props.textContent = a && b
        ? `فاصلهٔ ${a.label} تا ${b.label} · ${fmt(dist(a, b))} واحد`
        : "اندازه‌گیری فاصله";
    } else if (o.type === "dirline") {
      const a = getPoint(o.a), b = getPoint(o.b), p = getPoint(o.p);
      props.textContent = a && b && p
        ? `${o.perp ? "خط عمود" : "خط موازی"} از ${p.label} · جهت ${a.label}${b.label}`
        : "خط";
    } else if (o.type === "ray") {
      const a = getPoint(o.a), b = getPoint(o.b);
      props.textContent = a && b ? `نیم‌خط از ${a.label} به سوی ${b.label}` : "نیم‌خط";
    } else if (o.type === "vector") {
      const a = getPoint(o.a), b = getPoint(o.b);
      props.textContent = a && b
        ? `بردار ${a.label}${b.label} · طول: ${fmt(dist(a, b))} واحد · مؤلفه‌ها: (${fmt(b.x - a.x)}, ${fmt(b.y - a.y)})`
        : "بردار";
    } else if (o.type === "pdist") {
      const P = getPoint(o.p), A = getPoint(o.a), B = getPoint(o.b);
      const F = P && A && B ? footWorld(P, A, B) : null;
      props.textContent = F
        ? `فاصلهٔ ${P.label} از خط ${A.label}${B.label} · ${fmt(dist(P, F))} واحد`
        : "فاصله از خط";
    } else if (o.type === "arc") {
      const s = arcSpec(o);
      if (!s) {
        props.textContent = "کمان";
      } else {
        const deg = fmt(s.sweep * 180 / Math.PI);
        if (o.sector) {
          props.textContent = `قطاع · شعاع: ${fmt(s.r)} · زاویه: ${deg}° · مساحت: ${fmt(s.r * s.r * s.sweep / 2)}`;
        } else if (o.b == null) {
          props.textContent = `نیم‌دایره · شعاع: ${fmt(s.r)} · محیط: ${fmt(Math.PI * s.r + 2 * s.r)} · مساحت: ${fmt(Math.PI * s.r * s.r / 2)}`;
        } else {
          props.textContent = `کمان · شعاع: ${fmt(s.r)} · زاویه: ${deg}° · طول کمان: ${fmt(s.r * s.sweep)}`;
        }
      }
    } else if (o.type === "ellipse") {
      const e = ellipseSpec(o);
      props.textContent = e
        ? `بیضی · نیم‌محور بزرگ a: ${fmt(e.a)} · نیم‌محور کوچک b: ${fmt(e.b)} · مساحت: ${fmt(Math.PI * e.a * e.b)}`
        : "بیضی";
    } else if (o.type === "parabola") {
      const pb = parabolaSpec(o);
      const F = getPoint(o.f), A = getPoint(o.a), B = getPoint(o.b);
      props.textContent = pb && F && A && B
        ? `سهمی · کانون ${F.label} · خط هادی ${A.label}${B.label} · فاصلهٔ کانون تا هادی: ${fmt(Math.abs(pb.f))}`
        : "سهمی";
    } else if (o.type === "angle") {
      const degrees = angleDegrees(o);
      props.textContent = degrees === null
        ? "زاویه"
        : `زاویه · ${fmt(degrees)} درجه`;
    }
  }

  /* ---------- tools ---------- */

  function setTool(next) {
    tool = next;
    pending = [];
    polygonIds = [];
    pickedId = null;

    document.querySelectorAll("[data-tool]").forEach(button =>
      button.classList.toggle("active", button.dataset.tool === tool));

    const instructions = {
      select: "روی نقطه یا هر شکل کلیک کن تا انتخاب شود. نقطه را بکش تا جابه‌جا شود، فضای خالی را بکش تا صفحه حرکت کند، و برای پاک‌کردن دکمهٔ حذف یا Delete را بزن. بوم محدود است و همه‌چیز داخل کادر آبی می‌ماند.",
      point: "روی بوم کلیک کن تا نقطه بسازی.",
      segment: "برای پاره‌خط دو نقطه را انتخاب کن.",
      line: "برای خط، دو نقطه را انتخاب کن.",
      circle: "مرکز دایره و سپس نقطه‌ای روی محیط را انتخاب کن.",
      polygon: "رأس‌ها را انتخاب کن؛ برای پایان Enter یا دکمهٔ «پایان چندضلعی» را بزن.",
      angle: "سه نقطه را انتخاب کن: ضلع اول، رأس زاویه، ضلع دوم.",
      midpoint: "دو نقطه را انتخاب کن تا نقطهٔ وسطشان ساخته شود. با جابه‌جایی نقاط، وسط هم جابه‌جا می‌شود.",
      perp: "دو سر پاره‌خط را انتخاب کن تا عمودمنصفش رسم شود.",
      bisector: "سه نقطه را انتخاب کن: ضلع اول، رأس زاویه، ضلع دوم تا نیمساز رسم شود.",
      stroke: "با موس یا انگشت روی بوم بکش؛ با رها کردن، خط دست‌آزاد ثبت می‌شود.",
      measure: "دو نقطه را انتخاب کن تا فاصلهٔ آن‌ها روی بوم نوشته شود.",
      intersect: "دو نقطه برای خط اول و دو نقطه برای خط دوم انتخاب کن؛ محل تقاطع ساخته می‌شود.",
      foot: "اول نقطهٔ P، سپس دو سر خط A و B را انتخاب کن تا پای عمود از P بر AB ساخته شود.",
      parallel: "اول نقطهٔ عبور خط را بزن، سپس دو نقطهٔ A و B را برای جهت انتخاب کن تا خط موازی AB از آن نقطه رسم شود.",
      perpline: "اول نقطهٔ عبور خط را بزن، سپس دو نقطهٔ A و B را انتخاب کن تا خط عمود بر AB از آن نقطه رسم شود.",
      ray: "دو نقطه را انتخاب کن: نقطهٔ شروع و نقطهٔ دوم. نیم‌خط از نقطهٔ اول به سوی نقطهٔ دوم ادامه پیدا می‌کند.",
      vector: "دو نقطه را انتخاب کن: ابتدا و انتهای بردار.",
      pdist: "سه نقطه را انتخاب کن: اول P، سپس دو نقطهٔ A و B روی خط. فاصلهٔ عمودی P تا خط AB نشان داده می‌شود.",
      circle3: "سه نقطهٔ روی محیط دایره را انتخاب کن تا دایرهٔ گذرنده از آن‌ها ساخته شود.",
      circleRad: "مرکز دایره را کلیک کن. شعاع از کادر «عدد ورودی» خوانده می‌شود.",
      compass: "دو نقطهٔ A و B فاصلهٔ پرگار را تعیین می‌کنند؛ سپس مرکز C را بزن تا دایرهٔ به شعاع AB روی C رسم شود.",
      tangent: "اول نقطهٔ P بیرون دایره را انتخاب کن، سپس روی خود دایره کلیک کن تا دو مماس از P رسم شوند.",
      arc3: "سه نقطه را انتخاب کن: ابتدای کمان، نقطه‌ای که کمان از آن می‌گذرد، و انتهای کمان.",
      semicircle: "دو سر قطر را انتخاب کن. نیم‌دایره در سمت چپ جهت حرکت از نقطهٔ اول به نقطهٔ دوم رسم می‌شود.",
      sector: "اول مرکز، سپس نقطهٔ شروع و نقطهٔ پایان را انتخاب کن. قطاع در خلاف جهت عقربه‌های ساعت از شروع تا پایان ساخته می‌شود.",
      regular: "دو رأس اول ضلع (A و B) را انتخاب کن. تعداد ضلع‌ها از کادر «عدد ورودی» خوانده می‌شود (۳ تا ۲۴).",
      angleGiven: "اول نقطهٔ روی ضلع اول، سپس رأس زاویه را انتخاب کن. اندازهٔ زاویه (بین ۰ تا ۱۸۰ درجه) از کادر عدد خوانده می‌شود.",
      translate: "اول شکل یا نقطه را بزن، سپس دو نقطه برای بردار انتقال انتخاب کن تا تصویر شکل ساخته شود.",
      rotate: "اول شکل یا نقطه را بزن، سپس مرکز چرخش را انتخاب کن. زاویه از کادر عدد خوانده می‌شود.",
      reflectline: "اول شکل یا نقطه را بزن، سپس دو نقطه برای خط تقارن انتخاب کن.",
      reflectpt: "اول شکل یا نقطه را بزن، سپس نقطهٔ تقارن را انتخاب کن.",
      dilate: "اول شکل یا نقطه را بزن، سپس مرکز تجانس را انتخاب کن. ضریب از کادر عدد خوانده می‌شود؛ مثلاً ۲ یعنی دو برابر.",
      ellipse: "سه نقطه را انتخاب کن: دو کانون F1 و F2 و سپس نقطه‌ای روی بیضی.",
      parabola: "سه نقطه را انتخاب کن: کانون F، و دو نقطهٔ A و B که خط هادی از آن‌ها می‌گذرد."
    };

    help.textContent = instructions[tool] || "";
    const paramInput = $("paramIn"), paramLabel = $("paramLabel");
    if (paramLabel) paramLabel.textContent = paramLabels[tool] || "عدد ورودی";
    if (paramInput && paramDefaults[tool]) paramInput.value = paramDefaults[tool];
    const buttonLabel = document.querySelector(`[data-tool="${tool}"] span`)?.textContent;
    say("ابزار انتخاب‌شده: " + (toolNames[tool] || buttonLabel || tool));
    draw();
  }

  function dependsOnPoint(o, id) {
    switch (o.type) {
      case "segment":
      case "line":
      case "ray":
      case "vector":
      case "measure":
      case "perpbis": return o.a === id || o.b === id;
      case "dirline":
      case "pdist": return o.p === id || o.a === id || o.b === id;
      case "arc": return o.center === id || o.a === id || o.c === id || o.b === id;
      case "ellipse": return o.f1 === id || o.f2 === id || o.p === id;
      case "parabola": return o.f === id || o.a === id || o.b === id;
      case "circle": return o.center === id || o.through === id || (o.inradius ? o.inradius.includes(id) : false);
      case "point": return !!o.dep && o.dep.of.includes(id);
      case "polygon": return o.points.includes(id);
      case "angle":
      case "bisector": return o.a === id || o.vertex === id || o.c === id;
      default: return false;
    }
  }

  // Everything that (directly or through other shapes) is built on a point.
  function collectDependents(id) {
    const dead = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const o of objects) {
        if (dead.has(o.id)) continue;
        for (const d of dead) {
          if (dependsOnPoint(o, d)) {
            dead.add(o.id);
            changed = true;
            break;
          }
        }
      }
    }
    return dead;
  }

  // Deleting a point also removes every shape built on it.
  function deleteSelected() {
    const target = objects.find(o => o.id === selectedId);
    if (!target) {
      say("اول یک شکل یا نقطه را انتخاب کن.");
      return;
    }

    let removed = 0;
    transact(() => {
      const count = objects.length;
      const dead = target.type === "point" ? collectDependents(target.id) : new Set([target.id]);
      objects = objects.filter(o => !dead.has(o.id));
      removed = count - objects.length;
      selectedId = null;
      pending = [];
      polygonIds = [];
    });

    if (target.type === "point") {
      say(removed > 1 ? `نقطه و ${removed - 1} شکل وابسته به آن حذف شد.` : "نقطه حذف شد.");
    } else {
      say("شکل حذف شد.");
    }
  }

  // Free points and freehand points of a shape: what moves when the shape is dragged or transformed.
  function movableOf(o) {
    let ids = [];
    switch (o.type) {
      case "segment": case "line": case "measure": case "perpbis": case "ray": case "vector": ids = [o.a, o.b]; break;
      case "circle": ids = [o.center, o.through]; break;
      case "angle": case "bisector": ids = [o.a, o.vertex, o.c]; break;
      case "polygon": ids = o.points; break;
      case "dirline": case "pdist": ids = [o.p, o.a, o.b]; break;
      case "arc": ids = [o.center, o.a, o.c, o.b]; break;
      case "ellipse": ids = [o.f1, o.f2, o.p]; break;
      case "parabola": ids = [o.f, o.a, o.b]; break;
    }
    const points = [...new Set(ids)].map(getPoint).filter(p => p && !p.dep);
    return { points, pts: o.type === "stroke" ? o.pts : [] };
  }

  // Applies fn to every movable point of the selected shape, around its centre. One undo step.
  function transformSelected(fn, message) {
    const o = objects.find(x => x.id === selectedId);
    if (!o) {
      say("اول یک شکل را انتخاب کن.");
      return;
    }
    const m = movableOf(o);
    const targets = [...m.points, ...m.pts];
    if (!targets.length) {
      say("این شکل قابل تبدیل نیست.");
      return;
    }
    const cx = targets.reduce((sum, t) => sum + t.x, 0) / targets.length;
    const cy = targets.reduce((sum, t) => sum + t.y, 0) / targets.length;
    const next = targets.map(t => fn(t, cx, cy));
    if (!next.every(inBoard)) {
      say("این تبدیل شکل را از بوم بیرون می‌برد.");
      return;
    }
    transact(() => targets.forEach((t, i) => { t.x = next[i].x; t.y = next[i].y; }));
    say(message);
  }

  function rotateSelected(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const deg = Math.round(angle * 180 / Math.PI);
    transformSelected((t, cx, cy) => {
      const dx = t.x - cx, dy = t.y - cy;
      return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
    }, `شکل ${deg}° چرخید.`);
  }

  function addTriangleCenters() {
    const selected = objects.find(o => o.id === selectedId);
    const tri = selected && selected.type === "polygon" && selected.points.length === 3
      ? selected
      : [...objects].reverse().find(o => o.type === "polygon" && o.points.length === 3);

    if (!tri) {
      say("اول یک مثلث بساز: ابزار چندضلعی با ۳ رأس، یا دستور triangle.");
      return;
    }

    const pts = tri.points.map(getPoint);
    if (pts.some(p => !p) || !circumcenter(pts[0], pts[1], pts[2])) {
      say("این مثلث تبهگون است (سه رأس روی یک خط).");
      return;
    }

    const ids = [...tri.points];
    transact(() => {
      addDerivedPoint("centroid", "G", ids);
      const O = addDerivedPoint("circumcenter", "O", ids);
      const I = addDerivedPoint("incenter", "I", ids);
      const H = addDerivedPoint("orthocenter", "H", ids);
      addObject({ type: "circle", name: "دایرهٔ محیطی", center: O.id, through: ids[0], radius: 0 });
      addObject({ type: "circle", name: "دایرهٔ محاطی", center: I.id, inradius: ids, radius: 0 });
      addObject({ type: "line", name: "خط اویلر (از O و H و G می‌گذرد)", a: O.id, b: H.id });
    });
    say("مراکز مثلث، دایرهٔ محیطی و محاطی و خط اویلر ساخته شد.");
  }

  function finishPolygon() {
    if (polygonIds.length < 3) {
      say("برای چندضلعی حداقل سه رأس لازم است.");
      return;
    }
    transact(() => addObject({ type: "polygon", points: [...polygonIds] }));
    polygonIds = [];
    draw();
    say("چندضلعی ساخته شد.");
  }

  // Called inside transact(), so every click is one undo step.
  function handleClick(x, y) {
    const p = snapPoint(screenToWorld(x, y));
    const hit = hitPoint(x, y);
    if (handleNewTool(x, y, p, hit)) return;

    if (tool === "point") {
      createPoint(p);
      say("نقطه ساخته شد.");
      return;
    }

    if (tool === "segment" || tool === "line") {
      pending.push(hit || createPoint(p));
      if (pending.length === 2) createLineBetween(pending[0], pending[1], tool);
      else say("حالا نقطهٔ دوم را انتخاب کن.");
      return;
    }

    if (tool === "circle") {
      pending.push(hit || createPoint(p));
      if (pending.length === 1) {
        say("حالا شعاع را با کلیک دوم تعیین کن.");
      } else {
        const center = pending[0], through = pending[1];
        const radius = dist(center, through);
        if (radius > 0) {
          addObject({ type: "circle", center: center.id, through: through.id, radius });
          say("دایره ساخته شد.");
        } else {
          say("نقطهٔ دوم باید با مرکز فرق داشته باشد.");
        }
        pending = [];
      }
      return;
    }

    if (tool === "polygon") {
      const point = hit || createPoint(p);
      if (!polygonIds.includes(point.id)) polygonIds.push(point.id);
      say(`رأس ${polygonIds.length} اضافه شد. برای پایان، Enter را بزن.`);
      return;
    }

    if (tool === "midpoint") {
      pending.push(hit || createPoint(p));
      if (pending.length === 2) {
        const [a, b] = pending;
        pending = [];
        if (a.id === b.id) {
          say("دو نقطهٔ متفاوت انتخاب کن.");
        } else {
          addDerivedPoint("midpoint", "M", [a.id, b.id]);
          say("نقطهٔ وسط ساخته شد.");
        }
      } else {
        say("حالا نقطهٔ دوم را انتخاب کن.");
      }
      return;
    }

    if (tool === "perp") {
      pending.push(hit || createPoint(p));
      if (pending.length === 2) {
        const [a, b] = pending;
        pending = [];
        if (a.id === b.id) {
          say("دو نقطهٔ متفاوت انتخاب کن.");
        } else {
          addObject({ type: "perpbis", a: a.id, b: b.id });
          say("عمودمنصف رسم شد.");
        }
      } else {
        say("حالا نقطهٔ دوم را انتخاب کن.");
      }
      return;
    }

    if (tool === "bisector") {
      pending.push(hit || createPoint(p));
      if (pending.length === 3) {
        const [a, v, c] = pending;
        pending = [];
        addObject({ type: "bisector", a: a.id, vertex: v.id, c: c.id });
        say("نیمساز رسم شد.");
      } else {
        say(`نقطهٔ ${pending.length} از ۳ را انتخاب کن.`);
      }
      return;
    }

    if (tool === "measure") {
      pending.push(hit || createPoint(p));
      if (pending.length === 2) {
        const [a, b] = pending;
        pending = [];
        if (a.id === b.id) say("دو نقطهٔ متفاوت انتخاب کن.");
        else {
          addObject({ type: "measure", a: a.id, b: b.id });
          say(`فاصلهٔ ${a.label} تا ${b.label} برابر ${fmt(dist(a, b))} واحد است.`);
        }
      } else {
        say("حالا نقطهٔ دوم را انتخاب کن.");
      }
      return;
    }

    if (tool === "intersect") {
      pending.push(hit || createPoint(p));
      if (pending.length < 4) {
        say(pending.length === 2 ? "حالا دو نقطهٔ خط دوم را انتخاب کن." : `نقطهٔ ${pending.length} از ۴ را انتخاب کن.`);
        return;
      }
      const [a, b, c, d] = pending;
      pending = [];
      if (new Set([a.id, b.id, c.id, d.id]).size < 4) {
        say("چهار نقطهٔ متفاوت انتخاب کن (دو نقطه برای هر خط).");
        return;
      }
      const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
      if (Math.abs(den) < 1e-9) {
        say("این دو خط موازی‌اند و تقاطعی ندارند.");
        return;
      }
      addObject({ type: "line", a: a.id, b: b.id });
      addObject({ type: "line", a: c.id, b: d.id });
      const X = addDerivedPoint("intersect", "X", [a.id, b.id, c.id, d.id]);
      say(`نقطهٔ تقاطع ${X.label} ساخته شد.`);
      return;
    }

    if (tool === "foot") {
      pending.push(hit || createPoint(p));
      if (pending.length < 3) {
        say(pending.length === 1 ? "حالا یکی از دو سر خط (A) را انتخاب کن." : "حالا سر دوم خط (B) را انتخاب کن.");
        return;
      }
      const [q, A, B] = pending;
      pending = [];
      if (A.id === B.id) {
        say("دو سر خط باید متفاوت باشند.");
        return;
      }
      const F = addDerivedPoint("foot", "H", [q.id, A.id, B.id]);
      addObject({ type: "line", a: A.id, b: B.id });
      addObject({ type: "segment", a: q.id, b: F.id });
      say(`پای عمود ${F.label} ساخته شد.`);
      return;
    }

    if (tool === "angle") {
      pending.push(hit || createPoint(p));
      if (pending.length === 3) {
        addObject({ type: "angle", a: pending[0].id, vertex: pending[1].id, c: pending[2].id });
        pending = [];
        say("زاویه ساخته شد.");
      } else {
        say(`نقطهٔ ${pending.length} از ۳ را انتخاب کن.`);
      }
    }
  }

  /* ---------- ابزارهای جدید (الگوی GeoGebra) ---------- */

  const transformTools = ["translate", "rotate", "reflectline", "reflectpt", "dilate"];

  // ساخت تصویر یک شکل (یا نقطه) با تبدیل داده‌شده؛ نقطه‌های تصویر وابسته به اصل‌اند
  // و با جابه‌جایی اصل، خودشان هم جابه‌جا می‌شوند. داخل transact صدا زده می‌شود.
  function makeImage(kind, extraIds, par) {
    const obj = objects.find(o => o.id === pickedId);
    if (!obj) return;
    const copyable = obj.type === "point" || (COPYABLE.includes(obj.type) && !obj.inradius);
    if (!copyable) {
      say("این نوع شکل را نمی‌توان تبدیل کرد.");
      pickedId = null;
      return;
    }
    const srcIds = obj.type === "point" ? [obj.id] : refIds(obj);
    const extra = extraIds.map(getPoint);
    for (const id of srcIds) {
      const q = transformCoords({ kind, par }, [getPoint(id), ...extra]);
      if (!q || !inBoard(q)) {
        say("این تبدیل شکل را از بوم بیرون می‌برد.");
        return;
      }
    }

    const map = new Map();
    for (const id of srcIds) {
      const src = getPoint(id);
      const img = addDerivedPoint(kind, src.label + "′", [id, ...extraIds], { par });
      map.set(id, img.id);
    }
    if (obj.type !== "point") {
      const data = copyShape(obj, id => map.get(id));
      if (data) addObject(data);
    }
    pickedId = null;
    const names = { translate: "انتقال یافت", rotate: "چرخید", reflectline: "نسبت به خط قرینه شد",
      reflectpt: "نسبت به نقطه قرینه شد", dilate: "تجانس یافت" };
    say(`تصویر ساخته شد: شکل ${names[kind] || "تبدیل شد"}.`);
  }

  // کلیک‌های ابزارهای تبدیل: اول شکل، سپس نقطه‌ها یا عدد ورودی
  function transformClick(x, y, p, hit) {
    if (!pickedId) {
      const shape = hit || hitShape(x, y);
      if (!shape) {
        say("اول روی شکل یا نقطه‌ای کلیک کن که می‌خواهی تبدیل شود.");
        return;
      }
      pickedId = shape.id;
      pending = [];
      const first = {
        translate: "حالا دو نقطه برای بردار انتقال انتخاب کن.",
        rotate: "حالا مرکز چرخش را انتخاب کن.",
        reflectline: "حالا دو نقطهٔ خط تقارن را انتخاب کن.",
        reflectpt: "حالا نقطهٔ تقارن را انتخاب کن.",
        dilate: "حالا مرکز تجانس را انتخاب کن."
      };
      say(first[tool]);
      return;
    }

    if (!objects.find(o => o.id === pickedId)) {
      pickedId = null;
      pending = [];
      say("شکل انتخاب‌شده دیگر وجود ندارد؛ دوباره انتخابش کن.");
      return;
    }

    let par = 0;
    if (tool === "rotate" || tool === "dilate") {
      par = readParam();
      if (par === null || (tool === "dilate" && par === 0)) {
        say(tool === "rotate" ? "زاویهٔ چرخش را در کادر عدد وارد کن." : "ضریب تجانس باید عددی غیرصفر باشد.");
        return;
      }
    }

    const needed = tool === "translate" || tool === "reflectline" ? 2 : 1;
    pending.push(hit || createPoint(p));
    if (pending.length < needed) {
      say(tool === "translate" ? "حالا نقطهٔ دوم بردار را انتخاب کن." : "حالا نقطهٔ دوم خط تقارن را انتخاب کن.");
      return;
    }
    const pts = pending;
    pending = [];

    if (tool === "translate" || tool === "reflectline") {
      if (pts[0].id === pts[1].id) {
        say("دو نقطهٔ متفاوت انتخاب کن.");
        return;
      }
      makeImage(tool, pts.map(q => q.id), 0);
    } else if (tool === "rotate") {
      makeImage("rotate", [pts[0].id], par);
    } else if (tool === "reflectpt") {
      makeImage("reflectpt", [pts[0].id], 0);
    } else {
      makeImage("dilate", [pts[0].id], par);
    }
  }

  // ابزارهای جدید؛ اگر ابزار جاری یکی از آن‌ها بود true برمی‌گرداند
  function handleNewTool(x, y, p, hit) {
    if (transformTools.includes(tool)) {
      transformClick(x, y, p, hit);
      return true;
    }

    switch (tool) {
      case "parallel":
      case "perpline": {
        pending.push(hit || createPoint(p));
        if (pending.length < 3) {
          say(pending.length === 1 ? "حالا دو نقطهٔ A و B را برای جهت خط انتخاب کن." : "حالا نقطهٔ دوم جهت (B) را انتخاب کن.");
          return true;
        }
        const [P, A, B] = pending;
        pending = [];
        if (A.id === B.id) {
          say("دو نقطهٔ A و B باید متفاوت باشند.");
          return true;
        }
        addObject({ type: "dirline", p: P.id, a: A.id, b: B.id, perp: tool === "perpline" });
        say(tool === "perpline" ? "خط عمود رسم شد." : "خط موازی رسم شد.");
        return true;
      }

      case "ray":
      case "vector": {
        pending.push(hit || createPoint(p));
        if (pending.length < 2) {
          say("حالا نقطهٔ دوم را انتخاب کن.");
          return true;
        }
        const [a, b] = pending;
        pending = [];
        if (a.id === b.id) {
          say("دو نقطهٔ متفاوت انتخاب کن.");
          return true;
        }
        addObject({ type: tool, a: a.id, b: b.id });
        say(tool === "ray" ? "نیم‌خط رسم شد." : "بردار رسم شد.");
        return true;
      }

      case "pdist": {
        pending.push(hit || createPoint(p));
        if (pending.length < 3) {
          say(pending.length === 1 ? "حالا دو نقطهٔ خط را انتخاب کن." : "حالا نقطهٔ دوم خط را انتخاب کن.");
          return true;
        }
        const [P, A, B] = pending;
        pending = [];
        if (A.id === B.id) {
          say("دو نقطهٔ خط باید متفاوت باشند.");
          return true;
        }
        addObject({ type: "pdist", p: P.id, a: A.id, b: B.id });
        say(`فاصلهٔ ${P.label} از خط ${A.label}${B.label} نشان داده شد.`);
        return true;
      }

      case "circle3":
      case "arc3": {
        pending.push(hit || createPoint(p));
        if (pending.length < 3) {
          say(`نقطهٔ ${pending.length + 1} از ۳ را انتخاب کن.`);
          return true;
        }
        const [A, B, C] = pending;
        pending = [];
        const center = circumcenter(A, B, C);
        if (!center) {
          say("این سه نقطه روی یک خط‌اند؛ دایره یا کمانی از آن‌ها ساخته نمی‌شود.");
          return true;
        }
        if (!inBoard(center)) {
          say("مرکز این دایره بیرون از بوم است.");
          return true;
        }
        const O = addDerivedPoint("circumcenter", "O", [A.id, B.id, C.id]);
        if (tool === "circle3") {
          addObject({ type: "circle", name: "دایرهٔ گذرنده از سه نقطه", center: O.id, through: A.id, radius: 0 });
          say("دایره از سه نقطه ساخته شد.");
        } else {
          addObject({ type: "arc", center: O.id, a: A.id, b: B.id, c: C.id, sector: false });
          say("کمان از سه نقطه ساخته شد.");
        }
        return true;
      }

      case "circleRad": {
        const r = readParam();
        if (r === null || r <= 0 || r > LIMIT) {
          say(`شعاع باید عددی مثبت و کوچک‌تر از ${LIMIT} باشد.`);
          return true;
        }
        const base = hit || p;
        if (!inBoard({ x: base.x + r, y: base.y })) {
          say("این دایره بیرون از بوم می‌افتد؛ مرکز را داخل بوم یا شعاع را کوچک‌تر کن.");
          return true;
        }
        const c = hit || createPoint(p);
        const edge = createPoint({ x: c.x + r, y: c.y });
        addObject({ type: "circle", center: c.id, through: edge.id, radius: r });
        say(`دایره با شعاع ${fmt(r)} ساخته شد.`);
        return true;
      }

      case "compass": {
        pending.push(hit || createPoint(p));
        if (pending.length < 3) {
          say(pending.length === 1 ? "حالا نقطهٔ دوم فاصله را انتخاب کن." : "حالا مرکز دایره را انتخاب کن.");
          return true;
        }
        const [A, B, C] = pending;
        pending = [];
        if (A.id === B.id) {
          say("دو نقطهٔ فاصله باید متفاوت باشند.");
          return true;
        }
        if (!inBoard({ x: C.x + B.x - A.x, y: C.y + B.y - A.y })) {
          say("این دایره بیرون از بوم می‌افتد؛ مرکز یا فاصله را تغییر بده.");
          return true;
        }
        const Q = addDerivedPoint("translate", "Q", [C.id, A.id, B.id]);
        addObject({ type: "circle", center: C.id, through: Q.id, radius: dist(A, B) });
        say("پرگار: دایره‌ای به شعاع فاصلهٔ AB ساخته شد.");
        return true;
      }

      case "tangent": {
        if (!pending.length) {
          pending.push(hit || createPoint(p));
          say("حالا روی خود دایره کلیک کن.");
          return true;
        }
        const P = pending[0];
        const shape = hitShape(x, y);
        if (!shape || shape.type !== "circle") {
          say("روی یک دایره کلیک کن.");
          return true;
        }
        pending = [];
        if (shape.inradius || shape.through == null) {
          say("این دایره برای رسم مماس مناسب نیست.");
          return true;
        }
        const O = getPoint(shape.center), A = getPoint(shape.through);
        if (dist(P, O) <= dist(O, A) + 1e-9) {
          say("نقطهٔ P باید بیرون دایره باشد.");
          return true;
        }
        const dep = { kind: "tangent", k: 0 };
        const q0 = transformCoords(dep, [P, O, A]);
        const q1 = transformCoords({ kind: "tangent", k: 1 }, [P, O, A]);
        if (!q0 || !q1 || !inBoard(q0) || !inBoard(q1)) {
          say("نقطهٔ تماس بیرون از بوم می‌افتد.");
          return true;
        }
        const t1 = addDerivedPoint("tangent", nextLabel(), [P.id, O.id, A.id], { k: 0 });
        const t2 = addDerivedPoint("tangent", nextLabel(), [P.id, O.id, A.id], { k: 1 });
        addObject({ type: "line", name: "مماس بر دایره", a: P.id, b: t1.id });
        addObject({ type: "line", name: "مماس بر دایره", a: P.id, b: t2.id });
        say("دو مماس از نقطه بر دایره رسم شد.");
        return true;
      }

      case "semicircle": {
        pending.push(hit || createPoint(p));
        if (pending.length < 2) {
          say("حالا نقطهٔ دوم قطر را انتخاب کن.");
          return true;
        }
        const [A, C] = pending;
        pending = [];
        if (A.id === C.id) {
          say("دو سر قطر باید متفاوت باشند.");
          return true;
        }
        const M = addDerivedPoint("midpoint", "M", [A.id, C.id]);
        addObject({ type: "arc", center: M.id, a: A.id, c: C.id, b: null, sector: false });
        say("نیم‌دایره ساخته شد.");
        return true;
      }

      case "sector": {
        pending.push(hit || createPoint(p));
        if (pending.length < 3) {
          say(pending.length === 1 ? "حالا نقطهٔ شروع کمان را انتخاب کن." : "حالا نقطهٔ پایان کمان را انتخاب کن.");
          return true;
        }
        const [O, A, B] = pending;
        pending = [];
        if (dist(O, A) < 1e-9 || A.id === O.id || B.id === O.id) {
          say("نقطهٔ شروع باید با مرکز فرق داشته باشد.");
          return true;
        }
        addObject({ type: "arc", center: O.id, a: A.id, c: B.id, b: null, sector: true });
        say("قطاع دایره ساخته شد.");
        return true;
      }

      case "regular": {
        const n = readParam();
        if (n === null || !Number.isInteger(n) || n < 3 || n > 24) {
          say("تعداد ضلع‌ها باید عدد صحیح بین ۳ و ۲۴ باشد.");
          return true;
        }
        pending.push(hit || createPoint(p));
        if (pending.length < 2) {
          say("حالا نقطهٔ دوم ضلع را انتخاب کن.");
          return true;
        }
        const [A, B] = pending;
        pending = [];
        if (A.id === B.id) {
          say("دو رأس ضلع باید متفاوت باشند.");
          return true;
        }
        for (let k = 2; k < n; k++) {
          const q = transformCoords({ kind: "regular", par: n, k }, [A, B]);
          if (!q || !inBoard(q)) {
            say("این چندضلعی بیرون از بوم می‌افتد؛ ضلع کوچک‌تری انتخاب کن.");
            return true;
          }
        }
        const ids = [A.id, B.id];
        for (let k = 2; k < n; k++) {
          ids.push(addDerivedPoint("regular", nextLabel(), [A.id, B.id], { par: n, k }).id);
        }
        addObject({ type: "polygon", points: ids });
        say(`چندضلعی منتظم ${n} ضلعی ساخته شد.`);
        return true;
      }

      case "angleGiven": {
        const th = readParam();
        if (th === null || th <= 0 || th >= 180) {
          say("اندازهٔ زاویه باید بین ۰ و ۱۸۰ درجه باشد.");
          return true;
        }
        pending.push(hit || createPoint(p));
        if (pending.length < 2) {
          say("حالا رأس زاویه را انتخاب کن.");
          return true;
        }
        const [A, V] = pending;
        pending = [];
        if (A.id === V.id) {
          say("نقطهٔ ضلع و رأس باید متفاوت باشند.");
          return true;
        }
        const q = transformCoords({ kind: "rotate", par: th }, [A, V]);
        if (!q || !inBoard(q)) {
          say("زاویهٔ ساخته‌شده بیرون از بوم می‌افتد.");
          return true;
        }
        const B = addDerivedPoint("rotate", nextLabel(), [A.id, V.id], { par: th });
        addObject({ type: "angle", a: A.id, vertex: V.id, c: B.id });
        say(`زاویهٔ ${fmt(th)} درجه ساخته شد.`);
        return true;
      }

      case "ellipse":
      case "parabola": {
        pending.push(hit || createPoint(p));
        const need = 3;
        if (pending.length < need) {
          const ask = tool === "ellipse"
            ? ["حالا کانون دوم F2 را انتخاب کن.", "حالا نقطه‌ای روی بیضی را انتخاب کن."]
            : ["حالا یکی از دو نقطهٔ خط هادی را انتخاب کن.", "حالا نقطهٔ دوم خط هادی را انتخاب کن."];
          say(ask[pending.length - 1]);
          return true;
        }
        const [X, Y, Z] = pending;
        pending = [];
        if (tool === "ellipse") {
          if (X.id === Y.id || dist(X, Y) < 1e-9) {
            say("دو کانون باید متفاوت باشند.");
            return true;
          }
          addObject({ type: "ellipse", f1: X.id, f2: Y.id, p: Z.id });
          say("بیضی ساخته شد.");
        } else {
          if (Y.id === Z.id || dist(Y, Z) < 1e-9) {
            say("دو نقطهٔ خط هادی باید متفاوت باشند.");
            return true;
          }
          if (Math.abs((X.x - Y.x) * (Z.y - Y.y) - (X.y - Y.y) * (Z.x - Y.x)) / dist(Y, Z) < 1e-6) {
            say("کانون نباید روی خط هادی باشد.");
            return true;
          }
          addObject({ type: "parabola", f: X.id, a: Y.id, b: Z.id });
          say("سهمی ساخته شد.");
        }
        return true;
      }
    }
    return false;
  }

  /* ---------- زوم دو انگشتی (لمسی) ---------- */
  const pointers = new Map();
  let pinch = null;
  function startPinch() {
    const [a, b] = [...pointers.values()];
    pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale };
    dragPoint = null; dragBefore = null; shapeDrag = null; panStart = null; strokeDraw = null;
    say("زوم دو انگشتی: انگشت‌ها را از هم دور یا به هم نزدیک کن.");
  }
  function pinchUpdate() {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const before = screenToWorld(cx, cy);
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinch.scale * dist / pinch.dist));
    ox = cx - before.x * scale;
    oy = cy + before.y * scale;
    clampView();
    draw();
  }

  /* ---------- pointer events ---------- */

  canvas.addEventListener("pointerdown", event => {
    const p = canvasPosition(event);
    const w = screenToWorld(p.x, p.y);
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: p.x, y: p.y });
    if (pointers.size >= 2) { startPinch(); return; }

    if (tool === "stroke") {
      strokeDraw = { pts: [clampWorld(w)] };
      draw();
      return;
    }

    if (tool === "select") {
      const hit = hitPoint(p.x, p.y);

      if (hit) {
        selectedId = hit.id;
        if (!hit.dep) {
          dragPoint = { id: hit.id };
          dragBefore = JSON.stringify(objects);
        }
      } else {
        const shape = hitShape(p.x, p.y);
        if (shape) {
          selectedId = shape.id;
          const m = movableOf(shape);
          const targets = [...m.points, ...m.pts];
          if (targets.length) {
            shapeDrag = { targets, start: targets.map(t => ({ x: t.x, y: t.y })), origin: w };
            dragBefore = JSON.stringify(objects);
          }
        } else {
          selectedId = null;
          panStart = { x: p.x, y: p.y, ox, oy };
        }
      }

      updateProperties();
      draw();
      return;
    }

    // بیرون از کادر بوم چیزی ساخته نمی‌شود
    const hit = hitPoint(p.x, p.y);
    if (!hit && !inBoard(w)) {
      say("این نقطه بیرون از بوم است؛ داخل کادر آبی کلیک کن.");
      return;
    }

    transact(() => handleClick(p.x, p.y));
  });

  canvas.addEventListener("pointermove", event => {
    const p = canvasPosition(event);
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: p.x, y: p.y });
    if (pinch && pointers.size >= 2) { pinchUpdate(); return; }
    const w = screenToWorld(p.x, p.y);
    coords.textContent = `x: ${fmt(w.x)} · y: ${fmt(w.y)}`;

    if (strokeDraw) {
      const c = clampWorld(w);
      const last = strokeDraw.pts[strokeDraw.pts.length - 1];
      if (Math.hypot(c.x - last.x, c.y - last.y) > 0.03) strokeDraw.pts.push(c);
      draw();
    } else if (dragPoint) {
      const point = getPoint(dragPoint.id);
      if (point) {
        const target = snapPoint(w);
        point.x = target.x;
        point.y = target.y;
        draw();
        updateProperties();
      }
    } else if (shapeDrag) {
      // کل شکل با یک اندازهٔ ثابت جابه‌جا می‌شود و هیچ نقطه‌ای از بوم بیرون نمی‌رود
      let dx = w.x - shapeDrag.origin.x, dy = w.y - shapeDrag.origin.y;
      if ($("snapToggle")?.checked) { dx = Math.round(dx); dy = Math.round(dy); }
      const xs = shapeDrag.start.map(q => q.x), ys = shapeDrag.start.map(q => q.y);
      dx = Math.max(-LIMIT - Math.min(...xs), Math.min(LIMIT - Math.max(...xs), dx));
      dy = Math.max(-LIMIT - Math.min(...ys), Math.min(LIMIT - Math.max(...ys), dy));
      shapeDrag.targets.forEach((t, i) => {
        t.x = shapeDrag.start[i].x + dx;
        t.y = shapeDrag.start[i].y + dy;
      });
      draw();
      updateProperties();
    } else if (panStart) {
      ox = panStart.ox + p.x - panStart.x;
      oy = panStart.oy + p.y - panStart.y;
      clampView();
      draw();
    }
  });

  function endPointer() {
    if (strokeDraw) {
      const pts = strokeDraw.pts;
      strokeDraw = null;
      if (pts.length > 1) {
        transact(() => addObject({ type: "stroke", pts }));
        say("قلم آزاد ثبت شد. برای جابه‌جایی‌اش ابزار انتخاب را بزن.");
      } else {
        draw();
      }
      return;
    }
    if ((dragPoint || shapeDrag) && dragBefore !== null && JSON.stringify(objects) !== dragBefore) {
      pushHistory(dragBefore);
    }
    if (dragPoint || shapeDrag || panStart) saveLocal();
    dragPoint = null;
    shapeDrag = null;
    dragBefore = null;
    panStart = null;
  }
  function releasePointer(event) {
    pointers.delete(event.pointerId);
    if (pinch) {
      if (pointers.size < 2) { pinch = null; saveLocal(); }
      return;
    }
    endPointer();
  }
  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);

  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    const p = canvasPosition(event);
    const before = screenToWorld(p.x, p.y);
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * (event.deltaY < 0 ? 1.1 : .9)));
    ox = p.x - before.x * scale;
    oy = p.y + before.y * scale;
    clampView();
    draw();
    saveLocal();
  }, { passive: false });

  /* ---------- toolbar buttons ---------- */

  document.querySelectorAll("[data-tool]").forEach(button =>
    button.addEventListener("click", () => setTool(button.dataset.tool)));

  $("finishPolygonBtn")?.addEventListener("click", finishPolygon);
  $("deleteBtn")?.addEventListener("click", deleteSelected);
  $("centersBtn")?.addEventListener("click", addTriangleCenters);
  $("rotPlusBtn").addEventListener("click", () => rotateSelected(Math.PI / 12));
  $("rotMinusBtn").addEventListener("click", () => rotateSelected(-Math.PI / 12));
  $("mirrorBtn").addEventListener("click", () =>
    transformSelected(t => ({ x: -t.x, y: t.y }), "شکل نسبت به محور y قرینه شد."));

  $("themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("day");
    try { localStorage.setItem("SAM MATH_GEOMETRY_THEME", isDay() ? "day" : "night"); } catch (_) {}
    draw();
    window.dispatchEvent(new Event("samgeo:theme"));
    say(isDay() ? "حالت روز فعال شد." : "حالت شب فعال شد.");
  });

  $("pngBtn")?.addEventListener("click", () => {
    canvas.toBlob(blob => {
      if (!blob) {
        say("ساخت تصویر ممکن نشد.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mathora-geometry.png";
      a.click();
      URL.revokeObjectURL(url);
      say("تصویر ذخیره شد.");
    });
  });

  $("undoBtn").addEventListener("click", () => {
    if (!history.length) {
      say("تغییری برای بازگشت وجود ندارد.");
      return;
    }
    objects = JSON.parse(history.pop());
    nextId = objects.reduce((max, o) => Math.max(max, o.id), 0) + 1;
    pending = [];
    polygonIds = [];
    selectedId = null;
    refresh();
    say("آخرین تغییر برگشت داده شد.");
  });

  function clearAll() {
    if (!objects.length) {
      say("بوم از قبل خالی است.");
      return;
    }
    transact(() => {
      objects = [];
      pending = [];
      polygonIds = [];
      selectedId = null;
      nextId = 1;
    });
    say("بوم پاک شد. با «بازگشت» می‌توانی برش گردانی.");
  }

  $("clearBtn").addEventListener("click", clearAll);
  $("clearAllBtn")?.addEventListener("click", clearAll);

  $("saveBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ objects, nextId, scale }, null, 2)],
      { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mathora-geometry.json";
    a.click();
    URL.revokeObjectURL(url);
    say("فایل پروژه دانلود شد.");
  });

  $("zoomIn").addEventListener("click", () => {
    scale = Math.min(MAX_SCALE, scale * 1.2);
    clampView();
    draw();
    saveLocal();
  });

  $("zoomOut").addEventListener("click", () => {
    scale = Math.max(MIN_SCALE, scale / 1.2);
    clampView();
    draw();
    saveLocal();
  });

  $("fitBtn").addEventListener("click", () => {
    ox = W / 2;
    oy = H / 2;
    scale = fitScale();
    clampView();
    draw();
    saveLocal();
  });

  document.addEventListener("keydown", event => {
    const typing = event.target instanceof HTMLInputElement && event.target.type !== "checkbox";

    if (event.key === "Enter" && tool === "polygon" && !typing) finishPolygon();
    if ((event.key === "Delete" || event.key === "Backspace") && !typing) {
      event.preventDefault();
      deleteSelected();
    }
    if (event.key === "Escape") {
      pending = [];
      pickedId = null;
      strokeDraw = null;
      polygonIds = [];
      say("عملیات جاری لغو شد.");
      draw();
    }
  });

  /* ---------- command box ---------- */

  // شکل‌های سه‌بعدی که با نام تنها هم ساخته می‌شوند (circle و cube… جدا از دستورهای دوبعدی هستند)
  const SOLID_SHORTHAND = ["sphere", "hemisphere", "cube", "cuboid", "cylinder", "cone", "tcone",
    "pyramid", "hexpyramid", "tetra", "prism", "octa", "vcircle", "square"];

  function command(text) {
    const parts = text.trim().toLowerCase().split(/[\s,;]+/);
    const name = parts[0];
    const n = Number(parts[1]);
    const m = Number(parts[2]);
    const three = window.SAMGeometry3D;

    if (name === "clear") {
      if (isIn3D() && three) three.clear();
      else clearAll();
      return;
    }
    if (name === "solid" || SOLID_SHORTHAND.includes(name)) {
      if (!three) {
        say("بخش سه‌بعدی هنوز بارگذاری نشده است.");
        return;
      }
      const kind = name === "solid" ? parts[1] : name;
      const size = Number(name === "solid" ? parts[2] : parts[1]);
      three.command(kind, size);
      return;
    }
    if (isIn3D() && three) three.setDim("2d");

    // مرکز نمای فعلی، به‌شرطی که شکل داخل بوم جا شود
    const view = screenToWorld(W / 2, H / 2);
    const tooBig = () => say(`این شکل در بوم ${2 * LIMIT} × ${2 * LIMIT} جا نمی‌شود؛ اندازه‌ها را کوچک‌تر کن.`);

    if (name === "segment" && Number.isFinite(n) && n > 0) {
      if (n > 2 * LIMIT) return tooBig();
      const cx = fitCenter(view.x, n / 2), cy = fitCenter(view.y, 0);
      transact(() => {
        const a = createPoint({ x: cx - n / 2, y: cy });
        const b = createPoint({ x: cx + n / 2, y: cy });
        addObject({ type: "segment", a: a.id, b: b.id });
      });
      say(`پاره‌خط با طول ${n} ساخته شد.`);
    } else if (name === "circle" && Number.isFinite(n) && n > 0) {
      if (n > LIMIT) return tooBig();
      const cx = fitCenter(view.x, n), cy = fitCenter(view.y, n);
      transact(() => {
        const c = createPoint({ x: cx, y: cy });
        const edge = createPoint({ x: c.x + n, y: c.y });
        addObject({ type: "circle", center: c.id, through: edge.id, radius: n });
      });
      say(`دایره با شعاع ${n} ساخته شد.`);
    } else if (name === "point" && Number.isFinite(n) && Number.isFinite(m)) {
      if (!inBoard({ x: n, y: m })) {
        say(`مختصات نقطه باید بین ${-LIMIT} و ${LIMIT} باشد.`);
        return;
      }
      transact(() => createPoint({ x: n, y: m }));
      say(`نقطهٔ (${n}, ${m}) ساخته شد.`);
    } else if (name === "triangle") {
      const cx = fitCenter(view.x, 3), cy = fitCenter(view.y, 3);
      transact(() => {
        const a = createPoint({ x: cx - 3, y: cy - 2 });
        const b = createPoint({ x: cx + 3, y: cy - 2 });
        const c = createPoint({ x: cx, y: cy + 3 });
        addObject({ type: "polygon", points: [a.id, b.id, c.id] });
      });
      say("مثلث ساخته شد.");
    } else if (name === "rectangle" && Number.isFinite(n) && Number.isFinite(m) && n > 0 && m > 0) {
      if (n > 2 * LIMIT || m > 2 * LIMIT) return tooBig();
      const cx = fitCenter(view.x, n / 2), cy = fitCenter(view.y, m / 2);
      transact(() => {
        const a = createPoint({ x: cx - n / 2, y: cy - m / 2 });
        const b = createPoint({ x: cx + n / 2, y: cy - m / 2 });
        const c = createPoint({ x: cx + n / 2, y: cy + m / 2 });
        const d = createPoint({ x: cx - n / 2, y: cy + m / 2 });
        addObject({ type: "polygon", points: [a.id, b.id, c.id, d.id] });
      });
      say(`مستطیل ${n} در ${m} ساخته شد.`);
    } else if (name === "regular" && Number.isInteger(n) && n >= 3 && n <= 24) {
      const r = m > 0 ? m : 3;
      if (r > LIMIT) return tooBig();
      const cx = fitCenter(view.x, r), cy = fitCenter(view.y, r);
      transact(() => {
        const ids = [];
        for (let k = 0; k < n; k++) {
          const t = Math.PI / 2 + 2 * Math.PI * k / n;
          ids.push(createPoint({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) }).id);
        }
        addObject({ type: "polygon", points: ids });
      });
      say(`چندضلعی منتظم ${n} ضلعی با شعاع ${r} ساخته شد.`);
    } else if (name === "pythagoras") {
      const a = n > 0 ? n : 3, b = m > 0 ? m : 4;
      if (a + b > LIMIT) return tooBig();
      transact(() => {
        const A = createPoint({ x: 0, y: 0 });
        const B = createPoint({ x: a, y: 0 });
        const C = createPoint({ x: 0, y: b });
        const D = createPoint({ x: a, y: -a });
        const E = createPoint({ x: 0, y: -a });
        const F = createPoint({ x: -b, y: b });
        const G = createPoint({ x: -b, y: 0 });
        const H = createPoint({ x: b, y: a + b });
        const I = createPoint({ x: a + b, y: a });
        addObject({ type: "polygon", points: [A.id, B.id, D.id, E.id] });
        addObject({ type: "polygon", points: [A.id, G.id, F.id, C.id] });
        addObject({ type: "polygon", points: [B.id, I.id, H.id, C.id] });
        addObject({ type: "polygon", points: [A.id, B.id, C.id] });
        addObject({ type: "angle", a: B.id, vertex: A.id, c: C.id });
      });
      say(`قضیهٔ فیثاغورس: ${fmt(a * a)} + ${fmt(b * b)} = ${fmt(a * a + b * b)} ← وتر = ${fmt(Math.hypot(a, b))}`);
    } else {
      say("دستورها: segment 13 · circle 5 · triangle · rectangle 8 5 · point 3 4 · regular 6 3 · pythagoras 3 4");
    }
  }

  // واسط برای دستیار صوتی: یک دستور می‌گیرد و پیام وضعیت را برمی‌گرداند
  window.SAMGeometry = {
    run(text) {
      const t = String(text || "").trim();
      if (!t) return "دستوری داده نشد.";
      if (t === "2d" || t === "3d") {
        if (window.SAMGeometry3D) window.SAMGeometry3D.setDim(t);
        return $("status").textContent;
      }
      command(t);
      return $("status").textContent;
    }
  };

  $("commandForm").addEventListener("submit", event => {
    event.preventDefault();
    command($("commandInput").value);
    $("commandInput").value = "";
  });

  document.querySelectorAll("[data-command]").forEach(button =>
    button.addEventListener("click", () => command(button.dataset.command)));

  /* ---------- startup ---------- */

  try {
    const data = JSON.parse(localStorage.getItem("SAM MATH_GEOMETRY_STUDIO") || "null");
    if (data && Array.isArray(data.objects)) {
      objects = data.objects;
      // نقطه‌های ذخیره‌شدهٔ قبلی را داخل بوم می‌آوریم
      objects.forEach(o => { if (o.type === "point") Object.assign(o, clampWorld(o)); });
      nextId = data.nextId || objects.reduce((max, o) => Math.max(max, o.id), 0) + 1;
      if (Number.isFinite(data.scale)) {
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, data.scale));
        hasSavedScale = true;
      }
    }
  } catch (_) {}

  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(resize).observe(shell);
  } else {
    window.addEventListener("resize", resize);
  }

  try {
    if (localStorage.getItem("SAM MATH_GEOMETRY_THEME") === "day") document.body.classList.add("day");
  } catch (_) {}

  setTool("select");
  resize();

  // ?cmd=... اجرا می‌شود؛ بعد از بارگذاری بخش سه‌بعدی تا دستورهای solid کار کنند
  window.addEventListener("load", () => {
    const cmd = new URLSearchParams(location.search).get("cmd");
    if (cmd) window.SAMGeometry.run(cmd);
  });
})();