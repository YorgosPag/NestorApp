/**
 * ΑΓΚΥΡΑ — CHECK 3.17: **βλέπει τη γραφή μέσω `withVersionCheck`, και δέχεται κοινό γραφέα ιστορικού
 * μόνο όσο αυτός όντως γράφει** (ADR-195, 2026-10-05).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το `PATCH /api/buildings` έγραφε κάθε ανθρώπινη αλλαγή μέσω `withVersionCheck`
 * χωρίς καμία εγγραφή ιστορικού, και η πύλη το έκρινε «καθαρό» — όχι επειδή καλυπτόταν, αλλά επειδή
 * κανένα από τα σχήματα γραφής της δεν εμφανίζεται στο σημείο κλήσης. Πράσινο από τύφλωση.
 *
 * Τα παραδείγματα είναι το σχήμα των πραγματικών αρχείων — όχι συνθετικές συμβολοσειρές.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
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
    expect(hasRecordChangeCall(`await recordBuildingUpdate({ buildingId, before, written, ctx });`, ['recordBuildingUpdate'])).toBe(true);
  });

  it('Κ3 — ο ίδιος γραφέας, αν ΔΕΝ είναι ζωντανός, δεν μετρά', () => {
    expect(hasRecordChangeCall(`await recordBuildingUpdate({ buildingId });`, [])).toBe(false);
  });

  it('Κ4 — σκέτη εισαγωγή του γραφέα (χωρίς κλήση) δεν είναι κάλυψη', () => {
    const source = `import { recordBuildingUpdate } from './_shared/building-update-audit';`;

    expect(hasRecordChangeCall(source, ['recordBuildingUpdate'])).toBe(false);
  });

  it('Κ5 — ο πραγματικός γραφέας κτιρίων είναι ζωντανός (εξάγεται ΚΑΙ γράφει)', () => {
    expect(liveRecorderDelegates(PROJECT_ROOT)).toContain('recordBuildingUpdate');
  });

  it('Κ6 — γραφέας που έπαψε να γράφει (ή λείπει) παύει να μετρά', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-delegate-'));
    const file = path.join(root, 'src/app/api/buildings/_shared/building-update-audit.ts');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(liveRecorderDelegates(root)).toEqual([]);

      // Εξάγει τη συνάρτηση αλλά η κλήση στο βιβλίο έγινε σχόλιο.
      fs.writeFileSync(file, `export async function recordBuildingUpdate() { /* EntityAuditService.recordChange() */ }`);
      expect(liveRecorderDelegates(root)).toEqual([]);

      fs.writeFileSync(file, `export async function recordBuildingUpdate() { await EntityAuditService.recordChange({}); }`);
      expect(liveRecorderDelegates(root)).toEqual(['recordBuildingUpdate']);
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
});
