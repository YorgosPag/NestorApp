'use client';

/**
 * @fileoverview **ΣΤΗΛΗ ΠΟΥ ΣΕΡΝΕΤΑΙ ΚΑΙ ΚΡΥΒΕΤΑΙ** — η μηχανική + το κουμπί, κοινά σε κάθε «σκηνή | στήλη».
 * @related `./resizable` · `./resizable-persistence` (**πότε** γράφεται) · `./resizable-column-store` (**τι** · **πού**) ·
 *   καταναλωτές: `spatial-tour/viewer/TourViewerSplit` (ADR-884) · `read-only-viewer/components/ViewerInspectorSplit`
 *   (ADR-840 Σ3)
 * @module components/ui/collapsible-column
 *
 * Ζούσε γραμμένο μέσα στο `TourViewerSplit`· ο επιθεωρητής ακινήτων χρειάστηκε **ακριβώς** την ίδια μηχανική
 * (N.0.2 · CHECK 3.28), άρα έγινε ένα σημείο. Μένει στον καταναλωτή μόνο **πού** κάθεται το κουμπί και τι λέει.
 *
 * 🔑 Κατά το σύρσιμο (~60/δευτ.) μόνο `ref`· render **μόνο** όταν αλλάζει το «κρυμμένη;».
 * 🔑 Σύρσιμο κάτω από το ελάχιστο ⇒ σύμπτυξη (`collapsible`), ίδια κατάσταση με το κουμπί — ένας κάτοχος, το panel.
 */

import { useCallback, useRef, useState } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { usePanelRef, type PanelSize } from './resizable';
import { usePanelWidthPersistence, type PanelWidthPersistence } from './resizable-persistence';
import type { ColumnLayout, ColumnLayoutStore } from './resizable-column-store';

export interface CollapsibleColumn {
  /** Η αποθηκευμένη διάταξη κατά την άφιξη — `defaultSize` και στόχος του διπλού κλικ. */
  readonly initial: ColumnLayout;
  readonly collapsed: boolean;
  readonly panel: ReturnType<typeof usePanelRef>;
  readonly persistence: PanelWidthPersistence;
  /** Στο `onResize` του panel της στήλης. */
  readonly onResize: (size: PanelSize) => void;
  /** Εμφάνιση στο αποθηκευμένο πλάτος ‖ απόκρυψη. */
  readonly toggle: () => void;
}

export function useCollapsibleColumn(store: ColumnLayoutStore): CollapsibleColumn {
  // Διαβάζεται ΜΙΑ φορά: το `defaultSize` είναι αρχική τιμή.
  const [initial] = useState(store.read);
  const [collapsed, setCollapsed] = useState(initial.collapsed);
  const collapsedNow = useRef(initial.collapsed);
  const panel = usePanelRef();
  const persistence = usePanelWidthPersistence(store.write, initial.width);

  const onResize = useCallback((size: PanelSize) => {
    persistence.onResize(size);
    const now = size.inPixels < 1;
    if (now === collapsedNow.current) return;
    collapsedNow.current = now;
    setCollapsed(now);
  }, [persistence]);

  const toggle = useCallback(() => {
    const handle = panel.current;
    if (handle === null) return;
    if (handle.isCollapsed()) handle.resize(store.read().width);
    else handle.collapse();
    persistence.persistSoon();
  }, [panel, persistence, store]);

  return { initial, collapsed, panel, persistence, onResize, toggle };
}

export interface ColumnToggleButtonProps {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
  /** Η ταυτότητα του panel της στήλης (`aria-controls`). */
  readonly controls: string;
  /** Η ετικέτα, ήδη μεταφρασμένη, για την τρέχουσα κατάσταση. */
  readonly label: string;
  /** Η θέση του κουμπιού πάνω στη σκηνή. */
  readonly className?: string;
}

export function ColumnToggleButton({ collapsed, onToggle, controls, label, className }: ColumnToggleButtonProps) {
  const Icon = collapsed ? PanelRightOpen : PanelRightClose;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" size="icon" variant="secondary" className={cn('absolute shadow', className)}
          onClick={onToggle} aria-label={label} aria-expanded={!collapsed} aria-controls={controls}>
          <Icon aria-hidden className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
