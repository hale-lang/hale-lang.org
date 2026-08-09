/*
  The shared medium.

  Every animated surface on this site is the same fluid seen from a
  different place. This module owns the parts that must not diverge: the
  medium itself, the way a cavity is drawn, the way light moves through
  it, and the lifecycle rules (a pixel budget instead of a device-pixel
  ratio, no frames for a hidden section, a real frame painted up front so
  a throttled tab never shows an empty rectangle).

  A page supplies only its scene.
*/

export const HUES = {
  jade: '46,196,163',
  cyan: '95,211,224',
  gold: '232,192,122',
  violet: '167,139,250',
  rose: '224,110,130',
} as const;

export type Hue = string;

export interface Frame {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  /** seconds since mount */
  t: number;
  /** 0..1 scroll progress of the host element, 0 when it does not scroll */
  p: number;
  /**
   * Rendering a tile for the page wash rather than the band itself: the
   * medium leaves its backdrop transparent so the tile carries only light,
   * and can be laid over paper of either theme.
   */
  wash?: boolean;
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const outCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const inCubic = (x: number) => Math.pow(clamp01(x), 3);

/** A 0..1..0 ramp across [a,b], for keying an effect to one beat. */
export function window_(p: number, a: number, b: number, edge = 0.12) {
  if (p <= a || p >= b) return 0;
  const u = (p - a) / (b - a);
  return Math.min(1, u / edge, (1 - u) / edge);
}

export const BG = '#05070a';

/** The fluid body: large, slow, always moving a little. */
export function medium(f: Frame, hues: Hue[] = [HUES.cyan, HUES.jade, HUES.violet], strength = 1) {
  const { ctx, W, H, t } = f;
  ctx.globalCompositeOperation = 'source-over';
  if (f.wash) {
    ctx.clearRect(0, 0, W, H);
  } else {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < hues.length; i++) {
    const a = t * (0.05 + i * 0.017) + i * 2.1;
    const cx = W * (0.5 + Math.cos(a) * 0.3);
    const cy = H * (0.5 + Math.sin(a * 0.8) * 0.32);
    const rr = Math.max(W, H) * (0.42 + i * 0.14);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, `rgba(${hues[i]},${0.052 * strength})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

/**
 * A void held open in the fluid: dark inside, bright where the light bends
 * around the boundary. This is a locus holding open a region.
 */
export function cavity(
  f: Frame, x: number, y: number, r: number, hue: Hue,
  opts: { alpha?: number; rim?: number; caustic?: boolean; wobble?: boolean } = {},
) {
  const { ctx, t } = f;
  const alpha = opts.alpha ?? 1;
  if (alpha <= 0.01 || r <= 0.4) return;
  const rr = opts.wobble === false ? r : r * (1 + Math.sin(t * 0.7 + x * 0.01) * 0.014);

  const g = ctx.createRadialGradient(x, y, rr * 0.1, x, y, rr);
  g.addColorStop(0, 'rgba(4,6,9,0.92)');
  g.addColorStop(0.62, `rgba(${hue},0.05)`);
  g.addColorStop(0.9, `rgba(${hue},${0.3 * alpha})`);
  g.addColorStop(1, `rgba(${hue},0)`);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(${hue},${(opts.rim ?? 0.5) * alpha})`;
  ctx.lineWidth = Math.max(0.6, rr * 0.012);
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, Math.PI * 2);
  ctx.stroke();

  if (opts.caustic !== false) {
    const a0 = t * 0.35 + x * 0.02;
    ctx.strokeStyle = `rgba(255,255,255,${0.24 * alpha})`;
    ctx.lineWidth = Math.max(0.5, rr * 0.02);
    ctx.beginPath();
    ctx.arc(x, y, rr * 0.985, a0, a0 + 0.7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** A travelling point of light, with a short trail behind it. */
export function spark(f: Frame, x: number, y: number, size: number, alpha: number, hue: Hue = HUES.gold) {
  const { ctx } = f;
  if (alpha <= 0.01) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, size);
  g.addColorStop(0, `rgba(255,255,255,${0.62 * alpha})`);
  g.addColorStop(0.38, `rgba(${hue},${0.5 * alpha})`);
  g.addColorStop(1, `rgba(${hue},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
}

/** The topic: structurally above everyone, which is why light goes up to it. */
export function topicLine(f: Frame, y: number, alpha: number, hue: Hue = HUES.jade) {
  const { ctx, W } = f;
  if (alpha <= 0.01) return;
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, `rgba(${hue},0)`);
  g.addColorStop(0.5, `rgba(${hue},${0.3 * alpha})`);
  g.addColorStop(1, `rgba(${hue},0)`);
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
}

/** Up to the topic, along it, then down. Never sideways. */
export function viaTopic(
  x0: number, y0: number, x1: number, y1: number, topY: number, k: number,
): [number, number] {
  const up = 0.34, along = 0.62;
  if (k < up) return [x0, lerp(y0, topY, outCubic(k / up))];
  if (k < along) {
    const u = (k - up) / (along - up);
    return [lerp(x0, x1, u), topY - Math.sin(u * Math.PI) * 12];
  }
  return [x1, lerp(topY, y1, inCubic((k - along) / (1 - along)))];
}

/**
 * Mount a scene. Returns nothing; the surface manages itself from here.
 *
 * `budget` caps the backing store by total pixels rather than by devicePixelRatio,
 * so cost does not scale with the size of somebody's monitor. These are fields of
 * soft gradients, so they upscale without visible loss.
 */
export function mount(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  scene: (f: Frame) => void,
  budget = 1_200_000,
) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const f: Frame = { ctx, W: 0, H: 0, t: 0, p: 0 };
  let raf = 0, live = false, t0 = 0, ema = 16, last = 0, slow = 0;
  // Set once a scene has failed its frame budget. Terminal for this mount:
  // a scene that could not hold 55ms is not one to re-enter on the next
  // intersection change. Only an explicit boot() clears it.
  let bailed = false;
  let scrollRaf = 0;

  function size() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const q = Math.min(window.devicePixelRatio || 1, Math.sqrt(budget / (r.width * r.height)));
    canvas.width = Math.max(1, Math.round(r.width * q));
    canvas.height = Math.max(1, Math.round(r.height * q));
    ctx!.setTransform(q, 0, 0, q, 0, 0);
    f.W = r.width;
    f.H = r.height;
    return true;
  }

  function progress() {
    const r = host.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    f.p = span > 8 ? clamp01(-r.top / span) : 0;
  }

  function paint(t: number) {
    f.t = t;
    progress();
    scene(f);
    ctx!.globalCompositeOperation = 'source-over';
    ctx!.globalAlpha = 1;
  }

  function frame(now: number) {
    if (!live) return;
    if (last) {
      const dt = now - last;
      ema = ema * 0.9 + dt * 0.1;
      // Nothing here is worth a tab that stops responding. Count consecutive
      // slow frames rather than waiting for a smoothed average to climb past
      // the threshold: ema starts at 16 and moves a tenth at a time, so on a
      // machine painting at 200ms it took ~40 frames — eight seconds of an
      // unusable main thread — to reach a verdict it could have reached in one.
      if (dt > 55) { if (++slow > 6) { bailed = true; stop(); paint(0); return; } }
      else slow = 0;
    }
    last = now;
    if (!t0) t0 = now;
    paint((now - t0) / 1000);
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    live = false;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(scrollRaf);
    scrollRaf = 0;
  }
  function start() { if (!live && !bailed) { live = true; t0 = 0; last = 0; raf = requestAnimationFrame(frame); } }

  function boot() {
    stop();
    bailed = false;
    if (!size()) return;
    // A real frame up front: animation frames are only scheduled for a
    // visible tab, and a black rectangle is worse than a still.
    paint(0);
    if (reduced.matches) return;
    new IntersectionObserver(
      (es) => (es[0].isIntersecting && !document.hidden ? start() : stop()),
      { threshold: 0 },
    ).observe(host);
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  let rt = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => { if (size()) paint(f.t); }, 140);
  });
  // A scroll moves the camera even when frames are not being scheduled — but
  // scroll events arrive far faster than frames, and paint() forces a layout
  // and repaints the whole surface. Coalesce to at most one paint per frame,
  // and stay still when the loop is off on purpose: a scene that bailed on
  // its frame budget must not come back through the scroll path, and
  // reduced-motion means reduced motion.
  window.addEventListener('scroll', () => {
    if (live || bailed || scrollRaf || reduced.matches) return;
    scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; paint(f.t); });
  }, { passive: true });
  reduced.addEventListener('change', boot);
  boot();
}

/**
 * A page's band, baked once into a still tile for the rest of the page to
 * sit on.
 *
 * Static on purpose. The band above the fold is the animated one; making
 * the whole page an animated surface would multiply the most expensive
 * thing on the site by the height of the document. This costs one render
 * at load and nothing per frame afterwards.
 *
 * The tile repeats vertically, so its top edge has to meet its own bottom
 * edge. A copy shifted by half the height is cross-faded into both edges:
 * at y=0 and at y=H the tile then shows the same source row (H/2), and the
 * seam has nowhere to appear.
 */
export function bakeTile(
  scene: (f: Frame) => void,
  W: number,
  H: number,
  alpha: number,
): string | null {
  const make = (w: number, h: number) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  const src = make(W, H);
  const sctx = src.getContext('2d');
  if (!sctx) return null;
  scene({ ctx: sctx, W, H, t: 0, p: 0, wash: true });

  const edges = make(W, H);
  const ectx = edges.getContext('2d');
  if (!ectx) return null;
  ectx.drawImage(src, 0, -H / 2);
  ectx.drawImage(src, 0, H / 2);

  const ramp = ectx.createLinearGradient(0, 0, 0, H);
  ramp.addColorStop(0, 'rgba(0,0,0,1)');
  ramp.addColorStop(0.5, 'rgba(0,0,0,0)');
  ramp.addColorStop(1, 'rgba(0,0,0,1)');
  ectx.globalCompositeOperation = 'destination-in';
  ectx.fillStyle = ramp;
  ectx.fillRect(0, 0, W, H);

  const tile = make(W, H);
  const tctx = tile.getContext('2d');
  if (!tctx) return null;
  tctx.drawImage(src, 0, 0);
  // take out of the original exactly what the shifted copy puts back
  tctx.globalCompositeOperation = 'destination-out';
  tctx.fillStyle = ramp;
  tctx.fillRect(0, 0, W, H);
  tctx.globalCompositeOperation = 'source-over';
  tctx.drawImage(edges, 0, 0);

  // one uniform scaling of alpha, rather than every scene learning to be faint
  tctx.globalCompositeOperation = 'destination-in';
  tctx.fillStyle = `rgba(0,0,0,${alpha})`;
  tctx.fillRect(0, 0, W, H);

  try {
    return tile.toDataURL('image/webp', 0.92);
  } catch {
    return null;
  }
}
