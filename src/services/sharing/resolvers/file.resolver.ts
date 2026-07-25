/**
 * =============================================================================
 * FILE SHARE RESOLVER (ADR-315, primitives per ADR-699)
 * =============================================================================
 *
 * Resolves `entityType: 'file'` shares. Everything shared with the other
 * resolvers — public projection, base input validation, tenant ownership, the
 * entity read — comes from `sharing/resolver-core`. What stays here is the only
 * genuinely file-specific rule: the resolved shape prefers the share's own
 * `fileMeta` over the document, and falls back to the id when the file has no
 * name (a missing file must still render a download page).
 *
 * @module services/sharing/resolvers/file.resolver
 * @see adrs/ADR-315-unified-sharing.md §3.3
 * @see adrs/ADR-699-share-resolver-declarations.md
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import {
  createTenantOwnershipGuard,
  loadSharedEntityDoc,
} from '@/services/sharing/resolver-core/share-entity-access';
import {
  buildSafePublicProjection,
  validateShareBaseInput,
} from '@/services/sharing/resolver-core/share-resolver-primitives';
import type { ShareEntityDefinition, ShareRecord } from '@/types/sharing';

const logger = createModuleLogger('FileShareResolver');

export interface FileShareResolvedData {
  shareId: string;
  token: string;
  fileId: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  note: string | null;
}

async function resolveFile(share: ShareRecord): Promise<FileShareResolvedData> {
  const data = await loadSharedEntityDoc({
    collection: COLLECTIONS.FILES,
    share,
    logger,
    missingMessage: 'File share points to missing file',
  });

  return {
    shareId: share.id,
    token: share.token,
    fileId: share.entityId,
    fileName: (data?.name as string | undefined) ?? share.entityId,
    mimeType: share.fileMeta?.mimeType ?? (data?.mimeType as string | undefined) ?? null,
    sizeBytes: share.fileMeta?.sizeBytes ?? (data?.sizeBytes as number | undefined) ?? null,
    note: share.note ?? null,
  };
}

export const fileShareResolver: ShareEntityDefinition<FileShareResolvedData> = {
  resolve: resolveFile,
  safePublicProjection: share => buildSafePublicProjection(share, 'fileMeta'),
  validateCreateInput: input =>
    validateShareBaseInput(input, { entityType: 'file', entityIdLabel: 'fileId' }),
  canShare: createTenantOwnershipGuard(COLLECTIONS.FILES),
  renderPublic: () => null, // Wired in Step D (public route dispatcher)
};
