'use client';

/**
 * **Επαναφορά πρόσβασης** (ADR-892 Φ2β, §12) — `suspended → active`, **ίδιος** ρόλος και θητεία.
 *
 * Δείχνει **ποιος, πότε, γιατί** έβαλε την παύση (η απόφαση που αναιρείται), και μετά το κουμπί. Καμία
 * προεπισκόπηση από τον διακομιστή: η επαναφορά δεν αφαιρεί τίποτα, και ο κριτής ξανακρίνει στην πράξη
 * (εαυτός · ανώτερος) — η άρνηση φτάνει με όνομα. Καμία αποσύνδεση, κανένα νέο claim.
 *
 * @module components/admin/role-management/components/RestoreAccessDialog
 * @see docs/centralized-systems/reference/adrs/ADR-892-workspace-member-removal.md §12
 */

import { useCallback, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatRelativeTime } from '@/lib/intl-formatting';

import type { CompanyUser } from '../types';
import { MEMBER_EXIT_NS, MEMBER_RESTORE_KEYS } from '../member-exit-labels';
import { restoreMemberAccess } from '../useMemberExit';
import { DialogConfirmFooter } from './DialogConfirmFooter';
import { MemberCard, ReasonField, RefusalNotice, useMemberActionSubmit } from './member-dialog-parts';

interface RestoreAccessDialogProps {
  readonly user: CompanyUser;
  /** Τα μέλη του γραφείου — για να ονομαστεί όποιος έβαλε την παύση. */
  readonly members: readonly CompanyUser[];
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

/** Ποιος/πότε/γιατί — από το `accessPause` της γραμμής. Απόν (παλιά παύση χωρίς ίχνος) ⇒ τίποτα, ποτέ εφεύρεση. */
function PauseRecord({ user, members }: { user: CompanyUser; members: readonly CompanyUser[] }) {
  const { t } = useTranslation(['admin', MEMBER_EXIT_NS]);
  const pause = user.accessPause;
  if (pause === null) return null;
  const actor = members.find((m) => m.uid === pause.pausedByUid);
  const name = actor === undefined ? t('roleManagement.unnamed') : (actor.displayName ?? actor.email);
  const date = pause.pausedAt === null ? '' : formatRelativeTime(pause.pausedAt);
  return (
    <section className="space-y-1 rounded-lg border p-3 text-sm" aria-label={t(MEMBER_RESTORE_KEYS.title)}>
      <p>{t(MEMBER_RESTORE_KEYS.pausedBy, { name, date })}</p>
      {pause.reason !== null && <p>{t(MEMBER_RESTORE_KEYS.pausedReason, { reason: pause.reason })}</p>}
      <p>{t(MEMBER_RESTORE_KEYS.notified)}</p>
    </section>
  );
}

export function RestoreAccessDialog({ user, members, open, onClose, onSuccess }: RestoreAccessDialogProps) {
  const { t } = useTranslation(['admin', MEMBER_EXIT_NS]);
  const [reason, setReason] = useState('');
  const act = useCallback((input: string) => restoreMemberAccess(user.uid, input), [user.uid]);
  const { submit, isSubmitting, lateRefusal } = useMemberActionSubmit(MEMBER_RESTORE_KEYS, act, onSuccess);

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(MEMBER_RESTORE_KEYS.title)}</DialogTitle>
          <DialogDescription>{t(MEMBER_RESTORE_KEYS.description)}</DialogDescription>
        </DialogHeader>
        <MemberCard user={user} />
        {lateRefusal !== null ? (
          <RefusalNotice refusal={lateRefusal} onClose={onClose} />
        ) : (
          <>
            <PauseRecord user={user} members={members} />
            <ReasonField value={reason} onChange={setReason} />
            <DialogConfirmFooter
              onCancel={onClose}
              onConfirm={() => submit(reason)}
              confirmKey={MEMBER_RESTORE_KEYS.confirm}
              isSubmitting={isSubmitting}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
