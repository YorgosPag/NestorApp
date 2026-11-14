/**
 * POST /api/contacts/[contactId]/adopt-declared-credential — **υιοθέτηση της δήλωσης του ίδιου** (ADR-915 §40.6).
 *
 * Ό,τι δήλωσε ο επαγγελματίας σε ενεργή συμμετοχή (π.χ. «ΥΠΕΝ 2600») γράφεται στην επαφή του γραφείου — στη λίστα
 * αδειών (`self-declared` + ώρα + συμμετοχή) ή στο πεδίο μητρώου της persona.
 *
 * 🔒 **Η δήλωση ΔΕΝ έρχεται από τον πελάτη**: ξαναδιαβάζεται εδώ (`readContactProfessionalLink`) — αλλιώς ο καθένας θα
 *    έγραφε «δηλωμένο από τον ίδιο» ό,τι ήθελε. Το σώμα κρατά **μόνο** την τιμή που είδε το γραφείο (`expectedCurrent`).
 * 🔒 **CAS μέσα σε συναλλαγή**: αν η επαφή άλλαξε από τότε που την είδε το γραφείο ⇒ 409, ποτέ σιωπηλή αντικατάσταση
 *    ταυτόχρονης χειρόγραφης αλλαγής (Salesforce Data.com Clean: ποτέ αυτόματη αντικατάσταση γεμάτου πεδίου).
 * 🔑 Ήδη ίδια τιμή ⇒ `unchanged`, καμία εγγραφή (ιδεμπότητα· και το `Idempotency-Key` του `withAuth`).
 * 🔑 Ίχνος: CDC των επαφών (σφραγίδες `_lastModified*` του ΕΝΟΣ φορέα) **και** `EntityAuditService.recordChange` με το
 *    ίδιο λυμένο όνομα — το CDC αποδιπλασιάζει μέσα στο παράθυρό του (πρότυπο `ika/.../insurance-class`, CHECK 3.17).
 *
 * @module api/contacts/[contactId]/adopt-declared-credential
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
import { getContactDisplayName } from '@/types/contacts/helpers';
import type { Contact } from '@/types/contacts';
import type { AdoptionTarget } from '@/config/declared-credential-adoption';
import { readContactProfessionalLink } from '@/server/engagements/contact-engagement-link.server';
import {
  compareDeclaredCredential,
  declaredValueOf,
  sameCredentialValue,
  type CredentialValue,
} from '@/lib/contacts/declared-credential-comparison';
import { adoptionPatchOf } from '@/lib/contacts/declared-credential-adoption-patch';
import type { PersonaData } from '@/types/contacts/personas';
import type { AdoptDeclaredCredentialResponse, ContactDeclaredCredential } from '@/types/contact-professional-link';
import { loadOwnedContact } from '../../_shared/contact-owned-doc';

type SegmentData = { params: Promise<{ contactId: string }> };

const AdoptBodySchema = z.object({
  expectedCurrent: z.object({ number: z.string(), chapter: z.string().nullable() }).nullable(),
});

/** Η δήλωση **από τον server** — καμία ⇒ 409 (η εικόνα του γραφείου είναι μπαγιάτικη). */
async function declarationOf(db: Firestore, ctx: AuthContext, contactId: string): Promise<ContactDeclaredCredential> {
  const read = await readContactProfessionalLink(db, ctx.companyId, contactId, Date.now());
  if (read.outcome === 'unknown') throw new ApiError(503, 'Professional link unavailable');
  if (read.link.declared === null) throw new ApiError(409, 'No active declaration to adopt', 'NOTHING_DECLARED');
  return read.link.declared;
}

interface AdoptSpec {
  readonly db: Firestore;
  readonly contactId: string;
  readonly declared: ContactDeclaredCredential;
  readonly expectedCurrent: z.infer<typeof AdoptBodySchema>['expectedCurrent'];
  readonly performer: ResolvedPerformer;
}

/** Τι άλλαξε — για τη γραμμή υπηρεσίας του ιστορικού. */
interface AdoptedChange {
  readonly field: string;
  readonly oldValue: string | null;
  readonly newValue: string;
  readonly entityName: string;
}

interface AdoptOutcome {
  readonly response: AdoptDeclaredCredentialResponse;
  readonly change: AdoptedChange | null;
}

function fieldOf(target: AdoptionTarget): string {
  return target.kind === 'licence' ? `licences.${target.licence}` : `personas.${target.persona}.${target.numberField}`;
}

function plainValue(value: CredentialValue): string {
  return value.chapter === null ? value.number : `${value.number} · ${value.chapter}`;
}

/** Ξαναδιάβασε → σύγκρινε → γράψε, σε **μία** συναλλαγή. */
function adoptInTransaction(spec: AdoptSpec): Promise<AdoptOutcome> {
  const ref = spec.db.collection(COLLECTIONS.CONTACTS).doc(spec.contactId);
  return spec.db.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data() ?? {};
    if (data.type !== 'individual') throw new ApiError(422, 'Only individual contacts hold credentials', 'NOT_INDIVIDUAL');
    const contact = { licences: data.licences, personas: (data.personas as PersonaData[] | undefined) ?? [] };
    const comparison = compareDeclaredCredential(spec.declared, contact);
    if (comparison.state === 'not-adoptable') throw new ApiError(422, 'Declaration is not adoptable', 'NOT_ADOPTABLE');
    if (comparison.state === 'same') return { response: { outcome: 'unchanged' }, change: null };
    if (!sameCredentialValue(comparison.current, spec.expectedCurrent)) {
      throw new ApiError(409, 'Contact changed since it was read', 'CONTACT_CHANGED');
    }
    const nowIso = nowISO();
    const value = declaredValueOf(spec.declared);
    const patch = adoptionPatchOf(comparison.target, contact, { value, engagementId: spec.declared.engagementId, nowIso });
    if (patch.field === null) throw new ApiError(422, 'Declaration does not form a valid credential', 'INVALID_DECLARATION');
    const fields = patch.field === 'licences' ? { licences: patch.licences } : { personas: patch.personas };
    tx.update(ref, { ...fields, updatedAt: nowIso, ...performerStamp(spec.performer) });
    return {
      response: { outcome: 'adopted' },
      change: {
        field: fieldOf(comparison.target),
        oldValue: comparison.current === null ? null : plainValue(comparison.current),
        newValue: plainValue(value),
        entityName: getContactDisplayName(data as Contact) || spec.contactId,
      },
    };
  });
}

async function adopt(req: NextRequest, ctx: AuthContext, contactId: string): Promise<AdoptDeclaredCredentialResponse> {
  const parsed = safeParseBody(AdoptBodySchema, await req.json());
  if (parsed.error) throw new ApiError(400, 'Invalid request body', 'VALIDATION_ERROR');
  const db = getAdminFirestore();
  if (!db) throw new ApiError(503, 'Database not available');
  await loadOwnedContact({ contactId, caller: ctx, action: 'adopt-declared-credential', db });
  const declared = await declarationOf(db, ctx, contactId);
  const performer = await resolvePerformer(userPerformer(ctx.uid, ctx.email));
  const { response, change } = await adoptInTransaction({ db, contactId, declared, expectedCurrent: parsed.data.expectedCurrent, performer });
  if (change !== null) {
    await EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.CONTACT,
      entityId: contactId,
      entityName: change.entityName,
      action: 'updated',
      changes: [{ field: change.field, oldValue: change.oldValue, newValue: change.newValue }],
      ...auditActorOf(performer),
      companyId: ctx.companyId,
    });
  }
  return response;
}

export const POST = withStandardRateLimit(async function handle(
  request: NextRequest,
  segmentData?: SegmentData,
): Promise<NextResponse> {
  const { contactId } = await segmentData!.params;
  const handler = withAuth<ApiSuccessResponse<AdoptDeclaredCredentialResponse>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => apiSuccess(await adopt(req, ctx, contactId)),
    { permissions: 'crm:contacts:update' },
  );
  return handler(request);
});
