import 'server-only';

/**
 * @fileoverview Ποιος πάροχος πληρωμών εξυπηρετεί αυτή την εταιρεία — **ο λογαριασμός εμπόρου** (ADR-ACC-030 §5)
 * @description Σήμερα: **ένας** λογαριασμός εμπόρου από το περιβάλλον (πλασματικός, sandbox). Αύριο: ρύθμιση ανά
 *   εταιρεία (κρυπτογραφημένα κλειδιά — εκτός εμβέλειας). Οι καταναλωτές (checkout, webhook, συμφιλίωση) ρωτούν
 *   **μόνο** εδώ, άρα η μετάβαση δεν αγγίζει κανέναν τους.
 *
 *   Χωρίς ρυθμισμένο λογαριασμό ⇒ `null`: η δημόσια σελίδα δεν δείχνει κάρτα / IRIS (μένει η μεταφορά) και το
 *   webhook απαντά 503 (ο πάροχος ξαναδοκιμάζει ώσπου να ρυθμιστεί).
 */

import type { PaymentProvider, PaymentProviderId } from './payment-provider';
import { createEverypayProvider } from './providers/everypay/everypay-adapter';
import { judgeEverypayConfig } from './providers/everypay/everypay-config';

/** Ο πάροχος με αυτό το id, αν είναι ρυθμισμένος. */
export function paymentProviderById(id: PaymentProviderId): PaymentProvider | null {
  switch (id) {
    case 'everypay': {
      const verdict = judgeEverypayConfig(process.env);
      return verdict.configured ? createEverypayProvider(verdict.credentials) : null;
    }
  }
}

/**
 * Ο πάροχος της εταιρείας. Το `companyId` είναι το σημείο όπου θα κουμπώσει ο λογαριασμός εμπόρου ανά εταιρεία·
 * σήμερα όλες μοιράζονται τον ένα λογαριασμό sandbox του περιβάλλοντος.
 */
export function paymentProviderForCompany(companyId: string): PaymentProvider | null {
  return companyId === '' ? null : paymentProviderById('everypay');
}
