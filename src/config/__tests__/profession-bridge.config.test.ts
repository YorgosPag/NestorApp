/**
 * @fileoverview Η γέφυρα ρόλου ↔ επαγγέλματος — και προς τις δύο κατευθύνσεις (ADR-745 §6.4, G1).
 *
 * Τα δύο δείγματα του τίτλου είναι **μετρημένα** από το `G753_ergasia F.dxf`: είναι ακριβώς
 * αυτό που βγάζει ο Λ1 (`readTitleBlocks`) στο πεδίο ειδικότητας των δύο προσώπων. Τα
 * υπόλοιπα δείγματα υπάρχουν επειδή το πραγματικό αρχείο **δεν ασκεί κάθε διαδρομή**: ένα
 * μόνο σχέδιο δεν περιέχει ποτέ διφορούμενο κείμενο, οπότε ο φύλακας του `null` θα ήταν
 * αόρατος και κάθε μετάλλαξή του θα επιζούσε (μάθημα Φ1 #1).
 */

import {
  PROJECT_ROLE_BRIDGE,
  getBridgeEntry,
  resolveRoleCandidatesFromProfession,
  resolveRoleFromProfession,
} from '../profession-bridge.config';
import { ENTITY_ASSOCIATION_ROLES } from '@/types/entity-associations';
import { containsWordSequence, splitIntoWords } from '@/utils/greek-text';

// ── Ευθεία φορά ───────────────────────────────────────────────────────────────

describe('getBridgeEntry — ρόλος → επάγγελμα', () => {
  it('καλύπτει και τους 7 ρόλους του SSoT, χωρίς κενό', () => {
    for (const role of ENTITY_ASSOCIATION_ROLES.project) {
      expect(getBridgeEntry(role)).not.toBeNull();
    }
    expect(Object.keys(PROJECT_ROLE_BRIDGE)).toHaveLength(
      ENTITY_ASSOCIATION_ROLES.project.length,
    );
  });

  it('άγνωστος ρόλος → null', () => {
    expect(getBridgeEntry('lawyer')).toBeNull();
    expect(getBridgeEntry('')).toBeNull();
  });

  it('🔴 κληρονομημένο κλειδί ΔΕΝ είναι εγγραφή — το `__proto__` δεν απαντά', () => {
    expect(getBridgeEntry('__proto__')).toBeNull();
    expect(getBridgeEntry('constructor')).toBeNull();
    expect(getBridgeEntry('toString')).toBeNull();
  });
});

// ── Αντίστροφη φορά — τα μετρημένα δείγματα ───────────────────────────────────

describe('resolveRoleFromProfession — τα δύο ΜΕΤΡΗΜΕΝΑ δείγματα του G753', () => {
  it('«ΑΓΡΟΝΟΜΟΣ ΤΟΠΟΓΡΑΦΟΣ ΜΗΧΑΝΙΚΟΣ Α.Π.Θ.» → surveyor', () => {
    expect(resolveRoleFromProfession('ΑΓΡΟΝΟΜΟΣ ΤΟΠΟΓΡΑΦΟΣ ΜΗΧΑΝΙΚΟΣ Α.Π.Θ.')).toBe('surveyor');
  });

  it('«ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ Τ.Ε.» → structural_engineer', () => {
    expect(resolveRoleFromProfession('ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ Τ.Ε.')).toBe('structural_engineer');
  });

  it('🔴 ο surveyor βρίσκεται ΜΟΝΟ μέσω του escoLabel — το `profession` δεν λέει «ΑΓΡΟΝΟΜΟΣ»', () => {
    const entry = getBridgeEntry('surveyor');
    expect(entry?.profession).not.toMatch(/ΑΓΡΟΝΟΜΟΣ/i);
    expect(entry?.escoLabel).toMatch(/αγρονόμος/i);
    // …και ταυτόχρονα η σκέτη γραφή του `profession` πρέπει να δουλεύει κι αυτή:
    expect(resolveRoleFromProfession('ΤΟΠΟΓΡΑΦΟΣ ΜΗΧΑΝΙΚΟΣ')).toBe('surveyor');
  });
});

// ── Το επίθημα ιδρύματος/βαθμίδας ─────────────────────────────────────────────

describe('επίθημα ιδρύματος — αδιάφορο ΕΞ ΟΡΙΣΜΟΥ, όχι με λίστα αφαίρεσης', () => {
  it.each([
    'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ Α.Π.Θ.',
    'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ Ε.Μ.Π.',
    'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ Δ.Π.Θ.',
    'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ Τ.Ε.',
    'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ Α.Τ.Ε.Ι.',
    'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ M.Sc.',
    'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ Ph.D.',
    'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ ΠΑΝΕΠΙΣΤΗΜΙΟΥ ΠΟΥ ΔΕΝ ΞΕΡΟΥΜΕ ΑΚΟΜΑ',
  ])('%s → structural_engineer', (text) => {
    expect(resolveRoleFromProfession(text)).toBe('structural_engineer');
  });

  it('χωρίς ΚΑΝΕΝΑ επίθημα δουλεύει το ίδιο — η διαδρομή δεν εξαρτάται από την ύπαρξή του', () => {
    expect(resolveRoleFromProfession('ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ')).toBe('structural_engineer');
  });
});

// ── Κανονικοποίηση ────────────────────────────────────────────────────────────

describe('κανονικοποίηση — κεφαλαία, τόνοι, ομόγλυφα', () => {
  it.each([
    ['κεφαλαία χωρίς τόνους', 'ΜΗΧΑΝΟΛΟΓΟΣ ΜΗΧΑΝΙΚΟΣ'],
    ['πεζά με τόνους', 'μηχανολόγος μηχανικός'],
    ['ανάμεικτα', 'Μηχανολόγος ΜΗΧΑΝΙΚΟΣ'],
  ])('%s → mechanical_engineer', (_label, text) => {
    expect(resolveRoleFromProfession(text)).toBe('mechanical_engineer');
  });

  it('🔴 λατινικά ομόγλυφα μέσα στη λέξη ΜΗΧΑΝΙΚΟΣ δεν σπάνε την αναγνώριση', () => {
    // Μ,Η,Χ,Α,Ν,Ι,Κ,Ο λατινικά· μόνο το τελικό Σ είναι ελληνικό (ό,τι βλέπει και το CAD).
    const contaminated = 'ΗΛΕΚΤΡΟΛΟΓΟΣ ' + 'MHXANIKO' + 'Σ';
    expect(contaminated).not.toBe('ΗΛΕΚΤΡΟΛΟΓΟΣ ΜΗΧΑΝΙΚΟΣ');
    expect(resolveRoleFromProfession(contaminated)).toBe('electrical_engineer');
  });
});

// ── Ο φύλακας του null ────────────────────────────────────────────────────────

describe('🔴 ο φύλακας του null — μια λάθος ταυτοποίηση είναι ΧΕΙΡΟΤΕΡΗ από καμία', () => {
  it('σκέτο «ΜΗΧΑΝΙΚΟΣ» → null (η λέξη ανήκει σε 5 από τους 7 ρόλους)', () => {
    expect(resolveRoleFromProfession('ΜΗΧΑΝΙΚΟΣ')).toBeNull();
    expect(resolveRoleCandidatesFromProfession('ΜΗΧΑΝΙΚΟΣ')).toEqual([]);
  });

  it('η λέξη «ΜΗΧΑΝΙΚΟΣ» ΟΝΤΩΣ είναι διφορούμενη — αλλιώς το από πάνω δεν αποδεικνύει τίποτα', () => {
    // Μετρημένο 2026-08-01: **5**, όχι 6 όπως έγραφε το handoff της Φ1. Ο `architect`
    // («Αρχιτέκτονας») και ο `energy_inspector` («Ενεργειακός Επιθεωρητής») δεν φέρουν τη
    // λέξη. Ο αριθμός δεν αλλάζει τίποτα στον αλγόριθμο — το ≥2 είναι που επιβάλλει το null.
    const withEngineer = ENTITY_ASSOCIATION_ROLES.project.filter((role) =>
      /μηχανικ/i.test(getBridgeEntry(role)?.profession ?? ''),
    );
    expect(withEngineer).toEqual([
      'structural_engineer',
      'electrical_engineer',
      'mechanical_engineer',
      'surveyor',
      'supervising_engineer',
    ]);
  });

  it('🔴 ΔΥΟ ρόλοι στο ίδιο κείμενο → null, και οι δύο ορατοί στους υποψηφίους', () => {
    const text = 'ΠΟΛΙΤΙΚΟΣ ΜΗΧΑΝΙΚΟΣ / ΕΠΙΒΛΕΠΩΝ ΜΗΧΑΝΙΚΟΣ';
    expect(resolveRoleCandidatesFromProfession(text)).toEqual([
      'structural_engineer',
      'supervising_engineer',
    ]);
    expect(resolveRoleFromProfession(text)).toBeNull();
  });

  it('🔴 σωστές λέξεις σε λάθος θέσεις → null (η γειτνίαση είναι ο μηχανισμός)', () => {
    expect(resolveRoleFromProfession('ΠΟΛΙΤΙΚΟΣ ΥΠΑΛΛΗΛΟΣ ΚΑΙ ΜΗΧΑΝΙΚΟΣ ΑΥΤΟΚΙΝΗΤΩΝ'))
      .toBeNull();
  });

  it.each(['', '   ', '—', 'ΖΕΡΒΑ ΓΕΩΡΓΙΑ', 'ΤΟΠΟΓΡΑΦΙΚΕΣ ΜΕΛΕΤΕΣ - ΕΦΑΡΜΟΓΕΣ'])(
    'κείμενο χωρίς επάγγελμα (%p) → null',
    (text) => {
      expect(resolveRoleFromProfession(text)).toBeNull();
    },
  );
});

// ── Πληρότητα: κάθε ρόλος αναγνωρίζει τις δικές του γραφές ────────────────────

describe('πληρότητα — κάθε ρόλος αναγνωρίζεται από τις ΔΙΚΕΣ ΤΟΥ γραφές', () => {
  it.each([...ENTITY_ASSOCIATION_ROLES.project])('%s ← profession + escoLabel', (role) => {
    const entry = getBridgeEntry(role);
    expect(entry).not.toBeNull();
    expect(resolveRoleFromProfession(entry!.profession)).toBe(role);
    expect(resolveRoleFromProfession(entry!.escoLabel)).toBe(role);
  });

  /**
   * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (μετρημένο 2026-08-01, mutation M2 ΕΠΕΖΗΣΕ):
   *
   * Η μετάλλαξη «ψάξε μόνο το `profession`» **δεν ρίχνει κανένα test** — και δεν είναι κενό
   * δείγματος: είναι **ισοδύναμη μετάλλαξη**. Με **περιεκτικότητα** αντί για ισότητα, κάθε
   * σημερινό `escoLabel` ή ταυτίζεται με το `profession` μετά την κανονικοποίηση, ή το
   * **περιέχει** ως συνεχόμενη υπακολουθία («αγρονόμος **τοπογράφος μηχανικός**»). Η
   * μικρότερη φράση ταιριάζει όπου ταιριάζει και η μεγαλύτερη ⇒ καμία είσοδος δεν μπορεί να
   * τα ξεχωρίσει. Το δεύτερο πεδίο μένει ως **ασφάλεια** (N.7.2 #4) για την πρώτη εγγραφή
   * που θα σπάσει τον κανόνα — π.χ. ESCO ετικέτα «μηχανικός χημικών διεργασιών» δίπλα σε
   * `profession` «Χημικός Μηχανικός».
   *
   * Αυτό το test είναι η **σκανδάλη**: την ημέρα που μια εγγραφή θα σπάσει τον κανόνα, θα
   * κοκκινίσει και θα πει στον επόμενο ότι από εκείνη τη στιγμή το `escoLabel` **σηκώνει
   * βάρος** — και ότι η M2 πρέπει πλέον να σκοτώνεται.
   */
  it('σήμερα κάθε escoLabel ΠΕΡΙΕΧΕΙ το profession — γι᾽ αυτό η M2 είναι ισοδύναμη μετάλλαξη', () => {
    const carriesProfession = ENTITY_ASSOCIATION_ROLES.project.filter((role) => {
      const entry = getBridgeEntry(role);
      if (!entry) return false;
      const professionWords = splitIntoWords(entry.profession).map((word) => word.normalized);
      return containsWordSequence(splitIntoWords(entry.escoLabel), professionWords);
    });
    expect(carriesProfession).toEqual([...ENTITY_ASSOCIATION_ROLES.project]);
  });

  it('κανένας ρόλος δεν απαντά δύο φορές όταν οι δύο γραφές του συμπίπτουν', () => {
    // Ο architect έχει `Αρχιτέκτονας` / `αρχιτέκτονας`: ίδιες μετά την κανονικοποίηση.
    expect(resolveRoleCandidatesFromProfession('ΑΡΧΙΤΕΚΤΟΝΑΣ')).toEqual(['architect']);
  });

  it('ο ενεργειακός επιθεωρητής (χωρίς τη λέξη «μηχανικός») αναγνωρίζεται κανονικά', () => {
    expect(resolveRoleFromProfession('ΕΝΕΡΓΕΙΑΚΟΣ ΕΠΙΘΕΩΡΗΤΗΣ Α.Π.Θ.')).toBe('energy_inspector');
  });
});
