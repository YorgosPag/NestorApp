/**
 * @fileoverview Άγκυρες της **κλίμακας** — η σειρά είναι το νόημα.
 * @related ADR-838 §4.2 · ADR-777 §7 (Α17) · SPEC-777-RESEARCH §24.5 · ADR-835 §7
 *
 * 🔴 **ΤΙ ΣΚΟΤΩΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ:**
 *
 * | # | Μετάλλαξη | Άγκυρα |
 * |---|---|---|
 * | Μ1 | αναδιάταξη του `LEGALITY_TIERS` χωρίς αλλαγή στα `RANKS` | Β2 |
 * | Μ2 | `isAtLeastTier`: `>=` → `>` | Β4 |
 * | Μ3 | `strongerTier`: `>` → `<` | Β3 |
 * | Μ4 | προσθήκη `'undeclared'` ως πέμπτη βαθμίδα | Β5 |
 */

import {
  isAtLeastTier,
  legalityTierRank,
  LEGALITY_TIERS,
  LEGALITY_TIER_RANKS,
  strongerTier,
} from '../legality-tier';

describe('Β1 — το λεξιλόγιο είναι κλειστό και χωρίς διπλότυπα', () => {
  it('τέσσερις βαθμίδες, καμία δύο φορές', () => {
    expect(LEGALITY_TIERS).toHaveLength(4);
    expect(new Set(LEGALITY_TIERS).size).toBe(LEGALITY_TIERS.length);
  });

  it('🔴 τα ΟΝΟΜΑΤΑ των δύο εγκεκριμένων εγγράφων υπάρχουν και τα δύο', () => {
    // ADR-835 §7 ονόμασε το `document-provided` και το `registry-verified`·
    // η SPEC-777 §24.5 (**εγκεκριμένη**) ονόμασε τη βαθμίδα του επαγγελματία και το
    // `self-declared`. Η συμφιλίωση **δεν επιτρέπεται να χάσει** καμία από τις δύο.
    expect(LEGALITY_TIERS).toContain('self-declared');
    expect(LEGALITY_TIERS).toContain('document-provided');
    expect(LEGALITY_TIERS).toContain('professional-attested');
    expect(LEGALITY_TIERS).toContain('registry-verified');
  });
});

describe('Β2 — η σειρά του πίνακα ΕΙΝΑΙ η σειρά των αριθμών', () => {
  it('🔴 οι βαθμοί συμφωνούν με τη δηλωμένη σειρά, θέση προς θέση', () => {
    // Η μόνη άγκυρα που πιάνει «αναδιάταξη για ευκολία»: χωρίς αυτήν, ο πίνακας και
    // οι αριθμοί θα μπορούσαν να αποκλίνουν σιωπηλά, και **κάθε** σύγκριση μαζί τους.
    LEGALITY_TIERS.forEach((tier, index) => {
      expect(legalityTierRank(tier)).toBe(index);
    });
  });

  it('οι βαθμοί είναι 0..3 χωρίς κενά και χωρίς διπλά', () => {
    const ranks = Object.values(LEGALITY_TIER_RANKS).sort((a, b) => a - b);
    expect(ranks).toEqual([0, 1, 2, 3]);
  });

  it('η κλίμακα είναι ΓΝΗΣΙΩΣ αύξουσα — κάθε σκαλοπάτι πάνω από το προηγούμενο', () => {
    for (let i = 1; i < LEGALITY_TIERS.length; i += 1) {
      expect(legalityTierRank(LEGALITY_TIERS[i])).toBeGreaterThan(
        legalityTierRank(LEGALITY_TIERS[i - 1])
      );
    }
  });
});

describe('Β3 — η ισχυρότερη από τις δύο', () => {
  it('διαλέγει ψηλότερα, ανεξάρτητα από τη σειρά των ορισμάτων', () => {
    expect(strongerTier('self-declared', 'registry-verified')).toBe('registry-verified');
    expect(strongerTier('registry-verified', 'self-declared')).toBe('registry-verified');
  });

  it('το έγγραφο που κανείς δεν άνοιξε είναι ΑΣΘΕΝΕΣΤΕΡΟ από την υπογραφή επαγγελματία', () => {
    expect(strongerTier('document-provided', 'professional-attested')).toBe(
      'professional-attested'
    );
  });

  it('ισοπαλία ⇒ η ίδια τιμή', () => {
    expect(strongerTier('document-provided', 'document-provided')).toBe('document-provided');
  });
});

describe('Β4 — 🔴 το κατώφλι, και το ΙΣΟΝ που ανήκει μέσα', () => {
  it('η ίδια η βαθμίδα φτάνει το κατώφλι της', () => {
    // Η παγίδα «φρουρός με αυστηρή ανισότητα» μετρήθηκε σε ΔΥΟ αρχεία στη Φ3.
    // Ένα `>` εδώ θα απέρριπτε **ακριβώς** τη βαθμίδα που ζητήθηκε.
    for (const tier of LEGALITY_TIERS) {
      expect(isAtLeastTier(tier, tier)).toBe(true);
    }
  });

  it('ψηλότερη φτάνει, χαμηλότερη όχι', () => {
    expect(isAtLeastTier('registry-verified', 'document-provided')).toBe(true);
    expect(isAtLeastTier('self-declared', 'document-provided')).toBe(false);
  });
});

describe('Β5 — 🔴 το «δεν δηλώθηκε» ΔΕΝ είναι βαθμίδα', () => {
  it('καμία τιμή της κλίμακας δεν ονομάζει την απουσία', () => {
    // Μια πέμπτη τιμή `'undeclared'` θα έκανε το «κανείς δεν κοίταξε» να μετρηθεί ως
    // **σκαλοπάτι** — δηλαδή ασθενής ισχυρισμός αντί για απουσία ισχυρισμού.
    // Η απουσία εκφράζεται με απουσία ΑΞΙΩΣΗΣ (`LegalitySignal.state`).
    const forbidden = ['undeclared', 'none', 'unknown', 'not-declared'];
    for (const name of forbidden) {
      expect(LEGALITY_TIERS as readonly string[]).not.toContain(name);
    }
  });
});
