/**
 * ADR-911 Φ1/Φ3 — **Πρόταση τοίχων από το σχέδιο** (ο καθαρός πυρήνας του βοηθού).
 *
 * Είσοδος: το σχέδιο + το χρώμα που ο άνθρωπος έδειξε ως «τοίχος» (Δ1). Έξοδος: για ΚΑΘΕ
 * ανιχνευμένο ορθογώνιο μία κατάσταση με λόγο, οι τοίχοι που θα χτιστούν, οι ομάδες πάχους
 * με την προτεινόμενη λειτουργία, και η αναφορά κάλυψης. Τίποτα δεν γράφεται — η εγγραφή
 * είναι άλλη φάση και θέλει έγκριση ανθρώπου.
 *
 * ΚΑΜΙΑ αναπαραγωγή — ο πυρήνας είναι σύνθεση υπαρχόντων SSoT:
 *   · `extractLineSegments`            — wall-in-region.ts
 *   · `WallDetectionStrategy`          — wall-detection-strategy.ts (Δ5)
 *   · `resolveAxesFromContext`         — context-axis.ts (Δ7: άξονας από τον γείτονα)
 *   · `suggestWallFunctions`           — wall-function-proposal.ts (Δ3: τοπολογία)
 *   · `computeFillingWalls`            — filling-walls-compute.ts (validate + τύπος + auto-join
 *                                        + no-overlap· το ΙΔΙΟ που τρέχει ο commit ⇒
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

import type { AnySceneEntity, Entity } from '../../types/entities';
import type { WallCategory, WallEntity } from '../types/wall-types';
import type { SceneUnits, WallParamOverrides } from '../../hooks/drawing/wall-completion';
import { MODEL_FROM_DRAWING_LIMITS } from '../../config/tolerance-config';
import { mmToSceneUnits } from '../../utils/scene-units';
import {
  detectedRectAxis,
  extractLineSegments,
  type DetectedRectangle,
  type RegionLineSeg,
} from '../walls/wall-in-region';
import { collectColumnFootprints } from '../walls/wall-trims';
import { rectEdgeSourceIds, type EntityColorResolver } from '../walls/same-color-rects';
import { computeFillingWalls, REGION_REJECT_OCCUPIED_KEY } from '../walls/filling-walls-compute';
import { closedRectangleStrategy, type WallDetectionStrategy } from './wall-detection-strategy';
import { computeDrawingCoverage, type DrawingCoverage } from './drawing-coverage';
import { resolveAxesFromContext } from './context-axis';
import { suggestWallFunctions, type WallFunctionSuggestion } from './wall-function-proposal';

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
  /** Πάχος (μικρή διάσταση) σε ακέραια mm — το κλειδί της ομάδας του (Δ3). */
  readonly thicknessMm: number;
  /** Μήκος κατά τον άξονα σε ακέραια mm — ό,τι διαβάζει ο άνθρωπος στη λίστα (Φ3β). */
  readonly lengthMm: number;
  /** Δ3 — τι λέει η τοπολογία για ΑΥΤΟ το ορθογώνιο (πρόταση, όχι απόφαση). */
  readonly suggestedFunction: WallFunctionSuggestion;
  /** Δ7 — `true` όταν ο άξονας δόθηκε από ομοαξονικό γείτονα ίδιου πάχους, όχι από το σχήμα. */
  readonly axisFromContext: boolean;
}

/** Δ3 — μία ομάδα πάχους: ό,τι επιβεβαιώνει ο άνθρωπος με ΜΙΑ απόφαση. */
export interface WallThicknessGroup {
  readonly thicknessMm: number;
  /** Τα κλειδιά των ορθογωνίων της ομάδας, ό,τι κι αν απέγιναν. */
  readonly keys: readonly string[];
  /** Πόσα ορθογώνια βλέπουν το εξωτερικό / πόσα όχι — η διαφωνία φαίνεται, δεν κρύβεται. */
  readonly exteriorCount: number;
  readonly interiorCount: number;
  /** Η πλειοψηφία της τοπολογίας (ισοπαλία ⇒ εξωτερικός). */
  readonly suggestedCategory: WallCategory;
  /** Η κατηγορία με την οποία χτίστηκαν οι τοίχοι: η επιλογή του ανθρώπου, αλλιώς η πρόταση. */
  readonly category: WallCategory;
  /** `true` μόνο όταν η κατηγορία ήρθε από τον άνθρωπο (`categoryByThicknessMm`). */
  readonly confirmed: boolean;
}

export interface WallProposal {
  readonly items: readonly WallProposalItem[];
  /** Οι τοίχοι των `ready` στοιχείων, στη σειρά χτισίματος. */
  readonly walls: readonly WallEntity[];
  /** Οι ομάδες πάχους, από τη λεπτότερη στην παχύτερη. */
  readonly groups: readonly WallThicknessGroup[];
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
  /** Δ3 — η λειτουργία που ο άνθρωπος ΕΠΙΒΕΒΑΙΩΣΕ ανά ομάδα πάχους (ακέραια mm). */
  readonly categoryByThicknessMm?: ReadonlyMap<number, WallCategory>;
  /**
   * ADR-412 — σφραγίζει κάθε τοίχο με τον τύπο του ΜΕΣΑ στο χτίσιμο (`wall-typer.ts`), ώστε
   * ό,τι φωτιστεί να είναι ακριβώς ό,τι θα γραφτεί (Α-3). Απών ⇒ τοίχοι χωρίς τύπο.
   */
  readonly typeWall?: (wall: WallEntity) => WallEntity;
}

type ItemOutcome = Pick<WallProposalItem, 'status' | 'wall' | 'reason'>;

/** Κλειδί ορθογωνίου σε ακέραια mm — ανεξάρτητο από τη σειρά ανίχνευσης και τις μονάδες σκηνής. */
function wallProposalKey(rect: DetectedRectangle, sceneUnits: SceneUnits): string {
  const toMm = 1 / mmToSceneUnits(sceneUnits);
  const cx = rect.polygon.reduce((s, p) => s + p.x, 0) / 4;
  const cy = rect.polygon.reduce((s, p) => s + p.y, 0) / 4;
  return [cx, cy, rect.longSide, rect.shortSide].map((v) => Math.round(v * toMm)).join(':');
}

/** Δ7 — ορθογώνιο χωρίς προφανή άξονα: «μεγάλη πλευρά = άξονας» θα ήταν αυθαίρετο. */
function isAmbiguous(rect: DetectedRectangle): boolean {
  if (rect.axis) return false; // η πηγή (ή το συμφραζόμενο) γνωρίζει ρητά τον προσανατολισμό
  return rect.longSide / rect.shortSide < MODEL_FROM_DRAWING_LIMITS.AMBIGUOUS_ASPECT_RATIO;
}

/**
 * Δ7 — ανίχνευση + άξονας από το συμφραζόμενο. Τα ορθογώνια που λύθηκαν αντικαθίστανται από
 * αντίγραφα με ρητό `axis`· το σύνολο `fromContext` τα θυμάται για την αναφορά.
 */
function detectRects(
  roleSegments: readonly RegionLineSeg[],
  input: WallProposalInput,
  tol: number,
): { readonly rects: readonly DetectedRectangle[]; readonly fromContext: ReadonlySet<DetectedRectangle> } {
  const detected = (input.strategy ?? closedRectangleStrategy)(roleSegments, tol);
  const maxGap = MODEL_FROM_DRAWING_LIMITS.CONTEXT_AXIS_MAX_GAP_MM * mmToSceneUnits(input.sceneUnits);
  const resolved = resolveAxesFromContext(
    detected.filter(isAmbiguous),
    detected.filter((r) => !isAmbiguous(r)),
    { tol, maxGap },
  );
  return {
    rects: detected.map((r) => resolved.get(r) ?? r),
    fromContext: new Set(resolved.values()),
  };
}

/** Δ3 — ομάδες πάχους με την τοπολογική πρόταση και την κατηγορία που τελικά ισχύει. */
function buildGroups(
  rects: readonly DetectedRectangle[],
  thicknessOf: ReadonlyMap<DetectedRectangle, number>,
  keyOf: ReadonlyMap<DetectedRectangle, string>,
  suggestions: ReadonlyMap<DetectedRectangle, WallFunctionSuggestion>,
  chosen: ReadonlyMap<number, WallCategory> | undefined,
): WallThicknessGroup[] {
  const byThickness = new Map<number, DetectedRectangle[]>();
  for (const rect of rects) {
    const t = thicknessOf.get(rect) ?? 0;
    byThickness.set(t, [...(byThickness.get(t) ?? []), rect]);
  }
  return [...byThickness.entries()]
    .sort(([a], [b]) => a - b)
    .map(([thicknessMm, members]) => {
      const exteriorCount = members.filter((r) => suggestions.get(r) === 'exterior').length;
      const interiorCount = members.length - exteriorCount;
      const suggestedCategory: WallCategory = exteriorCount >= interiorCount ? 'exterior' : 'interior';
      const picked = chosen?.get(thicknessMm);
      return {
        thicknessMm,
        keys: members.map((r) => keyOf.get(r) ?? ''),
        exteriorCount,
        interiorCount,
        suggestedCategory,
        category: picked ?? suggestedCategory,
        confirmed: picked !== undefined,
      };
    });
}

/**
 * Χτίζει τα μη-αμφίσημα ορθογώνια μέσω του SSoT και αντιστοιχίζει κάθε ένα στην κατάληξή του.
 * Ο `computeFillingWalls` επιστρέφει τους τοίχους στη σειρά των ορθογωνίων, παραλείποντας τα
 * απορριφθέντα ⇒ η αντιστοίχιση γίνεται με ταυτότητα ορθογωνίου, όχι με δείκτη.
 */
function resolveBuildable(
  buildable: readonly DetectedRectangle[],
  input: WallProposalInput,
  categoryOf: (rect: DetectedRectangle) => WallCategory,
): ReadonlyMap<DetectedRectangle, ItemOutcome> {
  const { walls, rejected } = computeFillingWalls(
    buildable,
    input.overrides ?? {},
    input.sceneUnits,
    input.levelId,
    input.entities,
    { typeWall: input.typeWall, overridesFor: (rect) => ({ category: categoryOf(rect) }) },
  );
  const outcome = new Map<DetectedRectangle, ItemOutcome>();
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
 * Entry point — η πρόταση τοίχων για ένα χρώμα-ρόλο. Καθαρός υπολογισμός: ό,τι επιστρέφει στο
 * `walls` είναι ΑΚΡΙΒΩΣ ό,τι θα γραφτεί (η εγγραφή δεν ξαναϋπολογίζει — Α-3).
 */
export function computeWallProposal(input: WallProposalInput): WallProposal {
  const { entities, wallColorHex, colorOf, sceneUnits } = input;
  const scale = mmToSceneUnits(sceneUnits);
  const tol = MODEL_FROM_DRAWING_LIMITS.NODE_MERGE_TOLERANCE_MM * scale;
  const roleSegments = extractLineSegments(entities.filter((e) => colorOf(e) === wallColorHex));
  const { rects, fromContext } = detectRects(roleSegments, input, tol);

  const keyOf = new Map(rects.map((r) => [r, wallProposalKey(r, sceneUnits)] as const));
  const thicknessOf = new Map(rects.map((r) => [r, Math.round(detectedRectAxis(r).thickness / scale)] as const));
  const columns = collectColumnFootprints(entities as readonly AnySceneEntity[]);
  const suggestions = suggestWallFunctions(rects, columns, scale);
  const groups = buildGroups(rects, thicknessOf, keyOf, suggestions, input.categoryByThicknessMm);
  const categoryOfThickness = new Map(groups.map((g) => [g.thicknessMm, g.category] as const));

  const undecided = new Set(
    rects.filter((r) => isAmbiguous(r) && !input.acceptedKeys?.has(keyOf.get(r) ?? '')),
  );
  const outcome = resolveBuildable(
    rects.filter((r) => !undecided.has(r)),
    input,
    (rect) => categoryOfThickness.get(thicknessOf.get(rect) ?? 0) ?? 'exterior',
  );

  const items: WallProposalItem[] = rects.map((rect) => ({
    key: keyOf.get(rect) ?? '',
    rect,
    sourceIds: rectEdgeSourceIds(rect, roleSegments, tol),
    thicknessMm: thicknessOf.get(rect) ?? 0,
    lengthMm: Math.round(detectedRectAxis(rect).length / scale),
    suggestedFunction: suggestions.get(rect) ?? 'interior',
    axisFromContext: fromContext.has(rect),
    ...(outcome.get(rect) ?? { status: 'needs-decision' as const }),
  }));
  const walls = items.flatMap((i) => (i.wall ? [i.wall] : []));
  return { items, walls, groups, coverage: computeDrawingCoverage(entities, roleSegments, rects, tol) };
}
