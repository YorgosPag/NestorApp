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

import type { CompanyUser, ChangeRoleResponse } from '../types';
import { ROLE_BADGE_VARIANT } from '../types';
import { GLOBAL_ROLES } from '@/lib/auth/types';
import type { GlobalRole } from '@/lib/auth/types';
import { PREDEFINED_ROLES } from '@/lib/auth/roles';

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
// ROLE DISPLAY LABELS
// =============================================================================

const ROLE_LABELS: Record<GlobalRole, string> = {
  super_admin: 'Super Admin',
  company_admin: 'Company Admin',
  internal_user: 'Internal User',
  external_user: 'External User',
};

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
  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await apiClient.patch<ChangeRoleResponse>(
        API_ROUTES.ADMIN.ROLE_MANAGEMENT.USER_ROLE(user.uid),
        { newRole, reason }
      );
      success(
        t('roleManagement.roleChanged', 'Role changed successfully. User must re-login to see changes.')
      );
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change role';
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
            {t('roleManagement.changeRole', 'Change Global Role')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'roleManagement.changeRoleDescription',
              'Change the global role for this user. This affects their access across the entire organization.'
            )}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-4">
          {/* User info */}
          <article className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <figure className="flex flex-col">
              <span className="font-medium text-sm">
                {user.displayName ?? user.email}
              </span>
              <span className="text-xs text-muted-foreground">{user.email}</span>
            </figure>
          </article>

          {/* Current role */}
          <fieldset className="space-y-2">
            <Label>{t('roleManagement.currentRole', 'Current Role')}</Label>
            <Badge variant={ROLE_BADGE_VARIANT[user.globalRole]}>
              {ROLE_LABELS[user.globalRole]}
            </Badge>
          </fieldset>

          {/* New role */}
          <fieldset className="space-y-2">
            <Label htmlFor="new-role-select">
              {t('roleManagement.newRole', 'New Role')}
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
                        <span>{ROLE_LABELS[role]}</span>
                        {roleDef && (
                          <span className="text-xs text-muted-foreground">
                            L{roleDef.level} — {roleDef.description}
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
              {t('roleManagement.reason', 'Reason')} ({t('roleManagement.minChars', 'min 10 characters')})
            </Label>
            <textarea
              id="role-change-reason"
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('roleManagement.reasonPlaceholder', 'Explain why this role change is needed...')}
            />
          </fieldset>

          {/* Self-protection warning */}
          {isSelf && (
            <Alert variant="destructive">
              <p className="text-sm">
                {t('roleManagement.cannotChangeOwnRole', 'You cannot change your own role.')}
              </p>
            </Alert>
          )}

          {/* Re-login warning */}
          {!isUnchanged && !isSelf && (
            <Alert>
              <p className="text-sm">
                {t(
                  'roleManagement.reLoginWarning',
                  'The user must sign out and sign back in for the new role to take effect.'
                )}
              </p>
            </Alert>
          )}
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting
              ? t('common.saving', 'Saving...')
              : t('roleManagement.confirmRoleChange', 'Change Role')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
