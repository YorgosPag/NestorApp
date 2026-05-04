'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ScrollText, Plus } from 'lucide-react';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { AgreementSlimList } from '@/components/procurement/agreements/AgreementSlimList';
import { AgreementDetail } from '@/components/procurement/agreements/AgreementDetail';
import { FrameworkAgreementFilters } from '@/components/procurement/agreements/FrameworkAgreementFilters';
import { FrameworkAgreementFormDialog } from '@/components/procurement/agreements/FrameworkAgreementFormDialog';
import { PageContainer, ListContainer, DetailsContainer } from '@/core/containers';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFrameworkAgreements } from '@/hooks/procurement/useFrameworkAgreements';
import { usePOSupplierContacts } from '@/hooks/procurement/usePOSupplierContacts';
import { getContactDisplayName } from '@/types/contacts';
import type {
  FrameworkAgreement,
  FrameworkAgreementStatus,
  CreateFrameworkAgreementDTO,
  UpdateFrameworkAgreementDTO,
} from '@/subapps/procurement/types/framework-agreement';

export default function AgreementsPage() {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const { agreements, loading, createAgreement, updateAgreement, deleteAgreement } =
    useFrameworkAgreements();
  const { suppliers } = usePOSupplierContacts();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FrameworkAgreementStatus | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FrameworkAgreement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FrameworkAgreement | null>(null);

  const vendorNamesById = useMemo(() => {
    const map = new Map<string, string>();
    suppliers.forEach((c) => {
      if (c.id) map.set(c.id, getContactDisplayName(c));
    });
    return map;
  }, [suppliers]);

  const filtered = useMemo(() => {
    let list = agreements;
    if (statusFilter) list = list.filter((a) => a.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.agreementNumber.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q),
      );
    }
    return list;
  }, [agreements, statusFilter, search]);

  const hasFilters = !!search.trim() || statusFilter !== null;

  // ── Master-detail: URL-persistent selection ──────────────────────────────
  const selectedAgreementId = searchParams.get('agreementId') ?? undefined;

  const selectedAgreement = useMemo(
    () => agreements.find((a) => a.id === selectedAgreementId) ?? null,
    [agreements, selectedAgreementId],
  );

  const handleSelectAgreement = useCallback(
    (agreement: FrameworkAgreement) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('agreementId', agreement.id);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, searchParams, pathname],
  );

  const handleDeselectAgreement = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('agreementId');
    router.replace(`${pathname}?${params.toString()}`);
  }, [router, searchParams, pathname]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  function handleNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function handleEdit(agreement: FrameworkAgreement) {
    setEditing(agreement);
    setDialogOpen(true);
  }

  async function handleSubmit(
    payload: CreateFrameworkAgreementDTO | UpdateFrameworkAgreementDTO,
    agreementId?: string,
  ) {
    if (agreementId) {
      await updateAgreement(agreementId, payload as UpdateFrameworkAgreementDTO);
      toast.success(t('hub.frameworkAgreements.toast.updated'));
    } else {
      await createAgreement(payload as CreateFrameworkAgreementDTO);
      toast.success(t('hub.frameworkAgreements.toast.created'));
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteAgreement(deleteTarget.id);
      toast.success(t('hub.frameworkAgreements.toast.deleted'));
      if (selectedAgreementId === deleteTarget.id) handleDeselectAgreement();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleteTarget(null);
    }
  }

  const listProps = {
    agreements: filtered,
    vendorNamesById,
    loading,
    hasFilters,
    selectedAgreementId,
    onSelectAgreement: handleSelectAgreement,
  };

  const rightPane = selectedAgreement ? (
    <AgreementDetail
      agreement={selectedAgreement}
      onEdit={handleEdit}
      onDelete={setDeleteTarget}
    />
  ) : null;

  return (
    <PageContainer ariaLabel={t('hub.frameworkAgreements.title')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>

      {/* Filters bar + Create button above the split */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b">
        <FrameworkAgreementFilters
          search={search}
          onSearchChange={setSearch}
          status={statusFilter}
          onStatusChange={setStatusFilter}
        />
        <Button onClick={handleNew} size="sm" className="shrink-0">
          <Plus className="h-4 w-4 mr-1" aria-hidden />
          {t('hub.frameworkAgreements.create')}
        </Button>
      </div>

      <ListContainer>
        <>
          {/* ── Desktop: split list + detail ───────────────────────────────── */}
          <section
            className="hidden md:flex flex-1 gap-2 min-h-0 min-w-0 overflow-hidden"
            aria-label={t('hub.frameworkAgreements.title')}
          >
            <AgreementSlimList {...listProps} />

            {rightPane ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-card border rounded-lg shadow-sm p-4">
                {rightPane}
              </div>
            ) : (
              <DetailsContainer
                emptyStateProps={{
                  icon: ScrollText,
                  title: t('hub.frameworkAgreements.detail.emptyTitle'),
                  description: t('hub.frameworkAgreements.detail.emptyDescription'),
                }}
                onCreateAction={handleNew}
              />
            )}
          </section>

          {/* ── Mobile: list (hidden when agreement selected) ───────────────── */}
          <section
            className={`md:hidden flex-1 min-h-0 overflow-hidden ${selectedAgreement ? 'hidden' : 'block'}`}
            aria-label={t('hub.frameworkAgreements.title')}
          >
            <AgreementSlimList {...listProps} />
          </section>

          {/* ── Mobile: slide-in detail overlay ────────────────────────────── */}
          <MobileDetailsSlideIn
            isOpen={!!selectedAgreement}
            onClose={handleDeselectAgreement}
            title={selectedAgreement?.title ?? ''}
          >
            {rightPane}
          </MobileDetailsSlideIn>
        </>
      </ListContainer>

      <FrameworkAgreementFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('hub.frameworkAgreements.deleteConfirm.title')}
        description={t('hub.frameworkAgreements.deleteConfirm.description', {
          name: deleteTarget?.title ?? '',
        })}
        confirmText={t('hub.frameworkAgreements.delete')}
        onConfirm={handleConfirmDelete}
        variant="destructive"
      />
    </PageContainer>
  );
}
