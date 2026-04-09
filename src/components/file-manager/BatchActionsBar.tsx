/**
 * =============================================================================
 * Batch Actions Bar — Multi-select file operations toolbar
 * =============================================================================
 *
 * Floating action bar when files are selected.
 * Supports: select all, batch delete, batch ZIP download, classification.
 *
 * @module components/file-manager/BatchActionsBar
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React, { useState } from 'react';
import {
  Download,
  Trash2,
  X,
  CheckSquare,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Archive,
  RotateCcw,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { FileClassification } from '@/config/domain-constants';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

interface BatchActionsBarProps {
  /** Number of selected files */
  selectedCount: number;
  /** Total number of files */
  totalCount: number;
  /** Select/deselect all */
  onSelectAll: () => void;
  /** Clear selection */
  onClearSelection: () => void;
  /** Batch delete (move to trash) */
  onBatchDelete: () => Promise<void>;
  /** Batch download as ZIP */
  onBatchDownload: () => Promise<void>;
  /** Batch classify (manual data classification) */
  onBatchClassify: (classification: FileClassification) => Promise<void>;
  /** AI auto-classify (ADR-191 Phase 2.2) */
  onAIClassify?: () => Promise<void>;
  /** Whether AI classification is in progress */
  aiClassifying?: boolean;
  /** Batch archive */
  onBatchArchive?: () => Promise<void>;
  /** Batch unarchive (restore from archive) */
  onBatchUnarchive?: () => Promise<void>;
}

// ============================================================================
// CLASSIFICATION CONFIG
// ============================================================================

const CLASSIFICATION_OPTIONS: { value: FileClassification; icon: typeof Shield }[] = [
  { value: 'public', icon: ShieldCheck },
  { value: 'internal', icon: Shield },
  { value: 'confidential', icon: ShieldAlert },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function BatchActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBatchDelete,
  onBatchDownload,
  onBatchClassify,
  onAIClassify,
  aiClassifying = false,
  onBatchArchive,
  onBatchUnarchive,
}: BatchActionsBarProps) {
  const { t } = useTranslation('files');
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [unarchiving, setUnarchiving] = useState(false);
  const [unarchiveDialogOpen, setUnarchiveDialogOpen] = useState(false);

  const allSelected = selectedCount === totalCount && totalCount > 0;

  async function handleDelete() {
    setDeleting(true);
    try {
      await onBatchDelete();
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      await onBatchDownload();
    } finally {
      setDownloading(false);
    }
  }

  async function handleClassify(value: string) {
    await onBatchClassify(value as FileClassification);
  }

  async function handleArchiveConfirm() {
    if (!onBatchArchive) return;

    setArchiving(true);
    try {
      await onBatchArchive();
      setArchiveDialogOpen(false);
    } finally {
      setArchiving(false);
    }
  }

  async function handleUnarchiveConfirm() {
    if (!onBatchUnarchive) return;

    setUnarchiving(true);
    try {
      await onBatchUnarchive();
      setUnarchiveDialogOpen(false);
    } finally {
      setUnarchiving(false);
    }
  }

  return (
    <nav
      className="flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg"
      aria-label={t('batch.toolbar')}
    >
      {/* Selection info */}
      <span className="text-sm font-medium tabular-nums">
        {`${selectedCount} / ${totalCount} ${t('batch.selectedLabel')}`}
      </span>

      {/* Select all / Clear */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={allSelected ? onClearSelection : onSelectAll}
            className="h-7 px-2 text-xs"
          >
            <CheckSquare className="h-3.5 w-3.5 mr-1" />
            {allSelected
              ? t('batch.deselectAll')
              : t('batch.selectAll')}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {allSelected ? t('batch.deselectAll') : t('batch.selectAll')}
        </TooltipContent>
      </Tooltip>

      <span className="w-px h-5 bg-border" aria-hidden="true" />

      {/* Classification dropdown */}
      <Select onValueChange={handleClassify}>
        <SelectTrigger className="h-7 w-[160px] text-xs">
          <SelectValue placeholder={t('batch.classify')} />
        </SelectTrigger>
        <SelectContent>
          {CLASSIFICATION_OPTIONS.map(({ value, icon: Icon }) => (
            <SelectItem key={value} value={value}>
              <span className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                {t(`batch.classification.${value}`)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* AI Auto-Classify (ADR-191 Phase 2.2) */}
      {onAIClassify && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onAIClassify}
              disabled={aiClassifying}
              className="h-7 px-2 text-xs text-violet-600 hover:text-violet-700"
            >
              {aiClassifying ? (
                <Spinner size="small" color="inherit" className="mr-1" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1" />
              )}
              {t('batch.aiClassify')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('batch.aiClassifyTooltip')}</TooltipContent>
        </Tooltip>
      )}

      {/* Batch archive (ADR-191 Phase 3.2) */}
      {onBatchArchive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setArchiveDialogOpen(true)}
              disabled={archiving}
              className="h-7 px-2 text-xs text-orange-600 hover:text-orange-700"
            >
              {archiving ? (
                <Spinner size="small" color="inherit" className="mr-1" />
              ) : (
                <Archive className="h-3.5 w-3.5 mr-1" />
              )}
              {t('batch.archive')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('batch.archiveTooltip')}</TooltipContent>
        </Tooltip>
      )}

      {/* Batch unarchive (restore from archive) */}
      {onBatchUnarchive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUnarchiveDialogOpen(true)}
              disabled={unarchiving}
              className="h-7 px-2 text-xs text-green-600 hover:text-green-700"
            >
              {unarchiving ? (
                <Spinner size="small" color="inherit" className="mr-1" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
              )}
              {t('batch.unarchive')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('batch.unarchiveTooltip')}</TooltipContent>
        </Tooltip>
      )}

      <span className="w-px h-5 bg-border" aria-hidden="true" />

      {/* Batch download */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
            className="h-7 px-2 text-xs"
          >
            {downloading ? (
              <Spinner size="small" color="inherit" className="mr-1" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-1" />
            )}
            {t('batch.downloadZip')}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('batch.downloadZip')}</TooltipContent>
      </Tooltip>

      {/* Batch delete */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          >
            {deleting ? (
              <Spinner size="small" color="inherit" className="mr-1" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 mr-1" />
            )}
            {t('batch.delete')}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('batch.delete')}</TooltipContent>
      </Tooltip>

      {/* Close selection */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-7 w-7 p-0 ml-auto"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('batch.clearSelection')}</TooltipContent>
      </Tooltip>

      <ConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title={t('batch.archiveConfirmTitle')}
        description={t('batch.archiveConfirmDescription', { count: selectedCount })}
        confirmText={t('batch.archiveConfirmText')}
        variant="warning"
        loading={archiving}
        onConfirm={handleArchiveConfirm}
      />

      <ConfirmDialog
        open={unarchiveDialogOpen}
        onOpenChange={setUnarchiveDialogOpen}
        title={t('archived.batchUnarchiveConfirmTitle')}
        description={t('archived.batchUnarchiveConfirmDescription', { count: selectedCount })}
        confirmText={t('archived.batchUnarchiveConfirmText')}
        variant="default"
        loading={unarchiving}
        onConfirm={handleUnarchiveConfirm}
      />
    </nav>
  );
}
