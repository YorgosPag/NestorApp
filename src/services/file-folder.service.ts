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
  doc,
  setDoc,
  where,
  orderBy,
  deleteDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FileAuditService } from './file-audit.service';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';

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
   * 🏢 ADR-214 Phase 3: siblings query via FirestoreQueryService (auto tenant filter)
   */
  async createFolder(input: CreateFolderInput): Promise<string> {
    // Get current max sortOrder for siblings — auto tenant filter replaces manual companyId
    const siblingsResult = await firestoreQueryService.getAll<DocumentData>('FILE_FOLDERS', {
      constraints: [
        where('parentId', '==', input.parentId ?? null),
      ],
    });
    const maxOrder = siblingsResult.documents.reduce(
      (max, d) => Math.max(max, (d.sortOrder as number) || 0),
      0
    );

    const { generateFolderId } = await import('@/services/enterprise-id.service');
    const enterpriseId = generateFolderId();
    const docRef = doc(db, COLLECTIONS.FILE_FOLDERS, enterpriseId);
    await setDoc(docRef, {
      companyId: input.companyId,
      parentId: input.parentId ?? null,
      name: input.name,
      color: input.color ?? null,
      icon: input.icon ?? null,
      sortOrder: maxOrder + 1,
      createdAt: serverTimestamp(),
      createdBy: input.createdBy,
    });

    return enterpriseId;
  },

  /**
   * Get all folders for a company (flat list — client builds tree)
   * 🏢 ADR-214 Phase 3: via FirestoreQueryService (auto tenant filter replaces manual companyId)
   */
  async getFolders(companyId: string): Promise<FileFolder[]> {
    const result = await firestoreQueryService.getAll<DocumentData>('FILE_FOLDERS', {
      constraints: [
        orderBy('sortOrder', 'asc'),
      ],
    });
    return result.documents as unknown as FileFolder[];
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
    safeFireAndForget(FileAuditService.log(fileId, 'move', userId, {
      targetFolderId: folderId,
    }), 'FileFolder.moveToFolder');
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
      safeFireAndForget(FileAuditService.log(fileId, 'move', userId, {
        targetFolderId: folderId,
      }), 'FileFolder.moveToFolder');
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
