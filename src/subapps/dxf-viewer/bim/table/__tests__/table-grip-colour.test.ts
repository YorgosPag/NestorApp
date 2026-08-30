/**
 * 🔴 ADR-739 Φ.Γ — **Η ΤΑΥΤΟΤΗΤΑ ΧΡΩΜΑΤΟΣ ΤΩΝ ΛΑΒΩΝ ΠΛΑΤΟΥΣ ΣΤΗΛΗΣ.**
 *
 * Giorgio 2026-08-03: «ξεχώρισε το χρώμα των λαβών που αλλάζουν το πλάτος των στηλών».
 * Είναι οι μόνες από τις έντεκα λαβές του πίνακα που κάνουν κάτι **τοπικό** (μία στήλη)·
 * όλες οι άλλες μετακινούν, στρέφουν ή κλιμακώνουν τον πίνακα συνολικά. Και μοιράζονται
 * την ίδια ακμή, οπότε χωρίς διάκριση διαβάζονται ως ένα αδιαφοροποίητο πλήθος.
 *
 * ## Δύο ερωτήσεις που καμία υπάρχουσα σουίτα δεν ρωτά
 *
 * 1. **«Το παίρνουν ΜΟΝΟ αυτές;»** Αν το έπαιρναν όλες, καμία δεν θα ξεχώριζε — η
 *    διάκριση θα υπήρχε στον κώδικα και όχι στην οθόνη.
 * 2. **«Ξεχωρίζει ΠΡΑΓΜΑΤΙΚΑ;»** Το χρώμα λαβής είναι κανάλι **κατάστασης** (ηρεμία /
 *    hover / σύρσιμο / οπλισμένη / στόχος έλξης). Μια ταυτότητα που πέφτει κοντά σε
 *    κάποια από αυτές δεν «ξεχωρίζει» — **ψεύδεται**: η λαβή θα διαβαζόταν μονίμως ως
 *    hovered ή ως συρόμενη. Η απόσταση από ΚΑΘΕ χρώμα κατάστασης είναι μέρος του ορισμού
 *    και όχι θέμα γούστου, γι' αυτό **μετριέται** εδώ αντί να «φαίνεται καλά».
 *
 * ## ⚠️ Τι ΔΕΝ καλύπτει
 * Τη μία γραμμή του `TableRenderer.getGrips` που διοχετεύει το χρώμα στο `GripInfo`. Ο
 * renderer τραβά ολόκληρη την αλυσίδα ως το Firebase όταν εισαχθεί σε test — γι' αυτό η
 * απόφαση **ζει στη λαβή** (`tableGripCustomColor`) και όχι στον ζωγράφο, ώστε το μέρος
 * που μπορεί να είναι λάθος να είναι και το μέρος που δοκιμάζεται. Η ζωντανή επαλήθευση
 * της διοχέτευσης γίνεται στην οθόνη.
 *
 * @see rendering/grips/__tests__/grip-color-state-not-type.test.ts — ο κανόνας που τηρείται
 */

import { getTableGrips, tableGripCustomColor, TABLE_COLUMN_KIND } from '../table-entity-grips';
import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
import {
  GRIP_ARMED_COLOR,
  GRIP_COLD_COLOR,
  GRIP_HOT_COLOR,
  GRIP_REST_LANDING_COLOR,
  GRIP_SNAPPABLE_COLOR,
  GRIP_TABLE_COLUMN_EDGE_COLOR,
  GRIP_WARM_COLOR,
} from '../../../config/color-config';
import type { TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import { tableWorksheetFields } from './make-table-entity';

beforeEach(() => {
  useDrawingScaleStore.setState({ drawingScale: 1 });
});

/** Τρεις στήλες ⇒ **δύο** εσωτερικά όρια: το test δεν μπορεί να περάσει με μηδέν λαβές. */
const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
  { id: 'c2', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'text', align: 'left' },
  { id: 'c3', sizing: { kind: 'fixed', widthMm: 30 }, valueType: 'text', align: 'left' },
];
const ROWS: TableRow[] = [
  { id: 'r1', rowClass: 'header', heightMm: 8 },
  { id: 'r2', rowClass: 'data', heightMm: 8 },
];

const entity: TableEntity = {
  id: 'tbl_colour',
  type: 'table',
  layerId: 'lyr_test',
  position: { x: 0, y: 0 },
  angleRad: 0,
  styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
  ...tableWorksheetFields(toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS }))),
};

/** `#RRGGBB` → κανάλια. Το SSoT χρωμάτων γράφει πάντα 6ψήφια hex. */
function rgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Ευκλείδεια απόσταση στον χώρο RGB (0 … ~441). */
function distance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

describe('tableGripCustomColor — ποιες λαβές παίρνουν ταυτότητα χρώματος', () => {
  it('🔴 ΜΟΝΟ οι λαβές ορίων (στήλης + γραμμής) — αν τη βάφαμε παντού, καμία δεν θα ξεχώριζε', () => {
    // Τρέχει τις **ΠΡΑΓΜΑΤΙΚΕΣ** λαβές, όχι στημένη λίστα kinds: αν αύριο μια νέα λαβή
    // γεννηθεί με kind που αρχίζει από `table-column`, εδώ θα φανεί.
    const coloured = getTableGrips(entity)
      .map((g) => tableGripCustomColor(g.gripKind?.kind as never))
      .filter((c) => c !== undefined);

    // 3 στήλες ⇒ 2 εσωτερικά όρια· 2 γραμμές ⇒ 1 (Giorgio 2026-08-04: λαβές ύψους γραμμής,
    // ίδιο χρώμα — ίδια **εμβέλεια**). Ακριβές πλήθος: αν κάποιος αφαιρέσει τις λαβές ορίου,
    // το test δεν γίνεται σιωπηλά πράσινο με κενή λίστα.
    expect(coloured).toHaveLength(3);
    for (const c of coloured) expect(c).toBe(GRIP_TABLE_COLUMN_EDGE_COLOR);
  });

  it('οι υπόλοιπες δέκα μένουν στο κανάλι ΚΑΤΑΣΤΑΣΗΣ (σιέλ σε ηρεμία, θερμαίνονται)', () => {
    const grips = getTableGrips(entity);
    const uncoloured = grips.filter((g) => tableGripCustomColor(g.gripKind?.kind as never) === undefined);
    expect(grips).toHaveLength(13); // σταυρός + τόξο + 8 περιμετρικές + 2 όρια στηλών + 1 γραμμών
    expect(uncoloured).toHaveLength(10);
  });

  it('η απόφαση κρέμεται από το KIND, όχι από τον δείκτη της λαβής στον πίνακα', () => {
    // Αν κρεμόταν από δείκτη, η προσθήκη μιας λαβής θα μετακινούσε σιωπηλά το χρώμα.
    expect(tableGripCustomColor(TABLE_COLUMN_KIND)).toBe(GRIP_TABLE_COLUMN_EDGE_COLOR);
    expect(tableGripCustomColor('table-move')).toBeUndefined();
    expect(tableGripCustomColor('table-rotation')).toBeUndefined();
    expect(tableGripCustomColor('table-corner-ne')).toBeUndefined();
    expect(tableGripCustomColor('table-edge-n')).toBeUndefined();
    expect(tableGripCustomColor(undefined)).toBeUndefined();
  });
});

describe('🔴 Η ταυτότητα ΔΕΝ επιτρέπεται να μοιάζει με χρώμα κατάστασης', () => {
  /** Ό,τι σημαίνει ήδη κάτι στο κανάλι χρώματος λαβής. */
  const RESERVED: ReadonlyArray<readonly [string, string]> = [
    ['ηρεμία (cold)', GRIP_COLD_COLOR],
    ['hover (warm)', GRIP_WARM_COLOR],
    ['σύρσιμο (hot)', GRIP_HOT_COLOR],
    ['οπλισμένη (armed)', GRIP_ARMED_COLOR],
    ['στόχος έλξης (snappable)', GRIP_SNAPPABLE_COLOR],
    ['πλατύσκαλο σκάλας (ADR-637)', GRIP_REST_LANDING_COLOR],
  ];

  /**
   * Κατώφλι αντιληπτής διάκρισης σε RGB. Δεν είναι χαραγμένο πάνω στην τρέχουσα τιμή για
   * να «περνά»: η πλησιέστερη δεσμευμένη απόχρωση είναι το magenta του hover, σε απόσταση
   * ≈156, οπότε το 100 αφήνει πραγματικό περιθώριο και θα κοκκινίσει σε αληθινή σύγκλιση.
   */
  const MIN_DISTANCE = 100;

  it.each(RESERVED)('απέχει αισθητά από: %s', (_label, reserved) => {
    expect(GRIP_TABLE_COLUMN_EDGE_COLOR.toLowerCase()).not.toBe(reserved.toLowerCase());
    expect(distance(GRIP_TABLE_COLUMN_EDGE_COLOR, reserved)).toBeGreaterThan(MIN_DISTANCE);
  });

  it('δεν είναι πράσινο — στο AutoCAD το πράσινο σημαίνει hover (ο λόγος που έφυγε το #00ff80)', () => {
    const [r, g, b] = rgb(GRIP_TABLE_COLUMN_EDGE_COLOR);
    expect(g > r && g > b).toBe(false);
  });
});
