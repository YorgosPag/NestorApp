/**
 * ΑΓΚΥΡΕΣ — CHECK 3.75, η πύλη του συνόρου του χάρτη (ADR-777 §8.56)
 *
 * ⚠️ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΠΡΩΤΑ**: κάθε ομάδα που ισχυρίζεται «δεν βρήκε παράβαση»
 * συνοδεύεται από άγκυρα που αποδεικνύει ότι ο σαρωτής **κοίταξε** — αλλιώς το
 * πράσινο σημαίνει «κανείς δεν κοίταξε», το σχήμα που αυτό το repo έχει πληρώσει
 * πάνω από πέντε φορές.
 *
 * 🔴 **ΚΑΘΕ ΚΛΑΔΟΣ ΠΟΥ ΜΠΛΟΚΑΡΕΙ ΑΣΚΕΙΤΑΙ ΕΔΩ.** Στο πραγματικό δέντρο κανένας από
 * αυτούς δεν τίθεται (γι' αυτό είναι πράσινο), άρα χωρίς ένεση θα ήταν **αδρανείς
 * φρουροί** — 606 μετρημένοι σε αυτό το repo (ADR-749 §5), με το «0» τους να
 * διαβάζεται ως «κοίταξα και δεν υπάρχουν».
 *
 * @jest-environment node
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  BOUNDARY_FILE,
  BOUNDARY_MODULE,
  BOUNDARY_STATES,
  GATE_STATES,
  GUARDED_MODULES,
  RAW_IMPORT_OWNERS,
  REQUIRED_STYLESHEET,
  isRawImportOwner,
  repoRelativePosix,
} = require('../lib/map-boundary/contract.js');
const {
  BLOCKING,
  MIN_REASON,
  collectSourceFiles,
  guardedRootOf,
  judgeBoundarySelf,
  judgeFile,
  judgeOwners,
  sweep,
} = require('../lib/map-boundary/gate.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const NOT_OWNER = 'src/components/whatever/SomeMap.tsx';

const judge = (text, file = NOT_OWNER) => judgeFile(file, text).state;

// ═══════════════════════════════════════════════════════════════════════════
// Μ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// ═══════════════════════════════════════════════════════════════════════════

describe('Μ0 — ο παρονομαστής', () => {
  const result = sweep(REPO_ROOT);

  it('Μ0α: ο σαρωτής βρίσκει ΠΡΑΓΜΑΤΙΚΟ πληθυσμό, όχι κενό δέντρο', () => {
    expect(result.population).toBeGreaterThan(1000);
    expect(collectSourceFiles(path.join(REPO_ROOT, 'src')).length).toBe(result.population);
  });

  it('Μ0β: υπάρχουν αρχεία ΣΤΟ ΣΥΝΟΡΟ — αλλιώς το «καμία παράβαση» είναι κενό', () => {
    expect(result.fileTally[GATE_STATES.AT_BOUNDARY]).toBeGreaterThan(0);
    expect(result.consumers).toBe(result.fileTally[GATE_STATES.AT_BOUNDARY]);
    expect(result.fileTally[GATE_STATES.OWNER]).toBe(Object.keys(RAW_IMPORT_OWNERS).length);
  });

  it('Μ0γ: υπάρχουν και αρχεία ΜΟΝΟ-ΤΥΠΩΝ — ο κάδος ΤΙΘΕΤΑΙ, δεν είναι θεωρία', () => {
    // Αν ήταν 0, το «ο τύπος επιτρέπεται» θα ήταν αδήλωτη υπόθεση αντί για
    // μετρημένη συμπεριφορά της πύλης πάνω σε πραγματικά αρχεία.
    expect(result.fileTally[GATE_STATES.TYPE_ONLY]).toBeGreaterThan(0);
  });

  it('Μ0δ: το πραγματικό δέντρο είναι ΚΑΘΑΡΟ (zero-tolerance εφικτό, μετρημένο)', () => {
    expect(result.violations).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Κ1 — ΤΟ ΚΡΙΤΗΡΙΟ ΤΗΣ ΠΑΡΑΚΑΜΨΗΣ
// ═══════════════════════════════════════════════════════════════════════════

describe('Κ1 — το κριτήριο της παράκαμψης', () => {
  it('Κ1α: ωμά named από `react-map-gl/maplibre` ΠΙΑΝΟΝΤΑΙ', () => {
    expect(judge("import { Map, Source } from 'react-map-gl/maplibre';")).toBe(
      GATE_STATES.BOUNDARY_BYPASS,
    );
  });

  it('Κ1β: ωμό `LngLatBounds` από `maplibre-gl` ΠΙΑΝΕΤΑΙ', () => {
    expect(judge("import { LngLatBounds } from 'maplibre-gl';")).toBe(
      GATE_STATES.BOUNDARY_BYPASS,
    );
  });

  it('Κ1γ: 🔴 ΤΟ ΙΔΙΟ ΤΟ ΦΥΛΛΟ ΣΤΥΛ — η εισαγωγή που ζούσε σε ΤΕΣΣΕΡΑ αρχεία', () => {
    // Εισαγωγή παρενέργειας: κανένα `importClause`. Αν δεν μετρούσε, το σύνορο θα
    // φύλαγε τα σύμβολα και θα άφηνε το στυλ να αντιγράφεται όπου να 'ναι.
    expect(judge(`import '${REQUIRED_STYLESHEET}';`)).toBe(GATE_STATES.BOUNDARY_BYPASS);
  });

  it('Κ1δ: ΔΙΠΛΑ εισαγωγικά — η μορφή που ένα grep χάνει', () => {
    expect(judge('import { Marker } from "maplibre-gl"')).toBe(GATE_STATES.BOUNDARY_BYPASS);
  });

  it('Κ1ε: ΜΕΤΟΝΟΜΑΣΜΕΝΟ named — κρίνεται το σύμβολο, όχι το τοπικό όνομα', () => {
    expect(judge("import { Marker as Pin } from 'maplibre-gl';")).toBe(
      GATE_STATES.BOUNDARY_BYPASS,
    );
  });

  it('Κ1ζ: NAMESPACE εισαγωγή ΠΙΑΝΕΤΑΙ — φέρνει ΟΛΕΣ τις τιμές', () => {
    expect(judge("import * as maplibregl from 'maplibre-gl';")).toBe(
      GATE_STATES.BOUNDARY_BYPASS,
    );
  });

  it('Κ1η: DEFAULT εισαγωγή ΠΙΑΝΕΤΑΙ', () => {
    expect(judge("import MapGL from 'react-map-gl/maplibre';")).toBe(
      GATE_STATES.BOUNDARY_BYPASS,
    );
  });

  it('Κ1θ: 🔴 ΜΟΝΟ-ΤΥΠΟΙ ΔΕΝ είναι παράβαση — ο τύπος δεν φτάνει στον περιηγητή', () => {
    expect(judge("import type { MapRef } from 'react-map-gl/maplibre';")).toBe(
      GATE_STATES.TYPE_ONLY,
    );
    expect(judge("import type { Map } from 'maplibre-gl';")).toBe(GATE_STATES.TYPE_ONLY);
    expect(judge("import { type StyleSpecification } from 'maplibre-gl';")).toBe(
      GATE_STATES.TYPE_ONLY,
    );
  });

  it('Κ1ι: ΑΝΑΜΕΙΚΤΗ εισαγωγή (τύπος + τιμή) ΠΙΑΝΕΤΑΙ — η τιμή κρίνει', () => {
    expect(judge("import { Map, type MapRef } from 'react-map-gl/maplibre';")).toBe(
      GATE_STATES.BOUNDARY_BYPASS,
    );
  });

  it('Κ1κ: εισαγωγή ΑΠΟ ΤΟ ΣΥΝΟΡΟ είναι ΚΑΘΑΡΗ', () => {
    expect(judge(`import { Map, Layer } from '${BOUNDARY_MODULE}';`)).toBe(
      GATE_STATES.AT_BOUNDARY,
    );
  });

  it('Κ1λ: 🔴 ΠΡΟΖΑ ΔΕΝ είναι εισαγωγή — η παγίδα Κ7β του CHECK 3.50', () => {
    // Το ίδιο το σύνορο και ο `AddressMap` γράφουν «maplibre-gl» σε σχόλιο. Ένα
    // regex θα κοκκίνιζε πάνω στην ΤΕΚΜΗΡΙΩΣΗ ΤΗΣ ΘΕΡΑΠΕΙΑΣ.
    expect(judge("// το maplibre-gl θέλει το φύλλο στυλ του· δες react-map-gl/maplibre")).toBe(
      GATE_STATES.NOT_A_MAP_FILE,
    );
  });

  it('Κ1μ: 🔴 ΓΕΙΤΝΙΑΣΗ ΟΝΟΜΑΤΟΣ ΔΕΝ αρκεί — ρίζα ή υποδιαδρομή, ποτέ prefix λέξης', () => {
    // `maplibre-gl-draw` ΔΕΝ είναι το `maplibre-gl`: ο έλεγχος είναι
    // `spec === ρίζα || spec.startsWith(ρίζα + '/')`, ώστε ένα μελλοντικό plugin
    // να μη μπει σιωπηλά στο κλειστό σύνολο χωρίς να το αποφασίσει άνθρωπος.
    expect(guardedRootOf('maplibre-gl-draw')).toBeNull();
    expect(guardedRootOf('maplibre-gl')).toBe('maplibre-gl');
    expect(guardedRootOf('maplibre-gl/dist/maplibre-gl.css')).toBe('maplibre-gl');
    expect(guardedRootOf('react-map-gl/maplibre')).toBe('react-map-gl');
    expect(guardedRootOf('@/lib/maps/maplibre')).toBeNull();
  });

  it('Κ1ν: το ΛΕΞΙΛΟΓΙΟ των φυλασσόμενων ριζών έχει ΛΟΓΟ σε καθεμία', () => {
    for (const [root, reason] of Object.entries(GUARDED_MODULES)) {
      expect(typeof reason).toBe('string');
      expect(reason.trim().length).toBeGreaterThanOrEqual(MIN_REASON);
      expect(guardedRootOf(root)).toBe(root);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Κ1′ — ΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΤΩΝ ΙΔΙΟΚΤΗΤΩΝ
// ═══════════════════════════════════════════════════════════════════════════

describe("Κ1′ — οι δηλώσεις ιδιοκτησίας", () => {
  it('Σ1: ο ιδιοκτήτης ΕΙΝΑΙ το ίδιο το σύνορο, και ΥΠΑΡΧΕΙ στον δίσκο', () => {
    expect(isRawImportOwner(BOUNDARY_FILE)).toBe(true);
    expect(fs.existsSync(path.join(REPO_ROOT, BOUNDARY_FILE))).toBe(true);
  });

  it('Σ2: ο ιδιοκτήτης ΔΕΝ καταγγέλλεται — η πύλη δεν κοκκινίζει στη θεραπεία', () => {
    expect(judgeOwners(REPO_ROOT)).toEqual([]);
    expect(judgeFile(BOUNDARY_FILE, fs.readFileSync(path.join(REPO_ROOT, BOUNDARY_FILE), 'utf8')).state)
      .toBe(GATE_STATES.OWNER);
  });

  it('Σ3: ΟΡΦΑΝΗ δήλωση ΠΙΑΝΕΤΑΙ — ο κλάδος ΑΣΚΕΙΤΑΙ', () => {
    const verdicts = judgeOwners(REPO_ROOT, {
      'src/does/not/exist.tsx': 'x'.repeat(MIN_REASON + 1),
    });
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].state).toBe(GATE_STATES.ORPHAN_OWNER);
  });

  it('Σ4: ΔΗΛΩΣΗ ΧΩΡΙΣ ΛΟΓΟ ΠΙΑΝΕΤΑΙ, και το ΟΡΙΟ περνά', () => {
    const short = judgeOwners(REPO_ROOT, { [BOUNDARY_FILE]: 'ok' });
    expect(short).toHaveLength(1);
    expect(short[0].state).toBe(GATE_STATES.REASONLESS_OWNER);
    expect(judgeOwners(REPO_ROOT, { [BOUNDARY_FILE]: 'x'.repeat(MIN_REASON) })).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Κ2 + Κ3 — ΤΟ ΙΔΙΟ ΤΟ ΣΥΝΟΡΟ
// ═══════════════════════════════════════════════════════════════════════════

describe('Κ2+Κ3 — το σύνορο κρίνεται για τον εαυτό του', () => {
  let tmp;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'map-boundary-'));
    fs.mkdirSync(path.join(tmp, 'src', 'lib', 'maps'), { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const writeBoundary = (body) =>
    fs.writeFileSync(path.join(tmp, BOUNDARY_FILE), body, 'utf8');

  it('Κ3α: σύνορο ΧΩΡΙΣ το φύλλο στυλ ΜΠΛΟΚΑΡΕΙ — η μία γραμμή που δικαιολογεί το αρχείο', () => {
    writeBoundary("export * from 'react-map-gl/maplibre';\n");
    const verdicts = judgeBoundarySelf(tmp, 5);
    expect(verdicts.map((v) => v.state)).toContain(BOUNDARY_STATES.STYLESHEET_MISSING);
  });

  it('Κ3β: 🔴 ΤΟ ΣΧΟΛΙΟ ΔΕΝ ΕΙΝΑΙ Η ΘΕΡΑΠΕΙΑ — AST, όχι `includes`', () => {
    // Το πραγματικό σύνορο γράφει τη διαδρομή του φύλλου στυλ σε ΠΡΟΖΑ. Ένα
    // `text.includes(...)` θα έμενε πράσινο με την εισαγωγή σβησμένη.
    writeBoundary(
      `/** χρειάζεται το ${REQUIRED_STYLESHEET} για τη διάταξη */\n` +
        "export * from 'react-map-gl/maplibre';\n",
    );
    expect(judgeBoundarySelf(tmp, 5).map((v) => v.state)).toContain(
      BOUNDARY_STATES.STYLESHEET_MISSING,
    );
  });

  it('Κ3γ: σύνορο ΜΕ το φύλλο στυλ και με καταναλωτές είναι ΥΓΙΕΣ', () => {
    writeBoundary(`import '${REQUIRED_STYLESHEET}';\nexport * from 'react-map-gl/maplibre';\n`);
    expect(judgeBoundarySelf(tmp, 5)).toEqual([]);
  });

  it('Κ2: 🔴 ΣΥΝΟΡΟ ΧΩΡΙΣ ΚΑΤΑΝΑΛΩΤΕΣ ΜΠΛΟΚΑΡΕΙ — πράσινο με μηδέν προστασία', () => {
    // Ο ευκολότερος τρόπος να «λυθεί» ένα κόκκινο Κ1 είναι να σβηστεί ο τελευταίος
    // καταναλωτής. Χωρίς το Κ2 η πύλη θα το επιβράβευε.
    writeBoundary(`import '${REQUIRED_STYLESHEET}';\nexport * from 'react-map-gl/maplibre';\n`);
    expect(judgeBoundarySelf(tmp, 0).map((v) => v.state)).toContain(
      BOUNDARY_STATES.BOUNDARY_ABANDONED,
    );
  });

  it('Κ3δ: ΑΝΥΠΑΡΚΤΟ σύνορο ΜΠΛΟΚΑΡΕΙ — και δεν σκάει', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'map-boundary-empty-'));
    expect(judgeBoundarySelf(empty, 5).map((v) => v.state)).toEqual([
      BOUNDARY_STATES.BOUNDARY_ABSENT,
    ]);
    fs.rmSync(empty, { recursive: true, force: true });
  });

  it('Κ3ε: το ΠΡΑΓΜΑΤΙΚΟ σύνορο κατέχει το φύλλο στυλ, ΤΩΡΑ', () => {
    expect(judgeBoundarySelf(REPO_ROOT, sweep(REPO_ROOT).consumers)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Λ — Η ΛΟΓΙΣΤΙΚΗ
// ═══════════════════════════════════════════════════════════════════════════

describe('Λ — κλειστή λογιστική fail-closed', () => {
  it('Λ1: ΤΡΙΑ ΚΑΤΑΣΤΙΧΑ κλείνουν ΞΕΧΩΡΙΣΤΑ — αρχεία, δηλώσεις, σύνορο', () => {
    const { fileTally, ownerTally, selfTally, population, declared } = sweep(REPO_ROOT);
    expect(Object.values(fileTally).reduce((a, b) => a + b, 0)).toBe(population);
    expect(Object.values(ownerTally).reduce((a, b) => a + b, 0)).toBe(declared);
    expect(Object.values(selfTally).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(1);
    expect(declared).toBe(Object.keys(RAW_IMPORT_OWNERS).length);
  });

  it('Λ2: 🔴 Η ΛΟΓΙΣΤΙΚΗ ΚΛΕΙΝΕΙ ΚΑΙ ΟΤΑΝ ΥΠΑΡΧΕΙ ΕΛΑΤΤΩΜΑ — η αφαίρεση ασκείται', () => {
    const injected = {
      [BOUNDARY_FILE]: 'ok',
      'src/does/not/exist.tsx': 'a'.repeat(MIN_REASON),
    };
    const { ownerTally, declared, violations } = sweep(REPO_ROOT, injected);
    expect(declared).toBe(2);
    expect(ownerTally[GATE_STATES.REASONLESS_OWNER]).toBe(1);
    expect(ownerTally[GATE_STATES.ORPHAN_OWNER]).toBe(1);
    expect(ownerTally[GATE_STATES.OWNER]).toBe(0);
    expect(Object.values(ownerTally).reduce((a, b) => a + b, 0)).toBe(declared);
    expect(violations.length).toBeGreaterThanOrEqual(2);
  }, 60000);

  it('Λ3: 🔴 ΧΩΡΙΣ ΔΗΛΩΜΕΝΟ ΙΔΙΟΚΤΗΤΗ, ΤΟ ΙΔΙΟ ΤΟ ΣΥΝΟΡΟ ΓΙΝΕΤΑΙ ΠΑΡΑΒΑΤΗΣ', () => {
    // Αποδεικνύει ότι η εξαίρεση του ιδιοκτήτη ΔΕΝ είναι διακοσμητική: αν σβηστεί
    // η δήλωση, το αρχείο που ΠΡΕΠΕΙ να αγγίζει ωμά κοκκινίζει αμέσως.
    const { fileTally } = sweep(REPO_ROOT, {});
    expect(fileTally[GATE_STATES.BOUNDARY_BYPASS]).toBeGreaterThan(0);
    expect(fileTally[GATE_STATES.OWNER]).toBe(0);
  }, 60000);

  it('Λ4: οι ΜΠΛΟΚΑΡΟΥΣΕΣ καταστάσεις είναι ακριβώς έξι, από δύο λεξιλόγια', () => {
    expect([...BLOCKING].sort()).toEqual(
      [
        GATE_STATES.BOUNDARY_BYPASS,
        GATE_STATES.ORPHAN_OWNER,
        GATE_STATES.REASONLESS_OWNER,
        BOUNDARY_STATES.BOUNDARY_ABANDONED,
        BOUNDARY_STATES.STYLESHEET_MISSING,
        BOUNDARY_STATES.BOUNDARY_ABSENT,
      ].sort(),
    );
  });

  it('Λ5: η πύλη δεν κρατά ΔΙΚΟ ΤΗΣ αντίγραφο του συμβολαίου', () => {
    const gateSource = fs.readFileSync(
      path.join(__dirname, '..', 'lib', 'map-boundary', 'gate.js'),
      'utf8',
    );
    expect(gateSource).toContain("require('./contract.js')");
    expect(gateSource).not.toMatch(/const\s+(GUARDED_MODULES|RAW_IMPORT_OWNERS)\s*=\s*Object\.freeze\(\{/);
  });

  it('Λ6: η κανονικοποίηση διαδρομής δουλεύει σε Windows — αλλιώς το σύνολο είναι ΚΕΝΟ', () => {
    const B = String.fromCharCode(92);
    const rel = repoRelativePosix(`C:${B}repo${B}src${B}lib${B}maps${B}maplibre.ts`, `C:${B}repo`);
    expect(rel).toBe('src/lib/maps/maplibre.ts');
    expect(rel).toBe(BOUNDARY_FILE);
  });
});
