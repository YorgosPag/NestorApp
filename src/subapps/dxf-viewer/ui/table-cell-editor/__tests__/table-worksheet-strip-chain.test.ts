/**
 * ADR-833 Φάση 4 — **Η ΑΛΥΣΙΔΑ ΤΗΣ ΛΩΡΙΔΑΣ, ΑΠΟ ΤΗΝ ΟΝΤΟΤΗΤΑ ΩΣ ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΟΥ ΠΑΤΗΜΑΤΟΣ.**
 *
 * ## Γιατί ξεκινά από **οντότητα + σημείο κόσμου** και όχι από `slot` γραμμένο στο χέρι
 * Το μάθημα είναι γραμμένο δίπλα, στο `table-copy-marquee-suppression.test.ts`: εκείνη η
 * λειτουργία είχε **15 πράσινα tests και δεν δούλευε**, γιατί τα tests ρωτούσαν τα εσωτερικά
 * αντί για την αλυσίδα που τρέχει. Εδώ κάθε έλεγχος διασχίζει **ολόκληρη** τη διαδρομή:
 *
 * ```
 *   entity + world → tableWorksheetStripAtWorld → tablePointerHitAtWorld → 'worksheet-tab' | 'worksheet-add'
 * ```
 *
 * 🔴 Και καρφώνει την **αιτία** που το ⊕ χρειάστηκε λέξη στο `where`: χωρίς αυτήν, ο φύλακας
 * του §29 θα έκοβε το `mousedown` σε σύλληψη στο `document` — δηλαδή το κουμπί θα ήταν ορατό,
 * οπλισμένο και **άφταστο** (το περιστατικό §40.8, προεξοφλημένο).
 *
 * @see ../table-worksheet-tab-probe.ts
 * @see ../table-cell-pointer-hit.ts
 */

import { tableWorksheetStripAtWorld } from '../table-worksheet-tab-probe';
import { tablePointerHitAtWorld } from '../table-cell-pointer-hit';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import { computeTableEntityGeometryLive, tableFrameToWorld } from '../../../bim/table/table-entity-geometry';
import { tableWorksheetTabStrip } from '../../../bim/table/table-worksheet-tabs-geometry';
import { resolveWorksheetFields } from '../../../bim/table/table-worksheet-resolve';
import { tableWorksheetId } from '../../../types/table-worksheet';
import type { TableEntity } from '../../../types/table-entity';
import type { TableRectMm } from '../../../bim/table/table-layout-types';

/** Κλίμακα προβολής που δίνει άνετη λωρίδα στον προεπιλεγμένο πίνακα. */
const VIEW_SCALE = 40;

function tableWith(sheetCount: number): TableEntity {
  const base = buildTableEntity({ x: 0, y: 0 }, { columnCount: 4 }, 'tbl_strip', 'lyr_test');
  const extra = Array.from({ length: sheetCount - 1 }, (_, i) => ({
    id: tableWorksheetId(`ws${i + 1}`),
    model: base.worksheets[0].model,
  }));
  return { ...base, worksheets: [base.worksheets[0], ...extra] };
}

/** Η λωρίδα **όπως τη βλέπει ο ζωγράφος** σε αυτή την κλίμακα. */
function stripOf(entity: TableEntity) {
  const geometry = computeTableEntityGeometryLive(entity);
  const { worksheets, activeWorksheetId } = resolveWorksheetFields(entity);
  return tableWorksheetTabStrip(
    worksheets,
    activeWorksheetId,
    geometry.layout.widthMm,
    geometry.layout.heightMm,
    geometry.mmToWorld * VIEW_SCALE,
  );
}

/** Το κέντρο ενός ορθογωνίου της λωρίδας, σε συντεταγμένες **κόσμου**. */
function centreWorld(entity: TableEntity, rectMm: TableRectMm) {
  const { mmToWorld } = computeTableEntityGeometryLive(entity);
  return tableFrameToWorld(entity, rectMm.x + rectMm.w / 2, rectMm.y + rectMm.h / 2, mmToWorld);
}

describe('ADR-833 Φ4 — η λωρίδα απαντά ΜΙΑ φορά, για δύο πράγματα', () => {
  const entity = tableWith(3);
  const strip = stripOf(entity);

  it('το δείγμα έχει και καρτέλες και ⊕ (αλλιώς κάθε έλεγχος από κάτω είναι κενός)', () => {
    expect(strip.tabs.length).toBeGreaterThan(1);
    expect(strip.add).not.toBeNull();
  });

  it('🔑 το κέντρο κάθε ΚΑΡΤΕΛΑΣ ⇒ `{ kind: "tab" }` με το ΙΔΙΟ φύλλο', () => {
    for (const tab of strip.tabs) {
      const hit = tableWorksheetStripAtWorld(
        entity,
        centreWorld(entity, tab.rectMm),
        computeTableEntityGeometryLive(entity),
        VIEW_SCALE,
      );
      expect(hit).toEqual({ kind: 'tab', tab });
    }
  });

  it('🔴 το κέντρο του ⊕ ⇒ `{ kind: "add" }`, ΠΟΤΕ καρτέλα', () => {
    const hit = tableWorksheetStripAtWorld(
      entity,
      centreWorld(entity, strip.add!),
      computeTableEntityGeometryLive(entity),
      VIEW_SCALE,
    );
    expect(hit).toEqual({ kind: 'add' });
  });
});

describe('🔴 ADR-833 Φ4 — ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΟΥ ΠΑΤΗΜΑΤΟΣ: ο φύλακας του §29 ΞΕΡΕΙ το ⊕', () => {
  const entity = tableWith(3);
  const strip = stripOf(entity);

  it('καρτέλα ⇒ `where === "worksheet-tab"`, με το slot που ζωγραφίστηκε', () => {
    const tab = strip.tabs[1];
    const hit = tablePointerHitAtWorld(entity, centreWorld(entity, tab.rectMm), VIEW_SCALE);
    expect(hit).toEqual({ where: 'worksheet-tab', tab });
  });

  it('🔴 ⊕ ⇒ `where === "worksheet-add"` — η λέξη ΧΩΡΙΣ την οποία το κουμπί θα ήταν άφταστο', () => {
    const hit = tablePointerHitAtWorld(entity, centreWorld(entity, strip.add!), VIEW_SCALE);
    expect(hit).toEqual({ where: 'worksheet-add' });
  });

  it('🔑 το ⊕ ΔΕΝ γίνεται ποτέ «καρτέλα»: οι δύο περιοχές δεν τέμνονται', () => {
    const addHit = tablePointerHitAtWorld(entity, centreWorld(entity, strip.add!), VIEW_SCALE);
    const tabHits = strip.tabs.map((tab) =>
      tablePointerHitAtWorld(entity, centreWorld(entity, tab.rectMm), VIEW_SCALE),
    );
    expect(tabHits.every((hit) => hit?.where === 'worksheet-tab')).toBe(true);
    expect(addHit?.where).toBe('worksheet-add');
  });

  it('μέσα στο πλέγμα ⇒ κελί, ποτέ λωρίδα (η λωρίδα ζει ΕΞΩ από το χαρτί)', () => {
    const { layout, mmToWorld } = computeTableEntityGeometryLive(entity);
    const inside = tableFrameToWorld(entity, layout.widthMm / 2, layout.heightMm / 2, mmToWorld);
    expect(tablePointerHitAtWorld(entity, inside, VIEW_SCALE)?.where).toBe('cell');
  });
});

describe('ADR-833 Φ4 — ένα φύλλο: το ⊕ υπάρχει, η καρτέλα του κι εκείνη', () => {
  const entity = tableWith(1);
  const strip = stripOf(entity);

  it('🔴 η λωρίδα ΔΕΝ είναι κενή πια — και το ⊕ πιάνεται', () => {
    expect(strip.add).not.toBeNull();
    expect(tablePointerHitAtWorld(entity, centreWorld(entity, strip.add!), VIEW_SCALE)?.where)
      .toBe('worksheet-add');
  });

  it('η μοναδική καρτέλα πιάνεται κι αυτή (δεν είναι διακοσμητική)', () => {
    expect(strip.tabs).toHaveLength(1);
    expect(tablePointerHitAtWorld(entity, centreWorld(entity, strip.tabs[0].rectMm), VIEW_SCALE)?.where)
      .toBe('worksheet-tab');
  });
});
