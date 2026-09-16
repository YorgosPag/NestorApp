/**
 * CHECK 3.86 / ADR-865 — άγκυρες της πύλης απόδειξης ανάπτυξης.
 *
 * Κρίνουν **την ίδια** καθαρή `judgeFirestoreDeploy` που τρέχει η πύλη, πάνω σε κόσμους
 * φτιαγμένους στο χέρι· και μία άγκυρα κρίνει **το πραγματικό αποθετήριο**.
 *
 * Κάθε κανόνας έχει **θετικό μάρτυρα** (ο καθαρός κόσμος μένει καθαρός) — αλλιώς μια πύλη που
 * αναφέρει τα πάντα θα περνούσε τις αρνητικές άγκυρες.
 */

'use strict';

const M = require('../lib/firestore-deploy/model');
const { RULES, judgeFirestoreDeploy, blocking } = require('../lib/firestore-deploy/judge');
const { loadWorld, resolveTargets } = require('../lib/firestore-deploy/world');

const RULES_BYTES = 'rules { allow read: if false; }\n';
const INDEX_BYTES = '{"indexes":[]}\n';
const STORAGE_BYTES = 'service firebase.storage {}\n';

const FIREBASE_JSON = {
  firestore: { rules: 'firestore.rules.compiled', indexes: 'firestore.indexes.json' },
  storage: { rules: 'storage.rules' },
  functions: [{ source: 'functions' }],
  hosting: { public: 'out' },
  emulators: { firestore: { port: 8080 } },
};

const BYTES = {
  'firestore.rules': RULES_BYTES,
  'firestore.indexes.json': INDEX_BYTES,
  'storage.rules': STORAGE_BYTES,
};

const row = (target, source, bytes, at = '2026-09-16') => ({
  at, target, source, digest: M.digestOf(bytes), commit: 'abc1234',
});

/** Καθαρός κόσμος: κάθε στόχος αναπτυγμένος με **τα τρέχοντα** bytes, μητρώο ίδιο με το `HEAD`. */
function cleanWorld(overrides = {}) {
  const bytes = { ...BYTES, ...(overrides.bytes || {}) };
  const targets = [
    { target: 'firestore:rules', source: 'firestore.rules', digest: M.digestOf(bytes['firestore.rules']) },
    { target: 'firestore:indexes', source: 'firestore.indexes.json', digest: M.digestOf(bytes['firestore.indexes.json']) },
    { target: 'storage', source: 'storage.rules', digest: M.digestOf(bytes['storage.rules']) },
  ];
  const deployments = [
    row('firestore:rules', 'firestore.rules', BYTES['firestore.rules']),
    row('firestore:indexes', 'firestore.indexes.json', BYTES['firestore.indexes.json']),
    row('storage', 'storage.rules', BYTES['storage.rules']),
  ];
  return {
    firebaseJson: overrides.firebaseJson || FIREBASE_JSON,
    ledger: { deployments: overrides.deployments || deployments },
    headLedger: { deployments: overrides.headLedger || deployments },
    targets: overrides.targets || targets,
    sourceByTarget: {
      'firestore:rules': 'firestore.rules',
      'firestore:indexes': 'firestore.indexes.json',
      storage: 'storage.rules',
    },
    ageOf: () => 3,
  };
}

const rulesOf = (findings) => findings.map((f) => f.rule);

describe('CHECK 3.86 — απόδειξη ανάπτυξης (ADR-865)', () => {
  it('🟢 Ο ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: καθαρός κόσμος ⇒ κανένα εύρημα', () => {
    expect(judgeFirestoreDeploy(cleanWorld())).toEqual([]);
  });

  describe('Κ1 — ο παρονομαστής (fail-closed)', () => {
    it('νέο κλειδί στο firebase.json χωρίς στόχο ΚΑΙ χωρίς λόγο ⇒ ⛔ block', () => {
      const world = cleanWorld({ firebaseJson: { ...FIREBASE_JSON, dataconnect: { source: 'dc' } } });
      const findings = judgeFirestoreDeploy(world);
      expect(rulesOf(findings)).toContain(RULES.K1);
      expect(blocking(findings, { atPush: false })).toHaveLength(1);
    });

    it('🔑 τα ρητά εξαιρεμένα (functions · hosting · emulators) ΔΕΝ κοκκινίζουν', () => {
      expect(Object.keys(M.NOT_JUDGED).sort()).toEqual(['emulators', 'functions', 'hosting']);
      for (const why of Object.values(M.NOT_JUDGED)) expect(why.length).toBeGreaterThanOrEqual(40);
      expect(judgeFirestoreDeploy(cleanWorld())).toEqual([]);
    });
  });

  describe('Κ2 — ο στόχος χωρίς αρχείο', () => {
    it('δηλωμένος στόχος με αρχείο που λείπει ⇒ ⛔ block', () => {
      const world = cleanWorld();
      world.targets[0].digest = null;
      const findings = judgeFirestoreDeploy(world);
      expect(rulesOf(findings)).toContain(RULES.K2);
      expect(blocking(findings, { atPush: false })).toHaveLength(1);
    });
  });

  describe('Κ3 — append-only', () => {
    it('γραμμή του HEAD που σβήστηκε ⇒ ⛔ block', () => {
      const head = cleanWorld().headLedger.deployments;
      const world = cleanWorld({ deployments: head.slice(1), headLedger: head });
      expect(rulesOf(judgeFirestoreDeploy(world))).toContain(RULES.K3);
    });

    it('γραμμή του HEAD που ΑΛΛΑΞΕ ⇒ ⛔ block (ιστορικό που επεξεργάζεται δεν είναι ιστορικό)', () => {
      const head = cleanWorld().headLedger.deployments;
      const tampered = head.map((r, i) => (i === 0 ? { ...r, at: '2026-01-01' } : r));
      const world = cleanWorld({ deployments: tampered, headLedger: head });
      expect(rulesOf(judgeFirestoreDeploy(world))).toContain(RULES.K3);
    });
  });

  describe('Κ4 — σχηματική εγκυρότητα γραμμής', () => {
    it.each([
      ['άγνωστος στόχος', { target: 'firestore:whatever' }],
      ['αποτύπωμα που δεν είναι sha256', { digest: 'md5:deadbeef' }],
      ['ημερομηνία εκτός YYYY-MM-DD', { at: '16/09/2026' }],
      ['πηγή που δεν συμφωνεί με το firebase.json', { source: 'firestore.rules.compiled' }],
    ])('%s ⇒ ⛔ block', (_label, patch) => {
      const base = cleanWorld().ledger.deployments;
      const deployments = [{ ...base[0], ...patch }, ...base.slice(1)];
      const world = cleanWorld({ deployments, headLedger: [] });
      expect(rulesOf(judgeFirestoreDeploy(world))).toContain(RULES.K4);
    });
  });

  describe('Κ5 — η καρδιά: τρέχον ≠ αναπτυγμένο', () => {
    it('🔴 Η ΠΡΑΓΜΑΤΙΚΗ ΒΛΑΒΗ — αλλαγμένος κανόνας που δεν αναπτύχθηκε', () => {
      const changed = 'rules { allow read: if resource.data.userId == request.auth.uid; }\n';
      const world = cleanWorld({ bytes: { 'firestore.rules': changed } });
      const findings = judgeFirestoreDeploy(world);
      const k5 = findings.filter((f) => f.rule === RULES.K5);
      expect(k5).toHaveLength(1);
      expect(k5[0].target).toBe('firestore:rules');
    });

    it('🔑 ΣΤΟ COMMIT ΔΕΝ ΜΠΛΟΚΑΡΕΙ — η στιγμή της ανάπτυξης είναι απόφαση ανθρώπου (N.(-1))', () => {
      const world = cleanWorld({ bytes: { 'firestore.rules': 'άλλο\n' } });
      expect(blocking(judgeFirestoreDeploy(world), { atPush: false })).toEqual([]);
    });

    it('🚫 ΣΤΟ PUSH ΜΠΛΟΚΑΡΕΙ — εκεί ο κώδικας φεύγει στην παραγωγή χωρίς τον κανόνα του', () => {
      const world = cleanWorld({ bytes: { 'firestore.rules': 'άλλο\n' } });
      expect(blocking(judgeFirestoreDeploy(world), { atPush: true })).toHaveLength(1);
    });

    it('στόχος χωρίς ΚΑΜΙΑ καταγεγραμμένη ανάπτυξη ⇒ εκκρεμής', () => {
      const world = cleanWorld({ deployments: [], headLedger: [] });
      expect(judgeFirestoreDeploy(world).filter((f) => f.rule === RULES.K5)).toHaveLength(3);
    });

    it('🔑 Η ΗΛΙΚΙΑ ΜΠΑΙΝΕΙ ΣΤΟ ΜΗΝΥΜΑ — σε commits, ποτέ σε μέρες (μάθημα CHECK 3.33)', () => {
      const world = cleanWorld({ bytes: { 'firestore.rules': 'άλλο\n' } });
      world.ageOf = () => 21;
      const k5 = judgeFirestoreDeploy(world).find((f) => f.rule === RULES.K5);
      expect(k5.detail).toContain('21 commit(s)');
    });
  });

  describe('Το μοντέλο — η πηγή, όχι το παραγόμενο', () => {
    it('🔴 ο στόχος firestore:rules δείχνει στην ΠΗΓΗ, όχι στο untracked .compiled', () => {
      expect(M.sourceOf(FIREBASE_JSON, 'firestore:rules')).toBe('firestore.rules');
      expect(M.declaredPath(FIREBASE_JSON, 'firestore:rules')).toBe('firestore.rules.compiled');
      expect(M.DEPLOY_TARGETS['firestore:rules'].overrideWhy.length).toBeGreaterThanOrEqual(40);
    });

    it('οι στόχοι χωρίς override παίρνουν τη διαδρομή του firebase.json αυτούσια', () => {
      expect(M.sourceOf(FIREBASE_JSON, 'firestore:indexes')).toBe('firestore.indexes.json');
      expect(M.sourceOf(FIREBASE_JSON, 'storage')).toBe('storage.rules');
    });

    it('στόχος που δεν δηλώνεται καθόλου ⇒ null (δεν μαντεύεται διαδρομή)', () => {
      expect(M.sourceOf({ firestore: {} }, 'storage')).toBeNull();
    });
  });

  describe('🌍 ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΑΠΟΘΕΤΗΡΙΟ', () => {
    it('Π — ο παρονομαστής δεν είναι κενός: το firebase.json δηλώνει και τους τρεις στόχους', () => {
      const { targets } = resolveTargets(M.loadFirebaseJson());
      expect(targets.map((t) => t.target).sort()).toEqual(['firestore:indexes', 'firestore:rules', 'storage']);
      for (const t of targets) expect(t.digest).toMatch(M.DIGEST_RE);
    });

    it('το πραγματικό δέντρο δεν παράγει κανένα εύρημα Κ1-Κ4 (μόνο ο Κ5 επιτρέπεται)', () => {
      const findings = judgeFirestoreDeploy(loadWorld());
      expect(findings.filter((f) => f.rule !== RULES.K5)).toEqual([]);
    });
  });
});
