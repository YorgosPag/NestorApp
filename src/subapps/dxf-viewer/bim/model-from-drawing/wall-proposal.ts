/**
 * ADR-911 Φ1 — **Πρόταση τοίχων από το σχέδιο** (ο καθαρός πυρήνας του βοηθού).
 *
 * Είσοδος: το σχέδιο + το χρώμα που ο άνθρωπος έδειξε ως «τοίχος» (Δ1). Έξοδος: για ΚΑΘΕ
 * ανιχνευμένο ορθογώνιο μία κατάσταση με λόγο, οι τοίχοι που θα χτιστούν, και η αναφορά
 * κάλυψης. Τίποτα δεν γράφεται — η εγγραφή είναι άλλη φάση και θέλει έγκριση ανθρώπου.
 *
 * ΚΑΜΙΑ αναπαραγωγή — ο πυρήνας είναι σύνθεση υπαρχόντων SSoT:
 *   · `extractLineSegments`            — wall-in-region.ts
 *   · `WallDetectionStrategy`          — wall-detection-strategy.ts (Δ5)
 *   · `computeFillingWalls`            — filling-walls-compute.ts (validate + auto-join +
 *                                        no-overlap· το ΙΔΙΟ που τρέχει ο commit ⇒
 *                                        προεπισκόπηση ≡ αποτέλεσμα)
 *   · `computeDrawingCoverage`         — drawing-coverage.ts
 *
 * Τέσσερις καταστάσεις, όχι δύο:
 *   · `ready`           — θα χτιστεί ακριβώς αυτός ο τοίχος.
 *   · `needs-decision`  — το ορθογώνιο δεν έχει προφανή άξονα (Δ7)· ούτε πράσινο ούτε κόκκινο.
 *   · `existing`        — εκεί υπάρχει ήδη δομική οντότητα (ADR-567). Αυτό δίνει την
 *                         ιδεμποτία: δεύτερη εκτέλεση προτείνει μηδέν νέους τοίχους (Α-6).
 *   · `rejected`        — ο επικυρωτής τον έκοψε, με τον λόγο του.
 *
 * ΚΑΘΑΡΟ (pure) — zero React/DOM/store.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-911-model-from-drawing-assistant.md
 */

import type { Entity } from '../../types/entities';
import type { WallEntity } from '../types/wall-types';
import type { SceneUnits, WallParamOverrides } from '../../hooks/drawing/wall-completion';
import { MODEL_FROM_DRAWING_LIMITS } from '../../config/tolerance-config';
import { mmToSceneUnits } from '../../utils/scene-units';
import { extractLineSegments, type DetectedRectangle } from '../walls/wall-in-region';
import { rectEdgeSourceIds, type EntityColorResolver } from '../walls/same-color-rects';
import { computeFillingWalls, REGION_REJECT_OCCUPIED_KEY } from '../walls/filling-walls-compute';
import { closedRectangleStrategy, type WallDetectionStrategy } from './wall-detection-strategy';
import { computeDrawingCoverage, type DrawingCoverage } from './drawing-coverage';

export type WallProposalStatus = 'ready' | 'needs-decision' | 'existing' | 'rejected';

/** Ένα ανιχνευμένο ορθογώνιο και τι θα του συμβεί. */
export interface WallProposalItem {
  /** Σταθερό κλειδί του ορθογωνίου (θέση + διαστάσεις σε mm) — ταυτότητα μέσα στην πρόταση. */
  readonly key: string;
  readonly rect: DetectedRectangle;
  readonly status: WallProposalStatus;
  /** Ο τοίχος που θα χτιστεί — ΜΟΝΟ όταν `status === 'ready'`. */
  readonly wall?: WallEntity;
  /** Φιλικό i18n key του λόγου — ΜΟΝΟ όταν `status === 'rejected'`. */
  readonly reason?: string;
  /**
   * Τα ids των γραμμών-πηγή, ένας πίνακας ανά ακμή. Κενός = ακμή χωρίς γραμμή εντός ανοχής·
   * πάνω από ένα id = συμπίπτουσες γραμμές (κοινό άκρο με γειτονικό τοίχο).
   */
  readonly sourceIds: readonly (readonly string[])[];
}

export interface WallProposal {
  readonly items: readonly WallProposalItem[];
  /** Οι τοίχοι των `ready` στοιχείων, στη σειρά χτισίματος. */
  readonly walls: readonly WallEntity[];
  readonly coverage: DrawingCoverage;
}

export interface WallProposalInput {
  readonly entities: readonly Entity[];
  /** Το resolved χρώμα (lowercase hex) που ο άνθρωπος έδειξε ως «τοίχος». */
  readonly wallColorHex: string;
  readonly colorOf: EntityColorResolver;
  readonly sceneUnits: SceneUnits;
  readonly levelId: string;
  readonly overrides?: WallParamOverrides;
  readonly strategy?: WallDetectionStrategy;
  /** Κλειδιά `needs-decision` ορθογωνίων που ο άνθρωπος αποφάσισε ότι ΕΙΝΑΙ τοίχοι. */
  readonly acceptedKeys?: ReadonlySet<string>;
}

/** Κλειδί ορθογωνίου σε ακέραια mm — ανεξάρτητο από τη σειρά ανίχνευσης και τις μονάδες σκηνής. */
function wallProposalKey(rect: DetectedRectangle, sceneUnits: SceneUnits): string {
  const toMm = 1 / mmToSceneUnits(sceneUnits);
  const cx = rect.polygon.reduce((s, p) => s + p.x, 0) / 4;
  const cy = rect.polygon.reduce((s, p) => s + p.y, 0) / 4;
  return [cx, cy, rect.longSide, rect.shortSide].map((v) => Math.round(v * toMm)).join(':');
}

/** Δ7 — ορθογώνιο χωρίς προφανή άξονα: «μεγάλη πλευρά = άξονας» θα ήταν αυθαίρετο. */
function isAmbiguous(rect: DetectedRectangle): boolean {
  if (rect.axis) return false; // η πηγή γνωρίζει ρητά τον προσανατολισμό
  return rect.longSide / rect.shortSide < MODEL_FROM_DRAWING_LIMITS.AMBIGUOUS_ASPECT_RATIO;
}

/**
 * Χτίζει τα μη-αμφίσημα ορθογώνια μέσω του SSoT και αντιστοιχίζει κάθε ένα στην κατάληξή του.
 * Ο `computeFillingWalls` επιστρέφει τους τοίχους στη σειρά των ορθογωνίων, παραλείποντας τα
 * απορριφθέντα ⇒ η αντιστοίχιση γίνεται με ταυτότητα ορθογωνίου, όχι με δείκτη.
 */
function resolveBuildable(
  buildable: readonly DetectedRectangle[],
  input: WallProposalInput,
): ReadonlyMap<DetectedRectangle, Pick<WallProposalItem, 'status' | 'wall' | 'reason'>> {
  const { walls, rejected } = computeFillingWalls(
    buildable,
    input.overrides ?? {},
    input.sceneUnits,
    input.levelId,
    input.entities,
  );
  const outcome = new Map<DetectedRectangle, Pick<WallProposalItem, 'status' | 'wall' | 'reason'>>();
  for (const r of rejected) {
    outcome.set(
      r.rect,
      r.reason === REGION_REJECT_OCCUPIED_KEY
        ? { status: 'existing' }
        : { status: 'rejected', reason: r.reason },
    );
  }
  let next = 0;
  for (const rect of buildable) {
    if (outcome.has(rect)) continue;
    outcome.set(rect, { status: 'ready', wall: walls[next] });
    next += 1;
  }
  return outcome;
}

/**
 * Entry point — η πρόταση τοίχων για ένα χρώμα-ρόλο. Καθαρός υπολογισμός: ο ίδιος καλείται
 * για την προεπισκόπηση και (στη φάση εγγραφής) για το αποτέλεσμα.
 */
export function computeWallProposal(input: WallProposalInput): WallProposal {
  const { entities, wallColorHex, colorOf, sceneUnits } = input;
  const tol = MODEL_FROM_DRAWING_LIMITS.NODE_MERGE_TOLERANCE_MM * mmToSceneUnits(sceneUnits);
  const roleSegments = extractLineSegments(entities.filter((e) => colorOf(e) === wallColorHex));
  const rects = (input.strategy ?? closedRectangleStrategy)(roleSegments, tol);

  const keyOf = new Map(rects.map((r) => [r, wallProposalKey(r, sceneUnits)] as const));
  const undecided = new Set(
    rects.filter((r) => isAmbiguous(r) && !input.acceptedKeys?.has(keyOf.get(r) ?? '')),
  );
  const outcome = resolveBuildable(rects.filter((r) => !undecided.has(r)), input);

  const items: WallProposalItem[] = rects.map((rect) => ({
    key: keyOf.get(rect) ?? '',
    rect,
    sourceIds: rectEdgeSourceIds(rect, roleSegments, tol),
    ...(outcome.get(rect) ?? { status: 'needs-decision' as const }),
  }));
  const walls = items.flatMap((i) => (i.wall ? [i.wall] : []));
  return { items, walls, coverage: computeDrawingCoverage(entities, roleSegments, rects, tol) };
}
