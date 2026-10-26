'use client';
/**
 * =============================================================================
 * 🏢 ΓΕΝΙΚΟ ΠΛΕΓΜΑ ΔΕΔΟΜΕΝΩΝ — WAI-ARIA APG grid · Excel · Glide (ADR-923 §5.10.4 Β1)
 * =============================================================================
 *
 * Πληκτρολόγιο του Excel (βέλη · Tab/Enter με στήλη αγκύρωσης · Ctrl+βέλη στην άκρη των δεδομένων · Shift επέκταση ·
 * F2 · Esc δύο σταδίων · Delete · Ctrl+D · Ctrl+Z/Y · Ctrl+A), **εγγενές** πρόχειρο TSV (επικόλληση από Excel με
 * πλακίδια και νέες γραμμές), ευρήματα ανά κελί, κλειδωμένα (κληρονομημένα) κελιά, virtualization με `aria-rowindex`.
 *
 * 🔑 Δεν κρατά δεδομένα: `rows` μέσα, **μία** `onChange` ανά ενέργεια έξω (ο καταναλωτής γράφει ιστορικό, κρίνει).
 * 🔑 Δεν φέρνει λέξεις: `words` από τον καλούντα (κανένα κόστος στο κέλυφος i18n).
 *
 * @module components/ui/data-grid/DataGrid
 * @see lib/spreadsheet — ο καθαρός πυρήνας (κίνηση · επιλογή · πρόθεση πλήκτρων · σχέδιο επικόλλησης · ιστορικό)
 */

import { useCallback, useEffect, useId, useRef, type FocusEvent, type ReactNode, type Ref } from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { rangeContains, rangeOfSelection } from '@/lib/spreadsheet/grid-selection';
import { cn } from '@/lib/utils';

import { DataGridCell, type DataGridCellView } from './DataGridCell';
import type { DataGridColumn, DataGridProps, DataGridWidth } from './data-grid-types';
import { useDataGrid, type DataGridController } from './use-data-grid';
import { useGridHandlers, type GridHandlers } from './use-grid-handlers';
import { useGridVirtualRows } from './use-grid-virtual-rows';

/** Πλάτη στηλών ως κλάσεις — ο πίνακας είναι `table-fixed`. */
export const DATA_GRID_WIDTH_CLASS: Readonly<Record<DataGridWidth, string>> = {
  xs: 'w-20',
  sm: 'w-28',
  md: 'w-40',
  lg: 'w-56',
  xl: 'w-72',
};

function ChoicesFor<Row>({ column, row, grid, handlers }: {
  readonly column: DataGridColumn<Row>;
  readonly row: Row;
  readonly grid: DataGridController<Row>;
  readonly handlers: GridHandlers;
}) {
  const choices = (column.choices?.(row) ?? []).filter((choice) => choice.text !== '');
  const current = column.text(row);
  return (
    <Select open={grid.choicesOpen} onOpenChange={(open) => { grid.setChoicesOpen(open); if (!open) grid.inputRef.current?.focus(); }}
      value={choices.some((choice) => choice.text === current) ? current : undefined} onValueChange={handlers.choose}>
      <SelectTrigger tabIndex={-1} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-0" />
      <SelectContent>
        {choices.map((choice) => <SelectItem key={choice.text} value={choice.text}>{choice.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function cellView<Row>(props: DataGridProps<Row>, grid: DataGridController<Row>, row: Row, index: number, col: number): DataGridCellView {
  const column = props.columns[col];
  const { selection } = grid.state;
  return {
    row: index,
    col,
    content: column.render ? column.render(row) : column.text(row),
    align: column.align ?? 'start',
    sticky: column.sticky === true,
    selected: rangeContains(rangeOfSelection(selection), { row: index, col }),
    active: selection.cursor.row === index && selection.cursor.col === col,
    lockReason: column.parse ? column.lock?.(row)?.reason ?? null : null,
    issues: props.issuesOf?.(row, index, column.id) ?? [],
    hasChoices: column.choices !== undefined && props.onChange !== undefined,
  };
}

function GridRow<Row>({ props, grid, handlers, row, index, gridId, attachInput }: {
  readonly props: DataGridProps<Row>;
  readonly grid: DataGridController<Row>;
  readonly handlers: GridHandlers;
  readonly row: Row;
  readonly index: number;
  readonly gridId: string;
  readonly attachInput: Ref<HTMLInputElement>;
}) {
  const tone = props.rowTone?.(row, index) ?? null;
  return (
    <tr aria-rowindex={index + 2} data-tone={tone ?? undefined}
      className={cn(tone === 'new' && 'bg-primary/5', tone === 'muted' && 'text-muted-foreground')}>
      {props.columns.map((column, col) => {
        const view = cellView(props, grid, row, index, col);
        return (
          <DataGridCell key={column.id} view={view} cellId={`${gridId}-${index}-${col}`} label={column.label}
            mode={grid.state.mode} draft={grid.state.draft} draftIssue={view.active ? grid.state.draftIssue : null}
            inputRef={attachInput} lockedWord={props.words.locked} choicesWord={props.words.choicesLabel(column.label)}
            onInputChange={handlers.onInputChange} onPointerDown={handlers.onCellPointerDown}
            onPointerEnter={handlers.onCellPointerEnter} onDoubleClick={handlers.onCellDoubleClick}
            onOpenChoices={() => grid.setChoicesOpen(true)}
            choices={view.active && view.hasChoices ? <ChoicesFor column={column} row={row} grid={grid} handlers={handlers} /> : null} />
        );
      })}
    </tr>
  );
}

/**
 * **Η εστία ακολουθεί το πεδίο του ενεργού κελιού.** Κάθε νέο πεδίο εστιάζεται κατά την προσάρτηση· όταν αφαιρεθεί
 * (ο δρομέας βγήκε από το παράθυρο της virtualization) την κρατά ο **πίνακας** — αλλιώς θα έπεφτε σιωπηλά στο
 * `body` (ο Chromium δεν στέλνει `blur` για στοιχείο που αφαιρείται) και το πληκτρολόγιο θα «πέθαινε».
 */
function useInputAttachment<Row>(grid: DataGridController<Row>) {
  const tableRef = useRef<HTMLTableElement | null>(null);
  const attachInput = useCallback((node: HTMLInputElement | null) => {
    grid.inputRef.current = node;
    if (!grid.hasFocus.current) return;
    if (node) node.focus({ preventScroll: true });
    else tableRef.current?.focus({ preventScroll: true });
  }, [grid]);
  return { tableRef, attachInput };
}

/** Η εστία έφυγε από το πλέγμα; Κρίνεται **αφού** ηρεμήσει το DOM: η αφαίρεση του πεδίου δεν είναι «έφυγε». */
function useLeaveDetection<Row>(grid: DataGridController<Row>) {
  return useCallback((event: FocusEvent<HTMLTableElement>) => {
    const table = event.currentTarget;
    if (event.relatedTarget instanceof Node && table.contains(event.relatedTarget)) return;
    queueMicrotask(() => {
      if (table.contains(document.activeElement)) return;
      grid.hasFocus.current = false;
      grid.commitOnLeave();
    });
  }, [grid]);
}

export function DataGrid<Row>(props: DataGridProps<Row>): ReactNode {
  const virtualRows = useGridVirtualRows(props.rows.length);
  const grid = useDataGrid(props, virtualRows.pageRows);
  const handlers = useGridHandlers(grid, props);
  const onBlur = useLeaveDetection(grid);
  const { tableRef, attachInput } = useInputAttachment(grid);
  const gridId = useId();
  const cursorRow = grid.state.selection.cursor.row;
  const { reveal } = virtualRows;
  useEffect(() => { if (grid.hasFocus.current) reveal(cursorRow); }, [cursorRow, reveal, grid.hasFocus]);

  return (
    <section className={cn('flex min-h-0 flex-col', props.className)} onPointerUp={handlers.onPointerUp}>
      {/* `contain: inline-size`: το φαρδύ table ΔΕΝ δηλώνει το min-content πλάτος του στους προγόνους (grid items με
          `min-width:auto` φούσκωναν και έσπρωχναν τα κουμπιά της κεφαλίδας έξω από την οθόνη) — κυλά μέσα του. */}
      <div ref={virtualRows.scrollRef} className="min-h-0 overflow-auto rounded-md border border-border [contain:inline-size]">
        <table ref={tableRef} role="grid" aria-label={props.label} aria-rowcount={props.rows.length + 1} aria-colcount={props.columns.length}
          aria-multiselectable aria-readonly={props.onChange ? undefined : true} tabIndex={-1}
          onKeyDown={handlers.onKeyDown} onCopy={handlers.onCopy} onCut={handlers.onCut} onPaste={handlers.onPaste}
          onFocus={() => { grid.hasFocus.current = true; }} onBlur={onBlur}
          className="w-full table-fixed border-separate border-spacing-0 outline-none">
          <colgroup>{props.columns.map((column) => <col key={column.id} className={DATA_GRID_WIDTH_CLASS[column.width]} />)}</colgroup>
          <thead>
            <tr aria-rowindex={1}>
              {props.columns.map((column, col) => (
                <th key={column.id} role="columnheader" scope="col" aria-colindex={col + 1}
                  className={cn('sticky top-0 z-[var(--z-index-docked)] h-9 border-b border-r border-border bg-muted px-2 text-left text-xs font-medium text-muted-foreground',
                    column.sticky && 'left-0', column.align === 'end' && 'text-right')}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {virtualRows.virtual ? <tr ref={virtualRows.topSpacerRef} aria-hidden /> : null}
            {virtualRows.indexes.map((index) => {
              const row = props.rows[index];
              return row === undefined ? null : (
                <GridRow key={props.rowKey(row, index)} props={props} grid={grid} handlers={handlers} row={row} index={index} gridId={gridId} attachInput={attachInput} />
              );
            })}
            {virtualRows.virtual ? <tr ref={virtualRows.bottomSpacerRef} aria-hidden /> : null}
          </tbody>
        </table>
        {props.rows.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">{props.words.empty}</p> : null}
      </div>
      <p aria-live="polite" className="sr-only">{grid.announcement}</p>
    </section>
  );
}
