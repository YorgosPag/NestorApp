/**
 * @fileoverview ADR-945 §7.2 — το **αίτημα προσφορών** έκδοσης: το αποθηκευμένο έγγραφο, το σχήμα του δίσκου και οι ΔΥΟ
 *   ταυτότητες (αίτημα · προσφορά). Καθαρό (χωρίς `server-only`): το διαβάζουν ο γραφέας, η πύλη και τα τεστ.
 * @related lib/document-validity/issuance-bidding.ts (ο μειωτής) · issuance-assignment-schema.ts (κάθε προσφορά είναι ανάθεση)
 * @module services/document-registry/issuance-request-schema
 *
 * Fail-closed, όπως το `issuance-assignment-schema.ts`: έγγραφο που δεν περνά ⇒ `null`. ⛔ Ποτέ `as StoredIssuanceRequest`:
 * ένα «μαντεμένο» `award` θα έγραφε «Ανατέθηκε» σε προσφορά που δεν κρίθηκε.
 */

import { z } from 'zod';

import { DOCUMENT_KINDS, type DocumentKind } from '@/config/document-validity/document-validity';
import { ISSUANCE_REQUEST_POLICY, type IssuanceRequestRecord } from '@/lib/document-validity/issuance-bidding';
import { professionalKeyOf, type IssuanceProfessional } from '@/lib/document-validity/issuance-professional';
import { custodyScopeFromData, type CustodyScope } from '@/lib/workspace/custody-scope';
import {
  generateDeterministicDocumentIssuanceBidId,
  generateDeterministicDocumentIssuanceRequestId,
} from '@/services/enterprise-id.service';
import { REGISTRY_PROPERTY_SCOPES, type RegistryPropertyScope } from './document-registry.types';
import { professionalSchema } from './issuance-assignment-schema';

/** Το αίτημα με τον κάτοχό του — γραφείο `{ companyId }` ή ιδιώτης `{ userId }` (στον δίσκο επίπεδο πεδίο, `custodyOnly`). */
export interface StoredIssuanceRequest extends IssuanceRequestRecord {
  readonly id: string;
  readonly owner: CustodyScope;
  readonly propertyId: string;
  readonly scope: RegistryPropertyScope;
  readonly documentKind: DocumentKind;
  readonly updatedAt: string;
}

const nonEmpty = z.string().min(1);

const requestSchema = z.object({
  id: nonEmpty,
  /** Ο κάτοχος — **ακριβώς ένα** από τα δύο (`custodyScopeFromData`). */
  companyId: nonEmpty.optional(),
  userId: nonEmpty.optional(),
  propertyId: nonEmpty,
  scope: z.enum(REGISTRY_PROPERTY_SCOPES),
  documentKind: z.enum(DOCUMENT_KINDS),
  cycle: z.number().int().min(1),
  bids: z.array(z.object({
    bidId: nonEmpty,
    professional: professionalSchema,
    invitedAt: nonEmpty,
    invitedByUid: nonEmpty,
  })).max(ISSUANCE_REQUEST_POLICY.maxBids),
  award: z.object({ bidId: nonEmpty, at: nonEmpty, byUid: nonEmpty }).nullable(),
  closure: z.object({ kind: z.literal('cancelled'), at: nonEmpty, byUid: nonEmpty }).nullable(),
  updatedAt: nonEmpty,
}).refine(
  // Η νικήτρια είναι **προσφορά του κύκλου**, και ένας κύκλος δεν είναι ταυτόχρονα ανατεθειμένος και ακυρωμένος.
  (value) => (value.award === null || value.bids.some((bid) => bid.bidId === value.award?.bidId))
    && (value.award === null || value.closure === null),
);

/** Ωμό έγγραφο → αίτημα **με κάτοχο**, ή `null` αν δεν είναι αίτημα που καταλαβαίνουμε (ή δεν έχει ΕΝΑ βιβλίο). */
export function parseIssuanceRequest(raw: unknown): StoredIssuanceRequest | null {
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { companyId, userId, ...rest } = parsed.data;
  // Ο ΙΔΙΟΣ κριτής «ακριβώς ένα βιβλίο» με αναθέσεις, δηλώσεις, ιστορικό και αρχεία — κανένα δεύτερο refine εδώ.
  const owner = custodyScopeFromData({ companyId, userId });
  return owner === null ? null : { ...rest, owner };
}

/** Τα γεγονότα μόνο — ό,τι κρίνει ο μειωτής, χωρίς την ταυτότητα. */
export function issuanceRequestRecordOf(request: StoredIssuanceRequest): IssuanceRequestRecord {
  const { cycle, bids, award, closure } = request;
  return { cycle, bids, award, closure };
}

/**
 * Η ΜΙΑ ταυτότητα αιτήματος ανά (κάτοχος, ακίνητο, είδος). Ίδιο δόγμα με το `upkeepDeclarationIdOf`: γραφείο `<companyId>:…`,
 * ιδιώτης `user:<uid>:…` — καμία ταυτότητα εταιρείας δεν συμπίπτει ποτέ με ταυτότητα χρήστη.
 */
export function issuanceRequestIdOf(owner: CustodyScope, propertyId: string, kind: DocumentKind): string {
  const ledger = owner.userId !== undefined ? `user:${owner.userId}` : owner.companyId;
  return generateDeterministicDocumentIssuanceRequestId(`${ledger}:${propertyId}:${kind}`);
}

/**
 * Η ΜΙΑ ταυτότητα προσφοράς ανά (αίτημα, κύκλος, επαγγελματίας) — έγγραφο του `document_issuance_assignments`. Το
 * κλειδί του επαγγελματία **με πρόθεμα** (`professionalKeyOf`): επαφή και βιτρίνα με ίδιο id δεν συμπίπτουν ποτέ.
 */
export function bidIdOf(requestId: string, cycle: number, professional: IssuanceProfessional): string {
  return generateDeterministicDocumentIssuanceBidId(`${requestId}:${cycle}:${professionalKeyOf(professional)}`);
}
