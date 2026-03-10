'use client';

/**
 * @fileoverview Sales Sidebar — ADR-197
 * @description List + Details sidebar for sales available units
 * @pattern Mirrors UnitsSidebar with commercial context
 */

import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { EntityListColumn, DetailsContainer } from '@/core/containers';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { SalesUnitListCard } from '@/components/sales/cards/SalesUnitListCard';
import { SalesDetailsHeader } from '@/components/sales/sidebar/SalesDetailsHeader';
import { SaleInfoContent } from '@/components/sales/tabs/SaleInfoContent';
import { UnitSummaryContent } from '@/components/sales/tabs/UnitSummaryContent';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIsMobile } from '@/hooks/useMobile';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIconSizes } from '@/hooks/useIconSizes';
import {
  DollarSign,
  Home,
  Camera,
  FileText,
  Clock,
} from 'lucide-react';
import type { Unit } from '@/types/unit';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SalesSidebarProps {
  units: Unit[];
  selectedUnit: Unit | null;
  onSelectUnit: (unitId: string) => void;
  selectedUnitId: string | null;
}

// =============================================================================
// 🏢 TAB CONFIG (ADR-197 §2.7)
// =============================================================================

const SALES_TABS = [
  { id: 'sale-info', icon: DollarSign, labelKey: 'sales.tabs.saleInfo' },
  { id: 'unit-summary', icon: Home, labelKey: 'sales.tabs.unitSummary' },
  { id: 'photos', icon: Camera, labelKey: 'sales.tabs.photos' },
  { id: 'documents', icon: FileText, labelKey: 'sales.tabs.documents' },
  { id: 'history', icon: Clock, labelKey: 'sales.tabs.history' },
] as const;

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SalesSidebar({
  units,
  selectedUnit,
  onSelectUnit,
  selectedUnitId,
}: SalesSidebarProps) {
  const { t } = useTranslation('common');
  const isMobile = useIsMobile();
  const iconSizes = useIconSizes();

  // =========================================================================
  // Details Content (shared between desktop & mobile)
  // =========================================================================
  const detailsContent = selectedUnit ? (
    <DetailsContainer
      selectedItem={selectedUnit}
      header={<SalesDetailsHeader unit={selectedUnit} />}
      tabsRenderer={
        <Tabs defaultValue="sale-info" className="flex-1 flex flex-col min-h-0">
          <TabsList className="flex flex-wrap gap-1 w-full h-auto min-h-fit flex-shrink-0">
            {SALES_TABS.map(tab => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1 text-xs font-medium"
              >
                <tab.icon className={iconSizes.sm} />
                <span className="hidden sm:inline">
                  {t(tab.labelKey, { defaultValue: tab.id })}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="sale-info" className="flex-1 overflow-y-auto">
            <SaleInfoContent data={selectedUnit} />
          </TabsContent>

          <TabsContent value="unit-summary" className="flex-1 overflow-y-auto">
            <UnitSummaryContent data={selectedUnit} />
          </TabsContent>

          <TabsContent value="photos" className="flex-1 overflow-y-auto">
            <div className="p-4 text-sm text-muted-foreground text-center">
              {t('sales.tabs.photosPlaceholder', { defaultValue: 'Φωτογραφίες — θα ενεργοποιηθεί σύντομα' })}
            </div>
          </TabsContent>

          <TabsContent value="documents" className="flex-1 overflow-y-auto">
            <div className="p-4 text-sm text-muted-foreground text-center">
              {t('sales.tabs.documentsPlaceholder', { defaultValue: 'Έγγραφα — θα ενεργοποιηθεί σύντομα' })}
            </div>
          </TabsContent>

          <TabsContent value="history" className="flex-1 overflow-y-auto">
            <div className="p-4 text-sm text-muted-foreground text-center">
              {t('sales.tabs.historyPlaceholder', { defaultValue: 'Ιστορικό — θα ενεργοποιηθεί σύντομα' })}
            </div>
          </TabsContent>
        </Tabs>
      }
    />
  ) : null;

  // =========================================================================
  // List Column
  // =========================================================================
  const listColumn = (
    <EntityListColumn aria-label={t('sales.available.listLabel', { defaultValue: 'Λίστα μονάδων πωλήσεων' })}>
      <GenericListHeader
        icon={ShoppingBag}
        entityName={t('sales.available.listTitle', { defaultValue: 'Μονάδες' })}
        itemCount={units.length}
      />

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-1 sm:p-2">
          {units.map(unit => (
            <SalesUnitListCard
              key={unit.id}
              unit={unit}
              isSelected={unit.id === selectedUnitId}
              onSelect={onSelectUnit}
            />
          ))}

          {units.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t('sales.available.noResults', { defaultValue: 'Δεν βρέθηκαν μονάδες με αυτά τα κριτήρια.' })}
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
      {/* Desktop: list + details side by side */}
      {listColumn}
      {!isMobile && detailsContent}

      {/* Mobile: slide-in details */}
      <MobileDetailsSlideIn
        isOpen={isMobile && !!selectedUnit}
        onClose={() => onSelectUnit('__none__')}
        title={selectedUnit?.name || t('sales.available.unitDetails', { defaultValue: 'Στοιχεία Μονάδας' })}
      >
        {isMobile && selectedUnit && detailsContent}
      </MobileDetailsSlideIn>
    </>
  );
}
