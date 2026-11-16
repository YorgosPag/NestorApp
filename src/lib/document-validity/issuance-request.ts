/**
 * @fileoverview ADR-915 §27 · §42 — **το αίτημα** μιας πράξης ανάθεσης: το σχήμα του σώματος (σύνορο του route) και η
 *   ΜΙΑ μετάφραση αιτήματος → πράξης του μειωτή, κοινή για τον διακομιστή και την αισιόδοξη οθόνη.
 * @related issuance-assignment.ts (ο μειωτής) · services/document-registry/issuance-assignment.service.ts (ο κριτής) ·
 *   components/document-registry/registry-issuance.ts (η αισιόδοξη προβολή)
 * @module lib/document-validity/issuance-request
 *
 * 🔑 **Ο υπεύθυνος του αιτήματος είναι όποιον ΕΙΔΕ ο άνθρωπος** (`expectedOwnerContactId`). Ο διακομιστής τον
 *    ξανακρίνει **πριν** καλέσει τη μετάφραση (`lead-changed`)· άρα όταν φτάνει εδώ, είναι ο αληθινός.
 * 🔑 **Η αναθεώρηση της προσφοράς που ΕΙΔΕ** (`quoteRevision`, §42) ταξιδεύει με κάθε απόφαση: ο μειωτής αρνείται
 *    «ναι» σε τιμή που άλλαξε στο μεταξύ.
 *
 * **Layering**: leaf — zod + καθαρές συναρτήσεις, μηδέν I/O.
 */

import { z } from 'zod';

import { ISSUER_QUALIFICATIONS } from '@/config/document-validity/document-issuers';
import { DOCUMENT_KINDS } from '@/config/document-validity/document-validity';
import { GREEK_VAT_RATE_PERCENTS, type GreekVatRatePercent } from '@/subapps/accounting/services/config/vat-rates';

import {
  INSTRUCTION_CHANNELS,
  ISSUANCE_NOTE_MAX,
  ISSUANCE_STAGES,
  NOTICE_CHANNELS,
  REGISTRY_NUMBER_MAX,
  type IssuanceAction,
} from './issuance-assignment';
import { INSPECTION_CONTACT_POLICY, INSPECTION_CONTACT_ROLES } from './issuance-inspection-contact';
import {
  MYDATA_MARK_PATTERN,
  QUOTE_BASES,
  QUOTE_DELIVERY_BUSINESS_DAYS,
  QUOTE_SCOPE_ITEMS,
  type QuoteTerms,
} from './issuance-quote';

const target = {
  propertyId: z.string().trim().min(1),
  documentKind: z.enum(DOCUMENT_KINDS),
  /** Το στάδιο που **είδε** ο άνθρωπος — `null` = καμία ενεργή ανάθεση (CAS). */
  expectedStage: z.enum(ISSUANCE_STAGES).nullable(),
};

/** Κείμενο προαιρετικό: κενό ⇒ `null` (ένα άδειο πεδίο φόρμας δεν είναι σημείωση). */
const optionalText = (max: number) => z.string().trim().max(max).nullable().transform((value) => (value === '' ? null : value));

/** ISO ημέρα `YYYY-MM-DD` — κοινή με το σχήμα του δίσκου. */
export const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** Συντελεστής ΦΠΑ **του πίνακα** (`24 | 13 | 6 | 0`) — κοινός με το σχήμα του δίσκου. */
export const vatRatePercentSchema = z.number().refine(
  (rate): rate is GreekVatRatePercent => (GREEK_VAT_RATE_PERCENTS as readonly number[]).includes(rate),
);
const quoteRevision = z.number().int().min(1);
/** §45 Φ2 — «παράδοση σε N εργάσιμες από την έγκριση» — κοινό με το σχήμα του δίσκου. */
export const deliveryBusinessDaysSchema = z.number().int().min(QUOTE_DELIVERY_BUSINESS_DAYS.min).max(QUOTE_DELIVERY_BUSINESS_DAYS.max);
const positiveMinor = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

/**
 * §42 — οι όροι της προσφοράς (χωρίς τη σημείωση, που ταξιδεύει δίπλα τους). Το σχήμα κρίνει **μορφή**· το «ισχύει
 * από σήμερα» και το «επιτρέπεται αναθεώρηση» τα κρίνει ο μειωτής, με το ρολόι του διακομιστή.
 */
export const quoteTermsBody = z.object({
  basis: z.enum(QUOTE_BASES),
  amountMinor: positiveMinor,
  vatRatePercent: vatRatePercentSchema,
  vatIncluded: z.boolean(),
  validUntil: isoDay,
  scope: z.array(z.enum(QUOTE_SCOPE_ITEMS)).min(1).max(QUOTE_SCOPE_ITEMS.length).transform((items) => [...new Set(items)]),
  /** §45 Φ2 — υποχρεωτικό σε κάθε νέα προσφορά: πρόσωπο + τιμή + **χρόνος** εγκρίνονται μαζί. */
  deliveryBusinessDays: deliveryBusinessDaysSchema,
});

export type QuoteTermsBody = z.infer<typeof quoteTermsBody>;

/** Οι όροι + η σημείωση → οι όροι του μειωτή. */
export function quoteTermsOf(terms: QuoteTermsBody, note: string | null): QuoteTerms {
  return { ...terms, note };
}

export const issuanceAssignmentBody = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('propose'),
    ...target,
    professionalContactId: z.string().trim().min(1),
    qualification: z.enum(ISSUER_QUALIFICATIONS),
    registryNumber: optionalText(REGISTRY_NUMBER_MAX),
  }),
  z.object({
    action: z.literal('decide'),
    ...target,
    outcome: z.enum(['approved', 'rejected']),
    channel: z.enum(INSTRUCTION_CHANNELS),
    note: optionalText(ISSUANCE_NOTE_MAX),
    expectedOwnerContactId: z.string().trim().min(1),
    /** §42 — η αναθεώρηση της προσφοράς που **είδε** ο άνθρωπος. */
    quoteRevision,
  }),
  z.object({ action: z.literal('notify'), ...target, channel: z.enum(NOTICE_CHANNELS) }),
  z.object({ action: z.literal('respond'), ...target, outcome: z.enum(['accepted', 'declined']) }),
  /** §42 — προσφορά που έφτασε στο γραφείο εκτός συνδέσμου (τηλέφωνο · email) και **καταγράφεται**. */
  z.object({ action: z.literal('record-quote'), ...target, terms: quoteTermsBody, note: optionalText(ISSUANCE_NOTE_MAX) }),
  /** §42 — το παραστατικό της εγκεκριμένης τιμής: ΜΑΡΚ myDATA · ημέρα έκδοσης · σύνολο σε λεπτά. */
  z.object({
    action: z.literal('record-receipt'),
    ...target,
    mark: z.string().trim().regex(MYDATA_MARK_PATTERN),
    issuedOn: isoDay,
    totalMinor: positiveMinor,
  }),
  /**
   * §45 Φ2 — ορισμός (χωρίς δέσμευση στην προσφορά) ή **αλλαγή** της προθεσμίας παράδοσης. Η αιτιολογία είναι
   * υποχρεωτική στην αλλαγή — την κρίνει ο μειωτής, που ξέρει αν υπάρχει ήδη προθεσμία.
   */
  z.object({ action: z.literal('schedule-delivery'), ...target, dueOn: isoDay, reason: optionalText(ISSUANCE_NOTE_MAX) }),
  /**
   * §45.15 — ο υπεύθυνος επικοινωνίας αυτοψίας: **επαφή του γραφείου** + ιδιότητα. Το «Άλλο» θέλει κείμενο — το κρίνει
   * ο μειωτής, που ξέρει και αν είναι ίδιος με τον τρέχοντα.
   */
  z.object({
    action: z.literal('set-inspection-contact'),
    ...target,
    contactId: z.string().trim().min(1),
    role: z.enum(INSPECTION_CONTACT_ROLES),
    roleOther: optionalText(INSPECTION_CONTACT_POLICY.roleOtherMax),
  }),
  z.object({ action: z.literal('cancel'), ...target }),
]);

export type IssuanceAssignmentBody = z.infer<typeof issuanceAssignmentBody>;

// ---------------------------------------------------------------------------
// §28 — αποστολή με σύνδεσμο (γραφείο) · απάντηση από σύνδεσμο (χωρίς λογαριασμό)
// ---------------------------------------------------------------------------

/** Σε ποιον πάει το μήνυμα: ο **υπεύθυνος** ιδιοκτήτης (έγκριση) ή ο επαγγελματίας (αίτημα προσφοράς). */
export const ISSUANCE_AUDIENCES = ['owner', 'professional'] as const;
export type IssuanceAudience = (typeof ISSUANCE_AUDIENCES)[number];

/**
 * Το πρόχειρο — ό,τι διαλέγει ο άνθρωπος πριν πατήσει «Αποστολή». Η προεπισκόπηση και η αποστολή διαβάζουν το **ίδιο**
 * σώμα, άρα ό,τι είδε είναι ό,τι φεύγει. `informContactIds`: οι συνιδιοκτήτες που θα ενημερωθούν (μόνο για `owner`).
 */
export const issuanceSendBody = z.object({
  ...target,
  audience: z.enum(ISSUANCE_AUDIENCES),
  note: optionalText(ISSUANCE_NOTE_MAX),
  /** Μόνο για `owner`: ο υπεύθυνος που **είδε** ο άνθρωπος (ίδια CAS με την απόφαση). */
  expectedOwnerContactId: z.string().trim().min(1).nullable(),
  informContactIds: z.array(z.string().trim().min(1)).max(20),
  /**
   * §29 — ο σύνδεσμος ζητά **και** κωδικό που λέει το γραφείο τηλεφωνικά (DocuSign «Access Code»). Λείπει ⇒ `true`:
   * η ασφαλής επιλογή είναι η προεπιλογή, και ένας παλιός πελάτης δεν στέλνει «σιωπηλά» σύνδεσμο χωρίς κωδικό.
   */
  requireAccessCode: z.boolean().default(true),
  /**
   * §31 — αυτόματες υπενθυμίσεις αν δεν απαντήσει (72 ώρες μετά · την παραμονή της λήξης). Προεπιλογή ενεργές, όπως στο
   * DocuSign και το Adobe Sign· ξεκινούν **μόνο** αν το μήνυμα του γραφείου έφυγε — ποτέ αυτόματη πρώτη αποστολή.
   */
  sendReminders: z.boolean().default(true),
});

export type IssuanceSendBody = z.infer<typeof issuanceSendBody>;

/**
 * Οι απαντήσεις της σελίδας-συνδέσμου — το ακροατήριο κρίνεται από το **έγγραφο**, όχι από το αίτημα. `accept` μένει
 * **μόνο** για παλιές αναθέσεις (§27)· στη ροή §42 ο επαγγελματίας απαντά `quote` ή `decline`.
 */
export const ISSUANCE_LINK_ANSWERS = ['approve', 'reject', 'accept', 'decline', 'quote'] as const;
export type IssuanceLinkAnswer = (typeof ISSUANCE_LINK_ANSWERS)[number];

/** Ό,τι πληκτρολόγησε ο άνθρωπος — η κανονικοποίηση (μόνο ψηφία) και η κρίση γίνονται στον διακομιστή. */
const typedAccessCode = z.string().max(32);

const linkAnswerCommon = {
  note: optionalText(ISSUANCE_NOTE_MAX),
  /** §29 — ο κωδικός, **ξανά** με την απάντηση: η πόρτα δεν κρατά «ξεκλείδωτη» συνεδρία, κρίνει κάθε πράξη. */
  accessCode: typedAccessCode.nullable().default(null),
};

export const issuanceLinkAnswerBody = z.discriminatedUnion('answer', [
  /** §42 — ο υπεύθυνος κρίνει **την αναθεώρηση που είδε**. */
  z.object({ answer: z.literal('approve'), ...linkAnswerCommon, quoteRevision }),
  z.object({ answer: z.literal('reject'), ...linkAnswerCommon, quoteRevision }),
  z.object({ answer: z.literal('accept'), ...linkAnswerCommon }),
  z.object({ answer: z.literal('decline'), ...linkAnswerCommon }),
  z.object({ answer: z.literal('quote'), ...linkAnswerCommon, terms: quoteTermsBody }),
]);

export type IssuanceLinkAnswerBody = z.infer<typeof issuanceLinkAnswerBody>;

/** §29 — «ξεκλείδωσε την όψη»: μία προσπάθεια κωδικού, που μετρά στο όριο όπως και η απάντηση. */
export const issuanceLinkUnlockBody = z.object({ accessCode: typedAccessCode });

export type IssuanceLinkUnlockBody = z.infer<typeof issuanceLinkUnlockBody>;

/** Ποιο ακροατήριο δίνει κάθε απάντηση — ιδιοκτήτης εγκρίνει/αρνείται, επαγγελματίας προσφέρει/αρνείται. */
export const LINK_ANSWER_AUDIENCE: Readonly<Record<IssuanceLinkAnswer, IssuanceAudience>> = {
  approve: 'owner',
  reject: 'owner',
  accept: 'professional',
  decline: 'professional',
  quote: 'professional',
};

/**
 * Η απάντηση του συνδέσμου → η πράξη του **ίδιου** μειωτή. Ο υπεύθυνος είναι αυτός **στον οποίο στάλθηκε** το αίτημα
 * (ο μειωτής το ξανακρίνει)· `channel: null` = αποφασίζει ο ίδιος, όχι καταγραφή.
 */
export function linkAnswerActionOf(answer: IssuanceLinkAnswerBody, ownerContactId: string): IssuanceAction {
  switch (answer.answer) {
    case 'approve':
    case 'reject': return {
      kind: 'decide',
      outcome: answer.answer === 'approve' ? 'approved' : 'rejected',
      channel: null,
      note: answer.note,
      ownerContactId,
      quoteRevision: answer.quoteRevision,
    };
    case 'accept': return { kind: 'respond', outcome: 'accepted', note: answer.note };
    case 'decline': return { kind: 'respond', outcome: 'declined', note: answer.note };
    case 'quote': return { kind: 'quote', terms: quoteTermsOf(answer.terms, answer.note) };
  }
}

/** Το αίτημα → η πράξη του μειωτή. */
export function issuanceActionOf(request: IssuanceAssignmentBody): IssuanceAction {
  switch (request.action) {
    case 'propose': return {
      kind: 'propose',
      professionalContactId: request.professionalContactId,
      credential: { qualification: request.qualification, registryNumber: request.registryNumber },
    };
    case 'decide': return {
      kind: 'decide',
      outcome: request.outcome,
      channel: request.channel,
      note: request.note,
      ownerContactId: request.expectedOwnerContactId,
      quoteRevision: request.quoteRevision,
    };
    // Καταγραφή του γραφείου: χωρίς μήνυμα της εφαρμογής (το μήνυμα με σύνδεσμο το γράφει η αποστολή, §28).
    case 'notify': return { kind: 'notify', channel: request.channel, invitationId: null, note: null, verification: null };
    case 'respond': return { kind: 'respond', outcome: request.outcome, note: null };
    case 'record-quote': return { kind: 'quote', terms: quoteTermsOf(request.terms, request.note) };
    case 'record-receipt': return { kind: 'record-receipt', mark: request.mark, issuedOn: request.issuedOn, totalMinor: request.totalMinor };
    case 'schedule-delivery': return { kind: 'schedule-delivery', dueOn: request.dueOn, reason: request.reason };
    case 'set-inspection-contact': return { kind: 'set-inspection-contact', contactId: request.contactId, role: request.role, roleOther: request.roleOther };
    case 'cancel': return { kind: 'cancel' };
  }
}
