'use client';

/**
 * ADR-244: Permission Set Manager Dialog
 *
 * Manages org-level permission sets for a user.
 * Checkbox list of all available permission sets from PERMISSION_SETS.
 */

import { useState, useCallback, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import type { CompanyUser, UpdatePermissionSetsResponse } from '../types';
import {
  PERMISSION_SETS,
  getAllPermissionSetIds,
  requiresMfaEnrollment,
} from '@/lib/auth/permission-sets';
import type { PermissionSetDefinition } from '@/lib/auth/permission-sets';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface PermissionSetManagerProps {
  user: CompanyUser;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PermissionSetManager({
  user,
  open,
  onClose,
  onSuccess,
}: PermissionSetManagerProps) {
  const { success, error: notifyError } = useNotifications();
  const { t } = useTranslation('admin');

  const allSetIds = useMemo(() => getAllPermissionSetIds(), []);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(user.permissionSetIds)
  );
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isReasonValid = reason.trim().length >= 10;

  // Check if anything changed
  const hasChanges = useMemo(() => {
    const original = new Set(user.permissionSetIds);
    if (original.size !== selectedIds.size) return true;
    for (const id of selectedIds) {
      if (!original.has(id)) return true;
    }
    return false;
  }, [user.permissionSetIds, selectedIds]);

  const canSubmit = hasChanges && isReasonValid && !isSubmitting;

  // ---------------------------------------------------------------------------
  // Toggle handler
  // ---------------------------------------------------------------------------
  const handleToggle = useCallback((setId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(setId);
      } else {
        next.delete(setId);
      }
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  const colors = useSemanticColors();

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await apiClient.patch<UpdatePermissionSetsResponse>(
        API_ROUTES.ADMIN.ROLE_MANAGEMENT.USER_PERMISSION_SETS(user.uid),
        { permissionSetIds: Array.from(selectedIds), reason }
      );
      success(
        t('roleManagement.permissionSetsUpdated', 'Permission sets updated successfully.')
      );
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update permission sets';
      notifyError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, user.uid, selectedIds, reason, success, notifyError, t, onSuccess]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {t('roleManagement.managePermissionSets', 'Manage Permission Sets')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'roleManagement.permissionSetsDescription',
              'Assign org-level permission sets to {name}. These apply across all projects.'
            ).replace('{name}', user.displayName ?? user.email)}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-4 max-h-[50vh] overflow-y-auto">
          <ul className="space-y-3" role="list">
            {allSetIds.map((setId) => {
              const definition: PermissionSetDefinition = PERMISSION_SETS[setId];
              const isChecked = selectedIds.has(setId);
              const needsMfa = requiresMfaEnrollment(setId);

              return (
                <li key={setId} className="flex items-start gap-3 rounded-lg border p-3">
                  <Checkbox
                    id={`perm-set-${setId}`}
                    checked={isChecked}
                    onCheckedChange={(checked) =>
                      handleToggle(setId, checked === true)
                    }
                  />
                  <label
                    htmlFor={`perm-set-${setId}`}
                    className="flex-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-sm">{definition.name}</span>
                      {needsMfa && (
                        <Badge variant="warning" className="text-[10px]">
                          MFA
                        </Badge>
                      )}
                    </span>
                    <p className={cn("text-xs mt-0.5", colors.text.muted)}>
                      {definition.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {definition.permissions.length} {t('roleManagement.permissions', 'permissions')}:
                      {' '}{definition.permissions.join(', ')}
                    </p>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Reason */}
        <fieldset className="space-y-2 mt-4">
          <Label htmlFor="perm-set-reason">
            {t('roleManagement.reason', 'Reason')} ({t('roleManagement.minChars', 'min 10 characters')})
          </Label>
          <Textarea
            id="perm-set-reason"
            size="sm"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('roleManagement.reasonPlaceholder', 'Explain why this change is needed...')}
          />
        </fieldset>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting
              ? t('common.saving', 'Saving...')
              : t('roleManagement.savePermissionSets', 'Save Permission Sets')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
