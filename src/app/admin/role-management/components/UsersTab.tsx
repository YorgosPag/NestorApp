'use client';

/**
 * ADR-244: Users Tab — Container component
 *
 * Fetches users from API, applies client-side filtering/sorting,
 * and renders UserTable + dialogs.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/contexts/AuthContext';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import { UserTable } from './UserTable';
import { RoleChangeDialog } from './RoleChangeDialog';
import { PermissionSetManager } from './PermissionSetManager';
import { UserDetailPanel } from './UserDetailPanel';

import type {
  CompanyUser,
  UserListFilters,
  UserListResponse,
  DialogMode,
} from '../types';
import { DEFAULT_FILTERS } from '../types';
import { GLOBAL_ROLES } from '@/lib/auth/types';
import type { GlobalRole } from '@/lib/auth/types';

// =============================================================================
// PROPS
// =============================================================================

interface UsersTabProps {
  canEdit: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function UsersTab({ canEdit }: UsersTabProps) {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotifications();
  const { t } = useTranslation('admin');

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [filters, setFilters] = useState<UserListFilters>(DEFAULT_FILTERS);
  const [selectedUser, setSelectedUser] = useState<CompanyUser | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [suspendReason, setSuspendReason] = useState('');

  // ---------------------------------------------------------------------------
  // Fetch users
  // ---------------------------------------------------------------------------
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      // apiClient unwraps canonical { success, data } → returns data directly
      const data = await apiClient.get<UserListResponse['data']>(
        '/api/admin/role-management/users'
      );
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load users';
      notifyError(message);
    } finally {
      setIsLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ---------------------------------------------------------------------------
  // Client-side filtering
  // ---------------------------------------------------------------------------
  const filteredUsers = useMemo(() => {
    let result = [...users];

    // Search filter
    if (filters.search.trim()) {
      const query = filters.search.toLowerCase();
      result = result.filter(
        (u) =>
          (u.displayName ?? '').toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query)
      );
    }

    // Role filter
    if (filters.globalRole !== 'all') {
      result = result.filter((u) => u.globalRole === filters.globalRole);
    }

    // Status filter
    if (filters.status !== 'all') {
      result = result.filter((u) => u.status === filters.status);
    }

    // Sorting
    result.sort((a, b) => {
      const direction = filters.sortOrder === 'asc' ? 1 : -1;

      switch (filters.sortBy) {
        case 'name':
          return direction * (a.displayName ?? '').localeCompare(b.displayName ?? '');
        case 'email':
          return direction * a.email.localeCompare(b.email);
        case 'lastSignIn': {
          const dateA = a.lastSignIn ? new Date(a.lastSignIn).getTime() : 0;
          const dateB = b.lastSignIn ? new Date(b.lastSignIn).getTime() : 0;
          return direction * (dateA - dateB);
        }
        case 'globalRole':
          return direction * a.globalRole.localeCompare(b.globalRole);
        default:
          return 0;
      }
    });

    return result;
  }, [users, filters]);

  // ---------------------------------------------------------------------------
  // Dialog handlers
  // ---------------------------------------------------------------------------
  const handleOpenDialog = useCallback((mode: DialogMode, targetUser: CompanyUser) => {
    setSelectedUser(targetUser);
    setDialogMode(mode);
    setSuspendReason('');
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogMode(null);
    setSelectedUser(null);
    setSuspendReason('');
  }, []);

  const handleDialogSuccess = useCallback(() => {
    handleCloseDialog();
    fetchUsers();
  }, [handleCloseDialog, fetchUsers]);

  // ---------------------------------------------------------------------------
  // Suspend / Activate handler
  // ---------------------------------------------------------------------------
  const handleSuspendConfirm = useCallback(async () => {
    if (!selectedUser || suspendReason.trim().length < 10) return;

    const action = selectedUser.status === 'active' ? 'suspend' : 'reactivate';

    try {
      await apiClient.patch<Record<string, unknown>>(
        `/api/admin/role-management/users/${selectedUser.uid}/status`,
        { action, reason: suspendReason }
      );
      success(
        action === 'suspend'
          ? t('roleManagement.userSuspended', 'User suspended successfully.')
          : t('roleManagement.userActivated', 'User activated successfully.')
      );
      handleDialogSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update status';
      notifyError(message);
    }
  }, [selectedUser, suspendReason, success, notifyError, t, handleDialogSuccess]);

  // ---------------------------------------------------------------------------
  // Filter update helpers
  // ---------------------------------------------------------------------------
  const updateFilter = useCallback(
    <K extends keyof UserListFilters>(key: K, value: UserListFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <section>
      {/* Filters bar */}
      <nav className="flex flex-wrap items-center gap-3 mb-4" aria-label="User filters">
        <Input
          placeholder={t('roleManagement.searchPlaceholder', 'Search by name or email...')}
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="max-w-xs"
        />

        <Select
          value={filters.globalRole}
          onValueChange={(value) => updateFilter('globalRole', value as GlobalRole | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('roleManagement.allRoles', 'All Roles')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('roleManagement.allRoles', 'All Roles')}</SelectItem>
            {GLOBAL_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {role.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) => updateFilter('status', value as 'all' | 'active' | 'suspended')}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('roleManagement.allStatuses', 'All Statuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('roleManagement.allStatuses', 'All Statuses')}</SelectItem>
            <SelectItem value="active">{t('roleManagement.active', 'Active')}</SelectItem>
            <SelectItem value="suspended">{t('roleManagement.suspended', 'Suspended')}</SelectItem>
          </SelectContent>
        </Select>
      </nav>

      {/* User table */}
      <UserTable
        users={filteredUsers}
        currentUserId={user?.uid ?? ''}
        canEdit={canEdit}
        isLoading={isLoading}
        sortBy={filters.sortBy}
        sortOrder={filters.sortOrder}
        onSort={(column) => {
          if (filters.sortBy === column) {
            updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc');
          } else {
            updateFilter('sortBy', column);
            updateFilter('sortOrder', 'asc');
          }
        }}
        onChangeRole={(u) => handleOpenDialog('role', u)}
        onManagePermissions={(u) => handleOpenDialog('permissions', u)}
        onSuspend={(u) => handleOpenDialog('suspend', u)}
        onViewDetails={(u) => handleOpenDialog('detail', u)}
      />

      {/* Role change dialog */}
      {dialogMode === 'role' && selectedUser && (
        <RoleChangeDialog
          user={selectedUser}
          currentUserId={user?.uid ?? ''}
          open={true}
          onClose={handleCloseDialog}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* Permission set manager */}
      {dialogMode === 'permissions' && selectedUser && (
        <PermissionSetManager
          user={selectedUser}
          open={true}
          onClose={handleCloseDialog}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* User detail panel */}
      {dialogMode === 'detail' && selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          open={true}
          onClose={handleCloseDialog}
        />
      )}

      {/* Suspend / Activate confirm dialog */}
      {dialogMode === 'suspend' && selectedUser && (
        <Dialog open={true} onOpenChange={handleCloseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedUser.status === 'active'
                  ? t('roleManagement.suspendUser', 'Suspend User')
                  : t('roleManagement.activateUser', 'Activate User')}
              </DialogTitle>
              <DialogDescription>
                {selectedUser.status === 'active'
                  ? t('roleManagement.suspendDescription', 'This will disable the user\'s account. They will not be able to sign in.')
                  : t('roleManagement.activateDescription', 'This will re-enable the user\'s account.')}
              </DialogDescription>
            </DialogHeader>

            <section className="space-y-3">
              <p className="text-sm">
                <strong>{selectedUser.displayName ?? selectedUser.email}</strong>
                {' '}({selectedUser.email})
              </p>
              <label className="block">
                <span className="text-sm font-medium">
                  {t('roleManagement.reason', 'Reason')} ({t('roleManagement.minChars', 'min 10 characters')})
                </span>
                <textarea
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  rows={3}
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder={t('roleManagement.reasonPlaceholder', 'Explain why this action is needed...')}
                />
              </label>
            </section>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant={selectedUser.status === 'active' ? 'destructive' : 'default'}
                disabled={suspendReason.trim().length < 10}
                onClick={handleSuspendConfirm}
              >
                {selectedUser.status === 'active'
                  ? t('roleManagement.suspend', 'Suspend')
                  : t('roleManagement.activate', 'Activate')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
