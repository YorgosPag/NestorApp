/**
 * @fileoverview Field Labels Module
 * @description Extracted from modal-select.ts - FIELD LABELS
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING
 */

// ====================================================================
// FIELD LABELS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Company Basic Information Field Labels
 * ✅ CENTRALIZED: Single source of truth for company form field labels
 */
export const MODAL_SELECT_COMPANY_FIELD_LABELS = {
  // Basic Company Info
  company_name: 'Επωνυμία Εταιρείας',
  trade_name: 'Διακριτικός Τίτλος',
  vat_number: 'ΑΦΜ',
  gemi_number: 'Αριθμός ΓΕΜΗ',
  legal_form: 'Νομική Μορφή',
  gemi_status: 'Κατάσταση ΓΕΜΗ',
  activity_code: 'Κωδικός ΚΑΔ',
  activity_description: 'Περιγραφή Δραστηριότητας',
  activity_type: 'Τύπος Δραστηριότητας',
  chamber: 'Επιμελητήριο',
  capital_amount: 'Κεφάλαιο',
  currency: 'Νόμισμα',
  extraordinary_capital: 'Εξωλογιστικά Κεφάλαια',
  registration_date: 'Ημερομηνία Εγγραφής',
  status_date: 'Ημερομηνία Κατάστασης',
  prefecture: 'Νομός',
  municipality: 'Δήμος',
  gemi_department: 'Τοπική Υπηρεσία ΓΕΜΗ',
  address_type: 'Τύπος Διεύθυνσης',
  street: 'Οδός',
  street_number: 'Αριθμός',
  postal_code: 'Ταχυδρομικός Κώδικας',
  city: 'Πόλη',
  region: 'Περιφέρεια',
  shareholder_type: 'Τύπος Μετόχου',
  shareholder_id: 'ΑΦΜ/ΑΔΤ Μετόχου',
  share_type: 'Είδος Μετοχών',
  share_percentage: 'Ποσοστό Συμμετοχής (%)',
  nominal_value: 'Ονομαστική Αξία',
  document_type: 'Τύπος Εγγράφου',
  document_date: 'Ημερομηνία Εγγράφου',
  document_subject: 'Θέμα Εγγράφου',
  decision_date: 'Ημερομηνία Απόφασης',
  decision_subject: 'Θέμα Απόφασης',
  protocol_number: 'Αριθμός Πρωτοκόλλου',
  decision_summary: 'Περίληψη',
  version_date: 'Ημερομηνία Μεταβολής',
  change_description: 'Περιγραφή Μεταβολής',
  previous_value: 'Προηγούμενη Τιμή',
  new_value: 'Νέα Τιμή',
  representative_name: 'Πλήρες Όνομα',
  representative_role: 'Ιδιότητα/Θέση',
  representative_tax: 'ΑΦΜ Εκπροσώπου',
  representative_doy: 'ΔΟΥ',
  representative_phone: 'Τηλέφωνο',
  announcement_date: 'Ημερομηνία Ανακοίνωσης',
  issue_paper: 'Φύλλο Δημοσίευσης',
  announcement_subject: 'Θέμα Ανακοίνωσης',
  announcement_summary: 'Περίληψη',
  announcement_file: 'Αρχείο Ανακοίνωσης',
  current_status: 'Τρέχουσα Κατάσταση',
  status_change_date: 'Ημερομηνία Αλλαγής',
  status_reason: 'Λόγος Αλλαγής',
  previous_status: 'Προηγούμενη Κατάσταση',
  relationships_summary: 'Περίληψη Σχέσεων'
} as const;

/**
 * Service Form Field Labels - Centralized από service-config.ts
 * ✅ ENTERPRISE: Single source of truth για όλα τα service form labels
 */
export const MODAL_SELECT_SERVICE_FIELD_LABELS = {
  // Βασικά Στοιχεία
  service_name: 'Επωνυμία Υπηρεσίας',
  short_name: 'Συντομογραφία',
  category: 'Κατηγορία Φορέα',
  supervision_ministry: 'Εποπτεύον Υπουργείο',

  // Διοικητικά Στοιχεία
  legal_status: 'Νομικό Καθεστώς',
  establishment_law: 'Νόμος Ίδρυσης',
  head_title: 'Τίτλος Προϊσταμένου',
  head_name: 'Όνομα Προϊσταμένου',

  // Στοιχεία Επικοινωνίας
  street: 'Οδός',
  street_number: 'Αριθμός',
  city: 'Πόλη',
  postal_code: 'Τ.Κ.',
  phone: 'Τηλέφωνο Κεντρικής',
  email: 'E-mail Επικοινωνίας',
  website: 'Ιστοσελίδα',

  // Αρμοδιότητες & Υπηρεσίες
  main_responsibilities: 'Κύριες Αρμοδιότητες',
  citizen_services: 'Υπηρεσίες προς Πολίτες',
  online_services: 'Ηλεκτρονικές Υπηρεσίες',
  service_hours: 'Ώρες Εξυπηρέτησης',

  // Sections
  basic_info_section: 'Βασικά Στοιχεία',
  administrative_section: 'Διοικητικά Στοιχεία',
  contact_section: 'Στοιχεία Επικοινωνίας',
  services_section: 'Αρμοδιότητες & Υπηρεσίες',
  logo_section: 'Λογότυπο',
  relationships_section: 'Υπάλληλοι & Οργάνωση'
} as const;

/**
 * Filter Panel Titles - Centralized Source of Truth
 * ✅ ENTERPRISE: Eliminates ALL hardcoded filter titles from AdvancedFilters/configs.ts
 */
export const MODAL_SELECT_FILTER_PANEL_TITLES = {
  // Filter Panel Titles
  units: 'Φίλτρα Αναζήτησης',
  contacts: 'Φίλτρα Επαφών',
  buildings: 'Φίλτρα Κτιρίων',
  projects: 'Φίλτρα Έργων',

  // Advanced Filter Titles
  advanced: 'Προηγμένα Φίλτρα'
} as const;

/**
 * Search Placeholders - Centralized Source of Truth
 * ✅ ENTERPRISE: Eliminates ALL hardcoded search placeholders
 */
export const MODAL_SELECT_SEARCH_PLACEHOLDERS = {
  // Search Field Placeholders
  units_search: 'Όνομα, περιγραφή...',
  contacts_search: 'Όνομα, εταιρεία, email...',
  buildings_search: 'Όνομα, περιγραφή, διεύθυνση...',
  projects_search: 'Όνομα, περιγραφή, εταιρεία, τοποθεσία...',

  // Field Placeholders
  status_placeholder: 'Επιλογή κατάστασης...',
  project_placeholder: 'Επιλογή Έργου',
  building_placeholder: 'Επιλογή Κτιρίου',
  floor_placeholder: 'Επιλογή Ορόφου',
  type_placeholder: 'Επιλογή Τύπου',
  priority_placeholder: 'Επιλέξτε προτεραιότητα',
  location_placeholder: 'Επιλέξτε περιοχή',
  company_placeholder: 'Επιλέξτε εταιρεία',
  client_placeholder: 'Επιλέξτε πελάτη',
  energy_class_placeholder: 'Επιλέξτε κλάση',
  renovation_placeholder: 'Επιλέξτε κατάσταση',
  risk_level_placeholder: 'Επιλέξτε επίπεδο',
  complexity_placeholder: 'Επιλέξτε πολυπλοκότητα'
} as const;

/**
 * Field Labels - Centralized Source of Truth
 * ✅ ENTERPRISE: Eliminates ALL hardcoded field labels
 */
export const MODAL_SELECT_FIELD_LABELS = {
  // Common Field Labels
  search: 'Αναζήτηση',
  status: 'Κατάσταση',
  type: 'Τύπος',
  priority: 'Προτεραιότητα',
  location: 'Περιοχή',
  company: 'Εταιρεία',
  client: 'Πελάτης',
  project: 'Έργο',
  building: 'Κτίριο',
  floor: 'Όροφος',

  // Unit-specific Labels
  price_range: 'Εύρος Τιμής (€)',
  area_range: 'Εύρος Εμβαδού (m²)',
  property_type: 'Τύπος Ακινήτου',

  // Contact-specific Labels
  contact_type: 'Τύπος Επαφής',
  units_count: 'Πλήθος Μονάδων',
  total_area: 'Συνολικό Εμβαδόν',
  has_properties: 'Μόνο με ιδιοκτησίες',
  is_favorite: 'Αγαπημένα',
  show_archived: 'Αρχειοθετημένα',

  // Building-specific Labels
  value_range: 'Αξία (€)',
  units_range: 'Αρ. Μονάδων',
  year_range: 'Έτος Κατασκευής',
  has_parking: 'Parking',
  has_elevator: 'Ασανσέρ',
  has_garden: 'Κήπος',
  has_pool: 'Πισίνα',
  energy_class: 'Ενεργειακή Κλάση',
  accessibility: 'Προσβασιμότητα ΑΜΕΑ',
  furnished: 'Επιπλωμένο',
  renovation: 'Κατάσταση',

  // Project-specific Labels
  budget_range: 'Προϋπολογισμός (€)',
  duration_range: 'Διάρκεια (μήνες)',
  progress_range: 'Πρόοδος (%)',
  start_year_range: 'Έτος Έναρξης',
  has_permits: 'Έχει άδειες',
  has_financing: 'Έχει χρηματοδότηση',
  is_ecological: 'Οικολογικό',
  has_subcontractors: 'Έχει υπεργολάβους',
  risk_level: 'Επίπεδο κινδύνου',
  complexity: 'Πολυπλοκότητα',
  is_active: 'Μόνο ενεργά',
  has_issues: 'Έχει προβλήματα'
} as const;

/**
 * Advanced Filter Options - Centralized Source of Truth
 * ✅ ENTERPRISE: Eliminates ALL hardcoded advanced filter labels
 */
export const MODAL_SELECT_ADVANCED_FILTER_OPTIONS = {
  // Unit Features
  parking: 'Parking',
  storage: 'Αποθήκη',
  fireplace: 'Τζάκι',
  view: 'Θέα',
  pool: 'Πισίνα',

  // Contact Features
  is_favorite_contacts: 'Αγαπημένες',
  has_email: 'Με Email',
  has_phone: 'Με Τηλέφωνο',
  recent_activity: 'Πρόσφατη Δραστηριότητα'
} as const;

/**
 * Range Labels - Centralized Source of Truth
 * ✅ ENTERPRISE: Eliminates ALL hardcoded range option labels
 */
export const MODAL_SELECT_RANGE_LABELS = {
  // Units Count Options
  units_all: 'Όλες οι μονάδες',
  units_1_2: '1-2 μονάδες',
  units_3_5: '3-5 μονάδες',
  units_6_plus: '6+ μονάδες',

  // Area Options
  areas_all: 'Όλα τα εμβαδά',
  area_up_to_100: 'Έως 100 τ.μ.',
  area_101_300: '101 - 300 τ.μ.',
  area_301_plus: '301+ τ.μ.'
} as const;

/**
 * Energy Class Labels - Centralized Source of Truth
 * ✅ ENTERPRISE: Eliminates hardcoded energy class options
 */
export const MODAL_SELECT_ENERGY_CLASS_LABELS = {
  'A+': 'A+',
  'A': 'A',
  'B+': 'B+',
  'B': 'B',
  'C': 'C',
  'D': 'D',
  'E': 'E',
  'F': 'F',
  'G': 'G'
} as const;

// ====================================================================
// ACCESSOR FUNCTIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Get company field labels
 * ✅ CENTRALIZED: Getter function for company field labels
 */
export function getCompanyFieldLabels() {
  return MODAL_SELECT_COMPANY_FIELD_LABELS;
}

/**
 * Get service field labels
 * ✅ CENTRALIZED: Getter function για service form fields
 */
export function getServiceFieldLabels() {
  return MODAL_SELECT_SERVICE_FIELD_LABELS;
}

/**
 * Get filter panel titles
 * ✅ CENTRALIZED: Getter function για filter panel titles
 */
export function getFilterPanelTitles() {
  return MODAL_SELECT_FILTER_PANEL_TITLES;
}

/**
 * Get search placeholders
 * ✅ CENTRALIZED: Getter function για search placeholders
 */
export function getSearchPlaceholders() {
  return MODAL_SELECT_SEARCH_PLACEHOLDERS;
}

/**
 * Get field labels
 * ✅ CENTRALIZED: Getter function για field labels
 */
export function getFieldLabels() {
  return MODAL_SELECT_FIELD_LABELS;
}

/**
 * Get advanced filter options
 * ✅ CENTRALIZED: Getter function για advanced filter options
 */
export function getAdvancedFilterOptions() {
  return MODAL_SELECT_ADVANCED_FILTER_OPTIONS;
}

/**
 * Get range labels
 * ✅ CENTRALIZED: Getter function για range labels
 */
export function getRangeLabels() {
  return MODAL_SELECT_RANGE_LABELS;
}

/**
 * Get energy class labels
 * ✅ CENTRALIZED: Getter function για energy class labels
 */
export function getEnergyClassLabels() {
  return MODAL_SELECT_ENERGY_CLASS_LABELS;
}