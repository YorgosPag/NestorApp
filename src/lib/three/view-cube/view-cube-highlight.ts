/**
 * ViewCube face highlight utilities.
 * PORT_AS_IS from GenArc viewCubeHighlight.ts (ADR-366 §8.2 SPEC-3D-004A).
 */

export type FaceZone =
  | 'center'
  | 'top' | 'right' | 'bottom' | 'left'
  | 'tl' | 'tr' | 'bl' | 'br';

interface FaceAdj {
  readonly t: number; readonly r: number;
  readonly b: number; readonly l: number;
}

const FACE_ADJ: readonly FaceAdj[] = [
  { t: 2, r: 5, b: 3, l: 4 },
  { t: 2, r: 4, b: 3, l: 5 },
  { t: 5, r: 0, b: 4, l: 1 },
  { t: 4, r: 0, b: 5, l: 1 },
  { t: 2, r: 0, b: 3, l: 1 },
  { t: 2, r: 1, b: 3, l: 0 },
];

type EdgeDir = 'top' | 'right' | 'bottom' | 'left';

function adjDirection(faceIdx: number, neighborIdx: number): EdgeDir | null {
  const adj = FACE_ADJ[faceIdx];
  if (!adj) return null;
  if (adj.t === neighborIdx) return 'top';
  if (adj.r === neighborIdx) return 'right';
  if (adj.b === neighborIdx) return 'bottom';
  if (adj.l === neighborIdx) return 'left';
  return null;
}

const CORNER_MAP: Record<string, FaceZone> = {
  'left,top': 'tl', 'right,top': 'tr',
  'bottom,left': 'bl', 'bottom,right': 'br',
};

function cornerFromEdges(d1: EdgeDir, d2: EdgeDir): FaceZone | null {
  return CORNER_MAP[[d1, d2].sort().join(',')] ?? null;
}

export function computeHighlights(
  hitType: 'face' | 'edge' | 'corner',
  faces: readonly number[],
): ReadonlyMap<number, FaceZone> {
  const result = new Map<number, FaceZone>();
  if (hitType === 'face' && faces.length === 1) {
    result.set(faces[0]!, 'center');
  } else if (hitType === 'edge' && faces.length === 2) {
    const [a, b] = faces;
    const dA = adjDirection(a!, b!);
    const dB = adjDirection(b!, a!);
    if (dA) result.set(a!, dA);
    if (dB) result.set(b!, dB);
  } else if (hitType === 'corner' && faces.length === 3) {
    for (const myFace of faces) {
      const others = faces.filter(f => f !== myFace);
      const d1 = adjDirection(myFace, others[0]!);
      const d2 = adjDirection(myFace, others[1]!);
      if (d1 && d2) {
        const zone = cornerFromEdges(d1, d2);
        if (zone) result.set(myFace, zone);
      }
    }
  }
  return result;
}

/**
 * SSoT hover/highlight color for the whole ViewCube widget (faces, ring,
 * compass labels, roll arrows, face-nav arrows, home button). AutoCAD-style
 * orange instead of the previous cyan (#88ccee). Hex form for THREE materials.
 *
 * Mirrored on the CSS side as `--viewcube-accent` (33 100% 50%) in globals.css,
 * which recolours the cut-plane slider so the 3D overlay controls share this one
 * accent. Keep the two in sync (ADR-452 v2.13).
 */
export const VIEWCUBE_HOVER_COLOR_HEX = 0xff8c00;

const HIGHLIGHT_FILL   = '#ff8c00';
const HIGHLIGHT_STROKE = '#803f00';
const HL_LINE_W = 2;

export function drawZoneHighlight(
  ctx: CanvasRenderingContext2D,
  zone: FaceZone,
  size: number,
  border: number,
): void {
  const inner = size - 2 * border;
  let x: number, y: number, w: number, h: number;
  switch (zone) {
    case 'center': x = border; y = border; w = inner; h = inner; break;
    case 'top':    x = border; y = 0;             w = inner;  h = border; break;
    case 'bottom': x = border; y = size - border;  w = inner;  h = border; break;
    case 'left':   x = 0;      y = border;         w = border; h = inner;  break;
    case 'right':  x = size - border; y = border;  w = border; h = inner;  break;
    case 'tl':     x = 0;             y = 0;              w = border; h = border; break;
    case 'tr':     x = size - border; y = 0;              w = border; h = border; break;
    case 'bl':     x = 0;             y = size - border;  w = border; h = border; break;
    case 'br':     x = size - border; y = size - border;  w = border; h = border; break;
  }
  ctx.fillStyle = HIGHLIGHT_FILL;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = HIGHLIGHT_STROKE;
  ctx.lineWidth = HL_LINE_W;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}
