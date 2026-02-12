import type { ObligationApprovalEntry, ObligationDocument } from '@/types/obligations';
import type { IPDFDoc, ICoverRenderer, Margins } from '../contracts';
import { TextRenderer } from './TextRenderer';
import { COLORS, FONT_SIZES } from '../layout';

const PDF_LABELS = {
  title: 'ΣΥΓΓΡΑΦΗ ΥΠΟΧΡΕΩΣΕΩΝ',
  companySection: 'ΣΤΟΙΧΕΙΑ ΕΤΑΙΡΕΙΑΣ',
  projectSection: 'ΣΤΟΙΧΕΙΑ ΕΡΓΟΥ',
  documentControlSection: 'ΕΛΕΓΧΟΣ ΕΓΓΡΑΦΟΥ',
  approvalsSection: 'ΕΓΚΡΙΣΕΙΣ',
  ownersSection: 'ΣΥΜΒΑΛΛΟΜΕΝΟΙ / ΙΔΙΟΚΤΗΤΕΣ',
  locationPrefix: 'Θεσσαλονίκη',
  fields: {
    company: 'Εταιρεία',
    registration: 'ΑΦΜ/Μητρώο',
    email: 'Email',
    phone: 'Τηλέφωνο',
    project: 'Έργο',
    address: 'Διεύθυνση',
    location: 'Τοποθεσία',
    permit: 'Αρ. Άδειας',
    documentId: 'Κωδικός Εγγράφου',
    revision: 'Αναθεώρηση',
    status: 'Κατάσταση',
    dueDate: 'Ημ. Λήξης',
    assignee: 'Υπεύθυνος',
    scope: 'Πεδίο Εφαρμογής',
  },
} as const;

const safe = (value?: string | number): string => {
  if (value === undefined || value === null) {
    return '';
  }
  const normalized = String(value).trim();
  return normalized;
};

const toStatusLabel = (status: ObligationDocument['status']): string => {
  const labels: Record<ObligationDocument['status'], string> = {
    draft: 'Draft',
    'in-review': 'In Review',
    returned: 'Returned',
    approved: 'Approved',
    issued: 'Issued',
    superseded: 'Superseded',
    archived: 'Archived',
    completed: 'Completed',
  };
  return labels[status];
};

const toScopeLabel = (document: ObligationDocument): string => {
  if (document.buildingId) {
    return `Building ${document.buildingId}`;
  }
  return document.projectId ? `Project ${document.projectId}` : 'Project Level';
};

const buildApprovalsSummary = (approvals?: ObligationApprovalEntry[]): string => {
  if (!approvals || approvals.length === 0) {
    return '-';
  }

  const approved = approvals.filter((entry) => entry.approved).length;
  return `${approved}/${approvals.length} approved`;
};

const drawSectionTitle = (
  textRenderer: TextRenderer,
  doc: IPDFDoc,
  text: string,
  y: number,
  margins: Margins,
  pageWidth: number,
  contentWidth: number
): number => {
  doc.setFillColor(...COLORS.GRAY);
  doc.rect(margins.left, y - 4, contentWidth, 8, 'F');
  return textRenderer.addText({
    doc,
    text,
    y,
    align: 'left',
    fontSize: FONT_SIZES.SMALL,
    bold: true,
    margins,
    pageWidth,
  }) + 2;
};

const drawField = (
  textRenderer: TextRenderer,
  doc: IPDFDoc,
  label: string,
  value: string,
  y: number,
  margins: Margins,
  pageWidth: number,
  contentWidth: number
): number => {
  const line = `${label}: ${value || '-'}`;
  return textRenderer.addWrappedText({
    doc,
    text: line,
    y,
    fontSize: FONT_SIZES.BODY,
    maxWidth: contentWidth,
    margins,
    onPageBreak: () => y,
  }) + 1;
};

export class CoverRenderer implements ICoverRenderer {
  private textRenderer: TextRenderer = new TextRenderer();

  render(doc: IPDFDoc, yStart: number, margins: Margins, contentWidth: number, pageWidth: number, pageHeight: number, document: ObligationDocument, formatDate: (d: Date) => string): number {
    let currentY = yStart;

    doc.setFillColor(...COLORS.RED);
    doc.rect(margins.left, currentY - 5, contentWidth, 15, 'F');

    const companyTitle = safe(document.companyDetails?.name) || safe(document.contractorCompany) || 'Nestor';
    currentY = this.textRenderer.addText({
      doc,
      text: companyTitle,
      y: currentY,
      align: 'center',
      fontSize: FONT_SIZES.H3,
      bold: true,
      color: COLORS.WHITE,
      margins,
      pageWidth,
    });

    currentY += 5;
    currentY = this.textRenderer.addText({
      doc,
      text: PDF_LABELS.title,
      y: currentY,
      align: 'center',
      fontSize: FONT_SIZES.BODY,
      color: COLORS.WHITE,
      margins,
      pageWidth,
    });

    currentY += 18;
    currentY = this.textRenderer.addText({
      doc,
      text: document.title,
      y: currentY,
      align: 'center',
      fontSize: FONT_SIZES.H2,
      bold: true,
      margins,
      pageWidth,
    });

    currentY += 8;
    currentY = this.textRenderer.addText({
      doc,
      text: safe(document.projectName) || '-',
      y: currentY,
      align: 'center',
      fontSize: FONT_SIZES.BODY,
      margins,
      pageWidth,
    });

    currentY += 10;
    currentY = drawSectionTitle(this.textRenderer, doc, PDF_LABELS.companySection, currentY, margins, pageWidth, contentWidth);
    currentY = drawField(this.textRenderer, doc, PDF_LABELS.fields.company, companyTitle, currentY, margins, pageWidth, contentWidth);
    currentY = drawField(this.textRenderer, doc, PDF_LABELS.fields.registration, safe(document.companyDetails?.registrationNumber), currentY, margins, pageWidth, contentWidth);
    currentY = drawField(this.textRenderer, doc, PDF_LABELS.fields.email, safe(document.companyDetails?.email), currentY, margins, pageWidth, contentWidth);
    currentY = drawField(this.textRenderer, doc, PDF_LABELS.fields.phone, safe(document.companyDetails?.phone), currentY, margins, pageWidth, contentWidth);

    currentY += 2;
    currentY = drawSectionTitle(this.textRenderer, doc, PDF_LABELS.projectSection, currentY, margins, pageWidth, contentWidth);
    currentY = drawField(this.textRenderer, doc, PDF_LABELS.fields.project, safe(document.projectName), currentY, margins, pageWidth, contentWidth);
    currentY = drawField(this.textRenderer, doc, PDF_LABELS.fields.location, safe(document.projectInfo?.location), currentY, margins, pageWidth, contentWidth);
    currentY = drawField(this.textRenderer, doc, PDF_LABELS.fields.address, safe(document.projectDetails?.address), currentY, margins, pageWidth, contentWidth);
    currentY = drawField(this.textRenderer, doc, PDF_LABELS.fields.permit, safe(document.projectDetails?.buildingPermitNumber), currentY, margins, pageWidth, contentWidth);

    currentY += 2;
    currentY = drawSectionTitle(this.textRenderer, doc, PDF_LABELS.documentControlSection, currentY, margins, pageWidth, contentWidth);
    currentY = drawField(this.textRenderer, doc, PDF_LABELS.fields.documentId, safe(document.docNumber) || safe(document.id), currentY, margins, pageWidth, contentWidth);
    currentY = drawField(this.textRenderer, doc, PDF_LABELS.fields.revision, document.revision !== undefined ? String(document.revision) : '-', currentY, margins, pageWidth, contentWidth);
    currentY = drawField(this.textRenderer, doc, PDF_LABELS.fields.status, toStatusLabel(document.status), currentY, margins, pageWidth, contentWidth);
    currentY = drawField(this.textRenderer, doc, PDF_LABELS.fields.dueDate, document.dueDate ? formatDate(document.dueDate) : '-', currentY, margins, pageWidth, contentWidth);
    currentY = drawField(this.textRenderer, doc, PDF_LABELS.fields.assignee, safe(document.assigneeName), currentY, margins, pageWidth, contentWidth);
    currentY = drawField(this.textRenderer, doc, PDF_LABELS.fields.scope, toScopeLabel(document), currentY, margins, pageWidth, contentWidth);

    currentY += 2;
    currentY = drawSectionTitle(this.textRenderer, doc, PDF_LABELS.approvalsSection, currentY, margins, pageWidth, contentWidth);
    currentY = drawField(this.textRenderer, doc, 'Summary', buildApprovalsSummary(document.approvals), currentY, margins, pageWidth, contentWidth);

    if (document.owners && document.owners.length > 0) {
      currentY += 2;
      currentY = drawSectionTitle(this.textRenderer, doc, PDF_LABELS.ownersSection, currentY, margins, pageWidth, contentWidth);
      document.owners.forEach((owner) => {
        const shareValue = owner.share !== undefined ? `${owner.share}%` : '-';
        currentY = drawField(this.textRenderer, doc, owner.name, shareValue, currentY, margins, pageWidth, contentWidth);
      });
    }

    currentY = pageHeight - 20;
    this.textRenderer.addText({
      doc,
      text: `${PDF_LABELS.locationPrefix}, ${formatDate(new Date())}`,
      y: currentY,
      align: 'center',
      fontSize: FONT_SIZES.BODY,
      margins,
      pageWidth,
    });

    return currentY;
  }
}
