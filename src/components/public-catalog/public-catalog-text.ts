'use client';

/**
 * Τα κείμενα της δημόσιας βιτρίνας (ADR-923 §5.13 Σ4): UI από το namespace, δεδομένα από το `resolveLocalizedText`.
 *
 * @module components/public-catalog/public-catalog-text
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLocalizedTextReader } from '@/components/catalog/shared/catalog-neutral-hooks';

export function usePublicCatalogText() {
  const { t, i18n } = useTranslation(['public-catalog']);
  const { text, language } = useLocalizedTextReader(i18n.language);
  return { t, text, language };
}
