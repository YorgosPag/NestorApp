/**
 * Firestore Rules Test Harness — Document Seeders
 *
 * Factory helpers that seed arrange-phase documents via the security-rules-
 * disabled context. Every seeder takes the same tenant companyId so that
 * tests assert against known data.
 *
 * For `tenant_crossdoc` patterns (e.g. buildings → projects), seeders take
 * upstream document ids so parent docs can be seeded first; see
 * ADR-298 §1.5 pitfall (α).
 *
 * See ADR-298 §3.1.
 *
 * @module tests/firestore-rules/_harness/seed-helpers
 * @since 2026-04-11 (ADR-298 Phase A)
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { withSeedContext } from './auth-contexts';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';

export interface SeedOptions {
  /** Override the companyId for cross-tenant test fixtures. */
  readonly companyId?: string;
  /** Override createdBy — defaults to a synthetic system uid. */
  readonly createdBy?: string;
  /** Extra fields merged on top of the factory defaults. */
  readonly overrides?: Record<string, unknown>;
}

const DEFAULT_CREATED_BY = 'seed-system';

function baseDoc(opts: SeedOptions | undefined): Record<string, unknown> {
  return {
    companyId: opts?.companyId ?? SAME_TENANT_COMPANY_ID,
    createdBy: opts?.createdBy ?? DEFAULT_CREATED_BY,
    createdAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Single-document seeders
// ---------------------------------------------------------------------------

export async function seedProject(
  env: RulesTestEnvironment,
  projectId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('projects').doc(projectId).set({
      name: `Test Project ${projectId}`,
      status: 'planning',
      company: 'Test Company',
      ...baseDoc(opts),
      ...opts?.overrides,
    });
  });
}

export async function seedBuilding(
  env: RulesTestEnvironment,
  buildingId: string,
  projectId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('buildings').doc(buildingId).set({
      name: `Test Building ${buildingId}`,
      projectId,
      ...baseDoc(opts),
      ...opts?.overrides,
    });
  });
}

export async function seedContact(
  env: RulesTestEnvironment,
  contactId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('contacts').doc(contactId).set({
      name: `Test Contact ${contactId}`,
      email: 'seed@example.com',
      phone: '+30 210 0000000',
      ...baseDoc(opts),
      ...opts?.overrides,
    });
  });
}

export async function seedFile(
  env: RulesTestEnvironment,
  fileId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    // The files rule update/delete bodies compare several immutable fields
    // against `resource.data.*` (id, storagePath, createdBy, companyId,
    // status, isDeleted). CEL errors when accessing missing keys, so seed
    // every field the rule will touch on the `ready → trashed` path.
    await ctx.firestore().collection('files').doc(fileId).set({
      id: fileId,
      fileName: `seed-${fileId}.pdf`,
      mimeType: 'application/pdf',
      size: 1024,
      status: 'ready',
      isDeleted: false,
      storagePath: `companies/${opts?.companyId ?? SAME_TENANT_COMPANY_ID}/files/${fileId}`,
      ...baseDoc(opts),
      ...opts?.overrides,
    });
  });
}

export async function seedMessage(
  env: RulesTestEnvironment,
  messageId: string,
  opts?: SeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    // Shape MUST satisfy `isValidMessageData` (firestore.rules:3268) so that
    // subsequent update tests produce a merged doc which is still valid:
    //   required: conversationId, direction, channel, content.text
    await ctx.firestore().collection('messages').doc(messageId).set({
      conversationId: `conv-${messageId}`,
      channel: 'email',
      direction: 'inbound',
      content: { text: 'Seeded by tests' },
      status: 'received',
      subject: 'Seed message',
      ...baseDoc(opts),
      ...opts?.overrides,
    });
  });
}

export async function seedEntityAuditTrail(
  env: RulesTestEnvironment,
  auditId: string,
  opts?: SeedOptions & { entityType?: string; entityId?: string },
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('entity_audit_trail').doc(auditId).set({
      entityType: opts?.entityType ?? 'contact',
      entityId: opts?.entityId ?? 'seeded-entity',
      action: 'created',
      timestamp: new Date(),
      ...baseDoc(opts),
      ...opts?.overrides,
    });
  });
}

/**
 * Extra options for attendance seeders — `skipCompanyId` forces the
 * crossdoc read leg by omitting the companyId field entirely instead of
 * setting it to undefined (which admin SDK rejects on write).
 */
export interface AttendanceSeedOptions extends SeedOptions {
  readonly skipCompanyId?: boolean;
}

/**
 * Seed an `attendance_events` document.
 *
 * The rule at firestore.rules:196 gates reads via a dual OR path: direct
 * `companyId` match first, then `projectId` crossdoc fallback. Canonical
 * seed carries BOTH fields — the direct leg wins. Pass `skipCompanyId:
 * true` to omit companyId entirely (forces the crossdoc path via
 * `belongsToProjectCompany(projectId)`).
 */
export async function seedAttendanceEvent(
  env: RulesTestEnvironment,
  eventId: string,
  projectId: string,
  opts?: AttendanceSeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    const doc: Record<string, unknown> = {
      projectId,
      contactId: `contact-${eventId}`,
      eventType: 'check_in',
      method: 'manual',
      timestamp: new Date(),
      recordedBy: 'seed-system',
      createdBy: opts?.createdBy ?? DEFAULT_CREATED_BY,
      createdAt: new Date(),
      ...opts?.overrides,
    };
    if (!opts?.skipCompanyId) {
      doc.companyId = opts?.companyId ?? SAME_TENANT_COMPANY_ID;
    }
    await ctx.firestore().collection('attendance_events').doc(eventId).set(doc);
  });
}

/**
 * Seed an `attendance_qr_tokens` document.
 *
 * Mirror of `seedAttendanceEvent` for the QR token collection. Every client
 * write denies (`allow create/update/delete: if false`) — this seeder only
 * exists so read/list tests have a fixture to target. Tokens are managed
 * exclusively by the server via Admin SDK in production (ADR-170).
 */
export async function seedAttendanceQrToken(
  env: RulesTestEnvironment,
  tokenId: string,
  projectId: string,
  opts?: AttendanceSeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    const doc: Record<string, unknown> = {
      projectId,
      tokenHash: `hmac-${tokenId}`,
      status: 'active',
      expiresAt: new Date(Date.now() + 86_400_000),
      createdBy: opts?.createdBy ?? DEFAULT_CREATED_BY,
      createdAt: new Date(),
      ...opts?.overrides,
    };
    if (!opts?.skipCompanyId) {
      doc.companyId = opts?.companyId ?? SAME_TENANT_COMPANY_ID;
    }
    await ctx.firestore().collection('attendance_qr_tokens').doc(tokenId).set(doc);
  });
}

// ---------------------------------------------------------------------------
// Accounting seeders (role_dual pattern — ADR-298 Phase B.2)
// ---------------------------------------------------------------------------

/**
 * Seed options for accounting collections that carry a `createdBy` field.
 * The default `createdByUid` is `same_tenant_user.uid` so that
 * `same_tenant_user × update/delete` cells can exercise the `uid == createdBy`
 * path without requiring a per-cell custom seed.
 */
export interface AccountingSeedOptions extends SeedOptions {
  /** uid stored in `createdBy`. Defaults to `PERSONA_CLAIMS.same_tenant_user.uid`. */
  readonly createdByUid?: string;
}

export async function seedAccountingInvoice(
  env: RulesTestEnvironment,
  docId: string,
  opts?: AccountingSeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_invoices').doc(docId).set({
      invoiceNumber: `INV-${docId}`,
      amount: 1000,
      currency: 'EUR',
      status: 'draft',
      ...baseDoc({
        ...opts,
        createdBy: opts?.createdByUid ?? PERSONA_CLAIMS.same_tenant_user.uid,
      }),
      ...opts?.overrides,
    });
  });
}

export async function seedAccountingJournalEntry(
  env: RulesTestEnvironment,
  docId: string,
  opts?: AccountingSeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_journal_entries').doc(docId).set({
      description: `Journal entry ${docId}`,
      debit: 100,
      credit: 100,
      ...baseDoc({
        ...opts,
        createdBy: opts?.createdByUid ?? PERSONA_CLAIMS.same_tenant_user.uid,
      }),
      ...opts?.overrides,
    });
  });
}

/**
 * Seed an `accounting_audit_log` document.
 *
 * The rule at firestore.rules:3099 requires `userId == request.auth.uid` on
 * create. This seeder stores `userId` separately from the `createdBy` base
 * field — the two can differ (admin creates the audit entry recording another
 * user's action). The read rule uses only `companyId` for tenant isolation.
 */
export async function seedAccountingAuditLog(
  env: RulesTestEnvironment,
  docId: string,
  opts?: SeedOptions & { readonly userId?: string },
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('accounting_audit_log').doc(docId).set({
      action: 'created',
      entityType: 'invoice',
      entityId: `inv-${docId}`,
      userId: opts?.userId ?? PERSONA_CLAIMS.same_tenant_admin.uid,
      timestamp: new Date(),
      ...baseDoc(opts),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// CRM seeders (tenant_direct CRM pattern — ADR-298 Phase B.3)
// ---------------------------------------------------------------------------

/**
 * Seed options for CRM collections that carry a `createdBy` field.
 * Default `createdByUid` = `PERSONA_CLAIMS.same_tenant_user.uid` so that
 * `same_tenant_user × update/delete` cells exercise the `uid == createdBy` path.
 */
export interface CrmSeedOptions extends SeedOptions {
  readonly createdByUid?: string;
}

export async function seedLead(
  env: RulesTestEnvironment,
  docId: string,
  opts?: CrmSeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('leads').doc(docId).set({
      title: `Test Lead ${docId}`,
      status: 'new',
      ...baseDoc({
        ...opts,
        createdBy: opts?.createdByUid ?? PERSONA_CLAIMS.same_tenant_user.uid,
      }),
      ...opts?.overrides,
    });
  });
}

export async function seedOpportunity(
  env: RulesTestEnvironment,
  docId: string,
  opts?: CrmSeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('opportunities').doc(docId).set({
      title: `Test Opportunity ${docId}`,
      stage: 'prospecting',
      value: 0,
      ...baseDoc({
        ...opts,
        createdBy: opts?.createdByUid ?? PERSONA_CLAIMS.same_tenant_user.uid,
      }),
      ...opts?.overrides,
    });
  });
}

export async function seedActivity(
  env: RulesTestEnvironment,
  docId: string,
  opts?: CrmSeedOptions,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('activities').doc(docId).set({
      type: 'call',
      description: `Test Activity ${docId}`,
      ...baseDoc({
        ...opts,
        createdBy: opts?.createdByUid ?? PERSONA_CLAIMS.same_tenant_user.uid,
      }),
      ...opts?.overrides,
    });
  });
}

// ---------------------------------------------------------------------------
// Legacy-fallback seeders (no companyId — tests the `|| no companyId` leg)
// ---------------------------------------------------------------------------

export async function seedLegacyBuilding(
  env: RulesTestEnvironment,
  buildingId: string,
  projectId: string,
  createdBy: string,
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('buildings').doc(buildingId).set({
      name: 'Legacy Building',
      projectId,
      createdBy,
      createdAt: new Date(),
      // NOTE: no companyId — exercises the legacy fallback rule leg
    });
  });
}
