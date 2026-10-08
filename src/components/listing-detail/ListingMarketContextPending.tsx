import React from 'react';

import { Card } from '@/components/ui/card';

/**
 * Ο σκελετός της ενότητας «Τιμές συμβολαίων» — `loading` του `next/dynamic` (ADR-889 Φ2).
 *
 * 🔑 **Χωρίς κείμενο, επίτηδες**: η ενότητα ζει πίσω από όριο ώστε το `market-contracts` να ΜΗΝ μπαίνει στο route
 * slice της αγγελίας (CHECK 3.34). Ένας τίτλος εδώ θα χρειαζόταν το namespace στο πρώτο καρέ — δηλαδή ωμό κλειδί
 * (CHECK 3.51). Ίδιο πλαίσιο και ύψος με την ενότητα σε φόρτωση, για μηδενικό CLS.
 */
export function ListingMarketContextPending(): React.ReactElement {
  return (
    <Card asChild className="flex flex-col gap-2 p-4">
      <span aria-hidden>
        <span className="block h-6 w-48 animate-pulse rounded bg-muted" />
        <span className="block h-24 animate-pulse rounded bg-muted" />
      </span>
    </Card>
  );
}
