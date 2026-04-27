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
import { PageContainer, ListContainer } from '@/core/containers';
import { PageLoadingState } from '@/core/states';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { ProcurementHeader } from '@/components/procurement/page/ProcurementHeader';
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
            searchValue={procFilters.searchTerm}
            onSearchChange={(v) =>
              handleFiltersChange({ ...procFilters, searchTerm: v })
            }
            onCreateNew={handleCreateNew}
            onViewPO={(id) => router.push(`/procurement/${id}`)}
            onDuplicate={handleDuplicate}
            onSelectPO={handleSelectPO}
            selectedPOId={selectedPO?.id}
            hideSearchBar
          />

          {/* Dettaglio / Form / Empty state */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card border rounded-lg shadow-sm">
            {editMode ? (
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
                <PurchaseOrderForm
                  existingPO={selectedPO ?? undefined}
                  onSuccess={handleFormSuccess}
                  onCancel={handleCancelEdit}
                />
              </div>
            ) : selectedPO ? (
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
                <PurchaseOrderDetail
                  po={selectedPO}
                  onApprove={() => handleAction('approve')}
                  onMarkOrdered={() => handleAction('order')}
                  onRecordDelivery={() => {/* TODO: delivery dialog */}}
                  onClose={() => handleAction('close')}
                  onCancel={() => handleAction('cancel', { reason: 'other' })}
                  onEdit={() => setEditMode(true)}
                  onDuplicate={() => handleDuplicate(selectedPO.id)}
                />
              </div>
            ) : (

              <EmptyDetailState
                onCreateNew={handleCreateNew}
                label={t('detail.emptyTitle')}
                description={t('detail.emptyDescription')}
                createLabel={t('list.createPO')}
              />
            )}
          </div>
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
            searchValue={procFilters.searchTerm}
            onSearchChange={(v) =>
              handleFiltersChange({ ...procFilters, searchTerm: v })
            }
            onCreateNew={handleCreateNew}
            onViewPO={(id) => router.push(`/procurement/${id}`)}
            onDuplicate={handleDuplicate}
            onSelectPO={handleSelectPO}
            selectedPOId={selectedPO?.id}
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
            />
          ) : null}
        </MobileDetailsSlideIn>
      </ListContainer>
    </PageContainer>
  );
}

export default ProcurementPageContent;

// =============================================================================
// EMPTY STATE (pannello destro quando nessun PO selezionato)
// =============================================================================

function EmptyDetailState({
  onCreateNew,
  label,
  description,
  createLabel,
}: {
  onCreateNew: () => void;
  label: string;
  description: string;
  createLabel: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Package className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      </div>
      <button
        onClick={onCreateNew}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {createLabel}
      </button>
    </div>
  );
}
