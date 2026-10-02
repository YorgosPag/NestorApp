/**
 * =============================================================================
 * Conveyance Checklist — ο ΕΝΑΣ κατάλογος (SSoT, ADR-901 §5.5)
 * =============================================================================
 *
 * Ενώνει τις ενότητες Α/Β/Γ/Δ, τα προφίλ και τις διαδικασίες. Δύο καταναλωτές
 * διαβάζουν το ΙΔΙΟ λεξιλόγιο:
 * - η υπόθεση μεταβίβασης (`src/lib/conveyance/derive-checklist.ts`)
 * - το AI knowledge base (`src/config/legal-procedures-kb.ts` — λεπτή όψη, ADR-901 §2 Ε-Α)
 *
 * @module config/conveyance-checklist/catalog
 */

import type { ChecklistItem, ConveyanceProcedure, ConveyanceProfile } from './types';
import { PROPERTY_ITEMS } from './items-property';
import { BUYER_ITEMS, SELLER_ITEMS } from './items-parties';
import { TRANSACTION_ITEMS } from './items-transaction';

/**
 * Έκδοση του καταλόγου — αποθηκεύεται στην υπόθεση. Αυξάνεται σε κάθε αλλαγή
 * σημασιολογίας γραμμής (όχι σε διόρθωση κειμένου), ώστε να ξέρουμε με ποιον κατάλογο
 * ανοίχτηκε κάθε υπόθεση.
 */
export const CONVEYANCE_CATALOG_VERSION = '0.1.0';

/** Ημέρες πριν τη λήξη (ή την ημέρα υπογραφής) που μια γραμμή γίνεται `expiring` (Σ-5). */
export const EXPIRING_WINDOW_DAYS = 7;

export const CONVEYANCE_CHECKLIST: readonly ChecklistItem[] = [
  ...PROPERTY_ITEMS,
  ...SELLER_ITEMS,
  ...BUYER_ITEMS,
  ...TRANSACTION_ITEMS,
];

const ITEMS_BY_ID: ReadonlyMap<string, ChecklistItem> = new Map(
  CONVEYANCE_CHECKLIST.map((item) => [item.id, item]),
);

/** Γραμμές που ΔΕΝ ανήκουν σε κάθε προφίλ (οι υπόλοιπες ελέγχονται από τα γεγονότα). */
const PROFILE_EXCLUSIONS: Readonly<Record<ConveyanceProfile, readonly string[]>> = {
  // Νεόδμητο: δεν υπάρχει διαχειριστής ούτε ΤΑΠ προηγούμενου ιδιοκτήτη για τα κοινόχρηστα.
  new_build_company: ['building_manager_certificate'],
  // Ιδιώτης: δεν υπάρχει αλυσίδα συμβολαίων ADR-230 (εξοφλητήριο εργολάβου) ούτε αντιπαροχή.
  resale_private: ['payoff_receipt', 'antiparochi_contract'],
};

export const CONVEYANCE_PROCEDURES: readonly ConveyanceProcedure[] = [
  {
    id: 'final_contract',
    category: 'sale',
    keywords: ['συμβόλαιο', 'συμβολαιογράφος', 'συμβολαιογράφο', 'αγοραπωλησία', 'οριστικό', 'αγορά', 'υπογραφή', 'μεταβίβαση κυριότητας'],
    itemIds: [
      'title_deed', 'topographic_plan', 'building_permit', 'engineer_legality_certificate',
      'energy_certificate', 'cadastral_extract', 'seller_tax_clearance', 'seller_enfia_certificate',
      'municipal_clearance',
    ],
  },
  {
    id: 'preliminary_contract',
    category: 'sale',
    keywords: ['προσύμφωνο', 'κράτηση', 'δέσμευση', 'αρραβώνας', 'προκαταβολή'],
    itemIds: ['buyer_identity', 'buyer_income_statement'],
  },
  {
    id: 'bank_loan',
    category: 'finance',
    keywords: ['δάνειο', 'τράπεζα', 'στεγαστικό', 'δανεισμός', 'χρηματοδότηση', 'mortgage'],
    itemIds: [
      'buyer_income_statement', 'buyer_employment_certificate', 'buyer_payslips',
      'bank_property_valuation', 'preliminary_agreement', 'topographic_plan', 'building_permit',
    ],
  },
  {
    id: 'property_transfer',
    category: 'transfer',
    keywords: ['μεταβίβαση', 'εξόφληση', 'εξοφλητήριο', 'κτηματολόγιο', 'τελική μεταβίβαση'],
    itemIds: ['payoff_receipt', 'final_contract', 'cadastral_extract', 'municipal_clearance'],
  },
];

/** Η γραμμή με αυτό το id — `undefined` αν δεν υπάρχει (π.χ. αποθηκευμένη απόκλιση παλιού καταλόγου). */
export function getChecklistItem(itemId: string): ChecklistItem | undefined {
  return ITEMS_BY_ID.get(itemId);
}

/** Οι γραμμές ενός προφίλ, με τη σειρά του καταλόγου. */
export function itemsForProfile(profile: ConveyanceProfile): readonly ChecklistItem[] {
  const excluded = new Set(PROFILE_EXCLUSIONS[profile]);
  return CONVEYANCE_CHECKLIST.filter((item) => !excluded.has(item.id));
}

/** Οι γραμμές μιας διαδικασίας, με τη σειρά της διαδικασίας. */
export function itemsForProcedure(procedure: ConveyanceProcedure): readonly ChecklistItem[] {
  return procedure.itemIds
    .map((id) => ITEMS_BY_ID.get(id))
    .filter((item): item is ChecklistItem => item !== undefined);
}
