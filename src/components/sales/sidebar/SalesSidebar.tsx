/* eslint-disable custom/no-hardcoded-strings */
'use client';

/**
 * @fileoverview Sales Sidebar — ADR-197
 * @description List + Details sidebar for sales available units
 * @pattern Mirrors UnitsSidebar with commercial context
 */

import React, { useState, useCallback } from 'react';
import { ShoppingBag, ExternalLink } from 'lucide-react';
import { EntityListColumn, DetailsContainer } from '@/core/containers';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { SalesUnitListCard } from '@/components/sales/cards/SalesUnitListCard';
import { SalesQuickFilters } from '@/components/sales/page/SalesQuickFilters';
import { SalesDetailsHeader } from '@/components/sales/sidebar/SalesDetailsHeader';
import { SaleInfoContent } from '@/components/sales/tabs/SaleInfoContent';
import { UnitSummaryContent } from '@/components/sales/tabs/UnitSummaryContent';
import { ActivityTab } from '@/components/shared/audit/ActivityTab';
import {
  ChangePriceDialog,
  ReserveDialog,
  SellDialog,
  RevertDialog,
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
  Video,
  FileText,
  Clock,
  Scale,
  CreditCard,
} from 'lucide-react';
import { LegalTabContent } from '@/components/sales/legal/LegalTabContent';
import { PaymentTabContent } from '@/components/sales/payments/PaymentTabContent';
import type { Unit } from '@/types/unit';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

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
  /** Callback after commercial data mutation (price change, reserve, sell) */
  onDataMutated?: () => void;
}

// =============================================================================
// 🏢 TAB CONFIG (ADR-197 §2.7)
// =============================================================================

/** Tab config shape */
interface SalesTabConfig {
  id: string;
  icon: React.ElementType;
  labelKey: string;
  defaultLabel: string;
}

/** Base tabs — always visible */
const BASE_SALES_TABS: SalesTabConfig[] = [
  { id: 'sale-info', icon: DollarSign, labelKey: 'sales.tabs.saleInfo', defaultLabel: 'Πώληση' },
  { id: 'unit-summary', icon: Home, labelKey: 'sales.tabs.unitSummary', defaultLabel: 'Μονάδα' },
  { id: 'documents', icon: FileText, labelKey: 'sales.tabs.documents', defaultLabel: 'Έγγραφα' },
  { id: 'photos', icon: Camera, labelKey: 'sales.tabs.photos', defaultLabel: 'Φωτογραφίες' },
  { id: 'videos', icon: Video, labelKey: 'sales.tabs.videos', defaultLabel: 'Βίντεο' },
  { id: 'history', icon: Clock, labelKey: 'sales.tabs.history', defaultLabel: 'Ιστορικό' },
];

/** Legal tab — conditional, visible ONLY for reserved/sold units (ADR-230) */
const LEGAL_TAB: SalesTabConfig = { id: 'legal', icon: Scale, labelKey: 'sales.tabs.legal', defaultLabel: 'Νομικά' };

/** Payment tab — conditional, visible ONLY for reserved/sold units (ADR-234) */
const PAYMENT_TAB: SalesTabConfig = { id: 'payments', icon: CreditCard, labelKey: 'sales.tabs.payments', defaultLabel: 'Πληρωμές' };

/** Check if unit has reserved/sold status → show legal tab */
function shouldShowLegalTab(unit: Unit | null): boolean {
  if (!unit) return false;
  return unit.commercialStatus === 'reserved' || unit.commercialStatus === 'sold';
}

/** Check if unit has reserved/sold status → show payment tab */
function shouldShowPaymentTab(unit: Unit | null): boolean {
  if (!unit) return false;
  return unit.commercialStatus === 'reserved' || unit.commercialStatus === 'sold';
}

/** Build dynamic tabs array */
function buildTabs(unit: Unit | null): SalesTabConfig[] {
  const tabs = [...BASE_SALES_TABS];
  if (shouldShowLegalTab(unit)) {
    // Insert legal tab after sale-info (position 1)
    tabs.splice(1, 0, LEGAL_TAB);
  }
  if (shouldShowPaymentTab(unit)) {
    // Insert payment tab after legal (or after sale-info if no legal)
    const insertIdx = tabs.findIndex((t) => t.id === 'legal');
    tabs.splice(insertIdx >= 0 ? insertIdx + 1 : 1, 0, PAYMENT_TAB);
  }
  return tabs;
}

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
  onDataMutated,
}: SalesSidebarProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('common');
  const isMobile = useIsMobile();
  const iconSizes = useIconSizes();

  // =========================================================================
  // Dialog State (ADR-197 §2.9 — 3 commercial actions)
  // =========================================================================
  const [changePriceOpen, setChangePriceOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);

  const handleChangePrice = useCallback(() => setChangePriceOpen(true), []);
  const handleReserve = useCallback(() => setReserveOpen(true), []);
  const handleSell = useCallback(() => setSellOpen(true), []);
  const handleRevert = useCallback(() => setRevertOpen(true), []);

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
          onRevert={handleRevert}
        />
      }
      tabsRenderer={
        <Tabs defaultValue="sale-info" className="flex flex-col">
          <TabsList className="flex flex-wrap gap-1 w-full h-auto min-h-fit flex-shrink-0">
            {buildTabs(selectedUnit).map(tab => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1 text-xs font-medium"
              >
                <tab.icon className={iconSizes.sm} />
                <span className="hidden sm:inline">
                  {t(tab.labelKey)}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="sale-info" className="flex-1">
            <SaleInfoContent data={selectedUnit} />
          </TabsContent>

          <TabsContent value="unit-summary" className="flex-1">
            <UnitSummaryContent data={selectedUnit} />
          </TabsContent>

          {/* Legal Tab — ADR-230 (conditional, reserved/sold only) */}
          {shouldShowLegalTab(selectedUnit) && (
            <TabsContent value="legal" className="flex-1">
              <LegalTabContent unit={selectedUnit} />
            </TabsContent>
          )}

          {/* Payments Tab — ADR-234 (conditional, reserved/sold only) */}
          {shouldShowPaymentTab(selectedUnit) && (
            <TabsContent value="payments" className="flex-1">
              <PaymentTabContent unit={selectedUnit} />
            </TabsContent>
          )}

          {/* Documents, Photos, Videos → redirect to /units with matching tab */}
          {(['documents', 'photos', 'videos'] as const).map(tabId => {
            return (
              <TabsContent key={tabId} value={tabId} className="flex-1">
                <section className="p-4">
                  <p className={cn("text-sm text-center mb-3", colors.text.muted)}>
                    {t(`sales.tabs.${tabId}Hint`)}
                  </p>
                  <div className="pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center gap-2 text-sm"
                      onClick={() => {
                        window.location.href = `/units?unitId=${selectedUnit.id}&tab=${tabId}`;
                      }}
                    >
                      <ExternalLink className={iconSizes.sm} />
                      {t('sales.tabs.openInSpaces')}
                    </Button>
                  </div>
                </section>
              </TabsContent>
            );
          })}

          {/* History — Centralized ActivityTab (ADR-195) */}
          <TabsContent value="history" className="flex-1">
            <ActivityTab entityType="unit" entityId={selectedUnit.id} />
          </TabsContent>
        </Tabs>
      }
    />
  ) : null;

  // =========================================================================
  // List Column
  // =========================================================================
  const listColumn = (
    <EntityListColumn aria-label={t('sales.available.listLabel')}>
      <GenericListHeader
        icon={ShoppingBag}
        entityName={t('sales.available.listTitle')}
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
            <div className={cn("p-6 text-center text-sm", colors.text.muted)}>
              {t('sales.available.noResults')}
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
        title={selectedUnit?.name || t('sales.available.unitDetails')}
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
            onSuccess={onDataMutated}
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
          <RevertDialog
            unit={selectedUnit}
            open={revertOpen}
            onOpenChange={setRevertOpen}
          />
        </>
      )}
    </>
  );
}
