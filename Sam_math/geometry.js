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
  const LIMIT = 10;
  const MIN_SCALE = 8;
  const MAX_SCALE = 150;

  let W = 0, H = 0, dpr = 1;
  let scale = 40, ox = 0, oy = 0, viewReady = false;
  let objects = [], history = [], nextId = 1;
  let tool = "select", pending = [], polygonIds = [];
  let dragPoint = null, dragBefore = null, panStart = null, selectedId = null;

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
    measure: "#fde047"
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
    foot: "پای عمود"
  };

  const depNames = {
    midpoint: "نقطهٔ وسط",
    centroid: "مرکز ثقل",
    circumcenter: "مرکز دایرهٔ محیطی",
    incenter: "مرکز دایرهٔ محاطی",
    orthocenter: "مرکز ارتفاعی",
    intersect: "نقطهٔ تقاطع",
    foot: "پای عمود"
  };

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
  function addDerivedPoint(kind, base, of) {
    const p = addObject({
      type: "point", x: 0, y: 0, label: uniqueLabel(base), dep: { kind, of }
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

      if (o.type === "segment" || o.type === "line") {
        const a = getPoint(o.a), b = getPoint(o.b);
        if (!a || !b) continue;
        const p = worldToScreen(a), q = worldToScreen(b);
        const d = o.type === "line"
          ? distToLine(x, y, p.x, p.y, q.x, q.y)
          : distToSegment(x, y, p.x, p.y, q.x, q.y);
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
    } else {
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();

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

  function draw() {
    if (!canvas.width || !canvas.height) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    updateDependents();
    drawGrid();

    for (const o of objects) {
      if (o.type === "segment" || o.type === "line") drawSegment(o);
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
      foot: "اول نقطهٔ P، سپس دو سر خط A و B را انتخاب کن تا پای عمود از P بر AB ساخته شود."
    };

    help.textContent = instructions[tool] || "";
    say("ابزار انتخاب‌شده: " + (toolNames[tool] || tool));
    draw();
  }

  function dependsOnPoint(o, id) {
    switch (o.type) {
      case "segment":
      case "line":
      case "measure":
      case "perpbis": return o.a === id || o.b === id;
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
      case "segment": case "line": case "measure": case "perpbis": ids = [o.a, o.b]; break;
      case "circle": ids = [o.center, o.through]; break;
      case "angle": case "bisector": ids = [o.a, o.vertex, o.c]; break;
      case "polygon": ids = o.points; break;
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

  /* ---------- pointer events ---------- */

  canvas.addEventListener("pointerdown", event => {
    const p = canvasPosition(event);
    const w = screenToWorld(p.x, p.y);
    canvas.setPointerCapture(event.pointerId);

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
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

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