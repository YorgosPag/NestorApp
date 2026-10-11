/**
 * ⚓ ΑΓΚΥΡΑ Α-19 (ADR-845 §7.15, Ο-32) — **ποιο είναι το ενεργό κτήριο;**
 *
 * ## Ο ισχυρισμός που καταρρέει
 *
 * Το `resolveActiveBuildingId` επέστρεφε το `buildingId` του **πρώτου** level, με
 * γραπτή αιτιολόγηση *«Κάθε linked Level φέρει το ίδιο `buildingId` (ADR-237,
 * link-time), οπότε ο πρώτος αρκεί»*. **Μετρημένα ψευδές**: στα 5 δεμένα ζωντανά
 * επίπεδα υπάρχουν **τρία διαφορετικά** κτήρια. Δύο καταναλωτές — η **σειρά** των
 * επιπέδων *(`LevelPanel`)* και το **modal «Διαχείριση Ορόφων»**
 * *(`DxfViewerDialogs`)* — έπαιρναν έτσι τους ορόφους ενός **αυθαίρετου** κτηρίου,
 * ανεξαρτήτως του τι είχε ανοιχτό ο μηχανικός.
 *
 * ## Η αρχή: τρία σκαλιά, με φθίνουσα βεβαιότητα
 *
 * 1. **Ανοιχτό** — το κτήριο του επιπέδου που δουλεύει αυτή τη στιγμή ο άνθρωπος.
 * 2. **Δηλωμένο** — η διεύθυνση *(`?bldg=`)*. Το ίδιο ιδίωμα με το `?lvl=` του
 *    ADR-400: *«the view lives in the URL as a shareable deep-link»* (Figma /
 *    Google Maps / Autodesk Forge). Δίνει στο πολυ-κτηριακό αυτό που το Revit
 *    πετυχαίνει μόνο με **χωριστά αρχεία** — χωρίς τα χωριστά αρχεία.
 * 3. **Οποιοδήποτε** — legacy έσχατη λύση, ρητά ονομασμένη ως τέτοια.
 *
 * ⚠️ **Η σειρά μετρήθηκε, δεν υποτέθηκε**: με τη διεύθυνση πρώτη, η εμβέλεια
 * **κολλάει** — ο άνθρωπος αλλάζει κτήριο και το «ενεργό» μένει το παλιό για
 * πάντα. Η διεύθυνση είναι η φωνή του **bootstrap**, όχι βέτο πάνω στον άνθρωπο.
 *
 * ⚠️ Το `currentLevelId` είναι **υποχρεωτικό όρισμα** εσκεμμένα: όταν ήταν
 * προαιρετικό, ο μόνος τρόπος να πάρεις σωστή απάντηση ήταν να θυμηθείς να το
 * δώσεις — και **κανένας** από τους δύο καλούντες δεν το θυμόταν.
 */

import {
  resolveActiveBuildingId,
  resolveActiveProjectId,
  resolveSubscriptionBuildingScope,
  resolveUrlBuildingId,
} from '../level-floor-resolution';
import type { Level } from '../config';

const lvl = (over: Partial<Level>): Level => ({ id: 'lvl', name: 'L', ...over }) as Level;

const BLDG_A = 'bldg_aaaaaaaa';
const BLDG_B = 'bldg_bbbbbbbb';
const BLDG_C = 'bldg_cccccccc';

/** Το **μετρημένο** σχήμα: τρία κτήρια σε μία λίστα, όλα ονομασμένα «Κτήριο Α». */
const LIVE_SHAPE: Level[] = [
  lvl({ id: 'lvl_unlinked', name: 'Επίπεδο 1' }),
  lvl({ id: 'lvl_ground_a', name: 'Ισόγειο', buildingId: BLDG_A }),
  lvl({ id: 'lvl_ground_b', name: 'Ισόγειο', buildingId: BLDG_B }),
  lvl({ id: 'lvl_first_c', name: '1ος Όροφος', buildingId: BLDG_C }),
];

describe('Ε1 — τρία σκαλιά, με φθίνουσα βεβαιότητα', () => {
  it('🥇 το ΑΝΟΙΧΤΟ επίπεδο απαντά, και δεν το ακυρώνει παλιά δήλωση της διεύθυνσης', () => {
    expect(resolveActiveBuildingId(LIVE_SHAPE, 'lvl_ground_b', null)).toBe(BLDG_B);
    expect(resolveActiveBuildingId(LIVE_SHAPE, 'lvl_first_c', null)).toBe(BLDG_C);
    // 🔑 Η ΠΑΓΙΔΑ: με τη διεύθυνση πρώτη, αυτό θα επέστρεφε BLDG_C για πάντα.
    expect(resolveActiveBuildingId(LIVE_SHAPE, 'lvl_ground_a', BLDG_C)).toBe(BLDG_A);
  });

  it('🥈 η ΔΗΛΩΣΗ απαντά όταν δεν υπάρχει ανοιχτό επίπεδο με κτήριο — η φωνή του bootstrap', () => {
    expect(resolveActiveBuildingId(LIVE_SHAPE, null, BLDG_C)).toBe(BLDG_C);
    expect(resolveActiveBuildingId(LIVE_SHAPE, 'lvl_unlinked', BLDG_C)).toBe(BLDG_C);
    expect(resolveActiveBuildingId([], null, BLDG_C)).toBe(BLDG_C);
  });

  it('🥉 χωρίς τίποτα από τα δύο, πέφτει σε οποιοδήποτε — ρητή έσχατη λύση', () => {
    expect(resolveActiveBuildingId(LIVE_SHAPE, 'lvl_unlinked', null)).toBe(BLDG_A);
  });

  it('επιστρέφει null όταν δεν υπάρχει καμία απάντηση', () => {
    expect(resolveActiveBuildingId([], null, null)).toBeNull();
    expect(resolveActiveBuildingId(null, null, null)).toBeNull();
    expect(resolveActiveBuildingId([lvl({ id: 'a' })], 'a', null)).toBeNull();
  });

  it('αγνοεί δήλωση που είναι κενή συμβολοσειρά — το κενό δεν είναι ταυτότητα', () => {
    expect(resolveActiveBuildingId(LIVE_SHAPE, 'lvl_unlinked', '')).toBe(BLDG_A);
  });
});

describe('Ε2 — 🔴 ο παλιός κανόνας έδινε ΛΑΘΟΣ απάντηση στο μετρημένο σχήμα', () => {
  it('ο μηχανικός δουλεύει στο κτήριο Γ και το «ενεργό κτήριο» ΔΕΝ είναι πια το Α', () => {
    // Ο παλιός κανόνας ήταν `levels.find(l => l.buildingId)` ⇒ ΠΑΝΤΑ το BLDG_A,
    // ό,τι κι αν είχε ανοιχτό ο άνθρωπος. Εδώ μετριέται ότι δεν ισχύει πια.
    expect(resolveActiveBuildingId(LIVE_SHAPE, 'lvl_first_c', null)).not.toBe(BLDG_A);
  });

  it('και δεν «κολλάει» στο ίδιο κτήριο όταν ο άνθρωπος αλλάζει επίπεδο', () => {
    const seen = ['lvl_ground_a', 'lvl_ground_b', 'lvl_first_c'].map((id) =>
      resolveActiveBuildingId(LIVE_SHAPE, id, null),
    );
    expect(new Set(seen).size).toBe(3);
  });
});

describe('Ε3 — ο αδελφός `resolveActiveProjectId` ΔΕΝ παρασύρεται', () => {
  it('μένει ως έχει: το έργο είναι σταθερό ανά όροφο, το κτήριο όχι', () => {
    // ADR-650 M10: η Θεμελίωση γεννιέται χωρίς `projectId` και δανείζεται
    // εκείνο ενός αδελφού. Αυτή η ανοχή είναι ΣΩΣΤΗ εκεί και ΛΑΘΟΣ στο κτήριο —
    // γι' αυτό οι δύο συναρτήσεις παύουν να είναι καθρέφτες.
    const levels = [lvl({ id: 'f', name: 'Θεμελίωση' }), lvl({ id: 'g', projectId: 'proj_x' })];
    expect(resolveActiveProjectId(levels)).toBe('proj_x');
  });
});

describe('Ε4 — η ΔΙΕΥΘΥΝΣΗ μαθαίνει μόνο από το ανοιχτό επίπεδο (ADR-914)', () => {
  const draft = { id: 'lvl_draft', name: 'Πρόχειρο 1', order: 9, isDefault: false, visible: true } as Level;
  const storey = { ...draft, id: 'lvl_storey', name: 'Ισόγειο', buildingId: 'bldg_A' } as Level;

  it('ανοιχτό επίπεδο με κτήριο ⇒ το κτήριό του', () => {
    expect(resolveUrlBuildingId([draft, storey], 'lvl_storey')).toBe('bldg_A');
  });

  it('🔑 ανοιχτό ΠΡΟΧΕΙΡΟ ⇒ `null`: η διεύθυνση ξεχνά το κτήριο, ώστε το F5 να μην το κρύψει', () => {
    expect(resolveUrlBuildingId([draft, storey], 'lvl_draft')).toBeNull();
    // Το «οποιοδήποτε κτήριο» μένει διαθέσιμο στους καταναλωτές — αλλά ΔΕΝ γράφεται στη διεύθυνση.
    expect(resolveActiveBuildingId([draft, storey], 'lvl_draft', null)).toBe('bldg_A');
  });

  it('κανένα ανοιχτό επίπεδο ακόμη ⇒ `undefined`: καμία γνώμη, η διεύθυνση μένει ως έχει', () => {
    expect(resolveUrlBuildingId([draft, storey], null)).toBeUndefined();
    expect(resolveUrlBuildingId([], 'lvl_not_loaded_yet')).toBeUndefined();
    expect(resolveUrlBuildingId(null, 'lvl_draft')).toBeUndefined();
  });
});

describe('Ε5 — η ΣΥΝΔΡΟΜΗ περιέχει πάντα το ανοιχτό επίπεδο (ADR-914 §2.9)', () => {
  const draft = { id: 'lvl_draft', name: 'Πρόχειρο 1', order: 9, isDefault: false, visible: true } as Level;
  const inA = { ...draft, id: 'lvl_a', name: 'Ισόγειο', buildingId: 'bldg_A' } as Level;
  const inB = { ...draft, id: 'lvl_b', name: 'Γενική κάτοψη', buildingId: 'bldg_B' } as Level;

  it('ανοιχτό επίπεδο ΜΕΣΑ στην εμβέλεια ⇒ η εμβέλεια μένει', () => {
    expect(resolveSubscriptionBuildingScope('bldg_A', [inA, draft], 'lvl_a')).toBe('bldg_A');
  });

  it('🔑 ΠΡΟΧΕΙΡΟ που γεννήθηκε σε στενεμένη συνεδρία ⇒ καμία εμβέλεια: αλλιώς δεν θα ερχόταν ποτέ', () => {
    expect(resolveSubscriptionBuildingScope('bldg_A', [inA, draft], 'lvl_draft')).toBeNull();
  });

  it('κάτοψη ΑΛΛΟΥ κτηρίου ⇒ η εμβέλεια το ακολουθεί', () => {
    expect(resolveSubscriptionBuildingScope('bldg_A', [inA, inB], 'lvl_b')).toBe('bldg_B');
  });

  it('χωρίς εμβέλεια δεν ΣΤΕΝΕΥΕΙ ποτέ — ο μηχανικός δεν κλειδώνεται στο ανοιχτό κτήριο', () => {
    expect(resolveSubscriptionBuildingScope(null, [inA, inB], 'lvl_a')).toBeNull();
  });

  it('άγνωστο ή κανένα ανοιχτό επίπεδο ⇒ η εμβέλεια μένει ως έχει', () => {
    expect(resolveSubscriptionBuildingScope('bldg_A', [inA], null)).toBe('bldg_A');
    expect(resolveSubscriptionBuildingScope('bldg_A', [inA], 'lvl_not_loaded_yet')).toBe('bldg_A');
    expect(resolveSubscriptionBuildingScope('bldg_A', null, 'lvl_a')).toBe('bldg_A');
  });
});
