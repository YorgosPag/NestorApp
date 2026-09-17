/**
 * @fileoverview **Ο ΕΝΑΣ ΚΡΙΤΗΣ ΤΗΣ ΚΛΕΙΣΤΗΣ ΔΙΑΘΕΣΗΣ** — ισχύει η συναίνεση; προσθέτει η γραφή παραβίαση;
 * @related ADR-864 §5.4 · §7 Α7/Α7α/Α7β/Α8/Α17 · types/private-marketing-consent.ts
 * @module lib/mandate/private-marketing-standing
 *
 * 🔑 **Καθαρές συναρτήσεις, κανένα ρολόι δικό τους.** Τις καλούν **όλοι** οι γραφείς (κοινό ·
 * εντολή · αποδοχή Σ3 · γέννηση) **και** η υπηρεσία συναίνεσης — ίδιο πρότυπο με το
 * `mandateWriteVerdict` (ADR-827 §9.21): πολλοί καλούντες, **μία** κρίση.
 *
 * 🔴 **ΚΡΙΝΕΤΑΙ Ο,ΤΙ ΑΛΛΑΖΕΙ.** Η άρνηση πέφτει μόνο όταν η γραφή **προσθέτει** παραβίαση. Έτσι ο
 * σαρωτής λήξης, η σφραγίδα «το είδε» και η απόσυρση δεν μπλοκάρονται ποτέ από κατάσταση που
 * **προϋπήρχε** — και η έξοδος (διεύρυνση σε `public`) μένει πάντα ανοιχτή.
 */

import type { MarketingAudience } from '@/constants/marketing-audiences';
import {
  bindingMandates,
  isMandateExpired,
  type BrokeredListingMandate,
  type MandateInvariant,
} from '@/types/owner-property-mandate';
import type {
  PrivateMarketingEvent,
  PrivateMarketingRefusal,
  PrivateMarketingStanding,
  PrivateMarketingTerm,
} from '@/types/private-marketing-consent';

/**
 * **Μία ώρα ανάμεσα σε δύο αιτήματα προς τον ίδιο ιδιοκτήτη** (ADR-864 §19 · Α29).
 *
 * 🌐 Dropbox Sign API, επί λέξει: *«You cannot send a reminder within 1 hour of the last reminder that was sent»*.
 * Ανά εντολή = ανά σχέση γραφείου↔ιδιοκτήτη, όπως εκεί ανά υπογράφοντα.
 */
export const PRIVATE_MARKETING_REQUEST_COOLDOWN_MS = 60 * 60 * 1000;

/** Ό,τι χρειάζεται ο κριτής από την καταχώρηση — τίποτε άλλο. */
interface PrivateMarketingSubject {
  readonly marketingAudience: MarketingAudience;
  readonly mandates: readonly BrokeredListingMandate[];
}

/** Τα γεγονότα της εντολής — η **μία** πόρτα προς το προαιρετικό πεδίο. */
export function privateMarketingEventsOf(
  mandate: BrokeredListingMandate,
): readonly PrivateMarketingEvent[] {
  return Array.isArray(mandate.privateMarketing) ? mandate.privateMarketing : [];
}

/** Οι όροι της εντολής **τώρα** — αυτό που δένει η συναίνεση (Α17). */
export function mandateTermOf(mandate: BrokeredListingMandate): PrivateMarketingTerm {
  return {
    agencyCompanyId: mandate.agencyCompanyId,
    startsAt: mandate.startsAt,
    expiresAt: mandate.expiresAt,
  };
}

function sameTerm(a: PrivateMarketingTerm, b: PrivateMarketingTerm): boolean {
  return a.agencyCompanyId === b.agencyCompanyId && a.startsAt === b.startsAt && a.expiresAt === b.expiresAt;
}

/**
 * **Πού βρίσκεται η συναίνεση αυτής της εντολής** — αποφασίζει το **τελευταίο** γεγονός.
 *
 * ⚠️ Συναίνεση για **άλλους** όρους ⇒ `outdated`, ποτέ `granted` (Α17): ο άνθρωπος υπέγραψε
 * *«αυτό το γραφείο, έως {expiresOn}»* — παράταση είναι άλλη σύμβαση.
 */
export function privateMarketingStandingOf(mandate: BrokeredListingMandate): PrivateMarketingStanding {
  const latest = privateMarketingEventsOf(mandate).at(-1);
  if (latest === undefined) return { kind: 'absent' };

  switch (latest.kind) {
    case 'requested':
      return { kind: 'requested', request: latest };
    case 'revoked':
      return { kind: 'revoked' };
    case 'granted':
      return sameTerm(latest.term, mandateTermOf(mandate))
        ? { kind: 'granted', grant: latest }
        : { kind: 'outdated' };
    case 'declined':
      // Άρνηση για **άλλους** όρους δεν φράζει τη νέα σύμβαση (Α17 · Α35) — μένει μόνο στο ιστορικό.
      return sameTerm(latest.term, mandateTermOf(mandate))
        ? { kind: 'declined', decline: latest }
        : { kind: 'absent' };
  }
}

/**
 * **Πότε επιτρέπεται το επόμενο αίτημα** — `null` = τώρα (Α29 · Α30).
 *
 * 🔑 Από το **τελευταίο** `requested` του ιστορικού — κανένας μετρητής, καμία δεύτερη αλήθεια. Την ίδια τιμή
 * κρίνει ο γραφέας (μέσα στη συναλλαγή) και δείχνει η οθόνη (από το πάνελ του διακομιστή).
 */
export function nextRequestAtOf(mandate: BrokeredListingMandate, nowISOValue: string): string | null {
  const lastRequest = privateMarketingEventsOf(mandate).filter((event) => event.kind === 'requested').at(-1);
  if (lastRequest === undefined) return null;
  const opensAt = Date.parse(lastRequest.at) + PRIVATE_MARKETING_REQUEST_COOLDOWN_MS;
  return opensAt > Date.parse(nowISOValue) ? new Date(opensAt).toISOString() : null;
}

/**
 * **Μπορεί το γραφείο να ζητήσει ΤΩΡΑ;** — `null` = ναι· αλλιώς ο λόγος, με όνομα.
 *
 * Σειρά = σειρά του «τι πρέπει να κάνει ο άνθρωπος»: ισχύει ήδη (τίποτα) · αρνήθηκε (σεβάσου το) · αναμονή (περίμενε).
 */
export function requestRefusalOf(mandate: BrokeredListingMandate, nowISOValue: string): PrivateMarketingRefusal | null {
  const standing = privateMarketingStandingOf(mandate).kind;
  if (standing === 'granted') return 'consent-already-granted';
  if (standing === 'declined') return 'consent-declined';
  return nextRequestAtOf(mandate, nowISOValue) === null ? null : 'consent-request-cooling';
}

/** Εντολές που **δεσμεύουν** αυτή τη στιγμή — εγκεκριμένες, μη ανακληθείσες, μη ληγμένες. */
export function consentBearingMandates(
  mandates: readonly BrokeredListingMandate[],
  nowISOValue: string,
): readonly BrokeredListingMandate[] {
  return bindingMandates(mandates).filter((mandate) => !isMandateExpired(mandate, nowISOValue));
}

/**
 * **Ποια γραφεία κρατούν εντολή χωρίς συναίνεση πάνω σε κλειστό κοινό** (Α7).
 *
 * `public` ⇒ κανένα. Ιδιώτης χωρίς εντολή ⇒ κανένα (Α7β): αποφασίζει για τον εαυτό του.
 */
export function privateMarketingViolators(
  subject: PrivateMarketingSubject,
  nowISOValue: string,
): readonly string[] {
  if (subject.marketingAudience === 'public') return [];
  return consentBearingMandates(subject.mandates, nowISOValue)
    .filter((mandate) => privateMarketingStandingOf(mandate).kind !== 'granted')
    .map((mandate) => mandate.agencyCompanyId);
}

/**
 * 🔴 **ΠΡΟΣΘΕΤΕΙ ΑΥΤΗ Η ΓΡΑΦΗ ΠΑΡΑΒΙΑΣΗ;** — `[]` = προχώρα.
 *
 * @param before — `null` στη γέννηση.
 * @returns `['private-marketing-consent-missing']` όταν **νέο** γραφείο μπαίνει στους παραβάτες.
 */
export function privateMarketingViolationsAdded(
  before: PrivateMarketingSubject | null,
  after: PrivateMarketingSubject,
  nowISOValue: string,
): readonly MandateInvariant[] {
  const prior = new Set(before === null ? [] : privateMarketingViolators(before, nowISOValue));
  const added = privateMarketingViolators(after, nowISOValue).some((agency) => !prior.has(agency));
  return added ? ['private-marketing-consent-missing'] : [];
}
