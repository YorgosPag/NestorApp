'use client';

/**
 * @module procurement/list
 * @enterprise ADR-267 §Phase E — Procurement Layout Unification
 *
 * Layout unificato: PageContainer + Header + UnifiedDashboard + AdvancedFiltersPanel
 * + ListContainer con split panel (lista | dettaglio inline).
 * Stesso pattern di ContactsPageContent / BuildingsPageContent (SSoT).
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  AdvancedFiltersPanel,
  procurementFiltersConfig,
} from '@/components/core/AdvancedFilters';
import { PageContainer, ListContainer, DetailsContainer } from '@/core/containers';
import { PageLoadingState } from '@/core/states';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { ProcurementHeader } from '@/components/procurement/page/ProcurementHeader';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { PurchaseOrderList } from '@/components/procurement/PurchaseOrderList';
import { PurchaseOrderDetail } from '@/components/procurement/PurchaseOrderDetail';
import { PurchaseOrderForm } from '@/components/procurement/PurchaseOrderForm';
import { useProcurementPageState } from '@/hooks/procurement/useProcurementPageState';

// =============================================================================
// COMPONENT
// =============================================================================

export function ProcurementPageContent() {
  const router = useRouter();
  const state = useProcurementPageState();

  const {
    purchaseOrders,
    actionRequired,
    loading,
    selectedPO,
    setSelectedPO,
    handleSelectPO,
    editMode,
    setEditMode,
    handleCreateNew,
    handleFormSuccess,
    handleCancelEdit,
    handleAction,
    handleDuplicate,
    showDashboard,
    setShowDashboard,
    showFilters,
    setShowFilters,
    procFilters,
    handleFiltersChange,
    dashboardStats,
    handleCardClick,
    t,
  } = state;

  const handleMobileClose = useCallback(() => {
    setSelectedPO(null);
    handleCancelEdit();
  }, [setSelectedPO, handleCancelEdit]);

  if (loading && purchaseOrders.length === 0) {
    return (
      <PageContainer ariaLabel={t('page.pageLabel')}>
        <PageLoadingState
          icon={Package}
          message={t('page.loadingMessage')}
          layout="contained"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer ariaLabel={t('page.pageLabel')}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <ProcurementHeader
        showDashboard={showDashboard}
        setShowDashboard={setShowDashboard}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        breadcrumb={<ModuleBreadcrumb />}
      />

      {/* ── Dashboard stats (collapsibile) ──────────────────────────────── */}
      {showDashboard && (
        <section
          role="region"
          aria-label={t('page.dashboard.label')}
          className="w-full overflow-hidden"
        >
          <UnifiedDashboard
            stats={dashboardStats}
            columns={4}
            onCardClick={handleCardClick}
            className="px-1 py-4 sm:px-4 sm:py-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 overflow-hidden"
          />
        </section>
      )}

      {/* ── Advanced Filters — Desktop ───────────────────────────────────── */}
      <aside
        className="hidden md:block"
        role="complementary"
        aria-label={t('page.filters.desktop')}
      >
        <AdvancedFiltersPanel
          config={procurementFiltersConfig}
          filters={procFilters}
          onFiltersChange={handleFiltersChange}
        />
      </aside>

      {/* ── Advanced Filters — Mobile (condizionale) ─────────────────────── */}
      {showFilters && (
        <aside
          className="md:hidden"
          role="complementary"
          aria-label={t('page.filters.mobile')}
        >
          <AdvancedFiltersPanel
            config={procurementFiltersConfig}
            filters={procFilters}
            onFiltersChange={handleFiltersChange}
            defaultOpen
          />
        </aside>
      )}

      {/* ── Sub-nav: Παραγγελίες | Προσφορές ───────────────────────────── */}
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>

      {/* ── List + Detail split ──────────────────────────────────────────── */}
      <ListContainer>
        {/* Desktop: pannello sinistro lista | pannello destro dettaglio */}
        <section
          className="hidden md:flex flex-1 gap-2 min-h-0 min-w-0 overflow-hidden"
          role="region"
          aria-label="Purchase orders"
        >
          {/* Lista */}
          <PurchaseOrderList
            purchaseOrders={purchaseOrders}
            actionRequired={actionRequired}
            loading={loading}
            onCreateNew={handleCreateNew}
            onViewPO={(id) => router.push(`/procurement/${id}`)}
            onDuplicate={handleDuplicate}
            onSelectPO={handleSelectPO}
            selectedPOId={selectedPO?.id}
            onEditPO={() => selectedPO && setEditMode(true)}
          />

          {/* Dettaglio / Form / Empty state — SSoT via DetailsContainer */}
          {(editMode || selectedPO) ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card border rounded-lg shadow-sm">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
                {editMode ? (
                  <PurchaseOrderForm
                    existingPO={selectedPO ?? undefined}
                    onSuccess={handleFormSuccess}
                    onCancel={handleCancelEdit}
                  />
                ) : (
                  <PurchaseOrderDetail
                    po={selectedPO!}
                    onApprove={() => handleAction('approve')}
                    onMarkOrdered={() => handleAction('order')}
                    onRecordDelivery={() => {/* TODO: delivery dialog */}}
                    onClose={() => handleAction('close')}
                    onCancel={() => handleAction('cancel', { reason: 'other' })}
                    onEdit={() => setEditMode(true)}
                    onDuplicate={() => handleDuplicate(selectedPO!.id)}
                    onCreateNew={handleCreateNew}
                  />
                )}
              </div>
            </div>
          ) : (
            <DetailsContainer
              selectedItem={null}
              onCreateAction={handleCreateNew}
              emptyStateProps={{
                icon: NAVIGATION_ENTITIES.procurement.icon,
                title: t('emptyState.title'),
                description: t('emptyState.description'),
              }}
            />
          )}
        </section>

        {/* Mobile: solo lista */}
        <section
          className={`md:hidden w-full ${selectedPO ? 'hidden' : 'block'}`}
          role="region"
          aria-label="Purchase orders list"
        >
          <PurchaseOrderList
            purchaseOrders={purchaseOrders}
            actionRequired={actionRequired}
            loading={loading}
            onCreateNew={handleCreateNew}
            onViewPO={(id) => router.push(`/procurement/${id}`)}
            onDuplicate={handleDuplicate}
            onSelectPO={handleSelectPO}
            selectedPOId={selectedPO?.id}
            onEditPO={() => selectedPO && setEditMode(true)}
          />
        </section>

        {/* Mobile: slide-in dettaglio */}
        <MobileDetailsSlideIn
          isOpen={!!selectedPO || editMode}
          onClose={handleMobileClose}
          title={
            editMode
              ? t(selectedPO ? 'detail.edit' : 'form.createTitle')
              : (selectedPO?.poNumber ?? t('detail.emptyTitle'))
          }
        >
          {editMode ? (
            <PurchaseOrderForm
              existingPO={selectedPO ?? undefined}
              onSuccess={handleFormSuccess}
              onCancel={handleCancelEdit}
            />
          ) : selectedPO ? (
            <PurchaseOrderDetail
              po={selectedPO}
              onApprove={() => handleAction('approve')}
              onMarkOrdered={() => handleAction('order')}
              onRecordDelivery={() => {}}
              onClose={() => handleAction('close')}
              onCancel={() => handleAction('cancel', { reason: 'other' })}
              onEdit={() => setEditMode(true)}
              onDuplicate={() => handleDuplicate(selectedPO.id)}
              onCreateNew={handleCreateNew}
            />
          ) : null}
        </MobileDetailsSlideIn>
      </ListContainer>
    </PageContainer>
  );
}

export default ProcurementPageContent;
