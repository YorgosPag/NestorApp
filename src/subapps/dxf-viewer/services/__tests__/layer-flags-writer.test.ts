/**
 * ADR-721 — Το συμβόλαιο της ΜΙΑΣ πόρτας γραφής για μόνιμες ιδιότητες layer.
 *
 * Κάθε test εδώ κλειδώνει μια συγκεκριμένη ιδιότητα που, όταν έλειπε, παρήγαγε πραγματικό
 * σύμπτωμα στην οθόνη του χρήστη. Δεν είναι «κάλυψη» — είναι παγίδες παλινδρόμησης.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { createSceneLayer } from '../../types/entities';
import { getLayer } from '../../stores/LayerStore';
import { setLayerFlags, setLayerFlagsBatch, toggleLayerFlag } from '../layer-flags-writer';
import {
  setupActiveDocument,
  teardownActiveDocument,
  getPersistedLayer,
  expectPersisted,
} from '../../systems/levels/__tests__/active-document-test-harness';
import { __resetActiveDocumentForTesting } from '../../systems/levels/active-document-gateway';

/**
 * Layer **χωρίς** δηλωμένο `visible` — η συνηθισμένη μορφή εισαγμένου DXF.
 *
 * Το `createSceneLayer` γεμίζει πάντα `visible: true`, οπότε το factory από μόνο του ΔΕΝ
 * μπορεί να αναπαραστήσει την πραγματική κατάσταση. Και είναι η κυρίαρχη: στο
 * `47_ergasia.dxf` μετρήθηκαν ζωντανά **58 στα 58** layers με `visible: undefined`. Ένα
 * suite που δοκιμάζει μόνο ρητά `true`/`false` δεν θα έπιανε ποτέ το σφάλμα του πρώτου
 * κλικ — γι' αυτό το αδήλωτο layer φτιάχνεται εδώ ρητά.
 */
function undeclaredVisibilityLayer(id: string, name: string) {
  const { visible: _dropped, ...rest } = createSceneLayer({ id, name });
  return rest as ReturnType<typeof createSceneLayer>;
}

const seed = () =>
  setupActiveDocument([
    createSceneLayer({ id: 'lyr_a', name: 'A', visible: true }),
    undeclaredVisibilityLayer('lyr_b', 'B'),
    createSceneLayer({ id: 'lyr_c', name: 'C', visible: false }),
  ]);

afterEach(teardownActiveDocument);

describe('setLayerFlags — έγγραφο ΚΑΙ runtime προβολή', () => {
  it('γράφει και στις δύο πηγές, ώστε UI και καμβάς να μη μπορούν να αποκλίνουν', () => {
    seed();
    expect(setLayerFlags('lyr_a', { visible: false })).toBe(true);
    // Το κρίσιμο: ΚΑΙ ΤΑ ΔΥΟ. Το αρχικό bug ήταν ακριβώς «το ένα ναι, το άλλο όχι».
    expectPersisted('lyr_a', 'visible', false);
  });

  it('είναι ιδεμποτικό — ίδια τιμή δεν παράγει εγγραφή (άρα ούτε auto-save)', () => {
    seed();
    const before = getPersistedLayer('lyr_a');
    expect(setLayerFlags('lyr_a', { visible: true })).toBe(false);
    // Ίδια ΑΝΑΦΟΡΑ: καμία νέα σκηνή, άρα κανένας κύκλος αποθήκευσης/επαναζωγραφικής.
    expect(getPersistedLayer('lyr_a')).toBe(before);
  });

  it('επιστρέφει false για άγνωστο layer αντί να γράψει μισή αλλαγή', () => {
    seed();
    expect(setLayerFlags('lyr_missing', { visible: false })).toBe(false);
  });

  it('είναι fail-closed χωρίς ενεργό έγγραφο — ΠΟΤΕ runtime-only γραφή', () => {
    seed();
    __resetActiveDocumentForTesting(); // προσομοιώνει «καμία σκηνή φορτωμένη»
    expect(setLayerFlags('lyr_a', { visible: false })).toBe(false);
    // Η προβολή ΔΕΝ άλλαξε. Αν άλλαζε, θα είχαμε ξαναφτιάξει το αρχικό bug: αλλαγή που
    // φαίνεται στην οθόνη αλλά χάνεται στο επόμενο hydration.
    expect(getLayer('lyr_a')?.visible).toBe(true);
  });
});

describe('setLayerFlagsBatch — μία ατομική εγγραφή για πολλά layers', () => {
  it('αλλάζει μόνο όσα διαφέρουν και επιστρέφει το πλήθος τους', () => {
    seed();
    // lyr_c είναι ήδη false ⇒ δεν μετράει· lyr_a/lyr_b αλλάζουν.
    expect(setLayerFlagsBatch(['lyr_a', 'lyr_b', 'lyr_c'], { visible: false })).toBe(2);
    expectPersisted('lyr_a', 'visible', false);
    expectPersisted('lyr_b', 'visible', false);
  });

  it('μία εγγραφή σκηνής για όλη την ομάδα, όχι μία ανά layer', () => {
    seed();
    const before = getPersistedLayer('lyr_a');
    setLayerFlagsBatch(['lyr_a', 'lyr_b'], { visible: false });
    const afterA = getPersistedLayer('lyr_a');
    const afterB = getPersistedLayer('lyr_b');
    expect(afterA).not.toBe(before);
    // Και τα δύο προέκυψαν από την ΙΔΙΑ σκηνή ⇒ ένα βήμα undo, ένα auto-save.
    expect(afterA?.visible).toBe(false);
    expect(afterB?.visible).toBe(false);
  });

  it('κενή αλλαγή ⇒ 0, καμία εγγραφή', () => {
    seed();
    const before = getPersistedLayer('lyr_c');
    expect(setLayerFlagsBatch(['lyr_c'], { visible: false })).toBe(0);
    expect(getPersistedLayer('lyr_c')).toBe(before);
  });
});

describe('toggleLayerFlag — η σημασιολογία του αδήλωτου flag (§1)', () => {
  it('layer με visible ΑΔΗΛΩΤΟ θεωρείται αναμμένο ⇒ το πρώτο κλικ το ΣΒΗΝΕΙ', () => {
    seed();
    expect(getPersistedLayer('lyr_b')?.visible).toBeUndefined();
    toggleLayerFlag('lyr_b', 'visible', true);
    // Το παλιό `!layer.visible` έδινε `!undefined === true` ⇒ ζητούσε «άναψε», δηλαδή
    // το πρώτο κλικ δεν άλλαζε τίποτα ορατό και ο χρήστης χρειαζόταν δεύτερο.
    expectPersisted('lyr_b', 'visible', false);
  });

  it('layer με frozen ΑΔΗΛΩΤΟ θεωρείται ΜΗ παγωμένο ⇒ το πρώτο κλικ το παγώνει', () => {
    seed();
    toggleLayerFlag('lyr_b', 'frozen', false);
    expectPersisted('lyr_b', 'frozen', true);
  });

  it('εναλλάσσει σταθερά σε δεύτερο πάτημα', () => {
    seed();
    toggleLayerFlag('lyr_a', 'visible', true);
    expectPersisted('lyr_a', 'visible', false);
    toggleLayerFlag('lyr_a', 'visible', true);
    expectPersisted('lyr_a', 'visible', true);
  });
});
