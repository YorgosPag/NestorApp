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
import { useCommandUndoToast } from '../../hooks/notifications/useCommandUndoToast';

const KEY = 'panels.floorplanBackground.calibration.commit';
const UNDO_TOAST_SCOPE = 'dxf-calibration-saved';

/**
 * ADR-929 §6.24 — `undoCommand`: το βήμα της εγγραφής στο ιστορικό αναίρεσης ⇒ το μήνυμα επιτυχίας φέρει «Αναίρεση», που
 * είναι **το ίδιο** Ctrl+Z (`undoIfLast`). Το toast ζει **όσο** η εντολή είναι η κορυφή του ιστορικού
 * (`useCommandUndoToast`): Ctrl+Z ή νέα αλλαγή ⇒ φεύγει. Το «δεν είναι πια η τελευταία» μένει ως δίχτυ ασφαλείας.
 */
export type AnnounceCalibration = (result: CalibrationCommitResult, undoCommand?: ICommand | null) => void;

/** Σταθερή αναφορά ανά (γλώσσα, ειδοποιήσεις): ασφαλής ως εξάρτηση `useMemo`/`useCallback` των καλούντων. */
export function useAnnounceCalibration(): AnnounceCalibration {
  const { t } = useTranslation(['dxf-viewer-panels']);
  const notifications = useNotifications();
  const showUndo = useCommandUndoToast(UNDO_TOAST_SCOPE);
  return useCallback((result: CalibrationCommitResult, undoCommand: ICommand | null = null) => {
    if (result.status === 'saved') {
      if (undoCommand) {
        showUndo({
          command: undoCommand, type: 'success', message: t(`${KEY}.saved`), undoLabel: t(`${KEY}.undo`),
          onUndo: () => { if (!undoIfLast(undoCommand)) notifications.info(t(`${KEY}.undoNotLast`)); },
        });
      } else {
        notifications.success(t(`${KEY}.saved`));
      }
      if (result.overlaysSkipped > 0) notifications.warning(t(`${KEY}.overlaysSkipped`, { count: result.overlaysSkipped }));
    } else if (result.status === 'conflict') {
      notifications.warning(t(`${KEY}.conflict`));
    } else {
      notifications.error(t(`${KEY}.failed`));
    }
  }, [t, notifications, showUndo]);
}
