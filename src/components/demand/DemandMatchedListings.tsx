'use client';

/**
 * **ΟΙ ΑΓΓΕΛΙΕΣ ΠΟΥ ΤΑΙΡΙΑΖΟΥΝ — ΚΑΙ ΩΣ ΤΙ** (ADR-777 §8.60.16).
 *
 * @related ADR-777 §8.60.15 · §8.60.16 · lib/demand/demand-answer.ts · lib/demand/demand-match-price.ts
 * @module components/demand/DemandMatchedListings
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΙ ΔΕΝ ΚΑΝΕΙ ΚΑΝΕΝΑ PORTAL
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Zillow · Idealista · Rightmove κόβουν τη ροή σε **μία** συναλλαγή ανά αποθηκευμένη αναζήτηση, άρα
 * δεν χρειάζεται να πουν «ως τι» ταιριάζει μια αγγελία. Εδώ η ζήτηση είναι «αγορά **ή** ενοικίαση»
 * (§8.60.15), οπότε κάθε ταίριασμα λέει **ρητά** τη συναλλαγή, το ποσό **στη μονάδα της** και πόσο
 * κάτω από το όριο είναι.
 *
 * 🔑 **Η οθόνη ΔΕΝ ξανακρίνει.** Το «ως τι» (`match.metOn`) το έχει ήδη υπολογίσει η μηχανή, στο ίδιο
 * πέρασμα με την τιμή. Εδώ μόνο διαβάζεται.
 *
 * ⚠️ **Όχι το `ListingCard`**: θα έφερνε χάρτη, γκαλερί και ολόκληρο το namespace `search-results` στο
 * slice της διαδρομής, για μια προεπισκόπηση. Ο σύνδεσμος οδηγεί στην **ίδια** σελίδα αγγελίας.
 *
 * ♿ **WCAG 1.4.1**: η συναλλαγή είναι **κείμενο** («Ενοικίαση · 850 €/μήνα»), ποτέ μόνο χρώμα.
 */

import React from 'react';

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { matchedPreview, type DemandAnswer } from '@/lib/demand/demand-answer';
import type {
  DemandOutcome,
  DemandSeekMet,
  DemandSeekMetExchange,
  DemandSeekMetPriced,
} from '@/lib/demand/demand-matching';
import { formatNumber, formatPercentage } from '@/lib/intl-formatting';
import { resolvedPriceLabel } from '@/lib/listings/listing-price-label';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import { Link } from '@/lib/workspace/navigation';

import { SEEK_KIND_I18N_KEYS } from './seek-kind-labels';

const K = 'property-market:demand.answer.matchedList';

type MatchT = ReturnType<typeof useTranslation>['t'];

/** Ετικέτα + περιθώριο μιας συναλλαγής **με ποσό** — η μονάδα από τον ΕΝΑ μορφοποιητή. */
function pricedPhrases(t: MatchT, kind: string, met: DemandSeekMetPriced): [string, string | null] {
  const { role, amount, headroomBy } = met;
  const term = amount === null ? kind : t(`${K}.term`, { kind, price: resolvedPriceLabel(t, { role, amount }) });
  if (headroomBy === null) return [term, null];
  if (headroomBy === 0) return [term, t(`${K}.atLimit`)];
  return [term, t(`${K}.headroom`, { amount: resolvedPriceLabel(t, { role, amount: headroomBy }) })];
}

/** Ετικέτα + περιθώριο της **αντιπαροχής** — ποσοστό οικοπεδούχου, ποτέ ευρώ (ADR-777 §8.60.17). */
function exchangePhrases(t: MatchT, kind: string, met: DemandSeekMetExchange): [string, string | null] {
  const { landownerShare, headroomBy } = met;
  const term =
    landownerShare === null
      ? t(`${K}.shareNegotiable`, { kind })
      : t(`${K}.shareTerm`, { kind, share: formatPercentage(landownerShare) });
  if (headroomBy === null) return [term, null];
  if (headroomBy === 0) return [term, t(`${K}.atLimit`)];
  return [term, t(`${K}.shareHeadroom`, { points: formatNumber(headroomBy, { maximumFractionDigits: 1 }) })];
}

/** Μία συναλλαγή που ικανοποιείται: ετικέτα-κείμενο, και το περιθώριο δίπλα της. */
function MetTerm({ met }: { met: DemandSeekMet }): React.ReactElement {
  const { t } = useTranslation(['property-market', 'common']);
  const kind = t(SEEK_KIND_I18N_KEYS[met.kind]);
  const [term, headroom] = met.kind === 'exchange' ? exchangePhrases(t, kind, met) : pricedPhrases(t, kind, met);

  return (
    <li className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary">{term}</Badge>
      {headroom !== null && <span className="text-xs text-muted-foreground">{headroom}</span>}
    </li>
  );
}

/** Μία αγγελία: τίτλος-σύνδεσμος και **ως τι** ταιριάζει. */
function MatchedListingItem({ outcome }: { outcome: DemandOutcome }): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const { listing } = outcome.facts;

  return (
    <li>
      <article className="flex flex-col gap-1">
        <h4 className="text-sm font-medium">
          <Link href={listingDetailHref(listing.id)} className="text-foreground underline-offset-4 hover:underline">
            {listing.title}
          </Link>
        </h4>
        <ul aria-label={t(`${K}.matchedAs`)} className="flex flex-col gap-1">
          {outcome.match.metOn.map((met) => (
            <MetTerm key={met.kind} met={met} />
          ))}
        </ul>
      </article>
    </li>
  );
}

/**
 * Η προεπισκόπηση των ταιριασμάτων. Το **όριο** και το «πόσα έμειναν έξω» τα αποφασίζει το
 * `matchedPreview` — ποτέ `slice` εδώ.
 */
export function DemandMatchedListings({ answer }: { answer: DemandAnswer }): React.ReactElement | null {
  const { t } = useTranslation(['property-market']);
  const headingId = React.useId();
  const { shown, hidden } = matchedPreview(answer);

  if (shown.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="rounded-md border border-border bg-card p-4">
      <h3 id={headingId} className="text-sm font-semibold text-foreground">
        {t(`${K}.heading`)}
      </h3>
      <ul className="mt-3 flex flex-col gap-3">
        {shown.map((outcome) => (
          <MatchedListingItem key={outcome.facts.listing.id} outcome={outcome} />
        ))}
      </ul>
      {hidden > 0 && <p className="mt-3 text-sm text-muted-foreground">{t(`${K}.more`, { count: hidden })}</p>}
    </section>
  );
}
