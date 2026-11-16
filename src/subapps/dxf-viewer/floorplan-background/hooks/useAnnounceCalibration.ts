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
import { undoIfLast } from '../services/calibration-command';
import type { ICommand } from '../../core/commands/interfaces';

const KEY = 'panels.floorplanBackground.calibration.commit';

/**
 * ADR-929 §6.24 — `undoCommand`: το βήμα της εγγραφής στο ιστορικό αναίρεσης ⇒ το μήνυμα επιτυχίας φέρει «Αναίρεση», που
 * είναι **το ίδιο** Ctrl+Z (`undoIfLast`). Αν έγιναν άλλες αλλαγές μετά, δεν αναιρεί εκτός σειράς: το λέει.
 */
export type AnnounceCalibration = (result: CalibrationCommitResult, undoCommand?: ICommand | null) => void;

/** Σταθερή αναφορά ανά (γλώσσα, ειδοποιήσεις): ασφαλής ως εξάρτηση `useMemo`/`useCallback` των καλούντων. */
export function useAnnounceCalibration(): AnnounceCalibration {
  const { t } = useTranslation(['dxf-viewer-panels']);
  const notifications = useNotifications();
  return useCallback((result: CalibrationCommitResult, undoCommand: ICommand | null = null) => {
    if (result.status === 'saved') {
      const undo = undoCommand
        ? () => { if (!undoIfLast(undoCommand)) notifications.info(t(`${KEY}.undoNotLast`)); }
        : null;
      notifications.success(t(`${KEY}.saved`), undo ? { actions: [{ label: t(`${KEY}.undo`), onClick: undo }] } : undefined);
      if (result.overlaysSkipped > 0) notifications.warning(t(`${KEY}.overlaysSkipped`, { count: result.overlaysSkipped }));
    } else if (result.status === 'conflict') {
      notifications.warning(t(`${KEY}.conflict`));
    } else {
      notifications.error(t(`${KEY}.failed`));
    }
  }, [t, notifications]);
}
