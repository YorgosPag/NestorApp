/**
 * @fileoverview **What kind of survey file is this? — the bytes decide, the name only breaks ties** (ADR-920 §13.3).
 * @related ./topo-delimited-reader · ./topo-excel-reader · ./dxf-survey-points (the three readers it routes to)
 *
 * An owner renames files, exports from a phone, gets `.txt` from the surveyor that is really a DXF. The same rule
 * as `file(1)` and the browsers' MIME sniffing: the CONTENT is the evidence, the extension a hint. Every kind the
 * readers cannot open is named (`xls-legacy`, `dxf-binary`, `dwg`, `pdf`), so the screen can say what to do — never
 * «unsupported». `dwg` and `pdf` are the surveyor's DRAWING, not a points file (ADR-920 §14.11): the points reader
 * refuses them by name; the plot-outline import (Ζ4) is where they belong.
 */

export type SurveyFileKind = 'dxf' | 'delimited' | 'xlsx' | 'xls-legacy' | 'dxf-binary' | 'dwg' | 'pdf' | 'unsupported';

/** How many leading bytes the sniffer needs — the caller reads exactly this much. */
export const SURVEY_FILE_SNIFF_BYTES = 512;

/** ZIP local file header — every `.xlsx` is a ZIP. */
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;
/** OLE2 compound document — the legacy `.xls` (BIFF), which `exceljs` cannot read. */
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0] as const;
/** The sentinel a binary DXF opens with. */
const BINARY_DXF_SENTINEL = 'AutoCAD Binary DXF';
/**
 * A DWG opens with its version string: `AC1009` … `AC1032` (R12 … 2018+), or the pre-R11 `AC1.2` / `AC1.40` / `AC1.50` /
 * `AC2.10` (ODA «Open Design Specification for .dwg files», §2). Read only to REFUSE by name (ADR-920 §14.11 Π10): no
 * permissively-licensed DWG reader is installed yet, so the owner is told «save as DXF» — never «unsupported».
 */
const DWG_VERSION = /^AC(?:10\d\d|1\.\d|2\.\d)/;
/**
 * The PDF header. ISO 32000 puts `%PDF-` at the start; readers (Acrobat) accept it anywhere in the first 1024 bytes, so
 * it is looked for in the whole sniffed head, not only at offset 0.
 */
const PDF_HEADER = '%PDF-';

const DELIMITED_EXTENSIONS: ReadonlySet<string> = new Set(['csv', 'txt', 'tsv', 'xyz', 'asc', 'prn', 'pnezd', 'penz', 'pts']);

/**
 * The file dialog's filter (`accept`) — DERIVED from the same lists the sniffer uses, so a dialog never hides a file the
 * readers open. `.xls`, every DXF, `.dwg` and `.pdf` are offered on purpose: a legacy, binary or drawing file gets a
 * NAMED refusal that says what to do, which helps more than a dialog that silently greys it out (ADR-920 Β4.9 · §14.11).
 */
export const SURVEY_FILE_ACCEPT = [...DELIMITED_EXTENSIONS, 'xlsx', 'xlsm', 'xls', 'dxf', 'dwg', 'pdf'].map((extension) => `.${extension}`).join(',');

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
  if (DWG_VERSION.test(text) && !isPlainText(head)) return 'dwg'; // a DWG's header carries NULs; a CSV whose first cell is «AC1012» does not
  if (text.includes(PDF_HEADER)) return 'pdf';
  if (!isPlainText(head)) return 'unsupported';
  if (looksLikeTextDxf(text)) return 'dxf';

  const extension = extensionOf(fileName);
  if (extension === 'dxf') return 'unsupported'; // named .dxf, but no DXF structure — not ours to guess
  return DELIMITED_EXTENSIONS.has(extension) || extension === '' ? 'delimited' : 'unsupported';
}
