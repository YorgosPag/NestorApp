/**
 * **Το σύνορο ανάγνωσης της βιτρίνας προμηθευτή** (ADR-923 §5.13 Δ6, CHECK 3.74).
 *
 * 🔒 Η παρουσία του εγγράφου είναι η πύλη κάθε δημόσιας σελίδας προμηθευτή. Έγγραφο που δεν περνά το κλειστό σχήμα απαντά
 *    `null`: η σελίδα κλείνει, δεν ανοίγει με μισά στοιχεία.
 *
 * @module subapps/catalog/public/supplier-showcase-from-document
 */

import { z } from 'zod';

import type { SupplierShowcaseRecord } from '../types/supplier-verification';

const supplierShowcaseSchema = z
  .object({
    companyId: z.string().min(1),
    legalName: z.string().min(1),
    basis: z.enum(['registry', 'manual-review']),
    publishedAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export function supplierShowcaseFromDocument(raw: unknown, companyId: string): SupplierShowcaseRecord | null {
  const parsed = supplierShowcaseSchema.safeParse(raw);
  if (!parsed.success || parsed.data.companyId !== companyId) return null;
  return parsed.data;
}
