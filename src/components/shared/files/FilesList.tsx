/**
 * =============================================================================
 * FilesList — Enterprise-grade file list display component
 * =============================================================================
 *
 * Displays FileRecords with professional UI patterns (Salesforce/Microsoft style).
 * Inline rename, description editing, delete/unlink confirmations.
 *
 * @module components/shared/files/FilesList
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React from 'react';
import { getStatusColor } from '@/lib/design-system';
import { FileText, Eye, Trash2, Calendar, HardDrive, Link2, Unlink, Pencil, Check, X, RotateCcw } from 'lucide-react';
import type { FileRecord } from '@/types/file-record';
import type { FileRecordWithLinkStatus } from './hooks/useEntityFiles';
import { FileThumbnail } from './FileThumbnail';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS, FORM_BUTTON_EFFECTS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFileDisplayName } from '@/hooks/useFileDisplayName';
import { formatFileSize } from '@/utils/file-validation';
import { formatDate } from '@/lib/intl-utils';
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DeletionBlockedDialog } from '@/components/shared/DeletionBlockedDialog';
import { useFileListActions } from './hooks/useFileListActions';
import { useFileClassification } from './hooks/useFileClassification';
import { useUserDisplayNames, seedUserNameCache } from '@/hooks/useUserDisplayNames';
import { useAuth } from '@/auth/hooks/useAuth';

// ============================================================================
// TYPES
// ============================================================================

export interface FilesListProps {
  files: FileRecordWithLinkStatus[];
  loading?: boolean;
  onDelete?: (fileId: string) => Promise<void>;
  onView?: (file: FileRecord) => void;
  onDownload?: (file: FileRecord) => void;
  onRename?: (fileId: string, newDisplayName: string) => void;
  onDescriptionUpdate?: (fileId: string, description: string) => void;
  currentUserId?: string;
  onLink?: (file: FileRecord) => void;
  onUnlink?: (fileId: string) => Promise<void>;
  showLinkAction?: boolean;
  entityType?: string;
  selectedIds?: Set<string>;
  onToggleSelect?: (fileId: string) => void;
  onClassified?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FilesList({
  files,
  loading = false,
  onDelete,
  onView,
  onDownload,
  onRename,
  onDescriptionUpdate,
  currentUserId,
  onLink,
  onUnlink,
  showLinkAction = false,
  entityType,
  selectedIds,
  onToggleSelect,
  onClassified,
}: FilesListProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation(['files', 'files-media']);
  const translateDisplayName = useFileDisplayName();

  const { user } = useAuth();
  // Pre-seed cache with current user (displayName may be null for email/password accounts)
  if (user?.uid) {
    const name = user.displayName || user.email || '';
    if (name) seedUserNameCache(user.uid, name);
  }

  const uploaderUids = files.map(f => f.createdBy).filter(Boolean);
  const uploaderNames = useUserDisplayNames(uploaderUids);

  // Dynamic entity name for link/unlink tooltips
  const entityName = t(`list.entityName.${entityType ?? 'building'}`);
  const linkFileLabel = t('list.linkFile', { entity: entityName });
  const unlinkFileLabel = t('list.unlinkFile', { entity: entityName });

  const { classifyFile, classifyingIds } = useFileClassification();

  async function handleRetryClassify(fileId: string) {
    await classifyFile(fileId, true);
    onClassified?.();
  }

  // All interactive state + handlers from extracted hook
  const actions = useFileListActions({
    onDelete, onView, onDownload, onRename, onDescriptionUpdate,
    onLink, onUnlink, currentUserId,
  });

  // Loading state
  if (loading) {
    return (
      <section className="space-y-2" role="status" aria-label={t('list.loadingFiles')}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`p-2 bg-card ${quick.card} border animate-pulse`}
            aria-hidden="true"
          >
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 bg-muted ${quick.card}`} />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </section>
    );
  }

  // Empty state
  if (files.length === 0) {
    return (
      <section
        className={`p-2 text-center ${colors.bg.muted} ${quick.card}`}
        role="status"
        aria-label={t('list.noFiles')}
      >
        <FileText className={`${iconSizes.xl} mx-auto mb-2 ${colors.text.muted}`} />
        <p className={cn("text-sm", colors.text.muted)}>{t('list.noFilesDescription')}</p>
      </section>
    );
  }

  // Files list
  return (
    <section className="space-y-2" role="region" aria-labelledby="files-list-heading">
      <h3 id="files-list-heading" className="sr-only">
        {t('list.filesList')}
      </h3>

      {files.map((file) => (
        <article
          key={file.id}
          className={`flex items-center justify-between p-2 bg-card ${quick.card} border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} cursor-pointer`}
          aria-label={`${t('list.file')}: ${translateDisplayName(file)}`}
          onClick={() => onView?.(file)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView?.(file); } }}
          draggable
          onDragStart={(e) => {
            const ids = selectedIds?.has(file.id) ? Array.from(selectedIds) : [file.id];
            e.dataTransfer.setData('application/x-file-ids', JSON.stringify(ids));
            e.dataTransfer.effectAllowed = 'move';
          }}
        >
          {/* Checkbox for multi-select */}
          {onToggleSelect && (
            <label className="flex-shrink-0 flex items-center justify-center w-6 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds?.has(file.id) ?? false}
                onChange={() => onToggleSelect(file.id)}
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                aria-label={`Select ${translateDisplayName(file)}`}
              />
            </label>
          )}

          {/* File info */}
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <FileThumbnail
              ext={file.ext}
              contentType={file.contentType}
              thumbnailUrl={file.thumbnailUrl}
              downloadUrl={file.downloadUrl}
              displayName={translateDisplayName(file)}
              size="sm"
              borderRadius={quick.card}
            />

            <div className="flex-1 min-w-0">
              {/* Display name — inline editable */}
              {actions.editingFileId === file.id ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={actions.editingName}
                    onChange={(e) => actions.setEditingName(e.target.value)}
                    onKeyDown={actions.handleRenameKeyDown}
                    className="flex-1 text-sm font-medium border rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={actions.renameLoading}
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={actions.handleRenameConfirm}
                    disabled={actions.renameLoading || !actions.editingName.trim()}
                    className={`h-6 w-6 ${getStatusColor('active', 'text')}`}
                    aria-label={t('list.confirmRename')}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={actions.handleRenameCancel}
                    disabled={actions.renameLoading}
                    className={`h-6 w-6 ${getStatusColor('error', 'text')}`}
                    aria-label={t('common.cancel')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm font-medium text-foreground truncate">
                  {translateDisplayName(file)}
                </p>
              )}

              {/* Metadata */}
              <div className={cn("flex items-center gap-2 text-xs mt-1", colors.text.muted)}>
                {(() => {
                  const uploaderName = uploaderNames.get(file.createdBy)
                    ?? (file.createdBy && file.createdBy === user?.uid
                      ? (user.displayName || user.email || null)
                      : null);
                  return uploaderName
                    ? <span className="truncate max-w-[120px]">{uploaderName}</span>
                    : null;
                })()}
                <span className="flex items-center gap-1">
                  <HardDrive className={iconSizes.xs} aria-hidden="true" />
                  {formatFileSize(file.sizeBytes ?? 0)}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className={iconSizes.xs} aria-hidden="true" />
                  {formatDate(file.createdAt)}
                </span>
                <span className="uppercase">.{file.ext}</span>

                {/* Classification badge */}
                {file.classification && file.classification !== 'internal' && (
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-medium leading-none',
                    file.classification === 'confidential' && 'bg-destructive/15 text-destructive',
                    file.classification === 'public' && `${getStatusColor('available', 'bg')}/15 ${getStatusColor('available', 'text')}`,
                  )}>
                    {t(`batch.classification.${file.classification}`)}
                  </span>
                )}

                {/* AI classification state badge */}
                {file.ingestion?.state === 'classifying' && (
                  <span className={`animate-pulse px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${getStatusColor('pending', 'bg')}/15 ${getStatusColor('pending', 'text')}`}>
                    {t('list.classifying', 'Ανάλυση...')}
                  </span>
                )}
                {file.ingestion?.state === 'classification_failed' && (
                  <span className="inline-flex items-center gap-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${getStatusColor('error', 'bg')}/15 ${getStatusColor('error', 'text')}`}>
                      {t('list.classificationFailed')}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleRetryClassify(file.id)}
                          disabled={classifyingIds.has(file.id)}
                          aria-label={t('list.retryClassification')}
                          className={cn(
                            'inline-flex items-center justify-center rounded p-0.5',
                            'text-blue-600 dark:text-blue-400',
                            'hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity',
                          )}
                        >
                          <RotateCcw
                            className={cn(iconSizes.xs, classifyingIds.has(file.id) && 'animate-spin')}
                            aria-hidden="true"
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t('list.retryClassification')}</TooltipContent>
                    </Tooltip>
                  </span>
                )}
                {file.ingestion?.analysis?.documentType && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium leading-none bg-violet-500/15 text-violet-700 dark:text-violet-400">
                    {t(`documentType.${file.ingestion.analysis.documentType}`, file.ingestion.analysis.documentType)}
                  </span>
                )}

                {/* Linked file indicator */}
                {file.isLinkedFile && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`flex items-center gap-1 ${getStatusColor('pending', 'text')}`}>
                        <Link2 className={iconSizes.xs} aria-hidden="true" />
                        {t('list.linkedFromProject')}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t('list.linkedFromProject')}</TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Description — inline editable */}
              {actions.editingDescFileId === file.id ? (
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="text"
                    value={actions.editingDesc}
                    onChange={(e) => actions.setEditingDesc(e.target.value)}
                    onKeyDown={actions.handleDescriptionKeyDown}
                    onBlur={actions.handleDescriptionSave}
                    placeholder={t('list.descriptionPlaceholder')}
                    className={cn("flex-1 text-xs border rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring", colors.text.muted)}
                    autoFocus
                  />
                </div>
              ) : file.description ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p
                      className={cn("text-xs mt-0.5 truncate cursor-pointer hover:text-foreground transition-colors", colors.text.muted)}
                      onClick={(e) => { e.stopPropagation(); if (onDescriptionUpdate) actions.handleDescriptionStart(file); }}
                    >
                      {file.description}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent>{file.description}</TooltipContent>
                </Tooltip>
              ) : onDescriptionUpdate ? (
                <button
                  type="button"
                  className={cn("text-xs mt-0.5 transition-colors", `${colors.text.muted}/50`, `hover:${colors.text.muted}`)}
                  onClick={(e) => { e.stopPropagation(); actions.handleDescriptionStart(file); }}
                >
                  {t('list.addDescription')}
                </button>
              ) : null}
            </div>
          </div>

          {/* Actions */}
          <nav className="flex items-center space-x-1" role="toolbar" aria-label={t('list.fileActions')}>
            {onRename && !file.isLinkedFile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); actions.handleRenameStart(file); }} aria-label={t('list.renameFile')}>
                    <Pencil className={iconSizes.sm} aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('list.renameFile')}</TooltipContent>
              </Tooltip>
            )}

            {showLinkAction && onLink && !file.isLinkedFile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={(e) => actions.handleLinkClick(file, e)} className={getStatusColor('pending', 'text')} aria-label={linkFileLabel}>
                    <Link2 className={iconSizes.sm} aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{linkFileLabel}</TooltipContent>
              </Tooltip>
            )}

            {file.isLinkedFile && onUnlink && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={(e) => actions.handleUnlinkClick(file.id, e)} className="text-orange-500" aria-label={unlinkFileLabel}>
                    <Unlink className={iconSizes.sm} aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{unlinkFileLabel}</TooltipContent>
              </Tooltip>
            )}

            {onDelete && currentUserId && !file.isLinkedFile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={(e) => actions.handleDeleteClick(file.id, e)} className={`text-red-500 ${FORM_BUTTON_EFFECTS.DESTRUCTIVE}`} aria-label={t('list.deleteFile')}>
                    <Trash2 className={iconSizes.sm} aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('list.deleteFile')}</TooltipContent>
              </Tooltip>
            )}
          </nav>
        </article>
      ))}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmDialog
        open={actions.deleteConfirmOpen}
        onOpenChange={actions.setDeleteConfirmOpen}
        title={t('list.deleteFile')}
        description={t('list.deleteConfirm')}
        onConfirm={actions.handleDeleteConfirm}
        confirmText={t('list.delete')}
        cancelText={t('list.cancel')}
        loading={actions.deleteLoading}
      />

      {/* File Hold Blocked Modal */}
      <DeletionBlockedDialog
        open={actions.deleteBlockedOpen}
        onOpenChange={actions.setDeleteBlockedOpen}
        dependencies={[]}
        message={actions.deleteBlockedMessage}
      />

      {/* Unlink Confirmation Modal */}
      <DeleteConfirmDialog
        open={actions.unlinkConfirmOpen}
        onOpenChange={actions.setUnlinkConfirmOpen}
        title={unlinkFileLabel}
        description={t('list.unlinkConfirm')}
        onConfirm={actions.handleUnlinkConfirm}
        confirmText={t('list.unlink')}
        cancelText={t('list.cancel')}
        loading={actions.unlinkLoading}
      />
    </section>
  );
}

