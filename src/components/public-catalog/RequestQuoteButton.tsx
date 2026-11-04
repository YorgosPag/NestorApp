'use client';

/**
 * **«Ζητήστε προσφορά» στη βιτρίνα** (ADR-923 §5.13 Ε6, Τ6) — νησίδα πελάτη μέσα σε σελίδα ISR.
 *
 * 🔑 Φαίνεται σε όλους, ανώνυμους και συνδεδεμένους. Ο ανώνυμος περνά από τη σύνδεση ή την εγγραφή (`loginHref`) και επιστρέφει
 *    στο **ίδιο** πρόχειρο, γιατί το πρόχειρο το κουβαλά το URL (`quoteDraftHref`, Ε6ε). Κανένα ανώνυμο έντυπο: αυτό θα ήταν
 *    κανάλι spam προς τον προμηθευτή.
 * 🔑 Η σελίδα μένει στατική: η ταυτότητα κρίνεται **εδώ**, στον φυλλομετρητή, όπως στο `ListingStayRequest`.
 * ⚠️ Το κουμπί δεν αποφασίζει τίποτα. Το SKU, το opt-in και ο εαυτός κρίνονται ξανά στον διακομιστή, στην προσυμπλήρωση και
 *    στη δημιουργία.
 *
 * @module components/public-catalog/RequestQuoteButton
 */

import { useAuth } from '@/auth/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { quoteDraftHref } from '@/lib/navigation/procurement-urls';
import { loginHref } from '@/lib/routes/return-path';
import { Link } from '@/lib/workspace/navigation';
import type { WorkspaceHref } from '@/lib/workspace/route-worlds';
import type { CatalogSkuAddress } from '@/subapps/procurement/types/rfq-line';

import { usePublicCatalogText } from './public-catalog-text';

/** Πού οδηγεί το κουμπί: ο συνδεδεμένος στο πρόχειρο, ο ανώνυμος στη σύνδεση **με επιστροφή** στο πρόχειρο. */
export function requestQuoteHref(address: CatalogSkuAddress, signedIn: boolean): WorkspaceHref {
  const draft = quoteDraftHref(address);
  return signedIn ? draft : loginHref(draft);
}

export function RequestQuoteButton({ address }: { readonly address: CatalogSkuAddress }) {
  const { t } = usePublicCatalogText();
  const { user } = useAuth();
  // ⚠️ Χωρίς δεύτερη πρόταση «θα σας ζητηθεί σύνδεση»: το route slice της σελίδας έχει σφράγιση (CHECK 3.34), και η φόρμα
  //    σύνδεσης έχει ήδη και την εγγραφή.
  return (
    <Button asChild size="sm" className="self-start">
      <Link href={requestQuoteHref(address, Boolean(user))}>{t('model.requestQuote')}</Link>
    </Button>
  );
}
