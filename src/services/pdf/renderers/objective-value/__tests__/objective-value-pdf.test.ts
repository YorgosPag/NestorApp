/**
 * @jest-environment node
 *
 * @fileoverview ADR-947 Φ2β — **το PDF πληροφοριακού υπολογισμού λέει ό,τι υπόσχεται.**
 *
 * Ο «τρίτος» διαβάζει το PDF όπως θα το διάβαζε: το συνημμένο (με τον ΙΔΙΟ αναγνώστη που θα χρησιμοποιήσει η σελίδα
 * επαλήθευσης) · το κείμενο των σελίδων με το **πραγματικό** pdf.js σε χωριστή διεργασία (μέσω του χάρτη ToUnicode).
 * Node περιβάλλον: το αποτύπωμα θέλει Web Crypto (`crypto.subtle`), που το jsdom δεν έχει.
 */

import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { createBundleTranslate } from '@/i18n/bundle-translate';
import elObjectiveValue from '@/i18n/locales/el/objective-value.json';
import elPropertiesEnums from '@/i18n/locales/el/properties-enums.json';
import { sha256HexOfText } from '@/lib/hash/sha256';
import { computeObjectiveValue } from '@/lib/objective-value/compute-objective-value';
import { draftToInput } from '@/lib/objective-value/objective-value-draft';
import { deriveInputProvenance } from '@/lib/objective-value/objective-value-input-provenance';
import {
  composeObjectiveValueSnapshot,
  objectiveValueSnapshotDigest,
  snapshotEffectiveDraft,
  type ObjectiveValueSnapshot,
} from '@/lib/objective-value/objective-value-snapshot';
import { SNAPSHOT_REQUEST } from '@/lib/objective-value/__tests__/objective-value-snapshot.fixtures';
import { readPdfTextFile } from '@/services/pdf/pdf-associated-file';

import { produceObjectiveValueSnapshotPdf } from '../objective-value-pdf.server';
import { renderObjectiveValuePdf } from '../objective-value-pdf-renderer';
import { liveObjectiveValuePdfView, type ObjectiveValuePdfView } from '../objective-value-pdf-view';

const ATTACHMENT = 'objective-value-snapshot.json';
const FORBIDDEN = /βεβαίω|επίσημ|certif|official/iu;

async function snapshotFixture(): Promise<ObjectiveValueSnapshot> {
  const composition = composeObjectiveValueSnapshot(SNAPSHOT_REQUEST);
  if (!composition.ok) throw new Error('fixture: η μηχανή δεν υπολόγισε');
  const digest = await objectiveValueSnapshotDigest(composition.content);
  return {
    ...composition.content,
    id: 'ovsn_a387d0b1-9ad7-4af3-8db1-b8faf2f9bf16',
    digest,
    companyId: 'comp_1',
    createdAt: '2026-11-23T10:00:00.000Z',
    createdBy: 'user_1',
  };
}

/** Το πραγματικό pdf.js σε χωριστή διεργασία — ό,τι θα έκανε ένα πρόγραμμα ανάγνωσης. */
const PDFJS_ORACLE = String.raw`(async () => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(require('fs').readFileSync(process.argv[1]));
  const doc = await getDocument({ data, isEvalSupported: false }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const { items } = await (await doc.getPage(n)).getTextContent();
    pages.push(items.map((item) => (item.str || '') + (item.hasEOL ? '\n' : ' ')).join(''));
  }
  process.stdout.write(pages.join('\n'));
})()`;

function textOf(pdf: Uint8Array): string {
  const dir = mkdtempSync(join(tmpdir(), 'ovpdf-'));
  try {
    const file = join(dir, 'objective-value.pdf');
    writeFileSync(file, pdf);
    return execFileSync(process.execPath, ['-e', PDFJS_ORACLE, file], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Κάθε συμβολοσειρά της όψης — για να βεβαιωθεί ότι καμία δεν είναι ωμό κλειδί. */
function stringsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsOf);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(stringsOf);
  return [];
}

async function produced(snapshot: ObjectiveValueSnapshot, language: 'el' | 'en') {
  const outcome = await produceObjectiveValueSnapshotPdf(snapshot, language);
  if (!outcome.ok) throw new Error(`αναμενόταν PDF: ${outcome.reason}`);
  return outcome;
}

describe('ADR-947 Φ2β — PDF στιγμιοτύπου', () => {
  let snapshot: ObjectiveValueSnapshot;
  let pdf: Uint8Array;
  let text: string;

  beforeAll(async () => {
    snapshot = await snapshotFixture();
    pdf = (await produced(snapshot, 'el')).pdf;
    text = textOf(pdf);
  });

  it('το συνημμένο ΕΙΝΑΙ το αποτυπωμένο περιεχόμενο: sha256(συνημμένο) = τυπωμένο αποτύπωμα', async () => {
    const attached = await readPdfTextFile(pdf, ATTACHMENT);
    expect(attached).not.toBeNull();
    expect(await sha256HexOfText(attached ?? '')).toBe(snapshot.digest);
  });

  it('ίδιο στιγμιότυπο ⇒ ίδια bytes (ντετερμινιστικό: κανένα «τώρα» μέσα στο έγγραφο)', async () => {
    const again = (await produced(snapshot, 'el')).pdf;
    expect(Buffer.from(again).equals(Buffer.from(pdf))).toBe(true);
  });

  it('τυπώνει κωδικό, αποτύπωμα, ποσό και «Πληροφοριακός υπολογισμός» — ποτέ «βεβαίωση»/«επίσημη»', () => {
    const flat = text.replace(/\s+/gu, '');
    expect(text).toContain('Πληροφοριακός υπολογισμός');
    expect(flat).toContain(snapshot.id);
    expect(flat).toContain(snapshot.digest);
    expect(text).toContain('ΠΟΛ.1149/1994');
    expect(text).not.toMatch(FORBIDDEN);
  });

  it('το ίδιο έγγραφο στα αγγλικά λέει το ίδιο αποτύπωμα — και καμία ελληνική ετικέτα', async () => {
    const en = await produced(snapshot, 'en');
    const enText = textOf(en.pdf);
    expect(enText).toContain('Informational objective value calculation');
    expect(enText).not.toContain('Πληροφοριακός');
    expect(enText.replace(/\s+/gu, '')).toContain(snapshot.digest);
    expect(enText).not.toMatch(FORBIDDEN);
    expect(await sha256HexOfText((await readPdfTextFile(en.pdf, ATTACHMENT)) ?? '')).toBe(snapshot.digest);
  });

  it('αλλοιωμένη εγγραφή (αποτύπωμα ≠ περιεχόμενο) ⇒ άρνηση, ποτέ PDF που διαψεύδει τον εαυτό του', async () => {
    const outcome = await produceObjectiveValueSnapshotPdf({ ...snapshot, digest: '0'.repeat(64) }, 'el');
    expect(outcome).toEqual({ ok: false, reason: 'attachment-mismatch' });
  });
});

describe('ADR-947 Φ2β — PDF της συσκευής (βαθμίδα 1)', () => {
  const t = createBundleTranslate({ 'objective-value': elObjectiveValue, 'properties-enums': elPropertiesEnums }, 'objective-value', 'el');
  const words = { t, language: 'el' as const };

  function liveView(): ObjectiveValuePdfView {
    const draft = snapshotEffectiveDraft(SNAPSHOT_REQUEST.draft, SNAPSHOT_REQUEST.zone);
    const result = computeObjectiveValue(draftToInput(draft, SNAPSHOT_REQUEST.valuationDate));
    if (result.kind !== 'computed') throw new Error('fixture: η μηχανή δεν υπολόγισε');
    const provenance = deriveInputProvenance({
      draft,
      prefill: null,
      location: { zonePriceFromSource: false, zonePrice: draft.zonePrice, sourcedCommercialityFactor: null },
    });
    return liveObjectiveValuePdfView(words, {
      calculation: { valuationDate: SNAPSHOT_REQUEST.valuationDate, draft, result, provenance, engine: SNAPSHOT_REQUEST.engine, zone: { fromSource: false, validFrom: null, table: null } },
      generatedAt: '2026-11-23T10:00:00.000Z',
      place: 'Εγνατίας 147, Θεσσαλονίκη',
    });
  }

  it('κάθε κείμενο της όψης είναι επιλυμένο — κανένα ωμό κλειδί locale', () => {
    const raw = stringsOf(liveView()).filter((text) => /^(objective-value|properties-enums):|^[a-z]+(\.[a-zA-Z]+){2,}$/u.test(text));
    expect(raw).toEqual([]);
  });

  it('δεν φέρει κωδικό, QR ή ντετερμινιστική ταυτότητα — και οι είσοδοι λένε όροφο και προέλευση', () => {
    const view = liveView();
    expect(view.verification).toBeNull();
    expect(view.identity).toBeNull();
    expect(view.inputs.rows).toContainEqual(['Επίπεδο 1: όροφος', "Α' όροφος (ή ημιώροφος)", 'Δηλωμένη τιμή']);
    expect(view.inputs.rows.map(([label]) => label)).toContain('Πρόσοψη');
  });

  it('αποδίδεται σε PDF χωρίς «βεβαίωση»/«επίσημη»', async () => {
    const text = textOf(await renderObjectiveValuePdf(liveView(), null));
    expect(text).toContain('Υπολογίστηκε στη συσκευή σας');
    expect(text).not.toMatch(FORBIDDEN);
  });
});
