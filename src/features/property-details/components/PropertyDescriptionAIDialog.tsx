'use client';

/**
 * =============================================================================
 * PropertyDescriptionAIDialog — Preview + accept flow for AI-generated descriptions
 * =============================================================================
 *
 * Opens when the user clicks "Δημιουργία με AI" next to the property description
 * textarea. Runs a generation request on mount, shows the output in an editable
 * textarea, and lets the user Regenerate / Cancel / Accept.
 *
 * On Accept the parent receives the final (possibly edited) text and writes it
 * into the form state. The dialog itself never writes to Firestore — persistence
 * flows through the existing property mutation pipeline so field locking + audit
 * trail (ADR-195) stay intact.
 *
 * @module features/property-details/components/PropertyDescriptionAIDialog
 */

import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  usePropertyDescriptionGenerator,
  type DescriptionErrorKind,
} from '@/hooks/usePropertyDescriptionGenerator';

interface PropertyDescriptionAIDialogProps {
  isOpen: boolean;
  propertyId: string;
  locale?: 'el' | 'en';
  onAccept: (description: string) => void;
  onClose: () => void;
}

function errorI18nKey(kind: DescriptionErrorKind): string {
  switch (kind) {
    case 'rateLimit':
      return 'aiDescriptionDialog.errorRateLimit';
    case 'unauthorized':
      return 'aiDescriptionDialog.errorUnauthorized';
    case 'network':
    case 'generic':
    default:
      return 'aiDescriptionDialog.errorGeneric';
  }
}

export function PropertyDescriptionAIDialog({
  isOpen,
  propertyId,
  locale = 'el',
  onAccept,
  onClose,
}: PropertyDescriptionAIDialogProps) {
  const { t } = useTranslation(['properties-detail']);
  const { description, isGenerating, errorKind, generate, reset } = usePropertyDescriptionGenerator();
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (isOpen && !isGenerating && description === null && errorKind === null) {
      void generate(propertyId, locale);
    }
  }, [isOpen, isGenerating, description, errorKind, generate, propertyId, locale]);

  useEffect(() => {
    if (description !== null) {
      setDraft(description);
    }
  }, [description]);

  useEffect(() => {
    if (!isOpen) {
      reset();
      setDraft('');
    }
  }, [isOpen, reset]);

  const handleRegenerate = () => {
    reset();
    setDraft('');
    void generate(propertyId, locale);
  };

  const handleAccept = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    onAccept(trimmed);
  };

  const canAccept = !isGenerating && draft.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {t('aiDescriptionDialog.title')}
          </DialogTitle>
          <DialogDescription>{t('aiDescriptionDialog.subtitle')}</DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          {isGenerating ? (
            <output
              aria-live="polite"
              className="flex h-40 items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('aiDescriptionDialog.loading')}
            </output>
          ) : (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('aiDescriptionDialog.editPlaceholder')}
              className="h-40 resize-none text-sm"
              autoFocus
            />
          )}

          {errorKind && (
            <p role="alert" className="text-sm text-destructive">
              {t(errorI18nKey(errorKind))}
            </p>
          )}
        </section>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleRegenerate}
            disabled={isGenerating}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('aiDescriptionDialog.regenerate')}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isGenerating}>
            {t('aiDescriptionDialog.cancel')}
          </Button>
          <Button type="button" onClick={handleAccept} disabled={!canAccept}>
            {t('aiDescriptionDialog.accept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
