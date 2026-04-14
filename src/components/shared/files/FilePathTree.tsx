/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Path Tree Component
 * =============================================================================
 *
 * "Windows Explorer style" hierarchical tree visualization for file paths.
 *
 * @module components/shared/files/FilePathTree
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Copy, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFileDisplayName } from '@/hooks/useFileDisplayName';
import type { FileRecord } from '@/types/file-record';
import {
  buildFilePathTree,
  buildStudyGroupTree,
  type FolderNode,
  type FileNode,
} from './utils/file-path-tree';
import { formatFileSize } from '@/utils/file-validation';
import { copyToClipboard } from '@/lib/share-utils';
import { useNotifications } from '@/providers/NotificationProvider';
import { FileInspector } from './FileInspector';
import '@/lib/design-system';

import type { FilePathTreeProps } from './file-path-tree-config';
import {
  getFolderIndentClass,
  getFileIndentClass,
  filterTreeToContextLevel,
} from './file-path-tree-config';

// Re-export props type
export type { FilePathTreeProps } from './file-path-tree-config';

const logger = createModuleLogger('FilePathTree');

// ============================================================================
// COMPONENT
// ============================================================================

export function FilePathTree({
  files,
  onFileSelect,
  className,
  contextLevel = 'full',
  companyName,
  viewMode = 'business',
  groupByStudyGroup = false,
}: FilePathTreeProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation(['files', 'files-media']);
  const translateDisplayName = useFileDisplayName();
  const { success, error } = useNotifications();

  const [inspectedFile, setInspectedFile] = useState<FileRecord | null>(null);

  const useStudyGroups = groupByStudyGroup || viewMode === 'business';

  const tree = useMemo(() => {
    if (useStudyGroups) {
      return buildStudyGroupTree(files);
    }
    const fullTree = buildFilePathTree(files);
    return filterTreeToContextLevel(fullTree, contextLevel);
  }, [files, contextLevel, useStudyGroups]);

  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    setCollapsedNodes(new Set());
  }, [useStudyGroups, files]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleFolderToggle = useCallback((folderId: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) { next.delete(folderId); } else { next.add(folderId); }
      return next;
    });
  }, []);

  const handleFileSelect = useCallback(
    (fileRecord: FileRecord) => { onFileSelect?.(fileRecord); },
    [onFileSelect]
  );

  const handleCopyPath = useCallback(
    async (fileRecord: FileRecord, event: React.MouseEvent) => {
      event.stopPropagation();
      const storagePath = fileRecord.storagePath;
      if (!storagePath) { error(t('technical.pathUnavailable')); return; }

      try {
        const copied = await copyToClipboard(storagePath);
        if (copied) { success(t('technical.pathCopied')); }
        else { error(t('copy.copyError', { ns: 'common' })); }
      } catch (err) {
        logger.error('Failed to copy path', { error: err });
        error(t('copy.copyError', { ns: 'common' }));
      }
    },
    [success, error, t]
  );

  const handleOpenInspector = useCallback(
    (fileRecord: FileRecord, event: React.MouseEvent) => {
      event.stopPropagation();
      setInspectedFile(fileRecord);
    },
    []
  );

  const handleCloseInspector = useCallback(() => { setInspectedFile(null); }, []);

  // =========================================================================
  // RENDER HELPERS
  // =========================================================================

  const getSegmentLabel = useCallback(
    (segment: string, value?: string): string => {
      if (segment === 'study-group') return '';

      if (viewMode === 'business') {
        if (segment === 'domains' && value) return t(`domains.${value}`, value);
        if (segment === 'categories' && value) return t(`categories.${value}`, value);
        if (segment === 'companies' || segment === 'entities' || segment === 'files') return '';
      }

      if (viewMode === 'technical') {
        if (segment === 'companies' && value) return companyName || value;
        if (segment === 'entities' && value) return t(`entityTypes.${value}`, value);
        if (segment === 'domains' && value) return t(`domains.${value}`, value);
        if (segment === 'categories' && value) return t(`categories.${value}`, value);
        if (['companies', 'projects', 'entities', 'domains', 'categories', 'files'].includes(segment)) {
          return t(`pathSegments.${segment}`);
        }
      }

      return value || segment;
    },
    [t, companyName, viewMode]
  );

  const renderFolderNode = useCallback(
    (node: FolderNode, depth: number): React.ReactNode => {
      const isExpanded = !collapsedNodes.has(node.id);
      const hasChildren = node.children.length > 0;
      const translatedLabel = getSegmentLabel(node.segment, node.value);
      const label = (node.segment === 'study-group') ? node.label : translatedLabel;

      // Business view: skip technical segments
      if (viewMode === 'business' && (node.segment === 'companies' || node.segment === 'entities' || node.segment === 'files')) {
        if (hasChildren) {
          return (
            <React.Fragment key={node.id}>
              {node.children.map((child) => {
                if (child.type === 'folder') return renderFolderNode(child, depth);
                if (child.type === 'file') return renderFileNode(child, depth);
                return null;
              })}
            </React.Fragment>
          );
        }
        return null;
      }

      const Icon = isExpanded ? FolderOpen : Folder;
      const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

      return (
        <li key={node.id} className="list-none">
          <button
            type="button"
            onClick={() => handleFolderToggle(node.id)}
            className={cn(
              'flex items-center gap-2 w-full py-1 px-2 rounded transition-colors',
              'hover:bg-muted text-left',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              getFolderIndentClass(depth)
            )}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? t('tree.collapse') : t('tree.expand')}
          >
            {hasChildren ? (
              <ChevronIcon className={cn(iconSizes.xs, `flex-shrink-0 ${colors.text.muted}`)} />
            ) : (
              <span className={cn(iconSizes.xs)} />
            )}
            <Icon className={cn(iconSizes.sm, `flex-shrink-0 ${colors.text.muted}`)} aria-hidden="true" />
            <span className="text-sm font-medium truncate">{label}</span>
            {hasChildren && (
              <span className={cn("ml-auto text-xs", colors.text.muted)}>({node.children.length})</span>
            )}
          </button>

          {isExpanded && hasChildren && (
            <ul className="m-0 p-0" role="group">
              {node.children.map((child) => {
                if (child.type === 'folder') return renderFolderNode(child, depth + 1);
                if (child.type === 'file') return renderFileNode(child, depth + 1);
                return null;
              })}
            </ul>
          )}
        </li>
      );
    },
    [iconSizes, t, getSegmentLabel, handleFolderToggle, viewMode, collapsedNodes]
  );

  const renderFileNode = useCallback(
    (node: FileNode, depth: number): React.ReactNode => {
      const showTechnicalActions = viewMode === 'technical';

      return (
        <li key={node.id} className="list-none">
          <div
            className={cn(
              'flex items-center gap-2 w-full py-1 px-2 rounded transition-colors group',
              'hover:bg-accent/50',
              getFileIndentClass(depth)
            )}
          >
            <FileText className={cn(iconSizes.sm, 'flex-shrink-0 text-primary')} aria-hidden="true" />

            <button
              type="button"
              onClick={() => handleFileSelect(node.fileRecord)}
              className={cn(
                'flex-1 text-left text-sm truncate',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded'
              )}
              aria-label={`${t('tree.file')}: ${translateDisplayName(node.fileRecord)}`}
            >
              {translateDisplayName(node.fileRecord)}
            </button>

            {node.fileRecord.sizeBytes && (
              <span className={cn("text-xs", colors.text.muted)}>
                {formatFileSize(node.fileRecord.sizeBytes)}
              </span>
            )}

            {showTechnicalActions && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => handleCopyPath(node.fileRecord, e)}
                      className={cn(
                        'p-1.5 rounded transition-colors',
                        `hover:bg-muted ${colors.text.muted} hover:text-foreground`,
                        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1'
                      )}
                      aria-label={t('technical.copyPath')}
                    >
                      <Copy className={iconSizes.xs} aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('technical.copyPath')}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => handleOpenInspector(node.fileRecord, e)}
                      className={cn(
                        'p-1.5 rounded transition-colors',
                        `hover:bg-muted ${colors.text.muted} hover:text-foreground`,
                        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1'
                      )}
                      aria-label={t('technical.details')}
                    >
                      <Info className={iconSizes.xs} aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('technical.details')}</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </li>
      );
    },
    [iconSizes, t, handleFileSelect, handleCopyPath, handleOpenInspector, viewMode, translateDisplayName]
  );

  // =========================================================================
  // RENDER
  // =========================================================================

  if (files.length === 0) {
    return (
      <section className={cn('p-2 text-center', colors.text.muted, className)}>
        <p className="text-sm">{t('list.noFiles')}</p>
      </section>
    );
  }

  return (
    <>
      <nav className={cn('rounded-lg border bg-card', className)} aria-label={t('tree.title')}>
        <header className="px-2 py-2 border-b bg-muted/50">
          <h3 className="text-sm font-semibold">{t('tree.title')}</h3>
        </header>

        <div className="p-2 max-h-96 overflow-y-auto">
          <ul className="m-0 p-0" role="tree">
            {tree.type === 'root' &&
              tree.children.map((child) => {
                if (child.type === 'folder') return renderFolderNode(child, 0);
                if (child.type === 'file') return renderFileNode(child, 0);
                return null;
              })}
          </ul>
        </div>
      </nav>

      {inspectedFile && (
        <FileInspector
          file={inspectedFile}
          open={!!inspectedFile}
          onClose={handleCloseInspector}
          companyName={companyName}
        />
      )}
    </>
  );
}
