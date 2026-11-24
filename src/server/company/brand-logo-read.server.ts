import 'server-only';

/**
 * @fileoverview **Ανάγνωση του λογοτύπου εταιρείας στον server** — ο τρέχων δείκτης του χώρου (ADR-ACC-018 §17).
 * @module server/company/brand-logo-read.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { brandLogoOf } from '@/lib/company/brand-logo-ref';
import type { CompanyBrandLogo } from '@/types/company-brand';

/** Το τρέχον λογότυπο του χώρου, ή `null` (κανένα / άκυρο σχήμα / δεν υπάρχει έγγραφο). */
export async function readCompanyBrandLogo(companyId: string): Promise<CompanyBrandLogo | null> {
  const snapshot = await getAdminFirestore().collection(COLLECTIONS.COMPANIES).doc(companyId).get();
  return snapshot.exists ? brandLogoOf(snapshot.data()) : null;
}
