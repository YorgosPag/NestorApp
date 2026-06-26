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
import { BEAM_EFFECTIVE_FLANGE_FIELD, BEAM_PROPERTY_GROUPS } from './beam-property-fields';
import { BimPropertyRow } from '../bim-properties/BimPropertyRow';
import type { BimPropertyGroup } from '../bim-properties/bim-property-types';
import { EntityWarningsSection } from '../structural-warnings/EntityWarningsSection';
import { IntermediateColumnsAction } from '../structural-warnings/IntermediateColumnsAction';
import { AnalysisForcesSection } from '../structural-analysis/AnalysisForcesSection';

/** Read-only readout: η αλλαγή δεν εφαρμόζεται ποτέ (derived value). */
const NOOP_CHANGE = (): void => {};

export interface BeamAdvancedPanelProps {
  readonly beam: BeamEntity;
  readonly dispatch: DispatchBeamParams;
  readonly containerClassName?: string;
  /**
   * ADR-534 Φ3c-A — DERIVED `b_eff` (mm) όταν μονολιθική πλάκα καλύπτει τη δοκό (T-beam).
   * Scene-injected από το `BeamPropertiesTab`· `undefined` = γυμνή ορθογώνια δοκός → καμία γραμμή.
   */
  readonly effectiveFlangeWidthMm?: number;
}

interface BeamAdvancedSectionProps {
  readonly group: BimPropertyGroup;
  readonly beam: BeamEntity;
  readonly onChange: (commandKey: string, value: string) => void;
  readonly effectiveFlangeWidthMm?: number;
}

/** Resolve της τρέχουσας τιμής μιας γραμμής (readout vs editable) μέσω των κοινών bridges. */
function resolveFieldValue(beam: BeamEntity, commandKey: string): string | null {
  const state = isBeamStructuralReadoutKey(commandKey)
    ? resolveBeamStructuralReadoutState(beam, commandKey)
    : resolveBeamStructuralState(beam, commandKey);
  return state?.value ?? null;
}

/**
 * Ένα visibility-gated section του panel. Στο `structural` group εισάγει —scene-permitting—
 * τη DERIVED γραμμή `b_eff` (πλακοδοκός) ΑΚΡΙΒΩΣ πάνω από τα readouts (όγκοι/ρ%), ως κεφαλή του
 * παραγόμενου μπλοκ — Revit instance property. Reuse του κοινού `BimPropertyRow` (μηδέν νέο UI).
 */
function BeamAdvancedSection({
  group,
  beam,
  onChange,
  effectiveFlangeWidthMm,
}: BeamAdvancedSectionProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  if (group.visibilityKey && !resolveBeamPanelVisibility(group.visibilityKey, beam.params)) {
    return null;
  }
  // `effectiveFlangeWidthMm != null` εδώ → narrowed σε number (μηδέν assertion).
  const flangeRow =
    group.id === 'structural' && effectiveFlangeWidthMm != null ? (
      <BimPropertyRow
        field={BEAM_EFFECTIVE_FLANGE_FIELD}
        value={String(Math.round(effectiveFlangeWidthMm))}
        onChange={NOOP_CHANGE}
      />
    ) : null;
  const firstReadoutKey = group.fields.find((f) => f.readOnly)?.commandKey;
  return (
    <section className="flex flex-col gap-1">
      <h4 className="text-xs font-semibold text-foreground">{t(group.titleKey)}</h4>
      {group.fields.map((field) => (
        <React.Fragment key={field.commandKey}>
          {flangeRow && field.commandKey === firstReadoutKey ? flangeRow : null}
          <BimPropertyRow
            field={field}
            value={resolveFieldValue(beam, field.commandKey)}
            onChange={onChange}
          />
        </React.Fragment>
      ))}
    </section>
  );
}

export function BeamAdvancedPanel({
  beam,
  dispatch,
  containerClassName,
  effectiveFlangeWidthMm,
}: BeamAdvancedPanelProps): React.ReactElement {
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
      {/* ADR-504 Φ2 — opt-in «Πρόσθεσε ενδιάμεσες κολώνες» (μόνο σε μη-πρακτικά άνοιγμα) */}
      <IntermediateColumnsAction beam={beam} />
      {/* ADR-482 — εντατικά μεγέθη envelope από τον στατικό FEM solver (read-only) */}
      <AnalysisForcesSection entityId={beam.id} />
      {BEAM_PROPERTY_GROUPS.map((group) => (
        <BeamAdvancedSection
          key={group.id}
          group={group}
          beam={beam}
          onChange={handleChange}
          effectiveFlangeWidthMm={effectiveFlangeWidthMm}
        />
      ))}
    </div>
  );
}
