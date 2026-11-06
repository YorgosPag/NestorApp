'use client';

/**
 * @fileoverview **Η ζώνη ρίψης** — στόχοι που εμφανίζονται στο κάτω μέρος του πίνακα ΜΟΝΟ όσο σέρνεις (ADR-930 §3.11).
 * @module components/ui/sortable/kanban-dock
 *
 * 📚 Pipedrive: όσο σέρνεις μια συμφωνία εμφανίζεται κάτω μπάρα ενεργειών («Delete» · «Move to»). Εδώ η ίδια ιδέα για
 *    τα **τελικά** στάδια: «Κέρδος» / «Απώλεια» είναι πάντα ένα σύρσιμο μακριά, όσο κι αν έχει κυλήσει ο πίνακας.
 *    Σε αντίθεση με το Pipedrive, οι κλειστές στήλες ΔΕΝ εξαφανίζονται — μένουν συμπτυγμένες, με πλήθος.
 *
 * 🔑 **Πάντα στο DOM, ορατή μόνο όσο σέρνεις** (`invisible`, όχι αφαίρεση — ομαλή εμφάνιση χωρίς προσάρτηση). Εκτός
 *    συρσίματος οι στόχοι είναι `disabled` ⇒ καμία σύγκρουση· όταν ενεργοποιούνται, το `@dnd-kit` ξαναμετρά (το σύνολο
 *    των ενεργών droppables άλλαξε — `useDroppableMeasuring`, έλεγχος `containersRef.current !== containers`).
 * 🔑 **Επικάλυψη, όχι νέα γραμμή διάταξης**: καμία μετατόπιση των στηλών (CLS 0) τη στιγμή που σηκώνεται η κάρτα.
 * 🔑 Τοπικό `z-30` μέσα στο πλαίσιο του πίνακα, όχι καθολική στρώση (CHECK 3.50).
 * ♿ Το πληκτρολόγιο ΔΕΝ πηγαίνει εδώ (το ←/→ αγνοεί τη ζώνη): οι ίδιες στήλες είναι προσβάσιμες ως στήλες.
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';

import { cn } from '@/lib/utils';
import { dockTargetId } from './kanban-model';

export interface KanbanDockTarget {
  /** Η στήλη που σημαίνει η ρίψη εδώ — η ρίψη αναφέρεται ως ρίψη σε αυτή τη στήλη. */
  readonly columnId: string;
  readonly label: string;
  readonly icon?: React.ReactNode;
}

interface DockSlotProps {
  readonly target: KanbanDockTarget;
  readonly disabled: boolean;
}

function DockSlot({ target, disabled }: DockSlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dockTargetId(target.columnId), disabled });
  return (
    <li
      ref={setNodeRef}
      className={cn(
        'flex h-14 list-none items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card text-sm font-medium text-foreground shadow-lg transition-colors',
        isOver && 'border-primary bg-accent',
        disabled && 'opacity-40',
      )}
    >
      {target.icon}
      <span className="truncate">{target.label}</span>
    </li>
  );
}

interface KanbanDockProps {
  readonly targets: readonly KanbanDockTarget[];
  readonly label: string;
  /** Σέρνεται κάρτα τώρα; */
  readonly visible: boolean;
  /** Ο στόχος δεν δέχεται τη συγκεκριμένη κάρτα (ίδια στήλη, ή το `canDrop` αρνείται). */
  readonly refuses: (columnId: string) => boolean;
}

export function KanbanDock({ targets, label, visible, refuses }: KanbanDockProps) {
  return (
    <aside
      aria-label={label}
      aria-hidden={!visible || undefined}
      className={cn(
        'pointer-events-none absolute inset-x-3 bottom-5 z-30 transition-opacity motion-reduce:transition-none',
        visible ? 'opacity-100' : 'invisible opacity-0',
      )}
    >
      <ul className="m-0 grid auto-cols-fr grid-flow-col gap-3 p-0">
        {targets.map((target) => (
          <DockSlot key={target.columnId} target={target} disabled={!visible || refuses(target.columnId)} />
        ))}
      </ul>
    </aside>
  );
}
