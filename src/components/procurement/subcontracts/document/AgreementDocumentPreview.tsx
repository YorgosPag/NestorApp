/**
 * Η προεπισκόπηση HTML του εγγράφου υπεργολαβίας (ADR-928 §5.17). **Μόνο τοποθετεί**: κάθε κείμενο έρχεται ήδη
 * αποδοσμένο από το `AgreementDocument` — καμία μορφοποίηση εδώ, άρα τίποτα που να διαφωνεί με το PDF (Φ4).
 */

import { cn } from '@/lib/utils';
import type {
  AgreementDocument,
  DocumentBlock,
  DocumentInline,
  DocumentLineRow,
} from '@/subapps/procurement/subcontracts/document/document-types';

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
    <table className="w-full text-sm">
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
    </table>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function PartiesAndProject({ document }: { document: AgreementDocument }) {
  return (
    <>
      <Section title={document.labels.parties}>
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
        <Section title={document.labels.project}>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            {document.project.map((field, index) => (
              <div key={index} className="contents"><dt className="text-muted-foreground">{field.label}</dt><dd>{field.value}</dd></div>
            ))}
          </dl>
        </Section>
      )}
    </>
  );
}

export function AgreementDocumentPreview({ document }: { document: AgreementDocument }) {
  return (
    <article lang={document.language} className="space-y-5 rounded-lg border bg-card p-5 text-sm leading-relaxed">
      <header className="space-y-1 border-b pb-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{document.kindLabel}</p>
        <h2 className="text-lg font-semibold">{document.title}</h2>
        <p className="text-xs text-muted-foreground">{document.documentNumber}{document.validUntil && ` · ${document.validUntil}`}</p>
        {document.prevailingNotice && <p role="note" className="text-xs font-medium">{document.prevailingNotice}</p>}
      </header>
      <PartiesAndProject document={document} />
      <Section title={document.labels.lines}>
        <LinesTable document={document} />
        {document.totals.unpricedNote && <p className="text-xs text-muted-foreground">{document.totals.unpricedNote}</p>}
        {document.totals.valueInWords && <p className="text-xs italic text-muted-foreground">{document.totals.valueInWords}</p>}
        <p className="text-xs text-muted-foreground">{document.totals.vatNote}</p>
      </Section>
      <Section title={document.labels.terms}>{document.terms.map((term) => <p key={term}>{term}</p>)}</Section>
      <Section title={document.labels.paymentPlan}>{document.paymentPlan.map((sentence) => <p key={sentence}>{sentence}</p>)}</Section>
      {document.clauses.length > 0 && (
        <Section title={document.labels.clauses}>
          <ol className="space-y-3">
            {document.clauses.map((clause) => (
              <li key={clause.clauseKey} className="space-y-1">
                <h4 className="font-semibold">{clause.number}. {clause.heading}</h4>
                {clause.untranslatedNote && <p role="note" className="text-xs text-destructive">{clause.untranslatedNote}</p>}
                <DocumentBlocks blocks={clause.blocks} />
              </li>
            ))}
          </ol>
        </Section>
      )}
    </article>
  );
}
