import 'server-only';

/**
 * @fileoverview «Δώσε μου το τιμολόγιο `invoiceId` **του μισθωτή** `companyId`», ή τίποτα (ADR-ACC-018 §16)
 * @description Το `repository.getInvoice` διαβάζει **με id** χωρίς να ρωτά τον μισθωτή. Στις διαδρομές της εφαρμογής
 *   ο κίνδυνος είναι μικρός. Για ό,τι ανοίγει **σύνδεσμος** (ανώνυμος επισκέπτης, δημιουργία συνδέσμου με id από
 *   σώμα) ο έλεγχος μισθωτή είναι υποχρεωτικός. Ζει εδώ, μία φορά, για τον κριτή δημιουργίας και τη συνεδρία
 *   προβολής. Ένα ξένο ή ανύπαρκτο τιμολόγιο δίνουν την **ίδια** απάντηση (`null`), ώστε να μη μαθαίνει κανείς
 *   ποια ids υπάρχουν σε άλλον μισθωτή.
 *
 * @see `share-entity-access.ts` (`mayShareEntity`, το ίδιο πρότυπο) · `lib/auth/tenant-ownership.ts`
 */

import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import type { Invoice } from '@/subapps/accounting/types';
import type { TenantContext } from '@/subapps/accounting/types/common';
import type { IAccountingRepository } from '@/subapps/accounting/types/interfaces';

export interface TenantInvoice {
  readonly invoice: Invoice;
  /** Το repository του **ίδιου** μισθωτή, για ό,τι ακολουθεί (μητρώο λογαριασμών, προφίλ, ίχνος). */
  readonly repository: IAccountingRepository;
}

/** Το τιμολόγιο, αν υπάρχει **και** ανήκει στον μισθωτή. Αλλιώς `null`. */
export async function readTenantInvoice(tenant: TenantContext, invoiceId: string): Promise<TenantInvoice | null> {
  if (!tenant.companyId || !invoiceId) return null;
  // Δυναμικά: ο κριτής συνδέσμων (`share-create-authority`) δεν φορτώνει όλη τη λογιστική για κάθε άλλο είδος.
  const { createAccountingServices } = await import('@/subapps/accounting/services/create-accounting-services');
  const { repository } = createAccountingServices(tenant);
  const invoice = await repository.getInvoice(invoiceId);
  if (invoice === null || !isPayloadOwnedByCompany(invoice, tenant.companyId)) return null;
  return { invoice, repository };
}
