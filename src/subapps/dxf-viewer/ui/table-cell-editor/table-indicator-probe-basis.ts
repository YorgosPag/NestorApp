/**
 * 🔴 ADR-739 §31.9 — **η κοινή βάση κάθε ερώτησης δείκτη**: LOD ⇒ πλαίσιο ⇒ πάχη ζωνών.
 *
 * Είχε ήδη εξαχθεί **μέσα** στο `table-cell-pointer-hit.ts` επειδή το CHECK 3.28 (jscpd, N.18)
 * την έπιασε ως sibling clone τη στιγμή που γεννήθηκε ο τρίτος καταναλωτής της. Τώρα βγαίνει
 * και σε **δικό της αρχείο**, γιατί ο έκτος καταναλωτής ζει πλέον αλλού (το πιάσιμο περιοχής,
 * `table-range-grab.ts`) και η εναλλακτική θα ήταν **κυκλική εξάρτηση**: το πιάσιμο χρειάζεται
 * τη βάση, και ο χάρτης χτυπημάτων χρειάζεται το πιάσιμο.
 *
 * Ο λόγος παραμένει ο αρχικός και δεν είναι φορμαλισμός: αντίγραφα του «είναι ορατός ο
 * δείκτης;» σημαίνουν ότι μια αλλαγή στο LOD θα άφηνε κάποια από αυτά να πιάνουν ζώνη **που
 * δεν ζωγραφίζεται** — δηλαδή χέρι που πιάνει αόρατο πράγμα.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-indicator-probe-basis
 * @see bim/table/table-indicator-geometry.ts — οι ζώνες και το LOD τους
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §31.9
 */

import {
  isTableIndicatorVisible,
  tableIndicatorBandsMm,
  type TableIndicatorBandsMm,
} from '../../bim/table/table-indicator-geometry';
import { tablePxPerMm, tableWorldToFrame } from '../../bim/table/table-entity-geometry';
import type { Point2D } from '../../rendering/types/Types';
import type {
  TableEntity,
  TableEntityGeometry,
  TableFramePoint,
} from '../../types/table-entity';

/** Το σημείο μεταφρασμένο στο πλαίσιο του πίνακα, μαζί με ό,τι χρειάζεται κάθε ερώτηση ζώνης. */
export interface TableIndicatorProbeBasis {
  readonly frame: TableFramePoint;
  readonly bands: TableIndicatorBandsMm;
  /** §40 — η κλίμακα ταξιδεύει μαζί: το ⊕ τη ζητά και δεν επιτρέπεται να την ξαναβγάλει. */
  readonly pxPerMm: number;
}

/**
 * `null` κάτω από το κατώφλι ορατότητας — ένα σημείο, μία απάντηση, για όλους.
 *
 * Το `null` **δεν** σημαίνει «έξω από τον πίνακα»: σημαίνει «σε αυτό το ζουμ ο δείκτης δεν
 * ζωγραφίζεται καθόλου», άρα δεν υπάρχει τίποτα να χτυπηθεί. Ο καλών οφείλει να το διαβάσει
 * ως «καμία ζώνη», όχι ως σφάλμα.
 */
export function indicatorProbeBasis(
  entity: TableEntity,
  world: Point2D,
  geometry: TableEntityGeometry,
  viewScale: number,
): TableIndicatorProbeBasis | null {
  const pxPerMm = tablePxPerMm(geometry.mmToWorld, viewScale);
  if (!isTableIndicatorVisible(geometry.layout.widthMm, geometry.layout.heightMm, pxPerMm)) {
    return null;
  }
  return {
    frame: tableWorldToFrame(entity, world, geometry.mmToWorld),
    bands: tableIndicatorBandsMm(pxPerMm),
    pxPerMm,
  };
}
