'use client';

/**
 * **Επιλογή γραμμής → πρόταση ανά πεδίο → αποδοχή** (ADR-949 Α4 · Α5) — ο άνθρωπος βλέπει «τώρα → από το έγγραφο,
 * σελ. N» και αποφασίζει ανά πεδίο ή για όλα. Τίποτα δεν μπαίνει στο πρόχειρο χωρίς το κλικ του.
 *
 * 🔑 **Πολλές γραμμές ⇒ ρωτάμε, δεν μαντεύουμε**: το Ε9 έχει όλη την περιουσία. Μία γραμμή ⇒ επιλεγμένη από μόνη της.
 * 🔑 **Σημαίες, ποτέ σιωπή** — μεζονέτα · ημιτελές · είδος που αλλάζει · είδος που δεν αποτιμάται.
 */

import React, { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { ObjectiveValueEvidenceDocument } from '@/config/objective-value/objective-value-evidence';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-formatting';
import type { ObjectiveValueReadingApplication } from '@/lib/objective-value/objective-value-declared-reading';
import {
  readingApplicationOf,
  readingProposalOf,
  type ObjectiveValueDocumentRow,
  type ObjectiveValueFieldProposal,
  type ObjectiveValueReadField,
  type ObjectiveValueReadingProposal,
} from '@/lib/objective-value/objective-value-document-reading';
import type { ObjectiveValueDraft } from '@/lib/objective-value/objective-value-draft';

import { EVIDENCE_DOCUMENT_LABEL_KEYS } from './objective-value-document-labels';
import { useBucketLabel } from './objective-value-floor-label';

const NS = 'objective-value';
const R = `${NS}:evidence.reader`;

/** Η περιγραφή μιας γραμμής: είδος · όροφος · τ.μ. · έτος · διεύθυνση · σελίδα — ό,τι ξεχωρίζει ένα ακίνητο από άλλο. */
function useRowSummary(): (row: ObjectiveValueDocumentRow) => string {
  const { t } = useTranslation([NS]);
  const floorLabel = useBucketLabel();
  return (row) =>
    [
      row.form === null ? t(`${R}.rowUnsupported`) : t(`${NS}:property.form.${row.form}`),
      row.floor === null ? null : floorLabel(row.floor),
      row.area === null ? null : t(`${R}.rowArea`, { area: formatNumber(row.area) }),
      row.constructionYear === null ? null : t(`${R}.rowYear`, { year: row.constructionYear }),
      row.address,
      t(`${R}.rowPage`, { page: row.page }),
    ]
      .filter((part): part is string => part !== null && part !== '')
      .join(' · ');
}

interface RowPickerProps {
  readonly rows: readonly ObjectiveValueDocumentRow[];
  readonly selected: number | null;
  readonly onSelect: (index: number) => void;
}

function RowPicker({ rows, selected, onSelect }: RowPickerProps) {
  const { t } = useTranslation([NS]);
  const legendId = useId();
  const summary = useRowSummary();
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend id={legendId} className="mb-2 text-sm font-medium text-foreground">{t(`${R}.rowsLegend`)}</legend>
      <RadioGroup aria-labelledby={legendId} value={selected === null ? '' : String(selected)} onValueChange={(value) => onSelect(Number(value))}>
        {rows.map((row, index) => (
          <p key={`${row.page}-${index}`} className="m-0 flex items-start gap-2">
            <RadioGroupItem id={`${legendId}-${index}`} value={String(index)} />
            <Label htmlFor={`${legendId}-${index}`} className="text-sm font-normal leading-snug">{summary(row)}</Label>
          </p>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

const A = `${NS}:adjustments`;

/** Το όνομα του πεδίου — το **ίδιο** με την ερώτηση της φόρμας, ποτέ δεύτερη διατύπωση. */
function useFieldLabel(): (field: ObjectiveValueReadField) => string {
  const { t } = useTranslation([NS]);
  return (field) => {
    switch (field) {
      case 'floor':
        return t(`${NS}:property.floorLabel`);
      case 'area':
        return t(`${NS}:property.areaLabel`);
      case 'ownershipPct':
        return t(`${A}.ownershipPct`);
      case 'coOwned':
        return t(`${A}.coOwned`);
      case 'encumbrance':
        return t(`${A}.encumbranceLabel`);
    }
  };
}

/** Η τιμή στη γλώσσα του πεδίου: όροφος ως «Β' όροφος», ποσοστό με %, ναι/όχι, ειδική κατάσταση με το όνομά της. */
function useFieldValue(): (proposal: ObjectiveValueFieldProposal, which: 'value' | 'current') => string {
  const { t } = useTranslation([NS]);
  const floorLabel = useBucketLabel();
  return (proposal, which) => {
    switch (proposal.field) {
      case 'coOwned':
        return t(proposal[which] ? `${R}.yes` : `${R}.no`);
      case 'encumbrance':
        return t(`${A}.encumbrance.${proposal[which]}`);
      default: {
        const value = proposal[which];
        if (value === null) return proposal.field === 'ownershipPct' ? t(`${R}.percent`, { pct: formatNumber(100) }) : t(`${R}.empty`);
        if (proposal.field === 'floor') return floorLabel(value);
        if (proposal.field === 'ownershipPct') return t(`${R}.percent`, { pct: formatNumber(value) });
        return t(`${R}.rowArea`, { area: formatNumber(value) });
      }
    }
  };
}

interface FieldRowProps {
  readonly proposal: ObjectiveValueFieldProposal;
  readonly checked: boolean;
  readonly onToggle: (field: ObjectiveValueReadField) => void;
}

function FieldRow({ proposal, checked, onToggle }: FieldRowProps) {
  const { t } = useTranslation([NS]);
  const id = useId();
  const valueOf = useFieldValue();
  const labelOf = useFieldLabel();
  return (
    <li className="flex items-start gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={() => onToggle(proposal.field)} />
      <Label htmlFor={id} className="flex flex-col gap-0.5 text-sm font-normal">
        <span className="font-medium text-foreground">{labelOf(proposal.field)}: {valueOf(proposal, 'value')}</span>
        <span className="text-xs text-muted-foreground">{t(`${R}.current`, { value: valueOf(proposal, 'current') })}</span>
      </Label>
    </li>
  );
}

function Flags({ proposal }: { readonly proposal: ObjectiveValueReadingProposal }) {
  const { t } = useTranslation([NS]);
  if (proposal.flags.length === 0) return null;
  const form = proposal.form === null ? '' : t(`${NS}:property.form.${proposal.form}`);
  return (
    <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
      {proposal.flags.map((flag) => <li key={flag}>{t(`${R}.flags.${flag}`, { form })}</li>)}
    </ul>
  );
}

interface ProposalProps {
  readonly document: ObjectiveValueEvidenceDocument;
  readonly row: ObjectiveValueDocumentRow;
  readonly draft: ObjectiveValueDraft;
  readonly onApply: (application: ObjectiveValueReadingApplication) => void;
}

/** Οι προτάσεις της γραμμής — όλες επιλεγμένες αρχικά· «Συμπλήρωση επιλεγμένων» ή «όλων». */
function Proposal({ document, row, draft, onApply }: ProposalProps) {
  const { t } = useTranslation([NS]);
  const proposal = useMemo(() => readingProposalOf(document, row, draft), [document, row, draft]);
  const all = useMemo(() => new Set(proposal.fields.map(({ field }) => field)), [proposal]);
  const [chosen, setChosen] = useState<ReadonlySet<ObjectiveValueReadField>>(all);
  const toggle = (field: ObjectiveValueReadField) =>
    setChosen((current) => { const next = new Set(current); if (!next.delete(field)) next.add(field); return next; });
  const apply = (fields: ReadonlySet<ObjectiveValueReadField>) => onApply(readingApplicationOf(proposal, fields, draft));
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="m-0 text-sm font-semibold text-foreground">
        {t(`${R}.proposalTitle`, { document: t(EVIDENCE_DOCUMENT_LABEL_KEYS[document]), page: row.page })}
      </h3>
      <Flags proposal={proposal} />
      {proposal.fields.length > 0 && (
        <>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {proposal.fields.map((field) => <FieldRow key={field.field} proposal={field} checked={chosen.has(field.field)} onToggle={toggle} />)}
          </ul>
          <p className="m-0 text-xs text-muted-foreground">{t(`${R}.declaredNote`)}</p>
          <footer className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => apply(all)}>{t(`${R}.acceptAll`)}</Button>
            <Button type="button" variant="outline" disabled={chosen.size === 0} onClick={() => apply(chosen)}>{t(`${R}.acceptSelected`)}</Button>
          </footer>
        </>
      )}
    </section>
  );
}

interface ReadingReviewProps {
  readonly document: ObjectiveValueEvidenceDocument;
  readonly rows: readonly ObjectiveValueDocumentRow[];
  readonly draft: ObjectiveValueDraft;
  readonly onApply: (application: ObjectiveValueReadingApplication) => void;
}

export function ObjectiveValueReadingReview({ document, rows, draft, onApply }: ReadingReviewProps) {
  const { t } = useTranslation([NS]);
  const [selected, setSelected] = useState<number | null>(rows.length === 1 ? 0 : null);
  if (rows.length === 0) return <p className="m-0 text-sm text-foreground" role="status">{t(`${R}.noRows`)}</p>;
  const row = selected === null ? null : rows[selected] ?? null;
  return (
    <section className="flex flex-col gap-4">
      {rows.length > 1 && <RowPicker rows={rows} selected={selected} onSelect={setSelected} />}
      {row !== null && <Proposal key={selected} document={document} row={row} draft={draft} onApply={onApply} />}
    </section>
  );
}
