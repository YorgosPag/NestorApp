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
import { SalesPropertyListCard } from '@/components/sales/cards/SalesPropertyListCard';
import { SalesQuickFilters } from '@/components/sales/page/SalesQuickFilters';
import { SalesDetailsHeader } from '@/components/sales/sidebar/SalesDetailsHeader';
import { SaleInfoContent } from '@/components/sales/tabs/SaleInfoContent';
import { PropertySummaryContent } from '@/components/sales/tabs/PropertySummaryContent';
import { ActivityTab } from '@/components/shared/audit/ActivityTab';
import dynamic from 'next/dynamic';

const ChangePriceDialog = dynamic(() => import('@/components/sales/dialogs/ChangePriceDialog').then(m => ({ default: m.ChangePriceDialog })), { ssr: false });
const ReserveDialog = dynamic(() => import('@/components/sales/dialogs/ReserveDialog').then(m => ({ default: m.ReserveDialog })), { ssr: false });
const SellDialog = dynamic(() => import('@/components/sales/dialogs/SellDialog').then(m => ({ default: m.SellDialog })), { ssr: false });
const RevertDialog = dynamic(() => import('@/components/sales/dialogs/RevertDialog').then(m => ({ default: m.RevertDialog })), { ssr: false });
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIsMobile } from '@/hooks/useMobile';
import { ENTITY_TYPES } from '@/config/domain-constants';
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
import type { Property } from '@/types/property';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface SalesSidebarProps {
  units: Property[];
  selectedProperty: Property | null;
  onSelectProperty: (propertyId: string) => void;
  selectedPropertyId: string | null;
  /** Quick filter: selected commercial status */
  selectedCommercialStatus: string;
  onCommercialStatusChange: (status: string) => void;
  /** Quick filter: selected property type */
  selectedPropertyType: string;
  onPropertyTypeChange: (type: string) => void;
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
}

/** Base tabs — always visible */
const BASE_SALES_TABS: SalesTabConfig[] = [
  { id: 'sale-info', icon: DollarSign, labelKey: 'sales.tabs.saleInfo' },
  { id: 'unit-summary', icon: Home, labelKey: 'sales.tabs.unitSummary' },
  { id: 'documents', icon: FileText, labelKey: 'sales.tabs.documents' },
  { id: 'photos', icon: Camera, labelKey: 'sales.tabs.photos' },
  { id: 'videos', icon: Video, labelKey: 'sales.tabs.videos' },
  { id: 'history', icon: Clock, labelKey: 'sales.tabs.history' },
];

/** Legal tab — conditional, visible ONLY for reserved/sold units (ADR-230) */
const LEGAL_TAB: SalesTabConfig = { id: 'legal', icon: Scale, labelKey: 'sales.tabs.legal' };

/** Payment tab — conditional, visible ONLY for reserved/sold units (ADR-234) */
const PAYMENT_TAB: SalesTabConfig = { id: 'payments', icon: CreditCard, labelKey: 'sales.tabs.payments' };

/** Check if unit has reserved/sold status → show legal tab */
function shouldShowLegalTab(unit: Property | null): boolean {
  if (!unit) return false;
  return unit.commercialStatus === 'reserved' || unit.commercialStatus === 'sold';
}

/** Check if unit has reserved/sold status → show payment tab */
function shouldShowPaymentTab(unit: Property | null): boolean {
  if (!unit) return false;
  return unit.commercialStatus === 'reserved' || unit.commercialStatus === 'sold';
}

/** Build dynamic tabs array */
function buildTabs(unit: Property | null): SalesTabConfig[] {
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
  selectedProperty,
  onSelectProperty,
  selectedPropertyId,
  selectedCommercialStatus,
  onCommercialStatusChange,
  selectedPropertyType,
  onPropertyTypeChange,
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
  const detailsContent = selectedProperty ? (
    <DetailsContainer
      selectedItem={selectedProperty}
      header={
        <SalesDetailsHeader
          unit={selectedProperty}
          onChangePrice={handleChangePrice}
          onReserve={handleReserve}
          onSell={handleSell}
          onRevert={handleRevert}
        />
      }
      tabsRenderer={
        <Tabs defaultValue="sale-info" className="flex flex-col">
          <TabsList className="flex flex-wrap gap-1 w-full h-auto min-h-fit flex-shrink-0">
            {buildTabs(selectedProperty).map(tab => (
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
            <SaleInfoContent data={selectedProperty} />
          </TabsContent>

          <TabsContent value="unit-summary" className="flex-1">
            <PropertySummaryContent data={selectedProperty} />
          </TabsContent>

          {/* Legal Tab — ADR-230 (conditional, reserved/sold only) */}
          {shouldShowLegalTab(selectedProperty) && (
            <TabsContent value="legal" className="flex-1">
              <LegalTabContent unit={selectedProperty} />
            </TabsContent>
          )}

          {/* Payments Tab — ADR-234 (conditional, reserved/sold only) */}
          {shouldShowPaymentTab(selectedProperty) && (
            <TabsContent value="payments" className="flex-1">
              <PaymentTabContent unit={selectedProperty} />
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
                        window.location.href = `/properties?propertyId=${selectedProperty.id}&tab=${tabId}`;
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
            <ActivityTab entityType={ENTITY_TYPES.PROPERTY} entityId={selectedProperty.id} />
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
        selectedPropertyType={selectedPropertyType}
        onPropertyTypeChange={onPropertyTypeChange}
      />

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-1 sm:p-2">
          {units.map(unit => (
            <SalesPropertyListCard
              key={unit.id}
              unit={unit}
              isSelected={unit.id === selectedPropertyId}
              onSelect={onSelectProperty}
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
        isOpen={isMobile && !!selectedProperty}
        onClose={() => onSelectProperty('__none__')}
        title={selectedProperty?.name || t('sales.available.unitDetails')}
      >
        {isMobile && selectedProperty && detailsContent}
      </MobileDetailsSlideIn>

      {/* Commercial Action Dialogs (ADR-197 §2.9) */}
      {selectedProperty && (
        <>
          <ChangePriceDialog
            unit={selectedProperty}
            open={changePriceOpen}
            onOpenChange={setChangePriceOpen}
            onSuccess={onDataMutated}
          />
          <ReserveDialog
            unit={selectedProperty}
            open={reserveOpen}
            onOpenChange={setReserveOpen}
          />
          <SellDialog
            unit={selectedProperty}
            open={sellOpen}
            onOpenChange={setSellOpen}
          />
          <RevertDialog
            unit={selectedProperty}
            open={revertOpen}
            onOpenChange={setRevertOpen}
          />
        </>
      )}
    </>
  );
}
