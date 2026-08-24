'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, usePathname } from '@/lib/workspace/navigation';
import { declaredHref } from '@/lib/workspace/route-worlds';
import { useSearchParams } from 'next/navigation';
import { Layers, Boxes, Sparkles, Clock, AlertTriangle } from 'lucide-react';
import { MaterialSlimList } from '@/components/procurement/materials/MaterialSlimList';
import { MaterialDetail } from '@/components/procurement/materials/MaterialDetail';
import { MaterialFormDialog } from '@/components/procurement/materials/MaterialFormDialog';
import { runHubDelete } from '@/components/procurement/hub/hub-delete';
import { ProcurementHubPage, useProcurementHubChrome } from '@/components/procurement/hub/ProcurementHubPage';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useMaterials } from '@/hooks/procurement/useMaterials';
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

  const chrome = useProcurementHubChrome();
  const { viewMode } = chrome;
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
      router.replace(
        declaredHref('usePathname() είναι ΗΔΗ η έγκυρη τρέχουσα σελίδα — ενημέρωση ερωτήματος, όχι νέος προορισμός.', `${pathname}?${params.toString()}`),
      );
    },
    [router, searchParams, pathname],
  );

  const handleDeselectMaterial = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('materialId');
    router.replace(
        declaredHref('usePathname() είναι ΗΔΗ η έγκυρη τρέχουσα σελίδα — ενημέρωση ερωτήματος, όχι νέος προορισμός.', `${pathname}?${params.toString()}`),
      );
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
    await runHubDelete({
      remove: () => deleteMaterial(deleteTarget.id),
      successMessage: t('hub.materialCatalog.toast.deleted'),
      onSuccess: () => { if (selectedMaterialId === deleteTarget.id) handleDeselectMaterial(); },
      onSettled: () => setDeleteTarget(null),
    });
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
    <ProcurementHubPage
      icon={Layers}
      title={t('hub.materialCatalog.title')}
      subtitle={t('hub.materialCatalog.description')}
      dashboardColumns={4}
      chrome={chrome}
      dashboardStats={dashboardStats}
      list={<MaterialSlimList {...listProps} />}
      detail={rightPane}
      emptyState={{
        icon: Layers,
        title: t('hub.materialCatalog.detail.emptyTitle'),
        description: t('hub.materialCatalog.detail.emptyDescription'),
      }}
      onCreateAction={openCreate}
      detailOpen={!!selectedMaterial}
      detailTitle={selectedMaterial?.name ?? ''}
      onDetailClose={handleDeselectMaterial}
    >


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
    </ProcurementHubPage>
  );
}
