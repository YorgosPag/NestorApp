'use client';

import { useState, useMemo } from 'react';
import { Layers, Plus } from 'lucide-react';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { PageContainer } from '@/core/containers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useMaterials } from '@/hooks/procurement/useMaterials';
import { MaterialList } from '@/components/procurement/materials/MaterialList';
import { MaterialFilters } from '@/components/procurement/materials/MaterialFilters';
import { MaterialFormDialog } from '@/components/procurement/materials/MaterialFormDialog';
import type {
  Material,
  CreateMaterialDTO,
  UpdateMaterialDTO,
} from '@/subapps/procurement/types/material';

export default function MaterialsPage() {
  const { t } = useTranslation('procurement');
  const {
    materials,
    loading,
    createMaterial,
    updateMaterial,
    deleteMaterial,
  } = useMaterials();

  const [search, setSearch] = useState('');
  const [atoeFilter, setAtoeFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Material | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);

  const filtered = useMemo(() => {
    let items = materials;
    if (atoeFilter) {
      items = items.filter((m) => m.atoeCategoryCode === atoeFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (m) =>
          m.code.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q),
      );
    }
    return items;
  }, [materials, search, atoeFilter]);

  const hasFilters = search.trim().length > 0 || atoeFilter !== null;

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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <PageContainer ariaLabel={t('hub.materialCatalog.title')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>

      <div className="px-4 py-4 space-y-4">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Layers className="h-6 w-6 text-yellow-600" aria-hidden />
            <h1 className="text-xl font-semibold">
              {t('hub.materialCatalog.title')}
            </h1>
            {!loading && (
              <Badge variant="secondary">
                {t('hub.materialCatalog.materialCount', {
                  count: materials.length,
                })}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground max-w-sm hidden md:block">
              {t('hub.materialCatalog.description')}
            </p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" aria-hidden />
              {t('hub.materialCatalog.create')}
            </Button>
          </div>
        </header>

        <MaterialFilters
          search={search}
          onSearchChange={setSearch}
          atoeCategoryCode={atoeFilter}
          onCategoryChange={setAtoeFilter}
        />

        <MaterialList
          materials={filtered}
          loading={loading}
          hasFilters={hasFilters}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
        />
      </div>

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
