/**
 * 🔴 **Ο ΕΝΑΣ «ελάχιστος πιστός κόσμος» των tests του ποντικιού** — το δοχείο του καμβά με τον
 * **πραγματικό** ακροατή (`useTableCellPointer`), και από πάνω του το πεδίο της συνεδρίας.
 *
 * ## Γιατί βγήκε εδώ (N.18 / CHECK 3.28, ADR-739 §36.9)
 * Το ίδιο component ήταν ήδη γραμμένο **δύο** φορές (`table-fill-handle-drag.test.tsx`,
 * `table-point-mode-pointer.test.tsx` — η κεφαλίδα του πρώτου το ονομάζει ρητά «*το αδελφό
 * δίχτυ, ίδιο σχήμα harness*»), και η μετακίνηση περιγράμματος θα ήταν το **τρίτο**. Το jscpd
 * χαρακτηρίζει sibling clones **ανεξάρτητα ονόματος**, και σωστά: τρία αντίγραφα σημαίνουν
 * τρεις ευκαιρίες να ξεχάσει κάποιος ένα prop του hook — και η παράλειψη θα ήταν **σιωπηλή**
 * (το `useTableCellPointer` δεν παραπονιέται για χειριστή που δεν καλείται ποτέ).
 *
 * ⚠️ Το `table-point-mode-pointer.test.tsx` κρατά **δικό** του: χρειάζεται `useTableCellCaret`
 * και `autoFocus`, δηλαδή δοκιμάζει τη **γραφή**, όχι μόνο τη χειρονομία. Γενίκευση που θα
 * κάλυπτε και τα δύο θα ήταν component με σημαίες — δηλαδή harness που πρέπει να διαβαστεί για
 * να καταλάβεις τι στήνει. Δύο σχήματα, δύο αρχεία· **όχι** τρία αντίγραφα ενός σχήματος.
 *
 * ⚠️ **Δεν είναι σουίτα**: το `testMatch` του `jest.config.js` απαιτεί κατάληξη `.test.ts(x)`,
 * οπότε ένας βοηθός χωρίς αυτήν δεν εκτελείται ποτέ ως suite — ίδιο μοτίβο με το
 * `table-screen-point.ts` δίπλα.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/__tests__/table-pointer-harness
 * @see ui/table-cell-editor/use-table-cell-pointer.ts — ο ακροατής που στήνεται
 */

import React, { useRef } from 'react';
import { TABLE_TEST_VIEW, type TableTestView } from './table-screen-point';
import { useTableCellCursor } from '../../../state/table-cell-cursor-store';
import { TABLE_CELL_SESSION_MARKER } from '../table-cell-session-focus';
import { useTableCellPointer } from '../use-table-cell-pointer';
import type { TableCellRef } from '../../../bim/table/table-cell-range';
import type { PersistedTableModel } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import type { ViewTransform } from '../../../rendering/types/Types';

/**
 * Ό,τι μπορεί να παρατηρήσει ένα test. **Όλα προαιρετικά εκτός της οντότητας**: κάθε σουίτα
 * μετρά ένα κανάλι και δηλώνει **μόνο** εκείνο — έτσι το τι παρατηρείται φαίνεται στο call-site
 * αντί να κρύβεται σε πέντε `jest.fn()` που κανείς δεν διαβάζει.
 */
export interface TablePointerHarnessProps {
  readonly entity: TableEntity;
  /**
   * 🔴 Η **προβολή** — προεπιλογή το {@link TABLE_TEST_VIEW}.
   *
   * Υπάρχει ως prop επειδή μερικές προδιαγραφές **είναι** συνάρτηση της κλίμακας: το φράγμα της
   * ζώνης περιγράμματος (ADR-739 §36.9) δεσμεύει μόνο όταν το κελί είναι μικρότερο από
   * ~36 px, δηλαδή σε κανονικό zoom φύλλου. Ένα harness κλειδωμένο σε μία κλίμακα θα έκανε
   * εκείνα τα tests **πράσινα χωρίς να δοκιμάζουν τίποτα**.
   */
  readonly view?: TableTestView;
  /** Το μοντέλο που φτάνει στο commit — το **μόνο** πράγμα που θα δει ο χρήστης. */
  readonly onCommitModel?: (entity: TableEntity, model: PersistedTableModel) => void;
  readonly onSelectTo?: (cell: TableCellRef) => void;
  /**
   * 🔴 §43 + §66 — το πάτημα στη γωνία. Ένα prop, γιατί είναι **ένα** πάτημα: το `selectAll`
   * και το όπλισμα της μετακίνησης ζουν και τα δύο πίσω από αυτόν τον χειριστή στην παραγωγή.
   */
  readonly onCornerPress?: (event: MouseEvent, container: HTMLElement) => void;
  readonly onCommitPending?: () => void;
  readonly onPreviewModel?: (entity: TableEntity, model: PersistedTableModel) => void;
}

/**
 * Το δοχείο με τον ακροατή, και το `<textarea>` της συνεδρίας από πάνω του.
 *
 * Το πεδίο υπάρχει **και σε `nav`** — όπως στην παραγωγή — και αυτό δεν είναι λεπτομέρεια: ο
 * φύλακας `isTableCellSessionElement` του `use-table-cell-pointer` το ρωτά σε **κάθε** πάτημα,
 * και ένα harness χωρίς πεδίο θα δοκίμαζε διαδρομή που δεν υπάρχει.
 */
export function TablePointerHarness(props: TablePointerHarnessProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ViewTransform>((props.view ?? TABLE_TEST_VIEW).transform);
  const cursor = useTableCellCursor();

  useTableCellPointer({
    cursor,
    entity: props.entity,
    liveTable: () => props.entity,
    containerRef,
    transformRef,
    onSelectTo: props.onSelectTo ?? (() => undefined),
    onCornerPress: props.onCornerPress ?? (() => undefined),
    onCommitPending: props.onCommitPending ?? (() => undefined),
    onPreviewModel: props.onPreviewModel ?? (() => undefined),
    onCommitModel: props.onCommitModel ?? (() => undefined),
  });

  return (
    <div ref={containerRef} data-testid="canvas">
      {cursor ? (
        <textarea
          key={`${cursor.entityId}:${cursor.position.rowId}:${cursor.position.colId}:${cursor.sessionId}`}
          value={cursor.draft}
          onChange={() => undefined}
          {...TABLE_CELL_SESSION_MARKER}
        />
      ) : null}
    </div>
  );
}

/**
 * Το δοχείο του τελευταίου `render`, με **δηλωμένο** ορθογώνιο.
 *
 * Το jsdom δεν κάνει διάταξη: χωρίς αυτό, το `getBoundingClientRect()` επιστρέφει μηδενικά και
 * **κάθε** μετατροπή οθόνης→κόσμου βγαίνει λάθος — σιωπηλά, γιατί τα μηδενικά είναι έγκυροι
 * αριθμοί. Ήταν γραμμένο πανομοιότυπα σε κάθε `mount()`.
 */
export function stubHarnessRect(canvas: HTMLElement, view: TableTestView = TABLE_TEST_VIEW): void {
  const { viewport } = view;
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: viewport.width, height: viewport.height }) as DOMRect;
}
