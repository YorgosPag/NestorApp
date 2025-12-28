/**
 * COMPANY GEMI HELP TEXTS
 *
 * Κεντρικοποιημένα help texts για όλα τα company GEMI fields
 * Uses established centralized help text system από modal-select
 *
 * @version 1.0.0 - ENTERPRISE HELP TEXTS
 * @updated 2025-12-28 - Split from monolithic company-gemi-config.ts
 */

// ENTERPRISE: Import από centralized modal-select system
import { MODAL_SELECT_COMPANY_HELP_TEXTS } from '../../../subapps/dxf-viewer/config/modal-select/core/options/company';

// ============================================================================
// HELP TEXTS MAPPING
// ============================================================================

/**
 * Company field help texts mapping
 * Maps existing centralized help texts σε expected property names
 * Enterprise pattern: Consistent help text system
 */
export const gemiHelps = {
  // Basic Info Help Texts
  company_name_help: MODAL_SELECT_COMPANY_HELP_TEXTS.BUSINESS_NAME,
  trade_name_help: MODAL_SELECT_COMPANY_HELP_TEXTS.TRADE_NAME,
  vat_number_help: MODAL_SELECT_COMPANY_HELP_TEXTS.AFM,
  gemi_number_help: MODAL_SELECT_COMPANY_HELP_TEXTS.GEMI_NUMBER,
  legal_form_help: MODAL_SELECT_COMPANY_HELP_TEXTS.LEGAL_FORM,
  company_status_help: 'Κατάσταση εταιρείας στο ΓΕΜΗ',

  // Activities Help Texts
  kad_code_help: MODAL_SELECT_COMPANY_HELP_TEXTS.ACTIVITY_CODE,
  business_description_help: 'Περιγραφή επιχειρηματικής δραστηριότητας',
  activity_category_help: 'Κατηγορία δραστηριότητας',
  chamber_office_help: 'Επιμελητήριο εγγραφής',

  // Capital Help Texts
  capital_amount_help: MODAL_SELECT_COMPANY_HELP_TEXTS.CAPITAL,
  currency_help: 'Νόμισμα κεφαλαίου',
  guarantee_capital_help: 'Εγγυημένα κεφάλαια',

  // Dates & Location Help Texts
  registration_date_help: 'Ημερομηνία εγγραφής στο ΓΕΜΗ',
  last_change_date_help: 'Ημερομηνία τελευταίας μεταβολής',
  region_help: 'Περιφέρεια έδρας',
  municipality_help: 'Δήμος έδρας',
  local_office_help: 'Τοπική υπηρεσία ΓΕΜΗ',

  // Address Help Texts
  address_type_help: 'Τύπος διεύθυνσης',
  street_help: 'Όνομα οδού',
  street_number_help: 'Αριθμός οδού',
  postal_code_help: 'Ταχυδρομικός κώδικας',
  city_help: 'Πόλη έδρας',
  region_address_help: 'Περιφέρεια διεύθυνσης',

  // Shareholders Help Texts
  shareholder_name_help: 'Επωνυμία μετόχου',
  shareholder_type_help: 'Τύπος μετόχου',
  shareholder_id_help: 'Αριθμός ταυτότητας μετόχου',
  share_category_help: 'Κατηγορία μετοχών',
  participation_percentage_help: 'Ποσοστό συμμετοχής στο κεφάλαιο',
  nominal_value_help: 'Ονομαστική αξία μετοχής',

  // Documents Help Texts
  document_category_help: 'Κατηγορία εγγράφου',
  document_date_help: 'Ημερομηνία έκδοσης εγγράφου',
  document_subject_help: 'Θέμα εγγράφου',

  // Decisions Help Texts
  decision_date_help: 'Ημερομηνία λήψης απόφασης',
  decision_subject_help: 'Θέμα απόφασης',
  protocol_number_help: 'Αριθμός πρωτοκόλλου απόφασης',

  // Representatives Help Texts
  representative_name_help: 'Ονοματεπώνυμο εκπροσώπου',
  representative_role_help: 'Θέση ή ιδιότητα στην εταιρεία',
  representative_tax_help: 'Αριθμός Φορολογικού Μητρώου εκπροσώπου',
  representative_doy_help: 'Δημόσια Οικονομική Υπηρεσία',
  representative_email_help: 'Email επικοινωνίας εκπροσώπου',
  representative_phone_help: 'Τηλέφωνο επικοινωνίας εκπροσώπου',

  // History Help Texts
  version_date_help: 'Ημερομηνία καταχώρησης μεταβολής',
  change_description_help: 'Περιγραφή της μεταβολής (π.χ. αλλαγή επωνυμίας)',
  previous_value_help: 'Προηγούμενη τιμή πεδίου (αν εφαρμόζεται)',
  new_value_help: 'Νέα τιμή μετά τη μεταβολή',

  // Announcements Help Texts
  announcement_date_help: 'Ημερομηνία δημοσίευσης ανακοίνωσης',
  issue_paper_help: 'Όνομα επίσημου φύλλου (π.χ. ΦΕΚ)',
  announcement_subject_help: 'Περιγραφή θέματος ανακοίνωσης',
  announcement_summary_help: 'Σύντομη περίληψη ανακοίνωσης',
  announcement_file_help: 'Link ή path αρχείου ανακοίνωσης',

  // Statuses Help Texts
  current_status_help: 'Τρέχουσα κατάσταση εταιρείας',
  status_change_date_help: 'Ημερομηνία αλλαγής κατάστασης',
  status_reason_help: 'Αιτιολογία αλλαγής κατάστασης',
  previous_status_help: 'Κατάσταση πριν την τελευταία αλλαγή',

  // Relationships Help Texts
  relationships_summary_help: 'Στατιστικά και περίληψη σχέσεων εταιρείας',

  // Additional Fields Help Texts
  document_url_help: 'URL για download εγγράφου',
  decision_summary_help: 'Σύντομη περίληψη απόφασης',
  organ_type_help: 'Όργανο που έλαβε την απόφαση',
} as const;

/**
 * Type-safe help text accessor
 * Enterprise pattern: Type-safe access σε help texts
 */
export type GemiHelpTextKey = keyof typeof gemiHelps;