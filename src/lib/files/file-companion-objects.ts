/**
 * 🧩 **ΤΑ ΣΥΝΟΔΕΥΤΙΚΑ ΑΝΤΙΚΕΙΜΕΝΑ ΕΝΟΣ ΑΡΧΕΙΟΥ** — το κλειστό μητρώο (ADR-899 §2.2 · ADR-191 document management).
 *
 * Ένα `FileRecord` δεν είναι ένα αντικείμενο στον κάδο: δίπλα στο πρωτότυπο γράφονται μικρογραφίες,
 * επεξεργασμένες σκηνές κ.λπ. Ο κάθε γραφέας έφτιαχνε το όνομα **με το χέρι** και κανείς δεν ρωτούσε
 * «ποιος τα σβήνει;» ⇒ το purge/ΓΚΠΔ έσβηνε μόνο το `storagePath` και τα υπόλοιπα έμεναν **για πάντα**
 * (μετρημένο 2026-10-01: `_thumb.webp` φωτογραφίας = προσωπικό δεδομένο).
 *
 * 🔑 **Δηλωμένο, όχι μαντεμένο** (πρότυπο GCS/S3: το παράγωγο έχει ντετερμινιστικό κλειδί από τον γονιό):
 * κάθε είδος λέει **πώς ονομάζεται** και **σε ποιον κάδο ζει**· ο γραφέας χτίζει το όνομα **εδώ**
 * ({@link fileCompanionPath}) και ο κριτής του purge διαβάζει **το ίδιο** μητρώο. Νέο είδος = νέα γραμμή εδώ,
 * αλλιώς δεν σβήνεται ποτέ.
 *
 * ⚠️ Γιατί ΚΑΙ ονόματα ΚΑΙ δείκτες της εγγραφής: μετρημένο στην παραγωγή, το autosave του CAD γράφει από
 * πάνω το `processedData.processedDataPath` (`.processed.json` ⇒ `.scene.json`) — το `.processed.json`
 * μένει στον κάδο **χωρίς** κανέναν δείκτη. Μόνο το μητρώο ονομάτων το βρίσκει.
 *
 * **Layering**: leaf — **μηδέν** imports (προβάλλεται στα Cloud Functions, ADR-874 · CHECK 3.93).
 *
 * @module lib/files/file-companion-objects
 */

/** Από τι χτίζεται το όνομα: όλο το `storagePath`, ή το **στέλεχος** του (χωρίς την τελευταία κατάληξη). */
export type FileCompanionBase = 'path' | 'stem';

/**
 * Σε ποιον κάδο το γράφει ο γραφέας του:
 * - `beside-original` — ο διακομιστής/Functions, στον **κάδο της εγγραφής** (`storagePlacement`).
 * - `client-default` — ο Firebase client SDK (`@/lib/firebase` storage), δηλαδή **πάντα** ο κανονικός κάδος.
 */
export type FileCompanionHome = 'beside-original' | 'client-default';

export interface FileCompanionKindSpec {
  readonly base: FileCompanionBase;
  readonly suffix: string;
  readonly home: FileCompanionHome;
}

/** ΤΟ ΜΗΤΡΩΟ — κάθε συνοδευτικό που γράφεται σήμερα, με τον γραφέα του. */
export const FILE_COMPANION_KINDS = {
  /** Μικρογραφία webp κάθε εικόνας στο ανέβασμα (`generate-upload-thumbnail` · CRM συνημμένα). */
  uploadThumbnail: { base: 'stem', suffix: '_thumb.webp', home: 'client-default' },
  /** Μικρογραφία κάτοψης DXF/PDF του οδηγού αποθήκευσης (`floorplan-save-orchestrator`). */
  floorplanThumbnail: { base: 'path', suffix: '_thumb.png', home: 'client-default' },
  /** Raster μικρογραφία DXF (`functions/dxf-thumbnail-onfinalize` · `dxf-thumbnail-selfheal`). */
  dxfRasterThumbnail: { base: 'path', suffix: '.thumbnail.png', home: 'beside-original' },
  /** Επεξεργασμένη σκηνή DXF (`floorplan-process.service`). */
  dxfProcessedScene: { base: 'path', suffix: '.processed.json', home: 'beside-original' },
  /** Σκηνή του autosave του DXF Viewer (`canonicalScenePath`, ADR-293). */
  cadScene: { base: 'stem', suffix: '.scene.json', home: 'client-default' },
} as const satisfies Record<string, FileCompanionKindSpec>;

export type FileCompanionKind = keyof typeof FILE_COMPANION_KINDS;

export const FILE_COMPANION_KIND_NAMES = Object.keys(FILE_COMPANION_KINDS) as readonly FileCompanionKind[];

/**
 * Τα πεδία της εγγραφής που **δείχνουν** σε συνοδευτικά — η ΓΚΠΔ τα μηδενίζει μαζί με `storagePath`/`downloadUrl`
 * (ένα URL με token προς σβησμένο αντικείμενο δεν είναι πια τίποτα — δεν μένει ούτε ως ίχνος).
 */
export const FILE_COMPANION_POINTER_FIELDS = ['thumbnailUrl', 'thumbnailStoragePath', 'processedData'] as const;

function splitPath(path: string): { readonly dir: string; readonly name: string } {
  const slash = path.lastIndexOf('/');
  return { dir: path.slice(0, slash + 1), name: path.slice(slash + 1) };
}

/** Το μονοπάτι χωρίς την **τελευταία** κατάληξη του ονόματος (`a/b.c/x.dxf` ⇒ `a/b.c/x`) — ποτέ τελεία φακέλου. */
export function storagePathStem(storagePath: string): string {
  const { dir, name } = splitPath(storagePath);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? dir + name.slice(0, dot) : storagePath;
}

/** **Το ένα** σημείο που ονομάζει ένα συνοδευτικό — το χρησιμοποιούν ο γραφέας ΚΑΙ ο κριτής του purge. */
export function fileCompanionPath(storagePath: string, kind: FileCompanionKind): string {
  const spec: FileCompanionKindSpec = FILE_COMPANION_KINDS[kind];
  return (spec.base === 'stem' ? storagePathStem(storagePath) : storagePath) + spec.suffix;
}

/**
 * 🔒 **Ανήκει αυτό το αντικείμενο σε ΑΥΤΟ το αρχείο;** — ο φρουρός πριν από κάθε διαγραφή συνοδευτικού.
 *
 * Ναι μόνο αν ζει στον **ίδιο φάκελο** και το όνομά του ξεκινά με:
 * - ολόκληρο το όνομα του πρωτοτύπου (`x.dxf` ⇒ `x.dxf…`), ή
 * - το `fileId` ακολουθούμενο από `.`/`_` — το id είναι μοναδικό (enterprise id), άρα κανένα άλλο αρχείο δεν
 *   μπορεί να έχει τέτοιο όνομα. Στέλεχος που **δεν** είναι το id (π.χ. `scan.pdf`) δεν δίνει τίποτα: θα
 *   έπιανε το `scan_thumb.webp` ενός **άλλου** αρχείου.
 *
 * Ποτέ το ίδιο το πρωτότυπο (το σβήνει ο γραφέας του purge, με τη δική του κρίση δέσμευσης).
 */
export function isCompanionPathOf(fileId: string, storagePath: string, candidate: string): boolean {
  if (candidate === storagePath) return false;
  const original = splitPath(storagePath);
  const other = splitPath(candidate);
  if (other.dir !== original.dir || other.name.length === 0) return false;
  if (other.name.startsWith(original.name)) return true;
  if (fileId.length === 0 || !other.name.startsWith(fileId)) return false;
  const next = other.name.charAt(fileId.length);
  return next === '.' || next === '_';
}

/** Ένας υποψήφιος προς διαγραφή, με τον κάδο που δηλώνει το είδος του. */
export interface FileCompanionCandidate {
  readonly path: string;
  readonly home: FileCompanionHome;
}

/**
 * Τα συνοδευτικά που **μπορεί** να έγραψε ο κάθε γραφέας για αυτό το αρχείο — από τα ονόματα του μητρώου,
 * περασμένα από τον φρουρό ({@link isCompanionPathOf}). Δεν ρωτά αν υπάρχουν: η διαγραφή είναι ιδεμποτής (404 = ήδη).
 */
export function fileCompanionCandidates(fileId: string, storagePath: string): readonly FileCompanionCandidate[] {
  return FILE_COMPANION_KIND_NAMES.map((kind) => ({
    path: fileCompanionPath(storagePath, kind),
    home: FILE_COMPANION_KINDS[kind].home,
  })).filter((candidate) => isCompanionPathOf(fileId, storagePath, candidate.path));
}
