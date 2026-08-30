'use client';

/**
 * ADR-833 Φάση 4 — **ΤΟ ΑΝΟΙΓΜΑ ΤΗΣ ΜΕΤΟΝΟΜΑΣΙΑΣ**: από καρτέλα του πλαισίου σε ορθογώνιο
 * οθόνης, και μία γραφή στο store.
 *
 * ## Γιατί δικό του module και όχι μέσα στους δύο καλούντες
 * Οι δρόμοι είναι **δύο** και θα μείνουν δύο: **διπλό κλικ** στην καρτέλα (Excel/Sheets
 * parity, η πιο συνηθισμένη χειρονομία) και **δεξί κλικ → Μετονομασία**. Και οι δύο
 * καταλήγουν στο ίδιο ερώτημα («πού ακριβώς κάθεται αυτή η καρτέλα στην οθόνη;») — δύο
 * αντίγραφα της προβολής θα ήταν sibling clone (N.18), και το δεύτερο θα ήταν εκείνο που
 * ξεχνά την **περιστροφή**.
 *
 * ## 🔴 ΤΟ ΚΟΥΤΙ ΕΙΝΑΙ ΕΥΘΥΓΡΑΜΜΙΣΜΕΝΟ ΜΕ ΤΗΝ ΟΘΟΝΗ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ Ο ΚΑΝΟΝΑΣ ΤΟΥ ΣΠΙΤΙΟΥ
 * Η καρτέλα **γέρνει** με τον πίνακα· ο επεξεργαστής της όχι. Δεν είναι έκπτωση — είναι η
 * ρητή απόφαση του `TextEditorAnchorLayer` (ADR-344 Φ-3D), που την τεκμηριώνει με το
 * `MTEXTFIXED = 2` του AutoCAD: *κείμενο που θα ήταν δυσανάγνωστο («πολύ μικρό, πολύ μεγάλο,
 * ή **περιστραμμένο**») εμφανίζεται **οριζόντια και σε ευανάγνωστο μέγεθος**.* Θέση από την
 * προβολή· προσανατολισμός σε screen-space.
 *
 * Το ορθογώνιο είναι το **περιβάλλον κουτί** των τεσσάρων προβεβλημένων γωνιών: σε γωνία μηδέν
 * ταυτίζεται ακριβώς με την καρτέλα, και σε στραμμένο πίνακα την **καλύπτει** ολόκληρη — ποτέ
 * μικρότερο από αυτό που αντικαθιστά.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-worksheet-rename-open
 * @see state/table-worksheet-rename-store.ts — η κατάσταση (και το γιατί είναι στατική)
 * @see ui/text-toolbar/TextEditorAnchorLayer.tsx — η πηγή του κανόνα προσανατολισμού
 */

import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import {
  computeTableEntityGeometryLive,
  tableFrameToWorld,
  tablePxPerMm,
} from '../../bim/table/table-entity-geometry';
import { resolveWorksheetFields } from '../../bim/table/table-worksheet-resolve';
import { tableWorksheetTabStrip } from '../../bim/table/table-worksheet-tabs-geometry';
import { worksheetDisplayName } from '../../bim/table/table-worksheet-name';
import { openTableWorksheetRename } from '../../state/table-worksheet-rename-store';
import type { TableWorksheetTabSlot } from '../../bim/table/table-worksheet-tabs-geometry';
import type { TableEntity } from '../../types/table-entity';
import type { TableWorksheetId } from '../../types/table-worksheet';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';

export interface OpenWorksheetRenameParams {
  readonly entity: TableEntity;
  readonly tab: TableWorksheetTabSlot;
  /** Η κλίμακα mm → μονάδες σκηνής **αυτού** του πίνακα (από τη ζωντανή γεωμετρία). */
  readonly mmToWorld: number;
  readonly container: HTMLElement;
  readonly transform: ViewTransform;
}

/** Ανοίγει τη μετονομασία της καρτέλας, με το ορθογώνιό της σε client px. */
export function openWorksheetRename(params: OpenWorksheetRenameParams): void {
  const { entity, tab, mmToWorld, container, transform } = params;
  const rect = container.getBoundingClientRect();
  const viewport: Viewport = { width: rect.width, height: rect.height };
  const { rectMm } = tab;

  // Και οι τέσσερις γωνίες, μία προς μία: με στραμμένο πίνακα δύο δεν αρκούν, και το
  // περιβάλλον κουτί τους είναι η **μόνη** έκφραση που δεν εξαρτάται από τη γωνία.
  const corners = [
    [rectMm.x, rectMm.y],
    [rectMm.x + rectMm.w, rectMm.y],
    [rectMm.x, rectMm.y + rectMm.h],
    [rectMm.x + rectMm.w, rectMm.y + rectMm.h],
  ].map(([u, v]) => {
    // 🔴 Η **ίδια** margin-aware μηχανή προβολής με τον renderer και τον επεξεργαστή κελιού
    // (`text-editor-anchor-2d`): η αρχή του κόσμου δεν κάθεται στη γωνία του δοχείου αλλά της
    // **περιοχής σχεδίασης**. Μια χειρόγραφη έκφραση εδώ θα ήταν ακριβώς το διπλότυπο που
    // κόστισε ≈30 px μετατόπιση στον επεξεργαστή κελιού (μετρημένο 2026-08-01).
    const local = CoordinateTransforms.worldToScreen(
      tableFrameToWorld(entity, u, v, mmToWorld),
      transform,
      viewport,
    );
    return { x: rect.left + local.x, y: rect.top + local.y };
  });

  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);

  openTableWorksheetRename({
    entityId: entity.id,
    worksheetId: tab.id,
    // 🔴 Το **ρητό** όνομα, ποτέ το προεπιλεγμένο — δες τη δήλωση του πεδίου.
    initialName: tab.sheet.name ?? '',
    placeholder: worksheetDisplayName(tab.sheet, tab.index),
    anchorRect: {
      x: left,
      y: top,
      width: Math.max(...xs) - left,
      height: Math.max(...ys) - top,
    },
  });
}

/**
 * Η ίδια πράξη από **ταυτότητα** φύλλου: βρίσκει την καρτέλα **όπως είναι ζωγραφισμένη τώρα**
 * και ανοίγει τη μετονομασία της· `false` όταν δεν φαίνεται.
 *
 * ## Γιατί η θέση ξαναϋπολογίζεται εδώ, ενώ το διπλό κλικ την έχει ήδη
 * Ο δεύτερος καλών είναι το **μενού**: ανάμεσα στο δεξί κλικ και την επιλογή «Μετονομασία»
 * μεσολαβεί ένας ολόκληρος ανθρώπινος χρόνος, μέσα στον οποίο το zoom (τροχός) μπορεί να έχει
 * αλλάξει — και μαζί του το **παράθυρο υπερχείλισης**. Το store του hover κρατά επίτηδες
 * **ταυτότητα** και όχι θέση, ακριβώς γι' αυτό: *η λωρίδα κυλά, το φύλλο όχι*.
 *
 * `false` σημαίνει «η καρτέλα δεν φαίνεται πια» — και τότε **δεν** ανοίγει κουτί σε τυχαία
 * θέση: μια μετονομασία που ζωγραφίζεται αλλού από την καρτέλα της είναι χειρότερη από μια
 * μετονομασία που δεν ξεκίνησε.
 */
export function openWorksheetRenameById(params: {
  readonly entity: TableEntity;
  readonly worksheetId: TableWorksheetId;
  readonly container: HTMLElement;
  readonly transform: ViewTransform;
}): boolean {
  const { entity, worksheetId, container, transform } = params;
  const geometry = computeTableEntityGeometryLive(entity);
  const { worksheets, activeWorksheetId } = resolveWorksheetFields(entity);
  const strip = tableWorksheetTabStrip(
    worksheets,
    activeWorksheetId,
    geometry.layout.widthMm,
    geometry.layout.heightMm,
    tablePxPerMm(geometry.mmToWorld, transform.scale),
  );
  const tab = strip.tabs.find((slot) => slot.id === worksheetId);
  if (!tab) return false;
  openWorksheetRename({ entity, tab, mmToWorld: geometry.mmToWorld, container, transform });
  return true;
}
