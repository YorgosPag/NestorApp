/**
 * Form data + file parsing helpers for the public vendor portal POST.
 * Pure functions, no I/O. Kept out of the route file to respect Google file
 * size standards (max 500 LOC per code file — CLAUDE.md SOS N.7.1).
 *
 * @module api/vendor/quote/[token]/parsing
 * @enterprise ADR-327 §7
 */

import 'server-only';

import { NextResponse } from 'next/server';
import type { Timestamp as ClientTimestamp } from 'firebase/firestore';
import { adminTimestampFromDateAsClient } from '@/services/vendor-portal/vendor-portal-token-service';
import type { QuoteLine } from '@/subapps/procurement/types/quote';

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB per Q25
export const MAX_IMAGES = 5;
export const MAX_PDFS = 1;
export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

export function jsonError(reason: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ success: false, error: reason, ...extra }, { status });
}

export function parseQuoteLines(raw: unknown): QuoteLine[] | null {
  if (!Array.isArray(raw)) return null;
  const out: QuoteLine[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown> | undefined;
    if (!item || typeof item !== 'object') return null;
    const description = String(item.description ?? '').trim();
    const quantity = Number(item.quantity);
    const unit = String(item.unit ?? 'τμχ');
    const unitPrice = Number(item.unitPrice);
    const vatRaw = Number(item.vatRate);
    if (!description || !Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return null;
    const vatRate: 0 | 6 | 13 | 24 =
      vatRaw === 0 || vatRaw === 6 || vatRaw === 13 ? (vatRaw as 0 | 6 | 13) : 24;
    const lineTotal = quantity * unitPrice;
    out.push({
      id: `vline_${i}_${Date.now()}`,
      description,
      categoryCode: null,
      quantity,
      unit,
      unitPrice,
      vatRate,
      lineTotal,
      notes: typeof item.notes === 'string' ? item.notes : null,
    });
  }
  return out;
}

export interface ParsedSubmission {
  lines: QuoteLine[];
  paymentTerms: string | null;
  deliveryTerms: string | null;
  warranty: string | null;
  notes: string | null;
  validUntil: ClientTimestamp | null;
}

export function readSubmission(formData: FormData): ParsedSubmission | { error: NextResponse } {
  const linesRaw = formData.get('lines');
  if (typeof linesRaw !== 'string') return { error: jsonError('lines_required', 400) };

  let parsedLinesInput: unknown;
  try {
    parsedLinesInput = JSON.parse(linesRaw);
  } catch {
    return { error: jsonError('lines_invalid_json', 400) };
  }
  const lines = parseQuoteLines(parsedLinesInput);
  if (!lines || lines.length === 0) return { error: jsonError('validationLines', 400) };

  const validUntilStr = formData.get('validUntil')?.toString().trim() || null;
  const validUntil = validUntilStr
    ? adminTimestampFromDateAsClient(new Date(validUntilStr))
    : null;

  return {
    lines,
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
      return { error: jsonError(`unsupported_type:${file.name}`, 415) };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { error: jsonError(`file_too_large:${file.name}`, 413) };
    }
    if (file.type === 'application/pdf') pdfCount++;
    else imageCount++;
  }
  if (imageCount > MAX_IMAGES) return { error: jsonError('too_many_images', 413) };
  if (pdfCount > MAX_PDFS) return { error: jsonError('too_many_pdfs', 413) };
  return { files, imageCount, pdfCount };
}
