/**
 * ADR-929 Φ5.2 (ADR-340) — σημείο βαθμονόμησης του υποβάθρου από τον **κεντρικό** αγωγό κλικ.
 *
 * 🔴 **Γιατί υπάρχει.** Από το ADR-732 (`441ee43c`, «3→1 καμβάς») το κλικ βαθμονόμησης ήταν `onClick`
 * πάνω στον καμβά της ζώνης Α (z=0). Από πάνω του κάθεται ο `dxf-canvas` (z-10) και παίρνει κάθε κλικ ⇒
 * τα σημεία **δεν καταγράφονταν ποτέ** (μετρημένο στην παραγωγή με `elementsFromPoint`, 2026-11-05).
 * Τώρα η βαθμονόμηση ζητά σημείο όπως κάθε άλλη λειτουργία (ADR-652 M6, ADR-911): ένας κλάδος στο
 * `useCanvasClickHandler`, και το σημείο φτάνει **ήδη** με OSNAP, σε συντεταγμένες σκηνής.
 *
 * Πάντα consume όσο ζητείται σημείο (το gating γίνεται από τον caller μέσω `isCalibrationPicking`),
 * ώστε το κλικ να ΜΗΝ πέσει σε grips/σχεδίαση/επιλογή.
 *
 * @see ../../floorplan-background/stores/floorplanBackgroundStore.ts — addCalibrationPoint
 */

import type { Point2D } from '../../rendering/types/Types';
import { useFloorplanBackgroundStore } from '../../floorplan-background/stores/floorplanBackgroundStore';

/** Αφήνει το σημείο σκηνής στη συνεδρία βαθμονόμησης. Πάντα consume το κλικ. */
export function handleCalibrationClick(worldPoint: Point2D): boolean {
  useFloorplanBackgroundStore.getState().addCalibrationPoint(worldPoint);
  return true;
}
