'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Layers, Boxes, Sparkles, Clock, AlertTriangle } from 'lucide-react';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { MaterialSlimList } from '@/components/procurement/materials/MaterialSlimList';
import { MaterialDetail } from '@/components/procurement/materials/MaterialDetail';
import { MaterialFormDialog } from '@/components/procurement/materials/MaterialFormDialog';
import { PageContainer, ListContainer, DetailsContainer } from '@/core/containers';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { PageHeader } from '@/core/headers';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useMaterials } from '@/hooks/procurement/useMaterials';
import type { ViewMode } from '@/core/headers';
import type {
  Material,
  CreateMaterialDTO,
  UpdateMaterialDTO,
} from '@/subapps/procurement/types/material';

export default function MaterialsPage() {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const { materials, loading, createMaterial, updateMaterial, deleteMaterial } = useMaterials();

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showDashboard, setShowDashboard] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Material | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);

  const selectedMaterialId = searchParams.get('materialId') ?? undefined;

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === selectedMaterialId) ?? null,
    [materials, selectedMaterialId],
  );

  const dashboardStats = useMemo(() => {
    const total = materials.length;
    const now = Date.now();
    const recent = materials.filter((m) => {
      const ms = m.lastPurchaseDate?.toMillis?.() ?? 0;
      return ms && now - ms <= 90 * 86400000;
    }).length;
    const inactive = materials.filter((m) => {
      const ms = m.lastPurchaseDate?.toMillis?.() ?? 0;
      return !ms || now - ms > 180 * 86400000;
    }).length;
    const noSupplier = materials.filter((m) => m.preferredSupplierContactIds.length === 0).length;
    return [
      { title: t('hub.materialCatalog.title'), value: total, icon: Boxes, color: 'blue' as const },
      { title: t('filters.materialStatus.recently_used'), value: recent, icon: Sparkles, color: 'green' as const },
      { title: t('filters.materialStatus.inactive'), value: inactive, icon: Clock, color: 'orange' as const },
      { title: t('filters.materialStatus.no_supplier'), value: noSupplier, icon: AlertTriangle, color: 'red' as const },
    ];
  }, [materials, t]);

  const handleSelectMaterial = useCallback(
    (material: Material) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('materialId', material.id);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, searchParams, pathname],
  );

  const handleDeselectMaterial = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('materialId');
    router.replace(`${pathname}?${params.toString()}`);
  }, [router, searchParams, pathname]);

  function openCreate() {
    setFormInitial(null);
    setFormOpen(true);
  }

  function openEdit(material: Material) {
    setFormInitial(material);
    setFormOpen(true);
  }

  async function handleSubmit(
    payload: CreateMaterialDTO | UpdateMaterialDTO,
    materialId?: string,
  ) {
    if (materialId) {
      await updateMaterial(materialId, payload as UpdateMaterialDTO);
      toast.success(t('hub.materialCatalog.toast.updated'));
    } else {
      await createMaterial(payload as CreateMaterialDTO);
      toast.success(t('hub.materialCatalog.toast.created'));
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMaterial(deleteTarget.id);
      toast.success(t('hub.materialCatalog.toast.deleted'));
      if (selectedMaterialId === deleteTarget.id) handleDeselectMaterial();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleteTarget(null);
    }
  }

  const handleEditFromList = useCallback((id: string) => {
    const m = materials.find((x) => x.id === id);
    if (m) openEdit(m);
  }, [materials]);

  const handleDeleteFromList = useCallback((id: string) => {
    const m = materials.find((x) => x.id === id);
    if (m) setDeleteTarget(m);
  }, [materials]);

  const listProps = {
    materials,
    loading,
    selectedMaterialId,
    onSelectMaterial: handleSelectMaterial,
    onCreateNew: openCreate,
    onEditMaterial: handleEditFromList,
    onDeleteMaterial: handleDeleteFromList,
    viewMode,
  };

  const rightPane = selectedMaterial ? (
    <MaterialDetail
      material={selectedMaterial}
      onEdit={openEdit}
      onDelete={setDeleteTarget}
      onCreateNew={openCreate}
    />
  ) : null;

  return (
    <PageContainer ariaLabel={t('hub.materialCatalog.title')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>

      <PageHeader
        variant="sticky-rounded"
        layout="compact"
        spacing="compact"
        title={{
          icon: Layers,
          title: t('hub.materialCatalog.title'),
          subtitle: t('hub.materialCatalog.description'),
        }}
        actions={{
          showDashboard,
          onDashboardToggle: () => setShowDashboard((v) => !v),
          viewMode: viewMode as ViewMode,
          onViewModeChange: (m) => setViewMode(m as 'list' | 'grid'),
          viewModes: ['list', 'grid'] as ViewMode[],
        }}
      />

      {showDashboard && (
        <section role="region" aria-label={t('hub.materialCatalog.title')}>
          <UnifiedDashboard stats={dashboardStats} columns={4} />
        </section>
      )}

      <ListContainer>
        <>
          <section
            className="hidden md:flex flex-1 gap-2 min-h-0 min-w-0 overflow-hidden"
            aria-label={t('hub.materialCatalog.title')}
          >
            <MaterialSlimList {...listProps} />

            {rightPane ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-card border rounded-lg shadow-sm p-4">
                {rightPane}
              </div>
            ) : (
              <DetailsContainer
                emptyStateProps={{
                  icon: Layers,
                  title: t('hub.materialCatalog.detail.emptyTitle'),
                  description: t('hub.materialCatalog.detail.emptyDescription'),
                }}
                onCreateAction={openCreate}
              />
            )}
          </section>

          <section
            className={`md:hidden flex-1 min-h-0 overflow-hidden ${selectedMaterial ? 'hidden' : 'block'}`}
            aria-label={t('hub.materialCatalog.title')}
          >
            <MaterialSlimList {...listProps} />
          </section>

          <MobileDetailsSlideIn
            isOpen={!!selectedMaterial}
            onClose={handleDeselectMaterial}
            title={selectedMaterial?.name ?? ''}
          >
            {rightPane}
          </MobileDetailsSlideIn>
        </>
      </ListContainer>

      <MaterialFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={formInitial}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('hub.materialCatalog.deleteConfirm.title')}
        description={t('hub.materialCatalog.deleteConfirm.description', {
          name: deleteTarget?.name ?? '',
        })}
        confirmText={t('hub.materialCatalog.delete')}
        onConfirm={handleConfirmDelete}
        variant="destructive"
      />
    </PageContainer>
  );
}
