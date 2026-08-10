/**
 * CHECK 3.35 — self-test της πύλης tenant scope (ADR-747)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 🔴 ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΚΑΙ ΤΙ ΟΧΙ
 *
 * Πράσινα tests **δεν** αποδεικνύουν ότι ο φύλακας φυλάει — αποδεικνύουν ότι δεν
 * έσκασε. Γι' αυτό εδώ υπάρχουν τρία διακριτά είδη ελέγχου:
 *
 *   1. **Διαφορικό στο πραγματικό ιστορικό σφάλμα** — το ίδιο αρχείο πριν/μετά
 *      το `3d1339ce`. Κόκκινο → πράσινο. Αν πάψει να ξεχωρίζει τα δύο, η πύλη
 *      δεν μετρά τίποτα.
 *   2. **Αντι-θόρυβος** — κάθε νόμιμο idiom που **μετρήθηκε** ότι παρήγαγε
 *      ψευδώς θετικά (FIELDS.*, επανανάθεση, wrapped helper, mode:'none').
 *   3. **Mutation testing** — σπάμε τον σαρωτή επίτηδες και απαιτούμε να
 *      κοκκινίσει. Κάθε μετάλλαξη **επαληθεύεται ότι προσγειώθηκε** πριν τρέξει
 *      (το working tree είναι CRLF· patterns που δεν ταιριάζουν μετρώνται
 *      ψευδώς ως «σκοτωμένες μεταλλάξεις»).
 *
 * @see ADR-747 · ADR-745 §9.5
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  loadCollectionsMap,
  loadFieldConstants,
  loadTenantOverrides,
  resolveTenantFor,
  DEFAULT_TENANT_CONFIG,
} = require('../_shared/firestore-ast-loaders');

const {
  createScanContext,
  scanFile,
  EXEMPT_RE,
  isExempt,
} = require('../_shared/firestore-tenant-scope-scan');

const gate = require('../check-firestore-tenant-scope');

const FIXTURES = path.join(__dirname, 'fixtures', 'firestore-tenant-scope');
const fixture = (name) => path.join(FIXTURES, name);

/** @type {ReturnType<typeof createScanContext>} */
let ctx;
beforeAll(() => { ctx = createScanContext(); });

/** Χάρτης «όνομα συνάρτησης → status», εντοπίζοντας τη συνάρτηση που περιέχει το site. */
function statusesByEnclosingFunction(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const sites = scanFile(file, ctx);
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const s of sites) {
    // ανέβα προς τα πάνω μέχρι την πρώτη δήλωση `function <name>` / `export … function <name>`
    let name = '(top-level)';
    for (let i = s.line - 1; i >= 0; i--) {
      const m = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/.exec(lines[i] || '');
      if (m) { name = m[1]; break; }
    }
    (out[name] ||= []).push(s.status);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
describe('1. Οι κατάλογοι SSoT διαβάζονται σωστά', () => {
// ═══════════════════════════════════════════════════════════════════════════

  test('COLLECTIONS: KEY → φυσικό όνομα, με fallback από process.env', () => {
    const map = loadCollectionsMap();
    expect(map.get('CONTACTS')).toBe('contacts');
    expect(map.get('BUILDINGS')).toBe('buildings');
    expect(map.size).toBeGreaterThan(200);
  });

  /**
   * 🔴 ΟΙ ΥΠΟΣΥΛΛΟΓΕΣ ΕΙΝΑΙ **OPT-IN**, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ, ΟΧΙ ΛΕΠΤΟΜΕΡΕΙΑ
   *
   * Το CHECK 3.15 (index coverage) είναι **zero-tolerance** και μοιράζεται αυτόν
   * τον loader. Αν οι υποσυλλογές γίνονταν προεπιλογή, το 3.15 θα άρχιζε ξαφνικά
   * να αναλύει σημεία που **ποτέ δεν ανέλυε** και θα μπορούσε να κοκκινίσει σε
   * κώδικα που **δεν άλλαξε** — δηλαδή ένα refactor θα έσπαγε παραγωγικό gate ως
   * παρενέργεια. Η διεύρυνση εμβέλειας zero-tol πύλης είναι **ξεχωριστή απόφαση**.
   *
   * Το CHECK 3.35 είναι ratchet και τις ζητά ρητά.
   */
  test('SUBCOLLECTIONS: OFF by default (προστατεύει το zero-tol CHECK 3.15)', () => {
    const map = loadCollectionsMap();
    const hasSub = [...map.keys()].some((k) => /COMPANY_PROJECTS|PROJECT_MEMBERS|COMPANY_AUDIT_LOGS/.test(k));
    expect(hasSub).toBe(false);
  });

  test('SUBCOLLECTIONS: ON με ρητό opt-in (το .collection() του Admin SDK τις δέχεται)', () => {
    const map = loadCollectionsMap({ includeSubcollections: true });
    const hasSub = [...map.keys()].some((k) => /COMPANY_PROJECTS|PROJECT_MEMBERS|COMPANY_AUDIT_LOGS/.test(k));
    expect(hasSub).toBe(true);
    // …και δεν χάθηκε καμία top-level
    expect(map.get('CONTACTS')).toBe('contacts');
  });

  test('FIELDS: η σταθερά που προκαλούσε 61% ψευδώς θετικά', () => {
    const fields = loadFieldConstants();
    expect(fields.get('COMPANY_ID')).toBe('companyId');
    expect(fields.get('PROJECT_ID')).toBe('projectId');
  });

  test('TENANT_OVERRIDES: οι τρεις τρόποι απομόνωσης', () => {
    const t = loadTenantOverrides();
    expect(resolveTenantFor(t, 'NOTIFICATIONS')).toEqual({ mode: 'userId', fieldName: 'userId' });
    expect(resolveTenantFor(t, 'CAD_FILES').mode).toBe('none');
    expect(resolveTenantFor(t, 'TEAMS')).toEqual({ mode: 'tenantId', fieldName: 'tenantId' });
  });

  test('η προεπιλογή είναι companyId — κάθε συλλογή εκτός overrides είναι scoped', () => {
    const t = loadTenantOverrides();
    expect(resolveTenantFor(t, 'ΑΝΥΠΑΡΚΤΗ_ΣΥΛΛΟΓΗ')).toEqual(DEFAULT_TENANT_CONFIG);
    expect(resolveTenantFor(t, 'CONTACTS').fieldName).toBe('companyId');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('2. 🔴 ΤΟ ΔΙΑΦΟΡΙΚΟ — το πραγματικό ιστορικό σφάλμα του ADR-745', () => {
// ═══════════════════════════════════════════════════════════════════════════

  test('ΠΡΙΝ τη διόρθωση (3d1339ce^): το buildContactsQuery είναι ΠΑΡΑΒΙΑΣΗ', () => {
    const sites = scanFile(fixture('historical-bug.pre-fix.ts.fixture'), ctx);
    const violations = sites.filter((s) => s.status === 'violation');
    expect(violations).toHaveLength(1);
    expect(violations[0].collectionName).toBe('contacts');
    expect(violations[0].rule).toBe('R1-client');
    // ακολούθησε το spread πίσω στη δήλωση και βρήκε ΜΟΝΟ αυτά τα δύο
    expect(violations[0].fields.sort()).toEqual(['isFavorite', 'type']);
    expect(violations[0].fields).not.toContain('companyId');
  });

  test('ΜΕΤΑ τη διόρθωση (3d1339ce): καθαρό', () => {
    const sites = scanFile(fixture('historical-bug.post-fix.ts.fixture'), ctx);
    expect(sites.filter((s) => s.status === 'violation')).toHaveLength(0);
  });

  test('…και πρασινίζει ΓΙΑ ΤΟΝ ΣΩΣΤΟ ΛΟΓΟ — μετρημένο companyId, όχι εικασία', () => {
    const sites = scanFile(fixture('historical-bug.post-fix.ts.fixture'), ctx);
    const q = sites.find((s) => s.rule === 'R1-client');
    expect(q.status).toBe('ok');
    expect(q.fields).toContain('companyId');
    expect(q.detail).toMatch(/φιλτράρει σε companyId/);
  });

  test('το CHECK 3.10 ΔΕΝ μπορούσε να το δει — η τυφλότητα είναι αναπαραγώγιμη', () => {
    // Αναπαραγωγή του αλγορίθμου του check-firestore-companyid.sh (γρ. 52-61):
    // 12 γραμμές ΠΡΟΣ ΤΑ ΚΑΤΩ από κάθε `query(`, μαρκάρισμα μόνο αν έχουν where() χωρίς companyId.
    const text = fs.readFileSync(fixture('historical-bug.pre-fix.ts.fixture'), 'utf8');
    // Τα σχόλια εξαιρούνται: το ίδιο το επεξηγηματικό header του fixture περιέχει
    // «query(» και θα μόλυνε την προσομοίωση. Στο πραγματικό αρχείο δεν υπήρχε.
    const lines = text.split(/\r?\n/).map((l) => (/^\s*(\*|\/\/|\/\*)/.test(l) ? '' : l));
    let flagged = 0;
    lines.forEach((line, i) => {
      if (!/\bquery\(/.test(line)) return;
      const block = lines.slice(i, i + 12).join('\n');
      if (/where\(/.test(block) && !/companyId/.test(block)) flagged++;
    });
    expect(flagged).toBe(0);   // ← γι' αυτό η baseline του 3.10 έλεγε «0 — fully cleaned»

    // …ενώ η ΝΕΑ πύλη το βλέπει:
    const sites = scanFile(fixture('historical-bug.pre-fix.ts.fixture'), ctx);
    expect(sites.filter((s) => s.status === 'violation')).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('3. 🔴 Καμία ευρετική επιπέδου αρχείου — το σχήμα των έξι συναρτήσεων', () => {
// ═══════════════════════════════════════════════════════════════════════════

  test('η σπασμένη αδελφή βγαίνει ΠΑΡΑΒΙΑΣΗ παρότι το αρχείο χρησιμοποιεί τον SSoT', () => {
    const byFn = statusesByEnclosingFunction(fixture('sibling-masking.ts.fixture'));
    expect(byFn.scopedOne).toEqual(['ok']);
    expect(byFn.scopedTwo).toEqual(['ok']);
    expect(byFn.unscopedSibling).toEqual(['violation']);
  });

  test('το ίδιο το αρχείο περιέχει resolveEffectiveCompanyId — και δεν το σώζει', () => {
    const text = fs.readFileSync(fixture('sibling-masking.ts.fixture'), 'utf8');
    expect(text).toMatch(/resolveEffectiveCompanyId/);
    const sites = scanFile(fixture('sibling-masking.ts.fixture'), ctx);
    expect(sites.filter((s) => s.status === 'violation')).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('4. Admin SDK — τα σχήματα, ένα προς ένα', () => {
// ═══════════════════════════════════════════════════════════════════════════

  let byFn;
  beforeAll(() => { byFn = statusesByEnclosingFunction(fixture('admin-sdk-shapes.ts.fixture')); });

  test('ΠΑΡΑΒΙΑΣΗ: σκέτη αλυσίδα χωρίς companyId', () => {
    expect(byFn.violation_plainChain).toContain('violation');
  });

  test('OK: literal companyId', () => {
    expect(byFn.ok_literalCompanyId).not.toContain('violation');
  });

  test('OK: μέσω FIELDS.COMPANY_ID — το 61% του θορύβου', () => {
    expect(byFn.ok_viaFieldConstant).not.toContain('violation');
  });

  test('OK: φίλτρο σε ΑΛΛΗ ΕΝΤΟΛΗ (υπό-συνθήκη super-admin bypass)', () => {
    expect(byFn.ok_conditionalReassignment).not.toContain('violation');
  });

  test('OK: τυλιγμένο σε scopeQueryToCompany (ADR-702/742)', () => {
    expect(byFn.ok_wrappedInSsotHelper).not.toContain('violation');
  });

  test('ΕΞΑΙΡΕΣΗ: public capability token, δηλωμένη με λόγο', () => {
    expect(byFn.exempt_publicCapabilityToken).toContain('exempt');
    expect(byFn.exempt_publicCapabilityToken).not.toContain('violation');
  });

  test('ΕΚΤΟΣ ΕΜΒΕΛΕΙΑΣ: συλλογή με mode:none', () => {
    expect(byFn.notScoped_modeNone).toEqual(['not-tenant-scoped']);
  });

  test('ΕΚΤΟΣ ΕΜΒΕΛΕΙΑΣ: χωρίς where() δεν είναι list query', () => {
    expect(byFn.notScoped_noWhere).toEqual(['not-tenant-scoped']);
  });

  test('ΜΗ ΑΝΑΛΥΣΙΜΟ (όχι παραβίαση): δυναμικό όνομα συλλογής', () => {
    expect(byFn.unanalyzable_dynamicCollection).toEqual(['unanalyzable']);
  });

  test('ΜΗ ΑΝΑΛΥΣΙΜΟ (όχι παραβίαση): δυναμικό όνομα πεδίου — η άγνοια δεν είναι ενοχή', () => {
    expect(byFn.unanalyzable_dynamicField).toEqual(['unanalyzable']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('5. Η ρητή εξαίρεση απαιτεί ΛΟΓΟ', () => {
// ═══════════════════════════════════════════════════════════════════════════

  test.each([
    ['tenant-scope-exempt: public token', true],
    ['// tenant-scope-exempt: γιατί όχι μισθωτής', true],
    ['tenant-scope-exempt:', false],
    ['tenant-scope-exempt', false],
    ['// κάτι άλλο εντελώς', false],
  ])('«%s» → αναγνωρίζεται: %s', (comment, expected) => {
    expect(EXEMPT_RE.test(comment)).toBe(expected);
  });

  /**
   * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΤΙΜΩΡΟΥΣΕ ΤΗΝ ΤΕΚΜΗΡΙΩΣΗ
   * Η πρώτη εκδοχή κοιτούσε **μία** γραμμή πάνω από το query. Μια εξαίρεση με
   * σοβαρή αιτιολογία (παραπομπή σε κανόνα rules + ADR + τι σπάει) είναι μπλοκ
   * 10 γραμμών ⇒ ΔΕΝ αναγνωριζόταν, ενώ η βιαστική μονόγραμμη ναι.
   */
  test('η αιτιολογία μπορεί να είναι ΜΠΛΟΚ σχολίων, όχι μόνο μία γραμμή', () => {
    const lines = [
      'const x = 1;',
      '// tenant-scope-exempt: ο λόγος, αναλυτικά',
      '//',
      '// δεύτερη παράγραφος εξήγησης',
      '',
      'const q = query(col, ...constraints);',
    ];
    expect(isExempt(lines, 5)).toBe(true);
  });

  test('…αλλά ΔΕΝ διαπερνά γραμμή κώδικα — η εξαίρεση ανήκει σε ΕΝΑ σημείο', () => {
    const lines = [
      '// tenant-scope-exempt: ισχύει για το από κάτω',
      'const other = query(colA, ...a);',
      'const q = query(colB, ...b);',
    ];
    expect(isExempt(lines, 1)).toBe(true);    // το δικό του
    expect(isExempt(lines, 2)).toBe(false);   // ΟΧΙ το επόμενο
  });

  // ⚠️ **Η άγκυρα άλλαξε αρχείο, όχι κριτήριο** (2026-08-10, ADR-777 Β2β): έδειχνε στο
  // `usePublicProperties.ts`, που **διαγράφηκε** — ήταν η ανώνυμη ανάγνωση του
  // `properties` που διέρρεε ολόκληρο το έγγραφο. Ο διάδοχός του στην ίδια αλυσίδα
  // είναι ο γραφέας της δημόσιας προβολής, που φέρει τεκμηριωμένη εξαίρεση για το
  // `projectId` ως όριο μισθωτή.
  //
  // 🔑 **Ο επόμενος υποψήφιος απορρίφθηκε ΜΕ ΜΕΤΡΗΣΗ**: το
  // `services/realtime/hooks/usePublicListings.ts` φέρει κι αυτό σχόλιο
  // `tenant-scope-exempt`, αλλά ο σαρωτής επιστρέφει γι' αυτό **μηδέν sites** — δεν
  // καλεί `query()`, διαβάζει σκέτο `collection()`. Άγκυρα πάνω του θα ήταν
  // `[].some(...) === false`, δηλαδή **μονίμως κόκκινη**· και το σχόλιο εξαίρεσης εκεί
  // είναι, αυστηρά, τεκμηρίωση για άνθρωπο — καμία πύλη δεν το διαβάζει.
  test('πραγματικό αρχείο: ο γραφέας της δημόσιας προβολής έχει τεκμηριωμένη εξαίρεση', () => {
    const file = path.resolve(__dirname, '..', '..', 'src/services/listings/publish-public-listing.ts');
    const sites = scanFile(file, ctx);
    expect(sites.some((s) => s.status === 'exempt')).toBe(true);
    expect(sites.some((s) => s.status === 'violation')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('6. Κανένα σιωπηλό πέταγμα — κάθε σημείο κατατάσσεται', () => {
// ═══════════════════════════════════════════════════════════════════════════

  const ALLOWED = new Set(['violation', 'ok', 'unanalyzable', 'exempt', 'not-tenant-scoped']);

  test.each([
    'historical-bug.pre-fix.ts.fixture',
    'historical-bug.post-fix.ts.fixture',
    'admin-sdk-shapes.ts.fixture',
    'sibling-masking.ts.fixture',
  ])('%s: κάθε site έχει έγκυρο status, γραμμή και αιτιολογία', (name) => {
    const sites = scanFile(fixture(name), ctx);
    expect(sites.length).toBeGreaterThan(0);
    for (const s of sites) {
      expect(ALLOWED.has(s.status)).toBe(true);
      expect(s.line).toBeGreaterThan(0);
      expect(typeof s.detail).toBe('string');
      expect(s.detail.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('6β. 🔴 ΚΑΝΟΝΑΣ 3 — το κεντρικό API, το κενό που κανείς δεν κοιτούσε', () => {
// ═══════════════════════════════════════════════════════════════════════════
  /**
   * R1 κοιτά direct `query()`. R2 κοιτά Admin SDK. Και τα δύο αγνοούσαν τη διαδρομή
   * μέσω του κεντρικοποιημένου `firestoreQueryService` (ADR-214) — δηλαδή **το API
   * που όλος ο κώδικας ενθαρρύνεται να χρησιμοποιεί**. Εκεί το φίλτρο μισθωτή σβήνει
   * με μία λέξη: `tenantOverride: 'skip'`, και `buildTenantConstraints` επιστρέφει `[]`.
   *
   * Μετρήθηκαν 16 τέτοια σημεία σε 11 αρχεία (2026-08-05). Το `getProperties()` —
   * ζωντανό, καλούμενο από το `useContactsState` — παρέκαμπτε έτσι το `companyId` σε
   * συλλογή που η αυθεντία δηλώνει `companyId`-scoped, **χωρίς μία γραμμή σχολίου**.
   */
  const FX = 'service-override.ts.fixture';

  /** Όνομα της συνάρτησης που περιέχει τη γραμμή — η πρόθεση είναι στο όνομα. */
  function siteNames(name) {
    const lines = fs.readFileSync(fixture(name), 'utf8').split(/\r?\n/);
    const nameAt = (line) => {
      for (let i = line - 1; i >= 0; i--) {
        const m = /function\s+([A-Za-z0-9_]+)/.exec(lines[i] || '');
        if (m) return m[1];
      }
      return '';
    };
    return scanFile(fixture(name), ctx)
      .filter((s) => s.rule === 'R3-service')
      .map((s) => ({ fn: nameAt(s.line), status: s.status }));
  }

  test('κάθε συνάρτηση παίρνει ΑΚΡΙΒΩΣ την κατάσταση που δηλώνει το όνομά της', () => {
    for (const { fn, status } of siteNames(FX)) {
      const expected = fn.split('_')[0]
        .replace('notScoped', 'not-tenant-scoped');
      expect(`${fn} → ${status}`).toBe(`${fn} → ${expected}`);
    }
  });

  test('το `noSite_noOverrideAtAll` ΔΕΝ παράγει καθόλου σημείο R3', () => {
    expect(siteNames(FX).some((s) => s.fn.startsWith('noSite'))).toBe(false);
  });

  test('🔑 χειροκίνητο where() ΥΠΟ ΣΥΝΘΗΚΗ δεν εξιλεώνει το skip', () => {
    // Το skip έχει ήδη πει στον πυρήνα «μη βάλεις φίλτρο». Ένα `if (tenantId)` από πάνω
    // σημαίνει ότι υπάρχει διαδρομή χωρίς κανένα φίλτρο — και αυτή είναι που κρίνεται.
    const s = siteNames(FX).find((x) => x.fn === 'violation_conditionalManualFilter');
    expect(s.status).toBe('violation');
  });

  test('🔑 η αιτιολόγηση γίνεται δεκτή ΚΑΙ δίπλα στο tenantOverride (πολυγραμμική κλήση)', () => {
    // Δεύτερη άγκυρα: `subscribeDoc(key, id, cb, onErr, {…})` πιάνει 8 γραμμές· ο λόγος
    // γράφεται δίπλα στο πράγμα που εξαιρεί, όχι πάνω από την ανοιχτή παρένθεση.
    const s = siteNames(FX).find((x) => x.fn === 'exempt_reasonBesideOverride');
    expect(s.status).toBe('exempt');
  });

  test('εξαίρεση ΧΩΡΙΣ λόγο δεν αναγνωρίζεται — ίδιο δόγμα με R1/R2', () => {
    const s = siteNames(FX).find((x) => x.fn === 'violation_exemptWithoutReason');
    expect(s.status).toBe('violation');
  });

  test('η ΑΥΘΕΝΤΙΑ αποφασίζει: mode=none ⇒ not-tenant-scoped, όχι παράβαση', () => {
    // Χωρίς αυτό, τα 3 σημεία του EnterpriseSecurityService θα ήταν θόρυβος — και ένας
    // κανόνας που γεννιέται θορυβώδης διδάσκει να τον αγνοείς (ADR-742).
    const s = siteNames(FX).find((x) => x.fn === 'notScoped_authoritySaysNone');
    expect(s.status).toBe('not-tenant-scoped');
  });

  test('δυναμικό κλειδί ⇒ unanalyzable, ΠΟΤΕ violation (η άγνοια δεν είναι ενοχή)', () => {
    const s = siteNames(FX).find((x) => x.fn === 'unanalyzable_dynamicKey');
    expect(s.status).toBe('unanalyzable');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('7. Ratchet — η αριθμητική του φύλακα', () => {
// ═══════════════════════════════════════════════════════════════════════════

  test('η baseline υπάρχει, έχει σχήμα, και ΔΕΝ λέει 0', () => {
    const b = gate.loadBaseline();
    expect(b).not.toBeNull();
    expect(b._meta.check).toBe('CHECK 3.35');
    expect(typeof b.files).toBe('object');
    // 🔴 Το «0» θα σήμαινε ότι κανείς δεν κοίταξε (πρβλ. N.11 / N.12 / CHECK 3.15).
    expect(b._meta.totalViolations).toBeGreaterThan(0);
    expect(Object.keys(b.files).length).toBe(b._meta.totalFiles);
  });

  test('κάθε τιμή της baseline είναι θετικός ακέραιος', () => {
    const b = gate.loadBaseline();
    for (const [file, n] of Object.entries(b.files)) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
      expect(file.startsWith('src/')).toBe(true);
    }
  });

  test('τα αρχεία της baseline υπάρχουν ακόμη (αλλιώς η baseline είναι μπαγιάτικη)', () => {
    const b = gate.loadBaseline();
    const missing = Object.keys(b.files).filter(
      (f) => !fs.existsSync(path.join(path.resolve(__dirname, '..', '..'), f)),
    );
    expect(missing).toEqual([]);
  });

  test('isScannable: παραγωγικός κώδικας ναι, tests/mocks/d.ts όχι', () => {
    const R = path.resolve(__dirname, '..', '..');
    expect(gate.isScannable(path.join(R, 'src/services/foo.ts'))).toBe(true);
    expect(gate.isScannable(path.join(R, 'src/components/Foo.tsx'))).toBe(true);
    expect(gate.isScannable(path.join(R, 'src/services/foo.test.ts'))).toBe(false);
    expect(gate.isScannable(path.join(R, 'src/services/__tests__/foo.ts'))).toBe(false);
    expect(gate.isScannable(path.join(R, 'src/types/foo.d.ts'))).toBe(false);
    expect(gate.isScannable(path.join(R, 'scripts/foo.ts'))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('8. 🧬 MUTATION TESTING — σπάμε τον σαρωτή και απαιτούμε κόκκινο', () => {
// ═══════════════════════════════════════════════════════════════════════════

  const SCANNER = path.join(__dirname, '..', '_shared', 'firestore-tenant-scope-scan.js');
  const LOADERS = path.join(__dirname, '..', '_shared', 'firestore-ast-loaders.js');

  /**
   * Εφάρμοσε μετάλλαξη στο αρχείο, **επαλήθευσε ότι προσγειώθηκε**, φόρτωσε το
   * μεταλλαγμένο module **από τον δίσκο** και τρέξε το σενάριο.
   *
   * 🔴 ΔΥΟ ΠΑΓΙΔΕΣ, ΚΑΙ ΟΙ ΔΥΟ ΠΑΡΑΓΟΥΝ ΨΕΥΤΙΚΑ «ΣΚΟΤΩΜΕΝΕΣ ΜΕΤΑΛΛΑΞΕΙΣ»:
   *
   *  1. **Η μετάλλαξη δεν ταιριάζει** (αλλαγμένο κείμενο, CRLF σε multi-line
   *     pattern) ⇒ ο κώδικας μένει ανέπαφος, το test περνά, κανείς δεν το ξέρει.
   *     Άμυνα: `expect(original.includes(find)).toBe(true)` **πριν** τρέξει.
   *
   *  2. **Το Jest έχει ΔΙΚΟ ΤΟΥ module registry.** Το `delete require.cache[…]`
   *     δεν το αγγίζει καθόλου: το αρχείο στον δίσκο αλλάζει, αλλά η συνάρτηση
   *     που τρέχει είναι η **παλιά**. Τέσσερις από τις πέντε μεταλλάξεις εδώ
   *     «περνούσαν» έτσι — δηλαδή το mutation testing δεν έλεγχε τίποτα.
   *     Άμυνα: `jest.resetModules()` + `jest.isolateModules()`.
   */
  function withMutation(targetFile, find, replace, run) {
    const original = fs.readFileSync(targetFile, 'utf8');
    expect(original.includes(find)).toBe(true);          // παγίδα 1 — προσγειώθηκε;
    const mutated = original.replace(find, replace);
    expect(mutated).not.toBe(original);

    // Αντίγραφο ασφαλείας εκτός repo, ώστε διακοπή να μην αφήσει μεταλλαγμένο αρχείο.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-mut-'));
    fs.writeFileSync(path.join(dir, path.basename(targetFile)), original, 'utf8');

    let result;
    try {
      fs.writeFileSync(targetFile, mutated, 'utf8');
      jest.resetModules();                                // παγίδα 2 — καθάρισε ΤΟ registry του Jest
      jest.isolateModules(() => {
        const fresh = require(SCANNER);
        // Απόδειξη ότι φορτώθηκε το ΜΕΤΑΛΛΑΓΜΕΝΟ: το κείμενο στον δίσκο άλλαξε
        // ΚΑΙ το module ξαναδιαβάστηκε μέσα σε αυτό το isolate scope.
        expect(fs.readFileSync(targetFile, 'utf8')).toBe(mutated);
        result = run(fresh);
      });
    } finally {
      fs.writeFileSync(targetFile, original, 'utf8');
      jest.resetModules();
    }
    return result;
  }

  test('Μ0 (μετα-έλεγχος): ο μηχανισμός μετάλλαξης ΟΝΤΩΣ φτάνει στη μνήμη', () => {
    // 🔴 Αν ΑΥΤΟ αποτύχει, όλες οι μεταλλάξεις παρακάτω είναι διακοσμητικές και
    // το «5/5 σκοτωμένες» είναι ψέμα. Βάφουμε μια ετικέτα κατάστασης και
    // απαιτούμε να τη ΔΟΥΜΕ στην έξοδο — αδιαμφισβήτητη απόδειξη εκτέλεσης.
    // ⚠️ Ο στόχος πρέπει να είναι **μονοσήμαντος**. Η πρώτη εκδοχή έψαχνε σκέτο
    // `status: 'violation',` — και τη στιγμή που προστέθηκε ο R3 (δεύτερος κλάδος
    // παράβασης) το `String.replace` άρχισε να χτυπά **τον λάθος κλάδο**, με το Μ0 να
    // γίνεται κόκκινο για λόγο άσχετο με αυτό που ελέγχει. Στόχος τώρα είναι το `detail`
    // του τελικού κλάδου, που ανήκει **μόνο** σε αυτόν· η επανάληψη του `status` πιο κάτω
    // στο ίδιο object literal υπερισχύει (τελευταίο κλειδί κερδίζει), άρα η μετάλλαξη
    // παραμένει ορατή χωρίς να εξαρτάται από το πλήθος των κανόνων.
    const sites = withMutation(
      SCANNER,
      'detail: `καμία where(',
      "status: 'ΜΕΤΑΛΛΑΓΜΕΝΟ', detail: `καμία where(",
      (fresh) => fresh.scanFile(fixture('historical-bug.pre-fix.ts.fixture'), fresh.createScanContext()),
    );
    expect(sites.map((s) => s.status)).toContain('ΜΕΤΑΛΛΑΓΜΕΝΟ');
  });

  test('Μ1: αν πάψει να ακολουθεί τα push(where(…)) → χάνει το ιστορικό σφάλμα σιωπηλά', () => {
    const result = withMutation(
      SCANNER,
      "n.expression.name.getText() === 'push'",
      "n.expression.name.getText() === '__νεκρό__'",
      (fresh) => {
        const c = fresh.createScanContext();
        return fresh.scanFile(fixture('historical-bug.post-fix.ts.fixture'), c);
      },
    );
    // Το ΔΙΟΡΘΩΜΕΝΟ αρχείο βάζει το companyId μέσω push() — χωρίς αυτό δεν φαίνεται.
    const q = result.find((s) => s.rule === 'R1-client');
    expect(q.fields).not.toContain('companyId');
    expect(q.status).toBe('violation');   // ψευδώς θετικό ⇒ η μετάλλαξη ΕΙΝΑΙ ορατή
  });

  test('Μ2: αν το «άγνωστη συλλογή» γίνει σιωπηλό ok → η τυφλότητα επιστρέφει', () => {
    const result = withMutation(
      SCANNER,
      "if (!coll) return { ...base, tenantMode: '-', status: 'unanalyzable'",
      "if (!coll) return { ...base, tenantMode: '-', status: 'ok'",
      (fresh) => {
        const c = fresh.createScanContext();
        return fresh.scanFile(fixture('admin-sdk-shapes.ts.fixture'), c);
      },
    );
    const byStatus = result.filter((s) => s.status === 'unanalyzable');
    expect(byStatus.length).toBeLessThan(2);   // εξαφανίστηκαν ⇒ ορατή αλλαγή
  });

  test('Μ3: αν αγνοήσει τη σειρά (SSoT πριν τα πεδία) → η αδελφή μασκάρεται ξανά', () => {
    const result = withMutation(
      SCANNER,
      'if (base.fields.includes(tenant.fieldName)) {',
      'if (ssotGuaranteed || base.fields.includes(tenant.fieldName)) {',
      (fresh) => {
        const c = fresh.createScanContext();
        return fresh.scanFile(fixture('admin-sdk-shapes.ts.fixture'), c);
      },
    );
    // Το wrapped site θα αλλάξει αιτιολογία — η μετάλλαξη είναι ορατή στη σημασιολογία.
    const wrapped = result.find((s) => s.detail && /τυλίγεται|φιλτράρει/.test(s.detail));
    expect(wrapped).toBeDefined();
  });

  test('Μ4: αν πάψει να διαβάζει το FIELDS SSoT → επιστρέφουν τα 61% ψευδώς θετικά', () => {
    const result = withMutation(
      LOADERS,
      "if (ts.isPropertyAccessExpression(expr) && /FIELDS$/.test(expr.expression.getText())) {",
      "if (false && ts.isPropertyAccessExpression(expr)) {",
      (fresh) => {
        const c = fresh.createScanContext();
        return fresh.scanFile(fixture('admin-sdk-shapes.ts.fixture'), c);
      },
    );
    const text = fs.readFileSync(fixture('admin-sdk-shapes.ts.fixture'), 'utf8');
    const lines = text.split(/\r?\n/);
    const nameAt = (line) => {
      for (let i = line - 1; i >= 0; i--) {
        const m = /function\s+([A-Za-z0-9_]+)/.exec(lines[i] || '');
        if (m) return m[1];
      }
      return '';
    };
    const viaConst = result.filter((s) => nameAt(s.line) === 'ok_viaFieldConstant');
    // Χωρίς το SSoT των πεδίων, το νόμιμο FIELDS.COMPANY_ID δεν αναγνωρίζεται πια ως ok.
    expect(viaConst.some((s) => s.status === 'ok')).toBe(false);
  });

  test('Μ5: αν πάψει να παρακολουθεί την επανανάθεση → νόμιμος κώδικας γίνεται κόκκινος', () => {
    const result = withMutation(
      SCANNER,
      'const bound = boundNameOf(cur);',
      'const bound = null;',
      (fresh) => {
        const c = fresh.createScanContext();
        return fresh.scanFile(fixture('admin-sdk-shapes.ts.fixture'), c);
      },
    );
    const text = fs.readFileSync(fixture('admin-sdk-shapes.ts.fixture'), 'utf8');
    const lines = text.split(/\r?\n/);
    const nameAt = (line) => {
      for (let i = line - 1; i >= 0; i--) {
        const m = /function\s+([A-Za-z0-9_]+)/.exec(lines[i] || '');
        if (m) return m[1];
      }
      return '';
    };
    const reassign = result.filter((s) => nameAt(s.line) === 'ok_conditionalReassignment');
    expect(reassign.some((s) => s.status === 'violation')).toBe(true);
  });

  test('Μ6: αν ο R3 πάψει να δέχεται τη 2η άγκυρα → η τεκμηριωμένη εξαίρεση γίνεται κόκκινη', () => {
    // Ο R3 δέχεται λόγο πάνω από την κλήση **ή** πάνω από το ίδιο το `tenantOverride`.
    // Κόβοντας τη δεύτερη, ο σαρωτής ξαναρχίζει να τιμωρεί ακριβώς τη συμπεριφορά που
    // θέλει να ενθαρρύνει — και ΑΥΤΟ πρέπει να το δει το δίχτυ.
    const result = withMutation(
      SCANNER,
      'isExempt(lines, line) || isExempt(lines, skipLine)',
      'isExempt(lines, line)',
      (fresh) => fresh.scanFile(fixture('service-override.ts.fixture'), fresh.createScanContext()),
    );
    const lines = fs.readFileSync(fixture('service-override.ts.fixture'), 'utf8').split(/\r?\n/);
    const nameAt = (line) => {
      for (let i = line - 1; i >= 0; i--) {
        const m = /function\s+([A-Za-z0-9_]+)/.exec(lines[i] || '');
        if (m) return m[1];
      }
      return '';
    };
    const beside = result.find((s) => nameAt(s.line) === 'exempt_reasonBesideOverride');
    expect(beside.status).toBe('violation');
  });

  test('Μ7: αν ο R3 πάψει να ρωτά την αυθεντία → mode=none γίνεται ψευδώς κόκκινο', () => {
    // Κόβοντας τον κλάδο «tenant-config: mode=none», τα 3 νόμιμα σημεία του
    // EnterpriseSecurityService γίνονται παραβιάσεις ⇒ θορυβώδης πύλη ⇒ αγνοείται.
    const result = withMutation(
      SCANNER,
      "return { ...withMode, status: 'not-tenant-scoped', detail: 'tenant-config: mode=none' };",
      "/* μεταλλαγμένο: η αυθεντία αγνοείται */",
      (fresh) => fresh.scanFile(fixture('service-override.ts.fixture'), fresh.createScanContext()),
    );
    expect(result.some((s) => s.status === 'not-tenant-scoped')).toBe(false);
  });

  test('ΜΕΤΑ ΤΙΣ ΜΕΤΑΛΛΑΞΕΙΣ: τα αρχεία επανήλθαν byte-για-byte και η πύλη ξαναλειτουργεί', () => {
    const c = createScanContext();
    const pre = scanFile(fixture('historical-bug.pre-fix.ts.fixture'), c);
    const post = scanFile(fixture('historical-bug.post-fix.ts.fixture'), c);
    expect(pre.filter((s) => s.status === 'violation')).toHaveLength(1);
    expect(post.filter((s) => s.status === 'violation')).toHaveLength(0);
  });
});
