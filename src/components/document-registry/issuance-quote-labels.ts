/**
 * @fileoverview ADR-915 §42 — **οι λέξεις της προσφοράς** (είδος τιμής · τι περιλαμβάνει), δεμένες στο κλειστό λεξιλόγιο
 *   του πυρήνα (`issuance-quote.ts`): νέα τιμή **δεν μεταγλωττίζεται** χωρίς λέξη. Χωριστό από τα πεδία της φόρμας, ώστε
 *   η κάρτα του γραφείου να τις χρησιμοποιεί χωρίς να φέρνει τη φόρμα στο πρώτο καρέ.
 * @module components/document-registry/issuance-quote-labels
 *
 * ⚠️ Κυριολεκτικά κλειδιά (CHECK 3.34 τα λύνει στατικά).
 */

import type { useTranslation } from '@/i18n/hooks/useTranslation';
import type { QuoteBasis, QuoteScopeItem } from '@/lib/document-validity/issuance-quote';

type Translate = ReturnType<typeof useTranslation>['t'];

export function scopeText(t: Translate, item: QuoteScopeItem): string {
  switch (item) {
    case 'site-visit': return t('document-registry:issuance.quoteForm.scope.site-visit');
    case 'issuance': return t('document-registry:issuance.quoteForm.scope.issuance');
    case 'registration': return t('document-registry:issuance.quoteForm.scope.registration');
  }
}

export function basisText(t: Translate, basis: QuoteBasis): string {
  return basis === 'indicative' ? t('document-registry:issuance.quoteForm.basisShort.indicative') : t('document-registry:issuance.quoteForm.basisShort.firm');
}
