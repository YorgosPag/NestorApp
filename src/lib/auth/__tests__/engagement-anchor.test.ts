/**
 * ADR-862 Φ1 — άγκυρες της συμμετοχής σε υπόθεση (κριτής · γραφέας · αναγνώστης).
 *
 * Κάθε `it` ονομάζει την άγκυρα του ADR-862 §7 που φυλάει και τη μετάλλαξη που πρέπει να κοκκινίσει.
 * Η βάση είναι το ΕΝΑ verified fake (`test-utils/fake-firestore`) — οι **κανόνες** δοκιμάζονται στον emulator.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { decideEngagement } from '../engagement-judge';
import { selectCurrentEngagement } from '../engagement-read';
import {
  closeEngagementsForSubject,
  offerEngagement,
  planTransition,
  transitionEngagement,
  type EngagementOfferRequest,
} from '../engagement-write';
import { parseEngagement } from '../engagement-schema';
import {
  ENGAGEMENT_SUBJECT_KINDS,
  ROLES_OF_SUBJECT,
  SCOPE_OF_SUBJECT,
  TEMPLATE_OF_SUBJECT,
  type ConveyanceEngagement,
  type ConveyanceEngagementSubject,
  type DeclaredCredential,
  type Engagement,
  type EngagementSubject,
  type IssuanceEngagement,
  type IssuanceEngagementSubject,
} from '@/types/engagement';
import { personalWorkspace } from '@/types/workspace-membership';

jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }) }));

// ─── Ο κριτής εγγραφής της Α2 — AST, με τα ΚΟΙΝΑ εργαλεία των πυλών «ενός γραφέα» ──────────────────────────────
const { ts, sourceFileOf, walk, calleeName, lineOf } = require('../../../../scripts/lib/write-authority/ast') as {
  readonly ts: typeof import('typescript');
  readonly sourceFileOf: (absPath: string, text: string) => import('typescript').SourceFile;
  readonly walk: (node: import('typescript').Node, visit: (node: import('typescript').Node) => void) => void;
  readonly calleeName: (call: import('typescript').CallExpression) => string | null;
  readonly lineOf: (sf: import('typescript').SourceFile, node: import('typescript').Node) => number;
};
type TsNode = import('typescript').Node;
type TsExpression = import('typescript').Expression;

const ENGAGEMENT_REF_FILE = 'src/lib/auth/engagement-ref.ts';
/** Οι γεννήτορες ref συμμετοχής του `engagement-ref.ts`. */
const REF_BUILDERS = /^(engagementRef|engagementDocOf|engagementsCollection(Of)?|dossierEngagementsCollection)$/;
const REF_BUILDER_MENTION = /\b(engagementRef|engagementDocOf|engagementsCollection(Of)?|dossierEngagementsCollection)\(/;
const WRITE_METHODS = new Set(['set', 'update', 'create', 'delete']);

/** Δείχνει η έκφραση σε ref συμμετοχής; (γεννήτορας · `.doc()` πάνω του · τριαδικός · μεταβλητή που τον κρατά) */
function isEngagementRef(expression: TsExpression | undefined, refs: ReadonlySet<string>): boolean {
  if (!expression) return false;
  if (ts.isParenthesizedExpression(expression)) return isEngagementRef(expression.expression, refs);
  if (ts.isConditionalExpression(expression)) {
    return isEngagementRef(expression.whenTrue, refs) || isEngagementRef(expression.whenFalse, refs);
  }
  if (ts.isIdentifier(expression)) return refs.has(expression.text);
  if (!ts.isCallExpression(expression)) return false;
  const name = calleeName(expression);
  if (name !== null && REF_BUILDERS.test(name)) return true;
  return name === 'doc' && ts.isPropertyAccessExpression(expression.expression)
    && isEngagementRef(expression.expression.expression, refs);
}

/** Οι γραμμές όπου το αρχείο ΓΡΑΦΕΙ έγγραφο συμμετοχής. */
function engagementWritesOf(file: string, text: string): readonly number[] {
  const sf = sourceFileOf(file, text);
  const refs = new Set<string>();
  const lines: number[] = [];
  walk(sf, (node: TsNode) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && isEngagementRef(node.initializer, refs)) {
      refs.add(node.name.text);
    }
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
    if (!WRITE_METHODS.has(node.expression.name.text)) return;
    if (isEngagementRef(node.arguments[0], refs) || isEngagementRef(node.expression.expression, refs)) {
      lines.push(lineOf(sf, node));
    }
  });
  return lines;
}

const NOW = Date.parse('2026-10-03T10:00:00.000Z');
/** ADR-901 §14.8 — το σήμα όψεων είναι υποχρεωτικό· εδώ καταγράφεται (οι άγκυρες σήματος ζουν στο τέλος). */
const signal = jest.fn();
const DAY = 24 * 60 * 60 * 1000;
const CASE_A: ConveyanceEngagementSubject = { kind: 'conveyance_case', caseId: 'cvc_A' };
const CASE_B: ConveyanceEngagementSubject = { kind: 'conveyance_case', caseId: 'cvc_B' };
const CREDENTIAL: DeclaredCredential = { authority: 'notary-association', number: '4321', chapter: 'Αθηνών', assurance: 'declared', declaredAt: new Date(NOW).toISOString() };

function engagement(overrides: Partial<ConveyanceEngagement> = {}): ConveyanceEngagement {
  return {
    id: 'eng_1', hostCompanyId: 'comp_host', projectId: 'proj_1', uid: 'u_notary', email: 'n@example.gr',
    template: 'legal', role: 'notary', subject: CASE_A, scopes: ['conveyance:case:view'], state: 'active',
    expiresAt: new Date(NOW + 30 * DAY).toISOString(),
    origin: { kind: 'professional_appointment', contactId: 'cont_1' }, consents: [],
    offeredBy: 'u_host', offeredAt: new Date(NOW - DAY).toISOString(), respondedAt: null,
    revokedBy: null, closedAt: null, updatedAt: new Date(NOW - DAY).toISOString(),
    ...overrides,
  };
}

/** ADR-901 §15 — ο χώρος της αποδοχής στις άγκυρες της Φ1: ο προσωπικός του ίδιου (κανένα γραφείο). */
const OWN_SPACE = personalWorkspace('u_notary');

const ask = (e: Engagement | null, subject: EngagementSubject = CASE_A, uid = 'u_notary') =>
  decideEngagement({ engagement: e, uid, subject, scope: 'conveyance:case:view', nowMs: NOW }).verdict;

describe('ADR-862 Φ1 — ο κριτής (`decideEngagement`)', () => {
  it('Α1 — ο συμβολαιογράφος του διαμερίσματος Α ΔΕΝ βλέπει το Β του ίδιου έργου', () => {
    expect(ask(engagement(), CASE_A)).toBe('engaged');
    expect(ask(engagement(), CASE_B)).toBe('not-engaged');
  });

  it('Α1 — η συμμετοχή του Χ δεν ανοίγει τίποτα στον Ψ', () => {
    expect(ask(engagement(), CASE_A, 'u_other')).toBe('not-engaged');
  });

  it('Α3/Α4 — ληγμένη ≠ ανακληθείσα, και η καθεμία με ΔΙΚΟ της όνομα', () => {
    expect(ask(engagement({ expiresAt: new Date(NOW - 1).toISOString() }))).toBe('expired');
    expect(ask(engagement({ revokedAt: new Date(NOW - 1).toISOString() }))).toBe('revoked');
    expect(ask(engagement({ state: 'revoked', revokedAt: new Date(NOW).toISOString() }))).toBe('revoked');
  });

  it('Α3 — η λήξη κρίνεται και ΧΩΡΙΣ εργασία λήξης: ενεργή κατάσταση με περασμένη ημερομηνία ⇒ άρνηση', () => {
    expect(ask(engagement({ state: 'active', expiresAt: new Date(NOW - DAY).toISOString() }))).toBe('expired');
  });

  it('fail-closed — άκυρη ημερομηνία λήξης ⇒ άρνηση με δικό της όνομα, ποτέ «δεν λήγει»', () => {
    expect(ask(engagement({ expiresAt: 'not-a-date' }))).toBe('unreadable-expiry');
  });

  it('Entra — πρόταση ΧΩΡΙΣ αποδοχή ⇒ καμία πρόσβαση', () => {
    expect(ask(engagement({ state: 'offered' }))).toBe('offered');
    expect(ask(engagement({ state: 'declined' }))).toBe('declined');
    expect(ask(engagement({ state: 'completed' }))).toBe('completed');
  });
});

describe('ADR-862 Φ1 — οι μεταβάσεις (`planTransition`, καθαρές)', () => {
  const offered = engagement({ state: 'offered', expiresAt: new Date(NOW + DAY).toISOString() });

  it('αποδέχεται ΜΟΝΟ ο ίδιος — ο οικοδεσπότης δεν «αναλαμβάνει» για λογαριασμό του', () => {
    expect(planTransition(offered, { kind: 'accept', byUid: 'u_host', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW).outcome).toBe('not-allowed');
  });

  it('αποδοχή ⇒ active με ΠΑΡΑΓΟΜΕΝΟ ταβάνι λήξης', () => {
    const planned = planTransition(offered, { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW);
    expect(planned.outcome).toBe('changed');
    if (planned.outcome !== 'changed') return;
    expect(planned.after.state).toBe('active');
    expect(Date.parse(planned.after.expiresAt)).toBeGreaterThan(NOW + 300 * DAY);
  });

  it('Α17 (ADR-901 Φ4) — η αποδοχή ΓΡΑΦΕΙ τη δήλωση ιδιότητας στη συμμετοχή· η άρνηση όχι', () => {
    // Μετάλλαξη: ο γραφέας πετά το `declaredCredential` της αποδοχής ⇒ ενεργή συμμετοχή χωρίς δήλωση.
    const planned = planTransition(offered, { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW);
    expect(planned.outcome === 'changed' && planned.after.declaredCredential).toEqual(CREDENTIAL);
    const declined = planTransition(offered, { kind: 'decline', byUid: 'u_notary' }, NOW);
    expect(declined.outcome === 'changed' && declined.after.declaredCredential).toBeUndefined();
  });

  it('ληγμένη πρόταση ⇒ `offer-expired` και κατάσταση `expired` — ποτέ σιωπηλή αποδοχή', () => {
    const stale = engagement({ state: 'offered', expiresAt: new Date(NOW - 1).toISOString() });
    const planned = planTransition(stale, { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW);
    expect(planned.outcome).toBe('offer-expired');
    const corrupt = engagement({ state: 'offered', expiresAt: 'garbage' });
    expect(planTransition(corrupt, { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW).outcome).toBe('offer-expired');
  });

  it('Α4/Α5 — ανάκληση ενεργής ⇒ `revoked` + `revokedAt` (κατάσταση, όχι διαγραφή)· πρόταση ⇒ `withdrawn`', () => {
    const revoked = planTransition(engagement(), { kind: 'end', byUid: 'u_host' }, NOW);
    expect(revoked.outcome === 'changed' && revoked.after.state).toBe('revoked');
    expect(revoked.outcome === 'changed' && revoked.after.revokedAt).toBe(new Date(NOW).toISOString());
    const withdrawn = planTransition(offered, { kind: 'end', byUid: 'u_host' }, NOW);
    expect(withdrawn.outcome === 'changed' && withdrawn.after.state).toBe('withdrawn');
  });

  it('ιδεμποτησία — αποδοχή ήδη ενεργής ⇒ noop', () => {
    expect(planTransition(engagement(), { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW).outcome).toBe('noop');
  });
});

describe('ADR-862 Φ1 — ο γραφέας πάνω σε βάση (fake Firestore)', () => {
  let fake: FakeFirestore;
  const db = (): AdminFirestore => fake as unknown as AdminFirestore;
  type CaseOfferRequest = Extract<EngagementOfferRequest, { readonly subject: ConveyanceEngagementSubject }>;
  const request = (overrides: Partial<CaseOfferRequest> = {}): CaseOfferRequest => ({
    hostCompanyId: 'comp_host', projectId: 'proj_1', uid: 'u_notary', email: 'n@example.gr',
    role: 'notary', subject: CASE_A, origin: { kind: 'professional_appointment', contactId: 'cont_1' },
    consents: [], offeredBy: 'u_host', nowMs: NOW, ...overrides,
  });
  const docs = () => fake.collection('companies/comp_host/projects/proj_1/engagements').get();

  beforeEach(() => { fake = new FakeFirestore(); });

  it('N.7.2 #3 — δεύτερη πρόταση στον ίδιο = ίδιο έγγραφο (καμία δεύτερη εγγραφή)', async () => {
    const first = await offerEngagement(db(), request(), signal);
    const second = await offerEngagement(db(), request(), signal);
    expect(first.outcome).toBe('offered');
    expect(second.outcome).toBe('already-live');
    expect((await docs()).size).toBe(1);
  });

  it('ADR-901 §5.2 — η θέση έχει ΕΝΑΝ: δεύτερος συμβολαιογράφος ⇒ `slot-occupied`', async () => {
    await offerEngagement(db(), request(), signal);
    expect((await offerEngagement(db(), request({ uid: 'u_other' }), signal)).outcome).toBe('slot-occupied');
  });

  it('ο ίδιος άνθρωπος δεν παίρνει δύο θέσεις (δικηγόρος ΚΑΙ συμβολαιογράφος) ⇒ `role-conflict`', async () => {
    await offerEngagement(db(), request(), signal);
    expect((await offerEngagement(db(), request({ role: 'buyer_lawyer' }), signal)).outcome).toBe('role-conflict');
  });

  it('Α1 — ο ίδιος συμβολαιογράφος σε ΔΥΟ υποθέσεις του ίδιου έργου = ΔΥΟ συμμετοχές (γι\' αυτό κλειδί ≠ uid)', async () => {
    await offerEngagement(db(), request(), signal);
    expect((await offerEngagement(db(), request({ subject: CASE_B }), signal)).outcome).toBe('offered');
    expect((await docs()).size).toBe(2);
  });

  it('Α5 — ανάκληση + νέα πρόταση ⇒ η ιστορία ΜΕΝΕΙ (δύο έγγραφα)', async () => {
    const first = await offerEngagement(db(), request(), signal);
    if (first.outcome !== 'offered') throw new Error('setup');
    const key = { hostCompanyId: 'comp_host', projectId: 'proj_1', engagementId: first.engagement.id };
    await transitionEngagement(db(), key, { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW, signal);
    await transitionEngagement(db(), key, { kind: 'end', byUid: 'u_host' }, NOW + 1, signal);
    expect((await offerEngagement(db(), request({ nowMs: NOW + 2 }), signal)).outcome).toBe('offered');
    const states = (await docs()).docs.map((d) => d.data().state).sort();
    expect(states).toEqual(['offered', 'revoked']);
  });

  it('κλείσιμο υπόθεσης ⇒ ενεργή `completed`, πρόταση `withdrawn` — ιδεμποτές', async () => {
    const a = await offerEngagement(db(), request(), signal);
    await offerEngagement(db(), request({ uid: 'u_lawyer', role: 'seller_lawyer' }), signal);
    if (a.outcome !== 'offered') throw new Error('setup');
    await transitionEngagement(db(), { hostCompanyId: 'comp_host', projectId: 'proj_1', engagementId: a.engagement.id }, { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW, signal);
    const key = { hostCompanyId: 'comp_host', projectId: 'proj_1' };
    expect((await closeEngagementsForSubject(db(), key, CASE_A, 'u_host', NOW, signal)).map((e) => e.state).sort()).toEqual(['completed', 'withdrawn']);
    expect(await closeEngagementsForSubject(db(), key, CASE_A, 'u_host', NOW, signal)).toHaveLength(0);
  });

  it('Α36 (§14.8) — ΚΑΘΕ γραφή σημαίνει τις όψεις με τη λίστα ΜΕΤΑ· κανένα no-op δεν σημαίνει', async () => {
    signal.mockClear();
    const offered = await offerEngagement(db(), request(), signal);
    if (offered.outcome !== 'offered') throw new Error('setup');
    expect(signal).toHaveBeenLastCalledWith(expect.anything(), { live: [offered.engagement], changed: [offered.engagement] });
    await offerEngagement(db(), request(), signal); // already-live ⇒ καμία γραφή ⇒ κανένα σήμα
    expect(signal).toHaveBeenCalledTimes(1);

    const key = { hostCompanyId: 'comp_host', projectId: 'proj_1', engagementId: offered.engagement.id };
    const accepted = await transitionEngagement(db(), key, { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW, signal);
    if (accepted.outcome !== 'changed') throw new Error('setup');
    expect(signal).toHaveBeenLastCalledWith(expect.anything(), { live: [accepted.after], changed: [accepted.after] });
    await transitionEngagement(db(), key, { kind: 'accept', byUid: 'u_notary', declaredCredential: CREDENTIAL, actingFor: OWN_SPACE }, NOW, signal); // noop
    expect(signal).toHaveBeenCalledTimes(2);

    const ended = await transitionEngagement(db(), key, { kind: 'end', byUid: 'u_host' }, NOW + 1, signal);
    if (ended.outcome !== 'changed') throw new Error('setup');
    // Η ανακληθείσα ΔΕΝ είναι πια ζωντανή — αλλά είναι στις αλλαγμένες (η δική της όψη πρέπει να μάθει την άρνηση).
    expect(signal).toHaveBeenLastCalledWith(expect.anything(), { live: [], changed: [ended.after] });
    await closeEngagementsForSubject(db(), { hostCompanyId: 'comp_host', projectId: 'proj_1' }, CASE_A, 'u_host', NOW, signal);
    expect(signal).toHaveBeenCalledTimes(3);
  });

  it('αναγνώστης — δύο ζωντανές για το ίδιο ζεύγος ⇒ ΔΕΝ διαλέγουμε (fail-closed)', () => {
    const picked = selectCurrentEngagement([engagement({ id: 'eng_1' }), engagement({ id: 'eng_2', state: 'offered' })]);
    expect(picked).toEqual({ engagement: null, ambiguous: true });
  });
});

describe('ADR-862 §5.3.10 — δεύτερο είδος υπόθεσης (ανάθεση έκδοσης)', () => {
  const ISSUANCE: IssuanceEngagementSubject = { kind: 'document_issuance', assignmentId: 'cvc_A' };
  const issuance = (overrides: Partial<IssuanceEngagement> = {}): IssuanceEngagement => ({
    ...engagement(),
    template: 'issuer', role: 'document_issuer', subject: ISSUANCE, scopes: ['issuance:assignment:collaborate'],
    ...overrides,
  });

  it('σχήμα — έγκυρη ανάθεση έκδοσης διαβάζεται· η μεταβίβαση διαβάζεται ΑΚΡΙΒΩΣ όπως πριν', () => {
    expect(parseEngagement(issuance())).toEqual(issuance());
    expect(parseEngagement(engagement())).toEqual(engagement());
  });

  it('σχήμα — ανάμειξη ειδών ⇒ μη αναγνώσιμο (fail-closed), ποτέ «περίπου»', () => {
    // Μετάλλαξη: το σχήμα δέχεται οποιονδήποτε ρόλο/πρότυπο/εύρος για οποιοδήποτε είδος.
    expect(parseEngagement({ ...issuance(), role: 'notary' })).toBeNull();
    expect(parseEngagement({ ...engagement(), role: 'document_issuer' })).toBeNull();
    expect(parseEngagement({ ...engagement(), template: 'issuer' })).toBeNull();
    expect(parseEngagement({ ...issuance(), template: 'legal' })).toBeNull();
    expect(parseEngagement({ ...issuance(), scopes: ['conveyance:case:view'] })).toBeNull();
    expect(parseEngagement({ ...issuance(), subject: { kind: 'document_issuance', caseId: 'cvc_A' } })).toBeNull();
  });

  it('σχήμα — εθνική αρχή (ΥΠΕΝ) ΧΩΡΙΣ σύλλογο· με σύλλογο ⇒ μη αναγνώσιμο', () => {
    const ypen: DeclaredCredential = { authority: 'ypen', number: '12345', chapter: null, assurance: 'declared', declaredAt: new Date(NOW).toISOString() };
    expect(parseEngagement(issuance({ declaredCredential: ypen }))).not.toBeNull();
    expect(parseEngagement(issuance({ declaredCredential: { ...ypen, chapter: 'Αθηνών' } }))).toBeNull();
  });

  it('κριτής — ίδιο id σε ΑΛΛΟ είδος υπόθεσης ⇒ `not-engaged`· εύρος άλλου είδους ⇒ `scope-missing`', () => {
    // Μετάλλαξη: η σύγκριση υπόθεσης κοιτά μόνο το id (εδώ και τα δύο `cvc_A`).
    expect(ask(issuance(), CASE_A)).toBe('not-engaged');
    expect(decideEngagement({ engagement: issuance(), uid: 'u_notary', subject: ISSUANCE, scope: 'issuance:assignment:collaborate', nowMs: NOW }).verdict).toBe('engaged');
    expect(decideEngagement({ engagement: issuance(), uid: 'u_notary', subject: ISSUANCE, scope: 'conveyance:case:view', nowMs: NOW }).verdict).toBe('scope-missing');
  });

  it('γραφέας — πρότυπο και εύρος ΠΑΡΑΓΟΝΤΑΙ από το είδος· τα δύο είδη δεν βλέπουν το ένα το άλλο', async () => {
    const fake = new FakeFirestore();
    const db = fake as unknown as AdminFirestore;
    const base = {
      hostCompanyId: 'comp_host', projectId: 'proj_1', uid: 'u_notary', email: 'n@example.gr',
      origin: { kind: 'professional_appointment', contactId: 'cont_1' }, consents: [], offeredBy: 'u_host', nowMs: NOW,
    } as const;
    const legal = await offerEngagement(db, { ...base, role: 'notary', subject: CASE_A }, signal);
    // Ίδιος άνθρωπος, ίδιο έργο, ίδιο id — αλλά ΑΛΛΟ είδος ⇒ νέα συμμετοχή, όχι `role-conflict`/`already-live`.
    const issued = await offerEngagement(db, { ...base, role: 'document_issuer', subject: ISSUANCE }, signal);
    expect(legal.outcome === 'offered' && [legal.engagement.template, legal.engagement.scopes]).toEqual(['legal', ['conveyance:case:view']]);
    expect(issued.outcome === 'offered' && [issued.engagement.template, issued.engagement.scopes]).toEqual(['issuer', ['issuance:assignment:collaborate']]);
  });

  it('ολικότητα — κάθε είδος έχει εύρος, ρόλους και πρότυπο', () => {
    for (const kind of ENGAGEMENT_SUBJECT_KINDS) {
      expect(SCOPE_OF_SUBJECT[kind]).toBeTruthy();
      expect(ROLES_OF_SUBJECT[kind].length).toBeGreaterThan(0);
      expect(TEMPLATE_OF_SUBJECT[kind]).toBeTruthy();
    }
  });
});

describe('ADR-862 Φ1 — δομικές άγκυρες (Α2 · Α6)', () => {
  const SRC = join(process.cwd(), 'src');
  const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : files(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
  const rel = (f: string) => relative(process.cwd(), f).replace(/\\/g, '/');
  const all = files(SRC);

  it('Α2 — το μονοπάτι `engagements` χτίζεται ΜΟΝΟ στο `engagement-ref.ts`', () => {
    const builders = all.filter((f) => readFileSync(f, 'utf8').includes('SUBCOLLECTIONS.PROJECT_ENGAGEMENTS')).map(rel);
    expect(builders).toEqual(['src/lib/auth/engagement-ref.ts']);
  });

  /**
   * 🔴 **ΚΡΙΝΕΤΑΙ Η ΕΓΓΡΑΦΗ, ΟΧΙ Η ΑΝΑΦΟΡΑ** (ADR-783 Ε2). Η πρώτη γραφή ρωτούσε «αναφέρει `engagementRef(`;» ⇒
   * κατήγγελλε την **ανάγνωση** `tx.get(engagementRef(…))` και ήταν **τυφλή** σε εγγραφή μέσω `engagementDocOf` ·
   * `dossierEngagementsCollection(…).doc()`. Τώρα: AST, κλήση `set/update/create/delete` (και `tx.`/`batch.`) με
   * όρισμα ή δέκτη ref συμμετοχής — ίδιο ιδίωμα με τις πύλες 3.87/3.88/3.89/3.102 (`scripts/lib/write-authority/ast.js`).
   */
  it('Α2 — έγγραφο συμμετοχής ΓΡΑΦΕΙ μόνο ο ΕΝΑΣ γραφέας (και ο γραφέας βρίσκεται)', () => {
    const candidates = all.filter((f) => rel(f) !== ENGAGEMENT_REF_FILE && REF_BUILDER_MENTION.test(readFileSync(f, 'utf8')));
    const writes = candidates.flatMap((f) => engagementWritesOf(f, readFileSync(f, 'utf8')).map((line) => `${rel(f)}:${line}`));
    const writers = [...new Set(writes.map((w) => w.replace(/:\d+$/, '')))];
    expect(writers).toEqual(['src/lib/auth/engagement-write.ts']);
    // Παρονομαστής: ο γραφέας γράφει με create/set σε ≥ 4 σημεία — αλλιώς ο κριτής δεν κοίταξε.
    expect(writes.length).toBeGreaterThanOrEqual(4);
  });

  it('Α2 μετάλλαξη — ανάγνωση ≠ εγγραφή · εγγραφή μέσω κάθε γεννήτορα ref ⇒ κόκκινο', () => {
    const judge = (body: string) => engagementWritesOf('fixture.ts', `async function f(tx, db, key, e, id) {\n${body}\n}`).length;
    expect(judge('await tx.get(engagementRef(db, key));')).toBe(0);
    expect(judge('await engagementsCollection(db, "c", "p").where("uid", "==", "u").get();')).toBe(0);
    expect(judge('tx.set(engagementDocOf(db, e), e);')).toBe(1);
    expect(judge('batch.update(engagementRef(db, key), { state: "x" });')).toBe(1);
    expect(judge('await dossierEngagementsCollection(db, id).doc("x").update({});')).toBe(1);
    expect(judge('const ref = c ? dossierEngagementsCollection(db, id).doc(k) : engagementRef(db, key);\nawait ref.delete();')).toBe(1);
    expect(judge('tx.create(engagementsCollectionOf(db, home).doc(e.id), e);')).toBe(1);
  });

  it('Α6 — ο γραφέας ΔΕΝ αγγίζει claims', () => {
    const source = readFileSync(join(SRC, 'lib/auth/engagement-write.ts'), 'utf8');
    expect(source).not.toMatch(/setCustomUserClaims|set-claims-with-mirror|claims-handler/);
  });
});
