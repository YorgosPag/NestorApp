/**
 * @fileoverview Άγκυρες της λίστας «ποιοι διαβάζουν» (ADR-834 (γ) ③ · (ε) 🏆) και της λωρίδας απουσίας — Λ-1…Λ-8.
 */

import { buildAudienceRoster, rosterUids } from '../audience-roster';
import { awayNotices } from '../away-strip';
import type { NetworkAudienceEntry } from '@/types/network-thread';

function row(uid: string, extra: Partial<NetworkAudienceEntry>): NetworkAudienceEntry {
  return {
    uid,
    side: 'host',
    role: 'collaborator',
    reason: 'added',
    addedBy: 'uid_admin',
    since: '2026-09-01T00:00:00.000Z',
    until: null,
    lastReadAt: null,
    muted: false,
    following: false,
    threadActivityAt: '2026-09-19T00:00:00.000Z',
    alsoHostRole: null,
    ...extra,
  };
}

const OWNER = row('uid_owner', { side: 'counterpart', role: 'counterpart', reason: 'counterpart' });
// ⚠️ Ο υπεύθυνος μπήκε ΤΕΛΕΥΤΑΙΟΣ (ανέλαβε μετά από μεταβίβαση): μόνο ο ΡΟΛΟΣ τον φέρνει πρώτο — αλλιώς η
//    σειρά «από πότε» θα συνέπιπτε τυχαία με τη σειρά ρόλων (μετάλλαξη Λ-1 που ΕΠΕΖΗΣΕ στην πρώτη γραφή).
const KOSTAS = row('uid_kostas', { role: 'responsible', reason: 'failover', since: '2026-09-05T00:00:00.000Z' });
const ELENI = row('uid_eleni', { since: '2026-09-03T00:00:00.000Z' });
const NIKOS = row('uid_nikos', { since: '2026-09-01T00:00:00.000Z', until: '2026-09-10T00:00:00.000Z' });
const ADMIN = row('uid_admin', { reason: 'admin-self', since: '2026-09-04T00:00:00.000Z' });
const ACT_AUDIENCE = [ELENI, OWNER, NIKOS, KOSTAS, ADMIN];

describe('audience-roster — ποιοι διαβάζουν', () => {
  it('Λ-1 ο ιδιοκτήτης βλέπει ΠΡΩΤΑ το γραφείο, υπεύθυνο πρώτο (μετάλλαξη: σειρά εισόδου αντί ρόλου)', () => {
    const roster = buildAudienceRoster(ACT_AUDIENCE, OWNER.uid, 'act');
    expect(roster.personal).toBe(false);
    expect(roster.sides.map((side) => side.relation)).toStrictEqual(['theirs', 'mine']);
    expect(roster.sides[0]?.current.map((m) => m.uid)).toStrictEqual(['uid_kostas', 'uid_eleni', 'uid_admin']);
  });

  it('Λ-2 όποιος ΕΦΥΓΕ φαίνεται στους παλιούς με «ως πότε», όχι στους τωρινούς (μετάλλαξη: σβήνονται οι σφραγισμένοι)', () => {
    const theirs = buildAudienceRoster(ACT_AUDIENCE, OWNER.uid, 'act').sides[0];
    expect(theirs?.past).toHaveLength(1);
    expect(theirs?.past[0]).toMatchObject({ uid: 'uid_nikos', until: '2026-09-10T00:00:00.000Z' });
  });

  it('Λ-3 ο διαχειριστής που μπήκε μόνος του ΦΑΙΝΕΤΑΙ, με τον λόγο του (μετάλλαξη: φιλτράρεται το admin-self)', () => {
    const theirs = buildAudienceRoster(ACT_AUDIENCE, OWNER.uid, 'act').sides[0];
    expect(theirs?.current.find((m) => m.uid === 'uid_admin')?.reason).toBe('admin-self');
  });

  it('Λ-4 στο γραφείο «δική μου» είναι η πλευρά host και ο θεατής σημαδεύεται (μετάλλαξη: απόλυτες πλευρές)', () => {
    const roster = buildAudienceRoster(ACT_AUDIENCE, ELENI.uid, 'act');
    expect(roster.sides[0]?.current.map((m) => m.uid)).toStrictEqual(['uid_owner']);
    expect(roster.sides[1]?.relation).toBe('mine');
    expect(roster.sides[1]?.current.find((m) => m.isViewer)?.uid).toBe('uid_eleni');
  });

  it('Λ-5 νήμα σχέσης ⇒ «προσωπικό», και ο άλλος είναι η άλλη πλευρά (μετάλλαξη: side===side ⇒ όλοι «δικοί μου»)', () => {
    const a = row('uid_a', { side: 'person', role: 'person', reason: 'relationship' });
    const b = row('uid_b', { side: 'person', role: 'person', reason: 'relationship' });
    const roster = buildAudienceRoster([a, b], 'uid_a', 'relationship');
    expect(roster.personal).toBe(true);
    expect(roster.sides.map((s) => [s.relation, s.current.map((m) => m.uid)])).toStrictEqual([
      ['theirs', ['uid_b']],
      ['mine', ['uid_a']],
    ]);
  });

  it('Λ-6 τα ονόματα ζητιούνται ΜΙΑ φορά ανά πρόσωπο, και για όσους έφυγαν', () => {
    expect(rosterUids([...ACT_AUDIENCE, ELENI])).toStrictEqual([
      'uid_admin',
      'uid_eleni',
      'uid_kostas',
      'uid_nikos',
      'uid_owner',
    ]);
  });
});

// ADR-867 Β9 — ΜΙΑ ΘΕΣΗ, ΔΥΟ ΙΔΙΟΤΗΤΕΣ (Figma «υψηλότερη πρόσβαση» · NAR Άρθρο 4 «δηλωμένο συμφέρον»).
describe('audience-roster — ο ιδιοκτήτης που είναι ΚΑΙ μέλος του γραφείου', () => {
  const DUAL = row('uid_owner', { side: 'counterpart', role: 'counterpart', reason: 'counterpart', alsoHostRole: 'responsible' });

  it('Λ-9 🔴 η πλευρά του γραφείου ΔΕΝ φαίνεται άδεια: το είδωλο του ιδιοκτήτη, με τον ρόλο του εκεί (μετάλλαξη: χωρίς είδωλο)', () => {
    const roster = buildAudienceRoster([DUAL, ELENI], ELENI.uid, 'act');
    const mine = roster.sides.find((side) => side.relation === 'mine');
    expect(mine?.current.map((m) => [m.uid, m.role, m.mirror])).toStrictEqual([
      ['uid_owner', 'responsible', true],
      ['uid_eleni', 'collaborator', false],
    ]);
  });

  it('Λ-10 🔴 η θέση του ιδιοκτήτη ΔΗΛΩΝΕΙ τη δεύτερη ιδιότητα (μετάλλαξη: alsoHostRole χάνεται)', () => {
    const theirs = buildAudienceRoster([DUAL, ELENI], ELENI.uid, 'act').sides.find((side) => side.relation === 'theirs');
    expect(theirs?.current).toStrictEqual([
      expect.objectContaining({ uid: 'uid_owner', role: 'counterpart', alsoHostRole: 'responsible', mirror: false }),
    ]);
  });

  it('Λ-11 μόνος του ⇒ `solo`, και οι δύο πλευρές τον δείχνουν· με δεύτερο πρόσωπο ⇒ ΟΧΙ solo', () => {
    const alone = buildAudienceRoster([DUAL], DUAL.uid, 'act');
    expect(alone.solo).toBe(true);
    expect(alone.sides).toHaveLength(2);
    expect(buildAudienceRoster([DUAL, ELENI], DUAL.uid, 'act').solo).toBe(false);
    expect(buildAudienceRoster(ACT_AUDIENCE, OWNER.uid, 'act').solo).toBe(false);
  });

  it('Λ-12 χωρίς δεύτερη ιδιότητα ⇒ ΚΑΝΕΝΑ είδωλο (μετάλλαξη: είδωλο για κάθε αντισυμβαλλόμενο)', () => {
    const roster = buildAudienceRoster(ACT_AUDIENCE, ELENI.uid, 'act');
    expect(roster.sides.flatMap((side) => side.current).filter((m) => m.mirror)).toStrictEqual([]);
  });
});

describe('away-strip — «ο Κώστας απουσιάζει — διαβάζει η Ελένη»', () => {
  it('Λ-7 οι αναπληρωτές είναι της ΙΔΙΑΣ πλευράς με τον απόντα (μετάλλαξη: covering χωρίς φίλτρο πλευράς)', () => {
    const notices = awayNotices(
      {
        away: [
          { uid: 'uid_kostas', role: 'responsible', until: '2026-09-24T00:00:00.000Z' },
        ],
        covering: ['uid_eleni', 'uid_admin'],
      },
      ACT_AUDIENCE,
      OWNER.uid,
    );
    expect(notices).toStrictEqual([
      {
        relation: 'theirs',
        absent: [{ uid: 'uid_kostas', until: '2026-09-24T00:00:00.000Z' }],
        covering: ['uid_eleni', 'uid_admin'],
      },
    ]);

    // 🔴 Απόντες ΚΑΙ στις δύο πλευρές: οι αναπληρωτές του γραφείου ΔΕΝ «καλύπτουν» τον ιδιοκτήτη
    //    (μετάλλαξη Λ-7 που ΕΠΕΖΗΣΕ στην πρώτη γραφή — όλοι οι αναπληρωτές ήταν της ίδιας πλευράς).
    const both = awayNotices(
      {
        away: [
          { uid: 'uid_owner', role: 'counterpart', until: '2026-09-30T00:00:00.000Z' },
          { uid: 'uid_kostas', role: 'responsible', until: '2026-09-24T00:00:00.000Z' },
        ],
        covering: ['uid_eleni', 'uid_admin'],
      },
      ACT_AUDIENCE,
      ELENI.uid,
    );
    expect(both).toStrictEqual([
      { relation: 'theirs', absent: [{ uid: 'uid_owner', until: '2026-09-30T00:00:00.000Z' }], covering: [] },
      { relation: 'mine', absent: [{ uid: 'uid_kostas', until: '2026-09-24T00:00:00.000Z' }], covering: ['uid_eleni', 'uid_admin'] },
    ]);
  });

  it('Λ-8 αν αναπληρώνω ΕΓΩ, το λέει — ποτέ ψευδές «κανείς»· στο νήμα σχέσης κανείς δεν αναπληρώνει (μετάλλαξη: εξαίρεση θεατή / covering στο person)', () => {
    const mine = awayNotices(
      { away: [{ uid: 'uid_kostas', role: 'responsible', until: '2026-09-24T00:00:00.000Z' }], covering: ['uid_eleni'] },
      ACT_AUDIENCE,
      ELENI.uid,
    );
    expect(mine[0]).toMatchObject({ relation: 'mine', covering: ['uid_eleni'] });

    const a = row('uid_a', { side: 'person', role: 'person', reason: 'relationship' });
    const b = row('uid_b', { side: 'person', role: 'person', reason: 'relationship' });
    const personal = awayNotices(
      { away: [{ uid: 'uid_b', role: 'person', until: '2026-09-24T00:00:00.000Z' }], covering: ['uid_a'] },
      [a, b],
      'uid_a',
    );
    expect(personal).toStrictEqual([
      { relation: 'theirs', absent: [{ uid: 'uid_b', until: '2026-09-24T00:00:00.000Z' }], covering: [] },
    ]);
  });
});
