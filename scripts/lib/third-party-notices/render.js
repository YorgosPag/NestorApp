/**
 * CHECK 3.84 / ADR-863 — ΤΙ ΒΛΕΠΕΙ Ο ΠΑΡΑΛΗΠΤΗΣ ΤΟΥ ΑΝΤΙΓΡΑΦΟΥ.
 *
 * Δύο παραδοτέα από **μία** κρίση:
 *   · `THIRD_PARTY_NOTICES.txt` — για τον **άνθρωπο** (πρότυπο VS Code / Slack / Figma)
 *   · `sbom.json` (CycloneDX) — για τη **μηχανή**, σε well-known διεύθυνση (**RFC 9472**)
 *
 * 🏆 **Το σκαλί πάνω από τους έξι που μετρήθηκαν**: Figma, Slack, Zillow, Graphisoft, VS Code
 * και Chromium δημοσιεύουν **μόνο** κείμενο για ανθρώπους. Κανείς δεν δημοσιεύει **μηχανικά
 * ανακαλύψιμη** απόδοση, παρότι το IETF έχει καταχωρήσει **μόνιμα** το well-known URI suffix
 * `sbom` (RFC 9472, κατά RFC 8615) και τα **CISA 2026 minimum elements** ζητούν ρητά
 * `Component License`. Εδώ το ίδιο γεγονός βγαίνει και στις δύο μορφές, από την ίδια πηγή —
 * άρα **δεν μπορούν να αποκλίνουν**.
 *
 * ⚠️ **ΤΑ ΚΑΝΟΝΙΚΑ ΚΕΙΜΕΝΑ ΤΥΠΩΝΟΝΤΑΙ ΜΙΑ ΦΟΡΑ, ΣΤΟ ΤΕΛΟΣ.** Το κείμενο του **πακέτου**
 * επαναλαμβάνεται ανά πακέτο επειδή κουβαλά **δικό του copyright**· τα κανονικά είναι εξ
 * ορισμού κοινά (113 πακέτα → 7 κείμενα), και η επανάληψή τους θα φούσκωνε το αρχείο χωρίς
 * να προσθέσει **καμία** νομική πληροφορία.
 *
 * @module scripts/lib/third-party-notices/render
 */

'use strict';

const { STATES, SURFACE } = require('./judge');
const { TEXT_SOURCE } = require('./texts');

const RULE = '='.repeat(78);
const THIN = '-'.repeat(78);

const HEADER = [
  'THIRD-PARTY NOTICES',
  '',
  'Το λογισμικό αυτό ενσωματώνει στοιχεία ανοιχτού κώδικα. Παρακάτω παρατίθενται οι',
  'ειδοποιήσεις πνευματικών δικαιωμάτων και τα κείμενα των αδειών τους, όπως απαιτούν',
  'οι αντίστοιχες άδειες (π.χ. MIT: «in all copies or substantial portions»· Apache-2.0',
  '§4(a): «a copy of this License»).',
  '',
  'This software includes open source components. The copyright notices and license',
  'texts below are reproduced as required by the respective licenses.',
  '',
  '⚠️ ΠΑΡΑΓΟΜΕΝΟ ΑΡΧΕΙΟ — μην το επεξεργάζεσαι με το χέρι.',
  '   Γεννήτορας: npm run third-party-notices:generate (ADR-863 · CHECK 3.84)',
];

const SECTIONS = [
  {
    surface: SURFACE.BROWSER,
    title: 'ΜΕΡΟΣ Α — ΔΙΑΝΕΜΕΤΑΙ ΣΤΟ ΠΡΟΓΡΑΜΜΑ ΠΕΡΙΗΓΗΣΗΣ',
    intro: [
      'Ο κώδικας αυτών των στοιχείων κατεβαίνει στη συσκευή σας — δηλαδή αποτελεί',
      'ΑΝΤΙΓΡΑΦΟ κατά την έννοια των αδειών, και η απόδοση είναι ΥΠΟΧΡΕΩΣΗ.',
    ],
  },
  {
    surface: SURFACE.SERVER,
    title: 'ΜΕΡΟΣ Β — ΕΚΤΕΛΕΙΤΑΙ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ',
    intro: [
      'Αυτά τα στοιχεία εκτελούνται στην υποδομή μας και ΔΕΝ διανέμονται. Παρατίθενται',
      'για ΔΙΑΦΑΝΕΙΑ, όχι επειδή το επιβάλλει κάποια άδεια.',
    ],
  },
];

const ATTRIBUTED_STATES = [STATES.ATTRIBUTED, STATES.ATTRIBUTED_CANONICAL];

/** Μια εγγραφή πακέτου: ταυτότητα, άδεια, προέλευση κειμένου — και το κείμενο όταν είναι δικό του. */
function renderEntry(row) {
  const lines = [THIN, `${row.id}`, `Άδεια: ${row.license}`];
  if (row.state === STATES.NOTICE_TEXT_MISSING) {
    lines.push('⚠️ ΚΕΙΜΕΝΟ ΑΔΕΙΑΣ: δεν βρέθηκε ούτε στο πακέτο ούτε ως κανονικό κείμενο.',
      `   ${row.detail}`);
    return lines;
  }
  if (row.state === STATES.NO_ATTRIBUTION_REQUIRED) {
    lines.push('Η άδεια δεν επιβάλλει διατήρηση ειδοποίησης.');
    return lines;
  }
  if (row.text && row.text.source === TEXT_SOURCE.CANONICAL) {
    const ids = row.text.files.map((f) => f.name.replace(/^licenses\//, '').replace(/\.txt$/, ''));
    lines.push(`Κείμενο: κανονικό κείμενο «${ids.join(' + ')}» (βλ. ΜΕΡΟΣ Γ).`,
      '   Ο εκδότης δεν συμπεριέλαβε αρχείο άδειας στο πακέτο· η ειδοποίηση πνευματικών',
      '   δικαιωμάτων του δεν δηλώθηκε και δεν εφευρίσκεται εδώ.');
    return lines;
  }
  for (const file of (row.text ? row.text.files : [])) {
    lines.push('', file.text);
  }
  return lines;
}

function renderSection(section, rows) {
  const mine = rows.filter((r) => r.surface === section.surface);
  const out = ['', RULE, section.title, RULE, ...section.intro, '', `Στοιχεία: ${mine.length}`];
  if (!mine.length) out.push('(κανένα)');
  for (const row of mine) out.push(...renderEntry(row));
  return out;
}

/** ΜΕΡΟΣ Γ: κάθε κανονικό κείμενο **μία** φορά, με τα πακέτα που το χρησιμοποιούν. */
function renderCanonical(rows) {
  const used = new Map();
  for (const row of rows) {
    if (row.state !== STATES.ATTRIBUTED_CANONICAL) continue;
    for (const file of row.text.files) {
      const entry = used.get(file.name) || { text: file.text, ids: [] };
      entry.ids.push(row.id);
      used.set(file.name, entry);
    }
  }
  if (!used.size) return [];
  const out = ['', RULE, 'ΜΕΡΟΣ Γ — ΚΑΝΟΝΙΚΑ ΚΕΙΜΕΝΑ ΑΔΕΙΩΝ', RULE,
    'Τα παρακάτω κείμενα παρατίθενται μία φορά και αφορούν τα στοιχεία που τα αναφέρουν.',
    'Προέλευση κάθε κειμένου: licenses/SOURCES.json.'];
  for (const [name, entry] of [...used].sort((a, b) => a[0].localeCompare(b[0]))) {
    out.push(THIN, name, `Στοιχεία που το χρησιμοποιούν: ${entry.ids.length}`, '', entry.text);
  }
  return out;
}

/** Το πλήρες κείμενο για ανθρώπους. */
function renderNotices(verdict, { generatedAt, fingerprint }) {
  const lines = [...HEADER, '', `Αποτύπωμα εισόδων: sha256:${fingerprint}`, `Παράχθηκε: ${generatedAt}`];
  for (const section of SECTIONS) lines.push(...renderSection(section, verdict.rows));
  lines.push(...renderCanonical(verdict.rows));
  lines.push('', RULE, `Σύνολο στοιχείων: ${verdict.rows.length}`, RULE);
  return `${lines.join('\n')}\n`;
}

/**
 * CycloneDX 1.7 — το **ίδιο** γεγονός, αναγνώσιμο από μηχανή.
 * ⚠️ Ο τύπος `purl` ακολουθεί το πρότυπο `pkg:npm/<name>@<version>` (PURL spec).
 */
function renderSbom(verdict, { generatedAt, fingerprint }) {
  const components = verdict.rows.map((row) => ({
    type: 'library',
    'bom-ref': `pkg:npm/${row.id}`,
    name: row.name,
    version: row.version,
    purl: `pkg:npm/${row.id}`,
    scope: row.surface === SURFACE.BROWSER ? 'required' : 'optional',
    licenses: [{ license: { id: row.license } }],
    properties: [
      { name: 'nestor:surface', value: row.surface },
      { name: 'nestor:attribution', value: row.state },
    ],
  }));
  return `${JSON.stringify({
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    metadata: {
      timestamp: generatedAt,
      properties: [{ name: 'nestor:inputsFingerprint', value: `sha256:${fingerprint}` }],
    },
    components,
  }, null, 2)}\n`;
}

/**
 * ADR-863 Φ3 — **ΤΟ ΤΡΙΤΟ ΠΑΡΑΔΟΤΕΟ: Ο ΚΑΤΑΛΟΓΟΣ ΓΙΑ ΤΗΝ ΟΘΟΝΗ.**
 *
 * 🔑 **ΓΙΑΤΙ ΤΡΙΤΟ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΑΝΑΓΝΩΣΗ ΤΟΥ SBOM.** Το SBOM είναι **586 KB** —
 * σχήμα CycloneDX με `bom-ref`, `purl`, `properties[]` ανά στοιχείο. Η σελίδα χρειάζεται
 * **τέσσερα πεδία**: το ίδιο γεγονός σε **61 KB**, δηλαδή **9,6×** λιγότερα bytes στο
 * σύρμα για τον άνθρωπο που απλώς ρωτά *«τι χρησιμοποιείτε;»*. Το εναλλακτικό —να
 * κατεβάζει η σελίδα το SBOM και να το κλαδεύει στον περιηγητή— θα πλήρωνε **525 KB**
 * για να τα πετάξει.
 *
 * ⚠️ **ΚΑΙ ΤΑ ΤΡΙΑ ΦΕΡΟΥΝ ΤΟ ΙΔΙΟ ΑΠΟΤΥΠΩΜΑ, ΑΡΑ ΔΕΝ ΜΠΟΡΟΥΝ ΝΑ ΑΠΟΚΛΙΝΟΥΝ.** Τρεις
 * μορφές, **μία** κρίση (`verdict`) — ποτέ τρεις υπολογισμοί.
 *
 * ⚠️ **ΣΥΜΠΑΓΕΣ, ΧΩΡΙΣ ΕΣΟΧΕΣ**: αυτό το αρχείο **κατεβαίνει σε συσκευή**, σε αντίθεση
 * με το SBOM που το ζητά μηχανή. Το `JSON.stringify(…, null, 2)` θα πρόσθετε ~40%.
 *
 * ⚠️ **ΤΟ `measured` ΤΑΞΙΔΕΥΕΙ ΜΑΖΙ**, και είναι ο λόγος που η οθόνη μπορεί να πει
 * «δεν μετρήθηκε» αντί να δείξει «0 διανέμονται» — η διαφορά ανάμεσα σε **άγνοια** και
 * σε **απουσία υποχρέωσης**, που είναι ολόκληρη.
 */
function renderIndex(verdict, { generatedAt, fingerprint, measured }) {
  return `${JSON.stringify({
    $doc: 'ΠΑΡΑΓΟΜΕΝΟ (ADR-863 · CHECK 3.84) — μην το επεξεργάζεσαι. Γεννήτορας: npm run third-party-notices:generate',
    fingerprint: `sha256:${fingerprint}`,
    generatedAt,
    measured: measured === true,
    tally: verdict.tally,
    rows: verdict.rows.map((row) => ({
      n: row.name,
      v: row.version,
      l: row.license,
      s: row.surface,
    })),
  })}\n`;
}

/** Πόσα στοιχεία απέδωσαν κείμενο — για την κλειστή λογιστική της αναφοράς. */
const attributedCount = (verdict) => verdict.rows.filter((r) => ATTRIBUTED_STATES.includes(r.state)).length;

module.exports = { HEADER, SECTIONS, renderEntry, renderSection, renderCanonical, renderNotices, renderSbom, renderIndex, attributedCount };
