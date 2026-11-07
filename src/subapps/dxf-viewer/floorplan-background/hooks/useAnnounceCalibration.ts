'use client';

/**
 * ADR-929 Φ5.2γ / Φ5.3γ — το αποτέλεσμα της μόνιμης εγγραφής βαθμονόμησης σε μήνυμα για τον άνθρωπο. **Ένα** σημείο
 * για τα δύο μέρη που γράφουν βαθμονόμηση (ο διάλογος δύο σημείων · η κάρτα κλίμακας από τις διαστάσεις): ίδια πράξη
 * (`commitCalibration`), ίδια μηνύματα.
 *
 * @see ../services/commit-calibration.ts
 */

import { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import type { CalibrationCommitResult } from '../services/commit-calibration';

const KEY = 'panels.floorplanBackground.calibration.commit';

/** Σταθερή αναφορά ανά (γλώσσα, ειδοποιήσεις): ασφαλής ως εξάρτηση `useMemo`/`useCallback` των καλούντων. */
export function useAnnounceCalibration(): (result: CalibrationCommitResult) => void {
  const { t } = useTranslation(['dxf-viewer-panels']);
  const notifications = useNotifications();
  return useCallback((result: CalibrationCommitResult) => {
    if (result.status === 'saved') {
      notifications.success(t(`${KEY}.saved`));
      if (result.overlaysSkipped > 0) notifications.warning(t(`${KEY}.overlaysSkipped`, { count: result.overlaysSkipped }));
    } else if (result.status === 'conflict') {
      notifications.warning(t(`${KEY}.conflict`));
    } else {
      notifications.error(t(`${KEY}.failed`));
    }
  }, [t, notifications]);
}
