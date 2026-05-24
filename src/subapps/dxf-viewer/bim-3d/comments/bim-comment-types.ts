/**
 * ADR-366 Phase 9 / C.2 — BIM Comments / Markup: shared domain types.
 * No Firebase, no React. Safe to import from store, service, and renderers.
 */

export type CommentType = 'issue' | 'question' | 'suggestion' | 'approval' | 'info';
export type CommentStatus = 'open' | 'in_review' | 'resolved' | 'archived';
export type AnchorType = 'entity' | 'world';

export interface CommentAnchor {
  readonly type: AnchorType;
  readonly entityId?: string;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly normal?: { readonly x: number; readonly y: number; readonly z: number };
}

export interface CommentAttachment {
  readonly id: string;
  readonly url: string;
  readonly thumbnailUrl: string;
  readonly name: string;
  readonly sizeBytes: number;
}

export interface BimComment {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly type: CommentType;
  readonly status: CommentStatus;
  readonly content: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly anchor: CommentAnchor;
  readonly assigneeId?: string;
  readonly mentionedUserIds: readonly string[];
  readonly attachments: readonly CommentAttachment[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly resolvedAt?: string;
  readonly archivedAt?: string;
}

export interface BimCommentReply {
  readonly id: string;
  readonly companyId: string;
  readonly commentId: string;
  readonly content: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly mentionedUserIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}
