/**
 * The React dependencies both electrical auto-design bridges (ADR-430 strong · ADR-431 weak) read:
 * the command executor, the shell translator and the live `MepSystem` list (terminals already on a
 * circuit/channel are skipped by the engines).
 */

import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { useCommandHistory, type ICommand } from '../../../../core/commands';
import { useMepSystemStore } from '../../../../bim/mep-systems/mep-system-store';
import type { MepSystemEntity } from '../../../../bim/types/mep-system-types';

export interface ElectricalAutoBridgeDeps {
  readonly executeCommand: (command: ICommand) => void;
  readonly t: TFunction;
  readonly systems: readonly MepSystemEntity[];
}

export function useElectricalAutoBridgeDeps(): ElectricalAutoBridgeDeps {
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');
  const systems = useMepSystemStore((s) => s.systems);
  return { executeCommand, t, systems };
}
