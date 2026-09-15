/**
 * @fileoverview **Η ΕΙΔΗΣΗ ΦΤΑΝΕΙ ΣΤΟΝ ΖΗΤΟΥΝΤΑ** — «βγήκε αγγελία που ταιριάζει
 * στη ζήτησή σου», η αντίθετη κατεύθυνση από το `interest-notifier.service.ts`.
 * @related ADR-777 §7 (Α9 · Α5) · §8.69 · SPEC-777B §12.6 · lib/demand/demand-answer.ts
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
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ADR-777 §8.69 — ΚΑΙ Η ΜΕΙΩΣΗ ΤΙΜΗΣ ΠΕΡΝΑ ΑΠΟ ΤΟΝ ΙΔΙΟ ΒΡΟΧΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μια μείωση ενδιαφέρει **μόνο** ζήτηση στην οποία η αγγελία **ταιριάζει ακόμη** με τη νέα
 * τιμή — άρα η ερώτηση *«σε ποιον τη λέμε;»* έχει **ήδη** απάντηση εδώ, από τον **ίδιο**
 * κριτή. Ένας δεύτερος βρόχος θα ξαναέτρεχε τη μηχανή ταιριάσματος και θα μπορούσε να
 * διαφωνήσει με αυτόν.
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

import { readMatchLedger, type MatchLedger } from './demand-match-ledger';
import { matchAnnouncementCopy } from './listing-announcement-copy';
import {
  EMPTY_PRICE_DROP_TALLY,
  addPriceDropOutcome,
  announcePriceDrop,
  dispatchOutcomeOf,
  type DispatchOutcome,
  type PriceDropTally,
} from './listing-price-drop-notifier';

const logger = createModuleLogger('demand/listing-match-notifier');

/**
 * 🔴 **Πόσα ΝΕΑ ταιριάσματα ανακοινώνονται ανά ζήτηση, ΣΕ ΕΝΑ ΠΕΡΑΣΜΑ.**
 *
 * ⚠️ **Δεν είναι το ίδιο όριο με το `MAX_ANNOUNCE_PROPERTIES` / `MAX_LIVE_LISTINGS`.**
 * Εκείνα φράζουν πόσα **υποψήφια εξετάζονται** συνολικά σε μια σάρωση. Αυτό φράζει
 * πόσα **email φτάνουν σε ΕΝΑΝ άνθρωπο** σε ένα πέρασμα — και χρειάζεται δικό του
 * όριο επειδή μια πλατιά ζήτηση («οποιοδήποτε διαμέρισμα, οπουδήποτε») μπορεί να
 * ταιριάξει με **εκατοντάδες** αγγελίες με μιας, ειδικά στο πρώτο πέρασμα πάνω από
 * ήδη υπάρχον απόθεμα (backfill).
 *
 * 🔴 **ΜΕΤΡΑ ΜΟΝΟ ΝΕΕΣ ΑΝΑΚΟΙΝΩΣΕΙΣ — και μέχρι 2026-09-15 δεν μετρούσε αυτό.** Το όριο
 * εφαρμοζόταν στα **πρώτα 10 ταιριάσματα**, γνωστά και άγνωστα μαζί. Από το δεύτερο
 * πέρασμα τα ίδια 10 έβγαιναν «ήδη γνωστά» και η **11η αγγελία δεν ανακοινωνόταν ποτέ**
 * — ενώ αυτό ακριβώς το σχόλιο υποσχόταν *«σε δόσεις των 10»*. Τώρα το καθολόγιο
 * (`demand-match-ledger.ts`) ξεχωρίζει τα γνωστά **πριν** από το όριο, και οι δόσεις
 * είναι **πραγματικές**. Άγκυρα: `Δ1` στο `listing-price-drop-notifier.test.ts`.
 */
export const MAX_NEW_MATCHES_PER_DEMAND = 10;

/** Τι απέγινε **ένα** ταίριασμα. Ονομασμένο, ποτέ boolean. */
export type MatchOutcome = DispatchOutcome;

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
  /** ADR-777 §8.69 — οι μειώσεις τιμής, **κάθε** κάδος, και οι σιωπές. */
  readonly priceDrops: PriceDropTally;
}

/** Κλείνει το άθροισμα; Υπάρχει **για να αποτύχει θορυβωδώς**. */
export function listingMatchReportBalances(report: ListingMatchReport): boolean {
  return report.announced + report.alreadyKnown + report.optedOut === report.considered;
}

/**
 * **Ο προορισμός ενός ταιριάσματος** (ADR-849 §6δ Β1) — η **δημόσια** αγγελία, με χώρο
 * τον **ιδιωτικό** χώρο του ζητούντος: εκεί ζει η ζήτησή του (`PROPERTY_DEMANDS`,
 * `mode: 'userId'`). Ο χώρος εδώ είναι **ετικέτα προέλευσης** — η δημόσια αγγελία
 * ανοίγει εκτός χώρου.
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

/** Ό,τι μοιράζονται όλες οι ανακοινώσεις **μίας** ζήτησης σε ένα πέρασμα. */
interface DemandPass {
  readonly demand: PropertyDemand;
  readonly matched: readonly PublicListing[];
  readonly ledger: MatchLedger;
  readonly nowMs: number;
}

/**
 * Στέλνει **μία** ειδοποίηση για **ένα** ταίριασμα — ή τη σιωπά αν τη γνωρίζει ήδη.
 *
 * ⚠️ **`titleKey` χωρίς πρόθεμα namespace**, ίδιο μετρημένο λόγο με το
 * `interest-notifier.service.ts:227-230`: ο `NotificationDrawer` φορτώνει
 * `common-shared`, άρα το κλειδί ζει εκεί.
 *
 * 🔑 **Το κείμενο το αποφασίζει το `matchAnnouncementCopy`** (§8.69): αγγελία που ταιριάζει
 * για πρώτη φορά **με ήδη μειωμένη τιμή** λέγεται **μία** φορά, με τη μείωση μέσα.
 */
async function announceOneMatch(pass: DemandPass, listing: PublicListing): Promise<MatchOutcome> {
  const { demand } = pass;
  const copy = matchAnnouncementCopy(listing, demand.features.priceMax, pass.nowMs);

  const result = await dispatchNotification({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH,
    recipientId: demand.authorUserId,
    // Η ζήτηση **δεν έχει εταιρεία-παραλήπτη**· το επίπεδο απομόνωσής της είναι
    // ο συγγραφέας της (`tenant-config.ts` → `PROPERTY_DEMANDS`, `mode: 'userId'`).
    tenantId: demand.authorUserId,
    title: copy.title,
    body: copy.body,
    titleKey: copy.titleKey,
    titleParams: { title: listing.title },
    // 🔑 Ζεύγος ταυτότητας, ΠΟΤΕ ζώνη — δες `demandListingMatchEventId` για το γιατί.
    eventId: demandListingMatchEventId(demand.id, listing.id),
    entityId: listing.id,
    // 🔴 **Η ΔΙΕΥΘΥΝΣΗ ΑΝΗΚΕΙ ΣΤΟΝ ΠΑΡΑΓΩΓΟ, ΟΧΙ ΣΤΟΝ ΑΝΑΓΝΩΣΤΗ** (ADR-841 §7 Α18).
    //
    // Ο `NotificationDrawer` αποδίδει το κουμπί «Προβολή» **μόνο αν** υπάρχει
    // `actions[0].url` — και ο μηχανισμός **δούλευε ήδη**. Έλειπε **η τροφοδοσία**.
    //
    // ⛔ **ΜΗΝ λυθεί με ευρετική τίτλου στον drawer** — θα έσπαγε με κάθε αλλαγή κειμένου.
    //
    // 🔑 **ΔΗΜΟΣΙΑ αγγελία, και είναι απόφαση**: ο παραλήπτης είναι ο **ζητών** — δεν
    //    κατέχει τίποτα εδώ. Το `/offers/<id>` θα ήταν **ψεύτικη πόρτα**.
    //
    // ⚠️ Το `label` **δεν φτάνει ποτέ σε οθόνη** (σταθερό αγγλικό αναγνωριστικό, N.11).
    ...listingMatchDestination(listing.id, demand.authorUserId),
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

/** Ό,τι μαζεύει ο βρόχος — πριν αποκτήσει το `demandsConsidered`/`truncated` του περάσματος. */
interface MatchTally {
  readonly announced: number;
  readonly alreadyKnown: number;
  readonly optedOut: number;
  readonly considered: number;
  readonly demandsTruncated: number;
  readonly priceDrops: PriceDropTally;
}

const EMPTY_TALLY: MatchTally = {
  announced: 0,
  alreadyKnown: 0,
  optedOut: 0,
  considered: 0,
  demandsTruncated: 0,
  priceDrops: EMPTY_PRICE_DROP_TALLY,
};

const OUTCOME_FIELD: Readonly<Record<MatchOutcome, 'announced' | 'alreadyKnown' | 'optedOut'>> = {
  announced: 'announced',
  'already-known': 'alreadyKnown',
  'opted-out': 'optedOut',
};

function countMatch(tally: MatchTally, outcome: MatchOutcome): MatchTally {
  const field = OUTCOME_FIELD[outcome];
  return { ...tally, [field]: tally[field] + 1, considered: tally.considered + 1 };
}

function mergeTallies(a: MatchTally, b: MatchTally): MatchTally {
  const priceDrops = { ...a.priceDrops };
  for (const key of Object.keys(b.priceDrops) as (keyof PriceDropTally)[]) {
    priceDrops[key] = a.priceDrops[key] + b.priceDrops[key];
  }
  return {
    announced: a.announced + b.announced,
    alreadyKnown: a.alreadyKnown + b.alreadyKnown,
    optedOut: a.optedOut + b.optedOut,
    considered: a.considered + b.considered,
    demandsTruncated: a.demandsTruncated + b.demandsTruncated,
    priceDrops,
  };
}

/** Η μείωση μιας αγγελίας, αν υπάρχει — κριμένη με ό,τι **ήδη** ξέρει ο ζητών. */
async function withPriceDrop(
  tally: MatchTally,
  pass: DemandPass,
  listing: PublicListing,
  match: MatchHistory,
): Promise<MatchTally> {
  if (listing.priceReduction === null) return tally;

  const outcome = await announcePriceDrop({
    demandId: pass.demand.id,
    recipientId: pass.demand.authorUserId,
    tenantId: pass.demand.authorUserId,
    listing,
    match,
    destination: listingMatchDestination(listing.id, pass.demand.authorUserId),
    nowMs: pass.nowMs,
  });
  return { ...tally, priceDrops: addPriceDropOutcome(tally.priceDrops, outcome) };
}

const NEVER_ANNOUNCED: MatchHistory = { kind: 'never-announced' };

/**
 * **Μία ζήτηση, ένα πέρασμα**: ό,τι είναι γνωστό κρίνεται για μείωση, ό,τι είναι νέο
 * ανακοινώνεται — μέχρι το όριο, που μετρά **μόνο** τα νέα.
 *
 * 🔑 **Κλειστός διακόπτης ταιριάσματος ⇒ σταματούν οι νέες αποστολές ταιριάσματος για
 * αυτή τη ζήτηση** (ίδιος παραλήπτης, ίδιος τύπος ⇒ ίδια απάντηση), **αλλά όχι οι
 * μειώσεις**: ο άνθρωπος που θέλει μόνο μειώσεις έχει δικό του διακόπτη.
 *
 * ⚠️ **Αγγελία που περιμένει το όριο ΔΕΝ παίρνει email μείωσης**: θα ήταν *«μειώθηκε η
 * τιμή»* για αγγελία που δεν του συστήσαμε ποτέ. Θα τη μάθει με το επόμενο πέρασμα, ως
 * ταίριασμα με τη μείωση μέσα.
 */
async function announceForDemand(pass: DemandPass): Promise<MatchTally> {
  let tally = EMPTY_TALLY;
  let matchesSilenced = false;
  let capped = false;

  for (const listing of pass.matched) {
    const announcedAtMs = pass.ledger.get(listing.id);
    if (announcedAtMs !== undefined) {
      tally = countMatch(tally, 'already-known');
      tally = await withPriceDrop(tally, pass, listing, { kind: 'announced', atMs: announcedAtMs });
    } else if (matchesSilenced) {
      tally = await withPriceDrop(tally, pass, listing, NEVER_ANNOUNCED);
    } else if (tally.announced >= MAX_NEW_MATCHES_PER_DEMAND) {
      capped = true;
    } else {
      const outcome = await announceOneMatch(pass, listing);
      tally = countMatch(tally, outcome);
      if (outcome === 'opted-out') {
        matchesSilenced = true;
        tally = await withPriceDrop(tally, pass, listing, NEVER_ANNOUNCED);
      } else if (outcome === 'already-known') {
        // Αγώνας: άλλο πέρασμα το έγραψε ανάμεσα στο καθολόγιο και το `create()`.
        tally = await withPriceDrop(tally, pass, listing, { kind: 'announced', atMs: null });
      }
    }
  }

  return { ...tally, demandsTruncated: capped ? 1 : 0 };
}

/**
 * Ο βρόχος που **κρίνει, στέλνει και μετράει** — χωριστός από τη συναρμολόγηση της
 * αναφοράς, ίδιο σχήμα με το `tallyAnnouncements` (`interest-notifier.service.ts`).
 */
async function tallyMatches(
  db: AdminFirestore,
  demands: readonly PropertyDemand[],
  listings: readonly PublicListing[],
  nowMs: number,
): Promise<MatchTally> {
  const knowledge = knowledgeFromListings(listings);
  const todayDate = todayLocalDate();
  let tally = EMPTY_TALLY;

  for (const demand of demands) {
    const matched = matchedListings(demand, listings, knowledge, todayDate);
    if (matched.length === 0) continue;

    const ledger = await readMatchLedger(
      db,
      demand.authorUserId,
      demand.id,
      matched.map((listing) => listing.id),
    );
    tally = mergeTallies(tally, await announceForDemand({ demand, matched, ledger, nowMs }));
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

/** Τα δύο ξεχωριστά όρια που μπορεί να αγγίχθηκαν — δες `MAX_NEW_MATCHES_PER_DEMAND`. */
function logTruncation(report: ListingMatchReport): void {
  if (report.truncated) {
    logger.warn('Η δεξαμενή ζητήσεων ή αγγελιών αγγίχθηκε — κάποιες ΔΕΝ εξετάστηκαν', {
      data: { demandsConsidered: String(report.demandsConsidered) },
    });
  }
  if (report.demandsTruncated > 0) {
    logger.warn('Μερικές ζητήσεις χτύπησαν το ανώτατο όριο ΝΕΩΝ ταιριασμάτων ανά πέρασμα', {
      data: {
        demandsTruncated: String(report.demandsTruncated),
        limit: String(MAX_NEW_MATCHES_PER_DEMAND),
      },
    });
  }
}

/**
 * **Πες σε κάθε ζητούντα ό,τι νέα αγγελία ταιριάζει στη ζήτησή του — και ό,τι μειώθηκε.**
 *
 * ⚠️ **Idempotent**, ίδια εγγύηση με τον ειδοποιητή ιδιοκτητών: δύο διαδοχικές
 * κλήσεις χωρίς νέα αγγελία και χωρίς νέα μείωση στέλνουν **μηδέν** δεύτερα μηνύματα.
 *
 * 🔑 **Μία ανάγνωση ρολογιού ανά πέρασμα** (`nowMs`): η φρεσκάδα κάθε μείωσης κρίνεται
 * απέναντι στην **ίδια** στιγμή — δύο αναγνώσεις θα έκαναν το ίδιο πέρασμα να διαφωνεί με
 * τον εαυτό του σε μείωση που λήγει ακριβώς τώρα.
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
