'use client';

/**
 * ADR-244 Phase B: Project Members Tab — Container component
 *
 * Select a project → view/manage its members.
 * Super admin can add, update, and remove members via 3-step wizard.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { useNotifications } from '@/providers/NotificationProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

import { MemberTable } from './MemberTable';
import { AssignMemberDialog } from './AssignMemberDialog';

import type {
  ProjectSummary,
  ProjectMemberEntry,
  ProjectMembersResponse,
} from '../types';

// =============================================================================
// PROPS
// =============================================================================

interface ProjectMembersTabProps {
  canEdit: boolean;
}

// =============================================================================
// TYPES
// =============================================================================

interface ProjectListItem {
  id: string;
  name: string;
  status: string;
}

interface ProjectListApiResponse {
  success: true;
  data: ProjectListItem[];
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ProjectMembersTab({ canEdit }: ProjectMembersTabProps) {
  const { t } = useTranslation('admin');
  const { success, error: notifyError } = useNotifications();

  // State
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [members, setMembers] = useState<ProjectMemberEntry[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  // Remove confirmation state
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch projects
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setIsLoadingProjects(true);
    // apiClient unwraps canonical { success, data } → returns data directly
    // Projects list returns { projects: [...], count, loadedAt, source }
    apiClient
      .get<{ projects: ProjectListItem[] }>('/api/projects/list')
      .then((data) => {
        const items = Array.isArray(data.projects) ? data.projects : [];
        setProjects(
          items.map((p) => ({ id: p.id, name: p.name, status: p.status }))
        );
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load projects';
        notifyError(message);
      })
      .finally(() => setIsLoadingProjects(false));
  }, [notifyError]);

  // ---------------------------------------------------------------------------
  // Fetch members when project changes
  // ---------------------------------------------------------------------------
  const fetchMembers = useCallback(async (projectId: string) => {
    if (!projectId) {
      setMembers([]);
      return;
    }
    setIsLoadingMembers(true);
    try {
      // apiClient unwraps canonical { success, data } → returns data directly
      const data = await apiClient.get<ProjectMembersResponse['data']>(
        `/api/admin/role-management/project-members?projectId=${encodeURIComponent(projectId)}`
      );
      setMembers(data.members);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load members';
      notifyError(message);
      setMembers([]);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [notifyError]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchMembers(selectedProjectId);
    }
  }, [selectedProjectId, fetchMembers]);

  // ---------------------------------------------------------------------------
  // Assign member
  // ---------------------------------------------------------------------------
  const handleAssignMember = useCallback(
    async (uid: string, roleId: string, permissionSetIds: string[], reason: string) => {
      await apiClient.post('/api/admin/role-management/project-members', {
        action: 'assign',
        projectId: selectedProjectId,
        uid,
        roleId,
        permissionSetIds,
        reason,
      });
      success(t('roleManagement.projectMembers.assignSuccess', 'Member added successfully'));
      fetchMembers(selectedProjectId);
    },
    [selectedProjectId, success, t, fetchMembers]
  );

  // ---------------------------------------------------------------------------
  // Update member (reuses assign dialog for simplicity — future improvement)
  // ---------------------------------------------------------------------------
  const handleUpdateMember = useCallback(
    (_uid: string) => {
      // For Phase B MVP, update is done by removing + re-adding.
      // Future: inline edit dialog
      notifyError(t('roleManagement.projectMembers.updateHint', 'To update, remove and re-add the member with new settings.'));
    },
    [notifyError, t]
  );

  // ---------------------------------------------------------------------------
  // Remove member
  // ---------------------------------------------------------------------------
  const handleConfirmRemove = useCallback(async () => {
    if (!removeTarget || removeReason.length < 10) return;
    setIsRemoving(true);
    try {
      await apiClient.post('/api/admin/role-management/project-members', {
        action: 'remove',
        projectId: selectedProjectId,
        uid: removeTarget,
        reason: removeReason,
      });
      success(t('roleManagement.projectMembers.removeSuccess', 'Member removed successfully'));
      setRemoveTarget(null);
      setRemoveReason('');
      fetchMembers(selectedProjectId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove member';
      notifyError(message);
    } finally {
      setIsRemoving(false);
    }
  }, [removeTarget, removeReason, selectedProjectId, success, t, fetchMembers, notifyError]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">
          {t('roleManagement.projectMembers.title', 'Project Members')}
        </h2>
        {canEdit && selectedProjectId && (
          <Button size="sm" onClick={() => setAssignDialogOpen(true)}>
            {t('roleManagement.projectMembers.addMember', 'Add Member')}
          </Button>
        )}
      </header>

      {/* Project selector */}
      <fieldset className="max-w-sm">
        <label className="text-sm font-medium text-muted-foreground mb-1 block">
          {t('roleManagement.projectMembers.selectProject', 'Select Project')}
        </label>
        {isLoadingProjects ? (
          <p className="text-sm text-muted-foreground animate-pulse">
            {t('roleManagement.projectMembers.loadingProjects', 'Loading projects...')}
          </p>
        ) : (
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger>
              <SelectValue placeholder={t('roleManagement.projectMembers.choosePlaceholder', 'Choose a project...')} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </fieldset>

      {/* Members table */}
      {selectedProjectId && (
        isLoadingMembers ? (
          <p className="py-8 text-center text-muted-foreground animate-pulse">
            {t('roleManagement.projectMembers.loadingMembers', 'Loading members...')}
          </p>
        ) : (
          <MemberTable
            members={members}
            canEdit={canEdit}
            onUpdateMember={handleUpdateMember}
            onRemoveMember={(uid) => setRemoveTarget(uid)}
          />
        )
      )}

      {!selectedProjectId && !isLoadingProjects && (
        <section className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">
            {t('roleManagement.projectMembers.selectPrompt', 'Select a project to view its members.')}
          </p>
        </section>
      )}

      {/* Assign dialog */}
      <AssignMemberDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        projectId={selectedProjectId}
        existingMembers={members}
        onConfirm={handleAssignMember}
      />

      {/* Remove confirmation dialog */}
      <Dialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('roleManagement.projectMembers.removeTitle', 'Remove Member')}
            </DialogTitle>
            <DialogDescription>
              {t('roleManagement.projectMembers.removeConfirm', 'This action will remove the user from this project. A reason is required for the audit trail.')}
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('roleManagement.status.reason', 'Reason')}
            </label>
            <Input
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              placeholder={t('roleManagement.status.reasonPlaceholder', 'Explain why (min 10 chars)...')}
            />
          </fieldset>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              {t('roleManagement.roleChange.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRemove}
              disabled={isRemoving || removeReason.length < 10}
            >
              {isRemoving
                ? t('roleManagement.projectMembers.removing', 'Removing...')
                : t('roleManagement.projectMembers.confirmRemove', 'Remove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
