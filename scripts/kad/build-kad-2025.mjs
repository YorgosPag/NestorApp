/**
 * @fileoverview **Ο ΓΕΝΝΗΤΟΡΑΣ ΤΟΥ ΚΑΤΑΛΟΓΟΥ ΚΑΔ 2025** — ΦΕΚ (PDF) → `public/data/kad/kad-2025.json`.
 * @related src/lib/kad/* (ο αναγνώστης + ο κανόνας επίλυσης) · hooks/useKadOptions.ts
 *
 * ```
 * ΑΑΔΕ Α.1003/2026, Παράρτημα Ι (ΦΕΚ Β΄ 235/22.01.2026, ΚΑΔ 2025 = NACE Rev 2.1)
 *   → pdfjs-dist (κείμενο + θέσεις, σειρά ροής)  → {κωδικός, περιγραφή}
 *   → επίπεδο · γονέας · μορφή ΓΕΜΗ 8 ψηφίων  → έλεγχοι  → JSON
 * ```
 *
 * **Εκτέλεση**: `npm run build:kad -- <διαδρομή προς το PDF του ΦΕΚ>`
 * Πηγή PDF: https://www.taxheaven.gr/attachment/32064 (το ΦΕΚ, 406 σελίδες, με εξαγώγιμο κείμενο).
 *
 * 🔑 **Διάταξη του πίνακα**: ο κωδικός ζει αριστερά (x < 300pt, σε μία από έξι στήλες), η
 * περιγραφή δεξιά (x ≥ 300pt) και **αναδιπλώνεται**. Κάθε κομμάτι δεξιά ανήκει στον τελευταίο
 * κωδικό της ροής περιεχομένου (δες `extractRows`) — και πάνω από αλλαγή σελίδας.
 *
 * 🔴 **Αποτυγχάνει δυνατά** αν: το πλήθος βγει εκτός λογικού εύρους, κάποιος κωδικός
 * επαναληφθεί, κάποιος γονέας λείπει, ή κάποιος από τους ελεγχόμενους κωδικούς ΓΕΜΗ δεν
 * επιλύεται με τον κανόνα του `src/lib/kad/kad-resolve.ts`.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE_URL = 'https://www.taxheaven.gr/attachment/32064';
const OUTPUT = path.join(process.cwd(), 'public', 'data', 'kad', 'kad-2025.json');
const DESCRIPTION_MIN_X = 300;
const HEADER_MIN_Y = 760;
const ROW_TOLERANCE = 1.5;
const COUNT_RANGE = { min: 10_000, max: 12_000 };

/** Μήκος κωδικού → επίπεδο. Η σειρά είναι η ιεραρχία. */
const LEVEL_BY_LENGTH = new Map([
  [2, 'division'],
  [4, 'group'],
  [5, 'class'],
  [7, 'category'],
  [8, 'subcategory'],
  [11, 'national'],
]);
const CODE_PATTERN = /^\d{2}(\.\d(\d(\.\d(\d(\.\d{2})?)?)?)?)?$/;
const SECTION_PATTERN = /^[Α-Ω]{1,3}$/u;
/**
 * **Τυπογραφικά λάθη του ίδιου του ΦΕΚ** στη στήλη κωδικών — διορθώνονται ΡΗΤΑ, ένα-ένα, με
 * αιτιολόγηση· οτιδήποτε άλλο άγνωστο σταματά τον γεννήτορα.
 */
const SOURCE_CODE_FIXES = new Map([
  // Λείπει η τελεία· η γραμμή ακολουθεί τις 22.26.91.01–03 και προηγείται της 22.26.99.
  ['22.26.9104', '22.26.91.04'],
  // Ο τομέας «Τ» (σελ. 397) είναι γραμμένος με ΛΑΤΙΝΙΚΟ T· όλοι οι άλλοι τομείς είναι ελληνικά γράμματα.
  ['T', 'Τ'],
]);
const DEPTH = ['section', 'division', 'group', 'class', 'category', 'subcategory', 'national'];

/** Οι ΚΑΔ ΓΕΜΗ που ΠΡΕΠΕΙ να επιλύονται (η εταιρεία του χρήστη — επαληθευμένοι στο ΓΕΜΗ). */
const REQUIRED_GEMI = [
  '41000000', '41001100', '42910000', '43221000', '43221103', '43230000', '43240000', '46640835',
  '46500000', '46471112', '46471113', '46472006', '46490000', '46491921', '55200101', '55900000',
  '68110000', '68110100', '68200000', '68200200', '71113102', '71121201', '71121302', '71121303',
  '71121304', '71121305', '71121908', '71121909', '71122000', '73201000', '73201400', '73201500',
  '73201600',
];
/** Δειγματοληπτική επαλήθευση του κανόνα σύγκρουσης απέναντι στις περιγραφές του ΓΕΜΗ. */
const EXPECTED_RESOLUTION = {
  '41000000': '41.00', '46500000': '46.50', '68200000': '68.20', '68110000': '68.11',
  '55900000': '55.90', '43240000': '43.24', '71122000': '71.12.2', '43221000': '43.22.1',
};

async function loadPdfjs() {
  const require = createRequire(path.join(process.cwd(), 'package.json'));
  return import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
}

/** Τα μη κενά κομμάτια κειμένου μιας σελίδας, ΜΕ ΤΗ ΣΕΙΡΑ ΤΗΣ ΡΟΗΣ ΠΕΡΙΕΧΟΜΕΝΟΥ, χωρίς την κεφαλίδα σελίδας. */
function itemsOf(textContent, page) {
  const out = [];
  for (const item of textContent.items) {
    if (typeof item.str !== 'string' || item.str.trim() === '') continue;
    const [, , , , x, y] = item.transform;
    if (y >= HEADER_MIN_Y) continue;
    out.push({ page, x, y, width: item.width, str: item.str });
  }
  return out;
}

/** Ενώνει κομμάτια της ΙΔΙΑΣ γραμμής με κενό μόνο όπου υπάρχει πραγματικό οπτικό κενό. */
function joinLine(items) {
  let text = '';
  let end = null;
  for (const item of [...items].sort((a, b) => a.x - b.x)) {
    if (end !== null && item.x > end + 0.5) text += ' ';
    text += item.str;
    end = item.x + item.width;
  }
  return text;
}

/** Τα κομμάτια μιας περιγραφής → κείμενο: γραμμές (σελίδα ↑, y ↓), ενωμένες με κενό. */
function descriptionOf(items) {
  const lines = [];
  for (const item of items) {
    const line = lines.find((l) => l.page === item.page && Math.abs(l.y - item.y) <= ROW_TOLERANCE);
    if (line) line.items.push(item);
    else lines.push({ page: item.page, y: item.y, items: [item] });
  }
  lines.sort((a, b) => a.page - b.page || b.y - a.y);
  // Γραμμή που τελειώνει σε «γράμμα-» είναι σύνθετη λέξη κομμένη στην αναδίπλωση
  // («νικέλιου-|υδρογονωμένου»): ενώνεται ΧΩΡΙΣ κενό· κάθε άλλη γραμμή με ένα κενό.
  return lines
    .map((line) => joinLine(line.items).trim())
    .reduce((text, line) => (text === '' ? line : /\p{L}-$/u.test(text) ? text + line : `${text} ${line}`), '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ένα κομμάτι της στήλης κωδικών → κωδικός (με τις ρητές διορθώσεις), ή σφάλμα. */
function codeOf(item) {
  const raw = item.str.trim();
  const code = SOURCE_CODE_FIXES.get(raw) ?? raw;
  if (CODE_PATTERN.test(code) || SECTION_PATTERN.test(code)) return code;
  throw new Error(`Άγνωστο περιεχόμενο στη στήλη κωδικών: «${raw}» (σελ. ${item.page})`);
}

/**
 * Όλο το PDF → γραμμές {code, description} με τη σειρά του ΦΕΚ.
 *
 * 🔑 **Η ΣΕΙΡΑ ΤΗΣ ΡΟΗΣ, ΟΧΙ Η ΘΕΣΗ y.** Η κατακόρυφη στοίχιση κωδικού↔περιγραφής ΔΕΝ είναι σταθερή
 * στο ΦΕΚ (συνήθως ο κωδικός στέκεται στην τελευταία γραμμή της περιγραφής, αλλά π.χ. ο 43.42.90
 * στέκεται ΠΑΝΩ από αυτήν — μετρημένο, σελ. 172). Η ροή περιεχομένου όμως γράφει πάντα πρώτα τον
 * κωδικό και αμέσως μετά την περιγραφή του· αυτό είναι το σταθερό σήμα. Η κεφαλίδα του πίνακα
 * (μόνο σελ. 1) τελειώνει στον πρώτο τομέα («Α»).
 */
async function extractRows(pdfBytes) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: pdfBytes, isEvalSupported: false, verbosity: 0 }).promise;
  const rows = [];
  let current = null;
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    for (const item of itemsOf(await page.getTextContent(), pageNo)) {
      if (item.x >= DESCRIPTION_MIN_X) {
        current?.items.push(item);
        continue;
      }
      if (current === null && !SECTION_PATTERN.test(item.str.trim())) continue;
      current = { code: codeOf(item), items: [] };
      rows.push(current);
    }
  }
  return rows.map(({ code, items }) => {
    const description = descriptionOf(items);
    if (description === '') throw new Error(`Κωδικός χωρίς περιγραφή: ${code}`);
    return { code, description };
  });
}

function levelOf(code) {
  return SECTION_PATTERN.test(code) ? 'section' : LEVEL_BY_LENGTH.get(code.length);
}

/** Ο βαθύτερος υπαρκτός πρόγονος (κατά πρόθεμα)· για τμήμα (division), ο τομέας που προηγείται. */
function parentOf(code, level, known, currentSection) {
  if (level === 'section') return null;
  if (level === 'division') return currentSection;
  const lengths = [...LEVEL_BY_LENGTH.keys()].filter((length) => length < code.length).reverse();
  for (const length of lengths) {
    const prefix = code.slice(0, length);
    if (known.has(prefix)) return prefix;
  }
  return null;
}

/** Οι γραμμές → πλήρεις εγγραφές, με έλεγχο μοναδικότητας και γονέα. */
function toEntries(rows) {
  const known = new Set();
  const entries = [];
  let currentSection = null;
  for (const { code, description } of rows) {
    if (known.has(code)) throw new Error(`Διπλός κωδικός: ${code}`);
    const level = levelOf(code);
    const parent = parentOf(code, level, known, currentSection);
    if (level !== 'section' && parent === null) throw new Error(`Κωδικός χωρίς γονέα: ${code}`);
    if (level === 'section') currentSection = code;
    known.add(code);
    const gemi = level === 'section' ? null : code.replace(/\./g, '').padEnd(8, '0');
    entries.push({ code, gemi, description, level, parent });
  }
  return entries;
}

/** Ίδιος κανόνας με το `resolveKad`: ο ρηχότερος υποψήφιος με επίπεδο ≥ τάξη, αλλιώς ο βαθύτερος. */
function resolveGemi(entries, gemi) {
  const candidates = entries.filter((entry) => entry.gemi === gemi);
  const depth = (entry) => DEPTH.indexOf(entry.level);
  const classDepth = DEPTH.indexOf('class');
  const selectable = candidates.filter((entry) => depth(entry) >= classDepth).sort((a, b) => depth(a) - depth(b));
  if (selectable.length > 0) return selectable[0];
  return candidates.sort((a, b) => depth(b) - depth(a))[0] ?? null;
}

function validate(entries) {
  if (entries.length < COUNT_RANGE.min || entries.length > COUNT_RANGE.max) {
    throw new Error(`Ύποπτο πλήθος εγγραφών: ${entries.length}`);
  }
  const table = REQUIRED_GEMI.map((gemi) => ({ gemi, entry: resolveGemi(entries, gemi) }));
  const missing = table.filter((row) => row.entry === null).map((row) => row.gemi);
  if (missing.length > 0) throw new Error(`Δεν επιλύονται οι ΚΑΔ ΓΕΜΗ: ${missing.join(', ')}`);
  for (const [gemi, code] of Object.entries(EXPECTED_RESOLUTION)) {
    const got = resolveGemi(entries, gemi)?.code;
    if (got !== code) throw new Error(`Κανόνας σύγκρουσης: ${gemi} → ${got}, αναμενόταν ${code}`);
  }
  return table;
}

function serialize(meta, entries) {
  const lines = entries.map((entry) => `    ${JSON.stringify(entry)}`);
  return `{\n  "meta": ${JSON.stringify(meta)},\n  "entries": [\n${lines.join(',\n')}\n  ]\n}\n`;
}

function report(entries, table, sha256) {
  const perLevel = Object.fromEntries(DEPTH.map((level) => [level, entries.filter((e) => e.level === level).length]));
  console.log(`ΚΑΔ 2025: ${entries.length} εγγραφές · sha256 ${sha256}`);
  console.log('Ανά επίπεδο:', JSON.stringify(perLevel));
  for (const { gemi, entry } of table) console.log(`  ${gemi} → ${entry.code}  ${entry.description}`);
  console.log(`→ ${path.relative(process.cwd(), OUTPUT)}`);
}

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) throw new Error('Χρήση: npm run build:kad -- <διαδρομή PDF ΦΕΚ Β΄ 235/22.01.2026>');
  const bytes = await readFile(pdfPath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const entries = toEntries(await extractRows(new Uint8Array(bytes)));
  const table = validate(entries);
  const meta = {
    source: 'ΑΑΔΕ Α.1003/2026 — Παράρτημα Ι',
    fek: 'ΦΕΚ Β΄ 235/22.01.2026',
    url: SOURCE_URL,
    sha256,
    effectiveFrom: '2026-03-01',
    generatedAt: new Date().toISOString(),
    count: entries.length,
  };
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, serialize(meta, entries), 'utf8');
  report(entries, table, sha256);
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
