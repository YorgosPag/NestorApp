/**
 * POST /api/contacts/[contactId]/adopt-account-name — **υιοθέτηση του ονόματος του λογαριασμού** (ADR-915 §40.9).
 *
 * Το σήμα επαφής λέει «Συνδέθηκε ως ΓΕΩΡΓΙΟΣ ΠΕΑΣ · Διαφορετικό όνομα» (§40.8)· εδώ το γραφείο, **ρητά**, γράφει στην
 * επαφή το δομημένο όνομα/επώνυμο του λογαριασμού (πρότυπο enrichment: πρόταση από εξωτερική πηγή, αποδοχή από
 * άνθρωπο, ίχνος — ποτέ αυτόματη αντικατάσταση γεμάτου πεδίου).
 *
 * 🔒 **Το όνομα ΔΕΝ έρχεται από τον πελάτη**: ξαναδιαβάζεται εδώ (`readSoleAcceptedAccount`). Το σώμα κρατά **μόνο** ό,τι
 *    είδε το γραφείο (`expectedCurrent`) — CAS μέσα σε συναλλαγή ⇒ 409 αντί σιωπηλής αντικατάστασης.
 * 🔒 **Ένας** αποδεκτός λογαριασμός, αλλιώς 409: με δύο, «ποιανού το όνομα;» δεν το αποφασίζει ο server.
 * 🔒 Χωρίς δομημένο όνομα **και** επώνυμο ⇒ 422: καμία μαντεψιά διάσπασης (ADR-884 §9.1 Α1).
 * 🔑 Ίδιο όνομα ⇒ `unchanged`, καμία εγγραφή, κανένα cascade (ιδεμπότητα).
 * 🔑 **Cascade στον server, με await** (`propagateContactNameChange`, ADR-249) — τα αντίγραφα του ονόματος σε ακίνητα
 *    και πλάνα πληρωμών. Αποτυχία ⇒ `nameCascade: 'failed'` στην απάντηση, ποτέ σιωπηλά· η επαφή **μένει** γραμμένη
 *    (είναι η αλήθεια· τα αντίγραφα ακολουθούν).
 * 🔑 Ίχνος: CDC (σφραγίδες του ΕΝΟΣ φορέα) **και** `EntityAuditService.recordChange` (CHECK 3.17), όπως στο
 *    `adopt-declared-credential`. Το `search_documents` το ξαναγράφει το `onContactWrite`.
 *
 * @module api/contacts/[contactId]/adopt-account-name
 */

import 'server-only';

import { z } from 'zod';
import type { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { userPerformer } from '@/lib/audit/audit-performer';
import { auditActorOf, performerStamp, resolvePerformer, type ResolvedPerformer } from '@/server/lib/performer-stamp';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { propagateContactNameChange } from '@/lib/firestore/cascade-propagation.service';
import {
  accountNameProposalOf,
  contactPersonFullName,
  contactPersonNameOf,
  sameContactPersonName,
  type ContactPersonName,
  type ContactPersonNameProposal,
} from '@/lib/engagements/contact-account-name-match';
import { readSoleAcceptedAccount } from '@/server/engagements/contact-engagement-link.server';
import type { AdoptAccountNameResponse, NameCascadeOutcome } from '@/types/contact-professional-link';
import { loadOwnedContact } from '../../_shared/contact-owned-doc';

const logger = createModuleLogger('AdoptAccountNameRoute');

type SegmentData = { params: Promise<{ contactId: string }> };

const AdoptNameBodySchema = z.object({
  expectedCurrent: z.object({ firstName: z.string().nullable(), lastName: z.string().nullable() }),
});

/** Το όνομα **από τον server** — ένας αποδεκτός λογαριασμός με δομημένο όνομα, αλλιώς ρητό σφάλμα. */
async function proposalOf(db: Firestore, ctx: AuthContext, contactId: string): Promise<ContactPersonNameProposal> {
  const read = await readSoleAcceptedAccount(db, ctx.companyId, contactId, Date.now());
  if (read.outcome === 'unknown') throw new ApiError(503, 'Linked account unavailable');
  if (read.outcome === 'none') throw new ApiError(409, 'No accepted account to adopt from', 'NO_LINKED_ACCOUNT');
  if (read.outcome === 'ambiguous') throw new ApiError(409, 'More than one accepted account', 'AMBIGUOUS_ACCOUNT');
  const proposal = accountNameProposalOf(read.identity);
  if (proposal === null) throw new ApiError(422, 'Account has no structured name', 'NO_STRUCTURED_NAME');
  return proposal;
}

interface AdoptNameSpec {
  readonly db: Firestore;
  readonly contactId: string;
  readonly proposal: ContactPersonNameProposal;
  readonly expectedCurrent: ContactPersonName;
  readonly performer: ResolvedPerformer;
}

/** `null` ⇒ ήδη ίδιο (`unchanged`)· αλλιώς το όνομα **πριν** την εγγραφή, για το ιστορικό. */
type AdoptNameOutcome = { readonly previous: ContactPersonName } | null;

/** Ξαναδιάβασε → σύγκρινε → γράψε, σε **μία** συναλλαγή. */
function adoptNameInTransaction(spec: AdoptNameSpec): Promise<AdoptNameOutcome> {
  const ref = spec.db.collection(COLLECTIONS.CONTACTS).doc(spec.contactId);
  return spec.db.runTransaction(async (tx) => {
    const current = contactPersonNameOf((await tx.get(ref)).data());
    if (current === null) throw new ApiError(422, 'Only individual contacts hold a person name', 'NOT_INDIVIDUAL');
    if (sameContactPersonName(current, spec.proposal)) return null;
    if (!sameContactPersonName(current, spec.expectedCurrent)) {
      throw new ApiError(409, 'Contact changed since it was read', 'CONTACT_CHANGED');
    }
    const { firstName, lastName } = spec.proposal;
    tx.update(ref, { firstName, lastName, updatedAt: nowISO(), ...performerStamp(spec.performer) });
    return { previous: current };
  });
}

/** Τα αντίγραφα του ονόματος (ADR-249) — η αποτυχία **αναφέρεται**, δεν ρίχνει την ήδη γραμμένη υιοθέτηση. */
async function cascadeName(contactId: string, fullName: string): Promise<NameCascadeOutcome> {
  try {
    const result = await propagateContactNameChange(contactId, fullName);
    if (result.success) return 'complete';
    logger.error('Name cascade after account-name adoption failed', { contactId, error: result.error });
  } catch (error) {
    logger.error('Name cascade after account-name adoption threw', {
      contactId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return 'failed';
}

async function recordAdoption(ctx: AuthContext, contactId: string, previous: ContactPersonName, next: ContactPersonNameProposal, performer: ResolvedPerformer) {
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.CONTACT,
    entityId: contactId,
    entityName: contactPersonFullName(next),
    action: 'updated',
    changes: [
      { field: 'firstName', oldValue: previous.firstName, newValue: next.firstName },
      { field: 'lastName', oldValue: previous.lastName, newValue: next.lastName },
    ],
    ...auditActorOf(performer),
    companyId: ctx.companyId,
  });
}

async function adoptName(req: NextRequest, ctx: AuthContext, contactId: string): Promise<AdoptAccountNameResponse> {
  const parsed = safeParseBody(AdoptNameBodySchema, await req.json());
  if (parsed.error) throw new ApiError(400, 'Invalid request body', 'VALIDATION_ERROR');
  const db = getAdminFirestore();
  if (!db) throw new ApiError(503, 'Database not available');
  await loadOwnedContact({ contactId, caller: ctx, action: 'adopt-account-name', db });
  const proposal = await proposalOf(db, ctx, contactId);
  const performer = await resolvePerformer(userPerformer(ctx.uid, ctx.email));
  const expectedCurrent = parsed.data.expectedCurrent;
  const outcome = await adoptNameInTransaction({ db, contactId, proposal, expectedCurrent, performer });
  if (outcome === null) return { outcome: 'unchanged', nameCascade: 'not-needed' };
  await recordAdoption(ctx, contactId, outcome.previous, proposal, performer);
  return { outcome: 'adopted', nameCascade: await cascadeName(contactId, contactPersonFullName(proposal)) };
}

export const POST = withStandardRateLimit(async function handle(
  request: NextRequest,
  segmentData?: SegmentData,
): Promise<NextResponse> {
  const { contactId } = await segmentData!.params;
  const handler = withAuth<ApiSuccessResponse<AdoptAccountNameResponse>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => apiSuccess(await adoptName(req, ctx, contactId)),
    { permissions: 'crm:contacts:update' },
  );
  return handler(request);
});
