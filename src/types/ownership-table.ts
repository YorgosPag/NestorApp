/**
 * ============================================================================
 * ADR-235: Πίνακας Ποσοστών Συνιδιοκτησίας — TypeScript Interfaces
 * ============================================================================
 *
 * Ν. 3741/1929 — Οριζόντια & Κάθετη Ιδιοκτησία
 * ΠΟΛ 1149/1994 — Συντελεστές Ορόφου (ΑΑΔΕ)
 *
 * @module types/ownership-table
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// ENUMS & LITERAL TYPES
// ============================================================================

/** Μεθοδολογία υπολογισμού χιλιοστών */
export type CalculationMethod = 'area' | 'value' | 'volume';

/** Κατηγορία ιδιοκτησίας στον πίνακα */
export type PropertyCategory = 'main' | 'auxiliary' | 'air_rights';

/** Ιδιοκτήτης στο σενάριο αντιπαροχής */
export type OwnerParty = 'contractor' | 'landowner' | 'buyer' | 'unassigned';

/** Status πίνακα */
export type OwnershipTableStatus = 'draft' | 'finalized' | 'registered';

/** Entity collection references */
export type OwnershipEntityCollection = 'properties' | 'parking_spots' | 'storage_units';

// ============================================================================
// FLOOR COEFFICIENTS — ΠΟΛ 1149/1994 (ΑΑΔΕ)
// ============================================================================

/**
 * Πίνακας Α: ΣΕ < 1.5 (Κατοικίες — χαμηλή εμπορικότητα)
 * Πίνακας Β: ΣΕ ≥ 1.5 (Καταστήματα — υψηλή εμπορικότητα)
 */
export interface FloorCoefficientTable {
  readonly basement: number;
  readonly ground: number;
  readonly first: number;
  readonly second: number;
  readonly third: number;
  readonly fourth: number;
  readonly fifthPlus: number;
  /** Extra entry for Table B: 6th+ floor */
  readonly sixthPlus?: number;
}

/** ΠΟΛ 1149/1994 — Πίνακας Α: ΣΕ < 1.5 */
export const FLOOR_COEFFICIENTS_TABLE_A: FloorCoefficientTable = {
  basement: 0.60,
  ground: 0.90,
  first: 1.00,
  second: 1.05,
  third: 1.10,
  fourth: 1.15,
  fifthPlus: 1.20,
} as const;

/** ΠΟΛ 1149/1994 — Πίνακας Β: ΣΕ ≥ 1.5 */
export const FLOOR_COEFFICIENTS_TABLE_B: FloorCoefficientTable = {
  basement: 0.60,
  ground: 1.20,
  first: 1.10,
  second: 1.05,
  third: 1.10,
  fourth: 1.15,
  fifthPlus: 1.20,
  sixthPlus: 1.25,
} as const;

/**
 * Mapping: floor string → coefficient key
 * Used by the calculation engine to resolve coefficients
 */
export const FLOOR_TO_COEFFICIENT_KEY: Record<string, keyof FloorCoefficientTable> = {
  'basement': 'basement',
  'υπόγειο': 'basement',
  'ground': 'ground',
  'ισόγειο': 'ground',
  'πιλοτή': 'ground',
  '1': 'first',
  '1ος': 'first',
  '2': 'second',
  '2ος': 'second',
  '3': 'third',
  '3ος': 'third',
  '4': 'fourth',
  '4ος': 'fourth',
  '5': 'fifthPlus',
  '5ος': 'fifthPlus',
  '6': 'fifthPlus',
  '6ος': 'fifthPlus',
} as const;

// ============================================================================
// DATA MODEL INTERFACES
// ============================================================================

/**
 * Οικοπεδούχος στο σενάριο αντιπαροχής (μπορεί να υπάρχουν πολλοί)
 */
export interface LandownerEntry {
  /** Contact ID του οικοπεδούχου */
  readonly contactId: string;
  /** Ονοματεπώνυμο */
  readonly name: string;
  /** Ποσοστό ιδιοκτησίας οικοπέδου (π.χ. 33.33 για 1/3) */
  readonly landOwnershipPct: number;
  /** Χιλιοστά που αναλογούν (υπολογίζεται αυτόματα) */
  readonly allocatedShares: number;
}

/**
 * Ρόλος ιδιοκτήτη σε ακίνητο (ADR-244 — Multi-Buyer Co-Ownership)
 */
export type PropertyOwnerRole = 'buyer' | 'co_buyer' | 'landowner';

/**
 * Ιδιοκτήτης/Συνιδιοκτήτης ακινήτου (ADR-244).
 * Ενιαίο type για αγοραστές, συν-αγοραστές, οικοπεδούχους.
 * Pattern: LandownerEntry (ίδια δομή, extended με role + paymentPlanId)
 */
export interface PropertyOwnerEntry {
  /** Contact ID */
  readonly contactId: string;
  /** Ονοματεπώνυμο (denormalized for display) */
  readonly name: string;
  /** Ποσοστό ιδιοκτησίας (0-100, π.χ. 50 = 50%) */
  readonly ownershipPct: number;
  /** Ρόλος: αγοραστής, συν-αγοραστής, οικοπεδούχος */
  readonly role: PropertyOwnerRole;
  /** Σύνδεση με ξεχωριστό πλάνο αποπληρωμής — null = κοινό πλάνο */
  readonly paymentPlanId: string | null;
}

/**
 * Entity reference — σε ποιο Firestore document αναφέρεται η γραμμή
 */
export interface OwnershipEntityRef {
  readonly collection: OwnershipEntityCollection;
  readonly id: string;
}

/**
 * Συντελεστές υπολογισμού (Μέθοδος Β: Αντικειμενική Αξία)
 */
export interface CalculationCoefficients {
  /** Συντελεστής ορόφου (ΠΟΛ 1149/1994) */
  readonly floorCoefficient: number;
  /** Συντελεστής αξίας (πρόσοψη, θέα, φωτισμός) — default 1.0 */
  readonly valueCoefficient: number;
}

/**
 * Παρακολούθημα (parking/storage) linked σε unit — πλήρη data για tree-branch display.
 * Τα παρακολουθήματα ΔΕΝ εμφανίζονται ως standalone rows — μόνο ως children του parent unit.
 */
export interface LinkedSpaceDetail {
  /** Firestore document ID του parking/storage */
  readonly spaceId: string;
  /** Κωδικός (π.χ. "A-PK-0.02", "ΑΠΟΘΗΚΗ 1") */
  readonly entityCode: string;
  /** Τύπος χώρου */
  readonly spaceType: 'parking' | 'storage';
  /** Περιγραφή */
  readonly description: string;
  /** Όροφος */
  readonly floor: string;
  /** Καθαρό εμβαδόν (τ.μ.) */
  readonly areaNetSqm: number;
  /** Μικτό εμβαδόν (τ.μ.) — συνήθως ίδιο με καθαρό για parking/storage */
  readonly areaSqm: number;
  /**
   * Αυτοτελή χιλιοστά — μόνο storage.
   * true = η αποθήκη-παρακολούθημα έχει δικά της χιλιοστά στον πίνακα (σύσταση το ορίζει).
   * false (default) = ακολουθεί τη μονάδα, δεν συμμετέχει στον υπολογισμό.
   * Parking = πάντα false.
   */
  readonly hasOwnShares: boolean;
  /** Χιλιοστά — ενεργό μόνο αν hasOwnShares = true (χειροκίνητα, ίδια λογική με αέρα) */
  readonly millesimalShares: number;
}

/**
 * Μία γραμμή στον πίνακα ποσοστών — αντιπροσωπεύει μία αυτοτελή ιδιοκτησία
 */
export interface OwnershipTableRow {
  /** Αύξων αριθμός */
  readonly ordinal: number;
  /** Reference στο κτήριο (για ομαδοποίηση στον πίνακα) */
  readonly buildingId: string;
  /** Building name (denormalized for display) */
  readonly buildingName: string;
  /** Reference στο entity (unit/parking/storage) */
  readonly entityRef: OwnershipEntityRef;
  /** Κωδικός entity (π.χ. "A1-01", "P-B1-03") */
  readonly entityCode: string;
  /** Περιγραφή */
  readonly description: string;
  /** Κατηγορία ιδιοκτησίας */
  readonly category: PropertyCategory;
  /** Όροφος */
  readonly floor: string;
  /** Καθαρό εμβαδόν (τ.μ.) */
  readonly areaNetSqm: number;
  /** Μικτό εμβαδόν (τ.μ.) — χρησιμοποιείται στον υπολογισμό χιλιοστών */
  readonly areaSqm: number;
  /** Ύψος ορόφου (μ.) — χρησιμοποιείται μόνο στη Μέθοδο Γ (Κατ' Όγκον) */
  readonly heightM: number | null;
  /** Χιλιοστά οικοπέδου (‰) — ΑΚΕΡΑΙΟΣ */
  readonly millesimalShares: number;
  /** Χειροκίνητα τροποποιημένα χιλιοστά — αν ο μηχανικός τα αλλάξει */
  readonly isManualOverride: boolean;
  /** Συντελεστές (Μέθοδος Β) — null για μεθόδους Α, Γ */
  readonly coefficients: CalculationCoefficients | null;
  /** Αν συμμετέχει στον υπολογισμό χιλιοστών (false = ενημερωτικό, π.χ. parking) */
  readonly participatesInCalculation: boolean;
  /** Συνδεδεμένοι χώροι — πλήρη data για tree-branch rendering */
  readonly linkedSpacesSummary: ReadonlyArray<LinkedSpaceDetail> | null;
  /** Ιδιοκτήτης (αντιπαροχή) */
  readonly ownerParty: OwnerParty;
  /** Ιδιοκτήτες μονάδας — SSoT (ADR-244 Phase 3) */
  readonly owners: ReadonlyArray<PropertyOwnerEntry> | null;
  /** Αριθμός προσυμφώνου */
  readonly preliminaryContract: string | null;
  /** Αριθμός οριστικού συμβολαίου */
  readonly finalContract: string | null;
}

/**
 * Σύνοψη αντιπαροχής
 */
export interface BartexSummary {
  /** Ποσοστό αντιπαροχής (%) — π.χ. 40 σημαίνει 40% στους οικοπεδούχους */
  readonly bartexPercentage: number;
  /** Σύνολο χιλιοστών εργολάβου */
  readonly contractorShares: number;
  /** Σύνολο χιλιοστών ΟΛΩΝ των οικοπεδούχων */
  readonly totalLandownerShares: number;
  /** Πλήθος ιδιοκτησιών εργολάβου */
  readonly contractorPropertyCount: number;
  /** Πλήθος ιδιοκτησιών οικοπεδούχων (συνολικά) */
  readonly landownerPropertyCount: number;
  /** Λίστα οικοπεδούχων — μπορεί να είναι πολλοί (κληρονόμοι, συνιδιοκτήτες) */
  readonly landowners: ReadonlyArray<LandownerEntry>;
}

/** Summary per category */
export interface CategorySummary {
  readonly count: number;
  readonly shares: number;
}

/**
 * Πλήρης Πίνακας Ποσοστών Συνιδιοκτησίας — ένας ανά project/οικόπεδο
 */
export interface OwnershipPercentageTable {
  /** Firestore document ID */
  readonly id: string;
  /** Reference στο project (= οικόπεδο) — ΕΝΑΣ πίνακας ανά οικόπεδο */
  readonly projectId: string;
  /** Κτήρια που συμμετέχουν (κάθετη ιδιοκτησία = πολλά) */
  readonly buildingIds: ReadonlyArray<string>;
  /** Ημερομηνία σύνταξης */
  readonly createdAt: Timestamp;
  /** Τελευταία ενημέρωση */
  readonly updatedAt: Timestamp;
  /** Τιμή ζώνης (€/τ.μ.) — εισάγεται χειροκίνητα από τον μηχανικό */
  readonly zonePrice: number;
  /** Συντελεστής Εμπορικότητας (ΣΕ) — καθορίζει Πίνακα Α ή Β */
  readonly commercialityCoefficient: number;
  /** Μεθοδολογία υπολογισμού */
  readonly calculationMethod: CalculationMethod;
  /** Γραμμές πίνακα — ΟΛΕΣ οι αυτοτελείς ιδιοκτησίες */
  readonly rows: ReadonlyArray<OwnershipTableRow>;
  /** Σύνολο χιλιοστών — ΠΡΕΠΕΙ = 1000 */
  readonly totalShares: number;
  /** Σύνοψη ανά κατηγορία */
  readonly summaryByCategory: {
    readonly main: CategorySummary;
    readonly auxiliary: CategorySummary;
  };
  /** Σενάριο αντιπαροχής (null αν δεν ισχύει) */
  readonly bartex: BartexSummary | null;
  /** Σημειώσεις (ελεύθερο κείμενο) */
  readonly notes: string | null;
  /** Αρ. πράξης σύστασης (notarial deed) */
  readonly deedNumber: string | null;
  /** Συμβολαιογράφος */
  readonly notary: string | null;
  /** Κωδικοί ΚΑΕΚ (αν έχει γίνει κτηματογράφηση) */
  readonly kaekCodes: ReadonlyArray<string> | null;
  /** Status */
  readonly status: OwnershipTableStatus;
  /** Τρέχουσα έκδοση */
  readonly version: number;
}

/**
 * Snapshot μιας παλαιότερης έκδοσης του πίνακα (revision history)
 * Αποθηκεύεται ως subcollection: ownership_tables/{tableId}/revisions/{revisionId}
 */
export interface OwnershipTableRevision {
  /** Revision document ID */
  readonly id: string;
  /** Αριθμός έκδοσης (1, 2, 3...) */
  readonly version: number;
  /** Πλήρες snapshot του πίνακα τη στιγμή του finalize */
  readonly snapshot: Omit<OwnershipPercentageTable, 'id' | 'version'>;
  /** Ποιος έκανε finalize αυτή την έκδοση */
  readonly finalizedBy: string;
  /** Πότε έγινε finalize */
  readonly finalizedAt: Timestamp;
  /** Λόγος αλλαγής (αν ξεκλειδώθηκε και δημιουργήθηκε νέα έκδοση) */
  readonly changeReason: string | null;
}

// ============================================================================
// MUTABLE VERSIONS (for state management)
// ============================================================================

/** Mutable row for editing in React state */
export type MutableOwnershipTableRow = {
  -readonly [K in keyof OwnershipTableRow]: OwnershipTableRow[K];
};

/** Mutable table for editing */
export type MutableOwnershipPercentageTable = {
  -readonly [K in keyof OwnershipPercentageTable]: K extends 'rows'
    ? MutableOwnershipTableRow[]
    : K extends 'buildingIds' | 'kaekCodes'
      ? string[] | null
      : K extends 'summaryByCategory'
        ? { main: CategorySummary; auxiliary: CategorySummary }
        : K extends 'bartex'
          ? BartexSummary | null
          : OwnershipPercentageTable[K];
};

// ============================================================================
// VALIDATION
// ============================================================================

/** Total millesimal shares target */
export const TOTAL_SHARES_TARGET = 1000;

/** Minimum shares per row */
export const MIN_SHARES_PER_ROW = 1;

/** Validation result */
export interface OwnershipValidationResult {
  readonly valid: boolean;
  readonly total: number;
  readonly difference: number;
  readonly errors: ReadonlyArray<string>;
}
