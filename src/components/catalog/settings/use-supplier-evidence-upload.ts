'use client';

/**
 * **Το ανέβασμα μιας απόδειξης προμηθευτή** (ADR-923 §5.13 · §16): ίδιο δοχείο και ίδια κρίση για επιβεβαίωση επιχείρησης και μάρκα.
 *
 * @module components/catalog/settings/use-supplier-evidence-upload
 */

import React from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { ENTITY_TYPES, FILE_CATEGORIES, FILE_DOMAINS } from '@/config/domain-constants';
import { useCompanyId } from '@/hooks/useCompanyId';
import { validateUploadAuth } from '@/services/filesystem/file-mutation-gateway';
import { uploadEntityFile } from '@/services/filesystem/upload-entity-file';

export function useSupplierEvidenceUpload(send: (fileId: string) => Promise<unknown>, onDone: () => void) {
  const { user } = useAuth();
  const companyId = useCompanyId()?.companyId ?? null;
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const submit = async (file: File) => {
    if (companyId === null) return;
    setBusy(true);
    setFailed(false);
    try {
      await validateUploadAuth(companyId);
      const { fileId } = await uploadEntityFile({
        custody: { companyId },
        entityType: ENTITY_TYPES.SUPPLIER_VERIFICATION,
        entityId: companyId,
        domain: FILE_DOMAINS.CATALOG,
        category: FILE_CATEGORIES.DOCUMENTS,
        entityLabel: file.name,
        createdBy: user?.uid ?? '',
        uploaderName: user?.displayName ?? undefined,
      }, file);
      await send(fileId);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
      onDone();
    }
  };
  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void submit(file);
  };
  return { busy, failed, onFile };
}
