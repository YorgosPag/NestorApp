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
 * ## 🔴 Γιατί ο δρομέας ΔΕΝ κλείνει από το blur που ακολουθεί
 * Ένα κλικ στον καμβά βγάζει την εστίαση από το `<textarea>` της συνεδρίας. Ο φύλακας
 * (`useTableCellSessionBlur`) όμως **δεν κλείνει συγχρόνως**: όταν ο παραλήπτης της
 * εστίασης είναι `null` — ακριβώς η περίπτωση «κλικ στον καμβά» — αναβάλλει την απόφαση
 * κατά **ένα καρέ** και ρωτά τότε ποιος έχει την εστίαση. Μέχρι τότε το store έχει ήδη
 * μετακινήσει τον δρομέα, το React έχει στήσει **νέο** `<textarea autoFocus>` για το νέο
 * κελί, και ο έλεγχος βρίσκει μέλος της συνεδρίας ⇒ **δεν κλείνει**.
 *
 * Δεν είναι τύχη: το σχόλιο εκείνου του αρχείου ονομάζει ρητά αυτή την περίπτωση ως τον
 * λόγο που η απόφαση μένει ένα καρέ αργότερα. Χτίζουμε πάνω σε δηλωμένη εγγύηση, όχι σε
 * παρενέργεια.
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
  tableIndicatorBandsMm,
  tableIndicatorHitAtFrame,
  type TableIndicatorHit,
} from '../../bim/table/table-indicator-geometry';
import { tableCursorAt } from '../../bim/table/table-cell-navigation';
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
}

export function useTableCellPointer(params: UseTableCellPointerParams): void {
  const { cursor, entity, containerRef, transformRef, onSelectTo } = params;

  useEffect(() => {
    // Χωρίς ενεργό δρομέα δεν υπάρχει τίποτα να μετακινηθεί: το πρώτο κλικ σε πίνακα τον
    // **επιλέγει** ως οντότητα (δουλειά του καμβά), και η λειτουργία πίνακα ανοίγει με
    // διπλό κλικ ή `Enter`/`F2`. Καμία διαρροή ακροατή όταν δεν χρειάζεται.
    if (!cursor || !entity) return;
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = (event: MouseEvent): void => {
      // Αριστερό κουμπί μόνο: το δεξί ανοίγει το μενού συμφραζομένων και δεν επιτρέπεται
      // να μετακινήσει την επιλογή κάτω από το μενού που μόλις άνοιξε.
      if (event.button !== 0) return;
      const transform = transformRef.current;
      if (!transform) return;

      const rect = container.getBoundingClientRect();
      const viewport: Viewport = { width: rect.width, height: rect.height };
      const worldPoint = CoordinateTransforms.screenToWorld(
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        transform,
        viewport,
      );

      const geometry = computeTableEntityGeometryLive(entity);

      // ADR-739 Φ.Δ βήμα 9 — **πρώτα οι ζώνες δείκτη**: ένα κλικ στο `B` επιλέγει ολόκληρη
      // τη στήλη, στο `3` ολόκληρη τη γραμμή (Excel / Sheets). Προηγείται του κελιού επειδή
      // οι δύο περιοχές δεν τέμνονται ποτέ — η ζώνη ζει σε **αρνητικά** mm — άρα η σειρά
      // είναι απλώς «η πιο ειδική ερώτηση πρώτη», χωρίς καμία διεκδίκηση.
      const bandHit = indicatorHitAt(entity, worldPoint, geometry, transform.scale);
      if (bandHit) {
        selectWholeAxis(entity, bandHit);
        return;
      }

      // Το κλικ πρέπει να πέσει μέσα στο πλέγμα **αυτού** του πίνακα. Έξω από αυτό —
      // αλλού στον καμβά, ή στα περιθώρια του πίνακα — δεν μας αφορά: ο καμβάς θα κάνει
      // ό,τι κάνει πάντα, και η συνεδρία θα κλείσει μόνη της από τον φύλακα εστίασης.
      const hit = tableCellAtWorld(entity, worldPoint, geometry);
      if (!hit) return;

      if (event.shiftKey) {
        onSelectTo({ rowId: hit.rowId, colId: hit.colId });
        return;
      }
      // Απλό κλικ: **νέα** στήλη αγκύρωσης (`tableCursorAt`) — ένα κλικ ξεκινά καινούρια
      // σειρά καταχώρισης, άρα το επόμενο `Enter` επιστρέφει ΕΔΩ. Κατάσταση `nav`: έδειξες
      // κελί, δεν άρχισες να γράφεις· η γραφή ξεκινά με τον πρώτο χαρακτήρα (Excel).
      setTableCellCursor(entity.id, tableCursorAt(hit.rowId, hit.colId), 'nav');
    };

    // Φάση **σύλληψης**: ο δρομέας μετακινείται πριν ο καμβάς ερμηνεύσει τη χειρονομία, ώστε
    // ο ζωγράφος να δει τη νέα θέση στο ίδιο καρέ. Καμία κατανάλωση του συμβάντος — δες την
    // κεφαλίδα.
    container.addEventListener('mousedown', handleMouseDown, { capture: true });
    return () => container.removeEventListener('mousedown', handleMouseDown, { capture: true });
  }, [cursor, entity, containerRef, transformRef, onSelectTo]);
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
 */
function selectWholeAxis(entity: TableEntity, hit: TableIndicatorHit): void {
  const { rows, columns } = entity.model;
  if (rows.length === 0 || columns.length === 0) return;

  const from: TableCellRef =
    hit.axis === 'column'
      ? { rowId: rows[0].id, colId: hit.colId }
      : { rowId: hit.rowId, colId: columns[0].id };
  const to: TableCellRef =
    hit.axis === 'column'
      ? { rowId: rows[rows.length - 1].id, colId: hit.colId }
      : { rowId: hit.rowId, colId: columns[columns.length - 1].id };

  setTableCellCursor(entity.id, tableCursorAt(from.rowId, from.colId), 'nav');
  setTableCellSelection({ from, to });
}
