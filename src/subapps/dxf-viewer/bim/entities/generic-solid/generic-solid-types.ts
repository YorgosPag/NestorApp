/**
 * BIM Generic Solid — Type Schema (ADR-684 Φ2).
 *
 * **Παραμετρικά γεωμετρικά στερεά** — κουτί, σφαίρα, κύλινδρος, κώνος, κουλούρι (torus), πυραμίδα,
 * δίσκος, πρίσμα. Το κενό που κάλυψε το ADR-684: ως τώρα ο Νέστωρ δεν είχε κανέναν τρόπο να φτιάξει
 * απλό ογκομετρικό στερεό από λίγους αριθμούς (grep = μηδέν· κανένα DXF 3DSOLID).
 *
 * ## Το όριο — τι είναι εδώ και τι ΔΕΝ είναι
 *
 * Εδώ ζουν **procedural** σχήματα: το σχήμα περιγράφεται πλήρως από λίγες παραμέτρους και το χτίζει
 * ο κώδικας (`generic-solid-to-three`). Τα **ελεύθερης μορφής** (γλυπτά, μαξιλάρια, σεντόνια) ΔΕΝ
 * μπαίνουν εδώ — δεν περιγράφονται με αριθμούς· πηγαίνουν στον δρόμο εισαγόμενου πλέγματος
 * (`imported-mesh`, ADR-683) / curated mesh library (ADR-411).
 *
 * ## Ένα kind, πολλά σχήματα
 *
 * Ο `kind` της οντότητας είναι πάντα `'generic'`. Η ποικιλία σχημάτων ζει στο `params.shape` ως
 * **nested discriminated union** — ΟΧΙ 7 ξεχωριστά entity kinds (θα ήταν sibling clones, N.18, και
 * ×7 τα ADR-587 capability anchors). Κάθε σχήμα έχει τα δικά του πεδία (ακτίνα vs πλάτος/βάθος/ύψος
 * vs μεγάλη/μικρή ακτίνα torus) — ακριβώς η δουλειά ενός discriminated union.
 *
 * ## Δομικό vs διακοσμητικό = metadata, όχι δεύτερος τύπος
 *
 * Το ίδιο στερεό μπορεί να είναι δομικός δακτύλιος ή διακοσμητικό. Η διάκριση ζει στην ταξινόμηση/
 * BOQ/υλικό (Φ4), ΟΧΙ στη γεωμετρία — όπως το «Structural» toggle του Revit.
 *
 * IFC: **`IfcBuildingElementProxy`** — γεωμετρία χωρίς σημασιολογία δομικού στοιχείου (ίδιο με
 * imported-mesh· ένα κουτί δεν είναι εγγενώς τοίχος ή κολώνα).
 *
 * @see ./generic-solid-geometry — computeGenericSolidGeometry + shapeBoundingBoxMm
 * @see ../imported-mesh/imported-mesh-types — ο αδελφός non-catalog point τύπος
 * @see docs/centralized-systems/reference/adrs/ADR-684-generic-solid-primitive-entity.md
 */

import type { BimEntity, BoundingBox3D, Point3D, Polygon3D } from '../../types/bim-base';
import type { SceneUnits } from '../../../utils/scene-units';
import type { IfcEntityMixin } from '../../types/ifc-entity-mixin';

// ─── Kind discriminator (οντότητα) ────────────────────────────────────────────

/**
 * Ο μόνος «kind» της οντότητας. Το σχήμα ΔΕΝ κωδικοποιείται εδώ — ζει στο `params.shape`. Ο `kind`
 * λέει *τι είναι* το αντικείμενο (ένα παραμετρικό στερεό), το `shape.kind` λέει *ποιο σχήμα*.
 */
export type GenericSolidKind = 'generic';

// ─── Shape discriminated union (params.shape) ─────────────────────────────────

/**
 * Το σχήμα του στερεού. Nested discriminated union στο `kind` — κάθε μέλος φέρει μόνο τα δικά του
 * πεδία. Όλες οι διαστάσεις σε **mm** (SSoT μονάδα BIM, όπως όλα τα params).
 */
export type GenericSolidShape =
  /** Ορθογώνιο παραλληλεπίπεδο (κουτί). */
  | { readonly kind: 'box'; readonly widthMm: number; readonly depthMm: number; readonly heightMm: number }
  /** Σφαίρα. */
  | { readonly kind: 'sphere'; readonly radiusMm: number }
  /** Κύλινδρος (κατακόρυφος άξονας). */
  | { readonly kind: 'cylinder'; readonly radiusMm: number; readonly heightMm: number }
  /** Κώνος / κόλουρος κώνος. `radiusTopMm = 0` → πλήρης κώνος. */
  | { readonly kind: 'cone'; readonly radiusBottomMm: number; readonly radiusTopMm: number; readonly heightMm: number }
  /** Κουλούρι (torus): `majorRadiusMm` = ακτίνα δακτυλίου, `tubeRadiusMm` = ακτίνα σωλήνα. */
  | { readonly kind: 'torus'; readonly majorRadiusMm: number; readonly tubeRadiusMm: number }
  /** Ορθογωνική πυραμίδα. */
  | { readonly kind: 'pyramid'; readonly baseWidthMm: number; readonly baseDepthMm: number; readonly heightMm: number }
  /** Δίσκος (λεπτός κύλινδρος): ακτίνα + πάχος. */
  | { readonly kind: 'disc'; readonly radiusMm: number; readonly thicknessMm: number }
  /** Κανονικό n-γωνικό πρίσμα (κατακόρυφος άξονας). `radiusMm` = ακτίνα περιγεγραμμένου κύκλου. */
  | { readonly kind: 'prism'; readonly radiusMm: number; readonly heightMm: number; readonly sides: number };

/** Οι discriminator τιμές του σχήματος. */
export type GenericSolidShapeKind = GenericSolidShape['kind'];

/**
 * ADR-684 Φ4-C — ρόλος του στερεού για ταξινόμηση/BOQ (§4.3). **Metadata, ΟΧΙ γεωμετρία** — το ίδιο
 * σχήμα είναι είτε δομικός δακτύλιος (RC, μετριέται σε m³) είτε διακοσμητικό (χωρίς αυτόματη γραμμή
 * κόστους, όπως ανανάθετο imported-mesh). Ακριβώς το «Structural» toggle του Revit Generic Model.
 */
export type GenericSolidStructuralRole = 'structural' | 'decorative';

/** SSoT λίστα ρόλων — για UI selector + coverage. */
export const GENERIC_SOLID_STRUCTURAL_ROLES = [
  'structural',
  'decorative',
] as const satisfies readonly GenericSolidStructuralRole[];

/** Προεπιλογή: διακοσμητικό (μη-δομικό, όπως το Revit Generic Model default). */
export const DEFAULT_GENERIC_SOLID_STRUCTURAL_ROLE: GenericSolidStructuralRole = 'decorative';

/** SSoT λίστα σχημάτων — για UI selectors + coverage. Παράγεται μία φορά εδώ. */
export const GENERIC_SOLID_SHAPE_KINDS = [
  'box',
  'sphere',
  'cylinder',
  'cone',
  'torus',
  'pyramid',
  'disc',
  'prism',
] as const satisfies readonly GenericSolidShapeKind[];

// ─── Parameters (SSoT) ────────────────────────────────────────────────────────

export interface GenericSolidParams {
  readonly kind: GenericSolidKind;
  /** Το σχήμα + οι διαστάσεις του (nested discriminated union). */
  readonly shape: GenericSolidShape;
  /** Σημείο εισαγωγής (κάτοψη, canvas units) — το κέντρο του ίχνους. Το `z` προκύπτει από το elevation. */
  readonly position: Point3D;
  /** Μοίρες CCW περί τον κατακόρυφο άξονα. */
  readonly rotationDeg: number;
  /** mm. Υψόμετρο τοποθέτησης πάνω από το FFL του ορόφου. `0` → πατά στο δάπεδο. */
  readonly mountingElevationMm: number;
  /** Προαιρετικός δείκτης σε `BimMaterial` (Φ4· απόν → προεπιλεγμένο υλικό στερεού). */
  readonly material?: string;
  /**
   * ADR-684 Φ4-C — ρόλος ταξινόμησης/BOQ (§4.3). Απόν → {@link DEFAULT_GENERIC_SOLID_STRUCTURAL_ROLE}
   * (διακοσμητικό). **Metadata πάνω στην ΙΔΙΑ γεωμετρία** — δεν αλλάζει σχήμα/converter/ίχνος.
   */
  readonly structuralRole?: GenericSolidStructuralRole;
  /** Μονάδα συντεταγμένων του καμβά. Απόν → `'mm'`. */
  readonly sceneUnits?: SceneUnits;
  /** FK → Floor.id (αναφορά ορόφου). */
  readonly storeyId?: string;
}

// ─── Geometry cache (παράγωγο· SSoT = params) ─────────────────────────────────

/**
 * Υπολογισμένη γεωμετρία. Επιστρέφεται από `computeGenericSolidGeometry(params)` — ποτέ δεν
 * μεταλλάσσεται από καταναλωτές. Το `footprint` είναι το **ορθογώνιο του bbox** (ίδιο συντηρητικό
 * ίχνος με έπιπλο/imported-mesh) ώστε hit-test + bounds να δουλεύουν αμέσως, χωρίς 3D build.
 */
export interface GenericSolidGeometry {
  /** Polygon3D — οριζόντιο ίχνος στο επίπεδο τοποθέτησης. Κλειστό CCW. */
  readonly footprint: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m². Εμβαδόν ίχνους. */
  readonly area: number;
  /** mm. Συνολικό ύψος (bbox Z). */
  readonly height: number;
}

// ─── Entity ───────────────────────────────────────────────────────────────────

/**
 * Οντότητα παραμετρικού στερεού. **Πλήρης πολίτης**: σχεδιάζεται σε κάτοψη ΚΑΙ 3Δ, επιλέγεται,
 * μετακινείται, περιστρέφεται, εξάγεται.
 */
export interface GenericSolidEntity
  extends BimEntity<GenericSolidKind, GenericSolidParams, GenericSolidGeometry>,
    IfcEntityMixin {
  readonly type: 'generic-solid';
  /** IFC4 — γεωμετρία χωρίς σημασιολογία δομικού στοιχείου (βλ. σχόλιο αρχείου). */
  readonly ifcType: 'IfcBuildingElementProxy';
}

// ─── Σταθερές ─────────────────────────────────────────────────────────────────

/**
 * Ο discriminator της οντότητας στη σκηνή. Σταθερά επειδή τον ρωτούν πολλαπλοί καταναλωτές που
 * δέχονται χαλαρό `{ type: string }` — εκεί ο tsc δεν πιάνει typo σε literal.
 */
export const GENERIC_SOLID_ENTITY_TYPE: GenericSolidEntity['type'] = 'generic-solid';

/** Ελάχιστη διάσταση (mm) κάτω από την οποία ένα σχήμα θεωρείται εκφυλισμένο. */
export const MIN_GENERIC_SOLID_DIMENSION_MM = 1;

/** Ελάχιστες πλευρές για πρίσμα. */
export const MIN_PRISM_SIDES = 3;

/** Προεπιλεγμένο υψόμετρο τοποθέτησης — πατά στο δάπεδο του ορόφου. */
export const DEFAULT_GENERIC_SOLID_MOUNTING_ELEVATION_MM = 0;

/** Προεπιλεγμένο σχήμα κατά τη δημιουργία (κουτί 500×500×500 mm). */
export const DEFAULT_GENERIC_SOLID_SHAPE: GenericSolidShape = {
  kind: 'box',
  widthMm: 500,
  depthMm: 500,
  heightMm: 500,
};
