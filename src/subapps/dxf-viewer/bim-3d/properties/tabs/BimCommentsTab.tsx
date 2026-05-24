"use client";

/**
 * ADR-366 Phase 9 / C.2 — BIM entity comments preview tab.
 * Shows top-3 comments anchored to this entity. Opens BimCommentsStore
 * panel on "see all". "Create new" adds a world-anchored comment via service.
 */

import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/hooks/useAuth';
import { useProjectHierarchyOptional } from '../../../contexts/ProjectHierarchyContext';
import {
  useBimCommentsStore,
  selectCommentsByEntityId,
} from '../../stores/BimCommentsStore';
import { BimCommentsService } from '../../comments/bim-comments.service';
import { CommentBadgeIcon } from '../../comments/CommentBadgeIcon';

interface BimCommentsTabProps {
  readonly bimId: string;
}

export function BimCommentsTab({ bimId }: BimCommentsTabProps) {
  const { t } = useTranslation('bim3d');
  const { user } = useAuth();
  const hierarchy = useProjectHierarchyOptional();
  const projectId = hierarchy?.selectedProject?.id ?? '';
  const companyId = user?.companyId ?? '';

  const comments = useBimCommentsStore((s) => s.comments);
  const openPanel = useBimCommentsStore((s) => s.openPanel);
  const selectComment = useBimCommentsStore((s) => s.selectComment);

  const entityComments = selectCommentsByEntityId(comments, bimId);
  const preview = entityComments.slice(0, 3);
  const extraCount = entityComments.length - preview.length;

  async function handleCreateNew(): Promise<void> {
    if (!projectId || !companyId || !user?.uid) return;
    const comment = await BimCommentsService.createComment({
      projectId,
      companyId,
      authorId: user.uid,
      authorName: user.displayName ?? user.email ?? '',
      type: 'issue',
      content: '',
      anchor: {
        type: 'entity',
        entityId: bimId,
        position: { x: 0, y: 0, z: 0 },
      },
    });
    openPanel();
    selectComment(comment.id);
  }

  return (
    <div className="flex flex-col gap-3 p-4 text-sm">
      {preview.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-muted-foreground">{t('entityCard.comments.empty')}</p>
          <Button size="sm" variant="outline" onClick={() => void handleCreateNew()}>
            {t('entityCard.comments.createNew')}
          </Button>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {preview.map((c) => (
              <li
                key={c.id}
                className="cursor-pointer rounded-md border border-border bg-muted/20 p-2 hover:bg-muted/40"
                onClick={() => { openPanel(); selectComment(c.id); }}
              >
                <div className="flex items-center gap-2">
                  <CommentBadgeIcon type={c.type} status={c.status} size={14} />
                  <span className="text-xs font-medium text-foreground">{c.authorName}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{c.updatedAt}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.content}</p>
              </li>
            ))}
          </ul>

          {extraCount > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              {t('entityCard.comments.previewMore', { count: extraCount })}
            </p>
          )}

          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="flex-1 text-xs" onClick={openPanel}>
              {t('entityCard.comments.seeAll')}
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => void handleCreateNew()}>
              {t('entityCard.comments.createNew')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
