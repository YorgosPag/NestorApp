'use client';
/**
 * @fileoverview **Πλέγμα | panel λεπτομερειών, με συρόμενη διαχωριστική** — ο άνθρωπος δίνει στις λεπτομέρειες όσο
 *   πλάτος θέλει, και το πλάτος **θυμάται** (px ανά συσκευή).
 * @related ADR-912 §12.19 · `DetailsPeekPanel` (το panel) · `ListDetailsSplit` (ο μόνος καλών) ·
 *   `@/components/ui/resizable` (ο ΕΝΑΣ wrapper της `react-resizable-panels`) · `@/components/ui/resizable-persistence`
 *   (**πότε** γράφεται) · `@/components/ui/resizable-column-store` (**τι** · **πού**) · πρότυπο: `ViewerInspectorSplit`
 * @module core/layouts/details-peek-split
 *
 * 🔴 **Η αφορμή** (στιγμιότυπο Giorgio 2026-10-19, έργα 1920px): το panel ήταν καρφωμένο `clamp(24rem,38%,48rem)` — οι
 *   καρτέλες του έργου έπιαναν τέσσερις σειρές και η φόρμα «Άδειες» στρίμωχνε πέντε πεδία σε ~600px.
 * 🔑 **Όπως Notion side peek · Figma inspector · VS Code sidebar**: σύρσιμο της διαχωριστικής, βέλη/Home/End από το
 *   πληκτρολόγιο (WAI-ARIA splitter, δωρεάν από τη βιβλιοθήκη), διπλό κλικ = επαναφορά στο αποθηκευμένο πλάτος.
 * 🔑 **Χωρίς σύμπτυξη**: το panel το κλείνει ο ✕ / το Esc / δεύτερο κλικ στην κάρτα — μία έξοδος, όχι δύο.
 * 🔑 **px + `preserve-pixel-size`**: μεγαλώνει το παράθυρο ⇒ τον χώρο τον παίρνει το **πλέγμα** (περισσότερες στήλες),
 *   οι λεπτομέρειες κρατούν το πλάτος που διάλεξε ο άνθρωπος.
 * ⚠️ Η βιβλιοθήκη γράφει **inline** `display: flex` στο εξωτερικό div του panel και πηγαίνει το `className` στο
 *   **εσωτερικό** ⇒ η απόκρυψη στο κινητό μπαίνει στην **ομάδα** (`max-md:[&>#…]:!hidden`), όπως στο `ViewerInspectorSplit`.
 */
import { useMemo, type ReactNode } from 'react';

import {
  THIN_SEPARATOR_CLASS, ResizableHandle, ResizablePanel, ResizablePanelGroup,
} from '@/components/ui/resizable';
import { usePanelWidthPersistence } from '@/components/ui/resizable-persistence';
import { createColumnLayoutStore } from '@/components/ui/resizable-column-store';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { STORAGE_KEYS } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { DetailsPeekPanel } from './DetailsPeekPanel';

/**
 * Όρια σε px. Ελάχιστο = το παλιό κάτω όριο (24rem)· προεπιλογή ≈ ό,τι έδινε το παλιό 38% σε οθόνη 1920px· μέγιστο =
 * σχεδόν όλη η περιοχή μιας μεγάλης οθόνης — στις μικρότερες νικά το ελάχιστο του πλέγματος.
 */
export const DETAILS_PEEK_COLUMN = {
  widthMin: 384,
  widthDefault: 640,
  widthMax: 1600,
} as const;

/** Το πλέγμα δεν στενεύει κάτω από αυτό (px) — υπερισχύει του `widthMax` του panel. */
const LIST_MIN_WIDTH = 320;
const LIST_PANEL_ID = 'details-peek-list';
const PEEK_PANEL_ID = 'details-peek-column';
/** Literal, όχι template: το Tailwind σαρώνει κείμενο. */
const NARROW_HIDES_PEEK = 'max-md:[&>#details-peek-column]:!hidden';

const peekStore = createColumnLayoutStore(STORAGE_KEYS.DETAILS_PEEK_COLUMN, DETAILS_PEEK_COLUMN);

interface DetailsPeekSplitProps {
  readonly list: ReactNode;
  /** Υπάρχει panel; (επιλογή ή φόρμα δημιουργίας, και όχι κινητό) */
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

export function DetailsPeekSplit({ list, open, title, onClose, children }: DetailsPeekSplitProps) {
  const { t } = useTranslation('common-actions');
  const persistence = usePanelWidthPersistence(peekStore.write, DETAILS_PEEK_COLUMN.widthDefault);
  // Το `defaultSize` μετρά μόνο στο στήσιμο του panel ⇒ ανάγνωση σε κάθε άνοιγμα, όχι σε κάθε render.
  const openWidth = useMemo(() => (open ? peekStore.read().width : DETAILS_PEEK_COLUMN.widthDefault), [open]);

  return (
    <ResizablePanelGroup orientation="horizontal" onLayoutChanged={persistence.onLayoutChanged}
      className={cn('min-h-0 min-w-0 flex-1', NARROW_HIDES_PEEK)}>
      {/* Γραμμή (όχι στήλη): το πλέγμα τεντώνεται σε ύψος και κυλά με το δικό του `overflow`. */}
      <ResizablePanel id={LIST_PANEL_ID} minSize={LIST_MIN_WIDTH} className="flex min-h-0 min-w-0">
        {list}
      </ResizablePanel>
      {open && (
        <>
          <ResizableHandle aria-label={t('actions.resizeDetails')} className={cn(THIN_SEPARATOR_CLASS, 'hidden md:flex')}
            {...persistence.separatorProps} />
          <ResizablePanel id={PEEK_PANEL_ID} elementRef={persistence.elementRef} defaultSize={openWidth}
            minSize={DETAILS_PEEK_COLUMN.widthMin} maxSize={DETAILS_PEEK_COLUMN.widthMax}
            groupResizeBehavior="preserve-pixel-size" onResize={persistence.onResize}
            className="flex min-h-0 min-w-0">
            <DetailsPeekPanel onClose={onClose} title={title}>{children}</DetailsPeekPanel>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
