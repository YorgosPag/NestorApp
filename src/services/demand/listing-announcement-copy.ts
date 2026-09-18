/**
 * @fileoverview **ΤΙ ΛΕΕΙ Η ΕΙΔΟΠΟΙΗΣΗ** — θέμα, κλειδί τίτλου και σώμα, για ταίριασμα και μείωση.
 * @related ADR-777 §8.69 · §8.69.12 · services/demand/listing-match-notifier.service.ts · listing-price-drop-notifier.ts
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
 *
 * 🏆 §8.69.12 — **ΕΝΑ ΜΗΝΥΜΑ, ΟΙ ΛΟΓΟΙ ΜΕΣΑ**: όταν η αγγελία ταιριάζει σε πολλές ζητήσεις του
 * ίδιου ανθρώπου, λέγεται **μία** φορά («… σε 2 ζητήσεις σας»), και το «Μπήκε στον
 * προϋπολογισμό σας» το αποφασίζει **ένας** κριτής για ταίριασμα **και** μείωση
 * (`strongestBudgetVerdict`).
 */

import {
  strongestBudgetVerdict,
  type AnnouncementReasons,
  type BudgetVerdict,
} from '@/lib/demand/demand-announcement';
import type {
  DemandSeekMet,
  DemandSeekMetExchange,
  DemandSeekMetPriced,
} from '@/lib/demand/demand-matching';
import { isReductionFresh } from '@/lib/listings/price-history';
import type { PriceRole } from '@/lib/properties/price-resolver';
import elMarket from '@/i18n/locales/el/property-market.json';
import { formatEuro } from '@/services/email-templates/base-email-template';
import type { PriceReduction } from '@/types/price-history';
import type { OfferKind } from '@/types/property-offers';
import type { PublicListing } from '@/types/public-listing';

import type { ListingTopic } from './listing-match-topics';

/** Ό,τι χρειάζεται μια ειδοποίηση για να μιλήσει. */
export interface AnnouncementCopy {
  /** Το θέμα του email — ελληνικό κείμενο του διακομιστή (δηλωμένη εξαίρεση N.11). */
  readonly title: string;
  /** Το κλειδί του κουδουνιού, χωρίς πρόθεμα namespace (`common-shared`). */
  readonly titleKey: string;
  /** Οι παράμετροι του κλειδιού — `title` πάντα, `count` = πλήθος λόγων. */
  readonly titleParams: Readonly<Record<string, string>>;
  /** Το σώμα — `undefined` όταν το θέμα τα λέει ήδη όλα. */
  readonly body?: string;
}

/**
 * **Μία κεφαλίδα**: κλειδί κουδουνιού + ελληνική πρόταση θέματος, για έναν και για πολλούς λόγους.
 *
 * ⚠️ **Ρητό `manyKey`, ποτέ `${key}Many`**: τα κλειδιά μένουν ορατά στο grep και στους
 * ελεγκτές reachability (CHECK 3.13).
 */
interface Lead {
  readonly key: string;
  readonly one: string;
  /** `null` ⇒ η ίδια πρόταση και το ίδιο κλειδί για όσους λόγους κι αν υπάρχουν. */
  readonly many: { readonly key: string; readonly lead: (count: number) => string } | null;
}

type LeadName = 'match' | 'matchReduced' | 'matchIntoBudget' | 'priceDrop' | 'priceDropIntoBudget';

const LEADS: Readonly<Record<LeadName, Lead>> = {
  match: {
    key: 'demandListingMatch.notificationTitle',
    one: 'Νέα αγγελία ταιριάζει στη ζήτησή σας',
    many: {
      key: 'demandListingMatch.notificationTitleMany',
      lead: (count) => `Νέα αγγελία ταιριάζει σε ${count} ζητήσεις σας`,
    },
  },
  matchReduced: {
    key: 'demandListingMatch.reducedTitle',
    one: 'Νέα αγγελία με μειωμένη τιμή ταιριάζει στη ζήτησή σας',
    many: {
      key: 'demandListingMatch.reducedTitleMany',
      lead: (count) => `Νέα αγγελία με μειωμένη τιμή ταιριάζει σε ${count} ζητήσεις σας`,
    },
  },
  matchIntoBudget: { key: 'demandListingMatch.intoBudgetTitle', one: 'Μπήκε στον προϋπολογισμό σας', many: null },
  priceDrop: {
    key: 'demandPriceDrop.notificationTitle',
    one: 'Μειώθηκε η τιμή αγγελίας της ζήτησής σας',
    many: {
      key: 'demandPriceDrop.notificationTitleMany',
      lead: (count) => `Μειώθηκε η τιμή αγγελίας που ταιριάζει σε ${count} ζητήσεις σας`,
    },
  },
  priceDropIntoBudget: { key: 'demandPriceDrop.intoBudgetTitle', one: 'Μπήκε στον προϋπολογισμό σας', many: null },
};

/**
 * Η μονάδα της τιμής ανά ρόλο — εξαντλητική: τέταρτος ρόλος δεν μεταγλωττίζεται εδώ μέχρι
 * να πει κάποιος **πώς** διαβάζεται ένα ποσό του.
 */
const ROLE_SUFFIX: Readonly<Record<PriceRole, string>> = {
  sale: '',
  rent: '/μήνα',
  nightly: '/διανυκτέρευση',
};

/**
 * Το όνομα κάθε συναλλαγής **από τη μεριά του ζητούντος** («Ενοικίαση», όχι «Εκμίσθωση»).
 *
 * ⛔ **ΔΕΝ ξαναγράφεται εδώ**: διαβάζεται από το **ίδιο** locale που δείχνει η σύνοψη της ζήτησης
 * (`property-market` → `demand.summary.seekKind`) — πρότυπο `holiday-question-email-texts.ts`. Το
 * `Record<OfferKind, …>` ⇒ νέα συναλλαγή **δεν μεταγλωττίζεται** χωρίς όνομα στο locale.
 */
const SEEK_KIND_NAME: Readonly<Record<OfferKind, string>> = elMarket.demand.summary.seekKind;

/** «50 €/μήνα κάτω από το όριό σας» — ή τίποτα, όταν δεν υπάρχει όριο (ή λόγος να λεχθεί). */
function headroomPhrase(headroomBy: number | null, formatted: (value: number) => string): string | null {
  if (headroomBy === null) return null;
  return headroomBy === 0 ? 'ακριβώς στο όριό σας' : `${formatted(headroomBy)} κάτω από το όριό σας`;
}

/** Οι λεπτομέρειες μιας συναλλαγής **με ποσό** — «850,00 €/μήνα, 50,00 €/μήνα κάτω από το όριό σας». */
function pricedDetails(met: DemandSeekMetPriced): readonly (string | null)[] {
  if (met.amount === null) return [];
  const suffix = ROLE_SUFFIX[met.role];
  return [`${formatEuro(met.amount)}${suffix}`, headroomPhrase(met.headroomBy, (value) => `${formatEuro(value)}${suffix}`)];
}

/**
 * Οι λεπτομέρειες της **αντιπαροχής** (ADR-777 §8.60.17) — «40% στον οικοπεδούχο, 5 μονάδες κάτω από
 * το όριό σας». Ποσοστό, **ποτέ** ευρώ: ο κλάδος το εγγυάται.
 */
function exchangeDetails(met: DemandSeekMetExchange): readonly (string | null)[] {
  if (met.landownerShare === null) return ['ποσοστό προς συζήτηση'];
  return [
    `${greekNumber(met.landownerShare)}% στον οικοπεδούχο`,
    headroomPhrase(met.headroomBy, (value) => `${greekNumber(value)} μονάδες`),
  ];
}

/** «ως ενοικίαση (850 €/μήνα, 50 €/μήνα κάτω από το όριό σας)» — ή σκέτο «ως αντιπαροχή». */
function metPhrase(met: DemandSeekMet): string {
  const name = `ως ${SEEK_KIND_NAME[met.kind].toLocaleLowerCase('el')}`;
  const details = (met.kind === 'exchange' ? exchangeDetails(met) : pricedDetails(met)).filter(
    (part): part is string => part !== null,
  );
  return details.length === 0 ? name : `${name} (${details.join(', ')})`;
}

/**
 * **Ως τι ταιριάζει** (ADR-777 §8.60.16) — «Ταιριάζει ως αγορά (170.000 €) και ως ενοικίαση
 * (850 €/μήνα).» Κανένα portal δεν το λέει: όλοι κόβουν τη ροή σε **μία** συναλλαγή ανά αναζήτηση.
 *
 * ⚠️ Το ποσό είναι **του ρόλου που ταίριαξε**, ποτέ η κύρια τιμή: αγγελία «πώληση + ενοικίαση» που
 * ταιριάζει ως ενοικίαση δεν λέει τις 200.000 € σε κάποιον που ψάχνει ενοίκιο.
 */
export function matchedAsSentence(metOn: readonly DemandSeekMet[]): string | undefined {
  if (metOn.length === 0) return undefined;
  return `Ταιριάζει ${metOn.map(metPhrase).join(' και ')}.`;
}

/** Αριθμός σε ελληνική γραφή, με ένα δεκαδικό το πολύ: `8.3` ⇒ `8,3`. */
function greekNumber(value: number): string {
  return new Intl.NumberFormat('el', { maximumFractionDigits: 1 }).format(value);
}

/** Ποσοστό μείωσης από μονάδες βάσης: `830` μ.β. ⇒ `8,3`. */
function percentOf(dropBasisPoints: number): string {
  return greekNumber(dropBasisPoints / 100);
}

function subjectOf(lead: string, listingTitle: string): string {
  return listingTitle.length > 0 ? `${lead}: «${listingTitle}»` : lead;
}

/** Θέμα + κλειδί + παράμετροι μιας κεφαλίδας, για το πλήθος λόγων αυτού του θέματος. */
function headerOf(lead: Lead, listing: PublicListing, reasons: AnnouncementReasons): AnnouncementCopy {
  const count = reasons.demandIds.length;
  const many = count > 1 ? lead.many : null;
  return {
    title: subjectOf(many ? many.lead(count) : lead.one, listing.title),
    titleKey: many ? many.key : lead.key,
    titleParams: { title: listing.title, count: String(count) },
  };
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

/**
 * Η δεύτερη πρόταση του `'into-budget'`: **πόσο** κάτω από το όριο — το νούμερο που μετρά.
 *
 * ⚠️ Με πολλούς λόγους το όριο **ονομάζεται**: «το ανώτατο όριο της ζήτησής σας» θα ήταν
 * ασαφές όταν οι ζητήσεις έχουν διαφορετικά όρια.
 */
function intoBudgetSentence(priceMax: number, reduction: PriceReduction, reasonCount: number): string {
  // 🔑 ADR-777 §8.60.15 — το όριο είναι **στη μονάδα της μείωσης**, άρα και η φράση τη λέει.
  const suffix = ROLE_SUFFIX[reduction.role];
  const limit =
    reasonCount > 1
      ? `το όριο ${formatEuro(priceMax)}${suffix} μιας ζήτησής σας`
      : 'το ανώτατο όριο της ζήτησής σας';
  return `Είναι πλέον ${formatEuro(priceMax - reduction.to)}${suffix} κάτω από ${limit}.`;
}

function bodyOf(
  listing: PublicListing,
  reduction: PriceReduction,
  verdict: BudgetVerdict,
  reasons: AnnouncementReasons,
): string {
  const sentence = reductionSentence(reduction, listing.areaSqm);
  return verdict.kind === 'into-budget'
    ? `${sentence} ${intoBudgetSentence(verdict.priceMax, reduction, reasons.demandIds.length)}`
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
export function matchAnnouncementCopy(topic: ListingTopic, nowMs: number): AnnouncementCopy {
  const { listing, reasons, metOn } = topic;
  // 🔑 §8.60.16 — **πρώτα** ως τι ταιριάζει, **μετά** η μείωση: η δεύτερη διαβάζεται μέσα στην πρώτη.
  const matchedAs = matchedAsSentence(metOn);
  const reduction = freshReductionOf(listing, nowMs);
  if (reduction === null) return { ...headerOf(LEADS.match, listing, reasons), body: matchedAs };

  const verdict = strongestBudgetVerdict(reasons.seeks, reduction);
  const lead = verdict.kind === 'into-budget' ? LEADS.matchIntoBudget : LEADS.matchReduced;
  const reductionBody = bodyOf(listing, reduction, verdict, reasons);
  return {
    ...headerOf(lead, listing, reasons),
    body: matchedAs === undefined ? reductionBody : `${matchedAs} ${reductionBody}`,
  };
}

/**
 * **Το email μείωσης** — για αγγελία που ο ζητών **ήδη** ξέρει.
 *
 * 🏆 §8.69.12 — και εδώ το `'into-budget'`: αγγελία που ταίριαζε (π.χ. με την υποχώρηση
 * τιμής του `demand-concessions.ts`) και η μείωση την έφερε **κάτω** από το όριο.
 */
export function priceDropCopy(
  listing: PublicListing,
  reduction: PriceReduction,
  reasons: AnnouncementReasons,
): AnnouncementCopy {
  const verdict = strongestBudgetVerdict(reasons.seeks, reduction);
  const lead = verdict.kind === 'into-budget' ? LEADS.priceDropIntoBudget : LEADS.priceDrop;
  return { ...headerOf(lead, listing, reasons), body: bodyOf(listing, reduction, verdict, reasons) };
}
