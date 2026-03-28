/**
 * FolderTreeItem — Single node in the virtual folder tree
 * Extracted from FolderManager for file-size compliance.
 *
 * @module components/shared/files/folder-tree-item
 * @enterprise ADR-191 Phase 4.4
 */

'use client';

import React, { useState } from 'react';
import {
  Folder,
  FolderPlus,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { getStatusColor } from '@/lib/design-system';
import type { FileFolder } from '@/services/file-folder.service';

// ============================================================================
// TYPES
// ============================================================================

export interface FolderTreeNode {
  folder: FileFolder;
  children: FolderTreeNode[];
}

// ============================================================================
// HELPERS
// ============================================================================

/** Build a tree structure from flat folder list */
export function buildFolderTree(folders: FileFolder[]): FolderTreeNode[] {
  const map = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  for (const folder of folders) {
    map.set(folder.id, { folder, children: [] });
  }
  for (const folder of folders) {
    const node = map.get(folder.id)!;
    if (folder.parentId && map.has(folder.parentId)) {
      map.get(folder.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** Folder color palette */
export const FOLDER_COLORS = [
  { value: null, label: 'Default', className: COLOR_BRIDGE.text.muted },
  { value: 'blue', label: 'Blue', className: getStatusColor('pending', 'text') },
  { value: 'green', label: 'Green', className: getStatusColor('available', 'text') },
  { value: 'orange', label: 'Orange', className: getStatusColor('construction', 'text') },
  { value: 'red', label: 'Red', className: getStatusColor('error', 'text') },
  { value: 'purple', label: 'Purple', className: getStatusColor('completed', 'text') },
  { value: 'yellow', label: 'Yellow', className: getStatusColor('reserved', 'text') },
];

export function getFolderColorClass(color: string | null): string {
  return FOLDER_COLORS.find((c) => c.value === color)?.className ?? COLOR_BRIDGE.text.muted;
}

// ============================================================================
// COMPONENT
// ============================================================================

export interface FolderTreeItemProps {
  node: FolderTreeNode;
  depth: number;
  selectedFolderId: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onDragOver: (e: React.DragEvent, folderId: string) => void;
  onDrop: (e: React.DragEvent, folderId: string) => void;
  dragOverId: string | null;
  t: (key: string) => string;
}

export function FolderTreeItem({
  node,
  depth,
  selectedFolderId,
  expandedIds,
  onToggleExpand,
  onSelect,
  onRename,
  onDelete,
  onCreateChild,
  onDragOver,
  onDrop,
  dragOverId,
  t,
}: FolderTreeItemProps) {
  const _colors = useSemanticColors();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(node.folder.name);
  const isExpanded = expandedIds.has(node.folder.id);
  const isSelected = selectedFolderId === node.folder.id;
  const isDragOver = dragOverId === node.folder.id;
  const hasChildren = node.children.length > 0;
  const colorClass = getFolderColorClass(node.folder.color);

  const handleRename = () => {
    if (editName.trim() && editName.trim() !== node.folder.name) {
      onRename(node.folder.id, editName.trim());
    }
    setEditing(false);
  };

  return (
    <li>
      <section
        className={cn(
          'group flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors',
          isSelected && 'bg-accent text-accent-foreground',
          !isSelected && 'hover:bg-accent/50', // eslint-disable-line custom/no-hardcoded-strings
          isDragOver && 'ring-2 ring-primary bg-primary/10'
        )}
        onDragOver={(e) => onDragOver(e, node.folder.id)}
        onDrop={(e) => onDrop(e, node.folder.id)}
        onClick={() => onSelect(node.folder.id)}
      >
        <span className="flex-shrink-0" aria-hidden="true">
          {'  '.repeat(depth)}
        </span>

        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleExpand(node.folder.id); }}
            className="flex-shrink-0 p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-[18px] flex-shrink-0" />
        )}

        {isExpanded && hasChildren ? (
          <FolderOpen className={cn('h-4 w-4 flex-shrink-0', colorClass)} />
        ) : (
          <Folder className={cn('h-4 w-4 flex-shrink-0', colorClass)} />
        )}

        {editing ? (
          <form
            className="flex items-center gap-1 flex-1"
            onSubmit={(e) => { e.preventDefault(); handleRename(); }}
          >
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
              className="flex-1 text-sm border rounded px-1 py-0.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <Button type="submit" variant="ghost" size="sm" className={`h-5 w-5 p-0 ${getStatusColor('available', 'text')}`}>
              <Check className="h-3 w-3" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} className={`h-5 w-5 p-0 ${getStatusColor('error', 'text')}`}>
              <X className="h-3 w-3" />
            </Button>
          </form>
        ) : (
          <span className="text-sm truncate flex-1">{node.folder.name}</span>
        )}

        {!editing && (
          <nav className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onCreateChild(node.folder.id); }} className="h-5 w-5 p-0" title={t('folders.addSubfolder')}>
              <FolderPlus className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditName(node.folder.name); setEditing(true); }} className="h-5 w-5 p-0" title={t('folders.rename')}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(node.folder.id); }} className="h-5 w-5 p-0 text-destructive" title={t('folders.delete')}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </nav>
        )}
      </section>

      {isExpanded && hasChildren && (
        <ul className="list-none">
          {node.children.map((child) => (
            <FolderTreeItem
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onCreateChild={onCreateChild}
              onDragOver={onDragOver}
              onDrop={onDrop}
              dragOverId={dragOverId}
              t={t}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
