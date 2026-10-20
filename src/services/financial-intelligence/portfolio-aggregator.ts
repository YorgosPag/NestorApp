/**
 * =============================================================================
 * Portfolio Aggregation Service — SPEC-242C
 * =============================================================================
 *
 * Server-only service that aggregates financial data across all projects.
 * Uses Admin SDK for Firestore access. Designed for API route consumption.
 *
 * This module only READS (projects, then each project's live units). Every number
 * is computed by the pure rollup in `portfolio-rollup.ts`.
 *
 * @module services/financial-intelligence/portfolio-aggregator
 * @enterprise SPEC-242C — Portfolio Dashboard & Debt Maturity Wall
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { isRetired } from '@/lib/firestore/trashed-status';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  PortfolioSummary,
  ProjectFinancialSummary,
} from '@/types/interest-calculator';
import { nowISO } from '@/lib/date-local';
import { readProjectDisplayName } from './project-reference';
import {
  readUnitFinancials,
  rollUpPortfolio,
  rollUpProject,
  type ProjectRollup,
  type UnitFinancials,
} from './portfolio-rollup';

const logger = createModuleLogger('PortfolioAggregator');

type AdminDb = ReturnType<typeof getAdminFirestore>;

interface PortfolioAggregationResult {
  portfolio: PortfolioSummary;
  projects: ProjectFinancialSummary[];
}

/** A project's live units — S-1: tenant-scoped; ADR-281: retired units excluded. */
async function readLiveUnits(db: AdminDb, projectId: string, companyId: string): Promise<UnitFinancials[]> {
  const propertiesSnap = await db
    .collection(COLLECTIONS.PROPERTIES)
    .where('project', '==', projectId)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .get();

  return propertiesSnap.docs
    .map((doc) => doc.data())
    .filter((data) => !isRetired(data))
    .map(readUnitFinancials);
}

/**
 * Aggregate financial data across all projects for a company.
 * Uses denormalized paymentSummary on unit docs when available.
 * A project whose units cannot be read is logged and left out, not zero-filled.
 */
export async function aggregatePortfolio(companyId: string): Promise<PortfolioAggregationResult> {
  const db = getAdminFirestore();
  const startTime = Date.now();

  const projectsSnap = await db
    .collection(COLLECTIONS.PROJECTS)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .get();

  logger.info(`[Portfolio] Found ${projectsSnap.size} projects for company ${companyId}`);

  const rollups: ProjectRollup[] = [];
  for (const projectDoc of projectsSnap.docs) {
    try {
      const units = await readLiveUnits(db, projectDoc.id, companyId);
      rollups.push(rollUpProject(projectDoc.id, readProjectDisplayName(projectDoc.data()), units));
    } catch (err) {
      logger.warn(`[Portfolio] Failed to aggregate project ${projectDoc.id}, skipping`, {
        error: getErrorMessage(err),
      });
    }
  }

  const portfolio = rollUpPortfolio(rollups, projectsSnap.size, nowISO());

  logger.info(`[Portfolio] Aggregation complete in ${Date.now() - startTime}ms`, {
    projects: projectsSnap.size,
    totalProperties: portfolio.totalProperties,
  });

  return { portfolio, projects: rollups.map((rollup) => rollup.summary) };
}
