/**
 * GET + POST /api/contacts/[contactId]/registry-check — **«Έλεγχος στο ΓΕΜΗ»** για μια επαφή-εταιρεία
 * (ADR-948 §8 Βήμα 5 · καθρέφτης του `licences/[licence]/registry-check`, ADR-915 §40.7 Φ2).
 *
 * **GET** — η κρίση από τα **αποθηκευμένα** (τρέχουσα επαφή ⇄ τελευταία απάντηση του ΓΕΜΗ). Καμία κλήση έξω.
 * **POST** — η **πράξη**: ρωτά το ΓΕΜΗ για ό,τι κρατά **τώρα** η επαφή (Αρ. ΓΕΜΗ, αλλιώς ΑΦΜ).
 *
 * 🔒 **Ούτε ο οργανισμός ούτε ο αριθμός έρχονται από το σώμα**: ο οργανισμός από το `ctx`, ο αριθμός από την
 *    **αποθηκευμένη** επαφή — αλλιώς η διαδρομή θα έλεγχε **ξένο** αριθμό στο όνομα αυτής της επαφής. Δεν υπάρχει σώμα.
 * 🔒 Η επαφή φορτώνεται με τον ΕΝΑ φορτωτή ιδιοκτησίας (`loadOwnedContact`): ξένη ⇒ ίδιο 404 με την ανύπαρκτη.
 * 🔒 Μόνο επαφή-εταιρεία (`isCompanyContact`) — φυσικό πρόσωπο ⇒ 409, πριν από οποιαδήποτε κλήση (ADR-948 §8.3).
 * ⏱️ Βαθμίδα ρυθμού **ρητά** (CHECK 3.78): `standard` για την ανάγνωση, `sensitive` για την πράξη — κάθε POST
 *    καταναλώνει το όριο του κλειδιού ΓΕΜΗ (8/λεπτό, §6.3.1)· υπέρβαση ⇒ `unavailable: rate-limited`, ποτέ «δεν υπάρχει».
 * 🔑 Ιδεμπότητα: ο ξανα-έλεγχος **αντικαθιστά** το ίδιο έγγραφο (`contact_registry_checks/{contactId}`) — και το
 *    `Idempotency-Key` του `withAuth` αποτρέπει τη δεύτερη κλήση έξω σε αυτόματη επανάληψη.
 * 🔑 Ίχνος: γραμμή Ιστορικού `gemiRegistryCheck` (ο Αρ. ΓΕΜΗ της απάντησης) — **μόνο** όταν μάθαμε κάτι
 *    (`recorded !== null`: βρέθηκε, πέρασε τον φράχτη, γράφτηκε).
 *
 * @module api/contacts/[contactId]/registry-check
 */

import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { userPerformer } from '@/lib/audit/audit-performer';
import { auditActorOf, resolvePerformer } from '@/server/lib/performer-stamp';
import { EntityAuditService } from '@/services/entity-audit.service';
import { getContactDisplayName } from '@/types/contacts/helpers';
import type { Contact } from '@/types/contacts';
import { isCompanyContact } from '@/lib/contacts/contact-registry-subject';
import {
  liveContactRegistryDeps,
  readContactRegistryReport,
  verifyContactRegistry,
  type ContactRegistryTarget,
} from '@/services/contact-registry/contact-registry-check.service';
import type { ContactRegistryCheckRecord, ContactRegistryReport } from '@/types/contact-registry-check';
import { loadOwnedContact } from '../../_shared/contact-owned-doc';

type SegmentData = { params: Promise<{ contactId: string }> };

function databaseOf(): Firestore {
  const db = getAdminFirestore();
  if (!db) throw new ApiError(503, 'Database not available');
  return db;
}

interface LoadedTarget {
  readonly db: Firestore;
  readonly target: ContactRegistryTarget;
  readonly contact: DocumentData;
}

/** Δική μου επαφή **και** εταιρεία — αλλιώς η διαδρομή δεν υπάρχει γι' αυτήν. */
async function loadTarget(ctx: AuthContext, contactId: string, action: string): Promise<LoadedTarget> {
  const db = databaseOf();
  const owned = await loadOwnedContact({ contactId, caller: ctx, action, db });
  const contact = owned.data ?? {};
  if (!isCompanyContact(contact)) throw new ApiError(409, 'Contact is not a company', 'NOT_A_COMPANY');
  return { db, target: { contactRef: owned.ref, companyId: ctx.companyId, contactId }, contact };
}

async function readReport(ctx: AuthContext, contactId: string): Promise<ContactRegistryReport> {
  const { db, target, contact } = await loadTarget(ctx, contactId, 'contact-registry-check-read');
  return readContactRegistryReport(target, contact, liveContactRegistryDeps(db));
}

/** Η γραμμή Ιστορικού — ο Αρ. ΓΕΜΗ που απάντησε· η λέξη του πεδίου λύνεται στην προβολή (`gemiRegistryCheck`). */
async function recordAuditLine(ctx: AuthContext, contact: DocumentData, recorded: ContactRegistryCheckRecord): Promise<void> {
  const performer = await resolvePerformer(userPerformer(ctx.uid, ctx.email));
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.CONTACT,
    entityId: recorded.contactId,
    entityName: getContactDisplayName(contact as Contact) || recorded.contactId,
    action: 'updated',
    changes: [{ field: 'gemiRegistryCheck', oldValue: null, newValue: recorded.record.registrationNumber }],
    ...auditActorOf(performer),
    companyId: ctx.companyId,
  });
}

async function check(ctx: AuthContext, contactId: string): Promise<ContactRegistryReport> {
  const { db, target, contact } = await loadTarget(ctx, contactId, 'contact-registry-check-run');
  const { report, recorded } = await verifyContactRegistry(target, contact, ctx.uid, liveContactRegistryDeps(db));
  if (recorded !== null) await recordAuditLine(ctx, contact, recorded);
  return report;
}

function route(
  run: (ctx: AuthContext, contactId: string) => Promise<ContactRegistryReport>,
  permissions: 'crm:contacts:view' | 'crm:contacts:update',
) {
  return async function handle(request: NextRequest, segmentData?: SegmentData): Promise<NextResponse> {
    const { contactId } = await segmentData!.params;
    const handler = withAuth<ApiSuccessResponse<ContactRegistryReport>>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => apiSuccess(await run(ctx, contactId)),
      { permissions },
    );
    return handler(request);
  };
}

export const GET = withStandardRateLimit(route(readReport, 'crm:contacts:view'));
export const POST = withSensitiveRateLimit(route(check, 'crm:contacts:update'));
