/**
 * @jest-environment node
 *
 * @fileoverview **ΦΡΟΥΡΟΣ: ΕΝΑ ψεύτικο Firestore, όχι τρίτο** (ADR-742 §7sexdecies).
 *
 * Ως 2026-09-30 υπήρχαν **τρία** in-memory Firestore για tests, γραμμένα ανεξάρτητα, που απέκλιναν σιωπηλά — και δύο
 * από αυτά ήταν τυφλά στην ίδια παγίδα (ADR-890 §17.4). Το CHECK 3.7 **δεν** μπορεί να το φυλάξει: το `exemptPatterns`
 * του `.ssot-registry.json` εξαιρεί `__tests__/` και `.test.` — δηλαδή ακριβώς εκεί όπου γεννιούνται τα fakes.
 *
 * Γι' αυτό φρουρός-άγκυρα: τρέχει στο `jest-suite.yml` (ολόκληρο το jest, ratchet «κάθε νέο κόκκινο μπλοκάρει»).
 *
 * Τι απαγορεύεται έξω από `src/test-utils/fake-firestore/`:
 *   • **κλάση** in-memory Firestore (`class FakeXFirestore`, `MockFirestore…`, `InMemory…Firestore`)·
 *   • εισαγωγή των παλιών διαδρομών.
 * Τι **δεν** απαγορεύεται: stubs `jest.fn()` ανά test (άλλο είδος test double — επαληθεύουν κλήσεις, δεν προσομοιώνουν
 * βάση). Μετρημένα 2026-09-30: 76 αρχεία, στο `pending-ratchet-work.md`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const SSOT_DIR = 'src/test-utils/fake-firestore/';

/** Κλάση που υλοποιεί Firestore — το όνομα είναι η δήλωση πρόθεσης. */
const FAKE_CLASS = /\bclass\s+\w*(?:Fake|Mock|InMemory|Stub)\w*Firestore\w*\b/;
/** Οι παλιές διαδρομές — όποιος τις ξαναζωντανέψει, ξαναγεννά δεύτερο fake. */
const LEGACY_IMPORT = /['"](?:@\/test-utils\/mock-firestore|[^'"]*places\/__tests__\/fake-firestore|[^'"]*oauth\/__tests__\/fake-firestore)['"]/;

/**
 * 🔴 **ΚΛΕΙΣΤΑ ΣΥΝΟΛΑ ΕΚΚΡΕΜΟΤΗΤΩΝ — ΜΟΝΟ ΜΙΚΡΑΙΝΟΥΝ.** Καλούντες που δεν μεταφέρθηκαν στις 2026-09-30 επειδή είχαν
 * **ξένες** αλλαγές σε κοινό working tree (κανόνας: δεν αγγίζεις αρχείο άλλου agent), και τα δύο παλιά fakes που
 * ζουν μόνο για αυτούς. Κάθε γραμμή που πάψει να χρειάζεται **πρέπει** να σβηστεί — το `Φ3` κοκκινίζει σε μπαγιάτικη.
 */
const PENDING_CALLERS: readonly string[] = [
  'src/app/api/files/_shared/__tests__/owned-file-bytes.test.ts',
  'src/services/file-record/__tests__/file-hold-service.test.ts',
  'src/services/file-record/__tests__/file-purge-custody.test.ts',
  'src/server/sharing/__tests__/share-gate-resolve.test.ts',
  'src/server/spatial-tour/__tests__/tour-tileset-baker.test.ts',
];

/** Παλιό fake → το κομμάτι της διαδρομής με το οποίο το εισάγουν οι εκκρεμείς καλούντες. */
const LEGACY_FAKES: Readonly<Record<string, string>> = {
  'src/test-utils/mock-firestore.ts': 'test-utils/mock-firestore',
  'src/services/places/__tests__/fake-firestore.ts': 'places/__tests__/fake-firestore',
};

const EXEMPT = new Set([...PENDING_CALLERS, ...Object.keys(LEGACY_FAKES)]);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

function relative(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

/** Τα αρχεία που παραβιάζουν τον κανόνα, με τον λόγο — ό,τι είναι στο SSoT ή στις εκκρεμότητες μένει έξω. */
function offenders(): string[] {
  return sourceFiles(path.join(ROOT, 'src'))
    .map((file) => ({ rel: relative(file), text: fs.readFileSync(file, 'utf8') }))
    .filter(({ rel }) => !rel.startsWith(SSOT_DIR) && !EXEMPT.has(rel))
    .flatMap(({ rel, text }) => [
      ...(FAKE_CLASS.test(text) ? [`${rel}: κλάση in-memory Firestore — χρησιμοποίησε το ${SSOT_DIR}fake-firestore.ts`] : []),
      ...(LEGACY_IMPORT.test(text) ? [`${rel}: εισαγωγή παλιού fake — πλέον @/test-utils/fake-firestore/fake-firestore`] : []),
    ]);
}

describe('ΕΝΑ ψεύτικο Firestore (ADR-742 §7sexdecies)', () => {
  it('🔑 Φ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ο σαρωτής βλέπει όντως το SSoT (αλλιώς το «0» θα σήμαινε «δεν κοίταξα»)', () => {
    const own = fs.readFileSync(path.join(ROOT, SSOT_DIR, 'fake-firestore.ts'), 'utf8');
    expect(FAKE_CLASS.test(own)).toBe(true);
  });

  it('🔴 Φ1 — κανένα άλλο in-memory Firestore, καμία εισαγωγή παλιού', () => {
    expect(offenders()).toEqual([]);
  });

  it('Φ2 — ο κανόνας πιάνει ό,τι πρέπει και αφήνει ό,τι πρέπει (μαρτυρίες)', () => {
    expect(FAKE_CLASS.test('export class FakeFirestore {')).toBe(true);
    expect(FAKE_CLASS.test('class InMemoryFirestoreStub {')).toBe(true);
    expect(FAKE_CLASS.test('class MockFirestoreKit {')).toBe(true);
    expect(FAKE_CLASS.test("const db = { collection: jest.fn() };")).toBe(false);
    expect(FAKE_CLASS.test('class FirestoreQueryService {')).toBe(false);
    expect(LEGACY_IMPORT.test("import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';")).toBe(true);
    expect(LEGACY_IMPORT.test("import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';")).toBe(false);
  });

  it('🔴 Φ3 — οι εκκρεμότητες είναι ΖΩΝΤΑΝΕΣ: ο καλών εισάγει ακόμη παλιό fake· το παλιό fake έχει ακόμη καλούντα', () => {
    const read = (rel: string): string | null => (fs.existsSync(path.join(ROOT, rel)) ? fs.readFileSync(path.join(ROOT, rel), 'utf8') : null);
    const staleCallers = PENDING_CALLERS.filter((rel) => !LEGACY_IMPORT.test(read(rel) ?? ''));
    const staleFakes = Object.entries(LEGACY_FAKES)
      .filter(([rel, specifier]) => read(rel) === null || !PENDING_CALLERS.some((caller) => (read(caller) ?? '').includes(specifier)))
      .map(([rel]) => rel);
    expect([...staleCallers, ...staleFakes]).toEqual([]);
  });
});
