'use client';

/**
 * @fileoverview **«ΠΩΣ ΠΑΝΕ ΟΙ ΑΓΓΕΛΙΕΣ ΜΟΥ»** — ένα fetch ανά σελίδα, για κάρτες ΚΑΙ λεπτομέρεια.
 * @related ADR-777 §8.72 · app/api/owner-properties/stats · lib/listings/listing-stats.ts
 * @module hooks/owner-property/useOwnerPortfolioStats
 *
 * 🔑 **Κάτοπτρο του {@link usePlaceInterest}, και για τον ίδιο λόγο**: τρεις καταστάσεις, και
 * το `unavailable` **ΔΕΝ** είναι «0 προβολές». Μια οθόνη που γράφει «κανείς δεν είδε την αγγελία
 * σου» επειδή έπεσε μια κλήση **λέει ψέματα με σιγουριά** — και σπρώχνει τον κάτοχο σε μείωση
 * τιμής για ένα πρόβλημα δικτύου.
 *
 * ⚠️ **ΕΝΑ fetch ανά σελίδα, ποτέ ανά κάρτα.** Η διαδρομή επιστρέφει όλο το χαρτοφυλάκιο (ο
 * διακομιστής βρίσκει μόνος του τα ακίνητα — κανένα `propertyId` από το σύρμα). Η λίστα καλεί
 * το hook μία φορά και μοιράζει `byProperty[id]`· η λεπτομέρεια το ίδιο, για κάρτα **και** πίνακα.
 */

import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import {
  OWNER_PORTFOLIO_STATS_PATH,
  type ListingStatsSummary,
  type OwnerPortfolioStats,
} from '@/lib/listings/listing-stats';

const logger = createModuleLogger('useOwnerPortfolioStats');

export type OwnerPortfolioStatsState =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly stats: OwnerPortfolioStats }
  | { readonly state: 'unavailable' };

/**
 * **Τα στατιστικά ΕΝΟΣ ακινήτου** — όπως τα χρειάζεται μια κάρτα ή ο πίνακας.
 * `ready` χωρίς εγγραφή για το ακίνητο = ο διακομιστής **δεν** το θεωρεί δικό σου για
 * στατιστικά (π.χ. εταιρική αγγελία) ⇒ τίποτα να δειχτεί, **όχι** μηδενικά.
 */
export type ListingStatsState =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly summary: ListingStatsSummary; readonly today: string }
  | { readonly state: 'unavailable' }
  | { readonly state: 'absent' };

export function listingStatsStateOf(
  portfolio: OwnerPortfolioStatsState,
  propertyId: string,
): ListingStatsState {
  if (portfolio.state !== 'ready') return portfolio;
  const summary = portfolio.stats.byProperty[propertyId];
  if (summary === undefined) return { state: 'absent' };
  return { state: 'ready', summary, today: portfolio.stats.today };
}

export function useOwnerPortfolioStats(): OwnerPortfolioStatsState {
  const [state, setState] = useState<OwnerPortfolioStatsState>({ state: 'loading' });

  useEffect(() => {
    let alive = true;

    apiClient
      .get<OwnerPortfolioStats>(OWNER_PORTFOLIO_STATS_PATH)
      .then((stats) => {
        if (alive) setState({ state: 'ready', stats });
      })
      .catch((cause: unknown) => {
        logger.warn('Τα στατιστικά αγγελιών δεν φορτώθηκαν', {
          error: cause instanceof Error ? cause.message : String(cause),
        });
        if (alive) setState({ state: 'unavailable' });
      });

    // Η σημαία ακυρώνει την **εγγραφή**, όχι την κλήση (ίδιος λόγος με το usePlaceInterest).
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
