'use client';

/**
 * **Η τιμή ζώνης σε μία θέση, σε κείμενο** — τιμή, ζώνη, ημερομηνία ισχύος, και η σημείωση «κοντά σε όριο».
 *
 * 🔑 **ΕΝΑ σημείο για δύο καταναλωτές**: η ζώνη της αγγελίας (`ListingValueZone`, ADR-889 Φ5) και ο δημόσιος
 * υπολογιστής αντικειμενικής αξίας (ADR-898 Φ2). Ίδια κλειδιά (`market-contracts:valueZone.*`), ίδια μορφοποίηση τιμής.
 *
 * 🔑 **Ποτέ «η αντικειμενική αξία του ακινήτου»**: η τιμή ζώνης είναι η **βάση**, πριν από τους συντελεστές.
 *
 * 🔑 **Ο ΣΕ της ζώνης** (ADR-898 Φ5) δίπλα στην τιμή, όταν η πηγή τον δίνει ως αριθμό· με πίνακα PDF, σύνδεσμος σε αυτόν.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay } from '@/lib/intl-formatting';
import { pricePerAreaLabel } from '@/lib/listings/listing-price-label';
import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';
import type { CommercialityFact } from '@/lib/market/value-zone-file';
import { formatCommercialityFactor } from '@/lib/objective-value/objective-value-zone';
import { VISIBLE_LINK_CLASS } from '@/lib/ui/link-style';

const NS = 'market-contracts';

export type ReadyValueZone = Extract<ValueZoneVerdict, { kind: 'ready' }>;

/** Η μορφοποίηση €/τ.μ. των ζωνών — η ΙΔΙΑ με των αγγελιών. */
export function useZonePriceLabel(): (amount: number) => string {
  const { t } = useTranslation([NS, 'common']);
  return (amount: number): string => pricePerAreaLabel(t, { role: 'sale', amount });
}

function ZoneCommerciality({ commerciality }: { readonly commerciality: CommercialityFact }): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  if (commerciality.kind === 'factor') {
    const factor = formatCommercialityFactor(commerciality.value);
    return <p className="m-0 text-xs text-muted-foreground">{t(`${NS}:valueZone.commerciality`, { factor })}</p>;
  }
  if (commerciality.kind === 'unknown') return null;
  return (
    <a href={commerciality.url} target="_blank" rel="noopener noreferrer" className={`self-start text-xs ${VISIBLE_LINK_CLASS}`}>
      {t(`${NS}:valueZone.commercialityDocument`)}
    </a>
  );
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
      <ZoneCommerciality commerciality={zone.commerciality} />
      {verdict.nearEdge && <p className="m-0 text-xs text-muted-foreground">{t(`${NS}:valueZone.nearEdge`)}</p>}
    </>
  );
}
