/**
 * =============================================================================
 * 🏢 ENTERPRISE: Audit Log Panel
 * =============================================================================
 *
 * Displays file audit trail with action history.
 * Used in FilePreviewPanel to show who did what and when.
 *
 * @module components/shared/files/AuditLogPanel
 * @enterprise ADR-191 - Enterprise Document Management System (Phase 3.1)
 * @compliance ISO 27001 §A.12.4 (Logging and Monitoring)
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  ScrollText,
  Eye,
  Download,
  Upload,
  Trash2,
  RotateCcw,
  Pencil,
  Shield,
  Sparkles,
  Clock,
  User,
  Loader2,
  Link2,
  Unlink,
  Archive,
  FileText,
  Share2,
  Lock,
  Unlock,
  FolderInput,
  Send,
  CheckCircle,
  XCircle,
  Ban,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { formatDate } from '@/lib/intl-utils';
import {
  FileAuditService,
  type FileAuditRecord,
  type FileAuditAction,
} from '@/services/file-audit.service';

// ============================================================================
// ACTION ICON MAP
// ============================================================================

type LucideIcon = React.ComponentType<{ className?: string }>;

const ACTION_ICON_MAP: Record<FileAuditAction, LucideIcon> = {
  view: Eye,
  download: Download,
  upload: Upload,
  finalize: FileText,
  rename: Pencil,
  description_update: Pencil,
  classify: Shield,
  ai_classify: Sparkles,
  delete: Trash2,
  restore: RotateCcw,
  archive: Archive,
  version_create: Upload,
  version_rollback: RotateCcw,
  link: Link2,
  unlink: Unlink,
  batch_delete: Trash2,
  batch_download: Download,
  batch_classify: Shield,
  share: Share2,
  hold_place: Lock,
  hold_release: Unlock,
  move: FolderInput,
  approval_request: Send,
  approval_approve: CheckCircle,
  approval_reject: XCircle,
  approval_cancel: Ban,
  comment: MessageSquare,
};

const ACTION_COLOR_MAP: Record<string, string> = {
  view: 'text-blue-500',
  download: 'text-green-600',
  upload: 'text-primary',
  finalize: 'text-primary',
  rename: 'text-amber-600',
  description_update: 'text-amber-600',
  classify: 'text-indigo-600',
  ai_classify: 'text-violet-600',
  delete: 'text-destructive',
  restore: 'text-green-600',
  archive: 'text-orange-500',
  version_create: 'text-cyan-600',
  version_rollback: 'text-amber-600',
  link: 'text-blue-500',
  unlink: 'text-orange-500',
  batch_delete: 'text-destructive',
  batch_download: 'text-green-600',
  batch_classify: 'text-indigo-600',
  share: 'text-blue-500',
  hold_place: 'text-red-600',
  hold_release: 'text-green-600',
  move: 'text-blue-500',
  approval_request: 'text-amber-600',
  approval_approve: 'text-green-600',
  approval_reject: 'text-destructive',
  approval_cancel: 'text-orange-500',
  comment: 'text-blue-500',
};

// ============================================================================
// TYPES
// ============================================================================

interface AuditLogPanelProps {
  /** File ID to show audit log for */
  fileId: string;
  /** Additional className */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AuditLogPanel({ fileId, className }: AuditLogPanelProps) {
  const { t } = useTranslation('files');
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
  const iconSizes = useIconSizes();

  const [entries, setEntries] = useState<FileAuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const history = await FileAuditService.getFileHistory(fileId, 30);
        if (!cancelled) {
          setEntries(history);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load audit log');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [fileId]);

  // Empty state
  if (!loading && entries.length === 0 && !error) {
    return (
      <section className={cn('p-4 text-center', colors.text.muted, className)}>
        <ScrollText className={cn(iconSizes.lg, 'mx-auto mb-2 opacity-50')} />
        <p className="text-sm">
          {t('audit.noEntries', 'Δεν υπάρχουν καταγραφές')}
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn('space-y-1', className)}
      aria-label={t('audit.title', 'Ιστορικό ενεργειών')}
    >
      {/* Header */}
      <header className="flex items-center gap-2 px-2 pb-1">
        <ScrollText className={cn(iconSizes.sm, colors.text.muted)} />
        <h4 className="text-sm font-medium">
          {t('audit.title', 'Ιστορικό ενεργειών')}
        </h4>
        {!loading && (
          <span className={cn('text-xs', colors.text.muted)}>
            ({entries.length})
          </span>
        )}
      </header>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center p-4">
          <Loader2 className={cn(iconSizes.md, 'animate-spin', colors.text.muted)} />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive px-2">{error}</p>
      )}

      {/* Audit entries */}
      {entries.map((entry) => {
        const ActionIcon = ACTION_ICON_MAP[entry.action] ?? ScrollText;
        const actionColor = ACTION_COLOR_MAP[entry.action] ?? colors.text.muted;

        return (
          <article
            key={entry.id}
            className={cn(
              'flex items-start gap-2 px-2 py-1.5',
              quick.card,
              'border',
            )}
          >
            {/* Action icon */}
            <span className={cn('flex-shrink-0 mt-0.5', actionColor)}>
              <ActionIcon className="h-3.5 w-3.5" />
            </span>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">
                {t(`audit.action.${entry.action}`, entry.action)}
              </p>
              <div className={cn('flex items-center gap-2 text-[11px]', colors.text.muted)}>
                <span className="flex items-center gap-0.5">
                  <User className="h-2.5 w-2.5" />
                  {entry.performedBy.length > 20
                    ? `${entry.performedBy.slice(0, 8)}...`
                    : entry.performedBy}
                </span>
                <span className="flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {formatDate(entry.timestamp)}
                </span>
              </div>
              {/* Metadata details */}
              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <p className={cn('text-[10px] mt-0.5 truncate', colors.text.muted)}>
                  {Object.entries(entry.metadata)
                    .filter(([, v]) => v !== null && v !== undefined)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ')}
                </p>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
