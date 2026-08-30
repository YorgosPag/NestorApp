'use client';

/**
 * ADR-040 — **ΟΙ ΛΑΒΕΣ ΤΩΝ ΜΕΝΟΥ ΤΟΥ ΚΑΜΒΑ, ΩΣ ΜΙΑ ΣΥΣΤΑΔΑ**.
 *
 * Τέσσερα `useRef` που ο ενορχηστρωτής (`CanvasSection`) δεν διαβάζει **ποτέ**: τα γεννά, τα
 * δίνει στον δρομολογητή δεξιού κλικ (`useCanvasContextMenu`) και στα ίδια τα μενού μέσα από
 * το `CanvasSectionOverlays`. Δηλαδή είναι **καλωδίωση**, όχι κατάσταση — και η καλωδίωση
 * είναι ακριβώς αυτό που ο ενορχηστρωτής οφείλει να **μην** κουβαλά (ADR-040: ο ενορχηστρωτής
 * δεν συνδρομεί, δεν διαβάζει, δεν κρατά).
 *
 * ## Γιατί ένα hook και όχι τέσσερα `useRef` στη σειρά
 * Οι τέσσερις λαβές **γεννιούνται και πεθαίνουν μαζί**: κάθε νέο μενού καμβά προσθέτει μία
 * γραμμή εδώ και **καμία** στον ενορχηστρωτή. Χωρίς τη συστάδα, ο τύπος κάθε λαβής ταξιδεύει
 * ως ξεχωριστό `import type` μέσα στο πιο φορτωμένο αρχείο του συστήματος — τέσσερις εισαγωγές
 * που υπάρχουν μόνο για να γραφτεί το `useRef<…>(null)` και τίποτε άλλο.
 *
 * @module subapps/dxf-viewer/hooks/canvas/use-canvas-menu-refs
 * @see hooks/canvas/useCanvasContextMenu.ts — ο ΕΝΑΣ δρομολογητής που τις καταναλώνει
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { useRef, type RefObject } from 'react';
import { type DrawingContextMenuHandle } from '../../ui/components/DrawingContextMenu';
import { type EntityContextMenuHandle } from '../../ui/components/EntityContextMenu';
import { type GuideContextMenuHandle } from '../../ui/components/GuideContextMenu';
import { type GuideBatchContextMenuHandle } from '../../ui/components/GuideBatchContextMenu';

/** Οι λαβές των μενού δεξιού κλικ του καμβά, σε ένα αντικείμενο. */
export interface CanvasMenuRefs {
  readonly drawingMenuRef: RefObject<DrawingContextMenuHandle | null>;
  readonly entityMenuRef: RefObject<EntityContextMenuHandle | null>;
  readonly guideMenuRef: RefObject<GuideContextMenuHandle | null>;
  readonly guideBatchMenuRef: RefObject<GuideBatchContextMenuHandle | null>;
}

/**
 * Γεννά τις τέσσερις λαβές. Σταθερές για όλη τη ζωή του καμβά — καμία εξάρτηση, καμία
 * επανεκτέλεση, μηδέν επανασχεδιάσεις.
 */
export function useCanvasMenuRefs(): CanvasMenuRefs {
  const drawingMenuRef = useRef<DrawingContextMenuHandle>(null);
  const entityMenuRef = useRef<EntityContextMenuHandle>(null);
  const guideMenuRef = useRef<GuideContextMenuHandle>(null);
  const guideBatchMenuRef = useRef<GuideBatchContextMenuHandle>(null);
  return { drawingMenuRef, entityMenuRef, guideMenuRef, guideBatchMenuRef };
}
