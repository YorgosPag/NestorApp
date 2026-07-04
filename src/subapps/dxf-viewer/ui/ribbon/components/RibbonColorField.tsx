'use client';

/**
 * ADR-345 — SSoT presentational color field για τα contextual ribbon tabs.
 *
 * ΕΝΑ σημείο για όλα τα ribbon color controls: (row + label) + το κεντρικό **floating**
 * `ColorDialogTrigger` (`EnterpriseColorDialog`) με το ΠΡΟΤΥΠΟ DXF preset — alpha off,
 * HEX/RGB/HSL, παλέτες DXF/semantic/material, recent, eyedropper. Hex string in/out,
 * ο ΙΔΙΟΣ picker με τις «Ρυθμίσεις DXF» (crosshair/grid/window).
 *
 * Οι καταναλωτές είναι thin data-adapters που διαφέρουν ΜΟΝΟ στην πηγή δεδομένων:
 *   - `RibbonDxfColorPickerWidget`  → ribbon bridge (hatch fill/gradient)
 *   - `RibbonMepCircuitColorWidget` → MepSystem store
 *   - `OpeningTagStyleColorWidget`  → opening-tag-style service
 * Έτσι ο picker + το preset + το markup ζουν ΜΙΑ φορά → μηδέν διπλότυπο.
 *
 * @see ../../color/EnterpriseColorDialog — floating picker engine (ίδιο με settings DXF)
 */

import React from 'react';
import { ColorDialogTrigger } from '../../color/EnterpriseColorDialog';

interface RibbonColorFieldProps {
  /** Already-translated label shown beside the swatch + used as the dialog title. */
  readonly label: string;
  /** Current color as `#rrggbb`. */
  readonly value: string;
  /** Commit a new `#rrggbb`. */
  readonly onChange: (hex: string) => void;
  /** Trigger-button caption (default: the hex value). */
  readonly buttonLabel?: string;
}

/** Ribbon color control — label + central floating EnterpriseColorDialog (DXF preset). */
export function RibbonColorField({ label, value, onChange, buttonLabel }: RibbonColorFieldProps) {
  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <span className="dxf-ribbon-widget-compact">
        <ColorDialogTrigger
          value={value}
          onChange={onChange}
          label={buttonLabel ?? value}
          title={label}
          alpha={false}
          modes={['hex', 'rgb', 'hsl']}
          palettes={['dxf', 'semantic', 'material']}
          recent
          eyedropper
          // Canvas color picker → μηδέν dim backdrop: το σχέδιο μένει πλήρως ορατό
          // ώστε να συγκρίνεις ζωντανά το χρώμα με τις άλλες οντότητες.
          dimBackdrop={false}
        />
      </span>
    </span>
  );
}
