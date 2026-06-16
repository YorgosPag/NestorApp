'use client';

/**
 * ADR-463 — Foundation Advanced Properties panel (mirror του `ColumnAdvancedPanel`).
 *
 * Presentational· διατρέχει το **kind-aware** SSoT descriptor
 * (`resolveFoundationPropertyGroups`) και αποδίδει sections με rows. Read/write
 * μέσω των ΚΟΙΝΩΝ resolvers (`resolveFoundationComboboxState` /
 * `applyFoundationComboboxChange`) + του κοινού writer (`useFoundationParamsDispatcher`).
 * Επαναχρησιμοποιεί το γενικό `ColumnPropertyRow` (N.0.2).
 *
 * @see ./foundation-property-fields.ts
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FoundationEntity } from '../../bim/types/foundation-types';
import {
  resolveFoundationComboboxState,
  applyFoundationComboboxChange,
} from '../ribbon/hooks/bridge/foundation-bridge-combobox-resolvers';
import { resolveFoundationFieldDisabled } from '../ribbon/hooks/bridge/foundation-structural-bridge';
import type { DispatchFoundationParams } from '../ribbon/hooks/bridge/useFoundationParamsDispatcher';
import { resolveFoundationPropertyGroups } from './foundation-property-fields';
import { ColumnPropertyRow } from '../column-advanced-panel/ColumnPropertyRow';
import { EntityWarningsSection } from '../structural-warnings/EntityWarningsSection';

export interface FoundationAdvancedPanelProps {
  readonly footing: FoundationEntity;
  readonly dispatch: DispatchFoundationParams;
  readonly containerClassName?: string;
}

export function FoundationAdvancedPanel({
  footing,
  dispatch,
  containerClassName,
}: FoundationAdvancedPanelProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');

  const handleChange = React.useCallback(
    (commandKey: string, value: string): void => {
      applyFoundationComboboxChange(commandKey, value, footing, (next) => dispatch(footing, next));
    },
    [footing, dispatch],
  );

  const groups = resolveFoundationPropertyGroups(footing.params.kind);

  return (
    <div className={containerClassName ?? 'flex flex-col gap-3 p-2'}>
      {/* ADR-459 — στατικός οργανισμός: «λείπει η κολώνα» κ.λπ. cross-entity warnings */}
      <EntityWarningsSection entityId={footing.id} />
      {groups.map((group) => (
        <section key={group.id} className="flex flex-col gap-1">
          <h4 className="text-xs font-semibold text-foreground">{t(group.titleKey)}</h4>
          {group.fields.map((field) => (
            <ColumnPropertyRow
              key={field.commandKey}
              field={field}
              value={resolveFoundationComboboxState(field.commandKey, footing)?.value ?? null}
              onChange={handleChange}
              disabled={resolveFoundationFieldDisabled(footing, field.commandKey)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
