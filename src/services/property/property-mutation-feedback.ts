import type { TFunction } from 'i18next';

export function translatePropertyMutationError(
  error: unknown,
  t: TFunction,
  fallbackKey = 'save.error',
  fallbackDefaultValue = 'Failed to save property changes.',
): string {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes('permission') || errorMessage.includes('PERMISSION_DENIED')) {
    return t('save.permissionDenied', {
      defaultValue: 'You do not have permission to update this property.',
    });
  }

  if (errorMessage.includes('asking price')) {
    return t('save.askingPriceRequired', {
      defaultValue: 'An asking price is required before reserving or selling this property.',
    });
  }

  if (errorMessage.includes('Buyer contact')) {
    return t('save.buyerRequired', {
      defaultValue: 'A buyer contact is required before reserving or selling this property.',
    });
  }

  if (errorMessage.includes('locked fields')) {
    return t('fieldLocking.serverReject', {
      defaultValue: 'This property contains locked fields that cannot be changed in its current commercial state.',
    });
  }

  if (errorMessage.includes('not linked to a building')) {
    return t('save.buildingRequired', {
      defaultValue: 'This property must be linked to a building before it can be reserved or sold.',
    });
  }

  if (errorMessage.includes('area')) {
    return t('save.areaRequired', {
      defaultValue: 'This property must have an area defined before it can be reserved or sold.',
    });
  }

  return t(fallbackKey, { defaultValue: fallbackDefaultValue });
}
