'use client';
/* eslint-disable custom/no-hardcoded-strings */

/**
 * @fileoverview Sales Parking Sidebar — ADR-199
 * @description List + Details sidebar for parking sales
 * @pattern Mirrors SalesSidebar with parking-specific components
 */

import React from 'react';
import { Car, DollarSign, Clock, FileText, Camera, Video, ExternalLink } from 'lucide-react';
import { EntityListColumn, DetailsContainer } from '@/core/containers';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { SalesParkingCard } from '@/components/sales/cards/SalesParkingCard';
import { ParkingQuickFilters } from '@/components/sales/filters/ParkingQuickFilters';
import { ParkingDetailPanel } from '@/components/sales/details/ParkingDetailPanel';
import { EntityDetailsHeader } from '@/core/entity-headers';
import type { EntityHeaderAction } from '@/core/entity-headers';
import { ActivityTab } from '@/components/shared/audit/ActivityTab';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIsMobile } from '@/hooks/useMobile';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { ParkingSpot } from '@/types/parking';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SalesParkingSidebarProps {
  items: ParkingSpot[];
  selectedItem: ParkingSpot | null;
  onSelectItem: (id: string) => void;
  selectedItemId: string | null;
  selectedStatus: string;
  onStatusChange: (s: string) => void;
  selectedType: string;
  onTypeChange: (t: string) => void;
}

// =============================================================================
// 🏢 TAB CONFIG
// =============================================================================

const TABS = [
  { id: 'info', icon: DollarSign, labelKey: 'salesParking.tabs.info', defaultLabel: 'Πληροφορίες' },
  { id: 'documents', icon: FileText, labelKey: 'salesParking.tabs.documents', defaultLabel: 'Έγγραφα' },
  { id: 'photos', icon: Camera, labelKey: 'salesParking.tabs.photos', defaultLabel: 'Φωτογραφίες' },
  { id: 'videos', icon: Video, labelKey: 'salesParking.tabs.videos', defaultLabel: 'Βίντεο' },
  { id: 'history', icon: Clock, labelKey: 'salesParking.tabs.history', defaultLabel: 'Ιστορικό' },
] as const;

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SalesParkingSidebar({
  items,
  selectedItem,
  onSelectItem,
  selectedItemId,
  selectedStatus,
  onStatusChange,
  selectedType,
  onTypeChange,
}: SalesParkingSidebarProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('common');
  const isMobile = useIsMobile();
  const iconSizes = useIconSizes();

  // =========================================================================
  // Details Header Actions
  // =========================================================================
  const actions = React.useMemo<EntityHeaderAction[]>(() => {
    if (!selectedItem) return [];
    return [];
  }, [selectedItem]);

  // =========================================================================
  // Details Content
  // =========================================================================
  const detailsContent = selectedItem ? (
    <DetailsContainer
      selectedItem={selectedItem}
      header={
        <EntityDetailsHeader
          icon={Car}
          title={selectedItem.number || selectedItem.id}
          subtitle={selectedItem.floor ? `${t('parking:general.fields.floor', { defaultValue: 'Επίπεδο' })}: ${selectedItem.floor}` : undefined}
          variant="detailed"
          actions={actions}
        />
      }
      tabsRenderer={
        <Tabs defaultValue="info" className="flex flex-col">
          <TabsList className="flex flex-wrap gap-1 w-full h-auto min-h-fit flex-shrink-0">
            {TABS.map(tab => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1 text-xs font-medium"
              >
                <tab.icon className={iconSizes.sm} />
                <span className="hidden sm:inline">
                  {t(tab.labelKey, { defaultValue: tab.defaultLabel })}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="info" className="flex-1">
            <ParkingDetailPanel data={selectedItem} />
          </TabsContent>

          {/* Documents, Photos, Videos → redirect to /spaces/parking */}
          {(['documents', 'photos', 'videos'] as const).map(tabId => (
            <TabsContent key={tabId} value={tabId} className="flex-1">
              <section className="p-4">
                <p className={cn("text-sm text-center mb-3", colors.text.muted)}>
                  {t(`salesParking.tabs.${tabId}Hint`, { defaultValue: `Διαχείριση στη σελίδα Χώροι → Στάθμευση` })}
                </p>
                <div className="pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center gap-2 text-sm"
                    onClick={() => {
                      window.location.href = `/spaces/parking?parkingId=${selectedItem.id}`;
                    }}
                  >
                    <ExternalLink className={iconSizes.sm} />
                    {t('salesParking.tabs.openInSpaces', { defaultValue: 'Άνοιγμα στους Χώρους' })}
                  </Button>
                </div>
              </section>
            </TabsContent>
          ))}

          <TabsContent value="history" className="flex-1">
            <ActivityTab entityType="parking" entityId={selectedItem.id} />
          </TabsContent>
        </Tabs>
      }
    />
  ) : null;

  // =========================================================================
  // List Column
  // =========================================================================
  const listColumn = (
    <EntityListColumn aria-label={t('salesParking.listLabel', { defaultValue: 'Λίστα θέσεων στάθμευσης' })}>
      <GenericListHeader
        icon={Car}
        entityName={t('salesParking.listTitle', { defaultValue: 'Θέσεις Στάθμευσης' })}
        itemCount={items.length}
      />

      <ParkingQuickFilters
        selectedStatus={selectedStatus}
        onStatusChange={onStatusChange}
        selectedType={selectedType}
        onTypeChange={onTypeChange}
      />

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-1 sm:p-2">
          {items.map(item => (
            <SalesParkingCard
              key={item.id}
              spot={item}
              isSelected={item.id === selectedItemId}
              onSelect={onSelectItem}
            />
          ))}

          {items.length === 0 && (
            <div className={cn("p-6 text-center text-sm", colors.text.muted)}>
              {t('salesParking.noResults', { defaultValue: 'Δεν βρέθηκαν θέσεις στάθμευσης με αυτά τα κριτήρια.' })}
            </div>
          )}
        </div>
      </ScrollArea>
    </EntityListColumn>
  );

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <>
      {listColumn}
      {!isMobile && detailsContent}

      <MobileDetailsSlideIn
        isOpen={isMobile && !!selectedItem}
        onClose={() => onSelectItem('__none__')}
        title={selectedItem?.number || t('salesParking.details.title', { defaultValue: 'Στοιχεία Θέσης' })}
      >
        {isMobile && selectedItem && detailsContent}
      </MobileDetailsSlideIn>
    </>
  );
}
