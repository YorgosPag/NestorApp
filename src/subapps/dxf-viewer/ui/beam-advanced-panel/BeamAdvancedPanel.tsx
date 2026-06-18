'use client';

/**
 * ADR-471 — Beam Advanced Properties panel (mirror του `ColumnAdvancedPanel`).
 *
 * Presentational. Διατρέχει το SSoT descriptor (`BEAM_PROPERTY_GROUPS`) και
 * αποδίδει sections με rows (κοινό `BimPropertyRow`). Read/write μέσω των pure
 * resolvers του `beam-structural-bridge` + του κοινού writer
 * (`useBeamParamsDispatcher`) — ίδιο data plumbing με το ribbon (μηδέν διπλή
 * λογική). Το structural section είναι visibility-gated (RC δοκός μόνο) μέσω του
 * κοινού `resolveBeamPanelVisibility`.
 *
 * @see ./beam-property-fields.ts
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { BeamEntity } from '../../bim/types/beam-types';
import {
  isBeamStructuralReadoutKey,
  resolveBeamPanelVisibility,
} from '../ribbon/hooks/bridge/beam-command-keys';
import {
  resolveBeamStructuralState,
  resolveBeamStructuralReadoutState,
  applyBeamStructuralChange,
} from '../ribbon/hooks/bridge/beam-structural-bridge';
import type { DispatchBeamParams } from '../ribbon/hooks/bridge/useBeamParamsDispatcher';
import { BEAM_PROPERTY_GROUPS } from './beam-property-fields';
import { BimPropertyRow } from '../bim-properties/BimPropertyRow';
import { EntityWarningsSection } from '../structural-warnings/EntityWarningsSection';
import { AnalysisForcesSection } from '../structural-analysis/AnalysisForcesSection';

export interface BeamAdvancedPanelProps {
  readonly beam: BeamEntity;
  readonly dispatch: DispatchBeamParams;
  readonly containerClassName?: string;
}

export function BeamAdvancedPanel({
  beam,
  dispatch,
  containerClassName,
}: BeamAdvancedPanelProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');

  const handleChange = React.useCallback(
    (commandKey: string, value: string): void => {
      applyBeamStructuralChange(beam, commandKey, value, (next) => dispatch(beam, next));
    },
    [beam, dispatch],
  );

  return (
    <div className={containerClassName ?? 'flex flex-col gap-3 p-2'}>
      {/* ADR-459 — στατικός οργανισμός: «λείπει η στήριξη/κολώνα» cross-entity warnings */}
      <EntityWarningsSection entityId={beam.id} />
      {/* ADR-482 — εντατικά μεγέθη envelope από τον στατικό FEM solver (read-only) */}
      <AnalysisForcesSection entityId={beam.id} />
      {BEAM_PROPERTY_GROUPS.map((group) => {
        if (group.visibilityKey && !resolveBeamPanelVisibility(group.visibilityKey, beam.params)) {
          return null;
        }
        return (
          <section key={group.id} className="flex flex-col gap-1">
            <h4 className="text-xs font-semibold text-foreground">{t(group.titleKey)}</h4>
            {group.fields.map((field) => {
              const state = isBeamStructuralReadoutKey(field.commandKey)
                ? resolveBeamStructuralReadoutState(beam, field.commandKey)
                : resolveBeamStructuralState(beam, field.commandKey);
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
