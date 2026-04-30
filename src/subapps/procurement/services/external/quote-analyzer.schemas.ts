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

export interface RawBankAccount {
  bankName: string;
  bic: string | null;
  iban: string;
  currency: string | null;
  accountHolder: string | null;
}

// ADR-336 — signatory / sales-rep block from quote footer (natural person).
// Fields are nullable so the schema stays well-formed when the document carries
// no human signatory. All confidence values are 0–100.
export interface RawSignatory {
  firstName: string | null;
  firstNameConfidence: number;
  lastName: string | null;
  lastNameConfidence: number;
  role: string | null;
  roleConfidence: number;
  profession: string | null;
  professionConfidence: number;
  mobile: string | null;
  mobileConfidence: number;
  email: string | null;
  emailConfidence: number;
  vatNumber: string | null;
  vatNumberConfidence: number;
}

export interface RawExtractedQuote {
  tableStructureNotes: string;
  vendorName: string | null;
  vendorVat: string | null;
  vendorPhone: string | null;
  vendorEmails: string[];
  vendorAddress: string | null;
  vendorCity: string | null;
  vendorPostalCode: string | null;
  vendorCountry: string | null;
  vendorBankAccounts: RawBankAccount[];
  signatory: RawSignatory;
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
  pricingType: 'unit_prices' | 'lump_sum' | 'mixed' | null;
  vatIncluded: boolean | null;
  vatIncludedConfidence: number;
  laborIncluded: boolean | null;
  laborIncludedConfidence: number;
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

const QUOTE_BANK_ACCOUNT = {
  type: 'object',
  properties: {
    bankName: { type: 'string' },
    bic: { type: ['string', 'null'] },
    iban: { type: 'string' },
    currency: { type: ['string', 'null'] },
    accountHolder: { type: ['string', 'null'] },
  },
  required: ['bankName', 'bic', 'iban', 'currency', 'accountHolder'],
  additionalProperties: false,
} as const;

// ADR-336 — natural-person signatory (footer "Υπεύθυνος Πωλητής" block).
// Always present in the response; all fields nullable so the schema stays
// well-formed when the document carries no human signatory.
const QUOTE_SIGNATORY = {
  type: 'object',
  properties: {
    firstName: { type: ['string', 'null'] },
    firstNameConfidence: { type: 'number' },
    lastName: { type: ['string', 'null'] },
    lastNameConfidence: { type: 'number' },
    role: { type: ['string', 'null'] },
    roleConfidence: { type: 'number' },
    profession: { type: ['string', 'null'] },
    professionConfidence: { type: 'number' },
    mobile: { type: ['string', 'null'] },
    mobileConfidence: { type: 'number' },
    email: { type: ['string', 'null'] },
    emailConfidence: { type: 'number' },
    vatNumber: { type: ['string', 'null'] },
    vatNumberConfidence: { type: 'number' },
  },
  required: [
    'firstName', 'firstNameConfidence',
    'lastName', 'lastNameConfidence',
    'role', 'roleConfidence',
    'profession', 'professionConfidence',
    'mobile', 'mobileConfidence',
    'email', 'emailConfidence',
    'vatNumber', 'vatNumberConfidence',
  ],
  additionalProperties: false,
} as const;

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
  'vendorName', 'vendorVat', 'vendorPhone', 'vendorEmails',
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
      vendorEmails: { type: 'array', items: { type: 'string' } },
      vendorAddress: { type: ['string', 'null'] },
      vendorCity: { type: ['string', 'null'] },
      vendorPostalCode: { type: ['string', 'null'] },
      vendorCountry: { type: ['string', 'null'] },
      vendorBankAccounts: { type: 'array', items: QUOTE_BANK_ACCOUNT },
      signatory: QUOTE_SIGNATORY,
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
      pricingType: { type: ['string', 'null'] },
      vatIncluded: { type: ['boolean', 'null'] },
      vatIncludedConfidence: { type: 'number' },
      laborIncluded: { type: ['boolean', 'null'] },
      laborIncludedConfidence: { type: 'number' },
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
      'vendorName', 'vendorVat', 'vendorPhone', 'vendorEmails',
      'vendorAddress', 'vendorCity', 'vendorPostalCode', 'vendorCountry',
      'vendorBankAccounts', 'signatory',
      'quoteDate', 'validUntil', 'quoteReference',
      'lineItems', 'subtotal', 'vatAmount', 'totalAmount',
      'paymentTerms', 'deliveryTerms', 'warranty', 'notes', 'tradeHint',
      'pricingType', 'vatIncluded', 'vatIncludedConfidence',
      'laborIncluded', 'laborIncludedConfidence',
      'detectedLanguage', 'overallConfidence', 'confidence',
    ],
    additionalProperties: false,
  },
} as const;

// ============================================================================
// SYSTEM PROMPTS — re-exported from `quote-analyzer.prompts.ts` (extracted to
// keep this file under the Google file-size limit; ADR-336 commit).
// ============================================================================

export { QUOTE_CLASSIFY_PROMPT, QUOTE_EXTRACT_PROMPT } from './quote-analyzer.prompts';

