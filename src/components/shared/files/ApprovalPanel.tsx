/**
 * =============================================================================
 * Approval Panel — Document approval workflow UI
 * =============================================================================
 *
 * Displays approval chain with status badges, approve/reject actions,
 * and the ability to create new approval requests.
 *
 * @module components/shared/files/ApprovalPanel
 * @enterprise ADR-191 Phase 3.3 — Approval Workflows
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  Plus,
  Send,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  FileApprovalService,
  type FileApproval,
  type ApprovalStatus,
} from '@/services/file-approval.service';
import {
  approveFileApprovalWithPolicy,
  cancelFileApprovalWithPolicy,
  createFileApprovalWithPolicy,
  rejectFileApprovalWithPolicy,
} from '@/services/filesystem/file-mutation-gateway';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import '@/lib/design-system';
import { createStaleCache } from '@/lib/stale-cache';

const fileApprovalCache = createStaleCache<FileApproval[]>('file-approval');

// ============================================================================
// TYPES
// ============================================================================

export interface ApprovalPanelProps {
  fileId: string;
  companyId: string;
  currentUserId: string;
  currentUserName: string;
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const STATUS_ICON_CONFIG: Record<
  ApprovalStatus,
  { icon: typeof CheckCircle2; colorClass: string }
> = {
  pending: { icon: Clock, colorClass: 'text-yellow-500' }, // eslint-disable-line design-system/enforce-semantic-colors
  approved: { icon: CheckCircle2, colorClass: 'text-green-500' }, // eslint-disable-line design-system/enforce-semantic-colors
  rejected: { icon: XCircle, colorClass: 'text-red-500' }, // eslint-disable-line design-system/enforce-semantic-colors
  cancelled: { icon: Ban, colorClass: COLOR_BRIDGE.text.muted },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ApprovalPanel({
  fileId,
  companyId,
  currentUserId,
  currentUserName,
  className,
}: ApprovalPanelProps) {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();

  const statusConfig = useMemo(() => ({
    pending: { ...STATUS_ICON_CONFIG.pending, label: t('approvals.status.pending') },
    approved: { ...STATUS_ICON_CONFIG.approved, label: t('approvals.status.approved') },
    rejected: { ...STATUS_ICON_CONFIG.rejected, label: t('approvals.status.rejected') },
    cancelled: { ...STATUS_ICON_CONFIG.cancelled, label: t('approvals.status.cancelled') },
  }), [t]);

  const [approvals, setApprovals] = useState<FileApproval[]>(fileApprovalCache.get(fileId) ?? []);
  const [loading, setLoading] = useState(!fileApprovalCache.hasLoaded(fileId));
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // New approval form
  const [newApproverName, setNewApproverName] = useState('');
  const [newApprovers, setNewApprovers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [newNote, setNewNote] = useState('');

  // Real-time subscription
  useEffect(() => {
    if (!fileApprovalCache.hasLoaded(fileId)) setLoading(true);
    const unsub = FileApprovalService.subscribeToApprovals(fileId, (data) => {
      fileApprovalCache.set(data, fileId);
      setApprovals(data);
      setLoading(false);
    });
    return unsub;
  }, [fileId]);

  const handleCreateApproval = useCallback(async () => {
    if (newApprovers.length === 0) return;
    setSubmitting(true);
    try {
      await createFileApprovalWithPolicy({
        fileId,
        companyId: '', // Will be populated from context
        requestedBy: currentUserId,
        requestedByName: currentUserName,
        approvers: newApprovers,
        note: newNote || undefined,
      });
      setCreating(false);
      setNewApprovers([]);
      setNewNote('');
    } finally {
      setSubmitting(false);
    }
  }, [fileId, currentUserId, currentUserName, newApprovers, newNote]);

  const handleApprove = useCallback(
    async (approvalId: string) => {
      await approveFileApprovalWithPolicy(approvalId, currentUserId);
    },
    [currentUserId]
  );

  const handleReject = useCallback(
    async (approvalId: string) => {
      if (!rejectReason.trim()) return;
      await rejectFileApprovalWithPolicy(approvalId, currentUserId, rejectReason);
      setRejectingId(null);
      setRejectReason('');
    },
    [currentUserId, rejectReason]
  );

  const handleCancel = useCallback(
    async (approvalId: string) => {
      await cancelFileApprovalWithPolicy(approvalId, currentUserId, fileId);
    },
    [currentUserId, fileId]
  );

  const addApprover = useCallback(() => {
    if (!newApproverName.trim()) return;
    setNewApprovers((prev) => [
      ...prev,
      {
        id: `approver_${Date.now()}`,
        name: newApproverName.trim(),
      },
    ]);
    setNewApproverName('');
  }, [newApproverName]);

  return (
    <section className={cn('flex flex-col', className)}>
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <UserCheck className={cn("h-4 w-4", colors.text.muted)} />
          {t('approvals.title')}
          {approvals.length > 0 && (
            <span className={cn("text-xs", colors.text.muted)}>
              ({approvals.length})
            </span>
          )}
        </h3>
        {!creating && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCreating(true)}
            className="h-6 px-2 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('approvals.request')}
          </Button>
        )}
      </header>

      {/* Create new approval */}
      {creating && (
        <section className="px-3 py-2 border-b bg-muted/10 space-y-2">
          <p className="text-xs font-medium">
            {t('approvals.newRequest')}
          </p>

          {/* Add approvers */}
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              addApprover();
            }}
          >
            <input
              type="text"
              value={newApproverName}
              onChange={(e) => setNewApproverName(e.target.value)}
              placeholder={t('approvals.approverName')}
              className="flex-1 text-xs border rounded px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button type="submit" variant="ghost" size="sm" className="h-7 px-2">
              <Plus className="h-3 w-3" />
            </Button>
          </form>

          {/* Listed approvers */}
          {newApprovers.length > 0 && (
            <ul className="space-y-1">
              {newApprovers.map((a, i) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 text-xs px-2 py-1 bg-muted/30 rounded"
                >
                  <span className="font-medium">{i + 1}.</span>
                  <span>{a.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setNewApprovers((prev) => prev.filter((x) => x.id !== a.id))
                    }
                    className="h-4 w-4 p-0 ml-auto text-destructive"
                  >
                    <XCircle className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {/* Note */}
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder={t('approvals.note')}
            className="w-full text-xs border rounded px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {/* Actions */}
          <nav className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCreating(false);
                setNewApprovers([]);
              }}
              className="h-7 text-xs"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleCreateApproval}
              disabled={newApprovers.length === 0 || submitting}
              className="h-7 text-xs"
            >
              {submitting ? (
                <Spinner size="small" color="inherit" className="mr-1" />
              ) : (
                <Send className="h-3 w-3 mr-1" />
              )}
              {t('approvals.send')}
            </Button>
          </nav>
        </section>
      )}

      {/* Approvals list */}
      <section className="flex-1 overflow-y-auto px-3 py-2 space-y-3 max-h-[300px]">
        {loading ? (
          <p className={cn("text-xs text-center py-4", colors.text.muted)}>
            <Spinner size="small" className="inline mr-1" />
          </p>
        ) : approvals.length === 0 ? (
          <p className={cn("text-xs text-center py-4", colors.text.muted)}>
            {t('approvals.empty')}
          </p>
        ) : (
          approvals.map((approval) => {
            const config = statusConfig[approval.status];
            const StatusIcon = config.icon;
            const isMyTurn = approval.steps.some(
              (s) => s.approverId === currentUserId && s.status === 'pending'
            );

            return (
              <article key={approval.id} className="border rounded-md p-2 space-y-2">
                {/* Approval header */}
                <header className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs">
                    <StatusIcon className={cn('h-3.5 w-3.5', config.colorClass)} />
                    <span className="font-medium">{config.label}</span>
                  </span>
                  <span className={cn("text-[10px]", colors.text.muted)}>
                    {t('approvals.by')} {approval.requestedByName}
                  </span>
                </header>

                {/* Note */}
                {approval.note && (
                  <p className={cn("text-xs italic", colors.text.muted)}>
                    {approval.note}
                  </p>
                )}

                {/* Steps */}
                <ol className="space-y-1">
                  {approval.steps.map((step) => {
                    const stepConfig = statusConfig[step.status];
                    const StepIcon = stepConfig.icon;
                    return (
                      <li
                        key={step.order}
                        className="flex items-center gap-2 text-xs"
                      >
                        <StepIcon
                          className={cn('h-3 w-3', stepConfig.colorClass)}
                        />
                        <span>{step.approverName}</span>
                        {step.reason && (
                          <span className="text-destructive italic ml-auto truncate max-w-[150px]">
                            {step.reason}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>

                {/* Actions */}
                {approval.status === 'pending' && (
                  <nav className="flex gap-1 justify-end">
                    {isMyTurn && (
                      <>
                        {rejectingId === approval.id ? (
                          <form
                            className="flex gap-1 flex-1"
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleReject(approval.id);
                            }}
                          >
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder={t('approvals.rejectReason')}
                              className="flex-1 text-xs border rounded px-1.5 py-0.5 bg-background"
                              autoFocus
                            />
                            <Button
                              type="submit"
                              variant="destructive"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              disabled={!rejectReason.trim()}
                            >
                              {t('approvals.reject')}
                            </Button>
                          </form>
                        ) : (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleApprove(approval.id)}
                              className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700" // eslint-disable-line design-system/enforce-semantic-colors
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {t('approvals.approve')}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setRejectingId(approval.id)}
                              className="h-6 px-2 text-xs"
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              {t('approvals.reject')}
                            </Button>
                          </>
                        )}
                      </>
                    )}
                    {approval.requestedBy === currentUserId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(approval.id)}
                        className={cn("h-6 px-2 text-xs", colors.text.muted)}
                      >
                        {t('approvals.cancel')}
                      </Button>
                    )}
                  </nav>
                )}
              </article>
            );
          })
        )}
      </section>
    </section>
  );
}
