/**
 * @jest-environment node
 *
 * ADR-861 Φ3 — άγκυρες του αναγνώστη εκδόσεων και του «τι άλλαξε».
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LEGAL_DOCUMENT_IDS, LEGAL_DOCUMENT_LOCALES } from '@/constants/legal-documents';
import { HUMAN_LANGUAGES } from '@/i18n/languages';
import { canonicalJson } from '@/lib/legal/canonical-json';
import type { FrozenLegalSection, FrozenLegalText } from '@/lib/legal/frozen-legal-document';
import {
  legalDocumentInForce,
  legalDocumentVersion,
  legalDocumentVersions,
} from '@/lib/legal/legal-document-versions';
import { sectionChangesBetween } from '@/lib/legal/section-changes';

const VERSIONS_DIR = join(process.cwd(), 'src', 'config', 'legal-document-versions');

describe('Αποδειξιμότητα — τα bytes που κατεβαίνουν ΕΙΝΑΙ τα bytes που υπογράφει το μητρώο', () => {
  it.each(LEGAL_DOCUMENT_IDS)('%s: κάθε έκδοση = αρχείο στον δίσκο, και sha256 = αποτύπωμα', (id) => {
    const versions = legalDocumentVersions(id);
    expect(versions.length).toBeGreaterThan(0);
    for (const v of versions) {
      const disk = readFileSync(join(VERSIONS_DIR, id, `v${v.frozen.version}.json`), 'utf8');
      expect(v.bytes).toBe(disk);
      expect(`sha256:${createHash('sha256').update(v.bytes, 'utf8').digest('hex')}`).toBe(v.digest);
    }
  });

  it('η σειριοποίηση της εφαρμογής = η μηχανή του γεννήτορα, και σε ΜΗ ταξινομημένη είσοδο', () => {
    // ⚠️ Τα αρχεία είναι ήδη ταξινομημένα ⇒ η άγκυρα των bytes ΔΕΝ βλέπει αν η συνάρτηση ταξινομεί
    //    (μετάλλαξη «χωρίς sort» επέζησε). Εδώ η είσοδος είναι σκόπιμα ανακατεμένη, με ελληνικά κλειδιά.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const engine: { readonly stableStringify: (value: unknown) => string } =
      require('../../../../scripts/lib/i18n-shell-slice/slice-build');
    const { stableStringify } = engine;
    const scrambled = { ω: 1, b: { z: [3, { y: 1, a: 2 }], a: null }, A: 'κείμενο\r\nγραμμή', a: true };
    expect(canonicalJson(scrambled)).toBe(stableStringify(scrambled));
    expect(canonicalJson(scrambled).indexOf('"A"')).toBeLessThan(canonicalJson(scrambled).indexOf('"ω"'));
  });

  it('οι γλώσσες που παγώνουν = οι ανθρώπινες γλώσσες της εφαρμογής (καμία έκδοση για τη μία μόνο)', () => {
    expect([...LEGAL_DOCUMENT_LOCALES].sort()).toEqual([...HUMAN_LANGUAGES].sort());
  });
});

describe('Λ7 — ζητήθηκε συγκεκριμένη έκδοση ⇒ ΠΟΤΕ υποκατάσταση', () => {
  it('άγνωστη έκδοση ⇒ absent, όχι η τελευταία', () => {
    expect(legalDocumentVersion('privacy-policy', 999)).toEqual({ kind: 'absent' });
  });

  it('γνωστή έκδοση ⇒ ακριβώς αυτή', () => {
    const found = legalDocumentVersion('privacy-policy', 1);
    expect(found.kind === 'published' && found.version.frozen.version).toBe(1);
  });
});

describe('«Σε ισχύ» ≠ «τελευταία»', () => {
  it('πριν από την 1η έκδοση ⇒ none-yet', () => {
    expect(legalDocumentInForce('terms-of-service', '2000-01-01')).toEqual({ kind: 'none-yet' });
  });

  it('την ημέρα ισχύος ⇒ in-force, χωρίς προαναγγελία', () => {
    const found = legalDocumentInForce('terms-of-service', '2026-09-16');
    expect(found.kind).toBe('in-force');
    expect(found.kind === 'in-force' && found.upcoming).toBeNull();
  });
});

const section = (id: string, text: string): FrozenLegalSection => ({
  id,
  heading: id,
  blocks: [{ kind: 'paragraph', text }],
});
const doc = (...sections: FrozenLegalSection[]): FrozenLegalText => ({ title: 'Τ', sections });

describe('Λ6 — «τι άλλαξε» κατά id, ποτέ κατά θέση', () => {
  it('νέα ενότητα στην ΑΡΧΗ ⇒ μόνο αυτή «added», οι υπόλοιπες «unchanged»', () => {
    const before = doc(section('a', 'Α'), section('b', 'Β'));
    const after = doc(section('new', 'Ν'), section('a', 'Α'), section('b', 'Β'));
    expect(sectionChangesBetween(before, after).map((c) => `${c.id}:${c.kind}`)).toEqual([
      'new:added',
      'a:unchanged',
      'b:unchanged',
    ]);
  });

  it('αλλαγμένο κείμενο + αφαιρεμένη ενότητα ⇒ changed + removed', () => {
    const before = doc(section('a', 'Α'), section('b', 'Β'));
    const after = doc(section('a', 'Α2'));
    expect(sectionChangesBetween(before, after).map((c) => `${c.id}:${c.kind}`)).toEqual([
      'a:changed',
      'b:removed',
    ]);
  });
});
