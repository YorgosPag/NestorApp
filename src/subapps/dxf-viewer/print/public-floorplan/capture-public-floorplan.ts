/**
 * @fileoverview **Η ΕΙΚΟΝΑ ΤΗΣ ΔΗΜΟΣΙΑΣ ΚΑΤΟΨΗΣ** — από το τρέχον σχέδιο σε PNG + τη συνταγή που την εξηγεί (ADR-909 Β2.3).
 * @related ADR-909 Α2 (raster) · Α4 (προφίλ) · Α6 (συνταγή) · ADR-453 (μηχανή εκτύπωσης) · ./public-floorplan-view
 * @module subapps/dxf-viewer/print/public-floorplan/capture-public-floorplan
 *
 * Η σειρά, και γιατί αυτή:
 *
 * 1. **μετατροπή** της σκηνής + ενυδάτωση στρωμάτων — ο ίδιος δρόμος με την εκτύπωση·
 * 2. **προφίλ** πάνω στη μετατραπείσα σκηνή — ό,τι δεν φεύγει στο κοινό φεύγει **πριν** μετρηθούν τα όρια·
 * 3. **διαστάσεις** από τα όρια όσων έμειναν — η εικόνα έχει τον λόγο πλευρών του διαμερίσματος, όχι χαρτιού·
 * 4. **απόδοση** με τον πραγματικό `DxfRenderer`, στην όψη της δημόσιας κάτοψης·
 * 5. **κάδρο** = ποιο ορθογώνιο του **σχεδίου** δείχνουν τα pixels — από τον μετασχηματισμό που **χρησιμοποιήθηκε**.
 *
 * 🔑 Τα βήματα 2–5 τρέχουν **σύγχρονα** μέσα στο `renderInPublicFloorplanView`. Τα δύο `await` ζουν **έξω**
 * από την όψη: οι εικόνες του σχεδίου **πριν** (Β2.6 — ένας σύγχρονος αποδότης δεν τις περιμένει), και η
 * κωδικοποίηση PNG **μετά**.
 *
 * ⛔ **ΟΧΙ** `thumbnail-generator` / `svg-from-dxf-scene`: παραλείπουν σιωπηλά κάθε οντότητα BIM (ADR-909 §2).
 */

import type { FloorplanRenderRecipe } from '@/lib/listings/floorplan-render-recipe';
import { PUBLIC_FLOORPLAN_PROFILE, canonicalFloorplanGroups } from '@/lib/listings/floorplan-render-recipe';
import { FLOORPLAN_CONTENT_TYPE, FLOORPLAN_MAX_BYTES } from '@/lib/listings/floorplan-publication-contract';

import type { SceneModel } from '../../types/entities';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { isEntityLayerSkipped } from '../../canvas-v2/dxf-canvas/dxf-entity-layer-skip';
import { createCombinedBounds } from '../../utils/bounds-utils';
import type { RasterTargetPx } from '../config/paper-types';
import { rasterToViewport } from '../config/paper-math';
import { MM_PER_INCH } from '../config/paper-constants';
import { PRINT_PAPER_HEX } from '../../config/print-color-policy';
import { MIN_ENTITY_CONTRAST } from '../../config/contrast-adaptation';
import { convertSceneForCapture, preloadCaptureAssets, renderDxfSceneOffscreen } from '../capture/capture-2d';
import { captureAssetFidelity } from '../capture/capture-asset-fidelity';
import type { PrintFidelityNote } from '../print-fidelity';
import { applyPublicFloorplanProfile, type PublicFloorplanGroupCounts } from './public-floorplan-profile';
import type { PublicFloorplanChoice } from './public-floorplan-presets';
import { renderInPublicFloorplanView } from './public-floorplan-view';

/**
 * Η μακριά πλευρά της εικόνας. Πάνω από το μεγαλύτερο πλάτος του ραφιού (2560) ώστε το webp να ψήνεται από
 * **περισσότερα** pixels απ' όσα δείχνει· κάτω από το ταβάνι της πόρτας (8192).
 */
const LONG_SIDE_PX = 4096;
/** Κάτω από αυτό μια πολύ στενόμακρη κάτοψη θα γινόταν λωρίδα λίγων pixels. */
const MIN_SHORT_SIDE_PX = 512;
/**
 * 🔴 **Η εικόνα δεν είναι χαρτί — είναι οθόνη.** Το πάχος μιας πένας είναι sheet-mm, άρα θέλει «φύλλο»· και
 * το φύλλο μιας κάτοψης αγγελίας είναι **όσο τη βλέπει ο αγοραστής**, όχι Α3.
 *
 * Μετρημένο ζωντανά (2026-10-08, 95 τ.μ.): με `300 dpi` τα 4096 px αντιστοιχούσαν σε φύλλο **347 mm** ⇒ κάθε
 * γραμμή έβγαινε **1–2 px**, δηλαδή μισό pixel στο ράφι των 1280 — «τοίχοι σαν τρίχες», μελάνι 1,6% της εικόνας.
 * Ο νόμος είναι του Revit: *τα πάχη είναι σχετικά με το μέγεθος της εικόνας — μεγαλύτερη εικόνα, λεπτότερες
 * γραμμές*. Άρα δηλώνεται **το φύλλο**, και το dpi **προκύπτει**.
 */
const NOMINAL_SHEET_LONG_SIDE_MM = 150;
/** Ονομαστική ανάλυση: ορίζει **μόνο** το πάχος γραμμών ISO σε pixels (ADR-454). ≈ 694 dpi. */
const NOMINAL_DPI = (LONG_SIDE_PX * MM_PER_INCH) / NOMINAL_SHEET_LONG_SIDE_MM;
/**
 * Το **μικρότερο** πλάτος στο οποίο οφείλει να διαβάζεται η κάτοψη (κάρτα αγγελίας σε κινητό, πυκνότητα 2×).
 * Από αυτό βγαίνει το δάπεδο πάχους: καμία γραμμή κάτω από **1 px εκεί**.
 */
const SMALLEST_LEGIBLE_WIDTH_PX = 1024;
/** Εξάγεται για την πύλη pixels (CHECK 3.101): κρίνει κάθε γραμμή με **αυτό** το δάπεδο, όχι με δεύτερο αριθμό. */
export const PUBLIC_FLOORPLAN_MIN_LINE_WIDTH_PX = LONG_SIDE_PX / SMALLEST_LEGIBLE_WIDTH_PX;
/**
 * ADR-909 Γ2.1 — το δάπεδο αντίθεσης κάθε γραμμής προς το χαρτί: το **ίδιο** κατώφλι που το έργο επιβάλλει σε
 * κάθε οντότητα της οθόνης (WCAG 1.4.11, 3:1) και με το οποίο κρίνει η πύλη pixels (Κ2). Το δηλώνει **μόνο** η
 * δημόσια κάτοψη — το PDF του μηχανικού τυπώνει τα χρώματά του αυτούσια.
 */
const PUBLIC_FLOORPLAN_MIN_INK_CONTRAST = MIN_ENTITY_CONTRAST;

interface WorldBounds {
  readonly min: Point2D;
  readonly max: Point2D;
}

/** Γιατί **δεν** βγήκε εικόνα — με όνομα, ώστε ο διάλογος να πει στον άνθρωπο τι να κάνει. */
export type PublicFloorplanCaptureRefusal = 'no-geometry' | 'too-large' | 'encode-failed';

export type PublicFloorplanCapture =
  | {
      readonly ok: true;
      /** Τα bytes που θα δει ο άνθρωπος **και** θα φύγουν — ένα αντικείμενο, όχι δύο αποδόσεις. */
      readonly blob: Blob;
      readonly recipe: FloorplanRenderRecipe;
      /** Τύποι στοιχείων που το προφίλ δεν γνωρίζει και **έμειναν έξω**. */
      readonly unruledTypes: readonly string[];
      /**
       * Ό,τι **έχασε** η εικόνα έναντι του σχεδίου (π.χ. εικόνα υλικού που δεν φόρτωσε ⇒ επίπεδο χρώμα).
       * Κενό ⇒ πιστή. Ο διάλογος το ονομάζει **πριν** ο άνθρωπος πατήσει «Δημοσίευση» (ADR-909 Β2.6).
       */
      readonly fidelity: readonly PrintFidelityNote[];
      /** Πόσα στοιχεία έχει το σχέδιο σε κάθε προαιρετική ομάδα — ο διάλογος το γράφει δίπλα στον διακόπτη. */
      readonly groupCounts: PublicFloorplanGroupCounts;
    }
  | { readonly ok: false; readonly why: PublicFloorplanCaptureRefusal };

export interface PublicFloorplanCaptureInput {
  readonly scene: SceneModel | null;
  /** Ομάδες και χρώμα, όπως τα διάλεξε ο άνθρωπος στον διάλογο (ADR-909 Β2.8). */
  readonly choice: PublicFloorplanChoice;
}

/**
 * **Πόσα pixels**, από τα όρια του σχεδίου — `null` όταν δεν υπάρχει τίποτα να φανεί.
 *
 * Η μακριά πλευρά είναι σταθερή· η κοντή ακολουθεί τον λόγο πλευρών και στρογγυλεύεται σε **ακέραιο**
 * *(η πόρτα συγκρίνει τις διαστάσεις της συνταγής με το IHDR των bytes — ακριβής ισότητα)*.
 */
export function publicFloorplanRasterOf(bounds: WorldBounds | null): RasterTargetPx | null {
  if (bounds === null) return null;
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(width) || !Number.isFinite(height) || (width <= 0 && height <= 0)) return null;

  const landscape = width >= height;
  const ratio = landscape ? height / width : width / height;
  const shortSide = Math.min(LONG_SIDE_PX, Math.max(MIN_SHORT_SIDE_PX, Math.round(LONG_SIDE_PX * ratio)));

  return {
    widthPx: landscape ? LONG_SIDE_PX : shortSide,
    heightPx: landscape ? shortSide : LONG_SIDE_PX,
    effectiveDpi: NOMINAL_DPI,
  };
}

/**
 * **Ποιο ορθογώνιο του σχεδίου δείχνει η εικόνα** — από τον μετασχηματισμό που πράγματι ζωγράφισε.
 *
 * 🔑 Όχι από τα όρια της σκηνής: το «χώρεσέ το» προσθέτει περιθώριο, και το κάδρο οφείλει να είναι **ό,τι
 * δείχνουν τα pixels** — πάνω του θα μετατραπούν τα σημεία λήψης στη Β4.
 */
export function publicFloorplanFrameOf(
  transform: ViewTransform,
  viewport: Viewport,
): FloorplanRenderRecipe['frame'] {
  const a = CoordinateTransforms.screenToWorld({ x: 0, y: 0 }, transform, viewport);
  const b = CoordinateTransforms.screenToWorld({ x: viewport.width, y: viewport.height }, transform, viewport);
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  };
}

interface RenderedFloorplan {
  readonly canvas: HTMLCanvasElement;
  readonly recipe: FloorplanRenderRecipe;
  readonly unruledTypes: readonly string[];
  readonly fidelity: readonly PrintFidelityNote[];
  readonly groupCounts: PublicFloorplanGroupCounts;
}

/** Λευκό **πίσω** από το σχέδιο: ο αποδότης αφήνει διαφανή καμβά, και ένα διαφανές PNG ψήνεται μαύρο. */
function layPaperBehind(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = PRINT_PAPER_HEX;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

/** Τα σύγχρονα βήματα 1–5. `null` ⇒ δεν έμεινε τίποτα να φανεί μετά το προφίλ. */
function renderPublicFloorplan(input: PublicFloorplanCaptureInput): RenderedFloorplan | null {
  const converted = convertSceneForCapture(input.scene);
  const { plotStyle } = input.choice;
  const groups = canonicalFloorplanGroups(input.choice.groups);

  return renderInPublicFloorplanView(() => {
    const { scene, unruledTypes, groupCounts } = applyPublicFloorplanProfile(
      converted,
      { groups: new Set(groups) },
      (entity) => isEntityLayerSkipped(entity, converted.layersById),
    );
    const raster = publicFloorplanRasterOf(createCombinedBounds(scene, [], true));
    if (raster === null) return null;

    const viewport = rasterToViewport(raster);
    const { canvas, transform } = renderDxfSceneOffscreen(scene, viewport, {
      scene: input.scene,
      raster,
      fitMode: 'fit-to-page',
      plotStyle,
      minLineWidthPx: PUBLIC_FLOORPLAN_MIN_LINE_WIDTH_PX,
      minInkContrast: PUBLIC_FLOORPLAN_MIN_INK_CONTRAST,
    });
    layPaperBehind(canvas);

    return {
      canvas,
      unruledTypes,
      groupCounts,
      // Πάνω σε ό,τι **ζωγραφίστηκε** (μετά το προφίλ): εικόνα ή σχήμα 3Δ που το προφίλ έκρυψε δεν είναι απώλεια.
      fidelity: captureAssetFidelity(scene.entities, plotStyle),
      recipe: {
        profileId: PUBLIC_FLOORPLAN_PROFILE.id,
        profileVersion: PUBLIC_FLOORPLAN_PROFILE.version,
        frame: publicFloorplanFrameOf(transform, viewport),
        widthPx: raster.widthPx,
        heightPx: raster.heightPx,
        plotStyle,
        groups,
      },
    };
  });
}

function encodePng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, FLOORPLAN_CONTENT_TYPE));
}

/**
 * **Από το σχέδιο στην εικόνα που θα δει το κοινό.**
 *
 * ⚠️ Δεν πετά για λόγο που ο άνθρωπος μπορεί να διορθώσει — επιστρέφει **ονομασμένη** άρνηση.
 */
export async function capturePublicFloorplan(input: PublicFloorplanCaptureInput): Promise<PublicFloorplanCapture> {
  // 🔑 Το `await` των εικόνων **και των σχημάτων 3Δ** ζει **εδώ** — πριν και έξω από το
  // `renderInPublicFloorplanView`, που μένει σύγχρονο. Μετρημένο ζωντανά (2026-10-09): χωρίς αυτό, πέτρα και
  // πλακάκι έβγαιναν επίπεδο γκρι (Β2.6), και έπιπλο που δεν είχε φορτώσει έβγαινε κουτί-εφεδρεία (Γ1β).
  await preloadCaptureAssets(input.scene, input.choice.plotStyle);

  const rendered = renderPublicFloorplan(input);
  if (rendered === null) return { ok: false, why: 'no-geometry' };

  const blob = await encodePng(rendered.canvas);
  if (blob === null) return { ok: false, why: 'encode-failed' };
  // 🔑 Η πόρτα θα το αρνιόταν ούτως ή άλλως· εδώ ο άνθρωπος το μαθαίνει **πριν** ανεβάσει megabytes.
  if (blob.size > FLOORPLAN_MAX_BYTES) return { ok: false, why: 'too-large' };

  return {
    ok: true,
    blob,
    recipe: rendered.recipe,
    unruledTypes: rendered.unruledTypes,
    fidelity: rendered.fidelity,
    groupCounts: rendered.groupCounts,
  };
}
