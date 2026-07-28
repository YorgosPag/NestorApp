/**
 * ADR-724 Φ2 — Η πλευρά αγκύρωσης ως καθαρός τύπος. Μηδέν jsdom, μηδέν localStorage.
 *
 * Ο επικυρωτής είναι η **μοναδική** άμυνα ανάμεσα στο localStorage (που γράφει οποιαδήποτε
 * έκδοση του app, και που ο χρήστης μπορεί να επεξεργαστεί) και τη διάταξη. Αν περάσει
 * σκουπίδι, το `WorkspaceSplitLayout` ζωγραφίζει άγνωστη κατάσταση.
 */

import {
  DOCK_MODES,
  DOCK_MODE_DEFAULT,
  isDockedRight,
  parseDockMode,
} from '../workspace-dock-mode';

describe('ADR-724 Φ2 — workspace-dock-mode', () => {
  describe('η απαρίθμηση', () => {
    it('η προεπιλογή είναι η ΣΗΜΕΡΙΝΗ συμπεριφορά ⇒ μηδενική οπτική αλλαγή στην αναβάθμιση', () => {
      expect(DOCK_MODE_DEFAULT).toBe('docked-left');
    });

    it('η προεπιλογή ανήκει στις έγκυρες τιμές', () => {
      expect(DOCK_MODES).toContain(DOCK_MODE_DEFAULT);
    });

    it('η σειρά είναι η σειρά του μενού — αριστερά πριν δεξιά', () => {
      expect([...DOCK_MODES]).toEqual(['docked-left', 'docked-right']);
    });
  });

  describe('parseDockMode (η αποθηκευμένη τιμή είναι ιστορικό, όχι αλήθεια)', () => {
    it.each([...DOCK_MODES])('δέχεται τη γνωστή τιμή %s', (mode) => {
      expect(parseDockMode(mode)).toBe(mode);
    });

    it('απορρίπτει μελλοντική τιμή της Φ3 αντί να τη ζωγραφίσει', () => {
      // Χρήστης που γύρισε σε παλιότερη έκδοση — ΔΕΝ πρέπει να πάρει άγνωστη κατάσταση.
      expect(parseDockMode('floating')).toBeNull();
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

  describe('isDockedRight — η ΜΟΝΗ ερώτηση πλευράς που επιτρέπεται στη διάταξη', () => {
    it('αληθής μόνο για τη δεξιά αγκύρωση', () => {
      expect(isDockedRight('docked-right')).toBe(true);
      expect(isDockedRight('docked-left')).toBe(false);
    });
  });
});
