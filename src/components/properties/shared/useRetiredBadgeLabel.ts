'use client';

/**
 * useRetiredBadgeLabel — το επίθεμα «(αρχειοθετημένο)» / «(στον κάδο)» ενός ακινήτου
 *
 * Μία μετάφραση για κάθε σημείο που δείχνει όνομα αποσυρμένου ακινήτου (επιλογείς,
 * κατανομή κόστους). Κενή συμβολοσειρά για ζωντανό ακίνητο.
 *
 * @module components/properties/shared/useRetiredBadgeLabel
 * @enterprise ADR-281 · ADR-329 §3.9
 */

import { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { retiredKindOf } from './linked-retired-properties';
import type { MaybeTrashed } from '@/lib/firestore/trashed-status';

export function useRetiredBadgeLabel(): (property: MaybeTrashed) => string {
  const { t } = useTranslation('trash');

  return useCallback((property) => {
    const kind = retiredKindOf(property);
    if (kind === 'archived') return t('archivedBadge');
    if (kind === 'trashed') return t('trashedBadge');
    return '';
  }, [t]);
}
