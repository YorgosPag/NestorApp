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
import { API_ROUTES } from '@/config/domain-constants';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createStaleCache } from '@/lib/stale-cache';
import { compareByLocale } from '@/lib/intl-formatting';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { UserTable } from './UserTable';
import { RoleChangeDialog } from './RoleChangeDialog';
import { PermissionSetManager } from './PermissionSetManager';
import { UserDetailPanel } from './UserDetailPanel';
import { ApproveUserDialog } from './ApproveUserDialog';
import { DenyAccessRequestDialog } from './DenyAccessRequestDialog';
import { MemberExitDialog } from './MemberExitDialog';
import { RestoreAccessDialog } from './RestoreAccessDialog';
import { AccountSuspendDialog } from './AccountSuspendDialog';
// 🎫 ADR-853 Φ6 — οι προσκλήσεις είναι **αδελφός** πίνακας, όχι γραμμές των χρηστών.
import { InvitationTable } from './InvitationTable';

import type {
  CompanyUser,
  UserListFilters,
  UserListResponse,
  DialogMode,
} from '../types';
import { DEFAULT_FILTERS } from '../types';
import { useInvitationActions } from '../useInvitationActions';
import { useInviteCapability } from '../useInviteCapability';
import type { WorkspaceInvitationView } from '@/types/workspace-invitation';
import { GLOBAL_ROLES } from '@/lib/auth/types';
import type { GlobalRole } from '@/lib/auth/types';

// ADR-300: Module-level cache — company-wide user list, survives re-navigation
const companyUsersCache = createStaleCache<CompanyUser[]>('admin-users');

// =============================================================================
// PROPS
// =============================================================================

interface UsersTabProps {
  canEdit: boolean;
  /**
   * 🎫 **ADR-853 Φ6 — ΣΗΜΑ, ΟΧΙ ΚΛΕΙΔΙ ΤΗΣ ΜΝΗΜΗΣ.**
   *
   * Η σελίδα κρατά τον διάλογο της πρόσκλησης (το `TabsContainer` δεν έχει υποδοχή
   * ενεργειών), αλλά η μνήμη `companyUsersCache` είναι **ιδιωτική αυτού** του module.
   * Ένας δεύτερος που την ακυρώνει από έξω θα ήταν **δεύτερος ιδιοκτήτης κύκλου ζωής**
   * (N.7.2 #7). Έτσι η σελίδα **ζητά ανανέωση** και ο ιδιοκτήτης αποφασίζει πώς.
   */
  refreshNonce?: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function UsersTab({ canEdit, refreshNonce = 0 }: UsersTabProps) {
  const { user } = useAuth();
  const { error: notifyError } = useNotifications();
  const { t } = useTranslation('admin');

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [users, setUsers] = useState<CompanyUser[]>(companyUsersCache.get() ?? []);
  const [filters, setFilters] = useState<UserListFilters>(DEFAULT_FILTERS);
  const [selectedUser, setSelectedUser] = useState<CompanyUser | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [isLoading, setIsLoading] = useState(!companyUsersCache.hasLoaded());
  // ADR-892 §7 — η αποτυχία ανάγνωσης είναι **κατάσταση**, όχι άδεια λίστα.
  const [loadFailed, setLoadFailed] = useState(false);
  // 🎫 ADR-853 Φ6 — **δεν μπαίνουν στη μνήμη των χρηστών**: εκείνη είναι
  //    `createStaleCache<CompanyUser[]>`, και μια πρόσκληση **δεν είναι** χρήστης (δεν έχει
  //    `uid`). Ζουν στην κατάσταση της καρτέλας και ξαναέρχονται με κάθε ανάγνωση.
  const [invitations, setInvitations] = useState<WorkspaceInvitationView[]>([]);

  // ---------------------------------------------------------------------------
  // Fetch users
  // ---------------------------------------------------------------------------
  const fetchUsers = useCallback(async () => {
    // ADR-300: Only show spinner on first load — not on re-navigation
    if (!companyUsersCache.hasLoaded()) setIsLoading(true);
    try {
      // apiClient unwraps canonical { success, data } → returns data directly
      const data = await apiClient.get<UserListResponse['data']>(
        API_ROUTES.ADMIN.ROLE_MANAGEMENT.USERS
      );
      const loaded = Array.isArray(data?.users) ? data.users : [];
      // ADR-300: Write to module-level cache so next remount skips spinner
      companyUsersCache.set(loaded);
      setUsers(loaded);
      setLoadFailed(false);
      // 🎫 ADR-853 Φ6 — **αδελφό πεδίο της ΙΔΙΑΣ απάντησης**, ποτέ δεύτερη κλήση: ένα
      //    ερώτημα («ποιοι είναι στον χώρο μου;») δεν επιτρέπεται να έχει δύο στιγμές,
      //    αλλιώς η οθόνη δείχνει μέλος που μόλις δέχτηκε **και** την πρόσκλησή του ως
      //    εκκρεμή (ADR-749). ⚠️ Ίδιος φρουρός πίνακα με το `users`.
      setInvitations(Array.isArray(data?.invitations) ? data.invitations : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load users';
      setLoadFailed(true);
      notifyError(message);
    } finally {
      setIsLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 🎫 ADR-853 Φ6 — η σελίδα εξέδωσε πρόσκληση ⇒ η λίστα είναι μπαγιάτικη.
  //
  // ⚠️ **Το `0` παραλείπεται επίτηδες**: είναι η αρχική τιμή, και χωρίς αυτόν τον φρουρό
  //    κάθε προσάρτηση θα έκανε **δύο** ταυτόσημες κλήσεις — η δεύτερη ακυρώνοντας τη
  //    μνήμη που μόλις γέμισε η πρώτη, δηλαδή σπινάρισμα σε κάθε επιστροφή στην καρτέλα.
  useEffect(() => {
    if (refreshNonce === 0) return;
    companyUsersCache.invalidate();
    fetchUsers();
  }, [refreshNonce, fetchUsers]);

  // 🎫 ADR-853 Φ6 — **ο ΕΝΑΣ κριτής**, ρωτημένος με την ίδια ικανότητα που φυλά τις πόρτες.
  //    ⛔ ΟΧΙ το `canEdit`: εκείνο είναι `super_admin`-only και θα έκρυβε τον πίνακα από
  //    τον `company_admin`, δηλαδή από αυτόν για τον οποίο γράφτηκε το ADR-853 (Α3).
  const invite = useInviteCapability();
  const invitationActions = useInvitationActions(fetchUsers);

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
          return direction * compareByLocale(a.displayName ?? '', b.displayName ?? '');
        case 'email':
          return direction * compareByLocale(a.email, b.email);
        case 'lastSignIn': {
          const dateA = a.lastSignIn ? new Date(a.lastSignIn).getTime() : 0;
          const dateB = b.lastSignIn ? new Date(b.lastSignIn).getTime() : 0;
          return direction * (dateA - dateB);
        }
        case 'globalRole':
          return direction * compareByLocale(a.globalRole, b.globalRole);
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
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogMode(null);
    setSelectedUser(null);
  }, []);

  const handleDialogSuccess = useCallback(() => {
    handleCloseDialog();
    fetchUsers();
  }, [handleCloseDialog, fetchUsers]);

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
          placeholder={t('roleManagement.usersTab.search')}
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="max-w-xs"
        />

        <Select
          value={filters.globalRole}
          onValueChange={(value) => updateFilter('globalRole', value as GlobalRole | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('roleManagement.usersTab.allRoles')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('roleManagement.usersTab.allRoles')}</SelectItem>
            {GLOBAL_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {t(`common:globalRoles.${role}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) => updateFilter('status', value as 'all' | 'active' | 'suspended' | 'pending')}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('roleManagement.usersTab.filterStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('roleManagement.usersTab.allStatuses')}</SelectItem>
            <SelectItem value="pending">{t('roleManagement.statusLabels.pending')}</SelectItem>
            <SelectItem value="active">{t('roleManagement.statusLabels.active')}</SelectItem>
            <SelectItem value="suspended">{t('roleManagement.statusLabels.suspended')}</SelectItem>
          </SelectContent>
        </Select>
      </nav>

      {/* User table */}
      <UserTable
        users={filteredUsers}
        currentUserId={user?.uid ?? ''}
        canEdit={canEdit}
        canRemove={invite.canInvite && !invite.pending}
        isLoading={isLoading}
        loadFailed={loadFailed}
        onRetry={fetchUsers}
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
        onRemove={(u) => handleOpenDialog('remove', u)}
        onPauseAccess={(u) => handleOpenDialog('pause', u)}
        onRestoreAccess={(u) => handleOpenDialog('restore', u)}
        onViewDetails={(u) => handleOpenDialog('detail', u)}
        onApprove={(u) => handleOpenDialog('approve', u)}
        onDeny={(u) => handleOpenDialog('deny', u)}
      />

      {/* ADR-853 Φ6 — οι εκκρεμείς προσκλήσεις, ξεχωριστά από τα μέλη.
          ⚠️ Όσο εκκρεμεί η ταυτότητα **δεν** δείχνουμε πράξεις: η κατεύθυνση είναι
          «κλειστό → ανοιχτό», ποτέ κουμπί που εμφανίζεται και μετά εξαφανίζεται. */}
      {/* ADR-892 §7 — ούτε η αποτυχία ούτε η ΦΟΡΤΩΣΗ είναι «καμία πρόσκληση» (μετρημένο ζωντανά 2026-09-27). */}
      {!loadFailed && !isLoading && <InvitationTable
        invitations={invitations}
        canManage={invite.canInvite && !invite.pending}
        busyId={invitationActions.busyId}
        onRevoke={invitationActions.revoke}
        onResend={invitationActions.resend}
      />}

      {/* Role change dialog */}
      {dialogMode === 'role' && selectedUser && (
        <RoleChangeDialog
          user={selectedUser}
          currentUserId={user?.uid ?? ''}
          open
          onClose={handleCloseDialog}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* Approve pending / unassigned user (ADR-660) */}
      {dialogMode === 'approve' && selectedUser && (
        <ApproveUserDialog
          user={selectedUser}
          open
          onClose={handleCloseDialog}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* Deny access request (ADR-660 §6) */}
      {dialogMode === 'deny' && selectedUser && (
        <DenyAccessRequestDialog
          user={selectedUser}
          open
          onClose={handleCloseDialog}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* ADR-892 Φ2/Φ2β — αφαίρεση (η θητεία τελειώνει) · παύση (μένει μέλος): ο ΙΔΙΟΣ διάλογος προεπισκόπησης */}
      {(dialogMode === 'remove' || dialogMode === 'pause') && selectedUser && (
        <MemberExitDialog
          mode={dialogMode === 'remove' ? 'removal' : 'pause'}
          user={selectedUser}
          members={users}
          open
          onClose={handleCloseDialog}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* ADR-892 Φ2β — επαναφορά πρόσβασης (ίδια θητεία, ίδιος ρόλος) */}
      {dialogMode === 'restore' && selectedUser && (
        <RestoreAccessDialog
          user={selectedUser}
          members={users}
          open
          onClose={handleCloseDialog}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* Permission set manager */}
      {dialogMode === 'permissions' && selectedUser && (
        <PermissionSetManager
          user={selectedUser}
          open
          onClose={handleCloseDialog}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* User detail panel */}
      {dialogMode === 'detail' && selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          open
          onClose={handleCloseDialog}
        />
      )}

      {/* Αναστολή ΛΟΓΑΡΙΑΣΜΟΥ (πλατφόρμας) — κρίνει από το `disabled`, όχι από την κατάσταση μέλους (ADR-892 §12) */}
      {dialogMode === 'suspend' && selectedUser && (
        <AccountSuspendDialog user={selectedUser} onClose={handleCloseDialog} onSuccess={handleDialogSuccess} />
      )}
    </section>
  );
}
