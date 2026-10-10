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
 *   · `wallFootprintPolygon` (raw ∪ mitered footprint)       — wall-footprint-union.ts
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

import type { Point2D } from '../../rendering/types/Types';
import type { AnySceneEntity, Entity } from '../../types/entities';
import { isWallEntity } from '../../types/entities';
import type { WallEntity } from '../types/wall-types';
import type { WallParamOverrides, SceneUnits } from '../../hooks/drawing/wall-completion';
import { buildWallFillingRectResult, type DetectedRectangle } from './wall-in-region';
import { extendFillingWallToNeighbors } from './wall-region-autojoin';
import { computeWallTrims, applyTrimPatches, collectColumnFootprints } from './wall-trims';
import { wallFootprintPolygon } from '../finishes/wall-footprint-union';
import { findStructuralOverlapForEntity } from '../placement/structural-placement-overlap';
import { projectVerticesTo2D } from '../geometry/shared/polygon-utils';

// ─── Reject reasons (friendly i18n keys — «κόκκινο + tooltip με ΛΟΓΟ») ─────────

/** Validator hardError key → φιλικός `regionPerimeter.rejected.*` λόγος (Giorgio: γιατί δεν χτίστηκε). */
const VALIDATOR_REASON_KEY: Readonly<Record<string, string>> = {
  'wall.validation.hardErrors.lengthTooShort': 'regionPerimeter.rejected.lengthTooShort',
  'wall.validation.hardErrors.thicknessExceedsMax': 'regionPerimeter.rejected.thicknessTooThick',
  'wall.validation.hardErrors.thicknessNonPositive': 'regionPerimeter.rejected.thicknessInvalid',
  'wall.validation.hardErrors.heightNonPositive': 'regionPerimeter.rejected.heightInvalid',
  'wall.validation.hardErrors.dnaThicknessMismatch': 'regionPerimeter.rejected.thicknessInvalid',
};

/** ADR-567 — το rect πέφτει πάνω σε υπάρχουσα δομική οντότητα (κατειλημμένο). */
export const REGION_REJECT_OCCUPIED_KEY = 'regionPerimeter.rejected.occupied';

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
 * Προαιρετικές ραφές του χτισίματος. Και οι δύο τρέχουν ΜΕΣΑ στον ένα βρόχο, ώστε ο
 * σταδιακός έλεγχος (γείτονες + επικάλυψη) να βλέπει πάντα τον τελικό τοίχο.
 */
export interface FillingWallsOptions {
  /**
   * ADR-412 / ADR-911 Φ3 — σφραγίζει τον φρεσκοχτισμένο τοίχο με τον τύπο του («ο τύπος
   * νικά πάντα»). Καθαρή συνάρτηση (`wall-typer.ts`)· απούσα ⇒ ο τοίχος μένει όπως χτίστηκε.
   */
  readonly typeWall?: (wall: WallEntity) => WallEntity;
  /**
   * ADR-911 Δ3 — overrides ΑΝΑ ορθογώνιο (π.χ. λειτουργία ανά ομάδα πάχους), πάνω από τα
   * κοινά. Κλήση ανά ομάδα θα έσπαγε τον σταδιακό έλεγχο· γι' αυτό είναι ραφή του βρόχου.
   */
  readonly overridesFor?: (rect: DetectedRectangle) => WallParamOverrides;
}

// ─── Build + validate + extend + no-overlap (ΙΔΙΟ με τον commit) ──────────────

/**
 * Build ΕΝΑΣ τοίχος ανά `DetectedRectangle`: validate (κρατά reason) → extend στους γείτονες
 * (Revit auto-join) → ADR-567 no-overlap guard. Επιστρέφει τους buildable τοίχους + τους
 * rejected με τον λόγο. **Ταυτόσημη λογική αποδοχής/απόρριψης με τον commit** — ο commit
 * καλεί ΑΥΤΟ, οπότε preview ≡ commit εξ ορισμού.
 *
 * Το no-overlap guard τρέχει με το ΙΔΙΟ incremental scene (`sceneEntities` + όσοι τοίχοι της
 * παρτίδας έχουν ήδη γίνει δεκτοί) όπως το `addWallToScene` ανά τοίχο → μηδέν απόκλιση.
 */
export function computeFillingWalls(
  rects: readonly DetectedRectangle[],
  overrides: WallParamOverrides,
  sceneUnits: SceneUnits,
  levelId: string,
  sceneEntities: readonly Entity[],
  options: FillingWallsOptions = {},
): FillingWallsResult {
  const sceneWalls = sceneEntities.filter(isWallEntity);
  const walls: WallEntity[] = [];
  const rejected: FillingWallReject[] = [];
  for (const rect of rects) {
    const rectOverrides = options.overridesFor ? { ...overrides, ...options.overridesFor(rect) } : overrides;
    const build = buildWallFillingRectResult(rect, rectOverrides, sceneUnits, levelId);
    if (!build.ok) {
      rejected.push({ rect, reason: friendlyReason(build.reason) });
      continue;
    }
    // ADR-911 Φ3 — ο τύπος μπαίνει ΕΔΩ, πριν από την επέκταση και τον έλεγχο επικάλυψης:
    // ό,τι ακολουθεί κρίνει τον ΤΕΛΙΚΟ τοίχο, όχι έναν που ο τύπος θα αλλάξει μετά.
    const typed = options.typeWall ? options.typeWall(build.wall) : build.wall;
    const entity = extendFillingWallToNeighbors(typed, [...sceneWalls, ...walls], sceneUnits);
    // ADR-567 parity με το `addWallToScene`: ΠΟΤΕ τοίχος πάνω σε υπάρχουσα δομική.
    // Έλεγχος με το ΙΔΙΟ incremental scene (existing + δεκτοί της παρτίδας) → ίδιο αποτέλεσμα.
    // Η ένωση με γείτονα (η επέκταση από πάνω) ΔΕΝ είναι κατάληψη: το SSoT κρίνει τοίχο↔τοίχο
    // μετά την ένωση (ADR-567 §join-is-not-occupation).
    if (findStructuralOverlapForEntity(entity as unknown as Entity, [...sceneEntities, ...walls] as Entity[])) {
      rejected.push({ rect, reason: REGION_REJECT_OCCUPIED_KEY });
      continue;
    }
    walls.push(entity);
  }
  return { walls, rejected };
}

// ─── Transient miter (preview-only) ──────────────────────────────────────────

/**
 * Preview-only: τρέχει το ΙΔΙΟ `computeWallTrims` + `applyTrimPatches` που τρέχει ο
 * `addWallToScene`, αλλά **transient** πάνω σε `[...sceneEntities, ...walls]` → επιστρέφει
 * τα ΤΕΛΙΚΑ mitered footprints (Point2D[][], σε σειρά `walls`) ΧΩΡΙΣ καμία mutation.
 *
 * Έτσι το πράσινο περίγραμμα του preview = ΑΚΡΙΒΩΣ το footprint που θα έχει ο τοίχος μετά
 * το miter/bevel του commit (T-junction → mitered ≠ raw rect). Reuse `collectColumnFootprints`
 * (κολόνα νικάει) + `wallFootprintPolygon` (raw ∪ mitered SSoT).
 */
export function computeFillingWallFootprints(
  walls: readonly WallEntity[],
  sceneEntities: readonly Entity[],
): Point2D[][] {
  if (walls.length === 0) return [];
  const sceneWalls = sceneEntities.filter(isWallEntity);
  const allWalls = [...sceneWalls, ...walls];
  const trims = computeWallTrims(allWalls, collectColumnFootprints(sceneEntities as readonly AnySceneEntity[]));
  const patched = applyTrimPatches([...sceneEntities, ...walls] as readonly AnySceneEntity[], trims);
  const patchedById = new Map<string, WallEntity>();
  for (const e of patched) {
    if (isWallEntity(e)) patchedById.set(e.id, e);
  }
  // Σειρά `walls` (όχι scene order) → 1:1 pairing με τα labels στο preview.
  return walls.map((w) => {
    const pw = patchedById.get(w.id) ?? w;
    return projectVerticesTo2D(wallFootprintPolygon(pw));
  });
}
