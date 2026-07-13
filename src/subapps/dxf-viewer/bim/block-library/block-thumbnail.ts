/**
 * ADR-652 M4 — Block thumbnail: ΔΙΑΝΥΣΜΑΤΙΚΟ preview, υπολογισμένο μία φορά.
 *
 * ## Τι κάνουν οι μεγάλοι (και τι κρατάμε από αυτούς)
 * Revit (`.rfa`), ArchiCAD (`.gsm`) και AutoCAD (DesignCenter/Blocks palette) αποθηκεύουν
 * **προϋπολογισμένη εικόνα preview ΜΕΣΑ στον κατάλογο** — ο browser ΠΟΤΕ δεν κατεβάζει τη
 * γεωμετρία του asset για να ζωγραφίσει μια κάρτα (θα κατέρρεε σε 500 αντικείμενα). Το Figma
 * δείχνει ζωντανό vector, αλλά έχει ΟΛΟ το αρχείο ήδη στη μνήμη — δωρεάν για εκείνο, όχι για
 * εμάς (η γεωμετρία μας ζει ως lazy blob στο Storage, ADR-652 M2).
 *
 * **Κρατάμε τον κύκλο ζωής τους** (preview προϋπολογισμένο, αποθηκευμένο δίπλα στο metadata,
 * μηδέν geometry download για το palette) και **αποκλίνουμε ΡΗΤΑ στο μέσο**: αντί για raster
 * PNG στο Storage, αποθηκεύουμε **διανυσματικό μονοπάτι** μέσα στο ίδιο Firestore doc. Γιατί:
 *  - **Node seed**: τα system blocks σπέρνονται από script (Admin SDK, χωρίς DOM canvas) — ένα
 *    PNG θα απαιτούσε headless canvas (νέα εξάρτηση + έλεγχος άδειας). Το vector είναι καθαρά
 *    μαθηματικά → τρέχει παντού (browser, Node, tests).
 *  - **Μηδέν επιπλέον δικτύωση**: το doc έρχεται ήδη από τη συνδρομή του palette — ένα PNG θα
 *    ήταν ένα ακόμα HTTP request ΑΝΑ ΚΑΡΤΑ.
 *  - **Theme-correct** (`currentColor`, N.3) + καθαρό σε κάθε DPR· ένα PNG ψήνει χρώμα και ανάλυση.
 *  - Είναι ήδη **το σπιτικό μοτίβο**: linetype / arrowhead / line-style / hatch thumbnails είναι
 *    ΟΛΑ «καθαρά δεδομένα → inline SVG» από τον ΙΔΙΟ SSoT που ζωγραφίζει ο renderer.
 *
 * Το preview ΔΕΝ είναι δεύτερη πηγή αλήθειας: είναι **παράγωγο, απλοποιημένο, φραγμένο**
 * στιγμιότυπο της γεωμετρίας (regenerable — ξαναχτίζεται από το blob όποτε θέλουμε), και
 * **καμία τοποθέτηση δεν το διαβάζει ποτέ** (το tool περνά πάντα από το `hydrateCloudBlockDef`).
 *
 * ## Ένας builder, δύο καλούντες
 * - **session block** (γεωμετρία στη μνήμη μετά το import) → χτίζεται ζωντανά, μηδέν persistence.
 * - **cloud block** → χτίζεται ΜΙΑ φορά τη στιγμή της εγγραφής (`saveBlock` στον browser,
 *   `seed-block-library` στο Node) και ταξιδεύει μέσα στο doc.
 *
 * Pure module (μηδέν Firebase/DOM/React).
 *
 * @see ../../rendering/entities/shared/entity-polylines.ts — Entity → σημεία (ο ουδέτερος SSoT)
 * @see ./block-library-types.ts — `BlockThumbnailVector` (το αποθηκευμένο σχήμα)
 */

import type { Entity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import {
  entitiesToPolylines,
  type EntityPolyline,
} from '../../rendering/entities/shared/entity-polylines';
import type { BlockThumbnailVector } from './block-library-types';

/** Πλευρά του τετράγωνου viewBox του preview (μονάδες μονοπατιού — ΟΧΙ px· το SVG κλιμακώνει). */
export const BLOCK_THUMBNAIL_VIEWBOX = 100;

/** Έκδοση του σχήματος του αποθηκευμένου thumbnail — bump ΜΟΝΟ σε breaking αλλαγή του `d`. */
export const BLOCK_THUMBNAIL_VERSION = 1;

/** Περιθώριο (μονάδες viewBox) ώστε η γραμμή να μην ακουμπά την άκρη της κάρτας. */
const PADDING = 4;

/**
 * Ανώτατο πλήθος σημείων ΑΝΑ thumbnail. Φράζει το μέγεθος του Firestore doc (~7 chars/σημείο
 * ⇒ ≲6KB) και τον χρόνο ζωγραφίσματος. Ένα έπιπλο/είδος υγιεινής είναι δεκάδες σημεία·
 * το όριο πιάνει μόνο παθολογικά imports (spline-βαρύ CAD περιεχόμενο), τα οποία κόβονται
 * ΜΕ ΣΕΙΡΑ ΣΧΕΔΙΑΣΗΣ (το περίγραμμα έρχεται πρώτο) και σημειώνονται στο `truncated`.
 */
export const MAX_THUMBNAIL_POINTS = 900;

/** Χονδρή tessellation — ένα preview 64px δεν κερδίζει τίποτα από λεία τόξα. */
const THUMBNAIL_TESSELLATION = { arcSegmentDeg: 24, splineSegments: 16 } as const;

/** Ακρίβεια συντεταγμένων στο μονοπάτι: 1 δεκαδικό σε viewBox 100 ⇒ 1/1000 της πλευράς. */
const DECIMALS = 1;

interface Extent {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Το πλαίσιο ΑΥΤΟΥ που πραγματικά ζωγραφίζεται (όχι των `boundsMm`) — μηδέν κρυφή περικοπή. */
function polylinesExtent(polylines: readonly EntityPolyline[]): Extent | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const line of polylines) {
    for (const p of line.points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  return Number.isFinite(minX) && Number.isFinite(minY) ? { minX, minY, maxX, maxY } : null;
}

/**
 * Προβολή world → viewBox: ομοιόμορφη κλίμακα (aspect-fit, κεντραρισμένο) + **αναστροφή Y**
 * (CAD Y-πάνω → SVG Y-κάτω). Εκφυλισμένη διάσταση (κάθετη/οριζόντια γραμμή) → κεντράρεται.
 */
function makeProjector(extent: Extent): (p: Point2D) => Point2D {
  const inner = BLOCK_THUMBNAIL_VIEWBOX - PADDING * 2;
  const w = extent.maxX - extent.minX;
  const h = extent.maxY - extent.minY;
  const scale = w > 0 || h > 0 ? inner / Math.max(w, h) : 1;
  const offsetX = PADDING + (inner - w * scale) / 2;
  const offsetY = PADDING + (inner - h * scale) / 2;

  return (p) => ({
    x: offsetX + (p.x - extent.minX) * scale,
    y: BLOCK_THUMBNAIL_VIEWBOX - (offsetY + (p.y - extent.minY) * scale),
  });
}

function round(value: number): string {
  return value.toFixed(DECIMALS).replace(/\.0$/, '');
}

/** Μια πολυγραμμή → subpath `M…L…[Z]` (μόνο πεπερασμένα σημεία). */
function polylineToSubpath(
  line: EntityPolyline,
  project: (p: Point2D) => Point2D,
  budget: number,
): { readonly d: string; readonly used: number } {
  const parts: string[] = [];
  let used = 0;

  for (const p of line.points) {
    if (used >= budget) break;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const q = project(p);
    parts.push(`${parts.length === 0 ? 'M' : 'L'}${round(q.x)},${round(q.y)}`);
    used += 1;
  }

  if (parts.length < 2) return { d: '', used: 0 };
  // Κλείνει ΜΟΝΟ αν χώρεσε ολόκληρη — μισοκομμένο σχήμα δεν το «κλείνουμε» ψεύτικα.
  if (line.closed && used === line.points.length) parts.push('Z');
  return { d: parts.join(''), used };
}

export interface BlockThumbnailBuildResult {
  readonly thumbnail: BlockThumbnailVector | null;
  /** `true` ⇒ χτυπήθηκε το όριο σημείων και το preview είναι μερικό (όχι σιωπηλά). */
  readonly truncated: boolean;
}

/**
 * BLOCK-LOCAL members → διανυσματικό thumbnail. `null` όταν το block δεν έχει καμία
 * γραμμική γεωμετρία (π.χ. μόνο κείμενο) — ο καλών πέφτει στο footprint των `boundsMm`.
 */
export function buildBlockThumbnail(members: readonly Entity[]): BlockThumbnailBuildResult {
  const polylines = entitiesToPolylines(members, THUMBNAIL_TESSELLATION);
  const extent = polylinesExtent(polylines);
  if (!extent) return { thumbnail: null, truncated: false };

  const project = makeProjector(extent);
  const subpaths: string[] = [];
  let remaining = MAX_THUMBNAIL_POINTS;
  let truncated = false;

  for (const line of polylines) {
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const { d, used } = polylineToSubpath(line, project, remaining);
    if (used < line.points.length) truncated = true;
    if (d) subpaths.push(d);
    remaining -= used;
  }

  if (subpaths.length === 0) return { thumbnail: null, truncated };
  return {
    thumbnail: { v: BLOCK_THUMBNAIL_VERSION, d: subpaths.join('') },
    truncated,
  };
}

/**
 * Identity cache για τα session blocks: το palette ξαναζωγραφίζεται σε κάθε φίλτρο/επιλογή,
 * αλλά τα `localMembers` ενός ορισμού είναι αμετάβλητα → κλειδί ταυτότητας ο ΙΔΙΟΣ πίνακας
 * (WeakMap ⇒ μηδέν διαρροή, μηδέν χειροκίνητο invalidation). Ίδιο πνεύμα με το memoize των
 * υπόλοιπων thumbnail builders (linetype/arrowhead/hatch), απλώς με κλειδί την ταυτότητα.
 */
const sessionCache = new WeakMap<readonly Entity[], BlockThumbnailVector | null>();

/** Cached παραλλαγή για ζωντανή χρήση στο UI (session defs). */
export function getBlockThumbnail(members: readonly Entity[]): BlockThumbnailVector | null {
  const hit = sessionCache.get(members);
  if (hit !== undefined) return hit;

  const { thumbnail } = buildBlockThumbnail(members);
  sessionCache.set(members, thumbnail);
  return thumbnail;
}
