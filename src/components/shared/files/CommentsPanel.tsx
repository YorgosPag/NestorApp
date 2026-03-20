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
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  FileCommentService,
  type FileComment,
} from '@/services/file-comment.service';

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
  t: (key: string, fallback?: string) => string;
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
  const isOwner = comment.authorId === currentUserId;
  const timeAgo = useMemo(() => {
    const date = comment.createdAt
      ? new Date(comment.createdAt as string)
      : new Date();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return t('comments.justNow', 'μόλις τώρα');
    if (diffMin < 60) return `${diffMin} ${t('comments.minutesAgo', 'λεπτά')}`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24)
      return `${diffHours} ${t('comments.hoursAgo', 'ώρες')}`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ${t('comments.daysAgo', 'ημέρες')}`;
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
        <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
        {comment.editedAt && (
          <span className="text-[10px] text-muted-foreground italic">
            ({t('comments.edited', 'επεξεργασμένο')})
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
          className="h-6 px-1.5 text-xs text-muted-foreground"
        >
          <Reply className="h-3 w-3 mr-1" />
          {t('comments.reply', 'Απάντηση')}
        </Button>

        {/* Resolve (only top-level) */}
        {!comment.parentId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleResolve(comment)}
            className="h-6 px-1.5 text-xs text-muted-foreground"
          >
            {comment.resolved ? (
              <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
            ) : (
              <Circle className="h-3 w-3 mr-1" />
            )}
            {comment.resolved
              ? t('comments.reopen', 'Ξαναάνοιγμα')
              : t('comments.resolve', 'Επίλυση')}
          </Button>
        )}

        {/* Edit / Delete (only owner) */}
        {isOwner && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(comment)}
              className="h-6 px-1.5 text-xs text-muted-foreground"
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
  const [comments, setComments] = useState<FileComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<FileComment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Real-time subscription
  useEffect(() => {
    setLoading(true);
    const unsub = FileCommentService.subscribeToComments(fileId, (data) => {
      setComments(data);
      setLoading(false);
    });
    return unsub;
  }, [fileId]);

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
        await FileCommentService.editComment(editingComment.id, text);
        setEditingComment(null);
      } else {
        await FileCommentService.addComment({
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
    await FileCommentService.deleteComment(commentId);
  }, []);

  const handleToggleResolve = useCallback(
    async (comment: FileComment) => {
      await FileCommentService.toggleResolve(
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
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">
          {t('comments.title', 'Σχόλια')}
          {comments.length > 0 && (
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({comments.length})
            </span>
          )}
        </h3>
      </header>

      {/* Comments list */}
      <section className="flex-1 overflow-y-auto px-3 py-2 space-y-4 max-h-[300px]">
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            <Spinner size="small" className="inline mr-1" />
            {t('comments.loading', 'Φόρτωση σχολίων...')}
          </p>
        ) : threads.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t('comments.empty', 'Δεν υπάρχουν σχόλια. Γράψε το πρώτο!')}
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
              t={(key, fallback) => t(key, fallback ?? '')}
            />
          ))
        )}
      </section>

      {/* Input area */}
      <footer className="border-t px-3 py-2 bg-muted/10">
        {/* Reply / Edit indicator */}
        {(replyingTo || editingComment) && (
          <section className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            {replyingTo && (
              <>
                <Reply className="h-3 w-3" />
                <span>
                  {t('comments.replyingTo', 'Απάντηση σε')} {replyingToName}
                </span>
              </>
            )}
            {editingComment && (
              <>
                <Pencil className="h-3 w-3" />
                <span>{t('comments.editing', 'Επεξεργασία σχολίου')}</span>
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
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('comments.placeholder', 'Γράψε ένα σχόλιο... (Ctrl+Enter για αποστολή)')}
            className="flex-1 text-sm border rounded-md px-2 py-1.5 bg-background resize-none min-h-[36px] max-h-[100px] focus:outline-none focus:ring-2 focus:ring-ring"
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
