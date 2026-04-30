'use client';

/**
 * ADR-336 — Weak-match disambiguation modal.
 *
 * Surfaces when the resolver returned `kind: 'weak'` (single-field overlap
 * with name/employer divergence). User picks one of:
 *   - Link to a candidate ("same person")
 *   - Create a new contact anyway ("different person, force create")
 *   - Cancel ("defer — I'll review later")
 */

import { AlertTriangle, Link2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { WeakMatchCandidate } from './types';

interface SignatoryDisambiguationModalProps {
  open: boolean;
  candidates: WeakMatchCandidate[];
  isSubmitting?: boolean;
  /** "Same person" — link to existing contact id. */
  onLink: (contactId: string) => void;
  /** "Different person — create new despite the overlap". */
  onCreateAnyway: () => void;
  /** "Defer — close without action". */
  onCancel: () => void;
}

const FIELD_BADGE_VARIANT: Record<'mobile' | 'email' | 'name', string> = {
  mobile: 'border-amber-500 text-amber-700 dark:text-amber-400',
  email: 'border-blue-500 text-blue-700 dark:text-blue-400',
  name: 'border-purple-500 text-purple-700 dark:text-purple-400',
};

export function SignatoryDisambiguationModal({
  open,
  candidates,
  isSubmitting = false,
  onLink,
  onCreateAnyway,
  onCancel,
}: SignatoryDisambiguationModalProps) {
  const { t } = useTranslation('quotes');

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {t('quotes.signatory.disambiguation.title')}
          </DialogTitle>
          <DialogDescription>
            {t('quotes.signatory.disambiguation.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {candidates.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('quotes.signatory.disambiguation.noCandidates')}
            </p>
          )}
          {candidates.map((c) => (
            <div
              key={c.contactId}
              className="rounded-md border border-amber-300 bg-amber-50/40 px-3 py-2 dark:border-amber-700 dark:bg-amber-950/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{c.displayName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.divergenceReason}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.matchedOn.map((field) => (
                      <Badge
                        key={field}
                        variant="outline"
                        className={`text-xs ${FIELD_BADGE_VARIANT[field]}`}
                      >
                        {t(`quotes.signatory.disambiguation.matchedOn.${field}`)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={isSubmitting}
                  onClick={() => onLink(c.contactId)}
                >
                  <Link2 className="mr-1 h-3.5 w-3.5" />
                  {t('quotes.signatory.disambiguation.linkButton')}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            <X className="mr-1 h-4 w-4" />
            {t('quotes.signatory.disambiguation.cancelButton')}
          </Button>
          <Button onClick={onCreateAnyway} disabled={isSubmitting}>
            <UserPlus className="mr-1 h-4 w-4" />
            {t('quotes.signatory.disambiguation.createAnywayButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
