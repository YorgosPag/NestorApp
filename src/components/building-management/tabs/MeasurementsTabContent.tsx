/**
 * MeasurementsTabContent — BOQ / Quantity Surveying Tab
 *
 * Orchestrator component for the Measurements tab in Building Detail.
 * Displays summary cards, filter bar, category accordion with item tables,
 * and the item editor dialog.
 *
 * @module components/building-management/tabs/MeasurementsTabContent
 * @see ADR-175 (Quantity Surveying / BOQ)
 */

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useBOQItems } from '@/hooks/useBOQItems';
import { useIconSizes } from '@/hooks/useIconSizes';
import { BOQSummaryCards } from './MeasurementsTabContent/BOQSummaryCards';
import { BOQCoverageIndicator } from './MeasurementsTabContent/BOQCoverageIndicator';
import { BOQFilterBar } from './MeasurementsTabContent/BOQFilterBar';
import { BOQCategoryAccordion, getCategoryCodes } from './MeasurementsTabContent/BOQCategoryAccordion';
import { BOQItemEditor } from './MeasurementsTabContent/BOQItemEditor';
import { Button } from '@/components/ui/button';
import { Ruler, Plus, AlertCircle, ChevronRight, ChevronDown, FileText } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
// 🏢 ADR-241: Centralized fullscreen system
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenOverlay, FullscreenToggleButton } from '@/core/containers/FullscreenOverlay';
import type { Building } from '@/types/building/contracts';
import type { BOQItem, BOQItemStatus, CreateBOQItemInput, UpdateBOQItemInput } from '@/types/boq';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

interface MeasurementsTabContentProps {
  building: Building;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MeasurementsTabContent({ building }: MeasurementsTabContentProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const colors = useSemanticColors();
  const { user } = useAuth();
  const { confirm, dialogProps } = useConfirmDialog();
  const router = useRouter();
  // 🏢 ADR-241: Fullscreen state
  const fullscreen = useFullscreen();
  // 🏢 ADR-201: Centralized companyId resolution (building → user fallback)
  const resolvedCompanyId = useCompanyId({ building })?.companyId ?? '';

  const {
    items,
    filteredItems,
    categories,
    loading,
    error,
    filters,
    setFilters,
    createItem,
    updateItem,
    deleteItem,
    updateStatus,
  } = useBOQItems(
    building.id,
    building.projectId,
    resolvedCompanyId,
    user?.uid ?? ''
  );

  const iconSizes = useIconSizes();

  // Editor dialog state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BOQItem | null>(null);

  // Accordion expand/collapse state (controlled mode)
  const allCategoryCodes = useMemo(() => getCategoryCodes(filteredItems), [filteredItems]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(allCategoryCodes);

  const handleToggleAllCategories = useCallback(() => {
    setExpandedCategories(prev =>
      prev.length === allCategoryCodes.length ? [] : [...allCategoryCodes]
    );
  }, [allCategoryCodes]);

  // --- HANDLERS ---

  const handleNewItem = useCallback(() => {
    setEditingItem(null);
    setEditorOpen(true);
  }, []);

  const handleEdit = useCallback((item: BOQItem) => {
    setEditingItem(item);
    setEditorOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (item: BOQItem) => {
      const confirmed = await confirm({
        title: t('tabs.measurements.actions.deleteConfirm'),
        description: t('tabs.measurements.actions.deleteConfirm'),
        variant: 'destructive',
      });
      if (!confirmed) return;
      await deleteItem(item.id);
    },
    [deleteItem, t, confirm]
  );

  const handleStatusChange = useCallback(
    async (item: BOQItem, status: BOQItemStatus) => {
      await updateStatus(item.id, status);
    },
    [updateStatus]
  );

  const handleSave = useCallback(
    async (data: CreateBOQItemInput | UpdateBOQItemInput, isNew: boolean) => {
      if (isNew) {
        await createItem(data as CreateBOQItemInput);
      } else if (editingItem) {
        const updateData = data as UpdateBOQItemInput;

        // Check if status changed (separate governance call)
        if (editingItem.status !== (updateData as UpdateBOQItemInput & { status?: BOQItemStatus }).status) {
          // Not handled here — status is managed via updateStatus
        }

        await updateItem(editingItem.id, updateData);
      }
    },
    [createItem, updateItem, editingItem]
  );

  const handleEditorClose = useCallback(() => {
    setEditorOpen(false);
    setEditingItem(null);
  }, []);

  const handleCreateRfqFromBoq = useCallback(async () => {
    if (filteredItems.length === 0) return;
    const missingSubCat = filteredItems.filter((i) => !i.subCategoryCode).length;
    if (missingSubCat > 0) {
      const proceed = await confirm({
        title: t('tabs.measurements.actions.rfqWarningTitle'),
        description: t('tabs.measurements.actions.rfqWarningBody', { count: missingSubCat }),
      });
      if (!proceed) return;
    }
    const ids = filteredItems.map((i) => i.id).join(',');
    router.push(`/procurement/rfqs/new?boqItems=${encodeURIComponent(ids)}&projectId=${encodeURIComponent(building.projectId)}`);
  }, [filteredItems, router, confirm, t]);

  // --- LOADING STATE ---

  if (loading) {
    return (
      <section className="flex items-center justify-center py-2">
        <Spinner size="large" />
      </section>
    );
  }

  // --- ERROR STATE ---

  if (error) {
    return (
      <section className="flex flex-col items-center justify-center py-2 gap-2">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
      </section>
    );
  }

  // --- EMPTY STATE ---

  if (items.length === 0) {
    return (
      <section className="flex flex-col items-center justify-center py-2 gap-2">
        <Ruler className={`h-12 w-12 ${colors.text.muted} opacity-50`} />
        <header className="text-center">
          <h3 className="font-semibold">{t('tabs.measurements.empty.title')}</h3>
          <p className={cn("text-sm mt-1", colors.text.muted)}>
            {t('tabs.measurements.empty.description')}
          </p>
        </header>
        <Button onClick={handleNewItem}>
          <Plus className="h-4 w-4 mr-2" />
          {t('tabs.measurements.empty.cta')}
        </Button>

        <BOQItemEditor
          open={editorOpen}
          onClose={handleEditorClose}
          item={null}
          buildingId={building.id}
          projectId={building.projectId}
          categories={categories}
          onSave={handleSave}
        />
      </section>
    );
  }

  // --- MAIN CONTENT ---

  return (
    <FullscreenOverlay
      isFullscreen={fullscreen.isFullscreen}
      onToggle={fullscreen.toggle}
      ariaLabel="Building Measurements"
      className="space-y-2 p-2"
      fullscreenClassName="p-4 overflow-auto"
    >
      <ConfirmDialog {...dialogProps} />
      {/* Summary Cards */}
      <BOQSummaryCards items={items} />

      {/* Floor coverage gap — non-blocking informational banner */}
      <BOQCoverageIndicator items={items} buildingId={building.id} />

      {/* Filter Bar + Actions */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <section className="flex-1 w-full">
          <BOQFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            categories={categories}
          />
        </section>
        <nav className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateRfqFromBoq}
            disabled={filteredItems.length === 0}
            title={t('tabs.measurements.actions.createRfqFromBoq')}
          >
            <FileText className="h-4 w-4 mr-1" />
            {t('tabs.measurements.actions.createRfqFromBoq')}
          </Button>
          <Button onClick={handleNewItem}>
            <Plus className="h-4 w-4 mr-2" />
            {t('tabs.measurements.actions.newItem')}
          </Button>
          {allCategoryCodes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleAllCategories}
              aria-label={expandedCategories.length === allCategoryCodes.length
                ? t('tabs.measurements.actions.collapseAll')
                : t('tabs.measurements.actions.expandAll')
              }
            >
              {expandedCategories.length === allCategoryCodes.length
                ? <ChevronDown className={iconSizes.sm} />
                : <ChevronRight className={iconSizes.sm} />
              }
            </Button>
          )}
          {/* 🏢 ADR-241: Fullscreen toggle */}
          <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
        </nav>
      </header>

      {/* Category Accordion with Items */}
      <BOQCategoryAccordion
        items={filteredItems}
        categories={categories}
        onEdit={handleEdit}
        onDelete={(item) => void handleDelete(item)}
        onStatusChange={handleStatusChange}
        expandedCategories={expandedCategories}
        onExpandedChange={(expanded) => setExpandedCategories(expanded as string[])}
      />

      {/* Editor Dialog */}
      <BOQItemEditor
        open={editorOpen}
        onClose={handleEditorClose}
        item={editingItem}
        buildingId={building.id}
        projectId={building.projectId}
        categories={categories}
        onSave={handleSave}
      />
    </FullscreenOverlay>
  );
}

export default MeasurementsTabContent;
