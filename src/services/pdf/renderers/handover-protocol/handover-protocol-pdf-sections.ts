/**
 * @fileoverview **ΟΙ ΕΝΟΤΗΤΕΣ ΤΟΥ ΠΡΩΤΟΚΟΛΛΟΥ** — κεφαλίδα · μέρη · ίχνος · πίνακας · αποτύπωμα · όροι · επαλήθευση
 *               (ADR-916 Φ-Γ2 Σ4).
 * @module services/pdf/renderers/handover-protocol/handover-protocol-pdf-sections
 * @related handover-protocol-pdf-renderer.ts (η σειρά και η σελίδα) · report-engine/report-pdf-chrome.ts (παλέτα · περιθώριο)
 *
 * 🔑 Κάθε ενότητα παίρνει το `y` όπου ξεκινά και επιστρέφει το `y` όπου τελείωσε — καμία κοινή μεταβλητή κατάστασης.
 * 🔑 Τα δομικά στοιχεία της ροής (επικεφαλίδα · παράγραφος · ζεύγη · πίνακας · QR) είναι κοινή υποδομή
 *    (`services/pdf/pdf-flow.ts`, ADR-947 Φ2β)· εδώ μένει **τι** γράφει το Πρωτόκολλο.
 * 🔑 **Τα αναγνωριστικά και τα αποτυπώματα σπάνε σε σταθερά σημεία** (`chunkText`), ποτέ όπου τύχει: ο άνθρωπος τα διαβάζει
 *    ομοιόμορφα, και το μηχαναγνώσιμο αντίγραφό τους είναι το `manifest.json` (χωρίς αλλαγές γραμμής).
 */

import type { FrozenLegalBlock, FrozenLegalSection } from '@/lib/legal/frozen-legal-document';
import { formatOperatorDateTime } from '@/lib/operator-time-format';
import {
  chunkText,
  drawFlowHeading,
  drawFlowPairs,
  drawFlowParagraph,
  drawFlowQrPairs,
  drawFlowTable,
  type PdfFlowPage,
} from '@/services/pdf/pdf-flow';
import { MARGIN, SLATE_800, ensurePageSpace } from '@/services/report-engine/report-pdf-chrome';

import type { HandoverProtocolView } from './handover-protocol-view';
import type { HandoverProtocolWording } from './handover-protocol-wording';

export interface ProtocolPage extends PdfFlowPage {
  readonly view: HandoverProtocolView;
  readonly wording: HandoverProtocolWording;
}

const when = (page: ProtocolPage, iso: string | null): string => (iso === null ? page.wording.unnamed : formatOperatorDateTime(iso, 'el'));
const bytesOf = (n: number): string => new Intl.NumberFormat('el-GR').format(n);

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
  return drawFlowPairs(page, [
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
  return drawFlowPairs(page, rows, y);
}

/** **Το ίχνος γεγονότων** — χρόνοι στη ζώνη του φορέα. */
export function drawProtocolEvents(page: ProtocolPage, y: number): number {
  const { view, wording } = page;
  const top = drawFlowHeading(page, wording.eventsHeading, y);
  return drawFlowPairs(page, [
    [wording.events.saleCompleted, when(page, view.events.saleCompletedAt)],
    [wording.events.invitationAccepted, when(page, view.events.invitationAcceptedAt)],
    [wording.events.deliveryStarted, when(page, view.events.deliveryStartedAt)],
    [wording.events.deliveryCompleted, when(page, view.events.deliveryCompletedAt)],
    [wording.events.protocolIssued, when(page, view.issuedAt)],
  ], top);
}

/** **Ο πίνακας αρχείων** — με τη σειρά του αποτυπώματος· πηγή · αντίγραφο · SHA-256 · bytes ανά γραμμή. */
export function drawProtocolFiles(page: ProtocolPage, y: number): number {
  const { view, wording } = page;
  const top = drawFlowHeading(page, wording.filesHeading, y);
  const { columns } = wording;
  const after = drawFlowTable(page, top, [columns.index, columns.file, columns.source, columns.copy, columns.sha256, columns.size],
    view.rows.map((row, i) => [
      String(i + 1), row.name ?? wording.unnamed, chunkText(row.sourceFileId, 21), chunkText(row.copyFileId, 21), chunkText(row.sha256, 32), bytesOf(row.size),
    ]),
    { 0: { cellWidth: 7 }, 1: { cellWidth: 40 }, 2: { cellWidth: 31 }, 3: { cellWidth: 31 }, 4: { cellWidth: 43 }, 5: { cellWidth: 30, halign: 'right' } });
  return drawFlowParagraph(page, wording.totals(view.rows.length, bytesOf(view.totalBytes)), after + 3);
}

/**
 * Φ-Δ.7γ (ADR-916 §5.23) — **ο δεύτερος πίνακας**: τα αρχεία χωρίς πλήρες αποτύπωμα, με CRC32C, χρόνο παράδοσης και αιτία.
 * Κενός ⇒ τίποτα δεν σχεδιάζεται: Πρωτόκολλο χωρίς κλεισμένες γραμμές μένει ίδιο με πριν.
 */
export function drawProtocolClosedFiles(page: ProtocolPage, y: number): number {
  const { view, wording } = page;
  if (view.closed.length === 0) return y;
  const top = drawFlowHeading(page, wording.closedHeading, y);
  const columns = wording.closedColumns;
  const after = drawFlowTable(page, top, [columns.index, columns.file, columns.source, columns.copy, columns.crc32c, columns.size, columns.cause],
    view.closed.map((row, i) => [
      String(i + 1), `${row.name ?? wording.unnamed}
${when(page, row.deliveredAt)}`, chunkText(row.sourceFileId, 21), chunkText(row.copyFileId, 21),
      row.crc32c, bytesOf(row.size), `${wording.closedCauses[row.cause]} (${row.cause})`,
    ]),
    { 0: { cellWidth: 7 }, 1: { cellWidth: 34 }, 2: { cellWidth: 28 }, 3: { cellWidth: 28 }, 4: { cellWidth: 18 }, 5: { cellWidth: 22, halign: 'right' }, 6: { cellWidth: 45 } });
  return drawFlowParagraph(page, wording.closedNote, after + 3, 7.5);
}

/** **Το αποτύπωμα φακέλου** — ετικέτα σχήματος + SHA-256, αυτολεξεί όπως τα ξαναϋπολογίζει ο τρίτος. */
export function drawProtocolDigest(page: ProtocolPage, y: number, scheme: string): number {
  const { view, wording } = page;
  const top = drawFlowHeading(page, wording.digestHeading, y);
  const after = drawFlowPairs(page, [[wording.digestScheme, scheme], [wording.digestValue, chunkText(view.ledgerDigest, 32)]], top);
  return drawFlowParagraph(page, wording.manifestNote, after, 7.5);
}

function block(page: ProtocolPage, item: FrozenLegalBlock, y: number): number {
  switch (item.kind) {
    case 'paragraph':
    case 'clause':
      return drawFlowParagraph(page, item.text, y);
    case 'list':
      return item.items.reduce((cursor, entry, i) => drawFlowParagraph(page, `${item.ordered ? `${i + 1}.` : '•'} ${entry.text}`, cursor, 8.5, 3), y);
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
    .reduce((cursor, line) => drawFlowParagraph(page, line, cursor, 8.5, 3), y);
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
  const top = drawFlowHeading(page, page.wording.legalHeading(page.view.legalText.version), y);
  return page.view.legalText.text.sections.reduce((cursor, section) => legalSection(page, section, cursor), top);
}

/** **Η επαλήθευση του κειμένου**: έκδοση + αποτύπωμα + σύνδεσμος, και QR μόνο όταν υπάρχει απόλυτος σύνδεσμος. */
export function drawProtocolTextReference(page: ProtocolPage, y: number, qrPng: string | null): number {
  const { view, wording } = page;
  return drawFlowQrPairs(page, y, [
    [wording.legalDigest, chunkText(view.legalText.digest, 39)],
    [wording.legalLink, view.legalText.url ?? view.legalText.path],
  ], qrPng);
}

/** **Η επαλήθευση του πρωτοκόλλου** (Σ6): η δημόσια πόρτα για **αυτόν** τον κωδικό — ο τρίτος σκανάρει το χαρτί. */
export function drawProtocolVerification(page: ProtocolPage, y: number, qrPng: string | null): number {
  const { view, wording } = page;
  return drawFlowQrPairs(page, y, [[wording.verifyLink, view.verification.url ?? view.verification.path]], qrPng);
}
