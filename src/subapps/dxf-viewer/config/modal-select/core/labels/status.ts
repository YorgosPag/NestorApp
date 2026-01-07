/**
 * @fileoverview Status Labels Module
 * @description Extracted from modal-select.ts - STATUS LABELS
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING
 */

// ====================================================================
// STATUS LABELS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Centralized project status labels
 */
export const MODAL_SELECT_PROJECT_STATUS_LABELS = {
  planning: 'Σχεδιασμός',
  in_progress: 'Σε Εξέλιξη',
  completed: 'Ολοκληρωμένο',
  on_hold: 'Σε Αναμονή',
  cancelled: 'Ακυρωμένο',
  review: 'Υπό Έλεγχο',
  approved: 'Εγκεκριμένο'
} as const;

/**
 * Centralized unit availability status labels
 */
export const MODAL_SELECT_UNIT_STATUS_LABELS = {
  available: 'Διαθέσιμο',
  occupied: 'Κατειλημμένο',
  maintenance: 'Συντήρηση',
  for_sale: 'Προς Πώληση',
  for_rent: 'Προς Ενοικίαση',
  sold: 'Πωλήθηκε',
  rented: 'Ενοικιάστηκε',
  under_construction: 'Υπό Κατασκευή',
  planned: 'Σχεδιασμένο'
} as const;

/**
 * Centralized contact status labels
 */
export const MODAL_SELECT_CONTACT_STATUS_LABELS = {
  active: 'Ενεργή',
  inactive: 'Ανενεργή',
  pending: 'Σε Αναμονή',
  blocked: 'Αποκλεισμένη',
  archived: 'Αρχειοθετημένη'
} as const;

/**
 * Centralized contact type labels
 */
export const MODAL_SELECT_CONTACT_TYPE_LABELS = {
  individual: 'Φυσικό Πρόσωπο',
  company: 'Νομικό Πρόσωπο',
  service: 'Δημόσια Υπηρεσία'
} as const;

/**
 * Centralized property market status labels
 */
export const MODAL_SELECT_PROPERTY_MARKET_STATUS_LABELS = {
  available: 'Διαθέσιμο',
  reserved: 'Κρατημένο',
  sold: 'Πωλήθηκε',
  pending: 'Εκκρεμεί',
  withdrawn: 'Αποσύρθηκε',
  expired: 'Έληξε',
  // 🏢 ENTERPRISE: Added for UNIT_SALE_STATUS_LABELS centralization
  not_sold: 'Δεν έχει πωληθεί'
} as const;

/**
 * Centralized rental type labels
 */
export const MODAL_SELECT_RENTAL_TYPE_LABELS = {
  rent_only: 'Μόνο Ενοικίαση',
  long_term: 'Μακροχρόνια Μίσθωση',
  short_term: 'Βραχυχρόνια Μίσθωση'
} as const;

/**
 * Centralized property special status labels
 */
export const MODAL_SELECT_PROPERTY_SPECIAL_STATUS_LABELS = {
  reserved_pending: 'Δεσμευμένο Εκκρεμές',
  contract_signed: 'Συμβόλαιο Υπογεγραμμένο',
  deposit_paid: 'Προκαταβολή Δεδομένη',
  corporate: 'Εταιρικό',
  not_for_sale: 'Δεν Πωλείται',
  family: 'Οικογενειακό',
  pre_launch: 'Προ-εκκίνηση',
  exclusive: 'Αποκλειστική Διάθεση',
  reduced_price: 'Μειωμένη Τιμή',
  urgent_sale: 'Επείγουσα Πώληση',
  under_renovation: 'Υπό Ανακαίνιση',
  legal_issues: 'Νομικά Προβλήματα',
  inspection_required: 'Απαιτείται Επιθεώρηση',
  pending_documents: 'Εκκρεμή Έγγραφα',
  for_sale: 'Προς Πώληση',
  for_rent: 'Προς Ενοικίαση',
  rented: 'Ενοικιασμένο',
  under_negotiation: 'Υπό Διαπραγμάτευση',
  available_soon: 'Σύντομα Διαθέσιμο',
  landowner: 'Ιδιοκτήτης Γης',
  off_market: 'Εκτός Αγοράς',
  unavailable: 'Μη Διαθέσιμο',
  // 🏢 ENTERPRISE: Added missing labels για property-hover/constants.ts complete coverage
  sold: 'Πουλημένο',
  reserved: 'Δεσμευμένο',
  unknown: 'Άγνωστο'
} as const;

/**
 * Centralized storage unit status labels
 */
export const MODAL_SELECT_STORAGE_STATUS_LABELS = {
  available: 'Διαθέσιμη',
  occupied: 'Κατειλημμένη',
  sold: 'Πωλήθηκε',
  maintenance: 'Συντήρηση',
  reserved: 'Κρατημένη'
} as const;

/**
 * Centralized priority/alert level labels
 */
export const MODAL_SELECT_PRIORITY_LABELS = {
  none: 'Χωρίς έργα',
  empty: 'Κενό',
  warning: 'Προειδοποίηση',
  attention: 'Προσοχή',
  success: 'Επιτυχία',
  info: 'Πληροφορία'
} as const;

/**
 * Centralized record state labels
 */
export const MODAL_SELECT_RECORD_STATE_LABELS = {
  new: 'Νέο',
  updated: 'Ενημερωμένο',
  deleted: 'Διαγραμμένο'
} as const;

/**
 * Centralized entity type labels
 */
export const MODAL_SELECT_ENTITY_TYPE_LABELS = {
  company: 'Εταιρεία',
  main: 'Κύριο',
  secondary: 'Δευτερεύον'
} as const;

/**
 * Centralized document status labels
 */
export const MODAL_SELECT_DOCUMENT_STATUS_LABELS = {
  draft: 'Προσχέδιο',
  completed: 'Ολοκληρωμένο',
  approved: 'Εγκεκριμένο'
} as const;

/**
 * Centralized property type labels
 */
export const MODAL_SELECT_PROPERTY_TYPE_LABELS = {
  studio: 'Στούντιο',
  garsoniera: 'Γκαρσονιέρα',
  apartment: 'Διαμέρισμα',
  maisonette: 'Μεζονέτα'
} as const;

// ====================================================================
// ACCESSOR FUNCTIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Get centralized project status labels
 */
export function getProjectStatusLabels() {
  return MODAL_SELECT_PROJECT_STATUS_LABELS;
}

/**
 * Get centralized unit status labels
 */
export function getUnitStatusLabels() {
  return MODAL_SELECT_UNIT_STATUS_LABELS;
}

/**
 * Get centralized contact status labels
 */
export function getContactStatusLabels() {
  return MODAL_SELECT_CONTACT_STATUS_LABELS;
}

/**
 * Get centralized contact type labels
 */
export function getContactTypeLabels() {
  return MODAL_SELECT_CONTACT_TYPE_LABELS;
}

/**
 * Get centralized property market status labels
 */
export function getPropertyMarketStatusLabels() {
  return MODAL_SELECT_PROPERTY_MARKET_STATUS_LABELS;
}

/**
 * Get centralized rental type labels
 */
export function getRentalTypeLabels() {
  return MODAL_SELECT_RENTAL_TYPE_LABELS;
}

/**
 * Get centralized property special status labels
 */
export function getPropertySpecialStatusLabels() {
  return MODAL_SELECT_PROPERTY_SPECIAL_STATUS_LABELS;
}

/**
 * Get centralized storage status labels
 */
export function getStorageStatusLabels() {
  return MODAL_SELECT_STORAGE_STATUS_LABELS;
}

/**
 * Get centralized priority labels
 */
export function getPriorityLabels() {
  return MODAL_SELECT_PRIORITY_LABELS;
}

/**
 * Get centralized record state labels
 */
export function getRecordStateLabels() {
  return MODAL_SELECT_RECORD_STATE_LABELS;
}

/**
 * Get centralized entity type labels
 */
export function getEntityTypeLabels() {
  return MODAL_SELECT_ENTITY_TYPE_LABELS;
}

/**
 * Get centralized document status labels
 */
export function getDocumentStatusLabels() {
  return MODAL_SELECT_DOCUMENT_STATUS_LABELS;
}

/**
 * Get centralized property type labels
 */
export function getPropertyTypeLabels() {
  return MODAL_SELECT_PROPERTY_TYPE_LABELS;
}