/**
 * =============================================================================
 * File Preview Panel — Split-panel file preview
 * =============================================================================
 *
 * Displays inline preview for supported file types:
 * - PDF: embedded iframe viewer
 * - Images (jpg, png, webp, gif, svg): zoomable image
 * - Video (mp4, webm): HTML5 video player
 * - Unsupported: file metadata + download prompt
 *
 * @module components/file-manager/FilePreviewPanel
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React, { useMemo, useState } from 'react';
import { formatFlexibleDate } from '@/lib/intl-utils';
import {
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Download,
  ExternalLink,
  X,
  File,
  Eye,
  History,
  ScrollText,
  Share2,
  MessageSquare,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFileDisplayName } from '@/hooks/useFileDisplayName';
import { formatFileSize } from '@/utils/file-validation';
import { VersionHistory } from '@/components/shared/files/VersionHistory';
import { AuditLogPanel } from '@/components/shared/files/AuditLogPanel';
import { ShareDialog } from '@/components/shared/files/ShareDialog';
import { CommentsPanel } from '@/components/shared/files/CommentsPanel';
import { ApprovalPanel } from '@/components/shared/files/ApprovalPanel';
import { FilePreviewRenderer } from '@/components/shared/files/preview/FilePreviewRenderer';
import { getPreviewType, type PreviewType } from '@/lib/file-types/preview-registry';
import { useFileDownload } from '@/components/shared/files/hooks/useFileDownload';
import type { FileRecord } from '@/types/file-record';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// TYPES
// ============================================================================

interface FilePreviewPanelProps {
  /** File to preview */
  file: FileRecord | null;
  /** Close preview */
  onClose: () => void;
  /** Tenant isolation — company ID for comments */
  companyId?: string;
  /** Current user ID (for version rollback) */
  currentUserId?: string;
  /** Current user display name (for comments) */
  currentUserName?: string;
  /** Callback after version rollback */
  onRefresh?: () => void;
  /** Optional class */
  className?: string;
}

function getPreviewIcon(previewType: PreviewType) {
  switch (previewType) {
    case 'pdf': return FileText;
    case 'image': return ImageIcon;
    case 'video': return Video;
    case 'audio': return Music;
    case 'docx': return FileText;
    default: return File;
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FilePreviewPanel({ file, onClose, companyId, currentUserId, currentUserName, onRefresh, className }: FilePreviewPanelProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('files');
  const [showVersions, setShowVersions] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const translateDisplayName = useFileDisplayName();

  const previewType = useMemo(
    () => (file ? getPreviewType(file.contentType, file.displayName) : 'unsupported'),
    [file]
  );

  const displayName = useMemo(
    () => (file ? translateDisplayName(file) : ''),
    [file, translateDisplayName]
  );

  const PreviewIcon = getPreviewIcon(previewType);
  const { handleDownload: downloadFile } = useFileDownload();

  const handleDownload = () => { if (file) downloadFile(file); };
  const handleOpenNewTab = () => {
    if (file?.downloadUrl) window.open(file.downloadUrl, '_blank', 'noopener,noreferrer');
  };

  // Empty state
  if (!file) {
    return (
      <section
        className={cn(
          'flex flex-col items-center justify-center h-full',
          colors.text.muted,
          className
        )}
      >
        <Eye className="h-12 w-12 opacity-30 mb-3" />
        <p className="text-sm">{t('manager.selectFileToPreview')}</p>
      </section>
    );
  }

  return (
    <section className={cn('flex flex-col h-full bg-card', className)}>
      {/* Header */}
      <header className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 min-h-[44px]">
        <PreviewIcon className={cn("h-4 w-4 flex-shrink-0", colors.text.muted)} />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-sm font-medium truncate flex-1">
              {displayName}
            </span>
          </TooltipTrigger>
          <TooltipContent>{displayName}</TooltipContent>
        </Tooltip>

        {/* Actions */}
        <nav className="flex items-center gap-1 flex-shrink-0">
          {file.downloadUrl && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleDownload} className="h-7 w-7 p-0">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('list.download')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleOpenNewTab} className="h-7 w-7 p-0">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('list.openInNewTab')}</TooltipContent>
              </Tooltip>
            </>
          )}
          {/* Version history toggle */}
          {file.revision && file.revision > 1 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showVersions ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setShowVersions(!showVersions)}
                  className="h-7 w-7 p-0"
                >
                  <History className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t('versions.title')} (v{file.revision})
              </TooltipContent>
            </Tooltip>
          )}
          {/* Share link */}
          {currentUserId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowShare(true)}
                  className="h-7 w-7 p-0"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t('share.title')}
              </TooltipContent>
            </Tooltip>
          )}
          {/* Comments toggle (ADR-191 Phase 4.3) */}
          {currentUserId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showComments ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setShowComments(!showComments)}
                  className="h-7 w-7 p-0"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t('comments.title')}
              </TooltipContent>
            </Tooltip>
          )}
          {/* Approvals toggle (ADR-191 Phase 3.3) */}
          {currentUserId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showApprovals ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setShowApprovals(!showApprovals)}
                  className="h-7 w-7 p-0"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t('approvals.title')}
              </TooltipContent>
            </Tooltip>
          )}
          {/* Audit log toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showAudit ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowAudit(!showAudit)}
                className="h-7 w-7 p-0"
              >
                <ScrollText className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t('audit.title')}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
                <X className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('common.cancel')}</TooltipContent>
          </Tooltip>
        </nav>
      </header>

      {/* File metadata bar */}
      <div className={cn("flex items-center gap-3 px-3 py-1.5 border-b text-xs bg-muted/10", colors.text.muted)}>
        {file.sizeBytes && <span>{formatFileSize(file.sizeBytes)}</span>}
        {file.contentType && <span>{file.contentType}</span>}
        {file.createdAt && (
          <span>{formatFlexibleDate(file.createdAt)}</span>
        )}
        {file.description && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate ml-auto italic">
                {file.description}
              </span>
            </TooltipTrigger>
            <TooltipContent>{file.description}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Version history panel (collapsible) */}
      {showVersions && (
        <div className="border-b max-h-[250px] overflow-y-auto">
          <VersionHistory
            fileId={file.id}
            currentRevision={file.revision}
            currentUserId={currentUserId}
            onRollback={onRefresh}
            className="p-2"
          />
        </div>
      )}

      {/* Audit log panel (collapsible) */}
      {showAudit && companyId && (
        <div className="border-b max-h-[250px] overflow-y-auto">
          <AuditLogPanel fileId={file.id} companyId={companyId} className="p-2" />
        </div>
      )}

      {/* Comments panel (collapsible — ADR-191 Phase 4.3) */}
      {showComments && currentUserId && companyId && (
        <div className="border-b">
          <CommentsPanel
            fileId={file.id}
            companyId={companyId}
            currentUserId={currentUserId}
            currentUserName={currentUserName || 'User'}
          />
        </div>
      )}

      {/* Approvals panel (collapsible — ADR-191 Phase 3.3) */}
      {showApprovals && currentUserId && companyId && (
        <div className="border-b max-h-[300px] overflow-y-auto">
          <ApprovalPanel
            fileId={file.id}
            companyId={companyId}
            currentUserId={currentUserId}
            currentUserName={currentUserName || 'User'}
          />
        </div>
      )}

      {/* Preview area — SSoT renderer, shared with public share page */}
      <FilePreviewRenderer
        url={file.downloadUrl}
        contentType={file.contentType}
        fileName={file.displayName}
        displayName={displayName}
        sizeBytes={file.sizeBytes}
        onDownload={handleDownload}
      />

      {/* Share dialog */}
      {currentUserId && (
        <ShareDialog
          open={showShare}
          onOpenChange={setShowShare}
          fileId={file.id}
          fileName={displayName}
          userId={currentUserId}
          companyId={companyId}
        />
      )}
    </section>
  );
}
