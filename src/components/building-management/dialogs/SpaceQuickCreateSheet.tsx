'use client';

/**
 * SpaceQuickCreateSheet — το ΚΕΛΥΦΟΣ της γρήγορης δημιουργίας χώρου (θέση · αποθήκη)
 *
 * Sheet + `EntityDetailsHeader` (αποθήκευση · ακύρωση) + `DetailsContainer` γύρω από τη Γενική
 * καρτέλα του χώρου σε κατάσταση δημιουργίας. Ήταν **δύο** σχεδόν ίδια αρχεία
 * (`ParkingQuickCreateSheet` / `StorageQuickCreateSheet`)· το `jscpd:diff` (CHECK 3.28) τα έπιασε
 * όταν η ADR-777 §8.60.20 άγγιξε και τα δύο. Κάθε χώρος δίνει πλέον μόνο ό,τι είναι δικό του:
 * εικονίδιο, ετικέτες και τη φόρμα.
 *
 * @module components/building-management/dialogs/SpaceQuickCreateSheet
 */

import React, { useRef, useCallback, type MutableRefObject } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { DIALOG_SCROLL } from '@/styles/design-tokens';
import { DetailsContainer } from '@/core/containers';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';

/** Ό,τι παίρνει η φόρμα του χώρου από το κέλυφος. */
export interface SpaceQuickCreateForm {
  readonly saveRef: MutableRefObject<(() => Promise<boolean>) | null>;
  readonly onCreated: () => void;
}

export interface SpaceQuickCreateSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly icon: LucideIcon;
  /** Ήδη μεταφρασμένα. */
  readonly labels: { readonly title: string; readonly save: string; readonly cancel: string };
  /** Μετά την επιτυχή δημιουργία — πριν κλείσει το φύλλο. */
  readonly onCreated?: () => void;
  readonly renderForm: (form: SpaceQuickCreateForm) => React.ReactNode;
}

export function SpaceQuickCreateSheet({
  open,
  onOpenChange,
  icon,
  labels,
  onCreated,
  renderForm,
}: SpaceQuickCreateSheetProps) {
  const saveRef = useRef<(() => Promise<boolean>) | null>(null);

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);
  const handleSave = useCallback(() => {
    saveRef.current?.();
  }, []);
  const handleCreated = useCallback(() => {
    onCreated?.();
    onOpenChange(false);
  }, [onCreated, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent
        side="right"
        className={cn(
          'w-[min(960px,96vw)] sm:max-w-none p-0 flex flex-col overflow-hidden',
          DIALOG_SCROLL.scrollable,
        )}
      >
        <SheetTitle className="sr-only">{labels.title}</SheetTitle>
        <DetailsContainer
          selectedItem={{ id: 'create' }}
          header={
            <EntityDetailsHeader
              icon={icon}
              title={labels.title}
              actions={[
                createEntityAction('save', labels.save, handleSave),
                createEntityAction('cancel', labels.cancel, handleClose),
              ]}
              variant="detailed"
            />
          }
          tabsRenderer={open ? renderForm({ saveRef, onCreated: handleCreated }) : undefined}
        />
      </SheetContent>
    </Sheet>
  );
}
