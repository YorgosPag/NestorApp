/**
 * BIM Foundation — Type Schema (ADR-436, Slice 0).
 *
 * Νέο structural discipline «foundation» (substructure / θεμελίωση). Καλύπτει
 * ΜΟΝΟ point/line elements που ΔΕΝ χωράνε στο region-based slab:
 *   - `pad`      → μεμονωμένο πέδιλο (point-based, IfcFooting/PAD_FOOTING)
 *   - `strip`    → πεδιλοδοκός / συνεχές πέδιλο (line-based, IfcFooting/STRIP_FOOTING)
 *   - `tie-beam` → συνδετήρια δοκός (line-based, IfcFooting/FOOTING_BEAM)
 *
 * Οι region-based πλάκες θεμελίωσης (εδαφόπλακα / γενική κοιτόστρωση) ΔΕΝ ζουν
 * εδώ — REUSE του υπάρχοντος `SlabEntity` (kinds `ground`/`foundation`), όπως
 * στη Revit (Structural Foundation Slab = system family πάνω στον Floor
 * μηχανισμό). Βλ. ADR-436 §3.6.
 *
 * Αρχιτεκτονική απόφαση: `FoundationParams` = **discriminated union** ανά
 * `kind` (σε αντίθεση με την κολώνα όπου όλα τα kinds είναι point-based και ένα
 * flat interface αρκεί). Οι 3 βάσεις (point/line) είναι θεμελιωδώς διαφορετικές,
 * άρα το union είναι πιο type-safe.
 *
 * Elevation (ADR-369): η θεμελίωση είναι ΚΑΤΩ από τη στάθμη (αρνητικό Z).
 * `topElevationMm` = στάθμη άνω παρειάς (τυπικά αρνητική)· το στερεό κρέμεται
 * ΚΑΤΩ κατά `thicknessMm` (ίδια σύμβαση με slab/beam).
 *
 * Όλες οι γραμμικές μετρήσεις σε mm (Nestor convention).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md
 */

import type {
  BimEntity,
  BoundingBox3D,
  Point3D,
  Polygon3D,
} from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';
import type {
  PadReinforcement,
  StripReinforcement,
  TieBeamReinforcement,
} from '../structural/reinforcement/footing-reinforcement-types';
import type { AppliedMemberLoad } from '../structural/loads/structural-loads-types';

// ─── Sub-type discriminators (ADR-436 §3.2) ──────────────────────────────────

/** Foundation kind discriminator. Phase 1 = pad/strip/tie-beam (Phase 2 → +pile-cap/pile). */
export type FoundationKind = 'pad' | 'strip' | 'tie-beam';

/** Pad-footing vertical profile. `flat` (Phase 1), `stepped`/`sloped` (Phase 1b). */
export type FoundationProfile = 'flat' | 'stepped' | 'sloped';

/**
 * 9-position anchor — ποιο σημείο της βάσης του πεδίλου εδράζεται στο
 * `position` (mirror κολώνας). Μόνο για `pad`.
 */
export type FoundationAnchor =
  | 'center'
  | 'n' | 's' | 'e' | 'w'
  | 'nw' | 'ne' | 'sw' | 'se';

/**
 * Justification (Location Line) γραμμικού πεδίλου/συνδετήριας — ΠΟΥ κάθεται το band
 * ως προς τον άξονα (ADR-441 Slice 5a). Mirror της Revit «Location Line»:
 *   - `center`  → band ±w/2 εκατέρωθεν (default, concentric — δομικά ιδανικό).
 *   - `left`    → band αναπτύσσεται προς τα +CCW-normal (αριστερά της φοράς start→end)·
 *                 η ΔΕΞΙΑ παρειά πέφτει στον άξονα.
 *   - `right`   → band αναπτύσσεται προς τα −CCW-normal (δεξιά της φοράς)·
 *                 η ΑΡΙΣΤΕΡΗ παρειά πέφτει στον άξονα.
 * Έκκεντρη ανάπτυξη χρειάζεται σε όριο οικοπέδου/υπάρχον κτίριο (αλλιώς overhang
 * εκτός περιγράμματος). Μόνο για `strip`/`tie-beam` — το `pad` χρησιμοποιεί `anchor`.
 */
export type StripJustification = 'center' | 'left' | 'right';

/** IFC4 `IfcFootingTypeEnum` predefined type ανά kind. */
export type FoundationPredefinedType = 'PAD_FOOTING' | 'STRIP_FOOTING' | 'FOOTING_BEAM';

// ─── Variant-specific param blocks ───────────────────────────────────────────

/**
 * Stepped pad geometry (2-βάθμιο πέδιλο). Πλατιά βάση (`width`×`length`) +
 * στενότερο άνω βήμα (`topWidth`×`topLength`). `stepThicknessMm` = πάχος της
 * κάτω (πλατιάς) βαθμίδας· το άνω βήμα γεμίζει το υπόλοιπο `thicknessMm`.
 */
export interface PadSteppedParams {
  readonly topWidth: number;
  readonly topLength: number;
  readonly stepThicknessMm: number;
}

/**
 * Sloped pad geometry (κωνικό/πυραμιδικό πέδιλο). Πλατιά βάση
 * (`width`×`length`) → στενότερη άνω παρειά (`topWidth`×`topLength`), frustum.
 */
export interface PadSlopedParams {
  readonly topWidth: number;
  readonly topLength: number;
}

// ─── Common params (shared across kinds) ─────────────────────────────────────

/**
 * Κοινά πεδία όλων των foundation kinds.
 *   - `topElevationMm` — στάθμη άνω παρειάς (mm από project origin). Τυπικά
 *     ΑΡΝΗΤΙΚΗ (κάτω από τη στάθμη). Το στερεό κρέμεται ΚΑΤΩ κατά `thicknessMm`.
 *   - `thicknessMm` — βάθος πεδίλου/πεδιλοδοκού· για `tie-beam` = ύψος διατομής.
 */
export interface FoundationCommonParams {
  readonly topElevationMm: number;
  readonly thicknessMm: number;
  /** Material library ID (concrete grade, Slice 4 BOQ). */
  readonly material?: string;
  /** DXF canvas coordinate unit (defaults 'mm' when absent). */
  readonly sceneUnits?: SceneUnits;
  /** FK → Floor.id (storey reference, ADR-369). */
  readonly storeyId?: string;
  /** mm. Top-face offset από storey reference elevation (default 0). */
  readonly offsetFromStorey?: number;
  /** Catalog profile ID (π.χ. 'C20/25', τυπικό πέδιλο). Slice 4. */
  readonly catalogProfile?: string;
}

// ─── Per-kind params (discriminated union members) ───────────────────────────

/** Μεμονωμένο πέδιλο (point-based, IfcFooting/PAD_FOOTING). */
export interface PadFootingParams extends FoundationCommonParams {
  readonly kind: 'pad';
  /** Clicked point σε world coords (mm). Anchor offset εφαρμόζεται στο geometry. */
  readonly position: Point3D;
  /** mm. Πλάτος βάσης (X-axis). */
  readonly width: number;
  /** mm. Μήκος βάσης (Y-axis). */
  readonly length: number;
  /** Μοίρες CCW γύρω από το anchor. */
  readonly rotation: number;
  /** 9-position anchor (default 'center'). */
  readonly anchor: FoundationAnchor;
  /** Vertical profile. `stepped`/`sloped` απαιτούν το αντίστοιχο block. */
  readonly profile: FoundationProfile;
  /** Only meaningful όταν profile='stepped'. */
  readonly stepped?: PadSteppedParams;
  /** Only meaningful όταν profile='sloped'. */
  readonly sloped?: PadSlopedParams;
  /**
   * ADR-459 Phase 4b — οπλισμός πεδίλου (δι-διευθυντική σχάρα). Optional/non-breaking:
   * absent → δεν έχει διαστασιολογηθεί οπλισμός. Derived ποσότητες on-demand από
   * `footing-reinforcement-compute.ts` — ΠΟΤΕ αποθηκεύονται (geometry-is-SSoT).
   */
  readonly reinforcement?: PadReinforcement;
  /**
   * ADR-464 — Χειροκίνητο service φορτίο σχεδιασμού πεδίλου (χαρακτηριστικές G/Q
   * συνιστώσες — η αντίδραση της φιλοξενούμενης κολώνας). Single SSoT για τον
   * σχεδιασμό αυτού του πεδίλου (έδραση/κάμψη/διάτρηση). Optional/non-breaking:
   * absent → ο σχεδιασμός παραμένει αδρανής (advisory). Το tributary takedown
   * (Slice 4) θα το παράγει αυτόματα από τον οργανισμό. ΠΟΤΕ derived — μόνο input.
   */
  readonly appliedLoad?: AppliedMemberLoad;
}

/** Πεδιλοδοκός / συνεχές πέδιλο (line-based, IfcFooting/STRIP_FOOTING). */
export interface StripFootingParams extends FoundationCommonParams {
  readonly kind: 'strip';
  /** Άξονας αρχή (mm world). */
  readonly start: Point3D;
  /** Άξονας τέλος (mm world). */
  readonly end: Point3D;
  /** mm. Πλάτος band κάθετα στον άξονα. */
  readonly width: number;
  /** Location Line ως προς τον άξονα (default 'center', ADR-441 Slice 5a). */
  readonly justification?: StripJustification;
  /**
   * ADR-441 Slice 5a-grid — `true` όταν ο μηχανικός όρισε χειροκίνητα το
   * `justification` (5a-control), ώστε η αυτόματη αναγέννηση εσχάρας (managed
   * reconcile) να ΜΗΝ το επαναφέρει στον κανόνα. Absent/false = auto (rule-driven).
   */
  readonly justificationManual?: boolean;
  /**
   * ADR-459 Phase 4b — οπλισμός πεδιλοδοκού (ανεστραμμένη δοκός: εγκάρσιες +
   * διαμήκεις διανομής + προαιρετικοί συνδετήρες). Optional/non-breaking.
   */
  readonly reinforcement?: StripReinforcement;
}

/**
 * Συνδετήρια δοκός (line-based, IfcFooting/FOOTING_BEAM). Εναέρια (clear of
 * ground) — ίδια geometry με strip, αλλά συνδέει πέδιλα/κεφαλόδεσμους.
 */
export interface TieBeamParams extends FoundationCommonParams {
  readonly kind: 'tie-beam';
  readonly start: Point3D;
  readonly end: Point3D;
  /** mm. Πλάτος διατομής κάθετα στον άξονα. */
  readonly width: number;
  /** Location Line ως προς τον άξονα (default 'center', ADR-441 Slice 5a). */
  readonly justification?: StripJustification;
  /** ADR-441 Slice 5a-grid — χειροκίνητη υπεροχή justification (βλ. StripFootingParams). */
  readonly justificationManual?: boolean;
  /**
   * ADR-459 Phase 4b — οπλισμός συνδετήριας δοκού. **REUSE** `BeamReinforcement`
   * (είναι δοκός) + discriminator. Optional/non-breaking.
   */
  readonly reinforcement?: TieBeamReinforcement;
}

/** Discriminated union ανά `kind`. */
export type FoundationParams =
  | PadFootingParams
  | StripFootingParams
  | TieBeamParams;

// ─── Geometry cache (derivable from params; SSoT = params) ───────────────────

/**
 * Computed foundation geometry. Returned by `computeFoundationGeometry(params)`
 * (Slice 1) — ΠΟΤΕ mutated by consumers. `area` σε m², `volume` σε m³,
 * `thickness` σε mm (BOQ-ready).
 */
export interface FoundationGeometry {
  /** Polygon3D — οριζόντιο ίχνος (closed CCW). */
  readonly footprint: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m². Εμβαδό ίχνους. */
  readonly area: number;
  /** m³. area × thickness / 1000. */
  readonly volume: number;
  /** mm. Mirror of `params.thicknessMm`. */
  readonly thickness: number;
}

// ─── Entity (BIM generic instantiation) ──────────────────────────────────────

/**
 * Foundation BIM entity. Extends `BimEntity` με `kind: FoundationKind` + IFC mixin.
 * `ifcType` = πάντα 'IfcFooting'· το `predefinedType` διαφοροποιεί ανά kind.
 */
export interface FoundationEntity
  extends BimEntity<FoundationKind, FoundationParams, FoundationGeometry>,
    IfcEntityMixin {
  readonly type: 'foundation';
  /** ADR-436 — IFC4 class. Always 'IfcFooting'. */
  readonly ifcType: 'IfcFooting';
  /** ADR-436 — IFC4 `IfcFootingTypeEnum` (από `FOUNDATION_IFC_MAP[kind]`). */
  readonly predefinedType: FoundationPredefinedType;
}

// ─── SSoT: kind → IFC predefined type ────────────────────────────────────────

/** SSoT IFC mapping (IFC export, Slice 4). Total over FoundationKind. */
export const FOUNDATION_IFC_MAP: Readonly<Record<FoundationKind, FoundationPredefinedType>> = {
  'pad': 'PAD_FOOTING',
  'strip': 'STRIP_FOOTING',
  'tie-beam': 'FOOTING_BEAM',
};

// ─── Defaults & constants ────────────────────────────────────────────────────

/** mm. Default στάθμη άνω παρειάς θεμελίωσης (κάτω από στάθμη, ADR-369). */
export const DEFAULT_FOUNDATION_TOP_ELEVATION_MM = -1000;

/**
 * mm. Default στάθμη άνω παρειάς **συνδετήριας δοκού**. Η συνδετήρια ΔΕΝ κάθεται στη
 * στάθμη θεμελίωσης μαζί με την πεδιλοδοκό (αλλιώς θάβεται μέσα της)· κατά Eurocode 8
 * §5.4.1.2 συνδέει τις κεφαλές των θεμελίων **ψηλότερα** — εδώ κάτω παρειά συνδετήριας
 * = άνω παρειά πεδιλοδοκού (−1000), βάθος 500 → άνω παρειά −500 → στοιβάζεται ΠΑΝΩ της.
 */
export const DEFAULT_TIE_BEAM_TOP_ELEVATION_MM = -500;

/** mm. Default διαστάσεις μεμονωμένου πεδίλου (1.5×1.5×0.5 m typical RC). */
export const DEFAULT_PAD_WIDTH_MM = 1500;
export const DEFAULT_PAD_LENGTH_MM = 1500;
export const DEFAULT_PAD_THICKNESS_MM = 500;

/** mm. Default πεδιλοδοκός (60cm πλάτος, 40cm βάθος). */
export const DEFAULT_STRIP_WIDTH_MM = 600;
export const DEFAULT_STRIP_THICKNESS_MM = 400;

/** mm. Default συνδετήρια δοκός (25×50cm RC tie beam, Eurocode 8 typical). */
export const DEFAULT_TIE_BEAM_WIDTH_MM = 250;
export const DEFAULT_TIE_BEAM_DEPTH_MM = 500;

/** mm. Ελάχιστη διάσταση/πάχος — validator threshold. */
export const MIN_FOUNDATION_DIMENSION_MM = 100;
export const MIN_FOUNDATION_THICKNESS_MM = 100;

/** Default rotation (μοίρες) + anchor. */
export const DEFAULT_FOUNDATION_ROTATION_DEG = 0;
export const DEFAULT_FOUNDATION_ANCHOR: FoundationAnchor = 'center';

/** Default Location Line γραμμικού πεδίλου/συνδετήριας (ADR-441 Slice 5a). */
export const DEFAULT_STRIP_JUSTIFICATION: StripJustification = 'center';

/**
 * SSoT πρόσημο της κάθετης μετατόπισης του centerline ανά justification, κατά
 * μήκος του CCW normal (αριστερά της φοράς start→end = +). Μοναδική πηγή φοράς —
 * το geometry διαβάζει από εδώ (ADR-441 Slice 5a). `center` → 0 (no shift).
 */
export const JUSTIFICATION_NORMAL_SIGN: Readonly<Record<StripJustification, number>> = {
  center: 0,
  left: 1,
  right: -1,
};

/**
 * Tab-cycle ring για το 9-position anchor (pad). Mirror του column
 * `ANCHOR_CYCLE_ORDER` — center πρώτο, μετά οι 4 πλευρές, μετά οι 4 γωνίες.
 */
export const FOUNDATION_ANCHOR_CYCLE_ORDER: readonly FoundationAnchor[] = [
  'center', 'n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw',
];

/**
 * Anchor → unit-fraction offset within the (width × length) bounding box,
 * BEFORE rotation. `dx`/`dy` ∈ {-0.5, 0, +0.5} (mirror κολώνας ANCHOR_OFFSETS).
 */
export const ANCHOR_OFFSETS: Readonly<Record<FoundationAnchor, { dx: number; dy: number }>> = {
  'center': { dx:  0,    dy:  0    },
  'n':      { dx:  0,    dy:  0.5  },
  's':      { dx:  0,    dy: -0.5  },
  'e':      { dx:  0.5,  dy:  0    },
  'w':      { dx: -0.5,  dy:  0    },
  'nw':     { dx: -0.5,  dy:  0.5  },
  'ne':     { dx:  0.5,  dy:  0.5  },
  'sw':     { dx: -0.5,  dy: -0.5  },
  'se':     { dx:  0.5,  dy: -0.5  },
};

// ─── Default params factory (pure — μηδέν enterprise-id) ──────────────────────

const ORIGIN: Point3D = { x: 0, y: 0, z: 0 };
const DEFAULT_AXIS_END: Point3D = { x: 1000, y: 0, z: 0 };

/**
 * SSoT default στάθμης άνω παρειάς ανά kind. Συνδετήρια → ψηλότερα ώστε να κάθεται
 * ΠΑΝΩ στην πεδιλοδοκό (Eurocode 8)· pad/strip → στάθμη θεμελίωσης.
 */
export function defaultFoundationTopElevationMm(kind: FoundationKind): number {
  return kind === 'tie-beam' ? DEFAULT_TIE_BEAM_TOP_ELEVATION_MM : DEFAULT_FOUNDATION_TOP_ELEVATION_MM;
}

/**
 * Pure default params ανά kind (mirror `buildDefaultColumnParams`). Δεν παράγει
 * enterprise-id — η οντότητα χτίζεται από το `createFoundationEntity` factory.
 */
export function buildDefaultFoundationParams(kind: FoundationKind): FoundationParams {
  const topElevationMm = defaultFoundationTopElevationMm(kind);
  switch (kind) {
    case 'pad':
      return {
        kind: 'pad',
        topElevationMm,
        thicknessMm: DEFAULT_PAD_THICKNESS_MM,
        position: ORIGIN,
        width: DEFAULT_PAD_WIDTH_MM,
        length: DEFAULT_PAD_LENGTH_MM,
        rotation: DEFAULT_FOUNDATION_ROTATION_DEG,
        anchor: DEFAULT_FOUNDATION_ANCHOR,
        profile: 'flat',
      };
    case 'strip':
      return {
        kind: 'strip',
        topElevationMm,
        thicknessMm: DEFAULT_STRIP_THICKNESS_MM,
        start: ORIGIN,
        end: DEFAULT_AXIS_END,
        width: DEFAULT_STRIP_WIDTH_MM,
      };
    case 'tie-beam':
      return {
        kind: 'tie-beam',
        topElevationMm,
        thicknessMm: DEFAULT_TIE_BEAM_DEPTH_MM,
        start: ORIGIN,
        end: DEFAULT_AXIS_END,
        width: DEFAULT_TIE_BEAM_WIDTH_MM,
      };
  }
}
