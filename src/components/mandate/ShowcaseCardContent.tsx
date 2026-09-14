'use client';

/**
 * @fileoverview **`/o/<χώρος>/settings/agency-profile/card` — η επαγγελματική κάρτα** (ADR-841 §7 Α21.16.7).
 * @related components/mandate/ShowcaseCardSection.tsx · components/mandate/ShowcaseCardDoor.tsx
 * @module components/mandate/ShowcaseCardContent
 *
 * 🔑 **Η ύπαρξη της βιτρίνας ρωτιέται από το ΙΔΙΟ hook με τη σελίδα της βιτρίνας** (`useAgencyShowcase`)
 * — ένας δεύτερος αναγνώστης θα ήταν δεύτερο βιβλίο (ADR-749).
 *
 * ⚠️ **`unavailable` ≠ «δεν δημοσιεύτηκε»** (N.12): σε βλάβη η σελίδα λέει «ξαναδοκιμάστε», ποτέ
 * «δημοσιεύστε πρώτα» — θα έστελνε τον άνθρωπο να ξαναδημοσιεύσει κάτι που υπάρχει.
 */

import React from 'react';
import { ChevronLeft } from 'lucide-react';

import { Link } from '@/lib/workspace/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAgencyShowcase } from '@/hooks/mandate/useAgencyShowcase';
import { AGENCY_SHOWCASE_ROUTE } from '@/lib/mandate/mandate-routes';
import {
  SHOWCASE_CARD_KEYS,
  SHOWCASE_KEYS,
  SHOWCASE_NS,
} from '@/components/mandate/agency-showcase-labels';
import { ShowcaseCardSection } from './ShowcaseCardSection';

// 🧩 ADR-744 §15 — PER-ROUTE SLICE, εγγεγραμμένο στο **client** component (όχι στο `page.tsx`):
//    τα Server και Client δέντρα έχουν ξεχωριστούς γράφους module (CHECK 3.51).
import routeSlice from '@/i18n/generated/routes/o__workspace__settings__agency-profile__card.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export function ShowcaseCardContent(): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const { state } = useAgencyShowcase();

  return (
    <section className="flex w-full flex-col gap-6">
      <nav>
        <Link href={AGENCY_SHOWCASE_ROUTE} className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t(SHOWCASE_CARD_KEYS.backToShowcase)}
        </Link>
      </nav>
      {state.phase === 'unavailable' ? (
        <p role="alert" className="m-0 text-sm text-destructive">{t(SHOWCASE_KEYS.temporarilyUnavailable)}</p>
      ) : null}
      {state.phase === 'published' || state.phase === 'not-published' ? (
        <ShowcaseCardSection enabled={state.phase === 'published'} />
      ) : null}
    </section>
  );
}
