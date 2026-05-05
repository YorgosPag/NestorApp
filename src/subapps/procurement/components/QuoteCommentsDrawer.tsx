'use client';

// ADR-329: Quote Comments side drawer / bottom sheet
// Internal-only comments visible to team, never to vendors.

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Pencil, Trash2, SendHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIsMobile } from '@/hooks/useMobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/auth/hooks/useAuth';
import { quoteCommentService, formatCommentDate, type QuoteComment } from '@/services/quote-comment.service';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// PROPS
// ============================================================================

export interface QuoteCommentsDrawerProps {
  quoteId: string;
  open: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

// ============================================================================
// RENDER HELPERS
// ============================================================================

function renderMentions(text: string): React.ReactNode {
  const parts = text.split(/(@\S+)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <strong key={i} className="text-primary font-medium">{part}</strong>
    ) : part.length > 0 ? (
      <span key={i}>{part}</span>
    ) : null,
  );
}

// ============================================================================
// COMMENT ITEM
// ============================================================================

interface CommentItemProps {
  comment: QuoteComment;
  isOwn: boolean;
  isEditing: boolean;
  editText: string;
  onEditTextChange: (v: string) => void;
  confirmingDelete: boolean;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  t: (key: string) => string;
}

function CommentItem({
  comment, isOwn, isEditing, editText, onEditTextChange,
  confirmingDelete, onStartEdit, onSaveEdit, onCancelEdit,
  onRequestDelete, onConfirmDelete, onCancelDelete, t,
}: CommentItemProps) {
  return (
    <article className="group relative space-y-1">
      <header className="flex items-baseline gap-1.5">
        <span className="text-xs font-semibold leading-none">{comment.authorName}</span>
        <time className="text-[10px] text-muted-foreground leading-none">
          {formatCommentDate(comment.createdAt)}
        </time>
        {comment.editedAt && (
          <span className="text-[10px] text-muted-foreground italic leading-none">
            ({t('rfqs.comments.edited')})
          </span>
        )}
      </header>

      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            className="min-h-[56px] resize-none text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={onSaveEdit} disabled={!editText.trim()}>
              {t('rfqs.comments.save')}
            </Button>
            <Button size="sm" variant="outline" onClick={onCancelEdit}>
              {t('rfqs.comments.cancel')}
            </Button>
          </div>
        </div>
      ) : confirmingDelete ? (
        <div className="flex flex-wrap items-center gap-2 text-sm py-1">
          <span className="text-destructive text-xs">{t('rfqs.comments.confirmDelete')}</span>
          <Button size="sm" variant="destructive" className="h-6 text-xs px-2" onClick={onConfirmDelete}>
            {t('rfqs.comments.delete')}
          </Button>
          <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={onCancelDelete}>
            {t('rfqs.comments.cancel')}
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm whitespace-pre-wrap break-words pr-12">
            {renderMentions(comment.text)}
          </p>
          {isOwn && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0 flex gap-0.5">
              <Button
                variant="ghost" size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={onStartEdit}
                title={t('rfqs.comments.edit')}
              >
                <Pencil className="size-3" />
              </Button>
              <Button
                variant="ghost" size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={onRequestDelete}
                title={t('rfqs.comments.delete')}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          )}
        </>
      )}
    </article>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function QuoteCommentsDrawer({
  quoteId,
  open,
  onClose,
  onCountChange,
}: QuoteCommentsDrawerProps) {
  const { t } = useTranslation('quotes');
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const authorName = user?.displayName ?? user?.email ?? user?.uid ?? '';

  const [comments, setComments] = useState<QuoteComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newText, setNewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    quoteCommentService.listComments(quoteId).then((data) => {
      if (cancelled) return;
      setComments(data);
      onCountChange?.(data.length);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, quoteId, onCountChange]);

  useEffect(() => {
    if (comments.length > 0) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length]);

  const handleSubmit = useCallback(async () => {
    if (!newText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const created = await quoteCommentService.createComment(quoteId, newText.trim(), authorName);
      setComments((prev) => {
        const next = [...prev, created];
        onCountChange?.(next.length);
        return next;
      });
      setNewText('');
    } finally {
      setSubmitting(false);
    }
  }, [quoteId, newText, submitting, authorName, onCountChange]);

  const handleSaveEdit = useCallback(async (commentId: string) => {
    if (!editText.trim()) return;
    await quoteCommentService.editComment(quoteId, commentId, editText.trim());
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, text: editText.trim(), editedAt: nowISO() }
          : c,
      ),
    );
    setEditingId(null);
    setEditText('');
  }, [quoteId, editText]);

  const handleDelete = useCallback(async (commentId: string) => {
    await quoteCommentService.deleteComment(quoteId, commentId);
    setComments((prev) => {
      const next = prev.filter((c) => c.id !== commentId);
      onCountChange?.(next.length);
      return next;
    });
    setConfirmDeleteId(null);
  }, [quoteId, onCountChange]);

  const startEdit = useCallback((comment: QuoteComment) => {
    setEditingId(comment.id);
    setEditText(comment.text);
    setConfirmDeleteId(null);
  }, []);

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex flex-col p-0 gap-0 [&>button]:hidden',
          isMobile ? 'max-h-[75dvh] rounded-t-xl' : 'w-80',
        )}
      >
        <SheetHeader className="flex-none border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm font-semibold">
              {t('rfqs.comments.title')}
              {comments.length > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                  ({comments.length})
                </span>
              )}
            </SheetTitle>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded leading-none">
                {t('rfqs.comments.internalOnly')}
              </span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={onClose}>
                <X className="size-4" />
                <span className="sr-only">{t('rfqs.comments.closeAria')}</span>
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-8 animate-pulse">…</p>
          )}
          {!loading && comments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('rfqs.comments.empty')}
            </p>
          )}
          {!loading && comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isOwn={comment.authorId === user?.uid}
              isEditing={editingId === comment.id}
              editText={editText}
              onEditTextChange={setEditText}
              confirmingDelete={confirmDeleteId === comment.id}
              onStartEdit={() => startEdit(comment)}
              onSaveEdit={() => void handleSaveEdit(comment.id)}
              onCancelEdit={() => { setEditingId(null); setEditText(''); }}
              onRequestDelete={() => setConfirmDeleteId(comment.id)}
              onConfirmDelete={() => void handleDelete(comment.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              t={t}
            />
          ))}
          <div ref={listEndRef} />
        </div>

        <footer className="flex-none border-t px-4 py-3">
          <div className="flex gap-2 items-end">
            <Textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder={t('rfqs.comments.placeholder')}
              className="min-h-[56px] max-h-[120px] resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void handleSubmit();
              }}
            />
            <Button
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={!newText.trim() || submitting}
              className="shrink-0 h-9"
              title={t('rfqs.comments.add')}
            >
              <SendHorizontal className="size-4" />
              <span className="sr-only">{t('rfqs.comments.add')}</span>
            </Button>
          </div>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
