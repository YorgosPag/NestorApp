/**
 * ADR-396 Phase P1 — Thermal Envelope (ETICS) Foundations: types + constants.
 *
 * Single Source of Truth για το data model της ενιαίας εξωτερικής
 * θερμοπρόσοψης (ETICS). Phase P1 = foundations μόνο (types + config +
 * advisory thresholds) — ΚΑΜΙΑ γεωμετρία / render / persistence εδώ
 * (έρχονται P2-P7, βλ. ADR-396 §7 Roadmap).
 *
 * Υβριδικό μοντέλο (ADR-396 D1):
 *   - DEFINITION: ένα `ThermalEnvelopeSpec` ανά όροφο (material + πάχος + ζώνες).
 *   - DATA: per-element `EnvelopeLayer` (industry-standard, σωστές προμετρήσεις).
 *   - DISPLAY: ενιαίο συνεχές κέλυφος (P4/P5).
 *
 * Οι 4 ζώνες (ADR-396 §2.1):
 *   Z1 κατακόρυφη όψη · Z2 οροφή πιλοτής (soffit) · Z3 δώμα (top) ·
 *   Z4 περβάζια κουφωμάτων (reveal strips).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md
 * @see src/subapps/dxf-viewer/bim/walls/wall-material-catalog.ts (materialId presets)
 * @see src/subapps/dxf-viewer/bim/config/material-to-atoe-mapping.ts (ΑΤΟΕ BOQ)
 */

import type {
  WallMaterialPresetId,
  WallMaterialCustomId,
} from '../walls/wall-material-catalog';

// ============================================================================
// ZONES
// ============================================================================

/** Οι 4 ζώνες μόνωσης του κελύφους (ADR-396 §2.1). */
export type EnvelopeZoneId = 'Z1' | 'Z2' | 'Z3' | 'Z4';

/** On/off toggles ανά ζώνη — μέρος του per-floor spec (ADR-396 D6). */
export interface EnvelopeZoneToggles {
  /** Z1 — κατακόρυφη εξωτ. όψη τοίχων/κολωνών/δοκαριών. */
  readonly Z1: boolean;
  /** Z2 — οροφή πιλοτής (κάτω παρειά εκτεθειμένης πλάκας). */
  readonly Z2: boolean;
  /** Z3 — δώμα (επάνω παρειά πλάκας τελευταίου ορόφου). */
  readonly Z3: boolean;
  /** Z4 — περβάζια κουφωμάτων (4 λωρίδες ανά εξωτερικό άνοιγμα). */
  readonly Z4: boolean;
}

// ============================================================================
// DATA MODEL
// ============================================================================

/**
 * Material id για στρώση κελύφους. Presets από wall-material-catalog ή
 * free-form string (custom, βλ. `classifyWallMaterial`). Τα presets που
 * έχουν νόημα για ETICS είναι `mat-eps-graphite` (Neopor) + `mat-xps`.
 */
export type EnvelopeMaterialId =
  | WallMaterialPresetId
  | WallMaterialCustomId
  | string;

/**
 * ADR-396 v2 Φάση 4 — Χειροκίνητη παράκαμψη (Revit Wall-Function-style) της
 * αυτόματης ταξινόμησης ορίων του `footprint-region-classifier` (Στρ.3, §3.1.2).
 * Per-element· προσαρτάται σε wall/column/beam (στοιχεία που σχηματίζουν το
 * πλευρικό footprint / ζώνη Z1). ΟΧΙ σε slab/opening (Z2/Z3 = άξονας υψομέτρου,
 * Z4 = ακολουθεί host wall — διαφορετικός άξονας).
 *
 * `undefined` = **auto** (χρησιμοποίησε την αυτόματη γεωμετρική ταξινόμηση).
 * Ρητή τιμή = override που υπερισχύει της auto απόφασης:
 *   - `'exterior'` → να μονωθεί η εξωτ. όψη (μέρος του κελύφους), ακόμη κι αν η
 *     γεωμετρία το έβγαζε εσωτερικό.
 *   - `'interior'` → να ΜΗΝ μονωθεί, ακόμη κι αν η γεωμετρία το έβγαζε εξωτερικό
 *     (π.χ. τοίχος προς εσωτερικό αίθριο).
 *
 * Αποσυνδεδεμένο από το δομικό `WallParams.category` (που έχει 5 τιμές
 * exterior/interior/partition/parapet/fence): το `category` είναι ο **δομικός**
 * ρόλος· το `envelopeFunction` είναι η **θερμική** παράκαμψη ETICS. Καθαρό SSoT,
 * ένα ομοιόμορφο πεδίο και στα τρία στοιχεία (κολώνες/δοκάρια δεν έχουν category).
 *
 * Data model μόνο (Φάση 4)· ο applicator το καταναλώνει στη Φάση 5, UI panel Φάση 6.
 */
export type EnvelopeFunction = 'exterior' | 'interior';

// ============================================================================
// ENVELOPE FUNCTION OVERRIDE — UI tri-state SSoT (v2 Φ6a ribbon + Φ6b region panel)
// ============================================================================

/**
 * Tri-state dropdown sentinel για «αυτόματη ταξινόμηση» (= πεδίο `envelopeFunction`
 * **απών**). Το UI (ribbon combobox Φ6a + region panel Φ6b) χρειάζεται μια ρητή τιμή
 * για το «auto», αλλά το `.strict()` Zod enum ΔΕΝ δέχεται literal `'auto'` →
 * το `parseEnvelopeFunctionValue('auto')` πάντα επιστρέφει `{ fn: undefined }` (clear).
 *
 * Ζει ΕΔΩ (neutral types SSoT, όχι σε ribbon code) ώστε ribbon ΚΑΙ
 * `ThermalEnvelopeDialog` region panel να μοιράζονται ΕΝΑ ορισμό χωρίς το dialog να
 * εξαρτάται από ribbon-bridge κώδικα (N.0.2/N.12, Φ6b).
 */
export const ENVELOPE_FUNCTION_AUTO = 'auto' as const;

/** Μία επιλογή του tri-state dropdown (κοινή σε ribbon combobox + region panel). */
export interface EnvelopeFunctionOption {
  readonly value: typeof ENVELOPE_FUNCTION_AUTO | EnvelopeFunction;
  /** i18n key στο `dxf-viewer-shell` namespace (N.11, ΟΧΙ defaultValue). */
  readonly labelKey: string;
  /** Πάντα `false` — οι ετικέτες είναι i18n keys, όχι literal strings. */
  readonly isLiteralLabel: false;
}

/**
 * Επιλογές tri-state override (auto/exterior/interior). Κοινό SSoT για τα 3
 * contextual ribbon tabs (Φ6a) ΚΑΙ το per-region panel του dialog (Φ6b).
 */
export const ENVELOPE_FUNCTION_OPTIONS: readonly EnvelopeFunctionOption[] = [
  { value: ENVELOPE_FUNCTION_AUTO, labelKey: 'ribbon.commands.envelopeFunction.auto', isLiteralLabel: false },
  { value: 'exterior', labelKey: 'ribbon.commands.envelopeFunction.exterior', isLiteralLabel: false },
  { value: 'interior', labelKey: 'ribbon.commands.envelopeFunction.interior', isLiteralLabel: false },
] as const;

/** Τρέχουσα τιμή πεδίου → dropdown value (`undefined` = auto → sentinel). */
export function readEnvelopeFunctionValue(fn: EnvelopeFunction | undefined): string {
  return fn ?? ENVELOPE_FUNCTION_AUTO;
}

/**
 * Dropdown value → επιθυμητή τιμή πεδίου. Επιστρέφει `{ fn }` σε έγκυρη τιμή
 * (`fn === undefined` σημαίνει «καθάρισε», δηλ. auto), ή `null` σε άκυρη τιμή
 * (ο caller κάνει no-op). Ποτέ δεν επιστρέφει το literal `'auto'`.
 */
export function parseEnvelopeFunctionValue(
  value: string,
): { readonly fn: EnvelopeFunction | undefined } | null {
  if (value === ENVELOPE_FUNCTION_AUTO) return { fn: undefined };
  if (value === 'exterior' || value === 'interior') return { fn: value };
  return null;
}

/**
 * Per-element εξωτερική στρώση μόνωσης (industry-standard, ADR-396 §3 DATA).
 * Προσαρτάται σε column/beam/slab/opening στη Φάση P2.
 */
export interface EnvelopeLayer {
  readonly materialId: EnvelopeMaterialId;
  /** Πάχος στρώσης σε ΜΕΤΡΑ (SSoT unit — όχι mm). */
  readonly thickness_m: number;
  /** Σε ποια ζώνη ανήκει η στρώση (καθορίζει advisory min + BOQ grouping). */
  readonly zone: EnvelopeZoneId;
}

/**
 * Per-floor ορισμός θερμοπρόσοψης (ADR-396 §3 DEFINITION). Ο χρήστης το
 * ορίζει ΜΙΑ φορά· το command «Εφαρμογή Θερμοπρόσοψης» (P6) παράγει τα
 * per-element `EnvelopeLayer`.
 */
export interface ThermalEnvelopeSpec {
  /** Υλικό κελύφους (default `mat-eps-graphite`). */
  readonly materialId: EnvelopeMaterialId;
  /** Πάχος Z1/Z2/Z3 σε ΜΕΤΡΑ (default 0.10). */
  readonly thickness_m: number;
  /** Πάχος περβαζιών Z4 σε ΜΕΤΡΑ (default 0.05, χωριστό από Z1). */
  readonly revealThickness_m: number;
  /** Ποιες ζώνες είναι ενεργές. */
  readonly zones: EnvelopeZoneToggles;
}

// ============================================================================
// CONSTANTS / CONFIG
// ============================================================================

/**
 * Canonical material id για γραφιτούχα EPS (Neopor) — το default preset του
 * ETICS κελύφους. Πρέπει να ταυτίζεται με wall-material-catalog +
 * material-to-atoe-mapping (OIK-10.05).
 */
export const GRAPHITE_EPS_MATERIAL_ID = 'mat-eps-graphite' as const;

/**
 * Default πάχη (ΜΕΤΡΑ) — ADR-396 §5.
 */
export const DEFAULT_ENVELOPE_THICKNESS_M = 0.1 as const; // Z1/Z2/Z3
export const DEFAULT_REVEAL_THICKNESS_M = 0.05 as const; // Z4

/**
 * ΚΕΝΑΚ advisory ελάχιστα πάχη σε ΜΕΤΡΑ (OQ-1 RESOLVED 2026-05-29).
 *
 * ⚠️ ADVISORY ΜΟΝΟ — ΔΕΝ μπλοκάρει (ADR-396 D6). Ο ΚΕΝΑΚ ορίζει συντελεστή
 * θερμοπερατότητας U, όχι σταθερό πάχος· αυτές είναι πρακτικές κατώφλιες
 * τιμές για γραφιτούχα EPS που, αν παραβιαστούν, δίνουν soft warning.
 *
 * - `facade` (Z1/Z2/Z3): 7εκ — κανονικές επιφάνειες.
 * - `reveal` (Z4): 2εκ — μικρές επιφάνειες (εσωτ. περιγράμματα ανοιγμάτων).
 */
export const KENAK_MIN_THICKNESS_M = {
  facade: 0.07,
  reveal: 0.02,
} as const;

/**
 * Επιλογές υλικού για το ETICS κέλυφος (Φάση P6 picker SSoT). ΜΟΝΟ τα δύο
 * προϊόντα εξωτερικής μόνωσης (§2.2): γραφιτούχα EPS (Neopor) + εξηλασμένη XPS.
 * Πετροβάμβακας/υαλοβάμβακας = εσωτερική μόνωση (Wall DNA), ΕΚΤΟΣ scope.
 *
 * `labelKey` = i18n key στο `dxf-viewer-shell` namespace (N.11, ΟΧΙ defaultValue).
 */
export interface EnvelopeMaterialOption {
  readonly id: EnvelopeMaterialId;
  readonly labelKey: string;
}

export const ENVELOPE_MATERIAL_OPTIONS: readonly EnvelopeMaterialOption[] = [
  { id: GRAPHITE_EPS_MATERIAL_ID, labelKey: 'ribbon.commands.thermalEnvelope.materials.graphiteEps' },
  { id: 'mat-xps', labelKey: 'ribbon.commands.thermalEnvelope.materials.xps' },
] as const;

/** Ελάχιστο επιτρεπτό πάχος (ΜΕΤΡΑ) — D6: «πάχος ελεύθερο ≥5εκ». */
export const MIN_ENVELOPE_THICKNESS_M = 0.05 as const;

/**
 * ADR-396 P7 Part B — ανοχή (ΜΕΤΡΑ) εντός της οποίας μια κολώνα/δοκάρι θεωρείται
 * «εξωτερική» (ζώνη Z1) και τυλίγεται με μόνωση. Κριτήριο: η αντιπροσωπευτική της
 * θέση (κέντρο footprint κολώνας / μέσο άξονα δοκαριού) απέχει ≤ αυτής της τιμής
 * από τη γραμμή της εξωτερικής όψης των τοίχων (μέσα ή έξω). Απόφαση Giorgio
 * (2026-05-29): ~20εκ, **configurable** — όχι hardcoded κατώφλι στον applicator.
 */
export const EXTERIOR_PROXIMITY_M = 0.2 as const;

/**
 * ADR-396 (gating) — ανοχή (ΜΕΤΡΑ) εντός της οποίας μια ΚΟΛΩΝΑ θεωρείται ότι
 * «γεφυρώνει» ένα ελεύθερο άκρο τοίχου, κλείνοντας το περίγραμμα. Ένα ελεύθερο
 * (valence-1) άκρο τοίχου που απέχει ≤ αυτής της τιμής από το footprint μιας
 * κολώνας (ή βρίσκεται μέσα του) προσδένεται σε αυτήν ως κόμβος-γέφυρα: δύο
 * τέτοια άκρα στην ίδια κολώνα κλείνουν το κενό (Επιλογή Α — η μόνωση τυλίγει
 * τις εξωτ. όψεις της κολώνας). Απόφαση Giorgio (2026-05-30): 0.30 m,
 * **configurable** — όχι hardcoded κατώφλι στη γεωμετρία.
 */
export const COLUMN_BRIDGE_TOL_M = 0.3 as const;

/**
 * ADR-396 v2 Phase 3 — κατώφλι κάλυψης (0..1) για τον διαχωρισμό **αίθριου** από
 * **κλειστό δωμάτιο** σε μια τρύπα του περιγράμματος κτιρίου (§3.1.2). Μια τρύπα
 * θεωρείται κλειστό δωμάτιο (καμία μόνωση) όταν το εμβαδόν της που σκεπάζεται από
 * πλάκα οποιουδήποτε ψηλότερου ορόφου είναι ≥ αυτού του ποσοστού· αλλιώς είναι
 * αίθριο (ανοιχτό στον ουρανό → μόνωση γύρω). Απόφαση Giorgio (2026-05-30): 50%,
 * **configurable** — όχι hardcoded κατώφλι στον classifier.
 */
export const ATRIUM_COVERAGE_THRESHOLD = 0.5 as const;

// ============================================================================
// ADVISORY HELPERS (pure, SSoT για threshold logic)
// ============================================================================

/**
 * UI conversion (P6): πάχος mm (input) → ΜΕΤΡΑ (spec SSoT), με κατώφλι D6 (≥5εκ).
 * Μη-πεπερασμένο input → επιστρέφει το `fallback_m` (κρατά την παλιά τιμή).
 */
export function mmToClampedMeters(raw: string | number, fallback_m: number): number {
  // Κενό/whitespace string (ο χρήστης καθαρίζει το input mid-edit) → κρατά την
  // παλιά τιμή· `Number('')` είναι 0, οπότε χρειάζεται ρητός έλεγχος.
  if (typeof raw === 'string' && raw.trim() === '') return fallback_m;
  const mm = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(mm)) return fallback_m;
  return Math.max(MIN_ENVELOPE_THICKNESS_M, mm / 1000);
}

/** ΜΕΤΡΑ → mm ακέραιο (για το number input). */
export function metersToMm(m: number): number {
  return Math.round(m * 1000);
}

/** Επιστρέφει το advisory ελάχιστο πάχος (ΜΕΤΡΑ) για μια ζώνη. */
export function getEnvelopeMinThickness(zone: EnvelopeZoneId): number {
  return zone === 'Z4' ? KENAK_MIN_THICKNESS_M.reveal : KENAK_MIN_THICKNESS_M.facade;
}

/**
 * True όταν το πάχος είναι κάτω από το ΚΕΝΑΚ advisory όριο της ζώνης
 * (→ soft warning, ΟΧΙ block).
 */
export function isBelowKenakAdvisory(thickness_m: number, zone: EnvelopeZoneId): boolean {
  return thickness_m < getEnvelopeMinThickness(zone);
}
