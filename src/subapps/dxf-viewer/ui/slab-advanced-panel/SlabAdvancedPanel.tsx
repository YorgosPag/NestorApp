'use client';

/**
 * ADR-476 — Slab Advanced Properties panel (mirror του `BeamAdvancedPanel`).
 *
 * Presentational. Διατρέχει το SSoT descriptor (`SLAB_PROPERTY_GROUPS`) και αποδίδει
 * sections με rows (κοινό `BimPropertyRow`). Read/write μέσω των pure resolvers του
 * `slab-structural-bridge` + του κοινού writer (`useSlabParamsDispatcher`) — ίδιο data
 * plumbing με το ribbon (μηδέν διπλή λογική). Το structural section είναι visibility-
 * gated (RC πλάκα μόνο) μέσω του κοινού `resolveSlabPanelVisibility`.
 *
 * @see ./slab-property-fields.ts
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SlabEntity } from '../../bim/types/slab-types';
import {
  isSlabStructuralReadoutKey,
  resolveSlabPanelVisibility,
} from '../ribbon/hooks/bridge/slab-command-keys';
import {
  resolveSlabStructuralState,
  resolveSlabStructuralReadoutState,
  applySlabStructuralChange,
} from '../ribbon/hooks/bridge/slab-structural-bridge';
import type { DispatchSlabParams } from '../ribbon/hooks/bridge/useSlabParamsDispatcher';
import { SLAB_PROPERTY_GROUPS } from './slab-property-fields';
import { BimPropertyRow } from '../bim-properties/BimPropertyRow';
import { EntityWarningsSection } from '../structural-warnings/EntityWarningsSection';

export interface SlabAdvancedPanelProps {
  readonly slab: SlabEntity;
  readonly dispatch: DispatchSlabParams;
  readonly containerClassName?: string;
}

export function SlabAdvancedPanel({
  slab,
  dispatch,
  containerClassName,
}: SlabAdvancedPanelProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');

  const handleChange = React.useCallback(
    (commandKey: string, value: string): void => {
      applySlabStructuralChange(slab, commandKey, value, (next) => dispatch(slab, next));
    },
    [slab, dispatch],
  );

  return (
    <div className={containerClassName ?? 'flex flex-col gap-3 p-2'}>
      {/* ADR-459 — στατικός οργανισμός: cross-entity warnings (π.χ. λείπει στήριξη) */}
      <EntityWarningsSection entityId={slab.id} />
      {SLAB_PROPERTY_GROUPS.map((group) => {
        if (group.visibilityKey && !resolveSlabPanelVisibility(group.visibilityKey, slab.params)) {
          return null;
        }
        return (
          <section key={group.id} className="flex flex-col gap-1">
            <h4 className="text-xs font-semibold text-foreground">{t(group.titleKey)}</h4>
            {group.fields.map((field) => {
              const state = isSlabStructuralReadoutKey(field.commandKey)
                ? resolveSlabStructuralReadoutState(slab, field.commandKey)
                : resolveSlabStructuralState(slab, field.commandKey);
              return (
                <BimPropertyRow
                  key={field.commandKey}
                  field={field}
                  value={state?.value ?? null}
                  onChange={handleChange}
                />
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
