/**
 * ADR-841 §7 Α23 Φ4 Α2 — τα νομικά στοιχεία όπως τα διαβάζει ο επισκέπτης.
 *
 *   • Ε1–Ε3 — η έδρα λέει ΜΟΝΟ ό,τι επέτρεψε η δημοσίευση (municipality ⇒ μόνο ο δήμος)
 *   • Π1 — 🔴 ο ΙΔΙΟΣ αριθμός ΓΕΜΗ ως πιστοποιητικό ⇒ λέγεται ΜΙΑ φορά (στα νομικά στοιχεία)
 *   • Π2–Π4 — θετικοί μάρτυρες: άλλος αριθμός · άλλη αρχή · χωρίς νομική ταυτότητα ⇒ τίποτα δεν κρύβεται
 */

import {
  BROKER_CREDENTIAL,
  legalIdentityFixture,
  TRADE_CREDENTIAL,
} from '@/lib/agency/__fixtures__/showcase-fixture';
import { credentialsBesideLegalIdentity, seatLineOf } from '../showcase-legal-presentation';

describe('seatLineOf', () => {
  it('Ε1 — full ⇒ οδός, Τ.Κ. και πόλη', () => {
    expect(seatLineOf({ disclosure: 'full', streetLine: 'Τσιμισκή 12', postalCode: '54624', locality: 'Θεσσαλονίκη' })).toBe(
      'Τσιμισκή 12, 54624 Θεσσαλονίκη',
    );
  });

  it('Ε2 — business-address χωρίς Τ.Κ. ⇒ οδός και πόλη', () => {
    expect(seatLineOf({ disclosure: 'business-address', streetLine: 'Εγνατίας 5', postalCode: null, locality: 'Θεσσαλονίκη' })).toBe(
      'Εγνατίας 5, Θεσσαλονίκη',
    );
  });

  it('🔴 Ε3 — municipality ⇒ ΜΟΝΟ ο δήμος', () => {
    expect(seatLineOf({ disclosure: 'municipality', streetLine: null, postalCode: null, locality: 'Θεσσαλονίκη' })).toBe('Θεσσαλονίκη');
  });
});

describe('credentialsBesideLegalIdentity', () => {
  it('🔴 Π1 — ο ΙΔΙΟΣ αριθμός ΓΕΜΗ ⇒ το πιστοποιητικό δεν επαναλαμβάνεται', () => {
    expect(credentialsBesideLegalIdentity([BROKER_CREDENTIAL, TRADE_CREDENTIAL], legalIdentityFixture())).toEqual([TRADE_CREDENTIAL]);
  });

  it('🔑 Π2 — ΑΛΛΟΣ αριθμός ⇒ άλλο γεγονός, μένει', () => {
    const other = legalIdentityFixture({ gemiNumber: '999999999000' });
    expect(credentialsBesideLegalIdentity([BROKER_CREDENTIAL], other)).toEqual([BROKER_CREDENTIAL]);
  });

  it('🔑 Π3 — χωρίς αριθμό ΓΕΜΗ στην ταυτότητα ⇒ μένουν όλα', () => {
    const credentials = [BROKER_CREDENTIAL, TRADE_CREDENTIAL];
    expect(credentialsBesideLegalIdentity(credentials, legalIdentityFixture({ gemiNumber: null }))).toBe(credentials);
  });

  it('🔑 Π4 — βιτρίνα πριν την Α23 (καμία νομική ταυτότητα) ⇒ ίδια αναφορά', () => {
    const credentials = [BROKER_CREDENTIAL];
    expect(credentialsBesideLegalIdentity(credentials, null)).toBe(credentials);
  });
});
