'use client';

/**
 * **Η διαθεσιμότητα στη σελίδα της αγγελίας** — «Παράδοση: Γ΄ τρίμηνο 2027 · αρχικά Β΄ τρίμηνο 2027 · μετατέθηκε 1 φορά».
 *
 * @related ADR-919 §10 (Δ3) · §11 · components/search-results/ListingDeliveryBadge.tsx · lib/listings/availability-history.ts
 *
 * 🏆 **Εδώ ξεπερνάμε την αγορά**: idealista, ImmoScout24, Rightmove και Zoopla **δεν** δείχνουν ιστορικό μεταθέσεων.
 * Στο ΗΒ μόνο το 64% των νέων κατοικιών παραδίδεται εγκαίρως· ο αγοραστής αξίζει να ξέρει αν η υπόσχεση έχει ήδη
 * μετατεθεί. Η σήμανση έρχεται **μόνο** από το `slipNoticeOf` (υπόσχεση ακόμη `scheduled` και ≥1 μετάθεση), ποτέ από
 * σκέτο `slips > 0`: μετά την παράδοση η ιστορία παύει να είναι είδηση.
 *
 * 🔑 Το `ready` γράφεται ρητά («Άμεσα διαθέσιμο», το «Bezugsfrei ab: Sofort» του ImmoScout24). Το `unknown` σιωπά.
 *
 * 🔴 Χωριστό από την κάρτα για τον ίδιο λόγο με το `ListingPriceReduction`: τα κλειδιά `listing-detail` φορτώνονται
 * **μόνο** στη διαδρομή της αγγελίας, ποτέ στο κέλυφος (CHECK 3.34).
 */

import React from 'react';

import { SectionFrame } from '@/components/ui/section-frame';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getCurrentLocale } from '@/lib/intl-utils';
import { slipNoticeOf } from '@/lib/listings/availability-history';
import { availabilityPromisePhrase } from '@/lib/listings/availability-phrase';
import type { PublicListing } from '@/types/public-listing';

const NS = ['listing-detail', 'common', 'common-shared'];

export function ListingAvailability({ listing }: { readonly listing: PublicListing }) {
  const { t } = useTranslation(NS);
  const { availability } = listing;
  if (availability.kind === 'unknown') return null;
  const locale = getCurrentLocale();
  const value = availability.kind === 'ready'
    ? t('common:listingAvailability.readyNow')
    : availabilityPromisePhrase(availability, t, locale);
  const notice = slipNoticeOf(listing.availabilityTrack, availability);
  return (
    <SectionFrame headingId="listing-availability-heading" title={t('listing-detail:availability.label')} headingLevel="h2" titleSize="eyebrow">
      <p className="mt-2 text-base font-medium text-foreground">{value}</p>
      {notice !== null && (
        <p className="text-sm text-muted-foreground">
          {t('listing-detail:availability.slipNotice', {
            originally: availabilityPromisePhrase(notice.originally, t, locale),
            count: notice.slips,
          })}
        </p>
      )}
      {availability.kind === 'scheduled' && <p className="text-xs text-muted-foreground">{t('listing-detail:availability.basis')}</p>}
    </SectionFrame>
  );
}
