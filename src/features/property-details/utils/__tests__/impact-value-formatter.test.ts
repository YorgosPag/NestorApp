import fs from 'fs';
import path from 'path';
import { formatImpactValue } from '../impact-value-formatter';

type FakeT = (key: string, options?: { defaultValue?: string }) => string;

/**
 * ⚠️ Οι τιμές του λεξικού είναι **αντιγραμμένες από τα πραγματικά locales**
 * (`el/properties.json`, `el/properties-enums.json`, `el/common-shared.json`).
 * Λεξικό με επινοημένες τιμές θα ήταν άγκυρα πάνω σε κόσμο που δεν υπάρχει.
 */
const DICT: Record<string, string> = {
  'properties:impactGuard.emptyValue': 'κενό',
  'properties-enums:units.sqm': 'τ.μ.',
  'properties-detail:fields.areas.gross': 'Μικτό',
  'properties-detail:fields.areas.net': 'Καθαρό',
  'properties-detail:fields.areas.balcony': 'Μπαλκόνι',
  'properties-detail:fields.areas.terrace': 'Βεράντα',
  'properties-detail:fields.areas.garden': 'Κήπος',
  'properties-detail:fields.bedrooms': 'Υπνοδωμάτια',
  'properties-detail:fields.bathrooms': 'Μπάνια',
  'properties-detail:fields.layout.wc': 'WC',
  'properties-enums:types.apartment': 'Διαμέρισμα',
  'properties-enums:condition.excellent': 'Άριστη',
  'properties-enums:condition.new': 'Νέο',
  'properties-enums:energy.class': 'Ενεργειακή κλάση',
  'properties-enums:systems.heating.label': 'Θέρμανση',
  'properties-enums:systems.heating.autonomous': 'Αυτόνομη',
  'properties-enums:systems.cooling.label': 'Ψύξη',
  'properties-enums:systems.cooling.split-units': 'Διαιρούμενες μονάδες',
  'properties-enums:finishes.flooring.label': 'Δάπεδα',
  'properties-enums:finishes.flooring.tiles': 'Πλακάκι',
  'properties-enums:finishes.flooring.marble': 'Μάρμαρο',
  'properties-enums:finishes.flooring.wood': 'Ξύλο',
  'properties-enums:finishes.frames.label': 'Κουφώματα',
  'properties-enums:finishes.frames.pvc': 'PVC',
  'properties-enums:finishes.glazing.label': 'Υαλοπίνακες',
  'properties-enums:finishes.glazing.double': 'Διπλοί',
  'properties-enums:features.interior.smart-home': 'Έξυπνο σπίτι',
  'properties-enums:features.interior.solar-panels': 'Ηλιακά πάνελ',
  'properties-enums:features.security.security-door': 'Πόρτα ασφαλείας',
  'properties-enums:features.security.alarm': 'Συναγερμός',
  'properties-enums:features.security.cctv': 'CCTV',
  'properties-enums:features.security.intercom': 'Θυροτηλέφωνο',
  'properties-enums:features.security.motion-sensors': 'Αισθητήρες κίνησης',
  'properties-enums:commercialStatus.for-sale': 'Προς πώληση',
  'properties-enums:units.orientation.north': 'Βόρειο',
  'properties-enums:units.orientation.south': 'Νότιο',
  'properties:impactGuard.commercial.askingPrice': 'Τιμή ζήτησης',
  'properties:impactGuard.commercial.rentPrice': 'Μηνιαίο ενοίκιο',
  'properties:impactGuard.commercial.finalPrice': 'Τελική τιμή',
  'properties:impactGuard.commercial.reservationDeposit': 'Προκαταβολή κράτησης',
  'properties:impactGuard.commercial.owners': 'Αγοραστές',
  'common-shared:search.entityTypes.parking': 'Θέση Στάθμευσης',
  'common-shared:search.entityTypes.storage': 'Αποθήκη',
  'properties:linkedSpaces.inclusion.included': 'Συμπεριλαμβάνεται',
  'properties:linkedSpaces.inclusion.optional': 'Προαιρετικό',
};

const fakeT: FakeT = (key, options) => DICT[key] ?? options?.defaultValue ?? key;

describe('formatImpactValue', () => {
  test('null → emptyValue label', () => {
    expect(formatImpactValue(fakeT as never, 'areas', null)).toBe('κενό');
  });

  test('type → enum lookup, unknown token falls back to raw', () => {
    expect(formatImpactValue(fakeT as never, 'type', 'apartment')).toBe('Διαμέρισμα');
    expect(formatImpactValue(fakeT as never, 'type', 'no-such-type')).toBe('no-such-type');
  });

  test('areas → gross/net/balcony/terrace/garden with τ.μ.', () => {
    const raw = JSON.stringify({ gross: 35, net: 30, balcony: 20, terrace: 15 });
    expect(formatImpactValue(fakeT as never, 'areas', raw))
      .toBe('Μικτό 35 τ.μ. · Καθαρό 30 τ.μ. · Μπαλκόνι 20 τ.μ. · Βεράντα 15 τ.μ.');
  });

  test('layout → bedrooms/bathrooms/wc', () => {
    const raw = JSON.stringify({ bedrooms: 1, bathrooms: 1, wc: 1 });
    expect(formatImpactValue(fakeT as never, 'layout', raw))
      .toBe('Υπνοδωμάτια 1 · Μπάνια 1 · WC 1');
  });

  test('orientations → comma-joined enum lookups; non-array → raw', () => {
    expect(formatImpactValue(fakeT as never, 'orientations', JSON.stringify(['north', 'south'])))
      .toBe('Βόρειο, Νότιο');
    expect(formatImpactValue(fakeT as never, 'orientations', 'north')).toBe('north');
  });

  test('condition → enum lookup', () => {
    expect(formatImpactValue(fakeT as never, 'condition', 'excellent')).toBe('Άριστη');
    expect(formatImpactValue(fakeT as never, 'condition', 'new')).toBe('Νέο');
  });

  test('energy → class prefix + letter', () => {
    const raw = JSON.stringify({ class: 'A+' });
    expect(formatImpactValue(fakeT as never, 'energy', raw)).toBe('Ενεργειακή κλάση A+');
  });

  test('systemsOverride → heating/cooling labels + values', () => {
    const raw = JSON.stringify({ heatingType: 'autonomous', coolingType: 'split-units' });
    expect(formatImpactValue(fakeT as never, 'systemsOverride', raw))
      .toBe('Θέρμανση: Αυτόνομη · Ψύξη: Διαιρούμενες μονάδες');
  });

  test('finishes → flooring list + frames + glazing', () => {
    const raw = JSON.stringify({
      flooring: ['tiles', 'marble', 'wood'],
      windowFrames: 'pvc',
      glazing: 'double',
    });
    expect(formatImpactValue(fakeT as never, 'finishes', raw))
      .toBe('Δάπεδα: Πλακάκι, Μάρμαρο, Ξύλο · Κουφώματα: PVC · Υαλοπίνακες: Διπλοί');
  });

  test('interiorFeatures → comma-joined enum lookups', () => {
    const raw = JSON.stringify(['smart-home', 'solar-panels']);
    expect(formatImpactValue(fakeT as never, 'interiorFeatures', raw))
      .toBe('Έξυπνο σπίτι, Ηλιακά πάνελ');
  });

  test('securityFeatures → comma-joined enum lookups', () => {
    const raw = JSON.stringify(['security-door', 'alarm', 'cctv', 'intercom', 'motion-sensors']);
    expect(formatImpactValue(fakeT as never, 'securityFeatures', raw))
      .toBe('Πόρτα ασφαλείας, Συναγερμός, CCTV, Θυροτηλέφωνο, Αισθητήρες κίνησης');
  });

  test('commercialStatus → enum lookup', () => {
    expect(formatImpactValue(fakeT as never, 'commercialStatus', 'for-sale')).toBe('Προς πώληση');
  });

  test('linkedSpaces → type × quantity · code · inclusion; empty array → emptyValue', () => {
    const raw = JSON.stringify([
      { spaceType: 'parking', inclusion: 'included', allocationCode: 'P-12', quantity: 2 },
      { spaceType: 'storage', inclusion: 'optional' },
    ]);
    expect(formatImpactValue(fakeT as never, 'linkedSpaces', raw))
      .toBe('Θέση Στάθμευσης · × 2 · P-12 · Συμπεριλαμβάνεται, Αποθήκη · Προαιρετικό');
    expect(formatImpactValue(fakeT as never, 'linkedSpaces', '[]')).toBe('κενό');
  });

  test('unknown field → returns raw', () => {
    expect(formatImpactValue(fakeT as never, 'name', 'Unit A')).toBe('Unit A');
    expect(formatImpactValue(fakeT as never, 'code', 'A-GK-1.04')).toBe('A-GK-1.04');
  });

  test('malformed JSON for structured field → returns raw', () => {
    expect(formatImpactValue(fakeT as never, 'areas', 'not-json')).toBe('not-json');
  });

  test('enum miss falls back to raw token via defaultValue', () => {
    const raw = JSON.stringify(['unknown-feature']);
    expect(formatImpactValue(fakeT as never, 'interiorFeatures', raw)).toBe('unknown-feature');
  });
});

/**
 * `commercial` = **τιμολόγηση** (`PropertyCommercialData`, ADR-197), **ΟΧΙ** κατάσταση.
 *
 * ⚠️ Μέχρι 2026-08-25 η άγκυρα βεβαίωνε ότι το `commercial` με τιμή `'for-sale'`
 * δίνει «Προς πώληση» — ψευδώνυμο που ίσχυε **μόνο** στο `c85eb47c`
 * (`case 'commercial':` fall-through στο `commercialStatus`) και **καταργήθηκε
 * σκόπιμα** στο `486f757b` («formatCommercialObject for commercial JSON field
 * render»). Τρεις ανεξάρτητοι μάρτυρες συμφωνούν ότι το ψευδώνυμο ήταν το λάθος,
 * όχι η κατάργησή του:
 *   1. `Property.commercial?: PropertyCommercialData` — **αντικείμενο**, ποτέ enum·
 *   2. το μήνυμα του `486f757b`·
 *   3. `properties:impactGuard.fields.commercial` = «Τιμολόγηση», ενώ
 *      `properties:impactGuard.fields.commercialStatus` = «Εμπορική κατάσταση».
 *
 * Η άγκυρα δεν διαγράφηκε — **αντιστράφηκε**: φυλά πλέον ότι το ψευδώνυμο
 * δεν θα επιστρέψει.
 */
describe('formatImpactValue · commercial = pricing object (ADR-197)', () => {
  test('pricing object → labelled money segments', () => {
    const raw = JSON.stringify({ askingPrice: 200000, rentPrice: null, finalPrice: null });
    expect(formatImpactValue(fakeT as never, 'commercial', raw))
      .toBe('Τιμή ζήτησης: 200.000 €');
  });

  test('owners → name (pct), comma-joined', () => {
    const raw = JSON.stringify({
      owners: [{ name: 'Α. Παπαδόπουλος', ownershipPct: 60 }, { name: 'Β. Γεωργίου' }],
    });
    expect(formatImpactValue(fakeT as never, 'commercial', raw))
      .toBe('Αγοραστές: Α. Παπαδόπουλος (60%), Β. Γεωργίου');
  });

  test('commercialStatus context decides WHICH price is shown', () => {
    const raw = JSON.stringify({ askingPrice: 200000, rentPrice: 1250 });

    // χωρίς συμφραζόμενα → και οι δύο (δεν κρύβουμε ό,τι δεν ξέρουμε)
    expect(formatImpactValue(fakeT as never, 'commercial', raw))
      .toBe('Τιμή ζήτησης: 200.000 € · Μηνιαίο ενοίκιο: 1.250 €');

    // πώληση → μόνο η ζητούμενη
    expect(formatImpactValue(fakeT as never, 'commercial', raw, { commercialStatus: 'for-sale' }))
      .toBe('Τιμή ζήτησης: 200.000 €');

    // ενοικίαση → μόνο το ενοίκιο
    expect(formatImpactValue(fakeT as never, 'commercial', raw, { commercialStatus: 'for-rent' }))
      .toBe('Μηνιαίο ενοίκιο: 1.250 €');

    // και τα δύο
    expect(formatImpactValue(fakeT as never, 'commercial', raw, { commercialStatus: 'for-sale-and-rent' }))
      .toBe('Τιμή ζήτησης: 200.000 € · Μηνιαίο ενοίκιο: 1.250 €');
  });

  test('finalPrice + reservationDeposit αγνοούν το φίλτρο κατάστασης (είναι γεγονότα, όχι προσφορές)', () => {
    const raw = JSON.stringify({ finalPrice: 195000, reservationDeposit: 5000 });
    expect(formatImpactValue(fakeT as never, 'commercial', raw, { commercialStatus: 'sold' }))
      .toBe('Τελική τιμή: 195.000 € · Προκαταβολή κράτησης: 5.000 €');
  });

  test('REGRESSION — σκέτο token κατάστασης ΔΕΝ είναι τιμολόγηση και δεν μεταφράζεται ως enum', () => {
    // Αν κάποιος ξαναγράψει `case 'commercial':` δίπλα στο `commercialStatus`,
    // αυτή η γραμμή κοκκινίζει. Η σωστή απάντηση για σκέτο token είναι «ωμό».
    expect(formatImpactValue(fakeT as never, 'commercial', 'for-sale')).toBe('for-sale');
  });
});

/**
 * ΑΓΚΥΡΑ ΚΛΑΣΗΣ — «κάθε πεδίο που **παράγει** ο server έχει **δηλωμένη** παρουσίαση».
 *
 * Ο παραγωγός (`FIELD_KIND_MAP`) και ο μορφοποιητής (`switch (field)`) είναι **δύο
 * λίστες που μπορούν να αποκλίνουν σιωπηλά**: πεδίο χωρίς `case` πέφτει στο
 * `default: return raw`, δηλαδή βγαίνει **ωμό στην οθόνη** χωρίς να κοκκινίσει τίποτα.
 * Η άγκυρα δεν απαγορεύει το ωμό — απαιτεί να είναι **απόφαση με λόγο**.
 *
 * ⚠️ Διαβάζει τα δύο αρχεία ως **κείμενο** επίτηδες: ο παραγωγός είναι `server-only`
 * (firebase-admin) και το `import` του θα έσπαγε τη σουίτα σε jsdom.
 */
describe('field presentation contract', () => {
  const ROOT = path.resolve(__dirname, '../../../../..');

  const PRODUCER = 'src/lib/firestore/property-mutation-impact-preview.service.ts';
  const FORMATTER = 'src/features/property-details/utils/impact-value-formatter.ts';

  type Presentation =
    | 'formatted'                 // έχει `case` — μεταφράζεται ή συντίθεται
    | 'raw-by-design'             // η αποθηκευμένη τιμή ΕΙΝΑΙ ήδη αναγνώσιμη από άνθρωπο
    | 'raw-unresolved-identity';  // 🔴 αδιαφανές id που ΟΦΕΙΛΕΙ να λυθεί σε όνομα

  const FIELD_PRESENTATION: Readonly<Record<string, { state: Presentation; why: string }>> = {
    name: { state: 'raw-by-design', why: 'ελεύθερο κείμενο που έγραψε ο χρήστης — δεν υπάρχει τι να μεταφραστεί' },
    code: { state: 'raw-by-design', why: 'κωδικός μονάδας (π.χ. A-GK-1.04) — αναγνώσιμη ταυτότητα ως έχει' },
    floor: { state: 'raw-by-design', why: 'αριθμός ορόφου· η ετικέτα «Όροφος» έρχεται από το impactGuard.fields' },
    type: { state: 'formatted', why: 'enum properties-enums:types.*' },
    commercialStatus: { state: 'formatted', why: 'enum properties-enums:commercialStatus.*' },
    commercial: { state: 'formatted', why: 'PropertyCommercialData (ADR-197) — σύνθεση ποσών, ιδιοκτητών, ημερομηνιών' },
    linkedSpaces: { state: 'formatted', why: 'πίνακας συνδεδεμένων χώρων — τύπος × ποσότητα · κωδικός · υπαγωγή' },
    areas: { state: 'formatted', why: 'δομημένο αντικείμενο εμβαδών με μονάδα μέτρησης' },
    layout: { state: 'formatted', why: 'δομημένο αντικείμενο διαρρύθμισης (υπνοδωμάτια/μπάνια/wc)' },
    orientations: { state: 'formatted', why: 'πίνακας enum προσανατολισμών' },
    condition: { state: 'formatted', why: 'enum properties-enums:condition.*' },
    energy: { state: 'formatted', why: 'ενεργειακή κλάση με πρόθεμα ετικέτας' },
    systemsOverride: { state: 'formatted', why: 'enum θέρμανσης και ψύξης με ετικέτες' },
    finishes: { state: 'formatted', why: 'enum δαπέδων, κουφωμάτων και υαλοπινάκων' },
    interiorFeatures: { state: 'formatted', why: 'πίνακας enum εσωτερικών χαρακτηριστικών' },
    securityFeatures: { state: 'formatted', why: 'πίνακας enum χαρακτηριστικών ασφαλείας' },

    // 🔴 ΔΗΛΩΜΕΝΟ ΧΡΕΟΣ — δεν είναι «εντάξει», είναι «γνωστό και ονομασμένο».
    buildingId: { state: 'raw-unresolved-identity', why: 'βάφει bldg_<uuid> στην οθόνη· θεραπεία = ζεύγος ταυτότητας/ετικέτας κατά ADR-195 (oldValueLabel/newValueLabel), απαιτεί αλλαγή του συμβολαίου του server' },
    floorId: { state: 'raw-unresolved-identity', why: 'βάφει flr_<uuid> στην οθόνη· ίδια θεραπεία με το buildingId — ζεύγος ταυτότητας/ετικέτας κατά ADR-195' },
  };

  function read(rel: string): string {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  }

  function producerFields(): string[] {
    const block = read(PRODUCER).match(/FIELD_KIND_MAP[^=]*=\s*\{([\s\S]*?)\n\};/);
    if (!block) {
      throw new Error(`Δεν βρέθηκε FIELD_KIND_MAP στο ${PRODUCER} — η άγκυρα δεν κοίταξε τίποτα.`);
    }
    return [...block[1].matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:/gm)].map((m) => m[1]);
  }

  function formatterCases(): string[] {
    const block = read(FORMATTER).match(/switch \(field\) \{([\s\S]*?)\n {2}\}/);
    if (!block) {
      throw new Error(`Δεν βρέθηκε το switch(field) στο ${FORMATTER} — η άγκυρα δεν κοίταξε τίποτα.`);
    }
    return [...block[1].matchAll(/case '([^']+)'/g)].map((m) => m[1]);
  }

  // ── Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ────────────────────────────────────────────────────────
  // Χωρίς αυτό, ένα σπασμένο regex θα έδινε «0 αποκλίσεις» και η άγκυρα θα ήταν
  // πράσινη ακριβώς επειδή **δεν είδε τίποτα**.
  test('DENOMINATOR — και οι δύο πηγές διαβάστηκαν και έδωσαν πραγματικό περιεχόμενο', () => {
    const fields = producerFields();
    const cases = formatterCases();

    expect(fields.length).toBeGreaterThanOrEqual(10);
    expect(cases.length).toBeGreaterThanOrEqual(10);

    // μάρτυρες με όνομα: αν λείπουν, ο αναλυτής κοιτάζει λάθος μπλοκ
    expect(fields).toEqual(expect.arrayContaining(['commercialStatus', 'buildingId', 'linkedSpaces']));
    expect(cases).toEqual(expect.arrayContaining(['commercialStatus', 'commercial', 'linkedSpaces']));

    // δεν διαρρέει το `default:` μέσα στα ονόματα πεδίων
    expect(fields).not.toContain('default');
  });

  test('κάθε πεδίο του παραγωγού έχει δηλωμένη παρουσίαση (νέο πεδίο ⇒ ΜΠΛΟΚ)', () => {
    const undeclared = producerFields().filter((f) => !(f in FIELD_PRESENTATION));
    expect(undeclared).toEqual([]);
  });

  test('καμία δήλωση δεν περισσεύει (πεδίο που έφυγε ⇒ ΜΠΛΟΚ)', () => {
    const fields = new Set(producerFields());
    const orphan = Object.keys(FIELD_PRESENTATION).filter((f) => !fields.has(f));
    expect(orphan).toEqual([]);
  });

  test('«formatted» σημαίνει ότι ΥΠΑΡΧΕΙ case — και το αντίστροφο', () => {
    const cases = new Set(formatterCases());

    const claimsFormattedButHasNoCase = Object.entries(FIELD_PRESENTATION)
      .filter(([field, decl]) => decl.state === 'formatted' && !cases.has(field))
      .map(([field]) => field);
    expect(claimsFormattedButHasNoCase).toEqual([]);

    const hasCaseButNotDeclaredFormatted = [...cases]
      .filter((c) => FIELD_PRESENTATION[c]?.state !== 'formatted');
    expect(hasCaseButNotDeclaredFormatted).toEqual([]);
  });

  test('κάθε δήλωση κουβαλά λόγο — «ωμό» επιτρέπεται ως απόφαση, ποτέ ως παράλειψη', () => {
    const reasonless = Object.entries(FIELD_PRESENTATION)
      .filter(([, decl]) => decl.why.trim().length < 20)
      .map(([field]) => field);
    expect(reasonless).toEqual([]);
  });

  test('ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ — κάθε πεδίο σε ακριβώς έναν κάδο, το άθροισμα κλείνει', () => {
    const fields = producerFields();
    const tally: Record<Presentation, string[]> = {
      'formatted': [],
      'raw-by-design': [],
      'raw-unresolved-identity': [],
    };

    for (const field of fields) {
      const decl = FIELD_PRESENTATION[field];
      if (!decl) {
        throw new Error(`Αδήλωτο πεδίο «${field}» — fail-closed.`);
      }
      if (!(decl.state in tally)) {
        throw new Error(`Άγνωστη κατάσταση «${decl.state}» για το πεδίο «${field}».`);
      }
      tally[decl.state].push(field);
    }

    const counted =
      tally['formatted'].length +
      tally['raw-by-design'].length +
      tally['raw-unresolved-identity'].length;
    expect(counted).toBe(fields.length);

    // 🔴 Το δηλωμένο χρέος τυπώνεται **με ονόματα**, ακόμα κι όταν είναι σταθερό:
    // ένας σκέτος αριθμός θα διαβαζόταν ως «τακτοποιημένο».
    expect([...tally['raw-unresolved-identity']].sort()).toEqual(['buildingId', 'floorId']);
  });
});
