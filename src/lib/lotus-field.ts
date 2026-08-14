/*
 * Hale Lotus Field
 *
 * A dependency-free Canvas 2D scene for the homepage. The field is not a
 * decorative particle soup: each lotus is a locus, each route is a declared
 * communication edge, and every moving packet follows one of those routes
 * before causing the receiving lotus to pulse.
 *
 * Ported from the digital-lotus reskin prototype. It preserves the site's
 * lifecycle rules from src/lib/field.ts: a bounded backing store, no
 * animation in a hidden tab, a static reduced-motion frame, resize
 * coalescing, and a slow-frame bailout.
 */

const LOTUS_PALETTE = {
  cyan: '#75e8ff',
  electric: '#5aa8ff',
  violet: '#9b7cff',
  jade: '#59f2cf',
  gold: '#ffd28a',
  rose: '#ff8fa5',
  white: '#f8fbff',
} as const;

type HueName = keyof typeof LOTUS_PALETTE;

const TAU = Math.PI * 2;
const HUES: HueName[] = ['cyan', 'electric', 'violet', 'jade', 'gold', 'rose'];
const SHAPES = ['orb', 'diamond', 'ring', 'capsule', 'triangle', 'hex'] as const;
type Shape = (typeof SHAPES)[number];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => 0.5 - Math.cos(clamp01(t) * Math.PI) * 0.5;

interface Point { x: number; y: number }

interface Node extends Point {
  id: number;
  radius: number;
  depth: number;
  phase: number;
  petals: number;
  hue: HueName;
  secondary: HueName;
  orbit: boolean;
  energy: number;
  incoming: number;
}

interface Edge {
  id: number;
  a: number;
  b: number;
  control: Point;
  hue: HueName;
  length: number;
  phase: number;
  traffic: number;
}

interface Packet {
  edge: number;
  direction: 1 | -1;
  progress: number;
  speed: number;
  size: number;
  hue: HueName;
  shape: Shape;
  trail: number;
  phase: number;
}

interface Star extends Point {
  radius: number;
  alpha: number;
  phase: number;
  hue: HueName;
}

interface Scene {
  width: number;
  height: number;
  nodes: Node[];
  edges: Edge[];
  packets: Packet[];
  stars: Star[];
}

export interface LotusCamera {
  x?: number;
  y?: number;
  zoom?: number;
  activity?: number;
}

export interface LotusFieldOptions {
  seed?: number;
  density?: number;
  minNodes?: number;
  maxNodes?: number;
  pixelBudget?: number;
  brightness?: number;
  background?: string;
  messageRate?: number;
  camera?: () => LotusCamera;
}

type ResolvedOptions = Required<Omit<LotusFieldOptions, 'camera'>> & {
  camera?: () => LotusCamera;
};

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const number = Number.parseInt(
    value.length === 3 ? value.split('').map((c) => c + c).join('') : value,
    16,
  );
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

function rgba(hue: HueName, alpha: number) {
  const [r, g, b] = hexToRgb(LOTUS_PALETTE[hue]);
  return `rgba(${r},${g},${b},${clamp01(alpha)})`;
}

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(a: number, b: number) {
  let value = Math.imul((a + 1) | 0, 0x45d9f3b) ^ Math.imul((b + 7) | 0, 0x119de1f3);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
}

function quadratic(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

function quadraticTangent(a: Point, c: Point, b: Point, t: number): Point {
  return {
    x: 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x),
    y: 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y),
  };
}

function approximateLength(a: Point, c: Point, b: Point) {
  let length = 0;
  let previous: Point = a;
  for (let i = 1; i <= 12; i += 1) {
    const point = quadratic(a, c, b, i / 12);
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
}

function choose<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

function nodeCount(width: number, height: number, options: ResolvedOptions) {
  const area = width * height;
  const desired = Math.round((area / 1_000_000) * options.density);
  const mobileCap =
    width < 560 ? Math.min(options.maxNodes, 15)
    : width < 900 ? Math.min(options.maxNodes, 23)
    : options.maxNodes;
  return clamp(desired, options.minNodes, mobileCap);
}

function buildNodes(width: number, height: number, count: number, random: () => number): Node[] {
  const aspect = Math.max(0.55, width / Math.max(1, height));
  const columns = Math.max(3, Math.round(Math.sqrt(count * aspect)));
  const rows = Math.max(3, Math.ceil(count / columns));
  const cellW = width / columns;
  const cellH = height / rows;
  const points: Node[] = [];
  for (let row = 0; row < rows && points.length < count; row += 1) {
    for (let column = 0; column < columns && points.length < count; column += 1) {
      const depth = 0.25 + random() * 0.75;
      const perspective = lerp(0.84, 1.08, row / Math.max(1, rows - 1));
      const jitterX = (random() - 0.5) * cellW * 0.62;
      const jitterY = (random() - 0.5) * cellH * 0.55;
      const x = (column + 0.5) * cellW + jitterX;
      const y = (row + 0.5) * cellH + jitterY;
      const base = Math.min(cellW, cellH) * (0.19 + random() * 0.12) * perspective;
      const hue = choose(HUES.slice(0, 5), random);
      const secondaryPool = HUES.filter((candidate) => candidate !== hue);
      points.push({
        id: points.length,
        x,
        y,
        radius: clamp(base, 12, 40),
        depth,
        phase: random() * TAU,
        petals: random() > 0.58 ? 7 : 5,
        hue,
        secondary: choose(secondaryPool, random),
        orbit: random() > 0.54,
        energy: random() * 0.18,
        incoming: 0,
      });
    }
  }
  // A few large foreground lotuses provide rhythm and a recognizable mark.
  const foreground = [...points]
    .sort((a, b) => (b.depth + hash2(b.id, 3) * 0.25) - (a.depth + hash2(a.id, 3) * 0.25))
    .slice(0, Math.max(2, Math.round(points.length * 0.13)));
  for (const node of foreground) {
    node.radius *= 1.32;
    node.orbit = true;
  }
  return points;
}

function buildEdges(nodes: Node[], random: () => number): Edge[] {
  const pairs = new Set<string>();
  const edges: Edge[] = [];
  const addEdge = (aIndex: number, bIndex: number) => {
    if (aIndex === bIndex) return;
    const a = Math.min(aIndex, bIndex);
    const b = Math.max(aIndex, bIndex);
    const key = `${a}:${b}`;
    if (pairs.has(key)) return;
    pairs.add(key);
    const na = nodes[a];
    const nb = nodes[b];
    const dx = nb.x - na.x;
    const dy = nb.y - na.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const bend = (random() - 0.5) * Math.min(distance * 0.24, 72);
    const control = {
      x: (na.x + nb.x) * 0.5 - (dy / distance) * bend,
      y: (na.y + nb.y) * 0.5 + (dx / distance) * bend,
    };
    const hue = random() > 0.68 ? na.secondary : na.hue;
    edges.push({
      id: edges.length,
      a,
      b,
      control,
      hue,
      length: approximateLength(na, control, nb),
      phase: random() * TAU,
      traffic: 0,
    });
  };
  // Local adjacency: each locus knows a small neighborhood, not every locus.
  nodes.forEach((node, index) => {
    const closest = nodes
      .map((other, otherIndex) => ({
        otherIndex,
        distance: otherIndex === index
          ? Number.POSITIVE_INFINITY
          : Math.hypot(other.x - node.x, other.y - node.y),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, index % 5 === 0 ? 3 : 2);
    closest.forEach(({ otherIndex }) => addEdge(index, otherIndex));
  });
  // Connectivity guarantee: walk left-to-right, joining each node to the
  // nearest node already in the connected prefix.
  const ordered = nodes.map((node, index) => ({ node, index })).sort((a, b) => a.node.x - b.node.x);
  for (let i = 1; i < ordered.length; i += 1) {
    const current = ordered[i];
    let best = ordered[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let j = 0; j < i; j += 1) {
      const candidate = ordered[j];
      const distance = Math.hypot(candidate.node.x - current.node.x, candidate.node.y - current.node.y);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    addEdge(current.index, best.index);
  }
  return edges;
}

function buildPackets(edges: Edge[], nodes: Node[], random: () => number, messageRate: number): Packet[] {
  const target = clamp(Math.round(edges.length * 0.34 * messageRate), 8, 42);
  return Array.from({ length: target }, (_, index) => {
    const edge = edges[Math.floor(random() * edges.length)] ?? edges[0];
    const radiusScale = Math.min(nodes[edge.a].radius, nodes[edge.b].radius) / 25;
    return {
      edge: edge.id,
      direction: random() > 0.5 ? 1 : -1 as const,
      progress: random(),
      speed: (0.035 + random() * 0.095) * clamp(440 / Math.max(180, edge.length), 0.55, 1.35),
      size: clamp((2.8 + random() * 5.2) * (0.8 + radiusScale * 0.22), 3, 10),
      hue: random() > 0.3 ? edge.hue : choose(HUES, random),
      shape: SHAPES[index % SHAPES.length],
      trail: 2 + Math.floor(random() * 5),
      phase: random() * TAU,
    } as Packet;
  });
}

function buildStars(width: number, height: number, random: () => number): Star[] {
  const count = clamp(Math.round((width * height) / 13_000), 45, 170);
  return Array.from({ length: count }, (_, index) => ({
    x: random() * width,
    y: random() * height,
    radius: 0.35 + random() * 1.2,
    alpha: 0.08 + random() * 0.34,
    phase: random() * TAU,
    hue: index % 9 === 0 ? choose(HUES.slice(0, 4), random) : 'cyan' as HueName,
  }));
}

function buildScene(width: number, height: number, options: ResolvedOptions): Scene {
  const random = seeded(options.seed + Math.round(width) * 17 + Math.round(height) * 31);
  const nodes = buildNodes(width, height, nodeCount(width, height, options), random);
  const edges = buildEdges(nodes, random);
  return {
    width,
    height,
    nodes,
    edges,
    packets: buildPackets(edges, nodes, random, options.messageRate),
    stars: buildStars(width, height, random),
  };
}

function petalPath(ctx: CanvasRenderingContext2D, radius: number, width: number) {
  ctx.beginPath();
  ctx.moveTo(0, radius * 0.23);
  ctx.bezierCurveTo(-width * 0.72, -radius * 0.03, -width * 0.54, -radius * 0.70, 0, -radius);
  ctx.bezierCurveTo(width * 0.54, -radius * 0.70, width * 0.72, -radius * 0.03, 0, radius * 0.23);
}

function drawLotus(
  ctx: CanvasRenderingContext2D,
  node: Node, x: number, y: number, time: number, brightness: number, zoom: number,
) {
  const breath = 1 + Math.sin(time * 0.62 + node.phase) * 0.035;
  const receive = clamp01(node.energy);
  const radius = node.radius * breath * zoom;
  const hue = node.hue;
  const secondary = node.secondary;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  const haloRadius = radius * (2.3 + receive * 0.7);
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, haloRadius);
  halo.addColorStop(0, rgba(secondary, (0.15 + receive * 0.16) * brightness));
  halo.addColorStop(0.28, rgba(hue, (0.085 + receive * 0.08) * brightness));
  halo.addColorStop(1, rgba(hue, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, haloRadius, 0, TAU);
  ctx.fill();
  if (node.orbit && radius > 13) {
    ctx.lineWidth = clamp(radius * 0.025, 0.55, 1.15);
    ctx.strokeStyle = rgba(hue, 0.18 * brightness);
    ctx.setLineDash([radius * 0.12, radius * 0.17]);
    ctx.lineDashOffset = -time * 2.6 - node.phase * 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.32, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba('white', 0.16 * brightness);
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(-radius * 1.55, 0);
    ctx.lineTo(radius * 1.55, 0);
    ctx.moveTo(0, -radius * 1.55);
    ctx.lineTo(0, radius * 1.55);
    ctx.stroke();
    const nodeRadius = clamp(radius * 0.065, 1.2, 2.4);
    ctx.fillStyle = rgba('white', 0.72 * brightness);
    for (const [nx, ny] of [[0, -1.55], [1.55, 0], [0, 1.55], [-1.55, 0]] as const) {
      ctx.beginPath();
      ctx.arc(nx * radius, ny * radius, nodeRadius, 0, TAU);
      ctx.fill();
    }
  }
  // Wide outer petals: a readable silhouette even when the field is small.
  const layers = radius < 18 ? 2 : 3;
  for (let layer = 0; layer < layers; layer += 1) {
    const count = Math.max(3, node.petals - layer * 2);
    const layerRadius = radius * (1 - layer * 0.25);
    const width = layerRadius * (0.55 - layer * 0.05);
    const alpha = (0.44 + layer * 0.13 + receive * 0.16) * brightness;
    ctx.lineWidth = clamp(radius * (0.045 - layer * 0.006), 0.75, 1.8);
    ctx.strokeStyle = layer === 1 ? rgba('white', alpha) : rgba(layer === 0 ? hue : secondary, alpha);
    for (let petal = 0; petal < count; petal += 1) {
      const spread = count === 1 ? 0 : (petal / (count - 1) - 0.5);
      const angle = spread * Math.PI * 0.84;
      ctx.save();
      ctx.rotate(angle);
      petalPath(ctx, layerRadius, width);
      ctx.stroke();
      ctx.restore();
    }
  }
  // The lower cradle closes the flower and recalls the generated mark.
  ctx.strokeStyle = rgba('white', (0.44 + receive * 0.18) * brightness);
  ctx.lineWidth = clamp(radius * 0.048, 0.75, 1.65);
  ctx.beginPath();
  ctx.moveTo(-radius * 1.02, radius * 0.37);
  ctx.bezierCurveTo(-radius * 0.54, radius * 1.1, radius * 0.54, radius * 1.1, radius * 1.02, radius * 0.37);
  ctx.stroke();
  const coreRadius = clamp(radius * (0.16 + receive * 0.07), 2.1, 7.5);
  const core = ctx.createRadialGradient(0, radius * 0.10, 0, 0, radius * 0.10, coreRadius * 3.4);
  core.addColorStop(0, `rgba(255,255,255,${0.95 * brightness})`);
  core.addColorStop(0.22, rgba('cyan', 0.75 * brightness));
  core.addColorStop(0.58, rgba(secondary, 0.42 * brightness));
  core.addColorStop(1, rgba(secondary, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, radius * 0.10, coreRadius * 3.4, 0, TAU);
  ctx.fill();
  if (receive > 0.02) {
    ctx.strokeStyle = rgba(secondary, receive * 0.55 * brightness);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, radius * (1.35 + (1 - receive) * 0.95), 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number, height: number, time: number, background: string, brightness: number,
) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';
  const fields: [HueName, number, number, number][] = [
    ['cyan', 0.18, 0.28, 0.62],
    ['violet', 0.78, 0.38, 0.72],
    ['electric', 0.55, 0.82, 0.62],
    ['jade', 0.28, 0.76, 0.58],
  ];
  fields.forEach(([hue, ux, uy, size], index) => {
    const x = width * (ux + Math.sin(time * (0.035 + index * 0.007) + index) * 0.045);
    const y = height * (uy + Math.cos(time * (0.031 + index * 0.006) + index * 2) * 0.05);
    const radius = Math.max(width, height) * size;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, rgba(hue, 0.052 * brightness));
    gradient.addColorStop(0.46, rgba(hue, 0.018 * brightness));
    gradient.addColorStop(1, rgba(hue, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  });
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: Star[], time: number, offsetX: number, offsetY: number, brightness: number,
) {
  ctx.globalCompositeOperation = 'lighter';
  for (const star of stars) {
    const pulse = 0.45 + 0.55 * Math.sin(time * 0.75 + star.phase) ** 2;
    ctx.fillStyle = rgba(star.hue, star.alpha * pulse * brightness);
    ctx.beginPath();
    ctx.arc(star.x + offsetX * 0.08, star.y + offsetY * 0.08, star.radius, 0, TAU);
    ctx.fill();
  }
}

function drawEdge(
  ctx: CanvasRenderingContext2D,
  edge: Edge, a: Point, b: Point, control: Point, time: number, brightness: number,
) {
  const pulse = 0.72 + Math.sin(time * 0.28 + edge.phase) * 0.18;
  const alpha = (0.075 + edge.traffic * 0.095) * pulse * brightness;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(edge.hue, alpha);
  ctx.lineWidth = 0.65 + edge.traffic * 0.65;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(control.x, control.y, b.x, b.y);
  ctx.stroke();
  // A faint topic bead sits on the route rather than a generic straight line.
  const bead = quadratic(a, control, b, 0.5);
  ctx.fillStyle = rgba(edge.hue, (0.18 + edge.traffic * 0.2) * brightness);
  ctx.beginPath();
  ctx.arc(bead.x, bead.y, 1.2 + edge.traffic * 1.4, 0, TAU);
  ctx.fill();
}

function polygon(ctx: CanvasRenderingContext2D, sides: number, radius: number) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const angle = -Math.PI / 2 + (i / sides) * TAU;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawPacketShape(
  ctx: CanvasRenderingContext2D,
  packet: Packet, x: number, y: number, angle: number, alpha: number, brightness: number,
) {
  const size = packet.size;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 3.6);
  glow.addColorStop(0, rgba(packet.hue, alpha * 0.38 * brightness));
  glow.addColorStop(1, rgba(packet.hue, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, size * 3.6, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba('white', alpha * 0.78 * brightness);
  ctx.fillStyle = rgba(packet.hue, alpha * 0.66 * brightness);
  switch (packet.shape) {
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.72, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.72, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'ring':
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.72, 0, TAU);
      ctx.stroke();
      break;
    case 'capsule':
      ctx.beginPath();
      ctx.roundRect(-size * 1.35, -size * 0.43, size * 2.7, size * 0.86, size * 0.43);
      ctx.fill();
      ctx.stroke();
      break;
    case 'triangle':
      polygon(ctx, 3, size);
      ctx.fill();
      ctx.stroke();
      break;
    case 'hex':
      polygon(ctx, 6, size * 0.88);
      ctx.fill();
      ctx.stroke();
      break;
    case 'orb':
    default:
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.65, 0, TAU);
      ctx.fill();
      break;
  }
  ctx.restore();
}

function reroute(packet: Packet, arrivingNode: number, scene: Scene) {
  const candidates = scene.edges.filter((edge) => edge.a === arrivingNode || edge.b === arrivingNode);
  if (!candidates.length) {
    packet.progress = packet.direction === 1 ? 0 : 1;
    return;
  }
  const offset = Math.floor(hash2(arrivingNode, Math.floor(packet.phase * 1000)) * candidates.length);
  const next = candidates[(offset + Math.floor(scene.nodes[arrivingNode].incoming)) % candidates.length] ?? candidates[0];
  packet.edge = next.id;
  packet.direction = next.a === arrivingNode ? 1 : -1;
  packet.progress = packet.direction === 1 ? 0 : 1;
  packet.hue = hash2(next.id, arrivingNode) > 0.28 ? next.hue : packet.hue;
}

function updatePackets(scene: Scene, delta: number, activity: number) {
  for (const edge of scene.edges) edge.traffic *= Math.pow(0.15, delta);
  for (const node of scene.nodes) {
    node.energy *= Math.pow(0.08, delta);
    node.incoming *= Math.pow(0.55, delta);
  }
  for (const packet of scene.packets) {
    const edge = scene.edges[packet.edge];
    if (!edge) continue;
    const advance = packet.speed * delta * activity * packet.direction;
    packet.progress += advance;
    edge.traffic = Math.min(1.4, edge.traffic + 0.22);
    if (packet.progress >= 1 || packet.progress <= 0) {
      const arrivingNode = packet.progress >= 1 ? edge.b : edge.a;
      const node = scene.nodes[arrivingNode];
      node.energy = Math.min(1.35, node.energy + 0.72 + packet.size / 22);
      node.incoming += 1;
      reroute(packet, arrivingNode, scene);
    }
  }
}

interface CameraState { x: number; y: number; zoom: number; activity: number }

function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene, time: number, delta: number,
  options: ResolvedOptions,
  pointer: Point, scrollY: number, camera: CameraState, animate: boolean,
) {
  const { width, height } = scene;
  const brightness = options.brightness;
  if (animate) updatePackets(scene, delta, camera.activity);
  drawBackground(ctx, width, height, time, options.background, brightness);
  const pointerX = pointer.x * 12;
  const pointerY = pointer.y * 8;
  const scrollOffset = ((scrollY % Math.max(height, 1)) / Math.max(height, 1) - 0.5) * 16;
  drawStars(ctx, scene.stars, time, pointerX, pointerY + scrollOffset, brightness);
  const project = (point: Point, depth: number): Point => ({
    x: (point.x - width / 2) * camera.zoom + width / 2 + camera.x + pointerX * depth,
    y: (point.y - height / 2) * camera.zoom + height / 2 + camera.y + (pointerY + scrollOffset) * depth,
  });
  for (const edge of scene.edges) {
    const na = scene.nodes[edge.a];
    const nb = scene.nodes[edge.b];
    const depth = (na.depth + nb.depth) * 0.5;
    drawEdge(ctx, edge, project(na, depth), project(nb, depth), project(edge.control, depth), time, brightness);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const packet of scene.packets) {
    const edge = scene.edges[packet.edge];
    if (!edge) continue;
    const na = scene.nodes[edge.a];
    const nb = scene.nodes[edge.b];
    const depth = (na.depth + nb.depth) * 0.5;
    const a = project(na, depth);
    const b = project(nb, depth);
    const c = project(edge.control, depth);
    const progress = easeInOut(packet.progress);
    for (let trail = packet.trail; trail >= 1; trail -= 1) {
      const step = 0.0085 * trail * packet.direction;
      const t = clamp01(progress - step);
      const point = quadratic(a, c, b, t);
      const alpha = (1 - trail / (packet.trail + 1)) * 0.18;
      const radius = Math.max(0.8, packet.size * (1 - trail / (packet.trail + 2)) * 0.33);
      ctx.fillStyle = rgba(packet.hue, alpha * brightness);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, TAU);
      ctx.fill();
    }
    const point = quadratic(a, c, b, progress);
    const tangent = quadraticTangent(a, c, b, progress);
    const angle = Math.atan2(tangent.y, tangent.x) + (packet.direction === -1 ? Math.PI : 0);
    const shimmer = 0.72 + Math.sin(time * 3.2 + packet.phase) * 0.24;
    drawPacketShape(ctx, packet, point.x, point.y, angle, shimmer, brightness);
  }
  // Draw back-to-front so larger, nearer lotuses sit naturally over routes.
  const sorted = [...scene.nodes].sort((a, b) => a.depth - b.depth);
  for (const node of sorted) {
    const point = project(node, node.depth);
    drawLotus(ctx, node, point.x, point.y, time, brightness, camera.zoom);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

/**
 * Mount the field and return a destroy function. No framework runtime needed.
 */
export function mountLotusField(canvas: HTMLCanvasElement, userOptions: LotusFieldOptions = {}) {
  const options: ResolvedOptions = {
    seed: userOptions.seed ?? 0x48414c45,
    density: userOptions.density ?? 25,
    minNodes: userOptions.minNodes ?? 12,
    maxNodes: userOptions.maxNodes ?? 36,
    pixelBudget: userOptions.pixelBudget ?? 1_350_000,
    brightness: userOptions.brightness ?? 1,
    background: userOptions.background ?? '#02040a',
    messageRate: userOptions.messageRate ?? 1,
    camera: userOptions.camera,
  };
  const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!context) return () => undefined;
  let scene: Scene | null = null;
  let raf = 0;
  let resizeTimer = 0;
  let running = false;
  let destroyed = false;
  let lastFrame = 0;
  let origin = 0;
  let slowFrames = 0;
  let qualityReduced = false;
  let visible = true;
  let scrollY = window.scrollY;
  const pointer: Point = { x: 0, y: 0 };
  const targetPointer: Point = { x: 0, y: 0 };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const currentCamera = (): CameraState => {
    const value = options.camera?.() ?? {};
    return {
      x: value.x ?? 0,
      y: value.y ?? 0,
      zoom: clamp(value.zoom ?? 1, 0.72, 1.5),
      activity: clamp(value.activity ?? 1, 0.12, 1.8),
    };
  };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      Math.sqrt(options.pixelBudget / Math.max(1, rect.width * rect.height)),
    );
    canvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
    canvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const maxNodes = qualityReduced
      ? Math.max(options.minNodes, Math.floor(options.maxNodes * 0.68))
      : options.maxNodes;
    scene = buildScene(rect.width, rect.height, { ...options, maxNodes });
    return true;
  };
  const paint = (time: number, delta: number, animate: boolean) => {
    if (!scene) return;
    pointer.x = lerp(pointer.x, targetPointer.x, 0.045);
    pointer.y = lerp(pointer.y, targetPointer.y, 0.045);
    drawScene(context, scene, time, delta, options, pointer, scrollY, currentCamera(), animate);
  };
  const frame = (now: number) => {
    if (!running || destroyed) return;
    if (!origin) origin = now;
    const rawDelta = lastFrame ? (now - lastFrame) / 1000 : 1 / 60;
    const delta = clamp(rawDelta, 0, 0.05);
    lastFrame = now;
    if (rawDelta > 0.055) slowFrames += 1;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 7 && !qualityReduced) {
      qualityReduced = true;
      slowFrames = 0;
      resize();
    } else if (slowFrames > 12) {
      stop();
      paint((now - origin) / 1000, 0, false);
      return;
    }
    paint((now - origin) / 1000, delta, true);
    raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (running || destroyed || reducedMotion.matches || !visible || document.hidden) return;
    running = true;
    lastFrame = 0;
    origin = 0;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  const boot = () => {
    stop();
    if (!resize()) return;
    paint(0, 0, false);
    if (!reducedMotion.matches) start();
  };
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(boot, 140);
  };
  const onScroll = () => { scrollY = window.scrollY; };
  const onPointerMove = (event: PointerEvent) => {
    targetPointer.x = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
    targetPointer.y = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
  };
  const onPointerLeave = () => { targetPointer.x = 0; targetPointer.y = 0; };
  const onVisibility = () => {
    if (document.hidden) stop();
    else if (visible) start();
  };
  const onMotion = () => boot();
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
    if (visible) start();
    else stop();
  }, { threshold: 0 });
  observer.observe(canvas);
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeave, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  reducedMotion.addEventListener('change', onMotion);
  boot();
  return () => {
    destroyed = true;
    stop();
    observer.disconnect();
    window.clearTimeout(resizeTimer);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('pointermove', onPointerMove);
    document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    reducedMotion.removeEventListener('change', onMotion);
  };
}
