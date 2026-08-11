'use client';

/**
 * **Η ΓΡΑΜΜΗ ΤΗΣ ΣΤΕΝΗΣ ΟΘΟΝΗΣ** — το «πίσω» του drill-down και η πόρτα του βοηθητικού
 * πάνελ. ADR-777 §8.20 · SPEC-777D §26.8.
 *
 * 🔑 **Αποδίδεται ΠΑΝΤΑ και κρύβεται με `md:hidden`** — ποτέ «εμφανίζεται μόλις μετρηθεί
 * στενή οθόνη». Το μάθημα είναι πληρωμένο στο §26.7: χρώμιο που προσγειώνεται μετά την
 * ενυδάτωση **σπρώχνει** το περιεχόμενο, δηλαδή γεννά ακριβώς τη μετατόπιση που ολόκληρος
 * ο σχεδιασμός αποφεύγει (Α19: `CLS < 0,1`).
 *
 * 🔑 **Το «πίσω» δεν είναι διακόσμηση του πίσω κουμπιού του τηλεφώνου — είναι ο ορατός του
 * αδελφός.** Το NN/g το λέει για τα φύλλα και ισχύει το ίδιο εδώ: *«accessibility requires
 * visible, tappable dismiss options»*. Όποιος δεν έχει πίσω κουμπί υλικού (desktop με στενό
 * παράθυρο, αναγνώστης οθόνης) χρειάζεται **ορατό** δρόμο επιστροφής, και οι δύο δρόμοι
 * καταλήγουν στην **ίδια** ταυτοδύναμη πράξη.
 */

import React from 'react';
import { ChevronLeft, PanelBottom } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ViewerNarrowBarProps {
  /** Το όνομα του επιλεγμένου ακινήτου — **δεδομένο**, όχι ετικέτα· μένει αμετάφραστο. */
  readonly title?: string;
  /** Επιστροφή στη λίστα. **Οφείλει να είναι ταυτοδύναμη** — τη μοιράζεται με το πίσω κουμπί. */
  readonly onBack: () => void;
  readonly onShowDetails: () => void;
}

export function ViewerNarrowBar({ title, onBack, onShowDetails }: ViewerNarrowBarProps) {
  const { t } = useTranslation(['properties-viewer']);
  const iconSizes = useIconSizes();

  return (
    <nav
      aria-label={t('properties-viewer:viewer.narrow.backToList')}
      className="flex shrink-0 items-center gap-1 border-b border-border px-1 py-1 md:hidden"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onBack}
        aria-label={t('properties-viewer:viewer.narrow.backToList')}
      >
        <ChevronLeft className={iconSizes.sm} aria-hidden="true" />
      </Button>

      {/* `truncate` + `min-w-0`: ένα μακρύ όνομα ακινήτου δεν επιτρέπεται να σπρώξει το
          κουμπί των στοιχείων εκτός οθόνης — εκεί είναι ο **μόνος** δρόμος προς αυτά. */}
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{title}</span>

      <Button type="button" variant="ghost" size="sm" onClick={onShowDetails} className="shrink-0">
        <PanelBottom className={`${iconSizes.sm} mr-1`} aria-hidden="true" />
        {t('properties-viewer:viewer.narrow.showDetails')}
      </Button>
    </nav>
  );
}
