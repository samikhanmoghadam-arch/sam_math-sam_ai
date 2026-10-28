"use strict";
/*
  حالت سه‌بعدی هندسه (نسخهٔ ۲).
  بوم جدا (geometry3dCanvas) فقط در حالت «سه‌بعدی» دیده می‌شود؛ بوم دو‌بعدی (geometry.js)
  دست‌نخورده می‌ماند و با برگشت به «دو‌بعدی» همان بوم قبلی نمایش داده می‌شود.

  قابلیت‌ها: انتخاب و جابه‌جایی شکل با موس/انگشت یا کلیدها، چرخش هر شکل با اسلایدر،
  بزرگ/کوچک‌کردن، تکثیر، رنگ، پر/خالی‌کردن وجه‌ها، نماهای آماده، شبکه، بازگشت، ذخیره و دانلود.
  واسط برای دستیار صوتی و دستور: window.SAMGeometry3D
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
  const LIMIT = 10;            // طول محورها و شبکهٔ کف
  const BOX = 12;              // شکل‌ها داخل |x|,|z| ≤ ۱۲ و ۰ ≤ y ≤ ۱۲ می‌مانند
  const CAM = 40;              // فاصلهٔ دوربین؛ عدد بزرگ‌تر یعنی پرسپکتیو ملایم‌تر
  const DEFAULT_YAW = -0.6;
  const DEFAULT_PITCH = 0.45;
  const PALETTE = ["#67e8f9", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#38bdf8", "#fb923c"];
  const NAMES = {
    circle: "دایرهٔ سه‌بعدی",
    vcircle: "دایرهٔ عمودی",
    square: "مربع (صفحه)",
    sphere: "کره",
    hemisphere: "نیم‌کره",
    cube: "مکعب",
    cuboid: "مکعب‌مستطیل",
    cylinder: "استوانه",
    cone: "مخروط",
    tcone: "مخروط ناقص",
    pyramid: "هرم چهارگوش",
    hexpyramid: "هرم شش‌ضلعی",
    tetra: "هرم سه‌وجهی",
    prism: "منشور مثلثی",
    octa: "هشت‌وجهی"
  };
  const KINDS = Object.keys(NAMES);
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
  let selected = null;          // شناسهٔ شکل انتخاب‌شده
  let showGrid = true, fillFaces = true;
  let drag = null;              // {type:'orbit'} یا {type:'solid', ...}
  let spinning = false, selfSpin = false, rafId = 0;
  let sliderSnap = null;
  let origTitle = "", origDesc = "", origNote = "";

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmt = n => String(+n.toFixed(2));
  const say = text => { status.textContent = text; };
  const isDay = () => body.classList.contains("day");
  const deg = r => Math.round(r * 180 / Math.PI);
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  /* ---------- بردار و رنگ ---------- */

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
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
  // رنگ هگزا به RGB؛ در حالت روز کمی تیره‌تر تا روی پس‌زمینهٔ روشن دیده شود
  function rgbOf(hex) {
    const n = parseInt(hex.slice(1), 16);
    const k = isDay() ? 0.5 : 1;
    return [((n >> 16) & 255) * k, ((n >> 8) & 255) * k, (n & 255) * k];
  }
  const strokeOf = hex => { const [r, g, b] = rgbOf(hex); return `rgb(${r | 0},${g | 0},${b | 0})`; };
  const fillOf = (hex, a) => { const [r, g, b] = rgbOf(hex); return `rgba(${r | 0},${g | 0},${b | 0},${a})`; };
  const colorOf = s => s.color || PALETTE[(s.id - 1) % PALETTE.length];

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

  // شبکهٔ کره: نصف‌النهارها و مدارهای موازی
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
      case "tcone": {
        // مخروط ناقص: قاعدهٔ بزرگ به شعاع R، قاعدهٔ بالایی به شعاع R/2
        const lines = [ring(R, 0), ring(R / 2, 2 * R)];
        for (let k = 0; k < 8; k++) {
          const t = TAU * k / 8;
          lines.push([[R * Math.cos(t), 0, R * Math.sin(t)], [R / 2 * Math.cos(t), 2 * R, R / 2 * Math.sin(t)]]);
        }
        return { lines };
      }
      case "pyramid":
        return {
          verts: [[-R, 0, -R], [R, 0, -R], [R, 0, R], [-R, 0, R], [0, 2 * R, 0]],
          faces: [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]]
        };
      case "hexpyramid": {
        const verts = [];
        for (let k = 0; k < 6; k++) {
          const t = TAU * k / 6;
          verts.push([R * Math.cos(t), 0, R * Math.sin(t)]);
        }
        verts.push([0, 2 * R, 0]);
        const faces = [[0, 1, 2, 3, 4, 5]];
        for (let k = 0; k < 6; k++) faces.push([k, (k + 1) % 6, 6]);
        return { verts, faces };
      }
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
      case "tcone": return vol(7 / 6 * P * r ** 3, P * r * r * (1.5 * Math.sqrt(4.25) + 1.25));
      case "pyramid": {
        const a = 2 * r, l = r * Math.sqrt(5);
        return vol(a * a * 2 * r / 3, a * a + 2 * a * l);
      }
      case "hexpyramid": {
        const base = 1.5 * Math.sqrt(3) * r * r, l = r * Math.sqrt(4.75);
        return vol(Math.sqrt(3) * r ** 3, base + 3 * r * l);
      }
      case "tetra": return vol(8 / 3 * r ** 3, 8 * Math.sqrt(3) * r * r);
      case "prism": return vol(1.5 * Math.sqrt(3) * r ** 3, 7.5 * Math.sqrt(3) * r * r);
      case "octa": return vol(4 / 3 * r ** 3, 4 * Math.sqrt(3) * r * r);
      default: return "";
    }
  }

  /* ---------- تبدیل‌ها ---------- */

  // چرخش خود شکل (rx، ry، rz بر حسب رادیان) قبل از جابه‌جایی به مکانش
  function orient(v, s) {
    let x = v[0], y = v[1], z = v[2];
    const cx = Math.cos(s.rx || 0), sx = Math.sin(s.rx || 0);
    [y, z] = [y * cx - z * sx, y * sx + z * cx];
    const cy = Math.cos(s.ry || 0), sy = Math.sin(s.ry || 0);
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    const cz = Math.cos(s.rz || 0), sz = Math.sin(s.rz || 0);
    [x, y] = [x * cz - y * sz, x * sz + y * cz];
    return [x, y, z];
  }

  // چرخش نما: اول حول محور y (yaw) سپس حول محور x (pitch)
  function camRot(p) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = p[0] * cy + p[2] * sy;
    const z1 = -p[0] * sy + p[2] * cy;
    const y2 = p[1] * cp - z1 * sp;
    const z2 = p[1] * sp + z1 * cp;
    return [x1, y2, z2];
  }

  // وارون camRot: از مختصات دوربین به مختصات جهانی (برای جابه‌جایی روی صفحهٔ نما)
  function unCam(q) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const y1 = q[1] * cp + q[2] * sp;
    const z1 = -q[1] * sp + q[2] * cp;
    return [q[0] * cy - z1 * sy, y1, q[0] * sy + z1 * cy];
  }

  // از مختصات محلی شکل تا مختصات دوربین
  const place = (v, s) => camRot(add(orient(v, s), s.pos));

  // تصویر روی صفحه؛ عمق (z) برای ترتیب رسم و تشخیص روی/پشت
  function project(v) {
    const k = base * zoom * CAM / (CAM - v[2]);
    return [W / 2 + v[0] * k, H / 2 - v[1] * k, v[2]];
  }

  const scaleAt = s => base * zoom * CAM / (CAM - camRot(s.pos)[2]);

  function strokeLine(a, b) {
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }

  /* ---------- ساخت لبه‌ها و وجه‌ها در مختصات دوربین ---------- */

  function buildSolid(s) {
    const g = geometryOf(s.kind, s.size);
    if (!g) return null;
    if (g.faces) {
      const R3 = g.verts.map(v => place(v, s));
      const center = avg(R3);
      const faces = g.faces.map(f => {
        const a = R3[f[0]], b = R3[f[1]], c = R3[f[2]];
        let n = cross(sub(b, a), sub(c, a));
        const fc = avg(f.map(i => R3[i]));
        // قطبیت: نرمال باید به بیرون شکل اشاره کند
        if (dot(n, sub(fc, center)) < 0) n = n.map(v => -v);
        return { idx: f, pts: f.map(i => R3[i]), front: n[2] > 0, depth: fc[2] };
      });
      // هر لبه وقتی «رو» است که حداقل یکی از وجه‌های مجاورش رو به دوربین باشد
      const edges = new Map();
      for (const f of faces) {
        f.idx.forEach((a, k) => {
          const b = f.idx[(k + 1) % f.idx.length];
          const key = a < b ? `${a}-${b}` : `${b}-${a}`;
          const e = edges.get(key) || { p: R3[a], q: R3[b], front: false };
          e.front = e.front || f.front;
          edges.set(key, e);
        });
      }
      return { faces, edges: [...edges.values()] };
    }
    const edges = [];
    for (const line of g.lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const p = place(line[i], s), q = place(line[i + 1], s);
        edges.push({ p, q, front: (p[2] + q[2]) / 2 >= 0 });
      }
    }
    return { faces: [], edges };
  }

  function drawSolid(s, bs, highlight) {
    if (!bs) return;
    const hex = colorOf(s);
    ctx.save();
    if (highlight) {
      // هاله‌ی درخشان دور شکل انتخاب‌شده
      ctx.shadowColor = hex;
      ctx.shadowBlur = 22;
    }

    if (fillFaces) {
      // وجه‌های رو به دوربین پر می‌شوند؛ از دورتر به نزدیک‌تر
      const visible = bs.faces.filter(f => f.front).sort((a, b) => a.depth - b.depth);
      for (const f of visible) {
        ctx.beginPath();
        f.pts.forEach((p, k) => {
          const q = project(p);
          if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
        });
        ctx.closePath();
        ctx.fillStyle = fillOf(hex, 0.16);
        ctx.fill();
      }
    }

    ctx.strokeStyle = strokeOf(hex);
    ctx.lineWidth = highlight ? 2.8 : 1.8;
    for (const e of bs.edges) {
      ctx.globalAlpha = e.front ? 1 : 0.3;
      ctx.beginPath();
      strokeLine(project(e.p), project(e.q));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGrid() {
    const L = LIMIT;
    if (showGrid) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = isDay() ? "rgba(71,85,105,.22)" : "rgba(148,163,184,.16)";
      ctx.beginPath();
      for (let i = -L; i <= L; i++) {
        strokeLine(project(camRot([i, 0, -L])), project(camRot([i, 0, L])));
        strokeLine(project(camRot([-L, 0, i])), project(camRot([L, 0, i])));
      }
      ctx.stroke();

      const axes = [
        { a: [-L, 0, 0], b: [L, 0, 0], end: [L + 0.7, 0, 0], c: "#f87171", label: "x" },
        { a: [0, -L, 0], b: [0, L, 0], end: [0, L + 0.7, 0], c: "#34d399", label: "y" },
        { a: [0, 0, -L], b: [0, 0, L], end: [0, 0, L + 0.7], c: "#60a5fa", label: "z" }
      ];
      ctx.lineWidth = 1.6;
      for (const ax of axes) {
        const col = strokeOf(ax.c);
        ctx.strokeStyle = col;
        ctx.beginPath();
        strokeLine(project(camRot(ax.a)), project(camRot(ax.b)));
        ctx.stroke();
        const e = project(camRot(ax.end));
        ctx.fillStyle = col;
        ctx.font = "bold 13px system-ui";
        ctx.fillText(ax.label, e[0] + 4, e[1]);
      }
    }

    const o = project(camRot([0, 0, 0]));
    ctx.fillStyle = isDay() ? "#334155" : "#e2e8f0";
    ctx.beginPath();
    ctx.arc(o[0], o[1], 3, 0, TAU);
    ctx.fill();
  }

  function sortedItems() {
    return solids
      .map(s => ({ s, bs: buildSolid(s), d: camRot(s.pos)[2] }))
      .sort((a, b) => a.d - b.d);
  }

  function draw3() {
    if (dim !== "3d" || !W || !H) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = isDay() ? "#f2f7fc" : "#0b1221";
    ctx.fillRect(0, 0, W, H);
    drawGrid();

    // شکل‌های دورتر اول رسم می‌شوند تا نزدیک‌ترها روی آن‌ها بنشینند
    for (const it of sortedItems()) drawSolid(it.s, it.bs, it.s.id === selected);

    coords.textContent = `چرخش: ${deg(yaw)}° · شیب: ${deg(pitch)}° · بزرگ‌نمایی: ${Math.round(zoom * 100)}%`;
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

  /* ---------- انتخاب با موس ---------- */

  function pointInPoly(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > py) !== (b[1] > py) && px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0]) {
        inside = !inside;
      }
    }
    return inside;
  }

  function distToSeg(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 ? clamp(((px - a[0]) * dx + (py - a[1]) * dy) / len2, 0, 1) : 0;
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  }

  // جلوترین شکلی که زیر نشانگر است (چندوجهی: درون وجه‌های رو به دوربین، یا نزدیک لبه‌ها)
  function hitSolid(x, y) {
    const items = sortedItems();
    for (let i = items.length - 1; i >= 0; i--) {
      const { s, bs } = items[i];
      if (!bs) continue;
      if (fillFaces) {
        for (const f of bs.faces) {
          if (!f.front) continue;
          if (pointInPoly(x, y, f.pts.map(project))) return s;
        }
      }
      for (const e of bs.edges) {
        if (distToSeg(x, y, project(e.p), project(e.q)) < 9) return s;
      }
    }
    return null;
  }

  function canvasPos(event) {
    const r = canvas.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }

  /* ---------- ذخیره، تاریخچه و وضعیت ---------- */

  function saveLocal() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ solids, nextId, yaw, pitch, zoom, showGrid, fillFaces }));
    } catch (_) {}
  }

  function loadLocal() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!d || !Array.isArray(d.solids)) return;
      solids = d.solids
        .filter(s => s && NAMES[s.kind] && Number.isFinite(s.size) && Array.isArray(s.pos) && Number.isFinite(s.id))
        .map(s => ({
          // نسخه‌های قدیمی بدون چرخش و رنگ هم بارگذاری می‌شوند
          id: s.id, kind: s.kind, size: clamp(s.size, 0.5, 6), pos: clampPos(s.pos),
          rx: Number(s.rx) || 0, ry: Number(s.ry) || 0, rz: Number(s.rz) || 0,
          color: typeof s.color === "string" && /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : undefined
        }));
      nextId = Number(d.nextId) || solids.reduce((m, s) => Math.max(m, s.id), 0) + 1;
      if (Number.isFinite(d.yaw)) yaw = d.yaw;
      if (Number.isFinite(d.pitch)) pitch = clamp(d.pitch, -1.5, 1.5);
      if (Number.isFinite(d.zoom)) zoom = clamp(d.zoom, 0.35, 4);
      if (typeof d.showGrid === "boolean") showGrid = d.showGrid;
      if (typeof d.fillFaces === "boolean") fillFaces = d.fillFaces;
    } catch (_) {}
  }

  function clampPos(p) {
    return [clamp(p[0], -BOX, BOX), clamp(p[1], 0, BOX), clamp(p[2], -BOX, BOX)];
  }

  function pushPast(snapshot) {
    past.push(snapshot || JSON.stringify(solids));
    if (past.length > 60) past.shift();
  }

  const selectedSolid = () => solids.find(s => s.id === selected) || null;

  function updateInfo() {
    const s = selectedSolid();
    if (s) {
      info.textContent =
        `${NAMES[s.kind]} · ${measures(s.kind, s.size)} · ` +
        `مکان: (${fmt(s.pos[0])}، ${fmt(s.pos[1])}، ${fmt(s.pos[2])}) · ` +
        `چرخش: x ${deg(s.rx || 0)}°، y ${deg(s.ry || 0)}°، z ${deg(s.rz || 0)}°`;
      syncControls();
      return;
    }
    if (!solids.length) {
      info.textContent = "هنوز شکل سه‌بعدی‌ای ساخته نشده است.";
      return;
    }
    const counts = {};
    solids.forEach(x => { counts[x.kind] = (counts[x.kind] || 0) + 1; });
    const summary = Object.entries(counts).map(([k, n]) => `${NAMES[k]}×${n}`).join("، ");
    info.textContent = `${solids.length} شکل در فضا (${summary}). برای ویرایش یکی را انتخاب کن.`;
    syncControls();
  }

  // کنترل‌های سمت راست را با شکل انتخاب‌شده هماهنگ می‌کند
  function syncControls() {
    const s = selectedSolid();
    const set = (id, v) => { const el = $(id); if (el) el.value = v; };
    const disabled = !s;
    ["rxIn", "ryIn", "rzIn", "scaleUpBtn", "scaleDownBtn", "applySizeBtn", "dupBtn", "delete3dBtn", "selfSpinToggle"]
      .forEach(id => { const el = $(id); if (el) el.disabled = disabled; });
    set("rxIn", s ? deg(s.rx || 0) : 0);
    set("ryIn", s ? deg(s.ry || 0) : 0);
    set("rzIn", s ? deg(s.rz || 0) : 0);
    if (s) set("size3d", s.size);
    $("rxVal").textContent = `${s ? deg(s.rx || 0) : 0}°`;
    $("ryVal").textContent = `${s ? deg(s.ry || 0) : 0}°`;
    $("rzVal").textContent = `${s ? deg(s.rz || 0) : 0}°`;
    const cur = s ? colorOf(s) : null;
    document.querySelectorAll(".swatch").forEach(b => b.classList.toggle("on", b.dataset.color === cur));
  }

  function commit(message) {
    saveLocal();
    draw3();
    updateInfo();
    if (message) say(message);
  }

  function select(id) {
    selected = id;
    if (selfSpin && !selectedSolid()) { selfSpin = false; $("selfSpinToggle").checked = false; }
    updateInfo();
    draw3();
  }

  function addSolid(kind, sizeArg) {
    const R = clamp(Number(sizeArg) || Number($("size3d").value) || 2, 0.5, 6);
    pushPast();
    const pos = clampPos(POSITIONS[solids.length % POSITIONS.length].slice());
    const id = nextId++;
    solids.push({ id, kind, size: R, pos, rx: 0, ry: 0, rz: 0, color: PALETTE[(id - 1) % PALETTE.length] });
    selected = id;
    commit(`${NAMES[kind]} ساخته شد و انتخاب شد. با موس یا کلیدهای جهت‌نما جابه‌جایش کن.`);
  }

  function undo3() {
    if (!past.length) {
      say("تغییری برای بازگشت در فضای سه‌بعدی نیست.");
      return;
    }
    solids = JSON.parse(past.pop());
    if (!selectedSolid()) selected = null;
    commit("آخرین تغییر برگشت داده شد.");
  }

  function deleteSelected() {
    const s = selectedSolid();
    if (!s) {
      say("اول یک شکل را انتخاب کن.");
      return;
    }
    pushPast();
    solids = solids.filter(x => x.id !== s.id);
    selected = null;
    commit(`${NAMES[s.kind]} حذف شد.`);
  }

  function clearAll3() {
    if (!solids.length) {
      say("فضای سه‌بعدی از قبل خالی است.");
      return;
    }
    pushPast();
    solids = [];
    selected = null;
    commit("شکل‌های سه‌بعدی پاک شدند. با «بازگشت» می‌توانی برگردانی.");
  }

  // تغییرات شکل انتخاب‌شده؛ هر کدام یک مرحلهٔ بازگشت است
  function editSelected(fn, message) {
    const s = selectedSolid();
    if (!s) {
      say("اول یک شکل را انتخاب کن.");
      return;
    }
    pushPast();
    fn(s);
    commit(message);
  }

  function scaleSelected(factor) {
    editSelected(s => { s.size = clamp(s.size * factor, 0.5, 6); },
      factor > 1 ? "شکل بزرگ‌تر شد." : "شکل کوچک‌تر شد.");
  }

  function duplicateSelected() {
    const s = selectedSolid();
    if (!s) {
      say("اول یک شکل را انتخاب کن.");
      return;
    }
    pushPast();
    const copy = { ...s, id: nextId++, pos: clampPos([s.pos[0] + 1.5, s.pos[1], s.pos[2] + 1.5]) };
    solids.push(copy);
    selected = copy.id;
    commit("شکل تکثیر شد.");
  }

  /* ---------- نما: چرخش، زوم، نماهای آماده ---------- */

  function zoomBy(factor) {
    zoom = clamp(zoom * factor, 0.35, 4);
    draw3();
    saveLocal();
  }

  function setView(y, p, label) {
    yaw = y;
    pitch = p;
    draw3();
    saveLocal();
    say(label);
  }

  function resetView() {
    zoom = 1;
    setView(DEFAULT_YAW, DEFAULT_PITCH, "نما بازنشانی شد.");
  }

  // همهٔ شکل‌ها را تا حد امکان داخل کادر می‌آورد
  function fitScene() {
    const extent = solids.reduce((m, s) => Math.max(m, Math.abs(s.pos[0]) + s.size * 2, Math.abs(s.pos[2]) + s.size * 2), 6);
    zoom = clamp(6 / extent, 0.35, 1.6);
    draw3();
    saveLocal();
    say("صحنه در کادر جا شد.");
  }

  function tick() {
    rafId = 0;
    if (dim !== "3d") return;
    let changed = false;
    if (spinning) { yaw += 0.012; changed = true; }
    if (selfSpin) {
      const s = selectedSolid();
      if (s) {
        s.ry = wrap((s.ry || 0) + 0.02);
        changed = true;
      }
    }
    if (changed) {
      draw3();
      if (selfSpin) updateInfo();
    }
    if (spinning || selfSpin) rafId = requestAnimationFrame(tick);
  }

  function ensureLoop() {
    if ((spinning || selfSpin) && dim === "3d" && !rafId) rafId = requestAnimationFrame(tick);
  }

  function toggleSpin() {
    spinning = !spinning;
    $("auto3dBtn").textContent = spinning ? "⏸ توقف چرخش" : "↻ چرخش خودکار";
    if (!spinning) saveLocal();
    ensureLoop();
  }

  /* ---------- حالت دو‌بعدی / سه‌بعدی ---------- */

  function setDim(next) {
    if (next === dim) return;
    dim = next;
    body.classList.toggle("dim-3d", dim === "3d");
    document.querySelectorAll(".dim-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.dim === dim));

    $("toolsTitle").textContent = dim === "3d" ? "افزودن و ویرایش سه‌بعدی" : "ابزارهای رسم";
    document.querySelector(".canvas-heading h1").textContent = dim === "3d" ? "فضای سه‌بعدی" : origTitle;
    document.querySelector(".canvas-heading p").textContent = dim === "3d"
      ? "شکل را بکش تا جابه‌جا شود و فضای خالی را بکش تا بچرخد؛ با چرخ موس بزرگ‌نمایی کن."
      : origDesc;
    document.querySelector(".canvas-footer span:last-child").textContent = dim === "3d"
      ? "فضای سه‌بعدی: هر شکل داخل مکعب ۲۴ واحدی می‌ماند"
      : origNote;

    if (dim === "3d") {
      resize3();
      updateInfo();
      say("حالت سه‌بعدی فعال شد. یک شکل بساز یا روی شکل موجود کلیک کن.");
    } else {
      spinning = false;
      selfSpin = false;
      cancelAnimationFrame(rafId);
      rafId = 0;
      $("auto3dBtn").textContent = "↻ چرخش خودکار";
      $("selfSpinToggle").checked = false;
      coords.textContent = "x: 0 · y: 0";
      say("حالت دو‌بعدی فعال شد.");
    }
  }

  /* ---------- رویدادها ---------- */

  document.querySelectorAll(".dim-btn").forEach(b =>
    b.addEventListener("click", () => setDim(b.dataset.dim)));

  document.querySelectorAll("[data-solid]").forEach(b =>
    b.addEventListener("click", () => addSolid(b.dataset.solid)));

  // دکمه‌های رنگ
  const swatchWrap = $("swatches");
  PALETTE.forEach(c => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.dataset.color = c;
    b.title = "رنگ شکل";
    b.setAttribute("aria-label", "رنگ " + c);
    b.style.background = c;
    b.addEventListener("click", () => editSelected(s => { s.color = c; }, "رنگ شکل عوض شد."));
    swatchWrap.appendChild(b);
  });

  // اسلایدرهای چرخش: هر کشیدن یک مرحلهٔ بازگشت است
  [["rxIn", "rx"], ["ryIn", "ry"], ["rzIn", "rz"]].forEach(([id, key]) => {
    const el = $(id);
    el.addEventListener("pointerdown", () => {
      if (!sliderSnap) sliderSnap = JSON.stringify(solids);
    });
    el.addEventListener("input", () => {
      const s = selectedSolid();
      if (!s) return;
      s[key] = Number(el.value) * Math.PI / 180;
      draw3();
      updateInfo();
    });
    el.addEventListener("change", () => {
      if (sliderSnap) pushPast(sliderSnap);
      sliderSnap = null;
      saveLocal();
    });
  });

  $("scaleUpBtn").addEventListener("click", () => scaleSelected(1.2));
  $("scaleDownBtn").addEventListener("click", () => scaleSelected(1 / 1.2));
  $("applySizeBtn").addEventListener("click", () => {
    const v = clamp(Number($("size3d").value) || 2, 0.5, 6);
    editSelected(s => { s.size = v; }, `اندازهٔ شکل روی ${v} تنظیم شد.`);
  });
  $("dupBtn").addEventListener("click", duplicateSelected);
  $("delete3dBtn").addEventListener("click", deleteSelected);
  $("clear3dBtn").addEventListener("click", clearAll3);

  $("selfSpinToggle").addEventListener("change", event => {
    selfSpin = event.target.checked && !!selectedSolid();
    if (event.target.checked && !selfSpin) say("اول یک شکل را انتخاب کن تا خودش بچرخد.");
    ensureLoop();
  });

  $("viewFrontBtn").addEventListener("click", () => setView(0, 0, "نمای روبه‌رو."));
  $("viewTopBtn").addEventListener("click", () => setView(0, 1.5, "نمای بالا."));
  $("viewIsoBtn").addEventListener("click", () => setView(-Math.PI / 4, 0.615, "نمای ایزومتریک."));
  $("reset3dBtn").addEventListener("click", resetView);
  $("auto3dBtn").addEventListener("click", toggleSpin);
  $("fitSceneBtn").addEventListener("click", fitScene);

  $("gridToggle").addEventListener("change", event => {
    showGrid = event.target.checked;
    draw3();
    saveLocal();
  });
  $("fillToggle").addEventListener("change", event => {
    fillFaces = event.target.checked;
    draw3();
    saveLocal();
  });

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

  // کلیدهای سه‌بعدی؛ میانبرهای دو‌بعدی در این حالت اجرا نمی‌شوند
  document.addEventListener("keydown", event => {
    if (dim !== "3d") return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const s = selectedSolid();
    const step = event.shiftKey ? 1 : 0.25;
    const move = (d) => {
      pushPast();
      s.pos = clampPos(add(s.pos, d));
      commit();
    };
    const key = event.key;
    let handled = true;
    if (key === "Escape") {
      select(null);
      say("انتخاب لغو شد.");
    } else if ((key === "z" || key === "Z") && (event.ctrlKey || event.metaKey)) {
      undo3();
    } else if (s && key === "ArrowLeft") move(unCam([-step, 0, 0]));
    else if (s && key === "ArrowRight") move(unCam([step, 0, 0]));
    else if (s && key === "ArrowUp") move(unCam([0, step, 0]));
    else if (s && key === "ArrowDown") move(unCam([0, -step, 0]));
    else if (s && key === "PageUp") move([0, step, 0]);
    else if (s && key === "PageDown") move([0, -step, 0]);
    else if (s && (key === "Delete" || key === "Backspace")) deleteSelected();
    else handled = false;
    if (handled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    } else {
      event.stopImmediatePropagation();
    }
  }, true);

  canvas.addEventListener("pointerdown", event => {
    const p = canvasPos(event);
    canvas.setPointerCapture(event.pointerId);
    const hit = hitSolid(p.x, p.y);
    if (hit) {
      selected = hit.id;
      drag = {
        type: "solid", id: hit.id, x: p.x, y: p.y,
        startPos: hit.pos.slice(), k: scaleAt(hit),
        before: JSON.stringify(solids), moved: false
      };
      updateInfo();
    } else {
      selected = null;
      drag = { type: "orbit", x: p.x, y: p.y, yaw, pitch };
      updateInfo();
    }
    draw3();
  });

  canvas.addEventListener("pointermove", event => {
    const p = canvasPos(event);
    if (!drag) return;
    if (drag.type === "orbit") {
      yaw = drag.yaw + (p.x - drag.x) * 0.008;
      pitch = clamp(drag.pitch + (p.y - drag.y) * 0.008, -1.5, 1.5);
      draw3();
      return;
    }
    const s = solids.find(x => x.id === drag.id);
    if (!s) return;
    // جابه‌جایی روی صفحهٔ نما: حرکت موس به واحد جهانی، با وارون چرخش نما
    const cx = (p.x - drag.x) / drag.k;
    const cy = -(p.y - drag.y) / drag.k;
    const d = unCam([cx, cy, 0]);
    s.pos = clampPos(add(drag.startPos, d));
    drag.moved = true;
    draw3();
    updateInfo();
  });

  const endDrag = () => {
    if (!drag) return;
    if (drag.type === "solid" && drag.moved && JSON.stringify(solids) !== drag.before) {
      pushPast(drag.before);
    }
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

  // تغییر حالت روز/شب از بوم دو‌بعدی به اینجا هم می‌رسد
  window.addEventListener("samgeo:theme", () => { if (dim === "3d") draw3(); });

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
    const blob = new Blob([JSON.stringify({ solids, nextId, yaw, pitch, zoom, showGrid, fillFaces }, null, 2)],
      { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sam-math-geometry-3d.json";
    a.click();
    URL.revokeObjectURL(url);
    say("فایل سه‌بعدی دانلود شد.");
  }

  /* ---------- واسط دستور و دستیار صوتی ---------- */

  // دستور solid: ساخت شکل سه‌بعدی و رفتن به حالت سه‌بعدی. متن وضعیت را برمی‌گرداند.
  function command(kind, sizeArg) {
    if (!NAMES[kind]) {
      say("نام شکل سه‌بعدی شناخته نشد. نمونه‌ها: sphere، cube، cylinder، cone، pyramid، hexpyramid، tcone.");
      return status.textContent;
    }
    setDim("3d");
    addSolid(kind, sizeArg);
    return status.textContent;
  }

  function clearFromCommand() {
    clearAll3();
    return status.textContent;
  }

  window.SAMGeometry3D = {
    KINDS,
    command,
    setDim,
    clear: clearFromCommand,
    isActive: () => dim === "3d"
  };

  /* ---------- راه‌اندازی ---------- */

  origTitle = document.querySelector(".canvas-heading h1").textContent;
  origDesc = document.querySelector(".canvas-heading p").textContent;
  origNote = document.querySelector(".canvas-footer span:last-child").textContent;

  loadLocal();
  $("gridToggle").checked = showGrid;
  $("fillToggle").checked = fillFaces;
  syncControls();
  updateInfo();

  window.addEventListener("resize", () => { if (dim === "3d") resize3(); });
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => { if (dim === "3d") resize3(); }).observe(shell);
  }
})();
