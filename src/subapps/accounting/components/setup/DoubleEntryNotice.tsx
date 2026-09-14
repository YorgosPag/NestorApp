'use client';

/**
 * @fileoverview **Ειδοποίηση διπλογραφικών βιβλίων** — μία, για ΕΠΕ και ΑΕ.
 * @module subapps/accounting/components/setup/DoubleEntryNotice
 *
 * 🔴 **ΕΞΑΓΩΓΗ (N.0.2 · CHECK 3.28)**: ζούσε αυτούσια σε δύο ενότητες· βρέθηκε όταν η Α23
 * (ADR-841 §7) τις άγγιξε για το πεδίο ΓΕΜΗ. Έτοιμο κείμενο από τον γονέα (κυριολεκτικό κλειδί).
 *
 * 🎨 **Χρώματα από το `useSemanticColors` (ADR-770 · CHECK 3.38)**: το `text-primary` στο σκοτεινό θέμα
 * ταυτίζεται με το `--card` ⇒ αόρατο κείμενο. Ρόλος «info» = `bg.infoSubtle` + `text.info`.
 */

import { Info } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export function DoubleEntryNotice({ text }: { readonly text: string }) {
  const colors = useSemanticColors();
  return (
    <p
      className={cn('m-0 flex items-start gap-2 rounded-md border border-ring p-3 text-sm', colors.bg.infoSubtle, colors.text.info)}
      role="status"
    >
      <Info aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />
      {text}
    </p>
  );
}
