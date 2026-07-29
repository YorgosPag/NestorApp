/**
 * ADR-724 Φ0 — Το store πλάτους της αγκυρωμένης παλέτας.
 *
 * Το store ενυδατώνεται **στο import** (module-level singleton), οπότε κάθε σενάριο επαναφοράς
 * απαιτεί φρέσκο module. Γι' αυτό `jest.resetModules()` + δυναμικό `import` αντί για
 * `__resetForTesting` export: ένα export που υπάρχει μόνο για τα tests είναι επιφάνεια
 * παραγωγής που κανείς δεν καλεί (και το πιάνει ο dead-code ratchet).
 */

const STORAGE_KEY = 'dxf-viewer:workspace-dock-width:v1';
const MODE_KEY = 'dxf-viewer:workspace-dock-mode:v1';
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

  describe('ADR-040 — συνδρομή ΜΟΝΟ εκεί που η συχνότητα το επιτρέπει', () => {
    /**
     * ⚠️ Ο έλεγχος είναι **ονομαστικός επί σκοπού**. Μέχρι τη Φ2 έλεγε «καμία `subscribe*`
     * επιφάνεια». Η Φ2 πρόσθεσε συνδρομή για την **πλευρά** — και το test κοκκίνισε, όπως
     * όφειλε. Δεν χαλαρώνει σε «τουλάχιστον μία»: ο κίνδυνος που φυλά είναι να προστεθεί
     * κάποτε `subscribeDockedWidth` και να ξαναρενδάρει ο viewer ~60 φορές/δευτ. κατά το
     * σύρσιμο (ADR-040 Φ XXII.B). Άρα η λίστα είναι **ακριβής**, όχι κατώτατο όριο.
     */
    it('συνδρομή υπάρχει για την ΠΛΕΥΡΑ και μόνο — ποτέ για το πλάτος', async () => {
      const store = await freshStore();
      const surface = Object.keys(store).filter((key) => key.toLowerCase().includes('subscribe'));
      expect(surface).toEqual(['subscribeDockMode']);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ADR-724 Φ2 — πλευρά αγκύρωσης + επαναφορά
  // ══════════════════════════════════════════════════════════════════════════

  describe('Φ2 — η πλευρά αγκύρωσης', () => {
    it('χωρίς εγγραφή ⇒ αριστερά (η σημερινή συμπεριφορά)', async () => {
      const store = await freshStore();
      expect(store.getDockMode()).toBe('docked-left');
    });

    it('έγκυρη αποθηκευμένη τιμή ⇒ επιστρέφεται', async () => {
      localStorage.setItem(MODE_KEY, JSON.stringify('docked-right'));
      const store = await freshStore();
      expect(store.getDockMode()).toBe('docked-right');
    });

    it('αλλοιωμένη τιμή ⇒ προεπιλογή, ΟΧΙ άγνωστη κατάσταση στη διάταξη', async () => {
      localStorage.setItem(MODE_KEY, JSON.stringify('sideways'));
      const store = await freshStore();
      expect(store.getDockMode()).toBe('docked-left');
    });

    it('γράφει την πλευρά και επιμένει σε νέα συνεδρία', async () => {
      const first = await freshStore();
      first.setDockMode('docked-right');
      const second = await freshStore();
      expect(second.getDockMode()).toBe('docked-right');
    });

    it('η προεπιλογή αποθηκεύεται ΣΙΩΠΗΡΑ (removeOnDefault) ⇒ η εγγραφή σβήνεται', async () => {
      const store = await freshStore();
      store.setDockMode('docked-right');
      store.setDockMode('docked-left');
      expect(localStorage.getItem(MODE_KEY)).toBeNull();
    });

    it('ειδοποιεί τους συνδρομητές ΜΟΝΟ σε πραγματική αλλαγή', async () => {
      const store = await freshStore();
      const listener = jest.fn();
      store.subscribeDockMode(listener);

      store.setDockMode('docked-right');
      expect(listener).toHaveBeenCalledTimes(1);

      store.setDockMode('docked-right'); // ίδια τιμή ⇒ πλήρες no-op
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('η αλλαγή πλευράς ΔΕΝ αγγίζει το πλάτος (ADR-724 §7)', async () => {
      const store = await freshStore();
      store.setDockedWidth(512);
      store.setDockMode('docked-right');
      expect(store.getDockedWidth()).toBe(512);
    });
  });

  describe('Φ2 — resetDockLayout («Reset palette locations»)', () => {
    /** Το πρόθεμα του ADR-723 — ό,τι έγραψε το `writePanelGeometry` το φέρει. */
    const FLOATING_PREFIX = 'nestor:floating-panel-geometry:v1:';

    it('επαναφέρει πλάτος ΚΑΙ πλευρά σε μία πράξη', async () => {
      const store = await freshStore();
      store.setDockedWidth(700);
      store.setDockMode('docked-right');

      store.resetDockLayout();

      expect(store.getDockedWidth()).toBe(DEFAULT_WIDTH);
      expect(store.getDockMode()).toBe('docked-left');
    });

    it('σβήνει ΚΑΙ τις αιωρούμενες γεωμετρίες — μερική επαναφορά είναι χειρότερη από καμία', async () => {
      localStorage.setItem(`${FLOATING_PREFIX}dxf.layer-manager`, '{"x":10,"y":10,"w":300,"h":400}');
      localStorage.setItem(`${FLOATING_PREFIX}dxf.properties`, '{"x":20,"y":20,"w":300,"h":400}');
      const store = await freshStore();

      store.resetDockLayout();

      expect(localStorage.getItem(`${FLOATING_PREFIX}dxf.layer-manager`)).toBeNull();
      expect(localStorage.getItem(`${FLOATING_PREFIX}dxf.properties`)).toBeNull();
    });

    it('ΔΕΝ αγγίζει ξένα κλειδιά — η επαναφορά διάταξης δεν είναι «καθάρισε τα πάντα»', async () => {
      localStorage.setItem('nestor:some-other-feature', 'κρατήσου');
      const store = await freshStore();

      store.resetDockLayout();

      expect(localStorage.getItem('nestor:some-other-feature')).toBe('κρατήσου');
    });

    it('είναι ιδεμποτεντικό (N.7.2 #3) — δεύτερη κλήση δεν αλλάζει τίποτα', async () => {
      const store = await freshStore();
      store.setDockMode('docked-right');

      store.resetDockLayout();
      const after = { width: store.getDockedWidth(), mode: store.getDockMode() };
      store.resetDockLayout();

      expect({ width: store.getDockedWidth(), mode: store.getDockMode() }).toEqual(after);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADR-724 Φ3 — Η ΤΕΛΕΥΤΑΙΑ ΠΛΕΥΡΑ ΚΑΙ Η ΕΝΑΛΛΑΓΗ
// ═══════════════════════════════════════════════════════════════════════════════

const LAST_SIDE_KEY = 'dxf-viewer:workspace-dock-last-side:v1';

describe('ADR-724 Φ3 — η μνήμη της πλευράς', () => {
  describe('getLastDockedSide / η καταγραφή γίνεται ΜΕΣΑ στο setDockMode', () => {
    it('χωρίς ιστορικό ⇒ η προεπιλεγμένη πλευρά', async () => {
      const store = await freshStore();
      expect(store.getLastDockedSide()).toBe('docked-left');
    });

    it('🔴 κάθε αγκύρωση καταγράφεται — ο καλών δεν χρειάζεται να το θυμηθεί', async () => {
      /*
        Υπάρχουν ΤΕΣΣΕΡΙΣ ανεξάρτητοι καλούντες του `setDockMode` (μενού «⋮», μενού δεξιού
        κλικ, απόθεση σε ζώνη §7.1, διπλό κλικ επικεφαλίδας). Αν η καταγραφή ζούσε στον
        καλούντα, θα αρκούσε ΕΝΑΣ να την ξεχάσει ώστε η παλέτα να «γυρίζει αριστερά»
        ανεξήγητα — και μόνο στη διαδρομή που κανείς δεν δοκίμασε.
      */
      const store = await freshStore();
      store.setDockMode('docked-right');
      expect(store.getLastDockedSide()).toBe('docked-right');
    });

    it('🔴 η αιώρηση ΔΕΝ σβήνει τη μνήμη — αλλιώς δεν υπάρχει «επιστροφή εκεί που ήταν»', async () => {
      const store = await freshStore();
      store.setDockMode('docked-right');
      store.setDockMode('floating');
      expect(store.getDockMode()).toBe('floating');
      expect(store.getLastDockedSide()).toBe('docked-right');
    });

    it('η μνήμη επιβιώνει επανεκκίνησης (είναι ιδιότητα του χρήστη, όχι της συνεδρίας)', async () => {
      const first = await freshStore();
      first.setDockMode('docked-right');
      first.setDockMode('floating');

      const second = await freshStore(); // νέο άνοιγμα του app
      expect(second.getLastDockedSide()).toBe('docked-right');
    });

    it('αλλοιωμένη αποθηκευμένη τιμή «floating» ⇒ προεπιλογή, όχι βρόχος', async () => {
      // Αν περνούσε, το διπλό κλικ θα εναλλασσόταν από αιώρηση σε αιώρηση = τίποτα.
      localStorage.setItem(LAST_SIDE_KEY, JSON.stringify('floating'));
      const store = await freshStore();
      expect(store.getLastDockedSide()).toBe('docked-left');
    });
  });

  describe('toggleDockFloat — η χειρονομία του διπλού κλικ (§8)', () => {
    it('αγκυρωμένη ⇒ αιωρούμενη', async () => {
      const store = await freshStore();
      store.toggleDockFloat();
      expect(store.getDockMode()).toBe('floating');
    });

    it('🔴 αιωρούμενη ⇒ επιστρέφει ΕΚΕΙ ΠΟΥ ΗΤΑΝ, όχι στην προεπιλογή (κανόνας Revit)', async () => {
      const store = await freshStore();
      store.setDockMode('docked-right');
      store.toggleDockFloat();            // → floating
      store.toggleDockFloat();            // → πίσω
      expect(store.getDockMode()).toBe('docked-right');
    });

    it('το ζεύγος είναι ιδεμποτεντικό: δύο εναλλαγές = καμία', async () => {
      const store = await freshStore();
      const before = store.getDockMode();
      store.toggleDockFloat();
      store.toggleDockFloat();
      expect(store.getDockMode()).toBe(before);
    });

    it('η εναλλαγή ΔΕΝ αγγίζει το πλάτος — ο χρήστης δεν ζήτησε άλλο μέγεθος', async () => {
      const store = await freshStore();
      store.setDockedWidth(640);
      store.toggleDockFloat();
      store.toggleDockFloat();
      expect(store.getDockedWidth()).toBe(640);
    });
  });

  describe('resetDockLayout — «Reset palette locations» (§7)', () => {
    it('🔴 επαναφέρει ΚΑΙ τη μνήμη πλευράς, όχι μόνο την τρέχουσα κατάσταση', async () => {
      /*
        Χωρίς αυτό, ο χρήστης πατά «Επαναφορά», βλέπει την παλέτα αριστερά, την αιωρεί με
        διπλό κλικ, ξανα-διπλοκλικάρει — και προσγειώνεται ΔΕΞΙΑ, από μια συνεδρία που
        νόμιζε ότι είχε σβήσει. Μερική επαναφορά είναι χειρότερη από καμία.
      */
      const store = await freshStore();
      store.setDockMode('docked-right');
      store.setDockMode('floating');

      store.resetDockLayout();

      expect(store.getDockMode()).toBe('docked-left');
      expect(store.getLastDockedSide()).toBe('docked-left');
      store.toggleDockFloat();
      store.toggleDockFloat();
      expect(store.getDockMode()).toBe('docked-left');
    });

    it('παραμένει ιδεμποτεντικό με το τρίτο πεδίο (N.7.2 #3)', async () => {
      const store = await freshStore();
      store.setDockMode('floating');
      store.resetDockLayout();
      store.resetDockLayout();
      expect(store.getDockMode()).toBe('docked-left');
      expect(store.getLastDockedSide()).toBe('docked-left');
      expect(store.getDockedWidth()).toBe(DEFAULT_WIDTH);
    });
  });

  describe('η ενυδάτωση δέχεται πλέον το «floating» (Φ3)', () => {
    it('αποθηκευμένο «floating» ⇒ επιστρέφεται, δεν πέφτει στην προεπιλογή', async () => {
      localStorage.setItem(MODE_KEY, JSON.stringify('floating'));
      const store = await freshStore();
      expect(store.getDockMode()).toBe('floating');
    });

    it('άγνωστη κατάσταση ⇒ προεπιλογή (ο φύλακας δεν αφαιρέθηκε)', async () => {
      localStorage.setItem(MODE_KEY, JSON.stringify('docked-top'));
      const store = await freshStore();
      expect(store.getDockMode()).toBe('docked-left');
    });
  });
});
