'use client';

/**
 * Τα **κοινά** κομμάτια των διαλόγων μέλους (ADR-892 Φ2/Φ2β) — αφαίρεση · παύση · επαναφορά.
 * Ένα σημείο, ώστε οι διάλογοι να μη γίνουν δίδυμοι (CHECK 3.28).
 *
 * @module components/admin/role-management/components/member-dialog-parts
 */

import { useCallback, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { ExitRefusalNotice, PreviewFailedNotice } from '@/components/workspace-membership/exit-dialog-parts';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { MEMBER_EXIT_REASON_MAX } from '@/lib/workspace/member-exit-policy';
import { useNotifications } from '@/providers/NotificationProvider';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import type { CompanyUser } from '../types';
import { MEMBER_EXIT_KEYS, MEMBER_EXIT_NS, MEMBER_EXIT_REFUSAL_KEY, type MemberExitRefusal } from '../member-exit-labels';
import type { MemberActionResult } from '../useMemberExit';

/** Ποιος — όνομα και email, πάνω από κάθε πράξη. */
export function MemberCard({ user }: { user: CompanyUser }) {
  const colors = useSemanticColors();
  return (
    <article className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
      <span className="text-sm font-medium">{user.displayName ?? user.email}</span>
      <span className={cn('text-xs', colors.text.muted)}>{user.email}</span>
    </article>
  );
}

/** Ο κριτής είπε «όχι» — με **όνομα**, και χωρίς κουμπί πράξης. */
export function RefusalNotice({ refusal, onClose }: { refusal: MemberExitRefusal; onClose: () => void }) {
  const { t } = useTranslation(['admin', MEMBER_EXIT_NS]);
  return (
    <ExitRefusalNotice message={t(MEMBER_EXIT_REFUSAL_KEY[refusal])} cancelLabel={t('common.cancel')} onClose={onClose} />
  );
}

/** Η προεπισκόπηση απέτυχε ⇒ **κανένα** κουμπί πράξης, μόνο επανάληψη (§7: η αποτυχία δεν μεταμφιέζεται). */
export function PreviewFailed({ onRetry, onClose }: { onRetry: () => void; onClose: () => void }) {
  const { t } = useTranslation(['admin', MEMBER_EXIT_NS]);
  return (
    <PreviewFailedNotice
      message={t(MEMBER_EXIT_KEYS.previewFailed)}
      cancelLabel={t('common.cancel')}
      retryLabel={t(MEMBER_EXIT_KEYS.retry)}
      onClose={onClose}
      onRetry={onRetry}
    />
  );
}

/** Προαιρετικός λόγος — ταξιδεύει σε ίχνος και ειδοποίηση· **ένα** όριο (`MEMBER_EXIT_REASON_MAX`) με τη διαδρομή. */
export function ReasonField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { t } = useTranslation(['admin', MEMBER_EXIT_NS]);
  return (
    <label className="block">
      <span className="text-sm font-medium">{t(MEMBER_EXIT_KEYS.reasonLabel)}</span>
      <Textarea
        className="mt-1"
        rows={2}
        maxLength={MEMBER_EXIT_REASON_MAX}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t(MEMBER_EXIT_KEYS.reasonPlaceholder)}
      />
    </label>
  );
}

/** Τα δύο κείμενα της έκβασης — κάθε διάλογος δίνει τα δικά του. */
interface OutcomeKeys {
  readonly success: string;
  /** 503: η επανάληψη είναι **ασφαλής** — ιδεμποτικό στον διακομιστή. */
  readonly error: string;
}

/**
 * Η πράξη → ειδοποίηση · άρνηση (μένει στον διάλογο, με όνομα) · αποτυχία (ασφαλής επανάληψη).
 * **Ένα** κέλυφος για αφαίρεση, παύση και επαναφορά.
 */
export function useMemberActionSubmit<I>(
  keys: OutcomeKeys,
  act: (input: I) => Promise<MemberActionResult>,
  onSuccess: () => void,
) {
  const { t } = useTranslation(['admin', MEMBER_EXIT_NS]);
  const { success, error: notifyError } = useNotifications();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lateRefusal, setLateRefusal] = useState<MemberExitRefusal | null>(null);

  const submit = useCallback(async (input: I) => {
    setIsSubmitting(true);
    const result = await act(input);
    setIsSubmitting(false);
    if (result.kind === 'done') {
      success(t(keys.success));
      onSuccess();
    } else if (result.kind === 'refused') {
      setLateRefusal(result.refusal);
    } else {
      notifyError(t(keys.error));
    }
  }, [keys, act, success, notifyError, t, onSuccess]);

  return { submit, isSubmitting, lateRefusal };
}
