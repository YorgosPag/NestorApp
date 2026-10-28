/**
 * Form data + file parsing helpers for the public vendor portal POST.
 * Pure functions, no I/O. Kept out of the route file to respect Google file
 * size standards (max 500 LOC per code file — CLAUDE.md SOS N.7.1).
 *
 * @module api/vendor/quote/parsing
 * @enterprise ADR-327 §7
 */

import 'server-only';

import type { NextResponse } from 'next/server';
import { vendorPortalError } from '@/server/vendor-portal/vendor-link-door';
import type { Timestamp as ClientTimestamp } from 'firebase/firestore';
import { adminTimestampFromDateAsClient } from '@/services/vendor-portal/admin-client-timestamp';
import {
  VENDOR_QUOTE_ALLOWED_MIME as ALLOWED_MIME,
  VENDOR_QUOTE_MAX_FILE_BYTES as MAX_FILE_BYTES,
  VENDOR_QUOTE_MAX_IMAGES as MAX_IMAGES,
  VENDOR_QUOTE_MAX_PDFS as MAX_PDFS,
} from '@/subapps/procurement/config/vendor-quote-attachments';
import { generateQuoteLineId } from '@/services/enterprise-id.service';
import { toStoredUom } from '@/lib/uom/uom-registry';
import { RFQ_SCOPE_RESPONSES, type QuoteLine, type RfqScopeResponse } from '@/subapps/procurement/types/quote';
import type { SubmissionPayload } from '@/subapps/procurement/services/vendor-portal-submit-service';
import { quoteLineTotal } from '@/subapps/procurement/utils/quote-line-total';


const MAX_LINES = 200;
const MAX_ID_LENGTH = 128;
const MAX_NOTE_LENGTH = 500;

function readRfqLineId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH ? value : null;
}

function readNote(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_NOTE_LENGTH) : null;
}

function parseLineItem(raw: unknown): QuoteLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const description = String(item.description ?? '').trim();
  const quantity = Number(item.quantity);
  const unitPrice = Number(item.unitPrice);
  const vatRaw = Number(item.vatRate);
  if (!description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
    return null;
  }
  const vatRate: QuoteLine['vatRate'] = vatRaw === 0 || vatRaw === 6 || vatRaw === 13 ? vatRaw : 24;
  return {
    id: generateQuoteLineId(),
    description,
    categoryCode: null,
    quantity,
    unit: toStoredUom(typeof item.unit === 'string' ? item.unit : null),
    unitPrice,
    vatRate,
    lineTotal: quoteLineTotal(quantity, unitPrice),
    notes: readNote(item.notes),
    rfqLineId: readRfqLineId(item.rfqLineId),
  };
}

/** `null` = άκυρη λίστα (ΜΙΑ άκυρη γραμμή ακυρώνει το σύνολο — ποτέ σιωπηλή απόρριψη γραμμής). */
export function parseQuoteLines(raw: unknown): QuoteLine[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_LINES) return null;
  const out = raw.map(parseLineItem);
  return out.every((l): l is QuoteLine => l !== null) ? out : null;
}

/** ADR-327 §8.5 — «περιλαμβάνεται» / «εξαιρείται» ανά γραμμή RFQ. */
export function parseScopeResponses(raw: unknown): RfqScopeResponse[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_LINES) return null;
  const out: RfqScopeResponse[] = [];
  for (const item of raw) {
    const entry = (item ?? {}) as Record<string, unknown>;
    const rfqLineId = readRfqLineId(entry.rfqLineId);
    const response = RFQ_SCOPE_RESPONSES.find((r) => r === entry.response);
    if (!rfqLineId || !response) return null;
    // Η περιγραφή ξαναγράφεται από τη γραμμή RFQ (`applyRfqLineAuthority`) — ποτέ του client.
    out.push({ rfqLineId, description: readNote(entry.description) ?? '', response, note: readNote(entry.note) });
  }
  return out;
}

/** Ό,τι φτάνει στο service — ΕΝΑΣ τύπος (`SubmissionPayload`), ποτέ δεύτερο αντίγραφο του σχήματος. */
export type ParsedSubmission = SubmissionPayload;

/** Ένα πεδίο JSON του multipart· απόν ⇒ `fallback` (οι εναλλακτικές / απαντήσεις είναι προαιρετικές). */
function readJsonField(formData: FormData, name: string, fallback: unknown): { value: unknown } | { error: true } {
  const raw = formData.get(name);
  if (raw === null) return { value: fallback };
  if (typeof raw !== 'string') return { error: true };
  try {
    return { value: JSON.parse(raw) };
  } catch {
    return { error: true };
  }
}

function readAnswers(formData: FormData): Pick<ParsedSubmission, 'lines' | 'alternates' | 'scopeResponses'> | { error: NextResponse } {
  if (typeof formData.get('lines') !== 'string') return { error: vendorPortalError('lines_required', 400) };
  const linesJson = readJsonField(formData, 'lines', []);
  const alternatesJson = readJsonField(formData, 'alternates', []);
  const scopeJson = readJsonField(formData, 'scopeResponses', []);
  if ('error' in linesJson || 'error' in alternatesJson || 'error' in scopeJson) {
    return { error: vendorPortalError('lines_invalid_json', 400) };
  }
  const lines = parseQuoteLines(linesJson.value);
  const alternates = parseQuoteLines(alternatesJson.value);
  const scopeResponses = parseScopeResponses(scopeJson.value);
  if (!lines || lines.length === 0 || !alternates || !scopeResponses) {
    return { error: vendorPortalError('validationLines', 400) };
  }
  return { lines, alternates, scopeResponses };
}

export function readSubmission(formData: FormData): ParsedSubmission | { error: NextResponse } {
  const answers = readAnswers(formData);
  if ('error' in answers) return answers;

  const validUntilStr = formData.get('validUntil')?.toString().trim() || null;
  const validUntil = validUntilStr
    ? adminTimestampFromDateAsClient(new Date(validUntilStr))
    : null;

  return {
    ...answers,
    paymentTerms: formData.get('paymentTerms')?.toString().trim() || null,
    deliveryTerms: formData.get('deliveryTerms')?.toString().trim() || null,
    warranty: formData.get('warranty')?.toString().trim() || null,
    notes: formData.get('notes')?.toString().trim() || null,
    validUntil,
  };
}

export interface PreparedFiles {
  files: File[];
  imageCount: number;
  pdfCount: number;
}

export function readFiles(formData: FormData): PreparedFiles | { error: NextResponse } {
  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  let imageCount = 0;
  let pdfCount = 0;
  for (const file of files) {
    if (!ALLOWED_MIME.has(file.type)) {
      return { error: vendorPortalError(`unsupported_type:${file.name}`, 415) };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { error: vendorPortalError(`file_too_large:${file.name}`, 413) };
    }
    if (file.type === 'application/pdf') pdfCount++;
    else imageCount++;
  }
  if (imageCount > MAX_IMAGES) return { error: vendorPortalError('too_many_images', 413) };
  if (pdfCount > MAX_PDFS) return { error: vendorPortalError('too_many_pdfs', 413) };
  return { files, imageCount, pdfCount };
}
