'use client';

/**
 * =============================================================================
 * ENTERPRISE: BuildingQuickCreateSheet — SSoT building creation from any context
 * =============================================================================
 *
 * Slide-over Sheet that embeds the canonical <BuildingDetails> editor in
 * create mode. Used whenever the user needs to create a building from a
 * context other than the main /buildings page (e.g. while creating a
 * property in /spaces/properties).
 *
 * Follows the EXACT same SSoT pattern as ProjectQuickCreateSheet:
 *   - Single Source of Truth: Create = Edit. Same component, fields,
 *     validation, and save path as the main /buildings page.
 *   - Any change to the building editor applies here automatically.
 *
 * @module components/building-management/dialogs/BuildingQuickCreateSheet
 * @enterprise SSoT Extension — ADR-238 / ADR-284 (same pattern as ProjectQuickCreateSheet)
 */

import React, { useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BuildingDetails } from '@/components/building-management/BuildingDetails';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/contexts/AuthContext';
import type { Building } from '@/types/building/contracts';
import { DIALOG_SCROLL } from '@/styles/design-tokens';

const TEMP_BUILDING_ID = '__new__';

export interface BuildingQuickCreateSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Fired with the real Firestore building ID after successful creation */
  readonly onBuildingCreated?: (buildingId: string) => void;
}

export function BuildingQuickCreateSheet({
  open,
  onOpenChange,
  onBuildingCreated,
}: BuildingQuickCreateSheetProps) {
  const { t } = useTranslation('building');
  const { user } = useAuth();

  const tempBuilding = useMemo<Building | null>(() => {
    if (!open) return null;
    return {
      id: TEMP_BUILDING_ID,
      name: '',
      description: '',
      status: 'planning',
      companyId: user?.companyId ?? '',
      company: '',
      address: '',
      city: '',
      location: '',
      totalArea: 0,
      builtArea: 0,
      floors: 0,
      units: 0,
      totalValue: 0,
      progress: 0,
      projectId: '',
      createdAt: new Date().toISOString(),
    };
  }, [open, user?.companyId]);

  const handleBuildingCreated = useCallback((realBuildingId: string) => {
    onBuildingCreated?.(realBuildingId);
    onOpenChange(false);
  }, [onBuildingCreated, onOpenChange]);

  const handleCancelCreate = useCallback(() => {
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
          <SheetTitle>{t('details.addBuildingTitle')}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {tempBuilding && (
            <BuildingDetails
              building={tempBuilding}
              isCreateMode
              startInEditMode
              onBuildingCreated={handleBuildingCreated}
              onCancelCreate={handleCancelCreate}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
