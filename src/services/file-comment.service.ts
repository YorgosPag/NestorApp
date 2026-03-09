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
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FileAuditService } from './file-audit.service';

// ============================================================================
// TYPES
// ============================================================================

export interface FileComment {
  /** Document ID (auto-generated) */
  id: string;
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
    const docRef = await addDoc(collection(db, COLLECTIONS.FILE_COMMENTS), {
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

    // Fire-and-forget audit
    FileAuditService.log(input.fileId, 'comment', input.authorId, {
      commentId: docRef.id,
      parentId: input.parentId ?? null,
    }).catch(() => {});

    return docRef.id;
  },

  /**
   * Get all comments for a file (ordered by creation time)
   */
  async getComments(fileId: string): Promise<FileComment[]> {
    const q = query(
      collection(db, COLLECTIONS.FILE_COMMENTS),
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
   * Subscribe to real-time comment updates for a file
   */
  subscribeToComments(
    fileId: string,
    callback: (comments: FileComment[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, COLLECTIONS.FILE_COMMENTS),
      where('fileId', '==', fileId),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const comments = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as FileComment[];
      callback(comments);
    });
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
