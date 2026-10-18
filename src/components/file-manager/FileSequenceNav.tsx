'use client';

/**
 * ADR-912 §12.16 — **‹ 3 / 48 ›: πλοήγηση ΑΡΧΕΙΩΝ στην κεφαλίδα του θεατή**, αριστερά από τις ενέργειες.
 *
 * 🔑 **Αρχεία ≠ σελίδες**: τα βέλη **σελίδων** του PDF ζουν στη γραμμή του θεατή («Προηγούμενη σελίδα»)· αυτά ζουν στην
 *   κεφαλίδα και λένε «Προηγούμενο αρχείο». Δύο ζεύγη ‹ › με το ίδιο όνομα θα ήταν ένα αίνιγμα για τον αναγνώστη οθόνης.
 * 🔑 **Πλήκτρα ← / →** (Google Drive · Dropbox · iOS Files): όσο ο θεατής φαίνεται, εκτός αν το πλήκτρο το κατέχει
 *   κάποιος άλλος (`shouldGlobalShortcutYield`: πεδίο κειμένου, ανοιχτός διάλογος, splitter). Ακούει στη φάση **capture**
 *   και δηλώνει `preventDefault`, ώστε ο θεατής PDF να ξέρει ότι τα ←/→ καταναλώθηκαν (εκεί οι σελίδες = PgUp/PgDn).
 * 🔑 **Χωρίς swipe, επίτηδες**: ο καμβάς του PDF (`touch-none`) και της εικόνας κάνουν pan με σύρσιμο σε κάθε zoom —
 *   μια οριζόντια σάρωση θα ήταν ταυτόχρονα «μετακίνησε τη σελίδα» και «άλλαξε αρχείο».
 * 🔑 **Στα άκρα `aria-disabled`, όχι `disabled`**: το κουμπί μένει εστιάσιμο (WAI-ARIA APG) — το focus δεν πέφτει στο
 *   `body` τη στιγμή που φτάνεις στο τελευταίο αρχείο.
 */

import { useEffect, useRef, type RefObject } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { shouldGlobalShortcutYield } from '@/lib/a11y/keyboard-scope';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import type { FileSequence } from './hooks/useFileSequence';

const KEY_STEP: Readonly<Record<string, -1 | 1>> = { ArrowLeft: -1, ArrowRight: 1 };

/** Φαίνεται ο θεατής; (κρυμμένη καρτέλα με ανοιχτή επιλογή ⇒ όχι — τα πλήκτρα ανήκουν σε όποιον φαίνεται) */
function isShown(el: HTMLElement | null): boolean {
  if (!el?.isConnected) return false;
  return typeof el.checkVisibility === 'function' ? el.checkVisibility() : true;
}

function useSequenceKeys(navRef: RefObject<HTMLElement | null>, step: FileSequence['step']): void {
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_STEP[event.key];
      if (direction === undefined || event.defaultPrevented) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (shouldGlobalShortcutYield(event) || !isShown(navRef.current)) return;
      event.preventDefault();
      stepRef.current(direction);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [navRef]);
}

function StepButton({ direction, label, atEdge, onStep }: {
  direction: -1 | 1; label: string; atEdge: boolean; onStep: FileSequence['step'];
}) {
  const Icon = direction < 0 ? ChevronLeft : ChevronRight;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={label}
          aria-disabled={atEdge || undefined}
          data-file-sequence-step={direction < 0 ? 'previous' : 'next'}
          onClick={() => onStep(direction)}
          className="h-9 w-9 p-0 aria-disabled:opacity-40 md:h-7 md:w-7"
        >
          <Icon className="h-4 w-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function FileSequenceNav({ sequence }: { readonly sequence: FileSequence }) {
  const { t } = useTranslation(['files']);
  const colors = useSemanticColors();
  const navRef = useRef<HTMLElement>(null);
  useSequenceKeys(navRef, sequence.step);
  const position = { index: sequence.index + 1, total: sequence.total };

  return (
    <nav ref={navRef} aria-label={t('viewer.sequenceNav')} className="flex flex-shrink-0 items-center">
      <StepButton direction={-1} label={t('viewer.previousFile')} atEdge={sequence.previous === null} onStep={sequence.step} />
      <output aria-live="polite" className={cn('min-w-[3.25rem] text-center text-xs tabular-nums', colors.text.muted)}>
        <span aria-hidden>{t('viewer.sequencePosition', position)}</span>
        <span className="sr-only">{t('viewer.sequenceLabel', position)}</span>
      </output>
      <StepButton direction={1} label={t('viewer.nextFile')} atEdge={sequence.next === null} onStep={sequence.step} />
    </nav>
  );
}
