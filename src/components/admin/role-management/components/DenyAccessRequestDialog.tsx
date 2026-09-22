'use client';

/**
 * **Απόρριψη αιτήματος ένταξης** (ADR-660 §6) — η άλλη μισή απάντηση στο `ApproveUserDialog`.
 *
 * Χωρίς αυτήν, ο διαχειριστής είχε μόνο «έγκριση» ή «σιωπή» — και η σιωπή άφηνε τον αιτούντα
 * να περιμένει για πάντα μια ειδοποίηση που του είχε **υποσχεθεί** η οθόνη αναμονής.
 * 🔒 Στέλνει **μόνο** το `uid`: ο διακομιστής βρίσκει το αίτημα **στον δικό του** χώρο.
 */

import { useCallback, useState } from 'react';

import { API_ROUTES } from '@/config/domain-constants';
import { DialogConfirmFooter } from './DialogConfirmFooter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/providers/NotificationProvider';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import type { CompanyUser } from '../types';

interface DenyAccessRequestDialogProps {
  user: CompanyUser;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DenyAccessRequestDialog({ user, open, onClose, onSuccess }: DenyAccessRequestDialogProps) {
  const { success, error: notifyError } = useNotifications();
  const { t } = useTranslation('admin');
  const colors = useSemanticColors();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await apiClient.post(API_ROUTES.ADMIN.WORKSPACE_ACCESS_REQUEST_DENY, { uid: user.uid });
      success(t('roleManagement.deny.success'));
      onSuccess();
    } catch {
      notifyError(t('roleManagement.deny.error'));
    } finally {
      setIsSubmitting(false);
    }
  }, [user.uid, success, notifyError, t, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('roleManagement.deny.title')}</DialogTitle>
          <DialogDescription>{t('roleManagement.deny.description')}</DialogDescription>
        </DialogHeader>

        <article className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
          <span className="text-sm font-medium">{user.displayName ?? user.email}</span>
          <span className={cn('text-xs', colors.text.muted)}>{user.email}</span>
        </article>

        <DialogConfirmFooter
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmKey="roleManagement.deny.confirm"
          isSubmitting={isSubmitting}
          confirmVariant="destructive"
        />
      </DialogContent>
    </Dialog>
  );
}
