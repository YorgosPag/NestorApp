/**
 * 🔴 ADR-032 §1 — Ο ΚΑΘΑΡΟΣ ΚΡΙΤΗΣ ΤΟΥ ΟΠΛΙΣΜΟΥ, ΕΚΤΕΛΕΣΜΕΝΟΣ.
 *
 * «Είναι η μηχανή οπλισμένη για το εργαλείο που δηλώνει ο άνθρωπος;»
 *
 * Αυτή η σουίτα εκτελεί **μόνο** το `resolveDrawingArming` / `ownsDrawingMachine` — καμία
 * React, κανένα store, κανένα δέντρο καμβά. Η **σκανδάλη** (πότε ξανατρέχει ο δεσμός)
 * μετριέται στο αδελφό αρχείο `hooks/drawing/__tests__/useDrawingMachineArming.test.tsx`
 * — δύο ερωτήσεις, δύο αρχεία (CHECK 3.47: κάθε test το τρέχει ΑΚΡΙΒΩΣ ΕΝΑΣ).
 *
 * ## Γιατί υπάρχει
 * Πριν από την §1 **καμία** σουίτα δεν ρώταγε «οπλίζεται η μηχανή όταν επιλέγεται εργαλείο
 * που είναι **ήδη** επιλεγμένο;». Το αποτέλεσμα ήταν εργαλείο που **φαίνεται ενεργό και
 * είναι νεκρό**: η κορδέλα έγραφε `table`, το φάντασμα ακολουθούσε τον κέρσορα, και το
 * κλικ δεν έγραφε τίποτα.
 *
 * ## Οι μεταλλάξεις που πρέπει να κοκκινίσουν (ADR-032 §1.7)
 * · **Μ2** φρουρός **μόνο** με `machineTool === declaredTool` (χωρίς `machineAcceptsPoints`) → **Σ2β**
 * · **Μ3** `ownsDrawingMachine` που δέχεται entity-picking → **Σ5**
 * · **Μ4** αφαίρεση φρουρού (πάντα `'arm'`) → **Σ3 + Σ4**
 * · **Μ5** κριτής που επιστρέφει πάντα `'none'` → **Σ1 + Σ2 + Σ2β**
 *
 * @see docs/centralized-systems/reference/adrs/ADR-032-drawing-state-machine.md §1
 */

import {
  ENTITY_PICKING_TOOLS,
  ownsDrawingMachine,
  resolveDrawingArming,
} from '../drawing-tool-arming';

describe('🔴 ADR-032 §1 — ownsDrawingMachine: ΠΟΙΟΣ ανήκει στη μηχανή σχεδίασης', () => {
  it('Σ5 — τα εργαλεία γωνίας που ΕΠΙΛΕΓΟΥΝ ΟΝΤΟΤΗΤΕΣ δεν ανήκουν (τρέχουν δική τους μηχανή)', () => {
    // Μ3: αν το `ENTITY_PICKING_TOOLS` πάψει να εξαιρείται, αυτά γίνονται `true`.
    for (const tool of ENTITY_PICKING_TOOLS) {
      expect(ownsDrawingMachine(tool)).toBe(false);
    }
    // Η ίδια η λίστα δεν επιτρέπεται να αδειάσει σιωπηλά — τότε η Μ3 θα περνούσε κενή.
    expect(ENTITY_PICKING_TOOLS.size).toBeGreaterThanOrEqual(3);
    expect(ENTITY_PICKING_TOOLS.has('measure-angle-constraint')).toBe(true);
  });

  it('τα εργαλεία σχεδίασης και μέτρησης ανήκουν', () => {
    expect(ownsDrawingMachine('table')).toBe(true);
    expect(ownsDrawingMachine('polyline')).toBe(true);
    expect(ownsDrawingMachine('measure-distance')).toBe(true);
  });

  it('Σ6 — `select`, `null`, `undefined`, κενό: κανείς δεν ανήκει', () => {
    expect(ownsDrawingMachine('select')).toBe(false);
    expect(ownsDrawingMachine(null)).toBe(false);
    expect(ownsDrawingMachine(undefined)).toBe(false);
    expect(ownsDrawingMachine('')).toBe(false);
  });
});

describe('🔴 ADR-032 §1 — resolveDrawingArming: Η ΑΠΟΦΑΣΗ', () => {
  it('Σ1 — ΙΔΙΟ ΕΡΓΑΛΕΙΟ ΞΑΝΑ: δηλωμένο `table`, μηχανή άοπλη ⇒ ΟΠΛΙΣΕ', () => {
    // Ο δρόμος του περιστατικού: το `onCancel()` αφόπλισε, η τιμή του `activeTool` ΔΕΝ
    // άλλαξε ⇒ ο παλιός `useEffect [activeTool]` δεν ξανάτρεχε ποτέ.
    expect(resolveDrawingArming('table', 'select', false)).toBe('arm');
  });

  it('Σ2 — ΦΟΡΤΩΣΗ ΣΕΛΙΔΑΣ: persisted `table`, μηχανή IDLE (`currentTool` = «select») ⇒ ΟΠΛΙΣΕ', () => {
    // Μετρημένο ζωντανά: `machineContext.toolType === null` ⇒ το `drawingState.currentTool`
    // διαβάζεται ως `'select'` (`useUnifiedDrawing`: `toolType || 'select'`).
    expect(resolveDrawingArming('table', 'select', false)).toBe('arm');
  });

  it('🔑 Σ2β — Η ΔΙΑΚΡΙΤΙΚΗ ΠΕΡΙΠΤΩΣΗ: ίδιο όνομα, ΑΛΛΑ άοπλη μηχανή ⇒ ΟΠΛΙΣΕ', () => {
    // ΑΥΤΟ είναι το σενάριο που κάνει το `machineAcceptsPoints` ΖΩΝΤΑΝΟ σκέλος, και είναι
    // υπαρκτή κατάσταση της μηχανής — όχι κατασκευή: στο `CANCEL` και στο `COMPLETE` το
    // `computeNewContext` κάνει `{...currentContext}`, δηλαδή **κρατά** το `toolType`, ενώ
    // οι καταστάσεις `CANCELLED`/`COMPLETED` έχουν `allowsAddPoint: false`.
    // ⇒ `machineTool === 'table'` ΚΑΙ `machineAcceptsPoints === false`.
    //
    // 🔴 Μ2 (φρουρός μόνο με σύγκριση ονομάτων) απαντά εδώ `'none'` ⇒ νεκρό εργαλείο μετά
    // από κάθε Escape / ολοκλήρωση. Χωρίς αυτό το σενάριο η Μ2 βγαίνει ΠΡΑΣΙΝΗ.
    expect(resolveDrawingArming('table', 'table', false)).toBe('arm');
  });

  it('Σ3 — Ο ΒΡΟΧΟΣ: `table` και μηχανή ΟΠΛΙΣΜΕΝΗ για `table` ⇒ ΜΗΝ ΑΓΓΙΞΕΙΣ', () => {
    // Το `startDrawing` γράφει νέο `localState` ⇒ re-render. Χωρίς φρουρό: ατέρμονος βρόχος.
    expect(resolveDrawingArming('table', 'table', true)).toBe('none');
  });

  it('Σ4 — ΤΑ ΦΑΓΩΜΕΝΑ ΣΗΜΕΙΑ: `polyline` ΣΤΗ ΜΕΣΗ πολυγραμμής ⇒ ΜΗΝ ΑΓΓΙΞΕΙΣ', () => {
    // Το `SELECT_TOOL` μηδενίζει τα σημεία (`...DEFAULT_DRAWING_CONTEXT`). Οπλισμός εδώ
    // θα έτρωγε τη δουλειά του ανθρώπου — γι' αυτό ο φρουρός ΔΕΝ είναι λεπτομέρεια.
    expect(resolveDrawingArming('polyline', 'polyline', true)).toBe('none');
  });

  it('Σ5 — entity-picking: η μηχανή σχεδίασης ΔΕΝ οπλίζεται ποτέ για αυτά', () => {
    expect(resolveDrawingArming('measure-angle-constraint', 'select', false)).toBe('none');
    expect(resolveDrawingArming('measure-angle-line-arc', 'select', false)).toBe('none');
  });

  it('Σ6 — `select` / `null` / `undefined` ⇒ καμία ενέργεια', () => {
    expect(resolveDrawingArming('select', 'select', false)).toBe('none');
    expect(resolveDrawingArming(null, 'select', false)).toBe('none');
    expect(resolveDrawingArming(undefined, 'select', false)).toBe('none');
  });

  it('ΑΛΛΑΓΗ ΕΡΓΑΛΕΙΟΥ ΣΤΗ ΜΕΣΗ: δηλωμένο `table` ενώ η μηχανή τρέχει `polyline` ⇒ ΟΠΛΙΣΕ', () => {
    // Η αυθεντία είναι η ΔΗΛΩΣΗ. Όταν οι δύο αλήθειες διαφωνούν, κερδίζει ο άνθρωπος.
    expect(resolveDrawingArming('table', 'polyline', true)).toBe('arm');
  });

  it('η απόφαση είναι ΚΑΘΑΡΗ: ίδιες είσοδοι ⇒ ίδια έξοδος, χωρίς παρενέργεια', () => {
    const a = resolveDrawingArming('table', 'select', false);
    const b = resolveDrawingArming('table', 'select', false);
    expect(a).toBe(b);
    expect(a).toBe('arm');
  });
});
