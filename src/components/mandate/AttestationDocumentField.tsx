'use client';

/**
 * @fileoverview **ΤΟ ΥΠΟΓΕΓΡΑΜΜΕΝΟ ΕΝΤΥΠΟ, ΑΝΕΒΑΣΜΕΝΟ ΣΤΟ ΣΥΣΤΗΜΑ ΑΡΧΕΙΩΝ** (ADR-864 Ε-12 · §18.4 Δ1 · Α23).
 * @related services/filesystem/upload-entity-file.ts · services/mandate/attestation-document.ts
 * @module components/mandate/AttestationDocumentField
 *
 * 🔑 **Ο κανονικός αγωγός, όχι δεύτερος**: `FileRecord` του **γραφείου**, δεμένο στην **αγγελία**
 * (`owner_property` / `ownerPropertyId`), στο `companies/{c}/entities/…` — ίχνος, κάδος και εκδόσεις του συστήματος
 * αρχείων ισχύουν αυτούσια. Προς τα πάνω φεύγει **μόνο** η ταυτότητα (`fileId`)· τη διαδρομή τη γράφει ο διακομιστής.
 *
 * ⚠️ **Τέσσερις καταστάσεις, ποτέ `boolean`**: «δεν ανέβηκε» · «ανεβαίνει» · «ανέβηκε» · «απέτυχε» — η φόρμα
 * ενεργοποιεί την υποβολή **μόνο** στο «ανέβηκε» (Α23, διεπαφή· ο διακομιστής το ξανακρίνει).
 */

import React from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { FileUploadButton } from '@/components/shared/files/FileUploadButton';
import { ENTITY_TYPES, FILE_CATEGORIES, FILE_DOMAINS } from '@/config/domain-constants';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { validateUploadAuth } from '@/services/filesystem/file-mutation-gateway';
import { uploadEntityFile } from '@/services/filesystem/upload-entity-file';

const NS = 'property-market';
const K = `${NS}:mandate.privateMarketing.agency`;

/** Ο σκοπός του αρχείου — το ξεχωρίζει από κάθε άλλο συμβόλαιο της ίδιας αγγελίας. */
const ATTESTATION_PURPOSE = 'private-marketing-attestation';

export type AttestationDocumentState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'uploading' }
  | { readonly kind: 'attached'; readonly fileId: string; readonly name: string }
  | { readonly kind: 'failed' };

export function AttestationDocumentField({
  ownerPropertyId,
  state,
  onChange,
}: {
  readonly ownerPropertyId: string;
  readonly state: AttestationDocumentState;
  readonly onChange: (next: AttestationDocumentState) => void;
}): React.ReactElement {
  const { t } = useTranslation([NS]);
  const { user } = useAuth();
  const companyId = useCompanyId()?.companyId ?? null;

  const upload = async (file: File): Promise<void> => {
    if (user === null || companyId === null) return onChange({ kind: 'failed' });
    onChange({ kind: 'uploading' });
    try {
      await validateUploadAuth(companyId);
      const uploaded = await uploadEntityFile(
        {
          companyId,
          entityType: ENTITY_TYPES.OWNER_PROPERTY,
          entityId: ownerPropertyId,
          domain: FILE_DOMAINS.LEGAL,
          category: FILE_CATEGORIES.CONTRACTS,
          purpose: ATTESTATION_PURPOSE,
          createdBy: user.uid,
        },
        file,
      );
      onChange({ kind: 'attached', fileId: uploaded.fileId, name: uploaded.displayName ?? file.name });
    } catch {
      onChange({ kind: 'failed' });
    }
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold text-card-foreground">{t(`${K}.documentLabel`)}</legend>
      <FileUploadButton
        onFileSelect={(file) => void upload(file)}
        accept="application/pdf,image/*"
        buttonText={t(state.kind === 'attached' ? `${K}.documentReplace` : `${K}.documentPick`)}
        loading={state.kind === 'uploading'}
        disabled={state.kind === 'uploading'}
      />
      {state.kind === 'attached' && <p className="text-sm text-card-foreground">{t(`${K}.documentAttached`, { name: state.name })}</p>}
      {state.kind === 'failed' && <p role="alert" className="text-sm font-medium text-destructive">{t(`${K}.documentFailed`)}</p>}
    </fieldset>
  );
}
