'use client';

/**
 * @fileoverview **«Αρχείο · δεν διαγράφεται»** — το σήμα ενός record στη γραμμή αρχείου, με εξήγηση (ADR-916 Φ-Δ.6 · Ο14).
 * @related lib/files/file-hold.ts (`isDeclaredRecord` — ο ΕΝΑΣ κριτής, ίδιος με την πόρτα κάδου) · FilesList.tsx
 * @module components/shared/files/FileRecordBadge
 *
 * 🔑 Microsoft Purview δείχνει το record **στο ίδιο το αρχείο** και εξηγεί γιατί η διαγραφή λείπει — το κουμπί που
 *    λείπει χωρίς εξήγηση μοιάζει με σφάλμα. Η εξήγηση ζει σε tooltip του SSoT (ποτέ `title=`, CHECK 3.23).
 * 🔑 Η κατάσταση με **λέξη**, το εικονίδιο μόνο συνοδεύει (CHECK 3.41).
 */

import React from 'react';
import { Lock } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getStatusColor } from '@/lib/design-system';
import { isDeclaredRecord, type FileRecordSubject } from '@/lib/files/file-hold';

export function FileRecordBadge({ file }: { readonly file: FileRecordSubject }): React.ReactElement | null {
  const { t } = useTranslation(['files', 'files-media']);
  const iconSizes = useIconSizes();
  if (!isDeclaredRecord(file)) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          data-record="true"
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${getStatusColor('info', 'bg')}/15 ${getStatusColor('info', 'text')}`}
        >
          <Lock className={iconSizes.xs} aria-hidden="true" />
          {t('list.record')}
        </span>
      </TooltipTrigger>
      <TooltipContent>{t('list.recordExplain')}</TooltipContent>
    </Tooltip>
  );
}
