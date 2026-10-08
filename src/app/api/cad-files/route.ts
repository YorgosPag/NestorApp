/**
 * 📐 CAD FILES API — ENTERPRISE ROUTE (ADR-288)
 *
 * Centralized upsert/read for cadFiles metadata (DXF scene metadata).
 * Replaces direct client-side setDoc writes in `dxf-firestore-storage.impl.ts`
 * with the same server-side SSOT pattern established by ADR-286 (dxf-levels).
 *
 * @module api/cad-files
 * @see ADR-288 — CAD File Metadata Centralization
 * @see ADR-031 — File Storage Consolidation (cadFiles → files)
 * @see ADR-285 — DXF Tenant Scoping
 *
 * 🔒 SECURITY:
 * - Permission: dxf:files:view (read) · dxf:files:upload (write)
 * - Admin SDK for secure server-side writes
 * - Tenant isolation enforced on every operation
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import type { ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import type {
  CadFileGetResponse,
  CadFileUpsertResponse,
} from './cad-files.types';
import {
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

// ⛔ ΚΑΜΙΑ `DELETE` εδώ — επίτηδες (ADR-845 §7.17 Α6, κλάση Ο-35). Η παλιά έσβηνε εγγραφή της
// `files` με το χέρι (`lifecycleState: 'deleted'`, τιμή εκτός λεξιλογίου), χωρίς κρίση δημοσίευσης,
// χωρίς ίχνος αρχείου και χωρίς επαναπροβολή της αγγελίας — και δεν την καλούσε κανείς.
// Το σχέδιο πάει στον κάδο από τη ΜΙΑ πόρτα: `POST /api/files/trash`.
