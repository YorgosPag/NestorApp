'use client';

/**
 * ADR-748 Φάση 3 — Ο ΔΕΙΚΤΗΣ «Χ ΚΡΥΜΜΕΝΑ» **ΚΑΙ Η ΕΠΑΝΑΦΟΡΑ ΜΕ ΕΝΑ ΚΛΙΚ**.
 *
 * Α-3 (μάθημα Office 2000, §6.7): η απόκρυψη επιτρέπεται· η **σιωπηλή**
 * απόκρυψη όχι. Τα «Adaptive Menus» του Office 2000 απέτυχαν παταγωδώς για δύο
 * λόγους — κατέστρεψαν την προβλεψιμότητα και σκότωσαν την ανακάλυψη. Η
 * διαφορά εδώ είναι **ακριβώς** αυτό το κουμπί: ο χρήστης ξέρει ανά πάσα στιγμή
 * ότι κάτι λείπει, πόσο, και πώς επιστρέφει.
 *
 * ⚠️ ΔΕΝ ΕΙΝΑΙ ΕΤΙΚΕΤΑ — ΕΙΝΑΙ ΚΟΥΜΠΙ. Ένας αριθμός που δεν επαναφέρει τίποτα
 * είναι χειρότερος από το τίποτα: λέει στον χρήστη ότι έχασε κάτι και τον
 * αφήνει να το ψάχνει (η αδυναμία **Υ-2** του Revit, §8).
 *
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ: τον χρειάζονται **δύο** ανεξάρτητες περιοχές — ο
 * διακόπτης του header (στοιχεία sidebar) και το dashboard (πλακίδια). Δύο
 * αντίγραφα θα ήταν sibling clone με δύο ευκαιρίες να αποκλίνουν σε κείμενο,
 * σε συμπεριφορά και σε προσβασιμότητα (κανόνας N.18 / CHECK 3.28).
 *
 * CHECK 3.23: κανένα native `title=` — ο υποβοηθούμενος χρήστης δεν διαβάζει
 * tooltip, γι' αυτό υπάρχει **και** `aria-label`.
 */

import React from 'react';
import { useTranslation } from '@/i18n';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface HiddenItemsBadgeProps {
  /** Πόσα έκρυψε η ενεργή δουλειά. Στο 0 δεν εμφανίζεται τίποτα. */
  count: number;
  /** Επαναφορά σε «Όλες οι δουλειές» — **ένα** κλικ, πάντα. */
  onRestore: () => void;
  className?: string;
}

export function HiddenItemsBadge({ count, onRestore, className }: HiddenItemsBadgeProps) {
  const { t } = useTranslation('navigation');

  // Ένα «0 κρυμμένα» θα ήταν θόρυβος: ο δείκτης υπάρχει μόνο όταν έχει νόημα.
  if (count <= 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onRestore}
          aria-label={t('jobs.switch.restoreAll')}
          className={[
            'rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground',
            'transition-colors hover:bg-accent hover:text-accent-foreground',
            className ?? '',
          ].join(' ')}
        >
          {t('jobs.switch.hiddenCount', { count })}
        </button>
      </TooltipTrigger>
      <TooltipContent>{t('jobs.switch.restoreAll')}</TooltipContent>
    </Tooltip>
  );
}
