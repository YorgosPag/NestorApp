'use client';

/**
 * ADR-366 Phase 9 / C.2 — Full-screen image lightbox for BIM comment attachments.
 * Arrow keys to navigate, Escape to close, click backdrop to close.
 *
 * ADR-364 §10.14 — ESC ownership. This component used to own a raw global
 * `window` keydown listener, and was never classified by §10.5 (it appears in
 * none of the 42 buckets). It now uses BOTH halves of the sanctioned stack,
 * deliberately — they cover different failure modes:
 *
 *  1. **Radix Dialog (GROUP B)** — the a11y shell. Gives focus trap, focus
 *     restore to the trigger thumbnail, `aria-modal` that is actually true,
 *     scroll lock and a portal. The previous hand-rolled `<div role="dialog"
 *     aria-modal="true">` claimed to be modal while leaving DOM focus on the
 *     thumbnail BEHIND it — so Tab walked the panel underneath, which is a
 *     WAI-ARIA APG violation, not a style preference.
 *  2. **`useEscapeHandler` at MODAL_DIALOG (1000)** — the priority guarantee.
 *     Radix listens on `document` capture; the bus listens on `window` capture
 *     and therefore ALWAYS runs first. With a 3D element selected, the composite
 *     `canvas/fallback-deselect` at DRAFT_POLYGON (400) reports `canHandle` true,
 *     consumes the press and calls `stopImmediatePropagation` — Radix would never
 *     see the key and the lightbox would stay open. Registering above it is what
 *     makes ESC reach this overlay at all.
 *
 * Radix's own ESC is left enabled as the fall-back rung (N.7.2 #4,
 * belt-and-suspenders): the bus is the primary path, Radix catches the case
 * where the bus is somehow not mounted. Only one of them can ever fire — a bus
 * consumption cuts the Radix listener off by specification.
 *
 * `allowWhenEditable` is deliberately NOT set, and with the focus trap that is
 * now a structural guarantee rather than an observation: this overlay contains
 * no INPUT / TEXTAREA / contenteditable, and the trap keeps focus inside it, so
 * `isEditableFocus()` cannot be true while it is mounted. The sibling
 * `CommentReplyInput` textarea can no longer hold focus underneath it.
 *
 * Arrow keys stay LOCAL (§10.2 — no competitor for them) and now ride the
 * dialog subtree's `onKeyDown` instead of a global listener, so they cannot
 * fire while some other part of the app has focus. Same split as
 * `bim-3d/animation/use-waypoint-drag-interaction.ts` (#3).
 */

import { useTranslation } from 'react-i18next';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useEscapeHandler, ESC_PRIORITY } from '../../systems/escape-bus';

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

  // Mount-scoped: the parent renders this only while `lightboxIndex !== null`,
  // so the component's lifetime IS the gate. Documenting that explicitly because
  // an ungated `canHandle` on a permanently mounted handler is the §10.12
  // regression — same reasoning as `ui/ribbon/components/RibbonContextMenu.tsx`.
  useEscapeHandler({
    id: 'bim-3d/comment-attachment-lightbox',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => true,
    handle: () => {
      onClose();
      return true;
    },
  });

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'ArrowLeft' && hasPrev) {
      e.preventDefault();
      onIndexChange(currentIndex - 1);
    } else if (e.key === 'ArrowRight' && hasNext) {
      e.preventDefault();
      onIndexChange(currentIndex + 1);
    }
  }

  if (!current) return null;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        size="fullscreen"
        hideCloseButton
        className="border-0 bg-transparent p-0 shadow-none"
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">
          {t('comments.details.attachmentViewer', {
            current: currentIndex + 1,
            total: images.length,
            name: current.name,
          })}
        </DialogTitle>

        {/* Clicking the empty area around the image closes, matching the
            pre-migration backdrop behaviour. */}
        <div
          className="flex h-full w-full items-center justify-center"
          onClick={onClose}
        >
          <div
            className="relative flex max-h-full max-w-full items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={current.url}
              alt={current.name}
              className="max-h-[85vh] max-w-[80vw] rounded-md object-contain"
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
                aria-label={t('comments.details.previousAttachment')}
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
                aria-label={t('comments.details.nextAttachment')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
