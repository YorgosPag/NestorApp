'use client';

/**
 * **Επιλογή γραμμής → πρόταση ανά πεδίο → αποδοχή** (ADR-949 Α4 · Α5 · Α-3) — ο άνθρωπος βλέπει «τώρα → από το
 * έγγραφο, σελ. N» και αποφασίζει ανά πεδίο ή για όλα. Τίποτα δεν μπαίνει στο πρόχειρο χωρίς το κλικ του.
 *
 * 🔑 **Πολλές γραμμές ⇒ ρωτάμε, δεν μαντεύουμε**: το Ε9 και το ΕΝΦΙΑ έχουν όλη την περιουσία. Μία γραμμή (π.χ. η πράξη
 *    της άδειας) ⇒ επιλεγμένη από μόνη της.
 * 🔑 **Σημαίες, ποτέ σιωπή** — μεζονέτα · ημιτελές · είδος που αλλάζει · είδος που δεν αποτιμάται · ενημέρωση άδειας.
 * 🔑 **Η διασταύρωση της τιμής ζώνης φαίνεται ΚΑΙ όταν συμφωνεί** (Α-3): «✓ συμφωνεί με το ΕΝΦΙΑ 2020» είναι
 *    πληροφορία (ο χάρτης δείχνει το σωστό σημείο), όχι θόρυβος.
 */

import React, { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { ObjectiveValueEvidenceDocument } from '@/config/objective-value/objective-value-evidence';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDate, formatCalendarDay, formatNumber } from '@/lib/intl-formatting';
import type { ObjectiveValueReadingApplication } from '@/lib/objective-value/objective-value-declared-reading';
import type { ObjectiveValueDocumentRow } from '@/lib/objective-value/objective-value-device-readers';
import {
  readingApplicationOf,
  readingProposalOf,
  type ObjectiveValueFieldProposal,
  type ObjectiveValueReadField,
  type ObjectiveValueReadingProposal,
  type ObjectiveValueZoneCheck,
} from '@/lib/objective-value/objective-value-document-reading';
import type { ObjectiveValueDraft } from '@/lib/objective-value/objective-value-draft';
import type { ObjectiveValueMapZone } from '@/lib/objective-value/objective-value-zone';

import { EVIDENCE_DOCUMENT_LABEL_KEYS } from './objective-value-document-labels';
import { useBucketLabel } from './objective-value-floor-label';

const NS = 'objective-value';
const R = `${NS}:evidence.reader`;

/**
 * Η περιγραφή μιας γραμμής — ό,τι ξεχωρίζει ένα ακίνητο από άλλο: είδος · όροφος · τ.μ. · έτος · διεύθυνση · σελίδα.
 * Για πράξη άδειας: τύπος · ημερομηνία · σελίδα.
 */
function useRowSummary(): (row: ObjectiveValueDocumentRow) => string {
  const { t } = useTranslation([NS]);
  const floorLabel = useBucketLabel();
  return (row) => {
    const parts =
      row.kind === 'permit'
        ? [t(`${R}.permitAct.${row.act}`), row.issuedOn === null ? null : formatCalendarDate(row.issuedOn)]
        : [
            row.form === null ? t(`${R}.rowUnsupported`) : t(`${NS}:property.form.${row.form}`),
            row.floor === null ? null : floorLabel(row.floor),
            row.area === null ? null : t(`${R}.rowArea`, { area: formatNumber(row.area) }),
            row.constructionYear === null ? null : t(`${R}.rowYear`, { year: row.constructionYear }),
            row.address,
          ];
    return [...parts, t(`${R}.rowPage`, { page: row.page })].filter((part): part is string => part !== null && part !== '').join(' · ');
  };
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
      case 'permitDate':
        return t(`${NS}:questions.ageYears.label`);
    }
  };
}

/** Η τιμή στη γλώσσα του πεδίου: όροφος ως «Β' όροφος», ποσοστό με %, ναι/όχι, ειδική κατάσταση, ημερομηνία. */
function useFieldValue(): (proposal: ObjectiveValueFieldProposal, which: 'value' | 'current') => string {
  const { t } = useTranslation([NS]);
  const floorLabel = useBucketLabel();
  return (proposal, which) => {
    switch (proposal.field) {
      case 'coOwned':
        return t(proposal[which] ? `${R}.yes` : `${R}.no`);
      case 'encumbrance':
        return t(`${A}.encumbrance.${proposal[which]}`);
      case 'permitDate': {
        const value = proposal[which];
        return value === null ? t(`${R}.empty`) : formatCalendarDate(value);
      }
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
  const { originalPermit } = proposal;
  const original = originalPermit === null ? '' : `${originalPermit.number}/${originalPermit.year}`;
  return (
    <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
      {proposal.flags.map((flag) => <li key={flag}>{t(`${R}.flags.${flag}`, { form, original })}</li>)}
    </ul>
  );
}

const price = (value: number) => formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Οι παράμετροι κάθε έκβασης της διασταύρωσης — όλες οι τιμές ως κείμενο, στη μορφή της γλώσσας. */
function zoneCheckParams(check: ObjectiveValueZoneCheck): Record<string, string | number> {
  switch (check.kind) {
    case 'agrees':
      return { year: check.year, price: price(check.price) };
    case 'differs':
      return { year: check.year, documentPrice: price(check.documentPrice), mapPrice: price(check.mapPrice) };
    case 'superseded':
      return { year: check.year, documentPrice: price(check.documentPrice), validFrom: formatCalendarDay(check.validFrom, true) };
    case 'needs-location':
      return { year: check.year, documentPrice: price(check.documentPrice) };
  }
}

/** Η διασταύρωση της τιμής ζώνης του εγγράφου με τον χάρτη — δεν γεμίζει πεδίο, μόνο ενημερώνει. */
function ZoneCheck({ check }: { readonly check: ObjectiveValueZoneCheck }) {
  const { t } = useTranslation([NS]);
  return (
    <p className="m-0 text-sm text-foreground" role="status">
      {t(`${R}.zoneCheck.${check.kind}`, zoneCheckParams(check))}
    </p>
  );
}

interface ProposalProps {
  readonly document: ObjectiveValueEvidenceDocument;
  readonly row: ObjectiveValueDocumentRow;
  readonly draft: ObjectiveValueDraft;
  readonly mapZone: ObjectiveValueMapZone | null;
  readonly onApply: (application: ObjectiveValueReadingApplication) => void;
}

/** Οι προτάσεις της γραμμής — όλες επιλεγμένες αρχικά· «Συμπλήρωση επιλεγμένων» ή «όλων». */
function Proposal({ document, row, draft, mapZone, onApply }: ProposalProps) {
  const { t } = useTranslation([NS]);
  const proposal = useMemo(() => readingProposalOf(document, row, draft, mapZone), [document, row, draft, mapZone]);
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
      {proposal.zoneCheck !== null && <ZoneCheck check={proposal.zoneCheck} />}
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
  readonly mapZone: ObjectiveValueMapZone | null;
  readonly onApply: (application: ObjectiveValueReadingApplication) => void;
}

export function ObjectiveValueReadingReview({ document, rows, draft, mapZone, onApply }: ReadingReviewProps) {
  const { t } = useTranslation([NS]);
  const [selected, setSelected] = useState<number | null>(rows.length === 1 ? 0 : null);
  if (rows.length === 0) return <p className="m-0 text-sm text-foreground" role="status">{t(`${R}.noRows`)}</p>;
  const row = selected === null ? null : rows[selected] ?? null;
  return (
    <section className="flex flex-col gap-4">
      {rows.length > 1 && <RowPicker rows={rows} selected={selected} onSelect={setSelected} />}
      {row !== null && <Proposal key={selected} document={document} row={row} draft={draft} mapZone={mapZone} onApply={onApply} />}
    </section>
  );
}
