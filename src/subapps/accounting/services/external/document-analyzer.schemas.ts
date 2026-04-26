/**
 * Document Analyzer Schemas + Prompts — ADR-ACC-005.
 *
 * OpenAI Strict Mode rules (CLAUDE.md):
 * - ALL props in `required`
 * - Optional → `type: ['string', 'null']` AND in required
 * - ALL objects `additionalProperties: false`
 * - NO `oneOf`/`anyOf` at root
 */

// ============================================================================
// CLASSIFY SCHEMA
// ============================================================================

export const EXPENSE_CLASSIFY_SCHEMA = {
  name: 'expense_classify',
  description: 'Classify an expense document by type and suggested category',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      documentType: {
        type: 'string',
        enum: [
          'purchase_invoice',
          'receipt',
          'utility_bill',
          'telecom_bill',
          'fuel_receipt',
          'bank_statement',
          'other',
        ],
      },
      suggestedCategory: {
        type: 'string',
        enum: [
          'third_party_fees', 'rent', 'utilities', 'telecom', 'fuel',
          'vehicle_expenses', 'vehicle_insurance', 'office_supplies',
          'software', 'equipment', 'travel', 'training', 'advertising',
          'efka', 'professional_tax', 'bank_fees', 'tee_fees',
          'depreciation', 'other_expense',
        ],
      },
      typeConfidence: { type: 'number' },
      categoryConfidence: { type: 'number' },
      alternativeCategories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: [
                'third_party_fees', 'rent', 'utilities', 'telecom', 'fuel',
                'vehicle_expenses', 'vehicle_insurance', 'office_supplies',
                'software', 'equipment', 'travel', 'training', 'advertising',
                'efka', 'professional_tax', 'bank_fees', 'tee_fees',
                'depreciation', 'other_expense',
              ],
            },
            confidence: { type: 'number' },
          },
          required: ['category', 'confidence'],
          additionalProperties: false,
        },
      },
    },
    required: [
      'documentType',
      'suggestedCategory',
      'typeConfidence',
      'categoryConfidence',
      'alternativeCategories',
    ],
    additionalProperties: false,
  },
} as const;

// ============================================================================
// EXTRACT SCHEMA
// ============================================================================

export const EXPENSE_EXTRACT_SCHEMA = {
  name: 'expense_extract',
  description: 'Extract structured data from an expense document (invoice, receipt, bill)',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      issuerName: { type: ['string', 'null'] },
      issuerVatNumber: { type: ['string', 'null'] },
      issuerAddress: { type: ['string', 'null'] },
      documentNumber: { type: ['string', 'null'] },
      issueDate: { type: ['string', 'null'] },
      netAmount: { type: ['number', 'null'] },
      vatAmount: { type: ['number', 'null'] },
      grossAmount: { type: ['number', 'null'] },
      vatRate: { type: ['number', 'null'] },
      lineItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            quantity: { type: ['number', 'null'] },
            unitPrice: { type: ['number', 'null'] },
            netAmount: { type: 'number' },
            vatRate: { type: ['number', 'null'] },
          },
          required: ['description', 'quantity', 'unitPrice', 'netAmount', 'vatRate'],
          additionalProperties: false,
        },
      },
      paymentMethod: {
        type: ['string', 'null'],
        enum: ['cash', 'bank_transfer', 'card', 'check', 'credit', 'mixed', null],
      },
      overallConfidence: { type: 'number' },
    },
    required: [
      'issuerName', 'issuerVatNumber', 'issuerAddress', 'documentNumber',
      'issueDate', 'netAmount', 'vatAmount', 'grossAmount', 'vatRate',
      'lineItems', 'paymentMethod', 'overallConfidence',
    ],
    additionalProperties: false,
  },
} as const;

// ============================================================================
// SYSTEM PROMPTS (Greek-first, multilingual aware)
// ============================================================================

export const CLASSIFY_SYSTEM_PROMPT = `Είσαι AI σύστημα ταξινόμησης παραστατικών για ελληνικό τεχνικό γραφείο (μηχανικός/κατασκευαστής).

Αναγνώρισε τον τύπο του εγγράφου:
- purchase_invoice: Τιμολόγιο αγοράς (ΤΠΥ/ΤΠ) — έχει ΑΦΜ εκδότη, αρ. παραστατικού
- receipt: Απόδειξη (ΑΛΠ/ΑΠΥ) — μικρό ποσό, λιανική
- utility_bill: ΔΕΚΟ (ΔΕΗ, ΕΥΔΑΠ, φυσικό αέριο)
- telecom_bill: Τηλεπικοινωνίες (OTE, Vodafone, Wind, Cosmote)
- fuel_receipt: Απόδειξη καυσίμων (βενζινάδικο)
- bank_statement: Τραπεζικό αντίγραφο κίνησης
- other: Λοιπά

Κατηγοριοποίησε στη σωστή κατηγορία εξόδου. Δώσε confidence 0-100.
Επέστρεψε ΜΟΝΟ JSON σύμφωνα με το schema.`;

export const EXTRACT_SYSTEM_PROMPT = `Είσαι AI σύστημα εξαγωγής δεδομένων από ελληνικά παραστατικά εξόδων.

Εξάγαγε τα ακόλουθα πεδία:
- issuerName: Επωνυμία εκδότη (η εταιρεία που εξέδωσε)
- issuerVatNumber: ΑΦΜ εκδότη (9 ψηφία)
- issuerAddress: Διεύθυνση εκδότη
- documentNumber: Αριθμός παραστατικού
- issueDate: Ημερομηνία (ISO 8601: YYYY-MM-DD)
- netAmount: Καθαρό ποσό (χωρίς ΦΠΑ)
- vatAmount: Ποσό ΦΠΑ
- grossAmount: Μικτό ποσό (συνολικό)
- vatRate: Συντελεστής ΦΠΑ (6, 13, 24)
- lineItems: Γραμμές αν υπάρχουν
- paymentMethod: Τρόπος πληρωμής αν αναγράφεται
- overallConfidence: Βαθμός εμπιστοσύνης 0-100

Αν δεν αναγνωρίζεις κάποιο πεδίο, βάλε null. Μην μαντεύεις.
Επέστρεψε ΜΟΝΟ JSON σύμφωνα με το schema.`;
