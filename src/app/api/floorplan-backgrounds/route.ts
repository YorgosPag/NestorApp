/**
 * Floorplan Backgrounds API — POST upload + GET by floor (ADR-340 Phase 7)
 *
 * POST  /api/floorplan-backgrounds      — multipart upload
 * GET   /api/floorplan-backgrounds?floorId=X[&include=polygonState]
 *
 * @module api/floorplan-backgrounds/route
 * @enterprise ADR-340 Phase 7 — D5 (RBAC), D7 (multipart upload)
 */

import { withAuth } from '@/lib/auth';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { handlePost, handleGet } from './floorplan-backgrounds.handlers';

export const maxDuration = 60;

const WRITE_ROLES = ['super_admin', 'company_admin', 'internal_user'] as const;

export const POST = withHeavyRateLimit(
  withAuth(handlePost, { requiredGlobalRoles: [...WRITE_ROLES] }),
);

export const GET = withHeavyRateLimit(withAuth(handleGet));
