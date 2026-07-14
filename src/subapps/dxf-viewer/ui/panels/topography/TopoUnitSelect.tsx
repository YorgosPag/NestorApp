'use client';
/**
 * ADR-650 M8β/Ε — the source-unit dropdown, one component, both cloud roads.
 *
 * A survey file states its coordinates in metres, millimetres or feet, and the reader scales by
 * `TOPO_UNIT_SCALE_TO_MM` accordingly. The control that picks it used to live inline in the
 * column-mapping grid (`TopoColumnMapTable`), so it only ever appeared for the roads that HAD a
 * grid — CSV and ASCII clouds. A binary LAS/LAZ cloud (no columns to map) got no grid, hence no
 * unit control, hence a silent default of `m`: a cloud in feet read ×3.28 wrong (M8β/Ε).
 *
 * Extracting the dropdown here lets the binary cloud step mount the exact same control next to its
 * extent readout — one widget, one `UNITS` list, no sibling clone (N.18). Presentational only,
 * canonical Radix `@/components/ui/select` (ADR-001), i18n keys (N.11), CSS module (N.3).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TopoUnit } from '../../../systems/topography/topo-import-types';
import styles from './TopoImportWizard.module.css';

/** The source units a survey file can be in — the single list both cloud roads offer. */
const UNITS: readonly TopoUnit[] = ['m', 'mm', 'ft'];

interface Props {
  readonly unit: TopoUnit;
  readonly disabled?: boolean;
  readonly onUnit: (unit: TopoUnit) => void;
}

export function TopoUnitSelect({ unit, disabled = false, onUnit }: Props): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');

  return (
    <label className={styles.field}>
      <span className={styles.label}>{t('topography.import.unitLabel')}</span>
      <Select value={unit} onValueChange={(v) => onUnit(v as TopoUnit)} disabled={disabled}>
        <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          {UNITS.map((u) => (
            <SelectItem key={u} value={u}>{t(`topography.import.unit.${u}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
