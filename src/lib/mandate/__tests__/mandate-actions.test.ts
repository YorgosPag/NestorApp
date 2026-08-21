/**
 * @fileoverview **ΑΓΚΥΡΕΣ ΤΟΥ ΚΡΙΤΗ ΤΩΝ ΠΡΑΞΕΩΝ** — ADR-777 §8.34.
 * @related lib/mandate/mandate-actions.ts · lib/mandate/mandate-standing.ts
 *
 * 🔴 **ΤΟ ΚΥΡΙΟ ΕΡΩΤΗΜΑ ΕΔΩ ΔΕΝ ΕΙΝΑΙ «σωστή απάντηση;» ΑΛΛΑ «ΥΠΑΡΧΕΙ απάντηση;»**
 * Ο κριτής είναι εξαντλητικός σε **δύο** διαστάσεις (πράξη × κατάσταση = 20 κελιά). Ένα
 * κελί που επιστρέφει `undefined` δεν θα έσκαγε — θα ζωγράφιζε **κανένα κουμπί** και
 * κανείς δεν θα το μάθαινε. Η ομάδα **Π** το κλείνει.
 */

import {
  allowedActionsFor,
  MANDATE_ACTIONS,
  isMandateAction,
  verdictFor,
} from '@/lib/mandate/mandate-actions';
import { MANDATE_STANDINGS } from '@/lib/mandate/mandate-standing';

// ============================================================================
// Π — ΠΛΗΡΟΤΗΤΑ: κάθε κελί του πίνακα 2 × 10 απαντά
// ============================================================================

describe('Π — ο κριτής απαντά σε ΚΑΘΕ συνδυασμό', () => {
  it('Π1 — 20 κελιά, 20 ετυμηγορίες, καμία `undefined`', () => {
    const missing: string[] = [];
    for (const action of MANDATE_ACTIONS) {
      for (const standing of MANDATE_STANDINGS) {
        const verdict = verdictFor(action, standing);
        if (verdict === undefined || typeof verdict.allowed !== 'boolean') {
          missing.push(`${action}×${standing}`);
        }
      }
    }
    // ⚠️ Λίστα ελλείψεων και σύγκριση με `[]` — το `expect` του jest **δεν** παίρνει
    // μήνυμα (Π11 του handoff), οπότε η αποτυχία πρέπει να **ονομάζει** μόνη της.
    expect(missing).toEqual([]);
  });

  it('Π2 — κάθε άρνηση κουβαλά λόγο', () => {
    const nameless: string[] = [];
    for (const action of MANDATE_ACTIONS) {
      for (const standing of MANDATE_STANDINGS) {
        const verdict = verdictFor(action, standing);
        if (!verdict.allowed && !verdict.refusal) nameless.push(`${action}×${standing}`);
      }
    }
    expect(nameless).toEqual([]);
  });
});

// ============================================================================
// Ξ — ΞΑΝΑΣΤΕΛΝΩ
// ============================================================================

describe('Ξ — ξαναστέλνω', () => {
  it('Ξ1 — επιτρέπεται στο «δεν στάλθηκε ποτέ»: είναι η ΘΕΡΑΠΕΙΑ του', () => {
    expect(verdictFor('resend', 'never-notified')).toEqual({ allowed: true });
  });

  it('Ξ2 — επιτρέπεται στο «δημοσιευμένο χωρίς ενημέρωση»: το ζήτημα συμμόρφωσης', () => {
    expect(verdictFor('resend', 'unannounced-live')).toEqual({ allowed: true });
  });

  it('Ξ3 — επιτρέπεται σε ΕΝΕΡΓΗ εντολή — ευρύτερο από το DocuSign, επίτηδες', () => {
    // Ο σύνδεσμος είναι η **έξοδος** του ιδιοκτήτη· άρνηση εδώ θα σήμαινε ότι εμείς
    // αποφασίζουμε πως δεν πρέπει να θυμηθεί ότι μπορεί να πει «όχι».
    expect(verdictFor('resend', 'live')).toEqual({ allowed: true });
    expect(verdictFor('resend', 'expiring-soon')).toEqual({ allowed: true });
  });

  it('Ξ4 — ΔΕΝ επιτρέπεται σε τερματικές: «αρνήθηκε» και «έληξε»', () => {
    expect(verdictFor('resend', 'declined')).toEqual({ allowed: false, refusal: 'declined' });
    expect(verdictFor('resend', 'expired')).toEqual({ allowed: false, refusal: 'expired' });
    expect(verdictFor('resend', 'expired-unanswered')).toEqual({
      allowed: false,
      refusal: 'expired',
    });
  });
});

// ============================================================================
// Α — ΑΝΑΚΑΛΩ
// ============================================================================

describe('Α — ανακαλώ', () => {
  it('Α1 — μόνο όσο εκκρεμεί ΚΑΙ υπάρχει ζωντανός σύνδεσμος', () => {
    const allowed = MANDATE_STANDINGS.filter((s) => verdictFor('revoke', s).allowed);
    expect([...allowed].sort()).toEqual(
      ['awaiting-decision', 'awaiting-view', 'never-notified'].sort(),
    );
  });

  it('Α2 — σε ΕΓΚΕΚΡΙΜΕΝΗ απαγορεύεται: θα κλείδωνε τον ιδιοκτήτη έξω από την έξοδό του', () => {
    expect(verdictFor('revoke', 'live')).toEqual({ allowed: false, refusal: 'not-pending' });
    expect(verdictFor('revoke', 'unannounced-live')).toEqual({
      allowed: false,
      refusal: 'not-pending',
    });
  });

  it('Α3 — σε «αρνήθηκε» απαγορεύεται: του κλείναμε τον δρόμο να ξανασκεφτεί', () => {
    expect(verdictFor('revoke', 'declined')).toEqual({ allowed: false, refusal: 'declined' });
  });

  it('Α4 — ήδη ανακλημένος ⇒ ΔΙΚΟΣ ΤΟΥ λόγος, όχι «δεν εκκρεμεί»', () => {
    // Η εντολή **όντως** εκκρεμεί· ένα κοινό μήνυμα θα έλεγε στον μεσίτη κάτι ψευδές.
    expect(verdictFor('revoke', 'link-revoked')).toEqual({
      allowed: false,
      refusal: 'already-revoked',
    });
  });
});

// ============================================================================
// Ο — Ο,ΤΙ ΖΩΓΡΑΦΙΖΕΙ Η ΟΘΟΝΗ
// ============================================================================

describe('Ο — τα κουμπιά της οθόνης', () => {
  it('Ο1 — οι τερματικές καταστάσεις δεν προσφέρουν ΚΑΝΕΝΑ κουμπί', () => {
    for (const standing of ['declined', 'expired', 'expired-unanswered'] as const) {
      expect(allowedActionsFor(standing)).toEqual([]);
    }
  });

  it('Ο2 — το «περιμένουμε τον πελάτη» προσφέρει ΚΑΙ ΤΑ ΔΥΟ', () => {
    expect([...allowedActionsFor('awaiting-view')].sort()).toEqual(['resend', 'revoke']);
    expect([...allowedActionsFor('awaiting-decision')].sort()).toEqual(['resend', 'revoke']);
  });

  it('Ο3 — καμία κατάσταση δεν προσφέρει πράξη που ο κριτής απορρίπτει', () => {
    const contradictions: string[] = [];
    for (const standing of MANDATE_STANDINGS) {
      for (const action of allowedActionsFor(standing)) {
        if (!verdictFor(action, standing).allowed) contradictions.push(`${action}×${standing}`);
      }
    }
    expect(contradictions).toEqual([]);
  });
});

// ============================================================================
// Δ — Ο ΦΡΟΥΡΟΣ ΤΟΥ ΔΙΚΤΥΟΥ
// ============================================================================

describe('Δ — τι δέχεται από το δίκτυο', () => {
  it('Δ1 — μόνο οι δύο γνωστές λέξεις', () => {
    expect(isMandateAction('resend')).toBe(true);
    expect(isMandateAction('revoke')).toBe(true);
  });

  it('Δ2 — ό,τι άλλο απορρίπτεται πριν φτάσει σε υπηρεσία', () => {
    for (const bad of ['RESEND', 'delete', '', null, undefined, 42, {}, ['resend']]) {
      expect(isMandateAction(bad)).toBe(false);
    }
  });
});
