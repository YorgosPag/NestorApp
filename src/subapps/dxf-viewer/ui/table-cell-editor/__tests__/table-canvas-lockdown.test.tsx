/**
 * 🔴 ADR-739 §29 — **Ο ΚΑΜΒΑΣ ΔΕΝ ΕΠΙΛΕΓΕΙ ΟΣΟ Ο ΠΙΝΑΚΑΣ ΕΙΝΑΙ ΑΝΟΙΧΤΟΣ.**
 *
 * Ζητούμενο (ιδιοκτήτης, 2026-08-02, με στιγμιότυπο): «όταν μπαίνω σε edit mode στους
 * πίνακες, να μην μπορώ να κάνω κλικ έξω από τους πίνακες μέσα στον καμβά για να επιλέξω και
 * να τροποποιήσω οντότητες, αν πρώτα δεν βγω με κάποιον τρόπο από το edit». Στην οθόνη:
 * σχηματιζόταν περίγραμμα επιλογής, άναβε το tooltip οντότητας, και η επιλογή **σκότωνε τη
 * συνεδρία** — τρία πράγματα από μία άθελη κίνηση.
 *
 * ## Η ερώτηση που ρωτούν αυτά τα tests
 * **«Το είδε ο καμβάς;»** — όχι «κλήθηκε ο φύλακας;». Ο κατάσκοπος ζει σε φάση **αναδίπλωσης**
 * πάνω στο ίδιο δοχείο που ακούει η παραγωγή, δηλαδή στο ακριβές σημείο όπου φτάνουν (ή δεν
 * φτάνουν) τα συμβάντα του καμβά. Ένα test που μετρούσε κλήσεις του φύλακα θα ήταν πράσινο
 * ακόμη και με λάθος φάση, λάθος κόμβο ή λάθος συμβάν — και ακριβώς αυτά τα τρία ήταν οι
 * παγίδες εδώ.
 *
 * ## 🔴 Το `mouseup` είναι ο λόγος που υπάρχει αυτό το αρχείο
 * Η επιλογή οντότητας **δεν** γεννιέται στο `click`: γεννιέται στο **`mouseup`**
 * (`mouse-handler-up.ts:285`, `onCanvasClick`). Ένας φύλακας σε `mousedown` + `click` θα
 * φαινόταν πλήρης, θα περνούσε κάθε εύλογη ανάγνωση κώδικα, και ο χρήστης θα συνέχιζε να
 * επιλέγει οντότητες. Το test «⛔ ΤΟ ΜΗ ΠΡΟΦΑΝΕΣ» παρακάτω το κλειδώνει ονομαστικά.
 *
 * @see ui/table-cell-editor/use-table-canvas-lockdown.ts — ο φύλακας και τα πέντε κριτήρια
 * @see ui/table-cell-editor/table-cell-pointer-hit.ts — η ΜΙΑ ερώτηση «πού έπεσε;»
 */

import React, { useRef } from 'react';
import { act, render } from '@testing-library/react';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import {
  TABLE_TEST_VIEW,
  tableBandScreenPoint,
  tableCellScreenPoint,
  tableFrameScreenPoint,
} from './table-screen-point';
import { computeTableEntityGeometryLive } from '../../../bim/table/table-entity-geometry';
import { TABLE_CELL_SESSION_MARKER } from '../table-cell-session-focus';
import {
  __resetTableCanvasLockdownForTests,
  isCanvasLockedByTableSession,
  useTableCanvasLockdown,
} from '../use-table-canvas-lockdown';
import type { TableEntity } from '../../../types/table-entity';
import type { ViewTransform } from '../../../rendering/types/Types';

const { transform: TRANSFORM, viewport: VIEWPORT } = TABLE_TEST_VIEW;

/**
 * Σημείο **μακριά** από τον πίνακα, μέσα στον καμβά — εκεί όπου ο χρήστης έσερνε το πλαίσιο
 * επιλογής στο στιγμιότυπο.
 *
 * 🔴 **Παράγεται από τη γεωμετρία, ΠΟΤΕ από αριθμούς οθόνης.** Η πρώτη γραφή του test το
 * καθήλωσε στην κάτω-δεξιά γωνία του viewport (`1196 × 796`) με σκεπτικό «ο πίνακας χτίζεται
 * στην αρχή των αξόνων, δεν φτάνει ως εκεί». Μετρημένο: ο πίνακας της δοκιμής προβάλλεται σε
 * `x ≈ 30…12030`, δηλαδή το «έξω» έπεφτε **μέσα** του — και **πέντε tests έγιναν κόκκινα
 * κατηγορώντας τον φύλακα για σφάλμα που δεν είχε**. Τριπλάσιο του πλαισίου σε **sheet-mm**
 * είναι έξω εξ ορισμού, ακολουθεί την περιστροφή, και επιβιώνει κάθε αλλαγής μεγέθους.
 */
function outsidePoint(table: TableEntity): { readonly x: number; readonly y: number } {
  const { layout } = computeTableEntityGeometryLive(table);
  return tableFrameScreenPoint(table, layout.widthMm * 3, layout.heightMm * 3);
}

interface HarnessProps {
  readonly entity: TableEntity | null;
  /** Το ίδιο `overlay !== null` της παραγωγής. */
  readonly active: boolean;
}

function LockdownHarness(props: HarnessProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ViewTransform>(TRANSFORM);

  useTableCanvasLockdown({
    active: props.active,
    entity: props.entity,
    containerRef,
    transformRef,
  });

  return (
    <div ref={containerRef} data-testid="canvas">
      {/* Το πεδίο της συνεδρίας, με το ΠΑΡΑΓΩΓΙΚΟ σημάδι — ο φύλακας δεν το αγγίζει ποτέ. */}
      <textarea readOnly value="" {...TABLE_CELL_SESSION_MARKER} data-testid="cell-field" />
    </div>
  );
}

describe('🔴 ADR-739 §29 — ο καμβάς παραιτείται όσο ζει η λειτουργία πίνακα', () => {
  let entity: TableEntity;
  let canvas: HTMLElement;
  /** Ό,τι **έφτασε** στον καμβά. Η ερώτηση του χρήστη, όχι του φύλακα. */
  let seenByCanvas: string[];
  let unmount: () => void;

  function mountHarness(props: HarnessProps): void {
    const view = render(<LockdownHarness {...props} />);
    unmount = view.unmount;
    canvas = view.getByTestId('canvas');
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: VIEWPORT.width, height: VIEWPORT.height }) as DOMRect;
    seenByCanvas = [];
    // Φάση **αναδίπλωσης** στο δοχείο — ακριβώς εκεί που ακούει η παραγωγή (`onMouseDown`
    // κ.λπ. του `CanvasLayerStack`). Ό,τι σταμάτησε ο φύλακας δεν φτάνει ποτέ εδώ.
    canvas.addEventListener('mousedown', () => seenByCanvas.push('mousedown'));
    canvas.addEventListener('mouseup', () => seenByCanvas.push('mouseup'));
    canvas.addEventListener('click', () => seenByCanvas.push('click'));
    canvas.addEventListener('dblclick', () => seenByCanvas.push('dblclick'));
    canvas.addEventListener('contextmenu', () => seenByCanvas.push('contextmenu'));
  }

  /** Στέλνει συμβάν από το βάθος του δέντρου, όπως ο browser. Επιστρέφει το ίδιο το συμβάν. */
  function dispatchAt(
    type: string,
    point: { readonly x: number; readonly y: number },
    init: MouseEventInit = {},
    target: HTMLElement = canvas,
  ): MouseEvent {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: point.x,
      clientY: point.y,
      ...init,
    });
    act(() => {
      target.dispatchEvent(event);
    });
    return event;
  }

  beforeEach(() => {
    __resetTableCanvasLockdownForTests();
    entity = buildTableEntity({ x: 0, y: 0 }, {}, 'table-1', 'layer-0');
  });

  afterEach(() => {
    unmount?.();
    __resetTableCanvasLockdownForTests();
  });

  describe('με ανοιχτή λειτουργία πίνακα', () => {
    beforeEach(() => {
      mountHarness({ entity, active: true });
    });

    it('⛔ αριστερό πάτημα ΕΞΩ από τον πίνακα δεν φτάνει ποτέ στον καμβά', () => {
      // Χωρίς αυτό: armάρει lasso / body-drag — το «περίγραμμα επιλογής» του στιγμιότυπου.
      dispatchAt('mousedown', outsidePoint(entity));
      expect(seenByCanvas).toEqual([]);
    });

    it('🔴 ⛔ ΤΟ ΜΗ ΠΡΟΦΑΝΕΣ: το `mouseup` — ΕΚΕΙ γεννιέται η επιλογή οντότητας', () => {
      // `mouse-handler-up.ts:285` → `onCanvasClick(...)`. Φύλακας μόνο σε mousedown+click θα
      // ήταν κοσμητικός: ο χρήστης θα συνέχιζε να επιλέγει.
      dispatchAt('mouseup', outsidePoint(entity));
      expect(seenByCanvas).toEqual([]);
    });

    it('⛔ `click` και `dblclick` ΕΞΩ δεν φτάνουν — ο browser τα παράγει ούτως ή άλλως', () => {
      dispatchAt('click', outsidePoint(entity));
      dispatchAt('dblclick', outsidePoint(entity));
      expect(seenByCanvas).toEqual([]);
    });

    it('⛔ το δεξί κλικ ΕΞΩ δεν ανοίγει μενού οντότητας — και ούτε του browser', () => {
      const event = dispatchAt('contextmenu', outsidePoint(entity), { button: 2 });
      expect(seenByCanvas).toEqual([]);
      // Χωρίς `preventDefault` θα έβγαινε το μενού του **browser** πάνω από τον πίνακα.
      expect(event.defaultPrevented).toBe(true);
    });

    it('🔴 το πάτημα ΕΞΩ αναιρεί την προεπιλογή — ΕΚΕΙ επιβιώνει δομικά η συνεδρία', () => {
      // Η μεταφορά εστίασης είναι η **προεπιλεγμένη ενέργεια** του `mousedown`. Αναιρώντας
      // την, δεν γεννιέται `blur` — άρα ούτε δήλωση, ούτε ανάκτηση, ούτε καρέ αναμονής.
      // Δεν προστίθεται μηχανισμός· αφαιρείται το συμβάν που θα τον χρειαζόταν.
      const event = dispatchAt('mousedown', outsidePoint(entity));
      expect(event.defaultPrevented).toBe(true);
    });

    it('✅ το πάτημα ΜΕΣΑ σε κελί περνά — ο καμβάς έχει ακόμα δουλειά εκεί (λαβές, μετακίνηση)', () => {
      dispatchAt('mousedown', tableCellScreenPoint(entity, 2, 1));
      expect(seenByCanvas).toEqual(['mousedown']);
    });

    it('✅ το πάτημα σε ΖΩΝΗ ΔΕΙΚΤΗ περνά — ζει σε αρνητικά mm, αλλά είναι του πίνακα', () => {
      // Η ζώνη είναι **έξω** από το πλέγμα και θα φαινόταν «έξω από τον πίνακα» σε κάθε
      // φύλακα που ρωτούσε μόνο για κελιά. Γι' αυτό η ερώτηση είναι ΜΙΑ και κοινή.
      dispatchAt('mousedown', tableBandScreenPoint(entity, 'column', 1));
      expect(seenByCanvas).toEqual(['mousedown']);
    });

    it('✅ το κλικ πάνω σε ΜΕΛΟΣ της συνεδρίας περνά, όπου κι αν πέφτει γεωμετρικά', () => {
      // Το `<textarea>` μεγαλώνει με το κείμενο και μπορεί να ξεπεράσει το κελί του: εκεί το
      // DOM είναι πιο αληθινό από τα mm, γι' αυτό ρωτιέται **πριν** τη γεωμετρία.
      const field = canvas.querySelector('[data-testid="cell-field"]') as HTMLElement;
      dispatchAt('mousedown', outsidePoint(entity), {}, field);
      expect(seenByCanvas).toEqual(['mousedown']);
    });

    it('✅ μεσαίο και δεξί ΠΑΤΗΜΑ περνούν — pan (απόφαση ιδιοκτήτη: «pan + zoom ναι»)', () => {
      dispatchAt('mousedown', outsidePoint(entity), { button: 1 });
      dispatchAt('mousedown', outsidePoint(entity), { button: 2 });
      dispatchAt('mouseup', outsidePoint(entity), { button: 2 });
      expect(seenByCanvas).toEqual(['mousedown', 'mousedown', 'mouseup']);
    });

    it('✅ ό,τι ζει ΕΞΩ από τον καμβά δεν αγγίζεται — κορδέλα, πλευρικός, μενού', () => {
      const outsideCanvas = document.createElement('button');
      document.body.appendChild(outsideCanvas);
      const seen: string[] = [];
      outsideCanvas.addEventListener('mousedown', () => seen.push('mousedown'));

      dispatchAt('mousedown', outsidePoint(entity), {}, outsideCanvas);

      expect(seen).toEqual(['mousedown']);
      outsideCanvas.remove();
    });

    it('το hover παραιτείται: ο ΕΝΑΣ ορισμός απαντά «κλειδωμένος»', () => {
      expect(isCanvasLockedByTableSession()).toBe(true);
    });
  });

  describe('χωρίς λειτουργία πίνακα — καμία παρενέργεια', () => {
    it('όλα περνούν όταν το `active` είναι false', () => {
      mountHarness({ entity, active: false });

      dispatchAt('mousedown', outsidePoint(entity));
      dispatchAt('mouseup', outsidePoint(entity));
      dispatchAt('contextmenu', outsidePoint(entity), { button: 2 });

      expect(seenByCanvas).toEqual(['mousedown', 'mouseup', 'contextmenu']);
      expect(isCanvasLockedByTableSession()).toBe(false);
    });

    /**
     * 🔴 Η ΜΗ-ΠΑΛΙΝΔΡΟΜΗΣΗ ΠΟΥ ΚΟΣΤΙΣΕ ΜΙΑ ΦΟΡΑ: ξεχασμένο release ⇒ «ο viewer κλείδωσε
     * μέχρι reload» (§5.1). Το πληκτρολόγιο το πλήρωσε ήδη· το ποντίκι δεν θα το ξαναπληρώσει.
     */
    it('🔴 το ξεμοντάρισμα ΞΕΚΛΕΙΔΩΝΕΙ — κανένα κρεμασμένο κλείδωμα', () => {
      mountHarness({ entity, active: true });
      expect(isCanvasLockedByTableSession()).toBe(true);

      act(() => { unmount(); });

      expect(isCanvasLockedByTableSession()).toBe(false);
      // Και το ίδιο το συμβάν ξαναπερνά — ο ακροατής του `document` ξεγράφηκε πραγματικά.
      const seen: string[] = [];
      canvas.addEventListener('mousedown', () => seen.push('mousedown'));
      dispatchAt('mousedown', outsidePoint(entity));
      expect(seen).toEqual(['mousedown']);
    });

    it('χαμένος πίνακας (undo / διαγραφή) ⇒ καμία απόφαση μπλοκαρίσματος', () => {
      // Ο δρομέας επιβιώνει επίτηδες μιας αποτυχημένης ανάγνωσης σκηνής· το κλείδωμα ΔΕΝ
      // επιτρέπεται να επιβιώσει μαζί του, αλλιώς ο καμβάς μένει κλειστός χωρίς κανέναν να
      // ακούει. Εδώ το `entity` λείπει ενώ το `active` λέει ναι — το χειρότερο σενάριο.
      mountHarness({ entity: null, active: true });

      dispatchAt('mousedown', outsidePoint(entity));

      expect(seenByCanvas).toEqual(['mousedown']);
    });
  });
});
