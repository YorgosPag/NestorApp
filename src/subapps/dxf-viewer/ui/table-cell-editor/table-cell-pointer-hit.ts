'use client';

/**
 * ADR-739 §29 — **ΠΟΥ ΕΠΕΣΕ ΑΥΤΟ ΤΟ ΣΥΜΒΑΝ;** Η μία ερώτηση, οι δύο καταναλωτές.
 *
 * Δύο σημεία ρωτούν πλέον το ίδιο πράγμα και **πρέπει** να παίρνουν την ίδια απάντηση:
 *
 *  1. ο {@link module:subapps/dxf-viewer/ui/table-cell-editor/use-table-cell-pointer} —
 *     για να **δράσει** (ποιο κελί, ποιος άξονας)·
 *  2. ο φύλακας του §29 (`use-table-canvas-lockdown`) — για να **αποφασίσει αν το συμβάν
 *     φτάνει στον καμβά**.
 *
 * Αν οι δύο απαντήσεις μπορούσαν να αποκλίνουν έστω κατά ένα pixel, θα υπήρχε ζώνη όπου ο
 * φύλακας μπλοκάρει και ο pointer δεν δρα — δηλαδή **νεκρή λωρίδα**, ακριβώς στην άκρη του
 * πίνακα, όπου ο χρήστης δεν θα καταλάβαινε ποτέ γιατί «δεν πιάνει τίποτα». Γι' αυτό η
 * ερώτηση εξήχθη εδώ **πριν** γραφτεί ο δεύτερος καταναλωτής, και όχι μετά.
 *
 * ## Η σειρά ΕΙΝΑΙ μέρος της απάντησης
 * Πρώτα η **ζώνη δείκτη** (γράμματα στηλών / αριθμοί γραμμών), μετά το **κελί**. Οι δύο
 * περιοχές δεν τέμνονται ποτέ — η ζώνη ζει σε **αρνητικά** mm — άρα η σειρά είναι απλώς «η
 * πιο ειδική ερώτηση πρώτη», χωρίς καμία διεκδίκηση. Ίδια σειρά με το βήμα 9.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-cell-pointer-hit
 * @see bim/table/table-entity-geometry.ts — `tableCellAtWorld`, ΠΟΙΟ κελί χτυπήθηκε
 * @see bim/table/table-indicator-geometry.ts — οι ζώνες, με το LOD τους
 */

import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import {
  computeTableEntityGeometryLive,
  tableCellAtWorld,
  tablePxPerMm,
  tableWorldToFrame,
} from '../../bim/table/table-entity-geometry';
import {
  isTableIndicatorVisible,
  tableIndicatorBandsMm,
  tableIndicatorHitAtFrame,
  type TableIndicatorHit,
} from '../../bim/table/table-indicator-geometry';
import type { TableCellHit, TableEntity, TableEntityGeometry } from '../../types/table-entity';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';

/**
 * Πού έπεσε το πάτημα **μέσα σε αυτόν** τον πίνακα. `null` = πουθενά πάνω του — δηλαδή
 * αλλού στον καμβά ή στα περιθώρια του ίδιου του πίνακα.
 */
export type TablePointerHit =
  | { readonly where: 'band'; readonly band: TableIndicatorHit }
  | { readonly where: 'cell'; readonly cell: TableCellHit };

/**
 * Σημείο συμβάντος → σημείο **κόσμου**, με τη ζωντανή προβολή.
 *
 * Ο ΕΝΑΣ δρόμος: τον περνούν το πάτημα, **κάθε κίνηση** της σύρσης, και οι φύλακες του §29
 * (ADR-040 — ανάγνωση τη στιγμή του συμβάντος, ποτέ στιγμιότυπο: ο χρήστης μπορεί να
 * ζουμάρει με τον τροχό ενώ σέρνει).
 */
export function tableEventWorldPoint(
  event: MouseEvent,
  container: HTMLElement,
  transform: ViewTransform | null,
): Point2D | null {
  if (!transform) return null;
  const rect = container.getBoundingClientRect();
  const viewport: Viewport = { width: rect.width, height: rect.height };
  return CoordinateTransforms.screenToWorld(
    { x: event.clientX - rect.left, y: event.clientY - rect.top },
    transform,
    viewport,
  );
}

/**
 * Η ερώτηση, ολόκληρη: ζώνη ⇒ κελί ⇒ τίποτα.
 *
 * Η γεωμετρία υπολογίζεται **μία** φορά εδώ και εξυπηρετεί και τις δύο υπο-ερωτήσεις — πριν
 * την εξαγωγή υπολογιζόταν δύο φορές στον ίδιο χειριστή.
 */
export function tablePointerHitAtWorld(
  entity: TableEntity,
  world: Point2D,
  viewScale: number,
): TablePointerHit | null {
  const geometry = computeTableEntityGeometryLive(entity);
  const band = indicatorHitAt(entity, world, geometry, viewScale);
  if (band) return { where: 'band', band };
  const cell = tableCellAtWorld(entity, world, geometry);
  return cell ? { where: 'cell', cell } : null;
}

/** Σε ποια υποδιαίρεση ζώνης έπεσε το κλικ· `null` όταν ο δείκτης δεν ζωγραφίζεται καν (LOD). */
function indicatorHitAt(
  entity: TableEntity,
  world: Point2D,
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
