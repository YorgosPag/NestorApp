/**
 * @fileoverview **ΟΙ ΕΝΟΤΗΤΕΣ ΤΟΥ ΠΡΩΤΟΚΟΛΛΟΥ** — κεφαλίδα · μέρη · ίχνος · πίνακας · αποτύπωμα · όροι · επαλήθευση
 *               (ADR-916 Φ-Γ2 Σ4).
 * @module services/pdf/renderers/handover-protocol/handover-protocol-pdf-sections
 * @related handover-protocol-pdf-renderer.ts (η σειρά και η σελίδα) · report-engine/report-pdf-chrome.ts (παλέτα · περιθώριο)
 *
 * 🔑 Κάθε ενότητα παίρνει το `y` όπου ξεκινά και επιστρέφει το `y` όπου τελείωσε — καμία κοινή μεταβλητή κατάστασης.
 * 🔑 **Τα αναγνωριστικά και τα αποτυπώματα σπάνε σε σταθερά σημεία** (`chunk`), ποτέ όπου τύχει: ο άνθρωπος τα διαβάζει
 *    ομοιόμορφα, και το μηχαναγνώσιμο αντίγραφό τους είναι το `manifest.json` (χωρίς αλλαγές γραμμής).
 */

import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import type { FrozenLegalBlock, FrozenLegalSection } from '@/lib/legal/frozen-legal-document';
import { formatOperatorDateTime } from '@/lib/operator-time-format';
import {
  MARGIN,
  PRIMARY,
  SLATE_200,
  SLATE_500,
  SLATE_800,
  ensurePageSpace,
  forceRobotoCell,
  yAfterTable,
  type PdfVerticalLayout,
} from '@/services/report-engine/report-pdf-chrome';

import type { HandoverProtocolView } from './handover-protocol-view';
import type { HandoverProtocolWording } from './handover-protocol-wording';

export interface ProtocolPage {
  readonly pdf: jsPDF;
  readonly view: HandoverProtocolView;
  readonly wording: HandoverProtocolWording;
  readonly layout: PdfVerticalLayout;
  readonly width: number;
}

const LINE = 4.2;
const SMALL_LINE = 3.6;

/** Σπάει σε κομμάτια των `size` χαρακτήρων — σταθερά, για αναγνωριστικά και hex. */
const chunk = (text: string, size: number): string => (text.match(new RegExp(`.{1,${size}}`, 'gu')) ?? [text]).join('\n');
const when = (page: ProtocolPage, iso: string | null): string => (iso === null ? page.wording.unnamed : formatOperatorDateTime(iso, 'el'));
const bytesOf = (n: number): string => new Intl.NumberFormat('el-GR').format(n);

function heading(page: ProtocolPage, text: string, y: number): number {
  const top = ensurePageSpace(page.pdf, y, 12, page.layout);
  page.pdf.setFont('Roboto', 'bold');
  page.pdf.setFontSize(10.5);
  page.pdf.setTextColor(...SLATE_800);
  page.pdf.text(text, MARGIN, top + 5);
  page.pdf.setDrawColor(...SLATE_200);
  page.pdf.setLineWidth(0.2);
  page.pdf.line(MARGIN, top + 6.5, page.width - MARGIN, top + 6.5);
  return top + 10;
}

/** Παράγραφος με αναδίπλωση και αλλαγή σελίδας ανά γραμμή — ποτέ κείμενο κάτω από το υποσέλιδο. */
function paragraph(page: ProtocolPage, text: string, y: number, size = 8.5, indent = 0): number {
  page.pdf.setFont('Roboto', 'normal');
  page.pdf.setFontSize(size);
  page.pdf.setTextColor(...SLATE_800);
  const lines: string[] = page.pdf.splitTextToSize(text, page.width - 2 * MARGIN - indent);
  let cursor = y;
  for (const line of lines) {
    cursor = ensurePageSpace(page.pdf, cursor, LINE, page.layout);
    page.pdf.text(line, MARGIN + indent, cursor + 3);
    cursor += size >= 8.5 ? LINE : SMALL_LINE;
  }
  return cursor + 1.5;
}

/** Ζεύγη «ετικέτα · τιμή» σε πίνακα δύο στηλών — κεφαλίδα, μέρη, ίχνος. */
function labelled(page: ProtocolPage, rows: readonly (readonly [string, string])[], y: number, rightInset = 0): number {
  autoTable(page.pdf, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN + rightInset, top: page.layout.marginTop, bottom: page.layout.marginBottom },
    theme: 'plain',
    body: rows.map(([label, value]) => [label, value]),
    styles: { font: 'Roboto', fontSize: 8.5, cellPadding: 1, textColor: SLATE_800 },
    columnStyles: { 0: { cellWidth: 58, textColor: SLATE_500 } },
    didParseCell: forceRobotoCell,
  });
  return yAfterTable(page.pdf, y, rows.length * LINE) + 3;
}

/** **Η κεφαλίδα**: ο δεσμευτικός τίτλος του παγωμένου κειμένου, αριθμός, αναθεώρηση, έκδοση, εκδότης. */
export function drawProtocolHeader(page: ProtocolPage, y: number): number {
  const { pdf, view, wording } = page;
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(...SLATE_800);
  pdf.text(view.legalText.text.title, MARGIN, y + 6);
  const supersedes = view.supersedes === null
    ? wording.firstRevision
    : wording.supersedes(view.supersedes.revision, view.supersedes.protocolId);
  return labelled(page, [
    [wording.protocolNumber, view.protocolId],
    [wording.revision(view.revision), supersedes],
    [wording.issuedAt, when(page, view.issuedAt)],
    [wording.issuer, view.issuerName],
  ], y + 11);
}

/** **Τα μέρη**: ακίνητο + παρακολουθήματα · παραλήπτης (μόνο ονοματεπώνυμο). */
export function drawProtocolParties(page: ProtocolPage, y: number): number {
  const { view, wording } = page;
  const rows: (readonly [string, string])[] = [[wording.property, view.propertyLabel ?? wording.unnamed]];
  if (view.appurtenances.length > 0) rows.push([wording.appurtenances, view.appurtenances.join(' · ')]);
  rows.push([wording.recipient, view.recipientName ?? wording.unnamed]);
  return labelled(page, rows, y);
}

/** **Το ίχνος γεγονότων** — χρόνοι στη ζώνη του φορέα. */
export function drawProtocolEvents(page: ProtocolPage, y: number): number {
  const { view, wording } = page;
  const top = heading(page, wording.eventsHeading, y);
  return labelled(page, [
    [wording.events.saleCompleted, when(page, view.events.saleCompletedAt)],
    [wording.events.invitationAccepted, when(page, view.events.invitationAcceptedAt)],
    [wording.events.deliveryStarted, when(page, view.events.deliveryStartedAt)],
    [wording.events.deliveryCompleted, when(page, view.events.deliveryCompletedAt)],
    [wording.events.protocolIssued, when(page, view.issuedAt)],
  ], top);
}

type FileTableColumns = NonNullable<Parameters<typeof autoTable>[1]['columnStyles']>;

/** Ο ΕΝΑΣ πίνακας αρχείων του Πρωτοκόλλου — ίδια γραμματοσειρά, χρώματα, περιθώρια· επιστρέφει πού τελείωσε. */
function fileTable(page: ProtocolPage, top: number, head: readonly string[], body: readonly string[][], columnStyles: FileTableColumns): number {
  autoTable(page.pdf, {
    startY: top,
    margin: { left: MARGIN, right: MARGIN, top: page.layout.marginTop, bottom: page.layout.marginBottom },
    head: [[...head]],
    body: body.map((row) => [...row]),
    styles: { font: 'Roboto', fontSize: 6.5, cellPadding: 1.2, textColor: SLATE_800, valign: 'top' },
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontSize: 7 },
    columnStyles,
    didParseCell: forceRobotoCell,
  });
  return yAfterTable(page.pdf, top, 10);
}

/** **Ο πίνακας αρχείων** — με τη σειρά του αποτυπώματος· πηγή · αντίγραφο · SHA-256 · bytes ανά γραμμή. */
export function drawProtocolFiles(page: ProtocolPage, y: number): number {
  const { view, wording } = page;
  const top = heading(page, wording.filesHeading, y);
  const { columns } = wording;
  const after = fileTable(page, top, [columns.index, columns.file, columns.source, columns.copy, columns.sha256, columns.size],
    view.rows.map((row, i) => [
      String(i + 1), row.name ?? wording.unnamed, chunk(row.sourceFileId, 21), chunk(row.copyFileId, 21), chunk(row.sha256, 32), bytesOf(row.size),
    ]),
    { 0: { cellWidth: 7 }, 1: { cellWidth: 40 }, 2: { cellWidth: 31 }, 3: { cellWidth: 31 }, 4: { cellWidth: 43 }, 5: { cellWidth: 30, halign: 'right' } });
  return paragraph(page, wording.totals(view.rows.length, bytesOf(view.totalBytes)), after + 3);
}

/**
 * Φ-Δ.7γ (ADR-916 §5.23) — **ο δεύτερος πίνακας**: τα αρχεία χωρίς πλήρες αποτύπωμα, με CRC32C, χρόνο παράδοσης και αιτία.
 * Κενός ⇒ τίποτα δεν σχεδιάζεται: Πρωτόκολλο χωρίς κλεισμένες γραμμές μένει ίδιο με πριν.
 */
export function drawProtocolClosedFiles(page: ProtocolPage, y: number): number {
  const { view, wording } = page;
  if (view.closed.length === 0) return y;
  const top = heading(page, wording.closedHeading, y);
  const columns = wording.closedColumns;
  const after = fileTable(page, top, [columns.index, columns.file, columns.source, columns.copy, columns.crc32c, columns.size, columns.cause],
    view.closed.map((row, i) => [
      String(i + 1), `${row.name ?? wording.unnamed}
${when(page, row.deliveredAt)}`, chunk(row.sourceFileId, 21), chunk(row.copyFileId, 21),
      row.crc32c, bytesOf(row.size), `${wording.closedCauses[row.cause]} (${row.cause})`,
    ]),
    { 0: { cellWidth: 7 }, 1: { cellWidth: 34 }, 2: { cellWidth: 28 }, 3: { cellWidth: 28 }, 4: { cellWidth: 18 }, 5: { cellWidth: 22, halign: 'right' }, 6: { cellWidth: 45 } });
  return paragraph(page, wording.closedNote, after + 3, 7.5);
}

/** **Το αποτύπωμα φακέλου** — ετικέτα σχήματος + SHA-256, αυτολεξεί όπως τα ξαναϋπολογίζει ο τρίτος. */
export function drawProtocolDigest(page: ProtocolPage, y: number, scheme: string): number {
  const { view, wording } = page;
  const top = heading(page, wording.digestHeading, y);
  const after = labelled(page, [[wording.digestScheme, scheme], [wording.digestValue, chunk(view.ledgerDigest, 32)]], top);
  return paragraph(page, wording.manifestNote, after, 7.5);
}

function block(page: ProtocolPage, item: FrozenLegalBlock, y: number): number {
  switch (item.kind) {
    case 'paragraph':
    case 'clause':
      return paragraph(page, item.text, y);
    case 'list':
      return item.items.reduce((cursor, entry, i) => paragraph(page, `${item.ordered ? `${i + 1}.` : '•'} ${entry.text}`, cursor, 8.5, 3), y);
    case 'operator-identity':
      return operatorIdentity(page, y);
  }
}

/** Ο φορέας **χωρίς** διευθύνσεις email: όνομα (προσδιορισμός) · έδρα · ΑΦΜ · ΓΕΜΗ. */
function operatorIdentity(page: ProtocolPage, y: number): number {
  const { operator } = page.view;
  const { operator: labels } = page.wording;
  const name = operator.qualifier === null ? operator.name : `${operator.name} (${operator.qualifier.text})`;
  const registry = [`${labels.vatNumber} ${operator.vatNumber}`, ...(operator.gemiNumber === null ? [] : [`${labels.gemiNumber} ${operator.gemiNumber}`])];
  return [name, `${operator.seatLine} · ${operator.countryCode}`, registry.join(' · ')]
    .reduce((cursor, line) => paragraph(page, line, cursor, 8.5, 3), y);
}

function legalSection(page: ProtocolPage, section: FrozenLegalSection, y: number): number {
  const top = ensurePageSpace(page.pdf, y, 14, page.layout);
  page.pdf.setFont('Roboto', 'bold');
  page.pdf.setFontSize(9);
  page.pdf.setTextColor(...SLATE_800);
  page.pdf.text(section.heading, MARGIN, top + 3);
  return section.blocks.reduce((cursor, item) => block(page, item, cursor), top + 6);
}

/** **Οι όροι** — το δεσμευτικό κείμενο της έκδοσης σε ισχύ, αυτολεξεί, ενότητα προς ενότητα. */
export function drawProtocolTerms(page: ProtocolPage, y: number): number {
  const top = heading(page, page.wording.legalHeading(page.view.legalText.version), y);
  return page.view.legalText.text.sections.reduce((cursor, section) => legalSection(page, section, cursor), top);
}

const QR_SIZE = 26;

/** Γραμμές με ετικέτα και, δεξιά, QR — μόνο όταν υπάρχει απόλυτος σύνδεσμος (το ΕΝΑ σχήμα «σύνδεσμος + QR»). */
function qrReference(page: ProtocolPage, y: number, rows: readonly (readonly [string, string])[], qrPng: string | null): number {
  const top = ensurePageSpace(page.pdf, y, QR_SIZE + 6, page.layout);
  if (qrPng !== null) page.pdf.addImage(qrPng, 'PNG', page.width - MARGIN - QR_SIZE, top, QR_SIZE, QR_SIZE);
  const after = labelled(page, rows, top, qrPng === null ? 0 : QR_SIZE + 3);
  return Math.max(after, qrPng === null ? after : top + QR_SIZE + 3);
}

/** **Η επαλήθευση του κειμένου**: έκδοση + αποτύπωμα + σύνδεσμος, και QR μόνο όταν υπάρχει απόλυτος σύνδεσμος. */
export function drawProtocolTextReference(page: ProtocolPage, y: number, qrPng: string | null): number {
  const { view, wording } = page;
  return qrReference(page, y, [
    [wording.legalDigest, chunk(view.legalText.digest, 39)],
    [wording.legalLink, view.legalText.url ?? view.legalText.path],
  ], qrPng);
}

/** **Η επαλήθευση του πρωτοκόλλου** (Σ6): η δημόσια πόρτα για **αυτόν** τον κωδικό — ο τρίτος σκανάρει το χαρτί. */
export function drawProtocolVerification(page: ProtocolPage, y: number, qrPng: string | null): number {
  const { view, wording } = page;
  return qrReference(page, y, [[wording.verifyLink, view.verification.url ?? view.verification.path]], qrPng);
}
