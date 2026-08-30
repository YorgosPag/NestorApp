/**
 * 🔴 ADR-739 §66 — **ΤΟ ΣΥΡΣΙΜΟ ΑΠΟ ΤΗ ΓΩΝΙΑ ΜΕΤΑΚΙΝΕΙ ΟΝΤΩΣ ΤΟΝ ΠΙΝΑΚΑ.**
 *
 * ## Γιατί το test τρέχει ολόκληρη την αλυσίδα και όχι τη συνάρτηση
 * Το επικίνδυνο μισό δεν είναι η αριθμητική — αυτή είναι το `applyTableGripDrag`, που έχει τα
 * δικά του anchors από το Φ.Γ. Το επικίνδυνο είναι το **καλώδιο**: ένα `where:
 * 'select-all-corner'` που κανείς δεν δρομολογεί στο `beginTableMove`, ή ένας ακροατής που
 * εγγράφεται και δεν λύνεται ποτέ. Γι' αυτό εδώ πέφτει **πραγματικό** `mousedown` σε pixel
 * οθόνης πάνω στο τετραγωνάκι, **πραγματικά** `mousemove`/`mouseup` στο `document`, και
 * μετριέται τι έφτασε στους γραφείς.
 *
 * ⚠️ Το `onCornerPress` του harness είναι **η ίδια γραμμή** που εκτελεί η παραγωγή
 * (`useTableCellDoubleClickEditor`) — όχι δεύτερη υλοποίηση της χειρονομίας.
 *
 * @see ui/table-cell-editor/table-move-drag.ts — η χειρονομία, με ολόκληρο το σκεπτικό
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §66
 */

import React, { useRef } from 'react';
import { act, render } from '@testing-library/react';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import { tableCursorAt } from '../../../bim/table/table-cell-navigation';
import {
  __resetTableCellCursorStoreForTests,
  setTableCellCursor,
  useTableCellCursor,
} from '../../../state/table-cell-cursor-store';
import { TABLE_TEST_VIEW, tableIndicatorCornerScreenPoint, tableCellScreenPoint } from './table-screen-point';
import { beginTableMove, endTableMoveDrag, isTableMoveDragging } from '../table-move-drag';
import { tableEventWorldPoint } from '../table-cell-pointer-hit';
import { useTableCellPointer } from '../use-table-cell-pointer';
import { DXF_TIMING } from '../../../config/dxf-timing';
import type { Point2D, ViewTransform } from '../../../rendering/types/Types';
import type { TableEntity } from '../../../types/table-entity';
import { activeTableModel } from '../../../bim/table/table-worksheet-resolve';

const { transform: TRANSFORM, viewport: VIEWPORT } = TABLE_TEST_VIEW;

interface MoveSpy {
  readonly previews: Point2D[];
  readonly commits: Point2D[];
}

function MoveHarness(props: {
  readonly entity: TableEntity;
  readonly spy: MoveSpy;
}): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ViewTransform>(TRANSFORM);
  const cursor = useTableCellCursor();

  useTableCellPointer({
    cursor,
    entity: props.entity,
    liveTable: () => props.entity,
    containerRef,
    transformRef,
    onSelectTo: jest.fn(),
    // 🔑 Η ΙΔΙΑ σύνθεση με την παραγωγή: μαρκάρισμα (§43) + όπλισμα μετακίνησης (§66). Το
    // μαρκάρισμα δεν μετριέται εδώ — έχει το δικό του αρχείο.
    onCornerPress: (event, container) => {
      beginTableMove(event, {
        entity: props.entity,
        container,
        transformRef,
        preview: (_e, position) => { props.spy.previews.push(position); },
        commit: (_e, position) => { props.spy.commits.push(position); },
      });
    },
    onCommitPending: jest.fn(),
    onPreviewModel: () => undefined,
    onCommitModel: () => undefined,
  });

  return <div ref={containerRef} data-testid="canvas" />;
}

describe('🔴 ADR-739 §66 — παρατεταμένο κλικ στη γωνία μετακινεί τον πίνακα', () => {
  let entity: TableEntity;
  let canvas: HTMLElement;
  let spy: MoveSpy;

  beforeEach(() => {
    __resetTableCellCursorStoreForTests();
    entity = buildTableEntity({ x: 0, y: 0 }, {}, 'table-1', 'layer-0');
    setTableCellCursor(entity, tableCursorAt(activeTableModel(entity).rows[1].id, activeTableModel(entity).columns[0].id), 'nav');
    spy = { previews: [], commits: [] };
    const view = render(<MoveHarness entity={entity} spy={spy} />);
    canvas = view.getByTestId('canvas');
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: VIEWPORT.width, height: VIEWPORT.height }) as DOMRect;
  });

  afterEach(() => {
    endTableMoveDrag();
  });

  function press(point: Point2D): void {
    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: point.x, clientY: point.y }),
      );
    });
  }

  function moveTo(point: Point2D): void {
    act(() => {
      document.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, clientX: point.x, clientY: point.y }),
      );
    });
  }

  function release(): void {
    act(() => { document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); });
  }

  /** Το αναμενόμενο delta, από την **ίδια** συνάρτηση προβολής που τρέχει η παραγωγή. */
  function worldDelta(from: Point2D, to: Point2D): Point2D {
    const a = tableEventWorldPoint({ clientX: from.x, clientY: from.y }, canvas, TRANSFORM)!;
    const b = tableEventWorldPoint({ clientX: to.x, clientY: to.y }, canvas, TRANSFORM)!;
    return { x: b.x - a.x, y: b.y - a.y };
  }

  it('🔴 ΤΟ ΚΑΛΩΔΙΟ ΕΙΝΑΙ ΖΩΝΤΑΝΟ: πάτημα στη γωνία + σύρση ⇒ η οντότητα μετακινείται', () => {
    const start = tableIndicatorCornerScreenPoint(entity);
    const end = { x: start.x + 120, y: start.y + 80 };

    press(start);
    moveTo(end);
    release();

    const delta = worldDelta(start, end);
    expect(spy.commits).toHaveLength(1);
    expect(spy.commits[0].x).toBeCloseTo(entity.position.x + delta.x, 6);
    expect(spy.commits[0].y).toBeCloseTo(entity.position.y + delta.y, 6);
  });

  /**
   * 🔴 Η γωνία έχει **δύο** νοήματα (§43 κλικ = επιλογή όλων, §66 σύρσιμο = μετακίνηση) και τα
   * ξεχωρίζει **μόνο** το κατώφλι. Χωρίς αυτό, κάθε κλικ με τρέμουλο χεριού θα έγραφε βήμα
   * αναίρεσης που ο χρήστης δεν ζήτησε — δηλαδή η νέα χειρονομία θα έτρωγε την παλιά.
   */
  it('🔴 ΣΚΕΤΟ ΚΛΙΚ ⇒ καμία μετακίνηση, καμία προεπισκόπηση, κανένα βήμα αναίρεσης', () => {
    press(tableIndicatorCornerScreenPoint(entity));
    release();

    expect(spy.previews).toHaveLength(0);
    expect(spy.commits).toHaveLength(0);
  });

  it('🔴 κίνηση ΚΑΤΩ από το κατώφλι ⇒ ο πίνακας δεν κουνιέται καθόλου', () => {
    const start = tableIndicatorCornerScreenPoint(entity);
    // Ένα pixel **λιγότερο** από το κατώφλι, κατά μήκος ενός άξονα: η απόσταση είναι ακριβώς
    // `DRAG_PX - 1`, άρα το test σπάει αν κάποιος χαλαρώσει τον έλεγχο σε `<=`.
    moveTo({ x: start.x + DXF_TIMING.threshold.DRAG_PX - 1, y: start.y });
    press(start);
    moveTo({ x: start.x + DXF_TIMING.threshold.DRAG_PX - 1, y: start.y });
    release();

    expect(spy.previews).toHaveLength(0);
    expect(spy.commits).toHaveLength(0);
  });

  /**
   * 🔴 **Η ΕΠΑΝΑΦΟΡΑ ΠΡΙΝ ΤΟ COMMIT** — δες την κεφαλίδα του module. Το `UpdateEntityCommand`
   * φωτογραφίζει τη σκηνή τη στιγμή του `execute()`· αν η τελευταία γραφή πριν από αυτό ήταν η
   * προεπισκόπηση, το «πριν» του undo θα ήταν η **τελική** θέση και το `Ctrl+Z` δεν θα έκανε
   * τίποτα. Η άγκυρα είναι εδώ γιατί το ελάττωμα είναι **αόρατο στην οθόνη**: ο πίνακας
   * μετακινείται σωστά, και μόνο η αναίρεση αποτυγχάνει — μία στις εκατό φορές που τη δοκιμάζει
   * κανείς.
   */
  it('🔴 η ΤΕΛΕΥΤΑΙΑ προεπισκόπηση πριν το commit είναι η ΑΡΧΙΚΗ θέση (αλλιώς το Ctrl+Z είναι no-op)', () => {
    const start = tableIndicatorCornerScreenPoint(entity);

    press(start);
    moveTo({ x: start.x + 200, y: start.y });
    release();

    const last = spy.previews[spy.previews.length - 1];
    expect(last).toEqual(entity.position);
    // …και δεν είναι απλώς «η πρώτη τιμή»: υπήρξε ενδιάμεση προεπισκόπηση που όντως κούνησε
    // τον πίνακα, αλλιώς το test θα περνούσε και με χειρονομία που δεν ζωγράφισε ποτέ τίποτα.
    expect(spy.previews.length).toBeGreaterThan(1);
    expect(spy.previews[0]).not.toEqual(entity.position);
  });

  it('η σύρση ΤΕΡΜΑΤΙΖΕΙ στο mouseup — κανένας ακροατής δεν επιζεί', () => {
    const start = tableIndicatorCornerScreenPoint(entity);
    press(start);
    expect(isTableMoveDragging()).toBe(true);

    release();
    expect(isTableMoveDragging()).toBe(false);

    // Και αποδεικνύεται: κίνηση **μετά** το τέλος δεν παράγει τίποτα.
    moveTo({ x: start.x + 300, y: start.y + 300 });
    expect(spy.previews).toHaveLength(0);
  });

  /**
   * Το κουμπί δεν διεκδικεί ξένα pixel: πάτημα **μέσα σε κελί** είναι σύρση επιλογής κελιών
   * (§27.15) και δεν επιτρέπεται να οπλίσει ποτέ μετακίνηση οντότητας.
   */
  it('🔴 πάτημα ΜΕΣΑ σε κελί ⇒ καμία μετακίνηση (ο κλάδος του κελιού μένει ανέπαφος)', () => {
    const start = tableCellScreenPoint(entity, 1, 1);

    press(start);
    moveTo({ x: start.x + 150, y: start.y + 150 });
    release();

    expect(isTableMoveDragging()).toBe(false);
    expect(spy.commits).toHaveLength(0);
  });
});
