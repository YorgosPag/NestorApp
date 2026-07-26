'use client';

/**
 * @module chart-card/editor/ChartCardEditor
 * @enterprise ADR-710 — The chrome of a chart card's entry form.
 *
 * Supplies the parts of an entry form that are the same everywhere — the disclosure,
 * the field grid, the row grid, the action bar, the pending label on the submit
 * button, the destructive row control — and knows nothing about fields. Each chart
 * still declares its own inputs, because a project's budget categories and a loan's
 * terms are not the same form and pretending otherwise would only move the difference
 * into a schema prop.
 *
 * The two shapes in use today compose from the same parts:
 *
 * - a **row list** (`Rows` / `RowHeader` / `Row` / `AddRow`) for editing many
 *   like-shaped records at once — `BudgetVarianceChart`
 * - a **disclosure over a field grid** (`Disclosure` / `Grid` / `Field`) for adding
 *   one record — `DebtMaturityWall`
 *
 * Layout contract: `Row` and `RowHeader` are 12-column grids. Cells declare their own
 * span (`col-span-4`) and should sum to 12, the same contract as any column grid.
 */

import { useCallback, useState, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';

// =============================================================================
// ROOT
// =============================================================================

export interface ChartCardEditorProps {
  readonly children: ReactNode;
}

function ChartCardEditorRoot({ children }: ChartCardEditorProps) {
  return <section className="space-y-4">{children}</section>;
}

// =============================================================================
// DISCLOSURE — collapsed trigger ⇄ expanded form
// =============================================================================

export interface ChartCardEditorDisclosureProps {
  /** Label of the collapsed trigger. */
  readonly triggerLabel: string;
  /**
   * The expanded form. A render prop rather than a node so the form can close itself
   * on a successful submit without the caller lifting the open state.
   */
  readonly children: (close: () => void) => ReactNode;
}

function ChartCardEditorDisclosure({
  triggerLabel,
  children,
}: ChartCardEditorDisclosureProps) {
  const [open, setOpen] = useState(false);
  const iconSizes = useIconSizes();
  const close = useCallback(() => setOpen(false), []);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
        {triggerLabel}
      </Button>
    );
  }

  return <>{children(close)}</>;
}

// =============================================================================
// FIELD GRID — single-record forms
// =============================================================================

function ChartCardEditorGrid({ children }: { readonly children: ReactNode }) {
  return (
    <section className="grid w-full grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-4">
      {children}
    </section>
  );
}

/** One labelled cell of the field grid. */
function ChartCardEditorField({ children }: { readonly children: ReactNode }) {
  return <fieldset className="space-y-1">{children}</fieldset>;
}

// =============================================================================
// ROW LIST — many-record forms
// =============================================================================

function ChartCardEditorRows({ children }: { readonly children: ReactNode }) {
  return <section className="space-y-2">{children}</section>;
}

/**
 * Column names for the row list. These name the cells below them, so row inputs are
 * labelled by reference rather than repeating a placeholder in every row.
 */
function ChartCardEditorRowHeader({ children }: { readonly children: ReactNode }) {
  return (
    <header className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-muted-foreground">
      {children}
    </header>
  );
}

function ChartCardEditorRow({ children }: { readonly children: ReactNode }) {
  return <fieldset className="grid grid-cols-12 items-center gap-2">{children}</fieldset>;
}

export interface ChartCardEditorAddRowProps {
  readonly label: string;
  readonly onClick: () => void;
}

function ChartCardEditorAddRow({ label, onClick }: ChartCardEditorAddRowProps) {
  const iconSizes = useIconSizes();
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <Plus className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
      {label}
    </Button>
  );
}

export interface ChartCardEditorRemoveProps {
  /** Names *what* is removed, for anyone who cannot see the row it sits in. */
  readonly label: string;
  readonly onClick: () => void;
  readonly className?: string;
}

function ChartCardEditorRemove({ label, onClick, className }: ChartCardEditorRemoveProps) {
  const iconSizes = useIconSizes();
  return (
    <Button variant="ghost" size="sm" className={className} onClick={onClick} aria-label={label}>
      <Trash2 className={iconSizes.sm} aria-hidden="true" />
    </Button>
  );
}

// =============================================================================
// ACTIONS
// =============================================================================

export interface ChartCardEditorActionsProps {
  readonly children: ReactNode;
  /** Span, when the action bar sits inside a `Grid` (`col-span-2 md:col-span-4`). */
  readonly className?: string;
}

function ChartCardEditorActions({ children, className }: ChartCardEditorActionsProps) {
  return <fieldset className={cn('flex items-end gap-2', className)}>{children}</fieldset>;
}

export interface ChartCardEditorSubmitProps {
  readonly label: string;
  /** A write is in flight — the control disables itself and announces the wait. */
  readonly pending: boolean;
  readonly onClick: () => void;
}

/**
 * The submit control. Owns what "in flight" looks like, which both migrated cards
 * spelled out for themselves as a bare `'…'`, with no accessible announcement.
 */
function ChartCardEditorSubmit({ label, pending, onClick }: ChartCardEditorSubmitProps) {
  const { t } = useTranslation('common');
  return (
    <Button size="sm" onClick={onClick} disabled={pending} aria-busy={pending}>
      {pending ? t('chart.saving') : label}
    </Button>
  );
}

export interface ChartCardEditorCancelProps {
  readonly label: string;
  readonly onClick: () => void;
}

function ChartCardEditorCancel({ label, onClick }: ChartCardEditorCancelProps) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      {label}
    </Button>
  );
}

// =============================================================================
// COMPOUND SURFACE
// =============================================================================

export const ChartCardEditor = Object.assign(ChartCardEditorRoot, {
  Disclosure: ChartCardEditorDisclosure,
  Grid: ChartCardEditorGrid,
  Field: ChartCardEditorField,
  Rows: ChartCardEditorRows,
  RowHeader: ChartCardEditorRowHeader,
  Row: ChartCardEditorRow,
  AddRow: ChartCardEditorAddRow,
  Remove: ChartCardEditorRemove,
  Actions: ChartCardEditorActions,
  Submit: ChartCardEditorSubmit,
  Cancel: ChartCardEditorCancel,
});
