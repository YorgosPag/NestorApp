/**
 * ADR-651 Φάση Β — insert title block into scene: resolve → layout → block-local entities.
 *
 * Ντετερμινιστικό: το scope δίνεται καρφωτό (καμία Firestore/δίκτυο εξάρτηση) και ο resolver
 * είναι καθαρός, άρα ο ορισμός του block είναι απόλυτα προβλέψιμος.
 */

import type { TextEntity } from '../../../types/entities';
import type { PlaceholderScope } from '../../templates/resolver/scope.types';
import { TITLE_BLOCK_EL } from '../../templates/defaults/title-blocks';
import { buildTitleBlockDef, TITLE_BLOCK_BLOCK_NAME } from '../title-block-def';
import { buildTitleBlockLayout, type TitleBlockLayoutOptions } from '../title-block-layout';
import { readTitleBlockContent } from '../title-block-rows';
import { makeNode, makeParagraph, makeRun } from '../../templates/defaults/template-helpers';

const SCOPE: PlaceholderScope = {
  company: { name: 'ΠΑΓΩΝΗΣ ΑΕ' },
  project: {
    name: 'Οικία Παπαδοπούλου',
    code: 'PRJ-001',
    owner: 'Κύριος Έργου',
    location: 'Λεωφ. Νίκης 12, Θεσσαλονίκη',
    client: 'Εργοδότης ΑΕ',
  },
  user: { fullName: 'Γιώργος Π.', checkerName: 'Ελεγκτής Ε.' },
  drawing: { scale: '1:50' },
  formatting: { locale: 'el', today: new Date(2026, 6, 13) },
};

const texts = (entities: readonly { type: string }[]): TextEntity[] =>
  entities.filter((e): e is TextEntity => e.type === 'text');

/** Φάση Γ: η διάταξη είναι πλέον παραμετρική — τα tests της Φάσης Β κρατούν το ΣΚΕΤΟ κουτί. */
const BOX_LAYOUT: TitleBlockLayoutOptions = {
  paper: { size: 'A3', orientation: 'landscape' },
  withFrame: false,
  withStampBox: false,
  stampLabel: '',
};

const defOptions = (scaleFactor: number) => ({ scaleFactor, layout: BOX_LAYOUT });

describe('readTitleBlockContent', () => {
  it('παίρνει την πρώτη γραμμή χωρίς «:» ως κεφαλίδα και τις υπόλοιπες ως label:value', () => {
    const node = makeNode([
      makeParagraph([makeRun('ΠΑΓΩΝΗΣ ΑΕ')]),
      makeParagraph([makeRun('Έργο: Οικία')]),
      makeParagraph([makeRun('   ')]),
      makeParagraph([makeRun('Κλίμακα: 1:50')]),
    ]);

    const content = readTitleBlockContent(node);

    expect(content.heading).toBe('ΠΑΓΩΝΗΣ ΑΕ');
    expect(content.rows).toEqual([
      { label: 'Έργο:', value: 'Οικία' },
      // Χωρίζει στο ΠΡΩΤΟ «:» — η ώρα/κλίμακα στην τιμή δεν σπάει τη γραμμή.
      { label: 'Κλίμακα:', value: '1:50' },
    ]);
  });

  it('χωρίς κεφαλίδα (όλες οι γραμμές έχουν «:») δεν καταναλώνει γραμμή πεδίου', () => {
    const node = makeNode([makeParagraph([makeRun('Έργο: Οικία')])]);
    const content = readTitleBlockContent(node);
    expect(content.heading).toBe('');
    expect(content.rows).toHaveLength(1);
  });
});

describe('buildTitleBlockLayout', () => {
  it('βγάζει κλειστό περίγραμμα + κεφαλίδα + διαχωριστή και ύψος που μεγαλώνει με τις γραμμές', () => {
    const one = buildTitleBlockLayout(
      { heading: 'ΓΡΑΦΕΙΟ', rows: Array.from({ length: 6 }, (_, i) => ({ label: `Α${i}:`, value: '1' })) },
      BOX_LAYOUT,
    );
    const two = buildTitleBlockLayout(
      { heading: 'ΓΡΑΦΕΙΟ', rows: Array.from({ length: 7 }, (_, i) => ({ label: `Α${i}:`, value: '1' })) },
      BOX_LAYOUT,
    );

    const frame = one.primitives[0];
    expect(frame.kind).toBe('polyline');
    expect(one.primitives.some((p) => p.kind === 'line')).toBe(true);
    expect(two.sizeMm.heightMm).toBeGreaterThan(one.sizeMm.heightMm);
  });
});

describe('buildTitleBlockDef', () => {
  it('λύνει τα placeholders του ενεργού έργου μέσα στα entities της πινακίδας', () => {
    const def = buildTitleBlockDef(TITLE_BLOCK_EL, SCOPE, defOptions(1));
    const rendered = texts(def.localMembers).map((t) => t.text);

    expect(def.name).toBe(TITLE_BLOCK_BLOCK_NAME);
    expect(rendered).toContain('ΠΑΓΩΝΗΣ ΑΕ');
    expect(rendered.some((t) => t.includes('Οικία Παπαδοπούλου'))).toBe(true);
    expect(rendered.some((t) => t.includes('PRJ-001'))).toBe(true);
    expect(rendered.some((t) => t.includes('1:50'))).toBe(true);
    // Καμία ανεπίλυτη έκφραση δεν διαρρέει στη σκηνή.
    expect(rendered.some((t) => t.includes('{{'))).toBe(false);
  });

  it('y-flip: τα μέλη ζουν σε block-local χώρο με αρχή κάτω-αριστερά (y ≥ 0)', () => {
    const def = buildTitleBlockDef(TITLE_BLOCK_EL, SCOPE, defOptions(1));
    for (const text of texts(def.localMembers)) {
      expect(text.position.y).toBeGreaterThanOrEqual(0);
      expect(text.position.x).toBeGreaterThanOrEqual(0);
    }
    expect(def.boundsMm?.minX).toBe(0);
    expect(def.boundsMm?.minY).toBe(0);
  });

  it('annotative: ο συντελεστής κλίμακας μεγεθύνει γεωμετρία ΚΑΙ ύψος κειμένου γραμμικά', () => {
    const at1 = buildTitleBlockDef(TITLE_BLOCK_EL, SCOPE, defOptions(1));
    const at50 = buildTitleBlockDef(TITLE_BLOCK_EL, SCOPE, defOptions(50));

    expect(at50.boundsMm?.maxX).toBeCloseTo((at1.boundsMm?.maxX ?? 0) * 50);
    expect(at50.boundsMm?.maxY).toBeCloseTo((at1.boundsMm?.maxY ?? 0) * 50);

    const h1 = texts(at1.localMembers)[0].height ?? 0;
    const h50 = texts(at50.localMembers)[0].height ?? 0;
    expect(h50).toBeCloseTo(h1 * 50);
  });

  it('κενό scope ⇒ η πινακίδα μπαίνει ούτως ή άλλως, με κενά πεδία (zero-config, όχι σφάλμα)', () => {
    const def = buildTitleBlockDef(TITLE_BLOCK_EL, {}, defOptions(1));
    expect(def.localMembers.length).toBeGreaterThan(0);
    expect(texts(def.localMembers).some((t) => t.text.includes('{{'))).toBe(false);
  });

  it('κάθε μέλος έχει δικό του id (ανεξάρτητο instance μετά την κλωνοποίηση)', () => {
    const def = buildTitleBlockDef(TITLE_BLOCK_EL, SCOPE, defOptions(1));
    const ids = def.localMembers.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
