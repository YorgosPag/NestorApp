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
 * - Fail-closed blocked deletion modal for held files
 * - Simple click handlers (link, view, download)
 *
 * Extracted from FilesList for Google SRP compliance.
 *
 * @module components/shared/files/hooks/useFileListActions
 */

import { useCallback, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFilesNotifications } from '@/hooks/notifications/useFilesNotifications';
import { useFileDownload } from './useFileDownload';
import type { FileRecord } from '@/types/file-record';

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
  editingFileId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  renameLoading: boolean;
  handleRenameStart: (file: FileRecord) => void;
  handleRenameCancel: () => void;
  handleRenameConfirm: () => Promise<void>;
  handleRenameKeyDown: (e: React.KeyboardEvent) => void;
  editingDescFileId: string | null;
  editingDesc: string;
  setEditingDesc: (desc: string) => void;
  handleDescriptionStart: (file: FileRecord) => void;
  handleDescriptionSave: () => void;
  handleDescriptionKeyDown: (e: React.KeyboardEvent) => void;
  deleteConfirmOpen: boolean;
  setDeleteConfirmOpen: (open: boolean) => void;
  deleteLoading: boolean;
  handleDeleteClick: (fileId: string, event: React.MouseEvent) => void;
  handleDeleteConfirm: () => Promise<void>;
  deleteBlockedOpen: boolean;
  setDeleteBlockedOpen: (open: boolean) => void;
  deleteBlockedMessage: string;
  unlinkConfirmOpen: boolean;
  setUnlinkConfirmOpen: (open: boolean) => void;
  unlinkLoading: boolean;
  handleUnlinkClick: (fileId: string, event: React.MouseEvent) => void;
  handleUnlinkConfirm: () => Promise<void>;
  handleLinkClick: (file: FileRecord, event: React.MouseEvent) => void;
  handleView: (file: FileRecord, event: React.MouseEvent) => void;
  handleDownload: (file: FileRecord, event: React.MouseEvent) => void;
}

const logger = createModuleLogger('FileListActions');

function deriveDeleteBlockMessage(error: unknown, fallbackMessage: string): string {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  const normalizedMessage = error.message.toLowerCase();
  if (normalizedMessage.includes('hold')) {
    return fallbackMessage;
  }

  return '';
}

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
  // SSoT: enterprise download with proper filename + extension (fallback when caller doesn't provide onDownload)
  const { handleDownload: enterpriseDownload } = useFileDownload();
  const { t } = useTranslation(['files', 'files-media']);
  const fileNotifications = useFilesNotifications();

  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  const [editingDescFileId, setEditingDescFileId] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState('');

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteBlockedOpen, setDeleteBlockedOpen] = useState(false);
  const [deleteBlockedMessage, setDeleteBlockedMessage] = useState('');

  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const [fileToUnlink, setFileToUnlink] = useState<string | null>(null);
  const [unlinkLoading, setUnlinkLoading] = useState(false);

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
      fileNotifications.list.renameSuccess();
      setEditingFileId(null);
      setEditingName('');
    } catch (err) {
      fileNotifications.list.renameError();
      logger.error('Rename failed', { error: err });
    } finally {
      setRenameLoading(false);
    }
  }, [editingFileId, editingName, onRename, fileNotifications]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleRenameConfirm();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  }, [handleRenameConfirm, handleRenameCancel]);

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
      fileNotifications.list.deleteSuccess();
      setDeleteConfirmOpen(false);
      setFileToDelete(null);
    } catch (err) {
      const blockedMessage = deriveDeleteBlockMessage(err, t('trash.cannotTrashWithHold'));
      setDeleteConfirmOpen(false);

      if (blockedMessage) {
        setDeleteBlockedMessage(blockedMessage);
        setDeleteBlockedOpen(true);
      } else {
        fileNotifications.list.deleteError();
      }

      logger.error('Delete failed', { error: err });
    } finally {
      setDeleteLoading(false);
    }
  }, [fileToDelete, onDelete, t, fileNotifications]);

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
      fileNotifications.list.unlinkSuccess();
      setUnlinkConfirmOpen(false);
      setFileToUnlink(null);
    } catch (err) {
      fileNotifications.list.unlinkError();
      logger.error('Unlink failed', { error: err });
    } finally {
      setUnlinkLoading(false);
    }
  }, [fileToUnlink, onUnlink, fileNotifications]);

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
    } else {
      // SSoT: always use enterprise download (blob + proper extension)
      enterpriseDownload(file);
    }
  }, [onDownload, enterpriseDownload]);

  return {
    editingFileId, editingName, setEditingName, renameLoading,
    handleRenameStart, handleRenameCancel, handleRenameConfirm, handleRenameKeyDown,
    editingDescFileId, editingDesc, setEditingDesc,
    handleDescriptionStart, handleDescriptionSave, handleDescriptionKeyDown,
    deleteConfirmOpen, setDeleteConfirmOpen, deleteLoading,
    handleDeleteClick, handleDeleteConfirm,
    deleteBlockedOpen, setDeleteBlockedOpen, deleteBlockedMessage,
    unlinkConfirmOpen, setUnlinkConfirmOpen, unlinkLoading,
    handleUnlinkClick, handleUnlinkConfirm,
    handleLinkClick, handleView, handleDownload,
  };
}
