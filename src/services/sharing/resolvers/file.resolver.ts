/**
 * =============================================================================
 * FILE SHARE RESOLVER (ADR-315, primitives per ADR-699)
 * =============================================================================
 *
 * Resolves `entityType: 'file'` shares. Everything shared with the other
 * resolvers — public projection, base input validation — comes from
 * `sharing/resolver-core`; the entity read and tenant ownership live on the
 * server (`server/sharing/share-entity-access.ts`, ADR-884 Φ0.12). What stays here is the only
 * genuinely file-specific rule: the resolved shape prefers the share's own
 * `fileMeta` over the document, and falls back to the id when the file has no
 * name (a missing file must still render a download page).
 *
 * @module services/sharing/resolvers/file.resolver
 * @see adrs/ADR-315-unified-sharing.md §3.3
 * @see adrs/ADR-699-share-resolver-declarations.md
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  buildSafePublicProjection,
  pickFirstStringField,
  validateShareBaseInput,
} from '@/services/sharing/resolver-core/share-resolver-primitives';
import type { ShareEntityDefinition, ShareProjectionInput } from '@/types/sharing';

export interface FileShareResolvedData {
  shareId: string;
  token: string;
  fileId: string;
  displayName: string;
  originalFilename: string;
  contentType: string | null;
  sizeBytes: number | null;
  ext: string | null;
  note: string | null;
  /**
   * Short-lived signed URL for the inline preview — filled **by the server** after
   * the access is recorded (`server/sharing/share-resolve.ts`); the pure projection
   * leaves it `null`. Never the file's permanent `downloadUrl`.
   */
  previewUrl: string | null;
}

/**
 * ⚠️ Διαβάζει τα **κανονικά** πεδία του `FileRecord` (`displayName` · `originalFilename` ·
 * `contentType` · `sizeBytes` · `ext`, `types/file-record.ts`). Μέχρι το ADR-884 Φ0.12 εδώ
 * διαβάζονταν `name` / `mimeType` — πεδία που το `FileRecord` **δεν έχει** — οπότε κάθε
 * αρχείο εμφανιζόταν με το id του αντί για το όνομά του.
 */
function projectFile({ share, entity: data, token }: ShareProjectionInput): FileShareResolvedData {
  const sizeFromDoc = typeof data?.sizeBytes === 'number' ? data.sizeBytes : null;
  return {
    shareId: share.id,
    token,
    fileId: share.entityId,
    displayName: pickFirstStringField(data, ['displayName', 'originalFilename']) ?? share.entityId,
    originalFilename: pickFirstStringField(data, ['originalFilename']) ?? share.entityId,
    contentType: share.fileMeta?.mimeType ?? pickFirstStringField(data, ['contentType']),
    sizeBytes: share.fileMeta?.sizeBytes ?? sizeFromDoc,
    ext: pickFirstStringField(data, ['ext']),
    note: share.note ?? null,
    previewUrl: null,
  };
}

export const fileShareResolver: ShareEntityDefinition<FileShareResolvedData> = {
  entityCollection: COLLECTIONS.FILES,
  project: projectFile,
  safePublicProjection: share => buildSafePublicProjection(share, 'fileMeta'),
  validateCreateInput: input =>
    validateShareBaseInput(input, { entityType: 'file', entityIdLabel: 'fileId' }),
  renderPublic: () => null, // Wired in Step D (public route dispatcher)
};
