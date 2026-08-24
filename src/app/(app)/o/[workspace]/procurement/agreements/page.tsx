'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, usePathname } from '@/lib/workspace/navigation';
import { declaredHref } from '@/lib/workspace/route-worlds';
import { useSearchParams } from 'next/navigation';
import { ScrollText, FileEdit, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { AgreementSlimList } from '@/components/procurement/agreements/AgreementSlimList';
import { AgreementDetail } from '@/components/procurement/agreements/AgreementDetail';
import { FrameworkAgreementFormDialog } from '@/components/procurement/agreements/FrameworkAgreementFormDialog';
import { runHubDelete } from '@/components/procurement/hub/hub-delete';
import { ProcurementHubPage, useProcurementHubChrome } from '@/components/procurement/hub/ProcurementHubPage';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFrameworkAgreements } from '@/hooks/procurement/useFrameworkAgreements';
import { usePOSupplierContacts } from '@/hooks/procurement/usePOSupplierContacts';
import { getContactDisplayName } from '@/types/contacts';
import type {
  FrameworkAgreement,
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

  const chrome = useProcurementHubChrome();
  const { viewMode } = chrome;
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

  const selectedAgreementId = searchParams.get('agreementId') ?? undefined;

  const selectedAgreement = useMemo(
    () => agreements.find((a) => a.id === selectedAgreementId) ?? null,
    [agreements, selectedAgreementId],
  );

  const dashboardStats = useMemo(() => {
    const now = Date.now();
    const total = agreements.length;
    const active = agreements.filter((a) => {
      const ms = a.validUntil?.toMillis?.() ?? 0;
      return a.status === 'active' && ms > now;
    }).length;
    const expiring = agreements.filter((a) => {
      if (a.status !== 'active') return false;
      const ms = a.validUntil?.toMillis?.() ?? 0;
      const days = (ms - now) / 86400000;
      return days >= 0 && days <= 30;
    }).length;
    const expired = agreements.filter((a) => {
      const ms = a.validUntil?.toMillis?.() ?? 0;
      return a.status === 'expired' || ms < now;
    }).length;
    const drafts = agreements.filter((a) => a.status === 'draft').length;
    return [
      { title: t('hub.frameworkAgreements.title'), value: total, icon: ScrollText, color: 'blue' as const },
      { title: t('filters.agreementStatus.active'), value: active, icon: CheckCircle, color: 'green' as const },
      { title: t('filters.agreementStatus.expiring'), value: expiring, icon: AlertTriangle, color: 'orange' as const },
      { title: t('filters.agreementStatus.expired'), value: expired, icon: Clock, color: 'red' as const },
      { title: t('filters.agreementStatus.draft'), value: drafts, icon: FileEdit, color: 'gray' as const },
    ];
  }, [agreements, t]);

  const handleSelectAgreement = useCallback(
    (agreement: FrameworkAgreement) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('agreementId', agreement.id);
      router.replace(
        declaredHref('usePathname() είναι ΗΔΗ η έγκυρη τρέχουσα σελίδα — ενημέρωση ερωτήματος, όχι νέος προορισμός.', `${pathname}?${params.toString()}`),
      );
    },
    [router, searchParams, pathname],
  );

  const handleDeselectAgreement = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('agreementId');
    router.replace(
        declaredHref('usePathname() είναι ΗΔΗ η έγκυρη τρέχουσα σελίδα — ενημέρωση ερωτήματος, όχι νέος προορισμός.', `${pathname}?${params.toString()}`),
      );
  }, [router, searchParams, pathname]);

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
    await runHubDelete({
      remove: () => deleteAgreement(deleteTarget.id),
      successMessage: t('hub.frameworkAgreements.toast.deleted'),
      onSuccess: () => { if (selectedAgreementId === deleteTarget.id) handleDeselectAgreement(); },
      onSettled: () => setDeleteTarget(null),
    });
  }

  const handleEditFromList = useCallback((id: string) => {
    const a = agreements.find((x) => x.id === id);
    if (a) handleEdit(a);
  }, [agreements]);

  const handleDeleteFromList = useCallback((id: string) => {
    const a = agreements.find((x) => x.id === id);
    if (a) setDeleteTarget(a);
  }, [agreements]);

  const listProps = {
    agreements,
    vendorNamesById,
    loading,
    selectedAgreementId,
    onSelectAgreement: handleSelectAgreement,
    onCreateNew: handleNew,
    onEditAgreement: handleEditFromList,
    onDeleteAgreement: handleDeleteFromList,
    viewMode,
  };

  const rightPane = selectedAgreement ? (
    <AgreementDetail
      agreement={selectedAgreement}
      onEdit={handleEdit}
      onDelete={setDeleteTarget}
      onCreateNew={handleNew}
    />
  ) : null;

  return (
    <ProcurementHubPage
      icon={ScrollText}
      title={t('hub.frameworkAgreements.title')}
      subtitle={t('hub.frameworkAgreements.description')}
      dashboardColumns={5}
      chrome={chrome}
      dashboardStats={dashboardStats}
      list={<AgreementSlimList {...listProps} />}
      detail={rightPane}
      emptyState={{
        icon: ScrollText,
        title: t('hub.frameworkAgreements.detail.emptyTitle'),
        description: t('hub.frameworkAgreements.detail.emptyDescription'),
      }}
      onCreateAction={handleNew}
      detailOpen={!!selectedAgreement}
      detailTitle={selectedAgreement?.title ?? ''}
      onDetailClose={handleDeselectAgreement}
    >


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
    </ProcurementHubPage>
  );
}
