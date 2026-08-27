/**
 * ADR-132 — **Η ΚΛΙΜΑΚΑ ΣΥΝΑΦΕΙΑΣ ESCO**, μία φορά.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΤΡΙΑ ΑΝΤΙΓΡΑΦΑ, ΔΥΟ ΑΠΟ ΤΑ ΟΠΟΙΑ ΕΙΧΑΝ ΑΠΟΚΛΙΝΕΙ
 *
 * Η ίδια σκάλα *(ακριβές → πρόθεμα → περιέχει → συνώνυμο → σκέτο token)* ζούσε
 * σε **τρία** σημεία:
 *
 * | Τόπος | Σκαλοπάτια | Απόκλιση |
 * |---|---|---|
 * | `esco.service.ts` *(επαγγέλματα, πελάτης)* | 1.0 · 0.9 · 0.8 *(ISCO)* · 0.7 · 0.6 · 0.5 | — |
 * | `esco-skill.service.ts` *(δεξιότητες, πελάτης)* | 1.0 · 0.9 · 0.7 · 0.6 · 0.5 | **χωρίς** ISCO *(σωστό: οι δεξιότητες δεν έχουν κωδικό)* |
 * | `ai-pipeline/tools/esco-search-utils.ts` *(διακομιστής)* | 1.0 · 0.9 · 0.7 · 0.5 | 🔴 **χωρίς συνώνυμα** — ίδια ερώτηση, **άλλη σειρά αποτελεσμάτων** στον διακομιστή απ' ό,τι στην οθόνη |
 *
 * 🔑 Η τρίτη γραμμή είναι το εύρημα: ο διακομιστής επέβαλλε στον χρήστη
 * *«διάλεξε από τη λίστα»* με κατάταξη που **δεν ήταν** αυτή που έβλεπε ο
 * χρήστης. Δεν ήταν σφάλμα που κοκκινίζει — ήταν **δεύτερη κρίση**.
 *
 * ⚠️ Η σκάλα διατηρήθηκε **ακέραιη**: η ενοποίηση δεν άλλαξε καμία τιμή. Η
 * μοναδική συμπεριφορική αλλαγή είναι ότι ο διακομιστής **βλέπει πλέον τα
 * συνώνυμα** — όταν του δοθούν· όπου δεν δίνονται, το αποτέλεσμα είναι
 * **ταυτόσημο** με πριν.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * @module lib/esco/relevance
 */

import { normalizeEscoText } from './search-tokens';

/**
 * Τα σκαλοπάτια, **ονομασμένα**. Ένας γυμνός αριθμός `0.6` μέσα σε `if` δεν λέει
 * σε κανέναν γιατί είναι κάτω από το `0.7` και πάνω από το `0.5`.
 */
export const ESCO_RELEVANCE = {
  /** Η ετικέτα **είναι** το ερώτημα. */
  exact: 1.0,
  /** Η ετικέτα **αρχίζει** με το ερώτημα — αυτό που κάνει το autocomplete. */
  prefix: 0.9,
  /** Ταίριασμα σε **δευτερεύον κλειδί** *(π.χ. κωδικός ISCO)*. */
  secondaryKey: 0.8,
  /** Η ετικέτα **περιέχει** το ερώτημα. */
  contains: 0.7,
  /** Ταίριασμα σε **συνώνυμο**. */
  alternative: 0.6,
  /** Μόνο τα tokens ταίριαξαν — το ελάχιστο για να μπει στη λίστα. */
  token: 0.5,
} as const;

/** Πού βρέθηκε το ταίριασμα. Οι καταναλωτές το δείχνουν ή το εξηγούν. */
export type EscoMatchedField = 'preferredLabel' | 'alternativeLabel' | 'secondaryKey';

export interface EscoRelevanceVerdict {
  readonly score: number;
  readonly matchedField: EscoMatchedField;
}

/** Τι δίνεται στην κρίση. Όλα **ήδη κανονικοποιημένα** εκτός των συνωνύμων. */
export interface EscoRelevanceInput {
  readonly normalizedLabel: string;
  readonly normalizedQuery: string;
  /** Ωμά συνώνυμα· κανονικοποιούνται εδώ. Κενό ⇒ το σκαλοπάτι παραλείπεται. */
  readonly alternatives?: readonly string[];
  /**
   * Δευτερεύον κλειδί *(στα επαγγέλματα: ο κωδικός ISCO)*. Ρωτιέται **μόνο** αν
   * καμία ετικέτα δεν ταίριαξε — όπως ακριβώς και πριν.
   */
  readonly secondaryKeyMatches?: boolean;
}

/**
 * **Η κρίση**, σε μία σκάλα, για όλους τους καταναλωτές του ESCO.
 *
 * ⚠️ Η **σειρά** των ελέγχων είναι η συμπεριφορά: ένα `contains` που ελεγχόταν
 * πριν το `startsWith` θα ισοπέδωνε το autocomplete. Μην την αναδιατάξεις.
 */
export function judgeEscoRelevance(input: EscoRelevanceInput): EscoRelevanceVerdict {
  const { normalizedLabel, normalizedQuery } = input;

  if (normalizedLabel === normalizedQuery) {
    return { score: ESCO_RELEVANCE.exact, matchedField: 'preferredLabel' };
  }
  if (normalizedLabel.startsWith(normalizedQuery)) {
    return { score: ESCO_RELEVANCE.prefix, matchedField: 'preferredLabel' };
  }
  if (normalizedLabel.includes(normalizedQuery)) {
    return { score: ESCO_RELEVANCE.contains, matchedField: 'preferredLabel' };
  }
  if (input.secondaryKeyMatches === true) {
    return { score: ESCO_RELEVANCE.secondaryKey, matchedField: 'secondaryKey' };
  }
  for (const alternative of input.alternatives ?? []) {
    if (normalizeEscoText(alternative).includes(normalizedQuery)) {
      return { score: ESCO_RELEVANCE.alternative, matchedField: 'alternativeLabel' };
    }
  }
  return { score: ESCO_RELEVANCE.token, matchedField: 'preferredLabel' };
}
