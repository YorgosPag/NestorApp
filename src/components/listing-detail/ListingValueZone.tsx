'use client';

/**
 * **Η ζώνη αντικειμενικής αξίας στη θέση της αγγελίας** (ADR-889 Φ5) — μέσα στην ενότητα «Τιμές συμβολαίων».
 *
 * Με αυτή τη σειρά: η **τιμή ζώνης** της θέσης · η ζητούμενη ως **% της ζώνης**, δίπλα στο % που υπογράφουν τα
 * συμβόλαια της περιοχής (ίδιος παρονομαστής, άρα άμεσα συγκρίσιμα) · τα **μέτωπα υπό όρο** · η αναφορά CC-BY.
 *
 * 🔑 **Ποτέ «η αντικειμενική αξία του ακινήτου»**: η τιμή ζώνης είναι η **βάση**, πριν από τους συντελεστές. Και ποτέ
 * «έχει πρόσοψη στη …»: η θέση δεν το αποδεικνύει — το μέτωπο λέγεται **υπό όρο**.
 */

import React from 'react';

import { OpenDataAttribution } from '@/components/market/OpenDataAttribution';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay } from '@/lib/intl-formatting';
import { pricePerAreaLabel } from '@/lib/listings/listing-price-label';
import { askingPctOfZone, type ListingMarketContext } from '@/lib/market/listing-market-context';
import { isReportedStatCell } from '@/lib/market/market-statistics';
import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';

const NS = 'market-contracts';
const HEADING_ID = 'listing-value-zone';

type ReadyZone = Extract<ValueZoneVerdict, { kind: 'ready' }>;

function ZoneFronts({ fronts, price }: { readonly fronts: ReadyZone['fronts']; readonly price: (amount: number) => string }) {
  const { t } = useTranslation([NS]);
  if (fronts.length === 0) return null;
  return (
    <>
      <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:valueZone.frontsIntro`)}</p>
      <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
        {fronts.map((front) => (
          <li key={`${front.id}|${front.street}`}>{t(`${NS}:valueZone.front`, { street: front.street, price: price(front.price) })}</li>
        ))}
      </ul>
    </>
  );
}

function AskingVsZone({ context }: { readonly context: ListingMarketContext }) {
  const { t } = useTranslation([NS]);
  const asking = askingPctOfZone(context);
  const contracts = context.kind === 'ready' ? context.priceToZonePct : null;
  if (asking === null || contracts === null || !isReportedStatCell(contracts)) return null;
  return (
    <p className="m-0 text-sm font-medium text-foreground">
      {t(`${NS}:valueZone.askingVsZone`, { asking, contracts: Math.round(contracts.median) })}
    </p>
  );
}

function ReadyBody({ verdict, context }: { readonly verdict: ReadyZone; readonly context: ListingMarketContext }) {
  const { t } = useTranslation([NS, 'common']);
  const price = (amount: number): string => pricePerAreaLabel(t, { role: 'sale', amount });
  const { zone } = verdict;
  return (
    <>
      <p className="m-0 text-base font-semibold text-foreground">{t(`${NS}:valueZone.price`, { price: price(zone.price) })}</p>
      <p className="m-0 text-xs text-muted-foreground">
        {t(`${NS}:valueZone.zone`, { name: zone.name, date: formatCalendarDay(zone.validFrom, true) })}
      </p>
      {verdict.nearEdge && <p className="m-0 text-xs text-muted-foreground">{t(`${NS}:valueZone.nearEdge`)}</p>}
      <AskingVsZone context={context} />
      <ZoneFronts fronts={verdict.fronts} price={price} />
    </>
  );
}

/** Κάθε κατάσταση λέει κάτι — ποτέ κενό κουτί, ποτέ σιωπή που διαβάζεται ως «δεν υπάρχει ζώνη». */
export function ListingValueZone({ context }: { readonly context: ListingMarketContext }) {
  const { t } = useTranslation([NS]);
  const verdict = context.valueZone;
  return (
    <section aria-labelledby={HEADING_ID} className="flex flex-col gap-2 border-t border-border pt-3">
      <h3 id={HEADING_ID} className="m-0 text-sm font-semibold text-foreground">{t(`${NS}:valueZone.title`)}</h3>
      {verdict.kind === 'ready' ? (
        <ReadyBody verdict={verdict} context={context} />
      ) : (
        <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:valueZone.${verdict.kind}`)}</p>
      )}
      {(verdict.kind === 'ready' || verdict.kind === 'outside') && <OpenDataAttribution source="valueZones" />}
    </section>
  );
}
