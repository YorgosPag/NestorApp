/**
 * ADR-929 Φ4 — το **πλαίσιο** της σύντηξης: τα τμήματα της Φ2 στο ευθυγραμμισμένο πλαίσιο, ομαδοποιημένα σε **οικογένειες
 * διευθύνσεων** και **ευθείες παρειών**.
 *
 * 🔑 **Συνευθειακά τμήματα = ΕΝΑΣ άγνωστος.** Δύο τοίχοι στην ίδια ευθεία (η πρόσοψη που διακόπτεται από άνοιγμα, δύο
 * δωμάτια με ευθυγραμμισμένο τοίχο) έχουν **μία** θέση. Η συγχώνευση μειώνει τους αγνώστους και αυξάνει τον πλεονασμό: δύο
 * διαστάσεις που καταλήγουν στην ίδια ευθεία ελέγχουν η μία την άλλη.
 * 🔑 **Λοξοί τοίχοι χωρίς έκπτωση.** Κάθε οικογένεια έχει δική της κάθετο· ο άγνωστος είναι μετατόπιση κατά μήκος της,
 * άρα το σύστημα μένει γραμμικό για κάθε γωνία.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/fusion-frame
 */

import { applyHomography, homographyLocalScale, type Homography, type PlanePoint } from '@/lib/geometry/homography';
import type { PlanAlignment } from '../alignment/plan-alignment-types';
import type { RasterSegment } from '../plan-recognition-types';
import type { FaceLine, PlanDirectionFamily, PlanFusionOptions } from './plan-fusion-types';

/** Ένα τμήμα στο ευθυγραμμισμένο πλαίσιο, με την οικογένειά του. */
interface AlignedSegment {
  readonly id: string;
  readonly familyId: number;
  readonly offsetPx: number;
  readonly t0: number;
  readonly t1: number;
  readonly lengthPx: number;
}

export interface FusionFrame {
  readonly families: readonly PlanDirectionFamily[];
  readonly lines: readonly FaceLine[];
  readonly lineById: ReadonlyMap<string, FaceLine>;
  readonly lineOfSegment: ReadonlyMap<string, string>;
  /** Αρχικά px ανά ευθυγραμμισμένο px στο κέντρο του σχεδίου (τοπική κλίμακα της ομογραφίας). */
  readonly originalPerAlignedPx: number;
  readonly centreAligned: PlanePoint;
  /** Η μικρή πλευρά της περιοχής σχεδίου (ευθυγραμμισμένα px). */
  readonly drawingSpanPx: number;
}

const HALF_TURN = Math.PI;

export const familyNormal = (f: PlanDirectionFamily): PlanePoint => ({ x: -Math.sin(f.angleRad), y: Math.cos(f.angleRad) });
export const familyDirection = (f: PlanDirectionFamily): PlanePoint => ({ x: Math.cos(f.angleRad), y: Math.sin(f.angleRad) });
const dot = (a: PlanePoint, b: PlanePoint): number => a.x * b.x + a.y * b.y;

/** Απόσταση δύο γωνιών modulo π. */
function angleGap(a: number, b: number): number {
  const d = Math.abs(a - b) % HALF_TURN;
  return Math.min(d, HALF_TURN - d);
}

function drawingBox(alignment: FusionAlignment): { readonly centre: PlanePoint; readonly span: number } {
  const r = alignment.sheet?.drawing.aligned ?? { minX: 0, minY: 0, maxX: alignment.image.width, maxY: alignment.image.height };
  return {
    centre: { x: (r.minX + r.maxX) / 2, y: (r.minY + r.maxY) / 2 },
    span: Math.max(1, Math.min(r.maxX - r.minX, r.maxY - r.minY)),
  };
}

type FusionAlignment = Pick<PlanAlignment, 'image' | 'originalToAligned' | 'alignedToOriginal' | 'sheet'>;

/** Οι οικογένειες: 0 και π/2 πάντα, και κάθε άλλη διεύθυνση που εμφανίζεται, ομαδοποιημένη με ανοχή. */
function assignFamilies(angles: readonly number[], toleranceRad: number): { families: PlanDirectionFamily[]; of: number[] } {
  const families: PlanDirectionFamily[] = [{ id: 0, angleRad: 0 }, { id: 1, angleRad: HALF_TURN / 2 }];
  const of = angles.map((angle) => {
    const hit = families.find((f) => angleGap(f.angleRad, angle) <= toleranceRad);
    if (hit) return hit.id;
    const created = { id: families.length, angleRad: angle };
    families.push(created);
    return created.id;
  });
  return { families, of };
}

function alignSegments(
  segments: readonly RasterSegment[],
  toAligned: Homography,
  toleranceRad: number,
): { families: PlanDirectionFamily[]; aligned: AlignedSegment[] } {
  const ends = segments.map((s) => [applyHomography(toAligned, s.start.x, s.start.y), applyHomography(toAligned, s.end.x, s.end.y)] as const);
  const angles = ends.map(([a, b]) => ((Math.atan2(b.y - a.y, b.x - a.x) % HALF_TURN) + HALF_TURN) % HALF_TURN);
  const { families, of } = assignFamilies(angles, toleranceRad);
  const aligned = segments.map((s, i) => {
    const family = families[of[i]];
    const [a, b] = ends[i];
    const n = familyNormal(family);
    const u = familyDirection(family);
    const ta = dot(u, a);
    const tb = dot(u, b);
    return {
      id: s.id,
      familyId: family.id,
      offsetPx: (dot(n, a) + dot(n, b)) / 2,
      t0: Math.min(ta, tb),
      t1: Math.max(ta, tb),
      lengthPx: Math.hypot(b.x - a.x, b.y - a.y),
    };
  });
  return { families, aligned };
}

/**
 * Η ανοχή συνευθειακότητας: **ένα πλάτος πινελιάς** του σχεδίου (διάμεσος των τμημάτων `stroke`). Μέσα σε μία πινελιά η
 * Φ2 μπορεί να δώσει και την κεντρική της γραμμή και το όριο μιας γεμάτης λωρίδας: είναι η **ίδια** σχεδιασμένη γραμμή.
 * ⚠️ Ποτέ το πάχος ενός `fill-face`: εκείνο είναι το πάχος του **τοίχου** και θα ένωνε τις δύο παρειές του.
 */
function collinearTolerance(segments: readonly RasterSegment[], originalPerAligned: number, o: PlanFusionOptions): number {
  const strokes = segments.filter((s) => s.style === 'stroke').map((s) => s.strokeWidthPx / originalPerAligned).sort((a, b) => a - b);
  const median = strokes.length === 0 ? 0 : strokes[Math.floor(strokes.length / 2)];
  return Math.max(o.minCollinearTolPx, o.collinearToleranceStroke * median);
}

/** Ομάδα φαρδύτερη από τόσες ανοχές δεν είναι **μία** γραμμή: κόβεται στο μεγαλύτερο εσωτερικό κενό της. */
const MAX_SPAN_TOLERANCES = 2;

/**
 * Ομαδοποίηση κατά μετατόπιση με **κενά** (single linkage): νέα ομάδα όπου δύο διαδοχικές μετατοπίσεις απέχουν > `tol`.
 * Οι μετατοπίσεις μιας φθαρμένης πινελιάς είναι **συνεχώς** κατανεμημένες (μετρημένο: −303,5 … −300,5 για μία παρειά), άρα
 * μια ομάδα «από το πρώτο της» θα την έκοβε αυθαίρετα· το κενό ανάμεσα σε δύο παρειές είναι το φυσικό σύνορο.
 * ⚠️ Φρένο στην αλυσίδα (γραμμοσκίαση ανά 1,5 px): ομάδα με εύρος > `MAX_SPAN_TOLERANCES × tol` κόβεται αναδρομικά.
 */
function clusterFamily(segments: readonly AlignedSegment[], tol: number): AlignedSegment[][] {
  const sorted = [...segments].sort((p, q) => p.offsetPx - q.offsetPx);
  const groups: AlignedSegment[][] = [];
  for (const s of sorted) {
    const last = groups[groups.length - 1];
    if (last && s.offsetPx - last[last.length - 1].offsetPx <= tol) last.push(s);
    else groups.push([s]);
  }
  return groups.flatMap((g) => splitWide(g, MAX_SPAN_TOLERANCES * tol));
}

function splitWide(group: readonly AlignedSegment[], maxSpan: number): AlignedSegment[][] {
  if (group.length < 2 || group[group.length - 1].offsetPx - group[0].offsetPx <= maxSpan) return [[...group]];
  let cut = 1;
  for (let i = 2; i < group.length; i++) {
    if (group[i].offsetPx - group[i - 1].offsetPx > group[cut].offsetPx - group[cut - 1].offsetPx) cut = i;
  }
  return [...splitWide(group.slice(0, cut), maxSpan), ...splitWide(group.slice(cut), maxSpan)];
}

function weightedOffset(group: readonly AlignedSegment[]): number {
  const total = group.reduce((sum, s) => sum + s.lengthPx, 0);
  return total > 0 ? group.reduce((sum, s) => sum + s.offsetPx * s.lengthPx, 0) / total : group[0].offsetPx;
}

function toFaceLine(group: readonly AlignedSegment[], id: string): FaceLine {
  return {
    id,
    familyId: group[0].familyId,
    offsetPx: weightedOffset(group),
    extentMinPx: Math.min(...group.map((s) => s.t0)),
    extentMaxPx: Math.max(...group.map((s) => s.t1)),
    segmentIds: group.map((s) => s.id),
  };
}

/** Τα τμήματα της Φ2 ⇒ οικογένειες + ευθείες παρειών, στο ευθυγραμμισμένο πλαίσιο. */
export function buildFusionFrame(segments: readonly RasterSegment[], alignment: FusionAlignment, o: PlanFusionOptions): FusionFrame {
  const box = drawingBox(alignment);
  const originalPerAlignedPx = homographyLocalScale(alignment.alignedToOriginal, box.centre.x, box.centre.y) ?? 1;
  const toleranceRad = (o.familyToleranceDeg * Math.PI) / 180;
  const { families, aligned } = alignSegments(segments, alignment.originalToAligned, toleranceRad);
  const tol = collinearTolerance(segments, originalPerAlignedPx, o);
  const lines: FaceLine[] = [];
  for (const family of families) {
    for (const group of clusterFamily(aligned.filter((s) => s.familyId === family.id), tol)) {
      lines.push(toFaceLine(group, `fl${lines.length}`));
    }
  }
  const lineOfSegment = new Map<string, string>();
  for (const line of lines) for (const id of line.segmentIds) lineOfSegment.set(id, line.id);
  return {
    families,
    lines,
    lineById: new Map(lines.map((l) => [l.id, l])),
    lineOfSegment,
    originalPerAlignedPx,
    centreAligned: box.centre,
    drawingSpanPx: box.span,
  };
}
