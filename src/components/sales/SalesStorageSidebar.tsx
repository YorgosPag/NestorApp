'use client';
/* eslint-disable custom/no-hardcoded-strings */

/**
 * @fileoverview Sales Storage Sidebar — ADR-199
 * @description List + Details sidebar for storage sales
 * @pattern Mirrors SalesSidebar with storage-specific components
 */

import React from 'react';
import { Package, DollarSign, Clock, Map, FileText, Camera, Video, ExternalLink } from 'lucide-react';
import { EntityListColumn, DetailsContainer } from '@/core/containers';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { SalesStorageCard } from '@/components/sales/cards/SalesStorageCard';
import { StorageQuickFilters } from '@/components/sales/filters/StorageQuickFilters';
import { StorageDetailPanel } from '@/components/sales/details/StorageDetailPanel';
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
import type { Storage } from '@/types/storage/contracts';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SalesStorageSidebarProps {
  items: Storage[];
  selectedItem: Storage | null;
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
  { id: 'info', icon: DollarSign, labelKey: 'salesStorage.tabs.info', defaultLabel: 'Πληροφορίες' },
  { id: 'floor-plan', icon: Map, labelKey: 'salesStorage.tabs.floorPlan', defaultLabel: 'Κάτοψη' },
  { id: 'documents', icon: FileText, labelKey: 'salesStorage.tabs.documents', defaultLabel: 'Έγγραφα' },
  { id: 'photos', icon: Camera, labelKey: 'salesStorage.tabs.photos', defaultLabel: 'Φωτογραφίες' },
  { id: 'videos', icon: Video, labelKey: 'salesStorage.tabs.videos', defaultLabel: 'Βίντεο' },
  { id: 'history', icon: Clock, labelKey: 'salesStorage.tabs.history', defaultLabel: 'Ιστορικό' },
] as const;

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SalesStorageSidebar({
  items,
  selectedItem,
  onSelectItem,
  selectedItemId,
  selectedStatus,
  onStatusChange,
  selectedType,
  onTypeChange,
}: SalesStorageSidebarProps) {
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
          icon={Package}
          title={selectedItem.name || selectedItem.id}
          subtitle={`${selectedItem.building ?? ''} · ${selectedItem.floor ?? ''}`}
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
            <StorageDetailPanel data={selectedItem} />
          </TabsContent>

          {/* Floor-plan, Documents, Photos, Videos → redirect to /spaces/storage */}
          {(['floor-plan', 'documents', 'photos', 'videos'] as const).map(tabId => {
            const hintKey = tabId === 'floor-plan' ? 'floorPlan' : tabId;
            return (
              <TabsContent key={tabId} value={tabId} className="flex-1">
                <section className="p-4">
                  <p className={cn("text-sm text-center mb-3", colors.text.muted)}>
                    {t(`salesStorage.tabs.${hintKey}Hint`, { defaultValue: `Διαχείριση στη σελίδα Χώροι → Αποθήκες` })}
                  </p>
                  <div className="pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center gap-2 text-sm"
                      onClick={() => {
                        window.location.href = `/spaces/storage?storageId=${selectedItem.id}`;
                      }}
                    >
                      <ExternalLink className={iconSizes.sm} />
                      {t('salesStorage.tabs.openInSpaces', { defaultValue: 'Άνοιγμα στους Χώρους' })}
                    </Button>
                  </div>
                </section>
              </TabsContent>
            );
          })}

          <TabsContent value="history" className="flex-1">
            <ActivityTab entityType="storage" entityId={selectedItem.id} />
          </TabsContent>
        </Tabs>
      }
    />
  ) : null;

  // =========================================================================
  // List Column
  // =========================================================================
  const listColumn = (
    <EntityListColumn aria-label={t('salesStorage.listLabel', { defaultValue: 'Λίστα αποθηκών πωλήσεων' })}>
      <GenericListHeader
        icon={Package}
        entityName={t('salesStorage.listTitle', { defaultValue: 'Αποθήκες' })}
        itemCount={items.length}
      />

      <StorageQuickFilters
        selectedStatus={selectedStatus}
        onStatusChange={onStatusChange}
        selectedType={selectedType}
        onTypeChange={onTypeChange}
      />

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-1 sm:p-2">
          {items.map(item => (
            <SalesStorageCard
              key={item.id}
              storage={item}
              isSelected={item.id === selectedItemId}
              onSelect={onSelectItem}
            />
          ))}

          {items.length === 0 && (
            <div className={cn("p-6 text-center text-sm", colors.text.muted)}>
              {t('salesStorage.noResults', { defaultValue: 'Δεν βρέθηκαν αποθήκες με αυτά τα κριτήρια.' })}
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
        title={selectedItem?.name || t('salesStorage.details.title', { defaultValue: 'Στοιχεία Αποθήκης' })}
      >
        {isMobile && selectedItem && detailsContent}
      </MobileDetailsSlideIn>
    </>
  );
}
