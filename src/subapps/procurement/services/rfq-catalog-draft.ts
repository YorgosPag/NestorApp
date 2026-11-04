import 'server-only';

/**
 * **Το πρόχειρο «Ζητήστε προσφορά» και η έκβασή του** (ADR-923 §5.13 Ε6ε · Ε6δ, Τ6).
 *
 * 🔑 `draftRfqFromCatalog`: `?catalog=` → `RfqCatalogDraft`. Αδελφός του `createRfqFromBoqItems`, όχι δεύτερο μοτίβο, και δεν
 *    γράφει τίποτα. Οι κρίσεις είναι **οι ίδιες** με της δημιουργίας (`requireQuoteSku` · `requireQuoteSupplierName`), άρα
 *    και οι αρνήσεις έχουν τους ίδιους κωδικούς και την ίδια μετάφραση.
 * 🔑 Το opt-in κρίνεται στο πρόχειρο από τη **δημόσια** προβολή, το ίδιο σήμα που έδειξε το κουμπί. Η δημιουργία το ξανακρίνει
 *    από το ιδιωτικό `quoteIntake` μέσα στη συναλλαγή (`supplierAcceptsQuotesInTx`).
 * 🔒 `catalogSuppliersSent`: ο σύνδεσμος πρόσβασης στους τιμοκαταλόγους φεύγει **μόνο** μετά από πράξη, για τον προμηθευτή που
 *    προσκλήθηκε στη συναλλαγή, και μόνο αν κάποιο SKU του κρίθηκε από τη βιτρίνα. **Το token δεν διανέμεται πριν από
 *    πράξη:** αλλιώς κάθε συνδεδεμένος θα μάζευε τα tokens όλων των προμηθευτών από το πρόχειρο (ελάχιστο προνόμιο).
 *
 * @module subapps/procurement/services/rfq-catalog-draft
 */

import type { AuthContext } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { liveSupplyRequestHref } from '@/server/supply-relationships/supply-request-link.server';
import { readPublicSupplierProfile } from '@/services/public-catalog/public-catalog.reader';

import { RfqCreateRefusal } from '../types/rfq-create-refusal';
import type { CatalogSkuAddress, RfqCatalogDraft, RfqCatalogSupplierSent } from '../types/rfq-line';
import { requireQuoteSku, requireQuoteSupplierName, type RfqCreatePlan } from './rfq-create-plan';

async function requireAcceptingSupplier(supplierCompanyId: string): Promise<string> {
  const [supplierName, profile] = await Promise.all([
    requireQuoteSupplierName(supplierCompanyId),
    readPublicSupplierProfile(supplierCompanyId),
  ]);
  if (profile?.acceptsQuoteRequests !== true) throw new RfqCreateRefusal('supplierNotAcceptingQuotes', supplierCompanyId);
  return supplierName;
}

/** Το πρόχειρο ενός SKU: κείμενο και επωνυμία, χωρίς κανέναν σύνδεσμο. */
export async function draftRfqFromCatalog(ctx: AuthContext, address: CatalogSkuAddress): Promise<RfqCatalogDraft> {
  const sku = await requireQuoteSku(ctx, address);
  const supplierName = await requireAcceptingSupplier(address.supplierCompanyId);
  return { address, description: sku.text, supplierName };
}

/**
 * Οι προμηθευτές του καταλόγου που προσκλήθηκαν, με την πρόταση πρόσβασης όπου αξίζει. Καλείται **μετά** το commit.
 * Ο σύνδεσμος διαβάζεται μόνο για προμηθευτή με SKU της βιτρίνας: με σχέση δεν υπάρχει τι να ζητηθεί.
 */
export function catalogSuppliersSent(plan: Pick<RfqCreatePlan, 'suppliers' | 'catalogLines'>): Promise<RfqCatalogSupplierSent[]> {
  const db = getAdminFirestore();
  return Promise.all(plan.suppliers.map(async ({ supplierCompanyId, legalName }) => {
    const viaShowcase = plan.catalogLines.some(({ sku }) => sku.ref.supplierCompanyId === supplierCompanyId && sku.path === 'public');
    const priceListAccessHref = viaShowcase ? await liveSupplyRequestHref(db, supplierCompanyId) : null;
    return { supplierCompanyId, supplierName: legalName, priceListAccessHref };
  }));
}
