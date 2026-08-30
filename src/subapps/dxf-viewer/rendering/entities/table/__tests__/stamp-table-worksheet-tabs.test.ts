/**
 * ADR-833 Φάση 3 — **η λωρίδα καρτελών στον καμβά**: τι ζωγραφίστηκε πραγματικά.
 *
 * ## Γιατί ξεκινά από το `stampTableChromeControls` και ΟΧΙ από τον ζωγράφο της λωρίδας
 * Το μάθημα είναι γραμμένο δίπλα, στο `table-copy-marquee-suppression.test.ts`: εκείνη η
 * λειτουργία είχε **15 πράσινα tests και δεν δούλευε**, γιατί όλα περνούσαν τη σημαία
 * **γραμμένη στο χέρι** — επικύρωναν ότι ο ζωγράφος υπακούει, ποτέ ποιος υπολογίζει.
 *
 * Εδώ δεν κατασκευάζεται κανένα `slot` με το χέρι. Κάθε test ξεκινά από **οντότητα** και
 * διασχίζει την ίδια αλυσίδα με το ζωντανό καρέ:
 *
 * ```
 *   entity → resolveWorksheetFields → tableWorksheetTabLayout → stampTableWorksheetTabs
 * ```
 *
 * @see rendering/entities/table/stamp-table-chrome.ts — ο ένας καλών
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.3
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stampTableChromeControls } from '../stamp-table-chrome';
import { createPaintLog, createRc, totalDrawCalls, type PaintLog } from './table-paint-recorder';
import { buildTableEntity } from '../../../../bim/table/build-table-entity';
import { computeTableEntityGeometryLive } from '../../../../bim/table/table-entity-geometry';
import { tableWorksheetTabLayout } from '../../../../bim/table/table-worksheet-tabs-geometry';
import {
  clearTableIndicatorHover,
  setTableIndicatorHover,
} from '../../../../state/table-indicator-hover-store';
import { TABLE_INDICATOR } from '../../../../config/color-config';
import { tableWorksheetId } from '../../../../types/table-worksheet';
import type { TableEntity } from '../../../../types/table-entity';

const PX_PER_MM = 10;
const WS1 = tableWorksheetId('ws1');

function tableWith(sheetCount: number): TableEntity {
  const base = buildTableEntity({ x: 0, y: 0 }, { columnCount: 4 }, 'tbl_tabs', 'lyr_test');
  const extra = Array.from({ length: sheetCount - 1 }, (_, i) => ({
    id: tableWorksheetId(`ws${i + 1}`),
    model: base.worksheets[0].model,
  }));
  return { ...base, worksheets: [base.worksheets[0], ...extra] };
}

/** Ζωγραφίζει το χρώμιο του πίνακα και επιστρέφει το ημερολόγιο — καμία τιμή στο χέρι. */
function paint(entity: TableEntity, pxPerMm = PX_PER_MM): PaintLog {
  const log = createPaintLog();
  const rc = createRc(log, { pxPerMm, toScreen: (u, v) => ({ x: u * pxPerMm, y: v * pxPerMm }) });
  stampTableChromeControls(rc, entity, computeTableEntityGeometryLive(entity).layout);
  return log;
}

beforeEach(() => {
  clearTableIndicatorHover();
});

describe('ADR-833 Φ3 — τι ζωγραφίζεται', () => {
  it('τρία φύλλα ⇒ τρεις ετικέτες, με το προεπιλεγμένο όνομα της θέσης τους', () => {
    const log = paint(tableWith(3));
    expect(log.texts).toHaveLength(3);
    // Η γλώσσα των tests είναι τα ελληνικά locales — το ουσιώδες είναι ότι είναι **τρία
    // διαφορετικά** ονόματα, δηλαδή ότι πέρασε η θέση καθενός στον επιλυτή.
    expect(new Set(log.texts.map((t) => t.text)).size).toBe(3);
  });

  it('🔑 ΕΝΑ φύλλο ⇒ ΚΑΜΙΑ λωρίδα (χειριστήριο χωρίς τίποτα να ελέγξει)', () => {
    expect(totalDrawCalls(paint(tableWith(1)))).toBe(0);
  });

  it('η ενεργή καρτέλα βάφεται με το ΕΝΕΡΓΟ μπλε, οι υπόλοιπες με το ουδέτερο γκρι', () => {
    const log = paint(tableWith(3));
    const active = log.fills.filter((f) => f === TABLE_INDICATOR.activeFillHex);
    const idle = log.fills.filter((f) => f === TABLE_INDICATOR.fillHex);
    expect(active).toHaveLength(1);
    expect(idle).toHaveLength(2);
  });

  it('🔴 ΔΙΠΛΗ ΚΩΔΙΚΟΠΟΙΗΣΗ (πύλη 3.41): η ενεργή δηλώνεται ΚΑΙ με βάρος, όχι μόνο με χρώμα', () => {
    const log = paint(tableWith(3));
    const bold = log.texts.filter((t) => t.font?.includes('bold'));
    expect(bold).toHaveLength(1);
  });

  it('hover σε καρτέλα ⇒ πλύσιμο, ΜΟΝΟ σε εκείνη και ΜΟΝΟ σε αυτόν τον πίνακα', () => {
    const entity = tableWith(3);
    setTableIndicatorHover({ entityId: entity.id, target: { kind: 'worksheet-tab', worksheetId: WS1 } });
    expect(paint(entity).fills.filter((f) => f === TABLE_INDICATOR.hoverWashRgba)).toHaveLength(1);

    // Ο ίδιος hover, **άλλος** πίνακας: κανένα πλύσιμο.
    setTableIndicatorHover({ entityId: 'tbl_other', target: { kind: 'worksheet-tab', worksheetId: WS1 } });
    expect(paint(entity).fills.filter((f) => f === TABLE_INDICATOR.hoverWashRgba)).toHaveLength(0);
  });

  it('hover σε ΖΩΝΗ (όχι καρτέλα) δεν πλένει καμία καρτέλα', () => {
    const entity = tableWith(3);
    setTableIndicatorHover({ entityId: entity.id, target: { kind: 'select-all' } });
    expect(paint(entity).fills.filter((f) => f === TABLE_INDICATOR.hoverWashRgba)).toHaveLength(0);
  });
});

describe('🔴 ADR-833 Φ3 — LOD: ΔΕΝ ζωγραφίζεται ΚΑΙ ΔΕΝ πιάνεται, τα δύο ΜΑΖΙ', () => {
  const entity = tableWith(3);
  const layout = computeTableEntityGeometryLive(entity).layout;

  it('κάτω από το κατώφλι: μηδέν μελάνι ΚΑΙ μηδέν στόχοι — από την ΙΔΙΑ συνάρτηση', () => {
    const tiny = 0.2;
    expect(totalDrawCalls(paint(entity, tiny))).toBe(0);
    // Το hit-test ρωτά **αυτό**: αν έδινε στόχους ενώ ο ζωγράφος σιωπά, θα ήταν ψέμα της οθόνης.
    expect(
      tableWorksheetTabLayout(entity.worksheets, entity.activeWorksheetId, layout.widthMm, layout.heightMm, tiny),
    ).toEqual([]);
  });

  it('πάνω από το κατώφλι: και τα δύο ζουν', () => {
    expect(totalDrawCalls(paint(entity))).toBeGreaterThan(0);
    expect(
      tableWorksheetTabLayout(entity.worksheets, entity.activeWorksheetId, layout.widthMm, layout.heightMm, PX_PER_MM),
    ).toHaveLength(3);
  });
});

describe('ADR-833 Φ3 — η ετικέτα κόβεται, το ορθογώνιο μένει', () => {
  it('🔑 μακρύ όνομα ⇒ αποκοπή με «…», ΠΟΤΕ υπερχείλιση έξω από την καρτέλα', () => {
    const base = tableWith(2);
    const long = 'Κοστολόγηση Α΄ Φάσης Οικοδομικών Εργασιών';
    const entity: TableEntity = {
      ...base,
      worksheets: [{ ...base.worksheets[0], name: long }, base.worksheets[1]],
    };
    const painted = paint(entity).texts.map((t) => t.text);
    const truncated = painted.find((t) => t.includes('…'));
    expect(truncated).toBeDefined();
    expect(truncated!.length).toBeLessThan(long.length);
    // …και το κομμένο είναι **πρόθεμα** του πραγματικού ονόματος: η αποκοπή δεν εφευρίσκει.
    expect(long.startsWith(truncated!.slice(0, -1))).toBe(true);
  });

  it('η καρτέλα ΔΕΝ αλλάζει πλάτος για να χωρέσει το όνομα (ενιαίο πλάτος, μία χωρητικότητα)', () => {
    // 🔑 Η αναλλοίωτη ρωτιέται από τη **δημόσια είσοδο**, ποτέ από ιδιωτική σταθερά πλάτους:
    // μια σύγκριση με το `TABLE_WORKSHEET_TAB_WIDTH_PX` θα έλεγε «το 64 ισούται με 64» — δηλαδή
    // θα επαλήθευε τον **αριθμό**, ενώ το ερώτημα είναι αν το **όνομα** αλλάζει το πλάτος.
    // Δύο διατάξεις, ίδια πάντα: η μία με μακρύ όνομα, η άλλη χωρίς κανένα.
    const base = tableWith(2);
    const named: TableEntity = {
      ...base,
      worksheets: [{ ...base.worksheets[0], name: 'Κοστολόγηση Α΄ Φάσης' }, base.worksheets[1]],
    };
    const slotsOf = (entity: TableEntity) => {
      const layout = computeTableEntityGeometryLive(entity).layout;
      return tableWorksheetTabLayout(
        entity.worksheets, entity.activeWorksheetId, layout.widthMm, layout.heightMm, PX_PER_MM,
      );
    };
    const namedSlots = slotsOf(named);
    const anonymousSlots = slotsOf(base);
    expect(namedSlots.length).toBe(anonymousSlots.length);
    expect(namedSlots.length).toBeGreaterThan(0);
    for (const [i, slot] of namedSlots.entries()) {
      // ίδιο πλάτος με το ανώνυμο κάτοπτρό της…
      expect(slot.rectMm.w).toBeCloseTo(anonymousSlots[i].rectMm.w);
      // …και ίδιο με κάθε άλλη καρτέλα της **ίδιας** λωρίδας.
      expect(slot.rectMm.w).toBeCloseTo(namedSlots[0].rectMm.w);
    }
  });
});

describe('🔴 ADR-833 Φ3 — ΟΡΑΤΟΤΗΤΑ: μηδέν λωρίδα σε ΜΗ ΕΠΙΛΕΓΜΕΝΟ πίνακα', () => {
  /**
   * Η απόφαση ζει στον `TableRenderer`, σε **μία** γραμμή, και είναι η ίδια που φυλά τον δρομέα
   * και τα δύο χειριστήρια. Ελέγχεται στην πηγή γιατί αυτό **είναι** η προδιαγραφή: αν η κλήση
   * βγει από το `if (selected)`, η λωρίδα μπαίνει στο **normal-state pass** — δηλαδή ψήνεται
   * μέσα στο bitmap cache της σκηνής (ADR-040 κανόνας #3) και τυπώνεται.
   */
  const source = readFileSync(
    join(__dirname, '..', '..', 'TableRenderer.ts'),
    'utf8',
  );

  it('ο ΕΝΑΣ καλών του χρωμίου κάθεται πίσω από το `if (selected)`', () => {
    expect(source).toContain('if (selected) stampTableChromeControls(rc, e, layout);');
  });

  it('…και δεν υπάρχει δεύτερη κλήση του, πουθενά', () => {
    expect(source.match(/stampTableChromeControls/g)).toHaveLength(2); // import + η μία κλήση
  });
});
