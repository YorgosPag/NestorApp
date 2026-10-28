'use client';

/**
 * «Προσθήκη στις επαφές» για προσφορά πύλης **χωρίς** επαφή (ADR-327 §8.5 Γ) — BuildingConnected «Unknown Company»
 * → «Add to directory». Ποτέ αυτόματα: ο PM αποφασίζει. Η ροή (εύρεση με email/όνομα πριν από δημιουργία) είναι
 * του `useBindQuoteVendor` — ίδια με τον έλεγχο σαρωμένης προσφοράς.
 *
 * Η προσφορά ενημερώνεται ζωντανά (`onSnapshot`), οπότε μετά το δέσιμο το κουμπί εξαφανίζεται μόνο του.
 *
 * @module subapps/procurement/components/QuoteVendorContactAction
 */

import { UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getErrorMessage } from '@/lib/error-utils';
import type { Quote } from '../types/quote';
import { useBindQuoteVendor } from '../hooks/useBindQuoteVendor';
import { quoteLacksVendorContact } from '../utils/quote-vendor-identity';

export function QuoteVendorContactAction({ quote }: { quote: Pick<Quote, 'id' | 'vendorContactId' | 'vendorSnapshot'> }) {
  const { t } = useTranslation('quotes');
  const { binding, bind } = useBindQuoteVendor(quote.id);
  const snapshot = quote.vendorSnapshot;
  if (!snapshot || !quoteLacksVendorContact(quote)) return null;

  const addToContacts = async () => {
    try {
      const vendor = await bind({ name: snapshot.name || null, emails: snapshot.email ? [snapshot.email] : [] });
      const params = { vendorName: vendor.displayName };
      toast.success(vendor.wasCreated ? t('quotes.vendorContact.created', params) : t('quotes.vendorContact.linked', params));
    } catch (error) {
      toast.error(getErrorMessage(error, t('quotes.vendorContact.failed')));
    }
  };

  return (
    <aside className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border bg-muted p-2 text-xs">
      <p className="flex-1 text-muted-foreground">
        {t('quotes.vendorContact.notInContacts', { email: snapshot.email ?? '—' })}
      </p>
      <Button size="sm" variant="outline" onClick={addToContacts} disabled={binding} aria-busy={binding}>
        {binding ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden /> : <UserPlus className="mr-1 h-3.5 w-3.5" aria-hidden />}
        {t('quotes.vendorContact.add')}
      </Button>
    </aside>
  );
}
