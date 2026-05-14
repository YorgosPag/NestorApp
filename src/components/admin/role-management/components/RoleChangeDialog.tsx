'use client';

/**
 * ADR-244: Role Change Dialog
 *
 * Allows super_admin to change a user's global role.
 * Self-protection: cannot change own role.
 * Requires a reason (min 10 chars) and warns about re-login.
 */

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import type { CompanyUser, ChangeRoleResponse } from '../types';
import { ROLE_BADGE_VARIANT } from '../types';
import { GLOBAL_ROLES } from '@/lib/auth/types';
import type { GlobalRole } from '@/lib/auth/types';
import { PREDEFINED_ROLES } from '@/lib/auth/roles';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface RoleChangeDialogProps {
  user: CompanyUser;
  currentUserId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function RoleChangeDialog({
  user,
  currentUserId,
  open,
  onClose,
  onSuccess,
}: RoleChangeDialogProps) {
  const { success, error: notifyError } = useNotifications();
  const { t } = useTranslation('admin');

  const [newRole, setNewRole] = useState<GlobalRole>(user.globalRole);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSelf = user.uid === currentUserId;
  const isUnchanged = newRole === user.globalRole;
  const isReasonValid = reason.trim().length >= 10;
  const canSubmit = !isSelf && !isUnchanged && isReasonValid && !isSubmitting;

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  const colors = useSemanticColors();

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await apiClient.patch<ChangeRoleResponse>(
        API_ROUTES.ADMIN.ROLE_MANAGEMENT.USER_ROLE(user.uid),
        { newRole, reason }
      );
      success(t('roleManagement.roleChanged'));
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('roleManagement.roleChange.error');
      notifyError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, user.uid, newRole, reason, success, notifyError, t, onSuccess]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('roleManagement.changeRole')}
          </DialogTitle>
          <DialogDescription>
            {t('roleManagement.changeRoleDescription')}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-4">
          {/* User info */}
          <article className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <figure className="flex flex-col">
              <span className="font-medium text-sm">
                {user.displayName ?? user.email}
              </span>
              <span className={cn("text-xs", colors.text.muted)}>{user.email}</span>
            </figure>
          </article>

          {/* Current role */}
          <fieldset className="space-y-2">
            <Label>{t('roleManagement.currentRole')}</Label>
            <Badge variant={ROLE_BADGE_VARIANT[user.globalRole]}>
              {t(`roleManagement.roleNames.${user.globalRole}`)}
            </Badge>
          </fieldset>

          {/* New role */}
          <fieldset className="space-y-2">
            <Label htmlFor="new-role-select">
              {t('roleManagement.newRole')}
            </Label>
            <Select
              value={newRole}
              onValueChange={(value) => setNewRole(value as GlobalRole)}
              disabled={isSelf}
            >
              <SelectTrigger id="new-role-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLOBAL_ROLES.map((role) => {
                  const roleDef = PREDEFINED_ROLES[role];
                  return (
                    <SelectItem key={role} value={role}>
                      <span className="flex flex-col">
                        <span>{t(`roleManagement.roleNames.${role}`)}</span>
                        {roleDef && (
                          <span className={cn("text-xs", colors.text.muted)}>
                            L{roleDef.level} — {t(`roleManagement.roleDescriptions.${role}`)}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </fieldset>

          {/* Reason */}
          <fieldset className="space-y-2">
            <Label htmlFor="role-change-reason">
              {t('roleManagement.reason')} ({t('roleManagement.minChars')})
            </Label>
            <Textarea
              id="role-change-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('roleManagement.reasonPlaceholder')}
            />
          </fieldset>

          {/* Self-protection warning */}
          {isSelf && (
            <Alert variant="destructive">
              <p className="text-sm">
                {t('roleManagement.cannotChangeOwnRole')}
              </p>
            </Alert>
          )}

          {/* Re-login warning */}
          {!isUnchanged && !isSelf && (
            <Alert>
              <p className="text-sm">
                {t('roleManagement.reLoginWarning')}
              </p>
            </Alert>
          )}
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting
              ? t('common.saving')
              : t('roleManagement.confirmRoleChange')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
