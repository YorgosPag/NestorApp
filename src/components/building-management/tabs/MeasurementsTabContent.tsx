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

import { useCallback, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { useBOQItems } from '@/hooks/useBOQItems';
import { BOQSummaryCards } from './MeasurementsTabContent/BOQSummaryCards';
import { BOQFilterBar } from './MeasurementsTabContent/BOQFilterBar';
import { BOQCategoryAccordion } from './MeasurementsTabContent/BOQCategoryAccordion';
import { BOQItemEditor } from './MeasurementsTabContent/BOQItemEditor';
import { Button } from '@/components/ui/button';
import { Ruler, Plus, AlertCircle, Loader2 } from 'lucide-react';
import type { Building } from '@/types/building/contracts';
import type { BOQItem, BOQItemStatus, CreateBOQItemInput, UpdateBOQItemInput } from '@/types/boq';

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
  const { t } = useTranslation('building');
  const { user } = useAuth();

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
    (building.companyId as string) ?? '',
    user?.uid ?? ''
  );

  // Editor dialog state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BOQItem | null>(null);

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
      if (!window.confirm(t('tabs.measurements.actions.deleteConfirm'))) return;
      await deleteItem(item.id);
    },
    [deleteItem, t]
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

  // --- LOADING STATE ---

  if (loading) {
    return (
      <section className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </section>
    );
  }

  // --- ERROR STATE ---

  if (error) {
    return (
      <section className="flex flex-col items-center justify-center py-20 gap-2">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
      </section>
    );
  }

  // --- EMPTY STATE ---

  if (items.length === 0) {
    return (
      <section className="flex flex-col items-center justify-center py-20 gap-2">
        <Ruler className="h-12 w-12 text-muted-foreground/50" />
        <header className="text-center">
          <h3 className="font-semibold">{t('tabs.measurements.empty.title')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
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
    <section className="space-y-2 p-2">
      {/* Summary Cards */}
      <BOQSummaryCards items={items} />

      {/* Filter Bar + Actions */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <section className="flex-1 w-full">
          <BOQFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            categories={categories}
          />
        </section>
        <Button onClick={handleNewItem} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          {t('tabs.measurements.actions.newItem')}
        </Button>
      </header>

      {/* Category Accordion with Items */}
      <BOQCategoryAccordion
        items={filteredItems}
        categories={categories}
        onEdit={handleEdit}
        onDelete={(item) => void handleDelete(item)}
        onStatusChange={handleStatusChange}
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
    </section>
  );
}

export default MeasurementsTabContent;
