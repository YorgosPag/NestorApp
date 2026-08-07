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
  tableInsertControlScreenPoint,
} from './table-screen-point';
import { computeTableEntityGeometryLive } from '../../../bim/table/table-entity-geometry';
import { TABLE_CELL_SESSION_MARKER } from '../table-cell-session-focus';
import {
  __resetTableCanvasLockdownForTests,
  isCanvasLockedByTableSession,
  useTableCanvasLockdown,
} from '../use-table-canvas-lockdown';
// 🔴 ADR-768 — ο **δεύτερος** αναγνώστης του φύλακα: ο στόχος βαψίματος του πινέλου.
import {
  __resetTableFormatPaintTargetForTests,
  setTableFormatPaintTarget,
} from '../../../state/table-format-paint-target-store';
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
  /**
   * 🔴 §29.15 — ο **μοναδικός** διακόπτης, ίδιος με την παραγωγή (`liveEntity`). Το `active`
   * έπαψε να είναι παράμετρος: «κλειδωμένο χωρίς οντότητα» δεν είναι πλέον εκφράσιμο.
   */
  readonly entity: TableEntity | null;
}

function LockdownHarness(props: HarnessProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ViewTransform>(TRANSFORM);

  useTableCanvasLockdown({
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
    // 🔴 ADR-768 — ο στόχος βαψίματος είναι **έκτο** κριτήριο του `shouldBlock`: αν διέρρεε από
    // test σε test, θα άφηνε την τρύπα ανοιχτή σε ολόκληρο το αρχείο, σιωπηλά.
    __resetTableFormatPaintTargetForTests();
    entity = buildTableEntity({ x: 0, y: 0 }, {}, 'table-1', 'layer-0');
  });

  afterEach(() => {
    unmount?.();
    __resetTableCanvasLockdownForTests();
    __resetTableFormatPaintTargetForTests();
  });

  describe('με ανοιχτή λειτουργία πίνακα', () => {
    beforeEach(() => {
      mountHarness({ entity });
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

    /**
     * 🔴 ADR-739 §40.8 — **ΤΟ ⊕ ΤΗΣ ΕΙΣΑΓΩΓΗΣ ΜΕΣΑ ΣΕ EDIT MODE** (ιδιοκτήτης, 2026-08-04).
     *
     * ## Το ελάττωμα, όπως το είδε στην οθόνη
     * «Η προσθήκη στηλών και γραμμών λειτουργεί σωστά **μόνον έξω** από το edit mode· όταν
     * μπαίνω σε edit mode δεν λειτουργεί σωστά.» Με στιγμιότυπα: το ⊕ **φαινόταν** και στις
     * δύο καταστάσεις, στη σωστή θέση, με τον δείκτη να γίνεται κουμπί.
     *
     * ## Γιατί ΚΑΝΕΝΑ υπάρχον test δεν το έπιασε — και είναι το μάθημα εδώ
     * Το §40 δοκιμάστηκε ολόκληρο ως **γεωμετρία** (19 anchors: φάσεις, θέση ανά κατάσταση,
     * δείκτης συνόρου) και η γεωμετρία ήταν **σωστή σε όλα**. Το ελάττωμα ζούσε μία στρώση πιο
     * κάτω: το `mousedown` κοβόταν από τον φύλακα του §29 στο `document` σε **σύλληψη**, πριν
     * φτάσει στον ακροατή του δοχείου. Δηλαδή **σωστός ζωγράφος + σωστό hit-test + άφταστο
     * κουμπί** — η ακριβής μορφή του «τα tests είναι πράσινα και ο χρήστης βλέπει το αντίθετο».
     *
     * Γι' αυτό τα anchors εδώ ρωτούν **«το είδε ο καμβάς;»** και όχι «τι απάντησε η γεωμετρία;».
     */
    describe('🔴 §40.8 — το ⊕ της εισαγωγής είναι ΚΟΥΜΠΙ, όχι περιοχή του καμβά', () => {
      it('🔴 ✅ το `mousedown` πάνω στον ΟΠΛΙΣΜΕΝΟ δίσκο ΦΤΑΝΕΙ — αλλιώς το κουμπί δεν πατιέται ποτέ', () => {
        // Το ακριβές ελάττωμα του ιδιοκτήτη: εδώ ήταν `[]`, δηλαδή ο ακροατής της εισαγωγής
        // (που ζει στο ΔΟΧΕΙΟ, άρα πιο κάτω από τον φύλακα του `document`) δεν καλούνταν ποτέ.
        dispatchAt('mousedown', tableInsertControlScreenPoint(entity, 'column', 1));
        expect(seenByCanvas).toEqual(['mousedown']);
      });

      it('🔴 ⛔ το `mouseup` στο ΙΔΙΟ σημείο ΔΕΝ φτάνει — εκεί γεννιέται η επιλογή οντότητας', () => {
        // Η ασυμμετρία **είναι** η προδιαγραφή. Μια συμμετρική «άσ' τα όλα να περάσουν» θα
        // διόρθωνε την εισαγωγή και θα αποεπέλεγε τον πίνακα με την ίδια κίνηση
        // (`mouse-handler-up.ts` → `onCanvasClick`, που τρέχει ΚΑΙ χωρίς προηγούμενο mousedown).
        dispatchAt('mouseup', tableInsertControlScreenPoint(entity, 'column', 1));
        expect(seenByCanvas).toEqual([]);
      });

      it('⛔ ούτε `click` / `dblclick` / `contextmenu` πάνω στον δίσκο', () => {
        const point = tableInsertControlScreenPoint(entity, 'row', 1);
        dispatchAt('click', point);
        dispatchAt('dblclick', point);
        dispatchAt('contextmenu', point, { button: 2 });
        expect(seenByCanvas).toEqual([]);
      });

      it('🔴 ⛔ η λωρίδα `nearby` ΜΕΝΕΙ κλειδωμένη — αλλιώς επιστρέφει το lasso του §29', () => {
        // Η λωρίδα είναι γενναιόδωρη επίτηδες ώστε το ⊕ να **βρεθεί** (§31.8) και τυλίγει
        // ολόκληρη την ακμή του πίνακα. Αν μετρούσε κι εκείνη ως «πάνω στον πίνακα», ο καμβάς
        // θα ξαναποκτούσε ζώνη 14 px γύρω από κάθε πίνακα — δηλαδή περίγραμμα επιλογής μέσα σε
        // edit mode, ακριβώς το ελάττωμα που έκλεισε το §29.
        //
        // Το σημείο: το ίδιο «πόσο έξω», αλλά στη **μέση μιας στήλης** — μακριά από κάθε
        // σύνορο, άρα `nearby` και ποτέ `armed`.
        const armed = tableInsertControlScreenPoint(entity, 'column', 1);
        const nextBoundary = tableInsertControlScreenPoint(entity, 'column', 2);
        const midway = { x: (armed.x + nextBoundary.x) / 2, y: (armed.y + nextBoundary.y) / 2 };
        dispatchAt('mousedown', midway);
        expect(seenByCanvas).toEqual([]);
      });
    });

    /**
     * 🔴 **ADR-768 Βήμα 5 — ΤΟ ΠΙΝΕΛΟ ΑΝΟΙΓΕΙ ΣΤΕΝΗ ΤΡΥΠΑ ΣΤΟ §29.**
     *
     * ## Το ελάττωμα που ΔΕΝ υπήρξε ποτέ στην οθόνη, επειδή μετρήθηκε πριν γραφτεί
     * Ο φύλακας από πάνω ρωτά τη γεωμετρία **ΤΟΥ ΠΙΝΑΚΑ ΤΟΥ ΔΡΟΜΕΑ** και μόνο. Άρα το κλικ σε
     * **δεύτερο** πίνακα δίνει `hit === null` ⇒ μπλοκάρεται ⇒ και επειδή αυτός ο ακροατής ζει
     * στο `document` σε **σύλληψη** ενώ ο ακροατής του πινέλου ζει στο **δοχείο**, το
     * `stopPropagation()` σημαίνει ότι ο ακροατής του πινέλου **δεν καλείται ποτέ**. Το
     * cross-table βάψιμο ήταν **δομικά αδύνατο**, όχι απλώς άγραφο — ακριβώς το σχήμα του
     * §40.8 («σωστός ζωγράφος + σωστό hit-test + άφταστο κουμπί»), μία στροφή πιο έξω.
     *
     * ## Η ερώτηση των anchors: **πόσο στενή είναι η τρύπα;**
     * Ο κρίσιμος αριθμός δεν είναι «ανοίγει», είναι «ανοίγει **μόνο** όπου υπάρχει στόχος». Ένα
     * σκέτο «το πινέλο είναι οπλισμένο» θα άφηνε το `mousedown` να φτάσει στον καμβά πάνω από
     * **κενό σχέδιο** ⇒ lasso ⇒ `blur` ⇒ θάνατος συνεδρίας: έξοδος **κατά λάθος**, δηλαδή
     * ακριβώς αυτό που το §29 ήρθε να καταργήσει. Το τρίτο anchor το κλειδώνει.
     */
    describe('🔴 ADR-768 — το οπλισμένο πινέλο βάφει και σε ΑΛΛΟΝ πίνακα', () => {
      /** Ο στόχος γράφεται από τον ΕΝΑ γραφέα (hover)· εδώ δηλώνεται απευθείας, ως συμβόλαιο. */
      function armPaintTargetElsewhere(): void {
        setTableFormatPaintTarget({ entityId: 'other-table', rowId: 'r1', colId: 'c1' });
      }

      it('🔴 ✅ με ΓΡΑΜΜΕΝΟ στόχο, το `mousedown` ΕΞΩ από τον πίνακα του δρομέα ΦΤΑΝΕΙ', () => {
        // Χωρίς αυτό, ο ακροατής του πινέλου (δοχείο) δεν καλείται ΠΟΤΕ για δεύτερο πίνακα.
        armPaintTargetElsewhere();
        dispatchAt('mousedown', outsidePoint(entity));
        expect(seenByCanvas).toEqual(['mousedown']);
      });

      it('🔴 ⛔ το `mouseup` στο ΙΔΙΟ σημείο ΔΕΝ φτάνει — αλλιώς το βάψιμο αποεπιλέγει τον πίνακα', () => {
        // Η ίδια ασυμμετρία με το ⊕ (§40.9): η επιλογή οντότητας γεννιέται στο `mouseup`
        // (`mouse-handler-up.ts` → `onCanvasClick`) και τρέχει ΚΑΙ χωρίς προηγούμενο mousedown.
        armPaintTargetElsewhere();
        dispatchAt('mouseup', outsidePoint(entity));
        expect(seenByCanvas).toEqual([]);
      });

      it('🔴 ⛔ ΧΩΡΙΣ στόχο η τρύπα είναι κλειστή — το κενό σχέδιο δεν σκοτώνει τη συνεδρία', () => {
        // Ο στόχος γράφεται μόνο εκεί που ο δείκτης υπόσχεται βάψιμο. Πάνω από κενό σχέδιο
        // είναι `null`, και το κλείδωμα οφείλει να κρατά ακέραιο.
        dispatchAt('mousedown', outsidePoint(entity));
        expect(seenByCanvas).toEqual([]);
      });

      it('⛔ ούτε `click` / `dblclick` / `contextmenu` — μόνο το πάτημα περνά', () => {
        armPaintTargetElsewhere();
        dispatchAt('click', outsidePoint(entity));
        dispatchAt('dblclick', outsidePoint(entity));
        dispatchAt('contextmenu', outsidePoint(entity), { button: 2 });
        expect(seenByCanvas).toEqual([]);
      });
    });
  });

  describe('χωρίς λειτουργία πίνακα — καμία παρενέργεια', () => {
    it('όλα περνούν όταν δεν υπάρχει λειτουργία πίνακα', () => {
      mountHarness({ entity: null });

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
      mountHarness({ entity });
      expect(isCanvasLockedByTableSession()).toBe(true);

      act(() => { unmount(); });

      expect(isCanvasLockedByTableSession()).toBe(false);
      // Και το ίδιο το συμβάν ξαναπερνά — ο ακροατής του `document` ξεγράφηκε πραγματικά.
      const seen: string[] = [];
      canvas.addEventListener('mousedown', () => seen.push('mousedown'));
      dispatchAt('mousedown', outsidePoint(entity));
      expect(seen).toEqual(['mousedown']);
    });

    /**
     * 🔴 §29.15 — Η ΕΓΓΥΗΣΗ ΠΟΥ ΕΝΙΣΧΥΘΗΚΕ: **ούτε το ΒΑΘΟΣ** επιβιώνει χαμένου πίνακα.
     *
     * Πριν, αυτό το test έλεγχε μόνο ότι κανένα συμβάν δεν μπλοκάρεται — και περνούσε, ενώ
     * το βάθος έμενε `1`. Δηλαδή ο φύλακας άφηνε τα συμβάντα να περάσουν, αλλά οι **τρεις
     * πύλες** του §29.9/§29.11 και ο ζωγράφος λαβών, που ρωτούν σκέτο
     * `isCanvasLockedByTableSession()` και **δεν** βλέπουν οντότητα, κρατούσαν τον καμβά
     * κλειστό: καμία επιλογή, καμία λαβή, μέχρι reload. Ήταν λανθάνον μόνο επειδή ο ένας
     * καλών περνούσε συνθήκη που συνεπαγόταν οντότητα.
     *
     * Τώρα το «κλειδωμένο χωρίς οντότητα» δεν είναι εκφράσιμο, και αυτή η γραμμή το φυλάει.
     */
    it('🔴 χαμένος πίνακας (undo / διαγραφή) ⇒ ούτε μπλοκάρισμα, ΟΥΤΕ κλείδωμα', () => {
      mountHarness({ entity: null });

      dispatchAt('mousedown', outsidePoint(entity));

      expect(seenByCanvas).toEqual(['mousedown']);
      expect(isCanvasLockedByTableSession()).toBe(false);
    });
  });
});
