/**
 * ΑΓΚΥΡΕΣ ΤΩΝ ΤΡΙΩΝ ΚΑΝΟΝΩΝ ΤΟΥ ΨΕΥΔΩΝΥΜΟΥ — Ψ1 · Ψ2 · Ψ3 (ADR-787 §5.3 δ)
 *
 * ⚠️ **Ο Ψ1 (μοναδικότητα σκελετού) ΔΕΝ κρίνεται εδώ** — απαιτεί ανάγνωση βάσης.
 * Εδώ φυλάσσεται ό,τι απαντιέται από **το ίδιο το κείμενο**: γραμματική, σενάριο
 * γραφής, δεσμευμένες λέξεις — και **η σειρά τους**, που είναι συμβόλαιο.
 */

import { judgeAliasShape, reservedAliases, reservedReason } from '../alias-rules';
import { ALIAS_MAX_LENGTH, PERSONAL_WORKSPACE_ALIAS } from '@/types/workspace-alias';

const GREEK_OMICRON = 'ο';
const GREEK_NU_CAPITAL = 'Ν';
const CYRILLIC_A = 'а';

/** Βοηθός: η αιτία απόρριψης, ή `'ok'`. */
const why = (candidate: string): string => {
  const v = judgeAliasShape(candidate);
  return v.ok ? 'ok' : v.reason;
};

// =============================================================================
// Μ0 — ΠΑΡΟΝΟΜΑΣΤΗΣ: τα νόμιμα ονόματα ΠΕΡΝΟΥΝ
// =============================================================================

describe('Μ0 — παρονομαστής: η πύλη δεν είναι μονίμως κόκκινη', () => {
  it.each([
    'pagonis',
    'nestor-construct',
    'παγωνης',
    'κατασκευες',
    'a1domi',
    'gm-tech',
    'abc',
  ])('Μ0: «%s» γίνεται δεκτό', (name) => {
    expect(why(name)).toBe('ok');
  });

  it('Μ0β: το δεκτό ψευδώνυμο επιστρέφει ΚΑΙ τον σκελετό του', () => {
    const verdict = judgeAliasShape('Pagonis');
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) throw new Error('αδύνατο');
    expect(verdict.alias).toBe('pagonis');
    expect(verdict.skeleton).toBeTruthy();
  });
});

// =============================================================================
// Ψ2 — ΕΝΑ ΣΕΝΑΡΙΟ ΓΡΑΦΗΣ
// =============================================================================

describe('Ψ2 — ένα σενάριο γραφής ανά ψευδώνυμο', () => {
  it('Ψ2.1: ΟΛΟ ελληνικό ⇒ δεκτό (η εφαρμογή είναι ελληνική)', () => {
    expect(why('τοπογραφικο')).toBe('ok');
  });

  it('Ψ2.2: ΟΛΟ λατινικό ⇒ δεκτό', () => {
    expect(why('topografiko')).toBe('ok');
  });

  it('Ψ2.3: 🔴 ΜΙΞΗ ⇒ απόρριψη ΑΚΟΜΑ ΚΑΙ ΣΕ ΑΔΕΙΟ ΜΗΤΡΩΟ', () => {
    // Αυτό είναι που κάνει τον Ψ2 ανεξάρτητο κανόνα: χωρίς αυτόν, το «Νestor»
    // θα το έπιανε ΜΟΝΟ ο Ψ1, δηλαδή μόνο ΑΝ υπήρχε ήδη το «nestor».
    expect(why(`${GREEK_NU_CAPITAL}estor`)).toBe('mixed-script');
    expect(why('παγωνης-sa')).toBe('mixed-script');
  });

  it('Ψ2.4: ψηφία και παύλα είναι Common — ΔΕΝ κάνουν το όνομα μικτό', () => {
    expect(why('a1-domi')).toBe('ok');
    expect(why('δομη-2')).toBe('ok');
  });

  it('Ψ2.5: 🔴 FAIL-CLOSED — άγνωστο σενάριο απορρίπτεται, δεν αγνοείται', () => {
    // Το κυριλλικό «а» είναι οπτικά ταυτόσημο με το λατινικό «a». Ένας κανόνας
    // που «αγνοεί ό,τι δεν αναγνωρίζει» θα άφηνε να περάσει ακριβώς την
    // κατηγορία χαρακτήρων που κανείς δεν περιμένει.
    expect(why(`p${CYRILLIC_A}rking`)).toBe('mixed-script');
  });
});

// =============================================================================
// Ψ3 — ΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ
// =============================================================================

describe('Ψ3 — δεσμευμένες λέξεις', () => {
  it('Ψ3.1: το ψευδώνυμο του ιδιωτικού χώρου είναι δεσμευμένο', () => {
    expect(why(PERSONAL_WORKSPACE_ALIAS)).toBe('reserved');
  });

  it('Ψ3.2: η δέσμευση είναι case-insensitive', () => {
    expect(why(PERSONAL_WORKSPACE_ALIAS.toUpperCase())).toBe('reserved');
  });

  it('Ψ3.3: 🔴 ΚΑΘΕ δεσμευμένη λέξη έχει ΓΡΑΜΜΕΝΟ ΛΟΓΟ', () => {
    // Μια δέσμευση χωρίς λόγο αφαιρεί όνομα από τον χρήστη και κανείς δεν ξέρει
    // αν εξακολουθεί να ισχύει (πρότυπο CHECK 3.35).
    for (const alias of reservedAliases()) {
      const reason = reservedReason(alias);
      expect(reason).toBeTruthy();
      expect((reason as string).length).toBeGreaterThan(40);
    }
  });

  it('Ψ3.4: το σύνολο μένει ΜΙΚΡΟ — αυτό είναι το κέρδος του δείκτη /o/', () => {
    // Στη ρίζα θα ήταν 99 λέξεις από 4 ασύνδετες πηγές (ADR-787 §5.3 α).
    // Αν αυτός ο αριθμός μεγαλώσει απότομα, κάποιος πρόσθεσε λέξεις «για
    // σιγουριά» — που ζουν ΚΑΤΩ από το /o/<alias>/, όχι δίπλα του.
    expect(reservedAliases().length).toBeLessThanOrEqual(5);
  });

  it('Ψ3.5: λέξεις που ζουν ΚΑΤΩ από το ψευδώνυμο ΔΕΝ είναι δεσμευμένες', () => {
    // /o/<alias>/settings — άρα «settings» δεν συγκρούεται με ψευδώνυμο.
    expect(why('settings')).toBe('ok');
    expect(why('admin')).toBe('ok');
    expect(why('api')).toBe('ok');
  });
});

// =============================================================================
// Κ — ΓΡΑΜΜΑΤΙΚΗ ΚΑΙ ΣΕΙΡΑ
// =============================================================================

describe('Κ — γραμματική, και η ΣΕΙΡΑ που είναι συμβόλαιο', () => {
  it('Κ1: πολύ κοντό', () => {
    expect(why('ab')).toBe('too-short');
  });

  it('Κ2: πολύ μακρύ', () => {
    expect(why('a'.repeat(ALIAS_MAX_LENGTH + 1))).toBe('too-long');
  });

  it('Κ3: το όριο των 63 είναι ΑΚΡΙΒΩΣ δεκτό', () => {
    expect(why('a'.repeat(ALIAS_MAX_LENGTH))).toBe('ok');
  });

  it.each([
    ['nestor construct', 'κενό'],
    ['nestor_construct', 'κάτω παύλα'],
    ['nestor.gr', 'τελεία'],
    ['-nestor', 'παύλα στην αρχή'],
    ['nestor-', 'παύλα στο τέλος'],
    ['nestor/admin', 'κάθετος'],
  ])('Κ4: «%s» απορρίπτεται (%s)', (candidate) => {
    expect(why(candidate)).toBe('invalid-characters');
  });

  it('Κ5: 🔴 Η ΣΕΙΡΑ — «ME!» λέει «χαρακτήρες», ΟΧΙ «δεσμευμένη»', () => {
    // Η δέσμευση κρίνεται με ΑΚΡΙΒΗ ισότητα, όχι με πρόθεμα: το «me!» δεν ΕΙΝΑΙ
    // η δεσμευμένη λέξη — μοιάζει με αυτήν.
    expect(why(`${PERSONAL_WORKSPACE_ALIAS}!`)).toBe('invalid-characters');
  });

  it('Κ6: 🔴 Η ΣΕΙΡΑ — το «δεσμευμένη» κρίνεται ΠΡΙΝ το μήκος', () => {
    // Το «me» έχει ΔΥΟ χαρακτήρες, ένα λιγότερο από το ελάχιστο. Αν το μήκος
    // κρινόταν πρώτο, ο άνθρωπος θα διάβαζε «πολύ κοντό» για λέξη που δεν
    // ελευθερώνεται σε ΚΑΝΕΝΑ μήκος — και θα ξαναδοκίμαζε.
    expect(PERSONAL_WORKSPACE_ALIAS.length).toBeLessThan(3);
    expect(why(PERSONAL_WORKSPACE_ALIAS)).toBe('reserved');
  });

  it('Κ6β: αλλά ένα ΑΛΛΟ κοντό όνομα εξακολουθεί να λέει «πολύ κοντό»', () => {
    expect(why(`${GREEK_NU_CAPITAL}e`)).toBe('too-short');
  });

  it('Κ7: κενά στις άκρες κόβονται, δεν απορρίπτονται', () => {
    expect(why('  pagonis  ')).toBe('ok');
  });

  it('Κ8: το ψευδώνυμο κανονικοποιείται σε πεζά', () => {
    const v = judgeAliasShape('ΠΑΓΩΝΗΣ');
    expect(v.ok).toBe(true);
    if (!v.ok) throw new Error('αδύνατο');
    expect(v.alias).toBe('παγωνης');
  });
});

// =============================================================================
// Ρ — ΤΡΕΙΣ ΚΑΝΟΝΕΣ, ΤΡΕΙΣ ΔΙΑΦΟΡΕΤΙΚΕΣ ΘΕΡΑΠΕΙΕΣ
// =============================================================================

describe('Ρ — κάθε απόρριψη λέει ΤΙ ΝΑ ΚΑΝΕΙ ο άνθρωπος', () => {
  it('Ρ1: οι αιτίες είναι διακριτές — όχι μία «μη έγκυρο»', () => {
    const reasons = new Set([
      why('ab'),
      why('a'.repeat(99)),
      why('a b'),
      why(`${GREEK_NU_CAPITAL}estor`),
      why(PERSONAL_WORKSPACE_ALIAS),
    ]);
    expect(reasons.size).toBe(5);
  });

  it('Ρ2: κάθε απόρριψη κουβαλά λεπτομέρεια για τον άνθρωπο', () => {
    for (const bad of ['ab', 'a'.repeat(99), 'a b', `${GREEK_NU_CAPITAL}estor`, PERSONAL_WORKSPACE_ALIAS]) {
      const v = judgeAliasShape(bad);
      expect(v.ok).toBe(false);
      if (v.ok) throw new Error('αδύνατο');
      expect(v.detail).toBeTruthy();
    }
  });
});
