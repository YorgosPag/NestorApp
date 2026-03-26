/**
 * =============================================================================
 * useFileListActions — Inline edit state & handlers for FilesList
 * =============================================================================
 *
 * Manages all interactive state for file list items:
 * - Inline rename (start/cancel/confirm/keydown)
 * - Inline description editing (start/save/keydown)
 * - Delete confirmation modal state
 * - Unlink confirmation modal state
 * - Simple click handlers (link, view, download)
 *
 * Extracted from FilesList for Google SRP compliance.
 *
 * @module components/shared/files/hooks/useFileListActions
 */

import { useCallback, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import type { FileRecord } from '@/types/file-record';

// ============================================================================
// TYPES
// ============================================================================

interface UseFileListActionsParams {
  onDelete?: (fileId: string) => Promise<void>;
  onView?: (file: FileRecord) => void;
  onDownload?: (file: FileRecord) => void;
  onRename?: (fileId: string, newDisplayName: string) => void;
  onDescriptionUpdate?: (fileId: string, description: string) => void;
  onLink?: (file: FileRecord) => void;
  onUnlink?: (fileId: string) => Promise<void>;
  currentUserId?: string;
}

export interface UseFileListActionsReturn {
  // Rename
  editingFileId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  renameLoading: boolean;
  handleRenameStart: (file: FileRecord) => void;
  handleRenameCancel: () => void;
  handleRenameConfirm: () => Promise<void>;
  handleRenameKeyDown: (e: React.KeyboardEvent) => void;
  // Description
  editingDescFileId: string | null;
  editingDesc: string;
  setEditingDesc: (desc: string) => void;
  handleDescriptionStart: (file: FileRecord) => void;
  handleDescriptionSave: () => void;
  handleDescriptionKeyDown: (e: React.KeyboardEvent) => void;
  // Delete
  deleteConfirmOpen: boolean;
  setDeleteConfirmOpen: (open: boolean) => void;
  deleteLoading: boolean;
  handleDeleteClick: (fileId: string, event: React.MouseEvent) => void;
  handleDeleteConfirm: () => Promise<void>;
  // Unlink
  unlinkConfirmOpen: boolean;
  setUnlinkConfirmOpen: (open: boolean) => void;
  unlinkLoading: boolean;
  handleUnlinkClick: (fileId: string, event: React.MouseEvent) => void;
  handleUnlinkConfirm: () => Promise<void>;
  // Simple handlers
  handleLinkClick: (file: FileRecord, event: React.MouseEvent) => void;
  handleView: (file: FileRecord, event: React.MouseEvent) => void;
  handleDownload: (file: FileRecord, event: React.MouseEvent) => void;
}

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('FileListActions');

// ============================================================================
// HOOK
// ============================================================================

export function useFileListActions({
  onDelete,
  onView,
  onDownload,
  onRename,
  onDescriptionUpdate,
  onLink,
  onUnlink,
  currentUserId,
}: UseFileListActionsParams): UseFileListActionsReturn {
  const { t } = useTranslation('files');
  const { success, error } = useNotifications();

  // =========================================================================
  // RENAME STATE
  // =========================================================================
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  // =========================================================================
  // DESCRIPTION EDIT STATE
  // =========================================================================
  const [editingDescFileId, setEditingDescFileId] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState('');

  // =========================================================================
  // DELETE CONFIRMATION STATE
  // =========================================================================
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // =========================================================================
  // UNLINK CONFIRMATION STATE
  // =========================================================================
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const [fileToUnlink, setFileToUnlink] = useState<string | null>(null);
  const [unlinkLoading, setUnlinkLoading] = useState(false);

  // =========================================================================
  // RENAME HANDLERS
  // =========================================================================

  const handleRenameStart = useCallback((file: FileRecord) => {
    setEditingFileId(file.id);
    setEditingName(file.displayName);
  }, []);

  const handleRenameCancel = useCallback(() => {
    setEditingFileId(null);
    setEditingName('');
  }, []);

  const handleRenameConfirm = useCallback(async () => {
    if (!editingFileId || !onRename || !editingName.trim()) return;

    setRenameLoading(true);
    try {
      onRename(editingFileId, editingName.trim());
      success(t('list.renameSuccess'));
      setEditingFileId(null);
      setEditingName('');
    } catch (err) {
      error(t('list.renameError'));
      logger.error('Rename failed', { error: err });
    } finally {
      setRenameLoading(false);
    }
  }, [editingFileId, editingName, onRename, t, success, error]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameConfirm();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  }, [handleRenameConfirm, handleRenameCancel]);

  // =========================================================================
  // DESCRIPTION HANDLERS
  // =========================================================================

  const handleDescriptionStart = useCallback((file: FileRecord) => {
    setEditingDescFileId(file.id);
    setEditingDesc(file.description || '');
  }, []);

  const handleDescriptionSave = useCallback(() => {
    if (!editingDescFileId || !onDescriptionUpdate) return;
    onDescriptionUpdate(editingDescFileId, editingDesc);
    setEditingDescFileId(null);
    setEditingDesc('');
  }, [editingDescFileId, editingDesc, onDescriptionUpdate]);

  const handleDescriptionKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditingDescFileId(null);
    }
  }, []);

  // =========================================================================
  // DELETE HANDLERS
  // =========================================================================

  const handleDeleteClick = useCallback((fileId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!onDelete || !currentUserId) return;
    setFileToDelete(fileId);
    setDeleteConfirmOpen(true);
  }, [onDelete, currentUserId]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!fileToDelete || !onDelete) return;

    setDeleteLoading(true);
    try {
      await onDelete(fileToDelete);
      success(t('list.deleteSuccess'));
      setDeleteConfirmOpen(false);
      setFileToDelete(null);
    } catch (err) {
      error(t('list.deleteError'));
      logger.error('Delete failed', { error: err });
    } finally {
      setDeleteLoading(false);
    }
  }, [fileToDelete, onDelete, t, success, error]);

  // =========================================================================
  // UNLINK HANDLERS
  // =========================================================================

  const handleUnlinkClick = useCallback((fileId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!onUnlink) return;
    setFileToUnlink(fileId);
    setUnlinkConfirmOpen(true);
  }, [onUnlink]);

  const handleUnlinkConfirm = useCallback(async () => {
    if (!fileToUnlink || !onUnlink) return;

    setUnlinkLoading(true);
    try {
      await onUnlink(fileToUnlink);
      success(t('list.unlinkSuccess'));
      setUnlinkConfirmOpen(false);
      setFileToUnlink(null);
    } catch (err) {
      error(t('list.unlinkError'));
      logger.error('Unlink failed', { error: err });
    } finally {
      setUnlinkLoading(false);
    }
  }, [fileToUnlink, onUnlink, t, success, error]);

  // =========================================================================
  // SIMPLE CLICK HANDLERS
  // =========================================================================

  const handleLinkClick = useCallback((file: FileRecord, event: React.MouseEvent) => {
    event.stopPropagation();
    onLink?.(file);
  }, [onLink]);

  const handleView = useCallback((file: FileRecord, event: React.MouseEvent) => {
    event.stopPropagation();
    onView?.(file);
  }, [onView]);

  const handleDownload = useCallback((file: FileRecord, event: React.MouseEvent) => {
    event.stopPropagation();
    if (onDownload) {
      onDownload(file);
    } else if (file.downloadUrl) {
      const newWindow = window.open(file.downloadUrl, '_blank', 'noopener,noreferrer');
      if (newWindow) newWindow.opener = null;
    }
  }, [onDownload]);

  return {
    editingFileId, editingName, setEditingName, renameLoading,
    handleRenameStart, handleRenameCancel, handleRenameConfirm, handleRenameKeyDown,
    editingDescFileId, editingDesc, setEditingDesc,
    handleDescriptionStart, handleDescriptionSave, handleDescriptionKeyDown,
    deleteConfirmOpen, setDeleteConfirmOpen, deleteLoading,
    handleDeleteClick, handleDeleteConfirm,
    unlinkConfirmOpen, setUnlinkConfirmOpen, unlinkLoading,
    handleUnlinkClick, handleUnlinkConfirm,
    handleLinkClick, handleView, handleDownload,
  };
}
