/**
 * ΑΓΚΥΡΑ — **η σύμπτυξη συνεδρίας δείχνει την καθαρή αλλαγή και δεν συγχωνεύει ποτέ ξένα πράγματα**
 * (ADR-195 · ADR-332 D29).
 *
 * Τα σχήματα των εγγραφών είναι **πραγματικά**: το `16 → 18 → 16` του Σ3 υπάρχει αυτούσιο στο
 * ιστορικό του έργου «ERGO TEST» (δύο γραμμές σε 56″ για καμία αλλαγή).
 */

/* global describe, it, expect */

import { AUDIT_EDIT_SESSION_GAP_MS, coalesceEditSessions } from '../coalesce-edit-sessions';
import type { AuditFieldChange, EntityAuditEntry } from '@/types/audit-trail';

const T0 = Date.parse('2026-10-05T09:00:00.000Z');

let serial = 0;
function entry(offsetMs: number, changes: AuditFieldChange[], over: Partial<EntityAuditEntry> = {}): EntityAuditEntry {
  serial += 1;
  return {
    id: `eaud_${serial}`,
    entityType: 'building',
    entityId: 'bld_1',
    entityName: 'Κτίριο Α',
    action: 'updated',
    changes,
    performedBy: 'user_1',
    performedByName: 'Γιώργος',
    timestamp: new Date(T0 + offsetMs).toISOString(),
    companyId: 'comp_1',
    ...over,
  } as EntityAuditEntry;
}

const scalar = (field: string, oldValue: string | null, newValue: string | null): AuditFieldChange => ({
  field,
  oldValue,
  newValue,
  label: field,
});

function addressChange(
  op: 'added' | 'removed' | 'modified',
  subs: Array<[string, string | null, string | null]>,
  itemLabel = 'site — Σαμοθράκης — 16',
): AuditFieldChange {
  return {
    field: 'addresses',
    oldValue: null,
    newValue: null,
    label: 'addresses',
    kind: 'collection',
    op,
    itemKey: 'k:addr_1',
    itemLabel,
    subChanges: subs.map(([subField, oldValue, newValue]) => ({ subField, oldValue, newValue })),
  };
}

describe('όρια συνεδρίας', () => {
  it('Σ1 — μία εγγραφή μένει ΑΥΤΟΥΣΙΑ (ίδιο αντικείμενο, καμία επεξεργασία)', () => {
    const only = entry(0, [scalar('name', 'Α', 'Β')]);

    const [session] = coalesceEditSessions([only]);

    expect(session.net).toBe(only);
    expect(session.entries).toEqual([only]);
  });

  it('Σ2 — ενδιάμεσες τιμές αυτόματης αποθήκευσης ⇒ ΜΙΑ γραμμή, πρώτη παλιά → τελευταία νέα', () => {
    const typed = [
      entry(4_000, [scalar('name', 'Κτίρ', 'Κτίριο Α')]),
      entry(2_000, [scalar('name', 'Κτ', 'Κτίρ')]),
      entry(0, [scalar('name', 'Παλιό', 'Κτ')]),
    ];

    const sessions = coalesceEditSessions(typed);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].net.changes).toEqual([scalar('name', 'Παλιό', 'Κτίριο Α')]);
    // Η γραμμή φέρει την ταυτότητα και την ώρα της ΤΕΛΕΥΤΑΙΑΣ αποθήκευσης.
    expect(sessions[0].net.id).toBe(typed[0].id);
    expect(sessions[0].entries).toEqual(typed);
  });

  it('Σ3 — η τιμή γύρισε στην αρχική (16 → 18 → 16) ⇒ καμία καθαρή αλλαγή, οι ωμές μένουν', () => {
    const sessions = coalesceEditSessions([
      entry(56_000, [addressChange('modified', [['number', '18', '16']])]),
      entry(0, [addressChange('modified', [['number', '16', '18']], 'site — Σαμοθράκης — 18')]),
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].net.changes).toEqual([]);
    expect(sessions[0].entries).toHaveLength(2);
  });

  it('Σ4 — διάλειμμα πάνω από το όριο ⇒ δύο συνεδρίες· ακριβώς στο όριο ⇒ μία', () => {
    const over = coalesceEditSessions([
      entry(AUDIT_EDIT_SESSION_GAP_MS + 1, [scalar('name', 'Β', 'Γ')]),
      entry(0, [scalar('name', 'Α', 'Β')]),
    ]);
    const at = coalesceEditSessions([
      entry(AUDIT_EDIT_SESSION_GAP_MS, [scalar('name', 'Β', 'Γ')]),
      entry(0, [scalar('name', 'Α', 'Β')]),
    ]);

    expect(over).toHaveLength(2);
    expect(at).toHaveLength(1);
  });

  it('Σ4β — παράγωγη γραμμή ΑΛΥΣΙΔΑΣ στην ίδια οντότητα κόβει τη συνεδρία: ό,τι υπολόγισε η μηχανή δεν πληκτρολογήθηκε', () => {
    // Πραγματικό σενάριο ορόφου: ο άνθρωπος αλλάζει στάθμη → η στοίβα ξαναπαράγει το ύψος ΤΟΥ ΙΔΙΟΥ ορόφου →
    // ο άνθρωπος αλλάζει όνομα. Ως τις 2026-10-05 η μεσαία γραμμή είχε το uid του ανθρώπου και τα τρία γίνονταν ένα.
    const floor = { entityType: 'floor', entityId: 'flr_1' } as const;
    const sessions = coalesceEditSessions([
      entry(0, [scalar('elevation', '3', '3.5')], floor),
      entry(1_000, [scalar('height', '3', '2.5')], { ...floor, performedBy: 'system:floor-stack', performedByName: 'System' }),
      entry(2_000, [scalar('name', 'Α', 'Β')], floor),
    ]);

    expect(sessions.map((session) => session.entries.length)).toEqual([1, 1, 1]);
    expect(sessions[1].net.changes).toEqual([scalar('height', '3', '2.5')]);
  });

  it('Σ5 — το όριο μετριέται από την ΠΡΟΗΓΟΥΜΕΝΗ αποθήκευση, όχι από την αρχή της συνεδρίας', () => {
    const step = AUDIT_EDIT_SESSION_GAP_MS - 1_000;
    const sessions = coalesceEditSessions([
      entry(2 * step, [scalar('name', 'Γ', 'Δ')]),
      entry(step, [scalar('name', 'Β', 'Γ')]),
      entry(0, [scalar('name', 'Α', 'Β')]),
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].net.changes).toEqual([scalar('name', 'Α', 'Δ')]);
  });

  it('Σ6 — άλλος χρήστης ανάμεσα ⇒ τρεις γραμμές, καμία συγχώνευση γύρω του', () => {
    const sessions = coalesceEditSessions([
      entry(4_000, [scalar('name', 'Γ', 'Δ')]),
      entry(2_000, [scalar('name', 'Β', 'Γ')], { performedBy: 'user_2', performedByName: 'Σταυρούλα' }),
      entry(0, [scalar('name', 'Α', 'Β')]),
    ]);

    expect(sessions.map((session) => session.entries.length)).toEqual([1, 1, 1]);
  });

  it('Σ7 — γραμμή της ΜΗΧΑΝΗΣ ανάμεσα κλείνει τη συνεδρία και δεν συμπτύσσεται ποτέ', () => {
    const machine = { performedBy: 'system:address-position', performedByName: 'System' };
    const sessions = coalesceEditSessions([
      entry(6_000, [scalar('name', 'Β', 'Γ')]),
      entry(4_000, [addressChange('modified', [['coordinates', null, '40.64030, 22.94440']])], machine),
      entry(3_000, [addressChange('modified', [['coordinates', null, '40.00000, 22.00000']])], machine),
      entry(0, [scalar('name', 'Α', 'Β')]),
    ]);

    expect(sessions.map((session) => session.entries.length)).toEqual([1, 1, 1, 1]);
  });

  it('Σ8 — άλλη πράξη (σύνδεση) ανάμεσα κλείνει τη συνεδρία', () => {
    const sessions = coalesceEditSessions([
      entry(4_000, [scalar('name', 'Β', 'Γ')]),
      entry(2_000, [scalar('contact_link', null, 'cont_1')], { action: 'linked' }),
      entry(0, [scalar('name', 'Α', 'Β')]),
    ]);

    expect(sessions).toHaveLength(3);
  });

  it('Σ9 — άλλη οντότητα ανάμεσα ΔΕΝ κλείνει τη συνεδρία (καθολική προβολή)', () => {
    const sessions = coalesceEditSessions([
      entry(4_000, [scalar('name', 'Β', 'Γ')]),
      entry(2_000, [scalar('name', 'Χ', 'Ψ')], { entityId: 'bld_2' }),
      entry(0, [scalar('name', 'Α', 'Β')]),
    ]);

    expect(sessions).toHaveLength(2);
    expect(sessions[0].net.changes).toEqual([scalar('name', 'Α', 'Γ')]);
    expect(sessions[1].net.entityId).toBe('bld_2');
  });

  it('Σ10 — η σειρά της εισόδου δεν αλλάζει το αποτέλεσμα (παλαιότερες πρώτα)', () => {
    const sessions = coalesceEditSessions([
      entry(0, [scalar('name', 'Α', 'Β')]),
      entry(2_000, [scalar('name', 'Β', 'Γ')]),
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].net.changes).toEqual([scalar('name', 'Α', 'Γ')]);
  });

  it('Σ11 — εγγραφή χωρίς έγκυρη ώρα δεν συμπτύσσεται', () => {
    const sessions = coalesceEditSessions([
      entry(2_000, [scalar('name', 'Β', 'Γ')], { timestamp: '' }),
      entry(0, [scalar('name', 'Α', 'Β')]),
    ]);

    expect(sessions).toHaveLength(2);
  });
});

describe('καθαρή αλλαγή — πεδία', () => {
  it('Κ1 — διαφορετικά πεδία μαζεύονται· όποιο γύρισε στην αρχή του φεύγει', () => {
    const [session] = coalesceEditSessions([
      entry(4_000, [scalar('description', 'x', null)]),
      entry(2_000, [scalar('description', null, 'x'), scalar('status', 'planning', 'active')]),
      entry(0, [scalar('name', 'Α', 'Β')]),
    ]);

    expect(session.net.changes).toEqual([scalar('name', 'Α', 'Β'), scalar('status', 'planning', 'active')]);
  });

  it('Κ2 — οι ετικέτες ξένου κλειδιού ακολουθούν τις τιμές τους: παλιά από την πρώτη, νέα από την τελευταία', () => {
    const first: AuditFieldChange = { ...scalar('projectId', 'p1', 'p2'), oldValueLabel: 'Έργο 1', newValueLabel: 'Έργο 2' };
    const last: AuditFieldChange = { ...scalar('projectId', 'p2', 'p3'), oldValueLabel: 'Έργο 2', newValueLabel: 'Έργο 3' };

    const [session] = coalesceEditSessions([entry(2_000, [last]), entry(0, [first])]);

    expect(session.net.changes).toEqual([
      { ...scalar('projectId', 'p1', 'p3'), oldValueLabel: 'Έργο 1', newValueLabel: 'Έργο 3' },
    ]);
  });
});

describe('καθαρή αλλαγή — στοιχεία συλλογής', () => {
  it('Λ1 — δύο τροποποιήσεις της ίδιας διεύθυνσης ⇒ μία, με τα υπο-πεδία ενωμένα', () => {
    const [session] = coalesceEditSessions([
      entry(2_000, [addressChange('modified', [['number', '16', '18'], ['coordinates', '40.00000, 22.00000', '40.10000, 22.10000']])]),
      entry(0, [addressChange('modified', [['street', 'Σαμοθράκης ', 'Σαμοθράκης']])]),
    ]);

    expect(session.net.changes).toEqual([
      addressChange('modified', [
        ['street', 'Σαμοθράκης ', 'Σαμοθράκης'],
        ['number', '16', '18'],
        ['coordinates', '40.00000, 22.00000', '40.10000, 22.10000'],
      ]),
    ]);
  });

  it('Λ2 — προσθήκη και μετά τροποποίηση ⇒ ΠΡΟΣΘΗΚΗ με τις τελικές τιμές', () => {
    const [session] = coalesceEditSessions([
      entry(2_000, [addressChange('modified', [['number', '16', '18']])]),
      entry(0, [addressChange('added', [['street', null, 'Σαμοθράκης'], ['number', null, '16']])]),
    ]);

    expect(session.net.changes).toEqual([
      addressChange('added', [['street', null, 'Σαμοθράκης'], ['number', null, '18']]),
    ]);
  });

  it('Λ3 — προσθήκη και μετά αφαίρεση ⇒ το στοιχείο δεν υπήρξε ποτέ', () => {
    const [session] = coalesceEditSessions([
      entry(69_000, [addressChange('removed', [['street', 'Σαμοθράκης', null]])]),
      entry(0, [addressChange('added', [['street', null, 'Σαμοθράκης']])]),
    ]);

    expect(session.net.changes).toEqual([]);
  });

  it('Λ4 — τροποποίηση και μετά αφαίρεση ⇒ ΑΦΑΙΡΕΣΗ, με τις τιμές που είχε ΠΡΙΝ τη συνεδρία', () => {
    const [session] = coalesceEditSessions([
      entry(2_000, [addressChange('removed', [['street', 'Σαμοθράκης', null], ['number', '18', null]])]),
      entry(0, [addressChange('modified', [['number', '16', '18']])]),
    ]);

    expect(session.net.changes).toEqual([
      addressChange('removed', [['number', '16', null], ['street', 'Σαμοθράκης', null]]),
    ]);
  });

  it('Λ5 — αφαίρεση και επαναπροσθήκη ίδιου στοιχείου ⇒ μόνο ό,τι διαφέρει, ως τροποποίηση', () => {
    const [session] = coalesceEditSessions([
      entry(2_000, [addressChange('added', [['street', null, 'Σαμοθράκης'], ['number', null, '20']])]),
      entry(0, [addressChange('removed', [['street', 'Σαμοθράκης', null], ['number', '16', null]])]),
    ]);

    expect(session.net.changes).toEqual([addressChange('modified', [['number', '16', '20']])]);
  });

  it('Λ6 — διαφορετικές διευθύνσεις δεν συγχωνεύονται μεταξύ τους', () => {
    const other: AuditFieldChange = { ...addressChange('modified', [['number', '1', '2']]), itemKey: 'k:addr_2' };

    const [session] = coalesceEditSessions([
      entry(2_000, [other]),
      entry(0, [addressChange('modified', [['number', '16', '18']])]),
    ]);

    expect(session.net.changes).toHaveLength(2);
  });
});
