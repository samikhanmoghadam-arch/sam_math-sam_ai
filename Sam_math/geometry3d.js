"use strict";
/*
  حالت سه‌بعدی هندسه.
  یک بوم جدا (geometry3dCanvas) است که فقط در حالت «سه‌بعدی» دیده می‌شود.
  بوم دو‌بعدی و منطق آن (geometry.js) دست‌نخورده می‌مانند؛ با برگشت به
  «دو‌بعدی» همان بوم قبلی دوباره نمایش داده می‌شود.
*/
(() => {
  const $ = id => document.getElementById(id);
  const body = document.body;
  const shell = $("canvasShell");
  const canvas = $("geometry3dCanvas");
  const ctx = canvas.getContext("2d");
  const status = $("status");
  const coords = $("coordinates");
  const info = $("info3d");
  const KEY = "SAM MATH_GEOMETRY_3D";
  const TAU = Math.PI * 2;
  const LIMIT = 10;            // طول محورها و شبکهٔ کف: از −۱۰ تا ۱۰
  const CAM = 40;              // فاصلهٔ دوربین؛ عدد بزرگ‌تر یعنی پرسپکتیو ملایم‌تر
  const DEFAULT_YAW = -0.6;
  const DEFAULT_PITCH = 0.45;
  const COLORS = ["#67e8f9", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#38bdf8", "#fb923c"];
  const NAMES = {
    circle: "دایرهٔ سه‌بعدی",
    vcircle: "دایرهٔ عمودی",
    square: "مربع سه‌بعدی",
    sphere: "کره",
    hemisphere: "نیم‌کره",
    cube: "مکعب",
    cuboid: "مکعب‌مستطیل",
    cylinder: "استوانه",
    cone: "مخروط",
    pyramid: "هرم چهارگوش",
    tetra: "هرم سه‌وجهی",
    prism: "منشور مثلثی",
    octa: "هشت‌وجهی"
  };
  // جای شکل‌های تازه؛ هر شکل جدید به نوبت در یکی از این نقطه‌ها ساخته می‌شود
  const POSITIONS = [
    [0, 0, 0], [4.5, 0, 0], [-4.5, 0, 0], [0, 0, 4.5], [0, 0, -4.5],
    [4.5, 0, 4.5], [-4.5, 0, -4.5], [4.5, 0, -4.5], [-4.5, 0, 4.5]
  ];

  let dim = "2d";
  let solids = [];
  let past = [];
  let nextId = 1;
  let yaw = DEFAULT_YAW, pitch = DEFAULT_PITCH, zoom = 1;
  let base = 20, W = 0, H = 0, dpr = 1;
  let drag = null, spinning = false, spinRaf = 0;
  let origTitle = "", origDesc = "", origNote = "";

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmt = n => String(+n.toFixed(2));
  const say = text => { status.textContent = text; };

  /* ---------- بردار و رنگ ---------- */

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  const avg = pts => {
    const s = [0, 0, 0];
    pts.forEach(p => { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; });
    return s.map(v => v / pts.length);
  };
  function withAlpha(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ---------- ساخت هندسهٔ شکل‌ها (مختصات محلی، مرکز در مبدأ) ---------- */

  // دایرهٔ افقی (صفحهٔ xz) در ارتفاع y
  function ring(r, y, n = 96) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = TAU * i / n;
      pts.push([r * Math.cos(t), y, r * Math.sin(t)]);
    }
    return pts;
  }

  // دایرهٔ عمودی (صفحهٔ xy)
  function vring(r, n = 96) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = TAU * i / n;
      pts.push([r * Math.cos(t), r * Math.sin(t), 0]);
    }
    return pts;
  }

  // شبکهٔ کره: نصف‌النهارها و مدارهای موازی؛ thetaMax = ۰ تا π برای کره، ۰ تا π/۲ برای نیم‌کره
  function sphereLines(R, thetaMax, meridians, span, parallels) {
    const lines = [];
    for (let k = 0; k < meridians; k++) {
      const phi = span * k / meridians;
      const line = [];
      for (let i = 0; i <= 40; i++) {
        const th = thetaMax * i / 40;
        line.push([R * Math.sin(th) * Math.cos(phi), R * Math.cos(th), R * Math.sin(th) * Math.sin(phi)]);
      }
      lines.push(line);
    }
    for (const th of parallels) lines.push(ring(R * Math.sin(th), R * Math.cos(th), 72));
    return lines;
  }

  // مکعب‌مستطیل با نصف‌طول‌های hx, hy, hz
  function boxGeom(hx, hy, hz) {
    const verts = [];
    for (let i = 0; i < 8; i++) {
      verts.push([i & 1 ? hx : -hx, i & 2 ? hy : -hy, i & 4 ? hz : -hz]);
    }
    const faces = [[1, 3, 7, 5], [0, 4, 6, 2], [2, 6, 7, 3], [0, 1, 5, 4], [4, 5, 7, 6], [0, 2, 3, 1]];
    return { verts, faces };
  }

  function geometryOf(kind, R) {
    switch (kind) {
      case "circle": return { lines: [ring(R, 0)] };
      case "vcircle": return { lines: [vring(R)] };
      case "square": return { lines: [[[-R, 0, -R], [R, 0, -R], [R, 0, R], [-R, 0, R], [-R, 0, -R]]] };
      case "sphere":
        return { lines: sphereLines(R, Math.PI, 12, Math.PI,
          [Math.PI / 6, Math.PI / 3, Math.PI / 2, 2 * Math.PI / 3, 5 * Math.PI / 6]) };
      case "hemisphere":
        return { lines: sphereLines(R, Math.PI / 2, 16, TAU, [Math.PI / 6, Math.PI / 3, Math.PI / 2]) };
      case "cube": return boxGeom(R, R, R);
      case "cuboid": return boxGeom(1.5 * R, R, 0.7 * R);
      case "cylinder": {
        const lines = [ring(R, 0), ring(R, 2 * R)];
        for (let k = 0; k < 8; k++) {
          const t = TAU * k / 8;
          lines.push([[R * Math.cos(t), 0, R * Math.sin(t)], [R * Math.cos(t), 2 * R, R * Math.sin(t)]]);
        }
        return { lines };
      }
      case "cone": {
        const lines = [ring(R, 0)];
        for (let k = 0; k < 8; k++) {
          const t = TAU * k / 8;
          lines.push([[0, 2 * R, 0], [R * Math.cos(t), 0, R * Math.sin(t)]]);
        }
        return { lines };
      }
      case "pyramid":
        return {
          verts: [[-R, 0, -R], [R, 0, -R], [R, 0, R], [-R, 0, R], [0, 2 * R, 0]],
          faces: [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]]
        };
      case "tetra":
        return {
          verts: [[R, R, R], [R, -R, -R], [-R, R, -R], [-R, -R, R]],
          faces: [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]
        };
      case "octa": {
        const verts = [[R, 0, 0], [-R, 0, 0], [0, R, 0], [0, -R, 0], [0, 0, R], [0, 0, -R]];
        const faces = [];
        for (const a of [0, 1]) for (const b of [2, 3]) for (const c of [4, 5]) faces.push([a, b, c]);
        return { verts, faces };
      }
      case "prism": {
        const verts = [];
        for (let k = 0; k < 3; k++) {
          const t = -Math.PI / 2 + TAU * k / 3;
          verts.push([R * Math.cos(t), 0, R * Math.sin(t)]);
        }
        for (let k = 0; k < 3; k++) verts.push([verts[k][0], 2 * R, verts[k][2]]);
        return {
          verts,
          faces: [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]]
        };
      }
      default: return null;
    }
  }

  // حجم و مساحت (یا محیط و مساحت برای شکل‌های تخت) بر حسب شعاع/نصف‌ضلع R
  function measures(kind, R) {
    const P = Math.PI, r = R;
    const vol = (v, a) => `حجم ≈ ${fmt(v)} · مساحت سطح ≈ ${fmt(a)}`;
    switch (kind) {
      case "circle":
      case "vcircle": return `محیط ≈ ${fmt(2 * P * r)} · مساحت ≈ ${fmt(P * r * r)}`;
      case "square": return `محیط ≈ ${fmt(8 * r)} · مساحت ≈ ${fmt(4 * r * r)}`;
      case "sphere": return vol(4 / 3 * P * r ** 3, 4 * P * r * r);
      case "hemisphere": return vol(2 / 3 * P * r ** 3, 3 * P * r * r);
      case "cube": return vol(8 * r ** 3, 24 * r * r);
      case "cuboid": {
        const a = 3 * r, b = 2 * r, c = 1.4 * r;
        return vol(a * b * c, 2 * (a * b + b * c + c * a));
      }
      case "cylinder": return vol(2 * P * r ** 3, 6 * P * r * r);
      case "cone": return vol(2 / 3 * P * r ** 3, P * r * r + P * r * r * Math.sqrt(5));
      case "pyramid": {
        const a = 2 * r, l = r * Math.sqrt(5);
        return vol(a * a * 2 * r / 3, a * a + 2 * a * l);
      }
      case "tetra": return vol(8 / 3 * r ** 3, 8 * Math.sqrt(3) * r * r);
      case "prism": return vol(1.5 * Math.sqrt(3) * r ** 3, 7.5 * Math.sqrt(3) * r * r);
      case "octa": return vol(4 / 3 * r ** 3, 4 * Math.sqrt(3) * r * r);
      default: return "";
    }
  }

  /* ---------- نمایش سه‌بعدی ---------- */

  // چرخش: اول حول محور y (yaw) سپس حول محور x (pitch)، بعد انتقال به مکان شکل
  function rot(p, o) {
    const x = p[0] + o[0], y = p[1] + o[1], z = p[2] + o[2];
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    return [x1, y2, z2];
  }

  // تصویر روی صفحه؛ عمق (z) برای ترتیب رسم و تشخیص روی/پشت استفاده می‌شود
  function project(v) {
    const k = base * zoom * CAM / (CAM - v[2]);
    return [W / 2 + v[0] * k, H / 2 - v[1] * k, v[2]];
  }

  function strokeLine(a, b) {
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }

  function drawGrid() {
    const L = LIMIT;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(148,163,184,.16)";
    ctx.beginPath();
    for (let i = -L; i <= L; i++) {
      strokeLine(project(rot([i, 0, -L], [0, 0, 0])), project(rot([i, 0, L], [0, 0, 0])));
      strokeLine(project(rot([-L, 0, i], [0, 0, 0])), project(rot([L, 0, i], [0, 0, 0])));
    }
    ctx.stroke();

    const axes = [
      { a: [-L, 0, 0], b: [L, 0, 0], end: [L + 0.7, 0, 0], c: "#f87171", label: "x" },
      { a: [0, -L, 0], b: [0, L, 0], end: [0, L + 0.7, 0], c: "#34d399", label: "y" },
      { a: [0, 0, -L], b: [0, 0, L], end: [0, 0, L + 0.7], c: "#60a5fa", label: "z" }
    ];
    ctx.lineWidth = 1.6;
    for (const ax of axes) {
      ctx.strokeStyle = ax.c;
      ctx.beginPath();
      strokeLine(project(rot(ax.a, [0, 0, 0])), project(rot(ax.b, [0, 0, 0])));
      ctx.stroke();
      const e = project(rot(ax.end, [0, 0, 0]));
      ctx.fillStyle = ax.c;
      ctx.font = "bold 13px system-ui";
      ctx.fillText(ax.label, e[0] + 4, e[1]);
    }

    const o = project(rot([0, 0, 0], [0, 0, 0]));
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.arc(o[0], o[1], 3, 0, TAU);
    ctx.fill();
  }

  function drawSolid(s) {
    const color = COLORS[(s.id - 1) % COLORS.length];
    const g = geometryOf(s.kind, s.size);
    if (!g) return;
    const o = s.pos;

    if (g.faces) {
      // چندوجهی‌ها: وجه‌های رو به دوربین پر می‌شوند و از دورتر به نزدیک‌تر رسم می‌شوند
      const R3 = g.verts.map(v => rot(v, o));
      const center = avg(R3);
      const visible = [];
      for (const f of g.faces) {
        const a = R3[f[0]], b = R3[f[1]], c = R3[f[2]];
        let n = cross(sub(b, a), sub(c, a));
        const fc = avg(f.map(i => R3[i]));
        // قطبیت: نرمال باید به بیرون شکل اشاره کند
        if (dot(n, sub(fc, center)) < 0) n = n.map(v => -v);
        if (n[2] > 0) visible.push({ f, depth: fc[2] });
      }
      visible.sort((p, q) => p.depth - q.depth);

      const edges = new Map();
      for (const { f } of visible) {
        ctx.beginPath();
        f.forEach((i, k) => {
          const p = project(R3[i]);
          if (k) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
        });
        ctx.closePath();
        ctx.fillStyle = withAlpha(color, 0.16);
        ctx.fill();
        for (let k = 0; k < f.length; k++) {
          const a = f[k], b = f[(k + 1) % f.length];
          edges.set(a < b ? `${a}-${b}` : `${b}-${a}`, [a, b]);
        }
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (const [a, b] of edges.values()) strokeLine(project(R3[a]), project(R3[b]));
      ctx.stroke();
    }

    if (g.lines) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      for (const line of g.lines) {
        for (let i = 0; i < line.length - 1; i++) {
          const a3 = rot(line[i], o), b3 = rot(line[i + 1], o);
          const behind = (a3[2] + b3[2]) / 2 < 0;
          ctx.globalAlpha = behind ? 0.3 : 1;
          ctx.beginPath();
          strokeLine(project(a3), project(b3));
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

  }

  function draw3() {
    if (dim !== "3d" || !W || !H) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b1221";
    ctx.fillRect(0, 0, W, H);
    drawGrid();

    // شکل‌های دورتر اول رسم می‌شوند تا نزدیک‌ترها روی آن‌ها بنشینند
    const order = solids
      .map(s => ({ s, d: rot([0, 0, 0], s.pos)[2] }))
      .sort((a, b) => a.d - b.d);
    for (const { s } of order) drawSolid(s);

    coords.textContent = `چرخش: ${Math.round(yaw * 180 / Math.PI)}° · شیب: ${Math.round(pitch * 180 / Math.PI)}° · بزرگ‌نمایی: ${Math.round(zoom * 100)}%`;
  }

  function resize3() {
    const r = shell.getBoundingClientRect();
    W = Math.max(280, r.width);
    H = Math.max(300, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    base = Math.min(W, H) / 26;
    draw3();
  }

  /* ---------- وضعیت، ذخیره و تاریخچه ---------- */

  function saveLocal() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ solids, nextId, yaw, pitch, zoom }));
    } catch (_) {}
  }

  function loadLocal() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!d || !Array.isArray(d.solids)) return;
      solids = d.solids.filter(s =>
        s && NAMES[s.kind] && Number.isFinite(s.size) && Array.isArray(s.pos) && Number.isFinite(s.id));
      nextId = Number(d.nextId) || solids.reduce((m, s) => Math.max(m, s.id), 0) + 1;
      if (Number.isFinite(d.yaw)) yaw = d.yaw;
      if (Number.isFinite(d.pitch)) pitch = clamp(d.pitch, -1.5, 1.5);
      if (Number.isFinite(d.zoom)) zoom = clamp(d.zoom, 0.35, 4);
    } catch (_) {}
  }

  function pushPast() {
    past.push(JSON.stringify(solids));
    if (past.length > 60) past.shift();
  }

  function updateInfo() {
    if (!solids.length) {
      info.textContent = "هنوز شکل سه‌بعدی‌ای ساخته نشده است.";
      return;
    }
    const counts = {};
    solids.forEach(s => { counts[s.kind] = (counts[s.kind] || 0) + 1; });
    const summary = Object.entries(counts).map(([k, n]) => `${NAMES[k]}×${n}`).join("، ");
    const last = solids[solids.length - 1];
    info.textContent =
      `${solids.length} شکل در فضا (${summary}). ` +
      `آخرین شکل: ${NAMES[last.kind]} · ${measures(last.kind, last.size)}`;
  }

  function commit(message) {
    saveLocal();
    draw3();
    updateInfo();
    if (message) say(message);
  }

  function addSolid(kind) {
    const R = clamp(Number($("size3d").value) || 2, 0.5, 5);
    pushPast();
    const pos = POSITIONS[solids.length % POSITIONS.length].slice();
    solids.push({ id: nextId++, kind, size: R, pos });
    commit(`${NAMES[kind]} ساخته شد.`);
  }

  function undo3() {
    if (!past.length) {
      say("تغییری برای بازگشت در فضای سه‌بعدی نیست.");
      return;
    }
    solids = JSON.parse(past.pop());
    commit("آخرین تغییر برگشت داده شد.");
  }

  function deleteLast() {
    if (!solids.length) {
      say("شکلی برای حذف وجود ندارد.");
      return;
    }
    pushPast();
    const removed = solids.pop();
    commit(`${NAMES[removed.kind]} حذف شد.`);
  }

  function clearAll3() {
    if (!solids.length) {
      say("فضای سه‌بعدی از قبل خالی است.");
      return;
    }
    pushPast();
    solids = [];
    commit("شکل‌های سه‌بعدی پاک شدند. با «بازگشت» می‌توانی برگردانی.");
  }

  /* ---------- نما: چرخش، زوم، بازنشانی ---------- */

  function zoomBy(factor) {
    zoom = clamp(zoom * factor, 0.35, 4);
    draw3();
    saveLocal();
  }

  function resetView() {
    yaw = DEFAULT_YAW;
    pitch = DEFAULT_PITCH;
    zoom = 1;
    draw3();
    saveLocal();
    say("نما بازنشانی شد.");
  }

  function spinTick() {
    if (!spinning || dim !== "3d") return;
    yaw += 0.012;
    draw3();
    spinRaf = requestAnimationFrame(spinTick);
  }

  function toggleSpin() {
    spinning = !spinning;
    $("auto3dBtn").textContent = spinning ? "⏸ توقف چرخش" : "↻ چرخش خودکار";
    if (spinning) spinTick();
    else cancelAnimationFrame(spinRaf);
  }

  /* ---------- حالت دو‌بعدی / سه‌بعدی ---------- */

  function setDim(next) {
    if (next === dim) return;
    dim = next;
    body.classList.toggle("dim-3d", dim === "3d");
    document.querySelectorAll(".dim-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.dim === dim));

    $("toolsTitle").textContent = dim === "3d" ? "ابزارهای سه‌بعدی" : "ابزارهای رسم";
    document.querySelector(".canvas-heading h1").textContent = dim === "3d" ? "فضای سه‌بعدی" : origTitle;
    document.querySelector(".canvas-heading p").textContent = dim === "3d"
      ? "با کشیدن روی فضا بچرخان و با چرخ موس بزرگ‌نمایی کن؛ شکل‌ها در فضا کنار هم ساخته می‌شوند."
      : origDesc;
    document.querySelector(".canvas-footer span:last-child").textContent = dim === "3d"
      ? "فضای سه‌بعدی: بدون محدودیت کادر"
      : origNote;

    if (dim === "3d") {
      resize3();
      updateInfo();
      say("حالت سه‌بعدی فعال شد. یک شکل از فهرست انتخاب کن.");
    } else {
      spinning = false;
      cancelAnimationFrame(spinRaf);
      $("auto3dBtn").textContent = "↻ چرخش خودکار";
      coords.textContent = "x: 0 · y: 0";
      say("حالت دو‌بعدی فعال شد.");
    }
  }

  /* ---------- رویدادها ---------- */

  document.querySelectorAll(".dim-btn").forEach(b =>
    b.addEventListener("click", () => setDim(b.dataset.dim)));

  document.querySelectorAll("[data-solid]").forEach(b =>
    b.addEventListener("click", () => addSolid(b.dataset.solid)));

  $("auto3dBtn").addEventListener("click", toggleSpin);
  $("reset3dBtn").addEventListener("click", resetView);
  $("delete3dBtn").addEventListener("click", deleteLast);
  $("clear3dBtn").addEventListener("click", clearAll3);

  // دکمه‌های بالای صفحه (بازگشت، پاک‌کردن، ذخیره، زوم) در حالت سه‌بعدی به فضای سه‌بعدی وصل می‌شوند
  const topActions = {
    undoBtn: undo3,
    clearBtn: clearAll3,
    pngBtn: savePng,
    saveBtn: saveJson,
    zoomIn: () => zoomBy(1.2),
    zoomOut: () => zoomBy(1 / 1.2),
    fitBtn: resetView
  };
  document.addEventListener("click", event => {
    if (dim !== "3d") return;
    const btn = event.target.closest && event.target.closest("button[id]");
    if (!btn || !topActions[btn.id]) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    topActions[btn.id]();
  }, true);

  // میانبرهای صفحهٔ دو‌بعدی (Delete و …) در حالت سه‌بعدی اجرا نمی‌شوند
  document.addEventListener("keydown", event => {
    if (dim !== "3d") return;
    if (event.target instanceof HTMLInputElement) return;
    event.stopImmediatePropagation();
  }, true);

  canvas.addEventListener("pointerdown", event => {
    drag = { x: event.clientX, y: event.clientY, yaw, pitch };
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", event => {
    if (!drag) return;
    yaw = drag.yaw + (event.clientX - drag.x) * 0.008;
    pitch = clamp(drag.pitch + (event.clientY - drag.y) * 0.008, -1.5, 1.5);
    draw3();
  });

  const endDrag = () => {
    if (!drag) return;
    drag = null;
    saveLocal();
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("wheel", event => {
    if (dim !== "3d") return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.1 : 0.9);
  }, { passive: false });

  function savePng() {
    canvas.toBlob(blob => {
      if (!blob) {
        say("ساخت تصویر ممکن نشد.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sam-math-geometry-3d.png";
      a.click();
      URL.revokeObjectURL(url);
      say("تصویر سه‌بعدی ذخیره شد.");
    });
  }

  function saveJson() {
    const blob = new Blob([JSON.stringify({ solids, nextId, yaw, pitch, zoom }, null, 2)],
      { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sam-math-geometry-3d.json";
    a.click();
    URL.revokeObjectURL(url);
    say("فایل سه‌بعدی دانلود شد.");
  }

  /* ---------- راه‌اندازی ---------- */

  origTitle = document.querySelector(".canvas-heading h1").textContent;
  origDesc = document.querySelector(".canvas-heading p").textContent;
  origNote = document.querySelector(".canvas-footer span:last-child").textContent;

  loadLocal();
  updateInfo();

  window.addEventListener("resize", () => { if (dim === "3d") resize3(); });
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => { if (dim === "3d") resize3(); }).observe(shell);
  }
})();
