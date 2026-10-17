/**
 * @fileoverview ADR-915 §27 — **το αίτημα** μιας πράξης ανάθεσης: το σχήμα του σώματος (σύνορο του route) και η ΜΙΑ
 *   μετάφραση αιτήματος → πράξης του μειωτή, κοινή για τον διακομιστή και την αισιόδοξη οθόνη.
 * @related issuance-assignment.ts (ο μειωτής) · services/document-registry/issuance-assignment.service.ts (ο κριτής) ·
 *   components/document-registry/registry-issuance.ts (η αισιόδοξη προβολή)
 * @module lib/document-validity/issuance-request
 *
 * 🔑 **Ο υπεύθυνος του αιτήματος είναι όποιον ΕΙΔΕ ο άνθρωπος** (`expectedOwnerContactId`). Ο διακομιστής τον
 *    ξανακρίνει **πριν** καλέσει τη μετάφραση (`lead-changed`)· άρα όταν φτάνει εδώ, είναι ο αληθινός.
 *
 * **Layering**: leaf — zod + καθαρές συναρτήσεις, μηδέν I/O.
 */

import { z } from 'zod';

import { ISSUER_QUALIFICATIONS } from '@/config/document-validity/document-issuers';
import { DOCUMENT_KINDS } from '@/config/document-validity/document-validity';
import {
  INSTRUCTION_CHANNELS,
  ISSUANCE_NOTE_MAX,
  ISSUANCE_STAGES,
  NOTICE_CHANNELS,
  REGISTRY_NUMBER_MAX,
  type IssuanceAction,
} from './issuance-assignment';

const target = {
  propertyId: z.string().trim().min(1),
  documentKind: z.enum(DOCUMENT_KINDS),
  /** Το στάδιο που **είδε** ο άνθρωπος — `null` = καμία ενεργή ανάθεση (CAS). */
  expectedStage: z.enum(ISSUANCE_STAGES).nullable(),
};

/** Κείμενο προαιρετικό: κενό ⇒ `null` (ένα άδειο πεδίο φόρμας δεν είναι σημείωση). */
const optionalText = (max: number) => z.string().trim().max(max).nullable().transform((value) => (value === '' ? null : value));

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
  }),
  z.object({ action: z.literal('notify'), ...target, channel: z.enum(NOTICE_CHANNELS) }),
  z.object({ action: z.literal('respond'), ...target, outcome: z.enum(['accepted', 'declined']) }),
  z.object({ action: z.literal('cancel'), ...target }),
]);

export type IssuanceAssignmentBody = z.infer<typeof issuanceAssignmentBody>;

// ---------------------------------------------------------------------------
// §28 — αποστολή με σύνδεσμο (γραφείο) · απάντηση από σύνδεσμο (χωρίς λογαριασμό)
// ---------------------------------------------------------------------------

/** Σε ποιον πάει το μήνυμα: ο **υπεύθυνος** ιδιοκτήτης (έγκριση) ή ο επαγγελματίας (ανάθεση). */
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
});

export type IssuanceSendBody = z.infer<typeof issuanceSendBody>;

/** Οι απαντήσεις της σελίδας-συνδέσμου — το ακροατήριο κρίνεται από το **έγγραφο**, όχι από το αίτημα. */
export const ISSUANCE_LINK_ANSWERS = ['approve', 'reject', 'accept', 'decline'] as const;
export type IssuanceLinkAnswer = (typeof ISSUANCE_LINK_ANSWERS)[number];

/** Ό,τι πληκτρολόγησε ο άνθρωπος — η κανονικοποίηση (μόνο ψηφία) και η κρίση γίνονται στον διακομιστή. */
const typedAccessCode = z.string().max(32);

export const issuanceLinkAnswerBody = z.object({
  answer: z.enum(ISSUANCE_LINK_ANSWERS),
  note: optionalText(ISSUANCE_NOTE_MAX),
  /** §29 — ο κωδικός, **ξανά** με την απάντηση: η πόρτα δεν κρατά «ξεκλείδωτη» συνεδρία, κρίνει κάθε πράξη. */
  accessCode: typedAccessCode.nullable().default(null),
});

export type IssuanceLinkAnswerBody = z.infer<typeof issuanceLinkAnswerBody>;

/** §29 — «ξεκλείδωσε την όψη»: μία προσπάθεια κωδικού, που μετρά στο όριο όπως και η απάντηση. */
export const issuanceLinkUnlockBody = z.object({ accessCode: typedAccessCode });

export type IssuanceLinkUnlockBody = z.infer<typeof issuanceLinkUnlockBody>;

/** Ποιο ακροατήριο δίνει κάθε απάντηση — ιδιοκτήτης εγκρίνει/αρνείται, επαγγελματίας αποδέχεται/αρνείται. */
export const LINK_ANSWER_AUDIENCE: Readonly<Record<IssuanceLinkAnswer, IssuanceAudience>> = {
  approve: 'owner',
  reject: 'owner',
  accept: 'professional',
  decline: 'professional',
};

/**
 * Η απάντηση του συνδέσμου → η πράξη του **ίδιου** μειωτή. Ο υπεύθυνος είναι αυτός **στον οποίο στάλθηκε** το αίτημα
 * (ο μειωτής το ξανακρίνει)· `channel: null` = αποφασίζει ο ίδιος, όχι καταγραφή.
 */
export function linkAnswerActionOf(answer: IssuanceLinkAnswerBody, ownerContactId: string): IssuanceAction {
  switch (answer.answer) {
    case 'approve': return { kind: 'decide', outcome: 'approved', channel: null, note: answer.note, ownerContactId };
    case 'reject': return { kind: 'decide', outcome: 'rejected', channel: null, note: answer.note, ownerContactId };
    case 'accept': return { kind: 'respond', outcome: 'accepted', note: answer.note };
    case 'decline': return { kind: 'respond', outcome: 'declined', note: answer.note };
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
      kind: 'decide', outcome: request.outcome, channel: request.channel, note: request.note, ownerContactId: request.expectedOwnerContactId,
    };
    // Καταγραφή του γραφείου: χωρίς μήνυμα της εφαρμογής (το μήνυμα με σύνδεσμο το γράφει η αποστολή, §28).
    case 'notify': return { kind: 'notify', channel: request.channel, invitationId: null, note: null, verification: null };
    case 'respond': return { kind: 'respond', outcome: request.outcome, note: null };
    case 'cancel': return { kind: 'cancel' };
  }
}
