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
      title: t('mutationPreview.commercial.title', {
        defaultValue: 'Confirm commercial status change',
      }),
      description: t('mutationPreview.commercial.description', {
        defaultValue: 'This change affects the market disposition of the property and may cascade to downstream commercial workflows.',
      }),
      variant: 'warning',
      confirmText: t('mutationPreview.confirm', { defaultValue: 'Continue' }),
    };
  }

  if (identityChanged) {
    return {
      title: t('mutationPreview.identity.title', {
        defaultValue: 'Confirm property identity change',
      }),
      description: t('mutationPreview.identity.description', {
        defaultValue: 'You are changing core property identity fields. Review the change carefully before saving.',
      }),
      variant: 'warning',
      confirmText: t('mutationPreview.confirm', { defaultValue: 'Continue' }),
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
      title: t('mutationPreview.buildingUnlink.title', {
        defaultValue: 'Confirm building unlink',
      }),
      description: t('mutationPreview.buildingUnlink.description', {
        defaultValue: 'Removing the building link also detaches the property from its structural context. Continue only if this is intentional.',
      }),
      variant: 'warning',
      confirmText: t('mutationPreview.confirm', { defaultValue: 'Continue' }),
    };
  }

  if (
    currentBuildingId &&
    nextBuildingId &&
    (currentBuildingId !== nextBuildingId || currentFloorId !== nextFloorId)
  ) {
    return {
      title: t('mutationPreview.buildingRelink.title', {
        defaultValue: 'Confirm building/floor reassignment',
      }),
      description: t('mutationPreview.buildingRelink.description', {
        defaultValue: 'This property will be reassigned to a different structural location. Verify that linked floor and building data remain correct.',
      }),
      variant: 'warning',
      confirmText: t('mutationPreview.confirm', { defaultValue: 'Continue' }),
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
      title: t('mutationPreview.linkedSpaces.title', {
        defaultValue: 'Confirm linked space change',
      }),
      description: t('mutationPreview.linkedSpaces.description', {
        defaultValue: 'You are removing or replacing linked parking/storage spaces. Confirm the allocation impact before continuing.',
      }),
      variant: 'warning',
      confirmText: t('mutationPreview.confirm', { defaultValue: 'Continue' }),
    };
  }

  return null;
}
