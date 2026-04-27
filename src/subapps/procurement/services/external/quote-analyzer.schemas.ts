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
// RAW TYPES — shape returned by OpenAI for QUOTE_EXTRACT_SCHEMA (pre-normalize)
// ============================================================================

export interface RawComponent {
  description: string;
  descriptionConfidence: number;
  quantity: number | null;
  quantityConfidence: number;
  unit: string | null;
  unitConfidence: number;
  unitPrice: number | null;
  unitPriceConfidence: number;
  discountPercent: number | null;
  discountPercentConfidence: number;
  vatRate: number | null;
  vatRateConfidence: number;
  lineTotal: number | null;
  lineTotalConfidence: number;
}

export interface RawLineItem {
  rowNumber: string | null;
  description: string;
  descriptionConfidence: number;
  rowSubtotal: number | null;
  rowSubtotalConfidence: number;
  components: RawComponent[];
}

export interface RawExtractedQuote {
  tableStructureNotes: string;
  vendorName: string | null;
  vendorVat: string | null;
  vendorPhone: string | null;
  vendorEmail: string | null;
  vendorAddress: string | null;
  vendorCity: string | null;
  vendorPostalCode: string | null;
  vendorCountry: string | null;
  quoteDate: string | null;
  validUntil: string | null;
  quoteReference: string | null;
  lineItems: RawLineItem[];
  subtotal: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  warranty: string | null;
  notes: string | null;
  tradeHint: string | null;
  detectedLanguage: string;
  overallConfidence: number;
  confidence: Record<string, number>;
}

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

// Component = leaf-level row (no children). Mirrors κούφωμα|ρολό|kit-component.
const QUOTE_COMPONENT = {
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
    discountPercent: { type: ['number', 'null'] },
    discountPercentConfidence: { type: 'number' },
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
    'discountPercent', 'discountPercentConfidence',
    'vatRate', 'vatRateConfidence',
    'lineTotal', 'lineTotalConfidence',
  ],
  additionalProperties: false,
} as const;

// Parent line = numbered row (001, 002…) that may bundle multiple components.
const QUOTE_LINE_ITEM = {
  type: 'object',
  properties: {
    rowNumber: { type: ['string', 'null'] },
    description: { type: 'string' },
    descriptionConfidence: { type: 'number' },
    rowSubtotal: { type: ['number', 'null'] },
    rowSubtotalConfidence: { type: 'number' },
    components: { type: 'array', items: QUOTE_COMPONENT },
  },
  required: [
    'rowNumber', 'description', 'descriptionConfidence',
    'rowSubtotal', 'rowSubtotalConfidence', 'components',
  ],
  additionalProperties: false,
} as const;

const HEADER_FIELDS = [
  'vendorName', 'vendorVat', 'vendorPhone', 'vendorEmail',
  'vendorAddress', 'vendorCity', 'vendorPostalCode', 'vendorCountry',
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
      // CoT reasoning step — written FIRST to ground subsequent extraction.
      tableStructureNotes: { type: 'string' },
      vendorName: { type: ['string', 'null'] },
      vendorVat: { type: ['string', 'null'] },
      vendorPhone: { type: ['string', 'null'] },
      vendorEmail: { type: ['string', 'null'] },
      vendorAddress: { type: ['string', 'null'] },
      vendorCity: { type: ['string', 'null'] },
      vendorPostalCode: { type: ['string', 'null'] },
      vendorCountry: { type: ['string', 'null'] },
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
      'tableStructureNotes',
      'vendorName', 'vendorVat', 'vendorPhone', 'vendorEmail',
      'vendorAddress', 'vendorCity', 'vendorPostalCode', 'vendorCountry',
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

export const QUOTE_EXTRACT_PROMPT = `Είσαι AI σύστημα εξαγωγής δεδομένων από προσφορές προμηθευτών (κατασκευαστικό κλάδο). Δουλεύεις σαν Google Document AI — πρώτα κατανοείς τη δομή, μετά εξάγεις.

# ΒΗΜΑ 1 — tableStructureNotes (ΥΠΟΧΡΕΩΤΙΚΟ, ΓΡΑΨΕ ΠΡΩΤΟ)

Πριν εξάγεις δεδομένα, γράψε ΣΥΝΤΟΜΟ (3-6 γραμμές) στο πεδίο \`tableStructureNotes\`:
1. Αριθμός σελίδων.
2. Πόσες αριθμημένες γραμμές βλέπεις (\`001, 002, 003…\` ή \`1, 2, 3…\` ή \`Α/Α\`).
3. Σε κάθε αριθμημένη γραμμή: ΜΙΑ μόνο γραμμή προϊόντος ή ΠΟΛΛΑΠΛΑ υπο-εξαρτήματα (π.χ. κούφωμα + ρολό);
4. Ποιες στήλες αριθμών υπάρχουν στην tabella (π.χ. "ποσότητα | τιμή μονάδος | έκπτωση % | αξία") και η σειρά τους.
5. Αν υπάρχει "Σύνοψη/Summary" στο τέλος → πόσα τμχ ανά κατηγορία αναφέρει.

Αυτό το βήμα είναι reasoning — βελτιώνει την ακρίβεια. Μην παραλείψεις.

# ΒΗΜΑ 2 — Εξαγωγή

**ΣΤΟΙΧΕΙΑ ΠΡΟΜΗΘΕΥΤΗ:**
- vendorName: Επωνυμία προμηθευτή (η εταιρεία που εκδίδει την προσφορά)
- vendorVat: ΑΦΜ/ΕΙΚ προμηθευτή. ΚΡΙΣΙΜΟΣ ΚΑΝΟΝΑΣ — ΠΟΤΕ μην μπερδεύεις ΑΦΜ με IBAN.
  Αποδεκτές μορφές ανά χώρα:
  • Ελλάδα (GR): ΑΠΟΚΛΕΙΣΤΙΚΑ 9 ψηφία (π.χ. "123456789")
  • Βουλγαρία (BG): 9 ψηφία (ΕΙΚ εταιρείας) ή 10 ψηφία (ΕΓΝ φυσικού προσώπου), ή με πρόθεμα "BG" + 9-10 ψηφία (π.χ. "BG123456789")
  Τι ΔΕΝ είναι ΑΦΜ:
  • IBAN = ξεκινά με "GR" + 26 ψηφία = 28 χαρακτήρες (π.χ. "GR1601101250000000012300695"). Τραπεζικός λογαριασμός — ΟΧΙ ΑΦΜ.
  • Αν βρεις αριθμό που ξεκινά με "GR" και έχει >4 χαρακτήρες → IBAN → βάλε null + confidence: 0.
  • Αν δεν υπάρχει σαφής ΑΦΜ/ΕΙΚ → null + confidence: 0. ΜΗΝ μαντεύεις.
- vendorPhone: Τηλέφωνο της εταιρείας που ΕΚΔΙΔΕΙ την προσφορά (ο προμηθευτής). ΟΧΙ το τηλέφωνο του παραλήπτη/πελάτη. Βρίσκεται στα στοιχεία επικεφαλίδας του προμηθευτή, ΟΧΙ στη γραμμή "Προς:" / "Πελάτης:" / "Αποστολή προς:".
- vendorEmail: Email επικοινωνίας
- vendorAddress: Οδός + αριθμός της έδρας προμηθευτή (π.χ. "ул. Хан Аспарух 15"). Null αν δεν αναγράφεται.
- vendorCity: Πόλη/οικισμός έδρας (π.χ. "Русе", "Θεσσαλονίκη", "Milano"). Null αν δεν αναγράφεται.
- vendorPostalCode: ΤΚ έδρας (π.χ. "7000", "54621", "20121"). Null αν δεν αναγράφεται.
- vendorCountry: Χώρα ISO κωδικός 2 γραμμάτων (π.χ. "GR", "BG", "IT", "DE"). Συμπέρανε από στοιχεία εγγράφου (ΑΦΜ μορφή, γλώσσα, postal code). Null αν αδύνατη η εκτίμηση.

**ΣΤΟΙΧΕΙΑ ΠΡΟΣΦΟΡΑΣ:**
- quoteDate: Ημερομηνία έκδοσης (ISO 8601: YYYY-MM-DD). Συνώνυμα: "Ημ/νία εισαγωγής", "Input Date", "Ημερομηνία προσφοράς".
- validUntil: Ισχύει μέχρι (ISO 8601). ΚΡΙΣΙΜΟ:
  • Αν αναγράφεται ρητή ημερομηνία λήξης → χρησιμοποίησέ τη.
  • Αν αναγράφεται διάρκεια τύπου "ισχύει X ημέρες/μέρες" ή "valid for X days" → ΥΠΟΛΟΓΙΣΕ: \`validUntil = quoteDate + X days\` (confidence 70-90 για υπολογισμό).
  • ΜΗΝ μπερδεύεις validUntil με "Ημ/νία παράδοσης / Delivery Date" — αυτή είναι ΑΛΛΟ πεδίο (πάει στο deliveryTerms αν δεν έχει σχέση με την ισχύ).
- quoteReference: Αρ. προσφοράς (αν αναγράφεται)

**ΓΡΑΜΜΕΣ (lineItems) — HIERARCHICAL ΔΟΜΗ:**

Κάθε στοιχείο του \`lineItems\` array αντιστοιχεί σε ΜΙΑ αριθμημένη γραμμή του παραστατικού (\`001, 002, 003…\`).

Για κάθε αριθμημένη γραμμή συμπλήρωσε:
- \`rowNumber\`: Αύξων αριθμός όπως φαίνεται (\`"001"\`, \`"1"\`, \`"A1"\`). Αν δεν υπάρχει αρίθμηση → null.
- \`description\`: Τίτλος της γραμμής (π.χ. "ΔΙΦΥΛΛΟ ΔΕΞΙΑ τζάμι 2 εποχών 1.260X2.085").
- \`rowSubtotal\`: Συνολική αξία της αριθμημένης γραμμής μετά εκπτώσεων (π.χ. 325,4 €). Αν δεν αναγράφεται → null.
- \`components\`: Array με ΟΛΑ τα υπο-εξαρτήματα της γραμμής. Αν η γραμμή είναι απλή (1 προϊόν), βάλε ένα μόνο component.

ΚΑΘΕ component:
- \`description\`: Όνομα υπο-εξαρτήματος (π.χ. "Aluplast Ideal 4000 round-line UF 1,3 ΛΕΥΚΟ").
- \`quantity\`: Ποσότητα. Διάβαζε ΑΠΟΚΛΕΙΣΤΙΚΑ από την αριθμητική στήλη ποσότητας (Τεμάχια/Τεμ/Qty/Ποσ). ΠΟΤΕ μην χρησιμοποιείς αριθμούς από το όνομα του προϊόντος ως ποσότητα — π.χ. "183x183" ή "1260x2085" είναι ΔΙΑΣΤΑΣΕΙΣ (mm/cm), ΟΧΙ ποσότητα. Αν η γραμμή δεν έχει ξεχωριστή στήλη ποσότητας → 1.
- \`unit\`: Μονάδα (τμχ/m/m²/m³/kg/lt/kit/h).
- \`unitPrice\`: Καθαρή τιμή μονάδος (ΠΡΙΝ έκπτωση).
- \`discountPercent\`: Ποσοστό έκπτωσης (π.χ. 47 για 47%). Αν δεν υπάρχει στήλη → null.
- \`vatRate\`: 0|6|13|24.
- \`lineTotal\`: Τελική αξία υπο-εξαρτήματος ΜΕΤΑ έκπτωση (π.χ. 240,6).

Δώσε confidence 0-100 για ΚΑΘΕ πεδίο.

ΚΡΙΣΙΜΑ ΟΡΙΖΟΝΤΙΚΗΣ ΕΥΘΥΓΡΑΜΜΙΣΗΣ ΣΤΗΛΩΝ (most important):
- ΚΑΘΕ αριθμός που εξάγεις πρέπει να διαβάζεται από την ΙΔΙΑ ΣΕΙΡΑ του πίνακα. Δεν ανακατεύεις τιμές μεταξύ γραμμών.
- Αν η εικόνα του προϊόντος καταλαμβάνει 2 σειρές οπτικά, η αντιστοιχία \`unitPrice/discount/lineTotal\` παραμένει ΣΤΗΝ ΙΔΙΑ ΣΕΙΡΑ ΚΕΙΜΕΝΟΥ.
- Επαλήθευσε εσωτερικά: \`lineTotal ≈ unitPrice × quantity × (1 - discountPercent/100)\`. Αν δεν ταιριάζει → ξαναδιαβάζεις τη σειρά.
- Επαλήθευσε εσωτερικά: \`rowSubtotal ≈ Σ(components.lineTotal)\`. Αν δεν ταιριάζει → λάθος αντιστοίχιση κάποιου component.

ΑΝΑΓΝΩΡΙΣΗ ΓΡΑΜΜΩΝ:
- Ψάξε ΟΛΟΥΣ τους αύξοντες αριθμούς. ΜΗΝ παραλείπεις. Αν Σύνοψη λέει "ΚΟΥΦΩΜΑ 3" → πρέπει να βρεις 3 lineItems.
- Διάβασε ΟΛΕΣ τις σελίδες.
- Αν Σύνοψη υπάρχει → ο σύνολος των \`Σ(components.quantity)\` πρέπει να ταιριάζει με τα totals της Σύνοψης.

ΓΛΩΣΣΑΡΙΟ — ΔΙΟΡΘΩΣΕ OCR ARTIFACTS ΣΕ ΤΕΧΝΙΚΑ ΟΝΟΜΑΤΑ:
Το OCR μερικές φορές παραμορφώνει ελληνικά τεχνικά ονόματα. Εφόσον το συγκείμενο υποδεικνύει κατασκευαστικό/κουφωματικό προϊόν, διόρθωσε αυτόματα:
- "ΔΕΣΙΤ", "ΔΕΣΙΤ." → ΔΕΞΙΑ (τύπος ανοίγματος κουφώματος)
- "τάφ" → τζάμι (υαλοπίνακας)
- "ΠΛΑΝΤΖΟΠΥ", "ΠΛΑΝΤΖΟΠΗ", "ΓΙΑΝΤΖΟΥΡΗ", "ΙΑΝΤΖΟΥΡΗ", "ΑΤΖΟΥΡΗ", "ΑΝΤΖΟΥΡΗ" → ΠΑΝΤΖΟΥΡΙ (εξωτερικό ρολό/κλείσιμο παραθύρου)
- "ΣΙΝΣΤΟ" → ΣΠΑΣΤΟ (τύπος ρολού — ρολό σπαστό)
- "ΚΟΥΦΩΜΑ", "ΚΟΥΦΩΜΑΤΑ", "ΡΟΛΟ ΕΞΩΤΕΡΙΚΟ", "ΔΙΦΥΛΛΟ", "ΜΟΝΟΦΥΛΛΟ" = σωστά (μην αλλάζεις)

**ΣΥΝΟΛΑ:**
- subtotal: Καθαρό σύνολο
- vatAmount: ΦΠΑ
- totalAmount: Μικτό σύνολο

**ΟΡΟΙ:**
- paymentTerms: Όροι πληρωμής. Ψάξε σε ΟΛΕΣ τις σελίδες για ετικέτες όπως:
  • Ελληνικά: "Τρόπος Πληρωμής", "Όροι Πληρωμής", "Πληρωμή"
  • Αγγλικά: "Payment Terms", "Payment Options", "Payment Conditions"
  • Βουλγαρικά: "Начин на плащане", "Условия за плащане", "Начин на разплащане"
  • Ιταλικά: "Condizioni di pagamento", "Pagamento"
  Παραδείγματα τιμών: "30 ημέρες", "προκαταβολή 30%", "50% advance + 50% on delivery", "30 дни".
  Αν δεν βρεθεί ΚΑΜΙΑ πληροφορία πληρωμής πουθενά στο έγγραφο → null + confidence: 0.
- deliveryTerms: Όροι παράδοσης. Συμπεριλαμβάνει: "5 εργάσιμες", "FCO έργο", "κατόπιν συνεννοήσης", "παράδοση Θεσσαλονίκη". Αν αναγράφεται "Ημ/νία παράδοσης" στο header → πέρασέ τη ΕΔΩ (όχι στο validUntil).
- warranty: Εγγύηση (π.χ. "2 έτη", "10 έτη στεγανοποίηση")
- notes: Λοιπές παρατηρήσεις. ΣΥΛΛΕΞΕ από ΟΛΕΣ τις σελίδες: όρους ισχύος, δικαιοδοσία, προειδοποιήσεις, μεταφορά. Γράψε ΜΟΝΟ στα Ελληνικά — αν το έγγραφο είναι σε άλλη γλώσσα, μετάφρασε στα ελληνικά. Null μόνο αν δεν υπάρχει ΤΙΠΟΤΑ.
- tradeHint: Κατηγορία ειδικότητας (αν είναι προφανής: π.χ. "ηλεκτρολογικά", "υδραυλικά", "πλακάκια", "κουφώματα", "ρολά").

**ΓΛΩΣΣΑ:**
- detectedLanguage: ISO (el, en, it, de, fr)

**Confidence αντικείμενο:** Για κάθε πεδίο header/totals (όχι lineItems) δώσε confidence 0-100.
**overallConfidence:** Συνολικός βαθμός εμπιστοσύνης 0-100.

ΚΑΝΟΝΕΣ:
- Αν δεν αναγνωρίζεις πεδίο → null + confidence: 0. ΜΗΝ μαντεύεις.
- Αν τιμή είναι θολή/μη ευκρινής → confidence ≤ 50.
- ISO ημερομηνίες πάντα. Αρ. χωρίς νομισματικά σύμβολα.

Επέστρεψε ΜΟΝΟ JSON σύμφωνα με το schema.`;
