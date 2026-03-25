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
// SECTION FIELD EXTRACTION
// ============================================================================

interface SectionLike {
  id: string;
  fields: ReadonlyArray<{ id: string }>;
}

/**
 * Extracts real (non-dummy) field IDs from a section.
 * Convention: dummy fields have field.id === section.id
 */
function extractRealFieldIds(section: SectionLike): string[] {
  if (!section.fields || section.fields.length === 0) return [];
  return section.fields
    .filter(f => f.id !== section.id) // skip dummy trigger fields
    .map(f => f.id);
}

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

🚨🚨🚨 ΤΕΡΜΑΤΙΚΟΣ ΚΑΝΟΝΑΣ ΦΙΛΤΡΑΡΙΣΜΑΤΟΣ ΚΑΡΤΕΛΩΝ:
Αν ο χρήστης ζητήσει "καρτέλα X" ή "στοιχεία X", ΑΠΑΓΟΡΕΥΕΤΑΙ να δείξεις πεδία ΑΛΛΩΝ καρτελών!
ΒΗΜΑ 1: Βρες ποια καρτέλα ζητήθηκε (αντιστοίχισε με τα παραπάνω)
ΒΗΜΑ 2: Φιλτράρε — δείξε ΑΠΟΚΛΕΙΣΤΙΚΑ τα πεδία εκείνης της καρτέλας
ΒΗΜΑ 3: Αν ένα πεδίο ΔΕΝ ανήκει στην καρτέλα → ΜΗΝ ΤΟ ΔΕΙΞΕΙΣ

ΠΑΡΑΔΕΙΓΜΑ: "βασικά στοιχεία" = ΜΟΝΟ firstName, lastName, fatherName, motherName, birthDate, birthCountry, gender, amka
ΟΧΙ vatNumber (ανήκει στην "Ταυτότητα & ΑΦΜ"), ΟΧΙ documentType/documentNumber (ανήκουν στην "Ταυτότητα"), ΟΧΙ phones/emails (ανήκουν στην "Επικοινωνία")

ΠΑΡΑΔΕΙΓΜΑ: "ταυτότητα" ή "ταυτότητα & ΑΦΜ" = ΜΟΝΟ documentType, documentNumber, documentIssuer, documentIssueDate, documentExpiryDate, vatNumber, taxOffice
ΟΧΙ firstName/lastName (ανήκουν στα "Βασικά"), ΟΧΙ phones (ανήκουν στην "Επικοινωνία")

Αν ΔΕΝ ζητήθηκε συγκεκριμένη καρτέλα → σύνοψη (όνομα, τηλ, email, ΑΦΜ)`;

  return cachedPrompt;
}
