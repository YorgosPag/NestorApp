/**
 * =============================================================================
 * SEED PARKING SPOTS - PROTECTED (AUTHZ Phase 2)
 * =============================================================================
 *
 * GET preview · POST execute · DELETE mass-delete · PATCH FK-validate.
 * Handlers live in `seed-parking.handlers.ts` (ADR-704 split); each keeps its
 * own bypass-role guard + audit.
 *
 * @module api/admin/seed-parking
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { BYPASS_ROLES } from '@/lib/auth/roles';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  handleSeedParkingPreview,
  handleSeedParkingExecute,
  handleSeedParkingDelete,
  handleForeignKeyValidation,
} from './seed-parking.handlers';

const ADMIN_PERMISSION = 'admin:migrations:execute';

export const GET = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
    handleSeedParkingPreview(req, ctx),
  { requiredGlobalRoles: BYPASS_ROLES, permissions: ADMIN_PERMISSION }
));

export const POST = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
    handleSeedParkingExecute(req, ctx),
  { requiredGlobalRoles: BYPASS_ROLES, permissions: ADMIN_PERMISSION }
));

export const DELETE = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
    handleSeedParkingDelete(req, ctx),
  { requiredGlobalRoles: BYPASS_ROLES, permissions: ADMIN_PERMISSION }
));

export const PATCH = withSensitiveRateLimit(withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
    handleForeignKeyValidation(req, ctx),
  { requiredGlobalRoles: BYPASS_ROLES, permissions: ADMIN_PERMISSION }
));
