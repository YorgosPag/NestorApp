/**
 * ADR-724 §4.1 / ADR-040 — Ο κανόνας αγκύρωσης του σχεδίου όταν αλλάζει ο καμβάς.
 *
 * Ελέγχεται ως **καθαρή συνάρτηση**, χωρίς να στηθεί hook/DOM/ResizeObserver: ο κανόνας είναι
 * το ρίσκο, όχι το plumbing. Αν αυτά τα tests χρειαστούν ποτέ jsdom, κάτι έχει διαρρεύσει.
 */

import { anchorTransformOnResize } from '../useViewportManager';
import type { ViewTransform } from '../../../rendering/types/Types';

const BASE: ViewTransform = { scale: 2.5, offsetX: 100, offsetY: 200 };

describe('ADR-724 §4.1 — anchorTransformOnResize', () => {
  describe('η κλίμακα είναι απαραβίαστη (ADR-418)', () => {
    it('καμία μεταβολή δεν αγγίζει το `scale`', () => {
      const result = anchorTransformOnResize(BASE, 120, -80);
      expect(result.scale).toBe(BASE.scale);
    });
  });

  describe('ύψος — αγκύρωση στην ΚΑΤΩ ακμή (προϋπάρχουσα συμπεριφορά)', () => {
    it('ψηλότερος καμβάς ⇒ το offsetY αυξάνεται κατά Δh', () => {
      expect(anchorTransformOnResize(BASE, 60, 0).offsetY).toBe(260);
    });

    it('κοντύτερος καμβάς ⇒ το offsetY μειώνεται κατά |Δh|', () => {
      expect(anchorTransformOnResize(BASE, -60, 0).offsetY).toBe(140);
    });

    it('το offsetX δεν επηρεάζεται από αλλαγή ύψους', () => {
      expect(anchorTransformOnResize(BASE, 60, 0).offsetX).toBe(BASE.offsetX);
    });
  });

  describe('πλάτος — αγκύρωση στην οθονο-χωρική αριστερή ακμή (νέο)', () => {
    it('η παλέτα ΑΡΙΣΤΕΡΑ πλαταίνει (η ακμή πάει δεξιά) ⇒ offsetX -= Δleft', () => {
      // Χωρίς αυτό, το σχέδιο θα σερνόταν μαζί με την παλέτα.
      expect(anchorTransformOnResize(BASE, 0, 40).offsetX).toBe(60);
    });

    it('η παλέτα ΑΡΙΣΤΕΡΑ στενεύει (η ακμή πάει αριστερά) ⇒ offsetX += |Δleft|', () => {
      expect(anchorTransformOnResize(BASE, 0, -40).offsetX).toBe(140);
    });

    it('αγκύρωση ΔΕΞΙΑ: η αριστερή ακμή δεν κουνιέται ⇒ Δleft = 0 ⇒ το σχέδιο ΑΚΙΝΗΤΟ', () => {
      // Ίδιος κανόνας, καμία διακλάδωση ανά πλευρά — αυτό είναι το ζητούμενο του §4.1.
      expect(anchorTransformOnResize(BASE, 0, 0)).toBe(BASE);
    });

    it('το offsetY δεν επηρεάζεται από αλλαγή πλάτους', () => {
      expect(anchorTransformOnResize(BASE, 0, 40).offsetY).toBe(BASE.offsetY);
    });
  });

  describe('ταυτόχρονη μεταβολή (σύρσιμο γωνίας παραθύρου)', () => {
    it('εφαρμόζονται και οι δύο άξονες σε ΜΙΑ εγγραφή', () => {
      expect(anchorTransformOnResize(BASE, 30, 20)).toEqual({
        scale: 2.5,
        offsetX: 80,
        offsetY: 230,
      });
    });
  });

  describe('κατώφλι θορύβου (0.5px)', () => {
    it.each([
      ['μηδέν', 0, 0],
      ['υπο-pixel σε ύψος', 0.4, 0],
      ['υπο-pixel σε πλάτος', 0, -0.5],
      ['υπο-pixel και στα δύο', 0.2, 0.3],
    ])('%s ⇒ επιστρέφει το ΙΔΙΟ αντικείμενο (μηδέν εγγραφή, μηδέν invalidation)', (_l, dh, dl) => {
      expect(anchorTransformOnResize(BASE, dh, dl)).toBe(BASE);
    });

    it('ακριβώς πάνω από το κατώφλι ⇒ εφαρμόζεται', () => {
      expect(anchorTransformOnResize(BASE, 0, 0.51).offsetX).toBeCloseTo(99.49);
    });
  });

  describe('καθαρότητα', () => {
    it('δεν μεταλλάσσει την είσοδο', () => {
      const input: ViewTransform = { ...BASE };
      anchorTransformOnResize(input, 100, 100);
      expect(input).toEqual(BASE);
    });
  });
});
