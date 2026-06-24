/**
 * BIM Cursor Snap — «Ένας Εγκέφαλος Έλξης» (ADR-514, Revit-grade unified snapping).
 *
 * **Ο ΕΝΑΣ resolver που απαντά: «δοθέντος raw cursor + ενεργού εργαλείου, πού προσγειώνεται
 * το σημείο και σε τι κούμπωσε;».** Συνθέτει τους δύο ιστορικά διάσπαρτους μηχανισμούς σε ΕΝΑ
 * layered, tool-agnostic σημείο εισόδου — όπως η Revit έχει ΕΝΑ snapping subsystem για όλα τα tools:
 *
 *   · **Layer 2 — placement** (ανά toolKind): η ειδικευμένη «έξυπνη» τοποθέτηση δομικού μέλους.
 *       - `column`     → `resolveColumnFaceSnapFromTargets` (9-λαβές face + polar/rect magnet)
 *       - `wall`/`beam`→ `resolveMemberGhostSnapFromStore` (column-priority → linear Τ-framing)
 *     Νικά όταν υπάρχει παρειά/στόχος εντός capture. Επιστρέφει ΟΛΟΚΛΗΡΗ τοποθέτηση.
 *   · **Layer 1 — point** (`findSnapPoint`, ProSnapEngineV2 / 26 engines): OSNAP σε ΣΗΜΕΙΟ
 *       (endpoint/midpoint/grid/intersection/guide/…). **Fallback** όταν καμία παρειά δεν είναι κοντά.
 *
 * **Γιατί ΕΝΑ σημείο εισόδου (FULL SSoT):** σήμερα η επίλυση «πού πάει ο BIM cursor» ζει σε 3
 * διάσπαρτα σημεία (column branch στο `mouse-handler-up`, wall/beam μέσα στα tool hooks, ξεχωριστά
 * στα `*-preview-helpers`). Με τον εγκέφαλο, **commit ΚΑΙ preview καλούν την ΙΔΙΑ συνάρτηση** →
 * preview ≡ commit **by construction**, και κάθε νέο εργαλείο αποκτά ομοιόμορφη έλξη με μηδέν
 * αντιγραφή. Η ασυμμετρία column-vs-wall/beam εξαλείφεται.
 *
 * **Γιατί discriminated union (όχι «μία συνάρτηση»):** οι placements column vs member είναι
 * κατηγορηματικά διαφορετικού τύπου (`ColumnFaceSnap` vs `MemberGhostSnapResult`)· το point-snap
 * είναι ΣΗΜΕΙΟ. Τα εκθέτουμε ως union· ο caller κάνει branch στο `.kind`. `point` υπάρχει ΠΑΝΤΑ.
 *
 * **Pure** — zero React/DOM/store. Ο OSNAP engine περνά **injected** (`findSnapPoint`) → πλήρως
 * testable & μηδέν εξάρτηση από το `snapping` runtime (type-only import). Ζει στο `bim/placement/`
 * (πάνω από `bim/columns` + `bim/framing`) → μηδέν import cycle.
 *
 * @see ../columns/column-face-snap.ts — column placement resolver (Layer 2)
 * @see ../framing/member-ghost-snap.ts — wall/beam placement dispatcher (Layer 2)
 * @see ../../snapping/global-snap-engine.ts — Layer 1 singleton (findSnapPoint provider)
 * @see docs/centralized-systems/reference/adrs/ADR-514-unified-bim-cursor-snap.md
 * @see docs/centralized-systems/reference/adrs/ADR-378-snap-system-master-architecture.md
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md
 * @see docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { ExtendedSnapType, ProSnapResult, SnapCandidate } from '../../snapping/extended-types';
import { resolveMemberGhostSnapFromStore } from '../framing/member-ghost-snap';
import { selectGhostMembers, type SceneSnapTargets } from '../framing/scene-snap-targets';
import type { MemberGhostSnapResult } from '../framing/linear-member-face-snap';
import { resolveColumnFaceSnapFromTargets, type ColumnFaceSnap } from '../columns/column-face-snap';
import type { PolarDiskSnapOptions } from '../columns/polar-disk-snap';

/**
 * Layer 1 point-snap provider. Ίδια υπογραφή με το `useSnapManager.findSnapPoint`
 * (`getGlobalSnapEngine().findSnapPoint`). Επιστρέφει `null` όταν ο engine είναι ανενεργός.
 */
export type FindSnapPointFn = (worldX: number, worldY: number) => ProSnapResult | null;

/** Ποιο placement layer ενεργοποιεί ο εγκέφαλος. `point-only` = μόνο OSNAP (line/polyline/…). */
export type BimSnapToolKind = 'wall' | 'beam' | 'column' | 'point-only';

/** Τύπος των member kinds που δέχεται ο `selectGhostMembers` (reuse — μηδέν re-declare). */
type MemberSnapKinds = Parameters<typeof selectGhostMembers>[1];

/** Default member kinds για wall/beam (wall+beam+slab μέλη ΚΑΙ σκέτες γραμμές-οδηγοί). */
const DEFAULT_MEMBER_KINDS: MemberSnapKinds = ['wall', 'beam', 'slab', 'line'];

/** Είσοδος του εγκεφάλου — όλα όσα χρειάζονται τα 2 layers, σε ΕΝΑ σημείο. */
export interface BimCursorSnapInput {
  readonly toolKind: BimSnapToolKind;
  readonly cursor: Readonly<Point2D>;
  /** Pre-collected στόχοι σκηνής (ΚΟΙΝΟ store — column + wall + beam). */
  readonly targets: Readonly<SceneSnapTargets>;
  readonly sceneUnits: SceneUnits;
  /** Layer 1 OSNAP engine — injected (pure/testable). */
  readonly findSnapPoint: FindSnapPointFn;
  /** wall/beam: πλάτος/πάχος νέου μέλους σε mm (ζωνική δικαιολόγηση). */
  readonly memberWidthMm?: number;
  /** wall/beam: ποιοι στόχοι μετράνε (default = wall+beam+slab+line). */
  readonly memberKinds?: MemberSnapKinds;
  /** column: Polar/Rect Magnet opts (ADR-398 §3.13/§3.15) — `undefined` = χωρίς magnet. */
  readonly columnOpts?: Readonly<PolarDiskSnapOptions>;
}

/**
 * Discriminated union: placement (column ή member) Ή σημείο (OSNAP/καθαρός cursor).
 * `point` υπάρχει ΠΑΝΤΑ (το τελικό σημείο που πρέπει να κουμπώσει ο cursor).
 */
export type BimCursorSnap =
  | { readonly kind: 'member-placement'; readonly placement: MemberGhostSnapResult; readonly point: Point2D }
  | { readonly kind: 'column-placement'; readonly placement: ColumnFaceSnap; readonly point: Point2D }
  | {
      readonly kind: 'point';
      readonly point: Point2D;
      /** OSNAP mode που κέρδισε (`null` = κανένα snap → καθαρός cursor). */
      readonly snapType: ExtendedSnapType | null;
      /** Ο νικητής candidate (φέρει `referenceSegment` για alignment line)· `null` αν κανένα. */
      readonly candidate: SnapCandidate | null;
    };

/**
 * Ο εγκέφαλος. **Placement-first (ανά toolKind), point-fallback** — consistent με την υπάρχουσα
 * συμπεριφορά (η face-snap νικά όταν υπάρχει παρειά κοντά· αλλιώς ο ήδη-OSNAP-snapped cursor
 * ρέει). Ποτέ δεν γυρίζει `null`: χωρίς placement/snap → `kind:'point'` με τον cursor αυτούσιο.
 */
export function resolveBimCursorSnap(input: BimCursorSnapInput): BimCursorSnap {
  const { toolKind, cursor, targets, sceneUnits, findSnapPoint } = input;

  // ── Layer 2: placement (ειδικευμένο ανά εργαλείο) ──────────────────────────
  if (toolKind === 'column') {
    const placement = resolveColumnFaceSnapFromTargets(cursor, targets, sceneUnits, input.columnOpts);
    if (placement) return { kind: 'column-placement', placement, point: placement.position };
  } else if (toolKind === 'wall' || toolKind === 'beam') {
    const members = selectGhostMembers(targets, input.memberKinds ?? DEFAULT_MEMBER_KINDS);
    const placement = resolveMemberGhostSnapFromStore(
      cursor,
      targets.footprints,
      members,
      input.memberWidthMm ?? 0,
      sceneUnits,
    );
    if (placement) return { kind: 'member-placement', placement, point: placement.start };
  }

  // ── Layer 1: point (OSNAP engine) — fallback ───────────────────────────────
  const result = findSnapPoint(cursor.x, cursor.y);
  if (result && result.found) {
    return { kind: 'point', point: result.snappedPoint, snapType: result.activeMode, candidate: result.snapPoint };
  }

  // ── Κανένα snap → καθαρός cursor (πάντα έγκυρο σημείο) ──
  return { kind: 'point', point: { x: cursor.x, y: cursor.y }, snapType: null, candidate: null };
}
