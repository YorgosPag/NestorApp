'use client';

/**
 * ADR-507 Φ5 UI — Gradient color swatch για το contextual «Γραμμοσκίαση» tab.
 *
 * Mirror του `HatchPatternPicker`: value/onChange μέσω του ΥΠΑΡΧΟΝΤΟΣ ribbon bridge
 * (`useRibbonCommand` → `getComboboxState`/`onComboboxChange` με το `command.commandKey`
 * του gradient χρώματος). Έτσι το dual-mode (επιλεγμένη οντότητα Ή draw-defaults) ζει
 * ΜΙΑ φορά στο bridge, και color1/color2 διαφέρουν μόνο στο `commandKey`.
 *
 * Color picker = το κεντρικό `ColorDialogTrigger` (`EnterpriseColorDialog`) — ο ΙΔΙΟΣ
 * full picker με crosshair/text/opening-tag/MEP circuit (hex in/out). Μηδέν νέο
 * component, μηδέν dependency.
 *
 * @see ../../color/EnterpriseColorDialog
 * @see ./HatchPatternPicker — variant precedent (bridge value/onChange)
 * @see ../RibbonMepCircuitColorWidget — ColorDialogTrigger pattern
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Tooltip, TooltipContent, TooltipTrigger } from '../RibbonTooltip';
import { ColorDialogTrigger } from '../../../color/EnterpriseColorDialog';
import { useRibbonCommand } from '../../context/RibbonCommandContext';
import type { RibbonCommand } from '../../types/ribbon-types';

const FALLBACK_HEX = '#2980b9';

interface HatchGradientColorPickerProps {
  command: RibbonCommand;
}

export const HatchGradientColorPicker: React.FC<HatchGradientColorPickerProps> = ({ command }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { onComboboxChange, getComboboxState } = useRibbonCommand();

  const state = getComboboxState(command.commandKey);
  const hex = state?.value && state.value !== '' ? state.value : FALLBACK_HEX;
  const label = t(command.labelKey);

  const handleChange = useCallback(
    (color: string) => onComboboxChange(command.commandKey, color),
    [onComboboxChange, command.commandKey],
  );

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <span className="dxf-ribbon-widget-compact">
        <ColorDialogTrigger
          value={hex}
          onChange={handleChange}
          title={label}
          alpha={false}
          modes={['hex', 'rgb', 'hsl']}
          palettes={['dxf', 'semantic', 'material']}
          recent
          eyedropper
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="block h-6 w-14 rounded border border-input hover:ring-1 hover:ring-ring"
                style={{ backgroundColor: hex }}
                aria-label={`${label}: ${hex}`}
                data-command-id={command.id}
              />
            </TooltipTrigger>
            <TooltipContent>{hex}</TooltipContent>
          </Tooltip>
        </ColorDialogTrigger>
      </span>
    </span>
  );
};
