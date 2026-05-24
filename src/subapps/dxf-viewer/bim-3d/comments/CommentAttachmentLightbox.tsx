'use client';

/**
 * ADR-366 Phase 9 / C.2 — Full-screen image lightbox for BIM comment attachments.
 * Arrow keys to navigate, Escape to close, click backdrop to close.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AttachmentImage {
  readonly url: string;
  readonly name: string;
}

interface CommentAttachmentLightboxProps {
  readonly images: readonly AttachmentImage[];
  readonly currentIndex: number;
  readonly onIndexChange: (index: number) => void;
  readonly onClose: () => void;
}

export function CommentAttachmentLightbox({
  images,
  currentIndex,
  onIndexChange,
  onClose,
}: CommentAttachmentLightboxProps) {
  const { t } = useTranslation('bim3d');
  const current = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onIndexChange(currentIndex - 1);
      if (e.key === 'ArrowRight' && hasNext) onIndexChange(currentIndex + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, hasPrev, hasNext, onClose, onIndexChange]);

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current.name}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={current.url}
          alt={current.name}
          className="max-h-[85vh] max-w-[85vw] rounded-md object-contain"
        />

        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute -right-4 -top-4"
          onClick={onClose}
          aria-label={t('comments.details.close')}
        >
          <X className="h-4 w-4" />
        </Button>

        {hasPrev && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute -left-12 top-1/2 -translate-y-1/2"
            onClick={() => onIndexChange(currentIndex - 1)}
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {hasNext && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute -right-12 top-1/2 -translate-y-1/2"
            onClick={() => onIndexChange(currentIndex + 1)}
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
