'use client';

/**
 * ADR-942 Φ2 — η πλευρά του **γραφείου** στο δόσιμο: «Δώσε από τον φάκελο» (ρητό, με τη δήλωση σκοπού στην επιβεβαίωση)
 * και, ανά στοιχείο, τα αρχεία που δόθηκαν με «Ανάκληση». Τίποτα δεν αποφασίζεται εδώ: ο server ξανακρίνει το αρχείο,
 * γράφει το ιστορικό και ειδοποιεί· η λίστα ξαναδιαβάζεται, γιατί το «δόθηκε» **παράγεται**.
 *
 * @module components/document-registry/RegistryIssuanceProvisions
 */

import React, { useCallback, useState } from 'react';
import { Share2, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/providers/NotificationProvider';
import { giveIssuanceDocument, revokeIssuanceProvision } from '@/services/document-registry/document-registry.client';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { IssuanceDocumentRequests, IssuanceFolderFile, IssuanceGivenFile, IssuanceRequestItemView } from '@/types/issuance-document-request';
import { ISSUANCE_REQUEST_KEYS, ISSUANCE_RETENTION_NOTICE_KEYS } from './issuance-request-labels';
import type { RegistryIssuanceView } from './registry-issuance';

/** Η δήλωση σκοπού (ΓΚΠΔ άρθρο 13) — `null` όταν το είδος δεν έχει βάση τήρησης. */
export function useRetentionNotice(panel: Pick<IssuanceDocumentRequests, 'retentionBasis'>): string | null {
  const { t } = useTranslation(['document-registry']);
  return panel.retentionBasis === null ? null : t(ISSUANCE_RETENTION_NOTICE_KEYS[panel.retentionBasis]);
}

interface ProvisionActions {
  readonly busy: boolean;
  readonly give: (file: IssuanceFolderFile) => Promise<void>;
  readonly revoke: (file: IssuanceGivenFile) => Promise<void>;
}

/** Οι δύο πράξεις, με μηνύματα και ξαναδιάβασμα — ένα πάτημα τη φορά. */
export function useProvisionActions(view: RegistryIssuanceView, onChanged: () => void): ProvisionActions {
  const { t } = useTranslation(['document-registry']);
  const { success, error } = useNotifications();
  const [busy, setBusy] = useState(false);
  const { propertyId, kind: documentKind } = view;
  const run = useCallback(async (act: () => Promise<{ readonly kind: string }>, ok: string, failed: string) => {
    setBusy(true);
    try {
      const result = await act();
      if (result.kind === 'ok') { success(t(ok)); onChanged(); } else error(t(failed));
    } finally {
      setBusy(false);
    }
  }, [onChanged, success, error, t]);
  const give = useCallback((file: IssuanceFolderFile) => run(
    () => giveIssuanceDocument({ propertyId, documentKind, fileId: file.fileId }), ISSUANCE_REQUEST_KEYS.given, ISSUANCE_REQUEST_KEYS.giveFailed,
  ), [run, propertyId, documentKind]);
  const revoke = useCallback((file: IssuanceGivenFile) => run(
    () => revokeIssuanceProvision({ propertyId, documentKind, provisionId: file.provisionId }), ISSUANCE_REQUEST_KEYS.revoked, ISSUANCE_REQUEST_KEYS.revokeFailed,
  ), [run, propertyId, documentKind]);
  return { busy, give, revoke };
}

/** «Δώσε από τον φάκελο»: επιλογή αρχείου → επιβεβαίωση **με** τη δήλωση σκοπού → δόσιμο. */
export function GiveExistingAction({ item, notice, actions }: {
  readonly item: IssuanceRequestItemView;
  readonly notice: string | null;
  readonly actions: ProvisionActions;
}) {
  const { t } = useTranslation(['document-registry']);
  const iconSizes = useIconSizes();
  const [chosen, setChosen] = useState<IssuanceFolderFile | null>(null);
  if (item.candidates.length === 0) return null;
  return (
    <>
      <Select value="" onValueChange={(fileId) => setChosen(item.candidates.find((file) => file.fileId === fileId) ?? null)} disabled={actions.busy}>
        <SelectTrigger className="h-8 w-auto gap-1 text-xs" aria-label={t(ISSUANCE_REQUEST_KEYS.giveExisting)}>
          <Share2 className={iconSizes.xs} aria-hidden="true" />
          <SelectValue placeholder={t(ISSUANCE_REQUEST_KEYS.giveExisting)} />
        </SelectTrigger>
        <SelectContent>
          {item.candidates.map((file) => (
            <SelectItem key={file.fileId} value={file.fileId}>{`${file.fileName} · ${formatDate(file.createdAt)}`}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ConfirmDialog
        open={chosen !== null}
        onOpenChange={(open) => { if (!open) setChosen(null); }}
        title={t(ISSUANCE_REQUEST_KEYS.giveConfirmTitle, { name: chosen?.fileName ?? '' })}
        description={notice ?? t(ISSUANCE_REQUEST_KEYS.sharingLead)}
        confirmText={t(ISSUANCE_REQUEST_KEYS.giveConfirmConfirm)}
        cancelText={t(ISSUANCE_REQUEST_KEYS.giveConfirmCancel)}
        loading={actions.busy}
        onConfirm={async () => { if (chosen) await actions.give(chosen); setChosen(null); }}
      />
    </>
  );
}

/** Ένα δοσμένο αρχείο: όνομα · «δόθηκε στις» · «Ανάκληση» (μόνο με δικαίωμα πράξης). */
function GivenFileRow({ file, busy, onRevoke }: {
  readonly file: IssuanceGivenFile;
  readonly busy: boolean;
  readonly onRevoke: (() => void) | null;
}) {
  const { t } = useTranslation(['document-registry']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="min-w-0 truncate">
        <span className="font-medium">{file.fileName}</span>
        <span className={cn('ml-1', colors.text.muted)}>{t(ISSUANCE_REQUEST_KEYS.givenToEngineer, { date: formatDate(file.givenAt) })}</span>
      </span>
      {onRevoke !== null && (
        <Button variant="ghost" size="sm" className="h-7 gap-1" disabled={busy} onClick={onRevoke}>
          <ShieldOff className={iconSizes.xs} aria-hidden="true" />
          {t(ISSUANCE_REQUEST_KEYS.revoke)}
        </Button>
      )}
    </li>
  );
}

/** Τα αρχεία που δόθηκαν για ένα στοιχείο — με «Ανάκληση» (επιβεβαίωση: ό,τι κατέβηκε δεν σβήνεται). */
export function GivenFilesOffice({ item, actions, canAct }: {
  readonly item: IssuanceRequestItemView;
  readonly actions: ProvisionActions;
  readonly canAct: boolean;
}) {
  const { t } = useTranslation(['document-registry']);
  const [revoking, setRevoking] = useState<IssuanceGivenFile | null>(null);
  if (item.given.length === 0) return null;
  return (
    <>
      <ul className="basis-full space-y-1">
        {item.given.map((file) => (
          <GivenFileRow key={file.provisionId} file={file} busy={actions.busy} onRevoke={canAct ? () => setRevoking(file) : null} />
        ))}
      </ul>
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => { if (!open) setRevoking(null); }}
        title={t(ISSUANCE_REQUEST_KEYS.revokeConfirmTitle)}
        description={t(ISSUANCE_REQUEST_KEYS.revokeConfirmDescription, { name: revoking?.fileName ?? '' })}
        confirmText={t(ISSUANCE_REQUEST_KEYS.revokeConfirmConfirm)}
        cancelText={t(ISSUANCE_REQUEST_KEYS.revokeConfirmCancel)}
        variant="destructive"
        loading={actions.busy}
        onConfirm={async () => { if (revoking) await actions.revoke(revoking); setRevoking(null); }}
      />
    </>
  );
}
