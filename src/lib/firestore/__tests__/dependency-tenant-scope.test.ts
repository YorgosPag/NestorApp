/**
 * ⚓ ADR-742 §7novies — **ο κανόνας του μητρώου εφαρμόζεται ΜΙΑ φορά**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΦΥΛΑΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Δύο μηχανές (`contact-impact-engine`, `deletion-guard`/`deletion-link-guard`)
 * διαβάζουν τους ίδιους καταλόγους εξαρτήσεων και εφάρμοζαν τη δήλωση
 * `skipCompanyFilter` **η καθεμιά μόνη της**, σε **έξι** σημεία. Μέχρι τις
 * 2026-08-01 τα έξι αντίγραφα είχαν ήδη αποκλίνει σε **δύο δόγματα**, και το πιο
 * χαλαρό άφηνε το φίλτρο μισθωτή να μην μπει **ποτέ** (§7octies).
 *
 * Αυτό το αρχείο ελέγχει **τρία διαφορετικά πράγματα**, γιατί το καθένα μπορεί
 * να σπάσει χωρίς το άλλο:
 *
 * | # | ερώτηση | γιατί χωριστά |
 * |---|---|---|
 * | Α | ο κανόνας είναι **σωστός**; | ο SSoT μόνος του |
 * | Β | οι **έξι** εκτελεστές τον **καλούν**; | ένας σωστός SSoT που δεν καλείται δεν φυλάει τίποτα (μάθημα Ομάδας 4: «κάλυψη σε νεκρό δίδυμο δεν είναι κάλυψη») |
 * | Γ | υπάρχει **έβδομο** αντίγραφο; | η δομή, όχι η στιγμιαία απόκλιση |
 *
 * @module lib/firestore/__tests__/dependency-tenant-scope
 * @see ADR-742 §3.2, §7octies, §7novies
 */

jest.mock('server-only', () => ({}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

/**
 * ⚠️ Το `@/lib/api/ApiErrorHandler` εισάγει `next/server` και η σουίτα σπάει με
 * `ReferenceError: Request is not defined` — η **ίδια** παγίδα που ανάγκασε την
 * Ομάδα 4 να ξεχωρίσει το `contact-not-found-response.ts` (§7octies.4). Το
 * υποκατάστατο κρατά την υπογραφή· κανένα test εδώ δεν διασχίζει κλάδο ρίψης
 * (οι εξαρτήσεις επιστρέφουν κενές), οπότε δεν υποκαθιστά συμπεριφορά υπό έλεγχο.
 */
jest.mock('@/lib/api/ApiErrorHandler', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      readonly statusCode: number,
      message: string,
      readonly code?: string,
    ) {
      super(message);
    }
  },
}));

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => undefined) },
}));

jest.mock('../deletion-storage-cleanup', () => ({
  executeStorageCleanup: jest.fn(async () => ({ totalDeleted: 0, details: [] })),
}));

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { FIELDS } from '@/config/firestore-field-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { tenantScopedDependencyQuery } from '../dependency-tenant-scope';
import { checkDeletionDependencies, executeDeletion } from '../deletion-guard';
import { checkLinkRemovalDependencies } from '../deletion-link-guard';

const TENANT = 'comp_owner';

// ============================================================================
// ΤΟ ΨΕΥΤΙΚΟ FIRESTORE — καταγράφει **ποια ερώτηση διατυπώθηκε**
// ============================================================================

interface WhereCall {
  readonly field: string;
  readonly op: string;
  readonly value: unknown;
}

/** Ένα άνοιγμα συλλογής μαζί με όλα τα `where` που κρεμάστηκαν πάνω του. */
interface OpenedQuery {
  readonly source: 'collection' | 'collectionGroup';
  readonly path: string;
  readonly wheres: WhereCall[];
}

interface FakeQuery {
  where(field: string, op: string, value: unknown): FakeQuery;
  select(): FakeQuery;
  limit(n: number): FakeQuery;
  get(): Promise<{ size: number; empty: boolean; docs: never[] }>;
  doc(id: string): FakeDocRef;
}

interface FakeDocRef {
  get(): Promise<{ exists: boolean; data: () => Record<string, unknown> }>;
  delete(): Promise<void>;
  collection(path: string): FakeQuery;
}

interface FakeDb {
  readonly opened: OpenedQuery[];
  collection(path: string): FakeQuery;
  collectionGroup(path: string): FakeQuery;
}

function makeDb(): FakeDb {
  const opened: OpenedQuery[] = [];

  const makeQuery = (record: OpenedQuery): FakeQuery => ({
    where(field, op, value) {
      record.wheres.push({ field, op, value });
      return makeQuery(record);
    },
    select: () => makeQuery(record),
    limit: () => makeQuery(record),
    get: async () => ({ size: 0, empty: true, docs: [] }),
    doc: () => makeDocRef(),
  });

  const makeDocRef = (): FakeDocRef => ({
    get: async () => ({ exists: true, data: () => ({}) }),
    delete: async () => undefined,
    collection: (path: string) => open('collection', path),
  });

  const open = (source: OpenedQuery['source'], path: string): FakeQuery => {
    const record: OpenedQuery = { source, path, wheres: [] };
    opened.push(record);
    return makeQuery(record);
  };

  return {
    opened,
    collection: (path) => open('collection', path),
    collectionGroup: (path) => open('collectionGroup', path),
  };
}

/** Το Firestore type δεν κατασκευάζεται σε unit test· ο ψεύτης είναι δομικά συμβατός. */
function asFirestore(db: FakeDb): FirebaseFirestore.Firestore {
  return db as unknown as FirebaseFirestore.Firestore;
}

const tenantFilters = (q: OpenedQuery): WhereCall[] =>
  q.wheres.filter((w) => w.field === FIELDS.COMPANY_ID);

const openedFor = (db: FakeDb, path: string): OpenedQuery[] =>
  db.opened.filter((q) => q.path === path);

// ============================================================================
// Α. Ο ΚΑΝΟΝΑΣ
// ============================================================================

describe('Α. tenantScopedDependencyQuery — ο κανόνας του μητρώου', () => {
  it('εξάρτηση ΧΩΡΙΣ `skipCompanyFilter` ⇒ η συλλογή ανοίγει ήδη φιλτραρισμένη', () => {
    const db = makeDb();

    tenantScopedDependencyQuery(asFirestore(db), 'opportunities', {}, TENANT);

    expect(db.opened).toHaveLength(1);
    expect(db.opened[0]?.source).toBe('collection');
    expect(db.opened[0]?.path).toBe('opportunities');
    expect(db.opened[0]?.wheres).toEqual([
      { field: FIELDS.COMPANY_ID, op: '==', value: TENANT },
    ]);
  });

  it('`skipCompanyFilter: false` είναι το ίδιο με απόν — δεν είναι τρίτη κατάσταση', () => {
    const db = makeDb();

    tenantScopedDependencyQuery(asFirestore(db), 'opportunities', { skipCompanyFilter: false }, TENANT);

    expect(tenantFilters(db.opened[0] as OpenedQuery)).toHaveLength(1);
  });

  /**
   * 🔴 ΜΕΤΑΛΛΑΞΗ (α): «το `skipCompanyFilter` αγνοείται».
   *
   * Δεν είναι υπερβολική αυστηρότητα — είναι **λάθος αποτέλεσμα**: φιλτράροντας
   * σε πεδίο που η συλλογή δεν φέρει, το Firestore επιστρέφει **μηδέν** έγγραφα
   * και ο φύλακας διαγραφής λέει ψευδώς «καμία εξάρτηση».
   */
  it('🔴 `skipCompanyFilter: true` ⇒ ΚΑΝΕΝΑ φίλτρο μισθωτή (η συλλογή δεν φέρει το πεδίο)', () => {
    const db = makeDb();

    tenantScopedDependencyQuery(asFirestore(db), 'accounting_invoices', { skipCompanyFilter: true }, TENANT);

    expect(db.opened[0]?.wheres).toEqual([]);
  });

  it('`useCollectionGroup` ανοίγει collectionGroup — και το φίλτρο ισχύει κανονικά', () => {
    const db = makeDb();

    tenantScopedDependencyQuery(asFirestore(db), 'items', { useCollectionGroup: true }, TENANT);

    expect(db.opened[0]?.source).toBe('collectionGroup');
    expect(db.opened[0]?.path).toBe('items');
    expect(tenantFilters(db.opened[0] as OpenedQuery)).toHaveLength(1);
  });

  it('οι δύο σημαίες είναι ανεξάρτητες: collectionGroup + skip ⇒ αφιλτράριστο group', () => {
    const db = makeDb();

    tenantScopedDependencyQuery(
      asFirestore(db),
      'items',
      { useCollectionGroup: true, skipCompanyFilter: true },
      TENANT,
    );

    expect(db.opened[0]?.source).toBe('collectionGroup');
    expect(db.opened[0]?.wheres).toEqual([]);
  });

  /**
   * 🔴🔴 ΜΕΤΑΛΛΑΞΗ (β): επαναφορά του `&& companyId`.
   *
   * Η **μόνη** είσοδος που ξεχωρίζει τις δύο εκδοχές. Με υπαρκτό tenant και οι
   * δύο περνούν — αυτό ακριβώς άφησε τη μετάλλαξη να επιβιώσει στην πρώτη γραφή
   * του `contact-impact-engine-tenant.test.ts` (§7octies).
   *
   * Το κενό δεν είναι tenant, είναι **απουσία** tenant (§4): το σωστό είναι να
   * μπει `where(companyId, '==', '')` και η ερώτηση να αποτύχει **κλειστά**, όχι
   * να εξαφανιστεί ο περιορισμός και να διαβαστούν όλοι οι πελάτες.
   */
  it('🔴🔴 ΚΕΝΟ companyId δεν ακυρώνει το φίλτρο — αποτυγχάνει ΚΛΕΙΣΤΑ', () => {
    const db = makeDb();

    tenantScopedDependencyQuery(asFirestore(db), 'opportunities', {}, '');

    expect(db.opened[0]?.wheres).toEqual([{ field: FIELDS.COMPANY_ID, op: '==', value: '' }]);
  });

  /** 🔴 ΜΕΤΑΛΛΑΞΗ (δ): καρφωμένος tenant. */
  it('🔴 ο μισθωτής στο σύρμα είναι ΑΥΤΟΣ που δόθηκε', () => {
    const db = makeDb();

    tenantScopedDependencyQuery(asFirestore(db), 'opportunities', {}, 'another_tenant');

    expect(tenantFilters(db.opened[0] as OpenedQuery).map((w) => w.value)).toEqual(['another_tenant']);
  });

  /**
   * Το φίλτρο μπαίνει **πριν** επιστρέψει η συνάρτηση, όχι ως προαιρετικό βήμα
   * που ο καλών «μπορεί» να ξεχάσει. Η αρίθμηση των παραμέτρων καρφώνεται ώστε
   * μια μελλοντική **προαιρετική** πέμπτη (`allowUnscoped?`) να μη γλιστρήσει
   * μέσα: μια boolean σε κλήση ασφαλείας είναι αυτό που ρυθμίζεται λάθος στο
   * review (ADR-742 §3.2).
   */
  it('η υπογραφή απαιτεί και τα τέσσερα ορίσματα — καμία προαιρετική διέξοδος', () => {
    expect(tenantScopedDependencyQuery).toHaveLength(4);
  });
});

// ============================================================================
// Β. ΟΙ ΕΞΙ ΕΚΤΕΛΕΣΤΕΣ ΤΟΝ ΚΑΛΟΥΝ
// ============================================================================

describe('Β. οι φύλακες διαγραφής περνούν από τον κανόνα', () => {
  /**
   * 🔴 ΜΕΤΑΛΛΑΞΗ (γ): «το φίλτρο εξαφανίζεται εντελώς» — σε **αυτό** το σημείο
   * κλήσης, όχι στον SSoT. Ο σωστός SSoT που δεν καλείται δεν φυλάει τίποτα.
   */
  it('checkDeletionDependencies: κάθε εξάρτηση με πεδίο μισθωτή φιλτράρεται', async () => {
    const db = makeDb();

    await checkDeletionDependencies(asFirestore(db), 'property', 'prop_1', TENANT);

    // `opportunities` φέρει companyId· `accounting_invoices` δηλώνει ρητά ότι όχι.
    const opportunities = openedFor(db, COLLECTIONS.OPPORTUNITIES);
    expect(opportunities.length).toBeGreaterThan(0);
    for (const q of opportunities) {
      expect(tenantFilters(q)).toEqual([{ field: FIELDS.COMPANY_ID, op: '==', value: TENANT }]);
    }

    for (const q of openedFor(db, COLLECTIONS.ACCOUNTING_INVOICES)) {
      expect(tenantFilters(q)).toEqual([]);
    }
  });

  it('checkDeletionDependencies: ο μισθωτής δεν είναι καρφωμένος', async () => {
    const db = makeDb();

    await checkDeletionDependencies(asFirestore(db), 'property', 'prop_1', 'another_tenant');

    const values = db.opened.flatMap((q) => tenantFilters(q).map((w) => w.value));
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => v === 'another_tenant')).toBe(true);
  });

  it('checkLinkRemovalDependencies: οι σύνθετες εξαρτήσεις φιλτράρονται κι αυτές', async () => {
    const db = makeDb();

    await checkLinkRemovalDependencies(asFirestore(db), 'contact_1', 'project', 'proj_1', TENANT);

    const scoped = db.opened.filter((q) => tenantFilters(q).length > 0);
    expect(scoped.length).toBeGreaterThan(0);
    for (const q of scoped) {
      expect(tenantFilters(q)).toEqual([{ field: FIELDS.COMPANY_ID, op: '==', value: TENANT }]);
    }
  });

  /**
   * Η **αλυσιδωτή διαγραφή** είναι το μόνο σημείο με `useCollectionGroup`, και
   * το μόνο που **σβήνει** αντί να μετράει. Ένα αφιλτράριστο query εδώ δεν
   * διαρρέει — **διαγράφει** ξένα έγγραφα.
   */
  it('executeDeletion → cascade: φιλτραρισμένες οι tenant συλλογές, collectionGroup όπου δηλώνεται', async () => {
    const db = makeDb();

    await executeDeletion(asFirestore(db), 'property', 'prop_1', 'uid_1', TENANT);

    const files = openedFor(db, COLLECTIONS.FILES);
    expect(files.length).toBeGreaterThan(0);
    for (const q of files) {
      expect(tenantFilters(q)).toEqual([{ field: FIELDS.COMPANY_ID, op: '==', value: TENANT }]);
    }

    const overlayItems = openedFor(db, 'items');
    expect(overlayItems).toHaveLength(1);
    expect(overlayItems[0]?.source).toBe('collectionGroup');
    expect(tenantFilters(overlayItems[0] as OpenedQuery)).toEqual([]);
  });
});

// ============================================================================
// Γ. ΤΟ ANCHOR — κανένα έβδομο αντίγραφο
// ============================================================================

/**
 * 🔴 Αφαιρεί σχόλια **πριν** τη μέτρηση (§7octies.2β).
 *
 * Τα ίδια τα αρχεία που έλυσαν το πρόβλημα **οφείλουν** να περιγράφουν τι
 * αντικατέστησαν — και αναφέρουν το `skipCompanyFilter` ονομαστικά. Μετρητής
 * που διαβάζει πρόζα θα τα κατήγγειλλε, και ένα gate που βγάζει θόρυβο το
 * χαλαρώνει κάποιος.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Τα δέντρα όπου μπορεί να ζήσει καταναλωτής των δύο μητρώων.
 *
 * ⚠️ **Δηλωμένο τυφλό σημείο**: `src/components` και `src/subapps` δεν
 * σαρώνονται — το δεύτερο έχει δικό του `node_modules` με σπασμένους συνδέσμους
 * (ίδιος περιορισμός με το `resource-concealment-anchor`). Οι κατάλογοι είναι
 * `server-only`, οπότε ένας καταναλωτής εκεί θα ήταν ήδη σφάλμα άλλου είδους.
 */
const SCANNED_TREES = ['src/app', 'src/config', 'src/lib', 'src/hooks', 'src/services'] as const;

const SKIP_DIRS = new Set(['__tests__', '__mocks__', 'node_modules', '.next']);

function listSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_DIRS.has(entry.name)) return [];
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listSources(full);
    if (entry.isSymbolicLink()) return [];
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

const toRepoPath = (file: string): string =>
  file.slice(process.cwd().length + 1).split('\\').join('/');

const SOURCES = SCANNED_TREES.flatMap((tree) => listSources(join(process.cwd(), tree)))
  .filter((file) => !/\.(test|spec)\.tsx?$/.test(file))
  .map((file) => ({ path: toRepoPath(file), code: stripComments(readFileSync(file, 'utf8')) }));

/**
 * Τα **μόνα** αρχεία που επιτρέπεται να ονομάσουν τη σημαία σε εκτελέσιμο
 * κώδικα — δύο που τη **δηλώνουν**, ένα που την **εφαρμόζει**.
 *
 * 🔑 Είναι **ισότητα, όχι ανισότητα**: ένα τέταρτο αρχείο σημαίνει ότι κάποιος
 * ξαναέγραψε τον κανόνα, και τα έξι αντίγραφα του §7octies είχαν αποκλίνει
 * ακριβώς έτσι — σιωπηλά, με πράσινα tests εκατέρωθεν.
 */
const RULE_OWNERS = [
  'src/config/contact-dependency-registry.ts',
  'src/config/deletion-registry.ts',
  'src/lib/firestore/dependency-tenant-scope.ts',
] as const;

describe('Γ. anchor — ο κανόνας `skipCompanyFilter` δεν ξαναγράφεται', () => {
  it('βρίσκει αρχεία να ελέγξει (φρουρά κατά σιωπηλά άδειας σάρωσης)', () => {
    expect(SOURCES.length).toBeGreaterThan(500);
  });

  it('🔴 ΜΟΝΟ τα δύο μητρώα και ο ένας εφαρμοστής ονομάζουν τη σημαία', () => {
    const mentions = SOURCES.filter((f) => f.code.includes('skipCompanyFilter')).map((f) => f.path);

    expect([...mentions].sort()).toEqual([...RULE_OWNERS].sort());
  });

  it('🔴 κανείς εκτός του εφαρμοστή δεν γράφει τη ΣΥΝΘΗΚΗ', () => {
    const condition = /if\s*\(\s*!\s*\w+\.skipCompanyFilter/;
    const offenders = SOURCES.filter((f) => condition.test(f.code)).map((f) => f.path);

    expect(offenders).toEqual([]);
  });

  it('ο ανιχνευτής θα πυροδοτούσε ακόμη — regex που δεν ταιριάζει τίποτα δεν αποδεικνύει τίποτα', () => {
    const condition = /if\s*\(\s*!\s*\w+\.skipCompanyFilter/;

    expect(condition.test('if (!dep.skipCompanyFilter) { q = q.where(a, b, c); }')).toBe(true);
    expect(condition.test('if (!query.skipCompanyFilter && companyId) {')).toBe(true);
    expect(condition.test('return dep.skipCompanyFilter ? q : scoped(q);')).toBe(false);

    // …και η τεκμηρίωση του παρελθόντος δεν μετριέται ως παράβαση.
    expect(stripComments('/** ρωτούσε `if (!dep.skipCompanyFilter)` */')).not.toContain('skipCompanyFilter');
    expect(stripComments('// if (!dep.skipCompanyFilter) {')).not.toContain('skipCompanyFilter');
  });
});
