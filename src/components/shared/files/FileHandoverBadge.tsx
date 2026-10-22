'use client';

/**
 * @fileoverview **Το σήμα προέλευσης παράδοσης μιας γραμμής αρχείου** (ADR-916 Φ-Γ1 · Φ-Γ2 Σ5) — «από την κατασκευάστρια»
 *               ή «Πρωτόκολλο παράδοσης · αναθ. N». Ένα component για **και τα δύο** διαμερίσματα (`files` · `files_personal`).
 * @related lib/property-handover/file-handover-origin.ts (οι δύο αναγνώστες) · FilesList.tsx (ο καταναλωτής)
 * @module components/shared/files/FileHandoverBadge
 *
 * 🔑 **Το Πρωτόκολλο νικά**: το αντίτυπο του αγοραστή κουβαλά **και** `handoverOrigin` **και** `handoverProtocolOf` — ένα
 *    σήμα, το πιο ειδικό. Το αντίτυπο της εταιρείας κουβαλά μόνο το `handoverProtocolOf`.
 * 🔒 Λέει «Πρωτόκολλο», όχι «επαληθευμένο»: το σημάδι το γράφει **μόνο** ο γραφέας μετά από έγκυρη σφράγιση και ο κανόνας
 *    απαγορεύει στον πελάτη να το προσθέσει/αλλάξει/αφαιρέσει — η επαλήθευση από τρίτο είναι η πόρτα της Σ6.
 * 🔑 Η κατάσταση με **λέξη**, το εικονίδιο μόνο συνοδεύει (CHECK 3.41).
 */

import React from 'react';
import { PackageCheck, Stamp } from 'lucide-react';

import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getStatusColor } from '@/lib/design-system';
import { readFileHandoverOrigin, readFileHandoverProtocolOf } from '@/lib/property-handover/file-handover-origin';
import type { FileRecord } from '@/types/file-record';

export type FileHandoverBadgeKind =
  | { readonly kind: 'protocol'; readonly revision: number }
  | { readonly kind: 'origin' }
  | { readonly kind: 'none' };

type BadgeSubject = Pick<FileRecord, 'handoverOrigin' | 'handoverProtocolOf'>;

/** **Ποιο σήμα** — καθαρή κρίση πάνω στα ωμά σημάδια· αλλοιωμένο σημάδι ⇒ σαν να μην υπάρχει. */
export function fileHandoverBadgeOf(file: BadgeSubject): FileHandoverBadgeKind {
  const protocol = readFileHandoverProtocolOf(file.handoverProtocolOf);
  if (protocol !== null) return { kind: 'protocol', revision: protocol.revision };
  return readFileHandoverOrigin(file.handoverOrigin) !== null ? { kind: 'origin' } : { kind: 'none' };
}

export function FileHandoverBadge({ file }: { readonly file: BadgeSubject }): React.ReactElement | null {
  const { t } = useTranslation(['files', 'files-media']);
  const iconSizes = useIconSizes();
  const badge = fileHandoverBadgeOf(file);
  if (badge.kind === 'none') return null;
  const Icon = badge.kind === 'protocol' ? Stamp : PackageCheck;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${getStatusColor('active', 'bg')}/15 ${getStatusColor('active', 'text')}`}>
      <Icon className={iconSizes.xs} aria-hidden="true" />
      {badge.kind === 'protocol' ? t('list.handoverProtocol', { revision: badge.revision }) : t('list.handoverOrigin')}
    </span>
  );
}
