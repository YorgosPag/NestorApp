'use client';

/**
 * @fileoverview **Πού ανεβαίνει το ΠΕΑ, ανά κάτοχο** (ADR-777 §8.96) — οι δύο θύρες του `useEnergyCertificateImport`.
 * @related `config/upload-entry-points/energy-certificate-slot.ts` (ο τύπος εγγράφου, από τον κατάλογο) ·
 *   `features/properties-sidebar/components/property-files-tab.tsx` (η καρτέλα «Έγγραφα» του γραφείου) ·
 *   `hooks/owner-property/useOwnershipVerification.ts` (ίδιος αγωγός για τον φάκελο του ιδιώτη)
 * @module hooks/energy-certificate/useEnergyCertificateImportPorts
 *
 * 🔑 **Ίδια ταυτότητα με την καρτέλα «Έγγραφα»**: ίδιος κάτοχος, ίδιο δοχείο, ίδιος τύπος εγγράφου ⇒ το αρχείο
 * εμφανίζεται εκεί χωρίς αντίγραφο, και ο server το αναγνωρίζει ως «δικό σου, αυτού του ακινήτου».
 * 🔑 `null` = δεν υπάρχει πού να ανέβει (ακίνητο που δεν σώθηκε ακόμη · αγγελία χωρίς φάκελο · χωρίς σύνδεση) ⇒
 * η οθόνη δεν δείχνει κουμπί, αντί να δείξει κουμπί που αποτυγχάνει.
 */

import { useMemo } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { energyCertificateSlot } from '@/config/upload-entry-points/energy-certificate-slot';
import { useCompanyId } from '@/hooks/useCompanyId';
import { custodyOf } from '@/lib/owner-property/listing-custody';
import { isPersistedPropertyId } from '@/lib/properties/unsaved-property';
import { validateCustodyUploadAuth } from '@/services/filesystem/file-mutation-gateway';
import { uploadEntityFile } from '@/services/filesystem/upload-entity-file';
import type { FileCustody } from '@/lib/files/file-custody';
import type { EntityType } from '@/config/domain-constants';
import type { EnergyCertificateImportPort } from '@/lib/energy-certificate/pea-import-outcome';
import type { OwnerProperty } from '@/types/owner-property';

const importUrlOf = (base: 'properties' | 'owner-properties', id: string): string =>
  `/api/${base}/${encodeURIComponent(id)}/energy-certificate-import`;

interface UploadTarget {
  readonly custody: FileCustody;
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly entityLabel?: string;
  readonly createdBy: string;
}

/** Ο ΕΝΑΣ τρόπος ανεβάσματος ΠΕΑ: κανονικός αγωγός, τύπος εγγράφου από τον κατάλογο. */
function uploaderOf(target: UploadTarget): ((file: File) => Promise<string>) | null {
  const slot = energyCertificateSlot();
  if (slot === null) return null;
  return async (file: File) => {
    await validateCustodyUploadAuth(target.custody);
    const { fileId } = await uploadEntityFile({ ...target, ...slot }, file);
    return fileId;
  };
}

/** Ακίνητο του γραφείου → «Έγγραφα» της καρτέλας του (εταιρεία της συνεδρίας, `property`). */
export function useCompanyPropertyImportPort(
  property: { readonly id?: string; readonly name?: string } | null,
): EnergyCertificateImportPort | null {
  const { user } = useAuth();
  const companyId = useCompanyId()?.companyId ?? null;
  const propertyId = property?.id ?? null;
  const label = property?.name;
  return useMemo(() => {
    if (!isPersistedPropertyId(propertyId) || user === null || companyId === null) return null;
    const upload = uploaderOf({
      custody: { companyId },
      entityType: ENTITY_TYPES.PROPERTY,
      entityId: propertyId,
      entityLabel: label,
      createdBy: user.uid,
    });
    return upload === null ? null : { upload, endpoint: importUrlOf('properties', propertyId) };
  }, [propertyId, label, user, companyId]);
}

/** Αγγελία ιδιώτη → ο **φάκελος** του ακινήτου (`property_dossier`, ιδιωτικός χώρος του κατόχου). */
export function useOwnerPropertyImportPort(property: OwnerProperty): EnergyCertificateImportPort | null {
  const custody = custodyOf(property);
  const userId = custody.kind === 'personal' ? custody.userId : null;
  const dossierId = property.dossierId ?? null;
  const { id } = property;
  return useMemo(() => {
    if (userId === null || dossierId === null) return null;
    const upload = uploaderOf({
      custody: { userId },
      entityType: ENTITY_TYPES.PROPERTY_DOSSIER,
      entityId: dossierId,
      createdBy: userId,
    });
    return upload === null ? null : { upload, endpoint: importUrlOf('owner-properties', id) };
  }, [userId, dossierId, id]);
}
