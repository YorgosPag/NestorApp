'use client';

/**
 * ADR-363 Phase 4 / Properties-palette split — Column Advanced Properties panel.
 *
 * Presentational· mirror του `WallAdvancedPanel`. Διατρέχει το SSoT descriptor
 * (`COLUMN_PROPERTY_GROUPS`) και αποδίδει sections με rows. Read/write μέσω των
 * ΚΟΙΝΩΝ pure resolvers (`resolveColumnComboboxState` / `applyColumnComboboxChange`)
 * + του κοινού writer (`useColumnParamsDispatcher`) — ίδιο data plumbing με το
 * ribbon (μηδέν διπλή λογική). Visibility-gated sections (structural=RC only) μέσω
 * του κοινού `resolveColumnPanelVisibility`.
 *
 * @see ./column-property-fields.ts
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ColumnEntity } from '../../bim/types/column-types';
import {
  resolveColumnComboboxState,
  applyColumnComboboxChange,
} from '../ribbon/hooks/bridge/column-bridge-combobox-resolvers';
import {
  resolveColumnPanelVisibility,
  resolveColumnFieldDisabled,
  resolveColumnFieldOptions,
} from '../ribbon/hooks/bridge/column-command-keys';
import type { DispatchColumnParams } from '../ribbon/hooks/bridge/useColumnParamsDispatcher';
import { COLUMN_PROPERTY_GROUPS } from './column-property-fields';
import { ColumnPropertyRow } from './ColumnPropertyRow';
import { EntityWarningsSection } from '../structural-warnings/EntityWarningsSection';

export interface ColumnAdvancedPanelProps {
  readonly column: ColumnEntity;
  readonly dispatch: DispatchColumnParams;
  readonly containerClassName?: string;
}

export function ColumnAdvancedPanel({
  column,
  dispatch,
  containerClassName,
}: ColumnAdvancedPanelProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');

  const handleChange = React.useCallback(
    (commandKey: string, value: string): void => {
      applyColumnComboboxChange(commandKey, value, column, dispatch);
    },
    [column, dispatch],
  );

  const poly = column.params.ushape?.polygon;
  const hasUshapePolygon = !!(poly && poly.length >= 3);

  return (
    <div className={containerClassName ?? 'flex flex-col gap-3 p-2'}>
      {/* ADR-459 — στατικός οργανισμός: «λείπει το πέδιλο» κ.λπ. cross-entity warnings */}
      <EntityWarningsSection entityId={column.id} />
      {COLUMN_PROPERTY_GROUPS.map((group) => {
        if (
          group.visibilityKey &&
          !resolveColumnPanelVisibility(group.visibilityKey, column.params.kind, hasUshapePolygon)
        ) {
          return null;
        }
        return (
          <section key={group.id} className="flex flex-col gap-1">
            <h4 className="text-xs font-semibold text-foreground">{t(group.titleKey)}</h4>
            {group.fields.map((field) => {
              // ADR-460 — shape-aware options (π.χ. διαμάντι κρυφό σε Γ/Τ/Π).
              const allowed = resolveColumnFieldOptions(field.commandKey, column.params);
              const options = allowed
                ? field.options.filter((o) => allowed.includes(o.value))
                : undefined;
              return (
                <ColumnPropertyRow
                  key={field.commandKey}
                  field={field}
                  value={resolveColumnComboboxState(field.commandKey, column, null)?.value ?? null}
                  onChange={handleChange}
                  disabled={resolveColumnFieldDisabled(field.commandKey, column.params)}
                  options={options}
                />
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
