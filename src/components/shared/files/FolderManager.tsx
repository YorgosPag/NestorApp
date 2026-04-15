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

import { safeJsonParse } from '@/lib/json-utils';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Folder,
  FolderPlus,
  FolderInput,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FileFolderService, type FileFolder } from '@/services/file-folder.service';
import { createStaleCache } from '@/lib/stale-cache';
import {
  createFileFolderWithPolicy,
  deleteFileFolderWithPolicy,
  renameFileFolderWithPolicy,
} from '@/services/filesystem/file-mutation-gateway';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { getStatusColor } from '@/lib/design-system';

const fileFoldersCache = createStaleCache<FileFolder[]>('file-folders');

// 🏢 ENTERPRISE: Extracted sub-component + helpers
import { FolderTreeItem, buildFolderTree } from './folder-tree-item';

// Re-exports for backward compatibility
export { FolderTreeItem, buildFolderTree, getFolderColorClass, FOLDER_COLORS } from './folder-tree-item';
export type { FolderTreeNode, FolderTreeItemProps } from './folder-tree-item';

// ============================================================================
// TYPES
// ============================================================================

export interface FolderManagerProps {
  companyId: string;
  currentUserId: string;
  selectedFolderId?: string | null;
  onFolderSelect?: (folderId: string | null) => void;
  onFilesDropped?: (folderId: string | null, fileIds: string[]) => void;
  className?: string;
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
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const [folders, setFolders] = useState<FileFolder[]>(fileFoldersCache.get(companyId) ?? []);
  const [loading, setLoading] = useState(!fileFoldersCache.hasLoaded(companyId));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(externalSelectedId ?? null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  const fetchFolders = useCallback(async () => {
    if (!companyId) return;
    if (!fileFoldersCache.hasLoaded(companyId)) setLoading(true);
    try {
      const data = await FileFolderService.getFolders(companyId);
      fileFoldersCache.set(data, companyId);
      setFolders(data);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  const tree = useMemo(() => buildFolderTree(folders), [folders]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback((id: string) => {
    const newId = selectedFolderId === id ? null : id;
    setSelectedFolderId(newId);
    onFolderSelect?.(newId);
  }, [selectedFolderId, onFolderSelect]);

  const handleRename = useCallback(async (id: string, name: string) => {
    await renameFileFolderWithPolicy(id, name);
    fetchFolders();
  }, [fetchFolders]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteFileFolderWithPolicy(id);
    if (selectedFolderId === id) { setSelectedFolderId(null); onFolderSelect?.(null); }
    fetchFolders();
  }, [fetchFolders, selectedFolderId, onFolderSelect]);

  const handleCreateChild = useCallback((parentId: string) => {
    setCreateParentId(parentId); setNewFolderName(''); setCreating(true);
    setExpandedIds((prev) => new Set(prev).add(parentId));
  }, []);

  const handleCreateRoot = useCallback(() => {
    setCreateParentId(null); setNewFolderName(''); setCreating(true);
  }, []);

  const handleCreateSubmit = useCallback(async () => {
    if (!newFolderName.trim()) return;
    await createFileFolderWithPolicy({
      companyId,
      parentId: createParentId ?? undefined,
      name: newFolderName.trim(),
      createdBy: currentUserId,
    });
    setCreating(false); setNewFolderName('');
    fetchFolders();
  }, [newFolderName, companyId, createParentId, currentUserId, fetchFolders]);

  const handleDragOver = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId(folderId);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault(); setDragOverId(null);
    const data = e.dataTransfer.getData('application/x-file-ids');
    if (data) {
      const fileIds = safeJsonParse<string[]>(data, []);
      if (fileIds.length > 0) onFilesDropped?.(folderId, fileIds);
    }
  }, [onFilesDropped]);

  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId('__root__');
  }, []);

  const handleRootDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOverId(null);
    const data = e.dataTransfer.getData('application/x-file-ids');
    if (data) {
      const fileIds = safeJsonParse<string[]>(data, []);
      if (fileIds.length > 0) onFilesDropped?.(null, fileIds);
    }
  }, [onFilesDropped]);

  return (
    <aside className={cn('flex flex-col border-r bg-muted/5', className)} role="navigation" aria-label={t('folders.title')}>
      <header className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <FolderInput className={cn("h-4 w-4", colors.text.muted)} />
          {t('folders.title')}
        </h3>
        <Button variant="ghost" size="sm" onClick={handleCreateRoot} className="h-6 px-1.5" title={t('folders.create')}>
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
      </header>

      <section
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors',
          !selectedFolderId && 'bg-accent text-accent-foreground',
          selectedFolderId && 'hover:bg-accent/50',
          dragOverId === '__root__' && 'ring-2 ring-primary bg-primary/10'
        )}
        onClick={() => { setSelectedFolderId(null); onFolderSelect?.(null); }}
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
      >
        <Folder className={cn("h-4 w-4", colors.text.muted)} />
        <span className="text-sm font-medium">{t('folders.allFiles')}</span>
      </section>

      <nav className="flex-1 overflow-y-auto px-1 py-1">
        {loading ? (
          <p className={cn("text-xs text-center py-4", colors.text.muted)}>
            <Spinner size="small" className="inline mr-1" />
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
                t={(key) => t(key)}
              />
            ))}
          </ul>
        )}

        {creating && (
          <form
            className="flex items-center gap-1 px-2 py-1 mt-1"
            onSubmit={(e) => { e.preventDefault(); handleCreateSubmit(); }}
          >
            <FolderPlus className={cn("h-4 w-4 flex-shrink-0", colors.text.muted)} />
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setCreating(false); }}
              placeholder={t('folders.namePlaceholder')}
              className="flex-1 text-sm border rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <Button type="submit" variant="ghost" size="sm" disabled={!newFolderName.trim()} className={`h-5 w-5 p-0 ${getStatusColor('available', 'text')}`}>
              <Check className="h-3 w-3" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)} className={`h-5 w-5 p-0 ${getStatusColor('error', 'text')}`}>
              <X className="h-3 w-3" />
            </Button>
          </form>
        )}
      </nav>
    </aside>
  );
}
