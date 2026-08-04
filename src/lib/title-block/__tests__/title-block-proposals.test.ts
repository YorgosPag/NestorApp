/**
 * @fileoverview Λ2 άκρη-σε-άκρη πάνω στην ΠΡΑΓΜΑΤΙΚΗ πινακίδα (ADR-745 Φ3β).
 *
 * Η είσοδος δεν είναι χειροποίητη: τρέχει ο πραγματικός Λ1 πάνω στο fixture του
 * `G753_ergasia F.dxf`, ώστε ό,τι αλλάξει στην ανάγνωση να φαίνεται **εδώ**.
 */

import { readTitleBlocks } from '@/subapps/dxf-viewer/text-engine/title-block/reading/title-block-reading';
import { G753_TITLEBLOCK_ROWS } from '@/subapps/dxf-viewer/text-engine/title-block/reading/__tests__/fixtures/g753-titleblock.fixture';
import type { BindingProposal } from '@/types/title-block-binding';
import { resolveTitleBlockProposals } from '../title-block-proposals';
import type { ContactSnapshotEntry } from '../resolve-people';

const PROJECT = 'proj_g753';
const LEVEL = 'lvl_topo';

const readings = () => readTitleBlocks('PINAKAKI 500', G753_TITLEBLOCK_ROWS);

/** Οι επαφές όπως θα ήταν στη βάση — με τόνους, πεζά και άλλη σειρά ονομάτων. */
const CONTACTS: readonly ContactSnapshotEntry[] = [
  {
    id: 'cont_mavro',
    displayName: 'Κωνσταντίνος Μαυρομιχάλης',
    phones: ['2310 788493'],
    emails: [],
  },
  {
    id: 'cont_nikolaou',
    displayName: 'Ιωάννης Νικολάου',
    phones: [],
    emails: ['INFO@nikolaou.com.gr'],
  },
  { id: 'cont_zerva', displayName: 'Γεωργία Ζέρβα', phones: [], emails: [] },
  { id: 'cont_other', displayName: 'Δημήτριος Παπαδόπουλος', phones: [], emails: [] },
];

const resolve = (contacts = CONTACTS) =>
  resolveTitleBlockProposals(readings(), { projectId: PROJECT, levelId: LEVEL, contacts });

/**
 * ⚠️ Χωριστός βοηθός, **όχι** `resolve(CONTACTS, undefined)`: περνώντας `undefined` σε παράμετρο
 * με προεπιλογή, η προεπιλογή **ενεργοποιείται** — δηλαδή το «χωρίς έργο» θα είχε έργο και το
 * test θα ήταν πράσινο χωρίς να ελέγχει τίποτα.
 */
const resolveWithoutProject = () =>
  resolveTitleBlockProposals(readings(), { levelId: LEVEL, contacts: CONTACTS });

const forField = (all: BindingProposal[], key: string) => all.filter((p) => p.fieldKey === key);
const person = (all: BindingProposal[], name: string) => all.find((p) => p.personName === name);

describe('Λ2 — μελετητές', () => {
  it('🔴 ο τοπογράφος βρίσκεται με μαρτυρία ΤΗΛΕΦΩΝΟΥ παρά τη συστολή του ονόματος', () => {
    const p = person(resolve(), 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ');
    expect(p?.candidates[0].target).toEqual({
      kind: 'contact',
      contactId: 'cont_mavro',
      role: 'surveyor',
      projectId: PROJECT,
    });
    // Το τηλέφωνο της πινακίδας είναι «2310-788493», της βάσης «2310 788493».
    expect(p?.candidates[0].evidence.map((e) => e.kind)).toContain('phone');
    expect(p?.candidates[0].evidence.map((e) => e.kind)).toContain('name-abbrev');
  });

  it('ο δεύτερος μηχανικός παίρνει τον δικό του ρόλο από την ειδικότητά του', () => {
    const p = person(resolve(), 'ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ');
    expect(p?.candidates[0].target).toMatchObject({
      contactId: 'cont_nikolaou',
      role: 'structural_engineer',
    });
    // e-mail με άλλα πεζά/κεφαλαία — ταυτότητα, όχι συμβολοσειρά.
    expect(p?.candidates[0].evidence[0].kind).toBe('email');
  });

  it('🔴 το e-mail κατατάσσεται ΠΑΝΩ από το όνομα — η μαρτυρία είναι η βεβαιότητα', () => {
    const p = person(resolve(), 'ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ');
    const kinds = p?.candidates[0].evidence.map((e) => e.kind) ?? [];
    expect(kinds[0]).toBe('email');
  });

  it('άγνωστο πρόσωπο δηλώνεται «δεν βρέθηκε» — ποτέ σιωπηλά κενό', () => {
    const p = person(resolve([CONTACTS[3]]), 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ');
    expect(p?.candidates).toEqual([]);
    expect(p?.blockedBy).toBe('no-match');
  });

  it('🔴 «τον βρήκα αλλά δεν ξέρω με τι ιδιότητα» είναι ΑΛΛΟ μήνυμα από «δεν τον βρήκα»', () => {
    // Δύο διαφορετικά προβλήματα με διαφορετική θεραπεία — δεν επιτρέπεται να συγχέονται.
    const kinds = new Set(resolve().map((p) => p.blockedBy));
    expect(kinds.has('no-match')).toBe(false); // στο πλήρες στιγμιότυπο βρίσκονται όλοι
    const poor = resolve([{ id: 'c', displayName: 'Κωνσταντίνος Μαυρομιχάλης', phones: [], emails: [] }]);
    expect(person(poor, 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ')?.candidates.length).toBeGreaterThan(0);
  });
});

describe('Λ2 — ο «ΕΡΓΟΔΟΤΗΣ» πάει στους οικοπεδούχους, ΠΟΤΕ στον πελάτη', () => {
  it('προτείνεται ως οικοπεδούχος σε κατάσταση «prospective»', () => {
    const [p] = forField(resolve(), 'employer');
    expect(p.snapshotValue).toBe('ΖΕΡΒΑ ΓΕΩΡΓΙΑ');
    expect(p.candidates[0].target).toEqual({
      kind: 'landowner',
      projectId: PROJECT,
      contactId: 'cont_zerva',
      acquisitionStatus: 'prospective',
    });
  });

  it('🔴 ΚΑΜΙΑ πρόταση δεν δείχνει ποτέ στο Project.client', () => {
    const targets = resolve().flatMap((p) => p.candidates.map((c) => c.target));
    expect(targets.some((t) => t.kind === 'project-field' && t.field !== 'buildingBlock')).toBe(false);
    expect(JSON.stringify(targets)).not.toContain('client');
  });
});

describe('Λ2 — η ΘΕΣΗ σπάει σε ξεχωριστές αποφάσεις', () => {
  it('ο δήμος, η περιοχή και το Ο.Τ. γίνονται τρεις ανεξάρτητες προτάσεις', () => {
    const located = forField(resolve(), 'location');
    const byTarget = located
      .flatMap((p) => p.candidates)
      .map((c) => (c.target.kind === 'project-address' ? `${c.target.field}=${c.target.value}` : `${c.target.kind}=${'value' in c.target ? c.target.value : ''}`));

    expect(byTarget).toContain('municipality=ΚΟΡΔΕΛΙΟΥ ΕΥΟΣΜΟΥ');
    expect(byTarget).toContain('neighborhood=ΠΕΡΙΟΧΗ ΕΠΕΚΤΑΣΗΣ ΕΥΟΣΜΟΥ');
    expect(byTarget).toContain('project-field=Ο.Τ. Γ 753');
  });

  it('🔴 το Ο.Τ. ΔΕΝ ρουφά την υπόλοιπη πρόταση — κάθε σημαδούρα τερματίζει την προηγούμενη', () => {
    const ot = forField(resolve(), 'location').find((p) => p.snapshotValue.startsWith('Ο.Τ.'));
    expect(ot?.snapshotValue).toBe('Ο.Τ. Γ 753');
    expect(ot?.snapshotValue).not.toContain('ΟΙΚ');
    expect(ot?.snapshotValue).not.toContain('Οδός');
  });

  it('ό,τι δεν έχει πεδίο υποδοχής εμφανίζεται ΑΔΕΤΟ — δεν εξαφανίζεται', () => {
    const unbound = forField(resolve(), 'location')
      .filter((p) => p.blockedBy === 'unsupported-field')
      .map((p) => p.snapshotValue);
    expect(unbound.some((v) => v.startsWith('Δ.Ε.'))).toBe(true);
    expect(unbound.some((v) => v.startsWith('ΟΙΚ'))).toBe(true);
    expect(unbound.some((v) => v.startsWith('Οδός'))).toBe(true);
  });

  it('🔴 το «Π.Ε. 39» αναγνωρίζεται αλλά ΔΕΝ γράφεται — αριθμημένη πολεοδομική, όχι περιφερειακή ενότητα', () => {
    const pe = forField(resolve(), 'location').find((p) => p.snapshotValue.includes('Π.Ε.'));
    expect(pe).toBeDefined();
    expect(pe?.candidates).toEqual([]);
    expect(pe?.blockedBy).toBe('unsupported-field');
  });
});

describe('Λ2 — μεταδεδομένα σχεδίου', () => {
  it('κλίμακα/χρόνος/αριθμός/είδος δένουν στο ΦΥΛΛΟ, όχι στο έργο', () => {
    const metaTargets = resolve()
      .flatMap((p) => p.candidates.map((c) => c.target))
      .filter((t) => t.kind === 'drawing-meta');
    expect(metaTargets.every((t) => t.kind === 'drawing-meta' && t.levelId === LEVEL)).toBe(true);
    expect(metaTargets.map((t) => (t.kind === 'drawing-meta' ? `${t.field}=${t.value}` : ''))).toEqual(
      expect.arrayContaining(['scale=1:200', 'studyDate=ΙΟΥΛΙΟΣ 2026', 'drawingNumber=Τ1']),
    );
  });

  it('τα μεταδεδομένα δουλεύουν ΚΑΙ χωρίς έργο — δεν το χρειάζονται', () => {
    const withoutProject = resolveWithoutProject();
    const meta = withoutProject.filter((p) => p.fieldKey === 'scale');
    expect(meta[0].candidates).toHaveLength(1);
  });
});

describe('Λ2 — σχέδιο χωρίς έργο', () => {
  it('🔴 τα πεδία έργου δηλώνονται ΚΛΕΙΣΤΑ με αιτία, δεν εξαφανίζονται', () => {
    const withoutProject = resolveWithoutProject();
    for (const key of ['employer', 'location', 'designers']) {
      const found = forField(withoutProject, key);
      expect(found.length).toBeGreaterThan(0);
      expect(found.every((p) => p.blockedBy === 'no-project')).toBe(true);
    }
  });
});

describe('Λ2 — καμία σιωπηλή απώλεια', () => {
  it('κάθε πεδίο που διάβασε ο Λ1 εμφανίζεται σε τουλάχιστον μία πρόταση', () => {
    const readFields = readings().flatMap((r) => r.fields.map((f) => f.key));
    const proposed = new Set(resolve().map((p) => p.fieldKey));
    for (const key of readFields) expect(proposed.has(key)).toBe(true);
  });

  it('κάθε πρόταση χωρίς υποψήφιο έχει ΑΙΤΙΑ, και κάθε πρόταση με υποψήφιο δεν έχει', () => {
    for (const p of resolve()) {
      if (p.candidates.length === 0) expect(p.blockedBy).toBeDefined();
      else expect(p.blockedBy).toBeUndefined();
    }
  });

  it('ο δείκτης πινακίδας διατηρείται — το layer φέρει ΔΥΟ πινακίδες', () => {
    expect(readings()).toHaveLength(2);
    expect(resolve().every((p) => Number.isInteger(p.titleBlockIndex))).toBe(true);
  });
});
