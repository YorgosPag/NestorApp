'use client';

/**
 * **Αναστολή / Επανενεργοποίηση ΛΟΓΑΡΙΑΣΜΟΥ** (ADR-244 · πλατφόρμας, `super_admin`).
 *
 * 🔴 ADR-892 Φ2β (§12): κρίνει από το **`disabled`** του λογαριασμού, **όχι** από την κατάσταση μέλους —
 * εκείνη ανήκει πλέον στην «Παύση πρόσβασης» του γραφείου (δύο πράξεις, δύο καταστάσεις, δύο κάτοχοι ·
 * Atlassian: deactivate account ≠ suspend access). Εξάχθηκε από το `UsersTab` (N.7.1).
 * ⏳ Φ4: μετακομίζει σε εργαλείο πλατφόρμας.
 *
 * @module components/admin/role-management/components/AccountSuspendDialog
 */

import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES } from '@/config/domain-constants';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { useNotifications } from '@/providers/NotificationProvider';

import type { CompanyUser } from '../types';

/** Το όριο της διαδρομής (`StatusChangeSchema`: `min(10)`). */
const MIN_REASON_CHARS = 10;

interface AccountSuspendDialogProps {
  readonly user: CompanyUser;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

function useAccountStatusSubmit(user: CompanyUser, reason: string, onSuccess: () => void) {
  const { t } = useTranslation('admin');
  const { success, error: notifyError } = useNotifications();
  const suspending = !user.disabled;

  return useCallback(async () => {
    if (reason.trim().length < MIN_REASON_CHARS) return;
    try {
      await apiClient.patch<Record<string, unknown>>(
        API_ROUTES.ADMIN.ROLE_MANAGEMENT.USER_STATUS(user.uid),
        { action: suspending ? 'suspend' : 'reactivate', reason },
      );
      success(suspending ? t('roleManagement.status.suspendSuccess') : t('roleManagement.status.reactivateSuccess'));
      onSuccess();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : t('roleManagement.status.error'));
    }
  }, [user.uid, suspending, reason, success, notifyError, t, onSuccess]);
}

export function AccountSuspendDialog({ user, onClose, onSuccess }: AccountSuspendDialogProps) {
  const { t } = useTranslation('admin');
  const [reason, setReason] = useState('');
  const submit = useAccountStatusSubmit(user, reason, onSuccess);
  const suspending = !user.disabled;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {suspending ? t('roleManagement.status.suspendTitle') : t('roleManagement.status.reactivateTitle')}
          </DialogTitle>
          <DialogDescription>
            {suspending ? t('roleManagement.status.suspendConfirm') : t('roleManagement.status.reactivateConfirm')}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <p className="text-sm">
            <strong>{user.displayName ?? user.email}</strong>
            {' '}({user.email})
          </p>
          <label className="block">
            <span className="text-sm font-medium">
              {t('roleManagement.status.reason')} ({t('roleManagement.permissionSets.minChars')})
            </span>
            <Textarea
              className="mt-1"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('roleManagement.status.reasonPlaceholder')}
            />
          </label>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('roleManagement.permissionSets.cancel')}
          </Button>
          <Button
            variant={suspending ? 'destructive' : 'default'}
            disabled={reason.trim().length < MIN_REASON_CHARS}
            onClick={submit}
          >
            {suspending ? t('roleManagement.actions.suspendAccount') : t('roleManagement.actions.reactivateAccount')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
