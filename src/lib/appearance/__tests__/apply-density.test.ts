/**
 * ΑΓΚΥΡΕΣ ΣΥΜΠΕΡΙΦΟΡΑΣ — η εφαρμογή της πυκνότητας (ADR-811)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ `scripts/__tests__/`
 * ─────────────────────────────────────────────────────────────────────────────
 * Εκεί ζουν οι άγκυρες της **αλυσίδας** (ποιο αρχείο δείχνει σε ποιο), σε
 * περιβάλλον `node` χωρίς μετασχηματισμό TypeScript. Η `applyDensity` είναι
 * TypeScript: για να **εκτελεστεί** χρειάζεται τον κανονικό μετασχηματιστή, και
 * ένα χειρόγραφο ξεγύμνωμα τύπων μέσα σε test θα ήταν **δεύτερος, εύθραυστος
 * μεταγλωττιστής** — δηλαδή ένα test που μπορεί να αποτύχει για λόγο άσχετο με
 * τον κώδικα που κρίνει.
 *
 * ⚠️ Ό,τι δοκιμάζεται εδώ είναι **ακριβώς** ό,τι σειριοποιείται στο inline
 * script του `<head>` — δεν υπάρχει δεύτερη υλοποίηση να ξεφύγει.
 */

import {
  DEFAULT_DENSITY,
  DENSITY_ATTRIBUTE,
  DENSITY_ROLES,
} from '@/styles/design-tokens/generated/appearance';

import { applyDensity } from '../apply-density';

const KEY = 'appearance-density-test';
const OTHER = DENSITY_ROLES.find((r) => r !== DEFAULT_DENSITY) as string;

const apply = () =>
  applyDensity(KEY, DENSITY_ATTRIBUTE, DENSITY_ROLES, DEFAULT_DENSITY);

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute(DENSITY_ATTRIBUTE);
});

describe('Π — ο παρονομαστής', () => {
  test('Π1 — υπάρχει δεύτερος ρόλος, αλλιώς κάθε άγκυρα από κάτω δεν κοιτάζει τίποτα', () => {
    expect(OTHER).toBeDefined();
    expect(OTHER).not.toBe(DEFAULT_DENSITY);
  });
});

describe('Κ — η εφαρμογή της τιμής', () => {
  test('Κ1 — αποθηκευμένος ΕΓΚΥΡΟΣ ρόλος φτάνει στο <html>', () => {
    window.localStorage.setItem(KEY, OTHER);
    expect(apply()).toBe(OTHER);
    expect(document.documentElement.getAttribute(DENSITY_ATTRIBUTE)).toBe(OTHER);
  });

  test('Κ2 — ΑΓΝΩΣΤΟΣ ρόλος αγνοείται και πέφτει στην προεπιλογή', () => {
    // Το `localStorage` είναι εγγράψιμο από τον χρήστη και **επιβιώνει
    // αναβαθμίσεων**: ένας ρόλος που καταργήθηκε θα έγραφε attribute που κανένας
    // κανόνας CSS δεν ταιριάζει ⇒ ο διάδρομος θα έπεφτε σιωπηλά στο fallback ενώ
    // η οθόνη προτιμήσεων θα έδειχνε **κενό πλαίσιο**.
    window.localStorage.setItem(KEY, 'ΡΟΛΟΣ-ΠΟΥ-ΚΑΤΑΡΓΗΘΗΚΕ');
    expect(apply()).toBe(DEFAULT_DENSITY);
    expect(document.documentElement.getAttribute(DENSITY_ATTRIBUTE)).toBe(DEFAULT_DENSITY);
  });

  test('Κ3 — ΧΩΡΙΣ αποθηκευμένη τιμή γράφεται ΠΑΝΤΑ το attribute', () => {
    // 🔴 Αν έμενε κενό, το `--shell-density-preference` θα ήταν **αόριστο** και ο
    // διάδρομος θα έπεφτε στο fallback — που σήμερα δίνει την ΙΔΙΑ τιμή, άρα το
    // ελάττωμα θα ήταν ΑΟΡΑΤΟ μέχρι να αλλάξει η προεπιλογή. Ένας μηχανισμός που
    // είναι σωστός κατά σύμπτωση δεν είναι μηχανισμός.
    expect(apply()).toBe(DEFAULT_DENSITY);
    expect(document.documentElement.hasAttribute(DENSITY_ATTRIBUTE)).toBe(true);
  });

  test('Κ4 — αποκλεισμένο localStorage ΔΕΝ ρίχνει (θα ήταν λευκή οθόνη)', () => {
    // Τρέχει στο `<head>`, **πριν** από κάθε React error boundary: ένα σφάλμα εδώ
    // δεν πιάνεται από πουθενά. Σε ιδιωτική περιήγηση το `localStorage` πετά
    // `SecurityError` στην ίδια την πρόσβαση.
    const spy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError');
      });
    try {
      expect(() => apply()).not.toThrow();
      expect(document.documentElement.getAttribute(DENSITY_ATTRIBUTE)).toBe(DEFAULT_DENSITY);
    } finally {
      spy.mockRestore();
    }
  });

  test('Κ5 — είναι ΙΔΕΜΠΟΤΗΣ: δεύτερη κλήση δίνει το ίδιο (N.7.2 #3)', () => {
    window.localStorage.setItem(KEY, OTHER);
    expect(apply()).toBe(apply());
    expect(document.documentElement.getAttribute(DENSITY_ATTRIBUTE)).toBe(OTHER);
  });

  test('Κ6 — κενή συμβολοσειρά ΔΕΝ περνά ως ρόλος', () => {
    // Το `''` δεν είναι στο σύνολο· αν περνούσε, θα έγραφε `data-density=""` που
    // κανένας κανόνας δεν ταιριάζει.
    window.localStorage.setItem(KEY, '');
    expect(apply()).toBe(DEFAULT_DENSITY);
    expect(document.documentElement.getAttribute(DENSITY_ATTRIBUTE)).toBe(DEFAULT_DENSITY);
  });
});
