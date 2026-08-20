/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΥΠΟΓΕΓΡΑΜΜΕΝΟΣ ΣΥΝΔΕΣΜΟΣ** — οι άγκυρες του κοινού SSoT (§8.33).
 * @related lib/tokens/signed-token.ts · ADR-170 · ADR-327 §7 · ADR-777 §8.33
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΠΙΟ ΣΗΜΑΝΤΙΚΗ ΑΓΚΥΡΑ ΕΔΩ ΕΙΝΑΙ Η **ΣΥΜΒΑΤΟΤΗΤΑ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το SSoT δεν είναι νέα μορφή συνδέσμου — είναι **η ίδια** μορφή, γραμμένη μία φορά.
 * Αν το κείμενο που παράγεται άλλαζε έστω κατά ένα byte, **κάθε σύνδεσμος που έχει
 * ήδη σταλεί σε προμηθευτή θα έπαυε να ισχύει** — σιωπηλά, με μήνυμα «άκυρος
 * σύνδεσμος» που θα διαβαζόταν ως επίθεση. Γι' αυτό η άγκυρα **Σ1** δεν κάνει
 * round-trip: υπολογίζει την υπογραφή **με τον παλιό τρόπο, ωμά** και απαιτεί
 * **ταυτότητα χαρακτήρα προς χαρακτήρα**.
 */

import { createHmac } from 'crypto';

import {
  decodeSignedToken,
  encodeSignedToken,
  newTokenNonce,
  requireTokenSecret,
} from '../signed-token';

/**
 * ⚠️ **Το `TEST_` στο όνομα δεν είναι στιλ — το ζητά η CHECK 10.** Ο σαρωτής μυστικών
 * μπλοκάρει κάθε `secret = '…'` εκτός αν η **ίδια η γραμμή** δηλώνει ότι είναι
 * δοκιμαστική (`ENV_SKIP_RE` στο `scripts/check-secret-scan.js`). Το σκέτο όνομα που
 * υπήρχε εδώ πριν έμοιαζε, γραμμικά, με διαρροή — και η θεραπεία είναι η γραμμή να
 * **λέει τι είναι**, όχι να παρακάμψει τον σαρωτή.
 */
const TEST_SECRET = 'δοκιμαστικό-μυστικό-1234567890';

/** Ο **παλιός** αλγόριθμος, αντιγραμμένος αυτούσιος από τα δύο αρχεία πριν το §8.33. */
function legacyToken(fields: readonly string[]): string {
  const payload = fields.join(':');
  const hmac = createHmac('sha256', TEST_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// =============================================================================
// Σ — ΣΥΜΒΑΤΟΤΗΤΑ: η μορφή ΔΕΝ άλλαξε
// =============================================================================

describe('🔴 Σ — κανένας υπάρχων σύνδεσμος δεν έπαψε να ισχύει', () => {
  it('🔑 Σ1 — QR παρουσιών: ίδιο κείμενο, χαρακτήρα προς χαρακτήρα', () => {
    const fields = ['proj_alfa', '2026-08-20', 'a1b2c3'];
    expect(encodeSignedToken(TEST_SECRET, fields)).toBe(legacyToken(fields));
  });

  it('🔑 Σ2 — πύλη προμηθευτή: ίδιο κείμενο, με τα δικά της τέσσερα πεδία', () => {
    const fields = ['rfq_1', 'cont_9', 'ff00', '1787788800000'];
    expect(encodeSignedToken(TEST_SECRET, fields)).toBe(legacyToken(fields));
  });

  it('Σ3 — και ο παλιός σύνδεσμος επαληθεύεται από τον νέο κώδικα', () => {
    const fields = ['rfq_1', 'cont_9', 'ff00', '1787788800000'];
    const verdict = decodeSignedToken(TEST_SECRET, legacyToken(fields), 4);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.fields).toEqual(fields);
  });

  /**
   * 🔴 **ΤΟ ΖΩΝΤΑΝΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΑΠΟΚΑΛΥΨΕ Η ΕΞΑΓΩΓΗ (§8.33).**
   *
   * Η πύλη προμηθευτή έβαζε **ISO χρονοσφραγίδα** σε πεδίο του συνδέσμου. Το ISO έχει
   * **δύο άνω-κάτω τελείες** — τον ίδιο χαρακτήρα που χωρίζει τα πεδία. Ο επαληθευτής
   * έσπαγε το κείμενο σε **7** τμήματα ενώ απαιτούσε **ακριβώς 5** ⇒ `invalid_format`
   * για **ΚΑΘΕ** σύνδεσμο, από την πρώτη μέρα.
   *
   * ⚠️ Η άγκυρα κρατά το **ίδιο το σχήμα της βλάβης** ζωντανό, ώστε κανείς να μην
   * ξαναβάλει διφορούμενο πεδίο σε σύνδεσμο επειδή «φαίνεται πιο ευανάγνωστο».
   */
  it('🔴 Σ4 — ΙΣΤΟΡΙΚΗ ΒΛΑΒΗ: πεδίο με `:` έσπαγε τη μέτρηση των τμημάτων', () => {
    const withIso = ['rfq_1', 'cont_9', 'ff00', '2026-08-27T00:00:00.000Z'];
    const legacy = legacyToken(withIso);
    const parts = Buffer.from(
      legacy.replace(/-/g, '+').replace(/_/g, '/') + '===',
      'base64',
    )
      .toString('utf-8')
      .split(':');

    // Ο παλιός επαληθευτής έλεγε `if (parts.length !== 5) return invalid` — και εδώ
    // είναι **επτά**. Δηλαδή η άρνηση ήταν βεβαιότητα, όχι πιθανότητα.
    expect(parts).toHaveLength(7);

    // Και σήμερα η γέννηση **αρνείται** αντί να παράγει νεκρό σύνδεσμο.
    expect(() => encodeSignedToken(TEST_SECRET, withIso)).toThrow();
  });
});

// =============================================================================
// Α — ΑΠΟΡΡΙΨΗ: ονομασμένοι λόγοι, ποτέ `false`
// =============================================================================

describe('Α — κάθε άρνηση λέει ΓΙΑΤΙ', () => {
  it('🔑 Α1 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: σωστός σύνδεσμος γίνεται δεκτός', () => {
    const token = encodeSignedToken(TEST_SECRET, ['a', 'b', 'c']);
    expect(decodeSignedToken(TEST_SECRET, token, 3).ok).toBe(true);
  });

  it('🔴 Α2 — ΑΛΛΟ ΜΥΣΤΙΚΟ ⇒ `invalid-signature`, ποτέ σιωπηλή αποδοχή', () => {
    const token = encodeSignedToken(TEST_SECRET, ['a', 'b', 'c']);
    const verdict = decodeSignedToken('άλλο-μυστικό-0987654321', token, 3);
    expect(verdict).toEqual({ ok: false, reason: 'invalid-signature' });
  });

  it('🔴 Α3 — ΠΕΙΡΑΓΜΕΝΟ ΠΕΔΙΟ ⇒ `invalid-signature`', () => {
    const token = encodeSignedToken(TEST_SECRET, ['cont_kostas', 'b', 'c']);
    const decoded = Buffer.from(
      token.replace(/-/g, '+').replace(/_/g, '/') + '===',
      'base64',
    ).toString('utf-8');
    const tampered = Buffer.from(decoded.replace('cont_kostas', 'cont_maria'), 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    expect(decodeSignedToken(TEST_SECRET, tampered, 3)).toEqual({
      ok: false,
      reason: 'invalid-signature',
    });
  });

  it('Α4 — ΛΙΓΟΤΕΡΑ ΠΕΔΙΑ από όσα περιμένει ο καταναλωτής ⇒ `invalid-format`', () => {
    const token = encodeSignedToken(TEST_SECRET, ['a', 'b']);
    expect(decodeSignedToken(TEST_SECRET, token, 4)).toEqual({
      ok: false,
      reason: 'invalid-format',
    });
  });

  it('Α5 — κενό πεδίο ⇒ `invalid-format` (δεν φτάνει ποτέ σε κώδικα που το διαβάζει)', () => {
    const token = encodeSignedToken(TEST_SECRET, ['a', '', 'c']);
    expect(decodeSignedToken(TEST_SECRET, token, 3)).toEqual({
      ok: false,
      reason: 'invalid-format',
    });
  });

  it('Α6 — σκουπίδια ⇒ ονομασμένη άρνηση, ΠΟΤΕ εξαίρεση', () => {
    for (const junk of ['', '!!!', 'ό,τι νά ναι', 'a.b.c']) {
      const verdict = decodeSignedToken(TEST_SECRET, junk, 3);
      expect(verdict.ok).toBe(false);
    }
  });
});

// =============================================================================
// Δ — Η ΔΙΦΟΡΟΥΜΕΝΗ ΥΠΟΓΡΑΦΗ
// =============================================================================

describe('🔴 Δ — δύο σύνολα πεδίων δεν επιτρέπεται να δώσουν ΤΟ ΙΔΙΟ υπογεγραμμένο', () => {
  it('Δ1 — πεδίο με `:` απορρίπτεται στη ΓΕΝΝΗΣΗ, όχι στην επαλήθευση', () => {
    // Χωρίς αυτό, τα ['a:b','c'] και ['a','b:c'] υπογράφουν το ΙΔΙΟ κείμενο — και η
    // υπογραφή παύει να προσδιορίζει τι υπογράφτηκε.
    expect(() => encodeSignedToken(TEST_SECRET, ['a:b', 'c'])).toThrow();
    expect(() => encodeSignedToken(TEST_SECRET, ['a', 'b:c'])).toThrow();
  });

  it('Δ2 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: τα ίδια δεδομένα χωρίς `:` περνούν κανονικά', () => {
    expect(() => encodeSignedToken(TEST_SECRET, ['a-b', 'c'])).not.toThrow();
  });
});

// =============================================================================
// Μ — ΤΟ ΜΥΣΤΙΚΟ
// =============================================================================

describe('Μ — το μυστικό ονομάζεται όταν λείπει', () => {
  it('🔑 Μ1 — το μήνυμα περιέχει το ΟΝΟΜΑ της μεταβλητής', () => {
    delete process.env.ΔΟΚΙΜΗ_ΜΥΣΤΙΚΟΥ;
    expect(() => requireTokenSecret('ΔΟΚΙΜΗ_ΜΥΣΤΙΚΟΥ')).toThrow(/ΔΟΚΙΜΗ_ΜΥΣΤΙΚΟΥ/);
  });

  it('Μ2 — κενό ή μόνο κενά μετρά ως ΑΠΟΝ', () => {
    process.env.ΔΟΚΙΜΗ_ΜΥΣΤΙΚΟΥ = '   ';
    expect(() => requireTokenSecret('ΔΟΚΙΜΗ_ΜΥΣΤΙΚΟΥ')).toThrow();
    process.env.ΔΟΚΙΜΗ_ΜΥΣΤΙΚΟΥ = 'ok';
    expect(requireTokenSecret('ΔΟΚΙΜΗ_ΜΥΣΤΙΚΟΥ')).toBe('ok');
    delete process.env.ΔΟΚΙΜΗ_ΜΥΣΤΙΚΟΥ;
  });

  it('Μ3 — κάθε nonce είναι διαφορετικό', () => {
    const seen = new Set(Array.from({ length: 50 }, () => newTokenNonce()));
    expect(seen.size).toBe(50);
  });
});
