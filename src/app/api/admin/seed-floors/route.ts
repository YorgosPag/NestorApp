/**
 * =============================================================================
 * SEED FLOORS — ROUTE (AUTHZ Phase 2)
 * =============================================================================
 *
 * API για seeding floors με enterprise IDs (manual seeding).
 *
 * @module api/admin/seed-floors
 * @enterprise RFC v6 - Authorization & RBAC System
 * @created 2026-01-31
 * @updated 2026-04-05 — ADR-286: split into handlers + config; creation via createEntity
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: admin:migrations:execute (super_admin ONLY)
 * - Manual Seeding: Mass deletion + mass creation
 * - Multi-Layer Security: withAuth + explicit super_admin check
 * - Comprehensive audit logging
 *
 * @method GET    - Προεπισκόπηση (dry run)
 * @method POST   - Εκτέλεση seeding (delete + create via createEntity)
 * @method DELETE - Διαγραφή όλων των floors
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import {
  handleSeedFloorsDelete,
  handleSeedFloorsExecute,
  handleSeedFloorsPreview,
} from './seed-floors.handlers';

export const GET = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
    handleSeedFloorsPreview(req, ctx),
  { permissions: 'admin:migrations:execute' }
);

export const POST = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
    handleSeedFloorsExecute(req, ctx),
  { permissions: 'admin:migrations:execute' }
);

export const DELETE = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> =>
    handleSeedFloorsDelete(req, ctx),
  { permissions: 'admin:migrations:execute' }
);
