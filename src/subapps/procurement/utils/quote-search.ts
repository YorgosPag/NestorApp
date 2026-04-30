import { normalizeSearchText } from '@/lib/search/search';
import type { Quote } from '../types/quote';

export type SearchPattern = 'quote-number' | 'date' | 'numeric' | 'free-text';

const QUOTE_NUMBER_RE = /^q[-\s]?(\d{4})?[-\s]?\d+/i;
const DATE_DMY_RE = /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/;
const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const NUMERIC_RE = /^[€$]?\s*\d+([.,]\d{1,2})?\s*[€$]?$/;

export function detectPattern(query: string): SearchPattern {
  const q = query.trim();
  if (QUOTE_NUMBER_RE.test(q)) return 'quote-number';
  if (DATE_DMY_RE.test(q) || DATE_ISO_RE.test(q)) return 'date';
  if (NUMERIC_RE.test(q)) return 'numeric';
  return 'free-text';
}

function parseNumeric(query: string): number {
  return parseFloat(query.replace(/[€$\s]/g, '').replace(/,/g, '.'));
}

function parseQueryDate(query: string): Date | null {
  const trimmed = query.trim();
  if (DATE_ISO_RE.test(trimmed)) return new Date(trimmed);
  const parts = trimmed.split(/[/-]/);
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

// Handles both Firestore Timestamp and serialized { seconds } objects
function toMs(ts: unknown): number {
  if (!ts) return 0;
  const t = ts as { toMillis?: () => number; seconds?: number };
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  return 0;
}

function isSameDay(ts: unknown, targetDate: Date): boolean {
  const ms = toMs(ts);
  if (!ms) return false;
  const d = new Date(ms);
  return (
    d.getFullYear() === targetDate.getFullYear() &&
    d.getMonth() === targetDate.getMonth() &&
    d.getDate() === targetDate.getDate()
  );
}

function matchesNumeric(quote: Quote, numericValue: number): boolean {
  const rounded = Math.round(numericValue);
  const subtotal = quote.totals?.subtotal;
  const total = quote.totals?.total;
  return (
    (subtotal !== undefined && Math.round(subtotal) === rounded) ||
    (total !== undefined && Math.round(total) === rounded)
  );
}

function matchesFreeText(quote: Quote, tokens: string[]): boolean {
  const vendorName = quote.extractedData?.vendorName?.value ?? '';
  const lineDescs = quote.lines.map((l) => l.description).join(' ');
  const fields = [
    vendorName,
    lineDescs,
    quote.paymentTerms ?? '',
    quote.deliveryTerms ?? '',
    quote.warranty ?? '',
    quote.notes ?? '',
  ].map(normalizeSearchText);

  return tokens.every((token) => fields.some((field) => field.includes(token)));
}

/**
 * Pattern-aware quote search per ADR-328 §5.U.
 * Priority: quote-number → date → numeric → free-text.
 */
export function matchesQuote(quote: Quote, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const pattern = detectPattern(trimmed);

  switch (pattern) {
    case 'quote-number': {
      const norm = normalizeSearchText(trimmed);
      const numNorm = normalizeSearchText(quote.displayNumber);
      return numNorm.includes(norm);
    }
    case 'date': {
      const targetDate = parseQueryDate(trimmed);
      if (!targetDate) return false;
      return isSameDay(quote.submittedAt, targetDate) || isSameDay(quote.createdAt, targetDate);
    }
    case 'numeric': {
      const numericValue = parseNumeric(trimmed);
      if (isNaN(numericValue)) return false;
      return matchesNumeric(quote, numericValue);
    }
    case 'free-text':
    default: {
      const tokens = trimmed.split(/\s+/).map(normalizeSearchText).filter(Boolean);
      return matchesFreeText(quote, tokens);
    }
  }
}
