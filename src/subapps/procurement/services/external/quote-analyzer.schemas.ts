/**
 * Quote Analyzer Schemas + Prompts — ADR-327 §6.
 *
 * OpenAI Strict Mode rules (CLAUDE.md):
 * - ALL props in `required`
 * - Optional → `type: ['string', 'null']` AND in required
 * - ALL objects `additionalProperties: false`
 * - NO `oneOf`/`anyOf` at root
 *
 * Schema strategy: flat value-based + parallel `confidence` object (per-field 0-100).
 * Client wraps into `FieldWithConfidence<T>` after parse to match ExtractedQuoteData.
 */

// ============================================================================
// CLASSIFY SCHEMA — is this image/PDF actually a quote?
// ============================================================================

export const QUOTE_CLASSIFY_SCHEMA = {
  name: 'quote_classify',
  description: 'Classify whether the document is a vendor quote/προσφορά and detect language',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      isQuote: { type: 'boolean' },
      confidence: { type: 'number' },
      detectedLanguage: { type: 'string' },
    },
    required: ['isQuote', 'confidence', 'detectedLanguage'],
    additionalProperties: false,
  },
} as const;

// ============================================================================
// EXTRACT SCHEMA — flat value object + parallel confidence object
// ============================================================================

const VAT_RATE_NULLABLE = { type: ['number', 'null'] } as const;

const QUOTE_LINE_ITEM = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    descriptionConfidence: { type: 'number' },
    quantity: { type: ['number', 'null'] },
    quantityConfidence: { type: 'number' },
    unit: { type: ['string', 'null'] },
    unitConfidence: { type: 'number' },
    unitPrice: { type: ['number', 'null'] },
    unitPriceConfidence: { type: 'number' },
    vatRate: VAT_RATE_NULLABLE,
    vatRateConfidence: { type: 'number' },
    lineTotal: { type: ['number', 'null'] },
    lineTotalConfidence: { type: 'number' },
  },
  required: [
    'description', 'descriptionConfidence',
    'quantity', 'quantityConfidence',
    'unit', 'unitConfidence',
    'unitPrice', 'unitPriceConfidence',
    'vatRate', 'vatRateConfidence',
    'lineTotal', 'lineTotalConfidence',
  ],
  additionalProperties: false,
} as const;

const HEADER_FIELDS = [
  'vendorName', 'vendorVat', 'vendorPhone', 'vendorEmail',
  'quoteDate', 'validUntil', 'quoteReference',
  'paymentTerms', 'deliveryTerms', 'warranty', 'notes', 'tradeHint',
] as const;

const TOTALS_FIELDS = ['subtotal', 'vatAmount', 'totalAmount'] as const;

function buildConfidenceProps() {
  const props: Record<string, { type: 'number' }> = {};
  for (const k of HEADER_FIELDS) props[k] = { type: 'number' };
  for (const k of TOTALS_FIELDS) props[k] = { type: 'number' };
  return props;
}

const CONFIDENCE_KEYS = [...HEADER_FIELDS, ...TOTALS_FIELDS];

export const QUOTE_EXTRACT_SCHEMA = {
  name: 'quote_extract',
  description: 'Extract structured quote data (vendor info, lines, totals, terms) with per-field confidence 0-100',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      vendorName: { type: ['string', 'null'] },
      vendorVat: { type: ['string', 'null'] },
      vendorPhone: { type: ['string', 'null'] },
      vendorEmail: { type: ['string', 'null'] },
      quoteDate: { type: ['string', 'null'] },
      validUntil: { type: ['string', 'null'] },
      quoteReference: { type: ['string', 'null'] },
      lineItems: { type: 'array', items: QUOTE_LINE_ITEM },
      subtotal: { type: ['number', 'null'] },
      vatAmount: { type: ['number', 'null'] },
      totalAmount: { type: ['number', 'null'] },
      paymentTerms: { type: ['string', 'null'] },
      deliveryTerms: { type: ['string', 'null'] },
      warranty: { type: ['string', 'null'] },
      notes: { type: ['string', 'null'] },
      tradeHint: { type: ['string', 'null'] },
      detectedLanguage: { type: 'string' },
      overallConfidence: { type: 'number' },
      confidence: {
        type: 'object',
        properties: buildConfidenceProps(),
        required: [...CONFIDENCE_KEYS],
        additionalProperties: false,
      },
    },
    required: [
      'vendorName', 'vendorVat', 'vendorPhone', 'vendorEmail',
      'quoteDate', 'validUntil', 'quoteReference',
      'lineItems', 'subtotal', 'vatAmount', 'totalAmount',
      'paymentTerms', 'deliveryTerms', 'warranty', 'notes', 'tradeHint',
      'detectedLanguage', 'overallConfidence', 'confidence',
    ],
    additionalProperties: false,
  },
} as const;

// ============================================================================
// SYSTEM PROMPTS (Greek-first, multilingual aware per Q14)
// ============================================================================

export const QUOTE_CLASSIFY_PROMPT = `Είσαι AI σύστημα ταξινόμησης παραστατικών για ελληνικό τεχνικό γραφείο/εργολάβο.

Στόχος: Διάγνωσε αν το αρχείο είναι **προσφορά προμηθευτή** (quote/quotation/προσφορά τιμών).

Ενδείξεις προσφοράς:
- Τίτλος "ΠΡΟΣΦΟΡΑ" / "QUOTE" / "QUOTATION" / "PREVENTIVO"
- Δομή: εκδότης (προμηθευτής), λίστα ειδών με τιμές, σύνολα, ισχύς προσφοράς
- ΟΧΙ τιμολόγιο (τιμολόγιο = ήδη πραγματοποιημένη πώληση)

Αν είναι τιμολόγιο/απόδειξη/άλλο → isQuote: false.
Αν είναι σαφώς προσφορά → isQuote: true.
Confidence: 0-100 ανάλογα με τη βεβαιότητά σου.
detectedLanguage: ISO code (el, en, it, de, fr) ή 'unknown'.

Επέστρεψε ΜΟΝΟ JSON σύμφωνα με το schema.`;

export const QUOTE_EXTRACT_PROMPT = `Είσαι AI σύστημα εξαγωγής δεδομένων από προσφορές προμηθευτών (κατασκευαστικό κλάδο).

Εξάγαγε τα ακόλουθα πεδία ΜΕ confidence 0-100 για κάθε ένα:

**ΣΤΟΙΧΕΙΑ ΠΡΟΜΗΘΕΥΤΗ:**
- vendorName: Επωνυμία προμηθευτή (η εταιρεία που εκδίδει την προσφορά)
- vendorVat: ΑΦΜ προμηθευτή (9 ψηφία ελληνικά)
- vendorPhone: Τηλέφωνο επικοινωνίας
- vendorEmail: Email επικοινωνίας

**ΣΤΟΙΧΕΙΑ ΠΡΟΣΦΟΡΑΣ:**
- quoteDate: Ημερομηνία έκδοσης (ISO 8601: YYYY-MM-DD)
- validUntil: Ισχύει μέχρι (ISO 8601)
- quoteReference: Αρ. προσφοράς (αν αναγράφεται)

**ΓΡΑΜΜΕΣ (lineItems):**
Για κάθε γραμμή: description, quantity, unit (τμχ/m/m²/m³/kg/lt/kit/h), unitPrice, vatRate (0|6|13|24), lineTotal.
Δώσε confidence για ΚΑΘΕ πεδίο της γραμμής.

**ΣΥΝΟΛΑ:**
- subtotal: Καθαρό σύνολο
- vatAmount: ΦΠΑ
- totalAmount: Μικτό σύνολο

**ΟΡΟΙ:**
- paymentTerms: Όροι πληρωμής (π.χ. "30 ημέρες", "προκαταβολή 30%")
- deliveryTerms: Όροι παράδοσης (π.χ. "5 εργάσιμες", "FCO έργο")
- warranty: Εγγύηση (π.χ. "2 έτη", "10 έτη στεγανοποίηση")
- notes: Λοιπές παρατηρήσεις
- tradeHint: Κατηγορία ειδικότητας (αν είναι προφανής: π.χ. "ηλεκτρολογικά", "υδραυλικά", "πλακάκια")

**ΓΛΩΣΣΑ:**
- detectedLanguage: ISO (el, en, it, de, fr)

**Confidence αντικείμενο:** Για κάθε πεδίο header/totals (όχι lineItems) δώσε confidence 0-100.
**overallConfidence:** Συνολικός βαθμός εμπιστοσύνης 0-100.

ΚΑΝΟΝΕΣ:
- Αν δεν αναγνωρίζεις πεδίο → null + confidence: 0. ΜΗΝ μαντεύεις.
- Αν τιμή είναι θολή/μη ευκρινής → confidence ≤ 50.
- ISO ημερομηνίες πάντα. Αρ. χωρίς νομισματικά σύμβολα.

Επέστρεψε ΜΟΝΟ JSON σύμφωνα με το schema.`;
