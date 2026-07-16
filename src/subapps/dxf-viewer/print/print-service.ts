/**
 * ADR-453 — Print/Export engine · facade (SSoT orchestrator).
 *
 * Orchestrates capture → assemble → output. Both 2D and 3D sources converge on
 * the SAME assembler (`assemblePrintPdf`) and the SAME output primitives
 * (`triggerExportDownload` / `openBlobInNewTab`), which is the SSoT guarantee.
 *
 * **ADR-651 Φάση ΣΤ** — η πινακίδα του PDF δεν φτιάχνεται πια εδώ: το print **διαβάζει** την
 * ενεργή πινακίδα (preset / κορνίζα / πραγματικά στοιχεία έργου) από τους ΙΔΙΟΥΣ event-time
 * SSoT που τροφοδοτούν και την οθόνη, και την τυπώνει από το ΙΔΙΟ layout model. Δύο μόνο
 * πράγματα κρατά για τον εαυτό του, γιατί ανήκουν στην εκτύπωση:
 *   - το **χαρτί** = αυτό του `PrintRequest` (τυπώνεις σε ό,τι βάζεις στον εκτυπωτή),
 *   - η **κλίμακα** = αυτή που ΟΝΤΩΣ τυπώνεται (1:N του διαλόγου, όχι της οθόνης).
 *
 * @module subapps/dxf-viewer/print/print-service
 */

import { createModuleLogger } from '@/lib/telemetry';
import { triggerExportDownload, openBlobInNewTab } from '@/lib/exports/trigger-export-download';
import type { SceneModel } from '../types/entities';
import type { SceneUnits } from '../utils/scene-units';
import {
  buildActiveTitleBlockScope,
  buildActiveTitleBlockSheetOptions,
  titleBlockTemplateForLocale,
  warmActiveTitleBlockQr,
  type TitleBlockScopeOverrides,
} from '../text-engine/title-block/active-title-block';
import { useTitleBlockOptionsStore } from '../state/title-block-options-store';
import { buildPrintSheet, type PrintSheet } from '../text-engine/title-block/print-sheet';
import type { SheetSetItem } from '../text-engine/title-block/sheet-set';
import type { TitleBlockLocale } from '../text-engine/title-block/title-block-presets';
import { resolveTitleBlockContent } from '../text-engine/title-block/title-block-rows';
import type { PrintRequest, RasterTargetPx } from './config/paper-types';
import { EXPORT_DPI, DEFAULT_PAGE_MARGIN_MM } from './config/paper-constants';
import {
  computeRasterPxForArea,
  formatScaleText,
  resolveAppliedScaleDenominator,
  resolvePrintableAreaMm,
} from './config/paper-math';
import type { CaptureResult } from './capture/capture-types';
import { captureCurrent2dView } from './capture/capture-2d';
import { captureCurrent2dViewVector } from './capture/capture-2d-vector';
import { assemblePrintPdf, assemblePrintPdfPages, type PrintPage } from './assemble/pdf-assembler';
import { mergePrintFidelity, type PrintFidelityNote } from './print-fidelity';
import { EventBus } from '../systems/events/EventBus';
import { buildPrintFilename } from './print-filename';

const logger = createModuleLogger('DXF_PRINT');

export interface PrintDeps {
  /** Active 2D scene (required for source='2d'). */
  scene: SceneModel | null;
  userDrawingUnits?: SceneUnits;
  /** Project/drawing name for the filename. */
  projectName: string;
  /** Injected ISO date string (nowISO().slice(0,10)) — keeps the service pure. */
  dateStr: string;
  /**
   * Slice 3 — 3D snapshot provider, wired by PrintHost when a 3D scene is
   * mounted. Decouples this service from Three.js.
   */
  capture3d?: (raster: RasterTargetPx) => Promise<CaptureResult>;
  /**
   * ADR-651 Φάση ΣΤ — η γλώσσα του προτύπου πινακίδας (Απόφαση #8). Μόνο αυτό χρειάζεται ο
   * host: ΟΛΑ τα υπόλοιπα (preset, κορνίζα, στοιχεία έργου/μελετητή) ζουν ήδη σε SSoT που
   * διαβάζονται event-time — καμία δεύτερη πηγή αλήθειας για την πινακίδα.
   */
  titleBlockLocale?: TitleBlockLocale;
}

/**
 * Η πινακίδα + η κορνίζα του τυπωμένου φύλλου, ή `undefined` όταν ο χρήστης δεν τη θέλει
 * (ή δεν υπάρχει γλώσσα προτύπου — π.χ. εκτός React host, στα tests).
 *
 * ADR-651 Φάση Ζ: τα `overrides` (τίτλος/αριθμός φύλλου) διαφέρουν ανά φύλλο στο σετ —
 * ίδια κατά τα άλλα πινακίδα, από το ΙΔΙΟ layout model.
 */
function buildSheet(
  request: PrintRequest,
  deps: PrintDeps,
  overrides?: TitleBlockScopeOverrides,
): PrintSheet | undefined {
  const locale = deps.titleBlockLocale;
  if (!request.includeTitleBlock || !locale) return undefined;

  const scaleName = formatScaleText(
    resolveAppliedScaleDenominator(request.fitMode, request.scaleDenominator),
  );
  const scopeOverrides = { scaleName, ...overrides };
  const content = resolveTitleBlockContent(
    titleBlockTemplateForLocale(locale),
    buildActiveTitleBlockScope(locale, scopeOverrides),
  );
  return buildPrintSheet({
    paper: request.paper,
    content,
    // ADR-651 Φάση Ε: το PDF θέλει τη σφραγίδα ως **data URL** (ο jsPDF `addImage` δεν
    // δέχεται remote URL) — η ίδια εικόνα, άλλη μορφή· ίδιο layout model με την οθόνη.
    // Φάση Λ: τα ίδια overrides περνούν στο QR ⇒ σωστό αποτύπωμα ανά φύλλο (per-sheet sheetNumber).
    options: buildActiveTitleBlockSheetOptions(locale, 'data-url', scopeOverrides),
  });
}

/**
 * Capture ενός συγκεκριμένου 2D scene (SSoT — μοιράζεται από single print + σετ φύλλων).
 * ADR-608 — vector είναι το 2D default (επιλέξιμες οντότητες, zoom-safe)· raster fallback.
 */
async function capture2dScene(
  request: PrintRequest,
  scene: SceneModel | null,
  userDrawingUnits: SceneUnits | undefined,
  raster: RasterTargetPx,
): Promise<CaptureResult> {
  const capture2dInput = {
    scene,
    userDrawingUnits,
    raster,
    fitMode: request.fitMode,
    scaleDenominator: request.scaleDenominator,
    plotStyle: request.plotStyle,
  };
  // ADR-608 hybrid — το vector path είναι πλέον async (προ-decode εικόνων)· raster μένει sync.
  return request.outputMode === 'raster'
    ? captureCurrent2dView(capture2dInput)
    : captureCurrent2dViewVector(capture2dInput);
}

/** Route to the correct capture adapter by source. */
async function captureSource(
  request: PrintRequest,
  deps: PrintDeps,
  raster: RasterTargetPx,
): Promise<CaptureResult> {
  if (request.source === '3d') {
    if (!deps.capture3d) {
      throw new Error('3D capture provider unavailable');
    }
    // 3D has no vector representation (real materials/shading) → always raster.
    return deps.capture3d(raster);
  }
  return capture2dScene(request, deps.scene, deps.userDrawingUnits, raster);
}

/**
 * ADR-667 Φ1 — ανακοίνωσε κάθε απόκλιση του PDF από την οθόνη. Καμία απώλεια ⇒ **καμία
 * εκπομπή** (πιστό PDF δεν ενοχλεί τον χρήστη). Fire-and-forget: η ειδοποίηση είναι
 * παρενέργεια, δεν μπλοκάρει το κατέβασμα (N.7.2 #6).
 */
function reportFidelity(notes: readonly PrintFidelityNote[]): void {
  if (notes.length === 0) return;
  EventBus.emit('dxf:print-fidelity-degraded', { notes });
  logger.warn('Print fidelity degraded', { notes });
}

/** Route the assembled blob to download or OS print dialog. */
function routeOutput(blob: Blob, request: PrintRequest, deps: PrintDeps): void {
  if (request.target === 'open-print') {
    openBlobInNewTab(blob, { onLoad: (w) => w.print() });
    return;
  }
  triggerExportDownload({
    blob,
    filename: buildPrintFilename(deps.projectName, request.paper.size, deps.dateStr),
  });
}

/**
 * Run a full print job. Throws on capture/assembly failure so the dialog can
 * surface an error to the user.
 */
export async function runPrint(request: PrintRequest, deps: PrintDeps): Promise<void> {
  // Το φύλλο υπολογίζεται ΠΡΙΝ το capture: ορίζει την περιοχή στην οποία θα ζωγραφιστεί το
  // σχέδιο (και άρα το μέγεθος του raster) — μηδέν await μέσα στο render path (N.7.2).
  const sheet = buildSheet(request, deps);
  const area =
    sheet?.drawingAreaMm ?? resolvePrintableAreaMm(request.paper, DEFAULT_PAGE_MARGIN_MM);
  const raster = computeRasterPxForArea(area, EXPORT_DPI);
  const capture = await captureSource(request, deps, raster);
  const blob = await assemblePrintPdf({
    capture,
    paper: request.paper,
    area,
    sheetPrimitives: sheet?.primitives,
    // Λεζάντα μόνο όταν υπάρχει ΠΡΑΓΜΑΤΙΚΗ κλίμακα (fit-to-page ⇒ καμία λεζάντα, όπως πριν).
    scaleText: capture.appliedScaleDenominator
      ? formatScaleText(capture.appliedScaleDenominator)
      : null,
  });
  routeOutput(blob, request, deps);
  reportFidelity(capture.fidelity ?? []);
  logger.info('Print job completed', {
    source: request.source,
    paper: `${request.paper.size}/${request.paper.orientation}`,
    fitMode: request.fitMode,
    target: request.target,
    titleBlock: sheet !== undefined,
  });
}

/**
 * ADR-651 Φάση Ζ — τυπώνει **ολόκληρο σετ φύλλων** ενός έργου σε ΕΝΑ πολυσέλιδο PDF: ένα
 * φύλλο ανά όροφο (`SheetSetItem`), με **αυτόματη αρίθμηση** (Α-1, Α-2…) και **συνεπή
 * πινακίδα** — μία αλλαγή στα στοιχεία έργου φαίνεται σε όλα (πρακτική AutoCAD Sheet Set
 * Manager / Vectorworks batch / ArchiCAD Layout Book).
 *
 * Μηδέν δεύτερη μηχανή: κάθε φύλλο = το ΙΔΙΟ `buildSheet` (με per-sheet τίτλο/αριθμό) + το
 * ΙΔΙΟ 2D capture + ο ΙΔΙΟΣ assembler (πλέον πολυσέλιδος). Σετ = **2Δ μόνο** (τα levels
 * είναι 2Δ κατόψεις). Κάθε φύλλο capture-άρεται και μπαίνει στη σελίδα του **σειριακά**
 * ⇒ το per-scene layer hydration δεν διαρρέει μεταξύ σελίδων.
 */
export async function runPrintSet(
  request: PrintRequest,
  deps: PrintDeps,
  sheets: readonly SheetSetItem[],
): Promise<void> {
  if (sheets.length === 0) throw new Error('Sheet set is empty');

  // Φάση Λ — κάθε φύλλο έχει δικό του QR (per-sheet αριθμός φύλλου). Το QR γεννιέται ασύγχρονα,
  // αλλά ο βρόχος συναρμολόγησης είναι σύγχρονος (ADR-040) ⇒ προ-φορτώνουμε ΟΛΑ τα QR εδώ, πριν.
  // Gated: μόνο όταν ο χρήστης θέλει QR (αλλιώς μηδέν περιττή γέννηση για σετ πολλών φύλλων).
  if (deps.titleBlockLocale && useTitleBlockOptionsStore.getState().withQr) {
    await Promise.all(
      sheets.map((sheet) =>
        warmActiveTitleBlockQr({ title: sheet.title, sheetNumber: sheet.sheetNumber }),
      ),
    );
  }

  const pages: PrintPage[] = [];
  for (const sheet of sheets) {
    const built = buildSheet(request, deps, {
      title: sheet.title,
      sheetNumber: sheet.sheetNumber,
    });
    const area =
      built?.drawingAreaMm ?? resolvePrintableAreaMm(request.paper, DEFAULT_PAGE_MARGIN_MM);
    const raster = computeRasterPxForArea(area, EXPORT_DPI);
    // eslint-disable-next-line no-await-in-loop — φύλλα σειριακά (per-scene layer hydration δεν διαρρέει)
    const capture = await capture2dScene(request, sheet.scene, sheet.userDrawingUnits, raster);
    pages.push({
      capture,
      area,
      sheetPrimitives: built?.primitives,
      scaleText: capture.appliedScaleDenominator
        ? formatScaleText(capture.appliedScaleDenominator)
        : null,
    });
  }

  const blob = await assemblePrintPdfPages(pages, request.paper);
  routeOutput(blob, request, deps);
  // Ένα PDF ⇒ μία σύνοψη: τα φύλλα συγχωνεύονται (όχι ένα toast ανά όροφο).
  reportFidelity(mergePrintFidelity(pages.map((p) => p.capture.fidelity ?? [])));
  logger.info('Print set completed', {
    sheets: sheets.length,
    paper: `${request.paper.size}/${request.paper.orientation}`,
    fitMode: request.fitMode,
    target: request.target,
  });
}
