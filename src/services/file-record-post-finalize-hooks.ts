/**
 * =============================================================================
 * FILE RECORD POST-FINALIZE HOOKS — SSoT (ADR-373)
 * =============================================================================
 *
 * Single orchestrator για side effects που τρέχουν AFTER ένα FileRecord
 * περάσει από `finalizeFileRecord`. Όλα τα hooks είναι **fire-and-forget** —
 * αποτυχία ενός hook ΔΕΝ μπλοκάρει ούτε άλλα hooks ούτε το upload.
 *
 * Active hooks:
 *  - **DXF auto-process** (ADR-312 Phase 7.1) — extracted από `file-record.service.ts`.
 *  - **ISO 19650 enrichment** (ADR-373) — AI vision classifier για 5 ISO fields.
 *
 * Pattern guarantees:
 *  - Each hook wrapped in `.catch()` — never throws.
 *  - Outer wrapper `.catch()` in caller (`file-record.service.finalizeFileRecord`)
 *    provides triple-safety against orchestrator-level failures.
 *  - Idempotent: re-running on the same fileId overwrites previous enrichment.
 *
 * @module services/file-record-post-finalize-hooks
 * @see ADR-373 §D5 — AI Auto-Fill Architecture
 * @see ADR-312 — DXF Floorplan Processing (Phase 7.1)
 */

import 'server-only';

import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_CATEGORIES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { Iso19650EnrichmentResult } from '@/services/ai-pipeline/tools/handlers/iso19650-enricher';

const logger = createModuleLogger('FILE_RECORD_HOOKS');

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/**
 * Minimal FileRecord snapshot passed από `finalizeFileRecord` στα hooks.
 * Δεν χρειάζεται όλα τα fields — μόνο όσα οδηγούν decisions στα hooks.
 */
export interface PostFinalizeContext {
  ext?: string;
  category?: string;
  sizeBytes?: number;
  downloadUrl?: string;
  originalFilename?: string;
  contentType?: string;
  purpose?: string;
}

// ============================================================================
// HOOK A — DXF AUTO-PROCESS (extracted from file-record.service.ts)
// ============================================================================
// Triggers `processFloorplanWithPolicy` για DXF floorplans μετά το finalize.
// Πρωτοχρησιμοποιείται από ADR-312 Phase 7.1 (entity-type agnostic — covers
// property/floor/building/parking/storage DXFs μέσω του single finalize SSoT).
// ============================================================================

function triggerDxfAutoProcess(fileId: string, ctx: PostFinalizeContext): void {
  if (ctx.ext?.toLowerCase() !== 'dxf') return;
  if (ctx.category !== FILE_CATEGORIES.FLOORPLANS) return;

  import('@/services/floorplans/floorplan-processing-mutation-gateway')
    .then(({ processFloorplanWithPolicy }) =>
      processFloorplanWithPolicy({ fileId, forceReprocess: false }),
    )
    .catch((err) =>
      logger.warn('DXF auto-process skipped', {
        fileId,
        error: getErrorMessage(err),
      }),
    );
}

// ============================================================================
// HOOK B — ISO 19650 METADATA ENRICHMENT (ADR-373)
// ============================================================================

function triggerIso19650Enrichment(fileId: string, ctx: PostFinalizeContext): void {
  if (!ctx.downloadUrl || !ctx.originalFilename || !ctx.contentType) return;

  const downloadUrl = ctx.downloadUrl;
  const filename = ctx.originalFilename;
  const contentType = ctx.contentType;
  const sizeBytes = ctx.sizeBytes ?? 0;
  const purpose = ctx.purpose;

  import('@/services/ai-pipeline/tools/handlers/iso19650-enricher')
    .then(({ enrichFileWithIso19650Metadata }) =>
      enrichFileWithIso19650Metadata({
        downloadUrl,
        filename,
        contentType,
        sizeBytes,
        purpose,
      }),
    )
    .then((enrichment) => applyIso19650Enrichment(fileId, enrichment))
    .catch((err) =>
      logger.warn('ISO19650 enrichment skipped', {
        fileId,
        error: getErrorMessage(err),
      }),
    );
}

/**
 * Persist enrichment payload to the FileRecord (Firestore).
 * `?? null` for every optional field per ADR-191 Firestore convention.
 */
async function applyIso19650Enrichment(
  fileId: string,
  enrichment: Iso19650EnrichmentResult,
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.FILES, fileId);
  const updateData: Record<string, unknown> = {
    disciplineCode: enrichment.disciplineCode ?? null,
    documentSeries: enrichment.documentSeries ?? null,
    revisionCode: enrichment.revisionCode ?? null,
    cdeState: enrichment.cdeState ?? null,
    buildingCode: enrichment.buildingCode ?? null,
    iso19650Source: enrichment.source,
    updatedAt: serverTimestamp(),
  };
  await updateDoc(docRef, updateData);
  logger.info('ISO19650 enrichment applied', {
    fileId,
    filledBy: enrichment.source.filledBy,
    discipline: enrichment.disciplineCode ?? 'none',
    series: enrichment.documentSeries ?? 'none',
  });
}

// ============================================================================
// PUBLIC ENTRY POINT — invoked από finalizeFileRecord
// ============================================================================

/**
 * Trigger all post-finalize side effects. Fire-and-forget for every hook.
 * Returns immediately (synchronous void) — promises run in the background.
 * Caller wraps with .catch() as triple-safety belt-and-suspenders.
 */
export function triggerPostFinalizeHooks(fileId: string, ctx: PostFinalizeContext): void {
  triggerDxfAutoProcess(fileId, ctx);
  triggerIso19650Enrichment(fileId, ctx);
}
