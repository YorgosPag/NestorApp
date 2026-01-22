/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Path Tree Component
 * =============================================================================
 *
 * "Windows Explorer style" hierarchical tree visualization για file paths.
 * Displays storage path structure using semantic DOM.
 *
 * @module components/shared/files/FilePathTree
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Features:
 * - Semantic HTML (<nav>, <ul>, <li>, <button>)
 * - Centralized design tokens (no inline styles)
 * - i18n labels για path segments
 * - Keyboard accessible (Space/Enter to toggle)
 * - Collapsible folders με visual tree lines
 *
 * @example
 * ```tsx
 * <FilePathTree
 *   files={fileRecords}
 *   onFileSelect={(file) => console.log(file)}
 * />
 * ```
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Copy, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFileDisplayName } from '@/hooks/useFileDisplayName'; // 🏢 ENTERPRISE: Runtime i18n translation
import type { FileRecord } from '@/types/file-record';
import {
  buildFilePathTree,
  toggleFolderExpansion,
  type TreeNode,
  type FolderNode,
  type FileNode,
} from './utils/file-path-tree';
import { formatFileSize } from '@/utils/file-validation'; // 🏢 ENTERPRISE: Centralized file size formatting
import { copyToClipboard } from '@/lib/share-utils'; // 🏢 ENTERPRISE: Centralized clipboard utility
import { useNotifications } from '@/providers/NotificationProvider'; // 🏢 ENTERPRISE: Centralized notification system
import { FileInspector } from './FileInspector'; // 🏢 ENTERPRISE: On-demand metadata inspector (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ #2)

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Centralized indentation classes for tree levels
 * Uses ONLY valid Tailwind classes (NOT arbitrary values) for guaranteed rendering
 * Maps depth → padding-left class
 */
const TREE_FOLDER_INDENTATION = [
  'pl-0',    // depth 0 - root level
  'pl-4',    // depth 1 - 1rem = 16px
  'pl-8',    // depth 2 - 2rem = 32px
  'pl-12',   // depth 3 - 3rem = 48px
  'pl-16',   // depth 4 - 4rem = 64px
  'pl-20',   // depth 5 - 5rem = 80px
  'pl-24',   // depth 6 - 6rem = 96px
] as const;

/**
 * 🏢 ENTERPRISE: File indentation (extra indent for visual hierarchy)
 * Files are indented more than folders for clear distinction
 */
const TREE_FILE_INDENTATION = [
  'pl-6',    // depth 0 + extra - 1.5rem = 24px
  'pl-10',   // depth 1 + extra - 2.5rem = 40px
  'pl-14',   // depth 2 + extra - 3.5rem = 56px
  'pl-16',   // depth 3 + extra - 4rem = 64px
  'pl-20',   // depth 4 + extra - 5rem = 80px
  'pl-24',   // depth 5 + extra - 6rem = 96px
  'pl-28',   // depth 6 + extra - 7rem = 112px
] as const;

/**
 * Get indentation class for folder node
 * @param depth - Tree depth level (0-based)
 * @returns Tailwind padding-left class
 */
function getFolderIndentClass(depth: number): string {
  return TREE_FOLDER_INDENTATION[Math.min(depth, TREE_FOLDER_INDENTATION.length - 1)];
}

/**
 * Get indentation class for file node (extra indent)
 * @param depth - Tree depth level (0-based)
 * @returns Tailwind padding-left class
 */
function getFileIndentClass(depth: number): string {
  return TREE_FILE_INDENTATION[Math.min(depth, TREE_FILE_INDENTATION.length - 1)];
}

// ============================================================================
// TYPES
// ============================================================================

export interface FilePathTreeProps {
  /** Array of FileRecords to display */
  files: FileRecord[];
  /** Callback when file is selected */
  onFileSelect?: (file: FileRecord) => void;
  /** Optional CSS class */
  className?: string;
  /**
   * 🏢 ENTERPRISE: Contextual root level for Business View
   * - 'full': Show full technical hierarchy (companies → entities → domains → categories → files)
   * - 'domains': Start from domains level (hide companies, entities)
   * - 'categories': Start from categories level (hide companies, entities, domains)
   * @default 'full'
   */
  contextLevel?: 'full' | 'domains' | 'categories';
  /**
   * 🏢 ENTERPRISE: Company name for user-friendly display
   * If not provided, will show companyId
   */
  companyName?: string;
  /**
   * 🏢 ENTERPRISE: View mode (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ - Business View)
   * - 'business': Default - Business view με user-friendly ομαδοποίηση (Ταυτοποίηση, Νομικά, κτλ.)
   * - 'technical': Admin/Debug - Full technical tree με IDs και segments
   * @default 'business'
   */
  viewMode?: 'business' | 'technical';
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Filter tree to contextual root level
 * Extracts a subtree starting from the specified segment level
 */
function filterTreeToContextLevel(
  root: TreeNode,
  contextLevel: 'full' | 'domains' | 'categories'
): TreeNode {
  if (contextLevel === 'full') {
    return root;
  }

  // Find the target segment to start from
  const targetSegment = contextLevel === 'domains' ? 'domains' : 'categories';

  // Recursively search for the first node with the target segment
  function findFirstNodeWithSegment(node: TreeNode): TreeNode | null {
    if (node.type === 'folder' && node.segment === targetSegment) {
      return node;
    }

    if (node.type === 'folder' || node.type === 'root') {
      for (const child of node.children) {
        const found = findFirstNodeWithSegment(child);
        if (found) return found;
      }
    }

    return null;
  }

  const contextRoot = findFirstNodeWithSegment(root);

  if (contextRoot) {
    // Create a new root with the contextual subtree
    return {
      id: 'contextual-root',
      type: 'root',
      label: 'Root',
      path: [],
      children: [contextRoot],
    } as TreeNode;
  }

  // Fallback: return original tree
  return root;
}

/**
 * 🏢 ENTERPRISE: File Path Tree Component
 *
 * Displays file storage paths as a hierarchical tree structure.
 * Uses semantic DOM and centralized design tokens.
 */
export function FilePathTree({
  files,
  onFileSelect,
  className,
  contextLevel = 'full',
  companyName,
  viewMode = 'business', // 🏢 ENTERPRISE: Default is Business View (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
}: FilePathTreeProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('files');
  const translateDisplayName = useFileDisplayName(); // 🏢 ENTERPRISE: Runtime i18n translation
  const { success, error } = useNotifications(); // 🏢 ENTERPRISE: Centralized toast notifications (ADR-031)

  // 🏢 ENTERPRISE: Inspector state (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ #2 - On-demand metadata)
  const [inspectedFile, setInspectedFile] = useState<FileRecord | null>(null);

  // Build tree structure from files
  const initialTree = useMemo(() => {
    const fullTree = buildFilePathTree(files);
    return filterTreeToContextLevel(fullTree, contextLevel);
  }, [files, contextLevel]);

  // Tree state (for expand/collapse)
  const [tree, setTree] = useState<TreeNode>(initialTree);

  // Update tree when files change
  React.useEffect(() => {
    const fullTree = buildFilePathTree(files);
    setTree(filterTreeToContextLevel(fullTree, contextLevel));
  }, [files, contextLevel]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  /**
   * Toggle folder expansion
   */
  const handleFolderToggle = useCallback((folderId: string) => {
    setTree((prevTree) => toggleFolderExpansion(prevTree, folderId));
  }, []);

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback(
    (fileRecord: FileRecord) => {
      if (onFileSelect) {
        onFileSelect(fileRecord);
      }
    },
    [onFileSelect]
  );

  /**
   * 🏢 ENTERPRISE: Handle copy storage path to clipboard (Technical View only)
   * ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ #2: Copy χωρίς inline display (on-demand)
   */
  const handleCopyPath = useCallback(
    async (fileRecord: FileRecord, event: React.MouseEvent) => {
      // Prevent file selection when clicking copy button
      event.stopPropagation();

      const storagePath = fileRecord.storagePath;
      if (!storagePath) {
        error(t('technical.pathUnavailable'));
        return;
      }

      try {
        const copied = await copyToClipboard(storagePath);
        if (copied) {
          success(t('technical.pathCopied'));
        } else {
          error(t('copy.copyError', { ns: 'common', defaultValue: 'Copy failed' }));
        }
      } catch (err) {
        console.error('[FilePathTree] Failed to copy path:', err);
        error(t('copy.copyError', { ns: 'common', defaultValue: 'Copy failed' }));
      }
    },
    [success, error, t]
  );

  /**
   * 🏢 ENTERPRISE: Handle open inspector (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ #2)
   * Opens on-demand metadata inspector for file details
   */
  const handleOpenInspector = useCallback(
    (fileRecord: FileRecord, event: React.MouseEvent) => {
      // Prevent file selection when clicking details button
      event.stopPropagation();
      setInspectedFile(fileRecord);
    },
    []
  );

  /**
   * 🏢 ENTERPRISE: Handle close inspector
   */
  const handleCloseInspector = useCallback(() => {
    setInspectedFile(null);
  }, []);

  // =========================================================================
  // RENDER HELPERS
  // =========================================================================

  /**
   * Get label for path segment using i18n
   * 🏢 ENTERPRISE: Show VALUES (not generic labels) for better UX
   * 🏢 ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ: Business View hides technical segments
   */
  const getSegmentLabel = useCallback(
    (segment: string, value?: string): string => {
      // 🏢 BUSINESS VIEW: Skip technical segments (they won't be rendered)
      if (viewMode === 'business') {
        // Only show business-relevant segments: domains and categories VALUES
        if (segment === 'domains' && value) {
          return t(`domains.${value}`, value);
        }
        if (segment === 'categories' && value) {
          return t(`categories.${value}`, value);
        }

        // Hide technical segments in business view
        if (segment === 'companies' || segment === 'entities' || segment === 'files') {
          return ''; // Will be filtered out
        }
      }

      // 🏢 TECHNICAL VIEW: Show all segments με full detail
      if (viewMode === 'technical') {
        // Company name (use prop if provided, otherwise companyId)
        if (segment === 'companies' && value) {
          return companyName || value;
        }

        // Entity type value (contact, building, unit, project)
        if (segment === 'entities' && value) {
          return t(`entityTypes.${value}`, value);
        }

        // Domain value (admin, construction, sales, etc.)
        if (segment === 'domains' && value) {
          return t(`domains.${value}`, value);
        }

        // Category value (documents, photos, contracts, etc.)
        if (segment === 'categories' && value) {
          return t(`categories.${value}`, value);
        }

        // Generic segment labels
        if (segment === 'companies' || segment === 'projects' || segment === 'entities' || segment === 'domains' || segment === 'categories' || segment === 'files') {
          return t(`pathSegments.${segment}`);
        }
      }

      // 🏢 FALLBACK: Return value or segment as-is
      return value || segment;
    },
    [t, companyName, viewMode]
  );

  /**
   * Render a folder node
   * 🏢 ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ: Business View filters out technical nodes
   */
  const renderFolderNode = useCallback(
    (node: FolderNode, depth: number): React.ReactNode => {
      const isExpanded = node.isExpanded || false;
      const hasChildren = node.children.length > 0;
      const label = getSegmentLabel(node.segment, node.value);

      // 🏢 BUSINESS VIEW: Skip rendering technical segments
      if (viewMode === 'business' && (node.segment === 'companies' || node.segment === 'entities' || node.segment === 'files')) {
        // Render children directly without showing this folder
        if (hasChildren) {
          return (
            <React.Fragment key={node.id}>
              {node.children.map((child) => {
                if (child.type === 'folder') {
                  return renderFolderNode(child, depth); // Same depth - flatten hierarchy
                }
                if (child.type === 'file') {
                  return renderFileNode(child, depth);
                }
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
          {/* Folder button */}
          <button
            type="button"
            onClick={() => handleFolderToggle(node.id)}
            className={cn(
              'flex items-center gap-2 w-full py-1 px-2 rounded transition-colors',
              'hover:bg-muted text-left',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              getFolderIndentClass(depth) // 🏢 ENTERPRISE: Centralized indentation (no inline styles)
            )}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? t('tree.collapse') : t('tree.expand')}
          >
            {/* Chevron */}
            {hasChildren && (
              <ChevronIcon className={cn(iconSizes.xs, 'flex-shrink-0 text-muted-foreground')} />
            )}
            {!hasChildren && <span className={cn(iconSizes.xs)} />}

            {/* Folder icon */}
            <Icon className={cn(iconSizes.sm, 'flex-shrink-0 text-muted-foreground')} aria-hidden="true" />

            {/* Label */}
            <span className="text-sm font-medium truncate">{label}</span>

            {/* File count badge */}
            {hasChildren && (
              <span className="ml-auto text-xs text-muted-foreground">
                ({node.children.length})
              </span>
            )}
          </button>

          {/* Children (recursive) */}
          {isExpanded && hasChildren && (
            <ul className="m-0 p-0" role="group">
              {node.children.map((child) => {
                if (child.type === 'folder') {
                  return renderFolderNode(child, depth + 1);
                }
                if (child.type === 'file') {
                  return renderFileNode(child, depth + 1);
                }
                return null;
              })}
            </ul>
          )}
        </li>
      );
    },
    [iconSizes, t, getSegmentLabel, handleFolderToggle, viewMode]
  );

  /**
   * Render a file node (leaf)
   * ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ #2: Clean list, on-demand inspector (NO inline paths)
   */
  const renderFileNode = useCallback(
    (node: FileNode, depth: number): React.ReactNode => {
      const showTechnicalActions = viewMode === 'technical';

      return (
        <li key={node.id} className="list-none">
          {/* 🏢 ENTERPRISE: Clean file row (1 row per file - NO inline paths) */}
          <div
            className={cn(
              'flex items-center gap-2 w-full py-1 px-2 rounded transition-colors group',
              'hover:bg-accent/50',
              getFileIndentClass(depth) // 🏢 ENTERPRISE: Centralized indentation (no inline styles)
            )}
          >
            {/* File icon */}
            <FileText className={cn(iconSizes.sm, 'flex-shrink-0 text-primary')} aria-hidden="true" />

            {/* File name (clickable) - 🏢 ENTERPRISE: Runtime i18n translation */}
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

            {/* File size */}
            {node.fileRecord.sizeBytes && (
              <span className="text-xs text-muted-foreground">
                {formatFileSize(node.fileRecord.sizeBytes)}
              </span>
            )}

            {/* 🏢 TECHNICAL VIEW: On-demand actions (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ #2) */}
            {showTechnicalActions && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Copy Path button (NO inline display) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => handleCopyPath(node.fileRecord, e)}
                      className={cn(
                        'p-1.5 rounded transition-colors',
                        'hover:bg-muted text-muted-foreground hover:text-foreground',
                        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1'
                      )}
                      aria-label={t('technical.copyPath')}
                    >
                      <Copy className={iconSizes.xs} aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('technical.copyPath')}</TooltipContent>
                </Tooltip>

                {/* Details button (opens Inspector) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => handleOpenInspector(node.fileRecord, e)}
                      className={cn(
                        'p-1.5 rounded transition-colors',
                        'hover:bg-muted text-muted-foreground hover:text-foreground',
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
    [iconSizes, t, handleFileSelect, handleCopyPath, handleOpenInspector, viewMode, translateDisplayName] // 🏢 CRITICAL: Must include translateDisplayName!
  );

  // =========================================================================
  // RENDER
  // =========================================================================

  if (files.length === 0) {
    return (
      <section className={cn('p-4 text-center text-muted-foreground', className)}>
        <p className="text-sm">{t('list.noFiles')}</p>
      </section>
    );
  }

  return (
    <>
      <nav
        className={cn('rounded-lg border bg-card', className)}
        aria-label={t('tree.title')}
      >
        <header className="px-4 py-2 border-b bg-muted/50">
          <h3 className="text-sm font-semibold">{t('tree.title')}</h3>
        </header>

        {/* Tree container */}
        {/* 🏢 ENTERPRISE: Using standard Tailwind class instead of arbitrary value */}
        <div className="p-2 max-h-96 overflow-y-auto">
          <ul className="m-0 p-0" role="tree">
            {tree.type === 'root' &&
              tree.children.map((child) => {
                if (child.type === 'folder') {
                  return renderFolderNode(child, 0);
                }
                if (child.type === 'file') {
                  return renderFileNode(child, 0);
                }
                return null;
              })}
          </ul>
        </div>
      </nav>

      {/* 🏢 ENTERPRISE: On-demand File Inspector (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ #2) */}
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

// ============================================================================
// UTILITIES
// ============================================================================
// 🏢 ENTERPRISE: formatFileSize is now imported from centralized utility
// @see src/utils/file-validation.ts
