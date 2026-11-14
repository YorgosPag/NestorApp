/**
 * GET + POST /api/contacts/[contactId]/licences/[licence]/registry-check — **«Έλεγχος στο μητρώο»** για την άδεια
 * μιας επαφής (ADR-915 §40.7 Φ2 · πρότυπο `api/companies/registry-verification`, ADR-841 §7 Α23).
 *
 * **GET** — η κρίση από τα **αποθηκευμένα** (άδεια της επαφής ⇄ τελευταία απάντηση του μητρώου). Καμία κλήση έξω.
 * **POST** — η **πράξη**: ρωτά το μητρώο για τον αριθμό που κρατά **τώρα** η επαφή.
 *
 * 🔒 **Ούτε ο οργανισμός ούτε ο αριθμός έρχονται από το σώμα**: ο οργανισμός από το `ctx`, ο αριθμός από την
 *    **αποθηκευμένη** επαφή — αλλιώς η διαδρομή θα έλεγχε **ξένο** αριθμό στο όνομα αυτής της επαφής. Δεν υπάρχει σώμα.
 * 🔒 Η επαφή φορτώνεται με τον ΕΝΑ φορτωτή ιδιοκτησίας (`loadOwnedContact`): ξένη ⇒ ίδιο 404 με την ανύπαρκτη.
 * ⏱️ Βαθμίδα ρυθμού **ρητά** (CHECK 3.78): `standard` για την ανάγνωση, `sensitive` για την πράξη — κάθε POST είναι
 *    αίτημα σε **τρίτη** δημόσια υπηρεσία, και η ευγένεια προς αυτήν δεν είναι προαιρετική.
 * 🔑 Ιδεμπότητα: ο ξανα-έλεγχος **αντικαθιστά** το ίδιο έγγραφο (`{contactId}__{licence}`) — και το `Idempotency-Key`
 *    του `withAuth` αποτρέπει τη δεύτερη κλήση έξω σε αυτόματη επανάληψη.
 * 🔑 Ίχνος: γραμμή Ιστορικού `registryCheck` με τις τάξεις της αρχής — **μόνο** όταν μάθαμε κάτι (`found` + γράφτηκε).
 *
 * @module api/contacts/[contactId]/licences/[licence]/registry-check
 */

import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { isProfessionalLicence, type ProfessionalLicence } from '@/config/professional-licences';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { userPerformer } from '@/lib/audit/audit-performer';
import { auditActorOf, resolvePerformer } from '@/server/lib/performer-stamp';
import { EntityAuditService } from '@/services/entity-audit.service';
import { getContactDisplayName } from '@/types/contacts/helpers';
import type { Contact } from '@/types/contacts';
import {
  hasRegistryLookup,
  readRegistryCheckReport,
  runRegistryCheck,
  type RegistryCheckTarget,
} from '@/services/professional-registry/registry-check.service';
import { registryCheckSubjectOf } from '@/lib/professional/registry-check-judgment';
import type { ProfessionalRegistryCheckRecord, RegistryCheckReport } from '@/types/professional-registry-check';
import { loadOwnedContact } from '../../../../_shared/contact-owned-doc';

type SegmentData = { params: Promise<{ contactId: string; licence: string }> };

/** Άδεια χωρίς αυτόματο έλεγχο (ή άγνωστη) ⇒ 404: η διαδρομή δεν υπάρχει για αυτήν. */
function licenceOf(raw: string): ProfessionalLicence {
  if (!isProfessionalLicence(raw) || !hasRegistryLookup(raw)) throw new ApiError(404, 'No registry lookup for this licence');
  return raw;
}

function databaseOf(): Firestore {
  const db = getAdminFirestore();
  if (!db) throw new ApiError(503, 'Database not available');
  return db;
}

interface LoadedTarget {
  readonly db: Firestore;
  readonly target: RegistryCheckTarget;
  readonly contact: DocumentData;
}

async function loadTarget(ctx: AuthContext, contactId: string, licence: ProfessionalLicence, action: string): Promise<LoadedTarget> {
  const db = databaseOf();
  const owned = await loadOwnedContact({ contactId, caller: ctx, action, db });
  return { db, target: { contactRef: owned.ref, companyId: ctx.companyId, contactId, licence }, contact: owned.data ?? {} };
}

async function readReport(ctx: AuthContext, contactId: string, licence: ProfessionalLicence): Promise<RegistryCheckReport> {
  const { db, target, contact } = await loadTarget(ctx, contactId, licence, 'registry-check-read');
  return readRegistryCheckReport(db, target, registryCheckSubjectOf(contact, licence));
}

/** Η γραμμή Ιστορικού — οι τάξεις της αρχής, ως κωδικοί· οι λέξεις λύνονται στην προβολή (`registryCheck`). */
async function recordAuditLine(ctx: AuthContext, contact: DocumentData, recorded: ProfessionalRegistryCheckRecord): Promise<void> {
  const performer = await resolvePerformer(userPerformer(ctx.uid, ctx.email));
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.CONTACT,
    entityId: recorded.contactId,
    entityName: getContactDisplayName(contact as Contact) || recorded.contactId,
    action: 'updated',
    changes: [{ field: 'registryCheck', oldValue: null, newValue: JSON.stringify(recorded.grades) }],
    ...auditActorOf(performer),
    companyId: ctx.companyId,
  });
}

async function check(ctx: AuthContext, contactId: string, licence: ProfessionalLicence): Promise<RegistryCheckReport> {
  const { db, target, contact } = await loadTarget(ctx, contactId, licence, 'registry-check-run');
  const subject = registryCheckSubjectOf(contact, licence);
  if (subject.held === null) throw new ApiError(409, 'Contact does not hold this licence', 'LICENCE_NOT_HELD');
  const { report, recorded } = await runRegistryCheck(db, target, { ...subject, held: subject.held }, ctx.uid);
  if (recorded !== null) await recordAuditLine(ctx, contact, recorded);
  return report;
}

function route(
  run: (ctx: AuthContext, contactId: string, licence: ProfessionalLicence) => Promise<RegistryCheckReport>,
  permissions: 'crm:contacts:view' | 'crm:contacts:update',
) {
  return async function handle(request: NextRequest, segmentData?: SegmentData): Promise<NextResponse> {
    const { contactId, licence } = await segmentData!.params;
    const handler = withAuth<ApiSuccessResponse<RegistryCheckReport>>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => apiSuccess(await run(ctx, contactId, licenceOf(licence))),
      { permissions },
    );
    return handler(request);
  };
}

export const GET = withStandardRateLimit(route(readReport, 'crm:contacts:view'));
export const POST = withSensitiveRateLimit(route(check, 'crm:contacts:update'));
