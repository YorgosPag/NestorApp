/**
 * @fileoverview Status Labels Module
 * @description Extracted from modal-select.ts - STATUS LABELS
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */

import { PROJECT_STATUS_LABELS, type ProjectStatus } from '@/constants/project-statuses';

// ====================================================================
// STATUS LABELS - 🏢 ENTERPRISE CENTRALIZED
// 🌐 i18n: Uses keys from various namespaces (projects, units, common, etc.)
// ====================================================================

/**
 * 🔴 ADR-812 — ΤΟ ΛΕΞΙΛΟΓΙΟ ΚΑΤΑΣΤΑΣΗΣ ΕΡΓΟΥ ΔΕΝ ΖΕΙ ΕΔΩ.
 *
 * Εδώ υπήρχε `VOCAB_PROJECT_STATUS_LABELS` με **επτά** κλειδιά: τα πέντε ενεργά
 * του λεξιλογίου, ΣΥΝ `review`/`approved`, ΧΩΡΙΣ `deleted`. Ήταν το τέταρτο από
 * δεκατρία σώματα που έλεγαν το ίδιο πράγμα με διαφορετικό σύνολο τιμών.
 *
 * 🏆 ΓΙΑΤΙ ΕΦΥΓΑΝ ΤΑ `review`/`approved` — ΔΕΝ είναι κατάσταση ΕΡΓΟΥ, είναι
 * κατάσταση ΕΓΚΡΙΣΗΣ ΠΑΡΑΔΟΤΕΟΥ: δύο ορθογώνιοι άξονες, και **και οι τρεις
 * μεγάλοι τους κρατούν χωριστά**:
 *   · ISO 19650 — τα `S3` «suitable for review and comment», `S4` «suitable for
 *     stage approval», `B1` «shared for authorisation» είναι μεταδεδομένα του
 *     **information container**· το έργο έχει **work stages**.
 *   · Revit — `Issued` ανήκει στο **revision**, `Approved By` στο **sheet**·
 *     το έργο έχει **Phases**.
 *   · Figma — «Approved» ανήκει στο **branch**, ποτέ στο file.
 * Ενωμένα σε ένα πεδίο, ένα έργο δεν μπορεί να είναι ταυτόχρονα «σε εξέλιξη»
 * ΚΑΙ να έχει «εγκεκριμένη» άδεια — που είναι η κανονική κατάσταση κάθε
 * οικοδομής. Στη ΝΕΣΤΩΡ ο άξονας έγκρισης ζει ήδη σωστά σε λογιστικά έγγραφα,
 * παραγγελίες και προσφορές CRM.
 *
 * Μετρημένο ότι η αφαίρεση δεν αλλάζει τίποτα ορατό (2026-08-26): το ζωντανό
 * dropdown είναι το `ProjectStatusPill` και παράγεται από `ACTIVE_PROJECT_STATUSES`·
 * ο μόνος καταναλωτής που πρόσφερε τα επτά (`getFieldOptions` → `SmartDialogEngine`)
 * είναι **δομικά απρόσιτος** — και οι 6 καλούντες του `createSmartDialog` περνούν
 * `PROPERTY · CONTACT ×3 · opportunity · task`, κανένας `project`.
 *
 * ⚠️ ΜΗΝ το ξαναφέρεις εδώ. Το CHECK 3.73 το μπλοκάρει.
 */

/**
 * Centralized unit availability status labels
 * 🌐 i18n: Uses keys from units.json namespace
 */
export const VOCAB_UNIT_STATUS_LABELS = {
  available: 'properties.status.available',
  occupied: 'properties.status.occupied',
  maintenance: 'properties.status.maintenance',
  for_sale: 'properties.status.forSale',
  for_rent: 'properties.status.forRent',
  for_sale_and_rent: 'properties.status.forSaleAndRent',
  sold: 'properties.status.sold',
  rented: 'properties.status.rented',
  under_construction: 'properties.status.underConstruction',
  planned: 'properties.status.planned'
} as const;

/**
 * Centralized contact status labels
 * 🌐 i18n: Uses keys from contacts.json namespace
 */
export const VOCAB_CONTACT_STATUS_LABELS = {
  active: 'contacts.status.active',
  inactive: 'contacts.status.inactive',
  pending: 'contacts.status.pending',
  blocked: 'contacts.status.blocked',
  archived: 'contacts.status.archived',
  deleted: 'contacts.trash.deletedAt'
} as const;

/**
 * Centralized contact type labels
 * 🌐 i18n: Uses keys from contacts.json namespace
 */
export const VOCAB_CONTACT_TYPE_LABELS = {
  individual: 'contacts.types.individual',
  company: 'contacts.types.company',
  service: 'contacts.types.service'
} as const;

/**
 * Centralized property market status labels
 * 🌐 i18n: Uses keys from properties.json namespace
 */
export const VOCAB_PROPERTY_MARKET_STATUS_LABELS = {
  available: 'properties.status.available',
  reserved: 'properties.status.reserved',
  sold: 'properties.status.sold',
  pending: 'properties.status.pending',
  withdrawn: 'properties.status.withdrawn',
  expired: 'properties.status.expired',
  // 🏢 ENTERPRISE: Added for UNIT_SALE_STATUS_LABELS centralization
  not_sold: 'properties.status.notSold'
} as const;

/**
 * Centralized rental type labels
 * 🌐 i18n: Uses keys from properties.json namespace
 */
export const VOCAB_RENTAL_TYPE_LABELS = {
  rent_only: 'properties.rental.rentOnly',
  long_term: 'properties.rental.longTerm',
  short_term: 'properties.rental.shortTerm'
} as const;

/**
 * Centralized property special status labels
 * 🌐 i18n: Uses keys from properties.json namespace
 */
export const VOCAB_PROPERTY_SPECIAL_STATUS_LABELS = {
  reserved_pending: 'properties.specialStatus.reservedPending',
  contract_signed: 'properties.specialStatus.contractSigned',
  deposit_paid: 'properties.specialStatus.depositPaid',
  corporate: 'properties.specialStatus.corporate',
  not_for_sale: 'properties.specialStatus.notForSale',
  family: 'properties.specialStatus.family',
  pre_launch: 'properties.specialStatus.preLaunch',
  exclusive: 'properties.specialStatus.exclusive',
  reduced_price: 'properties.specialStatus.reducedPrice',
  urgent_sale: 'properties.specialStatus.urgentSale',
  under_renovation: 'properties.specialStatus.underRenovation',
  legal_issues: 'properties.specialStatus.legalIssues',
  inspection_required: 'properties.specialStatus.inspectionRequired',
  pending_documents: 'properties.specialStatus.pendingDocuments',
  for_sale: 'properties.status.forSale',
  for_rent: 'properties.status.forRent',
  rented: 'properties.status.rented',
  under_negotiation: 'properties.specialStatus.underNegotiation',
  available_soon: 'properties.specialStatus.availableSoon',
  landowner: 'properties.specialStatus.landowner',
  off_market: 'properties.specialStatus.offMarket',
  unavailable: 'properties.specialStatus.unavailable',
  // 🏢 ENTERPRISE: Added missing labels για property-hover/constants.ts complete coverage
  sold: 'properties.status.sold',
  reserved: 'properties.status.reserved',
  unknown: 'common-status:status.unknown'
} as const;

/**
 * Centralized storage unit status labels
 * 🌐 i18n: Uses keys from storage.json namespace
 */
export const VOCAB_STORAGE_STATUS_LABELS = {
  available: 'storage.general.status.available',
  occupied: 'storage.general.status.occupied',
  sold: 'storage.general.status.sold',
  maintenance: 'storage.general.status.maintenance',
  reserved: 'storage.general.status.reserved'
} as const;

/**
 * Centralized **severity / notice level** labels.
 * 🌐 i18n: Uses keys from common.json namespace
 *
 * 🔴 **ΛΕΓΟΤΑΝ `VOCAB_PRIORITY_LABELS` ΚΑΙ ΗΤΑΝ ΨΕΜΑ** (ADR-806 §7 #2). Δεν κρατά
 * προτεραιότητα: κρατά `none · empty · warning · attention · success · info` —
 * **σοβαρότητα/τόνο**. Η προτεραιότητα (`high · medium · low · urgent · critical`)
 * ζει στο `constants/domains/filter-labels.ts`, με **ίδιο ακριβώς όνομα**.
 *
 * 🔑 **ΜΕΤΟΝΟΜΑΣΤΗΚΕ ΑΥΤΟ ΠΟΥ ΕΛΕΓΕ ΨΕΜΑΤΑ, ΟΧΙ ΑΥΤΟ ΠΟΥ ΕΛΕΓΕ ΤΗΝ ΑΛΗΘΕΙΑ.** Το
 * DDD ονομάζει τη θεραπεία της ομωνυμίας: *«τα ονόματα των contexts μπαίνουν στη
 * γλώσσα, ώστε να μιλάς για το μοντέλο **χωρίς αμφισημία**»* — δηλαδή **μετονομασία**,
 * ποτέ ένωση: ένωση των δύο θα ισοπέδωνε δύο ξεχωριστές έννοιες σε μία.
 * ⚠️ Ο μοναδικός καταναλωτής (`core/status/StatusConstants.ts`) το χρησιμοποιεί για
 * badges `no_projects · empty · warning · alert · success · info` — **επιβεβαιώνει**
 * ότι το context είναι σοβαρότητα.
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ, ΜΗ ΛΥΜΕΝΟ**: το ίδιο το locale συγχέει τα δύο — το `common.priority`
 * κρατά **11** κλειδιά (τις 5 πραγματικές προτεραιότητες **και** τις 6 σοβαρότητες),
 * και οι 5 πρώτες είναι **διπλότυπες** του `filters.priority`. Μετακίνηση κλειδιών
 * locale είναι αλλαγή i18n με δικό της εύρος — ADR-806 §7.
 */
export const VOCAB_SEVERITY_LABELS = {
  none: 'common.priority.none',
  empty: 'common.priority.empty',
  warning: 'common.priority.warning',
  attention: 'common.priority.attention',
  success: 'common.priority.success',
  info: 'common.priority.info'
} as const;

/**
 * Centralized record state labels
 * 🌐 i18n: Uses keys from common.json namespace
 */
export const VOCAB_RECORD_STATE_LABELS = {
  new: 'common.recordState.new',
  updated: 'common.recordState.updated',
  deleted: 'common.recordState.deleted'
} as const;

/**
 * Centralized entity type labels
 * 🌐 i18n: Uses keys from common.json namespace
 */
export const VOCAB_ENTITY_TYPE_LABELS = {
  company: 'common.entityType.company',
  main: 'common.entityType.main',
  secondary: 'common.entityType.secondary'
} as const;

/**
 * Centralized document status labels
 * 🌐 i18n: Uses keys from common.json namespace
 */
export const VOCAB_DOCUMENT_STATUS_LABELS = {
  draft: 'common.documentStatus.draft',
  completed: 'common.documentStatus.completed',
  approved: 'common.documentStatus.approved'
} as const;

/**
 * Centralized property type labels
 * 🌐 i18n: Uses keys from building.json namespace
 */
export const VOCAB_PROPERTY_TYPE_LABELS = {
  studio: 'building.propertyTypes.studio',
  garsoniera: 'building.propertyTypes.garsoniera',
  apartment: 'building.propertyTypes.apartment',
  maisonette: 'building.propertyTypes.maisonette'
} as const;

// ====================================================================
// ACCESSOR FUNCTIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Get centralized project status labels
 */
export function getProjectStatusLabels(): Readonly<Record<ProjectStatus, string>> {
  return PROJECT_STATUS_LABELS;
}

/**
 * Get centralized unit status labels
 */
export function getUnitStatusLabels() {
  return VOCAB_UNIT_STATUS_LABELS;
}

/**
 * Get centralized contact status labels
 */
export function getContactStatusLabels() {
  return VOCAB_CONTACT_STATUS_LABELS;
}

/**
 * Get centralized contact type labels
 */
export function getContactTypeLabels() {
  return VOCAB_CONTACT_TYPE_LABELS;
}

/**
 * Get centralized property market status labels
 */
export function getPropertyMarketStatusLabels() {
  return VOCAB_PROPERTY_MARKET_STATUS_LABELS;
}

/**
 * Get centralized rental type labels
 */
export function getRentalTypeLabels() {
  return VOCAB_RENTAL_TYPE_LABELS;
}

/**
 * Get centralized property special status labels
 */
export function getPropertySpecialStatusLabels() {
  return VOCAB_PROPERTY_SPECIAL_STATUS_LABELS;
}

/**
 * Get centralized storage status labels
 */
export function getStorageStatusLabels() {
  return VOCAB_STORAGE_STATUS_LABELS;
}

/**
 * Get centralized priority labels
 */
export function getSeverityLabels() {
  return VOCAB_SEVERITY_LABELS;
}

/**
 * Get centralized record state labels
 */
export function getRecordStateLabels() {
  return VOCAB_RECORD_STATE_LABELS;
}

/**
 * Get centralized entity type labels
 */
export function getEntityTypeLabels() {
  return VOCAB_ENTITY_TYPE_LABELS;
}

/**
 * Get centralized document status labels
 */
export function getDocumentStatusLabels() {
  return VOCAB_DOCUMENT_STATUS_LABELS;
}

/**
 * Get centralized property type labels
 */
export function getPropertyTypeLabels() {
  return VOCAB_PROPERTY_TYPE_LABELS;
}