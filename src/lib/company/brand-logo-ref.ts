/**
 * @fileoverview **Ανάγνωση σχήματος** του λογοτύπου εταιρείας από ωμά δεδομένα (Firestore · σύρμα) — ADR-ACC-018 §17.
 * @module lib/company/brand-logo-ref
 *
 * ⛔ **ΚΑΘΑΡΟ MODULE**. Ό,τι δεν έχει **ακριβώς** το σχήμα ⇒ `null` (κανένα λογότυπο), ποτέ μισή αναφορά: ένα PDF
 *    δεν ζωγραφίζει ποτέ bytes που δεν μπορεί να αποδείξει (γενιά + sha256).
 */

import type { BrandLogoContentType, BrandLogoRef, CompanyBrandLogo } from '@/types/company-brand';

const SHA256_HEX = /^[0-9a-f]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isPositiveInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

function contentTypeOf(value: unknown): BrandLogoContentType | null {
  return value === 'image/png' || value === 'image/jpeg' ? value : null;
}

/**
 * Η αναφορά (ό,τι χρειάζεται για να ζωγραφιστεί), ή `null`. Δέχεται και το πλήρες `CompanyBrandLogo`: επιστρέφει
 * **μόνο** τα πεδία της αναφοράς — έτσι παράγεται το στιγμιότυπο `InvoiceIssuer.logo` και έτσι ξαναδιαβάζεται.
 */
export function brandLogoRefOf(value: unknown): BrandLogoRef | null {
  if (!isRecord(value)) return null;
  const contentType = contentTypeOf(value.contentType);
  const { storagePath, generation, sha256, width, height } = value;
  if (contentType === null || !isNonEmpty(storagePath) || !isNonEmpty(generation)) return null;
  if (typeof sha256 !== 'string' || !SHA256_HEX.test(sha256)) return null;
  if (!isPositiveInt(width) || !isPositiveInt(height)) return null;
  return { storagePath, generation, sha256, contentType, width, height };
}

/** Το πλήρες `companies/{id}.brandLogo` από τα δεδομένα του εγγράφου του χώρου, ή `null`. */
export function brandLogoOf(companyData: unknown): CompanyBrandLogo | null {
  if (!isRecord(companyData)) return null;
  const raw = companyData.brandLogo;
  const ref = brandLogoRefOf(raw);
  if (ref === null || !isRecord(raw)) return null;
  const { fileId, sizeBytes, updatedAt } = raw;
  if (!isNonEmpty(fileId) || !isPositiveInt(sizeBytes) || !isNonEmpty(updatedAt)) return null;
  return { ...ref, fileId, sizeBytes, updatedAt };
}
