'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';

import type { Quote } from '@/subapps/procurement/types/quote';

/**
 * ΤΟ ΜΟΝΟ σημείο που αλλάζει το status μιας προσφοράς μέσω `PATCH /api/quotes/:id`.
 *
 * Κεντρικοποιήθηκε (N.0.2, CHECK 3.28): ταυτόσημη λογική ζούσε ξεχωριστά στο
 * `quotes/page.tsx` και στο `RfqDetailClient.tsx`.
 */
export function usePatchQuoteStatus(
  selectedQuote: Quote | null,
  t: (key: string) => string,
  onSuccess?: () => void | Promise<void>,
) {
  return useCallback(
    async (status: string) => {
      if (!selectedQuote) return;
      const res = await fetch(`/api/quotes/${selectedQuote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error(t('quotes.errors.updateFailed'));
        return;
      }
      await onSuccess?.();
    },
    [selectedQuote, t, onSuccess],
  );
}
