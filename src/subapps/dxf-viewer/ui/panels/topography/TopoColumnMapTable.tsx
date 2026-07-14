'use client';
/**
 * ADR-650 M2 (+ M8β/Δ) — the column-mapping GRID, shared by both roads that need one.
 *
 * The CSV/TXT road (`TopoColumnMapStep`) and the ASCII point-cloud road (`TopoCloudStep`) ask the
 * engineer the exact same question — «which column is X, which is the point number, which is the
 * feature code» — and the answer is the exact same `ColumnMapping`. Writing the grid twice would be
 * the textbook sibling clone the jscpd ratchet exists to catch (N.18): two grids drift, and the day
 * one of them stops offering `pointId` is the day a PENZD cloud is silently read as XYZ again.
 *
 * Presentational only — it owns no state. Dropdowns are the canonical Radix
 * `@/components/ui/select` (ADR-001); `ignore` is a real non-empty value, so no clear-sentinel is
 * needed. Strings are i18n keys (N.11), layout is a CSS module (N.3).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TOPO_ORDER_PRESETS } from '../../../systems/topography/topo-order-presets';
import type { ColumnMapping, ColumnRole, TopoUnit } from '../../../systems/topography/topo-import-types';
import styles from './TopoImportWizard.module.css';

/** Roles offered per column, in the order a surveyor thinks about them. */
const ROLES: readonly ColumnRole[] = ['x', 'y', 'z', 'code', 'pointId', 'ignore'];
const UNITS: readonly TopoUnit[] = ['m', 'mm', 'ft'];

/** How many data rows the preview shows — enough to recognise the file, never enough to scroll away. */
const PREVIEW_ROWS = 8;

interface Props {
  /** Column labels when the file had a header row; empty otherwise (a cloud never has one). */
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly mapping: ColumnMapping;
  readonly unit: TopoUnit;
  readonly disabled?: boolean;
  readonly onRole: (columnIndex: number, role: ColumnRole) => void;
  readonly onPreset: (presetId: string) => void;
  readonly onUnit: (unit: TopoUnit) => void;
}

export function TopoColumnMapTable(props: Props): React.JSX.Element {
  const { headers, rows, mapping, unit, disabled = false, onRole, onPreset, onUnit } = props;
  const { t } = useTranslation('dxf-viewer-panels');

  return (
    <>
      <div className={styles.controls}>
        <label className={styles.field}>
          <span className={styles.label}>{t('topography.import.presetLabel')}</span>
          <Select onValueChange={onPreset} disabled={disabled}>
            <SelectTrigger size="sm">
              <SelectValue placeholder={t('topography.import.presetPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {TOPO_ORDER_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {t(`topography.import.preset.${preset.id}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

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
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.previewTable}>
          <thead>
            <tr>
              {mapping.map((role, i) => (
                <th key={i} className={styles.headCell}>
                  <span className={styles.headLabel}>
                    {headers[i] ?? t('topography.import.columnN', { n: i + 1 })}
                  </span>
                  <Select value={role} onValueChange={(v) => onRole(i, v as ColumnRole)} disabled={disabled}>
                    <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{t(`topography.import.role.${r}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, PREVIEW_ROWS).map((row, r) => (
              <tr key={r}>
                {mapping.map((_, c) => (
                  <td key={c} className={styles.cell}>{row[c] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
