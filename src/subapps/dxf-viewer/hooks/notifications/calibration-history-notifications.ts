/**
 * calibration-history-notifications — ADR-929 §6.24.
 *
 * Η αναίρεση/επανάληψη μιας βαθμονόμησης (`CalibrationChangeCommand`) **δεν** γράφει πάνω σε ξένη αλλαγή και δεν αποτυγχάνει
 * σιωπηλά: η εντολή εκπέμπει `floorplan:calibration-history-skipped`, εδώ γίνεται μήνυμα για τον άνθρωπο.
 *
 * @see ../../floorplan-background/services/calibration-command.ts
 */

import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { EventBus } from '../../systems/events/EventBus';

export function registerCalibrationHistoryNotifications(t: TFunction): Array<() => void> {
  return [
    EventBus.on('floorplan:calibration-history-skipped', ({ reason }) => {
      if (reason === 'changed-meanwhile') toast.warning(t('calibrationHistory.changedMeanwhile'));
      else toast.error(t('calibrationHistory.failed'));
    }),
  ];
}
