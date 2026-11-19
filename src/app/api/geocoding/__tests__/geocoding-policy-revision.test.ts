/**
 * @fileoverview Άγκυρα **σκάλα ⇄ έκδοση πολιτικής** (ADR-332 §D32).
 * @related lib/geocoding/geocoding-policy-revision · app/api/geocoding/geocoding-ladder · geocoding-cache
 *
 * 🔴 Το D31 άλλαξε τη σκάλα **χωρίς** να αυξήσει την έκδοση της cache (`geocoding:v2`) — και κανείς δεν
 * το είδε. Από το §D32 η ίδια έκδοση ακυρώνει **και** το ίχνος `unmatched` των αποθηκευμένων διευθύνσεων:
 * μια σιωπηλή αλλαγή σκάλας σημαίνει ότι η βελτίωση **δεν φτάνει ποτέ** στις διευθύνσεις που απέτυχαν πριν.
 *
 * ⚠️ **ΑΝ ΚΟΚΚΙΝΙΣΕΙ:** άλλαξες τη σκάλα. Αύξησε το `GEOCODING_POLICY_REVISION` **και** ενημέρωσε το
 * snapshot (`-u`) στο ίδιο commit. Ενημέρωση snapshot χωρίς αύξηση = η αποτυχία που αυτό το test υπάρχει να πιάσει.
 */

/* global describe, it, expect */

import { buildGeocodingLadder } from '../geocoding-ladder';
import { GEOCODING_POLICY_REVISION } from '@/lib/geocoding/geocoding-policy-revision';

/** Πλήρες αίτημα — κάθε βαθμίδα της σκάλας εφαρμόζεται ή δηλώνεται `skipped`. */
const FULL_REQUEST = {
  street: 'Τσιμισκή',
  number: '10',
  postalCode: '54624',
  neighborhood: 'Κέντρο',
  city: 'Θεσσαλονίκη',
  region: 'Κεντρική Μακεδονία',
  country: 'Ελλάδα',
};

/** Το **σχήμα** της σκάλας — χωρίς URL βάσης, ώστε να μην εξαρτάται από περιβάλλον. */
function ladderShape() {
  return buildGeocodingLadder(FULL_REQUEST, 'gr').map((step) => ({
    variant: step.variant,
    applies: step.url !== null,
    guarded: typeof step.accept === 'function',
    relaxation: step.relaxation ?? null,
  }));
}

describe('§D32 — η σκάλα και η έκδοση πολιτικής αλλάζουν ΜΑΖΙ', () => {
  it('το σχήμα της σκάλας είναι δεμένο με τον αριθμό έκδοσης', () => {
    expect({ revision: GEOCODING_POLICY_REVISION, ladder: ladderShape() }).toMatchSnapshot();
  });
});
