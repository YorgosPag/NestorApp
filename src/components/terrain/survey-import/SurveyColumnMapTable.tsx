'use client';

/**
 * @fileoverview **Ποια στήλη είναι το Χ, ποια το υψόμετρο** — ο πίνακας αντιστοίχισης στηλών κάθε δρόμου εισαγωγής
 * τοπογραφικού: CSV/TXT και νέφος ASCII στον DXF Viewer (ADR-650 M2 · M8β/Δ), αγγελία οικοπέδου (ADR-920 Β4.9).
 * @related lib/terrain/survey-import/topo-mapping-edit (`assignRole` · `padMapping` — η λογική) ·
 *   lib/terrain/survey-import/topo-order-presets (οι έτοιμες σειρές) · ./SurveyUnitSelect
 * @module components/terrain/survey-import/SurveyColumnMapTable
 *
 * 🔑 **Μετακόμισε από τον viewer** (`TopoColumnMapTable`) όταν η αγγελία χρειάστηκε την ίδια ερώτηση: δύο πίνακες θα
 *   απέκλιναν, και τη μέρα που ο ένας σταματούσε να προσφέρει `pointId` ένα PENZD θα διαβαζόταν σιωπηλά ως XYZ (N.18).
 * 🔑 **Μόνο παρουσίαση** — καμία κατάσταση. Θεματικά tokens (ισχύει και στα δύο θέματα — ο παλιός πίνακας είχε λευκά
 *   διάφανα περιγράμματα, αόρατα στο φωτεινό) · κείμενο ≥ 12 px (ADR-907 §11.14).
 */

import React from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ColumnMapping, ColumnRole, TopoUnit } from '@/lib/terrain/survey-import/topo-import-types';
import { TOPO_ORDER_PRESETS } from '@/lib/terrain/survey-import/topo-order-presets';

import { SurveyUnitSelect } from './SurveyUnitSelect';

/** Οι ρόλοι ανά στήλη, με τη σειρά που σκέφτεται ένας τοπογράφος. */
const ROLES: readonly ColumnRole[] = ['x', 'y', 'z', 'code', 'pointId', 'ignore'];

/** Πόσες γραμμές δεδομένων δείχνει — αρκετές για να αναγνωριστεί το αρχείο, ποτέ τόσες που να χαθεί η κεφαλίδα. */
const PREVIEW_ROWS = 8;

const NS = 'terrain-survey:columns';

export interface SurveyColumnMapTableProps {
  /** Οι ετικέτες των στηλών όταν το αρχείο είχε επικεφαλίδα· κενό αλλιώς (ένα νέφος δεν έχει ποτέ). */
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly mapping: ColumnMapping;
  readonly unit: TopoUnit | null;
  readonly disabled?: boolean;
  readonly onRole: (columnIndex: number, role: ColumnRole) => void;
  readonly onPreset: (presetId: string) => void;
  readonly onUnit: (unit: TopoUnit) => void;
}

function RoleSelect({ label, role, disabled, onRole }: {
  /** Το όνομα της στήλης για τον αναγνώστη οθόνης — το dropdown μέσα σε κεφαλίδα δεν έχει δική του ετικέτα. */
  readonly label: string;
  readonly role: ColumnRole;
  readonly disabled: boolean;
  readonly onRole: (role: ColumnRole) => void;
}) {
  const { t } = useTranslation('terrain-survey');
  const choose = (value: string) => {
    const picked = ROLES.find((candidate) => candidate === value);
    if (picked !== undefined) onRole(picked);
  };
  return (
    <Select value={role} onValueChange={choose} disabled={disabled}>
      <SelectTrigger size="sm" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        {ROLES.map((candidate) => (
          <SelectItem key={candidate} value={candidate}>{t(`${NS}.role.${candidate}`)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PresetSelect({ disabled, onPreset }: { readonly disabled: boolean; readonly onPreset: (id: string) => void }) {
  const { t } = useTranslation('terrain-survey');
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{t(`${NS}.presetLabel`)}</span>
      <Select onValueChange={onPreset} disabled={disabled}>
        <SelectTrigger size="sm"><SelectValue placeholder={t(`${NS}.presetPlaceholder`)} /></SelectTrigger>
        <SelectContent>
          {TOPO_ORDER_PRESETS.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>{t(`${NS}.preset.${preset.id}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function SurveyColumnMapTable(props: SurveyColumnMapTableProps) {
  const { headers, rows, mapping, unit, disabled = false, onRole, onPreset, onUnit } = props;
  const { t } = useTranslation('terrain-survey');
  const columnName = (column: number) => headers[column] ?? t(`${NS}.columnN`, { n: column + 1 });
  return (
    <>
      <fieldset className="m-0 flex flex-wrap gap-3 border-0 p-0">
        <PresetSelect disabled={disabled} onPreset={onPreset} />
        <SurveyUnitSelect unit={unit} disabled={disabled} onUnit={onUnit} />
      </fieldset>
      <section className="max-h-80 overflow-auto rounded border border-border" aria-label={t(`${NS}.caption`)}>
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">{t(`${NS}.caption`)}</caption>
          <thead>
            <tr>
              {mapping.map((role, column) => (
                <th key={column} scope="col" className="sticky top-0 bg-muted p-1.5 text-left align-top font-semibold">
                  <span className="mb-1 block truncate">{columnName(column)}</span>
                  <RoleSelect label={t(`${NS}.roleOf`, { column: columnName(column) })} role={role} disabled={disabled} onRole={(next) => onRole(column, next)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, PREVIEW_ROWS).map((row, index) => (
              <tr key={index}>
                {mapping.map((_, column) => (
                  <td key={column} className="whitespace-nowrap border-t border-border px-1.5 py-1 tabular-nums">
                    {row[column] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
