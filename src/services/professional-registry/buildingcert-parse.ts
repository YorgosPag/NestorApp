/**
 * @fileoverview **Η ΣΕΛΙΔΑ ΑΠΟΤΕΛΕΣΜΑΤΩΝ ΤΟΥ ΜΗΤΡΩΟΥ ΕΝΕΡΓΕΙΑΚΩΝ ΕΠΙΘΕΩΡΗΤΩΝ** → ετυμηγορία (ADR-915 §40.7 Φ2).
 * @related services/professional-registry/buildingcert.client.ts (το αίτημα) · types/professional-registry-check.ts
 * @module services/professional-registry/buildingcert-parse
 *
 * 🔑 **Ο πίνακας βρίσκεται από τις ΕΠΙΚΕΦΑΛΙΔΕΣ, ποτέ από θέση** («Αρ. Μητρώου» · «Ονοματεπώνυμο» · «Κτίρια» ·
 *    «Συστήματα Θέρμανσης» · «Συστήματα Κλιματισμού»). Η σελίδα είναι HTML του 2010 χωρίς id — η θέση είναι το πρώτο
 *    που αλλάζει.
 * 🔑 **«Δεν βρέθηκε» μόνο με απόδειξη**: ο αριθμός πρέπει να **επιστρέφει** στο κρυφό πεδίο της φόρμας (η ερώτηση
 *    κατανοήθηκε) **και** να υπάρχει το μήνυμα «Δε βρέθηκαν». Οτιδήποτε άλλο ⇒ `layout-changed`, ονομαστικά — ποτέ
 *    σιωπηλό «δεν υπάρχει» για επιθεωρητή που υπάρχει.
 * 🔒 **Ελαχιστοποίηση (GDPR 5(1)(γ))**: διαβάζονται **μόνο** οι στήλες αριθμού, ονόματος και τάξεων. Διεύθυνση,
 *    τηλέφωνο και email δεν αγγίζονται καν· από το όνομα κρατιέται μόνο το επώνυμο.
 * Καθαρό (μόνο `node:crypto` για το αποτύπωμα) — καμία κλήση δικτύου, κανένα ρολόι.
 */

import { createHash } from 'node:crypto';
import { parse } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';

import { LICENCE_GRADE_SCOPES, type LicenceGradeScope } from '@/config/professional-licences';
import { stripAccents } from '@/utils/greek-text';
import type {
  RegistryGrades,
  RegistryInspectorRow,
  RegistryLookupVerdict,
  RegistryScopeAnswer,
} from '@/types/professional-registry-check';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

/** Οι επικεφαλίδες της στήλης κάθε κατηγορίας, όπως τις γράφει η σελίδα (κανονικοποιημένες). */
const SCOPE_HEADERS: Readonly<Record<LicenceGradeScope, string>> = {
  buildings: 'ΚΤΙΡΙΑ',
  heating: 'ΣΥΣΤΗΜΑΤΑ ΘΕΡΜΑΝΣΗΣ',
  cooling: 'ΣΥΣΤΗΜΑΤΑ ΚΛΙΜΑΤΙΣΜΟΥ',
};
const NUMBER_HEADER = 'ΑΡ. ΜΗΤΡΩΟΥ';
const NAME_HEADER = 'ΟΝΟΜΑΤΕΠΩΝΥΜΟ';
const NOT_FOUND_MARKER = 'ΔΕ ΒΡΕΘΗΚΑΝ ΕΠΙΘΕΩΡΗΤΕΣ';
const NUMBER_ECHO_FIELD = 'search_ministry_code';

/** «Α' Τάξη» / «Β΄ Τάξη» (ελληνικό ή λατινικό γράμμα, οποιαδήποτε απόστροφος) · «Οχι». */
const GRADE_CELL = /^([ΑΒAB])\s*['΄’`ʹ]?\s*ΤΑΞΗ$/u;
const NONE_CELL = 'ΟΧΙ';

/** Σύγκριση κειμένου: χωρίς τόνους, κεφαλαία, ένα κενό. */
function canonical(text: string): string {
  return stripAccents(text).toUpperCase().replace(/\s+/gu, ' ').trim();
}

function isElement(node: Node): node is Element {
  return 'tagName' in node;
}

function childElements(node: Node): Element[] {
  return 'childNodes' in node ? node.childNodes.filter(isElement) : [];
}

/** Όλα τα στοιχεία με αυτό το όνομα, σε σειρά εγγράφου. */
function descendants(node: Node, tagName: string): Element[] {
  const found: Element[] = [];
  for (const child of childElements(node)) {
    if (child.tagName === tagName) found.push(child);
    found.push(...descendants(child, tagName));
  }
  return found;
}

function textOf(node: Node): string {
  if (node.nodeName === '#text' && 'value' in node) return node.value;
  return 'childNodes' in node ? node.childNodes.map(textOf).join('') : '';
}

function attr(element: Element, name: string): string | null {
  return element.attrs.find((a) => a.name === name)?.value ?? null;
}

/** Τα κελιά μιας γραμμής (td/th), ως κανονικοποιημένο και ως ωμό κείμενο. */
function cellsOf(row: Element): { readonly raw: string; readonly key: string }[] {
  return childElements(row)
    .filter((cell) => cell.tagName === 'td' || cell.tagName === 'th')
    .map((cell) => ({ raw: textOf(cell), key: canonical(textOf(cell)) }));
}

/** Οι γραμμές ενός πίνακα — και όσες ζουν μέσα σε `tbody` (που ο parse5 προσθέτει πάντα). */
function rowsOf(table: Element): Element[] {
  return childElements(table).flatMap((child) => (child.tagName === 'tr' ? [child] : childElements(child).filter((r) => r.tagName === 'tr')));
}

interface ColumnMap {
  readonly number: number;
  readonly name: number;
  readonly scopes: Readonly<Record<LicenceGradeScope, number>>;
}

/** Οι θέσεις των στηλών από τις επικεφαλίδες — `null` αν λείπει έστω μία. */
function columnsOf(headerRows: readonly Element[]): ColumnMap | null {
  let number = -1;
  let name = -1;
  const scopes: Partial<Record<LicenceGradeScope, number>> = {};
  for (const row of headerRows) {
    const keys = cellsOf(row).map((cell) => cell.key);
    if (keys.includes(NUMBER_HEADER)) {
      number = keys.indexOf(NUMBER_HEADER);
      name = keys.indexOf(NAME_HEADER);
    }
    for (const scope of LICENCE_GRADE_SCOPES) if (keys.includes(SCOPE_HEADERS[scope])) scopes[scope] = keys.indexOf(SCOPE_HEADERS[scope]);
  }
  const complete = LICENCE_GRADE_SCOPES.every((scope) => scopes[scope] !== undefined);
  return number < 0 || name < 0 || !complete ? null : { number, name, scopes: scopes as Record<LicenceGradeScope, number> };
}

function scopeAnswerOf(cell: string): RegistryScopeAnswer | null {
  if (cell === NONE_CELL) return 'none';
  const match = GRADE_CELL.exec(cell);
  if (match === null) return null;
  return match[1] === 'Α' || match[1] === 'A' ? 'A' : 'B';
}

/** Μία γραμμή δεδομένων ⇒ γραμμή μητρώου, ή το όνομα αυτού που δεν αναγνωρίστηκε. */
function inspectorRowOf(cells: readonly { raw: string; key: string }[], columns: ColumnMap): RegistryInspectorRow | string {
  const grades: Partial<Record<LicenceGradeScope, RegistryScopeAnswer>> = {};
  for (const scope of LICENCE_GRADE_SCOPES) {
    const cell = cells[columns.scopes[scope]]?.key ?? '';
    const answer = scopeAnswerOf(cell);
    if (answer === null) return `grade-cell:${scope}`;
    grades[scope] = answer;
  }
  // Το όνομα είναι δύο στήλες σταθερού πλάτους (επώνυμο · όνομα) ⇒ χωρίζονται με ≥ 2 κενά.
  const surname = (cells[columns.name]?.raw ?? '').trim().split(/\s{2,}/u)[0]?.trim() ?? '';
  if (surname === '') return 'name-cell';
  const number = (cells[columns.number]?.raw ?? '').trim();
  const complete = grades as RegistryGrades;
  const rowSha256 = createHash('sha256').update(JSON.stringify([number, surname, complete])).digest('hex');
  return { number, surname, grades: complete, rowSha256 };
}

function isHeaderRow(row: Element): boolean {
  return childElements(row).some((cell) => attr(cell, 'class')?.includes('tableHeader') === true);
}

/** Ο πίνακας αποτελεσμάτων μέσα στη φόρμα: αυτός με την επικεφαλίδα «Αρ. Μητρώου». */
function resultsTableOf(form: Element): Element | null {
  return descendants(form, 'table').find((table) => rowsOf(table).some((row) => cellsOf(row).some((c) => c.key === NUMBER_HEADER))) ?? null;
}

function verdictFromTable(table: Element, number: string): RegistryLookupVerdict {
  const rows = rowsOf(table);
  const columns = columnsOf(rows.filter(isHeaderRow));
  if (columns === null) return { kind: 'layout-changed', detail: 'header-columns' };
  const matching = rows
    .filter((row) => !isHeaderRow(row))
    .map(cellsOf)
    .filter((cells) => (cells[columns.number]?.raw ?? '').trim() === number);
  if (matching.length === 0) return { kind: 'absent' };
  if (matching.length > 1) return { kind: 'ambiguous' };
  const read = inspectorRowOf(matching[0], columns);
  return typeof read === 'string' ? { kind: 'layout-changed', detail: read } : { kind: 'found', row: read };
}

/**
 * **Η σελίδα ⇒ ετυμηγορία** για τον αριθμό που ζητήθηκε. Ο αριθμός συγκρίνεται **ακριβώς** (η αναζήτηση του μητρώου
 * μπορεί να επιστρέψει και γειτονικούς).
 */
export function parseBuildingcertResults(html: string, requestedNumber: string): RegistryLookupVerdict {
  const document = parse(html);
  const form = descendants(document, 'form').find((candidate) => attr(candidate, 'id') === 'form1');
  if (form === undefined) return { kind: 'layout-changed', detail: 'form' };
  const echo = descendants(form, 'input').find((input) => attr(input, 'name') === NUMBER_ECHO_FIELD);
  if (echo === undefined || (attr(echo, 'value') ?? '').trim() !== requestedNumber) return { kind: 'layout-changed', detail: 'number-echo' };
  const table = resultsTableOf(form);
  if (table !== null) return verdictFromTable(table, requestedNumber);
  return canonical(textOf(form)).includes(NOT_FOUND_MARKER) ? { kind: 'absent' } : { kind: 'layout-changed', detail: 'no-results-marker' };
}
