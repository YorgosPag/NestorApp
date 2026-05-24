'use client';

/**
 * ADR-366 Phase 9 / C.2 — BIM Comments client-side Firestore CRUD.
 *
 * Mirror of BimDimensions3DService pattern (ADR-366 Phase 9 / C.3):
 *  - Direct setDoc/updateDoc/deleteDoc via Firebase client SDK.
 *  - Audit trail written by CDC trigger on document change (ADR-195).
 *  - subscribeByProject uses firestoreQueryService (companyId auto-applied).
 *  - subscribeReplies uses onSnapshot directly (subcollection not in COLLECTIONS).
 */

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import {
  generateBimCommentId,
  generateBimCommentReplyId,
} from '@/services/enterprise-id.service';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { nowISO } from '@/lib/date-local';
import { canTransition } from './comment-status-fsm';
import type {
  BimComment,
  BimCommentReply,
  CommentAnchor,
  CommentAttachment,
  CommentStatus,
  CommentType,
} from './bim-comment-types';

export interface CreateCommentInput {
  readonly projectId: string;
  readonly companyId: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly type: CommentType;
  readonly content: string;
  readonly anchor: CommentAnchor;
  readonly mentionedUserIds?: readonly string[];
  readonly assigneeId?: string;
}

export interface UpdateCommentInput {
  readonly content?: string;
  readonly assigneeId?: string | null;
  readonly mentionedUserIds?: readonly string[];
  readonly attachments?: readonly CommentAttachment[];
}

export interface CreateReplyInput {
  readonly commentId: string;
  readonly companyId: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly content: string;
  readonly mentionedUserIds?: readonly string[];
}

export const BimCommentsService = {
  async createComment(input: CreateCommentInput): Promise<BimComment> {
    const id = generateBimCommentId();
    const now = nowISO();
    const payload: BimComment = {
      id,
      companyId: input.companyId,
      projectId: input.projectId,
      type: input.type,
      status: 'open',
      content: input.content,
      authorId: input.authorId,
      authorName: input.authorName,
      anchor: input.anchor,
      ...(input.assigneeId ? { assigneeId: input.assigneeId } : {}),
      mentionedUserIds: input.mentionedUserIds ?? [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    const ref = doc(db, COLLECTIONS.BIM_COMMENTS, id);
    await setDoc(ref, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return payload;
  },

  async updateComment(commentId: string, patch: UpdateCommentInput): Promise<void> {
    const ref = doc(db, COLLECTIONS.BIM_COMMENTS, commentId);
    await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
  },

  async transitionStatus(
    commentId: string,
    from: CommentStatus,
    to: CommentStatus,
    isAuthorOrAdmin: boolean,
  ): Promise<void> {
    if (!canTransition(from, to, isAuthorOrAdmin)) {
      throw new Error(`[BimCommentsService] Invalid transition: ${from} → ${to}`);
    }
    const ref = doc(db, COLLECTIONS.BIM_COMMENTS, commentId);
    const patch: Record<string, unknown> = { status: to, updatedAt: serverTimestamp() };
    if (to === 'resolved') patch['resolvedAt'] = serverTimestamp();
    if (to === 'archived') patch['archivedAt'] = serverTimestamp();
    await updateDoc(ref, patch);
  },

  async assignComment(commentId: string, assigneeId: string | null): Promise<void> {
    const ref = doc(db, COLLECTIONS.BIM_COMMENTS, commentId);
    await updateDoc(ref, { assigneeId: assigneeId ?? null, updatedAt: serverTimestamp() });
  },

  async orphanComment(commentId: string, worldPosition: CommentAnchor['position']): Promise<void> {
    const ref = doc(db, COLLECTIONS.BIM_COMMENTS, commentId);
    await updateDoc(ref, {
      'anchor.type': 'world',
      'anchor.entityId': null,
      'anchor.position': worldPosition,
      updatedAt: serverTimestamp(),
    });
  },

  async createReply(input: CreateReplyInput): Promise<BimCommentReply> {
    const id = generateBimCommentReplyId();
    const now = nowISO();
    const payload: BimCommentReply = {
      id,
      companyId: input.companyId,
      commentId: input.commentId,
      content: input.content,
      authorId: input.authorId,
      authorName: input.authorName,
      mentionedUserIds: input.mentionedUserIds ?? [],
      createdAt: now,
      updatedAt: now,
    };
    const commentRef = doc(db, COLLECTIONS.BIM_COMMENTS, input.commentId);
    const replyRef = doc(
      collection(commentRef, SUBCOLLECTIONS.BIM_COMMENT_REPLIES),
      id,
    );
    await setDoc(replyRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return payload;
  },

  async deleteReply(commentId: string, replyId: string): Promise<void> {
    const commentRef = doc(db, COLLECTIONS.BIM_COMMENTS, commentId);
    const replyRef = doc(
      collection(commentRef, SUBCOLLECTIONS.BIM_COMMENT_REPLIES),
      replyId,
    );
    await deleteDoc(replyRef);
  },

  subscribeByProject(
    projectId: string,
    onChange: (comments: readonly BimComment[]) => void,
    onError?: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<BimComment>(
      'BIM_COMMENTS',
      (result) => onChange(result.documents),
      (err) => onError?.(err),
      { constraints: [where('projectId', '==', projectId)] },
    );
  },

  subscribeReplies(
    commentId: string,
    onChange: (replies: readonly BimCommentReply[]) => void,
    onError?: (err: Error) => void,
  ): Unsubscribe {
    const commentRef = doc(db, COLLECTIONS.BIM_COMMENTS, commentId);
    const repliesRef = collection(commentRef, SUBCOLLECTIONS.BIM_COMMENT_REPLIES);
    const q = query(repliesRef, orderBy('createdAt', 'asc'));
    return onSnapshot(
      q,
      (snap) => onChange(snap.docs.map((d) => d.data() as BimCommentReply)),
      (err) => onError?.(err),
    );
  },
} as const;
