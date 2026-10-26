'use client';
/**
 * **Ένα κελί του πλέγματος** (ADR-923 §5.10.4 Β1).
 *
 * Μόνο το **ενεργό** κελί έχει πεδίο (Glide: ο επεξεργαστής αποδίδεται σε ένα κελί, όχι σε χιλιάδες). Το πεδίο
 * είναι **πάντα** εστιασμένο όσο το πλέγμα έχει την εστία — σε πλοήγηση διάφανο πάνω από την τιμή, όπως το
 * `<textarea>` του DXF — ώστε IME/ελληνικά/τόνοι να δουλεύουν από το πρώτο πλήκτρο και τα εγγενή `copy`/`paste`
 * να έχουν στόχο. Ευρήματα και κλειδώματα: `aria-invalid`/`aria-readonly` + περιγραφή + tooltip (όχι `title=`,
 * CHECK 3.23).
 *
 * @module components/ui/data-grid/DataGridCell
 */

import { ChevronDown, Lock } from 'lucide-react';
import { memo, type ChangeEvent, type PointerEvent, type ReactNode, type Ref } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { GridEditMode } from '@/lib/spreadsheet/grid-key-intent';
import { cn } from '@/lib/utils';

export interface DataGridCellView {
  readonly row: number;
  readonly col: number;
  readonly content: ReactNode;
  readonly align: 'start' | 'end';
  readonly sticky: boolean;
  readonly selected: boolean;
  readonly active: boolean;
  readonly lockReason: string | null;
  readonly issues: readonly string[];
  readonly hasChoices: boolean;
}

export interface DataGridCellProps {
  readonly view: DataGridCellView;
  readonly cellId: string;
  readonly label: string;
  readonly mode: GridEditMode;
  readonly draft: string;
  readonly draftIssue: string | null;
  readonly inputRef: Ref<HTMLInputElement>;
  readonly lockedWord: (reason: string) => string;
  readonly choicesWord: string;
  readonly onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onPointerDown: (cell: { row: number; col: number }, event: PointerEvent<HTMLElement>) => void;
  readonly onPointerEnter: (cell: { row: number; col: number }) => void;
  readonly onDoubleClick: (cell: { row: number; col: number }) => void;
  readonly onOpenChoices: () => void;
  readonly choices?: ReactNode;
}

function messagesOf(view: DataGridCellView, draftIssue: string | null, lockedWord: (reason: string) => string): string[] {
  const messages = [...view.issues];
  if (view.active && draftIssue) messages.unshift(draftIssue);
  if (view.lockReason) messages.push(lockedWord(view.lockReason));
  return messages;
}

function CellEditor({ props, describedBy }: { readonly props: DataGridCellProps; readonly describedBy: string | undefined }) {
  const writing = props.mode !== 'nav';
  return (
    <input
      ref={props.inputRef}
      value={writing ? props.draft : ''}
      onChange={props.onInputChange}
      aria-label={props.label}
      aria-describedby={describedBy}
      aria-invalid={props.draftIssue ? true : undefined}
      autoComplete="off"
      spellCheck={false}
      className={cn(
        'absolute inset-0 h-full w-full border-0 px-2 text-sm outline-none',
        writing ? 'bg-background text-foreground' : 'cursor-default bg-transparent text-transparent caret-transparent',
        props.view.align === 'end' && 'text-right',
      )}
    />
  );
}

function DataGridCellImpl(props: DataGridCellProps) {
  const { view } = props;
  const cell = { row: view.row, col: view.col };
  const messages = messagesOf(view, props.draftIssue, props.lockedWord);
  const describedBy = messages.length > 0 ? `${props.cellId}-note` : undefined;
  const body = (
    <span className={cn('block truncate px-2', view.lockReason && 'text-muted-foreground', view.align === 'end' && 'text-right')}>
      {view.content}
    </span>
  );
  return (
    <td
      role="gridcell"
      id={props.cellId}
      aria-colindex={view.col + 1}
      aria-selected={view.selected}
      aria-readonly={view.lockReason ? true : undefined}
      aria-invalid={view.issues.length > 0 ? true : undefined}
      aria-describedby={describedBy}
      onPointerDown={(event) => props.onPointerDown(cell, event)}
      onPointerEnter={() => props.onPointerEnter(cell)}
      onDoubleClick={() => props.onDoubleClick(cell)}
      className={cn(
        'relative h-9 select-none border-b border-r border-border p-0 align-middle text-sm',
        view.sticky && 'sticky left-0 z-[var(--z-index-docked)] bg-card',
        view.selected && 'bg-primary/10',
        view.active && 'outline outline-2 -outline-offset-2 outline-ring',
        view.issues.length > 0 && 'bg-destructive/10',
      )}
    >
      {messages.length > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>{body}</TooltipTrigger>
          <TooltipContent>{messages.join(' · ')}</TooltipContent>
        </Tooltip>
      ) : body}
      {view.lockReason ? <Lock className="absolute right-1 top-1 h-3 w-3 text-muted-foreground" aria-hidden /> : null}
      {view.active ? <CellEditor props={props} describedBy={describedBy} /> : null}
      {view.active && view.hasChoices ? (
        <button type="button" tabIndex={-1} aria-label={props.choicesWord} onClick={props.onOpenChoices}
          className="absolute right-0 top-0 z-[var(--z-index-docked)] flex h-full w-6 items-center justify-center text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
      {props.choices}
      {describedBy ? <span id={describedBy} className="sr-only">{messages.join('. ')}</span> : null}
    </td>
  );
}

export const DataGridCell = memo(DataGridCellImpl);
