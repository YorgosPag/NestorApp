/**
 * =============================================================================
 * STORAGE SHOWCASE SHARE RESOLVER (ADR-315)
 * =============================================================================
 *
 * Delegates 95% of logic to `createShowcaseShareResolver` factory (ADR-321).
 * Overrides `validateCreateInput` to make pdfStoragePath optional — storage
 * showcase does not have a PDF generation service yet.
 *
 * @module services/sharing/resolvers/storage-showcase.resolver
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { createShowcaseShareResolver } from '@/services/showcase-core/share-resolver-factory';
import type {
  CreateShareInput,
  ShareEntityDefinition,
  ValidationResult,
} from '@/types/sharing';

export interface StorageShowcaseResolvedData {
  shareId: string;
  token: string;
  storageId: string;
  storageTitle: string | null;
  pdfStoragePath: string | null;
  pdfRegeneratedAt: string | null;
  note: string | null;
}

function validateCreateInput(input: CreateShareInput): ValidationResult {
  if (input.entityType !== 'storage_showcase') {
    return { valid: false, reason: 'Wrong resolver — expected entityType=storage_showcase' };
  }
  if (!input.entityId?.trim()) return { valid: false, reason: 'storageId required' };
  if (!input.companyId?.trim()) return { valid: false, reason: 'companyId required' };
  if (!input.createdBy?.trim()) return { valid: false, reason: 'createdBy required' };
  return { valid: true };
}

export const storageShowcaseShareResolver: ShareEntityDefinition<StorageShowcaseResolvedData> = {
  ...createShowcaseShareResolver<StorageShowcaseResolvedData>({
    entityType: 'storage_showcase',
    collection: COLLECTIONS.STORAGE,
    entityIdLabel: 'storageId',
    loggerName: 'StorageShowcaseShareResolver',
    buildResolvedData: ({ share, data, pdfStoragePath, pdfRegeneratedAt }) => ({
      shareId: share.id,
      token: share.token,
      storageId: share.entityId,
      storageTitle:
        (data?.name as string | undefined) ??
        (data?.code as string | undefined) ??
        null,
      pdfStoragePath,
      pdfRegeneratedAt,
      note: share.note ?? null,
    }),
  }),
  validateCreateInput,
};
