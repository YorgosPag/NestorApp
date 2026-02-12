/**
 * BOQ Unit System — Type Literals & Mappings
 *
 * Μονάδες μέτρησης, IFC quantity types, και domain-specific enumerations
 * για το σύστημα επιμετρήσεων (Quantity Surveying).
 *
 * @module types/boq/units
 * @see ADR-175 (Quantity Surveying / BOQ)
 */

// ============================================================================
// MEASUREMENT UNITS
// ============================================================================

/** Μονάδα μέτρησης ποσοτήτων BOQ — ISO standard + ελληνικά */
export type BOQMeasurementUnit =
  | 'm'       // μέτρα (γραμμικά)
  | 'm2'      // τετραγωνικά μέτρα
  | 'm3'      // κυβικά μέτρα
  | 'kg'      // κιλά
  | 'ton'     // τόνοι
  | 'pcs'     // τεμάχια
  | 'lt'      // λίτρα
  | 'set'     // σετ
  | 'hr'      // ώρες (εργατοώρες)
  | 'day'     // ημέρες (μηχανημάτων)
  | 'lump';   // κατ' αποκοπή

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
  | 'duplicate';      // Αντίγραφο από άλλο item

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

/** Προέλευση τιμής — τιμοκατάλογος inheritance */
export type SourceAuthority =
  | 'master'     // Master Price List (εταιρείας)
  | 'project'    // Project override
  | 'item';      // Item-level override
