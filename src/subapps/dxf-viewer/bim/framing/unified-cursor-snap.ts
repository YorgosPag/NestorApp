/**
 * Unified cursor snap — pure SSoT (ADR-508 §unified-snap, Layered snap architecture Φ1).
 *
 * **Ο ΕΝΑΣ resolver για ΟΛΑ τα εργαλεία.** Ενώνει τους δύο ιστορικά ξεχωριστούς «κόσμους»
 * έλξης σε ΕΝΑ layered μονοπάτι, χωρίς να συγχωνεύει τα ασύμβατα contracts τους:
 *
 *   · **Layer 2 — placement** (`resolveMemberGhostSnapFromStore`, ADR-508): face/ghost snap
 *     δομικού μέλους → ΟΛΟΚΛΗΡΗ τοποθέτηση (centerline start/end, status 🟢/🔴, faceFrame,
 *     targetId). Ειδικευμένο, ΥΨΗΛΗΣ προτεραιότητας — νικά όταν υπάρχει παρειά κοντά.
 *   · **Layer 1 — point** (`findSnapPoint`, ProSnapEngineV2 / 26 engines): OSNAP σε ΣΗΜΕΙΟ
 *     (endpoint/midpoint/grid/intersection/guide/construction-point/…). **Fallback** όταν
 *     ΚΑΜΙΑ παρειά δεν είναι εντός capture → ο ελεύθερος cursor περνά από τον OSNAP κόσμο.
 *
 * **Γιατί layered και ΟΧΙ «μία συνάρτηση»:** ο Layer 2 γυρίζει *placement* (start≠end +
 * προσανατολισμός), ο Layer 1 γυρίζει *σημείο*. Είναι κατηγορηματικά διαφορετικοί τύποι —
 * τους εκθέτουμε ως discriminated union (`UnifiedCursorSnap`), ο caller κάνει branch.
 *
 * **Pure** — zero React/DOM/store. Ο OSNAP engine περνά **injected** ως callback
 * (`findSnapPoint`) → πλήρως testable & μηδέν εξάρτηση του `bim/framing` από το `snapping`
 * runtime (μόνο type-only import). Preview ≡ commit: ίδιος resolver και στις δύο διαδρομές.
 *
 * @see ./member-ghost-snap.ts — Layer 2 dispatcher (column-priority → linear-member)
 * @see ../../snapping/global-snap-engine.ts — Layer 1 singleton (findSnapPoint provider)
 * @see docs/centralized-systems/reference/adrs/ADR-378-snap-system-master-architecture.md
 * @see docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { ExtendedSnapType, ProSnapResult, SnapCandidate } from '../../snapping/extended-types';
import { resolveMemberGhostSnapFromStore } from './member-ghost-snap';
import type { MemberGhostSnapResult, LinearMemberSnapTarget } from './linear-member-face-snap';

/**
 * Layer 1 point-snap provider. Ίδια υπογραφή με το `useSnapManager.findSnapPoint`
 * (`getGlobalSnapEngine().findSnapPoint`). Επιστρέφει `null` όταν ο engine είναι ανενεργός.
 */
export type FindSnapPointFn = (worldX: number, worldY: number) => ProSnapResult | null;

/** Είσοδος του unified resolver — όλα όσα χρειάζονται οι δύο layers, σε ΕΝΑ σημείο. */
export interface UnifiedCursorSnapInput {
  readonly cursor: Readonly<Point2D>;
  /** Footprints κολονών εντός capture (Layer 2 column-priority). */
  readonly columnFootprints: readonly (readonly Point2D[])[];
  /** Στόχοι γραμμικών μελών (Layer 2 member-to-member Τ-framing). */
  readonly memberTargets: readonly LinearMemberSnapTarget[];
  /** Πλάτος/πάχος νέου μέλους σε mm (Layer 2 ζωνική δικαιολόγηση). */
  readonly memberWidthMm: number;
  readonly sceneUnits: SceneUnits;
  /** Layer 1 OSNAP engine — injected (pure/testable). */
  readonly findSnapPoint: FindSnapPointFn;
}

/**
 * Discriminated union: ο Layer 2 έδωσε placement, Ή έπεσε στον Layer 1 για ΣΗΜΕΙΟ.
 * `point` υπάρχει ΠΑΝΤΑ (το «τελικό» σημείο που πρέπει να κουμπώσει ο cursor) — για
 * `placement` ισούται με το κλειδωμένο `placement.start`.
 */
export type UnifiedCursorSnap =
  | {
      readonly kind: 'placement';
      readonly placement: MemberGhostSnapResult;
      readonly point: Point2D;
    }
  | {
      readonly kind: 'point';
      readonly point: Point2D;
      /** OSNAP mode που κέρδισε (`null` = κανένα snap → καθαρός cursor). */
      readonly snapType: ExtendedSnapType | null;
      /** Ο νικητής candidate (φέρει `referenceSegment` για alignment line)· `null` αν κανένα. */
      readonly candidate: SnapCandidate | null;
    };

/**
 * Ο ΕΝΑΣ resolver. **Face-first, point-fallback** (consistent — μηδέν regression: τα δομικά
 * εργαλεία ήδη προτιμούσαν τον Layer 2· εδώ απλώς ΠΡΟΣΘΕΤΟΥΜΕ τον OSNAP κόσμο όταν δεν υπάρχει
 * παρειά κοντά). Η τυχόν fine-tuning προτεραιότητας point↔face (π.χ. exact endpoint να νικά
 * fuzzy slide) είναι θέμα Φ2 (browser-verify) — η Φ1 κρατά την ιστορική σειρά αμετάβλητη.
 *
 * Ποτέ δεν γυρίζει `null`: αν ούτε placement ούτε snap, επιστρέφει `kind:'point'` με τον
 * ΑΝΕΠΗΡΕΑΣΤΟ cursor (snapType=null) → ο caller έχει πάντα έγκυρο σημείο.
 */
export function resolveUnifiedCursorSnap(input: UnifiedCursorSnapInput): UnifiedCursorSnap {
  const { cursor, columnFootprints, memberTargets, memberWidthMm, sceneUnits, findSnapPoint } = input;

  // ── Layer 2: placement (face/ghost snap δομικού μέλους) — νικά όταν υπάρχει παρειά ──
  const placement = resolveMemberGhostSnapFromStore(
    cursor,
    columnFootprints,
    memberTargets,
    memberWidthMm,
    sceneUnits,
  );
  if (placement) {
    return { kind: 'placement', placement, point: placement.start };
  }

  // ── Layer 1: point (OSNAP engine) — fallback όταν καμία παρειά δεν είναι κοντά ──
  const result = findSnapPoint(cursor.x, cursor.y);
  if (result && result.found) {
    return {
      kind: 'point',
      point: result.snappedPoint,
      snapType: result.activeMode,
      candidate: result.snapPoint,
    };
  }

  // ── Κανένα snap → καθαρός cursor (πάντα έγκυρο σημείο) ──
  return {
    kind: 'point',
    point: { x: cursor.x, y: cursor.y },
    snapType: null,
    candidate: null,
  };
}
