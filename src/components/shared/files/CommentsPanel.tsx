/**
 * =============================================================================
 * Comments Panel — Inline threaded comments for file documents
 * =============================================================================
 *
 * Displays threaded comments with real-time updates, reply support,
 * edit/delete, and resolve/unresolve for thread management.
 *
 * @module components/shared/files/CommentsPanel
 * @enterprise ADR-191 Phase 4.3 — Inline Annotations / Comments
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  Reply,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  Send,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  FileCommentService,
  type FileComment,
} from '@/services/file-comment.service';
import {
  addFileCommentWithPolicy,
  deleteFileCommentWithPolicy,
  editFileCommentWithPolicy,
  toggleFileCommentResolveWithPolicy,
} from '@/services/filesystem/file-mutation-gateway';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

export interface CommentsPanelProps {
  /** File ID to show comments for */
  fileId: string;
  /** Tenant isolation — company ID for Firestore rules */
  companyId: string;
  /** Current user ID */
  currentUserId: string;
  /** Current user display name */
  currentUserName: string;
  /** Optional className */
  className?: string;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface CommentItemProps {
  comment: FileComment;
  replies: FileComment[];
  currentUserId: string;
  currentUserName: string;
  onReply: (parentId: string) => void;
  onEdit: (comment: FileComment) => void;
  onDelete: (commentId: string) => void;
  onToggleResolve: (comment: FileComment) => void;
  t: (key: string) => string;
}

function CommentItem({
  comment,
  replies,
  currentUserId,
  currentUserName: _currentUserName,
  onReply,
  onEdit,
  onDelete,
  onToggleResolve,
  t,
}: CommentItemProps) {
  const colors = useSemanticColors();
  const isOwner = comment.authorId === currentUserId;
  const timeAgo = useMemo(() => {
    const date = comment.createdAt
      ? new Date(comment.createdAt as string)
      : new Date();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return t('comments.justNow');
    if (diffMin < 60) return `${diffMin} ${t('comments.minutesAgo')}`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24)
      return `${diffHours} ${t('comments.hoursAgo')}`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ${t('comments.daysAgo')}`;
  }, [comment.createdAt, t]);

  return (
    <article
      className={cn(
        'group',
        comment.resolved && 'opacity-60'
      )}
    >
      {/* Comment header */}
      <header className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-foreground">
          {comment.authorName}
        </span>
        <span className={cn("text-[10px]", colors.text.muted)}>{timeAgo}</span>{/* eslint-disable-line custom/no-hardcoded-strings */}
        {comment.editedAt && (
          <span className={cn("text-[10px] italic", colors.text.muted)}>
            ({t('comments.edited')})
          </span>
        )}
      </header>

      {/* Comment body */}
      <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
        {comment.text}
      </p>

      {/* Actions */}
      <nav className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Reply */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onReply(comment.id)}
          className={cn("h-6 px-1.5 text-xs", colors.text.muted)}
        >
          <Reply className="h-3 w-3 mr-1" />
          {t('comments.reply')}
        </Button>

        {/* Resolve (only top-level) */}
        {!comment.parentId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleResolve(comment)}
            className={cn("h-6 px-1.5 text-xs", colors.text.muted)}
          >
            {comment.resolved ? (
              <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" /> // eslint-disable-line design-system/enforce-semantic-colors
            ) : (
              <Circle className="h-3 w-3 mr-1" />
            )}
            {comment.resolved
              ? t('comments.reopen')
              : t('comments.resolve')}
          </Button>
        )}

        {/* Edit / Delete (only owner) */}
        {isOwner && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(comment)}
              className={cn("h-6 px-1.5 text-xs", colors.text.muted)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(comment.id)}
              className="h-6 px-1.5 text-xs text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
      </nav>

      {/* Replies */}
      {replies.length > 0 && (
        <section className="ml-4 mt-2 pl-3 border-l-2 border-muted space-y-3">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              replies={[]}
              currentUserId={currentUserId}
              currentUserName={_currentUserName}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleResolve={onToggleResolve}
              t={t}
            />
          ))}
        </section>
      )}
    </article>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CommentsPanel({
  fileId,
  companyId,
  currentUserId,
  currentUserName,
  className,
}: CommentsPanelProps) {
  const { t } = useTranslation('files');
  const colors = useSemanticColors();
  const [comments, setComments] = useState<FileComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<FileComment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Real-time subscription (companyId required for Firestore rules)
  useEffect(() => {
    setLoading(true);
    const unsub = FileCommentService.subscribeToComments(fileId, companyId, (data) => {
      setComments(data);
      setLoading(false);
    });
    return unsub;
  }, [fileId, companyId]);

  // Build thread structure: top-level comments + their replies
  const threads = useMemo(() => {
    const topLevel = comments.filter((c) => !c.parentId);
    const repliesMap = new Map<string, FileComment[]>();

    for (const c of comments) {
      if (c.parentId) {
        const arr = repliesMap.get(c.parentId) ?? [];
        arr.push(c);
        repliesMap.set(c.parentId, arr);
      }
    }

    return topLevel.map((c) => ({
      comment: c,
      replies: repliesMap.get(c.id) ?? [],
    }));
  }, [comments]);

  const handleSubmit = useCallback(async () => {
    const text = newText.trim();
    if (!text) return;

    setSubmitting(true);
    try {
      if (editingComment) {
        await editFileCommentWithPolicy(editingComment.id, text);
        setEditingComment(null);
      } else {
        await addFileCommentWithPolicy({
          companyId,
          fileId,
          parentId: replyingTo ?? undefined,
          text,
          authorId: currentUserId,
          authorName: currentUserName,
        });
        setReplyingTo(null);
      }
      setNewText('');
    } finally {
      setSubmitting(false);
    }
  }, [newText, editingComment, companyId, fileId, replyingTo, currentUserId, currentUserName]);

  const handleDelete = useCallback(async (commentId: string) => {
    await deleteFileCommentWithPolicy(commentId);
  }, []);

  const handleToggleResolve = useCallback(
    async (comment: FileComment) => {
      await toggleFileCommentResolveWithPolicy(
        comment.id,
        !comment.resolved,
        currentUserId
      );
    },
    [currentUserId]
  );

  const handleEdit = useCallback((comment: FileComment) => {
    setEditingComment(comment);
    setNewText(comment.text);
    setReplyingTo(null);
  }, []);

  const handleReply = useCallback((parentId: string) => {
    setReplyingTo(parentId);
    setEditingComment(null);
    setNewText('');
  }, []);

  const handleCancel = useCallback(() => {
    setReplyingTo(null);
    setEditingComment(null);
    setNewText('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        handleCancel();
      }
    },
    [handleSubmit, handleCancel]
  );

  // Replying-to display name
  const replyingToName = useMemo(() => {
    if (!replyingTo) return null;
    return comments.find((c) => c.id === replyingTo)?.authorName ?? '';
  }, [replyingTo, comments]);

  return (
    <section className={cn('flex flex-col', className)}>
      {/* Header */}
      <header className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
        <MessageSquare className={cn("h-4 w-4", colors.text.muted)} />
        <h3 className="text-sm font-medium">
          {t('comments.title')}
          {comments.length > 0 && (
            <span className={cn("ml-1.5 text-xs", colors.text.muted)}>
              ({comments.length})
            </span>
          )}
        </h3>
      </header>

      {/* Comments list */}
      <section className="flex-1 overflow-y-auto px-3 py-2 space-y-4 max-h-[300px]">
        {loading ? (
          <p className={cn("text-xs text-center py-4", colors.text.muted)}>
            <Spinner size="small" className="inline mr-1" />
            {t('comments.loading')}
          </p>
        ) : threads.length === 0 ? (
          <p className={cn("text-xs text-center py-4", colors.text.muted)}>
            {t('comments.empty')}
          </p>
        ) : (
          threads.map(({ comment, replies }) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={replies}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleResolve={handleToggleResolve}
              t={(key) => t(key)}
            />
          ))
        )}
      </section>

      {/* Input area */}
      <footer className="border-t px-3 py-2 bg-muted/10">
        {/* Reply / Edit indicator */}
        {(replyingTo || editingComment) && (
          <section className={cn("flex items-center gap-2 mb-2 text-xs", colors.text.muted)}>
            {replyingTo && (
              <>
                <Reply className="h-3 w-3" />
                <span>
                  {t('comments.replyingTo')} {replyingToName}
                </span>
              </>
            )}
            {editingComment && (
              <>
                <Pencil className="h-3 w-3" />
                <span>{t('comments.editing')}</span>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-5 w-5 p-0 ml-auto"
            >
              <X className="h-3 w-3" />
            </Button>
          </section>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <Textarea
            size="sm"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('comments.placeholder')}
            className="flex-1 resize-none min-h-[36px] max-h-[100px]"
            rows={1}
            disabled={submitting}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!newText.trim() || submitting}
            className="h-9 px-3"
          >
            {submitting ? (
              <Spinner size="small" color="inherit" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </form>
      </footer>
    </section>
  );
}
