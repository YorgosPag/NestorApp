/**
 * =============================================================================
 * INVOICE ENTITY EXTRACTOR — Structured Data from Greek Invoices
 * =============================================================================
 *
 * Phase 2 of document preview: when Phase 1 identifies documentType === 'invoice',
 * this service runs a second OpenAI Vision call with an invoice-specific schema
 * to extract structured issuer (εκδότης) and customer (συναλλασσόμενος) data.
 *
 * The extracted entities are injected into the enriched message so the AI agent
 * can create full contacts on demand (e.g., "δημιούργησε την επαφή του εκδότη").
 *
 * @module services/ai-pipeline/invoice-entity-extractor
 * @see document-preview-service.ts (Phase 1 — general preview)
 * @see ADR-264 (Document Preview Mode)
 */

import 'server-only';

import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { isRecord } from '@/lib/type-guards';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  isImageMime,
  extractOutputText,
} from './tools/handlers/contact-document-classifier';
import type { VisionContent } from './tools/handlers/contact-document-classifier';

const logger = createModuleLogger('INVOICE_EXTRACT');

// ============================================================================
// TYPES
// ============================================================================

export interface InvoiceEntity {
  name: string | null;
  profession: string | null;
  street: string | null;
  streetNumber: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  vatNumber: string | null;
  taxOffice: string | null;
  email: string | null;
}

export interface InvoiceIssuer extends InvoiceEntity {
  registrationNumber: string | null;
}

export interface InvoiceDetails {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  totalAmount: string | null;
  vatAmount: string | null;
  netAmount: string | null;
}

export interface InvoiceEntityResult {
  issuer: InvoiceIssuer;
  customer: InvoiceEntity;
  invoiceDetails: InvoiceDetails;
}

export interface InvoiceExtractionParams {
  fileBuffer: Buffer;
  filename: string;
  contentType: string;
  fileRecordId: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const EXTRACTION_TIMEOUT_MS = 15_000;

// ============================================================================
// SCHEMA (OpenAI strict JSON — all fields required + nullable)
// ============================================================================

const ENTITY_PROPERTIES = {
  name: { type: ['string', 'null'], description: 'Ονοματεπώνυμο ή Επωνυμία ΑΚΡΙΒΩΣ όπως γράφεται' },
  profession: { type: ['string', 'null'], description: 'Επάγγελμα/Δραστηριότητα (π.χ. ΥΠΗΡΕΣΙΕΣ ΜΗΧΑΝΙΚΩΝ, ΙΔΙΩΤΗΣ)' },
  street: { type: ['string', 'null'], description: 'Οδός (χωρίς αριθμό)' },
  streetNumber: { type: ['string', 'null'], description: 'Αριθμός οδού' },
  postalCode: { type: ['string', 'null'], description: 'Ταχυδρομικός κώδικας' },
  city: { type: ['string', 'null'], description: 'Πόλη/Περιοχή' },
  phone: { type: ['string', 'null'], description: 'Τηλέφωνο' },
  vatNumber: { type: ['string', 'null'], description: 'ΑΦΜ (9 ψηφία)' },
  taxOffice: { type: ['string', 'null'], description: 'ΔΟΥ (ΟΝΟΜΑ, π.χ. "ΚΑΤΕΡΙΝΗΣ", ΟΧΙ αριθμός)' },
  email: { type: ['string', 'null'], description: 'Email' },
} as const;

const INVOICE_EXTRACTION_SCHEMA = {
  name: 'invoice_entity_extraction',
  description: 'Extract structured issuer and customer entities from a Greek invoice/receipt.',
  strict: true,
  schema: {
    type: 'object',
    required: ['issuer', 'customer', 'invoiceDetails'],
    additionalProperties: false,
    properties: {
      issuer: {
        type: 'object',
        required: [
          'name', 'profession', 'street', 'streetNumber', 'postalCode',
          'city', 'phone', 'vatNumber', 'taxOffice', 'registrationNumber', 'email',
        ],
        additionalProperties: false,
        properties: {
          ...ENTITY_PROPERTIES,
          registrationNumber: { type: ['string', 'null'], description: 'Αριθμός Γ.Ε.ΜΗ' },
        },
      },
      customer: {
        type: 'object',
        required: [
          'name', 'profession', 'street', 'streetNumber', 'postalCode',
          'city', 'phone', 'vatNumber', 'taxOffice', 'email',
        ],
        additionalProperties: false,
        properties: { ...ENTITY_PROPERTIES },
      },
      invoiceDetails: {
        type: 'object',
        required: ['invoiceNumber', 'invoiceDate', 'totalAmount', 'vatAmount', 'netAmount'],
        additionalProperties: false,
        properties: {
          invoiceNumber: { type: ['string', 'null'], description: 'Αριθμός παραστατικού' },
          invoiceDate: { type: ['string', 'null'], description: 'Ημερομηνία (DD/MM/YYYY)' },
          totalAmount: { type: ['string', 'null'], description: 'Πληρωτέο ποσό (π.χ. "496,00")' },
          vatAmount: { type: ['string', 'null'], description: 'Αξία ΦΠΑ (π.χ. "96,00")' },
          netAmount: { type: ['string', 'null'], description: 'Καθαρή αξία (π.χ. "400,00")' },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT =
  'Είσαι AI εξαγωγέας δεδομένων από ελληνικά τιμολόγια/αποδείξεις. ' +
  'Εξήγαγε τα στοιχεία ΕΚΔΟΤΗ (issuer) και ΣΥΝΑΛΛΑΣΣΟΜΕΝΟΥ/ΠΕΛΑΤΗ (customer) ' +
  'ΑΚΡΙΒΩΣ όπως εμφανίζονται στο έγγραφο. ' +
  'Ο ΕΚΔΟΤΗΣ εμφανίζεται πάνω δεξιά ή πάνω αριστερά (με ΑΦΜ, ΔΟΥ, Γ.Ε.ΜΗ). ' +
  'Ο ΣΥΝΑΛΛΑΣΣΟΜΕΝΟΣ εμφανίζεται κάτω αριστερά ή σε ξεχωριστό block ("Συναλλασσόμενος", "Πελάτης"). ' +
  'Για κάθε πεδίο: αν ΔΕΝ εμφανίζεται στο έγγραφο, βάλε null. ' +
  'ΜΗΝ μαντέψεις — ΜΟΝΟ ό,τι γράφει ΡΗΤΑ το έγγραφο. ' +
  'Για ΔΟΥ: γράψε το ΟΝΟΜΑ (π.χ. "ΚΑΤΕΡΙΝΗΣ"), ΟΧΙ τον αριθμητικό κωδικό. ' +
  'Ποσά χωρίς σύμβολο € — μόνο αριθμός (π.χ. "496,00"). ' +
  'Απάντησε ΜΟΝΟ JSON σύμφωνα με το schema.';

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Extract structured issuer/customer entities from an invoice document.
 * Returns null on failure — callers fall back to general preview only.
 */
export async function extractInvoiceEntities(
  params: InvoiceExtractionParams
): Promise<InvoiceEntityResult | null> {
  const { fileBuffer, filename, contentType, fileRecordId } = params;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('No OPENAI_API_KEY — skipping invoice extraction');
    return null;
  }

  const content = buildVisionContent(fileBuffer, filename, contentType);
  return callExtractionAPI(content, apiKey, fileRecordId);
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function buildVisionContent(
  buffer: Buffer,
  filename: string,
  contentType: string
): VisionContent[] {
  const userPrompt =
    'Εξήγαγε τα στοιχεία ΕΚΔΟΤΗ και ΣΥΝΑΛΛΑΣΣΟΜΕΝΟΥ από αυτό το παραστατικό.\n' +
    `Filename: ${filename}\nMIME: ${contentType}`;

  const content: VisionContent[] = [
    { type: 'input_text', text: userPrompt },
  ];

  const base64 = buffer.toString('base64');

  if (isImageMime(contentType)) {
    content.push({
      type: 'input_image',
      image_url: `data:${contentType};base64,${base64}`,
    });
  } else {
    content.push({
      type: 'input_file',
      filename,
      file_data: `data:${contentType};base64,${base64}`,
    });
  }

  return content;
}

async function callExtractionAPI(
  content: VisionContent[],
  apiKey: string,
  fileRecordId: string
): Promise<InvoiceEntityResult | null> {
  const baseUrl = AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL;
  const model = AI_ANALYSIS_DEFAULTS.OPENAI.VISION_MODEL;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);

    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: SYSTEM_PROMPT }] },
          { role: 'user', content },
        ],
        text: { format: { type: 'json_schema', ...INVOICE_EXTRACTION_SCHEMA } },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'no body');
      logger.warn('Invoice extraction API non-OK', {
        status: response.status,
        fileRecordId,
        error: errorBody.substring(0, 500),
      });
      return null;
    }

    const payload: unknown = await response.json();
    return parseExtractionResponse(payload, fileRecordId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.warn('Invoice extraction API error', { error: msg, fileRecordId });
    return null;
  }
}

function parseExtractionResponse(
  payload: unknown,
  fileRecordId: string
): InvoiceEntityResult | null {
  const outputText = extractOutputText(payload);
  if (!outputText) {
    logger.warn('No output_text in invoice extraction response', { fileRecordId });
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(outputText);
    if (!isRecord(parsed)) return null;

    const record = parsed as Record<string, unknown>;
    const issuer = parseIssuer(record.issuer);
    const customer = parseCustomer(record.customer);
    const invoiceDetails = parseInvoiceDetails(record.invoiceDetails);

    if (!issuer || !customer || !invoiceDetails) return null;

    logger.info('Invoice entities extracted', { fileRecordId });
    return { issuer, customer, invoiceDetails };
  } catch {
    logger.warn('Failed to parse invoice extraction JSON', { fileRecordId });
    return null;
  }
}

function parseIssuer(raw: unknown): InvoiceIssuer | null {
  if (!isRecord(raw)) return null;
  const r = raw as Record<string, unknown>;
  return {
    name: asNullableString(r.name),
    profession: asNullableString(r.profession),
    street: asNullableString(r.street),
    streetNumber: asNullableString(r.streetNumber),
    postalCode: asNullableString(r.postalCode),
    city: asNullableString(r.city),
    phone: asNullableString(r.phone),
    vatNumber: asNullableString(r.vatNumber),
    taxOffice: asNullableString(r.taxOffice),
    registrationNumber: asNullableString(r.registrationNumber),
    email: asNullableString(r.email),
  };
}

function parseCustomer(raw: unknown): InvoiceEntity | null {
  if (!isRecord(raw)) return null;
  const r = raw as Record<string, unknown>;
  return {
    name: asNullableString(r.name),
    profession: asNullableString(r.profession),
    street: asNullableString(r.street),
    streetNumber: asNullableString(r.streetNumber),
    postalCode: asNullableString(r.postalCode),
    city: asNullableString(r.city),
    phone: asNullableString(r.phone),
    vatNumber: asNullableString(r.vatNumber),
    taxOffice: asNullableString(r.taxOffice),
    email: asNullableString(r.email),
  };
}

function parseInvoiceDetails(raw: unknown): InvoiceDetails | null {
  if (!isRecord(raw)) return null;
  const r = raw as Record<string, unknown>;
  return {
    invoiceNumber: asNullableString(r.invoiceNumber),
    invoiceDate: asNullableString(r.invoiceDate),
    totalAmount: asNullableString(r.totalAmount),
    vatAmount: asNullableString(r.vatAmount),
    netAmount: asNullableString(r.netAmount),
  };
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}
