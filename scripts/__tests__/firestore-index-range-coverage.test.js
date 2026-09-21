/**
 * @fileoverview Άγκυρα: η πύλη κάλυψης δεικτών (CHECK 3.15) βλέπει το **ΕΥΡΟΣ** (ADR-869 §7).
 *
 * 🔴 ΤΙ ΦΥΛΑΕΙ. Μέχρι τις 2026-09-20 το `QueryShape` **δεν είχε καν πεδίο εύρους**: κάθε
 * `where(x,'>=',v)` γινόταν προειδοποίηση «composite coverage uncertain» και η πύλη έκρινε
 * μόνο την **προβολή ισοτήτων** — δηλαδή ένα ερώτημα **άλλο** από αυτό που τρέχει.
 *
 * Το μετρημένο τίμημα: το `files` με `cdeReadReach == · isDeleted == · purgeAt <=` περνούσε
 * **πράσινο** (υπάρχει δείκτης `cdeReadReach↑, isDeleted↑`) ενώ η ζωντανή εκτέλεση επιστρέφει
 * `FAILED_PRECONDITION`. Το Firestore πρότεινε τότε ακριβώς `cdeReadReach↑, isDeleted↑,
 * purgeAt↑` — **ο ίδιος** δείκτης που υπολογίζει σήμερα το `requiredIndexFor`, και αυτό
 * ελέγχει η πρώτη ομάδα παρακάτω.
 *
 * ⚠️ Η άγκυρα **ΕΚΤΕΛΕΙ** τον κριτή· δεν διαβάζει τον κώδικά του (παγίδα #5 του handoff: ο
 * resolver του Telegram «φαινόταν σωστός» και δεν αντικαθιστούσε ΠΟΤΕ παράμετρο).
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  requiredIndexFor,
  indexCoversShape,
  findMatchingIndex,
  findCoveringIndexes,
  noIndexCarriesRangeFields,
  suggestIndexJson,
} = require('../_shared/firestore-index-matcher');
const { extractCallSitesFromFile } = require('../check-firestore-index-coverage');

/** Σχήμα όπως το παράγει το `deriveShapes` — εδώ του εκκαθαριστή αρχείων. */
function shape(over = {}) {
  return {
    collection: 'files',
    equalityFields: ['cdeReadReach', 'isDeleted'],
    orderBy: [],
    arrayContainsField: null,
    rangeFields: ['purgeAt'],
    variant: 'default+cdeReadReach',
    ...over,
  };
}

const idx = (...fields) => ({
  collectionGroup: 'files',
  queryScope: 'COLLECTION',
  fields: fields.map((f) => (
    f.endsWith('↓')
      ? { fieldPath: f.slice(0, -1), order: 'DESCENDING' }
      : { fieldPath: f.replace(/↑$/, ''), order: 'ASCENDING' }
  )),
});

describe('CHECK 3.15 × εύρος — ο απαιτούμενος δείκτης', () => {
  it('το πεδίο εύρους μπαίνει ΜΕΤΑ τις ισότητες — ταυτόσημο με ό,τι πρότεινε ζωντανά το Firestore', () => {
    const required = requiredIndexFor(shape());
    expect(required.status).toBe('required');
    expect(required.fields).toEqual([
      { fieldPath: 'cdeReadReach', order: 'ASCENDING' },
      { fieldPath: 'isDeleted', order: 'ASCENDING' },
      { fieldPath: 'purgeAt', order: 'ASCENDING' },
    ]);
  });

  it('🔴 Η ΙΔΙΑ Η ΒΛΑΒΗ: δείκτης με ΜΟΝΟ τις ισότητες ΔΕΝ καλύπτει το ερώτημα', () => {
    // Αυτός ο δείκτης ΥΠΑΡΧΕΙ στο firestore.indexes.json και ήταν ο λόγος του ψευδούς πράσινου.
    expect(indexCoversShape(idx('cdeReadReach', 'isDeleted'), shape())).toBe(false);
    expect(indexCoversShape(idx('cdeReadReach', 'isDeleted', 'purgeAt'), shape())).toBe(true);
  });

  it('δείκτης του εύρους ΧΩΡΙΣ το πεδίο του δρόμου ανάγνωσης δεν αρκεί', () => {
    // `isDeleted↑, purgeAt↑` υπάρχει — αλλά εξυπηρετεί το ερώτημα του Admin SDK, όχι αυτό.
    expect(indexCoversShape(idx('isDeleted', 'purgeAt'), shape())).toBe(false);
  });

  it('η πρόταση που τυπώνει η πύλη ΠΕΡΙΕΧΕΙ το πεδίο εύρους (αλλιώς προτείνει ό,τι απορρίπτει)', () => {
    const suggested = suggestIndexJson(shape());
    expect(suggested.fields.map((f) => f.fieldPath)).toEqual(['cdeReadReach', 'isDeleted', 'purgeAt']);
    expect(indexCoversShape(suggested, shape())).toBe(true);
  });

  it('ισότητα ΚΑΙ εύρος στο ΙΔΙΟ πεδίο ⇒ το πεδίο μπαίνει ΜΙΑ φορά, στη θέση του εύρους', () => {
    const required = requiredIndexFor(shape({ equalityFields: ['isDeleted', 'purgeAt'] }));
    expect(required.fields.map((f) => f.fieldPath)).toEqual(['isDeleted', 'purgeAt']);
  });
});

describe('CHECK 3.15 × εύρος — φορά ταξινόμησης', () => {
  it('ρητό orderBy στο πεδίο εύρους ⇒ η φορά είναι ΔΕΣΜΕΥΤΙΚΗ', () => {
    const s = shape({ orderBy: [{ field: 'purgeAt', direction: 'DESCENDING' }] });
    expect(indexCoversShape(idx('cdeReadReach', 'isDeleted', 'purgeAt↓'), s)).toBe(true);
    expect(indexCoversShape(idx('cdeReadReach', 'isDeleted', 'purgeAt↑'), s)).toBe(false);
  });

  it('ΧΩΡΙΣ ρητό orderBy η σάρωση γίνεται και αντίστροφα ⇒ δεκτές και οι δύο φορές', () => {
    expect(indexCoversShape(idx('cdeReadReach', 'isDeleted', 'purgeAt↑'), shape())).toBe(true);
    expect(indexCoversShape(idx('cdeReadReach', 'isDeleted', 'purgeAt↓'), shape())).toBe(true);
  });
});

describe('CHECK 3.15 × εύρος — όσα η πύλη ΑΡΝΕΙΤΑΙ να κρίνει', () => {
  it('🔴 ADR-870: ρητό orderBy σε ΑΛΛΟ πεδίο ΔΕΝ είναι άκυρο ερώτημα — το εύρος πάει ΤΕΛΟΣ', () => {
    // Ζωντανή μέτρηση 2026-09-21 (`rfqs`: companyId== status!= orderBy(title asc)): το
    // Firestore **πρότεινε δείκτη** `companyId↑, title↑, status↑` αντί να απορρίψει το
    // ερώτημα. Ο παλιός κανόνας («πρώτη ταξινόμηση = πεδίο εύρους») έλεγε «ΣΚΑΕΙ».
    const required = requiredIndexFor(shape({ orderBy: [{ field: 'createdAt', direction: 'ASCENDING' }] }));
    expect(required.status).toBe('required');
    expect(required.fields).toEqual([
      { fieldPath: 'cdeReadReach', order: 'ASCENDING' },
      { fieldPath: 'isDeleted', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'ASCENDING' },
      { fieldPath: 'purgeAt', order: 'ASCENDING' },
    ]);
  });

  it('🔴 ADR-870: η φορά του σιωπηρού εύρους ακολουθεί το ΤΕΛΕΥΤΑΙΟ ρητό orderBy', () => {
    // Ζωντανή μέτρηση (`rfqs`: status!= orderBy(title asc, budget desc)) ⇒ `title↑, budget↓, status↓`.
    const required = requiredIndexFor(shape({
      equalityFields: [],
      rangeFields: ['status'],
      orderBy: [{ field: 'title', direction: 'ASCENDING' }, { field: 'budget', direction: 'DESCENDING' }],
    }));
    expect(required.fields).toEqual([
      { fieldPath: 'title', order: 'ASCENDING' },
      { fieldPath: 'budget', order: 'DESCENDING' },
      { fieldPath: 'status', order: 'DESCENDING' },
    ]);
  });

  it('🔴 ADR-870: ΜΟΝΟ ισότητες ⇒ ελεύθερο — το Firestore συγχωνεύει μονοπεδιακούς', () => {
    // Ζωντανή μέτρηση (`audit_logs`: action== actorType== targetType==, κανένας σύνθετος
    // δείκτης σε δύο από τα τρία): επιστρέφει κανονικά. Η παλιά εκδοχή ζητούσε σύνθετο.
    const required = requiredIndexFor(shape({ equalityFields: ['a', 'b', 'c'], rangeFields: [] }));
    expect(required.status).toBe('free');
  });

  it('πολλαπλά πεδία εύρους ⇒ «δεν αποφασίζεται» — η πύλη ΔΕΝ μαντεύει επιλεκτικότητα', () => {
    const required = requiredIndexFor(shape({ rangeFields: ['purgeAt', 'createdAt'] }));
    expect(required.status).toBe('undecidable');
  });

  it('«δεν αποφασίζεται» ΔΕΝ σημαίνει «καλυμμένο»: κανένας δείκτης δεν το ικανοποιεί', () => {
    const s = shape({ rangeFields: ['purgeAt', 'createdAt'] });
    const catalog = new Map([['files', [idx('cdeReadReach', 'isDeleted', 'purgeAt', 'createdAt')]]]);
    expect(findMatchingIndex(catalog, s)).toBeNull();
  });

  it('🔴 ADR-870: «δεν αποφασίζεται» ΔΕΝ σωπαίνει όταν λείπουν ΚΑΙ ΤΑ ΔΥΟ πεδία εύρους', () => {
    // Ζωντανή μέτρηση: `tasks` με `reminderDate <=` + `reminderSent !=` ⇒ FAILED_PRECONDITION
    // σε cron job. Η σειρά είναι όντως άγνωστη — το «δεν έχεις ΚΑΝΕΝΑΝ» δεν είναι.
    const s = shape({ rangeFields: ['purgeAt', 'createdAt'] });
    expect(noIndexCarriesRangeFields(new Map([['files', [idx('isDeleted', 'purgeAt')]]]), s)).toBe(true);
    expect(noIndexCarriesRangeFields(new Map([['files', [idx('purgeAt', 'createdAt')]]]), s)).toBe(false);
  });
});

describe('CHECK 3.15 × εύρος — ΣΥΓΧΩΝΕΥΣΗ ΔΕΙΚΤΩΝ (ADR-870)', () => {
  /** `action== actorId== orderBy(timestamp desc)` — το σχήμα που μετρήθηκε ζωντανά. */
  const merged = () => ({
    collection: 'audit_logs',
    equalityFields: ['action', 'actorId'],
    orderBy: [{ field: 'timestamp', direction: 'DESCENDING' }],
    arrayContainsField: null,
    rangeFields: [],
    variant: 'admin',
  });
  const aidx = (...fields) => ({ ...idx(...fields), collectionGroup: 'audit_logs' });

  it('δύο δείκτες με ΚΟΙΝΗ ουρά ταξινόμησης καλύπτουν το ερώτημα — μετρημένο ζωντανά', () => {
    const catalog = new Map([['audit_logs', [aidx('action', 'timestamp↓'), aidx('actorId', 'timestamp↓')]]]);
    expect(findMatchingIndex(catalog, merged())).toBeNull();          // κανένας ΕΝΑΣ δεν αρκεί
    const cover = findCoveringIndexes(catalog, merged());
    expect(cover).not.toBeNull();
    expect(cover.mode).toBe('merge');
    expect(cover.indexes).toHaveLength(2);
  });

  it('🔴 ΤΟ ΟΡΙΟ: αν ΕΝΑ πεδίο ισότητας δεν έχει δικό του δείκτη, ΔΕΝ συγχωνεύεται', () => {
    // Ζωντανή μέτρηση: `action== actorType== orderBy(timestamp desc)` ⇒ FAILED_PRECONDITION,
    // επειδή το `actorType` δεν έχει `(actorType, timestamp↓)`.
    const catalog = new Map([['audit_logs', [aidx('action', 'timestamp↓')]]]);
    const shapeB = { ...merged(), equalityFields: ['action', 'actorType'] };
    expect(findCoveringIndexes(catalog, shapeB)).toBeNull();
  });

  it('η ουρά πρέπει να είναι Η ΙΔΙΑ — δείκτης με άλλη φορά δεν συγχωνεύεται', () => {
    const catalog = new Map([['audit_logs', [aidx('action', 'timestamp↓'), aidx('actorId', 'timestamp↑')]]]);
    expect(findCoveringIndexes(catalog, merged())).toBeNull();
  });
});

describe('CHECK 3.15 × εύρος — ο εξαγωγέας διαβάζει ΠΡΑΓΜΑΤΙΚΟ κώδικα', () => {
  let dir;
  const write = (name, source) => {
    const p = path.join(dir, name);
    fs.writeFileSync(p, source, 'utf8');
    return p;
  };

  beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idx-range-')); });
  afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  const preamble = "import { firestoreQueryService } from '@/services/firestore/firestore-query.service';\n";

  it('δύο τελεστές στο ΙΔΙΟ πεδίο είναι ΕΝΑ εύρος, όχι δύο', () => {
    const file = write('one-range.ts', `${preamble}
      export const run = () => firestoreQueryService.getAll('APPOINTMENTS', {
        constraints: [where('start', '>=', a), where('start', '<=', b)],
      });
    `);
    const [site] = extractCallSitesFromFile(file);
    expect(site.rangeFields).toEqual(['start']);
    expect(site.warnings).toEqual([]);
  });

  it('το εύρος ΔΕΝ είναι πια προειδοποίηση — έγινε δεδομένο του σχήματος', () => {
    const file = write('no-warning.ts', `${preamble}
      export const run = () => firestoreQueryService.getAll('TASKS', {
        constraints: [where('status', '==', 'open'), where('dueDate', '<=', d), orderBy('dueDate')],
      });
    `);
    const [site] = extractCallSitesFromFile(file);
    expect(site.equalityFields).toEqual(['status']);
    expect(site.rangeFields).toEqual(['dueDate']);
    expect(site.warnings.join(' ')).not.toMatch(/inequality|uncertain/);
  });

  it('τα `!=` / `not-in` μετρούν ΚΑΙ ΑΥΤΑ ως εύρος — ίδια θέση στον δείκτη', () => {
    const file = write('not-equal.ts', `${preamble}
      export const run = () => firestoreQueryService.getAll('CONTACTS', {
        constraints: [where('companyId', '==', c), where('status', '!=', 'deleted')],
      });
    `);
    const [site] = extractCallSitesFromFile(file);
    expect(site.rangeFields).toEqual(['status']);
  });
});
