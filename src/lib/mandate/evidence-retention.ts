/**
 * @fileoverview **ΠΟΣΟ ΖΕΙ ΕΝΑ ΑΠΟΔΕΙΚΤΙΚΟ, ΚΑΙ ΤΙ ΚΑΝΟΥΜΕ ΜΕ ΑΥΤΟ ΣΗΜΕΡΑ** — ο ΕΝΑΣ κριτής (ADR-864 §20).
 * @related types/mandate-evidence-record.ts · services/mandate/evidence-retention.service.ts ·
 *   types/owner-property-mandate.ts (`isMandateExpired` · `isAgencyRevoked`) · lib/date/quarter-helpers.ts
 * @module lib/mandate/evidence-retention
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΡΟΛΟΙ ΞΕΚΙΝΑ ΑΠΟ ΤΟ ΓΕΓΟΝΟΣ, ΟΧΙ ΑΠΟ ΤΗ ΓΕΝΝΗΣΗ (Purview «event-based retention»)
 * ────────────────────────────────────────────────────────────────────────────
 * Το αποδεικτικό χρειάζεται **όσο μπορεί να γεννηθεί διαφορά** από τη σχέση γραφείου–ακινήτου. Η σχέση είναι
 * ο άξονας, όχι η μία εντολή: **ανανέωση από το ίδιο γραφείο συνεχίζει** τη σχέση (ν.4557/2018 άρθ.30: «μετά τη
 * λήξη της επιχειρηματικής σχέσης»), ενώ εντολή **άλλου** γραφείου δεν αγγίζει το ρολόι του πρώτου.
 *
 * 🔑 **Προθεσμία: ως το τέλος του έτους λήξης + 5 έτη** — η πενταετία συμπίπτει σε τέσσερις πηγές:
 *   ΑΚ 250 αρ.5 (αμοιβές παροχής υπηρεσιών κατ' επάγγελμα) με έναρξη στο **τέλος του έτους** (ΑΚ 253) ·
 *   ΑΚ 937 (αδικοπραξία: 5 έτη από τη γνώση) · ν.4557/2018 άρθ.30 · ν.4308/2014 άρθ.7. Ο ΓΚΠΔ 17§3(ε) το
 *   επιτρέπει (θεμελίωση νομικών αξιώσεων) και ο 5§1(ε) απαγορεύει το «για πάντα» που ίσχυε ως τις 17/09.
 *
 * ⚠️ **Καθαρό, κανένα ρολόι μέσα** — το `now` περνιέται, ώστε η ίδια διέλευση να δίνει την ίδια απάντηση.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import { athensDateRangeToUtc } from '@/lib/date/quarter-helpers';
import type { MandateEvidenceRecord } from '@/types/mandate-evidence-record';
import type { BrokeredListingMandate } from '@/types/owner-property-mandate';
import { isAgencyRevoked, isMandateExpired } from '@/types/owner-property-mandate';

/** Ο κανόνας — **ένα** σημείο για τον αριθμό, την άγκυρα και τη νομική βάση. */
export const EVIDENCE_RETENTION_RULE = {
  id: 'gr-civil-5y-year-end',
  years: 5,
  anchor: 'end-of-calendar-year',
  timezone: 'Europe/Athens',
  basis: ['AK-250-5', 'AK-253', 'AK-937', 'N-4557-2018-30', 'N-4308-2014-7', 'GDPR-17-3-e'],
} as const;

const yearInAthens = (iso: string): number =>
  Number(new Intl.DateTimeFormat('en-CA', { timeZone: EVIDENCE_RETENTION_RULE.timezone, year: 'numeric' }).format(new Date(iso)));

/**
 * `endedAt` → **1η Ιανουαρίου (έτος λήξης + 6), 00:00 ώρα Αθήνας**, ως ISO UTC.
 * Δηλαδή ολόκληρο το έτος λήξης μετρά (ΑΚ 253), και μετά πέντε πλήρη ημερολογιακά έτη.
 */
export function retainUntilOf(endedAtISO: string): string {
  const year = yearInAthens(endedAtISO) + EVIDENCE_RETENTION_RULE.years + 1;
  const firstDay = `${year}-01-01`;
  return athensDateRangeToUtc(firstDay, firstDay).start;
}

/** Ζει ακόμη αυτή η εντολή ως σχέση; — εκκρεμής **μετρά** (η σχέση σχηματίζεται). */
function isRelationshipLive(mandate: BrokeredListingMandate, nowISO: string): boolean {
  return mandate.confirmation !== 'declined' && !isAgencyRevoked(mandate) && !isMandateExpired(mandate, nowISO);
}

/** Η στιγμή που **αυτή** η εντολή σταμάτησε να ζει — ή το `now` όταν δεν λέγεται (συντηρητικά: μεγαλύτερη διατήρηση). */
function endOfMandate(mandate: BrokeredListingMandate, nowISO: string): string {
  if (mandate.confirmation === 'declined') return mandate.decidedAt ?? nowISO;
  if (isAgencyRevoked(mandate)) return mandate.agencyRevokedAt ?? nowISO;
  return isMandateExpired(mandate, nowISO) ? mandate.expiresAt : nowISO;
}

const laterOf = (a: string, b: string): string => (Date.parse(a) >= Date.parse(b) ? a : b);

/**
 * **Πότε έληξε η σχέση του γραφείου με το ακίνητο** — `null` όσο ζει.
 *
 * ⚠️ Χωρίς **καμία** εντολή του γραφείου (αντικαταστάθηκε, ή λείπει το ακίνητο) ⇒ `now`: η στιγμή της
 * απώλειας δεν καταγράφηκε, και η συντηρητική κατεύθυνση είναι **περισσότερη** διατήρηση, ποτέ λιγότερη.
 */
export function relationshipEndedAt(
  mandates: readonly BrokeredListingMandate[],
  agencyCompanyId: string,
  nowISO: string,
): string | null {
  const own = mandates.filter((mandate) => mandate.agencyCompanyId === agencyCompanyId);
  if (own.some((mandate) => isRelationshipLive(mandate, nowISO))) return null;
  return own.map((mandate) => endOfMandate(mandate, nowISO)).reduce(laterOf, own.length === 0 ? nowISO : '1970-01-01T00:00:00.000Z');
}

/** Το επόμενο βήμα για μία εγγραφή — ο διακομιστής **εκτελεί**, δεν κρίνει. */
export type EvidenceRetentionStep =
  | { readonly kind: 'keep' }
  /** Κλείδωμα (ή **επέκταση**) της διατήρησης — `sealed → retained`, ή `retained` με μεταγενέστερη λήξη. */
  | { readonly kind: 'retain'; readonly relationshipEndedAt: string; readonly retainUntil: string }
  | { readonly kind: 'dispose' };

/**
 * 🔴 **Ο ΕΝΑΣ ΚΡΙΤΗΣ ΤΟΥ ΚΥΚΛΟΥ ΖΩΗΣ.** Σειρά:
 *  1. διατεθειμένο ⇒ τίποτα·
 *  2. η σχέση ζει ⇒ τίποτα (και σε `retained`: ξανάνοιξε, το κλείδωμα μένει, **ποτέ** διάθεση)·
 *  3. νέα ημερομηνία **μεταγενέστερη** της κλειδωμένης (ή καμία ακόμη) ⇒ κλείδωμα/επέκταση·
 *  4. δικαστική δέσμευση ⇒ τίποτα·
 *  5. πέρασε η κλειδωμένη ημερομηνία ⇒ διάθεση.
 */
export function evidenceRetentionStepOf(
  record: MandateEvidenceRecord,
  mandates: readonly BrokeredListingMandate[],
  nowISO: string,
): EvidenceRetentionStep {
  if (record.state === 'disposed') return { kind: 'keep' };
  const endedAt = relationshipEndedAt(mandates, record.agencyCompanyId, nowISO);
  if (endedAt === null) return { kind: 'keep' };

  const retainUntil = retainUntilOf(endedAt);
  if (record.retainUntil === null || Date.parse(retainUntil) > Date.parse(record.retainUntil)) {
    return { kind: 'retain', relationshipEndedAt: endedAt, retainUntil };
  }
  if (record.legalHold !== null) return { kind: 'keep' };
  return Date.parse(record.retainUntil) <= Date.parse(nowISO) ? { kind: 'dispose' } : { kind: 'keep' };
}
