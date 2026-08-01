/**
 * ADR-746 §8 — 🚧 GATE: **καμία ωμή ανάγνωση `.defPoints` εκτός του SSoT.**
 *
 * ⚠️ ΓΙΑΤΙ ΥΠΑΡΧΕΙ — δύο crashes σε μία ώρα, ίδια κλάση, διαφορετική διαδρομή:
 *   1. `dim.defPoints is not iterable`            → `dimension-cull-bounds` (bitmap cache)
 *   2. `Cannot read properties of undefined`      → `dim-snap-geometry`     (snap engine)
 * Το (2) χτύπησε **αφού** το (1) είχε «διορθωθεί»: η πρώτη διόρθωση άφησε τους υπόλοιπους
 * ~40 αναγνώστες ως «Boy-Scout αργότερα». Το «αργότερα» ήρθε σε λίγα λεπτά.
 *
 * 🏛️ ΑΡΧΗ: μια συμφωνία που στηρίζεται σε **πειθαρχία** έχει ήδη σπάσει τρεις φορές
 * (ADR-716 Φ7, ADR-736, ADR-746). Ό,τι πρέπει να ισχύει σε κάθε νέο αρχείο πρέπει να είναι
 * **μηχανικά ελέγξιμο** — αλλιώς δεν είναι κανόνας, είναι ευχή.
 *
 * ✅ ΤΙ ΕΠΙΤΡΕΠΕΤΑΙ: **γραφή** (`defPoints: …`) — το gate αφορά μόνο την **ανάγνωση**.
 * ❌ ΤΙ ΜΠΛΟΚΑΡΕΙ: `x.defPoints[0]`, `[...x.defPoints]`, `const [a] = x.defPoints`,
 *    `x.defPoints.length`, `for (… of x.defPoints)` — κάθε μορφή που πετάει όταν το πεδίο λείπει.
 *
 * 🔧 ΔΙΟΡΘΩΣΗ όταν γίνει κόκκινο: `import { dimDefPoints } from '…/dimension-def-points'`
 *    και `x.defPoints` → `dimDefPoints(x)`. **ΜΗΝ** προσθέσεις το αρχείο σου στο allowlist
 *    επειδή «εκεί είναι σίγουρα ορισμένο» — αυτό ακριβώς πίστευαν και οι 40 προηγούμενοι.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const SUBAPP_ROOT = join(__dirname, '..', '..', '..');

/**
 * Αρχεία που επιτρέπεται να αγγίζουν ωμά το `.defPoints`, με **ρητή αιτιολόγηση** το καθένα.
 * Κάθε νέα εγγραφή εδώ χρειάζεται λόγο που δεν είναι «ξέρω ότι υπάρχει».
 */
const ALLOWLIST: ReadonlyArray<{ file: string; why: string }> = [
  {
    file: 'systems/dimensions/dimension-def-points.ts',
    why: 'Ο ΙΔΙΟΣ ο SSoT — κάποιος πρέπει να διαβάσει το ωμό πεδίο μία φορά.',
  },
  {
    file: 'systems/scale/scale-dimension.ts',
    why: 'Το `e.defPoints && {…}` είναι ΣΚΟΠΙΜΟ: παράγει patch που παραλείπει το κλειδί όταν '
       + 'λείπει. Με `dimDefPoints` θα έγραφε ΠΑΝΤΑ πίνακα — αλλαγή σημασιολογίας σε '
       + 'μετασχηματισμό (κλίμακα/μετατόπιση), όχι ανάγνωση γεωμετρίας.',
  },
  {
    file: 'systems/dimensions/auto/run-cutline-dimension.ts',
    why: 'Το `seg` είναι plan object του `planCutLineChain` (εσωτερικά παραγόμενο στο ίδιο tick), '
       + 'ΟΧΙ DimensionEntity από σύνορο δεδομένων.',
  },
  {
    file: 'snapping/engines/DimDefPointSnapEngine.ts',
    why: 'Έχει ήδη ρητό `Array.isArray(defPoints)` guard πριν τη χρήση.',
  },
];

const ALLOWED = new Set(ALLOWLIST.map((e) => e.file));

/**
 * Οι μορφές που **όντως πετούν** όταν το πεδίο λείπει — όχι κάθε αναφορά στη λέξη.
 *
 * ⚠️ Η πρώτη εκδοχή του gate ήταν «οτιδήποτε δεν είναι `defPoints:`» και παρήγαγε **7 false
 * positives**: έπιανε γραφές (`patch.defPoints = …`), περάσματα τιμής (`{ defPoints: p.defPoints }`
 * — δεν αποαναφοροποιεί, δεν πετάει) και **spread τοπικής μεταβλητής** (`[...defPoints]`, όπου το
 * `...` περιέχει κυριολεκτικά `.defPoints`). Ένα gate με θόρυβο αγνοείται και μετά αφαιρείται —
 * ο κανόνας N.12 το λέει ρητά για τον ≤10% πήχη false positives.
 */
const DANGEROUS_READS: ReadonlyArray<{ re: RegExp; form: string }> = [
  { re: /\w\.defPoints\s*\[/, form: 'δεικτοδότηση: x.defPoints[i]' },
  { re: /\w\.defPoints\s*\./, form: 'ιδιότητα/μέθοδος: x.defPoints.length / .map' },
  { re: /\.\.\.\s*\w+\.defPoints/, form: 'spread: [...x.defPoints]' },
  { re: /\bof\s+\w+\.defPoints/, form: 'for…of x.defPoints' },
  { re: /\]\s*=\s*\w+\.defPoints/, form: 'destructuring: const [a,b] = x.defPoints' },
  { re: /=\s*\w+\.defPoints\s*;/, form: 'ανάθεση: const pts = x.defPoints;' },
];

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      collectSourceFiles(full, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** Πετά σχόλια γραμμής/μπλοκ ώστε ένα `.defPoints` μέσα σε JSDoc να μη μετράει ως ανάγνωση. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('ADR-746 GATE — το `.defPoints` διαβάζεται ΜΟΝΟ μέσω του SSoT', () => {
  it('κανένα αρχείο εκτός allowlist δεν διαβάζει ωμά το `.defPoints`', () => {
    const offenders: string[] = [];

    for (const full of collectSourceFiles(SUBAPP_ROOT)) {
      const rel = relative(SUBAPP_ROOT, full).split(sep).join('/');
      if (ALLOWED.has(rel)) continue;

      const lines = stripComments(readFileSync(full, 'utf8')).split('\n');
      lines.forEach((line, i) => {
        const hit = DANGEROUS_READS.find(({ re }) => re.test(line));
        if (hit) offenders.push(`${rel}:${i + 1} [${hit.form}] → ${line.trim()}`);
      });
    }

    expect(offenders).toEqual([]);
  });

  it('το ίδιο το gate πιάνει κάθε επικίνδυνη μορφή (self-test — ένα gate που δεν πιάνει τίποτα δεν είναι gate)', () => {
    const samples = [
      'const p = dim.defPoints[2];',
      'if (entity.defPoints.length > 0) return;',
      'const pts = [...dim.defPoints];',
      'for (const pt of entity.defPoints) {',
      'const [a, b, c] = entity.defPoints;',
      'const pts = dim.defPoints;',
    ];
    for (const sample of samples) {
      expect(DANGEROUS_READS.some(({ re }) => re.test(sample))).toBe(true);
    }
  });

  it('το gate ΔΕΝ πιάνει γραφές ούτε περάσματα τιμής (τα 7 false positives της 1ης εκδοχής)', () => {
    const legitimate = [
      'patch.defPoints = nextPts;',
      'previous.defPoints = prevPts;',
      "commands.push(new UpdateEntityCommand(id, { defPoints: patch.defPoints }, ctx.sm, 'DIMSPACE'));",
      'defPoints: geom.defPoints,',
      'defPoints: seg.defPoints,',
      "return { ...common, dimensionType: 'aligned', defPoints: [...defPoints], ...legacy };",
    ];
    for (const line of legitimate) {
      expect(DANGEROUS_READS.some(({ re }) => re.test(line))).toBe(false);
    }
  });

  it('κάθε εγγραφή του allowlist έχει αιτιολόγηση και δείχνει σε υπαρκτό αρχείο', () => {
    for (const { file, why } of ALLOWLIST) {
      expect(why.length).toBeGreaterThan(40); // «γιατί», όχι «επειδή ναι»
      expect(() => statSync(join(SUBAPP_ROOT, file))).not.toThrow();
    }
  });
});
