'use client';

import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PropertyInlineCreateForm } from '@/components/building-management/tabs/PropertyInlineCreateForm';
import { DIALOG_SCROLL } from '@/styles/design-tokens';
import type { FloorRecord } from '@/components/building-management/tabs/property-tab-constants';

export interface UnitQuickCreateSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly buildingId: string;
  readonly buildingName: string;
  readonly projectId: string;
  readonly floors: FloorRecord[];
  readonly onCreated?: () => void;
}

export function UnitQuickCreateSheet({
  open,
  onOpenChange,
  buildingId,
  buildingName,
  projectId,
  floors,
  onCreated,
}: UnitQuickCreateSheetProps) {
  const { t } = useTranslation('building');

  const handleCreated = useCallback(() => {
    onCreated?.();
    onOpenChange(false);
  }, [onCreated, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'w-[min(960px,96vw)] sm:max-w-none p-0 flex flex-col',
          DIALOG_SCROLL.scrollable,
        )}
      >
        <SheetHeader className="p-4 border-b">
          <SheetTitle>{t('details.addUnitTitle')}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {open && (
            <PropertyInlineCreateForm
              buildingId={buildingId}
              buildingName={buildingName}
              projectId={projectId}
              floors={floors}
              onCreated={handleCreated}
              onCancel={handleCancel}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
