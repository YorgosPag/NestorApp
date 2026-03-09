/**
 * =============================================================================
 * File Folder Service — Virtual folder structure for file organization
 * =============================================================================
 *
 * Virtual folder system stored in Firestore. Files reference folders by ID.
 * Supports nested folders, drag-and-drop reordering, and company-scoped isolation.
 *
 * @module services/file-folder.service
 * @enterprise ADR-191 Phase 4.4 — Drag & Drop Folder Structure
 */

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FileAuditService } from './file-audit.service';

// ============================================================================
// TYPES
// ============================================================================

export interface FileFolder {
  /** Document ID (auto-generated) */
  id: string;
  /** Company ID for tenant isolation */
  companyId: string;
  /** Parent folder ID (null for root-level folders) */
  parentId: string | null;
  /** Folder display name */
  name: string;
  /** Color tag for visual identification */
  color: string | null;
  /** Icon name (lucide icon key) */
  icon: string | null;
  /** Sort order within parent */
  sortOrder: number;
  /** Creation timestamp */
  createdAt: Date | string;
  /** User who created this folder */
  createdBy: string;
}

export interface CreateFolderInput {
  companyId: string;
  parentId?: string;
  name: string;
  color?: string;
  icon?: string;
  createdBy: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export const FileFolderService = {
  /**
   * Create a new virtual folder
   */
  async createFolder(input: CreateFolderInput): Promise<string> {
    // Get current max sortOrder for siblings
    const siblingsQuery = query(
      collection(db, COLLECTIONS.FILE_FOLDERS),
      where('companyId', '==', input.companyId),
      where('parentId', '==', input.parentId ?? null)
    );
    const siblings = await getDocs(siblingsQuery);
    const maxOrder = siblings.docs.reduce(
      (max, d) => Math.max(max, (d.data().sortOrder as number) || 0),
      0
    );

    const docRef = await addDoc(collection(db, COLLECTIONS.FILE_FOLDERS), {
      companyId: input.companyId,
      parentId: input.parentId ?? null,
      name: input.name,
      color: input.color ?? null,
      icon: input.icon ?? null,
      sortOrder: maxOrder + 1,
      createdAt: serverTimestamp(),
      createdBy: input.createdBy,
    });

    return docRef.id;
  },

  /**
   * Get all folders for a company (flat list — client builds tree)
   */
  async getFolders(companyId: string): Promise<FileFolder[]> {
    const q = query(
      collection(db, COLLECTIONS.FILE_FOLDERS),
      where('companyId', '==', companyId),
      orderBy('sortOrder', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as FileFolder[];
  },

  /**
   * Rename a folder
   */
  async renameFolder(folderId: string, newName: string): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.FILE_FOLDERS, folderId), {
      name: newName,
    });
  },

  /**
   * Delete a folder (files inside are unassigned, not deleted)
   */
  async deleteFolder(folderId: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.FILE_FOLDERS, folderId));
  },

  /**
   * Move a folder to a new parent
   */
  async moveFolder(
    folderId: string,
    newParentId: string | null
  ): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.FILE_FOLDERS, folderId), {
      parentId: newParentId,
    });
  },

  /**
   * Move a file into a folder (updates FileRecord.folderId)
   */
  async moveFileToFolder(
    fileId: string,
    folderId: string | null,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.FILES, fileId), {
      folderId: folderId,
    });

    // Fire-and-forget audit
    FileAuditService.log(fileId, 'move', userId, {
      targetFolderId: folderId,
    }).catch(() => {});
  },

  /**
   * Move multiple files to a folder (batch operation)
   */
  async moveFilesToFolder(
    fileIds: string[],
    folderId: string | null,
    userId: string
  ): Promise<void> {
    const batch = writeBatch(db);

    for (const fileId of fileIds) {
      batch.update(doc(db, COLLECTIONS.FILES, fileId), {
        folderId: folderId,
      });
    }

    await batch.commit();

    // Fire-and-forget audit for each file
    for (const fileId of fileIds) {
      FileAuditService.log(fileId, 'move', userId, {
        targetFolderId: folderId,
      }).catch(() => {});
    }
  },

  /**
   * Update sort order for folders (after drag-and-drop reorder)
   */
  async reorderFolders(
    folderOrders: Array<{ id: string; sortOrder: number }>
  ): Promise<void> {
    const batch = writeBatch(db);

    for (const { id, sortOrder } of folderOrders) {
      batch.update(doc(db, COLLECTIONS.FILE_FOLDERS, id), { sortOrder });
    }

    await batch.commit();
  },

  /**
   * Update folder color
   */
  async updateColor(folderId: string, color: string | null): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.FILE_FOLDERS, folderId), {
      color,
    });
  },
};
