import { mergeCoresToFinishedRings } from '../structural-finish-horizontal';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';
import { safeUnion } from '../../geometry/shared/safe-polygon-boolean';
import type { Pair, Polygon } from 'polygon-clipping';

function toClip(fp: Pt2[]): Polygon {
  let s = 0;
  for (let i = 0; i < fp.length; i++) { const a = fp[i]; const b = fp[(i + 1) % fp.length]; s += a.x * b.y - b.x * a.y; }
  const ccw = s < 0 ? [...fp].reverse() : fp;
  const ring: Pair[] = ccw.map((p) => [p.x, p.y]);
  ring.push([ring[0][0], ring[0][1]]);
  return [ring];
}

function rawWallRect(start: Pt2, end: Pt2, thick: number): Pt2[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const h = thick / 2;
  return [
    { x: start.x + nx * h, y: start.y + ny * h },
    { x: end.x + nx * h, y: end.y + ny * h },
    { x: end.x - nx * h, y: end.y - ny * h },
    { x: start.x - nx * h, y: start.y - ny * h },
  ];
}

const column: Pt2[] = [
  { x: 1024.4493867963492, y: 5365.460794637555 },
  { x: 1259.3725419928262, y: 5279.955758806138 },
  { x: 1344.8775778242434, y: 5514.878914002616 },
  { x: 1109.9544226277665, y: 5600.383949834033 },
];
const wallA = rawWallRect({ x: 1302.13, y: 5397.42 }, { x: 2288.80, y: 5038.30 }, 210);
const wallB = rawWallRect({ x: 1227.42, y: 5557.63 }, { x: 1227.42, y: 6607.63 }, 210);

test('DIAG reflex notch', () => {
  const u = safeUnion(toClip(column), toClip(wallA), toClip(wallB));
  const coreRing = u[0][0].map(([x, y]) => ({ x, y }));
  // eslint-disable-next-line no-console
  console.log('CORE RING', JSON.stringify(coreRing.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))));

  const rings = mergeCoresToFinishedRings([column, wallA, wallB], 15, 1);
  const main = rings.reduce((a, b) => (a.length >= b.length ? a : b));
  // eslint-disable-next-line no-console
  console.log('MAIN RING', JSON.stringify(main.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))));

  // HYPOTHESIS: add wall B mitered-start extension triangle (up to inner corner 1332,5519)
  const wallBmiterTri: Pt2[] = [
    { x: 1122.42, y: 5557.63 }, { x: 1332.42, y: 5557.63 }, { x: 1332.42, y: 5519.41 },
  ];
  const rings2 = mergeCoresToFinishedRings([column, wallA, wallB, wallBmiterTri], 15, 1);
  const main2 = rings2.reduce((a, b) => (a.length >= b.length ? a : b));
  // eslint-disable-next-line no-console
  console.log('MAIN2 RING', JSON.stringify(main2.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))));
  expect(rings.length).toBeGreaterThan(0);
});
