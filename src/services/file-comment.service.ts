/**
 * =============================================================================
 * File Comment Service — Inline annotations & threaded comments
 * =============================================================================
 *
 * Enterprise comment system for file documents.
 * Supports threaded replies, mentions, and real-time updates.
 *
 * @module services/file-comment.service
 * @enterprise ADR-191 Phase 4.3 — Inline Annotations / Comments
 */

import {
  collection,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { createModuleLogger } from '@/lib/telemetry';
import { FileAuditService } from './file-audit.service';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';

const log = createModuleLogger('file-comment.service');

// ============================================================================
// TYPES
// ============================================================================

export interface FileComment {
  /** Document ID (auto-generated) */
  id: string;
  /** Tenant isolation — company that owns this comment */
  companyId: string;
  /** File this comment belongs to */
  fileId: string;
  /** Parent comment ID (null for top-level comments) */
  parentId: string | null;
  /** Comment text content */
  text: string;
  /** Author user ID */
  authorId: string;
  /** Author display name (denormalized for fast reads) */
  authorName: string;
  /** Creation timestamp */
  createdAt: Date | string;
  /** Last edit timestamp (null if never edited) */
  editedAt: Date | string | null;
  /** Whether this comment has been resolved */
  resolved: boolean;
  /** User ID who resolved this comment */
  resolvedBy: string | null;
}

export interface CreateCommentInput {
  companyId: string;
  fileId: string;
  parentId?: string;
  text: string;
  authorId: string;
  authorName: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export const FileCommentService = {
  /**
   * Add a comment to a file
   */
  async addComment(input: CreateCommentInput): Promise<string> {
    const { generateCommentId } = await import('@/services/enterprise-id.service');
    const enterpriseId = generateCommentId();
    const docRef = doc(db, COLLECTIONS.FILE_COMMENTS, enterpriseId);
    await setDoc(docRef, {
      companyId: input.companyId,
      fileId: input.fileId,
      parentId: input.parentId ?? null,
      text: input.text,
      authorId: input.authorId,
      authorName: input.authorName,
      createdAt: serverTimestamp(),
      editedAt: null,
      resolved: false,
      resolvedBy: null,
    });

    // Fire-and-forget audit (with companyId for tenant isolation)
    safeFireAndForget(FileAuditService.log(input.fileId, 'comment', input.authorId, input.companyId, {
      commentId: enterpriseId,
      parentId: input.parentId ?? null,
    }), 'FileComment.addComment');

    return enterpriseId;
  },

  /**
   * Get all comments for a file (ordered by creation time)
   */
  async getComments(fileId: string, companyId: string): Promise<FileComment[]> {
    const q = query(
      collection(db, COLLECTIONS.FILE_COMMENTS),
      where('companyId', '==', companyId),
      where('fileId', '==', fileId),
      orderBy('createdAt', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as FileComment[];
  },

  /**
   * Subscribe to real-time comment updates for a file.
   * Tenant isolation (companyId filter) auto-injected by firestoreQueryService
   * from the authenticated user's context (ADR-214).
   */
  subscribeToComments(
    fileId: string,
    callback: (comments: FileComment[]) => void
  ): Unsubscribe {
    return firestoreQueryService.subscribe<FileComment>(
      'FILE_COMMENTS',
      (result) => callback(result.documents),
      (err) => log.error('subscribeToComments failed', { fileId, err }),
      {
        constraints: [
          where('fileId', '==', fileId),
          orderBy('createdAt', 'asc'),
        ],
      }
    );
  },

  /**
   * Edit a comment's text
   */
  async editComment(commentId: string, newText: string): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.FILE_COMMENTS, commentId), {
      text: newText,
      editedAt: serverTimestamp(),
    });
  },

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.FILE_COMMENTS, commentId));
  },

  /**
   * Resolve/unresolve a comment thread
   */
  async toggleResolve(
    commentId: string,
    resolved: boolean,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.FILE_COMMENTS, commentId), {
      resolved,
      resolvedBy: resolved ? userId : null,
    });
  },
};
