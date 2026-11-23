'use client';

/**
 * @fileoverview **Φόρμα ⇄ ΓΕΜΗ, ανά πεδίο** — ο πίνακας του «Έλεγχος στο ΓΕΜΗ» (ADR-948 §8 Βήμα 7).
 * @module components/contacts/ContactCompanyRegistryComparison
 *
 * 🏆 Πρακτική Oracle Sales / Salesforce enrichment: **ανά πεδίο** τι λέει η επαφή, τι λέει η πηγή, και ο άνθρωπος
 *    διαλέγει — ποτέ μαζική σιωπηλή αντικατάσταση. Πιο έξυπνα εδώ:
 *    - η σύγκριση τρέχει **πάνω στη φόρμα** (`liveRegistryComparison`) ⇒ το «Δέξου» πρασινίζει αμέσως, και το σήμα
 *      «Επαληθευμένο» σβήνει μόνο του αν ο άνθρωπος αλλάξει την τιμή·
 *    - η **έδρα** φαίνεται ανά μέρος και **δεν** γράφεται από εδώ: πηγαίνει ως πρόταση στον editor διευθύνσεων,
 *      όπου γεωκωδικοποιείται και επιβεβαιώνεται η πινέζα (ADR-332).
 * 🔑 «Όχι συγκρίσιμο» **δεν** είναι διαφορά: καμία πρόταση, κανένα κουμπί.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fieldLabels } from '@/config/company-gemi/labels/field-labels';
import { VOCAB_GEMI_STATUSES, VOCAB_LEGAL_FORMS } from '@/config/vocabulary/options/company';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FieldComparison, FieldComparisonState } from '@/lib/comparison/field-judgment';
import {
  SEAT_PARTS,
  type ContactRegistryComparison,
  type SeatFields,
} from '@/lib/company/contact-registry-comparison';
import {
  ACCEPTABLE_REGISTRY_FIELDS,
  canAcceptRegistryField,
  canProposeRegistrySeat,
  type AcceptableRegistryField,
} from '@/lib/company/registry-form-acceptance';
import { formatDate } from '@/lib/intl-formatting';

import {
  CONTACT_COMPANY_REGISTRY_STATE_KEYS as STATE_KEYS,
  CONTACT_COMPANY_REGISTRY_TABLE_KEYS as KEYS,
  CONTACT_COMPANY_SEAT_PART_KEYS as SEAT_PART_KEYS,
} from './contact-company-registry-labels';

type Translate = ReturnType<typeof useTranslation>['t'];

/** Το όνομα κάθε γραμμής = η **ίδια** ετικέτα που έχει το πεδίο στη φόρμα. */
const ROW_LABEL: Readonly<Record<AcceptableRegistryField, string>> = {
  legalName: fieldLabels.companyName,
  distinctiveTitle: fieldLabels.tradeName,
  gemiNumber: fieldLabels.gemiNumber,
  legalForm: fieldLabels.legalForm,
  status: fieldLabels.gemiStatus,
};

type VocabularyEntry = { readonly value: string; readonly label: string };

/** Ποια πεδία έχουν λεξιλόγιο τιμών — η τιμή φαίνεται με τη λέξη του, όχι ως κωδικός. */
const VALUE_VOCABULARY: Partial<Readonly<Record<AcceptableRegistryField, readonly VocabularyEntry[]>>> = {
  legalForm: VOCAB_LEGAL_FORMS,
  status: VOCAB_GEMI_STATUSES,
};

export interface ContactCompanyRegistryComparisonProps {
  readonly comparison: ContactRegistryComparison;
  readonly checkedAt: string;
  /** Η φόρμα είναι σε επεξεργασία — μόνο τότε υπάρχουν «Δέξου». */
  readonly canEdit: boolean;
  readonly onAccept: (field: AcceptableRegistryField) => void;
  readonly onProposeSeat: () => void;
}

function valueText(field: AcceptableRegistryField, value: string | null, tForms: Translate, t: Translate): string {
  if (value === null) return t(KEYS.empty);
  const entry = VALUE_VOCABULARY[field]?.find((option) => option.value === value);
  return entry === undefined ? value : tForms(entry.label);
}

function StateText({ state, checkedAt, t }: { readonly state: FieldComparisonState; readonly checkedAt: string; readonly t: Translate }) {
  const emphasis = state === 'match' ? 'font-medium text-foreground' : 'text-muted-foreground';
  return <span className={`text-xs ${emphasis}`}>{t(STATE_KEYS[state], { date: formatDate(checkedAt) })}</span>;
}

interface FieldRowProps {
  readonly field: AcceptableRegistryField;
  readonly row: FieldComparison<string>;
  readonly props: ContactCompanyRegistryComparisonProps;
  readonly t: Translate;
  readonly tForms: Translate;
}

/**
 * Η στήλη της πράξης **κρατά πάντα το ύψος του κουμπιού** (`h-9` = `Button size="sm"`) — ADR-948 §8.7.2.
 * Χωρίς αυτό, η «Αποδοχή» έσβηνε το κουμπί, η γραμμή κόνταινε, και σε κυλισμένο περιέκτη όλη η φόρμα «πηδούσε»
 * (μετρημένο 2026-11-23 στην ARIES Α.Ε.): το επόμενο κλικ μπορούσε να πέσει σε **άλλη** γραμμή. Καμία μετατόπιση
 * διάταξης μετά από πράξη χρήστη (Core Web Vitals · CLS).
 */
function ActionCell({ children }: { readonly children: React.ReactNode }) {
  return (
    <TableCell className="text-right">
      <div className="inline-flex h-9 items-center justify-end">{children}</div>
    </TableCell>
  );
}

function FieldRow({ field, row, props, t, tForms }: FieldRowProps) {
  const label = tForms(ROW_LABEL[field]);
  const acceptable = props.canEdit && canAcceptRegistryField(props.comparison, field);
  return (
    <TableRow>
      <TableHead scope="row" className="text-xs font-medium">{label}</TableHead>
      <TableCell className="text-xs">{valueText(field, row.contact, tForms, t)}</TableCell>
      <TableCell className="text-xs">{valueText(field, row.registry, tForms, t)}</TableCell>
      <TableCell><StateText state={row.state} checkedAt={props.checkedAt} t={t} /></TableCell>
      <ActionCell>
        {acceptable && (
          <Button type="button" variant="outline" size="sm" aria-label={t(KEYS.acceptAria, { field: label })} onClick={() => props.onAccept(field)}>
            {t(KEYS.accept)}
          </Button>
        )}
      </ActionCell>
    </TableRow>
  );
}

/** «Οδός Ερμού · Αριθμός 12 · …» — μόνο τα μέρη που υπάρχουν. */
function seatText(seat: SeatFields | null, t: Translate): string {
  if (seat === null) return t(KEYS.empty);
  return SEAT_PARTS.filter((part) => seat[part] !== null)
    .map((part) => `${t(SEAT_PART_KEYS[part])}: ${seat[part]}`)
    .join(' · ');
}

/** Τα μέρη της έδρας που **δεν** ταιριάζουν — ο άνθρωπος βλέπει ποιο μέρος διαφέρει. */
function SeatPartStates({ comparison, checkedAt, t }: { readonly comparison: ContactRegistryComparison; readonly checkedAt: string; readonly t: Translate }) {
  const parts = SEAT_PARTS.filter((part) => comparison.seat.parts[part] === 'missing' || comparison.seat.parts[part] === 'differs');
  if (parts.length === 0) return <StateText state={comparison.seat.state} checkedAt={checkedAt} t={t} />;
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
      {parts.map((part) => (
        <li key={part} className="text-xs text-muted-foreground">
          {t(SEAT_PART_KEYS[part])}: {t(STATE_KEYS[comparison.seat.parts[part]], { date: formatDate(checkedAt) })}
        </li>
      ))}
    </ul>
  );
}

function SeatRow({ props, t }: { readonly props: ContactCompanyRegistryComparisonProps; readonly t: Translate }) {
  const { comparison, checkedAt } = props;
  const proposable = props.canEdit && canProposeRegistrySeat(comparison);
  const hintId = React.useId();
  return (
    <TableRow>
      <TableHead scope="row" className="text-xs font-medium">{t(KEYS.seat)}</TableHead>
      <TableCell className="text-xs">{seatText(comparison.seat.contact, t)}</TableCell>
      <TableCell className="text-xs">{seatText(comparison.seat.registry, t)}</TableCell>
      <TableCell><SeatPartStates comparison={comparison} checkedAt={checkedAt} t={t} /></TableCell>
      <ActionCell>
        {proposable && (
          <Button type="button" variant="outline" size="sm" aria-describedby={hintId} onClick={props.onProposeSeat}>
            {t(KEYS.seatPropose)}
          </Button>
        )}
        {proposable && <p id={hintId} className="sr-only">{t(KEYS.seatProposeHint)}</p>}
      </ActionCell>
    </TableRow>
  );
}

export function ContactCompanyRegistryComparison(props: ContactCompanyRegistryComparisonProps) {
  const { t } = useTranslation('contacts-form');
  const { t: tForms } = useTranslation('forms');
  const { comparison } = props;
  return (
    <Table size="compact">
      <TableCaption className="text-left text-xs">{t(KEYS.caption)}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col" className="text-xs">{t(KEYS.field)}</TableHead>
          <TableHead scope="col" className="text-xs">{t(KEYS.contact)}</TableHead>
          <TableHead scope="col" className="text-xs">{t(KEYS.registry)}</TableHead>
          <TableHead scope="col" className="text-xs">{t(KEYS.state)}</TableHead>
          <TableHead scope="col" className="text-xs"><span className="sr-only">{t(KEYS.accept)}</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ACCEPTABLE_REGISTRY_FIELDS.map((field) => (
          <FieldRow key={field} field={field} row={comparison[field]} props={props} t={t} tForms={tForms} />
        ))}
        <SeatRow props={props} t={t} />
      </TableBody>
    </Table>
  );
}
