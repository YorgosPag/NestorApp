/**
 * =============================================================================
 * 🏢 ENTITY FILE DISPLAY NAME PROPAGATOR (Server-Only)
 * =============================================================================
 *
 * Cascade updater for FileRecord.displayName when the parent entity is renamed.
 *
 * Strategy: string-replacement on the persisted displayName using the stored
 * entityLabel as anchor. Avoids server-side i18n (not available in API routes
 * — see file-display-name.ts isServerContext()), and preserves the original
 * label format (category/purpose labels, descriptors, date, revision) exactly
 * as captured at upload time.
 *
 * Pattern:
 *   oldDisplayName: "Θέα - Studio 35 m²"
 *   oldEntityLabel: "Studio 35 m²"
 *   newEntityLabel: "Appartamento deluxe"
 *   newDisplayName: "Θέα - Appartamento deluxe"
 *
 * @module services/filesystem/entity-file-display-propagator
 * @enterprise ADR-293 Phase 8 — Entity Display Name Cascade
 * @enterprise ADR-195 — Entity Audit Trail (bulk summary entry)
 */

import 'server-only';

import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_STATUS, FILE_LIFECYCLE_STATES } from '@/config/domain-constants';
import { EntityAuditService } from '@/services/entity-audit.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { AuditEntityType } from '@/types/audit-trail';

const logger = createModuleLogger('EntityFileDisplayPropagator');

const FIRESTORE_BATCH_LIMIT = 500;

export interface PropagateEntityRenameParams {
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly newEntityLabel: string;
  readonly companyId: string;
  readonly performedBy: string;
  readonly performedByName: string | null;
}

export interface PropagatedFileUpdate {
  readonly fileId: string;
  readonly newDisplayName: string;
}

export interface PropagateEntityRenameResult {
  readonly updatedCount: number;
  readonly skippedCount: number;
  readonly oldEntityLabel: string | null;
  readonly updatedFiles: readonly PropagatedFileUpdate[];
}

interface FileCandidate {
  readonly id: string;
  readonly displayName: string;
  readonly entityLabel: string;
}

function collectCandidates(
  docs: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[],
  newEntityLabel: string,
): { candidates: FileCandidate[]; skipped: number; dominantOldLabel: string | null } {
  const candidates: FileCandidate[] = [];
  const labelCounts = new Map<string, number>();
  let skipped = 0;

  for (const snap of docs) {
    const data = snap.data();
    const displayName = typeof data.displayName === 'string' ? data.displayName : '';
    const entityLabel = typeof data.entityLabel === 'string' ? data.entityLabel : '';

    if (!entityLabel || entityLabel === newEntityLabel) {
      skipped++;
      continue;
    }

    if (!displayName.includes(entityLabel)) {
      logger.warn('entityLabel not found in displayName — skipping cascade for file', {
        fileId: snap.id,
        entityLabel,
        displayName,
      });
      skipped++;
      continue;
    }

    candidates.push({ id: snap.id, displayName, entityLabel });
    labelCounts.set(entityLabel, (labelCounts.get(entityLabel) ?? 0) + 1);
  }

  let dominantOldLabel: string | null = null;
  let maxCount = 0;
  for (const [label, count] of labelCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      dominantOldLabel = label;
    }
  }

  return { candidates, skipped, dominantOldLabel };
}

async function commitCandidatesInChunks(
  candidates: readonly FileCandidate[],
  newEntityLabel: string,
): Promise<PropagatedFileUpdate[]> {
  const db = getAdminFirestore();
  const filesRef = db.collection(COLLECTIONS.FILES);
  const updates: PropagatedFileUpdate[] = [];

  for (let i = 0; i < candidates.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = candidates.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = db.batch();

    for (const candidate of chunk) {
      const newDisplayName = candidate.displayName.split(candidate.entityLabel).join(newEntityLabel);
      batch.update(filesRef.doc(candidate.id), {
        displayName: newDisplayName,
        entityLabel: newEntityLabel,
        updatedAt: FieldValue.serverTimestamp(),
      });
      updates.push({ fileId: candidate.id, newDisplayName });
    }

    await batch.commit();
    logger.info('Propagator batch committed', {
      batchIndex: Math.floor(i / FIRESTORE_BATCH_LIMIT),
      batchSize: chunk.length,
    });
  }

  return updates;
}

export class EntityFileDisplayPropagator {
  /**
   * Cascade-update FileRecord.displayName for all files attached to an entity
   * whose display label has been renamed. Also updates FileRecord.entityLabel
   * so subsequent renames can chain correctly.
   *
   * Fire-and-forget audit summary via EntityAuditService (ADR-195). Query and
   * write failures are logged and re-thrown so the caller (API route) can
   * surface them to the client.
   */
  static async propagate(
    params: PropagateEntityRenameParams,
  ): Promise<PropagateEntityRenameResult> {
    const { entityType, entityId, newEntityLabel, companyId, performedBy, performedByName } = params;

    if (!newEntityLabel.trim()) {
      throw new Error('newEntityLabel cannot be empty');
    }

    const db = getAdminFirestore();
    const trimmedLabel = newEntityLabel.trim();

    const snapshot = await db
      .collection(COLLECTIONS.FILES)
      .where('companyId', '==', companyId)
      .where('entityType', '==', entityType)
      .where('entityId', '==', entityId)
      .where('status', '==', FILE_STATUS.READY)
      .where('lifecycleState', '==', FILE_LIFECYCLE_STATES.ACTIVE)
      .where('isDeleted', '==', false)
      .get();

    if (snapshot.empty) {
      logger.info('No FileRecord to propagate', { entityType, entityId });
      return { updatedCount: 0, skippedCount: 0, oldEntityLabel: null, updatedFiles: [] };
    }

    const { candidates, skipped, dominantOldLabel } = collectCandidates(
      snapshot.docs,
      trimmedLabel,
    );

    if (candidates.length === 0) {
      logger.info('All FileRecord skipped during propagation', {
        entityType,
        entityId,
        skippedCount: skipped,
      });
      return { updatedCount: 0, skippedCount: skipped, oldEntityLabel: dominantOldLabel, updatedFiles: [] };
    }

    let updatedFiles: PropagatedFileUpdate[];
    try {
      updatedFiles = await commitCandidatesInChunks(candidates, trimmedLabel);
    } catch (err) {
      logger.error('Propagator batch commit failed', {
        entityType,
        entityId,
        error: getErrorMessage(err),
      });
      throw err;
    }

    void EntityAuditService.recordChange({
      entityType,
      entityId,
      entityName: trimmedLabel,
      action: 'updated',
      changes: [
        {
          field: 'files_cascade_rename',
          label: `${candidates.length} file(s) renamed`,
          oldValue: dominantOldLabel ?? null,
          newValue: trimmedLabel,
        },
      ],
      performedBy,
      performedByName,
      companyId,
    });

    logger.info('Propagation completed', {
      entityType,
      entityId,
      updatedCount: candidates.length,
      skippedCount: skipped,
    });

    return {
      updatedCount: candidates.length,
      skippedCount: skipped,
      oldEntityLabel: dominantOldLabel,
      updatedFiles,
    };
  }
}
