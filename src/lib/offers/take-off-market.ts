/**
 * =============================================================================
 * «ΕΚΤΟΣ ΑΓΟΡΑΣ» — τι αλλάζει σε ένα ακίνητο όταν παύει να διατίθεται, ως καθαρή συνάρτηση
 * =============================================================================
 *
 * Το ρωτά η επαναφορά από το **αρχείο** (ADR-281 · ADR-329 §3.9): ένα ακίνητο που έμεινε
 * μήνες αποσυρμένο **δεν ξαναβγαίνει μόνο του στον κόσμο** με την τιμή που είχε τότε.
 * Η δημοσίευση είναι ρητή πράξη ανθρώπου — Shopify (*«products that you unarchive are set
 * to Draft»*), Zillow Rental Manager (Activate), Airbnb (Relist).
 *
 * 🔑 **Δύο σχήματα εγγράφου, μία απάντηση** — ακριβώς τα δύο σκέλη του `offerStateOf`:
 *   - έγγραφο με `offers` (ADR-777 Α20): οι **ενεργές** διαθέσεις γίνονται `withdrawn`,
 *     και τα παραγόμενα πεδία βγαίνουν από τον **ένα** παραγωγό·
 *   - παλιό έγγραφο: το `commercialStatus` γυρίζει στην προεπιλογή «εκτός αγοράς».
 *
 * ⚠️ Οι `reserved` και `closed` διαθέσεις **δεν αγγίζονται**: εκεί υπάρχει αντισυμβαλλόμενος,
 * και η απόσυρσή τους δεν είναι απόφαση του κύκλου ζωής της εγγραφής.
 *
 * @module lib/offers/take-off-market
 * @enterprise ADR-777 Α20 · ADR-281
 */

import {
  DEFAULT_COMMERCIAL_STATUS,
  LISTED_COMMERCIAL_STATUSES,
} from '@/constants/commercial-statuses';
import type { PropertyOffer } from '@/types/property-offers';
import { deriveCommercialStatus, deriveOfferKinds } from './derive-commercial-status';

/** Ό,τι χρειάζεται από το έγγραφο για να απαντηθεί το ερώτημα. */
export interface MarketFacts {
  readonly offers?: unknown;
  readonly offerKinds?: unknown;
  readonly commercialStatus?: unknown;
}

/** Τα πεδία προς γραφή και η εμπορική κατάσταση πριν / μετά, για το βιβλίο ιστορικού. */
export interface OffMarketPatch {
  readonly fields: Record<string, unknown>;
  readonly commercialStatusBefore: string | null;
  readonly commercialStatusAfter: string;
}

const isListed = (status: string | null): boolean =>
  status !== null && (LISTED_COMMERCIAL_STATUSES as readonly string[]).includes(status);

/** Το σκέλος της Α20: αποσύρει τις ενεργές διαθέσεις και ξαναπαράγει τα παραγόμενα πεδία. */
function withdrawActiveOffers(
  offers: readonly PropertyOffer[],
  before: string | null,
  closedAt: unknown,
): OffMarketPatch | null {
  if (!offers.some((offer) => offer.lifecycle === 'active')) return null;

  const withdrawn: PropertyOffer[] = offers.map((offer) =>
    offer.lifecycle === 'active' ? { ...offer, lifecycle: 'withdrawn' } : offer,
  );
  const commercialStatusAfter = deriveCommercialStatus(withdrawn);

  return {
    fields: {
      // Η στιγμή μπαίνει μόνο στις διαθέσεις που αποσύρθηκαν ΤΩΡΑ — το ιστορικό δεν ξαναγράφεται.
      offers: withdrawn.map((offer, index) =>
        offers[index].lifecycle === 'active' ? { ...offer, closedDate: closedAt } : offer,
      ),
      commercialStatus: commercialStatusAfter,
      offerKinds: deriveOfferKinds(withdrawn),
    },
    commercialStatusBefore: before,
    commercialStatusAfter,
  };
}

/**
 * Τι πρέπει να γραφτεί ώστε το ακίνητο να **μη διατίθεται** πια.
 *
 * @param facts — το έγγραφο όπως είναι αποθηκευμένο
 * @param fallbackStatus — το παλιό `status`, για έγγραφα που δεν έχουν ακόμη `commercialStatus`
 *                         (ίδια εφεδρεία με το `offerStateOf`)
 * @param closedAt — η στιγμή της απόσυρσης, όπως θα αποθηκευτεί στις διαθέσεις
 * @returns `null` όταν το ακίνητο είναι **ήδη** εκτός αγοράς — καμία γραφή, καμία γραμμή
 */
export function takeOffMarket(
  facts: MarketFacts,
  fallbackStatus: string | null,
  closedAt: unknown,
): OffMarketPatch | null {
  const before =
    typeof facts.commercialStatus === 'string' ? facts.commercialStatus : fallbackStatus;

  if (Array.isArray(facts.offers)) {
    return withdrawActiveOffers(facts.offers as PropertyOffer[], before, closedAt);
  }

  const declaresKinds = Array.isArray(facts.offerKinds) && facts.offerKinds.length > 0;
  if (!isListed(before) && !declaresKinds) return null;

  return {
    fields: {
      commercialStatus: DEFAULT_COMMERCIAL_STATUS,
      ...(declaresKinds ? { offerKinds: [] } : {}),
    },
    commercialStatusBefore: before,
    commercialStatusAfter: DEFAULT_COMMERCIAL_STATUS,
  };
}
