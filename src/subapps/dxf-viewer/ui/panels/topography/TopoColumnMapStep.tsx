'use client';
/**
 * ADR-650 Milestone 2 — the column-mapping step (the heart of the wizard).
 *
 * This is the screen that beats CASS: the surveyor never edits the file. A preset (PNEZD,
 * PENZD, …) or a per-column dropdown declares what each column MEANS, the preview grid
 * shows the file exactly as it is, and the point count updates live underneath.
 *
 * Dropdowns are the canonical Radix `@/components/ui/select` (ADR-001) — never
 * `EnterpriseComboBox`. The «ignore» role is a real, non-empty value (`'ignore'`), so no
 * `SELECT_CLEAR_VALUE` sentinel is needed here (Radix only forbids the empty string).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TOPO_ORDER_PRESETS } from '../../../systems/topography/topo-order-presets';
import type { ColumnRole, TopoUnit } from '../../../systems/topography/topo-import-types';
import type { UseTopoImport } from './useTopoImport';
import styles from './TopoImportWizard.module.css';

/** Roles offered per column, in the order a surveyor thinks about them. */
const ROLES: readonly ColumnRole[] = ['x', 'y', 'z', 'code', 'pointId', 'ignore'];
const UNITS: readonly TopoUnit[] = ['m', 'mm', 'ft'];

/** How many data rows the preview shows — enough to recognise the file, never enough to scroll away. */
const PREVIEW_ROWS = 8;

interface Props {
  readonly wizard: UseTopoImport;
}

export function TopoColumnMapStep({ wizard }: Props): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-panels');
  const { table, mapping, unit } = wizard;

  if (!table) return null;
  const rows = table.rows.slice(0, PREVIEW_ROWS);

  return (
    <section className={styles.step}>
      <div className={styles.controls}>
        <label className={styles.field}>
          <span className={styles.label}>{t('topography.import.presetLabel')}</span>
          <Select onValueChange={wizard.applyPreset}>
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
          <Select value={unit} onValueChange={(v) => wizard.setUnit(v as TopoUnit)}>
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
                  <span className={styles.headLabel}>{table.headers[i] ?? t('topography.import.columnN', { n: i + 1 })}</span>
                  <Select value={role} onValueChange={(v) => wizard.setRole(i, v as ColumnRole)}>
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
            {rows.map((row, r) => (
              <tr key={r}>
                {mapping.map((_, c) => (
                  <td key={c} className={styles.cell}>{row[c] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.status}>
        {t('topography.import.previewCount', { count: wizard.points.length })}
        {wizard.skippedCount > 0 ? ` · ${t('topography.import.previewSkipped', { count: wizard.skippedCount })}` : ''}
      </p>
    </section>
  );
}
