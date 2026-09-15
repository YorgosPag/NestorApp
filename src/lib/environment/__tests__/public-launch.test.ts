/**
 * Άγκυρες του δημόσιου ανοίγματος (ADR-861 Φ1).
 *
 * **Σ** — η σημαία: τρεις καταστάσεις, ποτέ boolean
 * **Ε** — η εκκίνηση: άγραφη ταμπέλα + δηλωμένο άνοιγμα ⇒ ΔΕΝ ξεκινά
 * **Τ** — 🔴 η παραγωγή σήμερα: χωρίς σημαία η εφαρμογή ΞΕΚΙΝΑ, ό,τι κι αν λέει ο φορέας
 */

import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import type { OperatorRecord } from '@/constants/platform-operator';
import { assertPublicLaunch } from '@/lib/environment/environment-startup';
import { PUBLIC_LAUNCH_ENV, readPublicLaunch } from '@/lib/environment/public-launch';

const NOW = new Date('2026-09-15T10:00:00Z');

const READY: OperatorRecord = {
  effectiveFrom: '2026-01-01',
  identity: { kind: 'natural-person', fullName: 'Δοκιμαστικό Πρόσωπο', tradeName: null },
  seat: { street: 'Οδός', number: '1', postalCode: '10431', city: 'Αθήνα', country: 'GR' },
  vatNumber: '123456783',
  gemiNumber: null,
  contact: { address: 'contact@example.gr', receivingConfirmedOn: '2026-02-01' },
  privacy: { address: 'privacy@example.gr', receivingConfirmedOn: '2026-02-01' },
};
const UNCONFIRMED: OperatorRecord = { ...READY, privacy: { ...READY.privacy, receivingConfirmedOn: null } };

const launch = (value: string | undefined) => ({ [PUBLIC_LAUNCH_ENV]: value });

describe('Σ — η σημαία έχει τρεις καταστάσεις', () => {
  it.each([[undefined], [''], ['   '], ['0'], ['false'], ['FALSE']])('Σ1 — «%s» ⇒ not-declared', (value) => {
    expect(readPublicLaunch(launch(value))).toBe('not-declared');
  });

  it.each([['1'], ['true'], [' TRUE ']])('Σ2 — «%s» ⇒ declared', (value) => {
    expect(readPublicLaunch(launch(value))).toBe('declared');
  });

  // 🔴 Με έλεγχο «υπάρχει;» το `yes` και το `no` θα διαβάζονταν ΚΑΙ ΤΑ ΔΥΟ ως «ναι».
  it.each([['yes'], ['no'], ['2']])('Σ3 — «%s» ⇒ unrecognized', (value) => {
    expect(readPublicLaunch(launch(value))).toBe('unrecognized');
  });
});

describe('Ε — η εκκίνηση', () => {
  it('Ε0 — θετικός μάρτυρας: δηλωμένο άνοιγμα + πλήρης φορέας ⇒ ξεκινά', () => {
    expect(() => assertPublicLaunch(launch('1'), NOW, [READY])).not.toThrow();
  });

  it('Ε1 — δηλωμένο άνοιγμα + κανένας φορέας ⇒ ΠΕΤΑ, με όνομα σημαίας και κατάσταση', () => {
    expect(() => assertPublicLaunch(launch('1'), NOW, [])).toThrow(/NESTOR_PUBLIC_LAUNCH.*pending/);
  });

  it('Ε2 — δηλωμένο άνοιγμα + ανεπιβεβαίωτο email απορρήτου ⇒ ΠΕΤΑ, με το ελάττωμα', () => {
    expect(() => assertPublicLaunch(launch('true'), NOW, [UNCONFIRMED])).toThrow(/privacy-mailbox-unconfirmed/);
  });

  it('Ε3 — άγνωστη τιμή ⇒ ΠΕΤΑ, ακόμα και με πλήρη φορέα', () => {
    expect(() => assertPublicLaunch(launch('yes'), NOW, [READY])).toThrow(/NESTOR_PUBLIC_LAUNCH/);
  });

  it('Ε4 — αθέτη σημαία + κανένας φορέας ⇒ ξεκινά (το άνοιγμα δεν δηλώθηκε)', () => {
    expect(() => assertPublicLaunch({}, NOW, [])).not.toThrow();
  });
});

describe('Τ — η παραγωγή σήμερα', () => {
  // 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΠΡΟΣΤΑΤΕΥΕΙ ΤΟ nestorconstruct.gr: η σημαία δεν ορίζεται στο Coolify, άρα
  // το ΠΡΑΓΜΑΤΙΚΟ ιστορικό —ό,τι κι αν λέει— δεν επιτρέπεται να ρίξει το επόμενο deploy.
  it('Τ1 — χωρίς σημαία, το πραγματικό ιστορικό δεν ρίχνει την εκκίνηση', () => {
    expect(() => assertPublicLaunch({})).not.toThrow();
  });

  // 🔴 Μια άρνηση που κανείς δεν καλεί είναι σχόλιο. AST και όχι κείμενο: το ίδιο το αρχείο
  // ΟΝΟΜΑΖΕΙ τη συνάρτηση μέσα σε σχόλια — σαρωτής κειμένου θα πρασίνιζε και χωρίς την κλήση.
  it('Τ2 — το `instrumentation.ts` ΚΑΛΕΙ την άρνηση στην εκκίνηση', () => {
    const file = path.resolve(__dirname, '..', '..', '..', '..', 'instrumentation.ts');
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const calls: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) calls.push(node.expression.text);
      ts.forEachChild(node, visit);
    };
    visit(sf);
    expect(calls).toContain('assertPublicLaunch');
  });
});
