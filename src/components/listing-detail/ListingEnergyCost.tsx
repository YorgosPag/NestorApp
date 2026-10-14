'use client';

/**
 * **Η εκτίμηση ετήσιου κόστους ενέργειας στη δημόσια αγγελία** (ADR-777 §8.95) — εύρος σε ευρώ, με ό,τι το στηρίζει
 * ορατό από κάτω: οι καταναλώσεις του πιστοποιητικού, η περίοδος και η πηγή των τιμών, και τι **δεν** μετρά.
 *
 * @related `lib/energy-cost/listing-energy-cost.ts` (ο υπολογισμός — πέντε καταστάσεις) ·
 *   `lib/energy-cost/energy-reference-prices.ts` (οι τιμές) · `./ListingEnergyCertificate.tsx` (η ενότητα που το κρεμά)
 *
 * 🔴 **ΤΟ ΕΛΛΗΝΙΚΟ ΠΕΑ ΔΕΝ ΤΥΠΩΝΕΙ ΠΟΣΟ.** Το ποσό εδώ είναι **υπολογισμός δικός μας**, και η οθόνη δεν το κρύβει:
 * ο τίτλος λέει «εκτίμηση», το εύρος δεν έχει δεκαδικά, και η γραμμή από κάτω λέει από ποια εξάμηνα είναι οι τιμές.
 *
 * 🔑 **Ο τίτλος ονομάζει τι μετρά** (θέρμανση · ψύξη · ζεστό νερό): «κόστος ενέργειας» σκέτο θα υποσχόταν τον
 * λογαριασμό του σπιτιού, ενώ ο υπολογισμός του ΚΕΝΑΚ για κατοικίες δεν περιέχει συσκευές, μαγείρεμα ή φωτισμό.
 *
 * 🏆 Γαλλία: εύρος + έτος τιμών, από το ίδιο το DPE. Ηνωμένο Βασίλειο: «δεν είναι ο λογαριασμός σας». Εδώ και τα δύο,
 * **και** τα δεδομένα του υπολογισμού στην ίδια οθόνη — που κανένα από τα δύο δεν δείχνει στην αγγελία.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { todayLocalDate } from '@/lib/date-local';
import { CERTIFICATE_ENERGY_SOURCE_KEY } from '@/lib/energy-certificate/energy-certificate-keys';
import { ENERGY_PRICE_SOURCES, ENERGY_REFERENCE_PRICES } from '@/lib/energy-cost/energy-reference-prices';
import {
  listingEnergyCost,
  type EnergyCostEstimate,
  type EnergyCostSubject,
  type ListingEnergyCost as EnergyCost,
} from '@/lib/energy-cost/listing-energy-cost';
import { formatCurrency, formatList, formatNumber } from '@/lib/intl-formatting';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const NOTE = 'm-0 text-xs text-muted-foreground';
const LINK = 'underline underline-offset-4 hover:text-foreground';
const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** `2024-S2` → «β΄ εξάμηνο 2024». Κλειδιά κυριολεκτικά, ώστε να τα βλέπει ο γεννήτορας του slice. */
function semesterText(t: Translate, period: string): string {
  const [year, half] = period.split('-');
  return half === 'S1'
    ? t('listing-detail:energyCost.semesterFirst', { year })
    : t('listing-detail:energyCost.semesterSecond', { year });
}

function amountText(t: Translate, { low, high }: EnergyCostEstimate): string {
  return low === high
    ? t('listing-detail:energyCost.single', { amount: formatCurrency(low) })
    : t('listing-detail:energyCost.range', { low: formatCurrency(low), high: formatCurrency(high) });
}

/** Γιατί δεν υπάρχει ποσό — το κενό έχει πάντα όνομα. */
function reasonText(t: Translate, cost: Exclude<EnergyCost, EnergyCostEstimate | { kind: 'hidden' }>): string {
  switch (cost.kind) {
    case 'undeclared':
      return t('listing-detail:energyCost.undeclared');
    case 'building-certificate':
      return t('listing-detail:energyCost.buildingCertificate');
    case 'stale-prices':
      return t('listing-detail:energyCost.stalePrices');
    case 'unpriced':
      return t('listing-detail:energyCost.unpriced', {
        sources: formatList(cost.sources.map((source) => t(CERTIFICATE_ENERGY_SOURCE_KEY[source]))),
      });
  }
}

/** Τα δεδομένα πίσω από το ποσό: πόσες kWh τον χρόνο γράφει το πιστοποιητικό για το ακίνητο, ανά πηγή. */
function Consumption({ estimate }: { readonly estimate: EnergyCostEstimate }) {
  const { t } = useTranslation(['listing-detail', 'properties-enums']);
  return (
    <dl className="mt-2 space-y-1">
      {estimate.lines.map((line) => (
        <div key={line.source} className="flex flex-wrap items-baseline gap-x-3">
          <dt className="text-sm text-muted-foreground">{t(CERTIFICATE_ENERGY_SOURCE_KEY[line.source])}</dt>
          <dd className="text-sm text-foreground">
            {t('listing-detail:energyCost.kwhPerYear', { value: formatNumber(Math.round(line.kwhPerYear)) })}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Estimate({ estimate }: { readonly estimate: EnergyCostEstimate }) {
  const { t } = useTranslation(['listing-detail']);
  return (
    <>
      <p className="m-0 mt-1 text-base font-semibold text-foreground">{amountText(t, estimate)}</p>
      <Consumption estimate={estimate} />
      <p className={`${NOTE} mt-2`}>
        {t('listing-detail:energyCost.basis', {
          from: semesterText(t, estimate.pricesFrom),
          to: semesterText(t, estimate.pricesTo),
        })}
      </p>
      {estimate.heatingInCommonCharges && <p className={`${NOTE} mt-1`}>{t('listing-detail:energyCost.heatingInCommonCharges')}</p>}
      <p className={`${NOTE} mt-1`}>
        {t('listing-detail:energyCost.pricesFrom')}
        {ENERGY_PRICE_SOURCES.map((source) => (
          <React.Fragment key={source.name}>
            {' '}
            <a href={source.url} className={LINK} {...EXTERNAL}>{source.name}</a>
          </React.Fragment>
        ))}
      </p>
    </>
  );
}

export function ListingEnergyCost({ listing }: { readonly listing: EnergyCostSubject }) {
  const { t } = useTranslation(['listing-detail', 'properties-enums']);
  const cost = listingEnergyCost(listing, ENERGY_REFERENCE_PRICES, todayLocalDate());
  if (cost.kind === 'hidden') return null;

  return (
    <section aria-labelledby="listing-energy-cost-heading" className="mt-4 border-t border-border pt-3">
      <h3 id="listing-energy-cost-heading" className="m-0 text-sm font-medium text-foreground">
        {t('listing-detail:energyCost.heading')}
      </h3>
      {cost.kind === 'estimated' ? (
        <Estimate estimate={cost} />
      ) : (
        <p className="m-0 mt-1 text-sm text-foreground">{reasonText(t, cost)}</p>
      )}
    </section>
  );
}
