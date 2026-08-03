'use client';

/**
 * ADR-750 Φ5 / ADR-344 — **ο ΕΝΑΣ διάλογος «Περισσότερα χρώματα…» της μπάρας πίνακα.**
 *
 * ## Γιατί υπάρχει (CHECK 3.28 / N.18)
 * Δύο χειριστήρια της ίδιας μπάρας ρωτούν το **ίδιο** πράγμα — «ποιο χρώμα;»: το μενού άξονα
 * (μελάνι / γέμισμα) και το μολύβι περιγραμμάτων. Γραμμένος δύο φορές, ο διάλογος ήταν
 * sibling clone που το CHECK 3.28 πιάνει **μέσα στο ίδιο commit**. Χειρότερα από το εύρημα
 * του εργαλείου είναι όμως το πραγματικό ρίσκο: δύο σημεία που μπορούν κάποτε να μάθουν
 * **διαφορετική** παλέτα, διαφορετικό πλάτος ή διαφορετική συμπεριφορά στο «Άκυρο» — δηλαδή
 * δύο απαντήσεις στο ίδιο ερώτημα, με μόνο μία ορατή στον χρήστη κάθε φορά.
 *
 * ## Τι ΔΕΝ κρατά — και γιατί
 * Το πρόχειρο (`draft`) μένει στον **γονιό**. Δεν είναι διακόσμηση: το μενού άξονα το ρωτά
 * και εκτός διαλόγου (ο χειριστής `Escape` κλείνει το μενού **μόνο** όταν δεν υπάρχει ανοιχτός
 * διάλογος). Αν το πρόχειρο ζούσε εδώ, εκείνη η απόφαση θα χρειαζόταν δεύτερο κανάλι πίσω
 * στον γονιό — δηλαδή την ίδια κατάσταση σε δύο κατόχους.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableColorDialog
 * @see ui/color/EnterpriseColorPicker.tsx — ο SSoT επιλογέας χρώματος (ADR-344)
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §19
 */

import React from 'react';
import { ColorDialogShell } from '../../color/ColorDialogShell';
import { EnterpriseColorPicker } from '../../color/EnterpriseColorPicker';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

export interface TableColorDialogProps {
  /** Το τρέχον πρόχειρο· `null` ⇒ ο διάλογος δεν υπάρχει καν στο δέντρο. */
  readonly draft: string | null;
  /** Ήδη μεταφρασμένος τίτλος — ο διάλογος δεν ξέρει ποιος τον άνοιξε. */
  readonly title: string;
  /** Ο χρήστης κινεί τον επιλογέα: το πρόχειρο ανήκει στον γονιό. */
  readonly onDraftChange: (hex: string) => void;
  /** Άκυρο / Escape / κλείσιμο — και τα τρία σημαίνουν το ίδιο. */
  readonly onCancel: () => void;
  /** Εφαρμογή: το πρόχειρο γίνεται επιλογή. Το κλείσιμο το κάνει ο γονιός. */
  readonly onApply: (hex: string) => void;
}

/**
 * Καθαρή παρουσίαση: καμία μνήμη, κανένα store, καμία γνώση του ποιος τον άνοιξε.
 */
export function TableColorDialog({
  draft, title, onDraftChange, onCancel, onApply,
}: TableColorDialogProps): React.ReactElement | null {
  if (draft === null) return null;

  return (
    <ColorDialogShell
      isOpen
      onClose={onCancel}
      title={title}
      dimBackdrop={false}
      maxWidthClass={PANEL_LAYOUT.LAYOUT_DIMENSIONS.PANEL_MAX_WIDTH_XL}
      showFooter
      onCancel={onCancel}
      onApply={() => onApply(draft)}
    >
      {/* Ο SSoT επιλογέας — ίδιες παλέτες/λειτουργίες με κάθε άλλο χρώμα του subapp (ADR-344). */}
      <EnterpriseColorPicker
        value={draft}
        onChange={onDraftChange}
        alpha={false}
        modes={['hex', 'rgb', 'hsl']}
        palettes={['dxf', 'semantic', 'material']}
        recent
        orientation="horizontal"
        className="border-0"
      />
    </ColorDialogShell>
  );
}
