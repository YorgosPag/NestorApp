'use client';

/**
 * ADR-366 Phase 9 / C.2 — BimCommentsStore (Zustand SSoT).
 *
 * Runtime state for BIM comment markers:
 *  - comments       : keyed by commentId, populated by subscribeByProject
 *  - replies        : keyed by commentId, populated per selected comment
 *  - selectedCommentId : drives BimCommentDetailsPanel open/close
 *  - panelOpen      : CommentListPanel (Floating3DPanel "Σχόλια" tab) visibility
 *  - filters        : CommentListPanel filter bar state
 *
 * Subscribe calls live here; leaf UI components read filtered slices only.
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { castDraft } from 'immer';
import { BimCommentsService } from '../comments/bim-comments.service';
import type {
  BimComment,
  BimCommentReply,
  CommentStatus,
  CommentType,
} from '../comments/bim-comment-types';

export interface CommentFilters {
  readonly status?: CommentStatus;
  readonly type?: CommentType;
  readonly assigneeId?: string;
  readonly searchQuery?: string;
}

interface BimCommentsState {
  comments: Record<string, BimComment>;
  replies: Record<string, BimCommentReply[]>;
  selectedCommentId: string | null;
  panelOpen: boolean;
  filters: CommentFilters;
}

interface BimCommentsActions {
  setComments(comments: readonly BimComment[]): void;
  setReplies(commentId: string, replies: readonly BimCommentReply[]): void;
  selectComment(id: string | null): void;
  togglePanel(): void;
  openPanel(): void;
  closePanel(): void;
  setFilters(f: Partial<CommentFilters>): void;
  clearFilters(): void;
  subscribeToProject(projectId: string): () => void;
  subscribeToReplies(commentId: string): () => void;
}

type BimCommentsStoreType = BimCommentsState & BimCommentsActions;

const initialState: BimCommentsState = {
  comments: {},
  replies: {},
  selectedCommentId: null,
  panelOpen: false,
  filters: {},
};

export const useBimCommentsStore = create<BimCommentsStoreType>()(
  devtools(
    subscribeWithSelector(
      immer((set) => ({
        ...initialState,

        setComments(comments) {
          set((draft) => {
            draft.comments = castDraft(Object.fromEntries(comments.map((c) => [c.id, c])));
          });
        },

        setReplies(commentId, replies) {
          set((draft) => {
            draft.replies[commentId] = castDraft([...replies]);
          });
        },

        selectComment(id) {
          set((draft) => { draft.selectedCommentId = id; });
        },

        togglePanel() {
          set((draft) => { draft.panelOpen = !draft.panelOpen; });
        },

        openPanel() {
          set((draft) => { draft.panelOpen = true; });
        },

        closePanel() {
          set((draft) => { draft.panelOpen = false; });
        },

        setFilters(f) {
          set((draft) => { Object.assign(draft.filters, f); });
        },

        clearFilters() {
          set((draft) => { draft.filters = {}; });
        },

        subscribeToProject(projectId) {
          return BimCommentsService.subscribeByProject(
            projectId,
            (comments) => useBimCommentsStore.getState().setComments(comments),
            (err) => console.error('[BimCommentsStore] project subscribe error:', err),
          );
        },

        subscribeToReplies(commentId: string) {
          return BimCommentsService.subscribeReplies(
            commentId,
            (replies) => useBimCommentsStore.getState().setReplies(commentId, replies),
            (err) => console.error('[BimCommentsStore] replies subscribe error:', err),
          );
        },
      })),
    ),
    { name: 'BimCommentsStore' },
  ),
);

// ── Selectors ─────────────────────────────────────────────────────────────────

export function selectFilteredComments(
  comments: Record<string, BimComment>,
  filters: CommentFilters,
): readonly BimComment[] {
  let result = Object.values(comments);
  if (filters.status) result = result.filter((c) => c.status === filters.status);
  if (filters.type) result = result.filter((c) => c.type === filters.type);
  if (filters.assigneeId) result = result.filter((c) => c.assigneeId === filters.assigneeId);
  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    result = result.filter((c) => c.content.toLowerCase().includes(q));
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function selectCommentsByEntityId(
  comments: Record<string, BimComment>,
  entityId: string,
): readonly BimComment[] {
  return Object.values(comments)
    .filter((c) => c.anchor.type === 'entity' && c.anchor.entityId === entityId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
