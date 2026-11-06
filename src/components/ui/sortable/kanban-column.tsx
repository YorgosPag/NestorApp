'use client';

/**
 * @fileoverview **Μία στήλη του πίνακα** — ανοιχτή ή συμπτυγμένη (ADR-930 §3.11).
 * @module components/ui/sortable/kanban-column
 *
 * 🔑 **Η συμπτυγμένη στήλη ΔΕΧΕΤΑΙ ρίψη** — είναι το ίδιο droppable, απλώς στενό: ο άνθρωπος κρύβει τις κάρτες, όχι
 *    το στάδιο. Δείχνει πλήθος και ετικέτα κάθετα (Trello collapsed list / HubSpot hidden stage).
 * 🔑 **Οι υπόλοιπες στήλες φαρδαίνουν** μόνες τους: είναι `flex-1`, η συμπτυγμένη `flex-none` — αυτό που ζητούν οι
 *    χρήστες του HubSpot (εκεί ο χώρος που ελευθερώνεται μένει άδειος).
 * 🔑 Κεφαλίδα **καρφωμένη πάνω** (`sticky`) όταν ο πίνακας κυλά κάθετα ολόκληρος (Jira) — αλλιώς χάνεται το όνομα.
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ChevronsLeftRight, ChevronsRightLeft } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { KanbanColumnDef } from './KanbanBoard';

interface KanbanColumnProps {
  readonly column: KanbanColumnDef;
  readonly count: number;
  readonly refusing: boolean;
  readonly emptyLabel?: string;
  readonly className?: string;
  /** Κλάσεις της κεφαλίδας — χρειάζεται ΑΔΙΑΦΑΝΕΣ φόντο όταν είναι `sticky`, αλλιώς οι κάρτες περνούν από κάτω ορατές. */
  readonly headerClassName?: string;
  readonly sticky: boolean;
  readonly collapsed: boolean;
  /** Χωρίς αυτό η στήλη δεν συμπτύσσεται (κανένα κουμπί). */
  readonly onCollapsedChange?: (collapsed: boolean) => void;
  readonly children: React.ReactNode;
}

const TOGGLE_CLASS =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function CollapseToggle({ label, collapsed, onToggle }: { readonly label: string; readonly collapsed: boolean; readonly onToggle: () => void }) {
  const { t } = useTranslation('common-shared');
  const Icon = collapsed ? ChevronsLeftRight : ChevronsRightLeft;
  return (
    <button
      type="button"
      className={TOGGLE_CLASS}
      aria-expanded={!collapsed}
      aria-label={collapsed ? t('kanban.expand', { column: label }) : t('kanban.collapse', { column: label })}
      onClick={onToggle}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

function useColumnDrop(id: string, refusing: boolean) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: refusing });
  return { setNodeRef, dropClass: cn(isOver && 'border-primary bg-accent/40', refusing && 'opacity-40') };
}

function CollapsedColumn({ column, count, refusing, className, headerClassName, sticky, onCollapsedChange }: KanbanColumnProps) {
  const { t } = useTranslation('common-shared');
  const { setNodeRef, dropClass } = useColumnDrop(column.id, refusing);
  // Το πλάτος ΜΕΤΑ το `className` του καταναλωτή: το `min-w-[280px] flex-1` μιας ανοιχτής στήλης δεν ισχύει εδώ.
  return (
    <section
      ref={setNodeRef}
      aria-label={column.label}
      aria-disabled={refusing || undefined}
      className={cn('flex flex-col items-center rounded-lg border border-transparent transition-colors', className, 'w-11 min-w-0 flex-none p-1.5', dropClass)}
    >
      <header className={cn('flex flex-col items-center gap-2 py-1', sticky && 'sticky top-0 z-10', headerClassName)}>
        {onCollapsedChange ? <CollapseToggle label={column.label} collapsed onToggle={() => onCollapsedChange(false)} /> : null}
        <span className="text-xs font-medium tabular-nums text-muted-foreground" aria-hidden>{count}</span>
        <span className="sr-only">{t('kanban.count', { count })}</span>
        <h3 className="m-0 whitespace-nowrap text-sm font-medium text-foreground [writing-mode:vertical-rl]">{column.label}</h3>
      </header>
    </section>
  );
}

function OpenColumn({ column, count, refusing, emptyLabel, className, headerClassName, sticky, onCollapsedChange, children }: KanbanColumnProps) {
  const { setNodeRef, dropClass } = useColumnDrop(column.id, refusing);
  return (
    <section
      ref={setNodeRef}
      aria-label={column.label}
      aria-disabled={refusing || undefined}
      className={cn('flex min-w-0 flex-col gap-2 rounded-lg border border-transparent p-3 transition-colors', className, dropClass)}
    >
      {/* Δύο γραμμές (Pipedrive/HubSpot): όνομα + ↔ πάνω, ό,τι δίνει ο καταναλωτής από κάτω σε όλο το πλάτος — αλλιώς στα
          280 px τα σύνολα έτρωγαν το όνομα («Διαπρα…»). Χωρίς `column.header` (κατάλογος) η κεφαλίδα μένει μία γραμμή. */}
      <header className={cn('flex flex-wrap items-center justify-between gap-x-2', sticky && 'sticky top-0 z-10 -mx-3 -mt-3 rounded-t-lg px-3 pb-1 pt-3', headerClassName)}>
        <h3 className="m-0 min-w-0 flex-1 truncate text-sm font-medium text-foreground">{column.label}</h3>
        {onCollapsedChange ? <CollapseToggle label={column.label} collapsed={false} onToggle={() => onCollapsedChange(true)} /> : null}
        {column.header ? <div className="basis-full">{column.header}</div> : null}
      </header>
      <ul className="m-0 flex min-h-16 flex-1 flex-col gap-2 p-0">{children}</ul>
      {count === 0 && emptyLabel ? <p className="m-0 text-center text-xs text-muted-foreground">{emptyLabel}</p> : null}
    </section>
  );
}

export function KanbanColumn(props: KanbanColumnProps) {
  return props.collapsed ? <CollapsedColumn {...props} /> : <OpenColumn {...props} />;
}
