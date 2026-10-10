/**
 * FloorsTabContent — IFC-Compliant Floor Management Tab
 *
 * Displays, creates, edits and deletes building floors (IfcBuildingStorey).
 *
 * @module components/building-management/tabs/FloorsTabContent
 * @see ADR-180 (IFC Floor Management System)
 */

'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Layers, Plus, AlertTriangle, Building2 } from 'lucide-react';
import { BuildingSpaceTabLoading, BuildingSpaceTabError } from '../shared/BuildingSpaceTabStatus';
import { BuildingSpaceTabHeader } from '../shared/BuildingSpaceTabHeader';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Building } from '@/types/building/contracts';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useContainerClass } from '@/hooks/media/useContainerClass';
import { getStatusColor } from '@/lib/design-system';
import { countBuildingStoreys, isBuildingStorey } from '@/utils/floor-naming';

// 🏢 ENTERPRISE: Extracted state hook
import { useFloorsTabState } from './useFloorsTabState';
import { FloorInlineCreateForm } from './FloorInlineCreateForm';
import { BuildingVerticalSetupForm } from './BuildingVerticalSetupForm';
import { FloorsCompactList } from './floors/FloorsCompactList';
import { FloorsTable } from './floors/FloorsTable';
import type { FloorsTabState } from './floors/floor-row-model';

// Re-export for backward compatibility
export type { FloorRecord } from './useFloorsTabState';

/**
 * Το ελάχιστο πλάτος **του περιέκτη** όπου ο πίνακας των 7 στηλών χωρά χωρίς να κοπεί (ADR-912 §5.1):
 * 40+80+128+96+80+128 = 552px σταθερές στήλες + ~120px για το όνομα ≈ 672px = 42rem. Σε rem, ώστε να ακολουθεί
 * το μέγεθος γραμματοσειράς του χρήστη (WCAG 1.4.4) και το zoom (1.4.10).
 */
export const FLOORS_TABLE_MIN_REM = 42;

interface FloorsViewProps {
  state: FloorsTabState;
  building: Building;
}

/**
 * Πίνακας ή λίστα — το αποφασίζει **ο χώρος που υπάρχει**, όχι το παράθυρο: το ίδιο πάνελ είναι στενό και σε
 * desktop με ανοιχτή πλαϊνή στήλη. Δικό του component ώστε να στήνεται **μαζί** με το στοιχείο που μετρά — ο
 * `FloorsTabContent` επιστρέφει νωρίς όσο φορτώνει, και ένας παρατηρητής στημένος εκεί δεν θα έβλεπε ποτέ το `ref`.
 * `'measuring'` (SSR · jsdom) ⇒ πίνακας, δηλαδή η συμπεριφορά πριν από το ADR-912.
 */
function FloorsView({ state, building }: FloorsViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isCompact = useContainerClass(ref, FLOORS_TABLE_MIN_REM, { zeroWidth: 'measuring' }) === 'narrow';
  return (
    <div ref={ref} className="min-w-0">
      {isCompact
        ? <FloorsCompactList state={state} building={building} />
        : <FloorsTable state={state} building={building} />}
    </div>
  );
}

interface FloorsTabContentProps {
  building: Building;
  /** BUG #5 deep-link — floor id to scroll into view and highlight on open. */
  focusFloorId?: string | null;
}

export function FloorsTabContent({ building, focusFloorId }: FloorsTabContentProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  const state = useFloorsTabState(building.id, building.projectId, focusFloorId);
  const {
    floors, loading, error, showCreateForm, setShowCreateForm, fetchFloors,
    continuityWarnings, stackConflicts, dialogProps, BlockedDialog,
  } = state;

  const existingFloorNumbers = useMemo(
    () => new Set(floors.map((f) => f.number)) as ReadonlySet<number>,
    [floors]
  );

  // ADR-461 — the manual create form reasons over COUNTED storeys only: a basement
  // may take −1 even when a foundation special occupies −1, and the elevation
  // suggestion must not anchor on a special level. The server satellite reconcile
  // then keeps the foundation always below / the penthouse always above.
  const countedFloors = useMemo(
    () => floors.filter((f) => f.kind === undefined || isBuildingStorey(f.kind)),
    [floors]
  );
  const countedFloorNumbers = useMemo(
    () => new Set(countedFloors.map((f) => f.number)) as ReadonlySet<number>,
    [countedFloors]
  );

  // ADR-451 — Quick Setup (Revit-grade building vertical setup) toggle.
  const [showQuickSetup, setShowQuickSetup] = useState(false);

  if (loading) {
    return <BuildingSpaceTabLoading />;
  }

  if (error) {
    // eslint-disable-next-line custom/no-hardcoded-strings
    return <BuildingSpaceTabError message={error} retryLabel="Retry" onRetry={fetchFloors} />;
  }

  return (
    <section className="flex flex-col gap-2 p-2">
      <ConfirmDialog {...dialogProps} />
      {BlockedDialog}

      <BuildingSpaceTabHeader icon={<Layers className="h-5 w-5 shrink-0 text-primary" />} title={t('tabs.floors.title')}>
        <Button variant="outline" size="sm" onClick={() => setShowQuickSetup((v) => !v)} disabled={showCreateForm}>
          <Building2 className="mr-1 h-4 w-4" />{t('tabs.floors.quickSetup.cta')}
        </Button>
        <Button variant="default" size="sm" onClick={() => setShowCreateForm(true)} disabled={showCreateForm || showQuickSetup}>
          <Plus className="mr-1 h-4 w-4" />{t('tabs.floors.addFloor')}
        </Button>
      </BuildingSpaceTabHeader>

      {showQuickSetup && (
        <BuildingVerticalSetupForm
          buildingId={building.id}
          projectId={building.projectId}
          existingFloorNumbers={existingFloorNumbers}
          onComplete={() => {
            setShowQuickSetup(false);
            void fetchFloors();
          }}
          onCancel={() => setShowQuickSetup(false)}
        />
      )}

      {showCreateForm && (
        <FloorInlineCreateForm
          buildingId={building.id}
          projectId={building.projectId}
          existingFloorNumbers={countedFloorNumbers}
          existingFloors={countedFloors}
          onCreated={() => {
            setShowCreateForm(false);
            void fetchFloors();
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {floors.length === 0 && !showCreateForm ? (
        <section className="text-center py-2 border-2 border-dashed rounded-lg">
          <AlertTriangle className={`${iconSizes.xl} mx-auto mb-2 text-[hsl(var(--text-warning))]`} />
          <h3 className="text-lg font-semibold mb-2">{t('tabs.floors.empty')}</h3>
          <p className={cn('text-sm mb-3', colors.text.muted)}>{t('tabs.floors.emptyHint')}</p>
          <Button variant="default" size="sm" onClick={() => setShowCreateForm(true)}>
            <Plus className={`${iconSizes.sm} mr-2`} />
            {t('tabs.floors.addFloor')}
          </Button>
        </section>
      ) : (
        <>
          <FloorsView state={state} building={building} />
          {/* Συγκρούσεις μοναδικότητας που υπάρχουν ήδη στα δεδομένα — σφάλμα προς επίλυση, όχι προειδοποίηση. */}
          {stackConflicts.length > 0 && (
            <ul className="flex flex-col gap-1" role="alert">
              {stackConflicts.map((conflict) => (
                <li key={conflict} className={cn("flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs", getStatusColor('error', 'border'), getStatusColor('error', 'text'))}>
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {conflict}
                </li>
              ))}
            </ul>
          )}
          {continuityWarnings.length > 0 && (
            <ul className="flex flex-col gap-1">
              {continuityWarnings.map((warning) => (
                <li key={warning} className={cn("flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs", getStatusColor('warning', 'border'), getStatusColor('warning', 'text'))}>
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          )}
          <footer className={cn("text-xs", colors.text.muted)}>{t('tabs.floors.total', { count: countBuildingStoreys(floors) })}</footer>
        </>
      )}
    </section>
  );
}
