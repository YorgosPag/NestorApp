/**
 * ADR-419 v2.4 — «Μία διαδρομή δημιουργίας» για τους τοίχους region-fill: preview ≡ commit 100%.
 *
 * Ο εντοπισμός πλαισίων (πράσινες διακεκομμένες) ήταν σωστός, αλλά η ΔΗΜΙΟΥΡΓΙΑ των τοίχων
 * αποκλίνει από αυτό που φαινόταν: το preview ζωγράφιζε το ΩΜΟ `rect.polygon`, ενώ ο commit
 * περνά build+validate+extend (Revit auto-join) + miter (add-wall-to-scene). Αποτέλεσμα:
 * «δείχνει-αλλά-δεν-φτιάχνει» / «φτιάχνει-αλλιώς».
 *
 * Λύση (Revit transaction-preview): ΕΝΑ SSoT compute, δύο καταλήξεις (render vs persist). Όλοι
 * οι enablers είναι ΗΔΗ καθαρές συναρτήσεις → τρέχουν transient χωρίς mutation:
 *   · `buildWallFillingRectResult` (validate, κρατά reason)  — wall-in-region.ts
 *   · `extendFillingWallToNeighbors` (Revit "Allow Join")    — wall-region-autojoin.ts
 *   · `findStructuralOverlapForEntity` (ADR-567 no-overlap)  — structural-placement-overlap.ts
 *   · `computeWallTrims` + `applyTrimPatches` (miter/bevel)  — wall-trims.ts
 *   · `resolveWallPaintedBodies` (το σώμα ΟΠΩΣ ζωγραφίζεται)  — wall-painted-body.ts
 *
 * Ο commit (`use-wall-commit.buildFillingWalls`) ΚΑΙ το preview (`resolvePerimeterPreview`)
 * καλούν ΑΥΤΟΝ τον υπολογισμό → ό,τι φωτίζεται πράσινο = ΑΚΡΙΒΩΣ οι τοίχοι που θα χτιστούν
 * (extended + mitered)· ό,τι απορρίπτεται → κόκκινο + ΛΟΓΟΣ (Giorgio 2026-07-03, επιλογή Α).
 *
 * ΚΑΘΑΡΟ (pure) — zero React/DOM/store.
 *
 * @see ./wall-in-region.ts (rect→wall builder)
 * @see ./add-wall-to-scene.ts (authoritative commit insertion — miter + persist)
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md §region-fill
 */

import type { AnySceneEntity, Entity } from '../../types/entities';
import { isWallEntity } from '../../types/entities';
import type { WallEntity } from '../types/wall-types';
import type { WallParamOverrides, SceneUnits } from '../../hooks/drawing/wall-completion';
import { buildWallFillingRectResult, type DetectedRectangle } from './wall-in-region';
import { extendFillingWallToNeighbors } from './wall-region-autojoin';
import { computeWallTrims, applyTrimPatches, collectColumnFootprints } from './wall-trims';
import { resolveWallPaintedBodies, type WallBodyPieces } from './wall-painted-body';
import { findStructuralOverlapForEntity } from '../placement/structural-placement-overlap';

// ─── Reject reasons (friendly i18n keys — «κόκκινο + tooltip με ΛΟΓΟ») ─────────

/** Validator hardError key → φιλικός `regionPerimeter.rejected.*` λόγος (Giorgio: γιατί δεν χτίστηκε). */
const VALIDATOR_REASON_KEY: Readonly<Record<string, string>> = {
  'wall.validation.hardErrors.lengthTooShort': 'regionPerimeter.rejected.lengthTooShort',
  'wall.validation.hardErrors.thicknessExceedsMax': 'regionPerimeter.rejected.thicknessTooThick',
  'wall.validation.hardErrors.thicknessNonPositive': 'regionPerimeter.rejected.thicknessInvalid',
  'wall.validation.hardErrors.heightNonPositive': 'regionPerimeter.rejected.heightInvalid',
  'wall.validation.hardErrors.dnaThicknessMismatch': 'regionPerimeter.rejected.thicknessInvalid',
};

/** ADR-567 — το rect πέφτει πάνω σε υπάρχουσα δομική οντότητα **της σκηνής** (κατειλημμένο). */
export const REGION_REJECT_OCCUPIED_KEY = 'regionPerimeter.rejected.occupied';

/**
 * ADR-929 Φ5.2δ — το rect επικαλύπτει **άλλον υποψήφιο της ίδιας παρτίδας**, που κέρδισε την κρίση
 * (`byJudgingPriority`). Δεν είναι «υπάρχει ήδη»: σε κενό όροφο η πρόταση από εικόνα έγραφε
 * «Υπάρχουν ήδη: 85» (μετρημένο στην παραγωγή), ενώ η σκηνή δεν είχε τίποτα.
 */
export const REGION_REJECT_OVERLAPS_CANDIDATE_KEY = 'regionPerimeter.rejected.overlapsCandidate';

/** Fallback όταν ο validator key δεν χαρτογραφείται (δεν πρέπει να συμβεί σε κανονική ροή). */
const FALLBACK_REASON_KEY = 'regionPerimeter.rejected.invalid';

function friendlyReason(validatorKey: string): string {
  return VALIDATOR_REASON_KEY[validatorKey] ?? FALLBACK_REASON_KEY;
}

// ─── Public types ──────────────────────────────────────────────────────────

/** Ένα rect που ΔΕΝ γίνεται τοίχος + ο λόγος (φιλικός i18n key για tooltip). */
export interface FillingWallReject {
  readonly rect: DetectedRectangle;
  /** Friendly `regionPerimeter.rejected.*` i18n key. */
  readonly reason: string;
}

/** Αποτέλεσμα του `computeFillingWalls`: οι τοίχοι που θα χτιστούν + όσοι απορρίφθηκαν (+λόγος). */
export interface FillingWallsResult {
  readonly walls: WallEntity[];
  readonly rejected: FillingWallReject[];
}

/**
 * Προαιρετικές ραφές του χτισίματος. Και οι δύο τρέχουν ΜΕΣΑ στο χτίσιμο (φάση α), ώστε η
 * ένωση και ο έλεγχος επικάλυψης να βλέπουν πάντα τον τελικό τοίχο.
 */
export interface FillingWallsOptions {
  /**
   * ADR-412 / ADR-911 Φ3 — σφραγίζει τον φρεσκοχτισμένο τοίχο με τον τύπο του («ο τύπος
   * νικά πάντα»). Καθαρή συνάρτηση (`wall-typer.ts`)· απούσα ⇒ ο τοίχος μένει όπως χτίστηκε.
   */
  readonly typeWall?: (wall: WallEntity) => WallEntity;
  /**
   * ADR-911 Δ3 — overrides ΑΝΑ ορθογώνιο (π.χ. λειτουργία ανά ομάδα πάχους), πάνω από τα
   * κοινά. Κλήση ανά ομάδα θα έκρυβε τη μία ομάδα από την άλλη· γι' αυτό είναι ραφή του χτισίματος.
   */
  readonly overridesFor?: (rect: DetectedRectangle) => WallParamOverrides;
}

// ─── Build + validate + extend + no-overlap (ΙΔΙΟ με τον commit) ──────────────

/** Ένα ορθογώνιο που πέρασε τον επικυρωτή: ο τοίχος του με τύπο, ΠΡΙΝ από κάθε επέκταση. */
interface FillingCandidate {
  /** Θέση του ορθογωνίου στην είσοδο — η ταυτότητα του υποψηφίου μέσα στον υπολογισμό. */
  readonly index: number;
  readonly wall: WallEntity;
}

/**
 * Φάση α — χτίσιμο + επικύρωση + τύπος για ΟΛΑ τα ορθογώνια, πριν ενωθεί οτιδήποτε. Όσα κόβει
 * ο επικυρωτής γυρίζουν στο `invalid` (θέση → φιλικός λόγος).
 */
function buildFillingCandidates(
  rects: readonly DetectedRectangle[],
  overrides: WallParamOverrides,
  sceneUnits: SceneUnits,
  levelId: string,
  options: FillingWallsOptions,
): { readonly candidates: FillingCandidate[]; readonly invalid: Map<number, string> } {
  const candidates: FillingCandidate[] = [];
  const invalid = new Map<number, string>();
  rects.forEach((rect, index) => {
    const rectOverrides = options.overridesFor ? { ...overrides, ...options.overridesFor(rect) } : overrides;
    const build = buildWallFillingRectResult(rect, rectOverrides, sceneUnits, levelId);
    if (!build.ok) {
      invalid.set(index, friendlyReason(build.reason));
      return;
    }
    // ADR-911 Φ3 — ο τύπος μπαίνει ΕΔΩ, πριν από την επέκταση και τον έλεγχο επικάλυψης:
    // ό,τι ακολουθεί κρίνει τον ΤΕΛΙΚΟ τοίχο, όχι έναν που ο τύπος θα αλλάξει μετά.
    candidates.push({ index, wall: options.typeWall ? options.typeWall(build.wall) : build.wall });
  });
  return { candidates, invalid };
}

/**
 * Η σειρά ΚΡΙΣΗΣ επικάλυψης — ιδιότητα της γεωμετρίας, όχι της σειράς εισόδου: ο μακρύτερος
 * τοίχος κρίνεται πρώτος (άρα κερδίζει όταν δύο υποψήφιοι διεκδικούν τον ίδιο χώρο), μετά ο
 * παχύτερος, μετά η θέση. Η θέση εισόδου σπάει μόνο την ισοπαλία ΤΑΥΤΟΣΗΜΩΝ τοίχων.
 */
function byJudgingPriority(a: FillingCandidate, b: FillingCandidate): number {
  const pa = a.wall.params, pb = b.wall.params;
  const lenA = Math.hypot(pa.end.x - pa.start.x, pa.end.y - pa.start.y);
  const lenB = Math.hypot(pb.end.x - pb.start.x, pb.end.y - pb.start.y);
  return (
    lenB - lenA ||
    pb.thickness - pa.thickness ||
    (pa.start.x + pa.end.x) - (pb.start.x + pb.end.x) ||
    (pa.start.y + pa.end.y) - (pb.start.y + pb.end.y) ||
    a.index - b.index
  );
}

/**
 * Φάσεις β + γ — ένωση και κρίση, ΑΝΕΞΑΡΤΗΤΕΣ από τη σειρά των ορθογωνίων (ADR-911 Φ3α-3).
 *
 * β. Κάθε υποψήφιος επεκτείνεται ΜΙΑ φορά, από την ΩΜΗ του θέση, έναντι της σκηνής και ΟΛΩΝ των
 *    άλλων ζωντανών υποψηφίων στην ωμή τους θέση. Πριν, επεκτεινόταν μόνο προς όσους είχαν ήδη
 *    χτιστεί: ο βραχίονας ενός Τ ενωνόταν μόνο αν ο διαμπερής έτυχε να προηγείται. Δεν
 *    επαναλαμβάνεται ως σταθερό σημείο: μετρήθηκε ότι ο δεύτερος γύρος σπρώχνει τοίχο ΟΜΟΑΞΟΝΙΚΑ
 *    μέσα στον συνεχόμενό του.
 * γ. ADR-567 — ΠΟΤΕ τοίχος πάνω σε υπάρχουσα δομική· κρίση με τη σειρά `byJudgingPriority`,
 *    έναντι της σκηνής + όσων έχουν ήδη γίνει δεκτοί. Η ένωση με γείτονα ΔΕΝ είναι κατάληψη
 *    (§join-is-not-occupation).
 *
 * Αν το γ κόψει κάποιον, το β ξανατρέχει ΑΠΟ ΤΑ ΩΜΑ με όσους έμειναν: κανείς δεν μένει
 * επεκταμένος προς τοίχο που δεν θα χτιστεί. Το σύνολο μόνο μικραίνει ⇒ τερματίζει.
 */
interface JudgeOutcome {
  readonly accepted: Map<number, WallEntity>;
  /** Θέση ορθογωνίου → λόγος: κατειλημμένο από τη **σκηνή** ή από **υποψήφιο** της παρτίδας. */
  readonly dropped: Map<number, string>;
}

/**
 * Ένας γύρος κρίσης. Πρώτα έναντι της σκηνής, μετά έναντι των ήδη δεκτών — το «δεκτός ή όχι» είναι
 * ταυτόσημο με τον ενιαίο έλεγχο `[...σκηνή, ...δεκτοί]`· αλλάζει μόνο ο **λόγος** (ADR-929 Φ5.2δ).
 */
function judgeRound(
  alive: readonly FillingCandidate[],
  sceneEntities: readonly Entity[],
  neighbours: readonly WallEntity[],
  sceneUnits: SceneUnits,
): JudgeOutcome {
  const accepted = new Map<number, WallEntity>();
  const dropped = new Map<number, string>();
  const acceptedEntities: Entity[] = [];
  for (const candidate of alive) {
    const entity = extendFillingWallToNeighbors(candidate.wall, neighbours, sceneUnits);
    const asEntity = entity as unknown as Entity;
    if (findStructuralOverlapForEntity(asEntity, sceneEntities)) {
      dropped.set(candidate.index, REGION_REJECT_OCCUPIED_KEY);
    } else if (findStructuralOverlapForEntity(asEntity, acceptedEntities)) {
      dropped.set(candidate.index, REGION_REJECT_OVERLAPS_CANDIDATE_KEY);
    } else {
      accepted.set(candidate.index, entity);
      acceptedEntities.push(asEntity);
    }
  }
  return { accepted, dropped };
}

function joinAndJudge(
  candidates: readonly FillingCandidate[],
  sceneEntities: readonly Entity[],
  sceneUnits: SceneUnits,
): JudgeOutcome {
  const sceneWalls = sceneEntities.filter(isWallEntity);
  const dropped = new Map<number, string>();
  let alive = [...candidates].sort(byJudgingPriority);
  for (;;) {
    const neighbours = [...sceneWalls, ...alive.map((c) => c.wall)];
    const round = judgeRound(alive, sceneEntities, neighbours, sceneUnits);
    round.dropped.forEach((reason, index) => dropped.set(index, reason));
    if (round.accepted.size === alive.length) return { accepted: round.accepted, dropped };
    alive = alive.filter((c) => round.accepted.has(c.index));
  }
}

/**
 * Build ΕΝΑΣ τοίχος ανά `DetectedRectangle`: validate (κρατά reason) → extend στους γείτονες
 * (Revit auto-join) → ADR-567 no-overlap guard. Επιστρέφει τους buildable τοίχους + τους
 * rejected με τον λόγο, και τα δύο στη σειρά των ορθογωνίων. **Ταυτόσημη λογική
 * αποδοχής/απόρριψης με τον commit** — ο commit καλεί ΑΥΤΟ, οπότε preview ≡ commit εξ ορισμού.
 *
 * Το αποτέλεσμα είναι συνάρτηση του ΣΥΝΟΛΟΥ των ορθογωνίων, όχι της σειράς τους (Revit: οι
 * ενώσεις αναγεννώνται στο τέλος της συναλλαγής, όχι ανά στοιχείο).
 */
export function computeFillingWalls(
  rects: readonly DetectedRectangle[],
  overrides: WallParamOverrides,
  sceneUnits: SceneUnits,
  levelId: string,
  sceneEntities: readonly Entity[],
  options: FillingWallsOptions = {},
): FillingWallsResult {
  const { candidates, invalid } = buildFillingCandidates(rects, overrides, sceneUnits, levelId, options);
  const { accepted, dropped } = joinAndJudge(candidates, sceneEntities, sceneUnits);
  const walls: WallEntity[] = [];
  const rejected: FillingWallReject[] = [];
  rects.forEach((rect, index) => {
    const invalidReason = invalid.get(index);
    const wall = accepted.get(index);
    if (invalidReason) rejected.push({ rect, reason: invalidReason });
    else if (wall) walls.push(wall);
    else rejected.push({ rect, reason: dropped.get(index) ?? REGION_REJECT_OCCUPIED_KEY });
  });
  return { walls, rejected };
}

// ─── Transient miter (preview-only) ──────────────────────────────────────────

/**
 * Preview-only: τρέχει το ΙΔΙΟ `computeWallTrims` + `applyTrimPatches` που τρέχει ο
 * `addWallToScene`, αλλά **transient** πάνω σε `[...sceneEntities, ...walls]`, και μετά το ΙΔΙΟ
 * κόψιμο σώματος που τρέχει η απόδοση (`resolveWallPaintedBodies`: κολώνες → διασταύρωση).
 * Επιστρέφει, σε σειρά `walls`, τα ΚΟΜΜΑΤΙΑ του σώματος κάθε τοίχου όπως θα ζωγραφιστεί — ΧΩΡΙΣ
 * καμία mutation. Ένα κομμάτι = άκοπος τοίχος· δύο+ = κολώνα που τον χωρίζει· `[]` = καταπίνεται.
 *
 * ADR-911 Φ3α-4 — η πηγή είναι το ΖΩΓΡΑΦΙΖΟΜΕΝΟ σώμα, όχι το `wallFootprintPolygon`. Εκείνο είναι
 * το αποτύπωμα του ΣΟΒΑ (ADR-449: ωμό ∪ λοξοτομημένο) και εκ σχεδιασμού αγνοεί κάθε κόψιμο που
 * αφαιρεί υλικό: φώτιζε τον βραχίονα ως τον άξονα του γείτονα και τη γωνία διπλή. Μετρημένο στο
 * σχέδιο δοκιμής: 16 ζεύγη φωτισμένων αποτυπωμάτων με κοινό εμβαδό → 0.
 */
export function computeFillingWallFootprints(
  walls: readonly WallEntity[],
  sceneEntities: readonly Entity[],
): WallBodyPieces[] {
  if (walls.length === 0) return [];
  const columnFootprints = collectColumnFootprints(sceneEntities as readonly AnySceneEntity[]);
  const trims = computeWallTrims([...sceneEntities.filter(isWallEntity), ...walls], columnFootprints);
  const patched = applyTrimPatches([...sceneEntities, ...walls] as readonly AnySceneEntity[], trims);
  // Το σώμα κρίνεται ανάμεσα σε ΟΛΟΥΣ τους τοίχους (σκηνή + νέοι, με τις ενώσεις τους), όπως
  // ακριβώς θα τους δει η απόδοση μετά την εγγραφή.
  const bodies = resolveWallPaintedBodies(patched.filter(isWallEntity), columnFootprints);
  // Σειρά `walls` (όχι scene order) → 1:1 pairing με τα labels στο preview.
  return walls.map((w) => bodies.get(w.id) ?? []);
}
