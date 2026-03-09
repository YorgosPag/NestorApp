/**
 * =============================================================================
 * Folder Manager — Virtual folder tree with drag-and-drop
 * =============================================================================
 *
 * Displays a tree of virtual folders. Files can be dragged into folders.
 * Supports create, rename, delete, and reorder operations.
 *
 * @module components/shared/files/FolderManager
 * @enterprise ADR-191 Phase 4.4 — Drag & Drop Folder Structure
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  GripVertical,
  Loader2,
  FolderInput,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  FileFolderService,
  type FileFolder,
} from '@/services/file-folder.service';

// ============================================================================
// TYPES
// ============================================================================

export interface FolderManagerProps {
  /** Company ID for tenant isolation */
  companyId: string;
  /** Current user ID */
  currentUserId: string;
  /** Currently selected folder ID */
  selectedFolderId?: string | null;
  /** Callback when a folder is selected */
  onFolderSelect?: (folderId: string | null) => void;
  /** Callback when files are dropped on a folder */
  onFilesDropped?: (folderId: string | null, fileIds: string[]) => void;
  /** Optional className */
  className?: string;
}

interface FolderTreeNode {
  folder: FileFolder;
  children: FolderTreeNode[];
}

// ============================================================================
// HELPERS
// ============================================================================

/** Build a tree structure from flat folder list */
function buildFolderTree(folders: FileFolder[]): FolderTreeNode[] {
  const map = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  // Create nodes
  for (const folder of folders) {
    map.set(folder.id, { folder, children: [] });
  }

  // Build tree
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

// Folder color palette
const FOLDER_COLORS = [
  { value: null, label: 'Default', className: 'text-muted-foreground' },
  { value: 'blue', label: 'Blue', className: 'text-blue-500' },
  { value: 'green', label: 'Green', className: 'text-green-500' },
  { value: 'orange', label: 'Orange', className: 'text-orange-500' },
  { value: 'red', label: 'Red', className: 'text-red-500' },
  { value: 'purple', label: 'Purple', className: 'text-purple-500' },
  { value: 'yellow', label: 'Yellow', className: 'text-yellow-500' },
];

function getFolderColorClass(color: string | null): string {
  return FOLDER_COLORS.find((c) => c.value === color)?.className ?? 'text-muted-foreground';
}

// ============================================================================
// FOLDER TREE ITEM
// ============================================================================

interface FolderTreeItemProps {
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
  t: (key: string, fallback?: string) => string;
}

function FolderTreeItem({
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
          !isSelected && 'hover:bg-accent/50',
          isDragOver && 'ring-2 ring-primary bg-primary/10'
        )}
        onDragOver={(e) => onDragOver(e, node.folder.id)}
        onDrop={(e) => onDrop(e, node.folder.id)}
        onClick={() => onSelect(node.folder.id)}
      >
        {/* Indent + expand toggle */}
        <span className="flex-shrink-0" aria-hidden="true">
          {'  '.repeat(depth)}
        </span>

        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.folder.id);
            }}
            className="flex-shrink-0 p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-[18px] flex-shrink-0" />
        )}

        {/* Folder icon */}
        {isExpanded && hasChildren ? (
          <FolderOpen className={cn('h-4 w-4 flex-shrink-0', colorClass)} />
        ) : (
          <Folder className={cn('h-4 w-4 flex-shrink-0', colorClass)} />
        )}

        {/* Name (editable or display) */}
        {editing ? (
          <form
            className="flex items-center gap-1 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              handleRename();
            }}
          >
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditing(false);
              }}
              className="flex-1 text-sm border rounded px-1 py-0.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-green-600"
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              className="h-5 w-5 p-0 text-red-500"
            >
              <X className="h-3 w-3" />
            </Button>
          </form>
        ) : (
          <span className="text-sm truncate flex-1">{node.folder.name}</span>
        )}

        {/* Actions (visible on hover) */}
        {!editing && (
          <nav className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onCreateChild(node.folder.id);
              }}
              className="h-5 w-5 p-0"
              title={t('folders.addSubfolder', 'Υποφάκελος')}
            >
              <FolderPlus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setEditName(node.folder.name);
                setEditing(true);
              }}
              className="h-5 w-5 p-0"
              title={t('folders.rename', 'Μετονομασία')}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.folder.id);
              }}
              className="h-5 w-5 p-0 text-destructive"
              title={t('folders.delete', 'Διαγραφή')}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </nav>
        )}
      </section>

      {/* Children */}
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FolderManager({
  companyId,
  currentUserId,
  selectedFolderId: externalSelectedId,
  onFolderSelect,
  onFilesDropped,
  className,
}: FolderManagerProps) {
  const { t } = useTranslation('files');
  const [folders, setFolders] = useState<FileFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    externalSelectedId ?? null
  );
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  // Fetch folders
  const fetchFolders = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await FileFolderService.getFolders(companyId);
      setFolders(data);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // Build tree
  const tree = useMemo(() => buildFolderTree(folders), [folders]);

  // Handlers
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      const newId = selectedFolderId === id ? null : id;
      setSelectedFolderId(newId);
      onFolderSelect?.(newId);
    },
    [selectedFolderId, onFolderSelect]
  );

  const handleRename = useCallback(
    async (id: string, name: string) => {
      await FileFolderService.renameFolder(id, name);
      fetchFolders();
    },
    [fetchFolders]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await FileFolderService.deleteFolder(id);
      if (selectedFolderId === id) {
        setSelectedFolderId(null);
        onFolderSelect?.(null);
      }
      fetchFolders();
    },
    [fetchFolders, selectedFolderId, onFolderSelect]
  );

  const handleCreateChild = useCallback((parentId: string) => {
    setCreateParentId(parentId);
    setNewFolderName('');
    setCreating(true);
    // Auto-expand parent
    setExpandedIds((prev) => new Set(prev).add(parentId));
  }, []);

  const handleCreateRoot = useCallback(() => {
    setCreateParentId(null);
    setNewFolderName('');
    setCreating(true);
  }, []);

  const handleCreateSubmit = useCallback(async () => {
    if (!newFolderName.trim()) return;

    await FileFolderService.createFolder({
      companyId,
      parentId: createParentId ?? undefined,
      name: newFolderName.trim(),
      createdBy: currentUserId,
    });

    setCreating(false);
    setNewFolderName('');
    fetchFolders();
  }, [newFolderName, companyId, createParentId, currentUserId, fetchFolders]);

  // Drag-and-drop handlers
  const handleDragOver = useCallback(
    (e: React.DragEvent, folderId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverId(folderId);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, folderId: string) => {
      e.preventDefault();
      setDragOverId(null);

      const data = e.dataTransfer.getData('application/x-file-ids');
      if (data) {
        const fileIds = JSON.parse(data) as string[];
        onFilesDropped?.(folderId, fileIds);
      }
    },
    [onFilesDropped]
  );

  // "All files" drop zone (unassign from folder)
  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId('__root__');
  }, []);

  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverId(null);

      const data = e.dataTransfer.getData('application/x-file-ids');
      if (data) {
        const fileIds = JSON.parse(data) as string[];
        onFilesDropped?.(null, fileIds);
      }
    },
    [onFilesDropped]
  );

  return (
    <aside
      className={cn('flex flex-col border-r bg-muted/5', className)}
      role="navigation"
      aria-label={t('folders.title', 'Φάκελοι')}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <FolderInput className="h-4 w-4 text-muted-foreground" />
          {t('folders.title', 'Φάκελοι')}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCreateRoot}
          className="h-6 px-1.5"
          title={t('folders.create', 'Νέος φάκελος')}
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
      </header>

      {/* "All files" root entry */}
      <section
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors',
          !selectedFolderId && 'bg-accent text-accent-foreground',
          selectedFolderId && 'hover:bg-accent/50',
          dragOverId === '__root__' && 'ring-2 ring-primary bg-primary/10'
        )}
        onClick={() => {
          setSelectedFolderId(null);
          onFolderSelect?.(null);
        }}
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
      >
        <Folder className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {t('folders.allFiles', 'Όλα τα αρχεία')}
        </span>
      </section>

      {/* Folder tree */}
      <nav className="flex-1 overflow-y-auto px-1 py-1">
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
          </p>
        ) : (
          <ul className="list-none space-y-0.5">
            {tree.map((node) => (
              <FolderTreeItem
                key={node.folder.id}
                node={node}
                depth={0}
                selectedFolderId={selectedFolderId}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
                onSelect={handleSelect}
                onRename={handleRename}
                onDelete={handleDelete}
                onCreateChild={handleCreateChild}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                dragOverId={dragOverId}
                t={t}
              />
            ))}
          </ul>
        )}

        {/* Inline create form */}
        {creating && (
          <form
            className="flex items-center gap-1 px-2 py-1 mt-1"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateSubmit();
            }}
          >
            <FolderPlus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setCreating(false);
              }}
              placeholder={t('folders.namePlaceholder', 'Όνομα φακέλου')}
              className="flex-1 text-sm border rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              disabled={!newFolderName.trim()}
              className="h-5 w-5 p-0 text-green-600"
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCreating(false)}
              className="h-5 w-5 p-0 text-red-500"
            >
              <X className="h-3 w-3" />
            </Button>
          </form>
        )}
      </nav>
    </aside>
  );
}
