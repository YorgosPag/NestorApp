/**
 * Vendor Mismatch Detection — ADR-327 §6 (GOL pattern).
 *
 * Strategy: VAT-first (deterministic) → fuzzy name (fallback).
 * Reuses fuzzyGreekMatch from SSOT (ai-pipeline/shared/greek-text-utils).
 *
 * @see ADR-327 — Quote Management
 * @see src/services/ai-pipeline/shared/greek-text-utils.ts — fuzzyGreekMatch SSOT
 */

import { fuzzyGreekMatch } from '@/services/ai-pipeline/shared/greek-text-utils';
import type { ExtractedQuoteData } from '../types/quote';
import type { Contact } from '@/types/contacts';

// ── Legal suffix strip ────────────────────────────────────────────────────────
// GR: ΑΕ, ΕΠΕ, ΙΚΕ, ΟΕ | BG: ЕООД, ООД, АД | INT: Ltd, LLC, Inc, GmbH, SA, SRL
const SUFFIX_RE =
  /\b(α\.?ε\.?|ε\.?π\.?ε\.?|ι\.?κ\.?ε\.?|ο\.?ε\.?|еоод|оод|ад|ltd|llc|inc|gmbh|s\.?a\.?|s\.?r\.?l\.?|b\.?v\.?|n\.?v\.?)\b\.?/gi;

function stripLegalSuffix(name: string): string {
  return name.replace(SUFFIX_RE, '').replace(/\s+/g, ' ').trim();
}

// ── VAT normalization ─────────────────────────────────────────────────────────
// Strips "BG" prefix (Bulgarian EU VAT), spaces, lowercases for comparison.
function normalizeVat(vat: string | null | undefined): string {
  if (!vat) return '';
  return vat.replace(/^BG/i, '').replace(/\s/g, '').toLowerCase();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type MismatchType = 'vat' | 'name' | 'none';

export interface VendorMismatchResult {
  hasMismatch: boolean;
  type: MismatchType;
  extractedVendorName: string | null;
  extractedVat: string | null;
  confidence: number;
}

const MIN_VAT_CONFIDENCE = 60;
const MIN_NAME_CONFIDENCE = 50;

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Detect whether the AI-extracted vendor matches the user-selected contact.
 *
 * Primary path: VAT comparison (deterministic — BG prefix stripped).
 * Fallback: fuzzy name match (handles Greek/Latin transliteration, legal suffixes).
 * Returns hasMismatch=false when confidence is too low to determine.
 */
export function detectVendorMismatch(
  extracted: ExtractedQuoteData,
  contact: Contact,
): VendorMismatchResult {
  const extractedVat = extracted.vendorVat.value ?? null;
  const extractedName = extracted.vendorName.value ?? null;
  const vatConfidence = extracted.vendorVat.confidence;
  const nameConfidence = extracted.vendorName.confidence;

  const contactVat = normalizeVat(
    contact.vatNumber ?? (contact as Record<string, unknown>)['taxNumber'] as string | undefined,
  );
  // Contact name: try all possible fields (individual/company/service contacts).
  const contactName = (
    contact.displayName ??
    contact.name ??
    (contact.firstName && contact.lastName ? `${contact.firstName} ${contact.lastName}` : null) ??
    contact.firstName ??
    contact.companyName ??
    contact.serviceName ??
    contact.legalName ??
    contact.tradeName ??
    ''
  ) as string;

  // Primary: VAT match (deterministic)
  if (extractedVat && vatConfidence >= MIN_VAT_CONFIDENCE && contactVat) {
    const vatMatch = normalizeVat(extractedVat) === contactVat;
    return {
      hasMismatch: !vatMatch,
      type: vatMatch ? 'none' : 'vat',
      extractedVendorName: extractedName,
      extractedVat,
      confidence: vatConfidence,
    };
  }

  // Fallback: fuzzy name match (Greek/Latin/suffix-tolerant)
  if (extractedName && nameConfidence >= MIN_NAME_CONFIDENCE && contactName) {
    const normExtracted = stripLegalSuffix(extractedName);
    const normContact = stripLegalSuffix(contactName);
    const nameMatch =
      fuzzyGreekMatch(normContact, normExtracted) ||
      fuzzyGreekMatch(normExtracted, normContact);
    return {
      hasMismatch: !nameMatch,
      type: nameMatch ? 'none' : 'name',
      extractedVendorName: extractedName,
      extractedVat,
      confidence: nameConfidence,
    };
  }

  // Insufficient confidence — cannot determine mismatch
  return {
    hasMismatch: false,
    type: 'none',
    extractedVendorName: extractedName,
    extractedVat,
    confidence: 0,
  };
}
