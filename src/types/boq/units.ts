/**
 * BOQ Unit System — Type Literals & Mappings
 *
 * Μονάδες μέτρησης, IFC quantity types, και domain-specific enumerations
 * για το σύστημα επιμετρήσεων (Quantity Surveying).
 *
 * @module types/boq/units
 * @see ADR-175 (Quantity Surveying / BOQ)
 */

import type { UomCode } from '@/lib/uom/uom-registry';

// ============================================================================
// MEASUREMENT UNITS
// ============================================================================

/**
 * Μονάδα μέτρησης ποσοτήτων BOQ — **υποσύνολο του ΕΝΟΣ μητρώου** `lib/uom/uom-registry` (ADR-923 §5.11 «3γ» Α10).
 *
 * Οι κωδικοί BOQ είναι οι **εσωτερικοί** κωδικοί του μητρώου (πρότυπο SAP T006)· ο UN/ECE κωδικός, οι γραφές των
 * άλλων λεξιλογίων (`'τεμ'`, `'m²'`) και οι ετικέτες ζουν **εκεί**. Αν αφαιρεθεί κωδικός από το μητρώο, ο
 * κωδικός που δεν υπάρχει στο μητρώο **δεν μεταγλωττίζεται** (`satisfies`) — η σύζευξη είναι σκόπιμη.
 */
export const BOQ_MEASUREMENT_UNITS = [
  'm', 'm2', 'm3', 'kg', 'ton', 'pcs', 'lt', 'set', 'hr', 'day', 'lump', 'kWp',
] as const satisfies readonly UomCode[];

export type BOQMeasurementUnit = (typeof BOQ_MEASUREMENT_UNITS)[number];

/**
 * Η λίστα **επιλογής** μονάδας BOQ (φόρμα υλικού · εφεδρεία του επεξεργαστή όταν η κατηγορία δεν ορίζει δικές της).
 * Χωρίς `kWp`: το δηλώνει **μόνο** η κατηγορία φωτοβολταϊκών (`boq-categories` → `allowedUnits`).
 * 🔴 Ήταν **δύο** πανομοιότυπα αντίγραφα (`MaterialFormDialog.BOQ_UNITS` · `useBOQEditorState.ALL_UNITS`, ADR-923 «3γ» Α10).
 */
export const BOQ_PICKER_UNITS: readonly BOQMeasurementUnit[] = BOQ_MEASUREMENT_UNITS.filter((unit) => unit !== 'kWp');

// ============================================================================
// IFC QUANTITY TYPES (BIM INTEGRATION)
// ============================================================================

/** IFC quantity types — aligned with IFC4 standard */
export type IfcQuantityType =
  | 'IfcQuantityLength'
  | 'IfcQuantityArea'
  | 'IfcQuantityVolume'
  | 'IfcQuantityWeight'
  | 'IfcQuantityCount';

/** Mapping: IFC quantity type → allowed BOQ units */
export const IFC_UNIT_MAP: Record<IfcQuantityType, BOQMeasurementUnit[]> = {
  IfcQuantityLength: ['m'],
  IfcQuantityArea: ['m2'],
  IfcQuantityVolume: ['m3', 'lt'],
  IfcQuantityWeight: ['kg', 'ton'],
  IfcQuantityCount: ['pcs', 'set'],
} as const;

// ============================================================================
// DOMAIN ENUMERATIONS
// ============================================================================

/** Τύπος χώρου — αφορά scope ανά μονάδα/κτίριο */
export type RoomType =
  | 'bedroom'
  | 'bathroom'
  | 'kitchen'
  | 'living_room'
  | 'hallway'
  | 'storage'
  | 'balcony'
  | 'parking'
  | 'common_area'
  | 'stairwell'
  | 'roof'
  | 'basement'
  | 'other';

/** Κύκλος ζωής BOQ item — governance status */
export type BOQItemStatus =
  | 'draft'       // Σχέδιο — ελεύθερη επεξεργασία
  | 'submitted'   // Υποβληθέν — αναμονή έγκρισης
  | 'approved'    // Εγκεκριμένο — κλειδωμένο, μπορεί να πιστοποιηθεί
  | 'certified'   // Πιστοποιημένο — πραγματική ποσότητα καταχωρημένη
  | 'locked';     // Κλειδωμένο — τελικό, αμετάβλητο

/**
 * ADR-673 — οι δύο «επεξεργάσιμες» καταστάσεις τις οποίες ο BIM auto-sync (BOQ bridge)
 * επιτρέπεται να δημιουργεί/ενημερώνει/διαγράφει. Καθρεφτίζει τον Firestore `boq_items`
 * delete rule (`status in ['draft','submitted']`). Οι `approved`/`certified`/`locked`
 * είναι **παγωμένα συμβατικά baselines**: ο auto-sync ΠΟΤΕ δεν τα διαγράφει ούτε τα
 * ξαναγράφει (5D-BIM cost πρακτική — CostX/iTWO/Vico: πιστοποιημένη ποσότητα = αμετάβλητη·
 * η απόκλιση μοντέλου εμφανίζεται ως variance για ανθρώπινο έλεγχο, ποτέ ως αυτόματη
 * μεταβολή). SSoT ώστε ο guard και κάθε μελλοντικό variance UI να συμφωνούν.
 */
export const BOQ_AUTO_MANAGED_STATUSES: readonly BOQItemStatus[] = ['draft', 'submitted'];

/** True όταν ένα BOQ row είναι ακόμα σε lifecycle που ο BIM auto-sync δικαιούται να μεταβάλει/διαγράψει. */
export function isBoqAutoManagedStatus(status: unknown): status is 'draft' | 'submitted' {
  return status === 'draft' || status === 'submitted';
}

/**
 * ADR-675 — οι τρεις «παγωμένες» καταστάσεις: υπογεγραμμένα συμβατικά baselines που ο BIM auto-sync
 * ΠΟΤΕ δεν overwriteάρει/διαγράφει (μόνο καταγράφει drift — βλ. `recordBaselineDrift`).
 */
export const BOQ_FROZEN_BASELINE_STATUSES: readonly BOQItemStatus[] = ['approved', 'certified', 'locked'];

/**
 * True ΜΟΝΟ όταν το status είναι ρητά ένα υπογεγραμμένο baseline (approved/certified/locked).
 * ΣΚΟΠΙΜΑ ΟΧΙ `!isBoqAutoManagedStatus`: ένα row χωρίς/άγνωστο status ΔΕΝ είναι signed baseline —
 * παραμένει auto-managed (ώστε normal upsert + orphan-cleanup να μη μπλοκάρονται από απόν πεδίο).
 */
export function isFrozenBaselineStatus(status: unknown): status is 'approved' | 'certified' | 'locked' {
  return status === 'approved' || status === 'certified' || status === 'locked';
}

/** Μέθοδος μέτρησης */
export type MeasurementMethod =
  | 'manual'       // Χειρωνακτική εισαγωγή
  | 'tape'         // Μέτρο/μετροταινία
  | 'laser'        // Αποστασιόμετρο laser
  | 'dxf_auto'     // Αυτόματη εξαγωγή από DXF
  | 'dxf_verified' // DXF + επαλήθευση χρήστη
  | 'bim';         // BIM model extraction

/** Πηγή δεδομένων BOQ item */
export type BOQSource =
  | 'manual'          // Χειρωνακτική εισαγωγή
  | 'template'        // Από πρότυπο
  | 'dxf_auto'        // Αυτόματη εξαγωγή DXF
  | 'dxf_verified'    // DXF verified
  | 'imported'        // Import από εξωτερικό αρχείο
  | 'duplicate'       // Αντίγραφο από άλλο item
  | 'bim-auto';       // Αυτόματη δημιουργία από BIM entity (ADR-363 Phase 6)

/** Κατάσταση QA — ποιοτικός έλεγχος */
export type QAStatus =
  | 'pending'      // Αναμονή ελέγχου
  | 'passed'       // Πέρασε τον έλεγχο
  | 'failed'       // Απέτυχε
  | 'na';          // Δεν εφαρμόζεται

/** Επίπεδο κατηγοριοποίησης — ΑΤΟΕ hierarchy */
export type CategoryLevel =
  | 'group'     // Ομάδα (π.χ. ΟΙΚ-2 Σκυροδέματα)
  | 'subgroup'  // Υποομάδα (π.χ. ΟΙΚ-2.1 Θεμελιώσεις)
  | 'item';     // Εργασία (π.χ. ΟΙΚ-2.1.3 Οπλισμένο σκυρόδεμα C20/25)

/** Πολιτική φύρας — πώς εφαρμόζεται το waste factor */
export type WastePolicy =
  | 'inherited'   // Κληρονομείται από κατηγορία/τιμοκατάλογο
  | 'overridden'; // Override ανά item

/**
 * Προέλευση τιμής (ADR-175 §4.1.3 · ADR-923 §5.4): ρίζα του λεξιλογίου.
 * `master`: λίστα `cost` του χώρου · `project`: λίστα `cost` του έργου · `item`: καμία πηγή τιμοκαταλόγου.
 * 🔑 Παράγεται από το `BOQItem.priceSource`, δεν δηλώνεται ανεξάρτητα (`services/measurements/boq-price-source`).
 */
export const BOQ_SOURCE_AUTHORITIES = ['master', 'project', 'item'] as const;

export type SourceAuthority = (typeof BOQ_SOURCE_AUTHORITIES)[number];
