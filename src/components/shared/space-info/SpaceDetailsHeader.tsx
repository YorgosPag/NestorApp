'use client';

/**
 * @fileoverview Η κεφαλίδα λεπτομερειών ενός **χώρου** (αποθήκη · θέση στάθμευσης): οι ίδιες ενέργειες, με την ίδια
 * λογική — Επεξεργασία ↔ Αποθήκευση/Ακύρωση, Επίδειξη, Νέο, Κάδος. Οι δύο κεφαλίδες την έγραφαν κατά λέξη (CHECK 3.28).
 * @related ADR-193 (επιτόπια επεξεργασία) · ADR-912 §12 (στο φύλλο κινητού οι ενέργειες ανεβαίνουν στην μπάρα του)
 * @module components/shared/space-info/SpaceDetailsHeader
 */

import type { LucideIcon } from 'lucide-react';

import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import type { EntityHeaderAction } from '@/core/entity-headers';

export interface SpaceDetailsHeaderLabels {
  readonly save: string;
  readonly saving: string;
  readonly cancel: string;
  readonly showcase: string;
  readonly create: string;
  readonly edit: string;
  readonly moveToTrash: string;
}

export interface SpaceDetailsHeaderProps {
  icon: LucideIcon;
  title: string;
  labels: SpaceDetailsHeaderLabels;
  isEditing: boolean;
  isSaving: boolean;
  onStartEdit: () => void;
  /** Η αποθήκευση ανατίθεται στη Γενική καρτέλα (`useDelegatedSave`). */
  onSave: () => void;
  onCancel: () => void;
  onNew?: () => void;
  onDelete?: () => void;
  onShowcase?: () => void;
  /** Όψη κάδου: καμία ενέργεια που αλλάζει την εγγραφή. */
  isInTrash?: boolean;
}

function spaceHeaderActions(props: SpaceDetailsHeaderProps): EntityHeaderAction[] {
  const { labels } = props;
  if (props.isEditing) {
    return [
      createEntityAction('save', labels.save, props.onSave, { pending: props.isSaving, pendingLabel: labels.saving }),
      createEntityAction('cancel', labels.cancel, props.onCancel),
    ];
  }
  if (props.isInTrash) return [];
  return [
    ...(props.onShowcase ? [createEntityAction('showcase', labels.showcase, props.onShowcase)] : []),
    createEntityAction('new', labels.create, () => props.onNew?.()),
    createEntityAction('edit', labels.edit, props.onStartEdit),
    createEntityAction('delete', labels.moveToTrash, () => props.onDelete?.()),
  ];
}

export function SpaceDetailsHeader(props: SpaceDetailsHeaderProps) {
  // ⚠️ Χωρίς `hidden md:block`: στο κινητό η κεφαλίδα ζει μέσα στο φύλλο και στέλνει τις ενέργειες στην μπάρα του.
  return (
    <EntityDetailsHeader
      icon={props.icon}
      title={props.title}
      actions={spaceHeaderActions(props)}
      variant="detailed"
    />
  );
}
