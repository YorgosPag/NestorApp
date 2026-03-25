/* eslint-disable custom/no-hardcoded-strings */
/**
 * =============================================================================
 * AI TAB MAPPING — Dynamic Tab-to-Field Mapping for AI Agent
 * =============================================================================
 *
 * Reads EXISTING section configs (SSoT) and generates compact text
 * for the AI system prompt, so the agent knows which fields belong
 * to which tab/section for each entity type.
 *
 * Architecture:
 * - ZERO duplication of field IDs — dynamically extracted from configs
 * - Greek labels are a small static map (labels rarely change)
 * - Module-level caching (configs are static at build time)
 * - Server-safe — no React/DOM dependencies
 *
 * @module config/ai-tab-mapping
 * @see ADR-171 (Autonomous AI Agent)
 */

import { INDIVIDUAL_SECTIONS } from '@/config/individual-config';
import { COMPANY_GEMI_SECTIONS } from '@/config/company-gemi';
import { SERVICE_SECTIONS } from '@/config/service-config';

// ============================================================================
// GREEK TAB LABELS (static map — labels rarely change, field IDs are dynamic)
// ============================================================================

const INDIVIDUAL_TAB_LABELS: Record<string, string> = {
  basicInfo: 'Βασικά Στοιχεία',
  identity: 'Ταυτότητα & ΑΦΜ',
  personas: 'Ιδιότητες',
  professional: 'Επαγγελματικά',
  address: 'Διεύθυνση',
  communication: 'Επικοινωνία',
  photo: 'Φωτογραφία',
  relationships: 'Σχέσεις',
  files: 'Αρχεία',
  banking: 'Τραπεζικά',
  history: 'Ιστορικό',
};

const COMPANY_TAB_LABELS: Record<string, string> = {
  basicInfo: 'Βασικά Στοιχεία',
  activities: 'Δραστηριότητες',
  addresses: 'Διευθύνσεις & Υποκαταστήματα',
  communication: 'Επικοινωνία',
  shareholders: 'Μέτοχοι & Εταίροι',
  files: 'Αρχεία',
  companyPhotos: 'Λογότυπο & Φωτογραφίες',
  relationships: 'Πρόσωπα & Ρόλοι',
  banking: 'Τραπεζικά',
};

const SERVICE_TAB_LABELS: Record<string, string> = {
  basicInfo: 'Βασικά Στοιχεία',
  address: 'Διεύθυνση',
  communication: 'Επικοινωνία',
  logo: 'Λογότυπο',
  relationships: 'Σχέσεις',
  files: 'Αρχεία',
  banking: 'Τραπεζικά',
};

// Descriptions for tabs with no queryable fields (custom renderers / subcollections)
const CONTENT_TAB_DESCRIPTIONS: Record<string, string> = {
  communication: 'phones[], emails[], websites[], socialMedia[]',
  photo: 'φωτογραφία προφίλ',
  relationships: 'contact_links (σχέσεις με επαφές)',
  files: 'αρχεία/έγγραφα (collection files)',
  banking: 'τραπεζικοί λογαριασμοί (subcollection)',
  history: 'audit trail, ιστορικό αλλαγών',
  companyPhotos: 'λογότυπο & φωτογραφίες',
  logo: 'λογότυπο υπηρεσίας',
};

// ============================================================================
// SECTION FIELD EXTRACTION (SSoT: section-field-utils.ts)
// ============================================================================

import { type SectionLike, extractRealFieldIds } from '@/config/section-field-utils';

/**
 * Generates tab mapping lines for a contact type
 */
function generateContactMapping(
  sections: ReadonlyArray<SectionLike>,
  labels: Record<string, string>
): string {
  return sections.map(section => {
    const label = labels[section.id] ?? section.id;
    const fieldIds = extractRealFieldIds(section);

    if (fieldIds.length > 0) {
      return `"${label}": ${fieldIds.join(', ')}`;
    }

    // No real fields — use description or skip
    const desc = CONTENT_TAB_DESCRIPTIONS[section.id];
    return desc ? `"${label}": ${desc}` : null;
  }).filter(Boolean).join('\n');
}

// ============================================================================
// ENTITY TAB DESCRIPTIONS (non-field-level tabs)
// ============================================================================

const BUILDING_TABS = 'Γενικά, Διευθύνσεις, Όροφοι, Μονάδες, Αποθήκες, Πάρκινγκ, Συνεργάτες, Πελάτες, Χρονοδιάγραμμα, Αναλυτικά, Επιμετρήσεις, Κάτοψη, Έγγραφα, Φωτογραφίες, Βίντεο, Ιστορικό';
const PROJECT_TABS = 'Γενικά, Διευθύνσεις, Δομή, Πίνακας Χιλιοστών, Οικοπεδούχοι, Συνεργάτες, Μεσίτες, Πελάτες, Χρονοδιάγραμμα, ΙΚΑ/ΕΦΚΑ, Κάτοψη, Πάρκινγκ, Επιμετρήσεις, Έγγραφα, Φωτογραφίες, Βίντεο, Ιστορικό';
const UNIT_TABS = 'Πληροφορίες, Κάτοψη, Έγγραφα, Φωτογραφίες, Βίντεο, Ιστορικό';
const CRM_TABS = 'Επισκόπηση, Pipeline, Επικοινωνίες, Εργασίες, Ημερολόγιο';

// ============================================================================
// MAIN GENERATOR (cached)
// ============================================================================

let cachedPrompt: string | null = null;

/**
 * Generates the complete tab mapping section for the AI system prompt.
 * Reads dynamically from existing section configs (SSoT).
 * Result is cached at module level (configs are static).
 */
export function generateTabMappingPrompt(): string {
  if (cachedPrompt) return cachedPrompt;

  const individualMapping = generateContactMapping(INDIVIDUAL_SECTIONS, INDIVIDUAL_TAB_LABELS);
  const companyMapping = generateContactMapping(COMPANY_GEMI_SECTIONS, COMPANY_TAB_LABELS);
  const serviceMapping = generateContactMapping(SERVICE_SECTIONS, SERVICE_TAB_LABELS);

  cachedPrompt = `⚠️⚠️⚠️ ΚΡΙΣΙΜΟ — ΚΑΡΤΕΛΕΣ & ΔΟΜΗ ΣΕΛΙΔΩΝ (DYNAMIC TAB MAPPING):
Η εφαρμογή οργανώνει τα δεδομένα σε ΚΑΡΤΕΛΕΣ. Όταν ο χρήστης ζητάει στοιχεία "από καρτέλα X", επέστρεψε ΜΟΝΟ τα πεδία αυτής — ΟΧΙ ΟΛΑ!

ΕΠΑΦΕΣ — Φυσικό Πρόσωπο:
${individualMapping}

ΕΠΑΦΕΣ — Εταιρεία:
${companyMapping}

ΕΠΑΦΕΣ — Δημόσια Υπηρεσία:
${serviceMapping}

ΚΤΗΡΙΑ: ${BUILDING_TABS}
ΕΡΓΑ: ${PROJECT_TABS}
ΜΟΝΑΔΕΣ/ΑΠΟΘΗΚΕΣ/ΠΑΡΚΙΝΓΚ: ${UNIT_TABS}
CRM DASHBOARD: ${CRM_TABS}

🚨🚨🚨 ΥΠΟΧΡΕΩΤΙΚΟ — SERVER-SIDE TAB FILTERING (tabFilter parameter):
Όταν ο χρήστης ζητάει "καρτέλα X" ή "στοιχεία X" για επαφή, ΠΡΕΠΕΙ να χρησιμοποιήσεις το tabFilter parameter στο firestore_query ή firestore_get_document.
Αυτό φιλτράρει τα πεδία SERVER-SIDE — θα λάβεις ΜΟΝΟ τα πεδία της ζητούμενης καρτέλας.

ΑΝΤΙΣΤΟΙΧΙΣΗ ΕΛΛΗΝΙΚΩΝ → tabFilter ID:
"βασικά στοιχεία" → tabFilter: "basicInfo"
"ταυτότητα" / "ταυτότητα & ΑΦΜ" / "ΑΦΜ" → tabFilter: "identity"
"ιδιότητες" → tabFilter: "personas"
"επαγγελματικά" → tabFilter: "professional"
"διεύθυνση" → tabFilter: "address" (ή "addresses" για εταιρεία)
"επικοινωνία" / "τηλέφωνα" / "email" → tabFilter: "communication"

Αν ΔΕΝ ζητήθηκε συγκεκριμένη καρτέλα → tabFilter: null (σύνοψη: όνομα, τηλ, email, ΑΦΜ)`;

  return cachedPrompt;
}
