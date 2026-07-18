/**
 * ADR-677 Φάση 2 (G1) — το ring πλάτους κουφώματος ερμηνεύει την πληκτρολογούμενη τιμή στη
 * **display μονάδα του χρήστη**, όπως ΚΑΘΕ άλλο μήκος (τοίχος/γραμμή/grip-drag).
 *
 * ⚠️ ΠΡΟΣΟΧΗ — αυτό το αρχείο ΑΝΤΙΣΤΡΕΨΕ προηγούμενη συμπεριφορά, σκόπιμα.
 * Μέχρι τις 2026-07-18 το ίδιο test κατοχύρωνε το ΑΝΤΙΘΕΤΟ («η τιμή = mm, ΟΧΙ display unit»),
 * γιατί το ribbon combobox «Πλάτος» δείχνει 700/800/900… mm. Ο Giorgio το αναίρεσε ρητά
 * (ADR-677 §6, αποφάσεις #2/#3): ΕΝΑ project unit παντού — δύο πεδία στο ΙΔΙΟ
 * `DynamicInputLockStore.length` slot ΔΕΝ επιτρέπεται να ερμηνεύουν πλήκτρα σε διαφορετική
 * μονάδα ανάλογα με το ενεργό εργαλείο. **Αν σκέφτεσαι να το γυρίσεις πίσω σε mm, διάβασε
 * πρώτα το ADR-677 §6 — δεν είναι bug, είναι απόφαση.**
 *
 * Το πεδίο είναι πλέον ο ΚΟΙΝΟΣ `lengthRingField` — μηδέν bespoke builder (N.18).
 */

import { OPENING_WIDTH_RING_CONFIG } from '../opening-width-ring-config';
import { lengthRingField } from '../ring-config';
import { DynamicInputLockStore } from '../DynamicInputLockStore';
import type { DisplayUnit } from '../../../config/units';
import type { SceneUnits } from '../../../utils/scene-units';

const ctx = (displayUnit: DisplayUnit) => ({ displayUnit, sceneUnits: 'mm' as SceneUnits });

describe('ADR-677 G1 — OPENING_WIDTH_RING_CONFIG σέβεται τον επιλογέα μονάδας', () => {
  afterEach(() => DynamicInputLockStore.unlock());

  const field = () => OPENING_WIDTH_RING_CONFIG.fields[0];

  it('έχει ΕΝΑ πεδίο «Μήκος»', () => {
    expect(OPENING_WIDTH_RING_CONFIG.fields).toHaveLength(1);
    expect(field().key).toBe('length');
  });

  it('σε μέτρα (το νέο default): 0.9 → 900mm', () => {
    field().commitNumeric?.(0.9, ctx('m'));
    expect(DynamicInputLockStore.getLocked().length).toBeCloseTo(900, 9);
  });

  it('σε εκατοστά: 10 → 100mm (ΟΧΙ 10 — αυτό ήταν η παλιά mm-native συμπεριφορά)', () => {
    field().commitNumeric?.(10, ctx('cm'));
    expect(DynamicInputLockStore.getLocked().length).toBeCloseTo(100, 9);
  });

  it('σε χιλιοστά: 700 → 700mm (ταυτοτικό — το παλιό ribbon preset εξακολουθεί να δουλεύει)', () => {
    field().commitNumeric?.(700, ctx('mm'));
    expect(DynamicInputLockStore.getLocked().length).toBeCloseTo(700, 9);
  });

  it('seed: locked scene → string στην display μονάδα', () => {
    DynamicInputLockStore.lockLength(900);
    expect(field().seed(ctx('m'))).toBe('0.900');
    expect(field().seed(ctx('cm'))).toBe('90.00');
    expect(field().seed(ctx('mm'))).toBe('900');
  });

  it('clearOnPlace ξεκλειδώνει το μήκος (one-shot direct-distance entry)', () => {
    DynamicInputLockStore.lockLength(80);
    field().clearOnPlace?.();
    expect(DynamicInputLockStore.getLocked().length).toBeNull();
  });

  it('ΤΑΥΤΙΖΕΤΑΙ με τον κοινό lengthRingField τοίχου/γραμμής — μηδέν bespoke διπλότυπο', () => {
    // Η πραγματική εγγύηση SSoT: ίδιος builder ⇒ ίδια σημασιολογία σε commit ΚΑΙ seed.
    const shared = lengthRingField('tools.ring.length');

    shared.commitNumeric?.(1.25, ctx('m'));
    const viaShared = DynamicInputLockStore.getLocked().length;
    DynamicInputLockStore.unlock();

    field().commitNumeric?.(1.25, ctx('m'));
    expect(DynamicInputLockStore.getLocked().length).toBe(viaShared);

    DynamicInputLockStore.lockLength(1234);
    expect(field().seed(ctx('m'))).toBe(shared.seed(ctx('m')));
  });
});
