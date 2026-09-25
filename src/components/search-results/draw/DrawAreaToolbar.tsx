'use client';

/**
 * # Η ΖΩΝΗ ΣΧΕΔΙΑΣΗΣ — οδηγία, μέτρηση, Αναίρεση / Ακύρωση / Εφαρμογή (ADR-885)
 *
 * Κάθεται στη θέση του chip ορίου (`MapAreaControl` → `regionChip`) όσο διαρκεί η
 * σχεδίαση: ένα χειριστήριο τη φορά πάνω από τον χάρτη.
 *
 * 🔑 **Η μέτρηση είναι `role="status"`** — ο αναγνώστης οθόνης ακούει «12 αγγελίες μέσα»
 * χωρίς να του κλέψει την εστίαση, και το ίδιο για τα «δεν σχηματίζει περιοχή».
 * 🔑 **`Escape` = Ακύρωση**, μέσω της ΜΙΑΣ στοίβας στρώσεων (`useEscapeKey`, ADR-711).
 */

import React from 'react';
import { Check, Undo2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { DrawAreaNotice, DrawAreaSession } from '@/hooks/listings/useDrawAreaSession';
import type { DrawnPreviewCount } from '@/lib/listings/listing-drawn-preview';

type Translate = ReturnType<typeof useTranslation>['t'];

/** Τι λέει η ζώνη τώρα: η ειδοποίηση προηγείται, μετά η μέτρηση, αλλιώς η οδηγία. */
function drawStatus(t: Translate, notice: DrawAreaNotice | null, count: DrawnPreviewCount | null): string {
  if (notice === 'full') return t('search-region:draw.full');
  if (notice === 'rejected') return t('search-region:draw.rejected');
  if (count === null) return t('search-region:draw.instruction');
  return count.exact
    ? t('search-region:draw.matches', { count: count.count })
    : t('search-region:draw.matchesAtLeast', { count: count.count });
}

interface DrawAreaToolbarProps {
  readonly session: DrawAreaSession;
  readonly previewCount: DrawnPreviewCount | null;
  readonly onApply: () => void;
}

export function DrawAreaToolbar({ session, previewCount, onApply }: DrawAreaToolbarProps) {
  const { t, isNamespaceReady } = useTranslation(['search-region']);
  const iconSizes = useIconSizes();
  useEscapeKey(session.cancel, session.active, 'search-results/draw-area');

  const status = drawStatus(t, session.notice, previewCount);
  const canUndo = session.shapes.length > 0 || session.trace.length > 0;

  return isNamespaceReady ? (
    <section
      role="toolbar"
      aria-label={t('search-region:draw.toolbar')}
      className="pointer-events-auto flex max-w-full flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-md"
    >
      <p role="status" className="text-center text-sm text-foreground">{status}</p>

      {session.shapes.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-1">
          {session.shapes.map((shape, index) => (
            // Ταυτότητα από τη γεωμετρία: δύο σχήματα με ίδια πρώτη κορυφή ΚΑΙ ίδιο πλήθος δεν σχεδιάζονται.
            <li key={`${shape[0].lat}:${shape[0].lng}:${shape.length}`}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => session.removeShape(index)}
                aria-label={t('search-region:draw.removeShape', { index: index + 1 })}
              >
                {index + 1}
                <X className={iconSizes.sm} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={session.undo} disabled={!canUndo}>
          <Undo2 className={iconSizes.sm} aria-hidden="true" />
          {t('search-region:draw.undo')}
        </Button>
        {session.canCloseTrace && (
          <Button type="button" size="sm" variant="outline" onClick={session.closeTrace}>
            {t('search-region:draw.closeShape')}
          </Button>
        )}
        <Button type="button" size="sm" variant="secondary" onClick={session.cancel}>
          {t('search-region:draw.cancel')}
        </Button>
        <Button type="button" size="sm" onClick={onApply} disabled={session.preview === null}>
          <Check className={iconSizes.sm} aria-hidden="true" />
          {t('search-region:draw.apply')}
        </Button>
      </p>
    </section>
  ) : null;
}
