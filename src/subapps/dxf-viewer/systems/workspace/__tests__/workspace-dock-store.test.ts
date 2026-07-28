/**
 * ADR-724 Φ0 — Το store πλάτους της αγκυρωμένης παλέτας.
 *
 * Το store ενυδατώνεται **στο import** (module-level singleton), οπότε κάθε σενάριο επαναφοράς
 * απαιτεί φρέσκο module. Γι' αυτό `jest.resetModules()` + δυναμικό `import` αντί για
 * `__resetForTesting` export: ένα export που υπάρχει μόνο για τα tests είναι επιφάνεια
 * παραγωγής που κανείς δεν καλεί (και το πιάνει ο dead-code ratchet).
 */

const STORAGE_KEY = 'dxf-viewer:workspace-dock-width:v1';
const DEFAULT_WIDTH = 384;
const MIN_WIDTH = 280;
const MAX_WIDTH = 720;

type DockStore = typeof import('../workspace-dock-store');

async function freshStore(): Promise<DockStore> {
  jest.resetModules();
  return import('../workspace-dock-store');
}

beforeEach(() => {
  localStorage.clear();
});

describe('ADR-724 — workspace-dock-store', () => {
  describe('ενυδάτωση (η αποθηκευμένη τιμή είναι ιστορικό, όχι αλήθεια)', () => {
    it('χωρίς εγγραφή ⇒ η προεπιλογή', async () => {
      const store = await freshStore();
      expect(store.getDockedWidth()).toBe(DEFAULT_WIDTH);
    });

    it('έγκυρη αποθηκευμένη τιμή ⇒ επιστρέφεται', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(512));
      const store = await freshStore();
      expect(store.getDockedWidth()).toBe(512);
    });

    it('τιμή εκτός ορίων (άλλη οθόνη / παλιά έκδοση) ⇒ περιορίζεται, δεν εμπιστεύεται ωμή', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(4000));
      const store = await freshStore();
      expect(store.getDockedWidth()).toBe(MAX_WIDTH);
    });

    it('υπερβολικά στενή αποθηκευμένη τιμή ⇒ ανεβαίνει στο ελάχιστο', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(40));
      const store = await freshStore();
      expect(store.getDockedWidth()).toBe(MIN_WIDTH);
    });

    it.each([
      ['μη-αριθμός', JSON.stringify('384')],
      ['αντικείμενο άλλου σχήματος', JSON.stringify({ width: 512 })],
      ['null', JSON.stringify(null)],
      ['κατεστραμμένο JSON', '{oops'],
    ])('%s ⇒ πέφτει πίσω στην προεπιλογή, χωρίς exception', async (_label, raw) => {
      localStorage.setItem(STORAGE_KEY, raw);
      const store = await freshStore();
      expect(store.getDockedWidth()).toBe(DEFAULT_WIDTH);
    });
  });

  describe('setDockedWidth', () => {
    it('γράφει το πλάτος και επιμένει', async () => {
      const store = await freshStore();
      store.setDockedWidth(500);
      expect(store.getDockedWidth()).toBe(500);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(500));
    });

    it('περιορίζει ό,τι μέτρησε το DOM — ο καλών δεν είναι υπεύθυνος για τα όρια', async () => {
      const store = await freshStore();
      store.setDockedWidth(9999);
      expect(store.getDockedWidth()).toBe(MAX_WIDTH);
    });

    it('η προεπιλογή αποθηκεύεται ΣΙΩΠΗΡΑ (removeOnDefault) ⇒ η εγγραφή σβήνεται', async () => {
      const store = await freshStore();
      store.setDockedWidth(500);
      store.setDockedWidth(DEFAULT_WIDTH);
      expect(store.getDockedWidth()).toBe(DEFAULT_WIDTH);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('ίδια τιμή ⇒ ΚΑΜΙΑ εγγραφή στο localStorage (πλήρες no-op)', async () => {
      const store = await freshStore();
      store.setDockedWidth(500);
      localStorage.removeItem(STORAGE_KEY); // αν ξαναγράψει, θα ξαναεμφανιστεί
      store.setDockedWidth(500);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('η επανα-ενυδάτωση βλέπει την τελευταία τιμή (γύρος μετ᾽ επιστροφής)', async () => {
      const first = await freshStore();
      first.setDockedWidth(640);
      const second = await freshStore();
      expect(second.getDockedWidth()).toBe(640);
    });
  });

  describe('ADR-040 — το store ΔΕΝ εκθέτει συνδρομή στο πλάτος', () => {
    it('καμία `subscribe*` επιφάνεια: το πλάτος ζει στο DOM κατά τη χειρονομία', async () => {
      const store = await freshStore();
      const surface = Object.keys(store).filter((key) => key.toLowerCase().includes('subscribe'));
      expect(surface).toEqual([]);
    });
  });
});
