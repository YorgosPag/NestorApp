'use client';

/**
 * # ΤΟ CHIP ΤΟΥ ΟΡΙΟΥ — ΕΝΑ ΧΕΙΡΙΣΤΗΡΙΟ, ΔΥΟ ΠΗΓΕΣ ΠΕΡΙΟΧΗΣ (ADR-883 · ADR-885)
 *
 * Όνομα + «Αφαίρεση ορίου», πάνω από τον χάρτη. Το ίδιο πλαίσιο για το **όριο δήμου** και
 * για το **σχήμα που σχεδίασε** ο επισκέπτης — όπως στη Zillow, όπου το σχεδιασμένο
 * σχήμα συμπεριφέρεται ακριβώς όπως το διοικητικό όριο. Ό,τι διαφέρει (γενεαλογία,
 * «Επεξεργασία») έρχεται ως `children`.
 */

import React from 'react';
import { X } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';

interface BoundaryChipFrameProps {
  readonly label: string;
  readonly title: string;
  readonly onRemove: () => void;
  readonly children?: React.ReactNode;
}

export function BoundaryChipFrame({ label, title, onRemove, children }: BoundaryChipFrameProps) {
  const { t } = useTranslation(['search-region']);
  const iconSizes = useIconSizes();

  return (
    <section
      aria-label={label}
      className="pointer-events-auto flex max-w-full flex-col items-center gap-1 rounded-2xl border border-border bg-card px-3 py-2 shadow-md"
    >
      <p className="flex max-w-full items-center gap-2 text-sm">
        <strong className="truncate font-semibold text-foreground">{title}</strong>
        <Button type="button" size="sm" variant="secondary" onClick={onRemove} className="shrink-0">
          <X className={iconSizes.sm} aria-hidden="true" />
          {t('search-region:boundary.remove')}
        </Button>
      </p>
      {children}
    </section>
  );
}
