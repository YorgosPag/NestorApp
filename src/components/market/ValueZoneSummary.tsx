'use client';

/**
 * **Η τιμή ζώνης σε μία θέση, σε κείμενο** — τιμή, ζώνη, ημερομηνία ισχύος, και η σημείωση «κοντά σε όριο».
 *
 * 🔑 **ΕΝΑ σημείο για δύο καταναλωτές**: η ζώνη της αγγελίας (`ListingValueZone`, ADR-889 Φ5) και ο δημόσιος
 * υπολογιστής αντικειμενικής αξίας (ADR-898 Φ2). Ίδια κλειδιά (`market-contracts:valueZone.*`), ίδια μορφοποίηση τιμής.
 *
 * 🔑 **Ποτέ «η αντικειμενική αξία του ακινήτου»**: η τιμή ζώνης είναι η **βάση**, πριν από τους συντελεστές.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay } from '@/lib/intl-formatting';
import { pricePerAreaLabel } from '@/lib/listings/listing-price-label';
import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';

const NS = 'market-contracts';

export type ReadyValueZone = Extract<ValueZoneVerdict, { kind: 'ready' }>;

/** Η μορφοποίηση €/τ.μ. των ζωνών — η ΙΔΙΑ με των αγγελιών. */
export function useZonePriceLabel(): (amount: number) => string {
  const { t } = useTranslation([NS, 'common']);
  return (amount: number): string => pricePerAreaLabel(t, { role: 'sale', amount });
}

export function ValueZoneSummary({ verdict }: { readonly verdict: ReadyValueZone }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const price = useZonePriceLabel();
  const { zone } = verdict;
  return (
    <>
      <p className="m-0 text-base font-semibold text-foreground">{t(`${NS}:valueZone.price`, { price: price(zone.price) })}</p>
      <p className="m-0 text-xs text-muted-foreground">
        {t(`${NS}:valueZone.zone`, { name: zone.name, date: formatCalendarDay(zone.validFrom, true) })}
      </p>
      {verdict.nearEdge && <p className="m-0 text-xs text-muted-foreground">{t(`${NS}:valueZone.nearEdge`)}</p>}
    </>
  );
}
