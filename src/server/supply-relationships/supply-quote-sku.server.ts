import 'server-only';

/**
 * **Ποιο SKU ζητά προσφορά ο αγοραστής** (ADR-923 §5.13 Ε6α).
 *
 * 🔑 Χωρίς προϋπόθεση σχέσης. Με ενεργή σχέση που δείχνει το SKU μετρά η σχέση, γιατί δίνει και το κοινό της. Αλλιώς μετρά
 *    η δημόσια βιτρίνα: ό,τι βλέπει ο ανώνυμος το βλέπει και ο συνδεδεμένος, άρα το δημόσιο είναι δάπεδο και όχι άρνηση.
 * 🔒 Η βιτρίνα διαβάζεται **μόνο** από τον έναν αναγνώστη (`readPublicModel`): πύλη βιτρίνας, κρυφό ≡ ανύπαρκτο (Δ1) και tags
 *    ανάκλησης (Δ4) έρχονται μαζί του, χωρίς δεύτερο δρόμο.
 * 🔑 Ο ίδιος ο χώρος, κρυφό, ανακλημένο, ανύπαρκτο και ξένο SKU δίνουν το **ίδιο** `null`: ο επιλογέας δεν απαριθμεί καταλόγους.
 * ⛔ Καμία τιμή (Ε4). Η γραμμή που θα γραφτεί από εδώ έχει `priceSnapshot: null`.
 * @module server/supply-relationships/supply-quote-sku.server
 */

import type { AuthContext } from '@/lib/auth';
import { readPublicModel } from '@/services/public-catalog/public-catalog.reader';
import { foreignSkuRowText } from '@/subapps/catalog/pricing/foreign-sku-search';

import { resolveVisibleForeignSku, type VisibleForeignSku } from './supply-foreign-quote.server';
import { supplyRelationshipId } from './supply-relationship-store.server';

/**
 * Η διεύθυνση ενός SKU της βιτρίνας. Το μοντέλο χρειάζεται επειδή το δημόσιο έγγραφο έχει κλειδί το μοντέλο: έτσι η κρίση
 * είναι ένα `get` κατά κλειδί, χωρίς ερώτημα και χωρίς δείκτη.
 */
export interface QuoteSkuAddress {
  readonly supplierCompanyId: string;
  readonly modelId: string;
  readonly variantId: string;
}

/** Από πού κρίθηκε το SKU. Το `public` σημαίνει ότι αξίζει να προταθεί αίτημα πρόσβασης στους τιμοκαταλόγους (Ε6δ). */
export type QuoteSkuPath = 'relationship' | 'public';

/**
 * Το κριμένο SKU και το κείμενό του (κωδικός και ετικέτα). Η περιγραφή της γραμμής RFQ βγαίνει **μόνο** από εδώ (Τ4), από τον
 * ίδιο δρόμο που έκρινε το SKU: δημόσια παραλλαγή στη βιτρίνα, SKU της ξένης ανάγνωσης στη σχέση.
 */
export interface QuoteSku extends VisibleForeignSku {
  readonly path: QuoteSkuPath;
}

/** Το SKU όπως το βλέπει ο ανώνυμος, ή `null`. Χωρίς `ctx`: η βιτρίνα δεν ξέρει ποιος ρωτά. */
export async function resolvePublicSku(address: QuoteSkuAddress): Promise<VisibleForeignSku | null> {
  const model = await readPublicModel(address.supplierCompanyId, address.modelId);
  const variant = model?.variants.find((candidate) => candidate.variantId === address.variantId);
  if (variant === undefined) return null;
  return { ref: { supplierCompanyId: address.supplierCompanyId, variantId: address.variantId }, text: foreignSkuRowText(variant) };
}

/** Ο ένας επιλογέας της ροής «Ζητήστε προσφορά»: σχέση πρώτα, βιτρίνα μετά, και ποτέ ο εαυτός. */
export async function resolveQuoteSku(ctx: AuthContext, address: QuoteSkuAddress): Promise<QuoteSku | null> {
  if (address.supplierCompanyId === ctx.companyId) return null;
  const relationshipId = supplyRelationshipId({ supplierCompanyId: address.supplierCompanyId, buyerCompanyId: ctx.companyId });
  const viaRelationship = await resolveVisibleForeignSku(ctx, { relationshipId, variantId: address.variantId });
  if (viaRelationship !== null) return { ...viaRelationship, path: 'relationship' };
  const viaPublic = await resolvePublicSku(address);
  return viaPublic === null ? null : { ...viaPublic, path: 'public' };
}
