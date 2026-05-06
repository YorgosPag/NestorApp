'use client';

/**
 * ParkingQuickCreateSheet — Sheet wrapping the canonical ParkingGeneralTab in
 * create mode, identical to the creation panel in /spaces/parking.
 *
 * SSoT: uses the same ParkingGeneralTab + EntityDetailsHeader + DetailsContainer
 * pattern as ParkingPageContent (lines 335-360).
 */

import React, { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Car } from 'lucide-react';
import { DIALOG_SCROLL } from '@/styles/design-tokens';
import { DetailsContainer } from '@/core/containers';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import { ParkingGeneralTab } from '@/components/space-management/ParkingPage/ParkingDetails/tabs/ParkingGeneralTab';
import type { ParkingSpot } from '@/types/parking';

export interface ParkingQuickCreateSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly buildingId: string;
  readonly projectId: string;
  readonly onParkingCreated?: () => void;
}

export function ParkingQuickCreateSheet({
  open,
  onOpenChange,
  buildingId,
  projectId,
  onParkingCreated,
}: ParkingQuickCreateSheetProps) {
  const { t: tParking } = useTranslation('parking');
  const saveRef = useRef<(() => Promise<boolean>) | null>(null);

  const emptyParking: ParkingSpot = {
    id: '',
    number: '',
    type: 'standard',
    status: 'available',
    floor: '',
    buildingId,
    projectId: projectId || undefined,
  };

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleSave = useCallback(() => {
    saveRef.current?.();
  }, []);

  const handleCreated = useCallback(() => {
    onParkingCreated?.();
    onOpenChange(false);
  }, [onParkingCreated, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent
        side="right"
        className={cn(
          'w-[min(960px,96vw)] sm:max-w-none p-0 flex flex-col overflow-hidden',
          DIALOG_SCROLL.scrollable,
        )}
      >
        <SheetTitle className="sr-only">{tParking('header.newParking')}</SheetTitle>
        <DetailsContainer
          selectedItem={{ id: 'create' }}
          header={
            <EntityDetailsHeader
              icon={Car}
              title={tParking('header.newParking')}
              actions={[
                createEntityAction('save', tParking('form.create'), handleSave),
                createEntityAction('cancel', tParking('form.cancel'), handleClose),
              ]}
              variant="detailed"
            />
          }
          tabsRenderer={
            open ? (
              <ParkingGeneralTab
                parking={emptyParking}
                isEditing
                createMode
                onSaveRef={saveRef}
                onCreated={handleCreated}
              />
            ) : undefined
          }
        />
      </SheetContent>
    </Sheet>
  );
}
