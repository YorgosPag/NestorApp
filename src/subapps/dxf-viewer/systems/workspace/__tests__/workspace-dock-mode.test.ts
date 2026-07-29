/**
 * ADR-724 Φ2/Φ3 — Η κατάσταση αγκύρωσης ως καθαρός τύπος. Μηδέν jsdom, μηδέν localStorage.
 *
 * Ο επικυρωτής είναι η **μοναδική** άμυνα ανάμεσα στο localStorage (που γράφει οποιαδήποτε
 * έκδοση του app, και που ο χρήστης μπορεί να επεξεργαστεί) και τη διάταξη. Αν περάσει
 * σκουπίδι, το `WorkspaceSplitLayout` ζωγραφίζει άγνωστη κατάσταση.
 */

import {
  DOCKED_SIDES,
  DOCKED_SIDE_DEFAULT,
  DOCK_MODES,
  DOCK_MODE_DEFAULT,
  isFloating,
  parseDockMode,
  parseDockedSide,
  resolveWorkspaceLayout,
  toDockedSide,
} from '../workspace-dock-mode';

describe('ADR-724 Φ2/Φ3 — workspace-dock-mode', () => {
  describe('η απαρίθμηση', () => {
    it('η προεπιλογή είναι η ΣΗΜΕΡΙΝΗ συμπεριφορά ⇒ μηδενική οπτική αλλαγή στην αναβάθμιση', () => {
      expect(DOCK_MODE_DEFAULT).toBe('docked-left');
    });

    it('η προεπιλογή ανήκει στις έγκυρες τιμές', () => {
      expect(DOCK_MODES).toContain(DOCK_MODE_DEFAULT);
    });

    it('η σειρά είναι η σειρά του μενού — πλευρές πρώτα, αιώρηση τελευταία', () => {
      expect([...DOCK_MODES]).toEqual(['docked-left', 'docked-right', 'floating']);
    });

    it('οι ΠΛΕΥΡΕΣ δεν περιέχουν την αιώρηση — αλλιώς η «τελευταία πλευρά» θα ήταν βρόχος', () => {
      expect([...DOCKED_SIDES]).toEqual(['docked-left', 'docked-right']);
      expect(DOCKED_SIDES).not.toContain('floating');
    });

    it('η προεπιλεγμένη πλευρά είναι πλευρά', () => {
      expect(DOCKED_SIDES).toContain(DOCKED_SIDE_DEFAULT);
    });
  });

  describe('parseDockMode (η αποθηκευμένη τιμή είναι ιστορικό, όχι αλήθεια)', () => {
    it.each([...DOCK_MODES])('δέχεται τη γνωστή τιμή %s', (mode) => {
      expect(parseDockMode(mode)).toBe(mode);
    });

    it('η Φ3 έκανε το «floating» έγκυρο — ο φύλακας ΔΕΝ αφαιρέθηκε γι᾽ αυτό', () => {
      expect(parseDockMode('floating')).toBe('floating');
      // Ο λόγος ύπαρξης του φύλακα μετακινήθηκε, δεν εξαφανίστηκε: προστατεύει από τιμές
      // ΑΛΛΩΝ εκδόσεων — προς τα εμπρός (μελλοντική Φ5) και προς τα πίσω (rollback).
      expect(parseDockMode('docked-top')).toBeNull();
    });

    it('απορρίπτει άγνωστο αλφαριθμητικό', () => {
      expect(parseDockMode('docked')).toBeNull();
      expect(parseDockMode('')).toBeNull();
    });

    it.each([null, undefined, 0, 1, {}, [], true])('απορρίπτει τον μη-αλφαριθμητικό %p', (raw) => {
      expect(parseDockMode(raw)).toBeNull();
    });

    it('δεν συγχέει το πρόθεμα με ολόκληρη την τιμή', () => {
      expect(parseDockMode('docked-left-extra')).toBeNull();
    });
  });

  describe('parseDockedSide — στενότερος, ΕΠΙΤΗΔΕΣ', () => {
    it.each([...DOCKED_SIDES])('δέχεται την πλευρά %s', (side) => {
      expect(parseDockedSide(side)).toBe(side);
    });

    it('🔴 ΑΠΟΡΡΙΠΤΕΙ το «floating» — αλλιώς «βγες από την αιώρηση» ⇒ αιώρηση', () => {
      // Αν αυτό γίνει ποτέ πράσινο με `'floating'`, το διπλό κλικ στην επικεφαλίδα σταματά
      // να κάνει τίποτα για όποιον έχει αυτή την τιμή αποθηκευμένη.
      expect(parseDockedSide('floating')).toBeNull();
    });

    it.each([null, undefined, 0, {}, []])('απορρίπτει τον μη-αλφαριθμητικό %p', (raw) => {
      expect(parseDockedSide(raw)).toBeNull();
    });
  });

  describe('isFloating / toDockedSide', () => {
    it('isFloating αληθές μόνο για την αιώρηση', () => {
      expect(isFloating('floating')).toBe(true);
      expect(isFloating('docked-left')).toBe(false);
      expect(isFloating('docked-right')).toBe(false);
    });

    it('toDockedSide στενεύει, και επιστρέφει null αντί να μαντέψει', () => {
      expect(toDockedSide('docked-left')).toBe('docked-left');
      expect(toDockedSide('docked-right')).toBe('docked-right');
      expect(toDockedSide('floating')).toBeNull();
    });
  });

  describe('🔴 resolveWorkspaceLayout — ο αντικαταστάτης του δυαδικού isDockedRight', () => {
    /*
      ΓΙΑΤΙ ΑΥΤΟ ΤΟ describe ΕΙΝΑΙ Η ΚΑΡΔΙΑ ΤΗΣ Φ3.

      Το παλιό `isDockedRight` ήταν **δυαδικό** πάνω σε ένωση που έγινε τριμερής: το
      `'floating'` έπεφτε στον κλάδο `else` και η αιωρούμενη παλέτα αποδιδόταν αγκυρωμένη
      αριστερά — χωρίς σφάλμα μεταγλώττισης και χωρίς κόκκινο test.
    */
    it('κάθε κατάσταση έχει ΔΙΚΗ ΤΗΣ διάταξη — καμία δεν μοιράζεται κλάδο με άλλη', () => {
      expect(resolveWorkspaceLayout('docked-left')).toBe('sidebar-first');
      expect(resolveWorkspaceLayout('docked-right')).toBe('canvas-first');
      expect(resolveWorkspaceLayout('floating')).toBe('floating');
    });

    it('η αιώρηση ΔΕΝ δίνει ποτέ την ίδια απάντηση με αγκυρωμένη πλευρά', () => {
      // Η ακριβής παλινδρόμηση που περιγράφει το handoff §4β.
      expect(resolveWorkspaceLayout('floating')).not.toBe(resolveWorkspaceLayout('docked-left'));
      expect(resolveWorkspaceLayout('floating')).not.toBe(resolveWorkspaceLayout('docked-right'));
    });

    it('η αντιστοίχιση είναι ΟΛΙΚΗ — καμία κατάσταση χωρίς απάντηση', () => {
      const answers = DOCK_MODES.map(resolveWorkspaceLayout);
      expect(answers).toHaveLength(DOCK_MODES.length);
      expect(answers.every((value) => typeof value === 'string' && value.length > 0)).toBe(true);
      // Και **αμφιμονοσήμαντη**: δύο καταστάσεις με ίδια διάταξη θα σήμαινε ότι μία από τις δύο
      // είναι αόρατη στον χρήστη.
      expect(new Set(answers).size).toBe(DOCK_MODES.length);
    });
  });
});
