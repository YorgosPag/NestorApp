/**
 * JSON Schema του Verifiable Quantity Envelope — ΕΝΑ σχήμα για όλες τις δυνατότητες
 *
 * Κάθε δυνατότητα δηλώνει **μόνο** το σχήμα του ωφέλιμου φορτίου της
 * (`valueSchema`)· ο φάκελος γύρω του χτίζεται εδώ. Αν κάθε εργαλείο έγραφε τον
 * δικό του φάκελο, επτά αντίγραφα θα απέκλιναν στην πρώτη αλλαγή του `envelope.ts`.
 *
 * ⚠️ **Όριο ειλικρίνειας:** αυτό είναι χειρόγραφος καθρέφτης του
 * `src/types/vqe/envelope.ts`. Το test `vqe-output-schema.test.ts` συγκρίνει τα
 * κλειδιά του σχήματος με τα κλειδιά ενός **πραγματικού** φακέλου που παράγει το
 * `buildEnvelope()` — πιάνει προσθήκη/αφαίρεση πεδίου, όχι αλλαγή τύπου.
 * Δηλώνεται ρητά αντί να υπονοείται πληρότητα που δεν υπάρχει.
 *
 * @module services/agent-capability/registry/vqe-output-schema
 * @see ADR-734 §6.2 (σχήμα), §6.5 (αποκλίσεις)
 */

import { BOQ_STATUS_LIFECYCLE_ORDER } from '@/types/boq';
import { ENVELOPE_WARNING_CODES, PROVENANCE_ACTIVITIES } from '@/types/vqe';
import { arraySchema, type JsonSchema, nullable, objectSchema } from './json-schema';

const STRING: JsonSchema = { type: 'string' };
const NUMBER: JsonSchema = { type: 'number' };
const STRING_ARRAY: JsonSchema = arraySchema(STRING);

// ============================================================================
// ΒΑΣΗ ΜΕΤΡΗΣΗΣ
// ============================================================================

const BASIS_FIELDS: Readonly<Record<string, JsonSchema>> = {
  atoeCategoryCode: nullable({ ...STRING, description: 'Κατηγορία ΑΤΟΕ, όταν ενιαία σε όλο το σύνολο.' }),
  unit: nullable({ ...STRING, description: 'Μονάδα μέτρησης, όταν ενιαία. null ⇒ ετερογενές σύνολο (π.χ. m3 + kg).' }),
  scope: nullable({ ...STRING, description: 'Εύρος (ADR-329), όταν ενιαίο.' }),
  wasteFactorApplied: nullable({ ...NUMBER, description: 'Συντελεστής φύρας, όταν ενιαίος.' }),
  costAllocationMethod: nullable({ ...STRING, description: 'Μέθοδος επιμερισμού κόστους, όταν ενιαία.' }),
  icmsCode: nullable({ ...STRING, description: 'ICMS 3 κωδικός — δηλώνεται από τον καλούντα.' }),
};

const BASIS_SCHEMA = objectSchema(
  BASIS_FIELDS,
  Object.keys(BASIS_FIELDS),
  'Με ποιον κανόνα μετρήθηκε (buildingSMART IDS / ICMS 3 / ΑΤΟΕ). null = το σύνολο δεν είναι ενιαίο ως προς το πεδίο.',
);

// ============================================================================
// ΠΡΟΕΙΔΟΠΟΙΗΣΕΙΣ
// ============================================================================

const ENVELOPE_ISSUE_SCHEMA = objectSchema(
  {
    source: { type: 'string', enum: ['envelope'] },
    code: { type: 'string', enum: [...ENVELOPE_WARNING_CODES] },
    itemIds: STRING_ARRAY,
    field: STRING,
    rawValue: STRING,
  },
  ['source', 'code'],
  'Εύρημα του ίδιου του φακέλου.',
);

const ALLOCATION_ISSUE_SCHEMA = objectSchema(
  {
    source: { type: 'string', enum: ['allocation'] },
    // Οι κωδικοί επιμερισμού ανήκουν στο `AllocationWarning` (cost-engine.ts,
    // ADR-329 §3.7.2) — δεν αντιγράφονται εδώ ούτε ως enum: το SSoT τους δεν
    // εκθέτει κατάλογο σε χρόνο εκτέλεσης και ο κώδικας του είναι αμετάβλητος
    // στις Φάσεις 1-3 (ADR-734 §9).
    detail: objectSchema(
      { type: STRING, propertyId: STRING, propertyCode: STRING },
      ['type'],
      'AllocationWarning — ADR-329 §3.7.2.',
    ),
  },
  ['source', 'detail'],
  'Εύρημα της μηχανής επιμερισμού κόστους.',
);

const WARNINGS_SCHEMA = arraySchema(
  { anyOf: [ENVELOPE_ISSUE_SCHEMA, ALLOCATION_ISSUE_SCHEMA] },
  'Προειδοποιήσεις σε ντετερμινιστική σειρά. Κενός πίνακας ≠ απουσία ελέγχου.',
);

// ============================================================================
// ΠΡΟΕΛΕΥΣΗ / ΔΙΑΚΥΒΕΡΝΗΣΗ / ΑΚΕΡΑΙΟΤΗΤΑ
// ============================================================================

const PROVENANCE_FIELDS: Readonly<Record<string, JsonSchema>> = {
  sourceItemIds: arraySchema(STRING, 'prov:Entity — τα BOQ items που συνεισέφεραν (μοναδικά, ταξινομημένα).'),
  sourceEntityIds: arraySchema(STRING, 'prov:wasDerivedFrom — BIM entity ids, όταν η ποσότητα προήλθε από γεωμετρία.'),
  computedBy: { type: 'string', enum: [...PROVENANCE_ACTIVITIES], description: 'prov:Activity — ποια συνάρτηση παρήγαγε την τιμή.' },
  computedAt: { ...STRING, description: 'prov:atTime (ISO 8601). ΔΕΝ συμμετέχει στο inputsHash.' },
  warnings: WARNINGS_SCHEMA,
};

const BASELINE_DRIFT_FIELDS: Readonly<Record<string, JsonSchema>> = {
  trackedItemCount: NUMBER,
  driftedItemCount: NUMBER,
  totalItemCount: NUMBER,
  maxAbsPercent: NUMBER,
  netQuantityDelta: nullable({ ...NUMBER, description: 'Μόνο σε ενιαία μονάδα· αλλιώς null (m3 + kg δεν αθροίζονται).' }),
  worstItemId: nullable(STRING),
  latestSyncedAt: nullable(STRING),
};

const STATUS_BREAKDOWN_FIELDS: Readonly<Record<string, JsonSchema>> = Object.fromEntries(
  BOQ_STATUS_LIFECYCLE_ORDER.map((status) => [status, NUMBER]),
);

const GOVERNANCE_FIELDS: Readonly<Record<string, JsonSchema>> = {
  effectiveStatus: {
    type: 'string',
    enum: [...BOQ_STATUS_LIFECYCLE_ORDER],
    description: 'Η ΧΑΜΗΛΟΤΕΡΗ κατάσταση του συνόλου. 99 certified + 1 draft ΔΕΝ είναι certified.',
  },
  statusBreakdown: objectSchema(STATUS_BREAKDOWN_FIELDS, Object.keys(STATUS_BREAKDOWN_FIELDS)),
  isSignable: { type: 'boolean', description: 'true ΜΟΝΟ αν υπάρχει ≥1 item και ΟΛΑ είναι certified ή locked.' },
  baselineDrift: nullable(
    objectSchema(
      BASELINE_DRIFT_FIELDS,
      Object.keys(BASELINE_DRIFT_FIELDS),
      'ADR-674. null = κανένα item δεν παρακολουθείται — ΔΙΑΦΟΡΕΤΙΚΟ από driftedItemCount: 0.',
    ),
  ),
};

const INTEGRITY_FIELDS: Readonly<Record<string, JsonSchema>> = {
  inputsHash: { ...STRING, description: 'sha256 των κανονικοποιημένων ΕΙΣΟΔΩΝ (ποτέ του αποτελέσματος).' },
  engineVersion: { ...STRING, description: '<semver>+<αποτύπωμα συμπεριφοράς του cost-engine>.' },
};

// ============================================================================
// Ο ΦΑΚΕΛΟΣ
// ============================================================================

/** Τυλίγει το σχήμα ενός ωφέλιμου φορτίου στο σχήμα του φακέλου. */
export function vqeOutputSchema(valueSchema: JsonSchema): JsonSchema {
  const fields: Readonly<Record<string, JsonSchema>> = {
    schemaVersion: { ...STRING, description: 'Έκδοση σχήματος φακέλου.' },
    value: valueSchema,
    basis: BASIS_SCHEMA,
    provenance: objectSchema(PROVENANCE_FIELDS, Object.keys(PROVENANCE_FIELDS), 'Από πού βγήκε (W3C PROV-O).'),
    governance: objectSchema(GOVERNANCE_FIELDS, Object.keys(GOVERNANCE_FIELDS), 'Πόσο δεσμευτικό είναι (ISO 19650).'),
    integrity: objectSchema(INTEGRITY_FIELDS, Object.keys(INTEGRITY_FIELDS), 'Αναπαράγεται;'),
  };
  return objectSchema(fields, Object.keys(fields), 'Verifiable Quantity Envelope (ADR-734 §6).');
}
