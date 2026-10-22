/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Ζ1–Ζ7 (Φ-Δ) — **η κρίση της καρτέλας «Παράδοση»**: ποιος οφείλει την επόμενη κίνηση, γιατί,
 *   πού βρίσκεται κάθε βήμα. Ο πίνακας σεναρίων είναι ο **ίδιος** με της γκαλερί. Καθαρές συναρτήσεις — καμία βάση.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | αγνοείται το Ο4 (πώληση έπεσε μετά την ολοκλήρωση) | Ζ3 ⇒ 🔴 |
 * | ο έλεγχος λήξης πριν από την άρνηση | Ζ4 «η άρνηση νικά» ⇒ 🔴 |
 * | `due` χωρίς έλεγχο ρύθμισης σφραγίδας | Ζ1 `awaiting-seal-configuration` ⇒ 🔴 |
 * | «λήγει σύντομα» και σε ληγμένη | Ζ5 ⇒ 🔴 |
 * | ακυρωμένη με «τρέχον» βήμα | Ζ6 ⇒ 🔴 |
 * | άρνηση ⇒ κίνηση συστήματος | Ζ1 «αποφάσεις ανθρώπου» ⇒ 🔴 |
 * | αγνοείται το όριο αποστολών | Ζ4 ⇒ 🔴 |
 *
 * Μετρημένο 2026-10-22 σε **αντίγραφο** (scratchpad + `moduleNameMapper`): **7/7** κόκκινες. Η 8η («ακυρωμένη ελέγχεται μετά
 * το Ο4») επιζεί ως **ισοδύναμη**: το Ο4 απαιτεί `ready`, η ακύρωση `cancelled` — αμοιβαία αποκλειόμενα, η σειρά δεν αλλάζει τίποτα.
 */

import {
  HANDOVER_OFFICE_SCENARIOS,
  SCENARIO_NOW,
  fileDeliveryFixture,
  handoverFixture,
  issuedInvitation,
  protocolPointerFixture,
} from '@/components/property-handover-office/testing/handover-office-scenarios';
import { HANDOVER_OFFICE_MOVE_OF, handoverOfficeStatusOf, type HandoverOfficeContext } from '@/lib/property-handover/handover-office-status';
import { HANDOVER_OFFICE_REASONS, HANDOVER_OFFICE_STEPS } from '@/types/property-handover';

const CONTEXT: HandoverOfficeContext = { snapshot: { open: true, recipientContactIds: ['cont_buyer'] }, sealConfigured: true, nowValue: SCENARIO_NOW };

describe('Ζ1 — ένας λόγος ανά σενάριο, ο κάτοχος της κίνησης ΠΑΡΑΓΕΤΑΙ από τον λόγο', () => {
  it.each(HANDOVER_OFFICE_SCENARIOS.map((s) => [s.id, s] as const))('%s', (_, scenario) => {
    const status = handoverOfficeStatusOf(scenario.handover, scenario.context);
    expect(status.reason).toBe(scenario.expected.reason);
    expect(status.signals).toEqual(scenario.expected.signals);
    expect(status.move).toBe(HANDOVER_OFFICE_MOVE_OF[scenario.expected.reason]);
  });

  it('🔴 οι αποφάσεις ΑΝΘΡΩΠΟΥ ανήκουν στο γραφείο — ανεξάρτητα από τον πίνακα που τις αντιστοιχίζει', () => {
    const officeReasons = Object.entries(HANDOVER_OFFICE_MOVE_OF).filter(([, move]) => move === 'office').map(([reason]) => reason).sort();
    expect(officeReasons).toEqual(['declined', 'invitation-expired', 'invitation-undeliverable', 'no-address', 'sale-reverted', 'unverifiable-rows']);
    expect(HANDOVER_OFFICE_MOVE_OF).toMatchObject({ 'awaiting-buyer': 'buyer', 'awaiting-completion': 'sale', sealed: 'none', cancelled: 'none' });
  });

  it('ο πίνακας σεναρίων καλύπτει ΚΑΘΕ λόγο — η γκαλερί δεν έχει τυφλό σημείο', () => {
    const covered = new Set(HANDOVER_OFFICE_SCENARIOS.map((s) => s.expected.reason));
    expect([...HANDOVER_OFFICE_REASONS].filter((reason) => !covered.has(reason))).toEqual([]);
  });

  it('κάθε σενάριο έχει μοναδικό id (κλειδί πάνελ στη γκαλερί)', () => {
    const ids = HANDOVER_OFFICE_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Ζ2 — σειρά προτεραιότητας: η απόφαση που μετρά κρύβει την τεχνική πρόοδο', () => {
  it('ακυρωμένη νικά τα πάντα', () => {
    expect(handoverOfficeStatusOf(handoverFixture({ lifecycle: 'cancelled', fileDelivery: fileDeliveryFixture() }), CONTEXT).reason).toBe('cancelled');
  });

  it('Ο4 νικά ακόμη και σφραγισμένη παράδοση', () => {
    const sealed = handoverFixture({ fileDelivery: fileDeliveryFixture(), protocol: protocolPointerFixture() });
    expect(handoverOfficeStatusOf(sealed, { ...CONTEXT, snapshot: { open: false, recipientContactIds: [] } }).reason).toBe('sale-reverted');
  });
});

describe('Ζ3 — Ο4: ακύρωση ΜΕΤΑ την ολοκλήρωση κρατά `ready` ⇒ απόφαση γραφείου', () => {
  it('ο αγοραστής αφαιρέθηκε ενώ η πώληση μένει ανοιχτή ⇒ sale-reverted', () => {
    const status = handoverOfficeStatusOf(handoverFixture(), { ...CONTEXT, snapshot: { open: true, recipientContactIds: ['cont_other'] } });
    expect(status).toMatchObject({ reason: 'sale-reverted', move: 'office' });
  });

  it('ακίνητο που δεν διαβάζεται ⇒ ΚΑΜΙΑ υπόθεση Ο4 (ποτέ εφευρημένη ακύρωση)', () => {
    expect(handoverOfficeStatusOf(handoverFixture(), { ...CONTEXT, snapshot: null }).reason).toBe('delivery-queued');
  });

  it('πριν την ολοκλήρωση η πώληση που έπεσε ΔΕΝ είναι Ο4 (τη χειρίζεται η συμφιλίωση ⇒ cancelled)', () => {
    const pending = handoverFixture({ lifecycle: 'awaiting-completion', completion: null });
    expect(handoverOfficeStatusOf(pending, { ...CONTEXT, snapshot: { open: false, recipientContactIds: [] } }).reason).toBe('awaiting-completion');
  });
});

describe('Ζ4 — πρόσκληση: άρνηση · λήξη · όριο αποστολών', () => {
  const unanswered = (invitation: ReturnType<typeof issuedInvitation>) => handoverFixture({ recipient: null, invitation });

  it('η άρνηση νικά τη λήξη (σεβασμός: είναι ΑΠΑΝΤΗΣΗ, όχι σιωπή)', () => {
    const both = unanswered(issuedInvitation({ declinedAt: '2026-10-02T09:00:00.000Z', expiresAt: '2026-10-10T09:00:00.000Z' }));
    expect(handoverOfficeStatusOf(both, CONTEXT).reason).toBe('declined');
  });

  it('αποτυχία στο όριο αποστολών ⇒ απόφαση γραφείου, όχι «ξαναδοκιμάζεται»', () => {
    const capped = unanswered(issuedInvitation({ delivery: 'failed', deliveryAttempts: 4 }));
    expect(handoverOfficeStatusOf(capped, CONTEXT)).toMatchObject({ reason: 'invitation-undeliverable', move: 'office' });
  });

  it('η λήξη είναι ΑΚΡΙΒΩΣ στη στιγμή — ούτε ένα χιλιοστό νωρίτερα', () => {
    expect(handoverOfficeStatusOf(unanswered(issuedInvitation({ expiresAt: SCENARIO_NOW })), CONTEXT).reason).toBe('invitation-expired');
    const later = new Date(Date.parse(SCENARIO_NOW) + 1).toISOString();
    expect(handoverOfficeStatusOf(unanswered(issuedInvitation({ expiresAt: later })), CONTEXT).reason).toBe('awaiting-buyer');
  });
});

describe('Ζ5 — «λήγει σύντομα» μόνο σε ζωντανή πρόσκληση που περιμένει τον αγοραστή', () => {
  it('ληγμένη ⇒ κανένα σήμα (ο λόγος το λέει ήδη)', () => {
    const expired = handoverFixture({ recipient: null, invitation: issuedInvitation({ expiresAt: '2026-10-21T09:00:00.000Z' }) });
    expect(handoverOfficeStatusOf(expired, CONTEXT).signals).toEqual([]);
  });

  it('αποδεκτή ⇒ κανένα σήμα, όσο κοντά κι αν είναι η λήξη του συνδέσμου', () => {
    const accepted = handoverFixture({ invitation: issuedInvitation({ expiresAt: '2026-10-23T09:00:00.000Z' }) });
    expect(handoverOfficeStatusOf(accepted, CONTEXT).signals).toEqual([]);
  });
});

describe('Ζ6 — βήματα', () => {
  const stepsOf = (id: string) => {
    const scenario = HANDOVER_OFFICE_SCENARIOS.find((s) => s.id === id);
    if (!scenario) throw new Error(id);
    return handoverOfficeStatusOf(scenario.handover, scenario.context).steps;
  };

  it('σφραγισμένη ⇒ όλα done', () => {
    expect(Object.values(stepsOf('sealed'))).toEqual(HANDOVER_OFFICE_STEPS.map(() => 'done'));
  });

  it('ακυρωμένη ⇒ κανένα «τρέχον» ή «μπλοκαρισμένο» βήμα', () => {
    expect(Object.values(stepsOf('cancelled')).filter((state) => state === 'current' || state === 'blocked')).toEqual([]);
  });

  it.each([
    ['unverifiable-rows', 'files'],
    ['awaiting-seal-configuration', 'protocol'],
    ['declined', 'invitation'],
    ['no-address', 'invitation'],
  ] as const)('%s ⇒ μπλοκαρισμένο το βήμα «%s»', (id, step) => {
    expect(stepsOf(id)[step]).toBe('blocked');
  });

  it('περιμένει τον αγοραστή ⇒ η αποδοχή είναι το τρέχον βήμα', () => {
    expect(stepsOf('awaiting-buyer')).toMatchObject({ invitation: 'done', acceptance: 'current' });
  });
});

describe('Ζ7 — 🔒 ποτέ «επαληθευμένο»: το λεξιλόγιο της κρίσης δεν υπόσχεται επαλήθευση', () => {
  it('κανένας λόγος δεν μιλά για verification', () => {
    expect(HANDOVER_OFFICE_REASONS.filter((reason) => /verif/i.test(reason) && reason !== 'unverifiable-rows')).toEqual([]);
  });
});
