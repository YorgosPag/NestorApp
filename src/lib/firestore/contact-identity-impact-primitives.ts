/**
 * =============================================================================
 * ContactIdentityImpactPrimitives — τα δύο σταθερά άκρα της προεπισκόπησης
 * =============================================================================
 *
 * Οι δύο υπηρεσίες προεπισκόπησης ταυτότητας (`contact-identity`, `service-identity`)
 * έγραφαν **αυτολεξεί** τα ίδια δύο άκρα:
 *
 *   1. «καμία αλλαγή» → `allow` με μηδενικά πάντα
 *   2. «το ερώτημα απέτυχε» → `block` (fail-safe), με μηδενικά πάντα
 *
 * Το `jscpd` το μέτρησε ως κλώνο 8 γραμμών / 51 tokens (CHECK 3.28, N.18). Ο
 * κίνδυνος δεν είναι οι γραμμές: είναι ότι το **fail-safe** μπορούσε να αποκλίνει
 * σιωπηλά — αν κάποιος γύριζε το ένα από `block` σε `allow` «για ευκολία», η
 * αστοχία ερωτήματος θα επέτρεπε αθόρυβα μια μετάλλαξη σε μία μόνο από τις δύο
 * διαδρομές, και κανένα test της άλλης δεν θα το έπιανε.
 *
 * ⚠️ Δεν είναι God-shell: το **ενδιάμεσο** (χαρτογράφηση εξαρτήσεων, παραγωγή
 * `mode`, `affectedDomains`) μένει σε κάθε υπηρεσία, γιατί εκεί οι δύο **όντως**
 * διαφέρουν — η μία ξέρει από ΑΜΚΑ και κατηγορίες πεδίων, η άλλη όχι. Ίδιο
 * σκεπτικό με το {@link ./impact-preview-primitives} (ADR-591).
 *
 * @module lib/firestore/contact-identity-impact-primitives
 * @see ADR-591 — Impact-Preview Primitives SSoT
 * @see ADR-145 — Contact Dependency SSoT
 */

import 'server-only';

import type {
  ContactIdentityAffectedDomainId,
  ContactIdentityImpactPreview,
} from '@/types/contact-identity-impact';

/** Οι αλλαγές όπως τις δέχεται η προεπισκόπηση — ατομικές **ή** υπηρεσίας. */
export type IdentityImpactChanges = ContactIdentityImpactPreview['changes'];

/**
 * Καμία αλλαγή ⇒ καμία επίπτωση. Το `changes` ταξιδεύει πίσω αυτούσιο ώστε ο
 * διάλογος να δείχνει τι ζητήθηκε, ακόμα κι όταν η λίστα είναι κενή.
 */
export function allowIdentityImpact(
  changes: IdentityImpactChanges,
): ContactIdentityImpactPreview {
  return {
    mode: 'allow',
    changes,
    dependencies: [],
    affectedDomains: [],
    messageKey: 'identityImpact.messages.allow',
    blockingCount: 0,
    warningCount: 0,
  };
}

/**
 * Το ερώτημα εξαρτήσεων απέτυχε ⇒ **`block`**, όχι `allow`.
 *
 * 🔴 Η κατεύθυνση είναι η ουσία: άγνωστη επίπτωση δεν σημαίνει «καμία επίπτωση».
 * Αν η μέτρηση δεν έγινε, η μετάλλαξη δεν επιτρέπεται — αλλιώς μια πεσμένη
 * σύνδεση Firestore μετατρέπεται σε σιωπηλή άδεια αλλαγής ταυτότητας.
 *
 * Τα `affectedDomains` μένουν όρισμα επειδή οι δύο υπηρεσίες τα γνωρίζουν
 * διαφορετικά: η μία τα παράγει από τα πεδία που άλλαξαν, η άλλη έχει σταθερό
 * σύνολο.
 */
export function unavailableIdentityImpact(
  changes: IdentityImpactChanges,
  affectedDomains: ReadonlyArray<ContactIdentityAffectedDomainId>,
): ContactIdentityImpactPreview {
  return {
    mode: 'block',
    changes,
    dependencies: [],
    affectedDomains,
    messageKey: 'identityImpact.messages.unavailable',
    blockingCount: 0,
    warningCount: 0,
  };
}
