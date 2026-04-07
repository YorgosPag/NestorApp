/* eslint-disable custom/no-hardcoded-strings */
/**
 * =============================================================================
 * 🏢 ENTERPRISE: CompanyFileTree Component
 * =============================================================================
 *
 * Tree view component for displaying all company files
 * with grouping by Entity or Category.
 *
 * @module components/file-manager/CompanyFileTree
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFileDisplayName } from '@/hooks/useFileDisplayName';
import type { FileRecord } from '@/types/file-record';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { getStatusColor } from '@/lib/design-system';

import type { TreeNodeData, CompanyFileTreeProps, ViewMode } from './company-file-tree-builders';
import { buildTreeByEntity, buildTreeByCategory } from './company-file-tree-builders';

// Re-export types for consumers
export type { GroupingMode, ViewMode } from './company-file-tree-builders';

// ============================================================================
// TREE NODE COMPONENT
// ============================================================================

interface TreeNodeProps {
  node: TreeNodeData;
  depth: number;
  expandedNodes: Set<string>;
  toggleNode: (nodeId: string) => void;
  onFileClick?: (file: FileRecord) => void;
  onFileDoubleClick?: (file: FileRecord) => void;
  onRename?: (fileId: string, newDisplayName: string) => void;
  viewMode: ViewMode;
}

function TreeNode({
  node, depth, expandedNodes, toggleNode,
  onFileClick, onFileDoubleClick, onRename, viewMode,
}: TreeNodeProps) {
  const colors = useSemanticColors();
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const paddingLeft = depth * 16 + 8;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const handleClick = useCallback(() => {
    if (isEditing) return;
    if (node.type === 'file' && node.file && onFileClick) {
      onFileClick(node.file);
    } else if (hasChildren) {
      toggleNode(node.id);
    }
  }, [node, hasChildren, toggleNode, onFileClick, isEditing]);

  const handleDoubleClick = useCallback(() => {
    if (node.type === 'file' && node.file && onRename) {
      setEditName(node.file.displayName);
      setIsEditing(true);
    } else if (node.type === 'file' && node.file && onFileDoubleClick) {
      onFileDoubleClick(node.file);
    }
  }, [node, onFileDoubleClick, onRename]);

  const handleRenameConfirm = useCallback(() => {
    if (!node.file || !onRename || !editName.trim()) return;
    onRename(node.file.id, editName.trim());
    setIsEditing(false);
  }, [node.file, onRename, editName]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameConfirm();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  }, [handleRenameConfirm]);

  return (
    <li role="treeitem" aria-expanded={node.type !== 'file' ? isExpanded : undefined}>
      <button
        type="button"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        className={cn(
          'w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-sm',
          'hover:bg-muted/50 transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          'cursor-pointer'
        )}
        style={{ paddingLeft }}
      >
        {hasChildren ? (
          <span className={cn("flex-shrink-0", colors.text.muted)}>
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        <span className="flex-shrink-0">
          {node.type === 'folder' ? (
            isExpanded ? <FolderOpen className={`h-4 w-4 ${getStatusColor('reserved', 'text')}`} /> : <Folder className={`h-4 w-4 ${getStatusColor('reserved', 'text')}`} />
          ) : (
            node.icon
          )}
        </span>

        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameConfirm}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-sm border rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        ) : (
          <span className="truncate flex-1 text-left">{node.label}</span>
        )}

        {viewMode === 'technical' && node.type === 'file' && node.file && !isEditing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn("text-xs truncate max-w-[200px]", colors.text.muted)}>
                {node.file.storagePath}
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-md">
              <p className="font-mono text-xs break-all">{node.file.storagePath}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {node.type === 'folder' && hasChildren && (
          <span className={cn("text-xs bg-muted px-1.5 py-0.5 rounded", colors.text.muted)}>
            {node.children?.length}
          </span>
        )}
      </button>

      {hasChildren && isExpanded && (
        <ul role="group" className="ml-0">
          {node.children!.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              onFileClick={onFileClick}
              onFileDoubleClick={onFileDoubleClick}
              onRename={onRename}
              viewMode={viewMode}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CompanyFileTree({
  files,
  companyName = 'Company',
  groupingMode = 'entity',
  viewMode = 'business',
  onFileClick,
  onFileDoubleClick,
  onRename,
  className,
}: CompanyFileTreeProps) {
  const { t, i18n } = useTranslation('files');
  const colors = useSemanticColors();
  const translateDisplayName = useFileDisplayName();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const lang = i18n.language;

  const treeData = useMemo(() => {
    if (groupingMode === 'entity') {
      return buildTreeByEntity(files, companyName, translateDisplayName, lang, t);
    }
    return buildTreeByCategory(files, companyName, translateDisplayName, lang, t);
  }, [files, companyName, groupingMode, translateDisplayName, lang, t]);

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) { next.delete(nodeId); } else { next.add(nodeId); }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allNodeIds = new Set<string>();
    function collectIds(node: TreeNodeData) {
      allNodeIds.add(node.id);
      node.children?.forEach(collectIds);
    }
    collectIds(treeData);
    setExpandedNodes(allNodeIds);
  }, [treeData]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set(['root']));
  }, []);

  if (files.length === 0) {
    return (
      <section className={cn('p-8 text-center', colors.text.muted, className)}>
        <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{t('tree.empty', 'No files found')}</p>
      </section>
    );
  }

  return (
    <section className={cn('flex flex-col', className)}>
      <header className="flex items-center justify-between px-4 py-2 border-b">
        <span className={cn("text-sm", colors.text.muted)}>
          {t('tree.fileCount', '{{count}} files', { count: files.length })}
        </span>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={expandAll} className="h-7 px-2">
            {t('tree.expandAll', 'Expand All')}
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll} className="h-7 px-2">
            {t('tree.collapseAll', 'Collapse All')}
          </Button>
        </nav>
      </header>

      <nav className="flex-1 overflow-auto p-2" role="tree" aria-label={t('tree.ariaLabel', 'File tree')}>
        <ul role="group" className="space-y-0.5">
          <TreeNode
            node={treeData}
            depth={0}
            expandedNodes={expandedNodes}
            toggleNode={toggleNode}
            onFileClick={onFileClick}
            onFileDoubleClick={onFileDoubleClick}
            onRename={onRename}
            viewMode={viewMode}
          />
        </ul>
      </nav>
    </section>
  );
}
