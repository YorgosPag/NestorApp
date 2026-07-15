'use client';

/**
 * ADR-660: Approve User Dialog
 *
 * Εγκρίνει έναν αυτο-εγγεγραμμένο (pending / unassigned) χρήστη: του αναθέτει
 * ρόλο + companyId μέσω του υπάρχοντος SSoT endpoint `set-user-claims` (θέτει
 * claims + δημιουργεί member doc + user doc active + audit). ΔΕΝ φτιάχνει νέο
 * μηχανισμό — απλώς οδηγεί το ήδη υπάρχον provisioning.
 */

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/contexts/AuthContext';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

import type { CompanyUser } from '../types';
import { GLOBAL_ROLES } from '@/lib/auth/types';
import type { GlobalRole } from '@/lib/auth/types';
import { PREDEFINED_ROLES } from '@/lib/auth/roles';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface ApproveUserDialogProps {
  user: CompanyUser;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Ασφαλές default: ελάχιστα προνόμια. Ο admin μπορεί να επιλέξει υψηλότερο ρόλο.
const DEFAULT_APPROVAL_ROLE: GlobalRole = 'external_user';

// =============================================================================
// COMPONENT
// =============================================================================

export function ApproveUserDialog({ user, open, onClose, onSuccess }: ApproveUserDialogProps) {
  const { user: admin } = useAuth();
  const { success, error: notifyError } = useNotifications();
  const { t } = useTranslation('admin');
  const colors = useSemanticColors();

  const [role, setRole] = useState<GlobalRole>(DEFAULT_APPROVAL_ROLE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const companyId = admin?.companyId ?? null;
  const canSubmit = Boolean(companyId) && Boolean(user.email) && !isSubmitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !companyId) return;

    setIsSubmitting(true);
    try {
      await apiClient.post(API_ROUTES.ADMIN.SET_USER_CLAIMS, {
        uid: user.uid,
        email: user.email,
        companyId,
        globalRole: role,
      });
      success(t('roleManagement.approve.success'));
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('roleManagement.approve.error');
      notifyError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, companyId, user.uid, user.email, role, success, notifyError, t, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('roleManagement.approve.title')}</DialogTitle>
          <DialogDescription>{t('roleManagement.approve.description')}</DialogDescription>
        </DialogHeader>

        <section className="space-y-4">
          <article className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <figure className="flex flex-col">
              <span className="font-medium text-sm">{user.displayName ?? user.email}</span>
              <span className={cn('text-xs', colors.text.muted)}>{user.email}</span>
            </figure>
          </article>

          <fieldset className="space-y-2">
            <Label htmlFor="approve-role-select">{t('roleManagement.approve.assignRole')}</Label>
            <Select value={role} onValueChange={(value) => setRole(value as GlobalRole)}>
              <SelectTrigger id="approve-role-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLOBAL_ROLES.map((globalRole) => {
                  const roleDef = PREDEFINED_ROLES[globalRole];
                  return (
                    <SelectItem key={globalRole} value={globalRole}>
                      <span className="flex flex-col">
                        <span>{t(`roleManagement.roleNames.${globalRole}`)}</span>
                        {roleDef && (
                          <span className={cn('text-xs', colors.text.muted)}>
                            L{roleDef.level} — {t(`roleManagement.roleDescriptions.${globalRole}`)}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </fieldset>

          <Alert>
            <p className="text-sm">{t('roleManagement.approve.note')}</p>
          </Alert>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? t('common.saving') : t('roleManagement.approve.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
