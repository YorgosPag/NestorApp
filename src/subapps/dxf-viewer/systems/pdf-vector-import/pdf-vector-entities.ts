/**
 * ADR-941 Φ1 — το διανυσματικό περιεχόμενο ενός PDF υποβάθρου (`PdfVectorContent`, px της εικόνας) ως **οντότητες σκηνής**:
 * `line` (δύο σημεία, ανοιχτή) · `polyline` · `text`. Καθαρό· καμία εγγραφή.
 *
 * 🔑 **ΕΝΑΣ δρόμος συντεταγμένων (Δ1):** κάθε σημείο περνά **μόνο** από το `rasterPixelToScene` (ADR-929 Δ3), τον ίδιο πίνακα με
 *   τον ζωγράφο του υποβάθρου. Γωνία και ύψος κειμένου βγαίνουν από **απεικονισμένα σημεία** (αρχή · κατά μήκος · πάνω), ποτέ
 *   από χειρόγραφο πρόσημο: η αναστροφή Y του `cad-y-up` και η περιστροφή του υποβάθρου μπαίνουν από τον πίνακα.
 * 🔑 **Ταυτότητα πηγής (Δ7):** κάθε οντότητα φέρει `metadata.pdfVectorImport = sourceKey`, ώστε η επόμενη εισαγωγή της ΙΔΙΑΣ
 *   πηγής να αντικαταστήσει, όχι να στοιβάξει.
 *
 * @module subapps/dxf-viewer/systems/pdf-vector-import/pdf-vector-entities
 */

import type { Point2D } from '../../rendering/types/Types';
import type { LineEntity, PolylineEntity, TextEntity } from '../../types/entities';
import { rasterPixelToScene, type RasterPlacement } from '../../floorplan-background/geometry/raster-scene-mapping';
import type { PdfVectorContent, PdfVectorPolyline, PdfVectorText, PxPoint } from '../../pdf-background/services/pdf-vector-content';
import { generateEntityId } from '../entity-creation/utils';
import { makeNode, makeParagraph, makeRun, DEFAULT_RUN_STYLE } from '../../text-engine/templates/defaults/template-helpers';

/** Το κλειδί στα `metadata` που δένει μια οντότητα με την εισαγωγή της. */
export const PDF_VECTOR_IMPORT_META_KEY = 'pdfVectorImport';

/**
 * Το PDF δίνει το **em** της γραμματοσειράς· το ύψος κειμένου CAD είναι ύψος **κεφαλαίου**. Λόγος κεφαλαίου/em της Helvetica
 * (718/1000, AFM) — η γραμματοσειρά αναφοράς του PDF· [ADR-941 Φ1: προς ζωντανή επαλήθευση στο ΤΕΣΤ1].
 */
export const PDF_EM_TO_CAP_HEIGHT = 0.718;

export interface PdfVectorLayers {
  readonly geometry: string;
  readonly text: string;
}

export interface PdfVectorEntityInput {
  readonly content: PdfVectorContent;
  readonly placement: RasterPlacement;
  readonly layers: PdfVectorLayers;
  /** Ταυτότητα της πηγής (π.χ. υπόβαθρο ορόφου), για την αντικατάσταση της προηγούμενης εισαγωγής. */
  readonly sourceKey: string;
}

const toScene = (p: PxPoint, placement: RasterPlacement): Point2D => rasterPixelToScene({ x: p[0], y: p[1] }, placement);
const RAD_TO_DEG = 180 / Math.PI;

function polylineEntity(polyline: PdfVectorPolyline, input: PdfVectorEntityInput): LineEntity | PolylineEntity {
  const vertices = polyline.points.map((p) => toScene(p, input.placement));
  const base = { id: generateEntityId(), layerId: input.layers.geometry, metadata: { [PDF_VECTOR_IMPORT_META_KEY]: input.sourceKey } };
  if (vertices.length === 2 && !polyline.closed) return { ...base, type: 'line', start: vertices[0], end: vertices[1] };
  return { ...base, type: 'polyline', vertices, closed: polyline.closed };
}

function textEntity(text: PdfVectorText, input: PdfVectorEntityInput): TextEntity | null {
  const origin = toScene(text.origin, input.placement);
  const along = toScene(text.along, input.placement);
  const up = toScene(text.up, input.placement);
  const height = Math.hypot(up.x - origin.x, up.y - origin.y) * PDF_EM_TO_CAP_HEIGHT;
  if (!(height > 0)) return null;
  const rotation = Math.atan2(along.y - origin.y, along.x - origin.x) * RAD_TO_DEG;
  const textNode = {
    ...makeNode([makeParagraph([makeRun(text.text, { ...DEFAULT_RUN_STYLE, height })])], { attachment: 'BL', rotation }),
    baselineAnchored: true,
  };
  return {
    id: generateEntityId(),
    type: 'text',
    layerId: input.layers.text,
    position: origin,
    text: text.text,
    textNode,
    height,
    rotation,
    metadata: { [PDF_VECTOR_IMPORT_META_KEY]: input.sourceKey },
  };
}

/** Η γεωμετρία της εισαγωγής: οι οντότητες, και το id **ανά πολυγραμμή** (`ids[i]` ⇔ `polylines[i]`, για τις συσχετίσεις). */
export interface PdfVectorGeometry {
  readonly entities: readonly (LineEntity | PolylineEntity)[];
  /** Το id ανά πολυγραμμή, με τη σειρά του `content.polylines`· `null` = απορροφήθηκε σε διάσταση (Φ2β, Δ19). */
  readonly ids: readonly (string | null)[];
}

/**
 * ADR-941 Φ2α · Φ2β — η γεωμετρία: μία οντότητα ανά πολυγραμμή, **εκτός** όσων είναι γραφικά δεμένων διαστάσεων (`absorbed`,
 * Δ19: η διάσταση τα ζωγραφίζει ήδη — δεύτερο αντίγραφο δεν θα ακολουθούσε το τέντωμα).
 */
export function pdfVectorGeometry(input: PdfVectorEntityInput, absorbed: ReadonlySet<number> = new Set()): PdfVectorGeometry {
  const ids: (string | null)[] = [];
  const entities: (LineEntity | PolylineEntity)[] = [];
  input.content.polylines.forEach((p, i) => {
    if (absorbed.has(i)) { ids.push(null); return; }
    const entity = polylineEntity(p, input);
    entities.push(entity);
    ids.push(entity.id);
  });
  return { entities, ids };
}

/** ADR-941 Φ2α — τα κείμενα, **εκτός** όσων έγιναν διαστάσεις (Δ16: μία οντότητα ανά πράγμα). */
export function pdfVectorTexts(input: PdfVectorEntityInput, asDimensions: ReadonlySet<number>): TextEntity[] {
  return input.content.texts.flatMap((t, i) => (asDimensions.has(i) ? [] : textEntity(t, input) ?? []));
}

/** Ανήκει η οντότητα στην εισαγωγή της πηγής `sourceKey`; */
export function isPdfVectorImportOf(entity: { readonly metadata?: Record<string, unknown> }, sourceKey: string): boolean {
  return entity.metadata?.[PDF_VECTOR_IMPORT_META_KEY] === sourceKey;
}
