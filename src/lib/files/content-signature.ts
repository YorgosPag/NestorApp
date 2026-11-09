/**
 * =============================================================================
 * ΤΙ ΕΙΝΑΙ ΑΥΤΑ ΤΑ BYTES; — ΥΠΟΓΡΑΦΗ ΠΕΡΙΕΧΟΜΕΝΟΥ (ADR-934 §5.2 Μ4 · §5.2.2 Μ-β2)
 * =============================================================================
 *
 * Ο **ΕΝΑΣ** ανιχνευτής τύπου από τα πρώτα bytes. Ένα αρχείο από διεύθυνση τρίτου έχει **τρεις** δηλώσεις που μπορεί να
 * ψεύδονται (κατάληξη στη διεύθυνση · `AttachmentFilename` · `Content-Type`) και **μία** που δεν ψεύδεται: τα bytes.
 *
 * 🔑 **Δεμένος στο μητρώο τύπων, όχι δεύτερος πίνακας MIME** (`classification-registry`): κάθε οικογένεια δηλώνει
 *   **καταλήξεις του μητρώου**, και το MIME βγαίνει από το μητρώο (`canonicalMimeForExt`). Μόνο το βίντεο, που το μητρώο
 *   γνωρίζει ως **οικογένεια** `video/*` και όχι ανά κατάληξη, δηλώνει MIME εδώ. Τύπος που το μητρώο δεν ξέρει (HEIC ·
 *   WOFF · GLB · RVT) **δεν** αναγνωρίζεται: η προσθήκη του είναι απόφαση του μητρώου, όχι αυτού του αρχείου.
 * 🔑 **Περιέκτες που δεν ξεχωρίζουν από τα πρώτα bytes** (OLE2: RFA · DOC · XLS · PPT — ZIP: DOCX · XLSX · PPTX): η
 *   δηλωμένη κατάληξη διαλέγει **μέσα** στην οικογένεια· δεν μπορεί να κάνει PDF ένα ZIP. OLE2 χωρίς δήλωση ⇒ άγνωστο
 *   (δεν μαντεύουμε RFA)· ZIP χωρίς δήλωση ⇒ `zip` (είναι αλήθεια).
 * 🔑 **Η σελίδα HTML αναγνωρίζεται ΡΗΤΑ** με τα πρότυπα του WHATWG MIME Sniffing §7.1 (ό,τι κάνει κάθε browser) **και** με
 *   το όνομα του ριζικού στοιχείου (`<html` μετά από δήλωση XML ή σχόλια). Είναι το συχνότερο λάθος συνδέσμου προμηθευτή:
 *   σελίδα σύνδεσης ή «404» με κωδικό 200.
 * 🔑 Το IFC κρίνεται από την κεφαλίδα STEP **και** το `FILE_SCHEMA` (`IFC…`): ένα STEP AP214 μηχανολογικού σχεδίου δεν είναι
 *   μοντέλο κτιρίου. Το PDF γίνεται δεκτό με την κεφαλίδα ως το byte 1024 (ISO 32000, σημείωση υλοποίησης των αναγνωστών).
 *
 * ⛔ **ΚΑΘΑΡΟ MODULE** — κανένα I/O, κανένα Node/DOM API πέρα από `TextDecoder`. Ίδια απάντηση σε browser και server.
 *
 * @module lib/files/content-signature
 */

import { canonicalMimeForExt } from '@/config/file-types/classification-registry';

/** Πόσα πρώτα bytes ζητά η ανίχνευση. Το IFC κρατά το `FILE_SCHEMA` στην κεφαλίδα του, μέσα στα πρώτα KB. */
export const CONTENT_SIGNATURE_HEAD_BYTES = 8192;

/** Ως πού μπορεί να βρίσκεται η κεφαλίδα `%PDF-` (οι αναγνώστες PDF ανέχονται σκουπίδια πριν από αυτήν). */
const PDF_HEADER_WINDOW = 1024;

export const CONTENT_SIGNATURE_IDS = [
  'pdf',
  'png',
  'jpeg',
  'gif',
  'webp',
  'tiff',
  'avif',
  'svg',
  'ifc',
  'ole2',
  'zip',
  'ttf',
  'otf',
  'mp4',
  'mov',
  'webm',
  'mkv',
] as const;

export type ContentSignatureId = (typeof CONTENT_SIGNATURE_IDS)[number];

/** Τι bytes είναι μια οικογένεια: ποιες καταλήξεις τους ταιριάζουν και ποια ισχύει όταν δεν δηλώθηκε καμία δική της. */
export interface ContentSignatureFamily {
  /** Καταλήξεις **του μητρώου** (ή, για βίντεο, της οικογένειας `video/*`) που ταιριάζουν σε αυτά τα bytes. */
  readonly extensions: readonly string[];
  /** Η κατάληξη όταν η δηλωμένη δεν είναι της οικογένειας. `null` ⇒ τα bytes δεν αρκούν για να ειπωθεί τι είναι. */
  readonly undeclared: string | null;
  /** Μόνο βίντεο: το MIME (το μητρώο γνωρίζει το βίντεο ως οικογένεια `video/*`, όχι ανά κατάληξη). */
  readonly videoMime?: string;
}

export const CONTENT_SIGNATURE_FAMILIES: Readonly<Record<ContentSignatureId, ContentSignatureFamily>> = {
  pdf: { extensions: ['pdf'], undeclared: 'pdf' },
  png: { extensions: ['png'], undeclared: 'png' },
  jpeg: { extensions: ['jpg', 'jpeg'], undeclared: 'jpg' },
  gif: { extensions: ['gif'], undeclared: 'gif' },
  webp: { extensions: ['webp'], undeclared: 'webp' },
  tiff: { extensions: ['tif', 'tiff'], undeclared: 'tif' },
  avif: { extensions: ['avif'], undeclared: 'avif' },
  svg: { extensions: ['svg'], undeclared: 'svg' },
  ifc: { extensions: ['ifc'], undeclared: 'ifc' },
  ole2: { extensions: ['rfa', 'doc', 'xls', 'ppt'], undeclared: null },
  zip: { extensions: ['zip', 'docx', 'xlsx', 'pptx'], undeclared: 'zip' },
  ttf: { extensions: ['ttf'], undeclared: 'ttf' },
  otf: { extensions: ['otf'], undeclared: 'otf' },
  mp4: { extensions: ['mp4', 'm4v'], undeclared: 'mp4', videoMime: 'video/mp4' },
  mov: { extensions: ['mov'], undeclared: 'mov', videoMime: 'video/quicktime' },
  webm: { extensions: ['webm'], undeclared: 'webm', videoMime: 'video/webm' },
  mkv: { extensions: ['mkv'], undeclared: 'mkv', videoMime: 'video/x-matroska' },
};

/** Τι είναι τα bytes: η οικογένεια και τα `ext`/`contentType` που θα γράψει η εγγραφή αρχείου. */
export interface ContentSignature {
  readonly id: ContentSignatureId;
  readonly ext: string;
  readonly contentType: string;
}

/** Υπογραφή · σελίδα HTML (όχι αρχείο) · `null` = δεν αναγνωρίστηκε ως τύπος που ξέρει το μητρώο. */
export type ContentSniff = ContentSignature | 'html' | null;

// ============================================================================
// ΔΥΑΔΙΚΕΣ ΥΠΟΓΡΑΦΕΣ (στο byte 0)
// ============================================================================

const bytesOf = (text: string): readonly number[] => Array.from(text, (char) => char.charCodeAt(0));

function matchesAt(head: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return head.length >= offset + signature.length && signature.every((byte, index) => head[offset + index] === byte);
}

function fourCC(head: Uint8Array, offset: number): string {
  return String.fromCharCode(head[offset], head[offset + 1], head[offset + 2], head[offset + 3]);
}

function uint(head: Uint8Array, offset: number, width: number): number {
  let value = 0;
  for (let index = 0; index < width; index += 1) value = value * 256 + head[offset + index];
  return value;
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const EBML = [0x1a, 0x45, 0xdf, 0xa3];
/** TIFF: little/big endian, κλασικό (42) και BigTIFF (43). */
const TIFF_HEADERS: readonly (readonly number[])[] = [
  [0x49, 0x49, 0x2a, 0x00],
  [0x4d, 0x4d, 0x00, 0x2a],
  [0x49, 0x49, 0x2b, 0x00],
  [0x4d, 0x4d, 0x00, 0x2b],
];
/** ZIP: τοπική κεφαλίδα αρχείου · κενό αρχείο (μόνο κατάλογος). */
const ZIP_HEADERS: readonly (readonly number[])[] = [bytesOf('PK\u0003\u0004'), bytesOf('PK\u0005\u0006')];

/** sfnt (TrueType/OpenType): ο αριθμός πινάκων στο byte 4 πρέπει να είναι λογικός — 4 bytes μόνα τους είναι ασθενής υπογραφή. */
function sfntTablesSane(head: Uint8Array): boolean {
  if (head.length < 6) return false;
  const tables = uint(head, 4, 2);
  return tables >= 1 && tables <= 256;
}

function fontSignature(head: Uint8Array): ContentSignatureId | null {
  if (!sfntTablesSane(head)) return null;
  if (matchesAt(head, bytesOf('OTTO'))) return 'otf';
  if (matchesAt(head, [0x00, 0x01, 0x00, 0x00]) || matchesAt(head, bytesOf('true'))) return 'ttf';
  return null;
}

// ─── ISO BMFF (`ftyp`): AVIF · MP4 · QuickTime ──────────────────────────────────────────────────────────────────────

/** Ήχος σε περιέκτη MP4 (`M4A`, ηχοβιβλίο, iTunes): **δεν** είναι βίντεο, παρότι δηλώνει και συμβατά brands βίντεο. */
const AUDIO_MAJOR_BRANDS = new Set(['M4A ', 'M4B ', 'M4P ']);
/** HEIF/HEIC: το μητρώο δεν τα γνωρίζει ⇒ άγνωστο (ελέγχεται **μετά** το AVIF, που μοιράζεται το `mif1`). */
const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);
const AVIF_BRANDS = new Set(['avif', 'avis']);
const MP4_BRANDS = new Set([
  'isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'iso7', 'iso8', 'iso9',
  'mp41', 'mp42', 'mp71', 'avc1', 'dash', 'mmp4', 'M4V ', 'M4VH', 'M4VP', 'f4v ',
]);
/** QuickTime πριν το `ftyp` (παλιά .mov): το πρώτο κουτί είναι κατευθείαν ταινία ή δεδομένα. */
const LEGACY_QUICKTIME_BOXES = new Set(['moov', 'mdat', 'wide', 'pnot']);

/** Τα brands του `ftyp` (κύριο + συμβατά), μόνο μέσα στο μέγεθος που δηλώνει το ίδιο το κουτί. */
function ftypBrands(head: Uint8Array): readonly string[] | null {
  if (head.length < 16 || fourCC(head, 4) !== 'ftyp') return null;
  const end = Math.min(uint(head, 0, 4), head.length);
  if (end < 16) return null;
  const brands = [fourCC(head, 8)];
  for (let offset = 16; offset + 4 <= end; offset += 4) brands.push(fourCC(head, offset));
  return brands;
}

function isoMediaSignature(head: Uint8Array): ContentSignatureId | null {
  const brands = ftypBrands(head);
  if (brands === null) return head.length >= 8 && LEGACY_QUICKTIME_BOXES.has(fourCC(head, 4)) ? 'mov' : null;
  const [major] = brands;
  if (AUDIO_MAJOR_BRANDS.has(major)) return null;
  if (major === 'qt  ') return 'mov';
  if (brands.some((brand) => AVIF_BRANDS.has(brand))) return 'avif';
  if (HEIF_BRANDS.has(major)) return null;
  return brands.some((brand) => MP4_BRANDS.has(brand)) ? 'mp4' : null;
}

// ─── EBML (WebM · Matroska): το `DocType` της κεφαλίδας ─────────────────────────────────────────────────────────────

/** Πλάτος ακέραιου μεταβλητού μήκους EBML: τα αρχικά μηδενικά bits του πρώτου byte + 1 (1..8). */
function vintWidth(first: number | undefined): number | null {
  if (first === undefined || first === 0) return null;
  return Math.clz32(first) - 23;
}

function readVint(head: Uint8Array, offset: number): { readonly value: number; readonly width: number } | null {
  const width = vintWidth(head[offset]);
  if (width === null || offset + width > head.length) return null;
  let value = head[offset] & (0xff >> width);
  for (let index = 1; index < width; index += 1) value = value * 256 + head[offset + index];
  return { value, width };
}

const EBML_DOCTYPE_ID = 0x4282;

/** Διαβάζει **δομικά** τα στοιχεία της κεφαλίδας EBML ως το `DocType` — όχι αναζήτηση bytes μέσα σε δεδομένα. */
function ebmlDocType(head: Uint8Array): string | null {
  if (!matchesAt(head, EBML)) return null;
  const header = readVint(head, EBML.length);
  if (header === null) return null;
  let offset = EBML.length + header.width;
  const end = Math.min(head.length, offset + header.value);
  while (offset < end) {
    const idWidth = vintWidth(head[offset]);
    if (idWidth === null || idWidth > 4) return null;
    const id = uint(head, offset, idWidth);
    const size = readVint(head, offset + idWidth);
    if (size === null) return null;
    offset += idWidth + size.width;
    if (id === EBML_DOCTYPE_ID) return String.fromCharCode(...head.subarray(offset, Math.min(offset + size.value, end)));
    offset += size.value;
  }
  return null;
}

function ebmlSignature(head: Uint8Array): ContentSignatureId | null {
  const docType = ebmlDocType(head);
  if (docType === 'webm') return 'webm';
  return docType === 'matroska' ? 'mkv' : null;
}

/** Οι δυαδικές υπογραφές στο byte 0, με σειρά — η πρώτη που απαντά κερδίζει. */
const BINARY_DETECTORS: readonly ((head: Uint8Array) => ContentSignatureId | null)[] = [
  (head) => (matchesAt(head, PNG) ? 'png' : null),
  (head) => (matchesAt(head, JPEG) ? 'jpeg' : null),
  (head) => (matchesAt(head, bytesOf('GIF87a')) || matchesAt(head, bytesOf('GIF89a')) ? 'gif' : null),
  (head) => (matchesAt(head, bytesOf('RIFF')) && matchesAt(head, bytesOf('WEBP'), 8) ? 'webp' : null),
  (head) => (TIFF_HEADERS.some((signature) => matchesAt(head, signature)) ? 'tiff' : null),
  (head) => (matchesAt(head, bytesOf('%PDF-')) ? 'pdf' : null),
  (head) => (matchesAt(head, OLE2) ? 'ole2' : null),
  (head) => (ZIP_HEADERS.some((signature) => matchesAt(head, signature)) ? 'zip' : null),
  fontSignature,
  ebmlSignature,
  isoMediaSignature,
];

// ============================================================================
// ΚΕΙΜΕΝΟ: SVG · HTML · IFC
// ============================================================================

/** Πού τελειώνει το `marker` μέσα στο `rest` — `null` αν δεν κλείνει μέσα στα bytes που έχουμε. */
function endAfter(rest: string, marker: RegExp | string, from = 0): number | null {
  if (typeof marker === 'string') {
    const at = rest.indexOf(marker, from);
    return at < 0 ? null : at + marker.length;
  }
  const match = marker.exec(rest.slice(from));
  return match === null ? null : from + match.index + match[0].length;
}

/** DOCTYPE, με πιθανό εσωτερικό υποσύνολο `[ … ]` (που μπορεί να περιέχει `>`). */
function doctypeEnd(rest: string): number | null {
  const subset = rest.indexOf('[');
  const gt = rest.indexOf('>');
  if (gt < 0) return null;
  return subset >= 0 && subset < gt ? endAfter(rest, /\]\s*>/, subset) : gt + 1;
}

/** Πού τελειώνει το στοιχείο προοιμίου στην αρχή του `rest`: `-1` = δεν αρχίζει προοίμιο · `null` = δεν κλείνει. */
function prologEnd(rest: string): number | null {
  if (rest.startsWith('<?')) return endAfter(rest, '?>');
  if (rest.startsWith('<!--')) return endAfter(rest, '-->');
  if (/^<!doctype/i.test(rest)) return doctypeEnd(rest);
  return -1;
}

/** Προσπερνά το προοίμιο XML/HTML (δηλώσεις · σχόλια · DOCTYPE) ως το ριζικό στοιχείο. `null` ⇒ δεν φτάνουμε εκεί. */
function skipProlog(text: string): string | null {
  let rest = text.trimStart();
  for (let guard = 0; guard < 64; guard += 1) {
    const end = prologEnd(rest);
    if (end === -1) return rest;
    if (end === null) return null;
    rest = rest.slice(end).trimStart();
  }
  return null;
}

/** Το όνομα του ριζικού στοιχείου (πεζά, χωρίς πρόθεμα namespace) — ή `null` αν δεν φτάνουμε εκεί μέσα στα bytes. */
function rootElementOf(text: string): string | null {
  const rest = skipProlog(text);
  const name = rest === null ? null : /^<([A-Za-z][\w:.-]*)/.exec(rest)?.[1] ?? null;
  return name === null ? null : name.toLowerCase().replace(/^.*:/, '');
}

/**
 * WHATWG MIME Sniffing §7.1 «Identifying a resource with an unknown MIME type»: οι πίνακας προτύπων HTML, ο καθένας με
 * **byte τερματισμού ετικέτας** (κενό ή `>`), μετά από κενά WHATWG. Η σειρά και τα πρότυπα είναι του προτύπου.
 */
const WHATWG_HTML_TAGS = ['!DOCTYPE HTML', 'HTML', 'HEAD', 'SCRIPT', 'IFRAME', 'H1', 'DIV', 'FONT', 'TABLE', 'A', 'STYLE', 'TITLE', 'B', 'BODY', 'BR', 'P', '!--'];

function matchesWhatwgHtml(text: string): boolean {
  const start = text.replace(/^[\t\n\f\r ]+/, '');
  const upper = start.slice(0, 16).toUpperCase();
  return WHATWG_HTML_TAGS.some((tag) => {
    const terminator = upper.charAt(tag.length + 1);
    return upper.startsWith(`<${tag}`) && (terminator === ' ' || terminator === '>');
  });
}

/** STEP (ISO 10303-21) **με** σχήμα IFC. Χωρίς ορατό `FILE_SCHEMA` στην κεφαλίδα, αποφασίζει η δηλωμένη κατάληξη. */
function isIfc(text: string, declaredExt: string): boolean {
  if (!text.trimStart().startsWith('ISO-10303-21;')) return false;
  const schema = /FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/i.exec(text)?.[1];
  return schema === undefined ? declaredExt === 'ifc' : schema.toUpperCase().startsWith('IFC');
}

function hasLatePdfHeader(head: Uint8Array): boolean {
  const window = head.subarray(0, PDF_HEADER_WINDOW + 5);
  const header = bytesOf('%PDF-');
  for (let offset = 1; offset + header.length <= window.length; offset += 1) {
    if (matchesAt(window, header, offset)) return true;
  }
  return false;
}

// ============================================================================
// Η ΚΡΙΣΗ
// ============================================================================

function normalizedExt(declaredExt: string | null | undefined): string {
  return (declaredExt ?? '').trim().replace(/^\./, '').toLowerCase();
}

/** Η οικογένεια γίνεται `ext` + `contentType`: η δηλωμένη κατάληξη αν είναι της οικογένειας, αλλιώς η `undeclared`. */
export function resolveContentSignature(id: ContentSignatureId, declaredExt?: string | null): ContentSignature | null {
  const family = CONTENT_SIGNATURE_FAMILIES[id];
  const declared = normalizedExt(declaredExt);
  const ext = family.extensions.includes(declared) ? declared : family.undeclared;
  if (ext === null) return null;
  return { id, ext, contentType: family.videoMime ?? canonicalMimeForExt(ext) };
}

/**
 * **Τι είναι αυτά τα bytes;** — από τα πρώτα {@link CONTENT_SIGNATURE_HEAD_BYTES}. Σειρά: δυαδικές υπογραφές στο byte 0 →
 * ριζικό στοιχείο SVG → σελίδα HTML → IFC → PDF με σκουπίδια μπροστά. Η δηλωμένη κατάληξη **δεν** κάνει ποτέ τα bytes κάτι
 * άλλο· μόνο διαλέγει μέσα σε περιέκτη που τα bytes δεν ξεχωρίζουν.
 */
export function sniffContent(head: Uint8Array, declaredExt?: string | null): ContentSniff {
  for (const detect of BINARY_DETECTORS) {
    const id = detect(head);
    if (id !== null) return resolveContentSignature(id, declaredExt);
  }
  const text = new TextDecoder('utf-8').decode(head);
  const root = rootElementOf(text);
  if (root === 'svg') return resolveContentSignature('svg', declaredExt);
  if (root === 'html' || matchesWhatwgHtml(text)) return 'html';
  if (isIfc(text, normalizedExt(declaredExt))) return resolveContentSignature('ifc', declaredExt);
  return hasLatePdfHeader(head) ? resolveContentSignature('pdf', declaredExt) : null;
}
