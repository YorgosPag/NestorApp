'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { PageContainer } from '@/core/containers';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFrameworkAgreements } from '@/hooks/procurement/useFrameworkAgreements';
import { usePOSupplierContacts } from '@/hooks/procurement/usePOSupplierContacts';
import { getContactDisplayName } from '@/types/contacts/helpers';
import { FrameworkAgreementList } from '@/components/procurement/agreements/FrameworkAgreementList';
import { FrameworkAgreementFilters } from '@/components/procurement/agreements/FrameworkAgreementFilters';
import { FrameworkAgreementFormDialog } from '@/components/procurement/agreements/FrameworkAgreementFormDialog';
import type {
  FrameworkAgreement,
  FrameworkAgreementStatus,
  CreateFrameworkAgreementDTO,
  UpdateFrameworkAgreementDTO,
} from '@/subapps/procurement/types/framework-agreement';

export default function AgreementsPage() {
  const { t } = useTranslation('procurement');
  const {
    agreements,
    loading,
    createAgreement,
    updateAgreement,
    deleteAgreement,
  } = useFrameworkAgreements();
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
    if (statusFilter) {
      list = list.filter((a) => a.status === statusFilter);
    }
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <PageContainer ariaLabel={t('hub.frameworkAgreements.title')}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <FrameworkAgreementFilters
            search={search}
            onSearchChange={setSearch}
            status={statusFilter}
            onStatusChange={setStatusFilter}
          />
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-1" aria-hidden />
            {t('hub.frameworkAgreements.create')}
          </Button>
        </div>

        <FrameworkAgreementList
          agreements={filtered}
          vendorNamesById={vendorNamesById}
          loading={loading}
          hasFilters={!!search.trim() || statusFilter !== null}
          onEdit={handleEdit}
          onDelete={setDeleteTarget}
        />
      </div>

      <FrameworkAgreementFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('hub.frameworkAgreements.deleteConfirm.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('hub.frameworkAgreements.deleteConfirm.description', {
                name: deleteTarget?.title ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('hub.frameworkAgreements.form.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('hub.frameworkAgreements.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
