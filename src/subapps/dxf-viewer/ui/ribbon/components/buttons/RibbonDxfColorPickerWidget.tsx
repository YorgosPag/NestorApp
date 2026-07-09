'use client';

/**
 * ADR-344 / ADR-345 / ADR-507 — Bridge-driven adapter για το unified ribbon color field.
 *
 * Thin leaf: value/onChange μέσω του ΥΠΑΡΧΟΝΤΟΣ ribbon bridge (`useRibbonCommand` →
 * `getComboboxState`/`onComboboxChange` με το `command.commandKey`). Hex in/out — μηδέν
 * conversion (το hatch fillColor/gradient είναι καθαρό `#rrggbb`). Όλο το UI (markup +
 * floating `ColorDialogTrigger` + DXF preset) ζει ΜΙΑ φορά στο SSoT `RibbonColorField`.
 *
 * Mount μέσω `comboboxVariant:'dxf-color'` (RibbonCombobox dispatcher). Χρήση: hatch
 * fillColor + gradient color1/2 (ADR-507 Φ2/Φ5). Γενικό → reusable για κάθε hex-bridge
 * color field. Αντικατέστησε το πρώην `HatchGradientColorPicker`.
 *
 * @see ../RibbonColorField — SSoT presentational color field (floating picker)
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { RibbonColorField } from '../RibbonColorField';
import { useRibbonDispatch } from '../../context/RibbonCommandContext';
import { useRibbonComboboxState } from '../../context/useRibbonFieldSelectors';
import type { RibbonCommand } from '../../types/ribbon-types';

const FALLBACK_HEX = '#808080';

interface RibbonDxfColorPickerWidgetProps {
  command: RibbonCommand;
}

export const RibbonDxfColorPickerWidget: React.FC<RibbonDxfColorPickerWidgetProps> = ({ command }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { onComboboxChange } = useRibbonDispatch();

  // ADR-547 Stage 4 — per-key leaf subscription (re-renders only on THIS color field).
  const state = useRibbonComboboxState(command.commandKey);
  const hex = state?.value && state.value !== '' ? state.value : FALLBACK_HEX;

  const handleChange = useCallback(
    (color: string) => onComboboxChange(command.commandKey, color),
    [onComboboxChange, command.commandKey],
  );

  return (
    <RibbonColorField
      label={t(command.labelKey)}
      value={hex}
      onChange={handleChange}
      disabled={state?.disabled === true}
    />
  );
};
