/**
 * ADR-865 §10 (+§11) — άγκυρες της ζωντανής επαλήθευσης (`drift.js` · `live.js` · `compileRules`).
 *
 * Κρίνουν **την ίδια** καθαρή `judgeLive` που τρέχει το `verify-live.js`, με κόσμους φτιαγμένους
 * στο χέρι· το `live.js` με **ψεύτικη μεταφορά** που καταγράφει κάθε URL — έτσι αποδεικνύεται
 * **ποιο** release ρωτιέται, όχι μόνο ότι «κάτι» ρωτιέται. Καμία κλήση δικτύου.
 *
 * Κάθε άξονας έχει **θετικό μάρτυρα** (ο καθαρός κόσμος μένει `Synced`/`Healthy`, έξοδος 0) —
 * αλλιώς ένας κριτής που αναφέρει τα πάντα θα περνούσε τις αρνητικές άγκυρες.
 */

'use strict';

const M = require('../lib/firestore-deploy/model');
const D = require('../lib/firestore-deploy/drift');
const { createTransport, loadLiveWorld, resolveProject } = require('../lib/firestore-deploy/live');
const { loadWorld, loadDesired, recordedBytes } = require('../lib/firestore-deploy/world');
const { compileRules } = require('../build-firestore-rules');

const PROJECT = 'demo-project';
const RULES = "rules_version = '2';\n// σχόλιο\nservice cloud.firestore {\n  match /a/{b} { allow read: if false; } // τέλος\n}\n";
const WIRE = compileRules(RULES);
const STORAGE = 'service firebase.storage {}\r\n';

const IDX = { collectionGroup: 'files', queryScope: 'COLLECTION',
  fields: [{ fieldPath: 'companyId', order: 'ASCENDING' }, { fieldPath: 'createdAt', order: 'DESCENDING' }] };
const OVERRIDE = { collectionGroup: 'audit_logs', fieldPath: 'expiresAt', ttl: true,
  indexes: [{ order: 'ASCENDING', queryScope: 'COLLECTION' }, { order: 'DESCENDING', queryScope: 'COLLECTION' },
    { arrayConfig: 'CONTAINS', queryScope: 'COLLECTION' }] };

/** Ό,τι επιστρέφει ο διακομιστής για το `IDX` — **με** το σιωπηρό `__name__`. */
const liveIndex = (state = 'READY') => ({
  ...IDX, fields: [...IDX.fields, { fieldPath: '__name__', order: 'DESCENDING' }], state, density: 'SPARSE_ALL',
});
const liveOverride = (state = 'READY', ttlState = 'ACTIVE') => ({
  collectionGroup: 'audit_logs', fieldPath: 'expiresAt', ttlState,
  indexes: OVERRIDE.indexes.map((i) => ({ queryScope: i.queryScope, state,
    fields: [{ fieldPath: 'expiresAt', ...(i.order ? { order: i.order } : { arrayConfig: i.arrayConfig }) }] })),
});

const recorded = (wire, extra = {}) => ({ at: '2026-09-18', commit: 'abc1234', digest: M.digestOf(RULES), wire, why: null, matchesTree: true, ...extra });

function desiredWorld(over = {}) {
  return {
    'firestore:rules': { kind: 'ruleset', source: 'firestore.rules', digest: M.digestOf(RULES), wire: WIRE, recorded: recorded(WIRE), ...over.rules },
    'firestore:indexes': { kind: 'indexes', source: 'firestore.indexes.json', indexes: [IDX], fieldOverrides: [OVERRIDE], ...over.indexes },
    storage: { kind: 'ruleset', source: 'storage.rules', digest: M.digestOf(STORAGE), wire: STORAGE, recorded: null, ...over.storage },
  };
}

function liveWorld(over = {}) {
  const release = (name, content) => ({ release: name, rulesetName: `projects/p/rulesets/${name}-id`, updateTime: '2026-09-18T08:27:34Z', files: [{ name: 'x', content }] });
  return {
    'firestore:rules': over.rules || release('cloud.firestore', WIRE),
    'firestore:indexes': over.indexes || { edition: 'STANDARD', indexes: [liveIndex()], fieldOverrides: [liveOverride()] },
    storage: over.storage || release('firebase.storage/b', STORAGE),
  };
}

const verdictOf = (result, target) => result.verdicts.find((v) => v.target === target);

describe('ADR-865 §10 — ζωντανό έναντι δέντρου', () => {
  describe('✅ ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ', () => {
    it('ο καθαρός κόσμος: κάθε στόχος Synced/Healthy, έξοδος 0', () => {
      const result = D.judgeLive(desiredWorld(), liveWorld());
      expect(result.exitCode).toBe(D.EXIT.OK);
      for (const v of result.verdicts) expect([v.sync, v.health]).toEqual([D.SYNC.SYNCED, D.HEALTH.HEALTHY]);
    });
  });

  describe('Κανόνες — σύγκριση περιεχομένου με απόδοση προέλευσης', () => {
    it('🔴 δέντρο προχώρησε ⇒ OutOfSync με προέλευση «recorded» (τρέχει η καταγεγραμμένη ανάπτυξη)', () => {
      const d = desiredWorld({ rules: { wire: `${WIRE}x\n`, digest: 'sha256:new' } });
      const v = verdictOf(D.judgeLive(d, liveWorld()), 'firestore:rules');
      expect([v.sync, v.origin]).toEqual([D.SYNC.OUT_OF_SYNC, D.ORIGIN.RECORDED]);
      expect(v.detail).toContain('@abc1234');
    });

    it('🔴 ζωντανό ≠ δέντρο ΚΑΙ ≠ μητρώο ⇒ «foreign» (Console · rollback)', () => {
      const d = desiredWorld({ rules: { wire: `${WIRE}x\n`, recorded: recorded('άλλο\n') } });
      expect(verdictOf(D.judgeLive(d, liveWorld()), 'firestore:rules').origin).toBe(D.ORIGIN.FOREIGN);
    });

    it('καταγεγραμμένη ανάπτυξη που δεν ανασυντίθεται ⇒ «unattributable», ποτέ ψευδής «foreign»', () => {
      const d = desiredWorld({ rules: { wire: `${WIRE}x\n`, recorded: recorded(null, { why: 'μη δεσμευμένα' }) } });
      const v = verdictOf(D.judgeLive(d, liveWorld()), 'firestore:rules');
      expect(v.origin).toBe(D.ORIGIN.UNATTRIBUTABLE);
      expect(v.detail).toContain('μη δεσμευμένα');
    });

    it('ζωντανό = δέντρο αλλά το τοπικό μητρώο δεν το κατέγραψε ⇒ Synced, με ορατή σημείωση (§11)', () => {
      // Από ADR-865 §11 αυτό είναι το ΚΑΝΟΝΙΚΟ μετά από ανάπτυξη της γραμμής παραγωγής: το αρχείο
      // της πράξης είναι το GitHub Deployment, όχι το τοπικό μητρώο — σημείωση, όχι «⚠️».
      const d = desiredWorld({ rules: { recorded: recorded('παλιό\n', { digest: 'sha256:old', matchesTree: false }) } });
      const v = verdictOf(D.judgeLive(d, liveWorld()), 'firestore:rules');
      expect(v.sync).toBe(D.SYNC.SYNCED);
      expect(v.detail).toContain('δεν το κατέγραψε');
      // Η απάντηση («γραμμή παραγωγής» ή «εκτός εργαλείου») έρχεται από το `withDeployment` (§11.10)
      expect(v.unrecorded).toBe(true);
    });

    it('release που δεν υπάρχει ⇒ OutOfSync («δεν αναπτύχθηκε ΠΟΤΕ»)', () => {
      const live = liveWorld({ rules: { release: 'cloud.firestore', rulesetName: null, updateTime: null, files: [] } });
      const v = verdictOf(D.judgeLive(desiredWorld(), live), 'firestore:rules');
      expect(v.sync).toBe(D.SYNC.OUT_OF_SYNC);
      expect(v.detail).toContain('ΠΟΤΕ');
    });

    it('🔴 σφάλμα παρόχου ⇒ Unknown και έξοδος 1 — ΠΟΤΕ σιωπηλό πράσινο', () => {
      const result = D.judgeLive(desiredWorld(), liveWorld({ storage: { error: '403 SERVICE_DISABLED — x' } }));
      expect(verdictOf(result, 'storage').sync).toBe(D.SYNC.UNKNOWN);
      expect(result.exitCode).toBe(D.EXIT.ERROR);
    });
  });

  describe('Δείκτες — η ταύτιση του firebase-tools', () => {
    it('🔑 το σιωπηρό __name__ παίρνει την κατεύθυνση του ΤΕΛΕΥΤΑΙΟΥ πεδίου με order', () => {
      expect(D.withImplicitName(IDX.fields).pop()).toEqual({ fieldPath: '__name__', order: 'DESCENDING' });
      const arr = [{ fieldPath: 'a', order: 'DESCENDING' }, { fieldPath: 'tags', arrayConfig: 'CONTAINS' }];
      expect(D.withImplicitName(arr).pop()).toEqual({ fieldPath: '__name__', order: 'DESCENDING' });
      expect(D.withImplicitName([{ fieldPath: 't', arrayConfig: 'CONTAINS' }]).pop().order).toBe('ASCENDING');
    });

    it('διανυσματικό πεδίο: το __name__ μπαίνει ΠΡΙΝ από αυτό (processIndex)', () => {
      const vec = { fieldPath: 'emb', vectorConfig: { dimension: 3, flat: {} } };
      expect(D.withImplicitName([{ fieldPath: 'a', order: 'ASCENDING' }, vec]).map((f) => f.fieldPath)).toEqual(['a', '__name__', 'emb']);
    });

    it('δείκτης αρχείου (χωρίς __name__) ≡ ζωντανός (με __name__)', () => {
      expect(D.indexIdentity(IDX, 'STANDARD')).toBe(D.indexIdentity(liveIndex(), 'STANDARD'));
    });

    it('άλλο queryScope ⇒ ΑΛΛΟΣ δείκτης (δεν ταυτίζονται)', () => {
      expect(D.indexIdentity({ ...IDX, queryScope: 'COLLECTION_GROUP' }, 'STANDARD')).not.toBe(D.indexIdentity(IDX, 'STANDARD'));
    });

    it('🔴 δείκτης αρχείου που λείπει ζωντανά ⇒ OutOfSync, με όνομα', () => {
      const extraSpec = { collectionGroup: 'x', queryScope: 'COLLECTION', fields: [{ fieldPath: 'a', order: 'ASCENDING' }, { fieldPath: 'b', order: 'ASCENDING' }] };
      const v = verdictOf(D.judgeLive(desiredWorld({ indexes: { indexes: [IDX, extraSpec] } }), liveWorld()), 'firestore:indexes');
      expect(v.sync).toBe(D.SYNC.OUT_OF_SYNC);
      expect(v.missing).toEqual(['x: a↑, b↑']);
    });

    it('🔴 ζωντανός δείκτης ΕΚΤΟΣ αρχείου ⇒ OutOfSync (το επόμενο deploy θα τον σβήσει)', () => {
      const v = verdictOf(D.judgeLive(desiredWorld({ indexes: { indexes: [] } }), liveWorld()), 'firestore:indexes');
      expect(v.extra).toEqual(['files: companyId↑, createdAt↓']);
    });

    it('🔴 δείκτης σε CREATING ⇒ Synced ΑΛΛΑ Progressing, έξοδος 3 — deploy ≠ διαθέσιμος', () => {
      const live = liveWorld({ indexes: { edition: 'STANDARD', indexes: [liveIndex('CREATING')], fieldOverrides: [liveOverride()] } });
      const result = D.judgeLive(desiredWorld(), live);
      const v = verdictOf(result, 'firestore:indexes');
      expect([v.sync, v.health, result.exitCode]).toEqual([D.SYNC.SYNCED, D.HEALTH.PROGRESSING, D.EXIT.PROGRESSING]);
    });

    it('🔴 NEEDS_REPAIR ⇒ Degraded, έξοδος 4 — και υπερισχύει του Progressing', () => {
      const live = liveWorld({ indexes: { edition: 'STANDARD', indexes: [liveIndex('NEEDS_REPAIR')], fieldOverrides: [liveOverride('CREATING')] } });
      const result = D.judgeLive(desiredWorld(), live);
      expect([verdictOf(result, 'firestore:indexes').health, result.exitCode]).toEqual([D.HEALTH.DEGRADED, D.EXIT.DEGRADED]);
    });

    it('🔴 απόκλιση υπερισχύει της υγείας (έξοδος 2 ακόμη κι αν κάτι χτίζεται)', () => {
      const live = liveWorld({ indexes: { edition: 'STANDARD', indexes: [liveIndex('CREATING')], fieldOverrides: [liveOverride()] } });
      expect(D.judgeLive(desiredWorld({ rules: { wire: 'άλλο\n' } }), live).exitCode).toBe(D.EXIT.DRIFT);
    });
  });

  describe('Field overrides — fieldMatchesSpec', () => {
    it('🔴 TTL που διαφωνεί ⇒ OutOfSync', () => {
      const v = verdictOf(D.judgeLive(desiredWorld({ indexes: { fieldOverrides: [{ ...OVERRIDE, ttl: false }] } }), liveWorld()), 'firestore:indexes');
      expect(v.missing).toEqual(['audit_logs.expiresAt']);
    });

    it('🔴 TTL σε CREATING ⇒ Progressing', () => {
      const live = liveWorld({ indexes: { edition: 'STANDARD', indexes: [liveIndex()], fieldOverrides: [liveOverride('READY', 'CREATING')] } });
      expect(verdictOf(D.judgeLive(desiredWorld(), live), 'firestore:indexes').health).toBe(D.HEALTH.PROGRESSING);
    });

    it('ζωντανό override εκτός αρχείου ⇒ extra', () => {
      const v = verdictOf(D.judgeLive(desiredWorld({ indexes: { fieldOverrides: [] } }), liveWorld()), 'firestore:indexes');
      expect(v.extra).toEqual(['audit_logs.expiresAt']);
    });
  });

  describe('compileRules — ΜΙΑ μεταγλώττιση για predeploy ΚΑΙ επαλήθευση', () => {
    it('αφαιρεί σχόλια και εσοχές, κρατά το // μέσα σε συμβολοσειρά', () => {
      expect(compileRules("a // x\n  b 'http://y' // z\n\n")).toBe("a\nb 'http://y'\n");
    });

    it('model.wireOf: οι κανόνες Firestore μεταγλωττίζονται, οι Storage ταξιδεύουν αυτούσιοι', () => {
      expect(M.wireOf('firestore:rules', RULES)).toBe(WIRE);
      expect(M.wireOf('storage', STORAGE)).toBe(STORAGE);
    });
  });

  describe('Ονόματα release — τα ίδια με το firebase deploy', () => {
    it('cloud.firestore χωρίς ονομασμένη βάση· cloud.firestore/<db> με', () => {
      expect(M.releaseNameOf({ firestore: {} }, 'firestore:rules', null)).toBe('cloud.firestore');
      expect(M.releaseNameOf({ firestore: { database: 'eu' } }, 'firestore:rules', null)).toBe('cloud.firestore/eu');
    });

    it('🔴 storage ΠΑΝΤΑ firebase.storage/<bucket> — ποτέ το σκέτο (νεκρό) firebase.storage', () => {
      expect(M.releaseNameOf({ storage: {} }, 'storage', 'def.app')).toBe('firebase.storage/def.app');
      expect(M.releaseNameOf({ storage: [{ target: 'main', rules: 'storage.rules' }] }, 'storage', 'own')).toBe('firebase.storage/own');
    });
  });

  describe('ADR-865 §11.7 — η δήλωση Storage όπως τη διαβάζει το firebase deploy (prepare/release.js)', () => {
    const RC = { targets: { p: { storage: { main: ['p.firebasestorage.app'], two: ['a', 'b'], none: [] } } } };
    const withTarget = (target) => ({ storage: [{ target, rules: 'storage.rules' }] });

    it('αντικείμενο ⇒ ανακάλυψη· ένα `bucket` εκεί ΑΓΝΟΕΙΤΑΙ (ο deployer το αντικαθιστά)', () => {
      const obj = { storage: { rules: 'storage.rules', bucket: 'own' } };
      expect(M.storageEntriesOf(obj)).toEqual({ bucket: null, target: null, rules: 'storage.rules' });
      expect(M.declaredBucketOf(obj, RC, 'p')).toBeNull();
    });

    it('πίνακας με target ⇒ λύνεται από το .firebaserc ΑΝΑ PROJECT (rc.target), καμία ανακάλυψη', () => {
      expect(M.storageEntriesOf(withTarget('main'))).toEqual({ bucket: null, target: 'main', rules: 'storage.rules' });
      expect(M.declaredBucketOf(withTarget('main'), RC, 'p')).toBe('p.firebasestorage.app');
      expect(M.sourceOf(withTarget('main'), 'storage')).toBe('storage.rules');
    });

    it('πίνακας με bucket ⇒ δηλωμένος χωρίς .firebaserc (τον δέχεται ο deployer, ΟΧΙ ο emulator)', () => {
      expect(M.declaredBucketOf({ storage: [{ bucket: 'b.app', rules: 'r' }] }, {}, 'p')).toBe('b.app');
    });

    it('🔴 ποτέ σιωπηλή επιλογή: ≠1 στοιχεία · και τα δύο · κανένα · target χωρίς ή με >1 buckets ⇒ ρίχνει', () => {
      expect(() => M.storageEntriesOf({ storage: [] })).toThrow('0 buckets');
      expect(() => M.storageEntriesOf({ storage: [{ bucket: 'a', rules: 'r' }, { bucket: 'b', rules: 'r' }] })).toThrow('2 buckets');
      expect(() => M.storageEntriesOf({ storage: [{ rules: 'r' }] })).toThrow('ΑΚΡΙΒΩΣ ένα');
      expect(() => M.storageEntriesOf({ storage: [{ bucket: 'a', target: 'main', rules: 'r' }] })).toThrow('ΑΚΡΙΒΩΣ ένα');
      expect(() => M.declaredBucketOf(withTarget('none'), RC, 'p')).toThrow('0 buckets');
      expect(() => M.declaredBucketOf(withTarget('two'), RC, 'p')).toThrow('2 buckets');
      expect(() => M.declaredBucketOf(withTarget('main'), RC, 'άλλο-project')).toThrow('0 buckets');
    });
  });

  describe('🌍 ADR-865 §11.7 — το ΠΡΑΓΜΑΤΙΚΟ firebase.json + .firebaserc', () => {
    const fs = require('node:fs');
    const REAL = M.loadFirebaseJson();
    const RC = M.loadFirebaserc();
    const WORKFLOW = fs.readFileSync(M.paths.of('.github/workflows/docker-build.yml'), 'utf8');
    const envOf = (name) => (WORKFLOW.match(new RegExp(`^\\s*${name}:\\s*(\\S+)\\s*$`, 'm')) || [])[1];

    it('η γραμμή παραγωγής ΔΕΝ εξαρτάται από το defaultBucket API — target, όχι ανακάλυψη', () => {
      expect(M.storageEntriesOf(REAL).target).toBe('main');
      expect(M.declaredBucketOf(REAL, RC, envOf('FIREBASE_PROJECT_ID'))).toMatch(/\.firebasestorage\.app$/);
    });

    it('🏆 οι κανόνες πάνε στον ΙΔΙΟ bucket που χρησιμοποιεί η εφαρμογή (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)', () => {
      // Δύο δηλώσεις του ίδιου γεγονότος: αν αποκλίνουν, το deploy «πετυχαίνει» σε bucket που η
      // εφαρμογή δεν αγγίζει και ο πραγματικός μένει με τους ΠΑΛΙΟΥΣ κανόνες — σιωπηλά.
      const project = envOf('FIREBASE_PROJECT_ID');
      expect(envOf('NEXT_PUBLIC_FIREBASE_PROJECT_ID')).toBe(project);
      expect(M.declaredBucketOf(REAL, RC, project)).toBe(envOf('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'));
    });

    it('🏆 κάθε emulator με storage και ρητό --project ξεκινά με ΤΟΥΣ ΔΙΚΟΥΣ ΜΑΣ κανόνες', () => {
      // Χωρίς αντιστοίχιση: demo project ⇒ ΑΝΟΙΧΤΟΙ προεπιλεγμένοι κανόνες (config.js), αλλιώς ρίψη.
      const scripts = Object.values(JSON.parse(fs.readFileSync(M.paths.of('package.json'), 'utf8')).scripts);
      const projects = scripts
        .filter((s) => /emulators:(exec|start)/.test(s) && /--only\s+\S*\bstorage\b/.test(s))
        .map((s) => (s.match(/--project\s+(\S+)/) || [])[1])
        .filter(Boolean);
      expect(projects.length).toBeGreaterThan(0);
      for (const project of projects) expect(() => M.declaredBucketOf(REAL, RC, project)).not.toThrow();
    });

    it('το .firebaserc ΔΕΝ ορίζει προεπιλεγμένο project — εντολή χωρίς --project δεν φτάνει ποτέ στην παραγωγή', () => {
      expect(RC.projects).toBeUndefined();
    });
  });
});

describe('ADR-865 §10 — live.js με ψεύτικη μεταφορά', () => {
  const FIREBASE_JSON = { firestore: { rules: 'firestore.rules.compiled', indexes: 'firestore.indexes.json' }, storage: { rules: 'storage.rules' } };

  function fakeRoutes() {
    return {
      '/v1alpha/projects/demo-project/defaultBucket': { bucket: { name: 'projects/demo-project/buckets/def.app' } },
      '/v1/projects/demo-project/releases/cloud.firestore': { rulesetName: 'projects/demo-project/rulesets/r1', updateTime: 't' },
      '/v1/projects/demo-project/rulesets/r1': { source: { files: [{ name: 'f', content: WIRE }] } },
      '/v1/projects/demo-project/releases/firebase.storage/def.app': { rulesetName: 'projects/demo-project/rulesets/s1', updateTime: 't' },
      '/v1/projects/demo-project/rulesets/s1': { source: { files: [{ name: 's', content: STORAGE }] } },
      '/v1/projects/demo-project/databases/(default)': { databaseEdition: 'STANDARD' },
      '/v1/projects/demo-project/databases/(default)/collectionGroups/-/indexes': { indexes: [{ ...liveIndex(), name: 'projects/demo-project/databases/(default)/collectionGroups/files/indexes/i1' }], nextPageToken: 'p2' },
      '/v1/projects/demo-project/databases/(default)/collectionGroups/-/indexes?pageToken=p2': { indexes: [] },
    };
  }

  function fakeTransport(routes, calls) {
    const credential = { getAccessToken: async () => ({ access_token: 'tok', expires_in: 3600 }) };
    const fetchImpl = async (url, init) => {
      calls.push({ url, method: init.method, headers: init.headers });
      const u = new URL(url);
      const key = u.pathname + (u.searchParams.has('pageToken') ? `?pageToken=${u.searchParams.get('pageToken')}` : '');
      if (u.pathname.endsWith('/fields')) {
        return json(200, { fields: [
          { name: 'projects/demo-project/databases/(default)/collectionGroups/__default__/fields/*', indexConfig: { indexes: [] } },
          { name: 'projects/demo-project/databases/(default)/collectionGroups/audit_logs/fields/expiresAt', ttlConfig: { state: 'ACTIVE' },
            indexConfig: { indexes: liveOverride().indexes } },
        ] });
      }
      return key in routes ? json(200, routes[key]) : json(404, {});
    };
    return createTransport(PROJECT, { credential, fetchImpl });
  }

  const json = (status, body) => ({ status, ok: status < 400, statusText: '', json: async () => body });

  it('ρωτά ΜΟΝΟ με GET, με x-goog-user-project, και τα releases του deployer', async () => {
    const calls = [];
    const live = await loadLiveWorld({ project: PROJECT, firebaseJson: FIREBASE_JSON, transport: fakeTransport(fakeRoutes(), calls) });
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
    expect(calls.every((c) => c.headers['x-goog-user-project'] === PROJECT)).toBe(true);
    expect(calls.some((c) => c.url.endsWith('/releases/firebase.storage/def.app'))).toBe(true);
    expect(calls.some((c) => /\/releases\/firebase\.storage$/.test(c.url))).toBe(false);
    expect(D.judgeLive(desiredWorld(), live).exitCode).toBe(D.EXIT.OK);
  });

  it('ακολουθεί το nextPageToken και πετά το __default__ (όπως listFieldOverrides)', async () => {
    const live = await loadLiveWorld({ project: PROJECT, firebaseJson: FIREBASE_JSON, transport: fakeTransport(fakeRoutes(), []) });
    expect(live['firestore:indexes'].indexes).toHaveLength(1);
    expect(live['firestore:indexes'].fieldOverrides.map((o) => o.collectionGroup)).toEqual(['audit_logs']);
  });

  it('ο bucket ΔΕΝ ρωτιέται όταν τον ονομάζει το firebase.json', async () => {
    const calls = [];
    const routes = { ...fakeRoutes(), '/v1/projects/demo-project/releases/firebase.storage/own': fakeRoutes()['/v1/projects/demo-project/releases/firebase.storage/def.app'] };
    const firebaserc = { targets: { [PROJECT]: { storage: { main: ['own'] } } } };
    await loadLiveWorld({ project: PROJECT, firebaseJson: { ...FIREBASE_JSON, storage: [{ target: 'main', rules: 'storage.rules' }] }, firebaserc, transport: fakeTransport(routes, calls) });
    expect(calls.some((c) => c.url.includes('defaultBucket'))).toBe(false);
    expect(calls.some((c) => c.url.endsWith('/releases/firebase.storage/own'))).toBe(true);
  });

  it('🔴 target χωρίς αντιστοίχιση ⇒ {error} ΜΕ ΟΝΟΜΑ, καμία ανακάλυψη, καμία ετυμηγορία (fail-closed)', async () => {
    const calls = [];
    const live = await loadLiveWorld({ project: PROJECT, firebaseJson: { ...FIREBASE_JSON, storage: [{ target: 'main', rules: 'storage.rules' }] }, firebaserc: {}, transport: fakeTransport(fakeRoutes(), calls) });
    expect(live.storage.error).toContain('.firebaserc');
    expect(calls.some((c) => c.url.includes('defaultBucket'))).toBe(false);
    expect(D.judgeLive(desiredWorld(), live).exitCode).toBe(D.EXIT.ERROR);
  });

  it('🔴 σφάλμα παρόχου γίνεται {error} με τον λόγο της Google — ο κόσμος ΔΕΝ καταρρέει', async () => {
    const credential = { getAccessToken: async () => ({ access_token: 't', expires_in: 3600 }) };
    const body = { error: { message: 'needs quota project', status: 'PERMISSION_DENIED',
      details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SERVICE_DISABLED' }] } };
    const transport = createTransport(PROJECT, { credential, fetchImpl: async () => json(403, body) });
    const live = await loadLiveWorld({ project: PROJECT, firebaseJson: FIREBASE_JSON, transport });
    expect(live['firestore:rules'].error).toContain('403 SERVICE_DISABLED');
    expect(D.judgeLive(desiredWorld(), live).exitCode).toBe(D.EXIT.ERROR);
  });

  it('το project ΔΕΝ μαντεύεται', () => {
    expect(resolveProject([], {})).toBeNull();
    expect(resolveProject(['--project', 'p'], {})).toBe('p');
    expect(resolveProject([], { FIREBASE_PROJECT_ID: 'e' })).toBe('e');
  });
});

describe('🌍 ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΑΠΟΘΕΤΗΡΙΟ', () => {
  it('το επιθυμητό έχει και τους τρεις στόχους, με τα bytes του δίσκου', () => {
    const desired = loadDesired(loadWorld({ tree: 'HEAD' }));
    expect(Object.keys(desired).sort()).toEqual(['firestore:indexes', 'firestore:rules', 'storage']);
    expect(desired['firestore:indexes'].indexes.length).toBeGreaterThan(0);
  });

  it('🔴 CRLF: η ανάπτυξη storage της 2026-09-18 ανασυντίθεται από το git (δίσκος CRLF · blob LF)', () => {
    const row = M.loadLedger().deployments.find((r) => r.target === 'storage' && r.commit === '78b75dc1');
    expect(row).toBeDefined();
    const { bytes, why } = recordedBytes(row);
    expect(why).toBeNull();
    expect(M.digestOf(bytes)).toBe(row.digest);
  });
});
