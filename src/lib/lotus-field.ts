/*
 * The lotus field.
 *
 * Not a particle soup. Each lotus is a locus, each route a declared edge
 * between two of them, and every packet travels one route and makes the
 * receiving lotus pulse. The lotuses sit on the petal curves of one large
 * lotus, two layers deep, with a core and a cradle, so the field reads as
 * one structure made of small ones. Drawn in the page's own tokens
 * (--lotus-petal, --lotus-core, --lotus-line), so it follows the theme.
 *
 * Lifecycle: one still frame under reduced motion, no frames while the
 * tab is hidden or the field is off screen, and a bailout only after
 * sustained slow frames once the page has settled. The host element
 * carries data-lotus = still | live N | bailed, so a reader (or a test)
 * can tell which state it is in.
 */
// @ts-nocheck: canvas geometry, kept close to the prototype it was tuned in.
var TAU = Math.PI * 2;
function seeded(seed) {
  var s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5; var v = s;
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function q(a, c, b, t) { var u = 1 - t; return { x: u*u*a.x + 2*u*t*c.x + t*t*b.x, y: u*u*a.y + 2*u*t*c.y + t*t*b.y }; }
function tangent(a, c, b, t) { return { x: 2*(1-t)*(c.x-a.x) + 2*t*(b.x-c.x), y: 2*(1-t)*(c.y-a.y) + 2*t*(b.y-c.y) }; }

function ink() {
  var cs = getComputedStyle(document.documentElement);
  var v = function (n) { return cs.getPropertyValue(n).trim(); };
  return { line: v('--lotus-line') || '#5fa68a', petal: v('--ink-3') || '#8a7e72', accent: v('--lotus-petal') || '#d04a86', violet: v('--lotus-petal-2') || '#7b5bd6', core: v('--lotus-core') || '#d39a2b', ink: v('--ink') || '#1c1814' };
}
function withAlpha(color, a) {
  var c = color.trim();
  if (c[0] === '#') {
    var h = c.length === 4 ? c.slice(1).split('').map(function (x) { return x + x; }).join('') : c.slice(1);
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + clamp(a, 0, 1) + ')';
  }
  return c;
}

/* ---- scene: one large lotus, built from small ones ----
   Nodes sit on the petal curves of a macro lotus (two layers), at its
   core, and along its cradle. Routes trace the petal outlines, join
   neighbouring petals at the base, tie the inner layer to the core,
   and tie the core to the cradle. On a short, wide band the flower
   opens flat: central petals rise, outer ones sweep to the sides. */
function build(W, H, seed) {
  var rnd = seeded(seed + Math.round(W) * 17 + Math.round(H) * 31);
  var short = H < 240, narrow = W < 560, mid = W < 900;
  var outerN = short ? (narrow ? 3 : 7) : narrow ? 3 : mid ? 4 : 5;
  var innerN = short ? (narrow ? 1 : 3) : narrow ? 2 : mid ? 2 : 3;
  var bx, by, L, spread, innerSpread;
  if (short) { bx = W * 0.5; by = H * 1.12; L = H * 0.92; spread = 84; innerSpread = 48; }
  else if (narrow) { bx = W * 0.5; by = H * 0.98; L = H * 0.72; spread = 70; innerSpread = 40; }
  else { bx = W * 0.745; by = H * 0.58; L = H * 0.52; spread = 70; innerSpread = 38; }
  var nodes = [], edges = [], seen = {};
  function node(x, y, radius, depth, extra) {
    var n = { id: nodes.length, x: x + (rnd() - 0.5) * 4, y: y + (rnd() - 0.5) * 4, depth: depth, radius: radius, phase: rnd() * TAU, petals: rnd() > 0.5 ? 7 : 5, orbit: !!(extra && extra.orbit), energy: 0, hue: extra && extra.hue !== undefined ? extra.hue : (rnd() > 0.55 ? 1 : 0) };
    nodes.push(n); return n.id;
  }
  function add(a, b, through) {
    if (a === b) return; var lo = Math.min(a, b), hi = Math.max(a, b), key = lo + ":" + hi; if (seen[key]) return; seen[key] = 1;
    var na = nodes[lo], nb = nodes[hi], dx = nb.x - na.x, dy = nb.y - na.y, d = Math.max(1, Math.hypot(dx, dy));
    var c;
    if (through) c = { x: 2 * through.x - (na.x + nb.x) / 2, y: 2 * through.y - (na.y + nb.y) / 2 };
    else { var bend = (rnd() - 0.5) * Math.min(d * 0.3, 60); c = { x: (na.x + nb.x) / 2 - dy / d * bend, y: (na.y + nb.y) / 2 + dx / d * bend }; }
    edges.push({ id: edges.length, a: lo, b: hi, hue: na.hue, depth: (na.depth + nb.depth) / 2, c: c, traffic: 0, phase: rnd() * TAU });
  }
  // the petal outline, in local coordinates with the petal pointing up; sgn picks the side
  function onPetal(t, len, sgn) {
    var w = len * 0.5, p0 = { x: 0, y: len * 0.23 }, p1 = { x: -w * 0.72 * sgn, y: -len * 0.03 }, p2 = { x: -w * 0.54 * sgn, y: -len * 0.70 }, p3 = { x: 0, y: -len };
    var u = 1 - t;
    return { x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x, y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y };
  }
  function place(p, deg) { var a = deg * Math.PI / 180; return { x: bx + p.x * Math.cos(a) - p.y * Math.sin(a), y: by + p.x * Math.sin(a) + p.y * Math.cos(a) }; }
  function layer(count, spreadDeg, lenBase, depth, radiusScale) {
    var out = [];
    for (var k = 0; k < count; k++) {
      var deg = count === 1 ? 0 : (k / (count - 1) - 0.5) * 2 * spreadDeg, s = Math.abs(Math.sin(deg * Math.PI / 180)), c = Math.cos(deg * Math.PI / 180);
      var len = short ? lenBase * 0.9 + (W / 2 - lenBase * 0.9) * Math.pow(s, 1.5) : lenBase * (1 - 0.22 * s);
      len = Math.min(len, (by - 14) / Math.max(0.08, c));
      var at = function (t, sgn) { return place(onPetal(t, len, sgn), deg); };
      var dTip = depth - (short ? s * 0.25 : 0), rs = (short ? 0.75 : 1) * radiusScale;
      var l1 = at(0.32, 1), l2 = at(0.72, 1), tp = at(1, 1), r2 = at(0.72, -1), r1 = at(0.32, -1);
      var iL1 = node(l1.x, l1.y, (6 + rnd() * 2) * rs, depth), iL2 = node(l2.x, l2.y, (7 + rnd() * 2) * rs, depth);
      var iT = node(tp.x, tp.y, (11 + rnd() * 3) * rs, dTip, { orbit: rnd() > 0.5 });
      var iR2 = node(r2.x, r2.y, (7 + rnd() * 2) * rs, depth), iR1 = node(r1.x, r1.y, (6 + rnd() * 2) * rs, depth);
      add(iL1, iL2, at(0.52, 1)); add(iL2, iT, at(0.86, 1)); add(iT, iR2, at(0.86, -1)); add(iR2, iR1, at(0.52, -1));
      out.push({ l: iL1, t: iT, r: iR1 });
    }
    for (var j = 1; j < out.length; j++) add(out[j - 1].r, out[j].l);
    return out;
  }
  var core = node(bx, by - L * 0.12, short ? 14 : narrow ? 16 : 22, 1, { orbit: true, hue: 0 });
  var outer = layer(outerN, spread, L, short ? 0.62 : 0.55, 1);
  var inner = layer(innerN, innerSpread, L * 0.62, 0.82, 0.9);
  inner.forEach(function (p) { add(p.l, core); });
  inner.forEach(function (p, i) { var o = outer[Math.round((i + 0.5) / inner.length * (outer.length - 1))]; if (o) add(p.r, o.l); });
  if (!short) {
    var Lc = L * 0.55, prev = -1, cradle = [];
    for (var t = 0.1; t <= 0.91; t += 0.2) {
      var u = 1 - t, cx = u*u*u*(-Lc) + 3*u*u*t*(-0.54*Lc) + 3*u*t*t*(0.54*Lc) + t*t*t*Lc, cy = u*u*u*(0.3*Lc) + 3*u*u*t*(1.0*Lc) + 3*u*t*t*(1.0*Lc) + t*t*t*(0.3*Lc);
      var id = node(bx + cx, by + cy - L * 0.05, 7 + rnd() * 2, 0.6); cradle.push(id); if (prev >= 0) add(prev, id); prev = id;
    }
    add(cradle[0], outer[0].l); add(cradle[cradle.length - 1], outer[outer.length - 1].r); add(cradle[Math.floor(cradle.length / 2)], core);
  } else {
    add(outer[0].l, core); add(outer[outer.length - 1].r, core);
  }
  nodes.forEach(function (n) { n.x = clamp(n.x, 6, W - 6); n.y = clamp(n.y, 6, H + 30); });
  var packets = [], np = clamp(Math.round(edges.length * 0.4), 4, 26);
  for (var p = 0; p < np; p++) { var e = edges[Math.floor(rnd() * edges.length)]; if (!e) break; packets.push({ edge: e.id, dir: rnd() > 0.5 ? 1 : -1, t: rnd(), speed: 0.06 + rnd() * 0.09, size: 1.8 + rnd() * 1.6, shape: p % 3, phase: rnd() * TAU }); }
  var stars = []; var ns = clamp(Math.round((W * H) / 11000), 24, 140);
  for (var s = 0; s < ns; s++) stars.push({ x: rnd() * W, y: rnd() * H, r: 0.5 + rnd() * 1.1, a: 0.25 + rnd() * 0.5, phase: rnd() * TAU, depth: 0.25 + rnd() * 0.3 });
  return { W: W, H: H, nodes: nodes, edges: edges, packets: packets, stars: stars };
}

/* ---- drawing ---- */
function petal(ctx, r, w) {
  ctx.beginPath(); ctx.moveTo(0, r * 0.23);
  ctx.bezierCurveTo(-w * 0.72, -r * 0.03, -w * 0.54, -r * 0.70, 0, -r);
  ctx.bezierCurveTo(w * 0.54, -r * 0.70, w * 0.72, -r * 0.03, 0, r * 0.23);
}
function drawLotus(ctx, n, p, t, col) {
  var d = n.depth, breath = 1 + Math.sin(t * 0.62 + n.phase) * 0.03, rec = clamp(n.energy, 0, 1), r = n.radius * breath;
  var fade = 0.35 + d * 0.65, hc = n.hue ? col.violet : col.accent;
  ctx.save(); ctx.translate(p.x, p.y);
  if (n.orbit && r > 13) {
    ctx.strokeStyle = withAlpha(col.line, 0.55 * fade); ctx.lineWidth = 0.7; ctx.setLineDash([r * 0.12, r * 0.17]); ctx.lineDashOffset = -t * 2.2 - n.phase * 3;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.32, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = withAlpha(col.petal, 0.7 * fade);
    [[0, -1.55], [1.55, 0], [0, 1.55], [-1.55, 0]].forEach(function (pp) { ctx.beginPath(); ctx.arc(pp[0] * r, pp[1] * r, 1.3, 0, TAU); ctx.fill(); });
  }
  var layers = r < 14 ? 2 : 3;
  for (var L = 0; L < layers; L++) {
    var count = Math.max(3, n.petals - L * 2), lr = r * (1 - L * 0.25), w = lr * (0.55 - L * 0.05);
    ctx.lineWidth = clamp(r * (0.045 - L * 0.006), 0.6, 1.4);
    ctx.strokeStyle = withAlpha(L === 2 ? col.petal : hc, (L === 0 ? 0.7 : L === 1 ? 0.5 + rec * 0.3 : 0.5) * fade);
    for (var pi = 0; pi < count; pi++) { var spread = count === 1 ? 0 : pi / (count - 1) - 0.5; ctx.save(); ctx.rotate(spread * Math.PI * 0.84); petal(ctx, lr, w); ctx.stroke(); ctx.restore(); }
  }
  ctx.strokeStyle = withAlpha(col.line, (0.7 + rec * 0.2) * fade); ctx.lineWidth = clamp(r * 0.048, 0.6, 1.4);
  ctx.beginPath(); ctx.moveTo(-r * 1.02, r * 0.37); ctx.bezierCurveTo(-r * 0.54, r * 1.1, r * 0.54, r * 1.1, r * 1.02, r * 0.37); ctx.stroke();
  ctx.fillStyle = withAlpha(col.core, (0.85 + rec * 0.15) * fade); ctx.beginPath(); ctx.arc(0, r * 0.1, clamp(r * 0.16, 1.8, 4.5), 0, TAU); ctx.fill();
  if (rec > 0.02) { ctx.strokeStyle = withAlpha(hc, rec * 0.8 * fade); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r * (1.3 + (1 - rec) * 0.9), 0, TAU); ctx.stroke(); }
  ctx.restore();
}
function drawPacket(ctx, pk, pt, ang, col, fade, hc) {
  ctx.save(); ctx.translate(pt.x, pt.y); ctx.rotate(ang);
  ctx.fillStyle = withAlpha(hc, 0.95 * fade); ctx.strokeStyle = withAlpha(hc, 0.95 * fade); ctx.lineWidth = 1;
  var s = pk.size;
  if (pk.shape === 0) { ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, TAU); ctx.fill(); }
  else if (pk.shape === 1) { ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.72, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.72, 0); ctx.closePath(); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(0, 0, s * 0.75, 0, TAU); ctx.stroke(); }
  ctx.restore();
}
function step(sc, dt) {
  sc.edges.forEach(function (e) { e.traffic *= Math.pow(0.15, dt); });
  sc.nodes.forEach(function (n) { n.energy *= Math.pow(0.08, dt); });
  sc.packets.forEach(function (pk) {
    var e = sc.edges[pk.edge]; pk.t += pk.speed * dt * pk.dir; e.traffic = Math.min(1.4, e.traffic + 0.22);
    if (pk.t >= 1 || pk.t <= 0) {
      var at = pk.t >= 1 ? e.b : e.a; sc.nodes[at].energy = Math.min(1.3, sc.nodes[at].energy + 0.8);
      var cands = sc.edges.filter(function (x) { return (x.a === at || x.b === at) && x.id !== e.id; });
      if (!cands.length) cands = [e];
      var nx = cands[Math.floor((pk.phase * 1000 + at) % cands.length)];
      pk.edge = nx.id; pk.dir = nx.a === at ? 1 : -1; pk.t = pk.dir === 1 ? 0 : 1;
    }
  });
}
function draw(ctx, sc, t, col, cam) {
  ctx.clearRect(0, 0, sc.W, sc.H);
  var project = function (p, depth) { return { x: (p.x - sc.W / 2) * cam.zoom + sc.W / 2 + cam.x * depth, y: (p.y - sc.H / 2) * cam.zoom + sc.H / 2 + cam.y * depth }; };
  sc.stars.forEach(function (s) { var tw = 0.5 + 0.5 * Math.sin(t * 0.7 + s.phase) * Math.sin(t * 0.7 + s.phase); var p = project(s, s.depth); ctx.fillStyle = withAlpha(col.petal, s.a * tw); ctx.beginPath(); ctx.arc(p.x, p.y, s.r, 0, TAU); ctx.fill(); });
  var order = sc.edges.slice().sort(function (a, b) { return a.depth - b.depth; });
  order.forEach(function (e) {
    var a = project(sc.nodes[e.a], e.depth), b = project(sc.nodes[e.b], e.depth), c = project(e.c, e.depth), fade = 0.35 + e.depth * 0.65, pulse = 0.72 + Math.sin(t * 0.28 + e.phase) * 0.18;
    ctx.strokeStyle = withAlpha(col.line, (0.55 + e.traffic * 0.35) * pulse * fade); ctx.lineWidth = (0.7 + e.traffic * 0.5) * (0.7 + e.depth * 0.3);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c.x, c.y, b.x, b.y); ctx.stroke();
    var m = q(a, c, b, 0.5); ctx.fillStyle = withAlpha(col.core, (0.5 + e.traffic * 0.4) * fade); ctx.beginPath(); ctx.arc(m.x, m.y, 1.1 + e.traffic, 0, TAU); ctx.fill();
  });
  sc.nodes.slice().sort(function (a, b) { return a.depth - b.depth; }).forEach(function (n) { drawLotus(ctx, n, project(n, n.depth), t, col); });
  sc.packets.forEach(function (pk) { var e = sc.edges[pk.edge], a = project(sc.nodes[e.a], e.depth), b = project(sc.nodes[e.b], e.depth), c = project(e.c, e.depth), tt = clamp(pk.t, 0, 1), pt = q(a, c, b, tt), tg = tangent(a, c, b, tt); drawPacket(ctx, pk, pt, Math.atan2(tg.y, tg.x), col, 0.35 + e.depth * 0.65, col.core); });
}

/* ---- lifecycle ---- */
var pointer = { x: 0, y: 0 };
window.addEventListener('pointermove', function (ev) { pointer.x = (ev.clientX / window.innerWidth - 0.5) * 2; pointer.y = (ev.clientY / window.innerHeight - 0.5) * 2; }, { passive: true });

function mount(host) {
  var canvas = host.querySelector('canvas'); if (!canvas) return;
  var ctx = canvas.getContext('2d'); if (!ctx) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var sc = null, col = ink(), raf = 0, live = false, t0 = 0, last = 0, slow = 0, bailed = false, frames = 0, budget = 1200000;
  var cam = { x: 0, y: 0, zoom: 1 }, px = 0, py = 0;
  function size() {
    var r = canvas.getBoundingClientRect(); if (!r.width || !r.height) return false;
    var k = Math.min(window.devicePixelRatio || 1, Math.sqrt(budget / (r.width * r.height)));
    canvas.width = Math.max(1, Math.round(r.width * k)); canvas.height = Math.max(1, Math.round(r.height * k)); ctx.setTransform(k, 0, 0, k, 0, 0);
    sc = build(r.width, r.height, 7); return true;
  }
  function paint(t) {
    px += (pointer.x * 14 - px) * 0.04; py += (pointer.y * 10 - py) * 0.04;
    cam.x = px + Math.sin(t * 0.11) * 6; cam.y = py + Math.cos(t * 0.09) * 4; cam.zoom = 1 + Math.sin(t * 0.07) * 0.015;
    draw(ctx, sc, t, col, cam);
  }
  function frame(now) {
    if (!live) return;
    if (!t0) t0 = now;
    var t = (now - t0) / 1000;
    if (last) {
      var dt = now - last;
      // measure only once the page has settled, and bail only on a sustained stall
      if (t > 2 && dt > 80) { if (++slow > 12) { bailed = true; host.setAttribute('data-lotus', 'bailed'); stop(); return; } } else slow = 0;
      step(sc, Math.min(dt, 50) / 1000);
    }
    last = now; frames++;
    if (frames === 1 || frames % 30 === 0) host.setAttribute('data-lotus', 'live ' + frames);
    paint(t); raf = requestAnimationFrame(frame);
  }
  function stop() { live = false; cancelAnimationFrame(raf); }
  function start() { if (!live && !bailed) { live = true; last = 0; raf = requestAnimationFrame(frame); } }
  function boot() {
    stop(); if (!size()) return; step(sc, 2); paint(0); host.setAttribute('data-lotus', 'still');
    if (reduced.matches) return;
    new IntersectionObserver(function (es) { es[0].isIntersecting && !document.hidden ? start() : stop(); }, { threshold: 0 }).observe(host);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (!bailed && !reduced.matches) start(); });
  var rt = 0; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(boot, 160); });
  reduced.addEventListener('change', boot);
  new MutationObserver(function () { col = ink(); if (sc) paint(0); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { col = ink(); if (sc) paint(0); });
  boot();
}

export function mountLotusFields(root: ParentNode = document) {
  root.querySelectorAll('.lotus-field').forEach((el) => mount(el as HTMLElement));
}
