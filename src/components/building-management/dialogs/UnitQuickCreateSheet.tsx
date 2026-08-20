'use client';

/**
 * UnitQuickCreateSheet — Sheet wrapping the canonical PropertiesSidebar create
 * mode, identical to the creation panel in /spaces/properties.
 *
 * SSoT: αποδίδει την **ίδια** {@link PropertyDetailSurface} με τη δεξιά στήλη και
 * με την καρτέλα ακινήτου, σε λειτουργία δημιουργίας — χωρίς τη λίστα, που δεν
 * έχει νόημα μέσα σε συρτάρι.
 *
 * ⚠️ **Το σχόλιο αυτό έλεγε «renders DetailsContainer + PropertyDetailsHeader +
 * UniversalTabsRenderer exactly as PropertiesSidebar does»** — και ήταν αληθές με
 * τον χειρότερο τρόπο: τα έστηνε **ξεχωριστά**, «ακριβώς όπως» το άλλο αρχείο.
 * Το «ακριβώς όπως» δεν είναι εγγύηση, είναι ευχή (ADR-777 §8.30).
 */

import React, { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { DIALOG_SCROLL } from '@/styles/design-tokens';
/**
 * 🔑 **Το ΤΡΙΤΟ σημείο προσάρτησης της ίδιας επιφάνειας** (ADR-777 §8.30). Η
 * δημιουργία μονάδας δείχνει **ακριβώς** τις καρτέλες που δείχνει η καρτέλα
 * ακινήτου, πάνω σε κενό ακίνητο — άρα δεν είναι δεύτερη σύνθεση, είναι η ίδια
 * με άλλο περιεχόμενο. Πριν το §8.30 έστηνε **η ίδια** τα ~30 σύρματα
 * (`additionalData`, χαρτογράφηση, ρυθμιστής καρτελών): η ημέρα που ο ένας από
 * τους τρεις θα άλλαζε, οι άλλοι δύο θα έμεναν πίσω **φαινομενικά σωστοί**.
 */
import { PropertyDetailSurface } from '@/features/property-detail-surface/PropertyDetailSurface';
import type { Property } from '@/types/property-viewer';
import type { FloorData, ViewerPassthroughProps } from '@/features/properties-sidebar/types';
import type { Building } from '@/types/building/contracts';
import type { FloorRecord } from '@/components/building-management/tabs/property-tab-constants';

export interface UnitQuickCreateSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly building: Building;
  readonly floors: FloorRecord[];
  readonly onCreated?: () => void;
}

const NOOP_UPDATE = async () => {};
/** Το συρτάρι δημιουργίας δεν έχει πάνελ ιστορικού, ούτε εναλλαγή επεξεργασίας:
 *  γεννιέται **μέσα** στην επεξεργασία και βγαίνει μόνο κλείνοντας. */
const NOOP_SHOW_HISTORY = () => {};
const NOOP_TOGGLE_EDIT = () => {};

export function UnitQuickCreateSheet({
  open,
  onOpenChange,
  building,
  floors,
  onCreated,
}: UnitQuickCreateSheetProps) {
  const { t } = useTranslation('building');
  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleCreated = useCallback(() => {
    onCreated?.();
    onOpenChange(false);
  }, [onCreated, onOpenChange]);

  const blankUnit = useMemo<Property>(() => ({
    id: '__new__',
    name: '',
    type: '',
    // SSoT default: a blank unit is `unavailable` (not on market), never reserved.
    status: 'unavailable',
    operationalStatus: 'draft',
    floor: 0,
    area: 0,
    layout: { bedrooms: 0, bathrooms: 0, wc: 0 },
    areas: { gross: 0 },
    orientations: [],
    buildingId: building.id,
    floorId: '',
    projectId: building.projectId || '',
    vertices: [],
    building: building.name || '',
    project: '',
  }), [building.id, building.projectId, building.name]);

  const floorData = useMemo<FloorData[]>(
    () => floors.map(f => ({
      id: f.id,
      name: f.name,
      level: f.number,
      buildingId: building.id,
      properties: [],
    })),
    [floors, building.id],
  );

  const minimalViewerProps = useMemo<ViewerPassthroughProps>(
    () => ({ properties: [], handleUpdateProperty: NOOP_UPDATE }),
    [],
  );

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent
        side="right"
        className={cn(
          'w-[min(960px,96vw)] sm:max-w-none p-0 flex flex-col overflow-hidden',
          DIALOG_SCROLL.scrollable,
        )}
      >
        <SheetTitle className="sr-only">{t('details.addUnitTitle')}</SheetTitle>
        {/*
          ⚠️ **Η φρουρά `open` διατηρείται αυτούσια.** Δεν είναι διακοσμητική: οι
          έξι καρτέλες στήνουν φορτωτές εγγράφων, φωτογραφιών και ιστορικού, και
          ένα συρτάρι που ζει κλειστό σε κάθε σελίδα κτιρίου θα τους έστηνε χωρίς
          να τους ζητήσει κανείς.
        */}
        {open ? (
          <PropertyDetailSurface
            property={blankUnit}
            units={[]}
            viewerProps={minimalViewerProps}
            floors={floorData}
            setShowHistoryPanel={NOOP_SHOW_HISTORY}
            isEditMode
            onToggleEditMode={NOOP_TOGGLE_EDIT}
            onExitEditMode={handleClose}
            isCreatingNewUnit
            onPropertyCreated={handleCreated}
            defaultTab="info"
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
