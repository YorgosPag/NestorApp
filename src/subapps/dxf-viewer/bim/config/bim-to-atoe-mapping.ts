/**
 * BIM → ΑΤΟΕ Mapping Config (ADR-363 Phase 6)
 *
 * Resolves BIM entity type + kind/category → ΑΤΟΕ category code + BOQ unit.
 * Single Source of Truth for BIM-to-BOQ auto-feed category assignment.
 * Phase 6.2 will derive mappings from material library (bim_materials.atoeCode).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6
 * @see docs/centralized-systems/reference/adrs/ADR-175-quantity-surveying-measurements-system.md
 */

import type { BOQMeasurementUnit } from '@/types/boq';
import type { WallCategory } from '../types/wall-types';
import type { OpeningKind } from '../types/opening-types';
import type { SlabKind } from '../types/slab-types';
import type { ColumnKind } from '../types/column-types';
import type { BeamKind } from '../types/beam-types';
import type { FoundationKind } from '../types/foundation-types';
import type { RailingKind } from '../types/railing-types';
import type { FurnitureKind } from '../types/furniture-types';
import type { RoofKind } from '../types/roof-types';
import type { MepRadiatorKind } from '../types/mep-radiator-types';
import type { MepBoilerKind } from '../types/mep-boiler-types';
import type { MepWaterHeaterKind } from '../types/mep-water-heater-types';
import type { MepManifoldKind } from '../types/mep-manifold-types';
import type { MepUnderfloorKind } from '../types/mep-underfloor-types';
import type { PlumbingSystemClassification } from '../types/mep-connector-types';
import type { OpeningHardwareComponent } from '../family-types/opening-hardware-set';
import { isImportedMeshBoqUnit } from '../entities/imported-mesh/imported-mesh-types';

// ============================================================================
// TYPES
// ============================================================================

export type BimEntityType =
  | 'wall' | 'opening' | 'slab' | 'column' | 'beam' | 'stair' | 'railing' | 'furniture' | 'roof'
  // ADR-408 — Η-Μ (Ηλεκτρομηχανολογικά) entities feeding the BOQ.
  | 'mep-radiator' | 'mep-boiler' | 'mep-water-heater' | 'mep-segment' | 'mep-underfloor' | 'mep-manifold'
  // ADR-683 Φ3.1 — εισαγόμενο ψημένο πλέγμα συνεργάτη. Ο ΜΟΝΟΣ τύπος του οποίου η αντιστοίχιση
  // δεν είναι πίνακας: το «τι είναι» το δηλώνει ο χρήστης μία φορά (§10.2), γιατί δεν υπάρχει
  // στη γεωμετρία. Λύνεται από το `resolveImportedMeshMapping`, ποτέ από `kind`.
  | 'imported-mesh';

export interface AtoeMappingEntry {
  /**
   * ΑΤΟΕ/ΑΤΗΕ article code — `OIK-x.xx` (Οικοδομικά / structural) or `ΗΛΜ-x.xx`
   * (Ηλεκτρομηχανολογικά / MEP, ADR-408). Must match `boq_categories` or be a
   * valid subcategory.
   */
  readonly categoryCode: string;
  readonly unit: BOQMeasurementUnit;
  /** Greek title stored in the auto-generated BOQ item. */
  readonly titleEL: string;
}

/**
 * ADR-395 Phase 2 (G1) — a stair is NOT a single-row entity like walls/slabs.
 * It produces THREE independent BOQ rows (Revit Material Takeoff pattern):
 * concrete (m³) + tread cladding (m²) + handrail (m). Each row is keyed by a
 * fixed component (not the stair `kind`), so it lives outside the
 * kind-dispatched `BIM_TO_ATOE_MAPPING` table and is resolved via
 * `resolveStairComponentMapping`.
 */
export type StairBoqComponent = 'concrete' | 'cladding' | 'handrail';

/**
 * ADR-674 Φ C — an opening is ALSO not a single-row entity for the priced BOQ:
 * beyond its one κούφωμα row (OIK-5.01/5.02) it emits N additive «σιδερικά»
 * (hardware) rows, one per purchasable component (χειρολαβή/κλειδαριά/μεντεσές…),
 * so the contractor gets each piece as a costable line — exactly the stair
 * concrete/cladding/handrail multi-row pattern. Keyed by the Phase A hardware
 * component union (NOT the opening `kind`), so it lives outside the
 * kind-dispatched `OPENING_MAPPING` table and is resolved via
 * {@link resolveOpeningHardwareMapping}. Re-exports Phase A's union — one SSoT
 * for the component set (`opening-hardware-set.ts`), never duplicated here.
 *
 * @see ../family-types/opening-hardware-set.ts — the hardware take-off SSoT (Phase A)
 */
export type OpeningHardwareBoqComponent = OpeningHardwareComponent;

// ============================================================================
// MAPPING TABLE
// ============================================================================

const WALL_MAPPING: Readonly<Record<WallCategory, AtoeMappingEntry>> = {
  exterior:  { categoryCode: 'OIK-3.05', unit: 'm2', titleEL: 'Τοιχοποιία εξωτερική (BIM)' },
  interior:  { categoryCode: 'OIK-3.06', unit: 'm2', titleEL: 'Τοιχοποιία εσωτερική (BIM)' },
  partition: { categoryCode: 'OIK-3.06', unit: 'm2', titleEL: 'Τοιχοποιία διαχωριστική (BIM)' },
  parapet:   { categoryCode: 'OIK-3.05', unit: 'm2', titleEL: 'Στηθαίο τοιχοποιία (BIM)' },
  fence:     { categoryCode: 'OIK-3.05', unit: 'm2', titleEL: 'Τοιχοποιία περίφραξης (BIM)' },
};

const OPENING_MAPPING: Readonly<Record<OpeningKind, AtoeMappingEntry>> = {
  // ─── Doors → OIK-5.01 ─────────────────────────────────────────────────────
  'door':                { categoryCode: 'OIK-5.01', unit: 'pcs', titleEL: 'Κούφωμα πόρτας (BIM)' },
  'double-door':         { categoryCode: 'OIK-5.01', unit: 'pcs', titleEL: 'Κούφωμα δίφυλλης πόρτας (BIM)' },
  'sliding-door':        { categoryCode: 'OIK-5.01', unit: 'pcs', titleEL: 'Κούφωμα συρόμενης πόρτας (BIM)' },
  'double-sliding-door': { categoryCode: 'OIK-5.01', unit: 'pcs', titleEL: 'Κούφωμα συρόμενης δίφυλλης πόρτας (BIM)' },
  'pocket-door':         { categoryCode: 'OIK-5.01', unit: 'pcs', titleEL: 'Κούφωμα χωνευτής πόρτας (BIM)' },
  'bifold-door':         { categoryCode: 'OIK-5.01', unit: 'pcs', titleEL: 'Κούφωμα πτυσσόμενης πόρτας (BIM)' },
  'overhead-door':       { categoryCode: 'OIK-5.01', unit: 'pcs', titleEL: 'Κούφωμα γκαραζόπορτας (BIM)' },
  'revolving-door':      { categoryCode: 'OIK-5.01', unit: 'pcs', titleEL: 'Κούφωμα περιστρεφόμενης πόρτας (BIM)' },
  'french-door':         { categoryCode: 'OIK-5.01', unit: 'pcs', titleEL: 'Κούφωμα γαλλικής πόρτας (BIM)' },
  // ─── Windows → OIK-5.02 ───────────────────────────────────────────────────
  'window':              { categoryCode: 'OIK-5.02', unit: 'pcs', titleEL: 'Κούφωμα παραθύρου (BIM)' },
  'fixed':               { categoryCode: 'OIK-5.02', unit: 'pcs', titleEL: 'Κούφωμα σταθερό (BIM)' },
  'double-hung-window':  { categoryCode: 'OIK-5.02', unit: 'pcs', titleEL: 'Κούφωμα κατακόρυφα συρόμενο (BIM)' },
  'sliding-window':      { categoryCode: 'OIK-5.02', unit: 'pcs', titleEL: 'Κούφωμα οριζόντια συρόμενο (BIM)' },
  'awning-window':       { categoryCode: 'OIK-5.02', unit: 'pcs', titleEL: 'Κούφωμα ανακλινόμενο πάνω (BIM)' },
  'hopper-window':       { categoryCode: 'OIK-5.02', unit: 'pcs', titleEL: 'Κούφωμα ανακλινόμενο κάτω (BIM)' },
  'tilt-turn-window':    { categoryCode: 'OIK-5.02', unit: 'pcs', titleEL: 'Κούφωμα ανοιγο-ανακλινόμενο (BIM)' },
  'bay-window':          { categoryCode: 'OIK-5.02', unit: 'pcs', titleEL: 'Κούφωμα προεξέχον (BIM)' },
};

const SLAB_MAPPING: Readonly<Record<SlabKind, AtoeMappingEntry>> = {
  floor:      { categoryCode: 'OIK-2.01', unit: 'm3', titleEL: 'Πλάκα ορόφου RC (BIM)' },
  ceiling:    { categoryCode: 'OIK-2.01', unit: 'm3', titleEL: 'Πλάκα οροφής RC (BIM)' },
  roof:       { categoryCode: 'OIK-2.01', unit: 'm3', titleEL: 'Πλάκα στέγης RC (BIM)' },
  ground:     { categoryCode: 'OIK-2.01', unit: 'm3', titleEL: 'Πλάκα ισογείου RC (BIM)' },
  foundation: { categoryCode: 'OIK-2.02', unit: 'm3', titleEL: 'Πλάκα θεμελίωσης (BIM)' },
};

const COLUMN_MAPPING: Readonly<Record<ColumnKind, AtoeMappingEntry>> = {
  'rectangular': { categoryCode: 'OIK-2.03', unit: 'm3', titleEL: 'Κολώνα RC ορθογωνική (BIM)' },
  'circular':    { categoryCode: 'OIK-2.03', unit: 'm3', titleEL: 'Κολώνα RC κυκλική (BIM)' },
  'L-shape':     { categoryCode: 'OIK-2.03', unit: 'm3', titleEL: 'Κολώνα RC Γ-τομής (BIM)' },
  'T-shape':     { categoryCode: 'OIK-2.03', unit: 'm3', titleEL: 'Κολώνα RC Τ-τομής (BIM)' },
  'polygon':     { categoryCode: 'OIK-2.03', unit: 'm3', titleEL: 'Κολώνα RC πολυγωνική (BIM)' },
  'shear-wall':  { categoryCode: 'OIK-2.03', unit: 'm3', titleEL: 'Τοιχείο RC (BIM)' },
  'I-shape':     { categoryCode: 'OIK-12.10', unit: 'kg', titleEL: 'Κολώνα μεταλλική Ι-τομής (BIM)' },
  // ADR-363 Phase 2 «από περίγραμμα» — σύνθετα τοιχία ΟΣ (RC, m³ — όπως shear-wall).
  'U-shape':     { categoryCode: 'OIK-2.03', unit: 'm3', titleEL: 'Τοιχείο RC Π-τομής (BIM)' },
  'composite':   { categoryCode: 'OIK-2.03', unit: 'm3', titleEL: 'Τοιχείο RC σύνθετης τομής (BIM)' },
};

/**
 * ADR-395 Phase 2 (G1) — stair component → ΑΤΟΕ. Three fixed rows per stair:
 *   - concrete  → OIK-2 Σκυροδέματα (next after slab/column/beam 2.01-2.04)
 *   - cladding  → OIK-5 Πατώματα/Δάπεδα (tread surface, marble/tile)
 *   - handrail  → OIK-12 Μεταλλικά (master catalog explicitly lists «κάγκελα, σκάλες»)
 */
const STAIR_COMPONENT_MAPPING: Readonly<Record<StairBoqComponent, AtoeMappingEntry>> = {
  concrete: { categoryCode: 'OIK-2.05',  unit: 'm3', titleEL: 'Σκάλα σκυρόδεμα (BIM)' },
  cladding: { categoryCode: 'OIK-5.05',  unit: 'm2', titleEL: 'Σκάλα επένδυση πατημάτων (BIM)' },
  handrail: { categoryCode: 'OIK-12.01', unit: 'm',  titleEL: 'Σκάλα κουπαστή (BIM)' },
};

/**
 * ⚠️ PLACEHOLDER OIK ARTICLE CODES (ADR-674 Φ C — opening «σιδερικά» BOQ auto-feed).
 *
 * Every purchasable opening-hardware component maps to an OIK-5.3x «κιγκαλερία
 * κουφωμάτων» article, counted per piece (`pcs`, qty = the component's own
 * count — 3 μεντεσέδες, 1 κλειδαριά…). The `OIK-5.31…5.39` numbers below are
 * PLACEHOLDERS following the OIK-5 opening group so the priced take-off is
 * complete TODAY (Revit Door/Window Hardware Schedule → 5D cost parity).
 * Replace each `categoryCode` with the project's real ΑΤΟΕ κιγκαλερίας article
 * number in THIS one file when the priced master is available — nothing else
 * changes.
 *
 * EXHAUSTIVE over {@link OpeningHardwareComponent} (compile-time total) — a new
 * component cannot enter the Phase A union without declaring its OIK article here.
 */
const OPENING_HARDWARE_MAPPING: Readonly<Record<OpeningHardwareComponent, AtoeMappingEntry>> = {
  'lever':         { categoryCode: 'OIK-5.31', unit: 'pcs', titleEL: 'Χειρολαβή μοχλού κουφώματος (BIM)' },
  'pull-handle':   { categoryCode: 'OIK-5.32', unit: 'pcs', titleEL: 'Χερούλι συρόμενου κουφώματος (BIM)' },
  'knob':          { categoryCode: 'OIK-5.33', unit: 'pcs', titleEL: 'Πόμολο κουφώματος (BIM)' },
  'window-handle': { categoryCode: 'OIK-5.34', unit: 'pcs', titleEL: 'Χειρολαβή παραθύρου (BIM)' },
  'lockset':       { categoryCode: 'OIK-5.35', unit: 'pcs', titleEL: 'Κλειδαριά κουφώματος (BIM)' },
  'hinge':         { categoryCode: 'OIK-5.36', unit: 'pcs', titleEL: 'Μεντεσές κουφώματος (BIM)' },
  'flush-bolt':    { categoryCode: 'OIK-5.37', unit: 'pcs', titleEL: 'Σύρτης κουφώματος (BIM)' },
  'sliding-track': { categoryCode: 'OIK-5.38', unit: 'pcs', titleEL: 'Μηχανισμός/ράγα συρόμενου (BIM)' },
  'friction-stay': { categoryCode: 'OIK-5.39', unit: 'pcs', titleEL: 'Μηχανισμός ανάκλισης παραθύρου (BIM)' },
};

const BEAM_MAPPING: Readonly<Record<BeamKind, AtoeMappingEntry>> = {
  straight:    { categoryCode: 'OIK-2.04', unit: 'm3', titleEL: 'Δοκός RC ευθύγραμμη (BIM)' },
  curved:      { categoryCode: 'OIK-2.04', unit: 'm3', titleEL: 'Δοκός RC καμπύλη (BIM)' },
  cantilever:  { categoryCode: 'OIK-2.04', unit: 'm3', titleEL: 'Πρόβολος RC (BIM)' },
};

/**
 * ADR-441 — θεμελίωση RC (m³). Πέδιλο/πεδιλοδοκός → OIK-2.02 (θεμελιώσεις)·
 * συνδετήρια δοκός → OIK-2.04 (δοκοί), όπως η υπέργεια δοκός. Όγκος = NET (μέσω
 * `applyFoundationGridNet` για grid strips) ώστε να μη διπλομετρώνται οι κόμβοι.
 */
const FOUNDATION_MAPPING: Readonly<Record<FoundationKind, AtoeMappingEntry>> = {
  pad:        { categoryCode: 'OIK-2.02', unit: 'm3', titleEL: 'Πέδιλο RC (BIM)' },
  strip:      { categoryCode: 'OIK-2.02', unit: 'm3', titleEL: 'Πεδιλοδοκός RC (BIM)' },
  'tie-beam': { categoryCode: 'OIK-2.04', unit: 'm3', titleEL: 'Συνδετήρια δοκός RC (BIM)' },
};

/**
 * ADR-363 Φ2 — μεταλλικό δοκάρι διατομής Ι/H → OIK-12 Μεταλλικά (kg), ίδιο με τη
 * μεταλλική κολώνα Ι-τομής. Το `BeamKind` (straight/curved/cantilever) είναι
 * δομική μορφή — ΔΕΝ φέρει steel· ο διαχωριστής είναι `params.sectionKind`, οπότε
 * το override λύνεται στο `resolveAtoeMapping` (εκτός του kind-table).
 */
const BEAM_ISHAPE_MAPPING: AtoeMappingEntry = {
  categoryCode: 'OIK-12.10', unit: 'kg', titleEL: 'Δοκός μεταλλική Ι-τομής (BIM)',
};

/**
 * Πυκνότητα δομικού χάλυβα (kg/m³) για BOQ βάρος μεταλλικών στοιχείων (EN 1991
 * / ISO: ~7850). Τροφοδοτεί το `'kg'` branch του `deriveAtoeQuantity`.
 */
export const STEEL_DENSITY_KGM3 = 7850;

// ADR-407 — railing → OIK-12 Μεταλλικά (master catalog: «κάγκελα, σκάλες»),
// measured as running length (m), like the stair handrail. First path-length
// BIM entity, so it introduces the `'m'` quantity branch in deriveAtoeQuantity.
const RAILING_MAPPING: Readonly<Record<RailingKind, AtoeMappingEntry>> = {
  railing: { categoryCode: 'OIK-12.01', unit: 'm', titleEL: 'Κιγκλίδωμα μεταλλικό (BIM)' },
};

/**
 * ADR-410 — έπιπλο (mesh-based CC0): μετριέται ανά τεμάχιο (pcs, qty=1), όπως τα
 * κουφώματα. Loose equipment — δεν φέρει δομικό όγκο/μήκος. Πρώτο entity που
 * τροφοδοτεί BOQ ως καθαρό count από το `interior` discipline.
 */
const FURNITURE_MAPPING: Readonly<Record<FurnitureKind, AtoeMappingEntry>> = {
  chair:      { categoryCode: 'OIK-12.50', unit: 'pcs', titleEL: 'Έπιπλο — καρέκλα (BIM)' },
  table:      { categoryCode: 'OIK-12.50', unit: 'pcs', titleEL: 'Έπιπλο — τραπέζι (BIM)' },
  bed:        { categoryCode: 'OIK-12.50', unit: 'pcs', titleEL: 'Έπιπλο — κρεβάτι (BIM)' },
  sofa:       { categoryCode: 'OIK-12.50', unit: 'pcs', titleEL: 'Έπιπλο — καναπές (BIM)' },
  armchair:   { categoryCode: 'OIK-12.50', unit: 'pcs', titleEL: 'Έπιπλο — πολυθρόνα (BIM)' },
  desk:       { categoryCode: 'OIK-12.50', unit: 'pcs', titleEL: 'Έπιπλο — γραφείο (BIM)' },
  cabinet:    { categoryCode: 'OIK-12.50', unit: 'pcs', titleEL: 'Έπιπλο — ντουλάπι/μπουφές (BIM)' },
  wardrobe:   { categoryCode: 'OIK-12.50', unit: 'pcs', titleEL: 'Έπιπλο — ντουλάπα (BIM)' },
  bookshelf:  { categoryCode: 'OIK-12.50', unit: 'pcs', titleEL: 'Έπιπλο — βιβλιοθήκη (BIM)' },
  nightstand: { categoryCode: 'OIK-12.50', unit: 'pcs', titleEL: 'Έπιπλο — κομοδίνο (BIM)' },
  bench:      { categoryCode: 'OIK-12.50', unit: 'pcs', titleEL: 'Έπιπλο — παγκάκι (BIM)' },
  dresser:    { categoryCode: 'OIK-12.50', unit: 'pcs', titleEL: 'Έπιπλο — συρταριέρα (BIM)' },
  stool:      { categoryCode: 'OIK-12.50', unit: 'pcs', titleEL: 'Έπιπλο — σκαμπό (BIM)' },
  tvStand:    { categoryCode: 'OIK-12.50', unit: 'pcs', titleEL: 'Έπιπλο — έπιπλο TV (BIM)' },
};

// ADR-417 — κεκλιμένη στέγη → OIK-7 Επικαλύψεις στεγών. Μετριέται με το ΚΕΚΛΙΜΕΝΟ
// εμβαδό (GrossArea m², geometry.area alias), όχι την κάτοψη (ADR-417 Q7: η
// επικάλυψη κεραμιδιών/μεμβράνης ακολουθεί την πραγματική κεκλιμένη επιφάνεια).
const ROOF_MAPPING: Readonly<Record<RoofKind, AtoeMappingEntry>> = {
  roof: { categoryCode: 'OIK-7.01', unit: 'm2', titleEL: 'Επικάλυψη στέγης (BIM)' },
};

// ============================================================================
// MEP / Η-Μ MAPPING (ADR-408 — heating, plumbing, drainage, HVAC)
// ============================================================================

/**
 * ⚠️ PLACEHOLDER ΗΛΜ ARTICLE CODES (ADR-408 BOQ auto-feed).
 *
 * Unlike the structural `OIK-x.xx` codes (Οικοδομικά), MEP elements belong to the
 * Greek Η-Μ (Ηλεκτρομηχανολογικά / ΑΤΗΕ) article groups. The numbers below follow
 * the official ΑΤΗΕ group structure so the architecture + per-System takeoff are
 * complete TODAY (Revit Material/System Takeoff parity):
 *   - `ΗΛΜ-5.xx` → ύδρευση (domestic water supply)
 *   - `ΗΛΜ-6.xx` → αποχέτευση (sanitary drainage)
 *   - `ΗΛΜ-7.xx` → θέρμανση (heating: terminals, sources, distribution)
 *   - `ΗΛΜ-8.xx` → αερισμός / κλιματισμός (HVAC air distribution)
 * Replace each `categoryCode` with the project's real ΑΤΗΕ article number in THIS
 * one file when the priced master is available — nothing else changes.
 */

// Heating terminal — panel radiator (IfcSpaceHeater) → counted per piece.
const MEP_RADIATOR_MAPPING: Readonly<Record<MepRadiatorKind, AtoeMappingEntry>> = {
  'panel-radiator': { categoryCode: 'ΗΛΜ-7.01', unit: 'pcs', titleEL: 'Θερμαντικό σώμα — πάνελ (BIM)' },
};

// Heating source — wall-hung boiler (IfcBoiler) → counted per piece.
const MEP_BOILER_MAPPING: Readonly<Record<MepBoilerKind, AtoeMappingEntry>> = {
  'wall-boiler': { categoryCode: 'ΗΛΜ-7.02', unit: 'pcs', titleEL: 'Λέβητας επίτοιχος (BIM)' },
};

// DHW source — electric water heater (IfcUnitaryEquipment) → counted per piece.
const MEP_WATER_HEATER_MAPPING: Readonly<Record<MepWaterHeaterKind, AtoeMappingEntry>> = {
  'electric-water-heater': { categoryCode: 'ΗΛΜ-5.03', unit: 'pcs', titleEL: 'Θερμοσίφωνας ηλεκτρικός (BIM)' },
};

// Manifold body — `floor-manifold` (heating distribution) vs `drainage-collector`
// (φρεάτιο). Different Η-Μ groups, so keyed by kind. Both counted per piece.
const MEP_MANIFOLD_MAPPING: Readonly<Record<MepManifoldKind, AtoeMappingEntry>> = {
  'floor-manifold':     { categoryCode: 'ΗΛΜ-7.03', unit: 'pcs', titleEL: 'Συλλέκτης θέρμανσης (BIM)' },
  'drainage-collector': { categoryCode: 'ΗΛΜ-6.02', unit: 'pcs', titleEL: 'Φρεάτιο αποχέτευσης (BIM)' },
};

// Underfloor heating loop — measured as developed serpentine pipe LENGTH (m),
// the Revit convention (geometry.totalLengthM → BimEntityForBoq.geometry.lengthM).
const MEP_UNDERFLOOR_MAPPING: Readonly<Record<MepUnderfloorKind, AtoeMappingEntry>> = {
  'hydronic-loop': { categoryCode: 'ΗΛΜ-7.04', unit: 'm', titleEL: 'Ενδοδαπέδια θέρμανση — σωλήνωση (BIM)' },
};

/**
 * Linear distribution segment (pipe/duct) — Revit System-based takeoff: a pipe is
 * billed PER plumbing classification (supply vs return vs cold/hot water vs drainage)
 * so each System rolls up to its own ΗΛΜ line; a duct (no plumbing classification)
 * rolls up to the HVAC group. Measured as running length (m). The `classification`
 * — not `kind` — is the discriminator, so it is resolved OUTSIDE the kind-table
 * (mirror of the beam `sectionKind === 'I-shape'` override) via
 * {@link resolveMepSegmentMapping}.
 */
const MEP_SEGMENT_DUCT_MAPPING: AtoeMappingEntry = {
  categoryCode: 'ΗΛΜ-8.01', unit: 'm', titleEL: 'Αεραγωγός (BIM)',
};
const MEP_SEGMENT_PIPE_GENERIC_MAPPING: AtoeMappingEntry = {
  categoryCode: 'ΗΛΜ-5.00', unit: 'm', titleEL: 'Σωλήνας (BIM)',
};
const MEP_SEGMENT_PIPE_MAPPING: Readonly<Record<PlumbingSystemClassification, AtoeMappingEntry>> = {
  'domestic-cold-water': { categoryCode: 'ΗΛΜ-5.01', unit: 'm', titleEL: 'Σωλήνας ύδρευσης κρύου νερού (BIM)' },
  'domestic-hot-water':  { categoryCode: 'ΗΛΜ-5.02', unit: 'm', titleEL: 'Σωλήνας ύδρευσης ζεστού νερού (BIM)' },
  'sanitary-drainage':   { categoryCode: 'ΗΛΜ-6.01', unit: 'm', titleEL: 'Σωλήνας αποχέτευσης (BIM)' },
  'hydronic-supply':     { categoryCode: 'ΗΛΜ-7.10', unit: 'm', titleEL: 'Σωλήνας θέρμανσης προσαγωγής (BIM)' },
  'hydronic-return':     { categoryCode: 'ΗΛΜ-7.11', unit: 'm', titleEL: 'Σωλήνας θέρμανσης επιστροφής (BIM)' },
  'fire-sprinkler':      { categoryCode: 'ΗΛΜ-19.01', unit: 'm', titleEL: 'Σωλήνας πυρόσβεσης καταιονισμού (BIM)' }, // ADR-433
};

/** Lookup map keyed by entity type for runtime dispatch. */
export const BIM_TO_ATOE_MAPPING = {
  wall:    WALL_MAPPING,
  opening: OPENING_MAPPING,
  slab:    SLAB_MAPPING,
  column:  COLUMN_MAPPING,
  beam:    BEAM_MAPPING,
  railing: RAILING_MAPPING,
  furniture: FURNITURE_MAPPING,
  roof:    ROOF_MAPPING,
  // ADR-408 — Η-Μ point/area entities (segment resolved separately, per classification).
  'mep-radiator':     MEP_RADIATOR_MAPPING,
  'mep-boiler':       MEP_BOILER_MAPPING,
  'mep-water-heater': MEP_WATER_HEATER_MAPPING,
  'mep-manifold':     MEP_MANIFOLD_MAPPING,
  'mep-underfloor':   MEP_UNDERFLOOR_MAPPING,
} as const;

// ============================================================================
// RESOLVER
// ============================================================================

/**
 * Resolve the ΑΤΟΕ mapping for a BIM entity.
 *
 * @param entityType  'wall' | 'opening' | 'slab' | 'column' | 'beam'
 * @param kind        entity.kind (e.g. 'straight', 'door', 'floor')
 * @param category    entity.params.category — required for walls (WallCategory discriminator)
 * @param sectionKind entity.params.sectionKind — ADR-363 Φ2 beam steel discriminator
 * @param classification entity.params.classification — ADR-408 MEP segment per-System discriminator
 * @returns AtoeMappingEntry or null when entityType/kind is unknown
 */
export function resolveAtoeMapping(
  entityType: BimEntityType,
  kind: string,
  category?: string,
  sectionKind?: string,
  classification?: string,
): AtoeMappingEntry | null {
  if (entityType === 'wall') {
    const wallCategory = category as WallCategory | undefined;
    if (!wallCategory) return null;
    return WALL_MAPPING[wallCategory] ?? null;
  }

  // ADR-363 Φ2 — μεταλλικό δοκάρι Ι/H: ο διαχωριστής είναι το sectionKind (όχι το
  // BeamKind), οπότε λύνεται πριν το kind-table lookup.
  if (entityType === 'beam' && sectionKind === 'I-shape') {
    return BEAM_ISHAPE_MAPPING;
  }

  // ADR-408 — MEP segment (pipe/duct): the plumbing `classification` (not `kind`)
  // drives the Η-Μ line (Revit System takeoff), so it is resolved outside the table.
  if (entityType === 'mep-segment') {
    return resolveMepSegmentMapping(kind, classification);
  }

  // Stair is multi-row (concrete/cladding/handrail) — resolved per component,
  // never per kind. Callers use `resolveStairComponentMapping` instead.
  if (entityType === 'stair') return null;

  // ADR-683 Φ3.1 — το εισαγόμενο πλέγμα έχει ΕΝΑ kind ('imported') που δεν λέει τίποτα για το
  // κόστος· ο διαχωριστής είναι η **ανατεθειμένη ταυτότητα** μέσα στα params. Λύνεται από το
  // `resolveImportedMeshMapping`, ώστε ένα ανανάθετο πλέγμα να μη βρίσκει ποτέ γραμμή κατά λάθος.
  if (entityType === 'imported-mesh') return null;

  const typeMap = BIM_TO_ATOE_MAPPING[entityType] as Readonly<Record<string, AtoeMappingEntry>>;
  return typeMap?.[kind] ?? null;
}

/**
 * ADR-441 — foundation ΑΤΟΕ mapping. Κρατιέται ΕΚΤΟΣ του `BimEntityType`
 * bridge-contract (η θεμελίωση τροφοδοτεί BOQ μέσω δικού της path
 * `foundation-grid-boq.ts`, όχι μέσω `BimToBoqBridge`). Χρησιμοποιείται από το
 * combined schedule preset για την κύρια ποσότητα (όγκος m³).
 */
export function resolveFoundationMapping(kind: FoundationKind): AtoeMappingEntry | null {
  return FOUNDATION_MAPPING[kind] ?? null;
}

/**
 * ADR-408 — resolve a linear MEP segment's Η-Μ mapping (Revit System-based takeoff).
 * A duct maps to the HVAC group; a pipe maps PER plumbing classification, falling
 * back to a generic pipe line when the run is not yet classified / system-bound.
 */
function resolveMepSegmentMapping(kind: string, classification?: string): AtoeMappingEntry | null {
  if (kind === 'duct') return MEP_SEGMENT_DUCT_MAPPING;
  if (kind !== 'pipe') return null;
  const byClass = classification
    ? (MEP_SEGMENT_PIPE_MAPPING as Readonly<Record<string, AtoeMappingEntry>>)[classification]
    : undefined;
  return byClass ?? MEP_SEGMENT_PIPE_GENERIC_MAPPING;
}

/**
 * ADR-683 Φ3.1 (§10.2) — αντιστοίχιση **εισαγόμενου πλέγματος** από την ανατεθειμένη ταυτότητα.
 *
 * Ο έκτος resolver εκτός του kind-πίνακα (μαζί με beam I-shape / mep-segment / stair /
 * opening-hardware / foundation), και ο μόνος του οποίου η πηγή είναι **δήλωση χρήστη** αντί για
 * ιδιότητα του μοντέλου: ένα ψημένο πλέγμα δεν φέρει κόστος ούτε μονάδα μέτρησης (§3).
 *
 * Το όρισμα είναι `unknown` γιατί έρχεται από το index-typed `params` του bridge. Η επικύρωση
 * γίνεται εδώ, **fail-closed**: ό,τι δεν είναι πλήρης ταυτότητα → `null` → **καμία γραμμή**.
 * Ποτέ μερική γραμμή με κενό τίτλο ή μονάδα που δεν παράγει ποσότητα.
 */
export function resolveImportedMeshMapping(identity: unknown): AtoeMappingEntry | null {
  if (typeof identity !== 'object' || identity === null) return null;
  const { categoryCode, unit, titleEL } = identity as Partial<Record<string, unknown>>;
  if (typeof categoryCode !== 'string' || categoryCode.length === 0) return null;
  if (typeof titleEL !== 'string' || titleEL.length === 0) return null;
  if (typeof unit !== 'string') return null;
  // Μόνο οι μονάδες που το `deriveAtoeQuantity` μετατρέπει όντως σε ποσότητα — οι υπόλοιπες θα
  // έγραφαν σιωπηλά μηδέν στην προμέτρηση.
  if (!isImportedMeshBoqUnit(unit)) return null;
  return { categoryCode, unit, titleEL };
}

/** Resolve the ΑΤΟΕ mapping for a single stair BOQ component (ADR-395 §G1). */
export function resolveStairComponentMapping(component: StairBoqComponent): AtoeMappingEntry {
  return STAIR_COMPONENT_MAPPING[component];
}

/**
 * ADR-674 Φ C — resolve the ΑΤΟΕ mapping for a single opening-hardware BOQ
 * component (χειρολαβή/κλειδαριά/μεντεσές…). Mirror of
 * {@link resolveStairComponentMapping}: keyed by the Phase A component union,
 * never by the opening `kind`. Total over the union → always non-null.
 */
export function resolveOpeningHardwareMapping(component: OpeningHardwareBoqComponent): AtoeMappingEntry {
  return OPENING_HARDWARE_MAPPING[component];
}

/**
 * Derive the primary BOQ quantity from a unit + computed geometry cache.
 *
 * SSoT for the geometry→quantity rule shared by the auto-feed bridge
 * (`BimToBoqBridge`) and the Schedule combined preset (`mapCombined`):
 *   - `pcs` → 1 (openings count as one piece)
 *   - `m2`  → `geometry.area`
 *   - `m3`  → `geometry.volume`
 *   - `m`   → `geometry.lengthM` (ADR-407 — running length, e.g. railings)
 *   - `kg`  → `geometry.volume × STEEL_DENSITY_KGM3` (ADR-363 Φ2 — μεταλλικά
 *     στοιχεία· ο όγκος είναι το πραγματικό εμβαδόν διατομής × μήκος/ύψος)
 *
 * ADR-395 §4.6 (G5): geometry is the single source of truth for BIM
 * quantities — the legacy `entity.qto` field was never populated and was
 * removed. Anything reading a primary quantity reads it from geometry here.
 */
export function deriveAtoeQuantity(
  unit: BOQMeasurementUnit,
  geometry?: { readonly area?: number; readonly volume?: number; readonly lengthM?: number } | null,
): number {
  if (unit === 'pcs') return 1;
  if (unit === 'm2') return geometry?.area ?? 0;
  if (unit === 'm3') return geometry?.volume ?? 0;
  if (unit === 'm') return geometry?.lengthM ?? 0;
  // ADR-363 Φ2 — μεταλλικά στοιχεία (μεταλλική κολώνα/δοκάρι Ι): βάρος = όγκος × ρ.
  if (unit === 'kg') return (geometry?.volume ?? 0) * STEEL_DENSITY_KGM3;
  return 0;
}
