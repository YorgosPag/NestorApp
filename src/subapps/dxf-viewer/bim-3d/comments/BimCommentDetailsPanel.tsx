'use client';

/**
 * ADR-366 Phase 9 / C.2 — BIM comment details right-side drawer.
 * Shows comment header, content, attachments, replies, and FSM transition actions.
 * Subscribes to replies from BimCommentsStore on mount.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/hooks/useAuth';
import {
  useBimCommentsStore,
} from '../stores/BimCommentsStore';
import { BimCommentsService } from './bim-comments.service';
import { CommentBadgeIcon } from './CommentBadgeIcon';
import { CommentReplyInput } from './CommentReplyInput';
import { CommentAttachmentLightbox } from './CommentAttachmentLightbox';
import { getAvailableTransitions } from './comment-status-fsm';
import type { CommentStatus } from './bim-comment-types';

const ADMIN_ROLES = new Set(['company_admin', 'project_manager']);

const STATUS_ACTION_KEY: Record<CommentStatus, string> = {
  in_review: 'comments.actions.markInReview',
  resolved:  'comments.actions.resolve',
  open:      'comments.actions.reopen',
  archived:  'comments.actions.archive',
};

interface BimCommentDetailsPanelProps {
  readonly commentId: string;
  readonly companyId: string;
}

export function BimCommentDetailsPanel({ commentId, companyId }: BimCommentDetailsPanelProps) {
  const { t } = useTranslation('bim3d');
  const { user } = useAuth();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const comment = useBimCommentsStore((s) => s.comments[commentId]);
  const replies = useBimCommentsStore((s) => s.replies[commentId] ?? []);
  const closePanel = useBimCommentsStore((s) => s.selectComment);

  useEffect(() => {
    return useBimCommentsStore.getState().subscribeToReplies(commentId);
  }, [commentId]);

  if (!comment) return null;

  const isAuthorOrAdmin =
    user?.uid === comment.authorId || ADMIN_ROLES.has(user?.globalRole ?? '');

  const availableTransitions = getAvailableTransitions(comment.status, isAuthorOrAdmin);

  async function handleTransition(to: CommentStatus): Promise<void> {
    await BimCommentsService.transitionStatus(commentId, comment.status, to, isAuthorOrAdmin);
  }

  async function handleReply(content: string, mentionedIds: readonly string[]): Promise<void> {
    await BimCommentsService.createReply({
      commentId,
      companyId,
      authorId: user?.uid ?? '',
      authorName: user?.displayName ?? user?.email ?? '',
      content,
      mentionedUserIds: mentionedIds,
    });
  }

  const attachmentImages = comment.attachments.map((a) => ({ url: a.url, name: a.name }));

  return (
    <aside
      className="flex h-full w-72 flex-col overflow-hidden border-l border-border bg-background"
      aria-label={t('comments.details.close')}
    >
      <CommentDetailsPanelHeader
        comment={comment}
        availableTransitions={availableTransitions}
        onTransition={handleTransition}
        onClose={() => closePanel(null)}
        t={t}
      />

      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-sm text-foreground">{comment.content}</p>

        <AnchorBadge type={comment.anchor.type} t={t} />

        {attachmentImages.length > 0 && (
          <section className="mt-4" aria-label={t('comments.details.attachments')}>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {t('comments.details.attachments')}
            </p>
            <ul className="flex flex-wrap gap-2">
              {attachmentImages.map((img, i) => (
                <li key={img.url}>
                  <button type="button" onClick={() => setLightboxIndex(i)}>
                    <img
                      src={img.url}
                      alt={img.name}
                      className="h-16 w-16 rounded-md object-cover hover:ring-2 hover:ring-primary"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-4" aria-label={t('comments.details.replies')}>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t('comments.details.replies')} ({replies.length})
          </p>
          <ul className="flex flex-col gap-3">
            {replies.map((r) => (
              <li key={r.id} className="rounded-md border border-border bg-muted/20 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{r.authorName}</span>
                  <span className="text-xs text-muted-foreground">{r.updatedAt}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.content}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="border-t border-border p-3">
        <CommentReplyInput onSubmit={handleReply} />
      </div>

      {lightboxIndex !== null && (
        <CommentAttachmentLightbox
          images={attachmentImages}
          currentIndex={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </aside>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface CommentDetailsPanelHeaderProps {
  readonly comment: ReturnType<typeof useBimCommentsStore.getState>['comments'][string];
  readonly availableTransitions: readonly CommentStatus[];
  readonly onTransition: (to: CommentStatus) => Promise<void>;
  readonly onClose: () => void;
  readonly t: (key: string) => string;
}

function CommentDetailsPanelHeader({
  comment,
  availableTransitions,
  onTransition,
  onClose,
  t,
}: CommentDetailsPanelHeaderProps) {
  return (
    <header className="flex flex-col gap-2 border-b border-border p-3">
      <div className="flex items-center gap-2">
        <CommentBadgeIcon type={comment.type} status={comment.status} size={18} />
        <span className="flex-1 text-sm font-medium">
          {t(`comments.type.${comment.type}`)}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground"
          onClick={onClose}
          aria-label={t('comments.details.close')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{comment.authorName}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
          {t(`comments.status.${comment.status === 'in_review' ? 'inReview' : comment.status}`)}
        </span>
      </div>

      {availableTransitions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {availableTransitions.map((to) => (
            <Button
              key={to}
              type="button"
              size="sm"
              variant="outline"
              className="h-6 text-xs"
              onClick={() => void onTransition(to)}
            >
              {t(STATUS_ACTION_KEY[to])}
            </Button>
          ))}
        </div>
      )}
    </header>
  );
}

function AnchorBadge({ type, t }: { type: 'entity' | 'world'; t: (k: string) => string }) {
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      {t(`comments.anchor.${type}`)}
    </p>
  );
}
