/**
 * @jest-environment node
 *
 * ADR-835 §22 (Στάδιο Γ) — **ο μυστικός σύνδεσμος εξαγωγής.**
 *
 * Τέσσερα ερωτήματα: *υπογράφεται;* · *είναι η **εμβέλεια** μέσα στην υπογραφή;* ·
 * *ακυρώνει η γενιά;* · *τι γίνεται **χωρίς** μυστικό;*
 */

import {
  stayExportClaimOf,
  stayExportConfigured,
  stayExportToken,
  STAY_EXPORT_SCOPE_ALL,
  STAY_ICAL_SECRET_ENV,
} from '@/services/stay-calendar/stay-channel-export.service';

const PROPERTY = 'ownp_a';
const FEED = 'schf_airbnb';

function withSecret(secret: string | undefined, run: () => void): void {
  const previous = process.env[STAY_ICAL_SECRET_ENV];
  if (secret === undefined) delete process.env[STAY_ICAL_SECRET_ENV];
  else process.env[STAY_ICAL_SECRET_ENV] = secret;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env[STAY_ICAL_SECRET_ENV];
    else process.env[STAY_ICAL_SECRET_ENV] = previous;
  }
}

describe('Τ — ο σύνδεσμος υπογράφεται και διαβάζεται', () => {
  it('Τ1. υπογραφή → ισχυρισμός: ακίνητο, εμβέλεια, γενιά', () => {
    withSecret('secret-a', () => {
      const token = stayExportToken(PROPERTY, STAY_EXPORT_SCOPE_ALL, 3);
      expect(token).not.toBeNull();
      expect(stayExportClaimOf(token ?? '')).toEqual({
        ok: true, propertyId: PROPERTY, scope: { kind: 'all' }, generation: 3,
      });
    });
  });

  it('Τ2. εμβέλεια feed ⇒ ο σύνδεσμος του καναλιού, ονομασμένος', () => {
    withSecret('secret-a', () => {
      const claim = stayExportClaimOf(stayExportToken(PROPERTY, FEED, 1) ?? '');
      expect(claim).toEqual({ ok: true, propertyId: PROPERTY, scope: { kind: 'feed', feedId: FEED }, generation: 1 });
    });
  });

  it('🔴 Τ3. η ΕΜΒΕΛΕΙΑ είναι ΜΕΣΑ στην υπογραφή: αλλαγμένο πεδίο ⇒ άκυρος', () => {
    withSecret('secret-a', () => {
      const token = stayExportToken(PROPERTY, FEED, 1) ?? '';
      // Το token είναι base64url του `πεδία:υπογραφή`. Αλλάζουμε την **εμβέλεια** και
      // κρατάμε την υπογραφή — αυτό θα ήταν «δώσε μου ΟΛΑ τα γεγονότα» από το κανάλι.
      const decoded = Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
      const tampered = decoded.replace(FEED, STAY_EXPORT_SCOPE_ALL);
      const retoken = Buffer.from(tampered, 'utf-8').toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      expect(stayExportClaimOf(retoken)).toEqual({ ok: false, reason: 'invalid' });
    });
  });

  it('🔴 Τ4. άλλο μυστικό ⇒ άκυρος (η υπογραφή είναι η εξουσιοδότηση)', () => {
    let token = '';
    withSecret('secret-a', () => {
      token = stayExportToken(PROPERTY, STAY_EXPORT_SCOPE_ALL, 1) ?? '';
    });
    withSecret('secret-b', () => {
      expect(stayExportClaimOf(token)).toEqual({ ok: false, reason: 'invalid' });
    });
  });

  it('🔑 Τ5. η γενιά ΤΑΞΙΔΕΥΕΙ μέσα στην υπογραφή ⇒ η ανάκληση είναι ΚΑΤΑΣΤΑΣΗ, όχι λήξη', () => {
    withSecret('secret-a', () => {
      const old = stayExportClaimOf(stayExportToken(PROPERTY, STAY_EXPORT_SCOPE_ALL, 1) ?? '');
      const fresh = stayExportClaimOf(stayExportToken(PROPERTY, STAY_EXPORT_SCOPE_ALL, 2) ?? '');
      // Και τα δύο έγκυρα **υπογραφικά**: ποιο ζει το κρίνει το έγγραφο (η διαδρομή).
      expect(old).toMatchObject({ ok: true, generation: 1 });
      expect(fresh).toMatchObject({ ok: true, generation: 2 });
    });
  });

  it('🔴 Τ6. ΧΩΡΙΣ μυστικό: κανένας σύνδεσμος, και η άρνηση λέει «δικό ΜΑΣ» πρόβλημα', () => {
    withSecret(undefined, () => {
      expect(stayExportConfigured()).toBe(false);
      expect(stayExportToken(PROPERTY, STAY_EXPORT_SCOPE_ALL, 1)).toBeNull();
      expect(stayExportClaimOf('οτιδήποτε')).toEqual({ ok: false, reason: 'server-config' });
    });
  });

  it('Τ7. σκουπίδια ⇒ άκυρος, χωρίς εξαίρεση', () => {
    withSecret('secret-a', () => {
      for (const token of ['', 'abc', 'YWJj', '....']) {
        expect(stayExportClaimOf(token).ok).toBe(false);
      }
    });
  });
});
