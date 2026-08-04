/**
 * 🔴 ADR-751 — **ποιος σύνδεσμος βρίσκεται κάτω από τον δείκτη.**
 *
 * Καθαρός επιλυτής, χωρίς store και χωρίς συμβάντα — ακριβώς το σχήμα του
 * `stair-click-into-2d.ts` (ADR-358 Q19 Φ3b), και για τον **ίδιο** λόγο: τον καλούν **δύο**
 * διαδρομές, το κλικ και το hover, και πρέπει να δίνουν την **ίδια** απάντηση. Αν το χεράκι
 * εμφανιζόταν σε άλλο εύρος από αυτό που ανοίγει, ο χρήστης θα πατούσε εκεί που του λέει ο
 * δείκτης και δεν θα άνοιγε τίποτα — το χειρότερο είδος σφάλματος, γιατί μοιάζει με «δεν
 * δουλεύει» ενώ δουλεύει αλλού.
 *
 * ## Γιατί ΔΕΝ περνά από το `tablePointerHitAtWorld`
 * Εκείνο απαντά «ζώνη, ακμή ή κελί;» — ερώτηση που έχει νόημα **μόνο μέσα σε συνεδρία
 * επεξεργασίας**, όπου υπάρχουν ζώνες `A B C` και λαβές αλλαγής μεγέθους. Σε απλή προβολή δεν
 * υπάρχει τίποτα από αυτά, και θα απαιτούσε `viewScale` που ο καλών δεν έχει. Ο υποκείμενος
 * SSoT είναι το {@link tableCellAtWorld}, και αυτόν καλούμε — όχι δεύτερο hit-test κελιού.
 *
 * ## Το εύρος είναι το ΙΔΙΟ που ζωγραφίστηκε
 * Ο έλεγχος γίνεται πάνω στα `offsetMm`/`advanceMm` του **ίδιου** `TableTextLinkSpan` που
 * διάβασε ο ζωγράφος. Δεν ξαναμετριέται κείμενο εδώ: μια δεύτερη μέτρηση θα ήταν δεύτερη
 * απάντηση στο «πόσο πλατύς είναι ο σύνδεσμος», δηλαδή ακριβώς η απόκλιση που το `advanceMm`
 * της Φ.Ε υπάρχει για να μη γίνει.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-link-hit
 * @see bim/table/table-cell-link-spans.ts — ποιος τα τοποθέτησε
 * @see bim/stairs/stair-click-into-2d.ts — ο αδελφός που καθρεφτίζει
 */

import { TEXT_METRICS_RATIOS } from '../../config/text-rendering-config';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { TableEntity } from '../../types/table-entity';
import type { TableTextLinkSpan } from './table-layout-types';
import {
  computeTableEntityGeometryLive,
  tableCellAtFrame,
  tableWorldToFrame,
} from './table-entity-geometry';

/** Ο σύνδεσμος που βρέθηκε, μαζί με το κελί του — αρκετό για δείκτη, μενού και άνοιγμα. */
export interface TableCellLinkHit {
  readonly rowId: string;
  readonly colId: string;
  readonly span: TableTextLinkSpan;
}

/**
 * Ο σύνδεσμος κάτω από ένα σημείο **σκηνής**, ή `null`.
 *
 * Η κάθετη ανοχή είναι η **πραγματική ζώνη των γραμμάτων** (ανιούσα πάνω από τη γραμμή
 * βάσης, κατιούσα κάτω), από το ίδιο `TEXT_METRICS_RATIOS` που χρησιμοποιεί η υπογράμμιση —
 * όχι ολόκληρο το ύψος του κελιού. Ένα ψηλό κελί με μία γραμμή κειμένου έχει κενό πάνω και
 * κάτω· κλικ εκεί δεν είναι κλικ «πάνω στον σύνδεσμο», και αν το δεχόμασταν, το χεράκι θα
 * εμφανιζόταν σε άδειο χώρο.
 */
export function resolveTableCellLinkAtWorld(
  entity: TableEntity,
  world: Point2D,
  sceneUnits: SceneUnits = 'mm',
): TableCellLinkHit | null {
  const geometry = computeTableEntityGeometryLive(entity, sceneUnits);
  const frame = tableWorldToFrame(entity, world, geometry.mmToWorld);

  const hit = tableCellAtFrame(geometry.layout, frame);
  if (!hit) return null;

  const cell = geometry.layout.cells.find(
    (c) => c.rowId === hit.rowId && c.colId === hit.colId,
  );
  const run = cell?.text;
  const links = run?.links;
  if (!run || !links?.length) return null;

  // Κάθετα: η ζώνη ανιούσας→κατιούσας γύρω από τη γραμμή βάσης (`+v` = προς τα κάτω).
  const belowBaselineMm = frame.v - run.position.y;
  if (
    belowBaselineMm > run.heightMm * TEXT_METRICS_RATIOS.DESCENT_RATIO ||
    belowBaselineMm < -run.heightMm * TEXT_METRICS_RATIOS.ASCENT_RATIO
  ) {
    return null;
  }

  // Οριζόντια: σχετικά με την **άγκυρα** του κειμένου, η ίδια σύμβαση με το `offsetMm`.
  const fromAnchorMm = frame.u - run.position.x;
  const span = links.find(
    (s) => fromAnchorMm >= s.offsetMm && fromAnchorMm <= s.offsetMm + s.advanceMm,
  );
  return span ? { rowId: hit.rowId, colId: hit.colId, span } : null;
}
