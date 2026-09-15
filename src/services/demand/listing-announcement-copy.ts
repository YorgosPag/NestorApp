/**
 * @fileoverview **ΤΙ ΛΕΕΙ Η ΕΙΔΟΠΟΙΗΣΗ** — θέμα, κλειδί τίτλου και σώμα, για ταίριασμα και μείωση.
 * @related ADR-777 §8.69 · services/demand/listing-match-notifier.service.ts · listing-price-drop-notifier.ts
 * @module services/demand/listing-announcement-copy
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ — ΜΙΑ ΔΙΑΤΥΠΩΣΗ, ΔΥΟ ΚΑΤΑΝΑΛΩΤΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το email ταιριάσματος και το email μείωσης μιλούν για την **ίδια** μείωση. Αν η πρόταση
 * *«από X σε Y (−Z%)»* γραφόταν δύο φορές, η πρώτη διόρθωση θα έφτανε στη μία — και ο
 * ζητών θα έβλεπε **δύο διαφορετικά ποσοστά** για την ίδια αγγελία, με μία ώρα διαφορά.
 *
 * ⚠️ **ΔΗΛΩΜΕΝΗ ΕΞΑΙΡΕΣΗ N.11 — ίδια με το `interest-notifier.service.ts:EMAIL_SUBJECT`**:
 * εδώ ο διακομιστής συνθέτει κείμενο **εκτός React**, για το email (`channels/email-channel.ts`
 * το ίδιο ιδίωμα). Το κουδούνι αποδίδει το `titleKey` (`common-shared`), που υπάρχει και στις
 * δύο γλώσσες. Τα ποσά μορφοποιούνται από το SSoT των email (`formatEuro`), ποτέ τοπικά.
 *
 * 🏆 **Η πρόταση λέει ΣΕ ΣΧΕΣΗ ΜΕ ΤΙ** — *«σε σχέση με τη χαμηλότερη τιμή των τελευταίων 30
 * ημερών»*. Οι σημάνσεις μείωσης της Zillow κατηγορούνται δημόσια ότι συγκρίνουν με μπαγιάτικες
 * τιμές· εδώ η αναφορά είναι **γραμμένη** δίπλα στο ποσοστό.
 */

import { priceDropKind, type PriceDropKind } from '@/lib/demand/demand-announcement';
import { isReductionFresh } from '@/lib/listings/price-history';
import type { PriceRole } from '@/lib/properties/price-resolver';
import { formatEuro } from '@/services/email-templates/base-email-template';
import type { PriceReduction } from '@/types/price-history';
import type { PublicListing } from '@/types/public-listing';

/** Ό,τι χρειάζεται μια ειδοποίηση για να μιλήσει. */
export interface AnnouncementCopy {
  /** Το θέμα του email — ελληνικό κείμενο του διακομιστή (δηλωμένη εξαίρεση N.11). */
  readonly title: string;
  /** Το κλειδί του κουδουνιού, χωρίς πρόθεμα namespace (`common-shared`). */
  readonly titleKey: string;
  /** Το σώμα — `undefined` όταν το θέμα τα λέει ήδη όλα. */
  readonly body?: string;
}

/**
 * Η μονάδα της τιμής ανά ρόλο — εξαντλητική: τέταρτος ρόλος δεν μεταγλωττίζεται εδώ μέχρι
 * να πει κάποιος **πώς** διαβάζεται ένα ποσό του.
 */
const ROLE_SUFFIX: Readonly<Record<PriceRole, string>> = {
  sale: '',
  rent: '/μήνα',
  nightly: '/διανυκτέρευση',
};

/** Ποσοστό σε ελληνική γραφή, με ένα δεκαδικό το πολύ: `830` μ.β. ⇒ `8,3`. */
function percentOf(dropBasisPoints: number): string {
  return new Intl.NumberFormat('el', { maximumFractionDigits: 1 }).format(dropBasisPoints / 100);
}

function subjectOf(lead: string, listingTitle: string): string {
  return listingTitle.length > 0 ? `${lead}: «${listingTitle}»` : lead;
}

/**
 * **Η πρόταση της μείωσης** — ποσά, ποσοστό, €/τ.μ. (μόνο στην πώληση) και η αναφορά.
 *
 * ⚠️ **€/τ.μ. μόνο για πώληση**: *«35 €/τ.μ.»* για μηνιαίο ενοίκιο είναι αριθμός που κανείς
 * δεν συγκρίνει, και για διανυκτέρευση είναι **λάθος** μέγεθος.
 */
export function reductionSentence(reduction: PriceReduction, areaSqm: number | null): string {
  const suffix = ROLE_SUFFIX[reduction.role];
  const amounts =
    `Η τιμή μειώθηκε από ${formatEuro(reduction.from)}${suffix} ` +
    `σε ${formatEuro(reduction.to)}${suffix} (−${percentOf(reduction.dropBasisPoints)}%)`;
  const perSqm =
    reduction.role === 'sale' && areaSqm !== null && areaSqm > 0
      ? ` · ${formatEuro(Math.round(reduction.to / areaSqm))}/τ.μ.`
      : '';
  return `${amounts}${perSqm}, σε σχέση με τη χαμηλότερη τιμή των τελευταίων 30 ημερών.`;
}

/** Η δεύτερη πρόταση του `'into-budget'`: **πόσο** κάτω από το όριο — το νούμερο που μετρά. */
function intoBudgetSentence(priceMax: number, reduction: PriceReduction): string {
  return `Είναι πλέον ${formatEuro(priceMax - reduction.to)} κάτω από το ανώτατο όριο της ζήτησής σας.`;
}

function bodyOf(
  listing: PublicListing,
  reduction: PriceReduction,
  kind: PriceDropKind,
  priceMax: number | null,
): string {
  const sentence = reductionSentence(reduction, listing.areaSqm);
  return kind === 'into-budget' && priceMax !== null
    ? `${sentence} ${intoBudgetSentence(priceMax, reduction)}`
    : sentence;
}

/** Η μείωση της αγγελίας **μόνο αν δείχνεται ακόμη** — ίδιος κριτής με την οθόνη. */
export function freshReductionOf(listing: PublicListing, nowMs: number): PriceReduction | null {
  const reduction = listing.priceReduction;
  return reduction !== null && isReductionFresh(reduction, nowMs) ? reduction : null;
}

/**
 * **Το email ταιριάσματος** — και, όταν η αγγελία κουβαλά φρέσκια μείωση, το λέει **εδώ**.
 *
 * 🔑 **Ένα email, όχι δύο**: μια αγγελία που ταιριάζει **για πρώτη φορά** με ήδη μειωμένη
 * τιμή λέγεται **μία** φορά, με τη μείωση μέσα. Ο ειδοποιητής μείωσης τη σιωπά μετά
 * (`predates-match`), γιατί ο ζητών την είδε **ήδη** μειωμένη.
 */
export function matchAnnouncementCopy(
  listing: PublicListing,
  priceMax: number | null,
  nowMs: number,
): AnnouncementCopy {
  const reduction = freshReductionOf(listing, nowMs);
  if (reduction === null) {
    return {
      title: subjectOf('Νέα αγγελία ταιριάζει στη ζήτησή σας', listing.title),
      titleKey: 'demandListingMatch.notificationTitle',
    };
  }

  const kind = priceDropKind(priceMax, reduction);
  return kind === 'into-budget'
    ? {
        title: subjectOf('Μπήκε στον προϋπολογισμό σας', listing.title),
        titleKey: 'demandListingMatch.intoBudgetTitle',
        body: bodyOf(listing, reduction, kind, priceMax),
      }
    : {
        title: subjectOf('Νέα αγγελία με μειωμένη τιμή ταιριάζει στη ζήτησή σας', listing.title),
        titleKey: 'demandListingMatch.reducedTitle',
        body: bodyOf(listing, reduction, kind, priceMax),
      };
}

/** **Το email μείωσης** — για αγγελία που ο ζητών **ήδη** ξέρει. */
export function priceDropCopy(listing: PublicListing, reduction: PriceReduction): AnnouncementCopy {
  return {
    title: subjectOf('Μειώθηκε η τιμή αγγελίας της ζήτησής σας', listing.title),
    titleKey: 'demandPriceDrop.notificationTitle',
    body: reductionSentence(reduction, listing.areaSqm),
  };
}
