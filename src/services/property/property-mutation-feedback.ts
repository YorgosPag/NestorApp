import type { TFunction } from 'i18next';

export function translatePropertyMutationError(
  error: unknown,
  t: TFunction,
  fallbackKey = 'save.error',
): string {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes('permission') || errorMessage.includes('PERMISSION_DENIED')) {
    return t('save.permissionDenied');
  }

  if (errorMessage.includes('asking price')) {
    return t('save.askingPriceRequired');
  }

  if (errorMessage.includes('Buyer contact')) {
    return t('save.buyerRequired');
  }

  if (errorMessage.includes('locked fields')) {
    return t('fieldLocking.serverReject');
  }

  if (errorMessage.includes('not linked to a building')) {
    return t('save.buildingRequired');
  }

  if (errorMessage.includes('area')) {
    return t('save.areaRequired');
  }

  if (errorMessage.includes('unsaved')) {
    return t('save.unsavedProperty');
  }

  const translated = t(fallbackKey);
  // If translation failed (returned raw key), surface the actual server error
  if (translated === fallbackKey || translated.includes(fallbackKey)) {
    return errorMessage || translated;
  }
  return translated;
}
