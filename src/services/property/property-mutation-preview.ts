import type { LinkedSpace } from '@/types/property';
import type { Property } from '@/types/property-viewer';

export interface PropertyMutationPreview {
  readonly title: string;
  readonly description: string;
  readonly variant?: 'default' | 'warning' | 'destructive';
  readonly confirmText?: string;
}

interface PropertyMutationPreviewTranslator {
  (key: string, options?: { defaultValue?: string }): string;
}

export function buildPropertyFormPreview(
  property: Property,
  updates: Partial<Property>,
  t: PropertyMutationPreviewTranslator,
): PropertyMutationPreview | null {
  const identityChanged =
    ('name' in updates && updates.name !== property.name) ||
    ('code' in updates && updates.code !== property.code) ||
    ('type' in updates && updates.type !== property.type);

  const commercialChanged =
    ('commercialStatus' in updates && updates.commercialStatus !== property.commercialStatus);

  if (commercialChanged) {
    return {
      title: t('mutationPreview.commercial.title'),
      description: t('mutationPreview.commercial.description'),
      variant: 'warning',
      confirmText: t('mutationPreview.confirm'),
    };
  }

  if (identityChanged) {
    return {
      title: t('mutationPreview.identity.title'),
      description: t('mutationPreview.identity.description'),
      variant: 'warning',
      confirmText: t('mutationPreview.confirm'),
    };
  }

  return null;
}

export function buildBuildingLinkPreview(
  currentBuildingId: string | undefined,
  nextBuildingId: string | undefined,
  currentFloorId: string | undefined,
  nextFloorId: string | undefined,
  t: PropertyMutationPreviewTranslator,
): PropertyMutationPreview | null {
  if (currentBuildingId && !nextBuildingId) {
    return {
      title: t('mutationPreview.buildingUnlink.title'),
      description: t('mutationPreview.buildingUnlink.description'),
      variant: 'warning',
      confirmText: t('mutationPreview.confirm'),
    };
  }

  if (
    currentBuildingId &&
    nextBuildingId &&
    (currentBuildingId !== nextBuildingId || currentFloorId !== nextFloorId)
  ) {
    return {
      title: t('mutationPreview.buildingRelink.title'),
      description: t('mutationPreview.buildingRelink.description'),
      variant: 'warning',
      confirmText: t('mutationPreview.confirm'),
    };
  }

  return null;
}

export function buildLinkedSpacesPreview(
  currentLinkedSpaces: readonly LinkedSpace[],
  nextLinkedSpaces: readonly LinkedSpace[],
  t: PropertyMutationPreviewTranslator,
): PropertyMutationPreview | null {
  const removedCount = currentLinkedSpaces.filter(
    (currentSpace) => !nextLinkedSpaces.some((nextSpace) => nextSpace.spaceId === currentSpace.spaceId),
  ).length;

  if (removedCount > 0) {
    return {
      title: t('mutationPreview.linkedSpaces.title'),
      description: t('mutationPreview.linkedSpaces.description'),
      variant: 'warning',
      confirmText: t('mutationPreview.confirm'),
    };
  }

  return null;
}
