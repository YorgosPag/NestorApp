/**
 * 📐 CAD FILES API — ENTERPRISE ROUTE (ADR-288)
 *
 * Centralized upsert/read/delete for cadFiles metadata (DXF scene metadata).
 * Replaces direct client-side setDoc writes in `dxf-firestore-storage.impl.ts`
 * with the same server-side SSOT pattern established by ADR-286 (dxf-levels).
 *
 * @module api/cad-files
 * @see ADR-288 — CAD File Metadata Centralization
 * @see ADR-031 — File Storage Consolidation (cadFiles → files)
 * @see ADR-285 — DXF Tenant Scoping
 *
 * 🔒 SECURITY:
 * - Permission: dxf:files:view (read) · dxf:files:upload (write/delete)
 * - Admin SDK for secure server-side writes
 * - Tenant isolation enforced on every operation
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import type { ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import type {
  CadFileDeleteResponse,
  CadFileGetResponse,
  CadFileUpsertResponse,
} from './cad-files.types';
import {
  handleDeleteCadFile,
  handleGetCadFile,
  handleUpsertCadFile,
} from './cad-files.handlers';

export const GET = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<CadFileGetResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
        handleGetCadFile(request, ctx),
      { permissions: 'dxf:files:view' }
    );
    return handler(request);
  }
);

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<CadFileUpsertResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handleUpsertCadFile(request, ctx),
    { permissions: 'dxf:files:upload' }
  )
);

export const DELETE = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<CadFileDeleteResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
        handleDeleteCadFile(request, ctx),
      { permissions: 'dxf:files:upload' }
    );
    return handler(request);
  }
);
