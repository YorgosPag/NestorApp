/**
 * **Ο χρυσός runner — η μέτρηση μιας περίπτωσης** (ADR-929 §6.21.5): απόδοση της σελίδας όπως η παραγωγή, η αλυσίδα του
 * Worker, και σύγκριση των ανοιγμάτων διάστασης με την αλήθεια.
 *
 * 🔑 **Ίδιο πλέγμα με την παραγωγή.** Η σελίδα αποδίδεται με τον server-side SSoT (`rasterizePdfPageImages`) στην κλίμακα
 * `PDF_RENDER_CONFIG.PLAN_RENDER_SCALE`, την ίδια που διαβάζει το `PdfPageProvider` για την εικόνα της αναγνώρισης.
 * Χωρίς ταβάνι πλάτους: η παραγωγή δεν έχει, και ένα σιωπηλό ταβάνι θα άλλαζε την κλίμακα.
 * 🔑 **Ίδια αλυσίδα με τον Worker.** `handlePlanAlign` (ό,τι εκτελεί ο Worker) → `fusePlan` με τα ορίσματα της συνεδρίας
 * (`plan-recognition-session.ts`): σελίδα PDF, διανυσματικό μέσο, άγνωστη κλίμακα. **Χωρίς** OCR: η ανάγνωση κειμένων δεν
 * τρέχει στο Node, άρα ο runner μετρά ό,τι βγαίνει από τα τμήματα και τους ρόλους τους.
 * 🔑 **Ίδιος κριτής με το CAD.** Οι δηλωμένες διαστάσεις γίνονται `CadTruthDimension` στις μονάδες περιεχομένου, με
 * μετασχηματισμό `userToPx ∘ contentMatrix`, και κρίνονται από το **υπάρχον** `checkSpans`.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/testing/golden-plan-run
 */

import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { composeAffine, type Affine2x3 } from '@/lib/geometry/affine-2x3';
import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import { rasterizePdfPageImages } from '@/services/pdf/pdf-rasterize.service';
import { PDF_RENDER_CONFIG } from '../../../pdf-background/types/pdf.types';
import { handlePlanAlign } from '../alignment/plan-align-host';
import type { PlanAlignment } from '../alignment/plan-alignment-types';
import { extensionAnchorMap, segmentRoleMap, textLinkMap } from '../classify/segment-roles';
import { fusePlan } from '../fusion/plan-fusion';
import type { PlanFusionResult } from '../fusion/plan-fusion-types';
import type { PlanSegmentExtraction } from '../segments/plan-segments';
import type { CadTruthDimension } from './cad-truth/cad-truth-types';
import type { GoldenDeclaredDimensions } from './golden-manifest-schema';
import { checkSpans, type SpanCheck } from './role-scoring/span-check';

/** Μία σελίδα PDF στο πλέγμα της αναγνώρισης, με τον πίνακα χώρος PDF → px. */
export interface GoldenPageImage {
  readonly raster: PlanRaster;
  readonly userToPx: Affine2x3;
}

export interface PlanChainRun {
  readonly alignment: PlanAlignment;
  readonly extraction: PlanSegmentExtraction;
  readonly fusion: PlanFusionResult;
}

const POINTS_PER_INCH = 72;

/** Η σελίδα `page` του PDF, όπως τη βλέπει η αναγνώριση στην παραγωγή. */
export async function renderGoldenPdfPage(absPath: string, page: number): Promise<GoldenPageImage> {
  const pages = await rasterizePdfPageImages(readFileSync(absPath), {
    dpi: PDF_RENDER_CONFIG.PLAN_RENDER_SCALE * POINTS_PER_INCH,
    maxPages: page,
    maxWidthPx: Number.POSITIVE_INFINITY,
  });
  const rendered = pages[page - 1];
  if (rendered === undefined) throw new Error(`PDF has ${pages.length} pages, case asks for page ${page}`);
  const png = PNG.sync.read(rendered.png);
  return {
    raster: { rgba: new Uint8ClampedArray(png.data), width: png.width, height: png.height },
    userToPx: rendered.userToPx,
  };
}

/** Η αλυσίδα του Worker και της συνεδρίας πάνω σε μία εικόνα, κλίμακα άγνωστη όπως στην παραγωγή χωρίς βαθμονόμηση. */
export function runPlanChain(raster: PlanRaster): PlanChainRun {
  const { alignment, segments: extraction } = handlePlanAlign({ kind: 'align', raster, segments: { scale: null } });
  if (extraction === null) throw new Error('plan-align-host returned no segments although they were requested');
  const verdicts = extraction.classification.verdicts;
  const fusion = fusePlan({
    kind: 'multipage-pdf',
    drawing: { choice: null, medium: 'vector' },
    alignment,
    segments: extraction.segments,
    reading: null,
    knownScale: null,
    sourceDpi: null,
    segmentRoles: segmentRoleMap(verdicts),
    extensionAnchors: extensionAnchorMap(verdicts),
    textLinks: textLinkMap(verdicts),
  });
  return { alignment, extraction, fusion };
}

const pointOf = ([x, y]: readonly [number, number]) => ({ x, y });

/** Οι δηλωμένες διαστάσεις ως αλήθεια CAD, στις μονάδες περιεχομένου του PDF. */
function asCadDimensions(truth: GoldenDeclaredDimensions): CadTruthDimension[] {
  return truth.dimensions.map((d) => ({
    text: d.text,
    measured: [pointOf(d.measured[0]), pointOf(d.measured[1])],
    line: [pointOf(d.line[0]), pointOf(d.line[1])],
  }));
}

/** Μονάδες περιεχομένου → px της εικόνας: πρώτα ο `cm` του περιεχομένου, μετά το viewport της απόδοσης. */
export function contentToPx(truth: GoldenDeclaredDimensions, userToPx: Affine2x3): Affine2x3 {
  const [a, b, c, d, e, f] = truth.contentMatrix;
  return composeAffine(userToPx, { a, b, c, d, e, f });
}

/** Τα ανοίγματα της αναγνώρισης απέναντι στις δηλωμένες διαστάσεις. */
export function checkDeclaredDimensions(run: PlanChainRun, truth: GoldenDeclaredDimensions, userToPx: Affine2x3): SpanCheck {
  return checkSpans({
    spans: run.fusion.dimensionSpans,
    segments: run.extraction.segments,
    dimensions: asCadDimensions(truth),
    drawingToPx: contentToPx(truth, userToPx),
  });
}
