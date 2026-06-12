/**
 * mep-autodesign-notifications — ADR-426 … ADR-434.
 *
 * Toast registrars for the 8 MEP auto-design disciplines (Generate → review →
 * accept): water-supply, drainage, heating, electrical (strong/weak), HVAC,
 * fire-protection, gas. Extracted from `useDxfViewerNotifications` (Google
 * file-size SSoT, N.7.1). Grouped two-per-registrar to keep each ≤40 lines.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-426-water-supply-auto-design.md
 */

import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { EventBus } from '../../systems/events/EventBus';

/** ADR-426 water-supply + ADR-427 sanitary-drainage (network/segment shape). */
function registerWaterDrainageToasts(t: TFunction): Array<() => void> {
  return [
    EventBus.on('bim:water-supply-generated', ({ networkCount, warningCount }) => {
      toast.info(warningCount > 0
        ? t('waterSupply.generatedWithWarnings', { count: networkCount, warnings: warningCount })
        : t('waterSupply.generated', { count: networkCount }));
    }),
    EventBus.on('bim:water-supply-empty', ({ reason }) => {
      toast.warning(t(`waterSupply.empty.${reason}`));
    }),
    EventBus.on('bim:water-supply-committed', ({ networkCount, segmentCount }) => {
      toast.success(t('waterSupply.committed', { count: networkCount, segments: segmentCount }));
    }),
    EventBus.on('bim:drainage-generated', ({ networkCount, warningCount }) => {
      toast.info(warningCount > 0
        ? t('drainage.generatedWithWarnings', { count: networkCount, warnings: warningCount })
        : t('drainage.generated', { count: networkCount }));
    }),
    EventBus.on('bim:drainage-empty', ({ reason }) => {
      toast.warning(t(`drainage.empty.${reason}`));
    }),
    EventBus.on('bim:drainage-committed', ({ networkCount, segmentCount }) => {
      toast.success(t('drainage.committed', { count: networkCount, segments: segmentCount }));
    }),
  ];
}

/** ADR-428 heating (hydronic) + ADR-432 HVAC (network/segment shape). */
function registerHeatingHvacToasts(t: TFunction): Array<() => void> {
  return [
    EventBus.on('bim:heating-generated', ({ networkCount, warningCount }) => {
      toast.info(warningCount > 0
        ? t('heating.generatedWithWarnings', { count: networkCount, warnings: warningCount })
        : t('heating.generated', { count: networkCount }));
    }),
    EventBus.on('bim:heating-empty', ({ reason }) => {
      toast.warning(t(`heating.empty.${reason}`));
    }),
    EventBus.on('bim:heating-committed', ({ networkCount, segmentCount }) => {
      toast.success(t('heating.committed', { count: networkCount, segments: segmentCount }));
    }),
    EventBus.on('bim:hvac-generated', ({ networkCount, warningCount }) => {
      toast.info(warningCount > 0
        ? t('hvac.generatedWithWarnings', { count: networkCount, warnings: warningCount })
        : t('hvac.generated', { count: networkCount }));
    }),
    EventBus.on('bim:hvac-empty', ({ reason }) => {
      toast.warning(t(`hvac.empty.${reason}`));
    }),
    EventBus.on('bim:hvac-committed', ({ networkCount, segmentCount }) => {
      toast.success(t('hvac.committed', { count: networkCount, segments: segmentCount }));
    }),
  ];
}

/** ADR-433 fire-protection + ADR-434 gas (network/segment shape). */
function registerFireGasToasts(t: TFunction): Array<() => void> {
  return [
    EventBus.on('bim:fire-generated', ({ networkCount, warningCount }) => {
      toast.info(warningCount > 0
        ? t('fire.generatedWithWarnings', { count: networkCount, warnings: warningCount })
        : t('fire.generated', { count: networkCount }));
    }),
    EventBus.on('bim:fire-empty', ({ reason }) => {
      toast.warning(t(`fire.empty.${reason}`));
    }),
    EventBus.on('bim:fire-committed', ({ networkCount, segmentCount }) => {
      toast.success(t('fire.committed', { count: networkCount, segments: segmentCount }));
    }),
    EventBus.on('bim:gas-generated', ({ networkCount, warningCount }) => {
      toast.info(warningCount > 0
        ? t('gas.generatedWithWarnings', { count: networkCount, warnings: warningCount })
        : t('gas.generated', { count: networkCount }));
    }),
    EventBus.on('bim:gas-empty', ({ reason }) => {
      toast.warning(t(`gas.empty.${reason}`));
    }),
    EventBus.on('bim:gas-committed', ({ networkCount, segmentCount }) => {
      toast.success(t('gas.committed', { count: networkCount, segments: segmentCount }));
    }),
  ];
}

/** ADR-430 electrical-strong (circuit) + ADR-431 electrical-weak (channel). */
function registerElectricalToasts(t: TFunction): Array<() => void> {
  return [
    EventBus.on('bim:electrical-generated', ({ circuitCount, warningCount }) => {
      toast.info(warningCount > 0
        ? t('electrical.generatedWithWarnings', { count: circuitCount, warnings: warningCount })
        : t('electrical.generated', { count: circuitCount }));
    }),
    EventBus.on('bim:electrical-empty', ({ reason }) => {
      toast.warning(t(`electrical.empty.${reason}`));
    }),
    EventBus.on('bim:electrical-committed', ({ circuitCount }) => {
      toast.success(t('electrical.committed', { count: circuitCount }));
    }),
    EventBus.on('bim:electrical-weak-generated', ({ channelCount, warningCount }) => {
      toast.info(warningCount > 0
        ? t('electricalWeak.generatedWithWarnings', { count: channelCount, warnings: warningCount })
        : t('electricalWeak.generated', { count: channelCount }));
    }),
    EventBus.on('bim:electrical-weak-empty', ({ reason }) => {
      toast.warning(t(`electricalWeak.empty.${reason}`));
    }),
    EventBus.on('bim:electrical-weak-committed', ({ channelCount }) => {
      toast.success(t('electricalWeak.committed', { count: channelCount }));
    }),
  ];
}

/** All 8 MEP auto-design discipline toasts. */
export function registerMepAutoDesignNotifications(t: TFunction): Array<() => void> {
  return [
    ...registerWaterDrainageToasts(t),
    ...registerHeatingHvacToasts(t),
    ...registerFireGasToasts(t),
    ...registerElectricalToasts(t),
  ];
}
