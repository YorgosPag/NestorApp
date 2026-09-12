/**
 * @fileoverview **ΑΓΚΥΡΕΣ: Η ΜΙΑ ΓΡΑΜΜΑΤΙΚΗ ΤΟΥ ΣΥΡΜΑΤΟΣ** (ADR-787 §5.3 ζ, όριο 1).
 * @related lib/workspace/requested-workspace-wire · lib/auth/auth-context · lib/api/enterprise-api-client
 *
 * 🔴 **Η ζωντανή βλάβη που τις γέννησε** (2026-09-11 17:50Z): το `/o/me/projects` —
 * **ιδιωτικός** χώρος — έδειξε «Έργα (7)». Ο πελάτης μετέφερε **μόνο εταιρεία**, οπότε ο
 * ιδιωτικός χώρος έφευγε στο σύρμα ταυτόσημος με το «δεν ονομάζει χώρο η διεύθυνση», και ο
 * διακομιστής διάβασε την απουσία ως «κρίνε μόνος σου» ⇒ καθολική όψη.
 *
 * ⚠️ Ο σειριοποιητής και ο αναλυτής ζουν στο **ίδιο** αρχείο ώστε τα δύο άκρα να μην
 * μπορούν να αποκλίνουν. Η άγκυρα `Κ1` είναι ακριβώς αυτό το συμβόλαιο, εκτελεσμένο.
 */

import {
  MISSING_TENANT_ERROR_CODE,
  REQUESTED_WORKSPACE_HEADER,
  parseLegacyCompanyHeader,
  parseRequestedWorkspace,
  serializeRequestedWorkspace,
} from '../requested-workspace-wire';
import type { RequestedWorkspace } from '@/types/workspace-membership';

const ORG: RequestedWorkspace = { kind: 'org', companyId: 'comp_9c7c1234' };
const PERSONAL: RequestedWorkspace = { kind: 'personal' };
const DEFAULT_WS: RequestedWorkspace = { kind: 'default' };

describe('Κ1 — ROUND-TRIP: ό,τι γράφει ο πελάτης, το διαβάζει ο διακομιστής', () => {
  it.each([ORG, PERSONAL, DEFAULT_WS])('%o επιβιώνει αυτούσιο', (requested) => {
    const reading = parseRequestedWorkspace(serializeRequestedWorkspace(requested));

    expect(reading).toEqual({ outcome: 'declared', requested });
  });

  it('🔴 ο ιδιωτικός χώρος έχει ΟΝΟΜΑ στο σύρμα — δεν είναι σιωπή', () => {
    expect(serializeRequestedWorkspace(PERSONAL)).toBe('personal');
    // ⚠️ Η μετάλλαξη που σκοτώνει: `personal` ⇒ `''` (ή `default`). Τότε ο διακομιστής
    //    δεν μπορεί να το ξεχωρίσει από την απουσία — ΑΚΡΙΒΩΣ η βλάβη του §9 (γ).
    expect(serializeRequestedWorkspace(PERSONAL)).not.toBe('');
    expect(serializeRequestedWorkspace(PERSONAL)).not.toBe(
      serializeRequestedWorkspace(DEFAULT_WS),
    );
  });
});

describe('Κ2 — ΑΠΟΥΣΙΑ: «δεν δήλωσα» ≠ «δήλωσα λάθος»', () => {
  it.each([null, undefined, '', '   '])('%p ⇒ absent (ποτέ malformed)', (raw) => {
    expect(parseRequestedWorkspace(raw)).toEqual({ outcome: 'absent' });
  });
});

describe('Κ3 — FAIL-CLOSED: ό,τι δεν αναγνωρίζεται είναι malformed, ΠΟΤΕ προεπιλογή', () => {
  it.each([
    ['unknown-token', 'personal-ish'],
    ['unknown-token', 'Personal'],
    ['unknown-token', 'ORG:comp_1'],
    ['unknown-token', 'company:comp_1'],
    ['invalid-company-id', 'org:'],
    ['invalid-company-id', 'org:a/b'],
    ['invalid-company-id', 'org:..'],
    ['invalid-company-id', 'org:__proto__'],
    ['invalid-company-id', `org:${'x'.repeat(201)}`],
    ['invalid-company-id', 'org:comp 1'],
  ])('%s ⇐ %p', (detail, raw) => {
    expect(parseRequestedWorkspace(raw)).toEqual({ outcome: 'malformed', detail });
  });

  /**
   * 🔴 ΑΣΦΑΛΕΙΑ, ΟΧΙ ΜΟΡΦΗ: ο ιδιωτικός χώρος που μπορεί να ζητηθεί είναι **πάντα του
   * συνδεδεμένου**. Αν η γραμματική δεχόταν `personal:<uid>`, το σύρμα θα είχε πεδίο με
   * το οποίο κάποιος θα ζητούσε **ξένο** ιδιωτικό χώρο.
   */
  it('🔴 δεν υπάρχει τρόπος να ζητήσεις ΞΕΝΟ ιδιωτικό χώρο', () => {
    expect(parseRequestedWorkspace('personal:uid_2')).toEqual({
      outcome: 'malformed',
      detail: 'unknown-token',
    });
  });
});

describe('Κ4 — Η ΑΠΟΣΥΡΟΜΕΝΗ ΚΕΦΑΛΙΔΑ: ίδιος αυστηρός κανόνας μορφής', () => {
  it('τιμή ⇒ εταιρεία', () => {
    expect(parseLegacyCompanyHeader('comp_9c7c1234')).toEqual({
      outcome: 'declared',
      requested: { kind: 'org', companyId: 'comp_9c7c1234' },
    });
  });

  it.each([null, '', '  '])('%p ⇒ absent', (raw) => {
    expect(parseLegacyCompanyHeader(raw)).toEqual({ outcome: 'absent' });
  });

  it('🔴 η απόσυρση ΔΕΝ αφήνει πίσω της χαλαρότερη πόρτα', () => {
    expect(parseLegacyCompanyHeader('a/b')).toEqual({
      outcome: 'malformed',
      detail: 'invalid-company-id',
    });
  });
});

describe('Κ5 — ΤΟ ΟΝΟΜΑ: RFC 6648 (BCP 178) — καμία κεφαλίδα με `X-`', () => {
  it('η νέα κεφαλίδα δεν έχει πρόθεμα `X-`', () => {
    expect(REQUESTED_WORKSPACE_HEADER).not.toMatch(/^x-/i);
  });

  it('έχει πρόθεμα οργανισμού, όπως προτείνει το RFC (πρότυπο `Stripe-Context`)', () => {
    expect(REQUESTED_WORKSPACE_HEADER).toBe('Nestor-Workspace');
  });
});

describe('Κ6 — ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΗΣ ΑΠΑΝΤΗΣΗΣ: μία λέξη για δύο μεταφορές', () => {
  /**
   * ⚠️ Ο κριτής του ADR-809 (`isMissingTenantError`) ρωτά **brand**. Ο κωδικός του σύρματος
   * είναι ο **μόνος** δεσμός ανάμεσα στην άρνηση HTTP και σε εκείνο το brand — αν αλλάξει
   * εδώ χωρίς να αλλάξει ο πελάτης, η σχεδιασμένη κατάσταση γίνεται σιωπηλά **βλάβη**.
   */
  it('ο κωδικός είναι σταθερός και ρητός', () => {
    expect(MISSING_TENANT_ERROR_CODE).toBe('MISSING_TENANT');
  });
});
