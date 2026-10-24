/**
 * @fileoverview **What kind of survey file is this? — the bytes decide, the name only breaks ties** (ADR-920 §13.3).
 * @related ./topo-delimited-reader · ./topo-excel-reader · ./dxf-survey-points (the three readers it routes to)
 *
 * An owner renames files, exports from a phone, gets `.txt` from the surveyor that is really a DXF. The same rule
 * as `file(1)` and the browsers' MIME sniffing: the CONTENT is the evidence, the extension a hint. Every kind the
 * readers cannot open is named (`xls-legacy`, `dxf-binary`), so the screen can say what to do — never «unsupported».
 */

export type SurveyFileKind = 'dxf' | 'delimited' | 'xlsx' | 'xls-legacy' | 'dxf-binary' | 'unsupported';

/** How many leading bytes the sniffer needs — the caller reads exactly this much. */
export const SURVEY_FILE_SNIFF_BYTES = 512;

/** ZIP local file header — every `.xlsx` is a ZIP. */
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;
/** OLE2 compound document — the legacy `.xls` (BIFF), which `exceljs` cannot read. */
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0] as const;
/** The sentinel a binary DXF opens with. */
const BINARY_DXF_SENTINEL = 'AutoCAD Binary DXF';

const DELIMITED_EXTENSIONS: ReadonlySet<string> = new Set(['csv', 'txt', 'tsv', 'xyz', 'asc', 'prn', 'pnezd', 'penz', 'pts']);

function startsWith(head: Uint8Array, magic: readonly number[]): boolean {
  return magic.every((byte, i) => head[i] === byte);
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/** A text DXF opens with group code 0 / SECTION (optionally after 999 comments). */
function looksLikeTextDxf(text: string): boolean {
  return /^\s*(?:999\s*\r?\n[^\n]*\r?\n\s*)*0\s*\r?\n\s*SECTION\b/.test(text);
}

/** Text that a NUL never appears in — a binary file the readers would misread is not «delimited». */
function isPlainText(head: Uint8Array): boolean {
  return !head.includes(0);
}

/**
 * Classify a survey file from its leading bytes ({@link SURVEY_FILE_SNIFF_BYTES}) and its name.
 * Magic bytes win; a text file is a DXF when it LOOKS like one, whatever it is called.
 */
export function surveyFileKindOf(fileName: string, head: Uint8Array): SurveyFileKind {
  if (startsWith(head, ZIP_MAGIC)) return 'xlsx';
  if (startsWith(head, OLE2_MAGIC)) return 'xls-legacy';

  const text = new TextDecoder('utf-8', { fatal: false }).decode(head);
  if (text.startsWith(BINARY_DXF_SENTINEL)) return 'dxf-binary';
  if (!isPlainText(head)) return 'unsupported';
  if (looksLikeTextDxf(text)) return 'dxf';

  const extension = extensionOf(fileName);
  if (extension === 'dxf') return 'unsupported'; // named .dxf, but no DXF structure — not ours to guess
  return DELIMITED_EXTENSIONS.has(extension) || extension === '' ? 'delimited' : 'unsupported';
}
