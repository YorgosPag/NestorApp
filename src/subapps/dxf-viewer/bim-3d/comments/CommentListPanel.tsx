'use client';

/**
 * ADR-366 Phase 9 / C.2 — Floating3DPanel "Σχόλια" tab content.
 * Filter bar, search, comment list, and new-comment inline form.
 * Mounts project subscription via BimCommentsStore.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/auth/hooks/useAuth';
import { useProjectHierarchyOptional } from '../../contexts/ProjectHierarchyContext';
import {
  useBimCommentsStore,
  selectFilteredComments,
} from '../stores/BimCommentsStore';
import { BimCommentsService } from './bim-comments.service';
import { CommentBadgeIcon } from './CommentBadgeIcon';
import type { BimComment, CommentStatus, CommentType } from './bim-comment-types';

type StatusFilter = 'all' | CommentStatus;

const COMMENT_TYPES: readonly CommentType[] = ['issue', 'question', 'suggestion', 'approval', 'info'];
const STATUS_FILTERS: readonly StatusFilter[] = ['all', 'open', 'in_review', 'resolved', 'archived'];

export function CommentListPanel() {
  const { t } = useTranslation('bim3d');
  const { user } = useAuth();
  const hierarchy = useProjectHierarchyOptional();
  const projectId = hierarchy?.selectedProject?.id ?? '';
  const companyId = user?.companyId ?? '';

  const comments = useBimCommentsStore((s) => s.comments);
  const filters = useBimCommentsStore((s) => s.filters);
  const setFilters = useBimCommentsStore((s) => s.setFilters);
  const selectComment = useBimCommentsStore((s) => s.selectComment);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    return useBimCommentsStore.getState().subscribeToProject(projectId);
  }, [projectId]);

  useEffect(() => {
    setFilters(statusFilter === 'all' ? { status: undefined } : { status: statusFilter });
  }, [statusFilter, setFilters]);

  const filtered = selectFilteredComments(comments, filters);

  return (
    <section className="flex flex-col gap-0" aria-label={t('comments.panelTitle')}>
      <div className="flex flex-wrap gap-1 border-b border-white/10 px-2 py-1.5">
        {STATUS_FILTERS.map((sf) => (
          <button
            key={sf}
            type="button"
            onClick={() => setStatusFilter(sf)}
            className={[
              'rounded px-1.5 py-0.5 text-xs transition-colors',
              statusFilter === sf
                ? 'bg-primary/80 text-white'
                : 'text-white/50 hover:text-white/80',
            ].join(' ')}
          >
            {t(`comments.filter.${sf === 'in_review' ? 'inReview' : sf}`)}
          </button>
        ))}
      </div>

      <div className="border-b border-white/10 px-2 py-1.5">
        <Input
          type="search"
          placeholder={t('comments.searchPlaceholder')}
          value={filters.searchQuery ?? ''}
          onChange={(e) => setFilters({ searchQuery: e.target.value || undefined })}
          className="h-6 text-xs"
        />
      </div>

      <ul className="flex flex-col divide-y divide-white/10 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="px-3 py-4 text-center text-xs text-white/40">
            {t('comments.noComments')}
          </li>
        )}
        {filtered.map((c) => (
          <CommentCard
            key={c.id}
            comment={c}
            onClick={() => selectComment(c.id)}
            t={t}
          />
        ))}
      </ul>

      {showForm ? (
        <NewCommentForm
          companyId={companyId}
          projectId={projectId}
          userId={user?.uid ?? ''}
          userName={user?.displayName ?? user?.email ?? ''}
          onClose={() => setShowForm(false)}
          t={t}
        />
      ) : (
        <div className="border-t border-white/10 p-2">
          <Button
            type="button"
            size="sm"
            className="w-full text-xs"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t('comments.newComment')}
          </Button>
        </div>
      )}
    </section>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface CommentCardProps {
  readonly comment: BimComment;
  readonly onClick: () => void;
  readonly t: (key: string) => string;
}

function CommentCard({ comment, onClick, t }: CommentCardProps) {
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-start gap-2 px-2 py-2 text-left hover:bg-white/5"
        onClick={onClick}
      >
        <CommentBadgeIcon type={comment.type} status={comment.status} size={16} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-white/90">{comment.content}</p>
          <p className="text-xs text-white/40">
            {comment.authorName} · {t(`comments.status.${comment.status === 'in_review' ? 'inReview' : comment.status}`)}
          </p>
        </div>
      </button>
    </li>
  );
}

interface NewCommentFormProps {
  readonly companyId: string;
  readonly projectId: string;
  readonly userId: string;
  readonly userName: string;
  readonly onClose: () => void;
  readonly t: (key: string) => string;
}

function NewCommentForm({ companyId, projectId, userId, userName, onClose, t }: NewCommentFormProps) {
  const [type, setType] = useState<CommentType>('issue');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      await BimCommentsService.createComment({
        projectId,
        companyId,
        authorId: userId,
        authorName: userName,
        type,
        content: content.trim(),
        anchor: { type: 'world', position: { x: 0, y: 0, z: 0 } },
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-white/10 p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/80">{t('comments.newComment')}</span>
        <Button type="button" size="icon" variant="ghost" className="h-5 w-5 text-white/40" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Select value={type} onValueChange={(v) => setType(v as CommentType)}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COMMENT_TYPES.map((ct) => (
            <SelectItem key={ct} value={ct} className="text-xs">
              {t(`comments.type.${ct}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t('comments.placeholder')}
        rows={3}
        className="resize-none text-xs"
        disabled={submitting}
      />

      <div className="flex gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="flex-1 text-xs"
          onClick={onClose}
          disabled={submitting}
        >
          {t('comments.details.cancel')}
        </Button>
        <Button
          type="button"
          size="sm"
          className="flex-1 text-xs"
          onClick={() => void handleSubmit()}
          disabled={!content.trim() || submitting}
        >
          {t('comments.details.submit')}
        </Button>
      </div>
    </div>
  );
}
