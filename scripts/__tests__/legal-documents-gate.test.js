/**
 * CHECK 3.85 / ADR-861 Φ3 — άγκυρες της πύλης εκδόσεων νομικών εγγράφων.
 *
 * Κρίνουν **την ίδια** καθαρή `judgeLegalDocuments` που τρέχει η πύλη, πάνω σε κόσμους
 * φτιαγμένους στο χέρι· και μία άγκυρα κρίνει **το πραγματικό αποθετήριο**.
 *
 * Κάθε κανόνας έχει **θετικό μάρτυρα** (ο καθαρός κόσμος μένει καθαρός) — αλλιώς μια πύλη που
 * αναφέρει τα πάντα θα περνούσε τις αρνητικές άγκυρες.
 */

'use strict';

const M = require('../lib/legal-documents/model');
const { RULES, judgeLegalDocuments } = require('../lib/legal-documents/judge');
const { loadWorld, renderIndex } = require('../lib/legal-documents/world');

const LOCALES = ['el', 'en'];
const OUTLINE = {
  source: 'doc',
  titleKey: 'title',
  sections: [
    { id: 'intro', headingKey: 'intro.title', blocks: [{ kind: 'paragraph', key: 'intro.content' }] },
    { id: 'contact', headingKey: 'contact.title', blocks: [{ kind: 'operator-identity' }] },
  ],
};

const legal = (content) => ({
  doc: { title: 'Τίτλος', intro: { title: 'Εισαγωγή', content }, contact: { title: 'Επικοινωνία' } },
});

const operatorRow = (effectiveFrom, vatNumber) => ({ effectiveFrom, vatNumber, identity: { kind: 'natural-person' } });

function operatorsFrom(history) {
  return {
    history,
    recordOn: (day) => history.filter((r) => r.effectiveFrom <= day).slice(-1)[0] || null,
  };
}

function freezeInto(files, { version, effectiveFrom, content, operators }) {
  const legalByLocale = { el: legal(content), en: legal(content) };
  const frozen = M.buildFrozen({
    id: 'doc',
    version,
    effectiveFrom,
    material: true,
    changeNote: null,
    text: M.resolveDocument('doc', OUTLINE, LOCALES, legalByLocale),
    operatorRecord: operators.recordOn(effectiveFrom),
  });
  const bytes = M.stableStringify(frozen);
  files.set(`doc@${version}`, bytes);
  return { version, effectiveFrom, material: true, digest: M.digestOf(bytes) };
}

/** Καθαρός κόσμος: μία έκδοση, ζωντανό κείμενο ίδιο, φρέσκο ευρετήριο, ίδιο `HEAD`. */
function cleanWorld() {
  const files = new Map();
  const operators = operatorsFrom([operatorRow('2026-09-15', '111')]);
  const row = freezeInto(files, { version: 1, effectiveFrom: '2026-09-16', content: 'Κείμενο v1', operators });
  const manifest = { documents: { doc: [row] } };
  const index = renderIndex(manifest, ['doc']);
  return {
    files,
    ids: ['doc'],
    outlines: { doc: OUTLINE },
    locales: LOCALES,
    legalByLocale: { el: legal('Κείμενο v1'), en: legal('Κείμενο v1') },
    manifest,
    headManifest: JSON.parse(JSON.stringify(manifest)),
    readFrozenBytes: (id, v) => (files.has(`${id}@${v}`) ? files.get(`${id}@${v}`) : null),
    operators,
    indexText: index,
    expectedIndexText: index,
  };
}

const rulesOf = (world) => judgeLegalDocuments(world).map((f) => f.rule);

describe('CHECK 3.85 — θετικός μάρτυρας', () => {
  it('καθαρός κόσμος ⇒ κανένα εύρημα', () => {
    expect(judgeLegalDocuments(cleanWorld())).toEqual([]);
  });

  it('ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΑΠΟΘΕΤΗΡΙΟ: κάθε νομικό έγγραφο είναι αμετάβλητη, αποδείξιμη έκδοση', () => {
    expect(judgeLegalDocuments(loadWorld())).toEqual([]);
  });
});

describe('Λ1 / Κ1 — τα bytes της παγωμένης έκδοσης', () => {
  it('αλλαγμένο παγωμένο αρχείο (ίδιο μητρώο) ⇒ frozen-bytes-mismatch', () => {
    const world = cleanWorld();
    world.files.set('doc@1', world.files.get('doc@1').replace('Κείμενο v1', 'Κείμενο αλλαγμένο'));
    expect(rulesOf(world)).toContain(RULES.K1);
  });

  it('χαμένο αρχείο ⇒ frozen-bytes-mismatch', () => {
    const world = cleanWorld();
    world.files.delete('doc@1');
    expect(rulesOf(world)).toContain(RULES.K1);
  });
});

describe('Λ2 / Κ2 — ζωντανό κείμενο χωρίς έκδοση', () => {
  it('αλλαγή στο legal.json χωρίς νέα έκδοση ⇒ text-changed-without-version', () => {
    const world = cleanWorld();
    world.legalByLocale.en = legal('Changed text');
    expect(rulesOf(world)).toEqual([RULES.K2]);
  });

  it('έγγραφο χωρίς καμία έκδοση ⇒ text-changed-without-version', () => {
    const world = cleanWorld();
    world.manifest = { documents: {} };
    world.headManifest = null;
    world.expectedIndexText = renderIndex(world.manifest, ['doc']);
    world.indexText = world.expectedIndexText;
    expect(rulesOf(world)).toEqual([RULES.K2]);
  });

  it('νέα έκδοση με το νέο κείμενο ⇒ καθαρό (θετικός μάρτυρας)', () => {
    const world = cleanWorld();
    const row = freezeInto(world.files, { version: 2, effectiveFrom: '2026-10-01', content: 'Κείμενο v2', operators: world.operators });
    world.manifest = { documents: { doc: [...world.manifest.documents.doc, row] } };
    world.legalByLocale = { el: legal('Κείμενο v2'), en: legal('Κείμενο v2') };
    world.expectedIndexText = renderIndex(world.manifest, ['doc']);
    world.indexText = world.expectedIndexText;
    expect(judgeLegalDocuments(world)).toEqual([]);
  });
});

describe('Λ3 / Κ3 — δημοσιευμένη έκδοση ξαναγράφτηκε', () => {
  it('ξαναπάγωμα της v1 με νέο κείμενο (συνεπές αρχείο + μητρώο) ⇒ published-version-altered', () => {
    const world = cleanWorld();
    const row = freezeInto(world.files, { version: 1, effectiveFrom: '2026-09-16', content: 'Άλλο κείμενο', operators: world.operators });
    world.manifest = { documents: { doc: [row] } };
    world.legalByLocale = { el: legal('Άλλο κείμενο'), en: legal('Άλλο κείμενο') };
    // Κ1, Κ2 ικανοποιούνται — μόνο η σύγκριση με το HEAD το βλέπει.
    expect(rulesOf(world)).toEqual([RULES.K3]);
  });

  it('σβήσιμο δημοσιευμένης έκδοσης ⇒ published-version-altered', () => {
    const world = cleanWorld();
    world.manifest = { documents: { doc: [] } };
    expect(rulesOf(world)).toContain(RULES.K3);
  });
});

describe('Κ4 — ακολουθία εκδόσεων', () => {
  it('κενό αριθμού (v1 → v3) ⇒ version-sequence-broken', () => {
    const world = cleanWorld();
    const row = freezeInto(world.files, { version: 3, effectiveFrom: '2026-10-01', content: 'Κείμενο v1', operators: world.operators });
    world.manifest = { documents: { doc: [...world.manifest.documents.doc, row] } };
    expect(rulesOf(world)).toContain(RULES.K4);
  });
});

describe('Λ4 / Κ5 — μάρτυρας φορέα', () => {
  it('επεξεργασία δημοσιευμένης γραμμής φορέα ⇒ operator-witness-mismatch', () => {
    const world = cleanWorld();
    world.operators = operatorsFrom([operatorRow('2026-09-15', '999')]);
    expect(rulesOf(world)).toEqual([RULES.K5]);
  });

  it('νέα γραμμή φορέα ΜΕΤΑ την έκδοση δεν αλλάζει τη μαρτυρία της παλιάς (θετικός μάρτυρας Κ5)', () => {
    const world = cleanWorld();
    world.operators = operatorsFrom([operatorRow('2026-09-15', '111'), operatorRow('2026-12-01', '222')]);
    expect(rulesOf(world)).not.toContain(RULES.K5);
  });
});

describe('Κ6 — αλλαγή φορέα χωρίς έκδοση', () => {
  it('νέος φορέας χωρίς έκδοση εκείνη τη μέρα ⇒ operator-change-without-version', () => {
    const world = cleanWorld();
    world.operators = operatorsFrom([operatorRow('2026-09-15', '111'), operatorRow('2026-12-01', '222')]);
    expect(rulesOf(world)).toEqual([RULES.K6]);
  });

  it('έκδοση την ίδια μέρα με τον νέο φορέα ⇒ καθαρό', () => {
    const world = cleanWorld();
    world.operators = operatorsFrom([operatorRow('2026-09-15', '111'), operatorRow('2026-12-01', '222')]);
    world.legalByLocale = { el: legal('Κείμενο v2'), en: legal('Κείμενο v2') };
    const row = freezeInto(world.files, { version: 2, effectiveFrom: '2026-12-01', content: 'Κείμενο v2', operators: world.operators });
    world.manifest = { documents: { doc: [...world.manifest.documents.doc, row] } };
    world.expectedIndexText = renderIndex(world.manifest, ['doc']);
    world.indexText = world.expectedIndexText;
    expect(judgeLegalDocuments(world)).toEqual([]);
  });
});

describe('Κ7 — παραγόμενο ευρετήριο', () => {
  it('χειρόγραφη αλλαγή στο ευρετήριο ⇒ index-stale', () => {
    const world = cleanWorld();
    world.indexText = `${world.indexText}// edit\n`;
    expect(rulesOf(world)).toEqual([RULES.K7]);
  });
});

describe('Το αποτύπωμα είναι ντετερμινιστικό', () => {
  it('η σειρά των κλειδιών δεν αλλάζει τα bytes', () => {
    expect(M.stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(M.stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
  });
});
