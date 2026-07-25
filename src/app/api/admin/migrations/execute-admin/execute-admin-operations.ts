/**
 * =============================================================================
 * execute-admin — migration operations (ADR-704 split)
 * =============================================================================
 *
 * "Fix Project-Company Relationships (Admin SDK)" migration, extracted from the
 * route so route.ts stays thin and each step stays under the 40-line limit.
 * Bypass-role guard (ADR-703) + audit + entity-audit trail stay owned here.
 *
 * @module api/admin/migrations/execute-admin/operations
 * @enterprise RFC v6 - Authorization & RBAC System
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { logMigrationExecuted, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth/types';
import { isRoleBypass } from '@/lib/auth/roles';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { ENTITY_STATUS } from '@/constants/entity-status-values';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('ExecuteAdminMigrationRoute');
const MIGRATION_ID = '001_fix_project_company_relationships_admin';
const MIGRATION_NAME = 'Fix Project-Company Relationships (Admin SDK)';
const SYSTEM_LABEL = 'Nestor Pagonis Enterprise Platform - Admin SDK';

interface CompanyData { id: string; companyName?: string; }
interface ProjectData { id: string; name?: string; company?: string; companyId?: string; }
interface Mapping {
  projectId: string;
  projectName?: string;
  oldCompanyId: string;
  newCompanyId: string;
  companyName?: string;
}
interface IntegrityReport { total: number; valid: number; orphan: number; score: number; }

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

async function fetchActiveCompanies(db: Firestore): Promise<CompanyData[]> {
  const snap = await db.collection(COLLECTIONS.CONTACTS)
    .where(FIELDS.TYPE, '==', 'company')
    .where(FIELDS.STATUS, '==', ENTITY_STATUS.ACTIVE)
    .get();
  return snap.docs.map(doc => ({ id: doc.id, companyName: doc.data().companyName as string | undefined }));
}

async function fetchProjects(db: Firestore): Promise<ProjectData[]> {
  const snap = await db.collection(COLLECTIONS.PROJECTS).get();
  return snap.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name as string | undefined,
    company: doc.data().company as string | undefined,
    companyId: doc.data().companyId as string | undefined,
  }));
}

function computeMappings(projects: ProjectData[], companies: CompanyData[]): Mapping[] {
  const mappings: Mapping[] = [];
  for (const project of projects) {
    const match = companies.find(c => c.companyName === project.company);
    if (match && project.companyId !== match.id) {
      mappings.push({
        projectId: project.id,
        projectName: project.name,
        oldCompanyId: project.companyId || '<empty>',
        newCompanyId: match.id,
        companyName: match.companyName,
      });
    }
  }
  return mappings;
}

function recordAuditTrail(mappings: Mapping[], ctx: AuthContext): void {
  for (const m of mappings) {
    EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.PROJECT as 'project',
      entityId: m.projectId,
      entityName: m.projectName ?? null,
      action: 'updated',
      changes: [{
        field: 'companyId',
        oldValue: m.oldCompanyId === '<empty>' ? null : m.oldCompanyId,
        newValue: m.newCompanyId,
        label: 'Company ID',
      }],
      performedBy: ctx.uid,
      performedByName: ctx.email ?? null,
      companyId: m.newCompanyId,
    }).catch(() => {});
  }
}

async function applyMappings(db: Firestore, mappings: Mapping[], ctx: AuthContext): Promise<number> {
  if (mappings.length === 0) {
    logger.info('No projects required updates');
    return 0;
  }

  const batch = db.batch();
  for (const m of mappings) {
    batch.update(db.collection(COLLECTIONS.PROJECTS).doc(m.projectId), {
      companyId: m.newCompanyId,
      updatedAt: nowISO(),
      migrationInfo: {
        migrationId: MIGRATION_ID,
        migratedAt: nowISO(),
        oldCompanyId: m.oldCompanyId,
        newCompanyId: m.newCompanyId,
        migrationMethod: 'admin_sdk_batch',
      },
    });
  }

  await batch.commit();
  logger.info('Successfully updated projects', { count: mappings.length });
  recordAuditTrail(mappings, ctx);
  return mappings.length;
}

async function verifyIntegrity(db: Firestore, companies: CompanyData[]): Promise<IntegrityReport> {
  const snap = await db.collection(COLLECTIONS.PROJECTS).get();
  let valid = 0;
  let orphan = 0;
  for (const doc of snap.docs) {
    const companyId = doc.data().companyId as string | undefined;
    if (companies.some(c => c.id === companyId)) valid++;
    else orphan++;
  }
  const score = parseFloat(((valid / snap.size) * 100).toFixed(1));
  return { total: snap.size, valid, orphan, score };
}

// ---------------------------------------------------------------------------
// Audit + responses
// ---------------------------------------------------------------------------

async function auditRun(
  request: NextRequest,
  ctx: AuthContext,
  updateCount: number,
  integrity: IntegrityReport,
  executionTimeMs: number,
): Promise<void> {
  const metadata = extractRequestMetadata(request);
  await logMigrationExecuted(
    ctx,
    MIGRATION_ID,
    {
      migrationName: MIGRATION_NAME,
      method: 'firebase_admin_batch',
      affectedRecords: updateCount,
      executionTimeMs,
      integrityScore: integrity.score,
      totalProjects: integrity.total,
      validProjects: integrity.valid,
      orphanProjects: integrity.orphan,
      result: 'success',
      metadata,
    },
    `Admin SDK migration executed by ${ctx.globalRole} ${ctx.email}`,
  ).catch((err: unknown) => {
    logger.warn('Audit logging failed (non-blocking)', { error: err });
  });
}

function buildSuccessResponse(
  mappings: Mapping[],
  integrity: IntegrityReport,
  updateCount: number,
  executionTimeMs: number,
): NextResponse {
  return NextResponse.json({
    success: true,
    migration: { id: MIGRATION_ID, name: MIGRATION_NAME, method: 'firebase_admin_batch' },
    execution: { executionTimeMs, affectedRecords: updateCount, completedAt: nowISO() },
    results: {
      mappings: mappings.map(m => ({
        projectName: m.projectName,
        companyName: m.companyName,
        oldCompanyId: m.oldCompanyId,
        newCompanyId: m.newCompanyId,
      })),
      verification: {
        totalProjects: integrity.total,
        validProjects: integrity.valid,
        orphanProjects: integrity.orphan,
        integrityScore: integrity.score,
      },
    },
    environment: { nodeEnv: process.env.NODE_ENV, timestamp: nowISO(), system: SYSTEM_LABEL },
  });
}

function buildFailureResponse(error: unknown, executionTimeMs: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: getErrorMessage(error),
      execution: { executionTimeMs, failedAt: nowISO() },
      environment: { nodeEnv: process.env.NODE_ENV, timestamp: nowISO(), system: SYSTEM_LABEL },
    },
    { status: 500 },
  );
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runAdminSdkMigration(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  // 🔐 Admin SDK migrations are SYSTEM-LEVEL (cross-tenant) — bypass roles ONLY
  if (!isRoleBypass(ctx.globalRole)) {
    logger.warn('BLOCKED: Non-super_admin attempted Admin SDK migration', {
      email: ctx.email,
      globalRole: ctx.globalRole,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Only super_admin can execute Admin SDK migrations',
        message: 'Admin SDK migrations are system-level operations restricted to super_admin',
      },
      { status: 403 },
    );
  }

  logger.info('Admin SDK migration request', { email: ctx.email, globalRole: ctx.globalRole, companyId: ctx.companyId });

  try {
    const db = getAdminFirestore();
    const companies = await fetchActiveCompanies(db);
    const projects = await fetchProjects(db);
    const mappings = computeMappings(projects, companies);
    const updateCount = await applyMappings(db, mappings, ctx);
    const integrity = await verifyIntegrity(db, companies);
    const executionTimeMs = Date.now() - startTime;

    await auditRun(request, ctx, updateCount, integrity, executionTimeMs);
    return buildSuccessResponse(mappings, integrity, updateCount, executionTimeMs);
  } catch (error) {
    logger.error('ADMIN MIGRATION FAILED', { error: getErrorMessage(error) });
    return buildFailureResponse(error, Date.now() - startTime);
  }
}
