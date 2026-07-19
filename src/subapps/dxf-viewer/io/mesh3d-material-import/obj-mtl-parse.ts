/**
 * obj-mtl-parse — ADR-678 Φ1. Καθαροί (pure, testable) parsers για το round-trip C4D → Νέστωρ.
 *
 * Δεν φορτώνουμε γεωμετρία (three OBJLoader): για βάψιμο ΑΝΑ ΣΤΟΙΧΕΙΟ χρειαζόμαστε μόνο
 * «ποιο object → ποιο υλικό → ποιο χρώμα». Άρα ελαφρύ text parsing, μηδέν dependency, μηδέν
 * mesh που θα πετούσαμε αμέσως. Καλύπτει και `o` (objects) και `g` (groups): το C4D γράφει
 * το ένα ή το άλλο ανάλογα με το «Objects as:» setting του OBJ exporter.
 *
 * **Dominant material ανά object:** ένα C4D object μπορεί να έχει πολλά `usemtl` groups (per-face
 * βάψιμο). Στη Φ1 (ανά-στοιχείο) διαλέγουμε το υλικό με τα ΠΕΡΙΣΣΟΤΕΡΑ faces — η κυρίαρχη
 * εμφάνιση του στοιχείου. Το per-face είναι Φ3.
 *
 * @see ./match-objects-to-entities.ts — name → bimId
 * @see docs/centralized-systems/reference/adrs/ADR-678-c4d-obj-material-roundtrip-import.md
 */

/** Ανάθεση υλικού σε ένα OBJ object (dominant material ή null αν το block δεν είχε `usemtl`). */
export interface ObjectMaterialAssignment {
  readonly objectName: string;
  readonly materialName: string | null;
}

/** Ένα υλικό του `.mtl` — μόνο ό,τι χρειάζεται η Φ1 (χρώμα + διαφάνεια). */
export interface ImportedMaterial {
  readonly name: string;
  /** CSS hex από το `Kd` (π.χ. `#c0392b`). */
  readonly colorHex: string;
  /** `d` (dissolve) 0..1 — 1 = αδιαφανές. */
  readonly opacity: number;
}

/** Το πρώτο token μετά από keyword (π.χ. `o Wall_w-42` → `Wall_w-42`)· null αν λείπει. */
function firstToken(line: string): string | null {
  const rest = line.slice(line.indexOf(' ') + 1).trim();
  return rest.length > 0 ? rest : null;
}

/**
 * Περνά το OBJ κείμενο και επιστρέφει ένα assignment ανά object (`o`/`g`), με το κυρίαρχο
 * (dominant) υλικό. Γραμμές `usemtl` ορίζουν το τρέχον υλικό· `f` (face) μετρά ψήφους σε αυτό.
 */
export function parseObjObjects(objText: string): ObjectMaterialAssignment[] {
  const result: ObjectMaterialAssignment[] = [];
  let currentName: string | null = null;
  let currentMat: string | null = null;
  let faceVotes = new Map<string, number>();

  const flush = (): void => {
    if (currentName === null) return;
    let best: string | null = null;
    let bestVotes = -1;
    for (const [mat, votes] of faceVotes) {
      if (votes > bestVotes) { best = mat; bestVotes = votes; }
    }
    result.push({ objectName: currentName, materialName: best });
  };

  for (const raw of objText.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('o ') || line.startsWith('g ')) {
      flush();
      currentName = firstToken(line);
      currentMat = null;
      faceVotes = new Map();
    } else if (line.startsWith('usemtl ')) {
      currentMat = firstToken(line);
    } else if (line.startsWith('f ') && currentMat !== null) {
      faceVotes.set(currentMat, (faceVotes.get(currentMat) ?? 0) + 1);
    }
  }
  flush();
  return result;
}

/** `Kd 0.752941 0.223529 0.168627` → `#c0392b`. Clamp 0..1 → 0..255. */
function kdToHex(tokens: readonly string[]): string | null {
  const rgb = tokens.slice(0, 3).map(Number);
  if (rgb.length !== 3 || rgb.some((n) => !Number.isFinite(n))) return null;
  const hex = rgb
    .map((n) => Math.round(Math.min(1, Math.max(0, n)) * 255).toString(16).padStart(2, '0'))
    .join('');
  return `#${hex}`;
}

/**
 * Περνά το `.mtl` κείμενο → `Map<materialName, ImportedMaterial>`. `newmtl` ανοίγει υλικό,
 * `Kd` δίνει χρώμα, `d` (ή `Tr = 1 - d`) δίνει διαφάνεια. Υλικά χωρίς `Kd` παραλείπονται.
 */
export function parseMtl(mtlText: string): Map<string, ImportedMaterial> {
  const out = new Map<string, ImportedMaterial>();
  let name: string | null = null;
  let colorHex: string | null = null;
  let opacity = 1;

  const flush = (): void => {
    if (name !== null && colorHex !== null) out.set(name, { name, colorHex, opacity });
  };

  for (const raw of mtlText.split('\n')) {
    const line = raw.trim();
    const tokens = line.split(/\s+/);
    if (line.startsWith('newmtl ')) {
      flush();
      name = firstToken(line);
      colorHex = null;
      opacity = 1;
    } else if (line.startsWith('Kd ')) {
      colorHex = kdToHex(tokens.slice(1));
    } else if (line.startsWith('d ')) {
      const d = Number(tokens[1]);
      if (Number.isFinite(d)) opacity = Math.min(1, Math.max(0, d));
    } else if (line.startsWith('Tr ')) {
      const tr = Number(tokens[1]);
      if (Number.isFinite(tr)) opacity = Math.min(1, Math.max(0, 1 - tr));
    }
  }
  flush();
  return out;
}
