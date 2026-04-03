import type { EntityType, FileCategory } from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';
import { updatePropertyCoverageWithPolicy } from '@/services/property/property-mutation-gateway';

interface SyncPropertyCoverageInput {
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly category: FileCategory;
  readonly remainingFiles: readonly FileRecord[];
}

function buildCoveragePatch(
  category: FileCategory,
  remainingCount: number,
): Partial<{
  hasPhotos: boolean;
  hasFloorplans: boolean;
  hasDocuments: boolean;
}> | null {
  const nextValue = remainingCount > 0;

  switch (category) {
    case 'photos':
      return { hasPhotos: nextValue };
    case 'floorplans':
      return { hasFloorplans: nextValue };
    case 'documents':
      return { hasDocuments: nextValue };
    default:
      return null;
  }
}

export async function syncPropertyCoverageForRemainingFiles({
  entityType,
  entityId,
  category,
  remainingFiles,
}: SyncPropertyCoverageInput): Promise<void> {
  if (entityType !== 'property') {
    return;
  }

  const coveragePatch = buildCoveragePatch(category, remainingFiles.length);
  if (!coveragePatch) {
    return;
  }

  await updatePropertyCoverageWithPolicy({
    propertyId: entityId,
    coverage: coveragePatch,
  });
}
