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
    case 'notify': return { kind: 'notify', channel: request.channel };
    case 'respond': return { kind: 'respond', outcome: request.outcome };
    case 'cancel': return { kind: 'cancel' };
  }
}
