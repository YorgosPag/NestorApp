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
  PrivateMarketingStanding,
  PrivateMarketingTerm,
} from '@/types/private-marketing-consent';

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
  }
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
