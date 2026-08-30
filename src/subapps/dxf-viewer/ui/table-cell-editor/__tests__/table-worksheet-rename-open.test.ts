/**
 * ADR-833 Φάση 4 — **ΤΟ ΑΝΟΙΓΜΑ ΤΗΣ ΜΕΤΟΝΟΜΑΣΙΑΣ**, καρφωμένο σε δύο σημεία που κοστίζουν αν
 * ξεχαστούν:
 *
 *  1. 🔴 **Το πρόχειρο είναι το ΡΗΤΟ όνομα, ποτέ το προεπιλεγμένο.** Μια προ-συμπλήρωση με
 *     «Φύλλο2» θα σήμαινε ότι ένα `Enter` **χωρίς πληκτρολόγηση** υλοποιεί το προεπιλεγμένο
 *     όνομα μέσα στα δεδομένα — δηλαδή παγώνει τη γλώσσα του δημιουργού (ο παραβάτης του §5.2).
 *  2. **Το κουτί καλύπτει την καρτέλα**, και σε στραμμένο πίνακα την καλύπτει **ολόκληρη**:
 *     είναι το περιβάλλον κουτί των τεσσάρων προβεβλημένων γωνιών, ποτέ δύο.
 *
 * @see ../table-worksheet-rename-open.ts
 */

import { openWorksheetRename, openWorksheetRenameById } from '../table-worksheet-rename-open';
import {
  __resetTableWorksheetRenameForTests,
  getTableWorksheetRename,
} from '../../../state/table-worksheet-rename-store';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import { computeTableEntityGeometryLive } from '../../../bim/table/table-entity-geometry';
import { tableWorksheetTabStrip } from '../../../bim/table/table-worksheet-tabs-geometry';
import { resolveWorksheetFields } from '../../../bim/table/table-worksheet-resolve';
import { worksheetDisplayName } from '../../../bim/table/table-worksheet-name';
import { tableWorksheetId } from '../../../types/table-worksheet';
import type { TableEntity } from '../../../types/table-entity';
import type { ViewTransform } from '../../../rendering/types/Types';

const TRANSFORM: ViewTransform = { scale: 40, offsetX: 0, offsetY: 0 };

/** Δοχείο-φάντασμα: το μόνο που ρωτά η προβολή είναι το ορθογώνιό του. */
const CONTAINER = {
  getBoundingClientRect: () => ({ left: 100, top: 50, width: 900, height: 600 }),
} as unknown as HTMLElement;

function tableWith(sheetCount: number, angleRad = 0): TableEntity {
  const base = buildTableEntity({ x: 0, y: 0 }, { columnCount: 4 }, 'tbl_rename', 'lyr_test');
  const extra = Array.from({ length: sheetCount - 1 }, (_, i) => ({
    id: tableWorksheetId(`ws${i + 1}`),
    model: base.worksheets[0].model,
  }));
  return { ...base, angleRad, worksheets: [base.worksheets[0], ...extra] };
}

function stripOf(entity: TableEntity) {
  const geometry = computeTableEntityGeometryLive(entity);
  const { worksheets, activeWorksheetId } = resolveWorksheetFields(entity);
  return tableWorksheetTabStrip(
    worksheets,
    activeWorksheetId,
    geometry.layout.widthMm,
    geometry.layout.heightMm,
    geometry.mmToWorld * TRANSFORM.scale,
  );
}

beforeEach(() => {
  __resetTableWorksheetRenameForTests();
});

describe('🔴 ADR-833 Φ4 — το πρόχειρο ΔΕΝ υλοποιεί το προεπιλεγμένο όνομα', () => {
  it('ανώνυμο φύλλο ⇒ ΚΕΝΟ πρόχειρο, με το προεπιλεγμένο μόνο ως placeholder', () => {
    const entity = tableWith(3);
    const tab = stripOf(entity).tabs[1];
    openWorksheetRename({
      entity,
      tab,
      mmToWorld: computeTableEntityGeometryLive(entity).mmToWorld,
      container: CONTAINER,
      transform: TRANSFORM,
    });
    const state = getTableWorksheetRename();
    expect(state?.initialName).toBe('');
    // Το placeholder είναι ό,τι δείχνει η **ίδια** η καρτέλα — ένας επιλυτής, μία απάντηση.
    expect(state?.placeholder).toBe(worksheetDisplayName(tab.sheet, tab.index));
    expect(state?.placeholder).not.toBe('');
  });

  it('ονομασμένο φύλλο ⇒ το ρητό όνομα, αυτούσιο', () => {
    const base = tableWith(2);
    const entity: TableEntity = {
      ...base,
      worksheets: [{ ...base.worksheets[0], name: 'Κόστη' }, base.worksheets[1]],
    };
    const tab = stripOf(entity).tabs[0];
    openWorksheetRename({
      entity,
      tab,
      mmToWorld: computeTableEntityGeometryLive(entity).mmToWorld,
      container: CONTAINER,
      transform: TRANSFORM,
    });
    expect(getTableWorksheetRename()?.initialName).toBe('Κόστη');
  });
});

describe('ADR-833 Φ4 — το κουτί καλύπτει την καρτέλα', () => {
  it('χωρίς περιστροφή: πλάτος και ύψος ίσα με την καρτέλα σε px οθόνης', () => {
    const entity = tableWith(3);
    const geometry = computeTableEntityGeometryLive(entity);
    const pxPerMm = geometry.mmToWorld * TRANSFORM.scale;
    const tab = stripOf(entity).tabs[0];
    openWorksheetRename({
      entity,
      tab,
      mmToWorld: geometry.mmToWorld,
      container: CONTAINER,
      transform: TRANSFORM,
    });
    const rect = getTableWorksheetRename()!.anchorRect;
    expect(rect.width).toBeCloseTo(tab.rectMm.w * pxPerMm, 3);
    expect(rect.height).toBeCloseTo(tab.rectMm.h * pxPerMm, 3);
  });

  it('🔴 ΜΕ περιστροφή: το κουτί ΜΕΓΑΛΩΝΕΙ ώστε να την καλύψει — ποτέ δεν μικραίνει', () => {
    const straight = tableWith(3);
    const turned = tableWith(3, Math.PI / 6);
    const boxOf = (entity: TableEntity) => {
      __resetTableWorksheetRenameForTests();
      const geometry = computeTableEntityGeometryLive(entity);
      openWorksheetRename({
        entity,
        tab: stripOf(entity).tabs[0],
        mmToWorld: geometry.mmToWorld,
        container: CONTAINER,
        transform: TRANSFORM,
      });
      return getTableWorksheetRename()!.anchorRect;
    };
    const a = boxOf(straight);
    const b = boxOf(turned);
    // Το περιβάλλον κουτί μιας στραμμένης καρτέλας είναι **γνησίως** μεγαλύτερο και στις δύο
    // διαστάσεις. Δύο γωνίες αντί για τέσσερις θα έδιναν κουτί που κόβει τη μισή καρτέλα.
    expect(b.width).toBeGreaterThan(a.width);
    expect(b.height).toBeGreaterThan(a.height);
  });
});

describe('ADR-833 Φ4 — άνοιγμα από ταυτότητα (ο δρόμος του μενού)', () => {
  it('ορατή καρτέλα ⇒ ανοίγει, με τον ίδιο στόχο', () => {
    const entity = tableWith(3);
    const ok = openWorksheetRenameById({
      entity,
      worksheetId: tableWorksheetId('ws2'),
      container: CONTAINER,
      transform: TRANSFORM,
    });
    expect(ok).toBe(true);
    expect(getTableWorksheetRename()?.worksheetId).toBe('ws2');
  });

  it('🔴 φύλλο που ΔΕΝ φαίνεται ⇒ `false` και ΚΑΝΕΝΑ κουτί σε τυχαία θέση', () => {
    const entity = tableWith(3);
    const ok = openWorksheetRenameById({
      entity,
      worksheetId: tableWorksheetId('ws9'),
      container: CONTAINER,
      transform: TRANSFORM,
    });
    expect(ok).toBe(false);
    expect(getTableWorksheetRename()).toBeNull();
  });
});
