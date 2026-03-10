'use client';

/**
 * @fileoverview Sales Sidebar — ADR-197
 * @description List + Details sidebar for sales available units
 * @pattern Mirrors UnitsSidebar with commercial context
 */

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, ExternalLink } from 'lucide-react';
import { EntityListColumn, DetailsContainer } from '@/core/containers';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { SalesUnitListCard } from '@/components/sales/cards/SalesUnitListCard';
import { SalesQuickFilters } from '@/components/sales/page/SalesQuickFilters';
import { SalesDetailsHeader } from '@/components/sales/sidebar/SalesDetailsHeader';
import { SaleInfoContent } from '@/components/sales/tabs/SaleInfoContent';
import { UnitSummaryContent } from '@/components/sales/tabs/UnitSummaryContent';
import {
  ChangePriceDialog,
  ReserveDialog,
  SellDialog,
} from '@/components/sales/dialogs/SalesActionDialogs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIsMobile } from '@/hooks/useMobile';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { Button } from '@/components/ui/button';
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
  /** Quick filter: selected commercial status */
  selectedCommercialStatus: string;
  onCommercialStatusChange: (status: string) => void;
  /** Quick filter: selected unit type */
  selectedUnitType: string;
  onUnitTypeChange: (type: string) => void;
}

// =============================================================================
// 🏢 TAB CONFIG (ADR-197 §2.7)
// =============================================================================

const SALES_TABS = [
  { id: 'sale-info', icon: DollarSign, labelKey: 'sales.tabs.saleInfo', defaultLabel: 'Πώληση' },
  { id: 'unit-summary', icon: Home, labelKey: 'sales.tabs.unitSummary', defaultLabel: 'Μονάδα' },
  { id: 'photos', icon: Camera, labelKey: 'sales.tabs.photos', defaultLabel: 'Φωτογραφίες' },
  { id: 'documents', icon: FileText, labelKey: 'sales.tabs.documents', defaultLabel: 'Έγγραφα' },
  { id: 'history', icon: Clock, labelKey: 'sales.tabs.history', defaultLabel: 'Ιστορικό' },
] as const;

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SalesSidebar({
  units,
  selectedUnit,
  onSelectUnit,
  selectedUnitId,
  selectedCommercialStatus,
  onCommercialStatusChange,
  selectedUnitType,
  onUnitTypeChange,
}: SalesSidebarProps) {
  const { t } = useTranslation('common');
  const router = useRouter();
  const isMobile = useIsMobile();
  const iconSizes = useIconSizes();

  // =========================================================================
  // Dialog State (ADR-197 §2.9 — 3 commercial actions)
  // =========================================================================
  const [changePriceOpen, setChangePriceOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);

  const handleChangePrice = useCallback(() => setChangePriceOpen(true), []);
  const handleReserve = useCallback(() => setReserveOpen(true), []);
  const handleSell = useCallback(() => setSellOpen(true), []);

  // =========================================================================
  // Details Content (shared between desktop & mobile)
  // =========================================================================
  const detailsContent = selectedUnit ? (
    <DetailsContainer
      selectedItem={selectedUnit}
      header={
        <SalesDetailsHeader
          unit={selectedUnit}
          onChangePrice={handleChangePrice}
          onReserve={handleReserve}
          onSell={handleSell}
        />
      }
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
                  {t(tab.labelKey, { defaultValue: tab.defaultLabel })}
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

          {/* Photos, Documents, History → redirect to /units (Χώροι) */}
          {(['photos', 'documents', 'history'] as const).map(tabId => (
            <TabsContent key={tabId} value={tabId} className="flex-1 overflow-y-auto">
              <section className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {t(`sales.tabs.${tabId}Hint`, {
                    defaultValue: tabId === 'photos'
                      ? 'Οι φωτογραφίες βρίσκονται στη σελίδα Χώροι → Μονάδες'
                      : tabId === 'documents'
                        ? 'Τα έγγραφα βρίσκονται στη σελίδα Χώροι → Μονάδες'
                        : 'Το ιστορικό βρίσκεται στη σελίδα Χώροι → Μονάδες',
                  })}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => router.push('/units')}
                >
                  <ExternalLink className={iconSizes.sm} />
                  {t('sales.tabs.openInSpaces', { defaultValue: 'Άνοιγμα στους Χώρους' })}
                </Button>
              </section>
            </TabsContent>
          ))}
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

      {/* Quick Filters inside list column (mirrors UnitsList pattern) */}
      <SalesQuickFilters
        selectedCommercialStatus={selectedCommercialStatus}
        onCommercialStatusChange={onCommercialStatusChange}
        selectedUnitType={selectedUnitType}
        onUnitTypeChange={onUnitTypeChange}
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

      {/* Commercial Action Dialogs (ADR-197 §2.9) */}
      {selectedUnit && (
        <>
          <ChangePriceDialog
            unit={selectedUnit}
            open={changePriceOpen}
            onOpenChange={setChangePriceOpen}
          />
          <ReserveDialog
            unit={selectedUnit}
            open={reserveOpen}
            onOpenChange={setReserveOpen}
          />
          <SellDialog
            unit={selectedUnit}
            open={sellOpen}
            onOpenChange={setSellOpen}
          />
        </>
      )}
    </>
  );
}
