/**
 * @fileoverview **Ο ΜΕΤΑΣΧΗΜΑΤΙΣΤΗΣ ΤΗΣ ΔΙΟΙΚΗΤΙΚΗΣ ΙΕΡΑΡΧΙΑΣ** — ADR-846 Φάση 4.
 *
 * ```
 * public/data/administrative-hierarchy.json   (τρέχον δέντρο ΕΛΣΤΑΤ/Καλλικράτης)
 *   + scripts/data/ypes-municipality-registry.json   (ΠΟΙΟΙ δήμοι υπάρχουν — ΥΠΕΣ)
 *   + scripts/data/kleisthenis-2019.json             (ΤΙ άλλαξε ο ν.4600/2019)
 *   →  ΕΠΑΛΗΘΕΥΣΗ  →  public/data/administrative-hierarchy.json
 * ```
 *
 * **Εκτέλεση**: `npm run build:administrative-hierarchy`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΝΤΙΚΑΤΕΣΤΗΣΕ, ΚΑΙ ΤΙ ΚΟΣΤΙΣΕ ΕΚΕΙΝΟ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ο προκάτοχος *(`scripts/update-municipalities.py`, διαγράφηκε)* κρατούσε τη
 * μεταρρύθμιση σε **χειρόγραφους πίνακες μέσα σε κώδικα** και **επινοούσε κωδικούς**
 * με τον κανόνα «κωδικός Π.Ε. + 02». Μετρημένο αποτέλεσμα, 2026-09-08:
 *
 * | τι | πόσα |
 * |---|---|
 * | κωδικοί που έπεσαν πάνω σε **υπαρκτό** δήμο | **3** *(Νέστου · Δεσκάτης · Παξών)* |
 * | δήμοι σε **λάθος Περιφερειακή Ενότητα** | **2** *(Βελβεντό→Γρεβενά, αντί Κοζάνη)* |
 * | μετονομασίες προς **λάθος** κατεύθυνση | **3** *(ΒΥΡΩΝΟΣ→ΒΥΡΩΝΑ κ.ά.)* |
 * | νόμιμες μετονομασίες που **δεν έγιναν** | **9** |
 * | δήμοι που **ΔΕΝ ΥΠΑΡΧΟΥΝ** | **1** *(«ΝΟΤΙΩΝ ΤΖΟΥΜΕΡΚΩΝ»)* |
 *
 * Καμία από αυτές δεν έσκασε. Η σύγκρουση κωδικού απλώς **εξαφάνισε** τρεις υπαρκτούς
 * δήμους από τη γεωμετρία: ο επαγγελματίας δήλωνε «Δήμος Νέστου» και **κανένας κύκλος
 * δεν τον έβρισκε ποτέ**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΜΗΤΡΩΑ, ΔΥΟ ΡΟΛΟΙ — ΚΑΙ ΓΙΑΤΙ ΟΧΙ ΕΝΑ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * | σύστημα | ρόλος | γιατί δεν αντικαθίσταται |
 * |---|---|---|
 * | **Καλλικράτης** *(`c`, θεσιακός: `<Π.Ε.><σειρά>`)* | **κλειδί γεωμετρίας + ένθεσης** | πάνω του κρέμονται 949 δημοτικές ενότητες, 6.064 κοινότητες, 13.272 οικισμοί **και όλα τα πολύγωνα** του WFS |
 * | **ΥΠΕΣ** *(`y`, μη-θεσιακός: `9001`–`9332`)* | **ύπαρξη + επίσημο όνομα** | ο Κλεισθένης πρόσθεσε `9326`–`9332` **χωρίς να πειράξει κανέναν υπάρχοντα** — άρα είναι εξ ορισμού ανθεκτικός σε μεταρρύθμιση |
 *
 * ⚠️ **Τα δύο εύρη ΔΕΝ τέμνονται** *(μετρημένο: Καλλικράτης `0101`–`7407` + `9901`·
 * ΥΠΕΣ `9001`–`9332`· επικαλύψεις **0**)*. Γι' αυτό οι επτά δήμοι του Κλεισθένη —
 * που **δεν έχουν** κωδικό Καλλικράτη, γιατί γεννήθηκαν μετά — παίρνουν ταυτότητα
 * `municipality:<κωδικός ΥΠΕΣ>`: **καμία επινόηση, καμία σύγκρουση**. Οι 326
 * Καλλικρατικοί δεν αγγίζονται — μηδέν μετανάστευση.
 *
 * 🔒 **ΤΟ ΚΡΙΣΙΜΟ: ΤΙΠΟΤΑ ΔΕΝ ΓΡΑΦΕΤΑΙ ΠΡΙΝ ΕΠΑΛΗΘΕΥΤΕΙ.** Ο προκάτοχος έγραφε πρώτα
 * και ρωτούσε ποτέ. Εδώ ο έλεγχος τρέχει **πάνω στο αποτέλεσμα, στη μνήμη**, και μια
 * αποτυχία αφήνει το αρχείο **ανέγγιχτο**.
 *
 * ♻️ **ΙΔΕΜΠΟΤΕΝΤΟ**: δεύτερη εκτέλεση δίνει byte-προς-byte το ίδιο αρχείο. Ο προκάτοχος
 * σε δεύτερη εκτέλεση **ξαναπρόσθετε** τους ίδιους δήμους — γι' αυτό δεν μπορούσε να
 * ξανατρέξει ποτέ, άρα δεν μπορούσε ούτε να διορθωθεί.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HIERARCHY_PATH = join(REPO_ROOT, 'public', 'data', 'administrative-hierarchy.json');
const REGISTRY_PATH = join(REPO_ROOT, 'scripts', 'data', 'ypes-municipality-registry.json');
const REFORM_PATH = join(REPO_ROOT, 'scripts', 'data', 'kleisthenis-2019.json');

const MUNICIPALITY = 5;
const MUNICIPAL_UNIT = 6;

interface Row {
  id: string;
  n: string;
  sn: string;
  nn: string;
  c: string;
  p: string | null;
  l: number;
  /** Κωδικός ΥΠΕΣ — **μόνο** σε δήμους· απουσιάζει από το Άγιο Όρος (δεν είναι δήμος). */
  y?: string;
  pc?: string;
  a?: string;
}

interface HierarchyFile {
  meta: { source: string; date: string; counts: Record<string, number>; levels: Record<string, string> };
  data: Row[];
}

interface CreatedMunicipality {
  readonly ypes: string;
  readonly shortName: string;
  readonly regionalUnit: string;
  readonly detachedFrom: string;
  readonly municipalUnits: readonly string[];
}

interface Reform {
  readonly created: readonly CreatedMunicipality[];
  readonly concordance: { readonly pairs: readonly { id: string; ypes: string; adoptName?: boolean }[] };
  readonly outsideRegistry: readonly { readonly id: string }[];
}

const hierarchy = JSON.parse(readFileSync(HIERARCHY_PATH, 'utf8')) as HierarchyFile;
const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as {
  data: readonly { code: string; name: string }[];
};
const reform = JSON.parse(readFileSync(REFORM_PATH, 'utf8')) as Reform;

const registryByCode = new Map(registry.data.map((entry) => [entry.code, entry.name]));

/**
 * **Ο ΕΝΑΣ κανονικοποιητής ονόματος.**
 *
 * ⚠️ Ο προκάτοχος είχε **δικό του** *(Python `str.lower()`)*, που διαφέρει από αυτόν του
 * φυλλομετρητή στο **τελικό σίγμα**: οι γραμμές της ΕΛΣΤΑΤ έγραφαν `δημοσ παξων`, οι
 * προστιθέμενες `δημος βορειας κερκυρας`. Δύο κανονικοποιητές σε ένα πεδίο αναζήτησης
 * σημαίνει ότι μισές οι εγγραφές απαντούν σε άλλη ερώτηση από τις άλλες μισές.
 */
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.\-_/\\()]/g, '')
    .toLowerCase();
}

/** Ταιριάσματος-κλειδί ονόματος: χωρίς τόνους, χωρίς «ΔΗΜΟΣ», χωρίς σημεία στίξης. */
function matchKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/^ΔΗΜΟΣ\s+/, '')
    .replace(/&/g, 'ΚΑΙ')
    .replace(/[^Α-ΩA-Z0-9]+/g, ' ')
    .trim();
}

// =============================================================================
// ΒΗΜΑ 1 — ΠΟΙΟΣ ΔΗΜΟΣ ΕΙΝΑΙ ΠΟΙΟΣ (ταύτιση με το μητρώο ΥΠΕΣ)
// =============================================================================

/**
 * Αντιστοιχεί κάθε **υπάρχουσα γραμμή** δήμου σε κωδικό ΥΠΕΣ.
 *
 * 🔑 Δύο διαδρομές, με **ρητή** προτεραιότητα: πρώτα η δηλωμένη αντιστοιχία *(οι
 * μετονομασίες και τα δύο «ΗΡΑΚΛΕΙΟΥ», που το όνομα δεν μπορεί να γεφυρώσει)*, μετά το
 * όνομα. Το αντίστροφο θα έδινε σε μετονομασμένο δήμο τον κωδικό **άλλου** που τυχαίνει
 * να λέγεται όπως λεγόταν παλιά — σιωπηλά.
 *
 * 🔴 **ΤΟ ΚΛΕΙΔΙ ΕΙΝΑΙ Η ΓΡΑΜΜΗ, ΟΧΙ ΤΟ `id`** — και αυτό δεν είναι λεπτομέρεια: η
 * είσοδος έχει **τρία διπλά `id`**, δηλαδή ακριβώς το ελάττωμα που ήρθαμε να λύσουμε.
 * Ένας πίνακας με κλειδί το `id` βάζει ΝΕΣΤΟΥ και ΝΟΤΙΩΝ ΤΖΟΥΜΕΡΚΩΝ στο **ίδιο κελί**:
 * ο δεύτερος κληρονομεί τον κωδικό του πρώτου *(άρα ο ανύπαρκτος επιβιώνει)* ή τον
 * σβήνει *(άρα ο υπαρκτός εξαφανίζεται)*. Και τα δύο μετρήθηκαν στην πρώτη εκτέλεση.
 */
function resolveYpesCodes(rows: readonly Row[]): Map<Row, string> {
  const declared = new Map(reform.concordance.pairs.map((pair) => [pair.id, pair.ypes]));
  const byName = new Map<string, string>();
  for (const [code, name] of registryByCode) byName.set(matchKey(name), code);

  const resolved = new Map<Row, string>();
  for (const row of rows) {
    if (row.l !== MUNICIPALITY) continue;
    const code = declared.get(row.id) ?? byName.get(matchKey(row.n));
    if (code !== undefined) resolved.set(row, code);
  }
  return resolved;
}

// =============================================================================
// ΒΗΜΑ 2 — ΤΟ ΝΕΟ ΣΥΝΟΛΟ ΔΗΜΩΝ
// =============================================================================

/** Η γραμμή ενός δήμου που **γέννησε** ο Κλεισθένης — ταυτότητα από το μητρώο ΥΠΕΣ. */
function createdRow(entry: CreatedMunicipality): Row {
  const officialName = registryByCode.get(entry.ypes);
  if (officialName === undefined) {
    throw new Error(`Ο κωδικός ΥΠΕΣ ${entry.ypes} δεν υπάρχει στο μητρώο — δεν επινοώ δήμο.`);
  }
  const name = `ΔΗΜΟΣ ${officialName}`;
  return {
    id: `municipality:${entry.ypes}`,
    n: name,
    sn: entry.shortName,
    nn: normalizeName(name),
    c: entry.ypes,
    p: entry.regionalUnit,
    l: MUNICIPALITY,
    y: entry.ypes,
  };
}

/**
 * Οι δήμοι, ξαναχτισμένοι από τις **δύο αυθεντίες**.
 *
 * ⚠️ Οι γραμμές των `created` **αφαιρούνται και ξαναφτιάχνονται** — όχι επειδή είναι
 * λάθος σήμερα, αλλά για να είναι η πράξη **ιδεμποτεντ**: το αποτέλεσμα εξαρτάται μόνο
 * από τη δήλωση, ποτέ από το τι βρήκε στο δίσκο.
 */
function rebuildMunicipalities(rows: readonly Row[], ypes: ReadonlyMap<Row, string>): Row[] {
  const createdCodes = new Set(reform.created.map((entry) => entry.ypes));
  const exempt = new Set(reform.outsideRegistry.map((entry) => entry.id));
  const adopt = new Map(
    reform.concordance.pairs.filter((pair) => pair.adoptName).map((pair) => [pair.id, pair.ypes]),
  );

  const kept: Row[] = [];
  for (const row of rows) {
    if (row.l !== MUNICIPALITY) continue;
    const code = ypes.get(row);
    if (exempt.has(row.id)) {
      kept.push({ ...row });
      continue;
    }
    // 🔴 Δεν είναι στο μητρώο ⇒ **δεν υπάρχει**. Έτσι φεύγει ο επινοημένος δήμος, χωρίς
    //    να τον ονομάσει κανείς — ο κανόνας πιάνει την **κλάση**, όχι το δείγμα.
    if (code === undefined) continue;
    if (createdCodes.has(code)) continue; // ξαναφτιάχνεται παρακάτω, σωστά

    const adopted = adopt.get(row.id);
    const officialName = adopted === undefined ? null : registryByCode.get(adopted) ?? null;
    const name = officialName === null ? row.n : `ΔΗΜΟΣ ${officialName}`;
    kept.push({ ...row, n: name, sn: officialName ?? row.sn, nn: normalizeName(name), y: code });
  }

  return [...kept, ...reform.created.map(createdRow)];
}

// =============================================================================
// ΒΗΜΑ 3 — ΤΑ ΠΑΙΔΙΑ ΑΚΟΛΟΥΘΟΥΝ, ΚΑΙ ΤΑ ΑΠΟΚΟΜΜΕΝΑ ΞΑΝΑΔΕΝΟΝΤΑΙ
// =============================================================================

/** Οι δημοτικές ενότητες που ο νόμος μετέφερε σε νέο δήμο. */
function reparentMunicipalUnits(rows: Row[]): number {
  const target = new Map<string, string>();
  for (const entry of reform.created) {
    for (const code of entry.municipalUnits) target.set(code, `municipality:${entry.ypes}`);
  }

  let moved = 0;
  for (const row of rows) {
    if (row.l !== MUNICIPAL_UNIT) continue;
    const parent = target.get(row.c);
    if (parent !== undefined && row.p !== parent) {
      row.p = parent;
      moved += 1;
    }
  }
  return moved;
}

/**
 * 🔴 **ΟΙ ΑΠΟΚΟΜΜΕΝΕΣ ΓΡΑΜΜΕΣ** — 176 κοινότητες και 465 οικισμοί με `p: null`.
 *
 * Συμβαίνει όπου ο δήμος **δεν έχει** δημοτικές ενότητες *(π.χ. ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ)*: ο
 * αρχικός γεννήτορας περίμενε γονέα ένα σκαλί πάνω, δεν τον βρήκε, και άφησε `null`.
 * Ο επισκέπτης που διάλεγε τέτοιον οικισμό **δεν έβρισκε** τον επαγγελματία που είχε
 * δηλώσει ολόκληρο τον δήμο — η γενεαλογία δεν έφτανε ποτέ εκεί.
 *
 * 🔑 **Δεν είναι εικασία**: ο κωδικός είναι **ένθετος** *(δήμος 4 ψηφία → δημοτική
 * ενότητα 6 → κοινότητα 8 → οικισμός 10)*, άρα ο γονέας είναι το **μακρύτερο υπαρκτό
 * πρόθεμα**. Μετρημένο: **641 στα 641** λύνονται, μηδέν αμφισημίες.
 */
function reattachOrphans(rows: Row[]): number {
  const byLevelCode = new Map<string, string>();
  for (const row of rows) byLevelCode.set(`${row.l}:${row.c}`, row.id);

  let attached = 0;
  for (const row of rows) {
    if (row.p !== null || row.l <= 1) continue;
    for (let level = row.l - 1; level >= 1; level -= 1) {
      const parent = byLevelCode.get(`${level}:${row.c.slice(0, codeLength(level))}`);
      if (parent !== undefined && parent !== row.id) {
        row.p = parent;
        attached += 1;
        break;
      }
    }
  }
  return attached;
}

/** Μήκος κωδικού Καλλικράτη ανά βαθμίδα — μετρημένο στο ίδιο το αρχείο. */
function codeLength(level: number): number {
  return { 3: 3, 4: 2, 5: 4, 6: 6, 7: 8, 8: 10 }[level] ?? 0;
}

// =============================================================================
// ΒΗΜΑ 4 — Η ΕΠΑΛΗΘΕΥΣΗ ΠΟΥ ΤΡΕΧΕΙ **ΠΡΙΝ** ΤΗ ΓΡΑΦΗ
// =============================================================================

function verify(rows: readonly Row[]): readonly string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const levelCodes = new Set<string>();

  for (const row of rows) {
    if (ids.has(row.id)) problems.push(`διπλό id: ${row.id} «${row.n}»`);
    ids.add(row.id);
    const key = `${row.l}:${row.c}`;
    if (levelCodes.has(key)) problems.push(`διπλό (επίπεδο, κωδικός): ${key} «${row.n}»`);
    levelCodes.add(key);
    if (row.id !== `${LEVEL_PREFIX[row.l]}:${row.c}`) problems.push(`ταυτότητα εκτός σχήματος: ${row.id}`);
  }

  for (const row of rows) {
    if (row.p !== null && !ids.has(row.p)) problems.push(`κρεμάμενος γονέας: ${row.id} → ${row.p}`);
  }

  problems.push(...verifyReachability(rows));
  problems.push(...verifyAgainstRegistry(rows));
  return problems;
}

const LEVEL_PREFIX: Readonly<Record<number, string>> = {
  1: 'major_geographic_unit',
  2: 'decentralized_administration',
  3: 'region',
  4: 'regional_unit',
  5: 'municipality',
  6: 'municipal_unit',
  7: 'community',
  8: 'settlement',
};

/** Κάθε τόπος κάτω από τον δήμο **φτάνει** σε δήμο — η ερώτηση του επισκέπτη. */
function verifyReachability(rows: readonly Row[]): readonly string[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const municipalities = new Set(rows.filter((row) => row.l === MUNICIPALITY).map((row) => row.id));
  const stranded: string[] = [];

  for (const row of rows) {
    if (row.l <= MUNICIPALITY) continue;
    let current: Row | undefined = row;
    let guard = 16;
    let found = false;
    while (current && guard-- > 0) {
      if (municipalities.has(current.id)) { found = true; break; }
      current = current.p === null ? undefined : byId.get(current.p);
    }
    if (!found) stranded.push(row.id);
  }

  return stranded.length === 0
    ? []
    : [`${stranded.length} γραμμές δεν φτάνουν σε δήμο (π.χ. ${stranded.slice(0, 3).join(', ')})`];
}

/** Το μητρώο ΥΠΕΣ και το δέντρο λένε **το ίδιο** για το ποιοι δήμοι υπάρχουν. */
function verifyAgainstRegistry(rows: readonly Row[]): readonly string[] {
  const exempt = new Set(reform.outsideRegistry.map((entry) => entry.id));
  const problems: string[] = [];
  const seen = new Map<string, number>();

  for (const row of rows) {
    if (row.l !== MUNICIPALITY || exempt.has(row.id)) continue;
    if (row.y === undefined) { problems.push(`δήμος χωρίς κωδικό ΥΠΕΣ: ${row.id} «${row.n}»`); continue; }
    if (!registryByCode.has(row.y)) problems.push(`κωδικός ΥΠΕΣ εκτός μητρώου: ${row.y} «${row.n}»`);
    seen.set(row.y, (seen.get(row.y) ?? 0) + 1);
  }

  for (const [code, times] of seen) {
    if (times > 1) problems.push(`ο κωδικός ΥΠΕΣ ${code} χρησιμοποιείται ${times} φορές`);
  }
  for (const [code, name] of registryByCode) {
    if (!seen.has(code)) problems.push(`λείπει δήμος του μητρώου: ${code} ${name}`);
  }
  return problems;
}

// =============================================================================
// Η ΕΚΤΕΛΕΣΗ
// =============================================================================

function main(): void {
  const original = hierarchy.data;
  const ypes = resolveYpesCodes(original);
  const municipalities = rebuildMunicipalities(original, ypes);
  const others = original.filter((row) => row.l !== MUNICIPALITY).map((row) => ({ ...row }));

  // ⚠️ Η **σειρά** των γραμμών διατηρείται κατά βαθμίδα και μετά κατά κωδικό: το αρχείο
  //    είναι παραγόμενο και μπαίνει σε git — μια αυθαίρετη σειρά θα έκανε κάθε diff
  //    αδιάβαστο, δηλαδή θα έκρυβε ακριβώς τις αλλαγές που πρέπει να ελέγξει άνθρωπος.
  const rows = [...others, ...municipalities].sort(
    (a, b) => a.l - b.l || a.c.localeCompare(b.c, 'el'),
  );

  const moved = reparentMunicipalUnits(rows);
  const attached = reattachOrphans(rows);

  const problems = verify(rows);
  if (problems.length > 0) {
    console.error(`\n❌ ΔΕΝ ΓΡΑΦΤΗΚΕ ΤΙΠΟΤΑ — ${problems.length} προβλήματα:\n`);
    for (const problem of problems.slice(0, 25)) console.error(`   • ${problem}`);
    if (problems.length > 25) console.error(`   … (+${problems.length - 25})`);
    process.exit(1);
  }

  const counts: Record<string, number> = {};
  for (const [level, key] of Object.entries(COUNT_KEY)) {
    counts[key] = rows.filter((row) => row.l === Number(level)).length;
  }

  const output = {
    meta: {
      ...hierarchy.meta,
      counts,
      generator: 'scripts/build-administrative-hierarchy.ts',
      authorities: {
        tree: 'ΕΛΣΤΑΤ / Καλλικράτης (ν. 3852/2010) — κωδικός `c`, κλειδί γεωμετρίας',
        municipalities: 'ΥΠΕΣ «Κωδικοί Δήμων — Κλεισθένης» — κωδικός `y`, ύπαρξη & όνομα',
      },
      adr: 'ADR-846 Φάση 4',
    },
    data: rows,
  };

  writeFileSync(HIERARCHY_PATH, JSON.stringify(output), 'utf8');
  console.log(`✅ ${rows.length} γραμμές · δήμοι ${counts.municipalities}`);
  console.log(`   δημοτικές ενότητες που μετακινήθηκαν: ${moved}`);
  console.log(`   αποκομμένες γραμμές που ξαναδέθηκαν: ${attached}`);
}

const COUNT_KEY: Readonly<Record<string, string>> = {
  1: 'major_geographic_units',
  2: 'decentralized_administrations',
  3: 'regions',
  4: 'regional_units',
  5: 'municipalities',
  6: 'municipal_units',
  7: 'communities',
  8: 'settlements',
};

main();
