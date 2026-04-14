import 'server-only';

/**
 * =============================================================================
 * IkaLaborComplianceSaveImpact — Impact preview for global config save
 * =============================================================================
 *
 * Queries `employment_records` company-wide to assess impact before saving
 * ΕΦΚΑ insurance class / contribution rate configuration.
 *
 * Any change to this global document re-prices ALL existing employment records
 * for all projects in the company — the accountant must confirm.
 *
 * Rule engine:
 *   total == 0     → allow  (nothing to re-price yet)
 *   total > 0      → warn   (confirm global impact)
 *
 * @module lib/firestore/ika-labor-compliance-save-impact.service
 * @enterprise ADR-307 — IKA Mutation Impact Guards
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type {
  ProjectMutationDependency,
  ProjectMutationImpactPreview,
} from '@/types/project-mutation-impact';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('IkaLaborComplianceSaveImpact');

// =============================================================================
// QUERIES
// =============================================================================

interface EmploymentRecordCounts {
  total: number;
  submitted: number;
}

async function countEmploymentRecords(
  companyId: string,
): Promise<EmploymentRecordCounts> {
  const db = getAdminFirestore();

  const [totalSnap, submittedSnap] = await Promise.all([
    db
      .collection(COLLECTIONS.EMPLOYMENT_RECORDS)
      .where('companyId', '==', companyId)
      .select()
      .get(),
    db
      .collection(COLLECTIONS.EMPLOYMENT_RECORDS)
      .where('companyId', '==', companyId)
      .where('apdStatus', 'in', ['submitted', 'accepted'])
      .select()
      .get(),
  ]);

  return { total: totalSnap.size, submitted: submittedSnap.size };
}

// =============================================================================
// RULE ENGINE
// =============================================================================

function buildDependencies(counts: EmploymentRecordCounts): {
  deps: ProjectMutationDependency[];
  messageKey: string | null;
} {
  if (counts.total === 0) {
    return { deps: [], messageKey: null };
  }

  const deps: ProjectMutationDependency[] = [
    { id: 'employmentRecordsGlobal', count: counts.total, mode: 'warn' },
  ];

  const messageKey = 'impactGuard.ikaSettingsSave.withActiveRecords';
  return { deps, messageKey };
}

// =============================================================================
// HELPERS
// =============================================================================

function buildAllowPreview(): ProjectMutationImpactPreview {
  return {
    mode: 'allow',
    mutationKinds: [],
    changes: [],
    dependencies: [],
    companyLinkChange: 'none',
    messageKey: 'impactGuard.messages.allow',
    blockingCount: 0,
    warningCount: 0,
  };
}

function buildUnavailablePreview(): ProjectMutationImpactPreview {
  return {
    mode: 'block',
    mutationKinds: [],
    changes: [],
    dependencies: [],
    companyLinkChange: 'none',
    messageKey: 'impactGuard.messages.unavailable',
    blockingCount: 0,
    warningCount: 0,
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================

export async function previewLaborComplianceSaveImpact(
  companyId: string,
): Promise<ProjectMutationImpactPreview> {
  try {
    const counts = await countEmploymentRecords(companyId);
    const { deps, messageKey } = buildDependencies(counts);

    if (deps.length === 0) return buildAllowPreview();

    const warningCount = deps.filter((d) => d.mode === 'warn').length;
    const blockingCount = deps.filter((d) => d.mode === 'block').length;

    return {
      mode: 'warn',
      mutationKinds: [],
      changes: [],
      dependencies: deps,
      companyLinkChange: 'none',
      messageKey: messageKey ?? 'impactGuard.messages.warn',
      blockingCount,
      warningCount,
    };
  } catch (error) {
    logger.warn('Labor compliance save impact preview failed', { error });
    return buildUnavailablePreview();
  }
}
