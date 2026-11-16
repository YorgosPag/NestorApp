'use client';

/**
 * ADR-942 Φ2 — η πλευρά του **μηχανικού** στο δόσιμο: ανά στοιχείο, τα αρχεία που του έδωσε το γραφείο, με «Άνοιγμα» και
 * «Λήψη» μέσα από την **ίδια** πόρτα με τη μεταβίβαση (`useCaseFileOpening` → `/api/engagements/{id}/files/{fileId}`).
 * Ο server κρίνει σε **κάθε** άνοιγμα (συμμετοχή · δόσιμο · παράθυρο) και γράφει το ίχνος· εδώ μόνο τα κουμπιά.
 *
 * @module components/conveyance/my-cases/EngagedIssuanceGivenFiles
 */

import React from 'react';
import { Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ISSUANCE_REQUEST_KEYS } from '@/components/document-registry/issuance-request-labels';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { CaseFileMode } from '@/lib/conveyance/case-activity';
import { formatDate } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { IssuanceDocumentRequests, IssuanceGivenFile, IssuanceRequestItemView } from '@/types/issuance-document-request';

export type OpenGivenFile = (file: IssuanceGivenFile, mode: CaseFileMode) => void;

/** Τα αρχεία που δόθηκαν για ένα στοιχείο — «Άνοιγμα» · «Λήψη». */
export function GivenFilesEngaged({ item, openFile }: { readonly item: IssuanceRequestItemView; readonly openFile: OpenGivenFile }) {
  const { t } = useTranslation(['document-registry']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  if (item.given.length === 0) return null;
  return (
    <ul className="basis-full space-y-1">
      {item.given.map((file) => (
        <li key={file.provisionId} className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="min-w-0 truncate">
            <span className="font-medium">{file.fileName}</span>
            <span className={cn('ml-1', colors.text.muted)}>{t(ISSUANCE_REQUEST_KEYS.givenToYou, { date: formatDate(file.givenAt) })}</span>
          </span>
          <span className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => openFile(file, 'view')}>
              <Eye className={iconSizes.xs} aria-hidden="true" />
              {t(ISSUANCE_REQUEST_KEYS.open)}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => openFile(file, 'download')}>
              <Download className={iconSizes.xs} aria-hidden="true" />
              {t(ISSUANCE_REQUEST_KEYS.download)}
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Ε4 — πότε λήγει ή γιατί δεν ανοίγουν τα δοσμένα. Τίποτα όσο η ανάθεση εκτελείται ή όταν δεν δόθηκε τίποτα. */
export function GivenFilesAccessNote({ access }: { readonly access: IssuanceDocumentRequests['access'] }) {
  const { t } = useTranslation(['document-registry']);
  const colors = useSemanticColors();
  if (access === null) return null;
  const text = access === 'unknown'
    ? t(ISSUANCE_REQUEST_KEYS.accessUnknown)
    : access.open
      ? access.lastDay === null ? null : t(ISSUANCE_REQUEST_KEYS.accessUntil, { date: formatDate(access.lastDay) })
      : t(access.reason === 'lapsed' ? ISSUANCE_REQUEST_KEYS.accessLapsed : ISSUANCE_REQUEST_KEYS.accessClosed);
  return text === null ? null : <p className={cn('text-xs', colors.text.muted)}>{text}</p>;
}
