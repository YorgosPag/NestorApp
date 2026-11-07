/**
 * **Αλήθεια από DXF** (ADR-929 §6.9). Επαναχρησιμοποιεί τον έναν αναγνώστη DXF της εφαρμογής (`runDxfParse`, ADR-635)
 * — καμία δεύτερη ανάλυση. Ρόλοι:
 * - `dimension` (linear/aligned) ⇒ γραμμή διάστασης + τα δύο σημεία μέτρησης (`defPoints[0..1]`), γραμμή διάστασης μέσω
 *   του `defPoints[2]`. Άλλα είδη διάστασης ⇒ μετρώνται στο `skipped`, δεν μαντεύονται.
 * - `text` (TEXT **και** MTEXT, ADR-635) ⇒ σημείωση.
 * - `line` / `polyline` / `lwpolyline` ⇒ παρειά τοίχου **μόνο** αν η στρώση τους είναι δηλωμένη ως στρώση τοίχων από
 *   τον καλούντα. Δεν υπάρχει καθολική σύμβαση ονομάτων στρώσεων, άρα **δεν** μαντεύεται. Αλλιώς ⇒ `other`.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/testing/cad-truth/dxf-truth
 */

import type { AffinePoint } from '@/lib/geometry/affine-2x3';
import { runDxfParse } from '../../../../utils/run-dxf-parse';
import type { Entity } from '../../../../types/entities';
import type { SceneModel } from '../../../../types/scene-types';
import type { CadTruth, CadTruthDimension, CadTruthRole, CadTruthSegment, CadTruthText } from './cad-truth-types';

export interface DxfTruthOptions {
  /** Ποιες στρώσεις (αρχικό όνομα του αρχείου) κρατούν παρειές τοίχων — δηλώνεται ανά περίπτωση στο μανιφέστο. */
  readonly isWallLayer: (layerName: string) => boolean;
}

export type DxfTruthResult = { readonly ok: true; readonly truth: CadTruth } | { readonly ok: false; readonly error: string };

const sub = (p: AffinePoint, q: AffinePoint): AffinePoint => ({ x: p.x - q.x, y: p.y - q.y });

/** Προβολή του `p` στην ευθεία `(o, d)` με μοναδιαίο `d`. */
function project(p: AffinePoint, o: AffinePoint, d: AffinePoint): AffinePoint {
  const s = (p.x - o.x) * d.x + (p.y - o.y) * d.y;
  return { x: o.x + d.x * s, y: o.y + d.y * s };
}

/** Γραμμή διάστασης linear/aligned από τα `defPoints`, ή `null` για άλλο είδος ή εκφυλισμένη. */
export function dxfDimensionTruth(e: Extract<Entity, { type: 'dimension' }>): CadTruthDimension | null {
  if (e.dimensionType !== 'linear' && e.dimensionType !== 'aligned') return null;
  const [o1, o2, ref] = e.defPoints;
  if (!o1 || !o2 || !ref) return null;
  const raw = e.dimensionType === 'linear'
    ? { x: Math.cos((e.rotation * Math.PI) / 180), y: Math.sin((e.rotation * Math.PI) / 180) }
    : sub(o2, o1);
  const len = Math.hypot(raw.x, raw.y);
  if (len <= 0) return null;
  const d = { x: raw.x / len, y: raw.y / len };
  const text = e.userText && e.userText !== '<>' ? e.userText : '';
  return { text, measured: [o1, o2], line: [project(o1, ref, d), project(o2, ref, d)] };
}

function polylineSegments(vertices: readonly AffinePoint[], closed: boolean, role: CadTruthRole): CadTruthSegment[] {
  const out: CadTruthSegment[] = [];
  const n = vertices.length;
  for (let i = 0; i + 1 < n + (closed ? 1 : 0); i++) out.push({ a: vertices[i], b: vertices[(i + 1) % n], role });
  return out;
}

interface Acc {
  readonly segments: CadTruthSegment[];
  readonly dimensions: CadTruthDimension[];
  readonly texts: CadTruthText[];
  readonly skipped: Record<string, number>;
}

function addEntity(e: Entity, layerName: string, o: DxfTruthOptions, acc: Acc): void {
  const wall: CadTruthRole = o.isWallLayer(layerName) ? 'wall-face' : 'other';
  if (e.type === 'line') {
    acc.segments.push({ a: e.start, b: e.end, role: wall });
  } else if (e.type === 'polyline' || e.type === 'lwpolyline') {
    acc.segments.push(...polylineSegments(e.vertices, e.closed === true, wall));
  } else if (e.type === 'text') {
    acc.texts.push({ text: e.text, at: e.position });
  } else if (e.type === 'dimension') {
    const dim = dxfDimensionTruth(e);
    if (dim === null) {
      acc.skipped[`dimension:${e.dimensionType}`] = (acc.skipped[`dimension:${e.dimensionType}`] ?? 0) + 1;
      return;
    }
    acc.dimensions.push(dim);
    acc.segments.push({ a: dim.line[0], b: dim.line[1], role: 'dimension-line' });
  } else {
    acc.skipped[e.type] = (acc.skipped[e.type] ?? 0) + 1;
  }
}

/** Αλήθεια από ήδη αναλυμένη σκηνή DXF. */
export function dxfTruthFromScene(scene: SceneModel, o: DxfTruthOptions): CadTruth {
  const acc: Acc = { segments: [], dimensions: [], texts: [], skipped: {} };
  for (const e of scene.entities) {
    const layer = scene.layersById[e.layerId];
    addEntity(e, layer?.sourceName ?? layer?.name ?? '', o, acc);
  }
  return acc;
}

/** Αλήθεια από το περιεχόμενο ενός DXF, στις μονάδες του αρχείου (καμία κανονικοποίηση ορίων). */
export function dxfTruth(content: string, o: DxfTruthOptions): DxfTruthResult {
  const r = runDxfParse(content, undefined, { normalizeBounds: false });
  if (!r.success || !r.scene) return { ok: false, error: r.error ?? 'dxf-parse-failed' };
  return { ok: true, truth: dxfTruthFromScene(r.scene, o) };
}
