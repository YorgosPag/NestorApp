/**
 * ADR-929 Φ5.3γ — ο ελεγκτής της **κάρτας κλίμακας**: υπο-module του ενός γραφέα (`planRecognitionSession.scale`), όπως
 * το `plan-reading-review`. Δεν γράφει τίποτα μόνος του στον διακομιστή: η βαθμονόμηση περνά από τη **μία** πόρτα
 * (`commitCalibration`, Δ4), και μόνο με ρητή πράξη του ανθρώπου.
 *
 * - `card` — η κάρτα για ό,τι υπάρχει **τώρα** (σύντηξη + τοποθέτηση + μονάδες). Η σύντηξη χωρίς γνωστή κλίμακα
 *   (μόνο στη διαφωνία) κρατιέται ανά αποτέλεσμα σύντηξης: ίδια είσοδος ⇒ κανένας δεύτερος υπολογισμός.
 * - `apply` — γράφει **τη λύση της κάρτας** (ό,τι είδε ο άνθρωπος). Αν άλλαξε η σύντηξη ή η θέση της εικόνας στο μεταξύ,
 *   αρνείται (`stale`): ποτέ εγγραφή πάνω σε βάση που ο άνθρωπος δεν είδε.
 * - `syncKnownScale` — μετά από **κάθε** βαθμονόμηση (κάρτα ή διάλογος) η σύντηξη ξανατρέχει με τη νέα κλίμακα: η κάρτα
 *   γίνεται «επιβεβαιωμένη» και η πηγή γραμμών του βοηθού παίρνει νέα έκδοση. Ιδεμποτικό: ίδια κλίμακα ⇒ τίποτα.
 * - `refinement` — §6.23: «Ευθυγράμμιση με τις διαστάσεις» πάνω σε επιβεβαιωμένη βαθμονόμηση, **οκνηρά** (μόνο όταν ο
 *   άνθρωπος τη ζητήσει: θέλει δεύτερη σύντηξη).
 * - §6.24 — κάθε «Εφαρμογή» είναι **βήμα του ενός ιστορικού αναίρεσης** (`changeCalibration` ⇒ `CalibrationChangeCommand`):
 *   το `apply` επιστρέφει την εντολή, που αναιρεί το Ctrl+Z **και** το κουμπί «Αναίρεση» του μηνύματος.
 * - `hover` — ποια διάσταση δείχνει ο άνθρωπος στην κάρτα (επισήμανση στον καμβά).
 *
 * Zero React.
 *
 * @see ./plan-scale-card.ts (η καθαρή παράγωγη)
 * @see ../../floorplan-background/services/commit-calibration.ts (η μία πόρτα εγγραφής)
 */

import type { PlanFusionResult } from '../../bim/plan-recognition/fusion/plan-fusion-types';
import type { PlanReadingOutcome } from '../../bim/plan-recognition/plan-recognition-types';
import { resolveRasterPixelScale, type RasterPixelScale } from '../../floorplan-background/geometry/raster-pixel-scale';
import type { RasterPlacement } from '../../floorplan-background/geometry/raster-scene-mapping';
import {
  transformsEqual,
  type BackgroundTransform,
  type CalibrationData,
  type FloorplanBackground,
} from '../../floorplan-background/providers/types';
import type { CalibrationCommitResult } from '../../floorplan-background/services/commit-calibration';
import type { CalibrationChange, CalibrationChangeCommand } from '../../floorplan-background/services/calibration-command';
import type { SceneUnits } from '../../utils/scene-units';
import { planRecognitionStore, type PlanRecognitionRun } from './plan-recognition-store';
import { planScaleReferences, type PlanScaleReferenceSet } from '../../bim/plan-recognition/fusion/scale-references';
import {
  planScaleCard,
  planScaleRefinement,
  planScaleSubject,
  scaleCardCalibration,
  type PlanScaleCard,
  type PlanScaleCardInput,
  type PlanScaleFailed,
  type PlanScaleProposal,
} from './plan-scale-card';

/** Η θέση της εικόνας **και** η βαθμονόμησή της (η προέλευση μπαίνει στην κάρτα). */
export type PlanScalePlacement = RasterPlacement & Pick<FloorplanBackground, 'calibration'>;

export interface PlanScaleControllerDeps<TSource> {
  /** Η σύντηξη μιας αναγνώρισης (καθαρή): ίδια με εκείνη της συνεδρίας. */
  readonly fuse: (run: PlanRecognitionRun, reading: PlanReadingOutcome | null) => PlanFusionResult;
  /** Υιοθετεί νέα σύντηξη (store + νέα έκδοση πηγής γραμμών). */
  readonly adoptFusion: (run: PlanRecognitionRun, fusion: PlanFusionResult) => TSource;
  readonly background: (floorId: string) => FloorplanBackground | null;
  /** Η μία πόρτα εγγραφής **με** καταγραφή στο ιστορικό αναίρεσης (§6.24, `changeCalibration`). */
  readonly change: (floorId: string, transform: BackgroundTransform, data: CalibrationData, undoName: string) => Promise<CalibrationChange>;
  readonly now: () => number;
}

/** `stale` — η κάρτα υπολογίστηκε πάνω σε άλλη σύντηξη ή άλλη θέση εικόνας από όσα ισχύουν τώρα. */
type PlanScaleApplyStatus = CalibrationCommitResult['status'] | 'stale';

interface PlanScaleApplyResult<TSource> {
  readonly status: PlanScaleApplyStatus;
  readonly overlaysSkipped: number;
  /** Νέα πηγή γραμμών όταν η σύντηξη ξανάτρεξε με τη νέα κλίμακα (`saved`). */
  readonly source: TSource | null;
  /** §6.24 — το βήμα στο ιστορικό αναίρεσης (`saved` μόνο). */
  readonly command: CalibrationChangeCommand | null;
}

const sameScale = (a: RasterPixelScale | null, b: RasterPixelScale | null): boolean =>
  a === b || (a !== null && b !== null && a.source === b.source
    && a.metresPerPixelX === b.metresPerPixelX && a.metresPerPixelY === b.metresPerPixelY);

export function createPlanScaleController<TSource>(getDeps: () => PlanScaleControllerDeps<TSource>) {
  let unknownScaleMemo: { readonly basis: PlanFusionResult; readonly fusion: PlanFusionResult } | null = null;

  /** Η σύντηξη **χωρίς** γνωστή κλίμακα, μία φορά ανά αποτέλεσμα σύντηξης. */
  function dimensionFusion(run: PlanRecognitionRun, reading: PlanReadingOutcome | null, basis: PlanFusionResult): PlanFusionResult {
    if (unknownScaleMemo?.basis !== basis) unknownScaleMemo = { basis, fusion: getDeps().fuse({ ...run, knownScale: null }, reading) };
    return unknownScaleMemo.fusion;
  }

  function cardInput(placement: PlanScalePlacement, sceneUnits: SceneUnits): PlanScaleCardInput | null {
    const { run, reading, fusion } = planRecognitionStore.get();
    if (!run || !fusion) return null;
    const { calibration } = placement;
    return {
      fusion, reading, placement, sceneUnits,
      alignment: run.alignment,
      origin: calibration ? calibration.origin ?? 'manual' : null,
      dimensionFusion: () => dimensionFusion(run, reading, fusion),
    };
  }

  function card(placement: PlanScalePlacement, sceneUnits: SceneUnits): PlanScaleCard | null {
    const input = cardInput(placement, sceneUnits);
    return input === null ? null : planScaleCard(input);
  }

  /** §6.23 — η ευθυγράμμιση μιας επιβεβαιωμένης βαθμονόμησης, μόνο όταν ζητηθεί. */
  function refinement(placement: PlanScalePlacement, sceneUnits: SceneUnits): PlanScaleProposal | PlanScaleFailed | null {
    const input = cardInput(placement, sceneUnits);
    return input === null ? null : planScaleRefinement(input);
  }

  /**
   * Οι διαστάσεις της κάρτας (χρησιμοποιημένες + απορριφθείσες) για την επικάλυψη του καμβά: **ίδια** απόφαση με την
   * κάρτα (`planScaleSubject`), χωρίς επιλυτή (δεν χρειάζεται θέση ή μονάδες για να δείξεις πού είναι μια διάσταση).
   */
  function references(): PlanScaleReferenceSet | null {
    const { run, reading, fusion } = planRecognitionStore.get();
    if (!run || !fusion) return null;
    const subject = planScaleSubject(fusion, reading, () => dimensionFusion(run, reading, fusion));
    if (subject === null) return null;
    const set = planScaleReferences(subject.fusion, run.alignment);
    return set.used.length > 0 ? set : null;
  }

  function syncKnownScale(floorId: string): TSource | null {
    const { run, reading } = planRecognitionStore.get();
    const background = getDeps().background(floorId);
    if (!run || run.floorId !== floorId || !background || background.id !== run.backgroundId) return null;
    const knownScale = resolveRasterPixelScale(background);
    if (sameScale(knownScale, run.knownScale)) return null;
    const next: PlanRecognitionRun = { ...run, knownScale };
    return getDeps().adoptFusion(next, getDeps().fuse(next, reading));
  }

  /** Ισχύει ακόμη η βάση της κάρτας; (ίδια σύντηξη, ίδια θέση εικόνας) */
  function isCurrent(proposal: PlanScaleProposal, floorId: string): boolean {
    const background = getDeps().background(floorId);
    return planRecognitionStore.get().fusion === proposal.basis.fusion
      && background !== null && transformsEqual(background.transform, proposal.basis.transform);
  }

  /** `undoName` = η ήδη μεταφρασμένη ετικέτα του βήματος αναίρεσης (§6.24). */
  async function apply(proposal: PlanScaleProposal, undoName: string): Promise<PlanScaleApplyResult<TSource>> {
    const floorId = planRecognitionStore.get().run?.floorId;
    if (!floorId || !isCurrent(proposal, floorId)) return { status: 'stale', overlaysSkipped: 0, source: null, command: null };
    const { transform, data } = scaleCardCalibration(proposal, getDeps().now());
    const { result, command } = await getDeps().change(floorId, transform, data, undoName);
    // Και στη σύγκρουση ο ελεγκτής ακολουθεί ό,τι υιοθέτησε το store από τον διακομιστή (ιδεμποτικό).
    const source = result.status === 'failed' ? null : syncKnownScale(floorId);
    return { status: result.status, overlaysSkipped: result.overlaysSkipped, source, command };
  }

  function hover(textId: string | null): void {
    if (planRecognitionStore.get().scaleHoverTextId !== textId) planRecognitionStore.patch({ scaleHoverTextId: textId });
  }

  return { card, refinement, references, apply, syncKnownScale, hover };
}

