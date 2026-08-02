'use client';

/**
 * ADR-739 Φ.Δ βήμα 8 — **το κλικ μέσα σε πίνακα που ήδη επεξεργάζεσαι**: απλό κλικ
 * μετακινεί το ενεργό κελί, `Shift+κλικ` απλώνει την περιοχή ως εκεί.
 *
 * ## 🔴 ΠΑΘΗΤΙΚΟΣ ΑΚΡΟΑΤΗΣ — καμία `preventDefault`, καμία `stopPropagation`
 * Η μεγάλη απόφαση αυτού του αρχείου είναι τι **δεν** κάνει. Ο πειρασμός είναι να
 * καταναλώσει το συμβάν ώστε «να μην το πειράξει ο καμβάς». Αυτό θα έσπαγε πράγματα που
 * δουλεύουν: το σύρσιμο λαβών του πίνακα, τη μετακίνηση της οντότητας, το πλαίσιο επιλογής.
 * Ο καμβάς είναι ο ιδιοκτήτης του ποντικιού και **παραμένει**· εδώ γίνεται μόνο μια
 * **επιπλέον** ανάγνωση: «σε ποιο κελί έπεσε αυτό;».
 *
 * Έτσι το αρχείο μένει εντελώς **έξω** από τον `CanvasSection` — τον orchestrator που ο
 * ADR-040 απαγορεύει να αποκτήσει συνδρομές — και δεν αλλάζει καμία υπάρχουσα διαδρομή
 * χειρισμού ποντικιού. Δεν είναι συμβιβασμός· είναι ο λόγος που η αλλαγή είναι ασφαλής.
 *
 * ## 🔴 ADR-739 §26.15 — ΓΙΑΤΙ Ο ΔΡΟΜΕΑΣ ΔΕΝ ΚΛΕΙΝΕΙ ΑΠΟ ΤΟ BLUR ΠΟΥ ΑΚΟΛΟΥΘΕΙ
 *
 * ⚠️ Εδώ έγραφε ότι «ο φύλακας αναβάλλει την απόφαση κατά ένα καρέ, και μέχρι τότε το React
 * θα έχει στήσει νέο `<textarea autoFocus>` ⇒ δεν κλείνει· χτίζουμε πάνω σε **δηλωμένη
 * εγγύηση**». Η εγγύηση **δεν υπήρχε**: ζωντανά, **11/11** κλικ μέσα στον πίνακα σκότωναν τη
 * λειτουργία — και το κλικ στο **ίδιο** κελί επίσης, όπου δεν ξαναστήνεται τίποτα επειδή δεν
 * αλλάζει κανένα κομμάτι του `key`. Το πλήρες σκεπτικό ζει στην κεφαλίδα του φύλακα· εδώ
 * αρκεί το συμπέρασμα:
 *
 * **Ο καμβάς δεν μπορεί να φέρει το σημάδι συνεδρίας** (θα κρατούσε τη συνεδρία ζωντανή σε
 * κάθε κλικ οπουδήποτε στο σχέδιο), άρα το κλικ πρέπει να **δηλωθεί**: όποτε αυτός ο
 * ακροατής αναγνωρίζει ότι το πάτημα έπεσε μέσα στον δικό του πίνακα, το λέει στον φύλακα με
 * το `claimTableCellSessionPointerDown()`. Ο φύλακας, ένα καρέ μετά, **ανακτά** το
 * πληκτρολόγιο αντί να κλείσει τη συνεδρία. Η δήλωση είναι μία γραμμή και **δεν** αλλάζει
 * τίποτα άλλο εδώ: ο ακροατής παραμένει απολύτως παθητικός.
 *
 * ## Γιατί `mousedown` και όχι `click`
 * Η επιλογή πρέπει να ακολουθεί το χέρι **αμέσως**, πριν ξεκινήσει οποιοδήποτε σύρσιμο —
 * όπως σε κάθε φύλλο υπολογισμού και σε κάθε CAD. Ένα `click` θα ενεργούσε μετά το
 * `mouseup`, δηλαδή αφού ο καμβάς έχει ήδη ερμηνεύσει τη χειρονομία.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-cell-pointer
 * @see ui/table-cell-editor/table-cell-session-focus.ts — η εγγύηση του ενός καρέ
 * @see bim/table/table-entity-geometry.ts — `tableCellAtWorld`, ΠΟΙΟ κελί χτυπήθηκε
 */

import { useEffect, type RefObject } from 'react';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import {
  computeTableEntityGeometryLive,
  tableCellAtWorld,
  tablePxPerMm,
  tableWorldToFrame,
} from '../../bim/table/table-entity-geometry';
// ADR-739 Φ.Δ βήμα 9 — οι ζώνες δείκτη είναι πλέον και **επιφάνεια επιλογής**, όχι μόνο
// ένδειξη: το ίδιο SSoT γεωμετρίας που ζωγραφίζει τα κουτιά απαντά και «σε ποιο έπεσα».
import {
  isTableIndicatorVisible,
  tableAxisTickAtFrame,
  tableIndicatorBandsMm,
  tableIndicatorHitAtFrame,
  type TableIndicatorHit,
} from '../../bim/table/table-indicator-geometry';
// ADR-739 §27.15 — ο κύκλος ζωής της σύρσης ζει σε δικό του module· εδώ μένει η **γεωμετρία**.
import { endTableCellDrag, startTableCellDrag } from './table-cell-drag-session';
import { tableCursorAt } from '../../bim/table/table-cell-navigation';
// ADR-739 §26.15 — ο ΕΝΑΣ ορισμός του «ανήκω στη συνεδρία», και στις δύο μορφές του:
// για **στοιχεία** (`isTableCellSessionElement`) και για **χειρονομίες** (`claim…`).
import {
  claimTableCellPointerGesture,
  claimTableCellSessionPointerDown,
  isTableCellSessionElement,
} from './table-cell-session-focus';
import {
  setTableCellCursor,
  setTableCellSelection,
  type TableCellCursorState,
} from '../../state/table-cell-cursor-store';
import type { TableCellRef } from '../../bim/table/table-cell-range';
import type { TableEntityGeometry } from '../../types/table-entity';
import type { TableEntity } from '../../types/table-entity';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';

export interface UseTableCellPointerParams {
  readonly cursor: TableCellCursorState | null;
  /** Η **ζωντανή** οντότητα του δρομέα· `null` όταν ο πίνακας χάθηκε από κάτω του. */
  readonly entity: TableEntity | null;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly transformRef: RefObject<ViewTransform>;
  /** `Shift+κλικ` — δεύτερη γωνία περιοχής, χωρίς να κουνηθεί το ενεργό κελί. */
  readonly onSelectTo: (cell: TableCellRef) => void;
  /**
   * 🔴 ADR-739 §26.15 — **δέσμευσε ό,τι γράφεται τώρα, πριν κουνηθεί ο δρομέας**. No-op σε
   * πλοήγηση (δεν γράφεται τίποτα) και ιδεμποτής (μια δεύτερη κλήση με ίδιο κείμενο δεν
   * παράγει εντολή — `buildTableCellEditCommand` επιστρέφει `null`).
   *
   * ## Γιατί δεν αρκεί το commit του `blur`
   * Η σειρά του browser είναι αμείλικτη: ο ακροατής **σύλληψης** τρέχει **πριν** από τη
   * μεταφορά εστίασης, άρα πριν από κάθε `blur`. Αν εδώ μετακινηθεί πρώτα ο δρομέας, το
   * `setTableCellCursor` έχει ήδη **σβήσει το πρόχειρο** — και ο επεξεργαστής έχει
   * ξαναστηθεί σε `nav`, όπου το commit είναι εξ ορισμού σιωπηλό (και σωστά: ένα «γράψε το
   * άδειο πρόχειρο» θα **έσβηνε** το κελί). Αποτέλεσμα: η πληκτρολόγηση χάνεται χωρίς
   * μήνυμα.
   *
   * Δεν είναι νέος κανόνας — είναι ο **ίδιος** που τηρεί ήδη το πληκτρολόγιο: δες
   * `use-table-cell-session-keys`, `case 'move'`, «η σειρά είναι το συμβόλαιο: πρώτα
   * δεσμεύεται το πρόχειρο, μετά μετακινείται ο δρομέας». Το ποντίκι απλώς του έλειπε.
   */
  readonly onCommitPending: () => void;
}

export function useTableCellPointer(params: UseTableCellPointerParams): void {
  const { cursor, entity, containerRef, transformRef, onSelectTo, onCommitPending } = params;

  useEffect(() => {
    // Χωρίς ενεργό δρομέα δεν υπάρχει τίποτα να μετακινηθεί: το πρώτο κλικ σε πίνακα τον
    // **επιλέγει** ως οντότητα (δουλειά του καμβά), και η λειτουργία πίνακα ανοίγει με
    // διπλό κλικ ή `Enter`/`F2`. Καμία διαρροή ακροατή όταν δεν χρειάζεται.
    if (!cursor || !entity) return;
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = (event: MouseEvent): void => {
      // 🔴 ADR-739 §27.14 — ΔΥΟ πλήκτρα μπαίνουν, ΕΝΑ ενεργεί.
      //
      // Εδώ έγραφε `if (event.button !== 0) return;` με αιτιολογία «το δεξί ανοίγει το μενού
      // και δεν επιτρέπεται να μετακινήσει την επιλογή». Η αιτιολογία είναι **σωστή** — αλλά
      // η πρόωρη έξοδος έκανε **δύο** πράγματα, όχι ένα: μαζί με τη μετακίνηση απέκλεισε και
      // τη **δήλωση** του §26.15. Αποτέλεσμα: ο browser μετέφερε την εστίαση, ο φύλακας δεν
      // έβλεπε δήλωση, η συνεδρία **έκλεινε** — και όταν έφτανε το `contextmenu`, το
      // `getHit` του μενού ζωνών ρωτούσε δρομέα που δεν υπήρχε πια και απαντούσε `null`.
      // Ο δρομολογητής έπεφτε σωστά στο μενού **οντότητας**: αυτό ακριβώς ανέφερε ο Giorgio
      // ως «στις λωρίδες εμφανίζεται το μενού του καμβά».
      //
      // Ο κανόνας του §26.15 δεν είπε ποτέ «αριστερό»: είπε «**όποτε αυτός ο ακροατής
      // αναγνωρίζει ότι το πάτημα έπεσε μέσα στον δικό του πίνακα, το δηλώνει**». Εδώ ο
      // κανόνας απλώς εφαρμόζεται ακέραιος.
      const primary = event.button === 0;
      // Το μεσαίο πλήκτρο είναι pan του καμβά — ούτε δηλώνεται, ούτε μας αφορά.
      if (!primary && event.button !== 2) return;
      // ADR-739 §26.15 — το πάτημα έπεσε πάνω σε **πεδίο της ίδιας συνεδρίας**, όχι στον
      // καμβά: σε γραφή το `<textarea>` σκεπάζει το κελί, και το κλικ μέσα στο κείμενο είναι
      // **τοποθέτηση κέρσορα**. Ο ακροατής ζει στο ίδιο δοχείο και σε φάση σύλληψης, άρα το
      // βλέπει· χωρίς αυτόν τον φύλακα θα το ερμήνευε ως «κλικ στο κελί» και θα γύριζε τη
      // συνεδρία σε `nav` — δηλαδή θα σου έκοβε τη γραφή τη στιγμή που διορθώνεις ένα γράμμα.
      // Ο ίδιος ΕΝΑΣ ορισμός του «ανήκω στη συνεδρία», καμία δεύτερη σύγκριση.
      if (isTableCellSessionElement(event.target)) return;
      const worldPoint = eventWorldPoint(event, container, transformRef.current);
      if (!worldPoint) return;
      const transform = transformRef.current;
      if (!transform) return;

      const geometry = computeTableEntityGeometryLive(entity);

      // ADR-739 Φ.Δ βήμα 9 — **πρώτα οι ζώνες δείκτη**: ένα κλικ στο `B` επιλέγει ολόκληρη
      // τη στήλη, στο `3` ολόκληρη τη γραμμή (Excel / Sheets). Προηγείται του κελιού επειδή
      // οι δύο περιοχές δεν τέμνονται ποτέ — η ζώνη ζει σε **αρνητικά** mm — άρα η σειρά
      // είναι απλώς «η πιο ειδική ερώτηση πρώτη», χωρίς καμία διεκδίκηση.
      const bandHit = indicatorHitAt(entity, worldPoint, geometry, transform.scale);
      if (bandHit) {
        claimTableCellSessionPointerDown();
        // 🔴 ADR-739 §27.15 — και η **χειρονομία** δηλώνεται: χωρίς αυτό, το body-drag του
        // ADR-560 armάρει στα 3px και η σύρση επιλογής θα μετακινούσε τον πίνακα.
        claimTableCellPointerGesture();
        // §27.14 — το δεξί σταματά **εδώ**: δήλωσε και παραδώσου. Τα υπόλοιπα (άνοιγμα
        // μενού ζώνης) τα κάνει ο δρομολογητής στο `contextmenu`, που τώρα βρίσκει
        // ζωντανό δρομέα.
        if (!primary) return;
        // Η ζώνη μετακινεί το ενεργό κελί στην αρχή του άξονα, άρα ισχύει το ίδιο συμβόλαιο
        // με το απλό κλικ: ό,τι γράφεται δεσμεύεται πρώτα.
        onCommitPending();
        const axisAnchor = selectWholeAxis(entity, bandHit);
        // Σύρση **πάνω στα γράμματα/αριθμούς** = πολλές ολόκληρες στήλες/γραμμές (Excel).
        // Η άγκυρα είναι η αρχή του άξονα· το κινούμενο άκρο ακολουθεί μόνο τη θέση κατά
        // μήκος του άξονα, γι' αυτό και το `tableAxisTickAtFrame` αγνοεί τη ζώνη.
        if (axisAnchor) {
          startTableCellDrag({
            anchor: axisAnchor,
            kind: bandHit.axis,
            resolveAt: (moveEvent) => axisEndAt(moveEvent, entity, container, transformRef, bandHit.axis),
          });
        }
        return;
      }

      // Το κλικ πρέπει να πέσει μέσα στο πλέγμα **αυτού** του πίνακα. Έξω από αυτό —
      // αλλού στον καμβά, ή στα περιθώρια του πίνακα — δεν μας αφορά: ο καμβάς θα κάνει
      // ό,τι κάνει πάντα, και η συνεδρία θα κλείσει μόνη της από τον φύλακα εστίασης.
      const hit = tableCellAtWorld(entity, worldPoint, geometry);
      if (!hit) return;

      // ADR-739 §26.15 — από εδώ και κάτω το πάτημα **είναι** της συνεδρίας. Η δήλωση
      // γίνεται ΠΡΙΝ από κάθε εγγραφή, ώστε να ισχύει και για τους δύο δρόμους που
      // ακολουθούν: και το `Shift+κλικ` (που δεν μετακινεί δρομέα) πρέπει να κρατήσει το
      // πληκτρολόγιο, αλλιώς φτιάχνεις περιοχή και μένεις χωρίς πίνακα.
      claimTableCellSessionPointerDown();
      // §27.15 — δες το δίδυμο σχόλιο στη ζώνη: η οντότητα δεν μετακινείται από πάτημα που
      // σημαδεύει κελί.
      claimTableCellPointerGesture();

      // §27.14 — ίδιος κανόνας μέσα στο πλέγμα: το δεξί κρατά τη συνεδρία ζωντανή αλλά
      // **δεν αγγίζει τίποτα**. Το μενού οντότητας που θα ανοίξει αφορά τον πίνακα ως
      // αντικείμενο· χωρίς τη δήλωση θα άφηνε πίσω του «επιλεγμένος πίνακας χωρίς δρομέα»,
      // δηλαδή ακριβώς την κατάσταση-φάντασμα που κατέγραψε το §27.10.
      if (!primary) return;

      if (event.shiftKey) {
        // ΚΑΜΙΑ δέσμευση εδώ, ακριβώς όπως στο `Shift+βέλος` (`case 'extend'`): η επέκταση
        // περιοχής είναι κατάσταση **διεπαφής** και δεν αγγίζει το μοντέλο.
        onSelectTo({ rowId: hit.rowId, colId: hit.colId });
        return;
      }
      onCommitPending();
      // Απλό κλικ: **νέα** στήλη αγκύρωσης (`tableCursorAt`) — ένα κλικ ξεκινά καινούρια
      // σειρά καταχώρισης, άρα το επόμενο `Enter` επιστρέφει ΕΔΩ. Κατάσταση `nav`: έδειξες
      // κελί, δεν άρχισες να γράφεις· η γραφή ξεκινά με τον πρώτο χαρακτήρα (Excel).
      setTableCellCursor(entity.id, tableCursorAt(hit.rowId, hit.colId), 'nav');

      // 🔴 ADR-739 §27.15 — από εδώ αρχίζει η **σύρση**. Καμία επιλογή δεν γράφεται τώρα:
      // ένα σκέτο κλικ πρέπει να μείνει σκέτο κλικ («καμία επιλογή ≠ επιλογή 1×1», ρητή
      // απόφαση του βήματος 8 που ο Giorgio επιβεβαίωσε στις 02/08). Η πρώτη επιλογή
      // γεννιέται μόνο όταν το χέρι φτάσει σε **άλλο** κελί — γι' αυτό η άγκυρα του
      // `startTableCellDrag` είναι κι αυτή ο φύλακας «άλλαξε κελί;».
      startTableCellDrag({
        anchor: { rowId: hit.rowId, colId: hit.colId },
        kind: 'range',
        resolveAt: (moveEvent) => cellEndAt(moveEvent, entity, container, transformRef),
      });
    };

    // Φάση **σύλληψης**: ο δρομέας μετακινείται πριν ο καμβάς ερμηνεύσει τη χειρονομία, ώστε
    // ο ζωγράφος να δει τη νέα θέση στο ίδιο καρέ. Καμία κατανάλωση του συμβάντος — δες την
    // κεφαλίδα.
    container.addEventListener('mousedown', handleMouseDown, { capture: true });
    return () => {
      container.removeEventListener('mousedown', handleMouseDown, { capture: true });
      // §27.15 — η συνεδρία έκλεισε (ή άλλαξε πίνακας) με το κουμπί ακόμα κάτω: οι ακροατές
      // της σύρσης ζουν στο `document` και **δεν** θα έφευγαν μόνοι τους.
      endTableCellDrag();
    };
  }, [cursor, entity, containerRef, transformRef, onSelectTo, onCommitPending]);
}

/**
 * Σημείο συμβάντος → σημείο **κόσμου**, με τη ζωντανή προβολή. Ο ΕΝΑΣ δρόμος: τον περνούν
 * και το πάτημα και **κάθε κίνηση** της σύρσης (ADR-040 — ανάγνωση τη στιγμή του συμβάντος,
 * ποτέ στιγμιότυπο: ο χρήστης μπορεί να ζουμάρει με τον τροχό ενώ σέρνει).
 */
function eventWorldPoint(
  event: MouseEvent,
  container: HTMLElement,
  transform: ViewTransform | null,
): { readonly x: number; readonly y: number } | null {
  if (!transform) return null;
  const rect = container.getBoundingClientRect();
  const viewport: Viewport = { width: rect.width, height: rect.height };
  return CoordinateTransforms.screenToWorld(
    { x: event.clientX - rect.left, y: event.clientY - rect.top },
    transform,
    viewport,
  );
}

/** Το κινούμενο άκρο μιας σύρσης **κελιών**· `null` έξω από το πλέγμα (η επιλογή μένει). */
function cellEndAt(
  event: MouseEvent,
  entity: TableEntity,
  container: HTMLElement,
  transformRef: RefObject<ViewTransform>,
): TableCellRef | null {
  const world = eventWorldPoint(event, container, transformRef.current);
  if (!world) return null;
  const hit = tableCellAtWorld(entity, world, computeTableEntityGeometryLive(entity));
  return hit ? { rowId: hit.rowId, colId: hit.colId } : null;
}

/**
 * Το κινούμενο άκρο μιας σύρσης **άξονα** (πάνω στα γράμματα ή στους αριθμούς).
 *
 * Η θέση κατά μήκος του άξονα είναι το μόνο που μετράει — όπως στο Excel, όπου η σύρση
 * `B → D` συνεχίζει να επιλέγει στήλες ακόμα κι αν το χέρι ξεφύγει κατακόρυφα από τη
 * λωρίδα. Το άλλο άκρο καρφώνεται στο **τέλος** του πλέγματος, ώστε η στήλη/γραμμή να
 * μένει **ολόκληρη** σε κάθε καρέ της σύρσης.
 */
function axisEndAt(
  event: MouseEvent,
  entity: TableEntity,
  container: HTMLElement,
  transformRef: RefObject<ViewTransform>,
  axis: 'column' | 'row',
): TableCellRef | null {
  const world = eventWorldPoint(event, container, transformRef.current);
  if (!world) return null;
  const geometry = computeTableEntityGeometryLive(entity);
  const frame = tableWorldToFrame(entity, world, geometry.mmToWorld);
  const tick = tableAxisTickAtFrame(geometry.layout, frame, axis);
  if (!tick) return null;
  const { rows, columns } = entity.model;
  if (rows.length === 0 || columns.length === 0) return null;
  return tick.axis === 'column'
    ? { rowId: rows[rows.length - 1].id, colId: tick.colId }
    : { rowId: tick.rowId, colId: columns[columns.length - 1].id };
}

/** Σε ποια υποδιαίρεση ζώνης έπεσε το κλικ· `null` όταν ο δείκτης δεν ζωγραφίζεται καν (LOD). */
function indicatorHitAt(
  entity: TableEntity,
  world: { readonly x: number; readonly y: number },
  geometry: TableEntityGeometry,
  viewScale: number,
): TableIndicatorHit | null {
  const pxPerMm = tablePxPerMm(geometry.mmToWorld, viewScale);
  if (!isTableIndicatorVisible(geometry.layout.widthMm, geometry.layout.heightMm, pxPerMm)) {
    return null;
  }
  const frame = tableWorldToFrame(entity, world, geometry.mmToWorld);
  return tableIndicatorHitAtFrame(geometry.layout, frame, tableIndicatorBandsMm(pxPerMm));
}

/**
 * Επιλογή **ολόκληρης** στήλης ή γραμμής.
 *
 * Δεν χρειάζεται νέος τύπος επιλογής: η περιοχή είναι ήδη «δύο γωνίες», και μια ολόκληρη
 * στήλη είναι απλώς η γωνία (πρώτη γραμμή, αυτή η στήλη) ως την (τελευταία γραμμή, αυτή η
 * στήλη). Το ενεργό κελί πάει στην **αρχή** του άξονα, όπως στο Excel: εκεί αρχίζει η
 * πληκτρολόγηση αν συνεχίσεις να γράφεις.
 *
 * Η σειρά μετράει: το `setTableCellCursor` **διαλύει** κάθε υπάρχουσα περιοχή (τεκμηριωμένο
 * στο store), οπότε η επιλογή γράφεται μετά — αλλιώς θα έσβηνε τη στιγμή που γεννιέται.
 *
 * Επιστρέφει την **άγκυρα** (τη γωνία που μένει) για τη σύρση που μπορεί να ακολουθήσει·
 * `null` σε πίνακα χωρίς γραμμές ή χωρίς στήλες.
 */
function selectWholeAxis(entity: TableEntity, hit: TableIndicatorHit): TableCellRef | null {
  const { rows, columns } = entity.model;
  if (rows.length === 0 || columns.length === 0) return null;

  const from: TableCellRef =
    hit.axis === 'column'
      ? { rowId: rows[0].id, colId: hit.colId }
      : { rowId: hit.rowId, colId: columns[0].id };
  const to: TableCellRef =
    hit.axis === 'column'
      ? { rowId: rows[rows.length - 1].id, colId: hit.colId }
      : { rowId: hit.rowId, colId: columns[columns.length - 1].id };

  setTableCellCursor(entity.id, tableCursorAt(from.rowId, from.colId), 'nav');
  // 🔴 ADR-739 §27.15 — η πρόθεση ταξιδεύει μαζί με τις γωνίες. Ο άξονας **δεν κουμπώνει**
  // σε συγχωνεύσεις: ο πίνακας της σκηνής έχει τίτλο συγχωνευμένο σε όλες τις στήλες, και
  // χωρίς αυτή τη λέξη το «κλικ στο B» μάρκαρε **ολόκληρο τον πίνακα** (Giorgio, 02/08).
  // Οι λέξεις είναι οι ΙΔΙΕΣ του `hit.axis` — καμία μετάφραση, κανένα δεύτερο λεξιλόγιο.
  setTableCellSelection({ from, to, kind: hit.axis });
  return from;
}
