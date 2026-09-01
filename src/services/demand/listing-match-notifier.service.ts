/**
 * @fileoverview **Η ΕΙΔΗΣΗ ΦΤΑΝΕΙ ΣΤΟΝ ΖΗΤΟΥΝΤΑ** — «βγήκε αγγελία που ταιριάζει
 * στη ζήτησή σου», η αντίθετη κατεύθυνση από το `interest-notifier.service.ts`.
 * @related ADR-777 §7 (Α9 · Α5) · SPEC-777B §12.6 · lib/demand/demand-answer.ts
 * @module services/demand/listing-match-notifier.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΔΕΝ ΞΑΝΑΓΡΑΦΤΗΚΕ Η ΜΗΧΑΝΗ ΤΑΙΡΙΑΣΜΑΤΟΣ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η κρίση «ταιριάζει αυτή η αγγελία σε αυτή τη ζήτηση;» υπάρχει ήδη, δοκιμασμένη και
 * καθαρή: {@link matchDemand} (`demand-matching.ts`), τροφοδοτημένη από
 * {@link listingFactsFrom} + {@link knowledgeFromListings} (`demand-answer.ts`) — η
 * ίδια αλυσίδα που χρησιμοποιεί ο πελάτης (`answerDemand` → `useDemandAnswer`) όταν ο
 * χρήστης ανοίγει την οθόνη του χειροκίνητα. Εδώ **δεν** καλείται το `answerDemand`
 * ολόκληρο: εκείνο υπολογίζει επίσης υποχωρήσεις, εμπόδια απορριφθεισών και τον
 * ανταγωνισμό — τρία πράγματα άχρηστα σε μια σάρωση που νοιάζεται **μόνο** για το
 * `matched`. Δύο ανεξάρτητοι κριτές για «ταιριάζει;» θα ήταν το σχήμα του ADR-749.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΔΕΝ ΞΑΝΑΧΡΗΣΙΜΟΠΟΙΗΘΗΚΕ ΤΟ `announcement-pass.ts`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κοινός πυρήνας εκεί απαντά *«άλλαξε ΑΡΚΕΤΑ ένα ΜΕΓΕΘΟΣ ώστε να αξίζει νέα
 * ειδοποίηση;»* (ζώνες πλήθους). Η ερώτηση εδώ είναι διαφορετική: *«εμφανίστηκε μια
 * νέα ΤΑΥΤΟΤΗΤΑ που δεν είχαμε ξαναπεί;»* — δεν υπάρχει «λίγο παραπάνω ταίριασμα»,
 * υπάρχει μόνο «αυτή η αγγελία, σε αυτή τη ζήτηση, ξαναειπωμένη ή όχι». Το ζόρισμα
 * του υπάρχοντος πυρήνα σε αυτό το σχήμα θα έκρυβε τη διαφορά αντί να τη δηλώνει — δες
 * το σχόλιο πάνω από {@link demandListingMatchEventId} (`demand-announcement.ts`) για
 * το γιατί η ζώνη θα ήταν εδώ **λανθασμένη**, όχι απλώς περιττή.
 *
 * **Layering**: service — Admin SDK + orchestrator. Η **κρίση** ζει στο `lib/demand/`.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import { todayLocalDate } from '@/lib/date-local';
import { NOTIFICATION_EVENT_TYPES, SOURCE_SERVICES, getCurrentEnvironment } from '@/config/notification-events';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import {
  demandListingMatchEventId,
} from '@/lib/demand/demand-announcement';
import {
  knowledgeFromListings,
  listingFactsFrom,
} from '@/lib/demand/demand-answer';
import { matchDemand } from '@/lib/demand/demand-matching';
import { readLiveDemands } from '@/services/demand/live-demands.reader';
import { readLivePublicListings } from '@/services/listings/live-public-listings.reader';
import type { PublicListing } from '@/types/public-listing';
import type { PropertyDemand } from '@/types/property-demand';

const logger = createModuleLogger('demand/listing-match-notifier');

/**
 * 🔴 **Πόσα ΝΕΑ ταιριάσματα ανακοινώνονται ανά ζήτηση, ΣΕ ΕΝΑ ΠΕΡΑΣΜΑ.**
 *
 * ⚠️ **Δεν είναι το ίδιο όριο με το `MAX_ANNOUNCE_PROPERTIES` / `MAX_LIVE_LISTINGS`.**
 * Εκείνα φράζουν πόσα **υποψήφια εξετάζονται** συνολικά σε μια σάρωση. Αυτό φράζει
 * πόσα **email φτάνουν σε ΕΝΑΝ άνθρωπο** σε ένα πέρασμα — και χρειάζεται δικό του
 * όριο επειδή μια πλατιά ζήτηση («οποιοδήποτε διαμέρισμα, οπουδήποτε») μπορεί να
 * ταιριάξει με **εκατοντάδες** αγγελίες με μιας, ειδικά στο πρώτο πέρασμα πάνω από
 * ήδη υπάρχον απόθεμα (backfill). Χωρίς φραγμό, αυτό θα ήταν καταιγισμός email σε ένα
 * μόνο άνοιγμα του inbox — ακριβώς το θόρυβο-με-πρόγραμμα που το
 * `demand-announcement.ts` απορρίπτει για την απέναντι κατεύθυνση, με άλλο σχήμα.
 *
 * 🔑 **Το `10` είναι διαλεγμένο, όχι φυσικός νόμος**: αρκετά για να δείξει ότι υπάρχει
 * πραγματική αγορά, λίγα αρκετά ώστε να παραμένει «είδηση» και όχι «λίστα». Ό,τι
 * περισσέψει **ΔΕΝ χάνεται σιωπηλά** — απλώς δεν αποκτά `eventId` σε αυτό το πέρασμα
 * (το `create()` idempotency τρέχει μόνο για ό,τι πράγματι στέλνεται), άρα τα επόμενα
 * ωριαία περάσματα το ξαναβρίσκουν και το στέλνουν, σε δόσεις των 10. Η καθυστέρηση
 * είναι **φραγμένη και ορατή**: {@link ListingMatchReport.demandsTruncated} μετρά
 * πόσες ζητήσεις χτύπησαν το όριο σε αυτό το πέρασμα.
 */
export const MAX_NEW_MATCHES_PER_DEMAND = 10;

/** Τι απέγινε **ένα** ταίριασμα. Ονομασμένο, ποτέ boolean. */
export type MatchOutcome = 'announced' | 'already-known' | 'opted-out';

/** Τι έκανε το πέρασμα. **Κλειστή λογιστική.** */
export interface ListingMatchReport {
  readonly announced: number;
  readonly alreadyKnown: number;
  readonly optedOut: number;
  /** Πόσα ζεύγη (ζήτηση, αγγελία) κρίθηκαν συνολικά — ο παρονομαστής. */
  readonly considered: number;
  readonly demandsConsidered: number;
  /** Πόσες ζητήσεις χτύπησαν το {@link MAX_NEW_MATCHES_PER_DEMAND} σε αυτό το πέρασμα. */
  readonly demandsTruncated: number;
  /** `true` όταν η ΔΕΞΑΜΕΝΗ ζητήσεων ή αγγελιών αγγίχθηκε (δες τους readers). */
  readonly truncated: boolean;
}

/** Κλείνει το άθροισμα; Υπάρχει **για να αποτύχει θορυβωδώς**. */
export function listingMatchReportBalances(report: ListingMatchReport): boolean {
  return report.announced + report.alreadyKnown + report.optedOut === report.considered;
}

/**
 * Το θέμα του email — **μία** διατύπωση, σε **μία** θέση.
 *
 * ⚠️ Ίδια δηλωμένη εξαίρεση N.11 με το `interest-notifier.service.ts:EMAIL_SUBJECT`:
 * είναι το μόνο σημείο όπου ο διακομιστής συνθέτει κείμενο χωρίς αποδότη i18n, γιατί
 * το email συντίθεται **εκτός** React (`channels/email-channel.ts` το ίδιο ιδίωμα).
 */
const EMAIL_SUBJECT = (listingTitle: string): string =>
  listingTitle.length > 0
    ? `Νέα αγγελία ταιριάζει στη ζήτησή σας: «${listingTitle}» — ΝΕΣΤΩΡ`
    : 'Νέα αγγελία ταιριάζει στη ζήτησή σας — ΝΕΣΤΩΡ';

/** Ό,τι χρειάζεται **μία** ανακοίνωση ζεύγους (ζήτηση, αγγελία). */
interface MatchAnnouncement {
  readonly demandId: string;
  readonly recipientId: string;
  readonly tenantId: string;
  readonly listing: PublicListing;
}

/**
 * Στέλνει **μία** ειδοποίηση για **ένα** ταίριασμα — ή τη σιωπά αν τη γνωρίζει ήδη.
 *
 * ⚠️ **`titleKey` χωρίς πρόθεμα namespace**, ίδιο μετρημένο λόγο με το
 * `interest-notifier.service.ts:227-230`: ο `NotificationDrawer` φορτώνει
 * `common-shared`, άρα το κλειδί ζει εκεί.
 */
async function announceOneMatch(announcement: MatchAnnouncement): Promise<MatchOutcome> {
  const { demandId, recipientId, tenantId, listing } = announcement;

  const result = await dispatchNotification({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH,
    recipientId,
    tenantId,
    title: EMAIL_SUBJECT(listing.title),
    titleKey: 'demandListingMatch.notificationTitle',
    titleParams: { title: listing.title },
    // 🔑 Ζεύγος ταυτότητας, ΠΟΤΕ ζώνη — δες `demandListingMatchEventId` για το γιατί.
    eventId: demandListingMatchEventId(demandId, listing.id),
    entityId: listing.id,
    source: {
      service: SOURCE_SERVICES.CRM,
      feature: 'demand-listing-match',
      env: getCurrentEnvironment(),
    },
  });

  if (!result.success) return 'opted-out';
  if (result.skipped) {
    return result.reason?.includes('Duplicate') === true ? 'already-known' : 'opted-out';
  }
  return 'announced';
}

/** Ταιριάσματα μιας ζήτησης, ήδη κομμένα στο {@link MAX_NEW_MATCHES_PER_DEMAND}. */
function cappedMatches(
  demand: PropertyDemand,
  listings: readonly PublicListing[],
  knowledge: ReturnType<typeof knowledgeFromListings>,
  todayDate: string,
): { readonly listings: readonly PublicListing[]; readonly capped: boolean } {
  const results = matchDemand(demand, listingFactsFrom(listings, knowledge), todayDate);
  const matched = results.matched.map((facts) => facts.listing);
  const capped = matched.length > MAX_NEW_MATCHES_PER_DEMAND;

  return { listings: capped ? matched.slice(0, MAX_NEW_MATCHES_PER_DEMAND) : matched, capped };
}

/** Ό,τι μαζεύει ο βρόχος — πριν αποκτήσει το `demandsConsidered`/`truncated` του περάσματος. */
interface MatchTally {
  readonly announced: number;
  readonly alreadyKnown: number;
  readonly optedOut: number;
  readonly considered: number;
  readonly demandsTruncated: number;
}

/**
 * Ο βρόχος που **κρίνει, στέλνει και μετράει** — χωριστός από τη συναρμολόγηση της
 * αναφοράς, ίδιο σχήμα με το `tallyAnnouncements` (`interest-notifier.service.ts`).
 */
async function tallyMatches(
  demands: readonly PropertyDemand[],
  listings: readonly PublicListing[],
  knowledge: ReturnType<typeof knowledgeFromListings>,
  todayDate: string,
): Promise<MatchTally> {
  let announced = 0;
  let alreadyKnown = 0;
  let optedOut = 0;
  let considered = 0;
  let demandsTruncated = 0;

  for (const demand of demands) {
    const { listings: toAnnounce, capped } = cappedMatches(demand, listings, knowledge, todayDate);
    if (capped) demandsTruncated += 1;

    for (const listing of toAnnounce) {
      considered += 1;
      const outcome = await announceOneMatch({
        demandId: demand.id,
        recipientId: demand.authorUserId,
        // Η ζήτηση **δεν έχει εταιρεία-παραλήπτη**· το επίπεδο απομόνωσής της είναι
        // ο συγγραφέας της (`tenant-config.ts` → `PROPERTY_DEMANDS`, `mode: 'userId'`).
        tenantId: demand.authorUserId,
        listing,
      });
      if (outcome === 'announced') announced += 1;
      else if (outcome === 'already-known') alreadyKnown += 1;
      else optedOut += 1;
    }
  }

  return { announced, alreadyKnown, optedOut, considered, demandsTruncated };
}

/** Άγνωστη κατάσταση ⇒ σφάλμα **με όνομα**, ποτέ σιωπηλή απώλεια κάδου. */
function assertReportBalances(report: ListingMatchReport): void {
  if (!listingMatchReportBalances(report)) {
    throw new Error(
      `listing-match-notifier: ασυνεπής λογιστική — ${report.announced}+${report.alreadyKnown}+` +
        `${report.optedOut} ≠ ${report.considered}`,
    );
  }
}

/** Τα δύο ξεχωριστά όρια που μπορεί να αγγίχθηκαν — δες `MAX_NEW_MATCHES_PER_DEMAND`. */
function logTruncation(report: ListingMatchReport): void {
  if (report.truncated) {
    logger.warn('Η δεξαμενή ζητήσεων ή αγγελιών αγγίχθηκε — κάποιες ΔΕΝ εξετάστηκαν', {
      data: { demandsConsidered: String(report.demandsConsidered) },
    });
  }
  if (report.demandsTruncated > 0) {
    logger.warn('Μερικές ζητήσεις χτύπησαν το ανώτατο όριο ταιριασμάτων ανά πέρασμα', {
      data: {
        demandsTruncated: String(report.demandsTruncated),
        limit: String(MAX_NEW_MATCHES_PER_DEMAND),
      },
    });
  }
}

/**
 * **Πες σε κάθε ζητούντα ό,τι νέα αγγελία ταιριάζει στη ζήτησή του.**
 *
 * ⚠️ **Idempotent**, ίδια εγγύηση με τον ειδοποιητή ιδιοκτητών: δύο διαδοχικές
 * κλήσεις χωρίς νέα αγγελία στέλνουν **μηδέν** δεύτερα μηνύματα.
 */
export async function announceListingMatchesToDemandAuthors(
  db: AdminFirestore,
): Promise<ListingMatchReport> {
  const { demands, truncated: demandsPoolTruncated } = await readLiveDemands(
    db,
    'demand/listing-match-notifier',
  );
  const { listings, truncated: listingsPoolTruncated } = await readLivePublicListings(
    db,
    'demand/listing-match-notifier',
  );

  const knowledge = knowledgeFromListings(listings);
  const todayDate = todayLocalDate();
  const tally = await tallyMatches(demands, listings, knowledge, todayDate);

  const report: ListingMatchReport = {
    ...tally,
    demandsConsidered: demands.length,
    truncated: demandsPoolTruncated || listingsPoolTruncated,
  };

  assertReportBalances(report);
  logTruncation(report);

  return report;
}
