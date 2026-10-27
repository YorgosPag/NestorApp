/**
 * =============================================================================
 * PROCUREMENT: Αυθεντική τιμολόγηση PO στον server (ADR-330 Phase 5.5 C.2 · ADR-923 §5.11 «3γ»)
 * =============================================================================
 *
 * Η φόρμα στέλνει μόνο γραμμές· εκπτώσεις, συμβάσεις και σύνολα υπολογίζονται **εδώ** από τη
 * συλλογή `framework_agreements` — ο πελάτης δεν μπορεί να γράψει «−50%» όταν η σύμβαση δίνει 10%.
 * Request-time έλεγχος όπως SAP / Oracle / Procore (το CF `onWrite` απορρίφθηκε 2026-05-04: μία
 * μόνο διαδρομή εγγραφής, άμεση απάντηση στον χρήστη).
 *
 * Τα μαθηματικά ζουν στο `price-purchase-order-pure.ts` (ίδια με της φόρμας).
 *
 * @module lib/procurement/price-purchase-order
 */

import 'server-only';

import { listFrameworkAgreements } from '@/subapps/procurement/services/framework-agreement-service';
import type { AuthContext } from '@/lib/auth';
import { pricePurchaseOrder, type POPricing, type POPricingInput } from './price-purchase-order-pure';

/**
 * Φορτώνει τις συμβάσεις του προμηθευτή (φίλτρο `vendorContactId` στη βάση) και τιμολογεί την PO.
 * Χωρίς προμηθευτή ή έργο ⇒ τιμολόγηση χωρίς συμβάσεις (τα σύνολα υπολογίζονται πάντα).
 */
export async function loadAndPricePurchaseOrder(
  ctx: AuthContext,
  input: POPricingInput,
): Promise<POPricing> {
  const agreements =
    input.supplierId && input.projectId
      ? await listFrameworkAgreements(ctx, { vendorContactId: input.supplierId })
      : [];
  return pricePurchaseOrder(agreements, input);
}
