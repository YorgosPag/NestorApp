'use client';

/**
 * ADR-244 Phase B: Assign Member Dialog — 3-Step Wizard
 *
 * Step 1: Select User (from company members not yet in project)
 * Step 2: Select Role & Permission Sets
 * Step 3: Review & Confirm
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CompanyUser, UserListResponse, ProjectMemberEntry } from '../types';
import { PERMISSION_SETS } from '@/lib/auth/permission-sets';
import { GLOBAL_ROLES } from '@/lib/auth/types';

// =============================================================================
// PROPS
// =============================================================================

interface AssignMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  existingMembers: ProjectMemberEntry[];
  onConfirm: (uid: string, roleId: string, permissionSetIds: string[], reason: string) => Promise<void>;
}

type WizardStep = 1 | 2 | 3;

// =============================================================================
// ROLE OPTIONS (project-level roles from permission sets)
// =============================================================================

const PROJECT_ROLE_OPTIONS = GLOBAL_ROLES.map((role) => ({
  value: role,
  label: role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}));

const PERMISSION_SET_OPTIONS = Object.entries(PERMISSION_SETS).map(([id, def]) => ({
  id,
  label: def.name,
  description: def.description,
}));

// =============================================================================
// COMPONENT
// =============================================================================

export function AssignMemberDialog({
  open,
  onOpenChange,
  projectId,
  existingMembers,
  onConfirm,
}: AssignMemberDialogProps) {
  const { t } = useTranslation('admin');

  // Wizard state
  const [step, setStep] = useState<WizardStep>(1);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected values
  const [selectedUid, setSelectedUid] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedPermissionSets, setSelectedPermissionSets] = useState<string[]>([]);
  const [reason, setReason] = useState('');

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedUid('');
      setSelectedRoleId('');
      setSelectedPermissionSets([]);
      setReason('');
      setUserSearch('');
    }
  }, [open]);

  // Fetch company users for step 1
  useEffect(() => {
    if (!open) return;
    setIsLoadingUsers(true);
    // apiClient unwraps canonical { success, data } → returns data directly
    apiClient
      .get<UserListResponse['data']>('/api/admin/role-management/users')
      .then((data) => setCompanyUsers(data.users))
      .catch(() => setCompanyUsers([]))
      .finally(() => setIsLoadingUsers(false));
  }, [open]);

  // Filter out users already in the project
  const existingUids = new Set(existingMembers.map((m) => m.uid));
  const availableUsers = companyUsers.filter((u) => {
    if (existingUids.has(u.uid)) return false;
    if (!userSearch) return true;
    const search = userSearch.toLowerCase();
    return (
      u.email.toLowerCase().includes(search) ||
      (u.displayName?.toLowerCase().includes(search) ?? false)
    );
  });

  const selectedUser = companyUsers.find((u) => u.uid === selectedUid);

  // Permission set toggle
  const togglePermissionSet = useCallback((setId: string) => {
    setSelectedPermissionSets((prev) =>
      prev.includes(setId)
        ? prev.filter((id) => id !== setId)
        : [...prev, setId]
    );
  }, []);

  // Submit
  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(selectedUid, selectedRoleId, selectedPermissionSets, reason);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t('roleManagement.projectMembers.assignTitle', 'Add Project Member')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'roleManagement.projectMembers.assignDescription',
              'Step {step} of 3',
              { step }
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <nav className="flex items-center gap-2 py-2" aria-label="Wizard steps">
          {([1, 2, 3] as const).map((s) => (
            <span
              key={s}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold
                ${s === step ? 'bg-primary text-primary-foreground' : s < step ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}
            >
              {s}
            </span>
          ))}
        </nav>

        {/* ================================================================= */}
        {/* STEP 1: Select User */}
        {/* ================================================================= */}
        {step === 1 && (
          <section className="space-y-3">
            <Input
              placeholder={t('roleManagement.projectMembers.searchUser', 'Search by name or email...')}
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            {isLoadingUsers ? (
              <p className="py-4 text-center text-muted-foreground animate-pulse">
                {t('roleManagement.usersTab.loadingUsers', 'Loading users...')}
              </p>
            ) : (
              <ul className="max-h-60 overflow-y-auto space-y-1">
                {availableUsers.map((user) => (
                  <li key={user.uid}>
                    <button
                      type="button"
                      onClick={() => setSelectedUid(user.uid)}
                      className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors
                        ${selectedUid === user.uid ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted'}`}
                    >
                      <span className="font-medium">{user.displayName ?? user.email}</span>
                      <span className="ml-2 text-muted-foreground text-xs">{user.email}</span>
                    </button>
                  </li>
                ))}
                {availableUsers.length === 0 && (
                  <li className="py-4 text-center text-muted-foreground text-sm">
                    {t('roleManagement.projectMembers.noAvailableUsers', 'No available users to add.')}
                  </li>
                )}
              </ul>
            )}
          </section>
        )}

        {/* ================================================================= */}
        {/* STEP 2: Select Role & Permissions */}
        {/* ================================================================= */}
        {step === 2 && (
          <section className="space-y-4">
            <fieldset className="space-y-1.5">
              <label className="text-sm font-medium">
                {t('roleManagement.projectMembers.selectRole', 'Project Role')}
              </label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('roleManagement.roleChange.selectRole', 'Select role')} />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </fieldset>

            <fieldset className="space-y-2">
              <label className="text-sm font-medium">
                {t('roleManagement.projectMembers.permissionSets', 'Permission Sets')}
              </label>
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {PERMISSION_SET_OPTIONS.map((opt) => (
                  <li key={opt.id} className="flex items-start gap-2">
                    <Checkbox
                      id={`ps-${opt.id}`}
                      checked={selectedPermissionSets.includes(opt.id)}
                      onCheckedChange={() => togglePermissionSet(opt.id)}
                    />
                    <label htmlFor={`ps-${opt.id}`} className="text-sm cursor-pointer">
                      <span className="font-medium">{opt.label}</span>
                      {opt.description && (
                        <span className="block text-xs text-muted-foreground">{opt.description}</span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          </section>
        )}

        {/* ================================================================= */}
        {/* STEP 3: Review & Confirm */}
        {/* ================================================================= */}
        {step === 3 && (
          <section className="space-y-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t('roleManagement.table.user', 'User')}</dt>
              <dd className="font-medium">{selectedUser?.displayName ?? selectedUser?.email ?? selectedUid}</dd>

              <dt className="text-muted-foreground">{t('roleManagement.projectMembers.role', 'Role')}</dt>
              <dd><Badge variant="secondary">{selectedRoleId}</Badge></dd>

              <dt className="text-muted-foreground">{t('roleManagement.projectMembers.permissionSets', 'Permission Sets')}</dt>
              <dd>
                {selectedPermissionSets.length > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    {selectedPermissionSets.map((id) => (
                      <Badge key={id} variant="outline" className="text-[10px]">{id}</Badge>
                    ))}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </dl>

            <fieldset className="space-y-1.5">
              <label className="text-sm font-medium">
                {t('roleManagement.projectMembers.reason', 'Reason')}
              </label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('roleManagement.roleChange.reasonPlaceholder', 'Explain why (min 10 chars)...')}
              />
            </fieldset>
          </section>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as WizardStep)}>
              {t('roleManagement.projectMembers.back', 'Back')}
            </Button>
          )}
          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => (s + 1) as WizardStep)}
              disabled={
                (step === 1 && !selectedUid) ||
                (step === 2 && !selectedRoleId)
              }
            >
              {t('roleManagement.projectMembers.next', 'Next')}
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              disabled={isSubmitting || reason.length < 10}
            >
              {isSubmitting
                ? t('roleManagement.projectMembers.assigning', 'Assigning...')
                : t('roleManagement.projectMembers.confirm', 'Confirm & Add')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
