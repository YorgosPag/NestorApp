/**
 * @fileoverview **Η ΕΙΔΗΣΗ ΦΤΑΝΕΙ ΣΤΟΝ ΖΗΤΟΥΝΤΑ** — «βγήκε αγγελία που ταιριάζει
 * στη ζήτησή σου», η αντίθετη κατεύθυνση από το `interest-notifier.service.ts`.
 * @related ADR-777 §7 (Α9 · Α5) · §8.69 · §8.69.12 · SPEC-777B §12.6 · lib/demand/demand-answer.ts
 * @module services/demand/listing-match-notifier.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΔΕΝ ΞΑΝΑΓΡΑΦΤΗΚΕ Η ΜΗΧΑΝΗ ΤΑΙΡΙΑΣΜΑΤΟΣ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η κρίση «ταιριάζει αυτή η αγγελία σε αυτή τη ζήτηση;» υπάρχει ήδη, δοκιμασμένη και
 * καθαρή: {@link matchDemand} (`demand-matching.ts`), τροφοδοτημένη από
 * {@link listingFactsFrom} + {@link knowledgeFromListings} (`demand-answer.ts`) — η
 * ίδια αλυσίδα που χρησιμοποιεί ο πελάτης (`answerDemand` → `useDemandAnswer`). Εδώ
 * **δεν** καλείται το `answerDemand` ολόκληρο: εκείνο υπολογίζει επίσης υποχωρήσεις,
 * εμπόδια απορριφθεισών και ανταγωνισμό — άχρηστα σε μια σάρωση που νοιάζεται **μόνο**
 * για το `matched`. Δύο ανεξάρτητοι κριτές για «ταιριάζει;» θα ήταν το σχήμα του ADR-749.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΔΕΝ ΞΑΝΑΧΡΗΣΙΜΟΠΟΙΗΘΗΚΕ ΤΟ `announcement-pass.ts`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κοινός πυρήνας εκεί απαντά *«άλλαξε ΑΡΚΕΤΑ ένα ΜΕΓΕΘΟΣ;»* (ζώνες πλήθους). Η ερώτηση
 * εδώ είναι *«εμφανίστηκε μια νέα ΤΑΥΤΟΤΗΤΑ που δεν είχαμε ξαναπεί;»* — δες το σχόλιο πάνω
 * από {@link demandListingMatchEventId} για το γιατί η ζώνη θα ήταν εδώ **λανθασμένη**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ADR-777 §8.69 — ΚΑΙ Η ΜΕΙΩΣΗ ΤΙΜΗΣ ΠΕΡΝΑ ΑΠΟ ΤΟΝ ΙΔΙΟ ΒΡΟΧΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μια μείωση ενδιαφέρει **μόνο** αγγελία που **ταιριάζει ακόμη** με τη νέα τιμή — άρα το
 * *«σε ποιον τη λέμε;»* έχει **ήδη** απάντηση εδώ, από τον **ίδιο** κριτή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ADR-777 §8.69.12 — ΕΝΑΣ ΑΝΘΡΩΠΟΣ, ΜΙΑ ΑΓΓΕΛΙΑ, ΜΙΑ ΕΙΔΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο βρόχος ήταν **ανά ζήτηση** ⇒ δύο ζητήσεις του ίδιου ανθρώπου = δύο email για την ίδια
 * αγγελία (μετρημένο ζωντανά, §8.69.11 #1). Τώρα είναι **ανά παραλήπτη → ανά αγγελία**
 * (`listing-match-topics.ts`), και οι ζητήσεις ταξιδεύουν ως **λόγοι** (`meta.reasons`).
 *
 * **Layering**: service — Admin SDK + orchestrator. Η **κρίση** ζει στο `lib/demand/`.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import { todayLocalDate } from '@/lib/date-local';
import { NOTIFICATION_EVENT_TYPES, SOURCE_SERVICES, getCurrentEnvironment } from '@/config/notification-events';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import {
  recipientListingMatchEventId,
  type MatchHistory,
} from '@/lib/demand/demand-announcement';
import {
  knowledgeFromListings,
  listingFactsFrom,
} from '@/lib/demand/demand-answer';
import { matchDemand } from '@/lib/demand/demand-matching';
// 🔑 **Ο ΥΠΑΡΧΩΝ helper, ποτέ χειρόγραφο `/listing/${id}`** — κουβαλά ήδη το
//    `encodeURIComponent` και είναι το **ένα** σημείο που ξέρει τη διαδρομή.
import { listingDetailHref } from '@/lib/listings/listing-routes';
import {
  viewDestination,
  type NotificationDestination,
} from '@/lib/notifications/notification-destination';
import { personalWorkspace } from '@/types/workspace-membership';
import { readLiveDemands } from '@/services/demand/live-demands.reader';
import { readLivePublicListings } from '@/services/listings/live-public-listings.reader';
import type { PublicListing } from '@/types/public-listing';
import type { PropertyDemand } from '@/types/property-demand';

import { readRecipientLedger, type RecipientLedger, type TopicKnowledge } from './demand-match-ledger';
import { matchAnnouncementCopy } from './listing-announcement-copy';
import {
  addPriceDropOutcome,
  announcePriceDrop,
  dispatchOutcomeOf,
  type DispatchOutcome,
} from './listing-price-drop-notifier';
import {
  EMPTY_TALLY,
  countMatch,
  groupTopicsByRecipient,
  mergeTallies,
  type ListingTopic,
  type MatchTally,
} from './listing-match-topics';

const logger = createModuleLogger('demand/listing-match-notifier');

/**
 * 🔴 **Πόσα ΝΕΑ ταιριάσματα ανακοινώνονται ανά ΑΝΘΡΩΠΟ, ΣΕ ΕΝΑ ΠΕΡΑΣΜΑ.**
 *
 * ⚠️ **Δεν είναι το ίδιο όριο με το `MAX_ANNOUNCE_PROPERTIES` / `MAX_LIVE_LISTINGS`.**
 * Εκείνα φράζουν πόσα **υποψήφια εξετάζονται** συνολικά. Αυτό φράζει πόσα **email φτάνουν
 * σε ΕΝΑΝ άνθρωπο** σε ένα πέρασμα — μια πλατιά ζήτηση («οποιοδήποτε διαμέρισμα, οπουδήποτε»)
 * μπορεί να ταιριάξει με **εκατοντάδες** αγγελίες με μιας (backfill).
 *
 * 🔑 **§8.69.12 — ανά παραλήπτη, όχι ανά ζήτηση.** Ήταν «ανά ζήτηση», ενώ η πρόθεση ήταν
 * πάντα «ανά άνθρωπο»: με 3 πλατιές ζητήσεις ο ίδιος άνθρωπος έπαιρνε 30 email.
 *
 * 🔴 **ΜΕΤΡΑ ΜΟΝΟ ΝΕΕΣ ΑΝΑΚΟΙΝΩΣΕΙΣ** — το καθολόγιο ξεχωρίζει τα γνωστά **πριν** από το
 * όριο, άρα οι δόσεις είναι **πραγματικές**. Άγκυρα: `Δ1` στο `listing-price-drop-notifier.test.ts`.
 */
export const MAX_NEW_MATCHES_PER_RECIPIENT = 10;

/** Τι απέγινε **ένα** ταίριασμα. Ονομασμένο, ποτέ boolean. */
export type MatchOutcome = DispatchOutcome;

/** Τι έκανε το πέρασμα. **Κλειστή λογιστική.** */
export interface ListingMatchReport extends MatchTally {
  readonly demandsConsidered: number;
  /** `true` όταν η ΔΕΞΑΜΕΝΗ ζητήσεων ή αγγελιών αγγίχθηκε (δες τους readers). */
  readonly truncated: boolean;
}

/** Κλείνει το άθροισμα; Υπάρχει **για να αποτύχει θορυβωδώς**. */
export function listingMatchReportBalances(report: ListingMatchReport): boolean {
  return report.announced + report.alreadyKnown + report.optedOut === report.considered;
}

/**
 * **Ο προορισμός ενός ταιριάσματος** (ADR-849 §6δ Β1) — η **δημόσια** αγγελία, με χώρο
 * τον **ιδιωτικό** χώρο του ζητούντος: εκεί ζουν οι ζητήσεις του (`PROPERTY_DEMANDS`,
 * `mode: 'userId'`). Ο χώρος εδώ είναι **ετικέτα προέλευσης**.
 *
 * 🔑 Εξάγεται ώστε ο ανιχνευτής απόκλισης να ρωτά **αυτόν** τον κανόνα, όχι αντίγραφό του.
 * Τον μοιράζεται και η **μείωση τιμής** (§8.69): ίδια αγγελία, ίδια πόρτα.
 */
export function listingMatchDestination(
  listingId: string,
  recipientId: string,
): NotificationDestination {
  return viewDestination(listingDetailHref(listingId), personalWorkspace(recipientId));
}

/** Ό,τι μοιράζονται όλες οι ανακοινώσεις **ενός** ανθρώπου σε ένα πέρασμα. */
interface RecipientPass {
  readonly recipientId: string;
  readonly topics: readonly ListingTopic[];
  readonly ledger: RecipientLedger;
  readonly nowMs: number;
}

/**
 * Στέλνει **μία** ειδοποίηση για **ένα** θέμα — ή τη σιωπά αν τη γνωρίζει ήδη.
 *
 * ⚠️ **`titleKey` χωρίς πρόθεμα namespace**, ίδιο μετρημένο λόγο με το
 * `interest-notifier.service.ts`: ο `NotificationDrawer` φορτώνει `common-shared`.
 *
 * 🔴 **Η ΔΙΕΥΘΥΝΣΗ ΑΝΗΚΕΙ ΣΤΟΝ ΠΑΡΑΓΩΓΟ, ΟΧΙ ΣΤΟΝ ΑΝΑΓΝΩΣΤΗ** (ADR-841 §7 Α18): ο drawer
 * αποδίδει «Προβολή» μόνο με `actions[0].url`. **ΔΗΜΟΣΙΑ** αγγελία — ο ζητών δεν κατέχει
 * τίποτα εδώ, το `/offers/<id>` θα ήταν ψεύτικη πόρτα. Το `label` δεν φτάνει ποτέ σε οθόνη.
 */
async function announceOneMatch(pass: RecipientPass, topic: ListingTopic): Promise<MatchOutcome> {
  const { listing, reasons } = topic;
  const copy = matchAnnouncementCopy(listing, reasons, pass.nowMs);

  const result = await dispatchNotification({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH,
    recipientId: pass.recipientId,
    // Η ζήτηση **δεν έχει εταιρεία-παραλήπτη**· το επίπεδο απομόνωσής της είναι
    // ο συγγραφέας της (`tenant-config.ts` → `PROPERTY_DEMANDS`, `mode: 'userId'`).
    tenantId: pass.recipientId,
    title: copy.title,
    body: copy.body,
    titleKey: copy.titleKey,
    titleParams: copy.titleParams,
    // 🔑 Θέμα, ΠΟΤΕ ζήτηση — δες `recipientListingMatchEventId`. Οι ζητήσεις είναι λόγοι.
    eventId: recipientListingMatchEventId(listing.id),
    reasons: reasons.demandIds,
    entityId: listing.id,
    ...listingMatchDestination(listing.id, pass.recipientId),
    source: {
      service: SOURCE_SERVICES.CRM,
      feature: 'demand-listing-match',
      env: getCurrentEnvironment(),
    },
  });

  return dispatchOutcomeOf(result);
}

/** Τα ταιριάσματα μιας ζήτησης, **όλα** — το όριο εφαρμόζεται αργότερα, μόνο στα νέα. */
function matchedListings(
  demand: PropertyDemand,
  listings: readonly PublicListing[],
  knowledge: ReturnType<typeof knowledgeFromListings>,
  todayDate: string,
): readonly PublicListing[] {
  return matchDemand(demand, listingFactsFrom(listings, knowledge), todayDate).matched.map(
    (facts) => facts.listing,
  );
}

/** Η μείωση μιας αγγελίας, αν υπάρχει — κριμένη με ό,τι **ήδη** ξέρει ο άνθρωπος. */
async function withPriceDrop(
  tally: MatchTally,
  pass: RecipientPass,
  topic: ListingTopic,
  match: MatchHistory,
): Promise<MatchTally> {
  if (topic.listing.priceReduction === null) return tally;

  const outcome = await announcePriceDrop({
    recipientId: pass.recipientId,
    listing: topic.listing,
    reasons: topic.reasons,
    match,
    alreadyAnnounced: knowledgeOf(pass, topic).priceDropKnown,
    destination: listingMatchDestination(topic.listing.id, pass.recipientId),
    nowMs: pass.nowMs,
  });
  return { ...tally, priceDrops: addPriceDropOutcome(tally.priceDrops, outcome) };
}

const NEVER_ANNOUNCED: MatchHistory = { kind: 'never-announced' };
const UNKNOWN_TOPIC: TopicKnowledge = { match: NEVER_ANNOUNCED, priceDropKnown: false };

function knowledgeOf(pass: RecipientPass, topic: ListingTopic): TopicKnowledge {
  return pass.ledger.get(topic.listing.id) ?? UNKNOWN_TOPIC;
}

/**
 * **Ένας άνθρωπος, ένα πέρασμα**: ό,τι είναι γνωστό κρίνεται για μείωση, ό,τι είναι νέο
 * ανακοινώνεται — μέχρι το όριο, που μετρά **μόνο** τα νέα.
 *
 * 🔑 **Κλειστός διακόπτης ταιριάσματος ⇒ σταματούν οι νέες αποστολές ταιριάσματος για
 * αυτόν τον άνθρωπο** (ίδιος παραλήπτης, ίδιος τύπος ⇒ ίδια απάντηση), **αλλά όχι οι
 * μειώσεις**: ο άνθρωπος που θέλει μόνο μειώσεις έχει δικό του διακόπτη.
 *
 * ⚠️ **Αγγελία που περιμένει το όριο ΔΕΝ παίρνει email μείωσης**: θα ήταν *«μειώθηκε η
 * τιμή»* για αγγελία που δεν του συστήσαμε ποτέ.
 */
async function announceForRecipient(pass: RecipientPass): Promise<MatchTally> {
  let tally = EMPTY_TALLY;
  let matchesSilenced = false;
  let capped = false;

  for (const topic of pass.topics) {
    const { match } = knowledgeOf(pass, topic);
    if (match.kind === 'announced') {
      tally = countMatch(tally, 'already-known');
      tally = await withPriceDrop(tally, pass, topic, match);
    } else if (matchesSilenced) {
      tally = await withPriceDrop(tally, pass, topic, NEVER_ANNOUNCED);
    } else if (tally.announced >= MAX_NEW_MATCHES_PER_RECIPIENT) {
      capped = true;
    } else {
      const outcome = await announceOneMatch(pass, topic);
      tally = countMatch(tally, outcome);
      if (outcome === 'opted-out') {
        matchesSilenced = true;
        tally = await withPriceDrop(tally, pass, topic, NEVER_ANNOUNCED);
      } else if (outcome === 'already-known') {
        // Αγώνας: άλλο πέρασμα το έγραψε ανάμεσα στο καθολόγιο και το `create()`.
        tally = await withPriceDrop(tally, pass, topic, { kind: 'announced', atMs: null });
      }
    }
  }

  return { ...tally, recipientsTruncated: capped ? 1 : 0 };
}

/**
 * Ο βρόχος που **κρίνει, ομαδοποιεί, στέλνει και μετράει** — χωριστός από τη συναρμολόγηση
 * της αναφοράς, ίδιο σχήμα με το `tallyAnnouncements` (`interest-notifier.service.ts`).
 */
async function tallyMatches(
  db: AdminFirestore,
  demands: readonly PropertyDemand[],
  listings: readonly PublicListing[],
  nowMs: number,
): Promise<MatchTally> {
  const knowledge = knowledgeFromListings(listings);
  const todayDate = todayLocalDate();
  const matches = demands
    .map((demand) => ({ demand, matched: matchedListings(demand, listings, knowledge, todayDate) }))
    .filter((entry) => entry.matched.length > 0);

  let tally = EMPTY_TALLY;
  for (const { recipientId, topics, pairs } of groupTopicsByRecipient(matches)) {
    const ledger = await readRecipientLedger(
      db,
      recipientId,
      topics.map(({ listing, reasons }) => ({
        listingId: listing.id,
        demandIds: reasons.demandIds,
        reduction: listing.priceReduction,
      })),
    );
    const passTally = await announceForRecipient({ recipientId, topics, ledger, nowMs });
    tally = mergeTallies(tally, { ...passTally, collapsedReasons: pairs - topics.length });
  }

  return tally;
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

/** Τα δύο ξεχωριστά όρια που μπορεί να αγγίχθηκαν — δες `MAX_NEW_MATCHES_PER_RECIPIENT`. */
function logTruncation(report: ListingMatchReport): void {
  if (report.truncated) {
    logger.warn('Η δεξαμενή ζητήσεων ή αγγελιών αγγίχθηκε — κάποιες ΔΕΝ εξετάστηκαν', {
      data: { demandsConsidered: String(report.demandsConsidered) },
    });
  }
  if (report.recipientsTruncated > 0) {
    logger.warn('Μερικοί παραλήπτες χτύπησαν το ανώτατο όριο ΝΕΩΝ ταιριασμάτων ανά πέρασμα', {
      data: {
        recipientsTruncated: String(report.recipientsTruncated),
        limit: String(MAX_NEW_MATCHES_PER_RECIPIENT),
      },
    });
  }
}

/**
 * **Πες σε κάθε ζητούντα ό,τι νέα αγγελία ταιριάζει στις ζητήσεις του — και ό,τι μειώθηκε.
 * Μία φορά ανά αγγελία, όσες ζητήσεις του κι αν ταιριάζουν.**
 *
 * ⚠️ **Idempotent**: δύο διαδοχικές κλήσεις χωρίς νέα αγγελία και χωρίς νέα μείωση
 * στέλνουν **μηδέν** δεύτερα μηνύματα.
 *
 * 🔑 **Μία ανάγνωση ρολογιού ανά πέρασμα** (`nowMs`): η φρεσκάδα κάθε μείωσης κρίνεται
 * απέναντι στην **ίδια** στιγμή.
 */
export async function announceListingMatchesToDemandAuthors(
  db: AdminFirestore,
): Promise<ListingMatchReport> {
  const nowMs = Date.now();
  const { demands, truncated: demandsPoolTruncated } = await readLiveDemands(
    db,
    'demand/listing-match-notifier',
  );
  const { listings, truncated: listingsPoolTruncated } = await readLivePublicListings(
    db,
    'demand/listing-match-notifier',
  );

  const tally = await tallyMatches(db, demands, listings, nowMs);

  const report: ListingMatchReport = {
    ...tally,
    demandsConsidered: demands.length,
    truncated: demandsPoolTruncated || listingsPoolTruncated,
  };

  assertReportBalances(report);
  logTruncation(report);

  return report;
}
