/**
 * =============================================================================
 * SEARCH INDEX BACKFILL API - PROTECTED (super_admin ONLY)
 * =============================================================================
 *
 * Admin endpoint for backfilling search index documents into searchDocuments
 * for Global Search. Handlers live in `search-backfill.handlers.ts` (ADR-704).
 *
 * @module api/admin/search-backfill
 * @enterprise ADR-029 - Global Search v1
 *
 * USAGE:
 *   POST  /api/admin/search-backfill  - Execute backfill
 *   GET   /api/admin/search-backfill  - Get system status
 *   PATCH /api/admin/search-backfill  - Migrate contact tenantIds
 */

import { withAuth } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  runSearchBackfill,
  getBackfillStatus,
  migrateContactTenants,
  type BackfillApiResponse,
  type BackfillStatusApiResponse,
  type MigrationApiResponse,
} from './search-backfill.handlers';

export const POST = withSensitiveRateLimit(withAuth<BackfillApiResponse>(
  runSearchBackfill,
  { permissions: 'admin:migrations:execute' }
));

export const GET = withAuth<BackfillStatusApiResponse>(
  getBackfillStatus,
  { permissions: 'admin:migrations:execute' }
);

export const PATCH = withAuth<MigrationApiResponse>(
  migrateContactTenants,
  { permissions: 'admin:migrations:execute' }
);
