'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Layers, Plus } from 'lucide-react';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { MaterialSlimList } from '@/components/procurement/materials/MaterialSlimList';
import { MaterialDetail } from '@/components/procurement/materials/MaterialDetail';
import { MaterialFilters } from '@/components/procurement/materials/MaterialFilters';
import { MaterialFormDialog } from '@/components/procurement/materials/MaterialFormDialog';
import { PageContainer, ListContainer, DetailsContainer } from '@/core/containers';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { Button } from '@/components/ui/button';
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

  const [search, setSearch] = useState('');
  const [atoeFilter, setAtoeFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Material | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);

  const filtered = useMemo(() => {
    let items = materials;
    if (atoeFilter) items = items.filter((m) => m.atoeCategoryCode === atoeFilter);
    const q = search.trim().toLowerCase();
    if (q)
      items = items.filter(
        (m) => m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
      );
    return items;
  }, [materials, search, atoeFilter]);

  const hasFilters = search.trim().length > 0 || atoeFilter !== null;

  // ── Master-detail: URL-persistent selection ──────────────────────────────
  const selectedMaterialId = searchParams.get('materialId') ?? undefined;

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === selectedMaterialId) ?? null,
    [materials, selectedMaterialId],
  );

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

  // ── Mutations ─────────────────────────────────────────────────────────────
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

  const listProps = {
    materials: filtered,
    loading,
    hasFilters,
    selectedMaterialId,
    onSelectMaterial: handleSelectMaterial,
  };

  const rightPane = selectedMaterial ? (
    <MaterialDetail
      material={selectedMaterial}
      onEdit={openEdit}
      onDelete={setDeleteTarget}
    />
  ) : null;

  return (
    <PageContainer ariaLabel={t('hub.materialCatalog.title')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>

      {/* Filters bar + Create button above the split */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b">
        <MaterialFilters
          search={search}
          onSearchChange={setSearch}
          atoeCategoryCode={atoeFilter}
          onCategoryChange={setAtoeFilter}
        />
        <Button onClick={openCreate} size="sm" className="shrink-0">
          <Plus className="h-4 w-4 mr-1" aria-hidden />
          {t('hub.materialCatalog.create')}
        </Button>
      </div>

      <ListContainer>
        <>
          {/* ── Desktop: split list + detail ───────────────────────────────── */}
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

          {/* ── Mobile: list (hidden when material selected) ────────────────── */}
          <section
            className={`md:hidden flex-1 min-h-0 overflow-hidden ${selectedMaterial ? 'hidden' : 'block'}`}
            aria-label={t('hub.materialCatalog.title')}
          >
            <MaterialSlimList {...listProps} />
          </section>

          {/* ── Mobile: slide-in detail overlay ────────────────────────────── */}
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
