/**
 * Άγκυρα — ο ελεγκτής ακεραιότητας **παράγει** την κλάση, δεν την αντιγράφει.
 *
 * ## Τι κλειδώνει
 *
 * Ο `audit-dangling-foreign-keys.js` δεν κουβαλά χειρόγραφο πίνακα συλλογών: ρωτά
 * το **ίδιο το `firestore.rules`** μέσω του parser της CHECK 3.16. Αυτή η άγκυρα
 * **εκτελεί** την παραγωγή — δεν διαβάζει το κείμενο του script — και απαιτεί:
 *
 *   1. να βρίσκει **ακριβώς** όσες συλλογές βρίσκει και το ωμό grep του αρχείου·
 *   2. να δίνει το **σωστό ξένο κλειδί** και τη **σωστή συλλογή γονέα** για καθεμία·
 *   3. να **αντιδρά** σε αλλαγή των κανόνων — αν προστεθεί ενδέκατη, να τη δει
 *      **χωρίς αλλαγή κώδικα**.
 *
 * ⚠️ Το (3) είναι το κρίσιμο: μια άγκυρα που ζητά μόνο `toHaveLength(10)` θα ήταν
 * πράσινη και πάνω σε χειρόγραφο πίνακα. Εδώ η παραγωγή τρέχει **δύο φορές, πάνω σε
 * δύο διαφορετικά κείμενα κανόνων**, και συγκρίνεται η **διαφορά** τους.
 *
 * @see ADR-823
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  deriveForeignKeyClass,
  TENANT_FIELD,
} = require('../audit-dangling-foreign-keys');

const RULES_PATH = path.resolve(__dirname, '..', '..', 'firestore.rules');
const RULES = fs.readFileSync(RULES_PATH, 'utf8');

describe('audit-dangling-foreign-keys — η κλάση ΠΑΡΑΓΕΤΑΙ από τους κανόνες', () => {
  const derived = deriveForeignKeyClass(RULES);

  it('βρίσκει όσες ακριβώς βρίσκει και το ωμό grep του αρχείου κανόνων', () => {
    const rawCount = RULES.split('\n').filter((line) =>
      /belongsTo(Project|Building)Company\(resource\.data/.test(line),
    ).length;

    expect(derived).toHaveLength(rawCount);
  });

  it('κάθε εγγραφή δηλώνει ξένο κλειδί ΚΑΙ συλλογή γονέα', () => {
    for (const entry of derived) {
      expect(typeof entry.collection).toBe('string');
      expect(entry.collection.length).toBeGreaterThan(0);
      expect(['projectId', 'buildingId']).toContain(entry.foreignKey);
      expect(['projects', 'buildings']).toContain(entry.parent);
      expect(entry.line).toBeGreaterThan(0);
    }
  });

  it('το ξένο κλειδί ΤΑΙΡΙΑΖΕΙ με τη συλλογή γονέα (όχι σταυρωτά)', () => {
    for (const entry of derived) {
      const expected = entry.foreignKey === 'buildingId' ? 'buildings' : 'projects';
      expect(entry.parent).toBe(expected);
    }
  });

  // =========================================================================
  // 🔑 Ο ΠΥΡΗΝΑΣ: ΑΝΤΙΔΡΑ σε αλλαγή κανόνων — δεν είναι χειρόγραφος πίνακας
  // =========================================================================
  it('ΕΝΔΕΚΑΤΗ συλλογή στους κανόνες εμφανίζεται ΧΩΡΙΣ αλλαγή κώδικα', () => {
    const injected = RULES.replace(
      '    match /floors/{floorId} {',
      [
        '    match /zz_anchor_probe/{id} {',
        '      allow read: if isAuthenticated()',
        '                  && (',
        '                       isSuperAdminOnly()',
        '                       || belongsToBuildingCompany(resource.data.buildingId)',
        '                     );',
        '    }',
        '',
        '    match /floors/{floorId} {',
      ].join('\n'),
    );
    expect(injected).not.toBe(RULES); // η ένεση ΕΦΑΡΜΟΣΤΗΚΕ — αλλιώς άκυρη μέτρηση

    const after = deriveForeignKeyClass(injected);
    expect(after).toHaveLength(derived.length + 1);

    const added = after.find((e) => e.collection === 'zz_anchor_probe');
    expect(added).toBeDefined();
    expect(added.foreignKey).toBe('buildingId');
    expect(added.parent).toBe('buildings');
  });

  it('συλλογή που ΦΕΥΓΕΙ από την κλάση εξαφανίζεται από την παραγωγή', () => {
    // ⚠️ Η ΠΡΩΤΗ γραφή αυτού του test έκανε `RULES.replace(/…/)` **χωρίς** αγκύρωση
    // στο μπλοκ, και το ίδιο σχήμα υπάρχει σε εννέα συλλογές: αφαίρεσε το
    // `attendance_events` ενώ ισχυριζόταν ότι αφαιρεί το `properties`. Πράσινο
    // δεν θα ήταν — αλλά **κόκκινο για λάθος λόγο** είναι εξίσου άχρηστο.
    // Γι' αυτό η αφαίρεση γίνεται **μέσα στη φέτα** του συγκεκριμένου μπλοκ.
    const start = RULES.indexOf('    match /properties/{propertyId} {');
    expect(start).toBeGreaterThan(-1);
    const end = RULES.indexOf('\n    match /', start + 10);
    expect(end).toBeGreaterThan(start);

    const slice = RULES.slice(start, end);
    const strippedSlice = slice.replace(
      /\|\| \(resource\.data\.keys\(\)\.hasAny\(\['projectId'\]\)[\s\S]*?&& belongsToProjectCompany\(resource\.data\.projectId\)\)/,
      '|| belongsToCompany(resource.data.companyId)',
    );
    expect(strippedSlice).not.toBe(slice); // η αφαίρεση ΕΦΑΡΜΟΣΤΗΚΕ

    const after = deriveForeignKeyClass(RULES.slice(0, start) + strippedSlice + RULES.slice(end));
    expect(after.map((e) => e.collection)).not.toContain('properties');
    expect(after.map((e) => e.collection)).toContain('attendance_events'); // ΜΟΝΟ ένα έφυγε
    expect(after).toHaveLength(derived.length - 1);
  });

  it('το πεδίο μισθωτή που ελέγχει είναι αυτό που φιλτράρει ο πελάτης', () => {
    // `tenant-config.ts`: το `PROPERTIES` δεν έχει override ⇒ προεπιλογή `companyId`.
    // Αν αυτό αλλάξει, ο ελεγκτής μετρά λάθος πεδίο και το εύρημα γίνεται θόρυβος.
    expect(TENANT_FIELD).toBe('companyId');
  });
});
