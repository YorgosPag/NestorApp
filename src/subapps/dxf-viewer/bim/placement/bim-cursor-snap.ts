/**
 * BIM Cursor Snap — «Ένας Εγκέφαλος Έλξης» (ADR-514, Revit-grade unified snapping).
 *
 * **Ο ΕΝΑΣ resolver που απαντά: «δοθέντος raw cursor + ενεργού εργαλείου, πού προσγειώνεται
 * το σημείο και σε τι κούμπωσε;».** Συνθέτει τους δύο ιστορικά διάσπαρτους μηχανισμούς σε ΕΝΑ
 * layered, tool-agnostic σημείο εισόδου — όπως η Revit έχει ΕΝΑ snapping subsystem για όλα τα tools:
 *
 *   · **Layer 2 — placement** (ανά toolKind): η ειδικευμένη «έξυπνη» τοποθέτηση δομικού μέλους.
 *       - `column`     → `resolveColumnFaceSnapFromTargets` (9-λαβές face + polar/rect magnet)
 *       - `wall`/`beam`→ `resolveMemberGhostSnapFromStore` (column-priority → linear Τ-framing)·
 *                        +optional polar/rect **magnet** fallback (`magnetOpts`, ίδιο SSoT με κολόνα)
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
import { resolveBeamSpanSnap, collectSpanSupportOutlines } from '../framing/beam-span-snap';
import { selectGhostMembers, type SceneSnapTargets } from '../framing/scene-snap-targets';
import type { MemberGhostSnapResult } from '../framing/linear-member-face-snap';
import { resolveColumnFaceSnapFromTargets, type ColumnFaceSnap } from '../columns/column-face-snap';
import type { HeadReferenceLines } from '../columns/column-reference-lines';
import type { PolarDiskSnapOptions } from '../columns/polar-disk-snap';
import { resolveMemberMagnetPlacement } from './member-magnet-placement';

/**
 * Layer 1 point-snap provider. Ίδια υπογραφή με το `useSnapManager.findSnapPoint`
 * (`getGlobalSnapEngine().findSnapPoint`). Επιστρέφει `null` όταν ο engine είναι ανενεργός.
 */
export type FindSnapPointFn = (worldX: number, worldY: number) => ProSnapResult | null;

/**
 * Ποιο placement layer ενεργοποιεί ο εγκέφαλος. `point-only` = μόνο OSNAP (line/polyline/…).
 *
 * ADR-514 Φ6 — face-snap σε slab/roof/foundation:
 *   · `polygon-vertex` (slab/roof) → κορυφή περιγράμματος κουμπώνει **flush** στην πλησιέστερη παρειά
 *     μέλους (member face-snap, `memberWidthMm` πάντα 0 → το σημείο πατά ΑΚΡΙΒΩΣ πάνω στην παρειά).
 *     Κοινό για πλάκα ΚΑΙ στέγη (ταυτόσημο polygon FSM) — ΕΝΑ kind, λιγότερη επιφάνεια.
 *   · `foundation-pad` → το πέδιλο (1-κλικ) κουμπώνει σε παρειά/άξονα κολόνας/μέλους ΟΠΩΣ η κολώνα
 *     (reuse `resolveColumnFaceSnapFromTargets` — center-on-axis / 9-handle flush).
 *
 * ADR-508 §line-cyan — `line` (σκέτη γραμμή σχεδίασης) = γραμμικό μέλος **μηδενικού πλάτους**: κουμπώνει
 *   **flush/κάθετα** σε υφιστάμενη γραμμή/μέλος ΟΠΩΣ ο τοίχος (ίδιος `resolveMemberGhostSnapFromStore`,
 *   `memberWidthMm` πάντα 0 → το σημείο πατά ΑΚΡΙΒΩΣ πάνω στην παρειά + `faceFrame` → κυανές listening
 *   dimensions). Ταυτόσημο zero-width behavior με το `polygon-vertex`, ξεχωριστό όνομα για σαφήνεια εργαλείου.
 */
export type BimSnapToolKind = 'wall' | 'beam' | 'column' | 'polygon-vertex' | 'foundation-pad' | 'line' | 'point-only';

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
  /**
   * Layer 1 OSNAP engine — injected (pure/testable). **Optional**: όταν ο `cursor` έρχεται ήδη
   * OSNAP-snapped κεντρικά από το pipeline (`mouse-handler-up`/scheduler γράφουν `ImmediateSnapStore`,
   * διαβ. μέσω `resolveEffectivePreviewCursor`), παρέλειψέ το ώστε ο εγκέφαλος **να ΜΗΝ ξανα-snapάρει**
   * (double-snap). Χωρίς αυτό, το `point` branch επιστρέφει τον cursor **αυτούσιο** (ADR-514 §2).
   */
  readonly findSnapPoint?: FindSnapPointFn;
  /** wall/beam: πλάτος/πάχος νέου μέλους σε mm (ζωνική δικαιολόγηση). */
  readonly memberWidthMm?: number;
  /** wall/beam: ποιοι στόχοι μετράνε (default = wall+beam+slab+line). */
  readonly memberKinds?: MemberSnapKinds;
  /** column: Polar/Rect Magnet opts (ADR-398 §3.13/§3.15) — `undefined` = χωρίς magnet. */
  readonly columnOpts?: Readonly<PolarDiskSnapOptions>;
  /**
   * column (ADR-523): οι reference lines της **κεφαλής** του ghost (Τ-κολόνα) → multi-reference flush
   * snap στις παρειές/άξονα τοίχου. `undefined`/`null` (μη-Τ ή μη υπολογισμένο) → ο tier αδρανής.
   */
  readonly columnHead?: Readonly<HeadReferenceLines> | null;
  /**
   * column (ADR-525): `true` όταν το ενεργό ghost είναι **L-shape** (Σχήμα Γ) → ενεργοποιεί τον
   * corner-gap auto-junction tier (η L γεμίζει το κενό μεταξύ δύο κάθετων δοκαριών). `undefined`/`false`
   * για κάθε άλλο kind → ο tier αδρανής.
   */
  readonly lShapeGhost?: boolean;
  /**
   * beam (ADR-528): `true` όταν το ενεργό δοκάρι (straight/cantilever, awaitingStart) μπορεί να
   * **γεφυρώσει αυτόματα** το κενό ανάμεσα σε δύο δομικά μέλη (κολόνα/τοίχο). Ενεργοποιεί τον auto-span
   * tier **ΠΡΩΤΙΣΤΟ** στο beam branch: όταν ο cursor είναι στη νοητή ευθεία κέντρο→κέντρο, επιστρέφει
   * πλήρες span (`start`/`end` flush στις παρειές, `span:true`). `undefined`/`false` (τοίχος, curved,
   * from-wall) → ο tier αδρανής. Mirror του `lShapeGhost` (αντίστροφη φορά — ADR-525).
   */
  readonly beamSpanGhost?: boolean;
  /**
   * wall/beam: Polar/Rect Magnet opts για το **START** του μέλους (ADR-398 §3.13/§3.15, ίδιο SSoT με
   * την κολώνα). `undefined` = χωρίς magnet (σημερινή συμπεριφορά τοίχου). Όταν δοθεί (δοκάρι), το
   * φάντασμα κουμπώνει σε πολικό/καρτεσιανό πλέγμα μέσα σε κύκλο/ορθογώνιο **ΟΠΩΣ η κολώνα** — ως
   * **fallback** όταν καμία παρειά μέλους/κολόνας δεν είναι εντός capture (member-face-first).
   */
  readonly magnetOpts?: Readonly<PolarDiskSnapOptions>;
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
  // ADR-514 Φ6 — το πέδιλο (`foundation-pad`) κουμπώνει ΟΠΩΣ η κολώνα (ίδιος resolver: center-on-axis
  // / 9-handle flush) → reuse, μηδέν παράλληλο subsystem.
  if (toolKind === 'column' || toolKind === 'foundation-pad') {
    const placement = resolveColumnFaceSnapFromTargets(cursor, targets, sceneUnits, input.columnOpts, input.columnHead, input.lShapeGhost);
    if (placement) return { kind: 'column-placement', placement, point: placement.position };
  } else if (toolKind === 'wall' || toolKind === 'beam' || toolKind === 'polygon-vertex' || toolKind === 'line') {
    // ADR-528 — auto-span ΠΡΩΤΙΣΤΟ (mirror του column `lCornerHit`): όταν ο cursor είναι στη νοητή
    // ευθεία ανάμεσα σε δύο δομικά μέλη (κολόνες footprints + τοίχοι outline), το δοκάρι γεφυρώνει το
    // κενό με τα άκρα flush στις παρειές. Gated `beamSpanGhost` (μόνο straight/cantilever beam → τοίχος
    // αμετάβλητος). Νικά πριν το face-snap (το κενό είναι μακριά από παρειές → μηδέν αλληλεπικάλυψη).
    if (input.beamSpanGhost) {
      // ADR-529 Φ3 — περνάμε το πλάτος δοκαριού ώστε το justified third-alignment (νότια/κέντρο/βόρεια-flush)
      // να υπολογίζει σωστά το flush offset (ημι-πλάτος). Preview ≡ commit (ίδιο width με το `resolveStartAnchor`).
      const span = resolveBeamSpanSnap(cursor, collectSpanSupportOutlines(targets), sceneUnits, input.memberWidthMm ?? 0);
      if (span) {
        return {
          kind: 'member-placement',
          // ADR-529 Φ3 — `faceFrame` → οι σιελ listening dimensions εμφανίζονται ΚΑΙ στο auto-span (justified).
          // ADR-529 Location-Line — `justification` ρέει στο commit (unjustify→location line + associative width).
          placement: { start: span.start, end: span.end, status: 'neutral', span: true, guide: span.guide, faceFrame: span.faceFrame, justification: span.justification },
          point: span.start,
        };
      }
    }
    const members = selectGhostMembers(targets, input.memberKinds ?? DEFAULT_MEMBER_KINDS);
    // ADR-514 Φ6 / ADR-508 §line-cyan — η κορυφή περιγράμματος (`polygon-vertex`) ΚΑΙ η σκέτη γραμμή
    // (`line`) δεν έχουν «πλάτος» → memberWidth 0 ώστε το `.start` να πατά ΑΚΡΙΒΩΣ πάνω στην παρειά
    // (flush), όχι σε centerline offset ημι-πλάτους.
    const widthMm = toolKind === 'polygon-vertex' || toolKind === 'line' ? 0 : input.memberWidthMm ?? 0;
    const placement = resolveMemberGhostSnapFromStore(
      cursor,
      targets.footprints,
      members,
      widthMm,
      sceneUnits,
    );
    if (placement) return { kind: 'member-placement', placement, point: placement.start };
    // ADR-398 §3.13/§3.15 magnet (ίδιο SSoT με κολόνα) — fallback όταν καμία παρειά δεν είναι εντός
    // capture: cursor εντός κύκλου/ορθογωνίου → πολικό/καρτεσιανό πλέγμα. Μόνο όταν δοθεί `magnetOpts`
    // (δοκάρι· ο τοίχος δεν το περνά → αμετάβλητος). ΧΩΡΙΣ findSnapPoint (point-snap μένει κεντρικά).
    if (input.magnetOpts) {
      const magnet = resolveMemberMagnetPlacement(cursor, targets, sceneUnits, input.magnetOpts);
      if (magnet) return { kind: 'member-placement', placement: magnet, point: magnet.start };
    }
  }

  // ── Layer 1: point (OSNAP engine) — fallback ───────────────────────────────
  // `findSnapPoint` optional: αν λείπει (cursor ήδη snapped upstream), παρακάμπτεται →
  // ο cursor επιστρέφει αυτούσιος (anti double-snap, ADR-514 §2).
  const result = findSnapPoint?.(cursor.x, cursor.y);
  if (result && result.found) {
    return { kind: 'point', point: result.snappedPoint, snapType: result.activeMode, candidate: result.snapPoint };
  }

  // ── Κανένα snap → καθαρός cursor (πάντα έγκυρο σημείο) ──
  return { kind: 'point', point: { x: cursor.x, y: cursor.y }, snapType: null, candidate: null };
}
