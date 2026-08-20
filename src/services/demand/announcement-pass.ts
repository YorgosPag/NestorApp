/**
 * =============================================================================
 * ΕΝΑ ΠΕΡΑΣΜΑ ΑΝΑΚΟΙΝΩΣΗΣ — μία κρίση, μία λογιστική, δύο σαρωτές (ADR-777 §8.23)
 * =============================================================================
 *
 * Οι δύο ειδοποιητές (ιδιώτη · γραφείου) διαφέρουν σε **δύο** πράγματα, και μόνο
 * σε αυτά:
 *
 * 1. **Πώς χτίζονται τα γεγονότα** — ο ιδιώτης δηλώνει ο ίδιος τον τόπο
 *    (σύγχρονο)· το γραφείο τον κληρονομεί από την αλυσίδα κτίριο → έργο
 *    (ασύγχρονο, με πραγματικές αναγνώσεις).
 * 2. **Ποιος είναι ο παραλήπτης** — `authorUserId` έναντι `createdBy`.
 *
 * **Σε τίποτα άλλο.** Η κρίση «είναι αυτό είδηση;», η επιλογή ζώνης, η αποστολή
 * και η καταμέτρηση είναι **ταυτόσημες** — και το CHECK 3.28 τις εντόπισε ως
 * δίδυμα **δύο φορές** μέσα στην ίδια δουλειά, καθώς γεννιόταν ο δεύτερος
 * σαρωτής.
 *
 * ⚠️ **Δεν είναι αισθητική εξαγωγή.** Η καταμέτρηση είναι ο μηχανισμός που
 * αποδεικνύει ότι **κανένα ακίνητο δεν χάθηκε σιωπηλά**, και η επιλογή ζώνης
 * είναι ο μηχανισμός που κάνει την επανάληψη **δομικά αδύνατη**. Γραμμένα δύο
 * φορές, θα μπορούσαν να αποκλίνουν — και η απόκλιση θα εμφανιζόταν ως **διπλό
 * email** ή ως **δύο αριθμοί για το ίδιο πέρασμα**, με τους δύο να φαίνονται
 * σωστοί (ADR-749).
 *
 * @module services/demand/announcement-pass
 * @see ADR-777 §8.23
 */

import { announcementBand } from '@/lib/demand/demand-announcement';
import { discloseInterest } from '@/lib/demand/demand-interest';
import {
  announceOnePlace,
  type AnnounceOutcome,
} from '@/services/demand/interest-notifier.service';
import type { ListingMatchFacts } from '@/lib/demand/demand-match-vocabulary';
import type { PropertyDemand } from '@/types/property-demand';

/** Οι τέσσερις καταλήξεις που μοιράζονται **και οι δύο** σαρωτές. */
export interface AnnouncementCounters {
  readonly announced: number;
  readonly alreadyKnown: number;
  readonly noNews: number;
  readonly optedOut: number;
  readonly considered: number;
  readonly truncated: boolean;
}

/** Ο μετρητής ενός περάσματος. */
export interface AnnouncementTally {
  /** Δεν υπάρχει είδηση για αυτό το ακίνητο (κάτω από ζώνη ή λογοκριμένο). */
  readonly countNoNews: () => void;
  /** Καταγράφει την κατάληξη μιας **πραγματικής** ανακοίνωσης. */
  readonly countOutcome: (outcome: AnnounceOutcome) => void;
  /**
   * Το αποτέλεσμα.
   *
   * ⚠️ Το `considered` δίνεται από τον καλούντα και **δεν** συνάγεται από τους
   * μετρητές: είναι ο **παρονομαστής**, και ολόκληρος ο λόγος που υπάρχει η
   * λογιστική είναι να συγκριθεί μαζί του. Ένα `considered` υπολογισμένο από τα
   * αθροίσματα θα έκλεινε **πάντα** — δηλαδή δεν θα έλεγχε τίποτα.
   */
  readonly snapshot: (considered: number, limit: number) => AnnouncementCounters;
}

/** Ό,τι διαφέρει ανά μονοπάτι κατοχής, για **ένα** ακίνητο. */
export interface AnnouncementCandidate {
  readonly propertyId: string;
  /** Ο τίτλος όπως τον ξέρει ο άνθρωπος. Κενό όταν το ακίνητο δεν έχει όνομα. */
  readonly propertyTitle: string;
  readonly recipientId: string;
  readonly tenantId: string;
  /** Τα γεγονότα, **ήδη χτισμένα** από το μονοπάτι που ξέρει πώς. */
  readonly facts: ListingMatchFacts;
}

/** Η στιγμή του περάσματος — **μία** για όλα τα ακίνητα. */
export interface PassMoment {
  readonly nowIso: string;
  readonly todayDate: string;
}

/**
 * **Είναι αυτό είδηση; Αν ναι, πες το — και μέτρησέ το.**
 *
 * Ο κοινός πυρήνας των δύο σαρωτών. Ο καλών φέρνει τα γεγονότα και τον
 * παραλήπτη· εδώ γίνεται η κρίση, η επιλογή ζώνης, η αποστολή και η καταμέτρηση.
 *
 * ⚠️ **Η ζώνη, ποτέ το ωμό πλήθος** — αυτό, και μόνο αυτό, κάνει την επανάληψη
 * δομικά αδύνατη (`lib/demand/demand-announcement.ts`).
 */
export async function announceIfNewsworthy(
  tally: AnnouncementTally,
  candidate: AnnouncementCandidate,
  demands: readonly PropertyDemand[],
  moment: PassMoment,
): Promise<void> {
  const { interest } = discloseInterest(
    candidate.facts,
    demands,
    moment.nowIso,
    moment.todayDate,
  );
  const band = announcementBand(interest.disclosure.count);

  if (band === null) {
    tally.countNoNews();
    return;
  }

  tally.countOutcome(
    await announceOnePlace({
      propertyId: candidate.propertyId,
      propertyTitle: candidate.propertyTitle,
      recipientId: candidate.recipientId,
      tenantId: candidate.tenantId,
      band,
      count: interest.disclosure.count ?? 0,
    }),
  );
}

/** Ένας φρέσκος μετρητής. */
export function createAnnouncementTally(): AnnouncementTally {
  let announced = 0;
  let alreadyKnown = 0;
  let noNews = 0;
  let optedOut = 0;

  return {
    countNoNews: () => {
      noNews += 1;
    },
    countOutcome: (outcome) => {
      if (outcome === 'announced') announced += 1;
      else if (outcome === 'already-known') alreadyKnown += 1;
      else optedOut += 1;
    },
    snapshot: (considered, limit) => ({
      announced,
      alreadyKnown,
      noNews,
      optedOut,
      considered,
      truncated: considered === limit,
    }),
  };
}
