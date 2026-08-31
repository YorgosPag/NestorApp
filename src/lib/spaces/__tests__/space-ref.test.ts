/**
 * @fileoverview Άγκυρες του **ατόμου του χώρου** — και της διαφοράς τομής/κάλυψης.
 * @related ADR-838 §4.1 · ADR-835 §4.12
 *
 * 🔴 **ΤΙ ΣΚΟΤΩΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ** (δοκιμή μετάλλαξης, όχι απλό pass):
 *
 * | # | Μετάλλαξη | Ποια άγκυρα κοκκινίζει |
 * |---|---|---|
 * | Μ1 | `spaceCovers` → `spacesIntersect` (κάλυψη γίνεται συμμετρική) | Α3 |
 * | Μ2 | `spaceSetCovers`: `every` → `some` | Α5 |
 * | Μ3 | `spacesIntersect`: αφαίρεση του ελέγχου `propertyId` | Α2 |
 * | Μ4 | `spaceSetsIntersect`: κενό ⇒ `true` | Α6 |
 * | Μ5 | `spaceRefKey`: `?? '*'` → `?? ''` (μπαλαντέρ ≡ κενό `spaceId`) | Α7 |
 */

import {
  spaceCovers,
  spaceRefKey,
  spaceSetCovers,
  spaceSetsIntersect,
  spacesIntersect,
  wholePropertySpace,
  type SpaceRef,
} from '../space-ref';

const P = 'prop_a0000001';
const OTHER = 'prop_b0000002';

const WHOLE: SpaceRef = { propertyId: P, spaceId: null };
const ROOM_A: SpaceRef = { propertyId: P, spaceId: 'room-a' };
const ROOM_B: SpaceRef = { propertyId: P, spaceId: 'room-b' };

describe('Α1 — η τομή είναι ΣΥΜΜΕΤΡΙΚΗ, και στις δύο κατευθύνσεις', () => {
  it('ολόκληρο ↔ δωμάτιο Α: τέμνονται, όποιον ρωτήσεις πρώτο', () => {
    expect(spacesIntersect(WHOLE, ROOM_A)).toBe(true);
    expect(spacesIntersect(ROOM_A, WHOLE)).toBe(true);
  });

  it('δύο ΔΙΑΦΟΡΕΤΙΚΑ δωμάτια δεν τέμνονται — αλλιώς κάθε κράτηση θα έκλεινε το σπίτι', () => {
    expect(spacesIntersect(ROOM_A, ROOM_B)).toBe(false);
    expect(spacesIntersect(ROOM_B, ROOM_A)).toBe(false);
  });
});

describe('Α2 — ο ΠΕΡΙΕΚΤΗΣ είναι μέρος της ταυτότητας', () => {
  it('δύο ΟΛΟΚΛΗΡΑ διαφορετικών ακινήτων ΔΕΝ τέμνονται', () => {
    // Χωρίς τον έλεγχο `propertyId`, `null ∩ null` θα ήταν `true` — δηλαδή **κάθε**
    // ακίνητο του καταλόγου θα συγκρουόταν με κάθε άλλο.
    expect(spacesIntersect(WHOLE, wholePropertySpace(OTHER))).toBe(false);
  });

  it('ίδιο όνομα χώρου σε ΑΛΛΟ ακίνητο δεν τέμνεται', () => {
    expect(spacesIntersect(ROOM_A, { propertyId: OTHER, spaceId: 'room-a' })).toBe(false);
  });
});

describe('Α3 — 🔴 η ΚΑΛΥΨΗ είναι ΑΣΥΜΜΕΤΡΗ, και εκεί κρίνεται η νομιμότητα', () => {
  it('το ΟΛΟΚΛΗΡΟ καλύπτει το δωμάτιο Α', () => {
    expect(spaceCovers(WHOLE, ROOM_A)).toBe(true);
  });

  it('🔴 το δωμάτιο Α ΔΕΝ καλύπτει το ολόκληρο — παρότι ΤΕΜΝΟΝΤΑΙ', () => {
    // Είναι το ΜΟΝΟ σημείο όπου οι δύο σχέσεις διαφωνούν, και είναι όλη η αξία του
    // αρχείου: με τομή, ο ΑΜΑ ΕΝΟΣ ΔΩΜΑΤΙΟΥ θα «νομιμοποιούσε» ολόκληρο το ακίνητο.
    expect(spacesIntersect(ROOM_A, WHOLE)).toBe(true);
    expect(spaceCovers(ROOM_A, WHOLE)).toBe(false);
  });

  it('ο χώρος καλύπτει τον εαυτό του', () => {
    expect(spaceCovers(ROOM_A, ROOM_A)).toBe(true);
  });

  it('κανένας χώρος δεν καλύπτει χώρο ΑΛΛΟΥ ακινήτου', () => {
    expect(spaceCovers(WHOLE, { propertyId: OTHER, spaceId: null })).toBe(false);
  });
});

describe('Α4 — τα σύνολα: τομή', () => {
  it('τέμνονται αν ΚΑΠΟΙΟΣ με ΚΑΠΟΙΟΝ', () => {
    expect(spaceSetsIntersect([ROOM_A, ROOM_B], [ROOM_B])).toBe(true);
  });

  it('ξένα σύνολα δεν τέμνονται', () => {
    expect(spaceSetsIntersect([ROOM_A], [ROOM_B])).toBe(false);
  });
});

describe('Α5 — τα σύνολα: κάλυψη είναι `every`, ΠΟΤΕ `some`', () => {
  it('🔴 ένα δωμάτιο καλυμμένο από τα δύο ΔΕΝ αρκεί', () => {
    // Με `some`, ένα διαμέρισμα όπου **ένα** από τα δύο δωμάτια έχει ΑΜΑ θα
    // απαντούσε «δηλωμένο» για **όλο**. Η αξίωση δεν επεκτείνεται με πλειοψηφία.
    expect(spaceSetCovers([ROOM_A], [ROOM_A, ROOM_B])).toBe(false);
    expect(spaceSetCovers([ROOM_A, ROOM_B], [ROOM_A, ROOM_B])).toBe(true);
  });

  it('το ΟΛΟΚΛΗΡΟ καλύπτει κάθε υποσύνολο', () => {
    expect(spaceSetCovers([WHOLE], [ROOM_A, ROOM_B])).toBe(true);
  });

  it('🔴 σύνολο ΔΩΜΑΤΙΩΝ δεν καλύπτει το ΟΛΟΚΛΗΡΟ, ούτε με όλα τα δωμάτια μέσα', () => {
    // Δεν ξέρουμε ότι τα δωμάτια είναι **όλοι** οι χώροι — το `spaceId: null` είναι
    // μπαλαντέρ, όχι απαρίθμηση. Το `space-ref` είναι leaf: δεν διαβάζει κάτοψη.
    expect(spaceSetCovers([ROOM_A, ROOM_B], [WHOLE])).toBe(false);
  });
});

describe('Α6 — το ΚΕΝΟ, και οι δύο διαφορετικές απαντήσεις του', () => {
  it('κενή τομή ⇒ `false` — «τίποτα δεν τέμνει τίποτα» (ίδιο με ADR-835 §17)', () => {
    expect(spaceSetsIntersect([], [WHOLE])).toBe(false);
    expect(spaceSetsIntersect([WHOLE], [])).toBe(false);
    expect(spaceSetsIntersect([], [])).toBe(false);
  });

  it('κενός ΣΤΟΧΟΣ κάλυψης ⇒ `true` (κενή σύζευξη) — ΑΛΓΕΒΡΑ, όχι λεξιλόγιο', () => {
    // Δηλωμένο επίτηδες: ο φρουρός του «ρώτησες για κανέναν χώρο» ζει στον καλούντα
    // (`legalitySignalFor`), όπου το κενό έχει ΟΝΟΜΑ. Εδώ θα ήταν ψευδής άλγεβρα.
    expect(spaceSetCovers([ROOM_A], [])).toBe(true);
  });

  it('κενή ΠΗΓΗ δεν καλύπτει τίποτα υπαρκτό', () => {
    expect(spaceSetCovers([], [ROOM_A])).toBe(false);
  });
});

describe('Α7 — το κλειδί ταυτότητας', () => {
  it('το μπαλαντέρ ΔΕΝ συγχέεται με κενό όνομα χώρου', () => {
    expect(spaceRefKey(WHOLE)).not.toBe(spaceRefKey({ propertyId: P, spaceId: '' }));
  });

  it('ίδιο ζεύγος ⇒ ίδιο κλειδί· άλλο ακίνητο ⇒ άλλο κλειδί', () => {
    expect(spaceRefKey(ROOM_A)).toBe(spaceRefKey({ propertyId: P, spaceId: 'room-a' }));
    expect(spaceRefKey(ROOM_A)).not.toBe(spaceRefKey({ propertyId: OTHER, spaceId: 'room-a' }));
  });
});

describe('Α8 — ο χτίστης του «ολόκληρου»', () => {
  it('`wholePropertySpace` δίνει μπαλαντέρ με σύνορο', () => {
    expect(wholePropertySpace(P)).toEqual({ propertyId: P, spaceId: null });
  });
});
