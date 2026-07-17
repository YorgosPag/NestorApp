'use client';

/**
 * OpeningHardwareSetEditor — reusable SSoT editor block for an opening's
 * hardware-set QUANTITY overrides (ADR-674 Φ B). One `OpeningHardwareQtyCell`
 * row per catalog component for the opening's `kind` (`OPENING_HARDWARE_CATALOG`),
 * wired to a sparse `OpeningHardwareOverrides` map.
 *
 * Shared by BOTH the TYPE dialog (`typeParams.hardwareOverrides` — applies to
 * every instance of the type) and, later, an instance-level dialog
 * (`params.hardwareOverrides` — «this door only»); the resolver folds type THEN
 * instance overrides (LAST wins, see `resolveOpeningHardwareSet`). This
 * component itself is override-scope agnostic — the caller supplies whichever
 * `overrides` map it owns and receives `(component, quantity)` patches back.
 *
 * Kinds with no operable hardware (`fixed` / `bay-window` / `overhead-door` /
 * `revolving-door`) render nothing — mirrors `openingHasOperableHardware`.
 *
 * @see ../../../bim/family-types/opening-hardware-set.ts — catalog + resolver + label-key SSoT
 * @see ./OpeningHardwareQtyCell.tsx — one row per component
 * @see ./EditOpeningTypeDialog.tsx — first consumer (type-level overrides)
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  HARDWARE_COMPONENT_LABEL_KEY,
  OPENING_HARDWARE_CATALOG,
  openingHasOperableHardware,
  type OpeningHardwareComponent,
} from '../../../bim/family-types/opening-hardware-set';
import type { OpeningHardwareOverrides } from '../../../bim/types/opening-types';
import type { OpeningKind } from '../../../bim/types/opening-types';
import { OpeningHardwareQtyCell } from './OpeningHardwareQtyCell';

export interface OpeningHardwareSetEditorProps {
  readonly kind: OpeningKind;
  readonly overrides: OpeningHardwareOverrides | undefined;
  readonly onChange: (component: OpeningHardwareComponent, quantity: number | undefined) => void;
}

export function OpeningHardwareSetEditor({
  kind,
  overrides,
  onChange,
}: OpeningHardwareSetEditorProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');

  const makeOnChange = useCallback(
    (component: OpeningHardwareComponent) => (quantity: number | undefined) =>
      onChange(component, quantity),
    [onChange],
  );

  if (!openingHasOperableHardware(kind)) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-foreground">
        {t('ribbon.commands.bimFamilyType.paramHardwareSet')}
      </span>
      <div className="flex flex-col gap-1.5">
        {OPENING_HARDWARE_CATALOG[kind].map((entry) => (
          <OpeningHardwareQtyCell
            key={entry.component}
            label={t(HARDWARE_COMPONENT_LABEL_KEY[entry.component])}
            quantity={overrides?.[entry.component]}
            defaultQuantity={entry.quantity}
            onChange={makeOnChange(entry.component)}
          />
        ))}
      </div>
    </div>
  );
}
