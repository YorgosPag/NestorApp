'use client';

/**
 * 🔘 **ΤΟ ΚΟΥΜΠΙ ΤΗΣ ΓΡΑΜΜΗΣ ΕΡΓΑΛΕΙΩΝ ΘΕΑΤΗ** — modal φωτογραφίας και πάνελ προεπισκόπησης (ADR-899 §9 θέματα 3 & 4).
 *
 * Μετακινήθηκε από το `PhotoPreviewModal` (ήταν ιδιωτικό `ToolbarButton`) όταν το πάνελ χρειάστηκε το ίδιο: πριν, τα κουμπιά
 * του πάνελ **δεν είχαν όνομα** για τον αναγνώστη οθόνης, ούτε tooltip.
 *
 * ♿ `aria-disabled`, ΟΧΙ `disabled` (WAI-ARIA APG, μοτίβο Toolbar): ένα `disabled` κουμπί που κρατά την εστίαση την πετά
 * στο `<body>` — μετρημένο στο θέμα 4 (Enter στο «Επόμενη» στο 3/4 ⇒ εστίαση έξω από το dialog). Το ανενεργό μένει
 * εστιάσιμο και ο φρουρός κάνει το πάτημα no-op. Tooltip του design system — όχι `title=` (CHECK 3.23).
 * Η ετικέτα είναι **μία** (όνομα + tooltip): ό,τι λέει το tooltip είναι αυτό που ακούει ο αναγνώστης οθόνης.
 *
 * ⛔ Διαφέρει σκόπιμα από το `CompactToolbar/ToolbarIconButton` (ADR-823): εκείνο χρωματίζει ανά δράση και απενεργοποιεί
 * με `disabled` — άλλο σχήμα.
 *
 * @module components/shared/media/viewer/ViewerToolbarButton
 */

import '@/lib/design-system';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';

export interface ViewerToolbarButtonProps {
  /** Προσβάσιμο όνομα **και** κείμενο tooltip. */
  readonly label: string;
  readonly icon: LucideIcon;
  readonly onClick: () => void;
  /** Ανενεργό που μένει εστιάσιμο (`aria-disabled` + φρουρός). */
  readonly disabled?: boolean;
}

export function ViewerToolbarButton({ label, icon: Icon, onClick, disabled = false }: ViewerToolbarButtonProps) {
  const iconSizes = useIconSizes();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={disabled ? undefined : onClick}
          aria-label={label}
          className={`${iconSizes.xl} p-0`}
          aria-disabled={disabled || undefined}
        >
          <Icon className={iconSizes.sm} aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
