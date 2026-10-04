/**
 * ADR-901 §14.8 — άγκυρα Α38: ΕΝΑΣ γραφέας σημάτων, και ΚΑΘΕ γραφέας της υπόθεσης τον ρωτά.
 *
 * Οι κανόνες κλείνουν τον **πελάτη** (`create/update/delete: if false`) — **όχι** το Admin SDK. Ένας δεύτερος γραφέας
 * σημάτων στον server θα μπορούσε να σημάνει όψη **έξω** από το ακροατήριο (διαρροή χρονισμού), και ένας γραφέας
 * της υπόθεσης που «ξέχασε» το σήμα αφήνει την οθόνη μπαγιάτικη μέχρι το F5 — το σύμπτωμα του Π5.
 * (Ο γραφέας συμμετοχών είναι φραγμένος **δομικά**: το σήμα είναι υποχρεωτική παράμετρος — δεν μεταγλωττίζεται χωρίς.)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(process.cwd(), 'src');
const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  if (statSync(full).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : files(full);
  return /\.(ts|tsx)$/.test(name) ? [full] : [];
});
const rel = (f: string) => relative(process.cwd(), f).replace(/\\/g, '/');
const ALL = files(SRC);
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const WRITER = 'src/services/conveyance/conveyance-view-signal.server.ts';
const CLIENT_REF = 'src/lib/conveyance/view-signal-client-ref.ts';

/** Κάθε γραφέας που αλλάζει όψη της υπόθεσης — και η κλήση σήματος που οφείλει να κάνει. */
const CASE_WRITERS: Readonly<Record<string, RegExp>> = {
  'src/services/conveyance/conveyance-case.service.ts': /signalCaseChangeInTx\(|signalViewsInTx\(/g,
  'src/services/conveyance/conveyance-contribution.service.ts': /signalCaseChangeInTx\(/g,
  'src/services/conveyance/conveyance-document-request.service.ts': /signalCaseChangeInTx\(/g,
  'src/services/conveyance/conveyance-engagement-host.service.ts': /caseRosterSignal\(/g,
  'src/services/conveyance/conveyance-engagement-access.service.ts': /caseRosterSignal\(/g,
  'src/server/engagement-invitations/engagement-invitation-redeem.ts': /caseRosterSignal\(|invitationHostSignal\(/g,
  'src/server/engagement-invitations/engagement-invitation-issue.ts': /invitationHostSignal\(/g,
  'src/server/engagement-invitations/engagement-invitation-reminder.ts': /invitationHostSignal\(/g,
  'src/server/engagement-invitations/engagement-invitation-preview.ts': /invitationHostSignal\(/g,
};

/** Πόσες κλήσεις οφείλει τουλάχιστον κάθε γραφέας (μία ανά συναλλαγή που αλλάζει όψη). */
const MIN_CALLS: Readonly<Record<string, number>> = {
  'src/services/conveyance/conveyance-case.service.ts': 2, // άνοιγμα + εντολή
  'src/services/conveyance/conveyance-contribution.service.ts': 2, // αποστολή + απόσυρση
  'src/services/conveyance/conveyance-engagement-host.service.ts': 3, // πρόταση + τέλος + κλείσιμο
  'src/server/engagement-invitations/engagement-invitation-issue.ts': 2, // έκδοση + ανάκληση
  'src/server/engagement-invitations/engagement-invitation-redeem.ts': 2, // αποδοχή + άρνηση
};

describe('Α38 — ο ΕΝΑΣ γραφέας σημάτων όψεων', () => {
  it('η συλλογή σημάτων ονομάζεται ΜΟΝΟ από τον γραφέα και την (μόνο-ανάγνωσης) αναφορά του client', () => {
    const users = ALL.filter((f) => readFileSync(f, 'utf8').includes('COLLECTIONS.CONVEYANCE_VIEW_SIGNALS')).map(rel).sort();
    expect(users).toEqual([CLIENT_REF, WRITER].sort());
  });

  it('η αναφορά του client ΔΕΝ γράφει ποτέ', () => {
    // Κλήσεις, όχι λέξεις: η κεφαλίδα του αρχείου ΟΝΟΜΑΖΕΙ το `setDoc` για να το απαγορεύσει.
    expect(read(CLIENT_REF)).not.toMatch(/\b(setDoc|updateDoc|deleteDoc|addDoc|writeBatch|runTransaction)\(/);
  });

  it('το έγγραφο σήματος γράφεται ΜΟΝΟ από τη `signalViewsInTx` (μία γραφή, merge + increment)', () => {
    const writes = read(WRITER).match(/\btx\.(set|update|create|delete)\(/g) ?? [];
    expect(writes).toEqual(['tx.set(']);
  });
});

describe('Α38 — ΚΑΘΕ γραφέας της υπόθεσης σημαίνει τις όψεις της', () => {
  it.each(Object.entries(CASE_WRITERS))('%s', (path, call) => {
    const calls = read(path).match(call)?.length ?? 0;
    expect({ path, calls: Math.min(calls, MIN_CALLS[path] ?? 1) }).toEqual({ path, calls: MIN_CALLS[path] ?? 1 });
  });
});
