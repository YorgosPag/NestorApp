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
import {
  AGREEMENT_BUCKET_PREDICATES,
  countAgreementBuckets,
  matchesAgreementBuckets,
} from '@/subapps/procurement/utils/framework-agreement-buckets';
import { useStatusDrillParam } from '@/components/projects/procurement/clients/useStatusDrillParam';
import { statusFilterCard } from '@/components/projects/procurement/clients/status-filter-card';
import { StatusDrillNotice } from '@/components/projects/procurement/clients/StatusDrillNotice';
import { usePOSupplierContacts, supplierNamesById } from '@/hooks/procurement/usePOSupplierContacts';
import type {
  FrameworkAgreement,
  CreateFrameworkAgreementDTO,
  UpdateFrameworkAgreementDTO,
} from '@/subapps/procurement/types/framework-agreement';
import routeSlice from '@/i18n/generated/routes/o__workspace__procurement__agreements.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

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

  const vendorNamesById = useMemo(() => supplierNamesById(suppliers), [suppliers]);

  const selectedAgreementId = searchParams.get('agreementId') ?? undefined;

  const selectedAgreement = useMemo(
    () => agreements.find((a) => a.id === selectedAgreementId) ?? null,
    [agreements, selectedAgreementId],
  );

  // ADR-330 §5.1 S3.4 — `?status=` = κουβάς (ενεργές · λήγουν · ληγμένες · πρόχειρες)· ΕΝΑΣ ορισμός με την κάρτα του hub.
  const drill = useStatusDrillParam(AGREEMENT_BUCKET_PREDICATES);
  const visibleAgreements = useMemo(() => {
    const nowMs = Date.now();
    return agreements.filter((a) => matchesAgreementBuckets(a, drill.statuses, nowMs));
  }, [agreements, drill.statuses]);

  const dashboardStats = useMemo(() => {
    const c = countAgreementBuckets(agreements, Date.now());
    return [
      { title: t('hub.frameworkAgreements.title'), value: agreements.length, icon: ScrollText, color: 'blue' as const },
      { title: t('filters.agreementStatus.active'), value: c.active, icon: CheckCircle, color: 'green' as const, ...statusFilterCard(drill, 'active', c.active) },
      { title: t('filters.agreementStatus.expiring'), value: c.expiring, icon: AlertTriangle, color: 'orange' as const, ...statusFilterCard(drill, 'expiring', c.expiring) },
      { title: t('filters.agreementStatus.expired'), value: c.expired, icon: Clock, color: 'red' as const, ...statusFilterCard(drill, 'expired', c.expired) },
      { title: t('filters.agreementStatus.draft'), value: c.draft, icon: FileEdit, color: 'gray' as const, ...statusFilterCard(drill, 'draft', c.draft) },
    ];
  }, [agreements, drill, t]);

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
    agreements: visibleAgreements,
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
      list={
        <>
          <StatusDrillNotice
            labels={drill.statuses.map((s) => t(`filters.agreementStatus.${s}`))}
            onClear={drill.clear}
          />
          <AgreementSlimList {...listProps} />
        </>
      }
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
        agreements={agreements}
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
