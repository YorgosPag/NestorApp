/**
 * ADR-449 — Structural Finish Skin (σοβάς κολόνας/δοκαριού): types + defaults.
 *
 * Πρόβλημα: τα στατικά δίνουν π.χ. κολόνα 50×50cm. Ο σοβάς προστίθεται περιμετρικά
 * αλλά ΔΕΝ πρέπει να αλλοιώνει τη στατική διάσταση (`width/depth`). Λύση (Revit/
 * big-player): στατικός πυρήνας = immutable SSoT· σοβάς = additive «δέρμα» (finish
 * skin) με δικό υλικό+πάχος, BOQ-tracked· η σοβατισμένη όψη (πυρήνας+2×σοβάς) είναι
 * **derived** (display only, ΠΟΤΕ stored).
 *
 * Δύο επίπεδα (mirror του ETICS hybrid DEFINITION/DATA, ADR-396):
 *   - `StructuralFinishSpec` = per-element ΠΡΟΘΕΣΗ (stored, optional): ποιο υλικό
 *     εσωτ./εξωτ. + πάχος. Absent = κανένας σοβάς (back-compat).
 *   - `StructuralFinishFaces` = DERIVED output του resolver (ποτέ stored): οι
 *     ΕΚΤΕΘΕΙΜΕΝΕΣ υπο-ακμές ανά παρειά (εξαιρώντας καλυμμένα από τοίχους) +
 *     ταξινόμηση interior/exterior + εμβαδά για BOQ.
 *
 * Per-face πραγματικότητα (Giorgio): κάθε παρειά μπορεί να είναι εσωτερική (Knauf),
 * εξωτερική (σοβάς/θερμοπρόσοψη) ή ΚΑΛΥΜΜΕΝΗ από τοίχο (καθόλου σοβάς) — και μάλιστα
 * ΜΕΡΙΚΩΣ (παρειά 50cm με τοίχους 25+25 → σοβατίζεται μόνο το εκτεθειμένο μεσαίο).
 * Γι' αυτό το `StructuralFinishFaces` παράγεται από ανάλυση γειτνίασης, ΟΧΙ σταθερό.
 *
 * Δεν επαναχρησιμοποιεί το `envelopeLayer` (ETICS): εκείνο είναι meters/zone/
 * exterior-only — τα δύο ΣΥΝΥΠΑΡΧΟΥΝ (εξωτ. όψη κολόνας = ETICS, εσωτ. = Knauf).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import type { Point2D } from '../../rendering/types/Types';

// ─── Canonical defaults (REUSE wall plaster catalog, ADR-447) ──────────────────
// Εσωτ. σοβάς (Knauf) = `mat-plaster-int` (ΑΤΟΕ OIK-4.01 m²)· εξωτ. = `mat-plaster-ext`
// (OIK-4.03 m²)· default πάχος 15mm (απόφαση Giorgio 2026-06-12).

/** Default υλικό εσωτερικών παρειών (Knauf) — ΑΤΟΕ OIK-4.01. */
export const STRUCTURAL_FINISH_INTERIOR_MATERIAL = 'mat-plaster-int';
/** Default υλικό εξωτερικών παρειών (σοβάς/θερμοπρόσοψη) — ΑΤΟΕ OIK-4.03. */
export const STRUCTURAL_FINISH_EXTERIOR_MATERIAL = 'mat-plaster-ext';
/** Default περιμετρικό πάχος σοβά σε mm (Giorgio 2026-06-12). */
export const STRUCTURAL_FINISH_DEFAULT_THICKNESS_MM = 15;

// ─── STORED: per-element πρόθεση σοβατίσματος ──────────────────────────────────

/**
 * Per-element πρόθεση finish skin (stored σε `ColumnParams.finish` /
 * `BeamParams.finish`). Optional — absent / `enabled:false` = κανένας σοβάς.
 *
 * Κρατά ΜΟΝΟ την παλέτα (ποιο υλικό εσωτ./εξωτ. + πάχος). Το ΠΟΙΕΣ παρειές /
 * ΠΟΣΟ εκτεθειμένες είναι DERIVED (resolver) — δεν αποθηκεύεται.
 */
export interface StructuralFinishSpec {
  /** Master on/off. */
  readonly enabled: boolean;
  /** Υλικό εσωτερικών παρειών (default `mat-plaster-int`). */
  readonly interiorMaterialId: string;
  /** Υλικό εξωτερικών παρειών (default `mat-plaster-ext`). */
  readonly exteriorMaterialId: string;
  /** mm. Περιμετρικό πάχος σοβά (default 15). ΠΟΤΕ δεν μπαίνει στο `width/depth`. */
  readonly thickness: number;
}

// ─── DERIVED: resolver output (ποτέ stored) ────────────────────────────────────

export type FinishClassification = 'interior' | 'exterior';

/**
 * Μία εκτεθειμένη υπο-ακμή μιας παρειάς (μετά την αφαίρεση των καλυμμένων από
 * τοίχους κομματιών). Συντεταγμένες σε **plan space** (ίδιες μονάδες με το
 * footprint του στοιχείου — canvas units).
 */
export interface FinishFaceSegment {
  readonly a: Point2D;
  readonly b: Point2D;
  readonly classification: FinishClassification;
  /** Resolved υλικό (interior→interiorMaterialId, exterior→exteriorMaterialId). */
  readonly materialId: string;
  /** mm — πάχος σοβά (από το spec). */
  readonly thickness: number;
  /** m — μήκος της εκτεθειμένης υπο-ακμής στο plan. */
  readonly lengthM: number;
  /**
   * ADR-449 Slice 10 — το άκρο `a` είναι **junction** (butt-join): ακουμπά γειτονικό
   * δομικό στοιχείο (obstacle) → ο σοβάς πρέπει να κλείνει **τετράγωνα** (corner-fill,
   * συνεχής γραμμή), ΟΧΙ 45° chamfer (που αφήνει τριγωνικό κενό στις flush συμβολές
   * «από κάναβο» — ADR-441). `undefined`/`false` = γνήσιο ελεύθερο άκρο → chamfer.
   */
  readonly aJunction?: boolean;
  /** ADR-449 Slice 10 — το άκρο `b` είναι junction (βλ. {@link aJunction}). */
  readonly bJunction?: boolean;
}

/**
 * DERIVED σύνολο finish faces ενός στοιχείου. `interiorAreaM2`/`exteriorAreaM2` =
 * Σ(lengthM) × heightM ανά ταξινόμηση → τροφοδοτεί το BOQ (ξεχωριστές γραμμές).
 */
export interface StructuralFinishFaces {
  readonly segments: readonly FinishFaceSegment[];
  /** m — ύψος επιφάνειας σοβά (κολόνα: ύψος· δοκάρι: structural depth). */
  readonly heightM: number;
  /** m² — συνολικό εμβαδό εσωτερικού σοβά (Knauf). */
  readonly interiorAreaM2: number;
  /** m² — συνολικό εμβαδό εξωτερικού σοβά. */
  readonly exteriorAreaM2: number;
}

// ─── Guards ─────────────────────────────────────────────────────────────────────

/** True όταν το spec υπάρχει ΚΑΙ είναι ενεργό ΚΑΙ έχει θετικό πάχος. */
export function isFinishActive(spec: StructuralFinishSpec | undefined): spec is StructuralFinishSpec {
  return !!spec && spec.enabled && spec.thickness > 0;
}

// ─── Factory (Slice 5) ────────────────────────────────────────────────────────

/**
 * ADR-449 Slice 5 — default finish spec για νέα δομικά στοιχεία (κολόνα/δοκάρι).
 * ΕΝΑ factory — το καλούν ΚΑΙ ο column ΚΑΙ ο beam factory. `enabled:true` πάντα:
 * η ορατότητα ελέγχεται view-level από το master toggle «Σοβατισμένη όψη»
 * (`showFinishSkin`), όχι από το data model (Revit visibility-only semantics).
 */
export function createDefaultStructuralFinishSpec(): StructuralFinishSpec {
  return {
    enabled: true,
    interiorMaterialId: STRUCTURAL_FINISH_INTERIOR_MATERIAL,
    exteriorMaterialId: STRUCTURAL_FINISH_EXTERIOR_MATERIAL,
    thickness: STRUCTURAL_FINISH_DEFAULT_THICKNESS_MM,
  };
}

// ─── Per-element override core (Slice 5, entity & UI agnostic) ──────────────────

/** Επεξεργάσιμα πεδία του spec μέσω του per-element override UI (Properties/ribbon). */
export type FinishParamField = 'enabled' | 'interiorMaterialId' | 'exteriorMaterialId' | 'thickness';

/** Spec ή default όταν απών (ώστε το override UI σε παλιό στοιχείο να δείχνει τιμές). */
function effectiveFinishSpec(spec: StructuralFinishSpec | undefined): StructuralFinishSpec {
  return spec ?? createDefaultStructuralFinishSpec();
}

/** Τρέχουσα τιμή ενός finish πεδίου ως string (για combobox state). */
export function readFinishParamValue(spec: StructuralFinishSpec | undefined, field: FinishParamField): string {
  const s = effectiveFinishSpec(spec);
  switch (field) {
    case 'enabled': return s.enabled ? 'on' : 'off';
    case 'interiorMaterialId': return s.interiorMaterialId;
    case 'exteriorMaterialId': return s.exteriorMaterialId;
    case 'thickness': return String(Math.round(s.thickness));
  }
}

/**
 * Εφαρμόζει νέα τιμή σε ένα finish πεδίο, επιστρέφοντας ΝΕΟ spec. `null` όταν η τιμή
 * είναι άκυρη (no-op) — π.χ. κενό υλικό ή μη-θετικό πάχος.
 */
export function applyFinishParam(
  spec: StructuralFinishSpec | undefined,
  field: FinishParamField,
  value: string,
): StructuralFinishSpec | null {
  const base = effectiveFinishSpec(spec);
  switch (field) {
    case 'enabled':
      return { ...base, enabled: value === 'on' };
    case 'interiorMaterialId':
      return value ? { ...base, interiorMaterialId: value } : null;
    case 'exteriorMaterialId':
      return value ? { ...base, exteriorMaterialId: value } : null;
    case 'thickness': {
      const n = Number.parseFloat(value);
      return Number.isFinite(n) && n > 0 ? { ...base, thickness: n } : null;
    }
  }
}
