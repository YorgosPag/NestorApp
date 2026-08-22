/**
 * BIM Drawing Mode — Base Types
 * ADR-363: Generic Parametric Building Element pattern (§5.1)
 *
 * Pattern mirrors ADR-358 StairEntity: kind + params + geometry cache + validation.
 * All geometry stored in mm (same as stair §5.0).
 * BimPoint has optional z for 3D-readiness (G11) — και το ΟΝΟΜΑ του το λέει (ADR-792).
 */

import type { Timestamp } from 'firebase/firestore';
import type { BaseEntity } from '../../types/base-entity';
import type { BimElementStyleOverride } from '../../config/bim-object-styles';
import type { GuideBinding } from '../hosting/guide-binding-types';
import type { FaceAppearanceMap } from './face-appearance-types';
import type { Point2D } from '../../rendering/types/Types';

// ─── Plan (XY) geometry vocabulary ────────────────────────────────────────────

/**
 * **Ό,τι εκθέτει `x`/`y`** — το λεξιλόγιο ΕΙΣΟΔΟΥ κάθε αλγορίθμου κάτοψης (ADR-730 → ADR-789).
 *
 * 🔑 Είναι ο **παραλήπτης**, όχι ο αποθηκευμένος τύπος. Τον ικανοποιούν ταυτόχρονα
 * {@link BimPoint}, `Point2D`, μια κορυφή, μια λαβή, ένα snap target — **χωρίς καμία
 * μετατροπή**. Γι' αυτό μια συνάρτηση που δεν διαβάζει `z` δηλώνει `PlanarPoint`,
 * ΠΟΤΕ `BimPoint`.
 *
 * **Γιατί υπάρχει** (ADR-789): μέχρι 2026-08-22 το `polygon-utils` και τα αδέλφια του
 * δήλωναν `readonly BimPoint[]` ενώ **δεν διάβαζαν `.z` ούτε μία φορά** (μετρημένο: 0
 * αναγνώσεις σε 460 γραμμές). Η υπογραφή έλεγε ψέματα, και οι καλούντες πλήρωναν το
 * ψέμα με **89 ωμά `{ x: p.x, y: p.y, z: 0 }` σε 67 αρχεία** — plus πέντε ιδιωτικά
 * `lift`/`toXY`, δύο `polygon2D*` wrappers, ένα `as readonly BimPoint[]` cast και **δύο**
 * διπλότυπα `polygonBbox(readonly Point2D[])` που νίκησαν την εκστρατεία min/max του
 * ADR-716/583 **ακριβώς επειδή** το κοινό απαιτούσε 3D.
 *
 * 🏆 **Πρότυπο**: το CGAL λύνει το ίδιο με `Projection_traits_xy_3` (adapter ώστε 2D
 * αλγόριθμοι να τρέχουν πάνω σε 3D δεδομένα) και το JTS με **νέα κλάση** `CoordinateXY`.
 * Και τα δύο πληρώνουν μηχανισμό επειδή η C++/Java είναι **ονομαστικές**. Η δομική
 * τυποποίηση της TypeScript δίνει το ίδιο αποτέλεσμα με **έναν τύπο και μηδέν adapter**.
 *
 * ⚠️ **ΜΗΝ** το χρησιμοποιήσεις ως τύπο **αποθήκευσης** — για αυτό υπάρχουν το `Point2D`
 * (προφίλ κάτοψης· το υψόμετρο ζει στον όροφο/επίπεδο, όπως `API_Coord` του ArchiCAD και
 * το «profiles must lie in the XY plane» του Revit) και το {@link BimPoint} (γνήσια χωρικά
 * δεδομένα: σκάλες, MEP routing, στέγες, breaklines).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-789-planar-point-vocabulary.md
 */
export interface PlanarPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * **Αποθηκευμένο προφίλ κάτοψης** — 2Δ κορυφές, ΧΩΡΙΣ υψόμετρο (ADR-789 Φάση Δ).
 *
 * 🔑 Το υψόμετρο **δεν λείπει· ζει αλλού** — στον όροφο (`levelElevation`), στο
 * `basePivotZ`, στο `floorElevationMm`. Μια κορυφή προφίλ δεν έχει γνώμη για το ύψος,
 * και μέχρι το ADR-789 το δήλωνε ψευδώς ως `z: 0` σε **12** σημεία εγγραφής — αριθμό
 * που **κανένας αναγνώστης δεν διάβαζε ποτέ** (μετρημένο: 0 αναγνώσεις `.z` σε
 * `footprint`/`outline`/`polylineVertices` σε όλο το δέντρο).
 *
 * 🏆 **Ομόφωνη πρακτική του κλάδου** — προφίλ σε τοπικό 2Δ επίπεδο + **ξεχωριστός**
 * μετασχηματισμός τοποθέτησης:
 * - **IFC** `IfcArbitraryClosedProfileDef` (2Δ) + `IfcAxis2Placement`
 * - **Revit**: *«Profiles must lie in the XY plane and will be transformed to the
 *   profile plane automatically»* + `SketchPlane`/`Level`
 * - **ArchiCAD** `API_Polygon` = πίνακας `API_Coord` (2Δ)· το `API_Coord3D` είναι **άλλος τύπος**
 * - **MAXON Cinema 4D**: spline points σε **τοπικές** συντεταγμένες + object matrix
 * - **Figma** `vectorNetwork.vertices` = `{x, y}` + `relativeTransform`
 *
 * 🏆 **Πού τους ξεπερνάμε**: και οι πέντε κρατούν τη σχέση «προφίλ ↔ επίπεδο» στην
 * **τεκμηρίωση** — γι' αυτό το Revit χρειάζεται τη φράση «*must* lie in the XY plane»
 * και το C4D το «*ideally* oriented». Δεν **μπορούν** να την επιβάλουν: C++/C# είναι
 * ονομαστικές. Εδώ το λέει ο **τύπος**, και ο μεταγλωττιστής απορρίπτει το `z: 0` στο
 * σημείο εγγραφής (excess property check σε object literal) — **η ακριβής μορφή** και
 * των 12 παραβιάσεων. Το ίδιο το δέντρο είχε ήδη το αποτύπωμα της αποτυχίας τους:
 * το `wall-covering-strip-geometry.ts` έγραφε στο σχόλιο «Optional cached **2D** strip
 * outline» ενώ ο τύπος από κάτω έλεγε `BimPoint[]`.
 *
 * ⚠️ **ΔΕΝ αντικαθιστά το {@link BimPolygon}**: εκείνο μένει για ό,τι είναι **γνήσια
 * χωρικό**, και είναι μετρημένο ποιο — κάγκελα (`baseElevationMm`), σκάλες (`baseZ`,
 * μεταβάλλεται ανά πατούσα), φρεάτιο σκάλας (`outlineZ` = πάνω παρειά πλάκας).
 * Καθολική στένωση του `BimPolygon` θα έσπαγε **ακριβώς** αυτά.
 *
 * ⚠️ **Το Zod schema ΔΕΝ στενεύει μαζί του — και είναι αποδεδειγμένο γιατί.** Το
 * `BimPointSchema` είναι `.strict()`, οπότε αφαίρεση του `z` κάνει **κάθε παλιό έγγραφο
 * να απορρίπτεται** (`unrecognized_keys`, επαληθεύτηκε εκτελώντας σε zod 3.25.76).
 * Κρατάμε `z: z.number().finite().optional()` στην ανάγνωση και γράφουμε 2Δ — αυτός
 * είναι ο **νόμος του Postel** («conservative in what you send, liberal in what you
 * accept»), όχι απόκλιση: «τι δέχομαι» και «τι γράφω» είναι δύο ερωτήματα (ADR-749).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-789-planar-point-vocabulary.md §8
 */
export interface PlanProfile {
  readonly vertices: readonly Point2D[];
}

// ─── BIM entity geometry vocabulary (ΜΠΟΡΕΙ να κουβαλά υψόμετρο) ─────────────

/**
 * **Σημείο οντότητας BIM** — `x`/`y` στην κάτοψη, με υψόμετρο που **μπορεί** να
 * ταξιδεύει μαζί του (ADR-792).
 *
 * 🔑 **Το όνομα ΔΕΝ λέει «3D», και αυτό είναι το συμβόλαιο.** Μέχρι το ADR-792
 * λεγόταν `Point3D` — ίδιο όνομα με το {@link Point3D} του `rendering/types/Types`,
 * που εγγυάται `z`. Μετρημένο τότε: **77% των 216 καταναλωτών του δεν διάβαζαν
 * ΠΟΤΕ `.z`**, και **46%** των αναγνώσεων που υπήρχαν ήταν `z ?? 0` — δηλαδή «υπόθεσε
 * ότι δεν είναι εκεί». Ένα όνομα που υπόσχεται τρίτη διάσταση την οποία δεν εγγυάται
 * είναι ψέμα, και το ψέμα το πλήρωναν οι αναγνώστες.
 *
 * 🏆 **Ο κανόνας είναι ομόφωνος στον κλάδο: το όνομα δηλώνει τι ΕΓΓΥΑΤΑΙ.**
 * Rhino `Point2d`/`Point3d` · Revit `UV`/`XYZ` · ArchiCAD `API_Coord`/`API_Coord3D` ·
 * three.js `Vector2`/`Vector3` · Cinema 4D `Vector`/`Vector4d`. **Κανένας** δεν βάζει
 * διάσταση σε όνομα που δεν την εγγυάται.
 *
 * 🔑 Το ακριβές μας ανάλογο είναι το **JTS**: το `Coordinate` του κουβαλά `z` που
 * **μπορεί να είναι `NaN`** («*If a Z-ordinate value is not specified or not defined,
 * constructed coordinates have a Z-ordinate of NaN*») — ίδιο πρόβλημα. Η λύση τους
 * είναι **όνομα χωρίς αξίωση διάστασης**, και κρατούν το ρητό `CoordinateXY` για ό,τι
 * εγγυάται δύο. **Πού τους ξεπερνάμε**: το JTS αφήνει τον αναγνώστη να θυμηθεί
 * `isNaN(z)` σε χρόνο εκτέλεσης· εδώ το `z?` το επιβάλλει ο **μεταγλωττιστής**.
 *
 * ⚠️ **Γνήσια χωρικά δεδομένα** (σκάλες: κάθε πατούσα σε άλλο ύψος· έλικες· σπείρες)
 * χρησιμοποιούν το {@link Point3D} του `rendering/types/Types` — **`z` υποχρεωτικό**.
 * ΜΗΝ τα ενώσεις: δύο ερωτήματα ⇒ δύο ονόματα (ADR-749).
 *
 * ⚠️ Για **παράμετρο** που δεν διαβάζει `z`, δήλωσε {@link PlanarPoint} — ΠΟΤΕ αυτό.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-792-bim-point-vocabulary.md
 */
export interface BimPoint extends PlanarPoint {
  readonly z?: number; // mm — προαιρετικό· το υψόμετρο ζει κανονικά στον όροφο
}

/** Ανοιχτή/κλειστή πολυγραμμή οντότητας BIM. Οι κορυφές **μπορεί** να έχουν `z`. */
export interface BimPolyline {
  readonly points: readonly BimPoint[];
  readonly closed?: boolean;
}

/**
 * Κλειστό πολύγωνο οντότητας BIM (η τελευταία κορυφή ενώνεται με την πρώτη).
 *
 * ⚠️ Δεν είναι το ίδιο με το `Polygon3D` του `stair-types`, που είναι **σκέτος
 * πίνακας** κορυφών με **εγγυημένο** `z`. Μέχρι το ADR-792 και τα δύο λέγονταν
 * `Polygon3D` — **54 έναντι 56** αρχεία, ένα αντικείμενο κι ένας πίνακας.
 */
export interface BimPolygon {
  readonly vertices: readonly BimPoint[];
}

/**
 * Περιβάλλον κουτί οντότητας BIM.
 *
 * ⚠️ Επειδή το `z` του {@link BimPoint} είναι προαιρετικό, ένα `BimBounds` **δεν
 * αποδεικνύει ύψος**. Δες ADR-789 §9 #3: το `polygonBbox` επιστρέφει `z: 0` σε `min`
 * ΚΑΙ σε `max`, δηλαδή κουτί με μηδενικό ύψος — ανοιχτό, με όνομα και αριθμό.
 */
export interface BimBounds {
  readonly min: BimPoint;
  readonly max: BimPoint;
}

// ─── BIM Element taxonomy ────────────────────────────────────────────────────

/** Discriminator for the BIM entity types (ADR-363 §5.2 + ADR-406 MEP fixture) */
export type BimElementType =
  | 'wall' | 'opening' | 'slab' | 'slab-opening' | 'column' | 'beam'
  // ADR-406 — point-based MEP fixture.
  | 'mep-fixture'
  // ADR-408 Φ3 — point-based electrical panel.
  | 'electrical-panel'
  // ADR-408 Φ12 — point-based plumbing manifold.
  | 'mep-manifold'
  // ADR-407 — standalone path-based railing.
  | 'railing'
  // ADR-410 — mesh-based CC0 furniture.
  | 'furniture'
  // ADR-683 Φ3 — εισαγόμενο ψημένο πλέγμα από συνεργάτη (κατάσταση D).
  | 'imported-mesh'
  // ADR-408 Φ8 — unified linear MEP segment (duct + pipe).
  | 'mep-segment'
  // ADR-408 Φ11 — auto pipe fitting (point-based junction element).
  | 'mep-fitting'
  // ADR-415 — pure-vector 2D floorplan symbol (category-driven; WC/sanitary first).
  | 'floorplan-symbol'
  // ADR-417 — parametric pitched roof (footprint + per-edge slopes).
  | 'roof'
  // ADR-408 Εύρος Β — point-based hydronic radiator (heating terminal).
  | 'mep-radiator'
  // ADR-408 Eyros B #2 — point-based hydronic boiler (heating source).
  | 'mep-boiler'
  // ADR-408 DHW — point-based domestic hot water heater (DHW source).
  | 'mep-water-heater'
  // ADR-408 Eyros B #3 — area-based radiant floor heating loop.
  | 'mep-underfloor'
  // ADR-419 — thin polygon floor covering per room (IfcCovering FLOORING).
  | 'floor-finish'
  // ADR-422 — analytical thermal space / θερμικός χώρος (IfcSpace).
  | 'thermal-space'
  // ADR-437 — space separator / γραμμή διαχωρισμού χώρου (IfcVirtualElement).
  | 'space-separator'
  // ADR-436 — substructure / θεμελίωση (πέδιλα/πεδιλοδοκοί/συνδετήριες δοκοί).
  | 'foundation';

/**
 * Union of all BIM sub-type discriminators (one per element type).
 * Narrowed to specific kind union at the concrete entity interface level.
 *
 * NOTE: Does NOT include stair kinds — stair uses its own StairKind union.
 * BimEntity<TKind> uses `TKind extends string` (not this) so stair can extend BimEntity too.
 */
export type BimElementKind =
  | 'straight' | 'curved' | 'polyline'           // wall kinds
  | 'door' | 'window' | 'sliding-door' | 'french-door' | 'fixed' // opening kinds
  | 'floor' | 'ceiling' | 'roof' | 'ground' | 'foundation'       // slab kinds
  | 'shaft' | 'well' | 'duct' | 'chimney'         // slab-opening kinds
  | 'rectangular' | 'circular' | 'L-shape' | 'T-shape'           // column kinds
  | 'cantilever';                                  // beam additional kind

// ─── ΑΤΟΕ category codes (ADR-175 §3.3) ─────────────────────────────────────

export type AtoeCategoryCode =
  | 'ΟΙΚ-1' | 'ΟΙΚ-2' | 'ΟΙΚ-3' | 'ΟΙΚ-4' | 'ΟΙΚ-5'
  | 'ΟΙΚ-6' | 'ΟΙΚ-7' | 'ΟΙΚ-8' | 'ΟΙΚ-9' | 'ΟΙΚ-10'
  | 'ΟΙΚ-11' | 'ΟΙΚ-12';

// ─── Building-code validation result ─────────────────────────────────────────

export interface BimValidation {
  readonly hasCodeViolations: boolean;
  /** i18n keys for violations (empty when no violations) */
  readonly violationKeys: readonly string[];
  readonly lastValidatedAt: Timestamp | null;
}

// ─── Multi-user soft lock (ADR-358 G24 pattern) ───────────────────────────────

/** Minimal lock shape — all BIM entities satisfy this. Concrete types can extend it. */
export interface BimLock {
  readonly userId: string;
}

/** Full soft lock for Phase 1+ BIM entities (Wall/Slab/Column/Beam/Opening). */
export interface SoftLock extends BimLock {
  readonly displayName: string;
  readonly lockedAt: Timestamp;
}

// ─── Generic BIM Entity base (§5.1) ──────────────────────────────────────────

/**
 * Generic parametric building element.
 * TKind narrows to the element's sub-type union (e.g. WallKind, StairKind).
 * TParams holds user-editable parameters.
 * TGeometry holds computed geometry cache (re-derivable from params on corruption).
 *
 * Constraint: TKind extends string (not BimElementKind) so that StairKind can also use this generic.
 *
 * ADR-395 §4.6 (G5): no `qto` field — BIM quantities are geometry-derived at
 * read time (BOQ bridge + Schedule combined preset via `deriveAtoeQuantity`).
 */
export interface BimEntity<TKind extends string, TParams, TGeometry>
  extends BaseEntity {
  readonly kind: TKind;
  readonly params: TParams;
  /** Computed geometry cache. Source of truth = params. */
  readonly geometry: TGeometry;
  readonly validation: BimValidation;
  /** Display-only multi-user lock (never blocks writes) */
  readonly editingBy?: BimLock;
  /** Per-element style override (ADR-375 Phase C.5). Persisted in Firestore entity doc. */
  readonly styleOverride?: BimElementStyleOverride;
  /**
   * Per-face appearance override (ADR-539 — Cinema 4D «Polygon Mode»). Cosmetic
   * χρώμα/υλικό ανά όψη (top/bottom/side:i). Δεν συμμετέχει στο geometry derivation
   * — ζει εδώ δίπλα στο `styleOverride`. Absent → legacy single-material render.
   */
  readonly faceAppearance?: FaceAppearanceMap;
  /**
   * Associative grid hosting (ADR-441). Δηλώνει σε ποιους άξονες κανάβου είναι
   * «κρεμασμένη» η entity ώστε να ακολουθεί όταν ο άξονας μετακινείται.
   * Optional → entities χωρίς bindings = ανεξάρτητες (ως σήμερα).
   */
  readonly guideBindings?: readonly GuideBinding[];
  // Firestore tenant fields (present on persisted entities)
  readonly companyId?: string;
  readonly projectId?: string;
  readonly buildingId?: string;
  readonly floorplanId?: string;
  readonly floorId?: string;
  readonly createdAt?: Timestamp | null;
  readonly updatedAt?: Timestamp | null;
  readonly createdBy?: string;
  readonly updatedBy?: string;
}

// ─── Params union helper (used by BimTypePickerDialog) ───────────────────────

/** Placeholder type for BimPreset generic param. Concrete types narrow this. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BimParams<_TKind> = Record<string, any>;

// ─── Default factory helpers ──────────────────────────────────────────────────

export function makeBimValidation(): BimValidation {
  return {
    hasCodeViolations: false,
    violationKeys: [],
    lastValidatedAt: null,
  };
}

