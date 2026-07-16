/**
 * ADR-622 τρίτο backend — sheet primitives → **scene DXF entities**.
 *
 * Το detail-sheet μοντέλο ({@link DetailPrimitive}, sheet-mm) είχε δύο backends: canvas
 * preview + PDF (preview === PDF). Η πινακίδα σχεδίου (ADR-651 Φάση Β) χρειάζεται ΤΟ ΙΔΙΟ
 * layout ως πραγματικά entities μέσα στο σχέδιο (επιλέξιμα/μετακινούμενα/undo). Αντί για
 * δεύτερη μηχανή διάταξης, ο ίδιος `DetailPrimitive[]` περνά από εδώ → `Entity[]`.
 * Έτσι preview === PDF === in-scene παραμένει μία αλήθεια (Απόφαση #1, ADR-651 §11).
 *
 * Δύο μετασχηματισμοί συστήματος συντεταγμένων:
 *  - **y-flip**: sheet-mm = y-κάτω με αρχή πάνω-αριστερά· η σκηνή = y-πάνω. Το
 *    `sheetHeightMm` είναι το datum της αναστροφής ⇒ η αρχή του παραγόμενου block-local
 *    χώρου πέφτει **κάτω-αριστερά** (σύμβαση DXF INSERT).
 *  - **scaleFactor**: paper-mm → model units (annotative: 1:50 ⇒ ×50), ώστε η πινακίδα να
 *    έχει σωστό τυπωμένο μέγεθος πάνω σε σχέδιο κτιρίου (AutoCAD annotative behaviour).
 *
 * Υποστηρίζεται το vector υποσύνολο που χρειάζονται οι καλούντες: `line` / `polyline` /
 * `text`. Τα `circle` / `dim` / `raster` αγνοούνται σιωπηλά — καμία σκηνή δεν τα ζητά ακόμη
 * (θα προστεθούν όταν υπάρξει καταναλωτής, όχι «προληπτικά» νεκρός κώδικας).
 *
 * @see ./detail-canvas-renderer.ts — backend #1 (preview)
 * @see ./detail-pdf-renderer.ts — backend #2 (PDF)
 */

import type { Point2D } from '../../../../rendering/types/Types';
import type {
  Entity,
  ImageEntity,
  LineEntity,
  PolylineEntity,
  TextEntity,
} from '../../../../types/entities';
import { generateEntityId } from '../../../../systems/entity-creation/utils';
import {
  DEFAULT_RUN_STYLE,
  makeNode,
  makeParagraph,
  makeRun,
} from '../../../../text-engine/templates/defaults/template-helpers';
import type { TextJustification, TextParagraph } from '../../../../text-engine/types/text-ast.types';
import type {
  DetailPrimitive,
  LinePrimitive,
  PolylinePrimitive,
  RasterPrimitive,
  TextAlign,
  TextPrimitive,
} from '../detail-sheet-types';
import { containFitRectMm } from './detail-raster-fit';

/** Πώς προσγειώνεται ένα sheet-mm layout μέσα στη σκηνή. */
export interface SheetToSceneOptions {
  /** Layer των παραγόμενων entities (`''` ⇒ ο create-path βάζει το ενεργό layer). */
  readonly layerId: string;
  /** paper-mm → model units (annotation scale factor· 1:1 ⇒ 1). */
  readonly scaleFactor: number;
  /** Ύψος φύλλου σε mm — datum του y-flip (αρχή = κάτω-αριστερά γωνία). */
  readonly sheetHeightMm: number;
}

/** Παράγραφος στοιχισμένη όπως το primitive (0=αριστερά, 1=κέντρο, 2=δεξιά). Τιμές από
 *  το SSoT `TextParagraph['justification']` (`0|1|2|3`) — όχι γυμνό `number` — ώστε το
 *  lookup να ταιριάζει άμεσα με το `justification` πεδίο του `makeParagraph`. */
const JUSTIFICATION_BY_ALIGN: Readonly<Record<TextAlign, TextParagraph['justification']>> = {
  left: 0,
  center: 1,
  right: 2,
};

/** Σημείο προσάρτησης του MTEXT ανά στοίχιση (μεσαία γραμμή βάσης). */
const ATTACHMENT_BY_ALIGN: Readonly<Record<TextAlign, TextJustification>> = {
  left: 'ML',
  center: 'MC',
  right: 'MR',
};

function toScene(p: Point2D, o: SheetToSceneOptions): Point2D {
  return { x: p.x * o.scaleFactor, y: (o.sheetHeightMm - p.y) * o.scaleFactor };
}

function lineToEntity(prim: LinePrimitive, o: SheetToSceneOptions): LineEntity {
  return {
    id: generateEntityId(),
    type: 'line',
    layerId: o.layerId,
    start: toScene(prim.a, o),
    end: toScene(prim.b, o),
    color: prim.stroke.colorHex,
    lineWidth: prim.stroke.widthMm,
  };
}

function polylineToEntity(prim: PolylinePrimitive, o: SheetToSceneOptions): PolylineEntity {
  return {
    id: generateEntityId(),
    type: 'polyline',
    layerId: o.layerId,
    vertices: prim.points.map((p) => toScene(p, o)),
    closed: prim.closed,
    color: prim.stroke.colorHex,
    lineWidth: prim.stroke.widthMm,
  };
}

function textToEntity(prim: TextPrimitive, o: SheetToSceneOptions): TextEntity {
  const height = prim.heightMm * o.scaleFactor;
  const run = makeRun(prim.text, { ...DEFAULT_RUN_STYLE, height, bold: prim.bold ?? false });
  return {
    id: generateEntityId(),
    type: 'text',
    layerId: o.layerId,
    position: toScene(prim.position, o),
    text: prim.text,
    textNode: makeNode(
      [makeParagraph([run], { justification: JUSTIFICATION_BY_ALIGN[prim.align] })],
      { attachment: ATTACHMENT_BY_ALIGN[prim.align] },
    ),
    height,
    fontSize: height,
    alignment: prim.align,
    color: prim.colorHex,
    rotation: 0,
  };
}

/**
 * ADR-651 Φάση Ε — raster → **`ImageEntity`**: το τρίτο backend απέκτησε καταναλωτή (η
 * σφραγίδα/υπογραφή μηχανικού μέσα στην πινακίδα). Η εικόνα τοποθετείται **contain-fit** με
 * τον ΙΔΙΟ helper που χρησιμοποιεί ο PDF ζωγράφος (`containFitRectMm`) ⇒ η σφραγίδα κάθεται
 * στο **ίδιο ακριβώς σημείο** σε οθόνη και σε χαρτί, με την ίδια αναλογία.
 *
 * Το `url` είναι **αναφορά** (https download URL), ποτέ pixels: το σχέδιο δεν φουσκώνει με
 * base64 και το ίδιο asset μοιράζεται σε όλες τις πινακίδες.
 */
function rasterToEntity(prim: RasterPrimitive, o: SheetToSceneOptions): ImageEntity | null {
  if (!prim.dataUrl || !prim.widthPx || !prim.heightPx) return null;
  const fit = containFitRectMm(prim.rect, prim.widthPx, prim.heightPx);
  if (fit.w <= 0 || fit.h <= 0) return null;
  return {
    id: generateEntityId(),
    type: 'image',
    layerId: o.layerId,
    // Η σκηνή είναι y-πάνω: η κάτω-αριστερή γωνία του ορθογωνίου είναι η ΚΑΤΩ ακμή του
    // sheet-mm rect (y + h), γι' αυτό το `toScene` εφαρμόζεται εκεί.
    position: toScene({ x: fit.x, y: fit.y + fit.h }, o),
    width: fit.w * o.scaleFactor,
    height: fit.h * o.scaleFactor,
    url: prim.dataUrl,
  };
}

/**
 * Μετατρέπει sheet-mm primitives σε scene entities (y-flipped + scaled). Τα primitives που
 * δεν έχουν ακόμη scene αντίστοιχο (`circle`/`dim`) παραλείπονται.
 */
export function detailPrimitivesToEntities(
  primitives: readonly DetailPrimitive[],
  options: SheetToSceneOptions,
): Entity[] {
  const out: Entity[] = [];
  for (const prim of primitives) {
    if (prim.kind === 'line') out.push(lineToEntity(prim, options));
    else if (prim.kind === 'polyline') out.push(polylineToEntity(prim, options));
    else if (prim.kind === 'text') out.push(textToEntity(prim, options));
    else if (prim.kind === 'raster') {
      const image = rasterToEntity(prim, options);
      if (image) out.push(image);
    }
  }
  return out;
}
