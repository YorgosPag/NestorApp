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
import type { FileClassification } from '@/config/domain-constants';

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
}: BatchActionsBarProps) {
  const { t } = useTranslation('files');
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [archiving, setArchiving] = useState(false);

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

  return (
    <nav
      className="flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg"
      aria-label={t('batch.toolbar', 'Μαζικές ενέργειες')}
    >
      {/* Selection info */}
      <span className="text-sm font-medium tabular-nums">
        {`${selectedCount} / ${totalCount} ${t('batch.selectedLabel', 'επιλεγμένα')}`}
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
              ? t('batch.deselectAll', 'Αποεπιλογή')
              : t('batch.selectAll', 'Επιλογή όλων')}
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
          <SelectValue placeholder={t('batch.classify', 'Ταξινόμηση')} />
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
              {t('batch.aiClassify', 'AI Ταξινόμηση')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('batch.aiClassifyTooltip', 'Αυτόματη αναγνώριση τύπου εγγράφου με AI')}</TooltipContent>
        </Tooltip>
      )}

      {/* Batch archive (ADR-191 Phase 3.2) */}
      {onBatchArchive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                setArchiving(true);
                try { await onBatchArchive(); } finally { setArchiving(false); }
              }}
              disabled={archiving}
              className="h-7 px-2 text-xs text-orange-600 hover:text-orange-700"
            >
              {archiving ? (
                <Spinner size="small" color="inherit" className="mr-1" />
              ) : (
                <Archive className="h-3.5 w-3.5 mr-1" />
              )}
              {t('batch.archive', 'Αρχειοθέτηση')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('batch.archiveTooltip', 'Μεταφορά σε αρχειοθήκη')}</TooltipContent>
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
            {t('batch.downloadZip', 'Λήψη ZIP')}
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
            {t('batch.delete', 'Διαγραφή')}
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
        <TooltipContent>{t('batch.clearSelection', 'Κλείσιμο επιλογής')}</TooltipContent>
      </Tooltip>
    </nav>
  );
}
