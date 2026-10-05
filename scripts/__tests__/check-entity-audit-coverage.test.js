/**
 * ΑΓΚΥΡΑ — CHECK 3.17: **βλέπει τη γραφή μέσω `withVersionCheck`, και δέχεται κοινό γραφέα ιστορικού
 * μόνο όσο αυτός όντως γράφει** (ADR-195, 2026-10-05).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το `PATCH /api/buildings` έγραφε κάθε ανθρώπινη αλλαγή μέσω `withVersionCheck`
 * χωρίς καμία εγγραφή ιστορικού, και η πύλη το έκρινε «καθαρό» — όχι επειδή καλυπτόταν, αλλά επειδή
 * κανένα από τα σχήματα γραφής της δεν εμφανίζεται στο σημείο κλήσης. Πράσινο από τύφλωση.
 *
 * Τα παραδείγματα είναι το σχήμα των πραγματικών αρχείων — όχι συνθετικές συμβολοσειρές.
 *
 * 2026-10-06 — **δηλωμένο πεδίο γραφής** (Σ1–Σ6 · Π5 · Π6): οι τέσσερις αλυσίδες ορόφου ήταν ΑΟΡΑΤΕΣ στην πύλη
 * (έγραφαν μέσω `flushInBatches` ή πάνω σε αναφορά από άλλο αρχείο) και την κάλυψή τους την κρατούσε μόνο το Π4.
 * Τώρα ο γραφέας παρτίδων απαιτεί δήλωση συλλογών, την επαληθεύει την ώρα της γραφής, και η πύλη τη διαβάζει.
 */

'use strict';

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  declaredWriteSites,
  detectTrackedWrites,
  hasRecordChangeCall,
  liveRecorderDelegates,
  stripCommentsAndStrings,
} = require('../check-entity-audit-coverage');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const keysOf = (source) => [...detectTrackedWrites(stripCommentsAndStrings(source)).keys];

describe('γραφή μέσω withVersionCheck', () => {
  it('Β1 — παρακολουθούμενη συλλογή μέσα στην κλήση ⇒ γραφή (το σχήμα του building-update.handler)', () => {
    const source = `
      import { withVersionCheck, ConflictError } from '@/lib/firestore/version-check';
      const versionResult = await withVersionCheck({
        db: adminDb,
        collection: COLLECTIONS.BUILDINGS,
        docId: buildingId,
        expectedVersion,
        updates: cleanUpdates,
        userId: ctx.uid,
      });`;

    expect(keysOf(source)).toEqual(['BUILDINGS']);
  });

  it('Β2 — το ίδιο για το withVersionCheckOnCurrent', () => {
    const source = `
      const { newVersion } = await withVersionCheckOnCurrent({
        db: adminDb, collection: COLLECTIONS.PROPERTIES, docId, userId, derive,
      });`;

    expect(keysOf(source)).toEqual(['PROPERTIES']);
  });

  it('Β3 — μη παρακολουθούμενη συλλογή ⇒ καμία γραφή', () => {
    const source = `await withVersionCheck({ db, collection: COLLECTIONS.DXF_VIEWER_LEVELS, docId, updates });`;

    expect(keysOf(source)).toEqual([]);
  });

  it('Β4 — σκέτη εισαγωγή του ονόματος (χωρίς κλήση) ΔΕΝ είναι γραφή', () => {
    const source = `
      import { withVersionCheck } from '@/lib/firestore/version-check';
      const stored = await db.collection(COLLECTIONS.BUILDINGS).doc(id).get();`;

    expect(keysOf(source)).toEqual([]);
  });

  it('Β5 — κλήση μέσα σε ΣΧΟΛΙΟ δεν μετρά', () => {
    const source = `
      // await withVersionCheck({ collection: COLLECTIONS.BUILDINGS })
      const stored = await db.collection(COLLECTIONS.BUILDINGS).doc(id).get();`;

    expect(keysOf(source)).toEqual([]);
  });

  it('Β6 — τα παλιά σχήματα συνεχίζουν να πιάνονται (καμία παλινδρόμηση)', () => {
    expect(keysOf(`await db.collection(COLLECTIONS.PROJECTS).doc(id).update(patch);`)).toEqual(['PROJECTS']);
    expect(keysOf(`await setDoc(doc(db, COLLECTIONS.CONTACTS, id), data);`)).toEqual(['CONTACTS']);
  });

  it('Β7 — ΔΗΛΩΜΕΝΟ τυφλό σημείο: γραφή με ΜΕΤΑΒΛΗΤΗ συλλογή παραμένει αόρατη', () => {
    // Δεν είναι επιθυμητό — είναι μετρημένο: η διεύρυνση έβγαζε ~80–90% ψευδώς θετικά. Αν αυτό
    // το test κοκκινίσει, κάποιος έκλεισε το κενό· σβήσε τη γραμμή από το pending-ratchet-work.
    const source = `await db.collection(job.collection).doc(job.docId).update(patch);`;

    expect(keysOf(source)).toEqual([]);
  });
});

describe('κάλυψη — άμεση ή μέσω δηλωμένου γραφέα', () => {
  it('Κ1 — άμεση κλήση EntityAuditService.recordChange', () => {
    expect(hasRecordChangeCall(`await EntityAuditService.recordChange({ entityId });`, [])).toBe(true);
  });

  it('Κ2 — κλήση ΖΩΝΤΑΝΟΥ δηλωμένου γραφέα μετρά ως κάλυψη', () => {
    expect(hasRecordChangeCall(`await recordEntityUpdate({ entityType, entityId, before, written, ctx });`, ['recordEntityUpdate'])).toBe(true);
  });

  it('Κ3 — ο ίδιος γραφέας, αν ΔΕΝ είναι ζωντανός, δεν μετρά', () => {
    expect(hasRecordChangeCall(`await recordEntityUpdate({ entityId });`, [])).toBe(false);
  });

  it('Κ4 — σκέτη εισαγωγή του γραφέα (χωρίς κλήση) δεν είναι κάλυψη', () => {
    const source = `import { recordEntityUpdate } from '@/services/audit/record-entity-update';`;

    expect(hasRecordChangeCall(source, ['recordEntityUpdate'])).toBe(false);
  });

  it('Κ5 — οι πραγματικοί κοινοί γραφείς είναι ζωντανοί (εξάγονται ΚΑΙ γράφουν)', () => {
    // Ο ανθρώπινος (PATCH κτιρίων/ορόφων) και ο παράγωγος (αλυσίδες ορόφου). Κλειστή λίστα: τρίτο όνομα
    // εδώ σημαίνει ότι κάποιος πρόσθεσε γραφέα — να είναι όντως ΚΟΙΝΟΣ, όχι παράκαμψη της πύλης.
    expect(liveRecorderDelegates(PROJECT_ROOT)).toEqual(['recordEntityUpdate', 'recordDerivedWrites']);
  });

  it('Κ6 — γραφέας που έπαψε να γράφει (ή λείπει) παύει να μετρά', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-delegate-'));
    const file = path.join(root, 'src/services/audit/record-entity-update.ts');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(liveRecorderDelegates(root)).toEqual([]);

      // Εξάγει τη συνάρτηση αλλά η κλήση στο βιβλίο έγινε σχόλιο.
      fs.writeFileSync(file, `export async function recordEntityUpdate() { /* EntityAuditService.recordChange() */ }`);
      expect(liveRecorderDelegates(root)).toEqual([]);

      fs.writeFileSync(file, `export async function recordEntityUpdate() { await EntityAuditService.recordChange({}); }`);
      expect(liveRecorderDelegates(root)).toEqual(['recordEntityUpdate']);
    } finally {
      quiet.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('τα πραγματικά αρχεία', () => {
  const analyse = (relative) => {
    const source = stripCommentsAndStrings(fs.readFileSync(path.join(PROJECT_ROOT, relative), 'utf8'));
    return {
      keys: [...detectTrackedWrites(source).keys],
      covered: hasRecordChangeCall(source, liveRecorderDelegates(PROJECT_ROOT)),
    };
  };

  it('Π1 — το PATCH των κτιρίων ΦΑΙΝΕΤΑΙ πλέον ως γραφέας, και είναι καλυμμένο', () => {
    expect(analyse('src/app/api/buildings/building-update.handler.ts')).toEqual({ keys: ['BUILDINGS'], covered: true });
  });

  it('Π2 — ο κλάδος της αντικειμενικής (withVersionCheckOnCurrent) το ίδιο', () => {
    expect(analyse('src/app/api/buildings/building-objective-value-patch.ts')).toEqual({ keys: ['BUILDINGS'], covered: true });
  });

  it('Π3 — το PATCH των ορόφων: η γραμμή γράφεται ΔΙΠΛΑ στη γραφή, όχι σε αδελφό αρχείο', () => {
    // Ως τις 2026-10-05 το ίχνος ζούσε στο `floor-update-effects.ts`, και η πύλη (που κρίνει ανά αρχείο)
    // σήμαινε τον handler — σωστά: γραφή και ίχνος σε δύο αρχεία χωρίζουν με την πρώτη αναδιάταξη.
    const handler = analyse('src/app/api/floors/floors.handlers.ts');

    expect(handler.keys).toContain('FLOORS');
    expect(handler.covered).toBe(true);
  });

  // Κάθε αλυσίδα του φακέλου, από τον ΔΙΣΚΟ — όχι από λίστα τεσσάρων ονομάτων: πέμπτη αλυσίδα μπαίνει μόνη της.
  const CASCADES = fs.readdirSync(path.join(PROJECT_ROOT, 'src/app/api/floors'))
    .filter((name) => /(?:cascade|reconcile).*\.service\.ts$/.test(name))
    .sort();

  it('Π4 — κάθε αλυσίδα ορόφου καλύπτεται από τον ΕΝΑ παράγωγο γραφέα, καμία δεν γράφει μόνη της', () => {
    // Δεύτερη άγκυρα δίπλα στην πύλη (Π5): ως τις 2026-10-06 ήταν η ΜΟΝΗ που κρατούσε την κάλυψη.
    expect(CASCADES.length).toBeGreaterThanOrEqual(4);

    for (const file of CASCADES) {
      const source = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/api/floors', file), 'utf8');

      expect(analyse(`src/app/api/floors/${file}`).covered).toBe(true);
      // Εκεί ζούσαν τα τέσσερα αντίγραφα του ίδιου `recordCascadeAudit`, με το uid του ανθρώπου.
      expect(source).not.toMatch(/EntityAuditService\s*\.\s*recordChange\s*\(/);
    }
  });

  it('Π5 — η πύλη ΒΛΕΠΕΙ πλέον κάθε αλυσίδα ως γραφέα, στις συλλογές που η ίδια ΔΗΛΩΝΕΙ', () => {
    // Ως τις 2026-10-06 αυτό το test έλεγε το αντίθετο (`seen` = []): καμία αλυσίδα δεν φαινόταν, γιατί έγραφαν με
    // `flushInBatches(db, updates)`, με `target.collection`, ή με `batch.update(ref, …)` πάνω σε αναφορά από ΑΛΛΟ
    // αρχείο. Τώρα δηλώνουν το πεδίο γραφής τους (`lib/admin-batch-utils.ts`) και η πύλη το διαβάζει.
    // Νέα αλυσίδα στον φάκελο ⇒ κοκκινίζει εδώ ώσπου να γραφτεί ΤΙ γράφει — επίτηδες.
    const seen = Object.fromEntries(
      CASCADES.map((file) => [file, analyse(`src/app/api/floors/${file}`).keys.sort()]),
    );

    expect(seen).toEqual({
      'floor-elevation-cascade.service.ts': ['FLOORS'],
      'floor-height-cascade.service.ts': ['FLOORPLAN_BEAMS', 'FLOORPLAN_COLUMNS', 'FLOORPLAN_SLABS', 'FLOORPLAN_WALLS'],
      'floor-ref-cascade.service.ts': ['PARKING_SPACES', 'PROPERTIES', 'STORAGE'],
      'floor-stack-reconcile.service.ts': ['FLOORS'],
    });
  });

  it('Π6 — ΜΕΤΑΛΛΑΞΗ: αλυσίδα που χάνει την κλήση του γραφέα ιστορικού γίνεται ΠΑΡΑΒΙΑΣΗ', () => {
    // Αυτό ακριβώς δεν μπορούσε να πιάσει η πύλη πριν: γραφή αόρατη ⇒ «καθαρό», με ή χωρίς ίχνος.
    const delegates = liveRecorderDelegates(PROJECT_ROOT);

    for (const file of CASCADES) {
      const real = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/api/floors', file), 'utf8');
      const mutated = stripCommentsAndStrings(real.replace(/\brecordDerivedWrites\s*\(/g, 'forgotToRecord('));

      expect(detectTrackedWrites(mutated).hasWrite).toBe(true);
      expect(hasRecordChangeCall(mutated, delegates)).toBe(false);
    }
  });
});

describe('δηλωμένο πεδίο γραφής — flushInBatches · openDeclaredBatch (2026-10-06)', () => {
  it('Σ1 — flushInBatches: ΚΑΘΕ παρακολουθούμενη συλλογή της δήλωσης είναι γραφή (το σχήμα του floor-ref-cascade)', () => {
    const source = `
      const flush = await flushInBatches(db, updates, {
        collections: [COLLECTIONS.PROPERTIES, COLLECTIONS.PARKING_SPACES, COLLECTIONS.STORAGE],
      });`;

    expect(keysOf(source)).toEqual(['PROPERTIES', 'PARKING_SPACES', 'STORAGE']);
  });

  it('Σ2 — openDeclaredBatch: η δήλωση αρκεί, ακόμη κι αν η γραφή γίνει αλλού (το σχήμα των δύο αλυσίδων στοίβας)', () => {
    const source = `
      const pending = openDeclaredBatch(db, [COLLECTIONS.FLOORS]);
      apply(pending, refById);`;

    expect(keysOf(source)).toEqual(['FLOORS']);
  });

  it('Σ3 — δηλωμένη ΜΗ παρακολουθούμενη συλλογή δεν είναι γραφή· μικτή δήλωση δίνει μόνο τις παρακολουθούμενες', () => {
    expect(keysOf(`await flushInBatches(db, updates, { collections: [COLLECTIONS.FILES], batchSize: 400 });`)).toEqual([]);
    expect(keysOf(`await flushInBatches(db, updates, { collections: [SUBCOLLECTIONS.USER_SESSIONS] });`)).toEqual([]);
    expect(keysOf(`const b = openDeclaredBatch(db, [COLLECTIONS.FILE_COMMENTS]);`)).toEqual([]);
    expect(keysOf(`await flushInBatches(db, updates, { collections: [COLLECTIONS.FILES, COLLECTIONS.BUILDINGS] });`))
      .toEqual(['BUILDINGS']);
  });

  it('Σ4 — δηλωμένη παρακολουθούμενη γραφή ΧΩΡΙΣ γραφέα ιστορικού = παραβίαση· με γραφέα = καλυμμένη', () => {
    const write = `await flushInBatches(db, updates, { collections: [COLLECTIONS.PROPERTIES] });`;
    const bare = stripCommentsAndStrings(write);
    const recorded = stripCommentsAndStrings(`${write}\nawait recordDerivedWrites(systemId, lines, actor, companyId);`);

    expect(detectTrackedWrites(bare).hasWrite).toBe(true);
    expect(hasRecordChangeCall(bare, ['recordDerivedWrites'])).toBe(false);
    expect(hasRecordChangeCall(recorded, ['recordDerivedWrites'])).toBe(true);
  });

  it('Σ5 — ό,τι ΔΕΝ είναι δήλωση δεν μετρά: ορισμός, εισαγωγή, σχόλιο, συλλογή έξω από τη λίστα', () => {
    expect(keysOf(`import { flushInBatches, openDeclaredBatch } from '@/lib/admin-batch-utils';`)).toEqual([]);
    expect(keysOf(`export async function flushInBatches(db, updates, scope) { return scope; }`)).toEqual([]);
    expect(keysOf(`// await flushInBatches(db, updates, { collections: [COLLECTIONS.FLOORS] });`)).toEqual([]);
    // Η παρακολουθούμενη συλλογή είναι όρισμα ΑΝΑΓΝΩΣΗΣ, όχι μέλος της δηλωμένης λίστας.
    expect(keysOf(`await flushInBatches(db, plan(COLLECTIONS.BUILDINGS), { collections: [COLLECTIONS.FILES] });`)).toEqual([]);
  });

  it('Σ6 — ΚΑΘΕ σημείο κλήσης στο src/ δηλώνει με ΚΥΡΙΟΛΕΚΤΙΚΑ — αλλιώς η πύλη διαβάζει κενή δήλωση', () => {
    // Ο τύπος επιβάλλει ΟΤΙ υπάρχει δήλωση και ο έλεγχος εκτέλεσης ότι είναι ΑΛΗΘΗΣ· κανένας από τους δύο δεν
    // επιβάλλει ότι είναι ΑΝΑΓΝΩΣΙΜΗ. Μια υπολογισμένη λίστα (`targets.map((t) => t.collection)`) τρέχει σωστά και
    // ξανακάνει το αρχείο αόρατο — το ίδιο πράσινο από τύφλωση που έκλεισε αυτή η διεύρυνση.
    // Χωρίς `--untracked` (μετρημένο: ~10s έναντι ~1s)· αρχείο που μόλις έγινε `git add` είναι ήδη στο ευρετήριο.
    const listed = execSync('git grep -lE "flushInBatches|openDeclaredBatch" -- src', {
      cwd: PROJECT_ROOT, encoding: 'utf8',
    });
    const files = listed.split('\n').map((line) => line.trim())
      .filter((file) => file && !/__tests__|\.test\.|lib\/admin-batch-utils\.ts$/.test(file));
    const literal = /^(?:SUB)?COLLECTIONS\.[A-Z0-9_]+$/;

    const sites = files.flatMap((file) =>
      declaredWriteSites(stripCommentsAndStrings(fs.readFileSync(path.join(PROJECT_ROOT, file), 'utf8')))
        .map((site) => ({ file, fn: site.fn, items: site.items })));
    const unreadable = sites.filter((site) =>
      site.items === null || site.items.length === 0 || !site.items.every((item) => literal.test(item)));

    // Μετρημένο 2026-10-06: 8 κλήσεις `flushInBatches` (2 αλυσίδες + 6 μεταπτώσεις) + 4 `openDeclaredBatch`.
    expect(sites.length).toBeGreaterThanOrEqual(12);
    expect(unreadable).toEqual([]);
  });
});
