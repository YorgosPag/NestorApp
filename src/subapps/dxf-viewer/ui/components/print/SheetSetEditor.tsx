'use client';

/**
 * ADR-651 Φάση Ι — **μαζική επεξεργασία φύλλων** (must-have #3), μέσα στον υπάρχοντα διάλογο
 * εκτύπωσης, όταν είναι ενεργό το «όλο το σετ».
 *
 * Μετά τη Φάση Θ, ό,τι είναι **κοινό** στα φύλλα (πρότυπο, στοιχεία έργου/μελετητή, σφραγίδα,
 * αναθεώρηση) αλλάζει **ήδη** παντού με μία διόρθωση ⇒ εδώ ζουν **μόνο** τα δύο πεδία που
 * διαφέρουν ανά φύλλο: **αριθμός** και **τίτλος**.
 *
 *  - **Τίτλος**: inline ανά γραμμή (είναι εξ ορισμού μοναδικός) — κενό ⇒ όνομα ορόφου.
 *  - **Αριθμός**: inline ανά γραμμή **ή** μαζική **επαναρίθμηση** των επιλεγμένων (πρόθεμα +
 *    αρχικός αριθμός) — η πράξη που όντως κάνει ο μηχανικός σε τεύχος (AutoCAD SSM «Rename &
 *    Renumber», ArchiCAD «Renumber Layouts»). Κενό ⇒ αυτόματη αρίθμηση κατά θέση.
 *
 * Μηδέν hardcoded string (N.11): όλα από `print.sheets.*`.
 *
 * @see ./useSheetSetEdits.ts — το state (pending αλλαγές + επιλογή)
 */

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { sheetNumberPrefixForLocale } from '../../../text-engine/title-block/sheet-numbering';
import { toTitleBlockLocale } from '../../../text-engine/title-block/title-block-presets';
import type { SheetRow } from '../../../text-engine/title-block/sheet-set';
import { SheetSetAiPlanner } from './SheetSetAiPlanner';
import type { UseSheetSetEditsResult } from './useSheetSetEdits';

export interface SheetSetEditorProps {
  readonly rows: readonly SheetRow[];
  readonly state: UseSheetSetEditsResult;
  readonly disabled?: boolean;
}

/** Μία γραμμή = ένα φύλλο = ένας όροφος (§5.5). */
function SheetRowFields({
  row,
  state,
  disabled,
}: {
  readonly row: SheetRow;
  readonly state: UseSheetSetEditsResult;
  readonly disabled: boolean;
}): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const values = state.valuesFor(row);

  return (
    <tr className="border-t border-border">
      <td className="py-1 pr-2">
        <Checkbox
          checked={state.selected.has(row.levelId)}
          onCheckedChange={() => state.toggleRow(row.levelId)}
          disabled={disabled}
          aria-label={t('print.sheets.selectRow', { name: row.levelName })}
        />
      </td>
      <td className="py-1 pr-2 text-sm [overflow-wrap:anywhere]">{row.levelName}</td>
      <td className="py-1 pr-2">
        <Input
          size="sm"
          className="w-24"
          value={values.sheetNumber}
          placeholder={row.autoNumber}
          onChange={(event) => state.setNumber(row.levelId, event.target.value)}
          disabled={disabled}
          aria-label={t('print.sheets.numberFor', { name: row.levelName })}
        />
      </td>
      <td className="py-1">
        <Input
          size="sm"
          value={values.title}
          placeholder={row.autoTitle}
          onChange={(event) => state.setTitle(row.levelId, event.target.value)}
          disabled={disabled}
          aria-label={t('print.sheets.titleFor', { name: row.levelName })}
        />
      </td>
    </tr>
  );
}

export function SheetSetEditor({
  rows,
  state,
  disabled = false,
}: SheetSetEditorProps): React.JSX.Element {
  const { t, i18n } = useTranslation('dxf-viewer-shell');
  const defaultPrefix = sheetNumberPrefixForLocale(toTitleBlockLocale(i18n.language));
  const [prefix, setPrefix] = React.useState(defaultPrefix);
  const [start, setStart] = React.useState('1');

  const startNumber = Number.parseInt(start, 10);
  const canRenumber =
    !disabled && state.selectedCount > 0 && Number.isFinite(startNumber) && startNumber >= 1;

  return (
    <section className="flex flex-col gap-2">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{t('print.sheets.title')}</h3>
        <p className="text-xs text-muted-foreground">{t('print.sheets.hint')}</p>
      </header>

      {/* ADR-651 Φάση Μ — «AI σετ από πρόθεση»: προτείνει επιλογή+αρίθμηση στο ΙΔΙΟ state κάτω. */}
      <SheetSetAiPlanner rows={rows} state={state} disabled={disabled} />

      <div className="max-h-56 overflow-y-auto rounded border border-border">
        <table className="w-full">
          <thead className="sticky top-0 bg-card">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="w-8 py-1 pl-2">
                <Checkbox
                  checked={state.allSelected}
                  onCheckedChange={state.toggleAll}
                  disabled={disabled || rows.length === 0}
                  aria-label={t('print.sheets.selectAll')}
                />
              </th>
              <th className="py-1 pr-2 font-medium">{t('print.sheets.sheet')}</th>
              <th className="py-1 pr-2 font-medium">{t('print.sheets.number')}</th>
              <th className="py-1 pr-2 font-medium">{t('print.sheets.sheetTitle')}</th>
            </tr>
          </thead>
          <tbody className="[&_td:first-child]:pl-2 [&_td:last-child]:pr-2">
            {rows.map((row) => (
              <SheetRowFields key={row.levelId} row={row} state={state} disabled={disabled} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="sheet-renumber-prefix" className="text-xs">
            {t('print.sheets.prefix')}
          </Label>
          <Input
            id="sheet-renumber-prefix"
            size="sm"
            className="w-20"
            value={prefix}
            onChange={(event) => setPrefix(event.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="sheet-renumber-start" className="text-xs">
            {t('print.sheets.start')}
          </Label>
          <Input
            id="sheet-renumber-start"
            size="sm"
            className="w-20"
            type="number"
            min={1}
            value={start}
            onChange={(event) => setStart(event.target.value)}
            disabled={disabled}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => state.renumber(prefix, startNumber)}
          disabled={!canRenumber}
        >
          {t('print.sheets.renumber', { count: state.selectedCount })}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={state.resetNumbers}
          disabled={disabled || state.selectedCount === 0}
        >
          {t('print.sheets.autoNumber')}
        </Button>
      </div>
    </section>
  );
}
