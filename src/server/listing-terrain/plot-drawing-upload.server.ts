import 'server-only';

/**
 * @fileoverview **ΤΟ ΣΧΕΔΙΟ ΤΟΥ ΤΟΠΟΓΡΑΦΟΥ, ΞΑΝΑΔΙΑΒΑΣΜΕΝΟ ΑΠΟ ΤΟΝ SERVER** (ADR-920 §14.11 Ζ3 · Π4 · Π5 · Π10).
 * @related lib/terrain/plot-outline/dxf-plot-outline-candidates · lib/terrain/plot-outline/pdf-coordinate-table (ο ΙΔΙΟΣ πυρήνας
 *   με τη συσκευή) · services/pdf/pdf-positioned-text.service · ./plot-outline-confirmation.server (ο καλών)
 * @module server/listing-terrain/plot-drawing-upload.server
 *
 * ```
 * multipart: σχέδιο + { candidateId, showInListing } + (μονάδα)
 *   → είδος ΑΠΟ ΤΑ BYTES (ποτέ το όνομα/`File.type`) · ταβάνι ανά είδος · DWG ⇒ «αποθήκευσε ως DXF» (Π10)
 *   → υποψήφια με τον ΙΔΙΟ πυρήνα του Ζ1 → το υποψήφιο που διάλεξε ο άνθρωπος, ή ονομασμένη άρνηση
 * ```
 *
 * 🔴 **Ο BROWSER ΟΝΟΜΑΖΕΙ ΥΠΟΨΗΦΙΟ, Ο SERVER ΔΙΝΕΙ ΤΟΝ ΔΑΚΤΥΛΙΟ.** Ο δακτύλιος που θα φτάσει στο ανάγλυφο είναι πάντα
 * αυτός που ο server βρήκε στα bytes που **ο ίδιος** θα φυλάξει — καμία σύγκριση αριθμών κινητής υποδιαστολής, καμία
 * εμπιστοσύνη σε παράγωγο του πελάτη (όπως ο κριτής εδάφους ξαναχτίζει το στιγμιότυπο, ADR-920 §13.3).
 */

import { createHash } from 'node:crypto';

import { ApiError } from '@/lib/api/ApiErrorHandler';
import type { TopographicDrawingKind } from '@/lib/listings/topographic-drawing-file-record';
import type { PdfPositionedPage } from '@/lib/pdf/pdf-page-text';
import { dxfPlotOutlineCandidates, scanDxfPlotDrawing } from '@/lib/terrain/plot-outline/dxf-plot-outline-candidates';
import { readPdfPlotOutline } from '@/lib/terrain/plot-outline/pdf-coordinate-table';
import { PLOT_DRAWING_MAX_BYTES } from '@/lib/terrain/plot-outline/plot-outline-config';
import {
  parsePlotOutlineConfirmationRequest,
  type PlotOutlineConfirmationRequest,
} from '@/lib/terrain/plot-outline/plot-outline-confirmation';
import type { PlotOutlineCandidate } from '@/lib/terrain/plot-outline/plot-outline-types';
import { PLOT_OUTLINE_CONFIRM_FIELDS } from '@/lib/terrain/publication/terrain-publication-contract';
import { surveyFileKindOf, SURVEY_FILE_SNIFF_BYTES } from '@/lib/terrain/survey-import/survey-file-kind';
import { decodeSurveyText } from '@/lib/terrain/survey-import/survey-file-read';
import { declaredDxfScaleToMm } from '@/lib/terrain/survey-import/survey-points';
import { TOPO_UNIT_SCALE_TO_MM, isTopoUnit, type TopoUnit } from '@/lib/terrain/survey-import/topo-import-types';
import { readPdfPositionedPages } from '@/services/pdf/pdf-positioned-text.service';

/** Το σχέδιο όπως το κράτησε ο server — bytes, είδος και αποτύπωμα, όλα μετρημένα εδώ. */
export interface PlotDrawingUpload {
  /** Πάνω σε `ArrayBuffer` (όχι κοινόχρηστο): γίνεται κατευθείαν `File` για τη φύλαξη στον φάκελο. */
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly kind: TopographicDrawingKind;
  readonly fileName: string;
  readonly sha256: string;
}

/** Ό,τι διάλεξε ο άνθρωπος, ως το υποψήφιο που ο server βρήκε στο σχέδιο. */
export interface PlotDrawingChoice {
  readonly drawing: PlotDrawingUpload;
  readonly request: PlotOutlineConfirmationRequest;
  readonly candidate: PlotOutlineCandidate;
  /** Η μονάδα που επιβεβαίωσε ο άνθρωπος — `null` όταν τη δήλωνε το αρχείο ή όταν είναι PDF (ΕΓΣΑ σε μέτρα). */
  readonly drawingUnit: TopoUnit | null;
}

/** Το είδος από τα πρώτα bytes — DXF ή PDF, αλλιώς ονομασμένη άρνηση (το DWG με τη δική του οδηγία). */
function drawingKindOf(fileName: string, bytes: Uint8Array): TopographicDrawingKind {
  const kind = surveyFileKindOf(fileName, bytes.subarray(0, SURVEY_FILE_SNIFF_BYTES));
  if (kind === 'dxf' || kind === 'pdf') return kind;
  if (kind === 'dwg') throw new ApiError(415, 'TERRAIN_DRAWING_DWG');
  throw new ApiError(415, 'TERRAIN_DRAWING_TYPE_UNSUPPORTED');
}

/** Το αρχείο του σχεδίου: παρόν, μη κενό, γνωστό είδος, κάτω από το ταβάνι **του είδους του**. */
async function readDrawing(formData: FormData): Promise<PlotDrawingUpload> {
  const file = formData.get(PLOT_OUTLINE_CONFIRM_FIELDS.drawing);
  if (!(file instanceof File)) throw new ApiError(400, 'TERRAIN_DRAWING_REQUIRED');
  if (file.size === 0) throw new ApiError(400, 'TERRAIN_DRAWING_EMPTY');
  // Φθηνός έλεγχος πριν διαβαστούν τα bytes: κανένα είδος δεν δέχεται περισσότερα από το μεγαλύτερο ταβάνι.
  if (file.size > Math.max(PLOT_DRAWING_MAX_BYTES.dxf, PLOT_DRAWING_MAX_BYTES.pdf)) throw new ApiError(413, 'TERRAIN_DRAWING_TOO_LARGE');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = drawingKindOf(file.name, bytes);
  if (bytes.byteLength > PLOT_DRAWING_MAX_BYTES[kind]) throw new ApiError(413, 'TERRAIN_DRAWING_TOO_LARGE');
  return { bytes, kind, fileName: file.name, sha256: createHash('sha256').update(bytes).digest('hex') };
}

/** Η μονάδα που έστειλε ο άνθρωπος — μόνο μία από τις γνωστές, αλλιώς «δεν είπε». */
function readDrawingUnit(formData: FormData): TopoUnit | null {
  const raw = formData.get(PLOT_OUTLINE_CONFIRM_FIELDS.drawingUnit);
  return isTopoUnit(raw) ? raw : null;
}

interface DrawingCandidates {
  readonly candidates: readonly PlotOutlineCandidate[];
  readonly drawingUnit: TopoUnit | null;
}

/** DXF → υποψήφια, WORLD mm. Η μονάδα: του αρχείου (`$INSUNITS`) αν τη δηλώνει, αλλιώς του ανθρώπου — ποτέ μαντεψιά. */
function dxfCandidates(drawing: PlotDrawingUpload, unit: TopoUnit | null): DrawingCandidates {
  const scanned = scanDxfPlotDrawing(decodeSurveyText(drawing.bytes));
  const declared = declaredDxfScaleToMm(scanned.declaredInsunits);
  const scaleToMm = declared ?? (unit === null ? null : TOPO_UNIT_SCALE_TO_MM[unit]);
  if (scaleToMm === null) throw new ApiError(422, 'TERRAIN_DRAWING_UNIT_REQUIRED');
  return { candidates: dxfPlotOutlineCandidates(scanned, scaleToMm).candidates, drawingUnit: declared === null ? unit : null };
}

/** PDF → υποψήφια από τον πίνακα συντεταγμένων (Π5). PDF που δεν ανοίγει ⇒ ίδια άρνηση με «χωρίς πίνακα». */
async function pdfCandidates(drawing: PlotDrawingUpload): Promise<DrawingCandidates> {
  let pages: PdfPositionedPage[];
  try {
    pages = await readPdfPositionedPages(drawing.bytes);
  } catch {
    throw new ApiError(422, 'TERRAIN_DRAWING_UNREADABLE');
  }
  const reading = readPdfPlotOutline(pages);
  const candidates = reading.status === 'tables' ? reading.tables.map((table) => table.candidate) : [];
  return { candidates, drawingUnit: null };
}

/**
 * 🏆 **Το σχέδιο και η επιλογή, κριμένα** — σειρά «φθηνό πρώτα»: η επιλογή (JSON) πριν διαβαστούν megabytes, το PDF
 * τελευταίο. Το υποψήφιο βρίσκεται **με το id του** ανάμεσα σε όσα βρήκε ο server· κανένα ⇒ `TERRAIN_DRAWING_UNREADABLE`,
 * άλλο ⇒ `TERRAIN_PLOT_OUTLINE_NOT_IN_DRAWING`.
 */
export async function readPlotDrawingChoice(formData: FormData): Promise<PlotDrawingChoice> {
  const request = parsePlotOutlineConfirmationRequest(formData.get(PLOT_OUTLINE_CONFIRM_FIELDS.choice));
  if (request === null) throw new ApiError(400, 'TERRAIN_PLOT_OUTLINE_INVALID');
  const drawing = await readDrawing(formData);

  const read = drawing.kind === 'dxf' ? dxfCandidates(drawing, readDrawingUnit(formData)) : await pdfCandidates(drawing);
  if (read.candidates.length === 0) throw new ApiError(422, 'TERRAIN_DRAWING_UNREADABLE');

  const candidate = read.candidates.find((c) => c.id === request.candidateId);
  if (candidate === undefined) throw new ApiError(422, 'TERRAIN_PLOT_OUTLINE_NOT_IN_DRAWING');
  return { drawing, request, candidate, drawingUnit: read.drawingUnit };
}
