/**
 * =============================================================================
 * PARKING SHOWCASE SHARE RESOLVER (ADR-315)
 * =============================================================================
 *
 * Delegates 95% of logic to `createShowcaseShareResolver` factory (ADR-321).
 * Overrides `validateCreateInput` to make pdfStoragePath optional — parking
 * showcase does not have a PDF generation service yet.
 *
 * @module services/sharing/resolvers/parking-showcase.resolver
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { createShowcaseShareResolver } from '@/services/showcase-core/share-resolver-factory';
import type {
  CreateShareInput,
  ShareEntityDefinition,
  ValidationResult,
} from '@/types/sharing';

export interface ParkingShowcaseResolvedData {
  shareId: string;
  token: string;
  parkingId: string;
  parkingTitle: string | null;
  pdfStoragePath: string | null;
  pdfRegeneratedAt: string | null;
  note: string | null;
}

function validateCreateInput(input: CreateShareInput): ValidationResult {
  if (input.entityType !== 'parking_showcase') {
    return { valid: false, reason: 'Wrong resolver — expected entityType=parking_showcase' };
  }
  if (!input.entityId?.trim()) return { valid: false, reason: 'parkingId required' };
  if (!input.companyId?.trim()) return { valid: false, reason: 'companyId required' };
  if (!input.createdBy?.trim()) return { valid: false, reason: 'createdBy required' };
  return { valid: true };
}

export const parkingShowcaseShareResolver: ShareEntityDefinition<ParkingShowcaseResolvedData> = {
  ...createShowcaseShareResolver<ParkingShowcaseResolvedData>({
    entityType: 'parking_showcase',
    collection: COLLECTIONS.PARKING_SPACES,
    entityIdLabel: 'parkingId',
    loggerName: 'ParkingShowcaseShareResolver',
    buildResolvedData: ({ share, data, pdfStoragePath, pdfRegeneratedAt }) => ({
      shareId: share.id,
      token: share.token,
      parkingId: share.entityId,
      parkingTitle:
        (data?.number as string | undefined) ??
        (data?.code as string | undefined) ??
        null,
      pdfStoragePath,
      pdfRegeneratedAt,
      note: share.note ?? null,
    }),
  }),
  validateCreateInput,
};
