'use client';

/**
 * Η προεπισκόπηση HTML του εγγράφου υπεργολαβίας (ADR-928 §5.17). **Μόνο τοποθετεί**: κάθε κείμενο έρχεται ήδη
 * αποδοσμένο από το `AgreementDocument` — καμία μορφοποίηση εδώ, άρα τίποτα που να διαφωνεί με το PDF (Φ4).
 *
 * §5.23: σελίδα πλάτους Α4 (ζουμ: §5.25, `DocumentZoomContext`), δείκτες ενοτήτων `data-doc-section` / `data-doc-clause` για τον συγχρονισμό με τις
 * καρτέλες του επεξεργαστή, και μολύβι «Επεξεργασία» μόνο όταν δοθεί `onEdit`.
 */

import { Table } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { EditorSection } from '../editor/editor-sections';
import type {
  AgreementDocument,
  DocumentBlock,
  DocumentInline,
  DocumentLineRow,
} from '@/subapps/procurement/subcontracts/document/document-types';
import { EditInFormButton, type DocumentEditHandler } from './EditInFormButton';
import { useDocumentZoomColumn } from './DocumentZoomContext';

function Inlines({ inlines }: { inlines: readonly DocumentInline[] }) {
  return (
    <>
      {inlines.map((inline, index) =>
        inline.kind === 'text'
          ? <span key={index}>{inline.text}</span>
          : <strong key={index} className={cn('font-semibold', inline.missing && 'text-destructive')}>{inline.text}</strong>,
      )}
    </>
  );
}

/** Τα μπλοκ ενός κειμένου εγγράφου — κοινά με την ανάγνωση ρήτρας στη βιβλιοθήκη (ADR-928 Φ3γ-0): ίδια λέξη, ίδια μορφή. */
export function DocumentBlocks({ blocks }: { blocks: readonly DocumentBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === 'paragraph') return <p key={index}><Inlines inlines={block.inlines} /></p>;
        const List = block.ordered ? 'ol' : 'ul';
        return (
          <List key={index} className={cn('ml-5 space-y-1', block.ordered ? 'list-decimal' : 'list-disc')}>
            {block.items.map((item, itemIndex) => <li key={itemIndex}><Inlines inlines={item} /></li>)}
          </List>
        );
      })}
    </>
  );
}

function LineRow({ line, byMeasurement }: { line: DocumentLineRow; byMeasurement: string }) {
  return (
    <tr className="border-b align-top">
      <td className="py-2 pr-2 tabular-nums">{line.number}</td>
      <td className="py-2 pr-2">
        <p>{line.description}</p>
        {line.comment && <p className="text-xs text-muted-foreground">{line.comment}</p>}
        {line.amountInWords && <p className="text-xs italic text-muted-foreground">{line.amountInWords}</p>}
        {line.measurementRule.length > 0 && <section className="mt-1 text-xs text-muted-foreground"><DocumentBlocks blocks={line.measurementRule} /></section>}
      </td>
      <td className="py-2 pr-2">{line.unit}</td>
      <td className="py-2 pr-2 text-right tabular-nums">{line.quantity ?? byMeasurement}</td>
      <td className="py-2 pr-2 text-right tabular-nums">{line.unitPrice}</td>
      <td className="py-2 text-right tabular-nums">{line.amount ?? '—'}</td>
    </tr>
  );
}

function LinesTable({ document }: { document: AgreementDocument }) {
  const { columns } = document.labels;
  return (
    <Table>
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th scope="col" className="py-1 pr-2">{columns.number}</th>
          <th scope="col" className="py-1 pr-2">{columns.description}</th>
          <th scope="col" className="py-1 pr-2">{columns.unit}</th>
          <th scope="col" className="py-1 pr-2 text-right">{columns.quantity}</th>
          <th scope="col" className="py-1 pr-2 text-right">{columns.unitPrice}</th>
          <th scope="col" className="py-1 text-right">{columns.amount}</th>
        </tr>
      </thead>
      <tbody>{document.lines.map((line) => <LineRow key={line.number} line={line} byMeasurement={document.labels.byMeasurement} />)}</tbody>
      <tfoot>
        <tr>
          <th scope="row" colSpan={5} className="py-2 pr-2 text-right">{document.totals.label}</th>
          <td className="py-2 text-right font-semibold tabular-nums">{document.totals.value}</td>
        </tr>
      </tfoot>
    </Table>
  );
}

interface SectionProps {
  readonly title: string;
  readonly section: EditorSection;
  readonly onEdit?: DocumentEditHandler;
  readonly children: React.ReactNode;
}

/** `data-doc-section`: ο δείκτης που βρίσκει ο συγχρονισμός καρτέλας → προεπισκόπησης (`EditorSplitLayout`). */
function Section({ title, section, onEdit, children }: SectionProps) {
  return (
    <section data-doc-section={section} className="group/doc-section scroll-mt-14 space-y-2">
      <h3 className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        {onEdit && <EditInFormButton target={{ section }} label={title} onEdit={onEdit} />}
      </h3>
      {children}
    </section>
  );
}

function PartiesAndProject({ document, onEdit }: { document: AgreementDocument; onEdit?: DocumentEditHandler }) {
  return (
    <>
      <Section title={document.labels.parties} section="parties" onEdit={onEdit}>
        <dl className="grid gap-3 sm:grid-cols-2">
          {document.parties.map((party, index) => (
            <div key={index}>
              <dt className="text-xs text-muted-foreground">{party.role}</dt>
              <dd className="font-medium">{party.name}</dd>
              {party.details.map((detail) => <dd key={detail} className="text-xs text-muted-foreground">{detail}</dd>)}
            </div>
          ))}
        </dl>
        {document.signatory && <p className="text-xs text-muted-foreground">{document.signatory}</p>}
      </Section>
      {document.project.length > 0 && (
        <Section title={document.labels.project} section="parties" onEdit={onEdit}>
          <FieldList fields={document.project} />
        </Section>
      )}
    </>
  );
}

function FieldList({ fields }: { fields: AgreementDocument['project'] }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
      {fields.map((field, index) => (
        <div key={index} className="contents"><dt className="text-muted-foreground">{field.label}</dt><dd>{field.value}</dd></div>
      ))}
    </dl>
  );
}

/**
 * Οι εντολές εργασίας κύριας σύμβασης (ADR-928 §5.24) — παράρτημα στο τέλος, όπως η A422 συνοδεύει την A421. Χωρίς
 * μολύβι: δεν γράφονται από τη φόρμα του πρόχειρου, τις δίνει ο γραφέας εντολών μετά την αποδοχή.
 */
function WorkOrdersSection({ document }: { document: AgreementDocument }) {
  if (document.workOrders.length === 0) return null;
  return (
    <section data-doc-section="workOrders" className="scroll-mt-14 space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{document.labels.workOrders}</h3>
      <ol className="space-y-3">
        {document.workOrders.map((order) => (
          <li key={order.number} className="space-y-1">
            <h4 className="font-semibold">{order.heading}</h4>
            <FieldList fields={order.fields} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function ClauseList({ document, onEdit }: { document: AgreementDocument; onEdit?: DocumentEditHandler }) {
  return (
    <ol className="space-y-3">
      {document.clauses.map((clause) => (
        <li key={clause.clauseKey} data-doc-clause={clause.clauseKey} className="space-y-1">
          <h4 className="flex items-center gap-1 font-semibold">
            {clause.number}. {clause.heading}
            {onEdit && <EditInFormButton target={{ section: 'clauses', clauseKey: clause.clauseKey }} label={clause.heading} onEdit={onEdit} />}
          </h4>
          {clause.untranslatedNote && <p role="note" className="text-xs text-destructive">{clause.untranslatedNote}</p>}
          <DocumentBlocks blocks={clause.blocks} />
        </li>
      ))}
    </ol>
  );
}

function DocumentHeader({ document, onEdit }: { document: AgreementDocument; onEdit?: DocumentEditHandler }) {
  return (
    <header data-doc-section="identity" className="group/doc-section scroll-mt-14 space-y-1 border-b pb-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{document.kindLabel}</p>
      <h2 className="flex items-center gap-1 text-lg font-semibold">
        {document.title}
        {onEdit && <EditInFormButton target={{ section: 'identity' }} label={document.title} onEdit={onEdit} />}
      </h2>
      <p className="text-xs text-muted-foreground">{document.documentNumber}{document.validUntil && ` · ${document.validUntil}`}</p>
      {document.prevailingNotice && <p role="note" className="text-xs font-medium">{document.prevailingNotice}</p>}
    </header>
  );
}

export interface AgreementDocumentPreviewProps {
  readonly document: AgreementDocument;
  /** Μολύβι «Επεξεργασία» δίπλα σε κάθε ενότητα και ρήτρα — μόνο μέσα σε επεξεργαστή. */
  readonly onEdit?: DocumentEditHandler;
}

/**
 * Μέσα σε `DocumentZoomProvider` (λεπτομέρεια · επεξεργαστές) η σελίδα ανήκει στη **μηχανή ζουμ** (§5.25): πλάτος Α4 +
 * ζουμ από εκεί, ένα για όλες τις γλωσσικές στήλες. Χωρίς πάροχο (παράθυρο προεπισκόπησης) ⇒ σελίδα Α4 στο κέντρο.
 */
export function AgreementDocumentPreview({ document, onEdit }: AgreementDocumentPreviewProps) {
  const { zoomable, frameRef, pageRef } = useDocumentZoomColumn();
  return (
    // `overflow-x-auto`: χειροκίνητο ζουμ φαρδύτερο από τη στήλη ⇒ οριζόντια κύλιση της στήλης, όπως σε προβολέα PDF.
    <div ref={frameRef} className={cn('min-w-0', zoomable && 'overflow-x-auto')}>
      {/* `mx-auto`: όταν η σελίδα είναι στενότερη από τη στήλη (ταβάνι ×2, μικρό χειροκίνητο ζουμ) **κεντράρεται** όπως σε
          προβολέα PDF — όχι κολλημένη αριστερά με κενό δεξιά (ζωντανός έλεγχος §5.23). Ρευστό πλάτος ⇒ καμία επίδραση. */}
      <article ref={pageRef} lang={document.language} className={cn('mx-auto space-y-5 rounded-lg border bg-card p-5 text-sm leading-relaxed', !zoomable && 'max-w-[210mm]')}>
        <DocumentHeader document={document} onEdit={onEdit} />
        <DocumentBody document={document} onEdit={onEdit} />
      </article>
    </div>
  );
}

function DocumentBody({ document, onEdit }: { document: AgreementDocument; onEdit?: DocumentEditHandler }) {
  return (
    <>
      <PartiesAndProject document={document} onEdit={onEdit} />
      <Section title={document.labels.lines} section="lines" onEdit={onEdit}>
        <LinesTable document={document} />
        {document.totals.unpricedNote && <p className="text-xs text-muted-foreground">{document.totals.unpricedNote}</p>}
        {document.totals.valueInWords && <p className="text-xs italic text-muted-foreground">{document.totals.valueInWords}</p>}
        <p className="text-xs text-muted-foreground">{document.totals.vatNote}</p>
      </Section>
      <Section title={document.labels.terms} section="terms" onEdit={onEdit}>{document.terms.map((term) => <p key={term}>{term}</p>)}</Section>
      <Section title={document.labels.paymentPlan} section="plan" onEdit={onEdit}>{document.paymentPlan.map((sentence) => <p key={sentence}>{sentence}</p>)}</Section>
      {document.clauses.length > 0 && (
        <Section title={document.labels.clauses} section="clauses" onEdit={onEdit}>
          <ClauseList document={document} onEdit={onEdit} />
        </Section>
      )}
      <WorkOrdersSection document={document} />
    </>
  );
}
