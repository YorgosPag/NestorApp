'use client';

/**
 * Η διάθεση ενός χώρου ως `{ statusKey, statusLabel }` — για κάρτες που χρωματίζουν ανά κατάσταση
 * (`SalesGridCard`). Κρύβει το namespace των ετικετών (`properties-enums`, ρητό — ADR-744) ώστε ο
 * καλών να μη χρειάζεται δεύτερο `useTranslation` (ADR-777 §8.60.20).
 *
 * @module components/shared/unit-status/useSpaceCommercialStatusView
 */

import { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { spaceCommercialStatusView } from '@/lib/units/unit-status-badges';
import type { SpaceStatusSource } from '@/lib/spaces/space-status-split';

export function useSpaceCommercialStatusView() {
  const { t } = useTranslation('properties-enums');
  return useCallback((space: SpaceStatusSource) => spaceCommercialStatusView(space, t), [t]);
}
