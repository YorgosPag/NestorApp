"use client";

/**
 * BimCommentsTab — inline preview of top-3 comments for a selected BIM entity.
 *
 * Reads from BimCommentsStore (ADR-366 C.2). Until C.2 is implemented,
 * useBimCommentsPreview returns [] and the tab renders the empty state.
 * ADR-366 C.4.Q5.
 */

import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---- Stub types until C.2 BimCommentsStore is implemented ----
interface CommentPreview {
  id: string;
  content: string;
  authorName: string;
  updatedAt: string;
  typeKey: string;
}

function useBimCommentsPreview(_entityId: string): readonly CommentPreview[] {
  // C.2 implementation wires the real BimCommentsStore here.
  return [];
}
// ---- End stub ----

interface BimCommentsTabProps {
  bimId: string;
}

export function BimCommentsTab({ bimId }: BimCommentsTabProps) {
  const { t } = useTranslation('bim3d');
  const comments = useBimCommentsPreview(bimId);
  const preview = comments.slice(0, 3);
  const extraCount = comments.length - preview.length;

  return (
    <div className="flex flex-col gap-3 p-4 text-sm">
      {preview.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-muted-foreground">{t('entityCard.comments.empty')}</p>
          <Button size="sm" variant="outline">
            {t('entityCard.comments.createNew')}
          </Button>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {preview.map((c) => (
              <li key={c.id} className="rounded-md border border-border bg-muted/20 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">{c.authorName}</span>
                  <span className="text-xs text-muted-foreground">{c.updatedAt}</span>
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
            <Button size="sm" variant="ghost" className="flex-1 text-xs">
              {t('entityCard.comments.seeAll')}
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-xs">
              {t('entityCard.comments.createNew')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
