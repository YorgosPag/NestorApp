/**
 * ΑΓΚΥΡΕΣ — **Η ΚΛΙΜΑΚΑ ΣΥΝΑΦΕΙΑΣ ESCO** (ADR-132).
 *
 * 🔑 Η βλάβη που φυλάνε: η **σειρά** των σκαλοπατιών **είναι** η συμπεριφορά.
 * Πριν την ενοποίηση υπήρχαν **τρεις** κλίμακες, και η μία *(διακομιστής)*
 * αγνοούσε τα συνώνυμα — δηλαδή έδινε **άλλη κατάταξη** από αυτήν που έβλεπε ο
 * άνθρωπος, στην ίδια ερώτηση.
 */

import {
  judgeEscoRelevance,
  ESCO_RELEVANCE,
} from '../relevance';

const QUERY = 'μηχανικος';

describe('Α. η σκάλα, σκαλοπάτι-σκαλοπάτι', () => {
  it('ακριβές ταίριασμα = 1.0', () => {
    expect(judgeEscoRelevance({ normalizedLabel: QUERY, normalizedQuery: QUERY })).toEqual({
      score: ESCO_RELEVANCE.exact,
      matchedField: 'preferredLabel',
    });
  });

  it('πρόθεμα = 0.9 — αυτό είναι το autocomplete', () => {
    expect(
      judgeEscoRelevance({ normalizedLabel: 'μηχανικος αυτοκινητων', normalizedQuery: QUERY }).score,
    ).toBe(ESCO_RELEVANCE.prefix);
  });

  it('περιέχει = 0.7', () => {
    expect(
      judgeEscoRelevance({ normalizedLabel: 'πολιτικος μηχανικος', normalizedQuery: QUERY }).score,
    ).toBe(ESCO_RELEVANCE.contains);
  });

  it('μόνο tokens = 0.5', () => {
    expect(judgeEscoRelevance({ normalizedLabel: 'ασχετο', normalizedQuery: QUERY }).score).toBe(
      ESCO_RELEVANCE.token,
    );
  });
});

describe('Β. η σειρά ΕΙΝΑΙ η συμπεριφορά', () => {
  it('🔑 το πρόθεμα ΝΙΚΑ το «περιέχει» — αλλιώς το autocomplete ισοπεδώνεται', () => {
    // Η ετικέτα ικανοποιεί ΚΑΙ τα δύο κριτήρια.
    const verdict = judgeEscoRelevance({
      normalizedLabel: 'μηχανικος μηχανικος',
      normalizedQuery: QUERY,
    });
    expect(verdict.score).toBe(ESCO_RELEVANCE.prefix);
    expect(verdict.score).toBeGreaterThan(ESCO_RELEVANCE.contains);
  });

  it('το δευτερεύον κλειδί ρωτιέται ΜΟΝΟ αν καμία ετικέτα δεν ταίριαξε', () => {
    // Ταιριάζει η ετικέτα ⇒ ο κωδικός δεν παίζει ρόλο.
    expect(
      judgeEscoRelevance({
        normalizedLabel: QUERY,
        normalizedQuery: QUERY,
        secondaryKeyMatches: true,
      }).score,
    ).toBe(ESCO_RELEVANCE.exact);

    // Δεν ταιριάζει τίποτα ⇒ ο κωδικός ανεβάζει στο 0.8.
    expect(
      judgeEscoRelevance({
        normalizedLabel: 'ασχετο',
        normalizedQuery: QUERY,
        secondaryKeyMatches: true,
      }),
    ).toEqual({ score: ESCO_RELEVANCE.secondaryKey, matchedField: 'secondaryKey' });
  });

  it('🔴 το δευτερεύον κλειδί ΝΙΚΑ το συνώνυμο — όπως πριν την ενοποίηση', () => {
    const verdict = judgeEscoRelevance({
      normalizedLabel: 'ασχετο',
      normalizedQuery: QUERY,
      alternatives: ['Μηχανικός Έργων'],
      secondaryKeyMatches: true,
    });
    expect(verdict.score).toBe(ESCO_RELEVANCE.secondaryKey);
    expect(ESCO_RELEVANCE.secondaryKey).toBeGreaterThan(ESCO_RELEVANCE.alternative);
  });
});

describe('Γ. τα συνώνυμα — το σκαλοπάτι που έλειπε από τον διακομιστή', () => {
  it('συνώνυμο ταιριάζει ⇒ 0.6, και ονομάζεται', () => {
    expect(
      judgeEscoRelevance({
        normalizedLabel: 'ασχετο',
        normalizedQuery: QUERY,
        alternatives: ['Δομοστατικός', 'Μηχανικός Έργων'],
      }),
    ).toEqual({ score: ESCO_RELEVANCE.alternative, matchedField: 'alternativeLabel' });
  });

  it('τα συνώνυμα κανονικοποιούνται — τόνοι και κεφαλαία δεν εμποδίζουν', () => {
    expect(
      judgeEscoRelevance({
        normalizedLabel: 'ασχετο',
        normalizedQuery: QUERY,
        alternatives: ['ΜΗΧΑΝΙΚΌΣ ΈΡΓΩΝ'],
      }).score,
    ).toBe(ESCO_RELEVANCE.alternative);
  });

  it('χωρίς συνώνυμα ⇒ πέφτει στο 0.5, ταυτόσημα με την παλιά κλίμακα διακομιστή', () => {
    expect(
      judgeEscoRelevance({ normalizedLabel: 'ασχετο', normalizedQuery: QUERY, alternatives: [] })
        .score,
    ).toBe(ESCO_RELEVANCE.token);
  });
});
